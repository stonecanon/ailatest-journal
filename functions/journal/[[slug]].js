// Cloudflare Pages Function — /journal/<issn>/ detail pages
// Uses a compact pre-built index (data/journal_index.json)

let indexCache = null;

async function loadIndex(ctx) {
  if (indexCache) return indexCache;
  
  try {
    const req = new Request('https://journal.ailatest.org/data/journal_index.json');
    const resp = await ctx.env.ASSETS.fetch(req);
    if (!resp.ok) throw new Error(`ASSETS fetch: ${resp.status}`);
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

export async function onRequest(ctx) {
  const { request, params } = ctx;
  const url = new URL(request.url);
  const origin = url.origin;
  
  try {
    const slugParts = (params.slug || []).filter(s => s.trim() !== '');
    const slug = slugParts.join('/');
    
    if (!slug) {
      return Response.redirect(`${origin}/`, 302);
    }
    
    const index = await loadIndex(ctx);
    const j = index[slug];
    
    if (!j) {
      return new Response('Journal not found', { status: 404 });
    }
    
    const name = j.n || 'Journal';
    const ifVal = j.f;
    const quartile = j.q;
    const indices = j.ix || [];
    const issn = j.i || j.is || slug;
    
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
    
    const head = `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${origin}/journal/${slug}/" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta name="robots" content="index,follow" />`;
    
    const metaRows = [];
    if (issn) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">ISSN</td><td>${esc(issn)}</td></tr>`);
    if (ifVal != null) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">IF 2024</td><td>${esc(String(ifVal))}</td></tr>`);
    if (quartile) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">JCR</td><td>${esc(quartile.toUpperCase())}</td></tr>`);
    if (indices.length) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">Indexing</td><td>${esc(indices.join(', '))}</td></tr>`);
    if (j.p) metaRows.push(`<tr><td style="padding:4px 8px 4px 0;color:#666">Publisher</td><td>${esc(j.p)}</td></tr>`);
    
    const body = `<h1 style="margin:0 0 8px;font-size:20px">${esc(name)}</h1>
<div style="font-size:13px;color:#888;margin-bottom:16px">ISSN: ${esc(issn)}</div>
<table style="font-size:14px">${metaRows.join('')}</table>
<a href="${origin}/" style="display:inline-block;margin-top:16px;padding:8px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">← Back</a>
<script>window.location.replace("${origin}/#j/${slug}")</script>`;
    
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
${head}
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#fafafa;color:#222;line-height:1.6}.card{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:24px}</style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' }
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
}
