import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const site = 'https://journal.ailatest.org';
const limit = Number(process.env.SEO_LIMIT || 5000);
const today = new Date().toISOString().slice(0, 10);

const outDir = join(root, 'journal');
const indexDir = join(root, 'journals');
const dataFile = join(root, 'data', 'journals.json');

function text(value) {
  return String(value ?? '').trim();
}

function esc(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value, fallback) {
  const slug = text(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 88);
  return slug || fallback;
}

function compact(values) {
  return values.map(text).filter(Boolean);
}

function arr(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function titleOf(r) {
  return text(r.name || r.title || r.en_name || r.cn_name || 'Untitled Journal');
}

function issns(r) {
  return compact([r.issn, r.eissn]);
}

function metricRows(r) {
  const rows = [
    ['ISSN', issns(r).join(' / ')],
    ['Publisher', r.publisher],
    ['Country / Region', r.country],
    ['Indexed in', arr(r.indices).join(', ')],
    ['JCR Impact Factor 2024', r.if_2024],
    ['JCR Quartile', r.if_quartile],
    ['JCR Rank', r.if_rank],
    ['CAS 2025 Zone', r.cas_zone ? `Zone ${r.cas_zone}${r.cas_top ? ' · TOP' : ''}` : ''],
    ['CAS Major Category', r.cas_major_cn || r.cas_major_cat],
    ['ESI Category', r.esi_category],
    ['WoS Categories', arr(r.wos_categories).join('; ')],
    ['EI Compendex', r.ei_status],
    ['Scopus Coverage', r.scopus?.coverage],
    ['ABDC Rating', r.abdc?.rating],
    ['ABS AJG Rating', r.abs?.rating],
    ['DOAJ', r.doaj ? compact([r.doaj.lic, r.doaj.apc ? `APC: ${r.doaj.apc}` : '', r.doaj.review]).join(' · ') : ''],
  ].filter(([, value]) => text(value));
  return rows;
}

function score(r) {
  const indices = new Set(arr(r.indices));
  let s = 0;
  if (indices.has('SCIE')) s += 90;
  if (indices.has('SSCI')) s += 90;
  if (indices.has('AHCI')) s += 60;
  if (indices.has('ESCI')) s += 35;
  if (indices.has('EI')) s += 55;
  if (r.if_2024) s += Math.min(120, Number(r.if_2024) * 8 || 0);
  if (r.if_quartile === 'Q1') s += 60;
  if (r.if_quartile === 'Q2') s += 35;
  if (Number(r.cas_zone) === 1) s += 60;
  if (Number(r.cas_zone) === 2) s += 35;
  if (r.cas_top) s += 25;
  if (r.ccf) s += 20;
  if (r.abdc?.rating) s += 25;
  if (r.abs?.rating) s += 25;
  if (r.doaj) s += 10;
  return s;
}

function pageDescription(r) {
  const title = titleOf(r);
  const bits = compact([
    issns(r).length ? `ISSN ${issns(r).join(' / ')}` : '',
    arr(r.indices).length ? arr(r.indices).join(', ') : '',
    r.if_2024 ? `2024 IF ${r.if_2024}` : '',
    r.if_quartile ? `JCR ${r.if_quartile}` : '',
    r.cas_zone ? `CAS Zone ${r.cas_zone}` : '',
    r.publisher,
  ]);
  return `${title} journal profile with indexing, impact factor, JCR quartile, CAS zone, publisher, ISSN, DOAJ and related submission metrics. ${bits.join(' · ')}`.slice(0, 300);
}

function badges(r) {
  const items = [
    ...arr(r.indices),
    r.if_quartile ? `JCR ${r.if_quartile}` : '',
    r.cas_zone ? `CAS ${r.cas_zone}${r.cas_top ? ' TOP' : ''}` : '',
    r.ccf ? `CCF ${r.ccf}` : '',
    r.abdc?.rating ? `ABDC ${r.abdc.rating}` : '',
    r.abs?.rating ? `ABS ${r.abs.rating}` : '',
    r.doaj ? 'DOAJ' : '',
  ].filter(Boolean);
  return items.map(item => `<span>${esc(item)}</span>`).join('');
}

function htmlFor(r, slug) {
  const title = titleOf(r);
  const url = `${site}/journal/${slug}/`;
  const rows = metricRows(r);
  const categories = compact([
    ...arr(r.wos_categories),
    r.esi_category,
    r.cas_major_cn,
    r.abdc?.field,
    r.abs?.field,
  ]);
  const sameAs = compact([r.doaj?.u, r.doaj?.du]);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name: title,
    issn: issns(r),
    publisher: r.publisher ? { '@type': 'Organization', name: r.publisher } : undefined,
    url,
    sameAs,
    about: categories,
  };
  const cleanedJsonLd = JSON.stringify(jsonLd, (_, value) => {
    if (Array.isArray(value) && value.length === 0) return undefined;
    return value === '' || value == null ? undefined : value;
  });
  const desc = pageDescription(r);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} | Journal metrics, indexing and ranking</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)} | AILatest Journal" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <link rel="stylesheet" href="/css/seo.css" />
  <script type="application/ld+json">${cleanedJsonLd}</script>
</head>
<body>
  <main class="page">
    <nav class="crumb"><a href="/">AILatest Journal</a><span>/</span><a href="/journals/">Journal pages</a></nav>
    <header class="hero">
      <p class="eyebrow">Journal Profile</p>
      <h1>${esc(title)}</h1>
      <p class="summary">${esc(desc)}</p>
      <div class="badges">${badges(r)}</div>
    </header>

    <section class="grid">
      <article class="card">
        <h2>Core Metrics</h2>
        <table>
          <tbody>
            ${rows.map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`).join('\n            ')}
          </tbody>
        </table>
      </article>
      <aside class="card side">
        <h2>Use this page for</h2>
        <ul>
          <li>Checking whether the journal is indexed in SCI, SSCI, AHCI, ESCI, EI, Scopus or DOAJ.</li>
          <li>Comparing JCR Impact Factor, JCR quartile and CAS zone signals.</li>
          <li>Finding ISSN, publisher and subject category information before submission.</li>
        </ul>
        <a class="button" href="/?q=${encodeURIComponent(title)}">Open in journal finder</a>
      </aside>
    </section>

    <section class="card">
      <h2>Subject Areas</h2>
      <p>${categories.length ? esc(categories.join(' · ')) : 'Subject category data is not available for this journal yet.'}</p>
    </section>

    <footer>
      <p>Data compiled by AILatest Journal from public journal directories and ranking lists. Last generated ${today}.</p>
    </footer>
  </main>
</body>
</html>
`;
}

function sitemapUrl(loc, priority = '0.7') {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function directoryHtml(pages, totalPages) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Journal Directory | AILatest Journal</title>
  <meta name="description" content="Browse AILatest Journal profile pages for journal indexing, impact factor, JCR quartile, CAS zone, ABDC, ABS and DOAJ information." />
  <link rel="canonical" href="${site}/journals/" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Journal Directory | AILatest Journal" />
  <meta property="og:description" content="Static journal profile pages for search engines and researchers." />
  <meta property="og:url" content="${site}/journals/" />
  <link rel="stylesheet" href="/css/seo.css" />
</head>
<body>
  <main class="page">
    <nav class="crumb"><a href="/">AILatest Journal</a><span>/</span><span>Journal pages</span></nav>
    <header class="hero">
      <p class="eyebrow">Journal Directory</p>
      <h1>Searchable Journal Pages</h1>
      <p class="summary">Browse journal profile pages generated from AILatest Journal data. Each page can be indexed by search engines and links back to the interactive journal finder.</p>
      <div class="badges"><span>${totalPages} generated pages</span><span>Top ${pages.length} listed here</span><span>Updated ${today}</span></div>
    </header>

    <section class="directory-list">
      ${pages.map(page => `<article>
        <a href="${page.path}">${esc(page.title)}</a>
        <p>${esc(page.description)}</p>
      </article>`).join('\n      ')}
    </section>
  </main>
</body>
</html>
`;
}

const journals = JSON.parse(await readFile(dataFile, 'utf8'));
const selected = journals
  .filter(r => titleOf(r) && (arr(r.indices).length || r.if_2024 || r.cas_zone || r.abdc || r.abs || r.doaj))
  .sort((a, b) => score(b) - score(a) || titleOf(a).localeCompare(titleOf(b)))
  .slice(0, limit);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await rm(indexDir, { recursive: true, force: true });
await mkdir(indexDir, { recursive: true });

const used = new Map();
const pages = [];
for (let i = 0; i < selected.length; i += 1) {
  const r = selected[i];
  const title = titleOf(r);
  const base = slugify(titleOf(r), `journal-${i + 1}`);
  const count = used.get(base) || 0;
  used.set(base, count + 1);
  const suffix = count ? `-${count + 1}` : '';
  const slug = `${base}${suffix}`;
  const dir = join(outDir, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), htmlFor(r, slug), 'utf8');
  pages.push({
    url: `${site}/journal/${slug}/`,
    path: `/journal/${slug}/`,
    title,
    description: pageDescription(r),
  });
}

await writeFile(join(indexDir, 'index.html'), directoryHtml(pages.slice(0, 500), pages.length), 'utf8');

await writeFile(join(root, 'sitemap-main.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrl(`${site}/`, '1.0')}
${sitemapUrl(`${site}/journals/`, '0.8')}
</urlset>
`, 'utf8');

await writeFile(join(root, 'sitemap-journals.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => sitemapUrl(page.url)).join('\n')}
</urlset>
`, 'utf8');

await writeFile(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${site}/sitemap-main.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${site}/sitemap-journals.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>
`, 'utf8');

console.log(`Generated ${pages.length} journal SEO pages in ${outDir}`);
