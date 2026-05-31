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
SITE_URL = 'https://journal.ailatest.org'

def load_journals():
    with open(JOURNALS_GZ, 'rb') as f:
        return json.loads(gzip.decompress(f.read()))

def load_wos_categories():
    with open(WOS_CATS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Sort by count descending, take top 100
    data.sort(key=lambda x: -x['count'])
    top = data[:100]
    # Build: (slug, title, desc, wos_name)
    result = []
    for item in top:
        name = item['name']
        slug = name.lower().replace(' & ', '-').replace(' &', '-').replace('& ', '-')
        slug = slug.replace(' & ', '-').replace('&', '-').replace(',', '').replace("'", '')
        slug = slug.replace('(', '').replace(')', '').replace(' ', '-').replace('--', '-').strip('-')
        desc = f'{name} journals — browse top journals in the Web of Science {name} category with Impact Factor, Quartile, CAS tier and indexing information.'
        result.append((slug, name, desc, name))
    return result

SUBJECTS = None  # will be loaded from wos_categories.json at runtime

# 5 个索引
INDEXES = [
    ('scie', 'SCIE', 'SCIE (Science Citation Index Expanded) indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['SCIE']),
    ('ssci', 'SSCI', 'SSCI (Social Sciences Citation Index) indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['SSCI']),
    ('ei', 'EI', 'EI Compendex indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', ['EI']),
    ('scopus', 'Scopus', 'Scopus indexed journals with Impact Factors, Quartiles, CAS rankings and publisher information.', None),
    ('medline', 'MEDLINE', 'MEDLINE indexed journals from the National Library of Medicine with Impact Factors, Quartiles, CAS rankings and publisher information.', None),
]

def esc(s):
    if s is None: return ''
    return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

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
.table-wrap{background:var(--paper);border:1px solid var(--rule);border-radius:8px;overflow:hidden;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--rule);font-weight:700;white-space:nowrap;color:var(--ink);font-size:11px;letter-spacing:.04em;text-transform:uppercase;background:var(--bg)}
td{padding:8px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
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
<div class="table-wrap"><table><thead><tr>__HEADERS__</tr></thead>
<tbody>__ROWS__</tbody></table></div>
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
    return any(k in indices for k in index_keys)

def match_subject(j, wos_name):
    cats = j.get('wos_categories') or []
    return wos_name in cats

def build_table_row(j, origin, headers):
    slug = make_slug(j)
    name = j.get('name') or j.get('en_name') or j.get('cn_name') or ''
    if_v = j.get('if_2024')
    q = (j.get('if_quartile') or '').upper()
    z = f"{j.get('cas_zone')}区" if j.get('cas_zone') is not None else '—'
    idx = ', '.join((j.get('indices') or [])[:4]) or '—'
    pub = j.get('publisher') or '—'
    issn = j.get('issn') or '—'
    cells = []
    for h in headers:
        if h == 'name': cells.append(f'<td><a href="{origin}/journal/{esc(slug)}/">{esc(name)}</a></td>')
        elif h == 'if': cells.append(f'<td>{esc(str(if_v)) if if_v is not None else "—"}</td>')
        elif h == 'q': cells.append(f'<td>{esc(q) if q else "—"}</td>')
        elif h == 'z': cells.append(f'<td>{esc(z)}</td>')
        elif h == 'idx': cells.append(f'<td>{esc(idx)}</td>')
        elif h == 'pub': cells.append(f'<td>{esc(pub)}</td>')
        elif h == 'issn': cells.append(f'<td>{esc(issn)}</td>')
    return '<tr>' + ''.join(cells) + '</tr>'

def generate_subjects(journals, origin):
    for slug, title, desc, wos_name in SUBJECTS:
        matched = [j for j in journals if match_subject(j, wos_name)]
        matched.sort(key=lambda x: -(x.get('if_2024') or -1))
        top = matched[:100]

        headers = ['name', 'if', 'q', 'z', 'idx', 'pub']
        th_html = ''.join(f'<th>{esc(h)}</th>' for h in ['Journal Name', 'IF', 'JCR Q', 'CAS', 'Indexing', 'Publisher'])
        rows_html = '\n'.join(build_table_row(j, origin, headers) for j in top)

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
    for slug, title, desc, index_keys in INDEXES:
        matched = [j for j in journals if match_index(j, slug, index_keys or [])]
        matched.sort(key=lambda x: -(x.get('if_2024') or -1))
        top = matched[:200]
        headers = ['name', 'if', 'q', 'z', 'issn', 'pub']
        th_html = ''.join(f'<th>{esc(h)}</th>' for h in ['Journal Name', 'IF', 'JCR Q', 'CAS', 'ISSN', 'Publisher'])
        rows_html = '\n'.join(build_table_row(j, origin, headers) for j in top)

        seo_title = f'{title} Indexed Journals | AILatest Journal'
        seo_desc = desc
        canonical = f'{origin}/indexes/{slug}/'
        count = f'Showing {len(top)} {title} indexed journals sorted by Impact Factor (descending).'

        item_list = [{'@type': 'ListItem', 'position': i+1,
            'item': {'@type': 'Periodical', 'name': j.get('name',''), 'url': f'{origin}/journal/{esc(make_slug(j))}/'}}
            for i, j in enumerate(top[:50])]
        jsonld_tag = f'<script type="application/ld+json">\n' + json.dumps(
            {'@context': 'https://schema.org', '@type': 'ItemList', 'name': f'{title} Indexed Journals',
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
    r_list = '\n'.join(f'<li><a href="{origin}/subjects/{s}/"><strong>{esc(t)}</strong></a></li>' for s, t, _, _ in subjects)
    r_html = f'''<!doctype html><html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browse Journals by WoS Subject | AILatest Journal</title>
<meta name="description" content="Browse academic journals by Web of Science subject area: Education, Economics, History, Engineering, Medicine, Computer Science and 94+ more categories. Top journals by Impact Factor." />
<link rel="canonical" href="{origin}/subjects/" /><meta name="robots" content="index,follow" />
<style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#fafafa;color:#222;line-height:1.6}}
.wrap{{max-width:800px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px}}
h1{{font-size:22px}}p.sub{{color:#666}}a{{color:#2563eb;text-decoration:none}}a:hover{{text-decoration:underline}}
ul{{line-height:2;columns:3}}.back{{display:inline-block;margin-top:20px;padding:8px 20px;background:#2563eb;color:#fff!important;text-decoration:none;border-radius:6px}}</style>
</head><body><div class="wrap"><h1>Browse Journals by WoS Subject</h1><p class="sub">Select a Web of Science subject category to browse top journals sorted by Impact Factor.</p>
<ul>{r_list}</ul><p><a class="back" href="{origin}/">← Back to Journal Search</a></p></div></body></html>'''
    (ROOT / 'subjects').mkdir(parents=True, exist_ok=True)
    (ROOT / 'subjects' / 'index.html').write_text(r_html, encoding='utf-8')
    print('  /subjects/ (landing)')

    # Indexes landing
    i_list = '\n'.join(f'<li><a href="{origin}/indexes/{s}/"><strong>{esc(t)}</strong></a></li>' for s, t, _, _ in indexes)
    i_html = f'''<!doctype html><html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browse Journals by Indexing Database | AILatest Journal</title>
<meta name="description" content="Browse academic journals indexed in SCIE, SSCI, EI Compendex, Scopus and MEDLINE." />
<link rel="canonical" href="{origin}/indexes/" /><meta name="robots" content="index,follow" />
<style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#fafafa;color:#222;line-height:1.6}}
.wrap{{max-width:800px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px}}
h1{{font-size:22px}}p.sub{{color:#666}}a{{color:#2563eb;text-decoration:none}}a:hover{{text-decoration:underline}}
ul{{line-height:2;columns:2}}.back{{display:inline-block;margin-top:20px;padding:8px 20px;background:#2563eb;color:#fff!important;text-decoration:none;border-radius:6px}}</style>
</head><body><div class="wrap"><h1>Browse Journals by Indexing Database</h1><p class="sub">Select an indexing database to browse indexed journals sorted by Impact Factor.</p>
<ul>{i_list}</ul><p><a class="back" href="{origin}/">← Back to Journal Search</a></p></div></body></html>'''
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
