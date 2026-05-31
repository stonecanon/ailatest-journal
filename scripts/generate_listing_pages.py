#!/usr/bin/env python3
"""Generate static HTML pages for /rankings/* and /indexes/* pages.
Also adds these URLs to sitemap.xml.

Usage: python3 scripts/generate_listing_pages.py
"""

import gzip, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
JOURNALS_GZ = DATA_DIR / 'journals.json.gz'
SITE_URL = 'https://journal.ailatest.org'

def load_journals():
    with open(JOURNALS_GZ, 'rb') as f:
        return json.loads(gzip.decompress(f.read()))

def esc(s):
    if s is None: return ''
    return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

TABLE_STYLE = 'width:100%;border-collapse:collapse;font-size:13px'
TH_STYLE = 'text-align:left;padding:8px;border-bottom:2px solid #ddd;font-weight:700;white-space:nowrap'
TD_STYLE = 'padding:8px;border-bottom:1px solid #eee;vertical-align:top'

HEAD = '''<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__</title>
<meta name="description" content="__DESC__" />
<link rel="canonical" href="__CANONICAL__" />
<meta property="og:title" content="__TITLE__" />
<meta property="og:description" content="__DESC__" />
<meta property="og:type" content="website" />
<meta property="og:url" content="__CANONICAL__" />
<meta name="robots" content="index,follow" />
__JSONLD__
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#fafafa;color:#222;line-height:1.6}
.wrap{max-width:1000px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px}
h1{font-size:22px;margin:0 0 8px}
p.sub{color:#666;margin-bottom:20px}
p.count{color:#888;font-size:13px;margin-bottom:16px}
table{''' + TABLE_STYLE + '''}
th{''' + TH_STYLE + '''}
td{''' + TD_STYLE + '''}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
.back{display:inline-block;margin-top:20px;padding:8px 20px;background:#2563eb;color:#fff!important;text-decoration:none;border-radius:6px;font-size:14px}
.back:hover{background:#1d4ed8}
</style>
</head><body>
<div class="wrap">
<h1>__TITLE__</h1>
<p class="sub">__DESC__</p>
<p class="count">__COUNT__</p>
<table><thead><tr>__HEADERS__</tr></thead>
<tbody>__ROWS__</tbody></table>
<p><a class="back" href="__BACK__">← Back</a></p>
</div></body></html>'''

RANKINGS = [
    ('energy', 'Energy', 'Energy journals covering renewable energy, fossil fuels, energy policy and energy storage.', 'ENERGY'),
    ('architecture', 'Architecture', 'Architecture journals covering urban design, building science, landscape architecture and planning.', None),
    ('environmental-science', 'Environmental Science', 'Environmental science journals covering ecology, climate change, pollution and sustainability.', 'ENVIRONMENT/ECOLOGY'),
    ('medicine', 'Medicine', 'Medical journals covering clinical medicine, surgery, pharmacology, public health and biomedical research.', 'CLINICAL MEDICINE'),
    ('computer-science', 'Computer Science', 'Computer science journals covering AI, data science, software engineering, networks and theoretical CS.', 'COMPUTER SCIENCE'),
    ('engineering', 'Engineering', 'Engineering journals covering civil, mechanical, electrical, chemical and aerospace engineering.', 'ENGINEERING'),
    ('materials-science', 'Materials Science', 'Materials science journals covering nanomaterials, polymers, ceramics, metals and composites.', 'MATERIALS SCIENCE'),
    ('social-sciences', 'Social Sciences', 'Social sciences journals covering sociology, psychology, political science, geography and anthropology.', 'SOCIAL SCIENCES, GENERAL'),
    ('management', 'Management', 'Management journals covering business administration, organizational behavior, strategy and operations.', 'ECONOMICS & BUSINESS'),
    ('education', 'Education', 'Education journals covering pedagogy, curriculum development, educational technology and policy.', 'SOCIAL SCIENCES, GENERAL'),
]

INDEXES = [
    ('sci', 'SCI', 'Browse SCI (Science Citation Index) indexed journals — multidisciplinary science coverage with Impact Factors, Quartiles and publisher information.', ['SCIE', 'SCI']),
    ('scie', 'SCIE', 'Browse SCIE (Science Citation Index Expanded) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.', ['SCIE']),
    ('ssci', 'SSCI', 'Browse SSCI (Social Sciences Citation Index) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.', ['SSCI']),
    ('ahci', 'AHCI', 'Browse AHCI (Arts & Humanities Citation Index) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.', ['AHCI']),
    ('esci', 'ESCI', 'Browse ESCI (Emerging Sources Citation Index) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.', ['ESCI']),
    ('scopus', 'Scopus', 'Browse Scopus indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.', None),
    ('pubmed', 'PubMed', 'Browse PubMed indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.', None),
    ('medline', 'MEDLINE', 'Browse MEDLINE indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.', None),
    ('pmc', 'PMC', 'Browse PMC (PubMed Central) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.', None),
    ('doaj', 'DOAJ', 'Browse DOAJ (Directory of Open Access Journals) listed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.', None),
]

def make_slug(r):
    s = r.get('slug', '').strip()
    if s: return s
    return (r.get('issn') or r.get('eissn') or '').replace('-', '').strip()

def match_index(j, index_type, index_keys):
    indices = j.get('indices') or []
    if index_type == 'scopus':
        return bool((j.get('scopus') or {}).get('active'))
    if index_type == 'pubmed':
        return bool(j.get('pubmed'))
    if index_type == 'medline':
        return bool(j.get('medline'))
    if index_type == 'pmc':
        return bool(j.get('pmc'))
    if index_type == 'doaj':
        return bool(j.get('doaj'))
    for k in index_keys:
        if k in indices:
            return True
    return False

def match_ranking(j, esi_cat, subject):
    if esi_cat and j.get('esi_category') == esi_cat:
        return True
    cats = j.get('wos_categories') or []
    subj = subject.replace('-', ' ')
    for c in cats:
        if subj in c.lower():
            return True
    # Also match by jcr_cat or cas_major_cat
    jcr = (j.get('jcr_cat') or '').lower()
    if subj in jcr:
        return True
    cas = (j.get('cas_major_cat') or '').lower()
    if subj in cas:
        return True
    return False

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
        if h == 'name':
            cells.append(f'<td><a href="{origin}/journal/{esc(slug)}/">{esc(name)}</a></td>')
        elif h == 'if':
            cells.append(f'<td>{esc(str(if_v)) if if_v is not None else "—"}</td>')
        elif h == 'q':
            cells.append(f'<td>{esc(q) if q else "—"}</td>')
        elif h == 'z':
            cells.append(f'<td>{esc(z)}</td>')
        elif h == 'idx':
            cells.append(f'<td>{esc(idx)}</td>')
        elif h == 'pub':
            cells.append(f'<td>{esc(pub)}</td>')
        elif h == 'issn':
            cells.append(f'<td>{esc(issn)}</td>')
    return '<tr>' + ''.join(cells) + '</tr>'

def generate_rankings(journals, origin):
    for slug, title, desc, esi_cat in RANKINGS:
        matched = [j for j in journals if match_ranking(j, esi_cat, slug)]
        matched.sort(key=lambda x: -(x.get('if_2024') or -1))
        top = matched[:100]

        headers = ['name', 'if', 'q', 'z', 'idx', 'pub']
        header_cells = ['Journal Name', 'IF', 'JCR Q', 'CAS', 'Indexing', 'Publisher']
        th_html = ''.join(f'<th>{esc(h)}</th>' for h in header_cells)
        rows_html = '\n'.join(build_table_row(j, origin, headers) for j in top)

        seo_title = f'Top {title} Journals by Impact Factor & Quartile | AILatest Journal'
        seo_desc = desc
        canonical = f'{origin}/rankings/{slug}/'
        count = f'Showing {len(top)} journals sorted by Impact Factor (descending).'
        back = f'{origin}/rankings/'

        # JSON-LD
        item_list = []
        for i, j in enumerate(top[:50]):
            s = make_slug(j)
            item_list.append({'@type': 'ListItem', 'position': i+1,
                'item': {'@type': 'Periodical', 'name': j.get('name',''), 'url': f'{origin}/journal/{esc(s)}/'}})
        jsonld = json.dumps({'@context': 'https://schema.org', '@type': 'ItemList',
            'name': f'Top {title} Journals', 'description': desc, 'url': canonical,
            'itemListElement': item_list}, ensure_ascii=False)
        jsonld_tag = f'<script type="application/ld+json">\n{jsonld}\n</script>'

        html = HEAD.replace('__TITLE__', esc(seo_title)).replace('__DESC__', esc(seo_desc))
        html = html.replace('__CANONICAL__', esc(canonical)).replace('__JSONLD__', jsonld_tag)
        html = html.replace('__COUNT__', esc(count)).replace('__HEADERS__', th_html)
        html = html.replace('__ROWS__', rows_html).replace('__BACK__', esc(back))

        out_dir = ROOT / 'rankings' / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / 'index.html').write_text(html, encoding='utf-8')
        print(f'  /rankings/{slug}/ → {len(top)} journals')

def generate_indexes(journals, origin):
    for slug, title, desc, index_keys in INDEXES:
        matched = [j for j in journals if match_index(j, slug, index_keys or [])]
        matched.sort(key=lambda x: -(x.get('if_2024') or -1))
        top = matched[:200]

        headers = ['name', 'if', 'q', 'z', 'issn', 'pub']
        header_cells = ['Journal Name', 'IF', 'JCR Q', 'CAS', 'ISSN', 'Publisher']
        th_html = ''.join(f'<th>{esc(h)}</th>' for h in header_cells)
        rows_html = '\n'.join(build_table_row(j, origin, headers) for j in top)

        seo_title = f'{title} Indexed Journals | AILatest Journal'
        seo_desc = desc
        canonical = f'{origin}/indexes/{slug}/'
        count = f'Showing {len(top)} {title} indexed journals sorted by Impact Factor (descending).'
        back = f'{origin}/indexes/'

        item_list = []
        for i, j in enumerate(top[:50]):
            s = make_slug(j)
            item_list.append({'@type': 'ListItem', 'position': i+1,
                'item': {'@type': 'Periodical', 'name': j.get('name',''), 'url': f'{origin}/journal/{esc(s)}/'}})
        jsonld = json.dumps({'@context': 'https://schema.org', '@type': 'ItemList',
            'name': f'{title} Indexed Journals', 'description': desc, 'url': canonical,
            'itemListElement': item_list}, ensure_ascii=False)
        jsonld_tag = f'<script type="application/ld+json">\n{jsonld}\n</script>'

        html = HEAD.replace('__TITLE__', esc(seo_title)).replace('__DESC__', esc(seo_desc))
        html = html.replace('__CANONICAL__', esc(canonical)).replace('__JSONLD__', jsonld_tag)
        html = html.replace('__COUNT__', esc(count)).replace('__HEADERS__', th_html)
        html = html.replace('__ROWS__', rows_html).replace('__BACK__', esc(back))

        out_dir = ROOT / 'indexes' / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / 'index.html').write_text(html, encoding='utf-8')
        print(f'  /indexes/{slug}/ → {len(top)} journals')

def generate_landing_pages(origin):
    # Rankings landing
    r_list = '\n'.join(
        f'<li><a href="{origin}/rankings/{s}/"><strong>{esc(t)}</strong></a> — {esc(d)}</li>'
        for s, t, d, _ in RANKINGS
    )
    r_html = f'''<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Journal Rankings by Subject | AILatest Journal</title>
<meta name="description" content="Browse top journals by subject area: Energy, Architecture, Environmental Science, Medicine, Computer Science, Engineering, Materials Science, Social Sciences, Management, Education." />
<link rel="canonical" href="{origin}/rankings/" />
<meta name="robots" content="index,follow" />
<style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#fafafa;color:#222;line-height:1.6}}.wrap{{max-width:800px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px}}h1{{font-size:22px}}p.sub{{color:#666}}a{{color:#2563eb;text-decoration:none}}a:hover{{text-decoration:underline}}ul{{line-height:2}}.back{{display:inline-block;margin-top:20px;padding:8px 20px;background:#2563eb;color:#fff!important;text-decoration:none;border-radius:6px}}</style></head><body>
<div class="wrap"><h1>Journal Rankings by Subject</h1><p class="sub">Browse top journals by discipline, sorted by Impact Factor and indexed in SCIE/SSCI/AHCI/ESCI, Scopus, PubMed and more.</p>
<ul>{r_list}</ul><p><a class="back" href="{origin}/">← Back to Journal Search</a></p></div></body></html>'''
    (ROOT / 'rankings' / 'index.html').write_text(r_html, encoding='utf-8')
    print('  /rankings/ (landing)')

    # Indexes landing
    i_list = '\n'.join(
        f'<li><a href="{origin}/indexes/{s}/"><strong>{esc(t)}</strong></a> — {esc(d)}</li>'
        for s, t, d, _ in INDEXES
    )
    i_html = f'''<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browse Journals by Indexing Database | AILatest Journal</title>
<meta name="description" content="Browse academic journals indexed in SCI, SCIE, SSCI, AHCI, ESCI, Scopus, PubMed, MEDLINE, PMC and DOAJ." />
<link rel="canonical" href="{origin}/indexes/" />
<meta name="robots" content="index,follow" />
<style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#fafafa;color:#222;line-height:1.6}}.wrap{{max-width:800px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px}}h1{{font-size:22px}}p.sub{{color:#666}}a{{color:#2563eb;text-decoration:none}}a:hover{{text-decoration:underline}}ul{{line-height:2}}.back{{display:inline-block;margin-top:20px;padding:8px 20px;background:#2563eb;color:#fff!important;text-decoration:none;border-radius:6px}}</style></head><body>
<div class="wrap"><h1>Browse Journals by Indexing Database</h1><p class="sub">Browse academic journals indexed in SCI, SCIE, SSCI, AHCI, ESCI, Scopus, PubMed, MEDLINE, PMC and DOAJ. Each listing includes Impact Factors, Quartiles, CAS Rankings, ISSN and publisher information.</p>
<ul>{i_list}</ul><p><a class="back" href="{origin}/">← Back to Journal Search</a></p></div></body></html>'''
    (ROOT / 'indexes' / 'index.html').write_text(i_html, encoding='utf-8')
    print('  /indexes/ (landing)')


def update_sitemap(origin):
    sitemap_path = ROOT / 'sitemap.xml'
    if not sitemap_path.exists():
        print('  sitemap.xml not found, skipping')
        return

    # Read existing sitemap, add new URLs
    existing = sitemap_path.read_text(encoding='utf-8')
    # Add rankings and indexes to the sitemap
    new_urls = []
    new_urls.append(f'  <url><loc>{origin}/rankings/</loc><priority>0.7</priority></url>')
    for slug, _, _, _ in RANKINGS:
        new_urls.append(f'  <url><loc>{origin}/rankings/{slug}/</loc><priority>0.7</priority></url>')
    new_urls.append(f'  <url><loc>{origin}/indexes/</loc><priority>0.7</priority></url>')
    for slug, _, _, _ in INDEXES:
        new_urls.append(f'  <url><loc>{origin}/indexes/{slug}/</loc><priority>0.7</priority></url>')

    # Insert before </urlset>
    if '</urlset>' in existing:
        existing = existing.replace('</urlset>', '\n'.join(new_urls) + '\n</urlset>')
    sitemap_path.write_text(existing, encoding='utf-8')
    print(f'  sitemap.xml: added {len(new_urls)} new URLs')


def main():
    origin = 'https://journal.ailatest.org'
    print('Loading journals...')
    journals = load_journals()
    print(f'Loaded {len(journals)} journals')

    print('Generating rankings pages...')
    generate_rankings(journals, origin)
    print('Generating indexes pages...')
    generate_indexes(journals, origin)
    print('Generating landing pages...')
    generate_landing_pages(origin)
    print('Updating sitemap...')
    update_sitemap(origin)
    print('Done!')

if __name__ == '__main__':
    main()
