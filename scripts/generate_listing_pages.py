#!/usr/bin/env python3
"""Generate static SEO landing pages for /subjects/* (WoS categories top 100) and /indexes/* (5 indexes).
Also generates landing pages and updates sitemap.

Usage: python3 scripts/generate_listing_pages.py
"""

import gzip, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
JOURNALS_GZ = DATA_DIR / 'journals.json.gz'
WOS_CATS_FILE = DATA_DIR / 'wos_categories.json'
CITIC_WARNING_FILE = ROOT / 'list' / 'topeditsci_citic_2025_warning.json'
SITE_URL = 'https://journal.ailatest.org'

def load_journals():
    with open(JOURNALS_GZ, 'rb') as f:
        return json.loads(gzip.decompress(f.read()))

def load_wos_categories():
    with open(WOS_CATS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Sort by count descending, take all
    data.sort(key=lambda x: -x['count'])
    # Build: (slug, title, desc, wos_name)
    result = []
    for item in data:
        name = item['name']
        slug = name.lower().replace(' & ', '-').replace(' &', '-').replace('& ', '-')
        slug = slug.replace(' & ', '-').replace('&', '-').replace(',', '').replace("'", '')
        slug = slug.replace('(', '').replace(')', '').replace(' ', '-').replace('--', '-').strip('-')
        desc = f'{name} journals — browse top journals in the Web of Science {name} category with Impact Factor, Quartile, CAS tier and indexing information.'
        result.append((slug, name, desc, name))
    # Sort alphabetically by title
    result.sort(key=lambda x: x[1].lower())
    print(f'  Generated {len(result)} subject entries')
    return result

SUBJECTS = None  # will be loaded from wos_categories.json at runtime

# 索引 + 特殊状态列表
INDEXES = [
    ('scie', 'SCIE', 'SCIE (Science Citation Index Expanded) indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['SCIE'], 'index'),
    ('ssci', 'SSCI', 'SSCI (Social Sciences Citation Index) indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['SSCI'], 'index'),
    ('ahci', 'AHCI', 'AHCI (Arts & Humanities Citation Index) indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['AHCI'], 'index'),
    ('esci', 'ESCI', 'ESCI (Emerging Sources Citation Index) indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['ESCI'], 'index'),
    ('ei', 'EI', 'EI Compendex indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['EI'], 'index'),
    ('scopus', 'Scopus', 'Scopus indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', None, 'index'),
    ('medline', 'MEDLINE', 'MEDLINE indexed journals from the National Library of Medicine with Impact Factors, Quartiles, CAS rankings and publisher information.', None, 'index'),
]

WARNING_LISTS = [
    ('under-review', '新锐 Under Review', '新锐版(Under Review)期刊 — 正在被 Web of Science 评审的期刊，含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
    ('on-hold', 'WoS On Hold', 'Web of Science On Hold 期刊 — 因质量问题被 Clarivate 暂停收录评估的期刊，含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
    ('cas-warning', '中科院预警', '中科院文献情报中心国际期刊预警名单 — 含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
    ('citic-warning', '中信所预警', '中信所(中国科学技术信息研究所)国际期刊预警名单(2025) — 含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
]

ALL_INDEX_PAGES = INDEXES + WARNING_LISTS

# Historical broad ESI subject URLs kept as lightweight bridge pages so old
# links do not fall back to stale templates.
LEGACY_SUBJECT_PAGES = [
    ('agricultural-sciences', 'Agricultural Sciences'),
    ('biology-biochemistry', 'Biology & Biochemistry'),
    ('chemistry', 'Chemistry'),
    ('computer-science', 'Computer Science'),
    ('environment-ecology', 'Environment / Ecology'),
    ('materials-science', 'Materials Science'),
    ('molecular-biology-genetics', 'Molecular Biology & Genetics'),
    ('neuroscience-behavior', 'Neuroscience & Behavior'),
    ('pharmacology-toxicology', 'Pharmacology & Toxicology'),
    ('physics', 'Physics'),
    ('plant-animal-science', 'Plant & Animal Science'),
    ('psychiatry-psychology', 'Psychiatry / Psychology'),
    ('social-sciences', 'Social Sciences'),
]

def esc(s):
    if s is None: return ''
    return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

def norm_issn(s):
    return ''.join(ch for ch in str(s or '').upper() if ch.isdigit() or ch == 'X')

def norm_title(s):
    return ''.join(ch.lower() for ch in str(s or '') if ch.isalnum())

def load_citic_warning_rows(journals):
    if not CITIC_WARNING_FILE.exists():
        return [j for j in journals if j.get('citic_warning')]
    with open(CITIC_WARNING_FILE, encoding='utf-8') as f:
        source = json.load(f)

    by_issn = {}
    by_title = {}
    for j in journals:
        for field in ('issn', 'eissn'):
            key = norm_issn(j.get(field))
            if key and key not in by_issn:
                by_issn[key] = j
        for field in ('name', 'en_name', 'cn_name'):
            key = norm_title(j.get(field))
            if key and key not in by_title:
                by_title[key] = j

    rows = []
    for idx, item in enumerate(source.get('items', [])):
        keys = [norm_issn(item.get('issn')), norm_issn(item.get('eissn'))]
        matched = next((by_issn[k] for k in keys if k and k in by_issn), None)
        if matched is None:
            matched = by_title.get(norm_title(item.get('journal_name')))
        if matched is not None:
            row = dict(matched)
            row['_citic_source_only'] = False
        else:
            row = {
                'name': item.get('journal_name') or '',
                'issn': item.get('issn') or '',
                'eissn': item.get('eissn') or '',
                'publisher': item.get('publisher') or '',
                'citic_warning': True,
                '_citic_source_only': True,
            }
        row['_citic_source'] = item
        row['citic_warning_order'] = item.get('no', idx + 1) - 1
        rows.append(row)
    return rows

CACHE_VERSION = '20260716-index-v7'

APP_RAIL_HTML = '''<aside class="app-rail" aria-label="Primary navigation">
  <nav class="rail-top" aria-label="站点">
    <a class="rail-nav-btn" href="/global" aria-label="全球期刊" title="全球期刊">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 3.4 9A14 14 0 0 1 12 21a14 14 0 0 1-3.4-9A14 14 0 0 1 12 3Z"/></svg>
      <span>全球</span>
    </a>
    <a class="rail-nav-btn rail-region-station" data-region-station="dom" href="/cn" aria-label="中国期刊" title="中国期刊">
      <span class="rail-flag" aria-hidden="true">CN</span>
      <span>中国</span>
    </a>
    <a class="rail-nav-btn rail-region-station" data-region-station="in" href="/in" aria-label="印度期刊" title="印度期刊" hidden>
      <span class="rail-flag" aria-hidden="true">IN</span>
      <span>印度</span>
    </a>
    <a class="rail-nav-btn rail-region-station" data-region-station="my" href="/my" aria-label="马来西亚期刊" title="马来西亚期刊" hidden>
      <span class="rail-flag" aria-hidden="true">MY</span>
      <span>马来西亚</span>
    </a>
    <a class="rail-nav-btn rail-region-station" data-region-station="kr" href="/kr" aria-label="韩国期刊" title="韩国期刊" hidden>
      <span class="rail-flag" aria-hidden="true">KR</span>
      <span>韩国</span>
    </a>
    <div class="rail-region-picker">
      <button class="rail-nav-btn rail-region-toggle" type="button" aria-label="地区站点" title="地区站点" aria-expanded="false">
        <span class="rail-flag rail-region-symbol" aria-hidden="true">···</span>
        <span><span>地区</span><b class="rail-caret" aria-hidden="true">▾</b></span>
      </button>
      <div class="rail-region-menu" aria-label="地区站点">
        <button class="rail-region-option rail-nav-btn" type="button" data-region-pin="dom" aria-label="中国期刊" title="中国期刊">
          <span class="rail-flag" aria-hidden="true">CN</span>
          <span>中国</span>
        </button>
        <button class="rail-region-option rail-nav-btn" type="button" data-region-pin="in" aria-label="印度期刊" title="印度期刊">
          <span class="rail-flag" aria-hidden="true">IN</span>
          <span>印度</span>
        </button>
        <button class="rail-region-option rail-nav-btn" type="button" data-region-pin="my" aria-label="马来西亚期刊" title="马来西亚期刊">
          <span class="rail-flag" aria-hidden="true">MY</span>
          <span>马来西亚</span>
        </button>
        <button class="rail-region-option rail-nav-btn" type="button" data-region-pin="kr" aria-label="韩国期刊" title="韩国期刊">
          <span class="rail-flag" aria-hidden="true">KR</span>
          <span>韩国</span>
        </button>
      </div>
    </div>
  </nav>
  <div class="rail-bottom" aria-label="账户与工具">
    <a class="rail-nav-btn active" href="/rankings/" aria-label="榜单" title="索引/学科排行榜 &amp; 预警名单">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 21V11"/><path d="M12 21V7"/><path d="M16 21V3"/><path d="M4 21h16"/></svg>
      <span>榜单</span>
    </a>
    <a class="rail-nav-btn" href="/favorites" aria-label="我的收藏" title="我的收藏">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.7l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3.7z"/></svg>
      <span>收藏</span>
    </a>
    <a class="rail-nav-btn account-credit-badge" href="/account" aria-label="我的" title="我的">
      <span class="rail-account-mark">我</span>
      <b>我的</b>
    </a>
  </div>
</aside>'''

SKELETON = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>__TITLE__</title>
<meta name="description" content="__DESC__" />
<link rel="canonical" href="__CANONICAL__" />
<meta property="og:title" content="__TITLE__" />
<meta property="og:description" content="__DESC__" />
<meta name="robots" content="index,follow" />
<meta name="theme-color" content="#f97316" />
__JSONLD__
<link rel="stylesheet" href="/css/listing.css?v=__CACHE_VERSION__" />
</head>
<body>
__APP_RAIL__
<header class="listing-topbar">
  <a href="/" class="listing-brand">AILatest <em>Journal</em></a>
  <span class="listing-section-title">期刊榜单</span>
  <nav>
    <a href="/">首页</a>
    <a href="/#rankings">榜单</a>
    <a href="/#download">下载</a>
    <a href="/about">关于</a>
    <a href="/contact">联系</a>
  </nav>
</header>
<div class="wrap">
  <h1>__HEADING__</h1>
  <p class="breadcrumb"><a href="/">首页</a> · <a href="/#rankings">榜单</a> · <a href="__BACK__">__BACK_LABEL__</a></p>
  <p class="sub">__DESC__</p>
  <p class="count">__COUNT__</p>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr>__HEADERS__</tr></thead>
    <tbody>__ROWS__</tbody>
  </table></div></div>
  <p class="back-wrap"><a class="back" href="__BACK__">← 返回</a></p>
</div>
<footer class="footer">© 2026 <a href="/">AILatest Journal</a> · <a href="/about">关于</a> · <a href="/contact">联系</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a> · <a href="/refund.html">Refund</a></footer>
<script src="/js/site-rail.js?v=__CACHE_VERSION__" defer></script>
</body>
</html>
'''

def make_slug(r):
    s = r.get('slug', '').strip()
    return s or (r.get('issn') or r.get('eissn') or '').replace('-', '').strip()

def match_index(j, slug, index_keys):
    indices = j.get('indices') or []
    if slug == 'scopus': return bool((j.get('scopus') or {}).get('active'))
    if slug == 'medline': return bool(j.get('medline'))
    if slug == 'under-review': return bool(j.get('under_review'))
    if slug == 'on-hold': return bool(j.get('on_hold'))
    if slug == 'cas-warning': return bool(j.get('warning'))
    if slug == 'citic-warning': return bool(j.get('citic_warning'))
    return any(k in indices for k in index_keys)

def match_subject(j, wos_name):
    cats = j.get('wos_categories') or []
    return wos_name in cats

def build_table_row(j, origin, headers, extra_cells=None, seq=0):
    slug = make_slug(j)
    name = j.get('name') or j.get('en_name') or j.get('cn_name') or ''
    if_v = j.get('if_2024')
    q = (j.get('if_quartile') or '').upper()
    z = f"{j.get('cas_zone')}区" if j.get('cas_zone') is not None else '—'
    inds = ', '.join((j.get('indices') or [])[:4]) or '—'
    source = j.get('_citic_source') or {}
    pub = source.get('publisher') or j.get('publisher') or '—'
    issn = source.get('issn') or j.get('issn') or '—'
    eissn = source.get('eissn') or j.get('eissn') or ''
    cells = []
    ec = iter(extra_cells or [])
    for h in headers:
        if h == 'num':
            cells.append(f'<td class="row-num">{seq}</td>')
        elif h == 'name':
            if j.get('_citic_source_only'):
                cells.append(f'<td>{esc(name)}</td>')
            else:
                cells.append(f'<td><a href="{origin}/journal/{esc(slug)}/">{esc(name)}</a></td>')
        elif h == 'if': cells.append(f'<td>{esc(str(if_v)) if if_v is not None else "—"}</td>')
        elif h == 'q': cells.append(f'<td>{esc(q) if q else "—"}</td>')
        elif h == 'z': cells.append(f'<td>{esc(z)}</td>')
        elif h == 'idx': cells.append(f'<td>{esc(inds)}</td>')
        elif h == 'pub': cells.append(f'<td>{esc(pub)}</td>')
        elif h == 'issn':
            issn_text = issn if not eissn else f'{issn} / {eissn}' if issn and issn != '—' else eissn
            cells.append(f'<td>{esc(issn_text)}</td>')
        elif h == 'status': cells.append(f'<td>{next(ec, "")}</td>')
    return '<tr>' + ''.join(cells) + '</tr>'

def generate_subjects(journals, origin):
    for slug, title, desc, wos_name in SUBJECTS:
        matched = [j for j in journals if match_subject(j, wos_name)]
        matched.sort(key=lambda x: -(x.get('if_2024') or -1))
        top = matched[:100]

        headers = ['num', 'name', 'if', 'q', 'z', 'idx', 'pub']
        th_html = ''.join(f'<th>{esc(h)}</th>' for h in ['#', '期刊', '影响因子', 'JCR 分区', '中科院', '索引', '出版商'])
        rows_html = '\n'.join(build_table_row(j, origin, headers, seq=i+1) for i, j in enumerate(top))

        total = len(matched)
        seo_title = f'{title} 期刊 — 影响因子与分区 | AILatest Journal'
        seo_desc = f'{desc} 共 {total} 种期刊，按影响因子排序。'
        canonical = f'{origin}/subjects/{slug}/'
        count = f'按影响因子降序展示前 {len(top)} / 共 {total} 种期刊（字段与主站一致：IF · JCR · 中科院 · 索引 · 出版商）。'

        item_list = [{'@type': 'ListItem', 'position': i+1,
            'item': {'@type': 'Periodical', 'name': j.get('name',''), 'url': f'{origin}/journal/{esc(make_slug(j))}/'}}
            for i, j in enumerate(top[:50])]
        jsonld_tag = f'<script type="application/ld+json">\n' + json.dumps(
            {'@context': 'https://schema.org', '@type': 'ItemList', 'name': f'{title} Journals',
             'description': desc, 'url': canonical, 'itemListElement': item_list}, ensure_ascii=False) + '\n</script>'

        html = SKELETON.replace('__TITLE__', esc(seo_title)).replace('__DESC__', esc(seo_desc))
        html = html.replace('__CACHE_VERSION__', CACHE_VERSION).replace('__APP_RAIL__', APP_RAIL_HTML)
        html = html.replace('__HEADING__', esc(f'{title} 期刊'))
        html = html.replace('__CANONICAL__', esc(canonical)).replace('__JSONLD__', jsonld_tag)
        html = html.replace('__ORIGIN__', origin)
        html = html.replace('__COUNT__', esc(count)).replace('__HEADERS__', th_html)
        html = html.replace('__ROWS__', rows_html).replace('__BACK__', f'{origin}/subjects/').replace('__BACK_LABEL__', '学科排行榜')
        (ROOT / 'subjects' / slug).mkdir(parents=True, exist_ok=True)
        (ROOT / 'subjects' / slug / 'index.html').write_text(html, encoding='utf-8', newline='\n')
        print(f'  /subjects/{slug}/ → {len(top)}/{total} journals')

def generate_indexes(journals, origin):
    for slug, title, desc, index_keys, table_type in ALL_INDEX_PAGES:
        if slug == 'citic-warning':
            matched = load_citic_warning_rows(journals)
        else:
            matched = [j for j in journals if match_index(j, slug, index_keys or [])]
        if table_type == 'status':
            # 状态列表：保持原始数据源顺序，不按 IF 排序
            order_key = (lambda x: x.get('warning_order', 999999)) if slug == 'cas-warning' \
                else (lambda x: x.get('on_hold_order', 999999)) if slug == 'on-hold' \
                else (lambda x: x.get('citic_warning_order', 999999)) if slug == 'citic-warning' \
                else (lambda x: x.get('under_review_order', 999999))
            matched.sort(key=order_key)
        else:
            matched.sort(key=lambda x: -(x.get('if_2024') or -1))
        top = matched[:200]
        if table_type == 'status':
            # 状态列表：加 Status 徽章列
            if slug == 'citic-warning':
                headers = ['num', 'name', 'issn', 'if', 'q', 'z', 'status', 'pub']
                th_labels = ['#', '期刊', 'ISSN / EISSN', '影响因子', 'JCR 分区', '中科院', '状态', '出版商']
            else:
                headers = ['num', 'name', 'if', 'q', 'z', 'status', 'pub']
                th_labels = ['#', '期刊', '影响因子', 'JCR 分区', '中科院', '状态', '出版商']
            th_html = ''.join(f'<th>{esc(h)}</th>' for h in th_labels)
            def status_badge(j):
                if slug == 'under-review': return '<span class="pill pill-under-review">新锐 Under Review</span>'
                if slug == 'on-hold': return '<span class="pill pill-on-hold">WoS On Hold</span>'
                if slug == 'cas-warning':
                    # 提取年份
                    w = j.get('warning')
                    years = set()
                    if isinstance(w, dict) and w.get('year'):
                        years.add(str(w['year']))
                    elif isinstance(w, list):
                        for wi in w:
                            if wi.get('year'): years.add(str(wi['year']))
                    year_str = ', '.join(sorted(years, reverse=True)) if years else ''
                    if year_str:
                        return f'<span class="pill pill-warning">中科院预警 {year_str}</span>'
                    return '<span class="pill pill-warning">中科院预警</span>'
                if slug == 'citic-warning':
                    return '<span class="pill pill-citic-warning">中信所预警 2025</span>'
                return ''
            rows_html = '\n'.join(
                build_table_row(j, origin, headers, extra_cells=[status_badge(j)], seq=i+1) for i, j in enumerate(top)
            )
            seo_title = f'{title} | AILatest Journal'
        else:
            headers = ['num', 'name', 'if', 'q', 'z', 'issn', 'pub']
            th_html = ''.join(f'<th>{esc(h)}</th>' for h in ['#', '期刊', '影响因子', 'JCR 分区', '中科院', 'ISSN', '出版商'])
            rows_html = '\n'.join(build_table_row(j, origin, headers, seq=i+1) for i, j in enumerate(top))
            seo_title = f'{title} 收录期刊 | AILatest Journal'
        seo_desc = desc
        canonical = f'{origin}/indexes/{slug}/'
        if table_type == 'status':
            count = f'共 {len(top)} 本{title}期刊（按原列表排序；字段：影响因子 · JCR · 中科院 · 状态 · 出版商）'
            jsonld_name = f'{title}'
        else:
            count = f'按影响因子降序展示 {len(top)} 种 {title} 收录期刊（字段与主站一致：IF · JCR · 中科院 · ISSN · 出版商）。'
            jsonld_name = f'{title} Indexed Journals'

        item_list = []
        for i, j in enumerate(top[:50]):
            item = {'@type': 'Periodical', 'name': j.get('name', '')}
            if not j.get('_citic_source_only'):
                item['url'] = f'{origin}/journal/{esc(make_slug(j))}/'
            item_list.append({'@type': 'ListItem', 'position': i + 1, 'item': item})
        jsonld_tag = f'<script type="application/ld+json">\n' + json.dumps(
            {'@context': 'https://schema.org', '@type': 'ItemList', 'name': jsonld_name,
             'description': desc, 'url': canonical, 'itemListElement': item_list}, ensure_ascii=False) + '\n</script>'

        html = SKELETON.replace('__TITLE__', esc(seo_title)).replace('__DESC__', esc(seo_desc))
        html = html.replace('__CACHE_VERSION__', CACHE_VERSION).replace('__APP_RAIL__', APP_RAIL_HTML)
        html = html.replace('__HEADING__', esc(f'{title} 期刊'))
        html = html.replace('__CANONICAL__', esc(canonical)).replace('__JSONLD__', jsonld_tag)
        html = html.replace('__ORIGIN__', origin)
        html = html.replace('__COUNT__', esc(count)).replace('__HEADERS__', th_html)
        back_path = f'{origin}/indexes/warning/' if table_type == 'status' else f'{origin}/indexes/'
        back_label = '预警名单' if table_type == 'status' else '索引排行榜'
        html = html.replace('__ROWS__', rows_html).replace('__BACK__', back_path).replace('__BACK_LABEL__', back_label)
        (ROOT / 'indexes' / slug).mkdir(parents=True, exist_ok=True)
        (ROOT / 'indexes' / slug / 'index.html').write_text(html, encoding='utf-8', newline='\n')
        print(f'  /indexes/{slug}/ → {len(top)} journals')

def generate_landing(origin):
    subjects = SUBJECTS
    indexes = INDEXES
    warning_lists = WARNING_LISTS

    def shell(page_title, meta_desc, canonical, heading, sub, body_html, back_href=None, minimal=False):
        back = f'<p class="back-wrap"><a class="back" href="{esc(back_href)}">← 返回榜单</a></p>' if back_href and not minimal else ''
        intro = '' if minimal else f'''  <h1>{esc(heading)}</h1>
  <p class="breadcrumb"><a href="/">首页</a> · <a href="/#rankings">榜单</a></p>
  <p class="sub">{esc(sub)}</p>'''
        wrap_class = 'wrap ranking-entry-wrap' if minimal else 'wrap'
        redirect = ''
        return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{esc(page_title)}</title>
<meta name="description" content="{esc(meta_desc)}" />
<link rel="canonical" href="{esc(canonical)}" />
<meta name="robots" content="index,follow" />
<meta name="theme-color" content="#f97316" />
<link rel="stylesheet" href="/css/listing.css?v={CACHE_VERSION}" />
{redirect}
</head>
<body>
{APP_RAIL_HTML}
<header class="listing-topbar">
  <a href="/" class="listing-brand">AILatest <em>Journal</em></a>
  <span class="listing-section-title">期刊榜单</span>
  <nav>
    <a href="/">首页</a>
    <a href="/#rankings">榜单</a>
    <a href="/#download">下载</a>
    <a href="/about">关于</a>
    <a href="/contact">联系</a>
  </nav>
</header>
<div class="{wrap_class}">
{intro}
  {body_html}
  {back}
</div>
<footer class="footer">© 2026 <a href="/">AILatest Journal</a> · <a href="/about">关于</a> · <a href="/contact">联系</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a> · <a href="/refund.html">Refund</a></footer>
<script src="/js/site-rail.js?v={CACHE_VERSION}" defer></script>
</body>
</html>
'''

    # Subjects landing
    r_list = '\n'.join(f'<li><a href="{origin}/subjects/{s}/" class="cat-link"><strong>{esc(t)}</strong></a></li>' for s, t, _, _ in subjects)
    r_html = shell(
        '学科排行榜 | AILatest Journal',
        '按 Web of Science 学科浏览期刊榜单，按影响因子排序。',
        f'{origin}/subjects/',
        '学科排行榜',
        '选择一个 Web of Science 学科，浏览该学科影响因子靠前的期刊。',
        f'<div class="card"><ul class="cat-list">{r_list}</ul></div>',
        f'{origin}/#rankings',
    )
    (ROOT / 'subjects').mkdir(parents=True, exist_ok=True)
    (ROOT / 'subjects' / 'index.html').write_text(r_html, encoding='utf-8', newline='\n')
    print('  /subjects/ (landing)')

    # 索引 / 预警落地页：统一由 write_rank_landings.py 输出（UTF-8 + 新设计）
    # 避免旧 shell 模板编码损坏；勿再写 index-card-grid 旧布局
    import subprocess, sys
    script = ROOT / 'scripts' / 'write_rank_landings.py'
    subprocess.check_call([sys.executable, str(script)], cwd=str(ROOT / 'scripts'))
    print('  /indexes/ + /indexes/warning/ via write_rank_landings.py')

    # 榜单入口由 SPA 接管（_redirects → index.html）。
    # 切勿再生成 rankings/index.html + location.replace('/')，否则侧栏点「榜单」
    # 会先整页跳到首页再靠 pendingTab 切回，造成明显闪烁。
    rankings_dir = ROOT / 'rankings'
    if rankings_dir.exists():
        for child in rankings_dir.iterdir():
            if child.is_file():
                child.unlink()
            elif child.is_dir():
                import shutil
                shutil.rmtree(child)
        try:
            rankings_dir.rmdir()
        except OSError:
            pass
    print('  /rankings/ → SPA (no static stub)')

    bridge_body = f'''<div class="ranking-choice-grid">
  <a class="ranking-choice" href="{origin}/subjects/"><strong>进入学科排行榜</strong><span>旧版 ESI 大类页面已合并到 Web of Science 学科排行榜。</span></a>
  <a class="ranking-choice" href="{origin}/indexes/"><strong>查看索引排行榜</strong><span>按 SCIE、SSCI、EI、Scopus 等索引浏览期刊。</span></a>
  <a class="ranking-choice" href="{origin}/rankings/"><strong>返回榜单入口</strong><span>在榜单入口选择索引、学科或预警名单。</span></a>
</div>'''
    for slug, title in LEGACY_SUBJECT_PAGES:
        legacy_html = shell(
            f'{title} | AILatest Journal',
            f'{title} 旧版 ESI 大类页面已合并到 AILatest Journal 学科排行榜。',
            f'{origin}/subjects/{slug}/',
            f'{title} 已合并',
            '旧版 ESI 大类页面已合并到新的学科排行榜，请从下面入口继续浏览。',
            bridge_body,
            f'{origin}/subjects/',
        )
        (ROOT / 'subjects' / slug).mkdir(parents=True, exist_ok=True)
        (ROOT / 'subjects' / slug / 'index.html').write_text(legacy_html, encoding='utf-8', newline='\n')
    print(f'  legacy /subjects/* bridge pages: {len(LEGACY_SUBJECT_PAGES)}')

def update_sitemap(origin):
    # Journal detail URLs live in a sitemap index (split into bounded chunks).
    # Keep the small, frequently changing landing-page set in its own urlset
    # so this script never makes the journal chunks exceed Google's limit.
    sitemap_path = ROOT / 'sitemap-static.xml'
    if not sitemap_path.exists():
        sitemap_path.write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            '</urlset>\n', encoding='utf-8'
        )
    existing = sitemap_path.read_text(encoding='utf-8')
    new_urls = []
    new_urls.append(f'  <url><loc>{origin}/indexes/</loc><priority>0.7</priority></url>')
    for slug, _, _, _, _ in ALL_INDEX_PAGES:
        new_urls.append(f'  <url><loc>{origin}/indexes/{slug}/</loc><priority>0.7</priority></url>')
    new_urls.append(f'  <url><loc>{origin}/indexes/warning/</loc><priority>0.7</priority></url>')
    new_urls.append(f'  <url><loc>{origin}/subjects/</loc><priority>0.7</priority></url>')
    for slug, _, _, _ in SUBJECTS:
        new_urls.append(f'  <url><loc>{origin}/subjects/{slug}/</loc><priority>0.7</priority></url>')
    # Remove old generated listing URLs before inserting the fresh set.
    lines = existing.split('\n')
    clean = [l for l in lines if '/rankings/' not in l and '/subjects/' not in l and '/indexes/' not in l]
    existing = '\n'.join(clean)
    if '</urlset>' in existing:
        existing = existing.replace('</urlset>', '\n'.join(new_urls) + '\n</urlset>')
    sitemap_path.write_text(existing, encoding='utf-8')
    print(f'  sitemap-static.xml: updated with {len(new_urls)} new URLs')

def main():
    global SUBJECTS
    origin = SITE_URL
    print('Loading journals...')
    journals = load_journals()
    print(f'Loaded {len(journals)} journals')

    print('Loading WoS categories...')
    SUBJECTS = load_wos_categories()
    print(f'Top {len(SUBJECTS)} WoS subjects:')
    for s, t, _, c in SUBJECTS:
        cnt = sum(1 for j in journals if match_subject(j, c))
        print(f'  {t}: {cnt} journals')
    print()

    print('Generating subjects pages...')
    generate_subjects(journals, origin)
    print('Generating indexes pages...')
    generate_indexes(journals, origin)
    print('Generating landing pages...')
    generate_landing(origin)
    print('Updating sitemap...')
    update_sitemap(origin)
    print('Done!')

if __name__ == '__main__':
    main()
