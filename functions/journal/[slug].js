// Cloudflare Pages Function — /journal/<issn>/ detail pages
// Minimal test — no ASSETS, no async loading

export async function onRequest(ctx) {
  const { request, params } = ctx;
  const url = new URL(request.url);
  
  try {
    const slugParts = (params.slug || []).filter(s => s.trim() !== '');
    const slug = slugParts.join('/');
    
    if (!slug) {
      return Response.redirect(url.origin + '/', 302);
    }
    
    // Inline data as json string (will be imported at build time)
    // This avoids ASSETS.fetch entirely
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/>
<title>Journal: ${slug} | AILatest</title>
<meta name="description" content="Academic journal with ISSN ${slug}. View impact factor, rankings, and indexing details on AILatest Journal." />
<link rel="canonical" href="${url.origin}/journal/${slug}/" />
<meta name="robots" content="index,follow" />
<script>window.location.replace("${url.origin}/#j/${slug}");</script>
</head>
<body><h1>Journal: ${slug}</h1><p>Redirecting...</p></body>
</html>`;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
