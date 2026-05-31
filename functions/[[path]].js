// Cloudflare Pages Function — root catch-all
// - /journal/<name-slug>/  → SSR SEO detail pages with FAQ + JSON-LD + Related Journals
// - /journal/<issn>/       → 301 redirects to name-slug
// - /compare/<a>-vs-<b>/   → SSR comparison page
// - All other routes       → static assets

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
  return out.replace(/^\/?(?:journal|compare)\//, '').replace(/\/+$/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function journalSlugCandidates(rawSlug) {
  const raw = decodeRoutePart(rawSlug).replace(/^\/?(?:journal|compare)\//, '').replace(/\/+$/, '');
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

function replaceMeta(html, selector, replacement) {
  if (selector && selector.test(html)) return html.replace(selector, replacement);
  return html.replace('</head>', `${replacement}
</head>`);
}

function journalSeo(j, slug, origin) {
  const name = titleCaseName(j.n || 'Journal');
  const ifVal = j.f;
  const quartile = j.q;
  const indices = j.ix || [];
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

// ───────── FAQ generation ─────────
function buildFAQ(j) {
  const name = j.n || 'Journal';
  const qa = [];
  qa.push({ q: `What is the Impact Factor of ${escJson(name)}?`,
    a: j.f != null ? `The Impact Factor of ${escJson(name)} is ${j.f}.` : 'Not available in the current database.' });
  qa.push({ q: `What is the JCR Quartile of ${escJson(name)}?`,
    a: j.q ? `${escJson(name)} has a JCR quartile of ${j.q.toUpperCase()}.` : 'Not available in the current database.' });
  if (j.z != null) {
    qa.push({ q: `What is the CAS Ranking of ${escJson(name)}?`, a: `${escJson(name)} is ranked CAS ${j.z}区.` });
  } else {
    qa.push({ q: `What is the CAS Ranking of ${escJson(name)}?`, a: 'Not available in the current database.' });
  }
  const allIdx = j.ix || [];
  const idxParts = allIdx.filter(Boolean);
  qa.push({ q: `Is ${escJson(name)} indexed in SCI, SSCI, AHCI, ESCI, Scopus, PubMed, MEDLINE or PMC?`,
    a: idxParts.length ? `Yes, ${escJson(name)} is indexed in: ${idxParts.join(', ')}.` : 'Not available in the current database.' });
  qa.push({ q: `Where can I submit to ${escJson(name)}?`,
    a: `You can submit manuscripts to ${escJson(name)} via its official website or editorial system. Visit the journal's homepage for submission guidelines.` });
  return qa;
}

function buildFAQHtml(j) {
  const qa = buildFAQ(j);
  const items = qa.map((item) =>
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
  const allIdx = j.ix || [];
  if (allIdx.length) pd.description = `Indexed in ${allIdx.join(', ')}.`;
  if (j.p) pd.publisher = { '@type': 'Organization', name: j.p };
  if (j.f != null) pd.impactFactor = j.f;
  return pd;
}

// ───────── AI Summary & About ─────────
function buildAiSummary(j) {
  const name = j.n || 'this journal';
  const pub = j.p ? `published by ${j.p}` : '';
  const ifVal = j.f != null ? `Impact Factor of ${j.f}` : '';
  const q = j.q ? `, JCR ${j.q.toUpperCase()}` : '';
  const z = j.z != null ? `, and CAS ${j.z}区` : '';
  const indices = j.ix || [];
  const idxStr = indices.length ? `Indexed in ${indices.join(', ')}` : '';
  const parts = [name, pub, ifVal, q, z, idxStr].filter(Boolean);
  return `${parts.join('. ')}.`;
}

function buildAboutHtml(j) {
  const name = j.n || 'this journal';
  const pub = j.p ? `published by ${j.p}` : '';
  const ifVal = j.f != null ? `It has a JCR Impact Factor of ${j.f}` : '';
  const q = j.q ? ` and is ranked ${j.q.toUpperCase()} in JCR quartile` : '';
  const z = j.z != null ? `. In the CAS ranking system, it is classified as ${j.z}区` : '';
  const indices = j.ix || [];
  const idxStr = indices.length ? `. It is indexed in ${indices.join(', ')}` : '';
  
  let text = `${name} is a scholarly journal ${pub}${ifVal}${q}${z}${idxStr}${esi}.`;
  if (!ifVal && !pub) text = `${name}. Detailed journal information is available in the database.`;
  if (text.length > 300) text = text.slice(0, 297) + '...';
  return `<section class="journal-about"><h2>About ${esc(name)}</h2><p>${esc(text)}</p></section>`;
}

// ───────── Journal page SSR ─────────
async function journalPage(ctx, j, slug, origin) {
  const seo = journalSeo(j, slug, origin);
  let html = await loadAppShell(ctx);

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

  const index = await loadIndex(ctx);
  const jsonldBlocks = [
    buildWebPageJsonLd(j, seo), buildBreadcrumbJsonLd(j, seo),
    buildFAQJsonLd(j), buildPeriodicalJsonLd(j),
  ];
  const jsonldHtml = jsonldBlocks.map(b => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`).join('\n');
  html = html.replace('</head>', jsonldHtml + '\n</head>');

  const seoContent = `<div id="seo-content" style="display:none">`
    + buildAboutHtml(j)
    + `<section class="journal-ai-summary"><h2>AI Summary</h2><p>${esc(buildAiSummary(j))}</p></section>`
    + buildFAQHtml(j)
    + `</div>`;
  html = html.replace('</body>', seoContent + '\n</body>');
  return html;
}

// ───────── Compare page ─────────
function compareSeo(j1, j2, slug1, slug2, origin) {
  const n1 = titleCaseName(j1.n || 'Journal A');
  const n2 = titleCaseName(j2.n || 'Journal B');
  const title = `${n1} vs ${n2} | Impact Factor, Quartile & Journal Comparison | AILatest Journal`;
  const desc = `Compare ${n1} and ${n2} journal rankings, impact factors, quartiles, indexing databases and submission information.`;
  return { title, desc, url: `${origin}/compare/${slug1}-vs-${slug2}/` };
}

function compareCell(label, v1, v2) {
  const fmt1 = v1 != null ? String(v1) : '—';
  const fmt2 = v2 != null ? String(v2) : '—';
  return `<tr><td style="font-weight:600;padding:10px 12px;border-bottom:1px solid #eee;white-space:nowrap">${esc(label)}</td>`
    + `<td style="padding:10px 12px;border-bottom:1px solid #eee">${esc(fmt1)}</td>`
    + `<td style="padding:10px 12px;border-bottom:1px solid #eee">${esc(fmt2)}</td></tr>`;
}

async function comparePage(ctx, j1, j2, slug1, slug2, origin) {
  const seo = compareSeo(j1, j2, slug1, slug2, origin);
  const n1 = titleCaseName(j1.n || 'Journal A');
  const n2 = titleCaseName(j2.n || 'Journal B');

  // Build comparison table
  const rows = [];
  const fmtIdx = (j) => { const a = j.ix || []; return a.length ? a.join(', ') : '—'; };
  const fmtOA = () => '—';
  rows.push(compareCell('Publisher', j1.p, j2.p));
  rows.push(compareCell('ISSN', j1.i || '—', j2.i || '—'));
  rows.push(compareCell('Impact Factor', j1.f, j2.f));
  rows.push(compareCell('JCR Quartile', j1.q ? j1.q.toUpperCase() : '—', j2.q ? j2.q.toUpperCase() : '—'));
  rows.push(compareCell('CAS Zone', j1.z != null ? `${j1.z}区` : '—', j2.z != null ? `${j2.z}区` : '—'));
  rows.push(compareCell('Indexing', fmtIdx(j1), fmtIdx(j2)));
  rows.push(compareCell('Open Access', fmtOA(j1), fmtOA(j2)));
  rows.push(compareCell('Subject (ESI)', j1.es || '—', j2.es || '—'));

  let html = await loadAppShell(ctx);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seo.desc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(seo.url)}" />`);
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace('</head>', '<meta name="robots" content="index,follow" />\n</head>');
  }

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seo.title, description: seo.desc, url: seo.url,
    isPartOf: { '@type': 'WebSite', name: 'AILatest Journal', url: 'https://journal.ailatest.org/' },
    about: [
      { '@type': 'Periodical', name: n1, url: `${origin}/journal/${slug1}/` },
      { '@type': 'Periodical', name: n2, url: `${origin}/journal/${slug2}/` },
    ],
  };
  html = html.replace('</head>', `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>\n</head>`);

  const style = 'body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;margin:0;padding:20px;background:#fafafa;color:#222;line-height:1.6}';
  const wrap = 'max-width:800px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:24px';
  const compHTML = `<div style="${style}"><div style="${wrap}">
    <h1 style="font-size:20px;margin:0 0 4px">${esc(n1)} vs ${esc(n2)}</h1>
    <p style="color:#666;margin-bottom:16px">${esc(seo.desc)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd">Metric</th>
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd"><a href="${origin}/journal/${slug1}/">${esc(n1)}</a></th>
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd"><a href="${origin}/journal/${slug2}/">${esc(n2)}</a></th>
      </tr></thead>
      <tbody>${rows.join('\n')}</tbody>
    </table>
    <p style="margin-top:20px;font-size:13px"><a href="${origin}/">← Back to Journal Search</a></p>
  </div></div>`;

  html = html.replace('</body>', compHTML + '\n</body>');
  return html;
}

// ───────── 404 page ─────────
function notFound(msg = 'Journal not found.') {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>404 - Not Found | AILatest Journal</title>
<meta name="robots" content="noindex,follow" />
<style>body{font-family:sans-serif;padding:40px;text-align:center}h1{font-size:48px;color:#ccc;margin:0}p{color:#666}a{color:#2563eb}</style>
</head><body><h1>404</h1><p>${esc(msg)}</p><p><a href="https://journal.ailatest.org/">← Back to Journal Search</a></p></body></html>`;
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
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    // Handle /compare/<a>-vs-<b>/
    if (path.startsWith('/compare/')) {
      const raw = path.replace('/compare/', '').replace(/\/$/, '');
      if (!raw) return Response.redirect(url.origin + '/', 302);
      // Split on LAST occurrence of -vs- to handle slugs containing "vs"
      const vsIdx = raw.lastIndexOf('-vs-');
      if (vsIdx < 1) return notFound('Invalid compare URL. Use /compare/journal-a-vs-journal-b/');
      const rawA = raw.slice(0, vsIdx);
      const rawB = raw.slice(vsIdx + 4);

      const index = await loadIndex(ctx);
      const ca = journalSlugCandidates(rawA);
      const slugA = ca.find(s => index[s]);
      const cb = journalSlugCandidates(rawB);
      const slugB = cb.find(s => index[s]);
      if (!slugA || !slugB) return notFound('One or both journals not found.');
      let jA = slugA ? index[slugA] : null;
      let jB = slugB ? index[slugB] : null;
      if (jA && jA._r) { slugA = jA._r; jA = index[slugA]; }
      if (jB && jB._r) { slugB = jB._r; jB = index[slugB]; }
      if (!jA || !jB) return notFound('One or both journals not found.');

      const html = await comparePage(ctx, jA, jB, slugA, slugB, url.origin);
      return new Response(html, { status: 200,
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    // All other routes: serve static assets
    return ctx.env.ASSETS.fetch(request);

  } catch (e) {
    try { return await ctx.env.ASSETS.fetch(request); } catch(_) {}
    return new Response(`Error: ${e.message}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
}
