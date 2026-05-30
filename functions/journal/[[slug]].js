// Cloudflare Pages Function — handles /journal/<issn>/ routes
// Generates SEO-optimized HTML for each journal detail page.
// The HTML includes meta tags for crawlers, then redirects to the main SPA via #j/<id>.

let journalsCache = null;
let journalsLoadPromise = null;

async function loadJournals(context) {
  if (journalsCache) return journalsCache;
  if (journalsLoadPromise) return journalsLoadPromise;

  journalsLoadPromise = (async () => {
    try {
      // Fetch the gzipped journal data from the same deployment
      const url = new URL('/data/journals.json.gz', context.request.url);
      const resp = await context.env.ASSETS.fetch(url);
      if (!resp.ok) {
        console.error('Failed to load journals:', resp.status);
        journalsCache = [];
        return journalsCache;
      }
      const buf = await resp.arrayBuffer();
      // Decompress: use DecompressionStream if available
      const ds = new DecompressionStream('gzip');
      const decompressed = await new Response(
        new ReadableStream({ start: (c) => { c.enqueue(new Uint8Array(buf)); c.close(); } })
          .pipeThrough(ds)
      ).text();
      journalsCache = JSON.parse(decompressed);
      console.log(`Loaded ${journalsCache.length} journals`);
      return journalsCache;
    } catch (e) {
      console.error('Error loading journals:', e.message);
      journalsCache = [];
      return journalsCache;
    }
  })();

  return journalsLoadPromise;
}

function escape(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findJournal(journals, slug) {
  const cleanSlug = slug.replace(/\/$/, '');
  // Try ISSN or EISSN match
  for (const r of journals) {
    if (r.issn === cleanSlug || r.eissn === cleanSlug) return r;
  }
  // Try normalized name (last resort)
  const normSlug = cleanSlug.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const r of journals) {
    const name = (r.name || r.cn_name || r.en_name || '');
    const norm = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (norm === normSlug) return r;
  }
  return null;
}

function buildTitle(r) {
  const parts = [];
  parts.push(escape(r.name || r.cn_name || r.en_name || 'Journal'));
  if (r.if_2024 != null) parts.push(`IF ${r.if_2024}`);
  if (r.if_quartile) parts.push(r.if_quartile.toUpperCase());
  if (r.indices && r.indices.length) parts.push(r.indices.slice(0, 3).join('/'));
  parts.push('AILatest Journal');
  return parts.join(' | ');
}

function buildDesc(r) {
  const name = r.name || r.cn_name || r.en_name || 'Journal';
  let desc = escape(name);
  if (r.if_2024 != null) desc += `: impact factor ${r.if_2024}`;
  if (r.if_quartile) desc += `, JCR ${r.if_quartile.toUpperCase()}`;
  if (r.indices && r.indices.length) desc += `, indexed in ${r.indices.slice(0, 3).join('/')}`;
  if (r.cas_zone != null) desc += `, CAS ${r.cas_zone}区`;
  if (r.publisher) desc += `. Published by ${escape(r.publisher)}`;
  const issn = r.issn || r.eissn || '';
  if (issn) desc += `. ISSN: ${issn}`;
  desc += '.';
  if (desc.length > 300) desc = desc.slice(0, 297) + '...';
  return desc;
}

function buildHtml(r, siteUrl) {
  const title = buildTitle(r);
  const desc = buildDesc(r);
  const slug = r.issn || r.eissn || '';
  const name = escape(r.name || r.cn_name || r.en_name || 'Journal');
  const issn = escape(r.issn || r.eissn || '');
  const ifVal = r.if_2024;
  const q = r.if_quartile || '';
  const cz = r.cas_zone;
  const pub = escape(r.publisher || '');
  const indices = r.indices || [];

  // Build metadata table rows for crawlers
  const fields = [];
  if (issn) fields.push(['ISSN', issn]);
  if (ifVal != null) fields.push(['Impact Factor (2024)', String(ifVal)]);
  if (q) fields.push(['JCR Quartile', q.toUpperCase()]);
  if (cz != null) fields.push(['CAS Zone', `${cz}区`]);
  if (indices.length) fields.push(['Indexing', indices.join(', ')]);
  if (pub) fields.push(['Publisher', pub]);
  const metaRows = fields.map(([k, v]) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">${escape(k)}</td><td style="padding:4px 0">${escape(v)}</td></tr>\n`
  ).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${siteUrl}/journal/${slug}/" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${siteUrl}/journal/${slug}/" />
<meta name="robots" content="index,follow" />
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#fafafa;color:#222;line-height:1.6}
  .card{max-width:720px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:32px}
  h1{font-size:22px;margin:0 0 8px}
  .meta{font-size:13px;color:#888;margin-bottom:16px}
  table{font-size:14px;width:100%;border-collapse:collapse}
  .back{display:inline-block;margin-top:20px;padding:8px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px}
  .back:hover{background:#1d4ed8}
  .loading{margin-top:20px;padding:12px;background:#f0f7ff;border-radius:6px;font-size:13px;color:#2563eb;text-align:center}
</style>
</head>
<body>
<div class="card">
<h1>${name}</h1>
<div class="meta">ISSN: ${issn}</div>
<table>${metaRows}</table>
<a class="back" href="${siteUrl}/" target="_top">← Back to Journal Search</a>
<div class="loading">Redirecting to full journal details...</div>
</div>
<script>
window.location.replace("${siteUrl}/#j/${slug}");
</script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { params, request } = context;
  const url = new URL(request.url);
  const siteUrl = url.origin;

  // Extract slug from the [[slug]] param (array of path segments)
  // /journal/2053-1583/ → ['2053-1583', '']; /journal/2053-1583 → ['2053-1583']
  const slugSegments = (params.slug || []).filter(s => s.trim() !== '');
  const slug = slugSegments.join('/');

  if (!slug) {
    // /journal/ with no slug → redirect to home
    return Response.redirect(`${siteUrl}/`, 302);
  }

  const journals = await loadJournals(context);
  const journal = findJournal(journals, slug);

  if (!journal) {
    return new Response('Journal not found', { status: 404 });
  }

  const html = buildHtml(journal, siteUrl);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
