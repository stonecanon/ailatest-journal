// Cloudflare Pages Function for crawlable journal detail pages.
//
// The catalogue is a client-side application, but every URL in the sitemap
// must still return a unique, server-visible document.  This function keeps
// the existing app shell (so the visual page is the same as the homepage),
// injects journal-specific metadata/content, and lets app.js hydrate the
// interactive detail view after first paint.

let indexPromise = null;

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compact(value) {
  return String(value || '').replace(/[^0-9X]/gi, '').toUpperCase();
}

function decodePart(value) {
  let out = String(value || '').trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch (_) {
      break;
    }
  }
  return out;
}

function keyFor(value) {
  return decodePart(value).replace(/\/+$/, '').toLowerCase();
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

async function loadIndex(ctx) {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const assetUrl = new URL('/data/journal_seo.json.gz', ctx.request.url);
    const response = await ctx.env.ASSETS.fetch(new Request(assetUrl));
    if (!response.ok) throw new Error(`journal SEO data fetch failed: ${response.status}`);
    if (!response.body) throw new Error('journal SEO data has no body');
    const text = await new Response(
      response.body.pipeThrough(new DecompressionStream('gzip'))
    ).text();
    const payload = JSON.parse(text);
    const map = Object.create(null);
    for (const item of payload.items || []) {
      if (!item || !item.s) continue;
      map[keyFor(item.s)] = item;
      const issn = compact(item.i);
      const eissn = compact(item.is);
      if (issn) map[issn.toLowerCase()] = item;
      if (eissn) map[eissn.toLowerCase()] = item;
    }
    return map;
  })();
  try {
    return await indexPromise;
  } catch (error) {
    indexPromise = null;
    throw error;
  }
}

function findJournal(index, raw) {
  const decoded = decodePart(raw).replace(/^\/+|\/+$/g, '');
  const candidates = [
    keyFor(decoded),
    keyFor(decoded.replace(/^journal\//i, '')),
    compact(decoded).toLowerCase(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (index[candidate]) return index[candidate];
  }
  return null;
}

function latestHistory(journal) {
  return (journal.ann || [])
    .map((item) => ({ year: Number(item.y), count: Number(item.c) }))
    .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.count))
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
}

function valueOrDash(value) {
  return value == null || value === '' ? '—' : String(value);
}

function journalSeo(journal, slug, origin) {
  const name = journal.n || 'Journal';
  const bits = [name];
  if (journal.f != null) bits.push(`IF ${journal.f}`);
  if (journal.q) bits.push(String(journal.q).toUpperCase());
  if (journal.z != null) bits.push(`CAS ${journal.z}`);
  bits.push('AILatest Journal');
  const descriptionParts = [`${name} journal profile`];
  if (journal.f != null) descriptionParts.push(`Impact Factor ${journal.f}`);
  if (journal.q) descriptionParts.push(`JCR ${String(journal.q).toUpperCase()}`);
  if (journal.z != null) descriptionParts.push(`CAS Zone ${journal.z}`);
  if (journal.ix && journal.ix.length) descriptionParts.push(`indexed in ${journal.ix.slice(0, 5).join(', ')}`);
  if (journal.p) descriptionParts.push(`published by ${journal.p}`);
  if (journal.i || journal.is) descriptionParts.push(`ISSN ${journal.i || journal.is}`);
  let description = `${descriptionParts.join(', ')}.`;
  if (description.length > 300) description = `${description.slice(0, 297)}...`;
  return {
    title: bits.join(' | '),
    description,
    url: `${origin}/journal/${encodeURIComponent(slug)}/`,
  };
}

function badges(journal) {
  const values = [...(journal.ix || [])];
  if (journal.sc) values.push('Scopus');
  if (journal.med) values.push('MEDLINE');
  if (journal.pm) values.push('PubMed');
  if (journal.pmc) values.push('PMC');
  if (journal.doaj) values.push('DOAJ');
  return [...new Set(values.filter(Boolean))].slice(0, 10);
}

function serverDetailBody(journal, slug, origin) {
  const name = journal.n || 'Journal';
  const issnLine = [journal.i ? `ISSN ${journal.i}` : '', journal.is ? `eISSN ${journal.is}` : '']
    .filter(Boolean).join(' · ');
  const subjectLine = (journal.wos || []).slice(0, 5).join(' · ') || journal.es || 'Academic journal';
  const indexBadges = badges(journal).map((item) => `<span class="badge">${esc(item)}</span>`).join('');
  const history = latestHistory(journal);
  const historyText = history.length
    ? history.map((item) => `${item.year}: ${item.count.toLocaleString()} works`).join(' · ')
    : 'Not currently available in the public bundle';
  const official = journal.hp
    ? `<a class="big-btn primary" href="${esc(journal.hp)}" target="_blank" rel="noopener nofollow">Journal website</a>`
    : '';
  const appLink = `${origin}/#j/${encodeURIComponent(journal.i || journal.is || slug)}`;
  const facts = [
    ['Impact Factor', valueOrDash(journal.f)],
    ['JCR quartile', journal.q ? String(journal.q).toUpperCase() : '—'],
    ['CAS zone', journal.z == null ? '—' : `${journal.z}${journal.zt ? ' · Top' : ''}`],
    ['Publisher', journal.p || '—'],
    ['Country/region', journal.country || '—'],
  ].map(([label, value]) => `<div class="meta-row"><div class="meta-k">${esc(label)}</div><div class="meta-v"><strong>${esc(value)}</strong></div></div>`).join('');
  const faq = [
    [`What is the Impact Factor of ${name}?`, journal.f != null ? `The current bundle records an Impact Factor of ${journal.f}.` : 'A verified Impact Factor is not currently available in the bundle.'],
    [`Which indexes cover ${name}?`, indexBadges ? `The current bundle marks this title as ${badges(journal).join(', ')}.` : 'No indexing badges are currently available in the bundle.'],
    [`Is ${name} open access?`, journal.doaj ? 'The title has a DOAJ record in the current bundle.' : 'Open-access status is not confirmed by the current bundle.'],
  ].map(([question, answer]) => `<details><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join('');
  return `<div class="detail-layout is-page">
  <main class="detail-main-col">
    <article class="d-hero">
      <div class="d-hero-row"><div class="d-hero-text">
        <div class="drawer-kicker">Journal details</div>
        <h1>${esc(name)}</h1>
        <div class="d-cn">${esc([journal.c || '', journal.p || '', issnLine].filter(Boolean).join(' · '))}</div>
        <div class="d-subj">${esc(subjectLine)}</div>
        <div class="pills badges">${indexBadges || '<span class="muted-cell">Indexing data unavailable</span>'}</div>
        <div class="cta-row">${official}<a class="big-btn ghost" href="${esc(appLink)}">Open interactive details</a></div>
      </div></div>
    </article>
    <section class="detail-more drawer-section">
      <h2>Journal overview</h2>
      <p>${esc(`${name} is listed in AILatest Journal for journal discovery and submission planning. Review the indexed databases, ranking signals, publisher information and subject coverage here, then confirm current requirements on the official journal website before submitting.`)}</p>
      <div class="info-grid">${facts}</div>
    </section>
    <section class="detail-more drawer-section"><h2>Publication history</h2><p>${esc(historyText)}. Source: OpenAlex-linked public data when available.</p></section>
    <section class="detail-more drawer-section faq"><h2>Frequently asked questions</h2>${faq}</section>
  </main>
  <aside class="detail-side-col"><div class="side-h">Data note</div><div class="side-card"><p>Metrics are compiled from public sources and may lag the journal or index provider. Use the official journal instructions as the final authority.</p></div></aside>
</div>`;
}

// The browser hydrates this compact record into the same detail component used
// by the homepage. Keep the payload small; the full journal bundle is loaded
// in the background after the first paint.
function journalRouteSeed(journal, slug) {
  return {
    slug,
    name: journal.n || '',
    issn: journal.i || '',
    eissn: journal.is || '',
    country: journal.country || '',
    publisher: journal.p || '',
    indices: Array.isArray(journal.ix) ? journal.ix : [],
    scopus: journal.sc ? { active: true } : null,
    medline: !!journal.med,
    pubmed: !!journal.pm,
    pmc: !!journal.pmc,
    doaj: !!journal.doaj,
    oa: journal.oa || '',
    homepage: journal.hp || '',
    apc: journal.apc == null ? null : journal.apc,
    tier: journal.tier || '',
    publication_history: Array.isArray(journal.ann)
      ? journal.ann
        .map((item) => ({ year: Number(item.y), count: Number(item.c) }))
        .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.count))
      : [],
    __src: 'int',
    __routeSeed: true,
  };
}

function notFound(origin) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Journal not found | AILatest Journal</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${origin}/"></head><body><h1>Journal not found</h1><p><a href="${origin}/">Back to AILatest Journal</a></p></body></html>`;
  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html;charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'X-Robots-Tag': 'noindex, follow',
    },
  });
}

async function render(ctx, journal, slug) {
  const origin = new URL(ctx.request.url).origin;
  const seo = journalSeo(journal, slug, origin);
  const shellResponse = await ctx.env.ASSETS.fetch(new Request(new URL('/index.html', ctx.request.url)));
  if (!shellResponse.ok) throw new Error(`index shell fetch failed: ${shellResponse.status}`);
  let html = await shellResponse.text();
  html = html.replace(/<html\s+lang="[^"]*"/i, '<html lang="en"');
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${esc(seo.description)}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${esc(seo.url)}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:url" content="${esc(seo.url)}" />`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${esc(seo.title)}" />`);
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${esc(seo.description)}" />`);
  html = html.replace(/<link rel="alternate"[^>]+hreflang="[^"]*"[^>]*>\s*/gi, '');
  const schema = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: seo.title, description: seo.description, url: seo.url, isPartOf: { '@type': 'WebSite', name: 'AILatest Journal', url: `${origin}/` } },
    { '@context': 'https://schema.org', '@type': 'Periodical', name: journal.n, url: seo.url, issn: journal.i || undefined, publisher: journal.p ? { '@type': 'Organization', name: journal.p } : undefined },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'AILatest Journal', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: journal.n, item: seo.url }] },
  ].map((item) => `<script type="application/ld+json">${jsonLd(item)}</script>`).join('\n');
  html = html.replace('</head>', `<meta name="robots" content="index,follow" />\n${schema}\n<script id="journal-route-seed" type="application/json">${jsonLd(journalRouteSeed(journal, slug))}</script>\n</head>`);
  html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
    const cleaned = String(attrs || '').replace(/\sclass="[^"]*"/i, '');
    return `<body${cleaned} class="journal-route">`;
  });
  html = html.replace(/<aside id="j-drawer" class="j-drawer" aria-hidden="true">/i, '<aside id="j-drawer" class="j-drawer open journal-page" aria-hidden="false">');
  html = html.replace('<div id="drawer-body" class="drawer-body"></div>', `<div id="drawer-body" class="drawer-body">${serverDetailBody(journal, slug, origin)}</div>`);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'index, follow',
    },
  });
}

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const rawSlug = url.pathname.replace(/^\/journal\//i, '').replace(/\/+$/, '');
  if (!rawSlug) return Response.redirect(`${url.origin}/`, 302);
  try {
    const index = await loadIndex(ctx);
    const journal = findJournal(index, rawSlug);
    if (!journal) return notFound(url.origin);
    const canonicalSlug = journal.s;
    if (keyFor(rawSlug) !== keyFor(canonicalSlug)) {
      return Response.redirect(`${url.origin}/journal/${encodeURIComponent(canonicalSlug)}/`, 301);
    }
    return await render(ctx, journal, canonicalSlug);
  } catch (error) {
    console.error('[journal-seo]', error);
    return new Response('Journal page temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' } });
  }
}
