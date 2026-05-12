#!/usr/bin/env python3
"""解析《中国科协科学技术创新部高质量科技期刊分级目录总汇》PDF。

多版式兼容：
  A. 表格式：名 | ISSN | CN       （建筑科学、煤炭、管理、照明等）
  B. 序号表：分级 | 序号 | 名 | ISSN | CN  （煤炭扩展式）
  C. 两栏式：tier 标签 + 左栏名 + 右栏名（临床医学早期分册）
  D. 单列: 刊名 + tier 右列      （地球科学数据）

分栏检测：对每页做 span 扫描，把 x 聚合成列 bin，其中「宽文本列」若有 2 条
且 count 接近，则判为两栏；否则单栏。跨行合并同列连续文本作为刊名。
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path
from collections import defaultdict, Counter

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDF  = ROOT / 'list' / '中国科协科学技术创新部高质量科技期刊分级目录总汇.pdf'
OUT  = ROOT / 'data' / 'cnkx_tiers.json'

RE_DOMAIN = re.compile(r'([\u4e00-\u9fff（）A-Za-z \-\(\)]+?)(?:领域)?高质量(?:科技)?期刊分级目录\s*[（(]共\s*(\d+)\s*种[)）]')
RE_ISSN   = re.compile(r'\b\d{4}-\d{3}[\dX]\b')
RE_CN     = re.compile(r'\bCN?\s*\d{1,2}-\d{4}\s*/[A-Z\d]+\b', re.IGNORECASE)
RE_TIER   = re.compile(r'^T[123]$')
RE_TIER_HDR = re.compile(r'入选\s*T([123])\s*级期刊')
RE_NUM    = re.compile(r'^\d{1,4}$')


def norm_cn(s: str) -> str:
    s = re.sub(r'\s+', '', s)
    if not s.upper().startswith('CN'): s = 'CN' + s
    return s.upper()


def page_spans(page):
    spans = []
    d = page.get_text('dict')
    for blk in d.get('blocks', []):
        for ln in blk.get('lines', []):
            for sp in ln.get('spans', []):
                t = (sp.get('text') or '').strip()
                if not t: continue
                x0, y0, x1, y1 = sp['bbox']
                spans.append({'x': x0, 'xr': x1, 'y': y0, 'h': y1-y0, 't': t})
    return spans


def cluster_cols(spans):
    """把文字列（非 ISSN/CN/tier/纯数字）x 聚成 bin。返回 [(x_center, count)]."""
    xs = []
    for s in spans:
        t = s['t']
        if RE_TIER.match(t): continue
        if RE_ISSN.search(t) and len(t) < 15: continue
        if RE_CN.search(t) and len(t) < 20: continue
        if RE_NUM.match(t) and len(t) < 4: continue
        xs.append(s['x'])
    if not xs: return []
    xs.sort()
    bins = []
    cur = [xs[0]]
    for x in xs[1:]:
        if x - cur[-1] < 12:
            cur.append(x)
        else:
            bins.append(cur)
            cur = [x]
    bins.append(cur)
    return [(sum(b)/len(b), len(b)) for b in bins]


def parse_page(page, current_domain, state):
    """state 持有 pending_tier 跨页传递。返回新 records."""
    spans = page_spans(page)
    text = page.get_text('text')

    # 域标题
    m = RE_DOMAIN.search(text)
    if m:
        current_domain['name'] = m.group(1).strip()
        state['pending_tier'] = None

    # 行级 tier header
    for mt in RE_TIER_HDR.finditer(text):
        state['pending_tier'] = 'T' + mt.group(1)

    if not current_domain['name']:
        return []

    # 聚合 span 成 row（y_tol=3），行内按 x 排
    y_tol = 3
    rows = defaultdict(list)
    for s in spans:
        rows[round(s['y']/y_tol)*y_tol].append(s)
    row_list = []
    for k in sorted(rows):
        r = sorted(rows[k], key=lambda s: s['x'])
        row_list.append(r)

    # 找主文本 column bins (按 count > 3 过滤)
    bins = cluster_cols(spans)
    text_cols = sorted([(x, c) for x, c in bins if c >= 3])

    # 判断 2-col 名字版式：两列 x 差 > 120 且 count 比例均衡
    name_col_xs = []
    if len(text_cols) >= 2:
        # 取 count 最大的两列
        top2 = sorted(text_cols, key=lambda p: -p[1])[:2]
        top2.sort()
        if (top2[1][0] - top2[0][0] > 120
                and min(top2[0][1], top2[1][1]) * 2 >= max(top2[0][1], top2[1][1])):
            name_col_xs = [top2[0][0], top2[1][0]]

    records = []

    if name_col_xs:
        # ===== 2-column name layout =====
        # 左/右 按 span.x 就近归属；tier 由低 x (< 110) 标签触发
        left_x, right_x = name_col_xs
        left_buf = []; right_buf = []
        def flush(col_buf, tier):
            if not col_buf: return
            name = ' '.join(col_buf).strip()
            col_buf.clear()
            if not name or name in ('期刊名','期刊名称'): return
            # 清洗 name
            issn_m = RE_ISSN.search(name); issn = issn_m.group(0) if issn_m else ''
            cn_m   = RE_CN.search(name);   cn   = norm_cn(cn_m.group(0)) if cn_m else ''
            name = RE_ISSN.sub('', name); name = RE_CN.sub('', name); name = name.strip(' -—,')
            if name:
                records.append({'name': name, 'issn': issn, 'cn_code': cn,
                                'tier': tier, 'domain': current_domain['name']})
        for row in row_list:
            # 检测 row 开头 tier 标签
            for s in row:
                if RE_TIER.match(s['t']) and s['x'] < 115:
                    # 换 tier 前 flush
                    flush(left_buf, state['pending_tier'])
                    flush(right_buf, state['pending_tier'])
                    state['pending_tier'] = s['t']
                    break
            # 分列积累文本（排除 tier 标签自身、纯序号、域/节标题）
            for s in row:
                t = s['t']
                if RE_TIER.match(t) and s['x'] < 115: continue
                if RE_NUM.match(t) and len(t) < 4 and s['x'] < 110: continue
                if '高质量' in t or '期刊分级目录' in t: continue
                if t in ('级别','期刊名称','期刊名','ISSN','CN','分级','序号'): continue
                if '编制单位' in t or '发布时间' in t or '修订时间' in t: continue
                if t.startswith('《') and t.endswith('》'):
                    # 子分册标题：flush 但保持当前 tier
                    flush(left_buf, state['pending_tier'])
                    flush(right_buf, state['pending_tier'])
                    continue
                # 分栏归属
                dL = abs(s['x'] - left_x); dR = abs(s['x'] - right_x)
                if dL < dR and dL < 80:
                    # 新条目触发：检测 ISSN/新大写英文开头且前面 buffer 像完整 record
                    left_buf.append(t)
                elif dR < 80:
                    right_buf.append(t)
        flush(left_buf, state['pending_tier'])
        flush(right_buf, state['pending_tier'])
        # 两栏模式下 name 以行换新条目启发：若长 buf 含多个 journal，无法拆分。
        # 简单 post-process：如果 name 明显是两条被连起（含两次大写英文起），留作 single record。
        return records

    # ===== 表格式（A/B/D）=====
    # 逐 row：寻找 tier label (第一个 span RE_TIER) / ISSN / CN / 名字
    for row in row_list:
        tier = None
        name_parts = []
        issn = ''; cn = ''
        for s in row:
            t = s['t']
            if RE_TIER.match(t) and s['x'] < 120:
                tier = t; continue
            if RE_NUM.match(t) and len(t) < 4 and s['x'] < 135: continue
            if t in ('级别','期刊名称','期刊名','ISSN','CN','分级','序号','期刊名 ISSN CN'): continue
            if '编制单位' in t or '发布时间' in t or '修订时间' in t: continue
            if '高质量' in t and '期刊分级目录' in t: continue
            if t.startswith('《') and t.endswith('》'): continue
            issn_m = RE_ISSN.search(t)
            cn_m   = RE_CN.search(t)
            if issn_m and len(t) <= 12:
                issn = issn_m.group(0); continue
            if cn_m and len(t) <= 20:
                cn = norm_cn(cn_m.group(0)); continue
            if issn_m: 
                issn = issn or issn_m.group(0)
                t = RE_ISSN.sub('', t)
            if cn_m:
                cn = cn or norm_cn(cn_m.group(0))
                t = RE_CN.sub('', t)
            t = t.strip()
            if t: name_parts.append(t)
        if tier: state['pending_tier'] = tier
        name = ' '.join(name_parts).strip()
        if not name and not issn and not cn: continue
        if not name: continue  # 表头行
        use_tier = tier or state['pending_tier']
        if not use_tier: continue
        records.append({'name': name, 'issn': issn, 'cn_code': cn,
                        'tier': use_tier, 'domain': current_domain['name']})

    # 合并跨行 name：若上一条 name 无 ISSN/CN 且本条 name 也无 ISSN/CN 且 tier 相同，可能是换行
    merged = []
    for r in records:
        if (merged and not merged[-1]['issn'] and not merged[-1]['cn_code']
                and not r['issn'] and not r['cn_code']
                and merged[-1]['tier'] == r['tier']
                and merged[-1]['domain'] == r['domain']
                and len(merged[-1]['name']) < 50):
            # 仅在右侧无 ISSN/CN 的 A 版式下可能（但会误合并），保守处理：只当前一条 name 末尾没结束英文时
            prev = merged[-1]['name']
            if not re.search(r'[\u4e00-\u9fff]$', prev) and not re.search(r'[A-Z]$', prev):
                merged[-1]['name'] = prev + ' ' + r['name']
                continue
        merged.append(r)
    return merged


def main():
    doc = pymupdf.open(PDF)
    current_domain = {'name': ''}
    state = {'pending_tier': None}
    all_records = []
    domains_seen = []
    seen_domain = set()

    for pi in range(4, len(doc)):
        page = doc[pi]
        prev = current_domain['name']
        recs = parse_page(page, current_domain, state)
        if current_domain['name'] and current_domain['name'] != prev:
            if current_domain['name'] not in seen_domain:
                seen_domain.add(current_domain['name'])
                domains_seen.append({'name': current_domain['name'], 'page': pi+1})
        all_records.extend(recs)

    # 去重
    seen = set(); uniq = []
    for r in all_records:
        key = (r['domain'], r['tier'], r['name'], r['issn'], r['cn_code'])
        if key in seen: continue
        seen.add(key); uniq.append(r)

    tc = Counter(r['tier'] for r in uniq)
    dc = Counter(r['domain'] for r in uniq)
    print(f'domains: {len(domains_seen)}')
    print(f'records uniq: {len(uniq)}')
    print(f'tiers: {dict(tc)}')
    print(f'with ISSN: {sum(1 for r in uniq if r["issn"])}')
    print(f'with CN:   {sum(1 for r in uniq if r["cn_code"])}')
    print('top 10 domains:')
    for d, c in dc.most_common(10):
        print(f'  {d}: {c}')

    OUT.write_text(json.dumps({
        'source': '中国科协科学技术创新部 · 高质量科技期刊分级目录总汇 · 2025-12',
        'domains': domains_seen,
        'records': uniq,
    }, ensure_ascii=False), encoding='utf-8')
    print(f'wrote {OUT}')
    doc.close()


if __name__ == '__main__':
    sys.exit(main())
