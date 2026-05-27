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

function badgeClass(value) {
  const key = text(value).toLowerCase();
  if (['scie', 'ssci', 'ahci', 'esci', 'ei', 'scopus', 'doaj', 'oaj'].includes(key)) return `badge b-${key}`;
  return 'soft-pill';
}

function badges(r) {
  const indexBadges = arr(r.indices).map(item => `<span class="${badgeClass(item)}">${esc(item)}</span>`);
  const rankBadges = compact([
    r.if_quartile ? `<span class="zone jcr-${esc(String(r.if_quartile).toLowerCase())}">JCR ${esc(r.if_quartile)}</span>` : '',
    r.cas_zone ? `<span class="zone z${esc(r.cas_zone)}">CAS ${esc(r.cas_zone)}${r.cas_top ? ' TOP' : ''}</span>` : '',
    r.ccf ? `<span class="soft-pill">CCF ${esc(r.ccf)}</span>` : '',
    r.abdc?.rating ? `<span class="soft-pill">ABDC ${esc(r.abdc.rating)}</span>` : '',
    r.abs?.rating ? `<span class="soft-pill">ABS ${esc(r.abs.rating)}</span>` : '',
    r.doaj ? '<span class="badge b-doaj">DOAJ</span>' : '',
    r.oaj ? '<span class="badge b-oaj">OAJ</span>' : '',
  ]);
  return [...indexBadges, ...rankBadges].join('');
}

function statCards(r) {
  const stats = [
    ['影响因子 / IF', r.if_2024],
    ['JCR 分区', r.if_quartile],
    ['中科院分区', r.cas_zone ? `${r.cas_zone} 区${r.cas_top ? ' · TOP' : ''}` : ''],
    ['ABDC', r.abdc?.rating],
    ['ABS AJG', r.abs?.rating],
    ['IF 排名', r.if_rank],
  ].filter(([, value]) => text(value));
  return stats.map(([key, value]) => `<div class="stat"><div class="stat-v">${esc(value)}</div><div class="stat-k">${esc(key)}</div></div>`).join('');
}

function metaBlock(rows) {
  return rows.map(([key, value]) => `<div class="meta-row"><div class="meta-k">${esc(key)}</div><div class="meta-v">${esc(value)}</div></div>`).join('');
}

function pageShell({ title, desc, canonical, children, directory = false, jsonLd = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="${directory ? 'website' : 'article'}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${canonical}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/seo.css" />
  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body>
  <div class="seo-shell">
    <aside class="seo-sidebar">
      <div class="brand"><a href="/">AILatest<span>Journal</span></a></div>
      <p class="brand-sub">面向科研人员的期刊检索与投稿决策工具。完整期刊页用于检索收录、分区、影响因子、开放获取与投稿前核查。</p>
      <nav class="seo-nav">
        <a href="/">返回主页查询</a>
        <a href="/journals/">浏览期刊内容页</a>
        <a href="/dashboard/">访问数据看板</a>
      </nav>
    </aside>
    <main class="seo-main">
      ${children}
      <p class="footnote">Data compiled by AILatest Journal from public journal directories and ranking lists. Last generated ${today}.</p>
    </main>
  </div>
</body>
</html>
`;
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
  const metaRows = rows.filter(([key]) => !['JCR Impact Factor 2024', 'JCR Quartile', 'JCR Rank', 'CAS 2025 Zone'].includes(key));
  const subjects = categories.length
    ? `<div class="cat-chips">${categories.map(c => `<span class="cat-chip">${esc(c)}</span>`).join('')}</div>`
    : '<p class="meta-v">Subject category data is not available for this journal yet.</p>';

  const children = `
      <nav class="crumb"><a href="/">AILatest Journal</a><span>/</span><a href="/journals/">期刊内容页</a><span>/</span><span>${esc(title)}</span></nav>
      <header class="page-hero">
        <p class="eyebrow">Journal Profile</p>
        <h1>${esc(title)}</h1>
        <p class="summary">${esc(desc)}</p>
        ${issns(r).length ? `<div class="issn-line">ISSN ${esc(issns(r).join(' · eISSN '))}</div>` : ''}
        <div class="badges">${badges(r)}</div>
        <div class="actions">
          <a class="big-btn primary" href="/?q=${encodeURIComponent(title)}">返回主页查询这本期刊</a>
          <a class="big-btn" href="/journals/">浏览更多期刊页</a>
        </div>
      </header>

      <div class="content-grid">
        <article>
          ${statCards(r) ? `<section class="panel"><h2>Core Metrics</h2><div class="stats-grid">${statCards(r)}</div></section>` : ''}
          <section class="panel"><h2>Journal Information</h2><div class="meta-block">${metaBlock(metaRows)}</div></section>
          <section class="panel"><h2>Subject Areas</h2>${subjects}</section>
        </article>
        <aside class="side-panel">
          <h3>Use This Page For</h3>
          <ul>
            <li>核查 SCI、SSCI、AHCI、ESCI、EI、Scopus、DOAJ 等收录信号。</li>
            <li>快速比较影响因子、JCR 分区、中科院分区、ABDC、ABS 等指标。</li>
            <li>从 Google 直接进入单本期刊档案，再回到主页做筛选与收藏。</li>
          </ul>
        </aside>
      </div>`;

  return pageShell({
    title: `${title} | AILatest Journal 期刊详情`,
    desc,
    canonical: url,
    children,
    jsonLd: cleanedJsonLd,
  });
}

function sitemapUrl(loc, priority = '0.7') {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function directoryHtml(pages, totalPages) {
  const desc = 'Browse AILatest Journal profile pages for journal indexing, impact factor, JCR quartile, CAS zone, ABDC, ABS and DOAJ information.';
  const children = `
      <nav class="crumb"><a href="/">AILatest Journal</a><span>/</span><span>期刊内容页</span></nav>
      <header class="page-hero">
        <p class="eyebrow">Journal Directory</p>
        <h1>完整期刊内容页</h1>
        <p class="summary">这里是从数据库生成的独立期刊页面。每个页面都有自己的 URL，可被搜索引擎抓取，也能把用户带回主页继续筛选、收藏和比较。</p>
        <div class="badges"><span class="soft-pill">${totalPages} generated pages</span><span class="soft-pill">Top ${pages.length} listed here</span><span class="soft-pill">Updated ${today}</span></div>
        <div class="actions"><a class="big-btn primary" href="/">返回主页查询</a></div>
      </header>

      <section class="directory-list">
        ${pages.map(page => `<article>
        <a href="${page.path}">${esc(page.title)}</a>
        <p>${esc(page.description)}</p>
      </article>`).join('\n        ')}
      </section>`;

  return pageShell({
    title: 'Journal Directory | AILatest Journal',
    desc,
    canonical: `${site}/journals/`,
    children,
    directory: true,
  });
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
