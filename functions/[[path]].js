// Cloudflare Pages Function — root catch-all
// - /journal/<name-slug>/  → generates SEO detail pages (primary)
// - /journal/<issn>/       → 301 redirects to name-slug URL
// - All other routes       → pass through to static assets

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

function titleCaseName(s) {
  return String(s || '').toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
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

  return {
    title,
    desc,
    url: `${origin}/journal/${slug}/`,
  };
}

function replaceMeta(html, selector, replacement) {
  if (selector.test(html)) return html.replace(selector, replacement);
  return html.replace('</head>', `${replacement}\n</head>`);
}

async function journalPage(ctx, j, slug, origin) {
  const seo = journalSeo(j, slug, origin);
  let html = await loadAppShell(ctx);
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`);
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
  return html;
}

export async function onRequest(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Handle /journal/<slug>/
    if (path.startsWith('/journal/')) {
      const rawSlug = path.replace('/journal/', '').replace(/\/$/, '');
      if (!rawSlug) {
        return Response.redirect(url.origin + '/', 302);
      }

      const index = await loadIndex(ctx);
      // Try exact match first (name-based slug), then try bare ISSN (strip hyphens)
      const slug = index[rawSlug] ? rawSlug : rawSlug.replace(/-/g, '');
      let j = index[slug];

      if (!j) {
        return new Response('Journal not found', { status: 404,
          headers: { 'Content-Type': 'text/plain' } });
      }

      // ISSN-based entry → 301 redirect to name-slug
      if (j._r) {
        return Response.redirect(url.origin + '/journal/' + j._r + '/', 301);
      }

      const html = await journalPage(ctx, j, slug, url.origin);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=utf-8',
                   'Cache-Control': 'public, max-age=3600, s-maxage=86400' }
      });
    }

    // All other routes: serve static assets
    return ctx.env.ASSETS.fetch(request);

  } catch (e) {
    // If journal function fails, try static assets as fallback
    try { return await ctx.env.ASSETS.fetch(request); } catch(_) {}
    return new Response(`Error: ${e.message}`, { status: 500,
      headers: { 'Content-Type': 'text/plain' } });
  }
}
