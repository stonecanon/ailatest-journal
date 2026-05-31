// Cloudflare Pages Function — root catch-all
// - /journal/<name-slug>/  → SSR SEO detail pages with FAQ + JSON-LD + Related Journals
// - /journal/<issn>/       → 301 redirects to name-slug
// - All other routes       → static assets (including /rankings/*, /indexes/*, /sitemap.xml)

let indexCache = null;

async function loadIndex(ctx) {
  if (indexCache) return indexCache;
  try {
    const req = new Request('https://journal.ailatest.org/data/journal_index.json');
    const resp = await ctx.env.ASSETS.fetch(req);
    if (!resp.ok) throw new Error(`Index fetch: ${resp.status}`);
    indexCache = await resp.json();
    return indexCache;
  } catch (e) {
    throw new Error(`loadIndex: ${e.message}`);
  }
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escJson(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t');
}

function titleCaseName(s) {
  return String(s || '').toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

function decodeRoutePart(s) {
  let out = String(s || '').trim();
  for (let i = 0; i < 2; i++) {
    try { const next = decodeURIComponent(out); if (next === out) break; out = next; } catch (_) { break; }
  }
  return out;
}

function normalizeJournalSlug(s, stripAccents = true) {
  let out = decodeRoutePart(s).toLowerCase();
  if (stripAccents) out = out.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return out.replace(/^\/?journal\//, '').replace(/\/+$/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function journalSlugCandidates(rawSlug) {
  const raw = decodeRoutePart(rawSlug).replace(/^\/?journal\//, '').replace(/\/+$/, '');
  const compactIssn = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return Array.from(new Set([raw, raw.toLowerCase(), normalizeJournalSlug(raw, false),
    normalizeJournalSlug(raw), raw.replace(/-/g, ''), compactIssn.length >= 7 ? compactIssn : ''].filter(Boolean)));
}

async function loadAppShell(ctx) {
  const req = new Request('https://journal.ailatest.org/index.html');
  const resp = await ctx.env.ASSETS.fetch(req);
  if (!resp.ok) throw new Error(`App shell fetch: ${resp.status}`);
  return resp.text();
}

function journalSeo(j, slug, origin) {
  const name = titleCaseName(j.n || 'Journal');
  const ifVal = j.f;
  const quartile = j.q;
  const indices = j.ia || j.ix || [];
  const issn = j.i || slug;
  const titleParts = [name];
  if (ifVal != null) titleParts.push(`IF ${ifVal}`);
  if (j.z != null) titleParts.push(`CAS ${j.z}区`);
  if (quartile) titleParts.push(quartile.toUpperCase());
  if (indices.length) titleParts.push(indices.slice(0, 2).join('/'));
  titleParts.push('AILatest Journal');
  const title = titleParts.join(' | ');
  let desc = `${name}`;
  if (ifVal != null) desc += `: impact factor ${ifVal}`;
  if (j.z != null) desc += `, CAS ${j.z}区`;
  if (quartile) desc += `, JCR ${quartile.toUpperCase()}`;
  if (indices.length) desc += `, indexed in ${indices.join('/')}`;
  if (j.p) desc += `. Published by ${j.p}`;
  desc += `. ISSN: ${issn}.`;
  if (desc.length > 300) desc = desc.slice(0, 297) + '...';
  return { title, desc, url: `${origin}/journal/${slug}/` };
}

function replaceMeta(html, selector, replacement) {
  if (selector && selector.test(html)) return html.replace(selector, replacement);
  return html.replace('</head>', `${replacement}\n</head>`);
}

// ───────── FAQ generation ─────────
function buildFAQ(j) {
  const name = j.n || 'Journal';
  const qa = [];
  // Q1: Impact Factor
  qa.push({ q: `What is the Impact Factor of ${escJson(name)}?`,
    a: j.f != null ? `The Impact Factor of ${escJson(name)} is ${j.f}.` : 'Not available in the current database.' });
  // Q2: JCR Quartile
  qa.push({ q: `What is the JCR Quartile of ${escJson(name)}?`,
    a: j.q ? `${escJson(name)} has a JCR quartile of ${j.q.toUpperCase()}.${j.ifr ? ' Rank: ' + j.ifr + '.' : ''}` : 'Not available in the current database.' });
  // Q3: CAS Ranking
  if (j.z != null) {
    const casStr = j.cm ? ` (${escJson(j.cm)})` : '';
    qa.push({ q: `What is the CAS Ranking of ${escJson(name)}?`,
      a: `${escJson(name)} is ranked CAS ${j.z}区${casStr}.` });
  } else {
    qa.push({ q: `What is the CAS Ranking of ${escJson(name)}?`, a: 'Not available in the current database.' });
  }
  // Q4: Indexing
  const allIdx = j.ia || j.ix || [];
  const idxChecks = [
    ['SCIE', allIdx.includes('SCIE')], ['SSCI', allIdx.includes('SSCI')],
    ['AHCI', allIdx.includes('AHCI')], ['ESCI', allIdx.includes('ESCI')],
    ['Scopus', j.sf === 1], ['PubMed', j.pb === 1],
    ['MEDLINE', j.md === 1], ['PMC', j.pc === 1],
    ['EI', allIdx.includes('EI')], ['DOAJ', j.dj === 1],
  ];
  const idxParts = idxChecks.filter(([_, v]) => v).map(([n]) => n);
  qa.push({ q: `Is ${escJson(name)} indexed in SCI, SSCI, AHCI, ESCI, Scopus, PubMed, MEDLINE or PMC?`,
    a: idxParts.length ? `Yes, ${escJson(name)} is indexed in: ${idxParts.join(', ')}.` : 'Not available in the current database.' });
  // Q5: Submission
  qa.push({ q: `Where can I submit to ${escJson(name)}?`,
    a: `You can submit manuscripts to ${escJson(name)} via its official website or editorial system. Visit the journal's homepage for submission guidelines.` });
  return qa;
}

function buildFAQHtml(j) {
  const qa = buildFAQ(j);
  const items = qa.map((item, i) =>
    `<div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">`
    + `<h3 itemprop="name">${esc(item.q)}</h3>`
    + `<div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><div itemprop="text">${esc(item.a)}</div></div></div>`
  ).join('\n');
  return `<section class="journal-faq"><h2>Frequently Asked Questions</h2>${items}</section>`;
}

function buildFAQJsonLd(j) {
  const qa = buildFAQ(j);
  return { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: qa.map(item => ({ '@type': 'Question', name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a } })) };
}

function buildWebPageJsonLd(j, seo) {
  return { '@context': 'https://schema.org', '@type': 'WebPage',
    name: seo.title, description: seo.desc, url: seo.url,
    isPartOf: { '@type': 'WebSite', name: 'AILatest Journal', url: 'https://journal.ailatest.org/' },
    about: { '@type': 'Thing', name: j.n || 'Journal', additionalType: 'https://schema.org/Periodical' } };
}

function buildBreadcrumbJsonLd(j, seo) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://journal.ailatest.org/' },
      { '@type': 'ListItem', position: 2, name: 'Journals', item: 'https://journal.ailatest.org/' },
      { '@type': 'ListItem', position: 3, name: j.n || 'Journal', item: seo.url } ] };
}

function buildPeriodicalJsonLd(j) {
  const pd = { '@context': 'https://schema.org', '@type': 'Periodical', name: j.n || 'Journal' };
  const issn = j.i || '';
  if (issn) pd.issn = issn.replace(/(\d{4})(\d{3}[\dX])/, '$1-$2');
  const eissn = j.is || '';
  if (eissn) pd.eissn = eissn.replace(/(\d{4})(\d{3}[\dX])/, '$1-$2');
  const allIdx = j.ia || j.ix || [];
  if (allIdx.length) pd.description = `Indexed in ${allIdx.join(', ')}.`;
  if (j.p) pd.publisher = { '@type': 'Organization', name: j.p };
  if (j.f != null) pd.impactFactor = j.f;
  return pd;
}

// ───────── Related journals ─────────
function buildRelatedJournals(j, slug, index, origin) {
  const publisher = j.p || '';
  const allIdx = j.ia || j.ix || [];
  const cats = j.wc || [];
  const scored = {};
  for (const [key, entry] of Object.entries(index)) {
    if (key === slug || entry._r || !entry.n) continue;
    let score = 0;
    if (publisher && entry.p && entry.p.toLowerCase() === publisher.toLowerCase()) score += 3;
    if (allIdx.length) {
      const eIdx = entry.ia || entry.ix || [];
      if (allIdx.some(ix => eIdx.includes(ix))) score += 1;
    }
    if (cats.length && entry.wc && cats.some(c => entry.wc.includes(c))) score += 2;
    if (score > 0) scored[key] = { entry, score, key };
  }
  const sorted = Object.values(scored).sort((a, b) => b.score - a.score).slice(0, 10);
  if (!sorted.length) return '';
  const links = sorted.map(s =>
    `<li><a href="${origin}/journal/${esc(s.entry.sl || s.key)}/">${esc(s.entry.n || '')}${s.entry.f != null ? ` (IF ${s.entry.f})` : ''}</a></li>`
  ).join('\n');
  return `<section class="related-journals"><h2>Related Journals</h2><ul>${links}</ul></section>`;
}

function buildRelatedJournalsJsonLd(j, slug, index, origin) {
  const publisher = j.p || '';
  const allIdx = j.ia || j.ix || [];
  const cats = j.wc || [];
  const scored = {};
  for (const [key, entry] of Object.entries(index)) {
    if (key === slug || entry._r || !entry.n) continue;
    let score = 0;
    if (publisher && entry.p && entry.p.toLowerCase() === publisher.toLowerCase()) score += 3;
    if (allIdx.length) {
      const eIdx = entry.ia || entry.ix || [];
      if (allIdx.some(ix => eIdx.includes(ix))) score += 1;
    }
    if (cats.length && entry.wc && cats.some(c => entry.wc.includes(c))) score += 2;
    if (score > 0) scored[key] = { entry, score };
  }
  const top = Object.values(scored).sort((a, b) => b.score - a.score).slice(0, 10);
  if (!top.length) return null;
  return { '@context': 'https://schema.org', '@type': 'ItemList',
    name: `Related Journals to ${j.n || ''}`,
    itemListElement: top.map((s, i) => ({ '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Periodical', name: s.entry.n, url: `${origin}/journal/${esc(s.entry.sl || '')}/` } })) };
}

// ───────── Journal page SSR ─────────
async function journalPage(ctx, j, slug, origin) {
  const seo = journalSeo(j, slug, origin);
  let html = await loadAppShell(ctx);

  // Meta tags
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seo.desc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(seo.url)}" />`);
  html = replaceMeta(html, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${esc(seo.url)}" />`);
  html = replaceMeta(html, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(seo.title)}" />`);
  html = replaceMeta(html, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(seo.desc)}" />`);
  html = replaceMeta(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${esc(seo.title)}" />`);
  html = replaceMeta(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${esc(seo.desc)}" />`);
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace('</head>', '<meta name="robots" content="index,follow" />\n</head>');
  }

  // JSON-LD blocks
  const index = await loadIndex(ctx);
  const jsonldBlocks = [
    buildWebPageJsonLd(j, seo),
    buildBreadcrumbJsonLd(j, seo),
    buildFAQJsonLd(j),
    buildPeriodicalJsonLd(j),
  ];
  const relatedLd = buildRelatedJournalsJsonLd(j, slug, index, origin);
  if (relatedLd) jsonldBlocks.push(relatedLd);

  const jsonldHtml = jsonldBlocks.map(b => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`).join('\n');
  html = html.replace('</head>', jsonldHtml + '\n</head>');

  // FAQ and related journals content (hidden from view, for crawlers)
  const faqHtml = buildFAQHtml(j);
  const relatedHtml = buildRelatedJournals(j, slug, index, origin);
  const extraContent = `<div id="seo-content" style="display:none">${faqHtml}${relatedHtml}</div>`;
  html = html.replace('</body>', extraContent + '\n</body>');

  return html;
}

// ───────── 404 page ─────────
function notFound() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>404 - Journal Not Found | AILatest Journal</title>
<meta name="robots" content="noindex,follow" />
<style>body{font-family:sans-serif;padding:40px;text-align:center}h1{font-size:48px;color:#ccc;margin:0}p{color:#666}a{color:#2563eb}</style>
</head><body><h1>404</h1><p>Journal not found.</p><p><a href="https://journal.ailatest.org/">← Back to Journal Search</a></p></body></html>`;
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

// ───────── Main handler ─────────
export async function onRequest(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Handle /journal/<slug>/
    if (path.startsWith('/journal/')) {
      const rawSlug = path.replace('/journal/', '').replace(/\/$/, '');
      if (!rawSlug) return Response.redirect(url.origin + '/', 302);

      const index = await loadIndex(ctx);
      const candidates = journalSlugCandidates(rawSlug);
      const slug = candidates.find(s => index[s]);
      let j = slug ? index[slug] : null;
      if (!j) return notFound();
      if (j._r) return Response.redirect(url.origin + '/journal/' + j._r + '/', 301);

      const html = await journalPage(ctx, j, slug, url.origin);
      return new Response(html, { status: 200,
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'CDN-Cache-Control': 'no-store' } });
    }

    // All other routes: serve static assets (handles /rankings/*, /indexes/*, /sitemap.xml, etc.)
    return ctx.env.ASSETS.fetch(request);

  } catch (e) {
    try { return await ctx.env.ASSETS.fetch(request); } catch(_) {}
    return new Response(`Error: ${e.message}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
}
