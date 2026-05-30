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

function journalPage(j, slug, origin) {
  const name = j.n || 'Journal';
  const ifVal = j.f;
  const quartile = j.q;
  const indices = j.ix || [];
  const issn = j.i || slug;

  const titleParts = [name];
  if (ifVal != null) titleParts.push(`IF ${ifVal}`);
  if (quartile) titleParts.push(quartile.toUpperCase());
  if (indices.length) titleParts.push(indices.slice(0, 3).join('/'));
  titleParts.push('AILatest Journal');
  const title = titleParts.join(' | ');

  let desc = `${esc(name)}`;
  if (ifVal != null) desc += `: impact factor ${ifVal}`;
  if (quartile) desc += `, JCR ${quartile.toUpperCase()}`;
  if (indices.length) desc += `, indexed in ${indices.join('/')}`;
  if (j.p) desc += `. Published by ${esc(j.p)}`;
  desc += `. ISSN: ${issn}.`;
  if (desc.length > 300) desc = desc.slice(0, 297) + '...';

  const metaRows = [];
  if (issn) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">ISSN</td><td>${esc(issn)}</td></tr>`);
  if (ifVal != null) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">IF 2024</td><td>${ifVal}</td></tr>`);
  if (quartile) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">JCR</td><td>${quartile.toUpperCase()}</td></tr>`);
  if (indices.length) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">Indexing</td><td>${esc(indices.join(', '))}</td></tr>`);
  if (j.p) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">Publisher</td><td>${esc(j.p)}</td></tr>`);

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${origin}/journal/${slug}/" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta name="robots" content="index,follow" />
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#fafafa;color:#222;line-height:1.6}.card{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:24px}</style>
</head>
<body><div class="card">
<h1 style="margin:0 0 8px;font-size:20px">${esc(name)}</h1>
<div style="font-size:13px;color:#888;margin-bottom:16px">ISSN: ${esc(issn)}</div>
<table style="font-size:14px;width:100%">${metaRows.join('')}</table>
<a href="${origin}/" style="display:inline-block;margin-top:16px;padding:8px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">← Back to Journal Search</a>
<script>window.location.replace("${origin}/#j/${encodeURIComponent(j.sl || slug)}")</script>
</div></body>
</html>`;
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

      const html = journalPage(j, slug, url.origin);
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
