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
    ('under-review', '新锐 Under Review', '新锐版(Under Review)期刊 — 正在被 Web of Science 评审的期刊，含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
    ('on-hold', 'WoS On Hold', 'Web of Science On Hold 期刊 — 因质量问题被 Clarivate 暂停收录评估的期刊，含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
    ('warning', '中科院预警', '中科院文献情报中心国际期刊预警名单 — 含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
    ('citic-warning', '中信所预警', '中信所(中国科学技术信息研究所)国际期刊预警名单(2025) — 含影响因子、分区、CAS 等级和索引信息。', None, 'status'),
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

SKELETON = '''<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__</title>
<meta name="description" content="__DESC__" />
<link rel="canonical" href="__CANONICAL__" />
<meta property="og:title" content="__TITLE__" />
<meta property="og:description" content="__DESC__" />
<meta name="robots" content="index,follow" />
<meta name="theme-color" content="#b4531f" />
__JSONLD__
<style>
:root{--accent:#b4531f;--accent-light:#f59e0b;--bg:#f7f5f0;--paper:#fff;--ink:#1c1917;--ink-soft:#6b6559;--rule:#e3ddd0;--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
*{box-sizing:border-box}
body{font-family:var(--sans);margin:0;padding:0;background:var(--bg);color:var(--ink);line-height:1.6}
.header{background:var(--paper);border-bottom:1px solid var(--rule);padding:14px 20px;position:sticky;top:0;z-index:10}
.header-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:16px}
.header a{color:var(--ink);text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em}
.header a:hover{color:var(--accent)}
.header .logo{display:flex;align-items:center;gap:6px}
.header .logo-symbol{font-size:22px;line-height:1}
.header .nav-links{display:flex;gap:16px;margin-left:auto;font-size:13px}
.header .nav-links a{font-weight:500;color:var(--ink-soft)}
.wrap{max-width:1100px;margin:0 auto;padding:20px}
h1{font-size:20px;margin:0 0 6px;font-weight:700;letter-spacing:-.01em}
.breadcrumb{font-size:12px;color:var(--ink-soft);margin-bottom:12px}
.breadcrumb a{color:var(--accent);text-decoration:none}
.breadcrumb a:hover{text-decoration:underline}
.sub{color:var(--ink-soft);font-size:14px;margin-bottom:12px}
.count{color:var(--ink-soft);font-size:12px;margin-bottom:14px}
.card{background:var(--paper);border:1px solid var(--rule);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.04);overflow:hidden}
.table-wrap{background:var(--paper);border:1px solid var(--rule);border-radius:8px;overflow:hidden;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--rule);font-weight:700;white-space:nowrap;color:var(--ink);font-size:11px;letter-spacing:.04em;text-transform:uppercase;background:var(--bg)}
td{padding:8px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
td.row-num{text-align:center;color:var(--ink-soft);font-size:11px;width:32px;min-width:32px}
tr:last-child td{border-bottom:0}
tr:hover td{background:#faf8f4}
a{color:var(--accent);text-decoration:none;font-weight:500}
a:hover{text-decoration:underline}
.muted{color:var(--ink-soft)}
.back-wrap{margin-top:18px}
.back{display:inline-block;padding:8px 22px;background:var(--accent);color:#fff!important;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600}
.back:hover{opacity:.9;text-decoration:none}
.footer{text-align:center;padding:24px;color:var(--ink-soft);font-size:12px;border-top:1px solid var(--rule);margin-top:24px}
.footer a{color:var(--ink-soft)}
.pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;white-space:nowrap}
.pill-under-review{background:#c2410c;color:#fff}
.pill-on-hold{background:#b91c1c;color:#fff}
.pill-warning{background:#92400e;color:#fff}
.pill-citic-warning{background:#7c3aed;color:#fff}
</style></head><body>
<div class="header">
<div class="header-inner">
  <a href="__ORIGIN__/" class="logo"><span class="logo-symbol">📖</span> AILatest Journal</a>
  <span class="nav-links">
    <a href="__ORIGIN__/indexes/">Indexes</a>
    <a href="__ORIGIN__/subjects/">Subjects</a>
  </span>
</div></div>
<div class="wrap">
<h1>__TITLE__</h1>
<p class="breadcrumb"><a href="__ORIGIN__/">Home</a> › <a href="__BACK__">__BACK_LABEL__</a></p>
<p class="sub">__DESC__</p>
<p class="count">__COUNT__</p>
<div class="card"><div class="table-wrap"><table><thead><tr>__HEADERS__</tr></thead>
<tbody>__ROWS__</tbody></table></div></div>
<p class="back-wrap"><a class="back" href="__BACK__">← Back</a></p>
</div>
<div class="footer"><a href="__ORIGIN__/">AILatest Journal</a> — journal search &amp; submission decision tool for researchers</div>
</body></html>'''

def make_slug(r):
    s = r.get('slug', '').strip()
    return s or (r.get('issn') or r.get('eissn') or '').replace('-', '').strip()

def match_index(j, slug, index_keys):
    indices = j.get('indices') or []
    if slug == 'scopus': return bool((j.get('scopus') or {}).get('active'))
    if slug == 'medline': return bool(j.get('medline'))
    if slug == 'under-review': return bool(j.get('under_review'))
    if slug == 'on-hold': return bool(j.get('on_hold'))
    if slug == 'warning': return bool(j.get('warning'))
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
        th_html = ''.join(f'<th>{esc(h)}</th>' for h in ['#', 'Journal Name', 'IF', 'JCR Q', 'CAS', 'Indexing', 'Publisher'])
        rows_html = '\n'.join(build_table_row(j, origin, headers, seq=i+1) for i, j in enumerate(top))

        total = len(matched)
        seo_title = f'{title} Journals — Impact Factor & Quartile | AILatest Journal'
        seo_desc = f'{desc} Browse {total} journals sorted by Impact Factor.'
        canonical = f'{origin}/subjects/{slug}/'
        count = f'Showing top {len(top)} of {total} journals sorted by Impact Factor (descending).'

        item_list = [{'@type': 'ListItem', 'position': i+1,
            'item': {'@type': 'Periodical', 'name': j.get('name',''), 'url': f'{origin}/journal/{esc(make_slug(j))}/'}}
            for i, j in enumerate(top[:50])]
        jsonld_tag = f'<script type="application/ld+json">\n' + json.dumps(
            {'@context': 'https://schema.org', '@type': 'ItemList', 'name': f'{title} Journals',
             'description': desc, 'url': canonical, 'itemListElement': item_list}, ensure_ascii=False) + '\n</script>'

        html = SKELETON.replace('__TITLE__', esc(seo_title)).replace('__DESC__', esc(seo_desc))
        html = html.replace('__CANONICAL__', esc(canonical)).replace('__JSONLD__', jsonld_tag)
        html = html.replace('__ORIGIN__', origin)
        html = html.replace('__COUNT__', esc(count)).replace('__HEADERS__', th_html)
        html = html.replace('__ROWS__', rows_html).replace('__BACK__', f'{origin}/subjects/').replace('__BACK_LABEL__', 'All Subjects')
        (ROOT / 'subjects' / slug).mkdir(parents=True, exist_ok=True)
        (ROOT / 'subjects' / slug / 'index.html').write_text(html, encoding='utf-8')
        print(f'  /subjects/{slug}/ → {len(top)}/{total} journals')

def generate_indexes(journals, origin):
    for slug, title, desc, index_keys, table_type in INDEXES:
        if slug == 'citic-warning':
            matched = load_citic_warning_rows(journals)
        else:
            matched = [j for j in journals if match_index(j, slug, index_keys or [])]
        if table_type == 'status':
            # 状态列表：保持原始数据源顺序，不按 IF 排序
            order_key = (lambda x: x.get('warning_order', 999999)) if slug == 'warning' \
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
                th_labels = ['#', 'Journal Name', 'ISSN / EISSN', 'IF', 'JCR Q', 'CAS', 'Status', 'Publisher']
            else:
                headers = ['num', 'name', 'if', 'q', 'z', 'status', 'pub']
                th_labels = ['#', 'Journal Name', 'IF', 'JCR Q', 'CAS', 'Status', 'Publisher']
            th_html = ''.join(f'<th>{esc(h)}</th>' for h in th_labels)
            def status_badge(j):
                if slug == 'under-review': return '<span class="pill pill-under-review">新锐 Under Review</span>'
                if slug == 'on-hold': return '<span class="pill pill-on-hold">WoS On Hold</span>'
                if slug == 'warning':
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
            th_html = ''.join(f'<th>{esc(h)}</th>' for h in ['#', 'Journal Name', 'IF', 'JCR Q', 'CAS', 'ISSN', 'Publisher'])
            rows_html = '\n'.join(build_table_row(j, origin, headers, seq=i+1) for i, j in enumerate(top))
            seo_title = f'{title} Indexed Journals | AILatest Journal'
        seo_desc = desc
        canonical = f'{origin}/indexes/{slug}/'
        if table_type == 'status':
            count = f'共 {len(top)} 本{title}标记的期刊（按原列表排序）'
            jsonld_name = f'{title}'
        else:
            count = f'Showing {len(top)} {title} indexed journals sorted by Impact Factor (descending).'
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
        html = html.replace('__CANONICAL__', esc(canonical)).replace('__JSONLD__', jsonld_tag)
        html = html.replace('__ORIGIN__', origin)
        html = html.replace('__COUNT__', esc(count)).replace('__HEADERS__', th_html)
        html = html.replace('__ROWS__', rows_html).replace('__BACK__', f'{origin}/indexes/').replace('__BACK_LABEL__', 'All Indexes')
        (ROOT / 'indexes' / slug).mkdir(parents=True, exist_ok=True)
        (ROOT / 'indexes' / slug / 'index.html').write_text(html, encoding='utf-8')
        print(f'  /indexes/{slug}/ → {len(top)} journals')

def generate_landing(origin):
    subjects = SUBJECTS
    indexes = INDEXES

    # Subjects landing
    r_list = '\n'.join(f'<li><a href="{origin}/subjects/{s}/" class="cat-link"><strong>{esc(t)}</strong></a></li>' for s, t, _, _ in subjects)
    r_html = f'''<!doctype html><html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browse Journals by WoS Subject | AILatest Journal</title>
<meta name="description" content="Browse academic journals by Web of Science subject area: Education, Economics, History, Engineering, Medicine, Computer Science and 94+ more categories. Top journals by Impact Factor." />
<link rel="canonical" href="{origin}/subjects/" /><meta name="robots" content="index,follow" />
<meta name="theme-color" content="#b4531f" />
<style>
:root{{--accent:#b4531f;--bg:#f7f5f0;--paper:#fff;--ink:#1c1917;--ink-soft:#6b6559;--rule:#e3ddd0;--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}}
*{{box-sizing:border-box}}
body{{font-family:var(--sans);margin:0;padding:0;background:var(--bg);color:var(--ink);line-height:1.6}}
.header{{background:var(--paper);border-bottom:1px solid var(--rule);padding:14px 20px;position:sticky;top:0;z-index:10}}
.header-inner{{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:16px}}
.header a{{color:var(--ink);text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em}}
.header a:hover{{color:var(--accent)}}
.header .logo{{display:flex;align-items:center;gap:6px}}
.header .logo-symbol{{font-size:22px;line-height:1}}
.header .nav-links{{display:flex;gap:16px;margin-left:auto;font-size:13px}}
.header .nav-links a{{font-weight:500;color:var(--ink-soft)}}
.header .nav-links a:hover{{color:var(--accent)}}
.wrap{{max-width:1100px;margin:0 auto;padding:20px}}
h1{{font-size:20px;margin:0 0 6px;font-weight:700}}
.breadcrumb{{font-size:12px;color:var(--ink-soft);margin-bottom:16px}}
.breadcrumb a{{color:var(--accent);text-decoration:none}}
.sub{{color:var(--ink-soft);font-size:14px;margin-bottom:16px}}
.card{{background:var(--paper);border:1px solid var(--rule);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.04);padding:16px 24px}}
.cat-list{{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 16px}}
.cat-link{{display:block;padding:6px 10px;color:var(--accent);text-decoration:none;font-size:13px;border-radius:4px;transition:background .1s}}
.cat-link:hover{{background:#f5f0ea;text-decoration:none}}
.back-wrap{{margin-top:20px}}
.back{{display:inline-block;padding:8px 22px;background:var(--accent);color:#fff!important;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600}}
.back:hover{{opacity:.9;text-decoration:none}}
.footer{{text-align:center;padding:24px;color:var(--ink-soft);font-size:12px;border-top:1px solid var(--rule);margin-top:24px}}
.footer a{{color:var(--ink-soft)}}
</style>
</head><body>
<div class="header"><div class="header-inner"><a href="{origin}/" class="logo"><span class="logo-symbol">📖</span> AILatest Journal</a>
<span class="nav-links"><a href="{origin}/indexes/">Indexes</a><a href="{origin}/subjects/">Subjects</a></span></div></div>
<div class="wrap"><h1>Browse Journals by WoS Subject</h1><p class="breadcrumb"><a href="{origin}/">Home</a></p>
<p class="sub">Select a Web of Science subject category to browse top journals sorted by Impact Factor.</p>
<div class="card"><ul class="cat-list">{r_list}</ul></div>
<p class="back-wrap"><a class="back" href="{origin}/">← Back</a></p></div>
<div class="footer"><a href="{origin}/">AILatest Journal</a> — journal search &amp; submission decision tool for researchers</div>
</body></html>'''
    (ROOT / 'subjects').mkdir(parents=True, exist_ok=True)
    (ROOT / 'subjects' / 'index.html').write_text(r_html, encoding='utf-8')
    print('  /subjects/ (landing)')

    # Indexes landing
    i_list = '\n'.join(f'<li><a href="{origin}/indexes/{s}/" class="cat-link"><strong>{esc(t)}</strong></a></li>' for s, t, _, _, _ in indexes)
    i_html = f'''<!doctype html><html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browse Journals by Indexing Database | AILatest Journal</title>
<meta name="description" content="Browse academic journals indexed in SCIE, SSCI, EI Compendex, Scopus and MEDLINE." />
<link rel="canonical" href="{origin}/indexes/" /><meta name="robots" content="index,follow" />
<meta name="theme-color" content="#b4531f" />
<style>
:root{{--accent:#b4531f;--bg:#f7f5f0;--paper:#fff;--ink:#1c1917;--ink-soft:#6b6559;--rule:#e3ddd0;--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}}
*{{box-sizing:border-box}}
body{{font-family:var(--sans);margin:0;padding:0;background:var(--bg);color:var(--ink);line-height:1.6}}
.header{{background:var(--paper);border-bottom:1px solid var(--rule);padding:14px 20px;position:sticky;top:0;z-index:10}}
.header-inner{{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:16px}}
.header a{{color:var(--ink);text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em}}
.header a:hover{{color:var(--accent)}}
.header .logo{{display:flex;align-items:center;gap:6px}}
.header .logo-symbol{{font-size:22px;line-height:1}}
.header .nav-links{{display:flex;gap:16px;margin-left:auto;font-size:13px}}
.header .nav-links a{{font-weight:500;color:var(--ink-soft)}}
.header .nav-links a:hover{{color:var(--accent)}}
.wrap{{max-width:1100px;margin:0 auto;padding:20px}}
h1{{font-size:20px;margin:0 0 6px;font-weight:700}}
.breadcrumb{{font-size:12px;color:var(--ink-soft);margin-bottom:16px}}
.breadcrumb a{{color:var(--accent);text-decoration:none}}
.sub{{color:var(--ink-soft);font-size:14px;margin-bottom:16px}}
.card{{background:var(--paper);border:1px solid var(--rule);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.04);padding:16px 24px}}
.cat-list{{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 16px}}
.cat-list li{{}}
.cat-link{{display:block;padding:6px 10px;color:var(--accent);text-decoration:none;font-size:13px;border-radius:4px;transition:background .1s}}
.cat-link:hover{{background:#f5f0ea;text-decoration:none}}
.back-wrap{{margin-top:20px}}
.back{{display:inline-block;padding:8px 22px;background:var(--accent);color:#fff!important;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600}}
.back:hover{{opacity:.9;text-decoration:none}}
.footer{{text-align:center;padding:24px;color:var(--ink-soft);font-size:12px;border-top:1px solid var(--rule);margin-top:24px}}
.footer a{{color:var(--ink-soft)}}
</style>
</head><body>
<div class="header"><div class="header-inner"><a href="{origin}/" class="logo"><span class="logo-symbol">📖</span> AILatest Journal</a>
<span class="nav-links"><a href="{origin}/indexes/">Indexes</a><a href="{origin}/subjects/">Subjects</a></span></div></div>
<div class="wrap"><h1>Browse Journals by Indexing Database</h1><p class="breadcrumb"><a href="{origin}/">Home</a></p>
<p class="sub">Select an indexing database to browse indexed journals sorted by Impact Factor.</p>
<div class="card"><ul class="cat-list">{i_list}</ul></div>
<p class="back-wrap"><a class="back" href="{origin}/">← Back</a></p></div>
<div class="footer"><a href="{origin}/">AILatest Journal</a> — journal search &amp; submission decision tool for researchers</div>
</body></html>'''
    (ROOT / 'indexes' / 'index.html').write_text(i_html, encoding='utf-8')
    print('  /indexes/ (landing)')

def update_sitemap(origin):
    sitemap_path = ROOT / 'sitemap.xml'
    if not sitemap_path.exists():
        print('  sitemap.xml not found, skipping'); return
    existing = sitemap_path.read_text(encoding='utf-8')
    new_urls = []
    new_urls.append(f'  <url><loc>{origin}/subjects/</loc><priority>0.7</priority></url>')
    for slug, _, _, _ in SUBJECTS:
        new_urls.append(f'  <url><loc>{origin}/subjects/{slug}/</loc><priority>0.7</priority></url>')
    # Remove old subjects/ links and /rankings/ lines
    lines = existing.split('\n')
    clean = [l for l in lines if '/rankings/' not in l and '/subjects/' not in l]
    existing = '\n'.join(clean)
    if '</urlset>' in existing:
        existing = existing.replace('</urlset>', '\n'.join(new_urls) + '\n</urlset>')
    sitemap_path.write_text(existing, encoding='utf-8')
    print(f'  sitemap.xml: updated with {len(new_urls)} new URLs')

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
