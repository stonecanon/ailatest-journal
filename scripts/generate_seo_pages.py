#!/usr/bin/env python3
"""Generate SEO detail pages + sitemap.xml for all journals.

Reads data/journals.json.gz and outputs:
  - /journal/<issn>/index.html  (one per journal with ISSN, optional)
  - sitemap.xml                 (root-level sitemap listing all URLs)

Usage:
  python3 scripts/generate_seo_pages.py           # generate pages + sitemap
  python3 scripts/generate_seo_pages.py --sitemap-only  # sitemap only
"""

import gzip, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
JOURNALS_GZ = DATA_DIR / 'journals.json.gz'
SITEMAP = ROOT / 'sitemap.xml'
SITE_URL = 'https://journal.ailatest.org'

def load_journals():
    with open(JOURNALS_GZ, 'rb') as f:
        return json.loads(gzip.decompress(f.read()))

def make_slug(r):
    """SEO-friendly slug: journal name if available, else ISSN."""
    s = r.get('slug', '').strip()
    if s:
        return s
    return (r.get('issn') or r.get('eissn') or '').replace('-', '').strip()

def escape(s):
    if s is None: return ''
    return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;').replace("'",'&#39;')

def build_title(r):
    """Generate SEO title like: Applied Energy | IF 11.2 | Q1 | SCIE | AILatest Journal"""
    parts = []
    name = r.get('name') or r.get('cn_name') or r.get('en_name') or 'Journal'
    parts.append(escape(name))
    if_val = r.get('if_2024')
    if if_val is not None:
        parts.append(f'IF {if_val}')
    q = r.get('if_quartile', '')
    if q:
        parts.append(q.upper())
    indices = r.get('indices', [])
    if indices:
        parts.append('/'.join(indices[:3]))
    parts.append('AILatest Journal')
    return ' | '.join(parts)

def build_desc(r):
    """Generate meta description."""
    name = r.get('name') or r.get('cn_name') or r.get('en_name') or 'Journal'
    desc = f'{escape(name)}'
    if_val = r.get('if_2024')
    if if_val is not None:
        desc += f': impact factor {if_val}'
    q = r.get('if_quartile', '')
    if q:
        desc += f', JCR {q.upper()}'
    indices = r.get('indices', [])
    if indices:
        desc += f', indexed in {"/".join(indices[:3])}'
    cz = r.get('cas_zone')
    if cz is not None:
        desc += f', CAS {cz}区'
    pub = r.get('publisher', '')
    if pub:
        desc += f'. Published by {escape(pub)}'
    issn = r.get('issn', '') or r.get('eissn', '')
    if issn:
        desc += f'. ISSN: {issn}'
    desc += '.'
    if len(desc) > 300:
        desc = desc[:297] + '...'
    return desc

def build_detail_html(r):
    """Generate a full HTML page for a single journal."""
    title = build_title(r)
    desc = build_desc(r)
    slug = make_slug(r)
    name = r.get('name') or r.get('cn_name') or r.get('en_name') or 'Journal'
    if_val = r.get('if_2024')
    indices = r.get('indices', [])
    q = r.get('if_quartile', '')
    cz = r.get('cas_zone')
    publisher = r.get('publisher', '')
    issn = r.get('issn', '') or r.get('eissn', '')
    
    idx_str = ', '.join(indices) if indices else '—'
    if_str = str(if_val) if if_val is not None else '—'
    q_str = q.upper() if q else '—'
    cz_str = f'{cz}区' if cz is not None else '—'
    
    # Build meta table rows for crawlers
    meta_rows = ''
    fields = [
        ('ISSN', issn),
        ('Impact Factor (2024)', if_str),
        ('JCR Quartile', q_str),
        ('CAS Zone', cz_str),
        ('Indexing', idx_str),
        ('Publisher', publisher),
    ]
    for k, v in fields:
        if v and v != '—':
            meta_rows += f'<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">{escape(k)}</td><td style="padding:4px 0">{escape(v)}</td></tr>\n'
    
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{desc}" />
<link rel="canonical" href="{SITE_URL}/journal/{slug}/" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="{SITE_URL}/journal/{slug}/" />
<meta name="robots" content="index,follow" />
<style>
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#fafafa;color:#222;line-height:1.6}}
  .card{{max-width:720px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:32px}}
  h1{{font-size:22px;margin:0 0 8px}}
  .meta{{font-size:13px;color:#888;margin-bottom:16px}}
  table{{font-size:14px;width:100%;border-collapse:collapse}}
  th{{text-align:left;padding:6px 0;border-bottom:1px solid #eee;font-weight:600}}
  .back{{display:inline-block;margin-top:20px;padding:8px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px}}
  .back:hover{{background:#1d4ed8}}
  .loading{{margin-top:20px;padding:12px;background:#f0f7ff;border-radius:6px;font-size:13px;color:#2563eb;text-align:center}}
</style>
</head>
<body>
<div class="card">
<h1>{escape(name)}</h1>
<div class="meta">ISSN: {escape(issn)}</div>
<table>{meta_rows}</table>
<a class="back" href="{SITE_URL}/" target="_top">← Back to Journal Search</a>
<div class="loading">Loading full journal details... <span id="s">.</span></div>
</div>
<script>
  // Auto-redirect to SPA detail view
  var d = document.getElementById('s');
  var dots = 0;
  setInterval(function(){{dots=(dots+1)%4;d.textContent='.'.repeat(dots||1);}},500);
  window.location.replace("{SITE_URL}/#j/{escape(slug)}");
</script>
</body>
</html>'''

def generate_all():
    sitemap_only = '--sitemap-only' in sys.argv
    journals = load_journals()
    print(f'Loaded {len(journals)} journals')
    
    sitemap_urls = []
    sitemap_urls.append((SITE_URL + '/', '1.0'))
    
    count = 0
    errors = 0
    
    for r in journals:
        slug = make_slug(r)
        if not slug:
            errors += 1
            continue
        
        if not sitemap_only:
            # Create directory
            page_dir = ROOT / 'journal' / slug
            page_dir.mkdir(parents=True, exist_ok=True)
            
            # Write index.html
            html = build_detail_html(r)
            (page_dir / 'index.html').write_text(html, encoding='utf-8')
        
        count += 1
        sitemap_urls.append((f'{SITE_URL}/journal/{slug}/', '0.8'))
        
        if count % 5000 == 0:
            print(f'  Generated {count} pages...')
    
    # Write sitemap
    print(f'Writing sitemap.xml with {len(sitemap_urls)} URLs...')
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, priority in sitemap_urls:
        xml_parts.append(f'  <url><loc>{url}</loc><priority>{priority}</priority></url>')
    xml_parts.append('</urlset>')
    
    SITEMAP.write_text('\n'.join(xml_parts) + '\n', encoding='utf-8')
    
    # Also write a compact journal index for the Pages Function
    print('Writing journal index for Pages Function...')
    index = {}
    for r in journals:
        slug = make_slug(r)
        if not slug:
            continue
        entry = {
            'n': r.get('name') or r.get('cn_name') or r.get('en_name') or '',
            'c': r.get('cn_name') or '',
            'e': r.get('en_name') or '',
            'i': r.get('issn') or '',
            'is': r.get('eissn') or '',
            'f': r.get('if_2024'),
            'q': r.get('if_quartile') or '',
            'z': r.get('cas_zone'),
            'ix': (r.get('indices') or [])[:3],
            'ia': (r.get('indices') or []),
            'p': r.get('publisher') or '',
            'sl': slug,
            'md': 1 if r.get('medline') else 0,
            'pb': 1 if r.get('pubmed') else 0,
            'pc': 1 if r.get('pmc') else 0,
            'sf': 1 if (r.get('scopus') or {}).get('active') else 0,
            'oj': 1 if r.get('oaj') else 0,
            'dj': 1 if r.get('doaj') else 0,
            'w': 1 if r.get('warning') else 0,
            'fr': 1 if r.get('free') else 0,
            'jc': r.get('jcr_cat') or '',
            'wc': (r.get('wos_categories') or [])[:3],
            'es': r.get('esi_category') or '',
            'cm': r.get('cas_major_cn') or '',
            'ifr': r.get('if_rank') or '',
        }
        # Primary key: name-based slug
        index[slug] = entry
        # Also add ISSN-based entries for 301 redirects
        for issn_key in ('i', 'is'):
            v = entry.get(issn_key, '').replace('-', '')
            if v and v not in index:
                index[v] = {'_r': slug}
    
    INDEX_FILE = DATA_DIR / 'journal_index.json'
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False)
    print(f'Journal index: {INDEX_FILE.stat().st_size / 1024:.1f} KB ({len(index)} entries)')
    
    mode = 'sitemap only' if sitemap_only else 'pages + sitemap'
    print(f'\nDone ({mode}): {count} pages generated, {errors} skipped (no ISSN), sitemap written')
    print(f'Sitemap size: {SITEMAP.stat().st_size / 1024:.1f} KB')

if __name__ == '__main__':
    generate_all()
