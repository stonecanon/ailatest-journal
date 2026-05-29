#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ScienceDirect 审稿周期爬取脚本
在学校/有订阅的电脑上运行，使用真实浏览器访问 ScienceDirect 文章页，
提取收稿(Received)→录用(Accepted)日期并计算审稿周期。

用法：
  pip3 install playwright
  playwright install chromium
  python3 crawl_sd_review_cycles.py

输出：sd_review_cycles.json（可在 VPS 上合并到 review_cycles.json）
"""

import json, os, re, time, sys, urllib.parse, urllib.request
from datetime import date, datetime
from pathlib import Path
from collections import defaultdict

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

# ====== 配置 ======
MAX_ARTICLES_PER_JOURNAL = 100      # 每刊最多爬取篇数
YEARS_BACK = 3                      # 近N年的文章
BATCH_SAVE_INTERVAL = 10            # 每爬完N个期刊保存一次
REQUEST_DELAY = 3.0                 # 每篇文章间隔（秒，防检测）
CROSSREF_USER_AGENT = "AILatest-Journal/1.0 (mailto:43259074+stonecanon@users.noreply.github.com)"
ELSEVIER_API_KEY = os.getenv("ELSEVIER_API_KEY", "").strip()
USE_BROWSER = os.getenv("SD_USE_BROWSER", "1").lower() not in {"0", "false", "no"}

# 目标期刊文件（需与 VPS 上的 data/target_journals_3fields.json 相同格式）
ROOT = Path(__file__).resolve().parent.parent
TARGET_FILE_CANDIDATES = [
    Path("target_journals_3fields.json"),
    ROOT / "data" / "target_journals_3fields.json",
]
OUTPUT_FILE = "sd_review_cycles.json"

# 如果 TARGET_FILE 不存在，也可以直接从期刊列表获取
# 手动指定期刊：以 ISSN 列表的形式
MANUAL_JOURNALS = [
    # 以下是环境/工程/计算机领域的 CAS zone 1 + SCIE 缺失期刊（前20个关键)
    {"issn": "0013-936X", "name": "ENVIRONMENTAL SCIENCE & TECHNOLOGY", "publisher": "ACS"},
    {"issn": "0043-1354", "name": "WATER RESEARCH", "publisher": "Elsevier"},
    {"issn": "0160-4120", "name": "ENVIRONMENT INTERNATIONAL", "publisher": "Elsevier"},
    {"issn": "0959-6526", "name": "JOURNAL OF CLEANER PRODUCTION", "publisher": "Elsevier"},
    {"issn": "0960-8524", "name": "BIORESOURCE TECHNOLOGY", "publisher": "Elsevier"},
    {"issn": "0304-3894", "name": "JOURNAL OF HAZARDOUS MATERIALS", "publisher": "Elsevier"},
    {"issn": "1383-5866", "name": "SEPARATION AND PURIFICATION TECHNOLOGY", "publisher": "Elsevier"},
    {"issn": "2210-6707", "name": "SUSTAINABLE CITIES AND SOCIETY", "publisher": "Elsevier"},
    {"issn": "1364-0321", "name": "RENEWABLE & SUSTAINABLE ENERGY REVIEWS", "publisher": "Elsevier"},
    {"issn": "0950-0618", "name": "CONSTRUCTION AND BUILDING MATERIALS", "publisher": "Elsevier"},
    {"issn": "0360-1323", "name": "BUILDING AND ENVIRONMENT", "publisher": "Elsevier"},
    {"issn": "0169-2046", "name": "LANDSCAPE AND URBAN PLANNING", "publisher": "Elsevier"},
    {"issn": "0925-5273", "name": "INTERNATIONAL JOURNAL OF PRODUCTION ECONOMICS", "publisher": "Elsevier"},
    {"issn": "1470-160X", "name": "ECOLOGICAL INDICATORS", "publisher": "Elsevier"},
    {"issn": "0031-3203", "name": "PATTERN RECOGNITION", "publisher": "Elsevier"},
    {"issn": "0957-4174", "name": "EXPERT SYSTEMS WITH APPLICATIONS", "publisher": "Elsevier"},
    {"issn": "0020-0255", "name": "INFORMATION SCIENCES", "publisher": "Elsevier"},
    {"issn": "1365-1609", "name": "INTERNATIONAL JOURNAL OF ROCK MECHANICS AND MINING SCIENCES", "publisher": "Elsevier"},
    {"issn": "0045-7825", "name": "COMPUTER METHODS IN APPLIED MECHANICS AND ENGINEERING", "publisher": "Elsevier"},
    {"issn": "2096-2754", "name": "UNDERGROUND SPACE", "publisher": "KEAI(Elsevier)"},
]

# ====== 辅助函数 ======

def load_targets():
    """加载目标期刊列表"""
    for target_file in TARGET_FILE_CANDIDATES:
        if not target_file.exists():
            continue
        try:
            with open(target_file) as f:
                return json.load(f)
        except Exception as e:
            print(f"提示：读取 {target_file} 失败: {e}")
    return MANUAL_JOURNALS


def get_dois_from_crossref(issn, rows=MAX_ARTICLES_PER_JOURNAL):
    """通过 CrossRef API 获取期刊最近的文章 DOI、PII 和 TDM 链接"""
    import ssl
    
    this_year = date.today().year
    from_date = f"{this_year - YEARS_BACK}-01-01"
    url = f"https://api.crossref.org/journals/{issn}/works?rows={rows}&filter=from-pub-date:{from_date}&sort=published&order=desc"
    
    ctx = ssl.create_default_context()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": CROSSREF_USER_AGENT})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            data = json.loads(r.read())
            items = data["message"]["items"]
            records = []
            for item in items:
                doi = item.get("DOI")
                if not doi:
                    continue
                links = item.get("link") or []
                xml_url = next((l.get("URL") for l in links if l.get("content-type") == "text/xml"), None)
                plain_url = next((l.get("URL") for l in links if l.get("content-type") == "text/plain"), None)
                pii = extract_pii_from_crossref_item(item, xml_url)
                records.append({
                    "doi": doi,
                    "pii": pii,
                    "xml_url": xml_url,
                    "plain_url": plain_url,
                })
            total = data["message"].get("total-results", 0)
            print(f"    CrossRef: 获取 {len(records)} 篇 (共 {total} 篇)")
            return records
    except Exception as e:
        print(f"    CrossRef 错误: {e}")
        return []


def extract_pii_from_crossref_item(item, xml_url=None):
    """CrossRef 的 alternative-id / TDM URL 通常包含 Elsevier PII。"""
    for value in item.get("alternative-id") or []:
        if isinstance(value, str) and re.match(r"^S\d{16,17}$", value):
            return value
    if xml_url:
        m = re.search(r"/PII:([^?/#]+)", xml_url, re.I)
        if m:
            return m.group(1)
    primary_url = ((item.get("resource") or {}).get("primary") or {}).get("URL", "")
    m = re.search(r"/pii/([^?/#]+)", primary_url, re.I)
    return m.group(1) if m else None


def fetch_url(url, headers=None, timeout=25):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def elsevier_article_url(record):
    """优先用 PII 调 Elsevier Article Retrieval API，避免 ScienceDirect 页面 CF。"""
    if record.get("pii"):
        pii = urllib.parse.quote(record["pii"], safe="")
        return f"https://api.elsevier.com/content/article/pii/{pii}?httpAccept=text%2Fxml"
    doi = urllib.parse.quote(record["doi"], safe="")
    return f"https://api.elsevier.com/content/article/doi/{doi}?httpAccept=text%2Fxml"


def fetch_dates_from_elsevier_api(record):
    """从 Elsevier API / CrossRef TDM XML 尝试提取文章历史。"""
    headers = {
        "User-Agent": CROSSREF_USER_AGENT,
        "Accept": "text/xml,application/xml,text/plain;q=0.8,*/*;q=0.5",
    }
    urls = []

    if ELSEVIER_API_KEY:
        headers["X-ELS-APIKey"] = ELSEVIER_API_KEY
        urls.append(elsevier_article_url(record) + "&view=FULL")

    # 无 API key 时这个接口通常只给 coredata；仍保留为低成本尝试。
    urls.append(record.get("xml_url") or elsevier_article_url(record))

    for url in [u for u in urls if u]:
        try:
            text = fetch_url(url, headers=headers)
        except Exception as e:
            print(f" API错误:{str(e)[:45]}", end="")
            continue
        received, accepted = extract_dates_from_text(text)
        if received and accepted:
            return received, accepted
    return None, None


def extract_dates(page, doi):
    """从 ScienceDirect 页面提取收稿/录用日期"""
    # 方法1: meta 标签
    received = accepted = None
    metas = page.eval_on_selector_all(
        'meta',
        "elements => elements.map(e => ({name: e.getAttribute('name'), content: e.getAttribute('content')}))"
    )
    for m in metas:
        name = (m['name'] or '').lower()
        content = (m['content'] or '').strip()
        if 'citation_received' in name or 'citation_date_received' in name:
            received = content
        elif 'citation_accepted' in name or 'citation_date_accepted' in name:
            accepted = content
    
    # 方法2: 页面文本中的 Article History
    if not received or not accepted:
        text = page.evaluate("() => document.body.innerText || ''")
        patterns = [
            (r'Received\s+(\d{1,2}\s+\w+\s+\d{4})', r'Accepted\s+(\d{1,2}\s+\w+\s+\d{4})'),
            (r'Received\s*:\s*(\d{1,2}\s+\w+\s+\d{4})', r'Accepted\s*:\s*(\d{1,2}\s+\w+\s+\d{4})'),
        ]
        for rec_pat, acc_pat in patterns:
            if not received:
                rm = re.search(rec_pat, text, re.IGNORECASE)
                if rm: received = rm.group(1)
            if not accepted:
                am = re.search(acc_pat, text, re.IGNORECASE)
                if am: accepted = am.group(1)
    
    return received, accepted


def strip_xml(text):
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def extract_dates_from_text(text):
    """从 XML/HTML/plain text 中提取 Received/Accepted。"""
    if not text:
        return None, None

    received = accepted = None

    meta_patterns = [
        (r'name=["\']citation(?:_date)?_received["\'][^>]*content=["\']([^"\']+)["\']', "received"),
        (r'name=["\']citation(?:_date)?_accepted["\'][^>]*content=["\']([^"\']+)["\']', "accepted"),
    ]
    for pat, kind in meta_patterns:
        m = re.search(pat, text, re.I)
        if m and kind == "received":
            received = m.group(1).strip()
        elif m and kind == "accepted":
            accepted = m.group(1).strip()

    xml_patterns = [
        (r"<[^>]*(?:date-received|received-date)[^>]*>(.*?)</[^>]+>", "received"),
        (r"<[^>]*(?:date-accepted|accepted-date)[^>]*>(.*?)</[^>]+>", "accepted"),
        (r"<[^>]*received[^>]*>\s*([^<]{4,80})\s*</[^>]+>", "received"),
        (r"<[^>]*accepted[^>]*>\s*([^<]{4,80})\s*</[^>]+>", "accepted"),
    ]
    for pat, kind in xml_patterns:
        m = re.search(pat, text, re.I | re.S)
        if not m:
            continue
        value = strip_xml(m.group(1)).strip(" :;,.")
        if value:
            if kind == "received" and not received:
                received = value
            elif kind == "accepted" and not accepted:
                accepted = value

    plain = strip_xml(text)
    plain_patterns = [
        (r"Received\s+(\d{1,2}\s+\w+\s+\d{4})", "received"),
        (r"Accepted\s+(\d{1,2}\s+\w+\s+\d{4})", "accepted"),
        (r"Received\s*:\s*([A-Za-z0-9,\-\s]{6,30})", "received"),
        (r"Accepted\s*:\s*([A-Za-z0-9,\-\s]{6,30})", "accepted"),
    ]
    for pat, kind in plain_patterns:
        m = re.search(pat, plain, re.I)
        if m and kind == "received" and not received:
            received = m.group(1).strip()
        elif m and kind == "accepted" and not accepted:
            accepted = m.group(1).strip()

    return received, accepted


def parse_date_to_days(received_str, accepted_str):
    """计算两个日期之间的天数"""
    if not received_str or not accepted_str:
        return None
    
    # 尝试多种格式
    formats = ['%d %B %Y', '%d %b %Y', '%Y-%m-%d', '%Y/%m/%d', '%B %d, %Y', '%b %d, %Y']
    rec = acc = None
    for fmt in formats:
        try:
            rec = datetime.strptime(received_str.strip(), fmt)
            break
        except: pass
    for fmt in formats:
        try:
            acc = datetime.strptime(accepted_str.strip(), fmt)
            break
        except: pass
    
    if rec and acc and acc > rec:
        days = (acc - rec).days
        if 0 < days < 1500:  # 合理范围
            return days
    return None


def crawl_journal(browser, journal, existing, new_data):
    """爬取单个期刊的所有文章"""
    issn = journal['issn']
    name = journal['name']
    
    # 跳过已有数据
    if issn in existing and existing[issn].get('median_days'):
        print(f"  ⏭️ 跳过（已有数据）")
        return
    
    if issn in new_data and new_data[issn].get('median_days'):
        print(f"  ⏭️ 跳过（本轮已爬）")
        return
    
    print(f"\n{'='*60}")
    print(f"📰 {name}")
    print(f"   ISSN: {issn}")
    
    # Step 1: 获取 DOI / PII 列表
    records = get_dois_from_crossref(issn)
    if not records:
        print(f"   ❌ 无文章数据")
        new_data[issn] = {"name": name, "n": 0, "error": "no_dois", "updated": date.today().isoformat()}
        return
    
    # Step 2: 浏览器访问每篇文章
    days_list = []
    success = 0
    total = len(records)
    
    page = None
    if browser:
        context = browser.contexts[0]
        page = context.new_page()
    
    for i, record in enumerate(records):
        doi = record["doi"]
        pii = record.get("pii")
        sd_url = f"https://www.sciencedirect.com/science/article/pii/{pii}" if pii else f"https://doi.org/{doi}"
        
        try:
            print(f"    [{i+1}/{total}] 访问 {doi[:50]}...", end=" ", flush=True)
            received, accepted = fetch_dates_from_elsevier_api(record)

            if (not received or not accepted) and page:
                page.goto(sd_url, wait_until='domcontentloaded', timeout=30000)
                page.wait_for_timeout(2000)

                # 检查是否被拦截
                body = page.evaluate("() => document.body.innerText.substring(0, 200)")
                if 'problem providing' in body.lower() or 'contact our support' in body.lower():
                    print(f"❌ 被拦截")
                    time.sleep(REQUEST_DELAY)
                    continue

                # 提取日期
                received, accepted = extract_dates(page, doi)

            if received and accepted:
                days = parse_date_to_days(received, accepted)
                if days:
                    days_list.append(days)
                    success += 1
                    print(f"✅ {days}d  (收稿:{received} 录用:{accepted})")
                else:
                    print(f"⚠️ 日期无法计算: {received} ~ {accepted}")
            else:
                print(f"❌ 无日期 (rec={received}, acc={accepted})")
        
        except Exception as e:
            print(f"⚠️ 错误: {str(e)[:60]}")
        
        time.sleep(REQUEST_DELAY)
        
        # 如果已收集足够数据，提前结束
        if success >= MAX_ARTICLES_PER_JOURNAL:
            print(f"    ✓ 已收集 {success} 篇，提前结束")
            break
    
    if page:
        page.close()
    
    # Step 3: 计算统计值
    if days_list:
        days_list.sort()
        n = len(days_list)
        median_days = days_list[n // 2]
        mean_days = sum(days_list) / n
        
        new_data[issn] = {
            "name": name,
            "issn": issn,
            "source": "Elsevier/ScienceDirect (browser)",
            "n": n,
            "median_days": int(median_days),
            "mean_days": round(mean_days, 1),
            "min_days": min(days_list),
            "max_days": max(days_list),
            "updated": date.today().isoformat(),
        }
        print(f"\n   ✅ {name}: 中位 {int(median_days)} 天 (n={n})")
    else:
        new_data[issn] = {
            "name": name,
            "issn": issn,
            "n": 0,
            "error": "no_dates_found",
            "updated": date.today().isoformat(),
        }
        print(f"\n   ❌ {name}: 未找到日期数据")


def main():
    print("=" * 60)
    print("ScienceDirect 审稿周期爬虫")
    print(f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    print()
    print("提示：优先走 CrossRef + Elsevier API；必要时才回退到 ScienceDirect 浏览器页面")
    if ELSEVIER_API_KEY:
        print("   已检测到 ELSEVIER_API_KEY，将尝试 Article Retrieval API full view")
    else:
        print("   未检测到 ELSEVIER_API_KEY，API 可能只返回 coredata，日期命中率会低")
    print()
    
    # 加载目标
    targets = load_targets()
    print(f"目标期刊: {len(targets)} 本")
    
    # 加载已有数据
    existing = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE) as f:
            existing = json.load(f)
        print(f"已有数据: {len(existing)} 条")
    
    new_data = {}
    
    browser = None
    if not USE_BROWSER:
        for idx, journal in enumerate(targets):
            print(f"\n--- 第 {idx+1}/{len(targets)} 刊 ---")
            crawl_journal(None, journal, existing, new_data)
        merged = {**existing, **new_data}
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(merged, f, ensure_ascii=False, sort_keys=True, indent=2)
        return

    if sync_playwright is None:
        print("未安装 playwright，无法回退浏览器抓取。可设置 ELSEVIER_API_KEY 或安装 playwright。")
        sys.exit(1)

    # 启动浏览器
    print("\n正在启动浏览器...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,  # 真实浏览器窗口，避免被检测
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='zh-CN',
        )
        
        # 移除 webdriver 标记
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        """)
        
        # 先打开一个页面测试访问；403 时不中止，因为 API 路径可能仍可跑。
        test_page = context.new_page()
        print("正在测试 ScienceDirect 访问...")
        test_page.goto('https://www.sciencedirect.com', wait_until='domcontentloaded', timeout=30000)
        test_page.wait_for_timeout(2000)
        test_body = test_page.evaluate("() => document.body.innerText.substring(0, 200)")
        if 'problem providing' in test_body.lower():
            print("⚠️ ScienceDirect 页面被拦截，后续将主要依赖 Elsevier API。")
            print(f"   返回信息: {test_body[:100]}")
        else:
            print("✅ ScienceDirect 页面访问正常！")
        test_page.close()
        
        # 逐期刊爬取
        for idx, journal in enumerate(targets):
            print(f"\n--- 第 {idx+1}/{len(targets)} 刊 ---")
            crawl_journal(browser, journal, existing, new_data)
            
            # 定期保存
            if (idx + 1) % BATCH_SAVE_INTERVAL == 0:
                # 合并并保存
                merged = {**existing, **new_data}
                with open(OUTPUT_FILE, 'w') as f:
                    json.dump(merged, f, ensure_ascii=False, sort_keys=True, indent=2)
                print(f"\n💾 已保存 {len(merged)} 条到 {OUTPUT_FILE}")
        
        browser.close()
    
    # 最终保存
    merged = {**existing, **new_data}
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(merged, f, ensure_ascii=False, sort_keys=True, indent=2)
    
    # 汇总
    with_data = sum(1 for v in merged.values() if v.get('median_days'))
    print(f"\n{'='*60}")
    print(f"完成！")
    print(f"  总条目: {len(merged)}")
    print(f"  有数据: {with_data} 刊")
    print(f"  输出文件: {OUTPUT_FILE}")
    print(f"\n将 {OUTPUT_FILE} 复制到 VPS 上，然后运行: ")
    print(f"  python3 merge_sd_data.py")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
