#!/usr/bin/env python3
"""
爬取高影响因子期刊官网的审稿周期数据。

策略：
1. 从target_journals.json读取需要爬的期刊（CAS zone1, SCIE/SSCI, 无已有数据）
2. 通过CrossRef API获取每个期刊最近3年的最200篇论文的DOI
3. 访问论文出版商的页面，解析meta标签中的收稿/录用日期
4. 计算每个期刊的平均审稿周期（收稿→录用天数）
5. 合并到review_cycles.json

支持的出版商：
- Elsevier (ScienceDirect): <meta name="citation_received/accepted">
- IEEE Xplore: HTML类日期信息
- 其他：通用meta/schema.org解析
"""

import json
import time
import re
import sys
import os
import requests
from datetime import datetime, date
from collections import defaultdict
from urllib.parse import urlparse
from bs4 import BeautifulSoup

# ---------- 配置 ----------
CROSSREF_BASE = "https://api.crossref.org/works"
CROSSREF_PAGE_SIZE = 200  # 每期刊获取的最多论文数
MAX_YEARS = 3        # 最近3年的论文
REQUESTS_DELAY = 0.3  # 请求间隔（秒）
CROSSREF_DELAY = 0.1  # CrossRef API间隔
REQUEST_TIMEOUT = 15

TARGET_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                           "data", "target_journals_3fields.json")
REVIEW_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                           "data", "review_cycles.json")
OUTPUT_FILE = REVIEW_FILE  # 直接合并到review_cycles.json

# ---------- 辅助函数 ----------

def get_session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "HermesAgent/1.0 (mailto:jiantaoweng@gmail.com) ReviewCycleCrawler",
        "Accept": "application/json, text/html, */*",
    })
    return s

session = get_session()

def crossref_search(issn, rows=200, years=3):
    """通过ISSN查找期刊最近几年的论文，返回DOI列表"""
    this_year = date.today().year
    from_date = f"{this_year - years}-01-01"
    
    dois = []
    offset = 0
    total = None
    
    while True:
        params = {
            "filter": f"issn:{issn},from-pub-date:{from_date}",
            "rows": min(rows - len(dois), 100),
            "offset": offset,
            "sort": "published",
            "order": "desc",
        }
        if len(dois) >= rows:
            break
        
        try:
            resp = session.get(CROSSREF_BASE, params=params, timeout=REQUEST_TIMEOUT)
            time.sleep(CROSSREF_DELAY)
            if resp.status_code != 200:
                print(f"  CrossRef error {resp.status_code}: {resp.text[:200]}")
                break
            data = resp.json()
            items = data.get("message", {}).get("items", [])
            if not items:
                break
            total = data.get("message", {}).get("total-results", 0)
            
            for item in items:
                doi = item.get("DOI")
                if doi:
                    dois.append(doi.upper())
            
            offset += len(items)
            if len(items) < 100:
                break
        except Exception as e:
            print(f"  CrossRef error: {e}")
            break
    
    print(f"  CrossRef: {len(dois)} DOIs (total={total})")
    return dois[:rows]


def fetch_page(url):
    """获取页面HTML"""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        time.sleep(REQUESTS_DELAY)
        if resp.status_code == 200:
            return resp.text
        return None
    except Exception as e:
        return None


def extract_dates_elsevier(html, doi):
    """从Elsevier/ScienceDirect页面提取收稿和录用日期"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # 方法1: meta标签
    received = None
    accepted = None
    for meta in soup.find_all('meta'):
        name = (meta.get('name', '') or '').strip().lower()
        content = (meta.get('content', '') or '').strip()
        if 'citation_received' in name or 'citation_submitted' in name:
            received = content
        elif 'citation_accepted' in name or 'citation_accept' in name:
            accepted = content
        elif 'citation_online_date' in name:
            if not accepted:
                accepted = content
    
    # 方法2: HTML结构数据（ScienceDirect新版）
    if not received or not accepted:
        patterns = [
            (r'Received\s+(\d{1,2}\s+\w+\s+\d{4})', r'Accepted\s+(\d{1,2}\s+\w+\s+\d{4})'),
            (r'Received\s*:?\s*(\d{4}-\d{2}-\d{2})', r'Accepted\s*:?\s*(\d{4}-\d{2}-\d{2})'),
        ]
        text = soup.get_text()
        for rec_pat, acc_pat in patterns:
            rec_m = re.search(rec_pat, text, re.IGNORECASE)
            acc_m = re.search(acc_pat, text, re.IGNORECASE)
            if rec_m and acc_m:
                if not received: received = rec_m.group(1)
                if not accepted: accepted = acc_m.group(1)
                break
    
    # 方法3: schema.org JSON-LD
    if not received or not accepted:
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                import json as _json
                data = _json.loads(script.string) if script.string else {}
                if isinstance(data, dict):
                    potential_action = data.get('potentialAction', {})
                    if not received:
                        sd_date = potential_action.get('startTime', '') or \
                                  data.get('dateReceived', '') or data.get('dateSubmitted', '')
                        if sd_date: received = sd_date
                    if not accepted:
                        sa_date = potential_action.get('endTime', '') or \
                                  data.get('dateAccepted', '') or data.get('datePublished', '')
                        if sa_date: accepted = sa_date
            except:
                pass
    
    return received, accepted


def extract_dates_ieee(html, doi):
    """从IEEE Xplore页面提取收稿和录用日期"""
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text()
    
    received = None
    accepted = None
    revised = None
    
    # IEEE日期格式: "Date of Submission: 01-Jan-2023", "Date Accepted: 15-May-2023"
    # 或者 "Date of Publication: 20-Jun-2023"
    
    patterns = [
        (r'(?:Date\s*of\s*)?[Ss]ubmission\s*:?\s*(\d{1,2}[- ]\w+[- ]\d{4})'),
        (r'(?:Date\s*of\s*)?[Rr]eceived\s*:?\s*(\d{1,2}[- ]\w+[- ]\d{4})'),
        (r'(?:Date\s*of\s*)?[Aa]ccepted\s*:?\s*(\d{1,2}[- ]\w+[- ]\d{4})'),
        (r'(?:Date\s*of\s*)?[Aa]ccept\s*:?\s*(\d{1,2}[- ]\w+[- ]\d{4})'),
        (r'(?:Date\s*of\s*)?[Rr]evised\s*:?\s*(\d{1,2}[- ]\w+[- ]\d{4})'),
        (r'(?:Date\s*of\s*)?[Pp]ublication\s*:?\s*(\d{1,2}[- ]\w+[- ]\d{4})'),
    ]
    
    # 从meta标签
    for meta in soup.find_all('meta'):
        name = (meta.get('name', '') or '').strip().lower()
        content = (meta.get('content', '') or '').strip()
        if 'citation_received' in name or 'citation_submitted' in name or 'citation_date_submitted' in name:
            received = content
        elif 'citation_accepted' in name:
            accepted = content
    
    # 从页面文本
    if not received or not accepted:
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                # 尝试多种日期格式
                parsed = parse_date(date_str)
                if parsed:
                    if 'received' in pattern or 'submission' in pattern:
                        if not received: received = parsed
                    elif 'accepted' in pattern or 'accept' in pattern:
                        if not accepted: accepted = parsed
                    elif 'revised' in pattern:
                        if not revised: revised = parsed
    
    # 尝试IEEE Xplore特定的JSON-LD
    if not received or not accepted:
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string) if script.string else {}
                if isinstance(data, dict):
                    if not received:
                        received = data.get('dateReceived', '') or received
                    if not accepted:
                        accepted = data.get('dateAccepted', '') or accepted
            except:
                pass
    
    return received, accepted, revised


def parse_date(date_str):
    """解析多种日期格式为YYYY-MM-DD字符串"""
    if not date_str:
        return None
    
    date_str = date_str.strip()
    
    # 已经是 ISO 格式
    if re.match(r'^\d{4}-\d{2}-\d{2}', date_str):
        return date_str[:10]
    
    # 常见格式
    formats = [
        '%d %B %Y',      # "15 January 2023"
        '%d-%b-%Y',      # "15-Jan-2023"
        '%d %b %Y',      # "15 Jan 2023"
        '%B %d, %Y',     # "January 15, 2023"
        '%b %d, %Y',     # "Jan 15, 2023"
        '%d-%m-%Y',      # "15-01-2023"
        '%Y/%m/%d',      # "2023/01/15"
        '%m/%d/%Y',      # "01/15/2023"
        '%d/%m/%Y',      # "15/01/2023"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    return None


def determine_publisher(html, doi):
    """从页面内容推断出版商"""
    text = html.lower() if html else ""
    
    if 'sciencedirect' in text or 'elsevier' in text or 'science\xadirect' in text:
        return 'elsevier'
    if 'ieeexplore' in text or 'ieee.org' in text:
        return 'ieee'
    if 'springer' in text or 'link.springer' in text:
        return 'springer'
    if 'taylor & francis' in text or 'tandfonline' in text:
        return 'tandf'
    if 'wiley' in text or 'onlinelibrary.wiley' in text:
        return 'wiley'
    if 'nature.com' in text or 'nature publishing' in text:
        return 'nature'
    if 'acs.org' in text or 'pubs.acs' in text:
        return 'acs'
    if 'oup.com' in text or 'academic.oup' in text or 'oxford' in text:
        return 'oup'
    if 'annualreviews' in text:
        return 'annualreviews'
    
    # 从DOI前缀判断
    if doi:
        prefix = doi.split('/')[0].lower() if '/' in doi else ''
        if prefix in ['10.1016', '10.1017', '10.1010']:
            return 'elsevier'
        elif prefix in ['10.1109']:
            return 'ieee'
        elif prefix in ['10.1007', '10.1002', '10.1038']:
            return 'springer_nature'
        elif prefix in ['10.1080']:
            return 'tandf'
        elif prefix in ['10.1002']:
            return 'wiley'
        elif prefix in ['10.1021']:
            return 'acs'
        elif prefix in ['10.1093']:
            return 'oup'
    
    return 'unknown'


def extract_dates_generic(html, doi):
    """通用提取方案：尝试各种已知的meta标签和结构"""
    soup = BeautifulSoup(html, 'html.parser')
    
    received = None
    accepted = None
    
    # 通用meta标签
    meta_names = {
        'received': ['citation_received', 'citation_submitted', 'citation_date_submitted',
                     'dc.date.submitted', 'prism.receiveddate', 'dcterms.dateSubmitted'],
        'accepted': ['citation_accepted', 'citation_date_accepted', 'dc.date.accepted',
                     'prism.accepteddate', 'dcterms.dateAccepted'],
    }
    
    for meta in soup.find_all('meta'):
        name = (meta.get('name', '') or meta.get('property', '') or '').strip().lower()
        content = (meta.get('content', '') or '').strip()
        
        for key, names in meta_names.items():
            if any(n in name for n in names):
                if key == 'received' and not received:
                    received = parse_date(content)
                elif key == 'accepted' and not accepted:
                    accepted = parse_date(content)
    
    # JSON-LD
    if not received or not accepted:
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string) if script.string else {}
                if isinstance(data, dict):
                    if not received:
                        received = parse_date(data.get('dateReceived', '') or data.get('dateSubmitted', ''))
                    if not accepted:
                        accepted = parse_date(data.get('dateAccepted', '') or data.get('datePublished', ''))
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            if not received:
                                received = parse_date(item.get('dateReceived', '') or item.get('dateSubmitted', ''))
                            if not accepted:
                                accepted = parse_date(item.get('dateAccepted', '') or item.get('datePublished', ''))
            except:
                pass
    
    # 页面文本搜索
    if not received or not accepted:
        text = html[:50000]  # 前50KB
        patterns = [
            (r'(?:Received|Submitted|Received Date)\s*:?\s*(\d{1,2}\s+\w+\s+\d{4})',
             r'(?:Accepted|Acceptance Date)\s*:?\s*(\d{1,2}\s+\w+\s+\d{4})'),
            (r'(?:Received|Submitted)\s*:?\s*(\d{4}-\d{2}-\d{2})',
             r'(?:Accepted|Acceptance)\s*:?\s*(\d{4}-\d{2}-\d{2})'),
        ]
        for rec_pat, acc_pat in patterns:
            rec_m = re.search(rec_pat, text, re.IGNORECASE)
            acc_m = re.search(acc_pat, text, re.IGNORECASE)
            if rec_m and not received:
                received = parse_date(rec_m.group(1))
            if acc_m and not accepted:
                accepted = parse_date(acc_m.group(1))
            if received and accepted:
                break
    
    return received, accepted


def compute_days(received, accepted):
    """计算从收稿到录用的天数"""
    try:
        rec = datetime.strptime(received[:10], '%Y-%m-%d') if received else None
        acc = datetime.strptime(accepted[:10], '%Y-%m-%d') if accepted else None
        if rec and acc and acc > rec:
            return (acc - rec).days
    except:
        pass
    return None


def process_journal(journal):
    """处理单个期刊：获取DOI→爬文章页→提取日期→计算审稿周期"""
    name = journal['name']
    issn = journal['issn']
    eissn = journal.get('eissn', '')
    field = journal.get('field', '')
    publisher_hint = journal.get('publisher', '')
    
    print(f"\n{'='*60}")
    print(f"[{field}] {name}")
    print(f"  ISSN: {issn}  Pub: {publisher_hint}")
    
    # Step 1: 通过CrossRef获取DOI列表
    dois = crossref_search(issn, rows=CROSSREF_PAGE_SIZE, years=MAX_YEARS)
    
    if not dois:
        # 尝试eissn
        if eissn:
            print(f"  Retrying with EISSN: {eissn}")
            dois = crossref_search(eissn, rows=CROSSREF_PAGE_SIZE, years=MAX_YEARS)
    
    if not dois:
        print(f"  ❌ No DOIs found")
        return None
    
    # Step 2: 访问每个DOI的页面并提取日期
    days_list = []
    processed = 0
    success = 0
    
    for doi in dois:
        url = f"https://doi.org/{doi}"
        
        html = fetch_page(url)
        if not html:
            processed += 1
            continue
        
        # 确定出版商
        publisher = determine_publisher(html, doi)
        
        # 根据出版商选择提取方法
        received, accepted = None, None
        if publisher == 'elsevier':
            received, accepted = extract_dates_elsevier(html, doi)
        elif publisher == 'ieee':
            r, a, _ = extract_dates_ieee(html, doi)
            received, accepted = r, a
        else:
            received, accepted = extract_dates_generic(html, doi)
        
        if received and accepted:
            days = compute_days(received, accepted)
            if days and 1 <= days <= 730:  # 合理的审稿周期
                days_list.append(days)
                success += 1
        
        processed += 1
        
        if len(dois) >= 50 and success >= 100:
            # 已有足够样本，提前结束
            break
        
        if processed % 50 == 0:
            print(f"  Progress: {processed}/{len(dois)} (success={success})")
    
    if not days_list:
        print(f"  ❌ No review cycle data extracted ({processed} pages visited)")
        return None
    
    # Step 3: 计算统计值
    days_list.sort()
    n = len(days_list)
    mean_days = sum(days_list) / n
    median_days = days_list[n // 2] if n % 2 else (days_list[n//2-1] + days_list[n//2]) / 2
    p25 = days_list[n // 4]
    p75 = days_list[3 * n // 4]
    
    result = {
        "source": "website_crawl",
        "field": field,
        "n": n,
        "mean_days": round(mean_days, 1),
        "median_days": round(median_days, 1),
        "p25": round(p25, 1),
        "p75": round(p75, 1),
        "min_days": min(days_list),
        "max_days": max(days_list),
        "samples": days_list[:50],  # 仅保存前50个样本
        "crawl_date": date.today().isoformat(),
        "publisher_hint": publisher_hint,
    }
    
    print(f"  ✅ n={n}  mean={result['mean_days']}d  median={result['median_days']}d  (p25-p75: {p25}-{p75})")
    return result


def main():
    # 加载目标期刊列表
    with open(TARGET_FILE) as f:
        targets = json.load(f)
    
    print(f"目标期刊数: {len(targets)}")
    print(f"覆盖领域: {sorted(set(t['field'] for t in targets))}")
    print(f"时间范围: 最近{MAX_YEARS}年")
    print(f"每期刊最多: {CROSSREF_PAGE_SIZE}篇论文")
    
    # 加载已有数据
    existing = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE) as f:
            existing = json.load(f)
    print(f"已有审稿周期数据: {len(existing)} 条")
    
    results = {}
    completed = 0
    skipped = 0
    
    for journal in targets:
        issn = journal['issn']
        eissn = journal.get('eissn', '')
        
        # 跳过已有数据
        if issn in existing or eissn in existing:
            print(f"\n⏭️ 跳过（已有数据）: {journal['name']}")
            skipped += 1
            results[issn] = existing.get(issn) or existing.get(eissn)
            continue
        
        result = process_journal(journal)
        if result:
            results[issn] = result
            # 保存到已有数据
            existing[issn] = result
            with open(OUTPUT_FILE, 'w') as f:
                json.dump(existing, f, ensure_ascii=False)
        else:
            results[issn] = {"source": "website_crawl", "n": 0, "crawl_date": date.today().isoformat()}
            existing[issn] = {"source": "website_crawl", "n": 0, "crawl_date": date.today().isoformat()}
            with open(OUTPUT_FILE, 'w') as f:
                json.dump(existing, f, ensure_ascii=False)
        
        completed += 1
        elapsed = time.time() - start_time if 'start_time' in dir() else 0
        print(f"\n  [{completed}/{len(targets)}] 耗时: {elapsed:.0f}s" if 'start_time' in dir() else "")
    
    # 汇总
    print(f"\n{'='*60}")
    print(f"完成！")
    print(f"  总目标: {len(targets)}")
    print(f"  已处理: {completed}")
    print(f"  已跳过: {skipped}")
    
    fields = {}
    for issn, r in results.items():
        f = r.get('field', 'unknown')
        if f not in fields:
            fields[f] = {"total": 0, "with_data": 0}
        fields[f]["total"] += 1
        if r.get("n", 0) > 0:
            fields[f]["with_data"] += 1
    
    for field, stats in sorted(fields.items()):
        print(f"  {field}: {stats['with_data']}/{stats['total']} 有数据")


if __name__ == "__main__":
    start_time = time.time()
    
    # 检查依赖
    try:
        import bs4
    except ImportError:
        print("安装 bs4: pip3 install beautifulsoup4")
        sys.exit(1)
    
    main()
