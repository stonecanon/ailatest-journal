/**
 * AILatest Journal — SSR page for /journal/:issn
 *
 * Renders a complete HTML page with SEO metadata + journal content.
 * Google sees full content without needing JS execution.
 */

// ── Module-level caches (shared across requests to the same isolate) ──
let journalsCache = null;    // parsed journal array
let oaCache = null;          // parsed oa.json map
let rcCache = null;          // parsed review_cycles.json map
let versionCache = null;     // version string from index.html
let versionCacheTime = 0;

const VERSION_CACHE_TTL = 300_000; // 5 min

// ── Helpers ──
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function escape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ── Data loaders ──

async function loadData(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const ct = resp.headers.get('content-type') || '';
  if (url.endsWith('.gz')) {
    const stream = resp.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  }
  return resp.json();
}

async function getJournals() {
  if (journalsCache) return journalsCache;
  const url = new URL('/data/journals.json.gz', 'https://journal.ailatest.org').href;
  journalsCache = await loadData(url);
  return journalsCache;
}

async function getOA() {
  if (oaCache) return oaCache;
  const url = new URL('/data/oa.json', 'https://journal.ailatest.org').href;
  oaCache = await loadData(url);
  return oaCache;
}

async function getReviewCycles() {
  if (rcCache) return rcCache;
  const url = new URL('/data/review_cycles.json', 'https://journal.ailatest.org').href;
  rcCache = await loadData(url);
  return rcCache;
}

// ── Rendering ──

function renderZoneTag(zone) {
  if (!zone && zone !== 0) return '';
  const z = parseInt(zone);
  const colors = ['#1a237e', '#283593', '#5c6bc0', '#9fa8da'];
  const labels = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4'];
  const idx = Math.max(0, Math.min(z - 1, 3));
  return `<span class="badge" style="background:${colors[idx]}">${labels[idx]}</span>`;
}

function renderCycleHTML(rc) {
  if (!rc) return '';
  if (rc.avg_months) {
    return `${escape(String(rc.avg_months))} months (submission→pub.)`;
  }
  if (rc.median_days) {
    const m = (rc.median_days / 30.44).toFixed(1);
    return `median ${m} months (received→accepted, n=${rc.sample_size})`;
  }
  return '';
}

function renderTopics(topics) {
  if (!topics || !topics.length) return '';
  return topics.map(t => `<span class="topic-tag">${escape(t)}</span>`).join('');
}

function renderJournalPage(journal, oaData, rcData, baseUrl) {
  const issn = journal.eissn || journal.issn || '';
  const lang = 'en';
  const title = journal.name || journal.title || '';
  const pageTitle = `${title} (ISSN ${issn}) — Journal Profile | AILatest Journal`;
  const siteName = 'AILatest Journal';

  // Build description
  const descParts = [title];
  if (journal.if_2024) descParts.push(`IF: ${journal.if_2024}`);
  if (journal.if_quartile) descParts.push(`${journal.if_quartile}`);
  if (journal.cas_zone || journal.cas_zone === 0) descParts.push(`CAS Zone ${journal.cas_zone_2023 || journal.cas_zone}`);
  if (rcData && (rcData.avg_months || rcData.median_days)) {
    const cycle = rcData.avg_months ? `${rcData.avg_months} month review cycle` : `${(rcData.median_days / 30.44).toFixed(1)} month median review cycle`;
    descParts.push(cycle);
  }
  if (journal.publisher) descParts.push(`Published by ${journal.publisher}`);
  const description = descParts.join(' | ');

  const canonicalUrl = `${baseUrl}/journal/${issn}`;
  const indices = Array.isArray(journal.indices) ? journal.indices.join(', ') : journal.indices || '';
  const categories = Array.isArray(journal.wos_categories) ? journal.wos_categories.join(', ') : '';
  const oaTopics = Array.isArray(oaData?.tp) ? oaData.tp.slice(0, 6) : [];
  const reviewCycle = renderCycleHTML(rcData);
  const zone2023 = journal.cas_zone_2023 ?? journal.cas_zone;

  // Structured data (JSON-LD)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name: title,
    issn: issn,
    description: description,
    url: canonicalUrl,
    publisher: journal.publisher ? { '@type': 'Organization', name: journal.publisher } : undefined,
    genre: categories || undefined,
    ...(journal.if_2024 ? {
      // We can't use IF directly in schema.org, but we can put it in description
    } : {}),
  };

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(pageTitle)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${escape(canonicalUrl)}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${escape(canonicalUrl)}">
  <meta property="og:site_name" content="${escape(siteName)}">
  <meta property="og:locale" content="en_US">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${JSON.stringify(structuredData, null, 2)}</script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f5f0e8; color: #2c2418; line-height: 1.6;
    }
    .ssr-container { max-width: 720px; margin: 0 auto; padding: 32px 20px; }
    .ssr-header { margin-bottom: 28px; }
    .ssr-header h1 { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
    .ssr-issn { font-size: 13px; color: #777; }
    .ssr-section { margin-bottom: 24px; }
    .ssr-section h2 {
      font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 10px; padding-bottom: 6px;
      border-bottom: 1px solid #d4c9a8;
    }
    .ssr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .ssr-stat {
      background: #fff; border-radius: 8px; padding: 12px 14px;
      border: 1px solid #e0d8c4;
    }
    .ssr-stat-v { font-size: 20px; font-weight: 700; color: #2c2418; }
    .ssr-stat-k { font-size: 11px; color: #888; margin-top: 2px; }
    .ssr-meta { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 3px;
      font-size: 11px; font-weight: 600; color: #fff;
    }
    .badge-scie { background: #1565c0; }
    .badge-ssci { background: #6a1b9a; }
    .badge-ahci { background: #00838f; }
    .badge-esci { background: #2e7d32; }
    .topic-tag {
      display: inline-block; padding: 3px 10px; margin: 2px; border-radius: 12px;
      background: #e8e0d0; color: #3a2e1f; font-size: 12px;
    }
    .ssr-categories { font-size: 14px; color: #555; }
    .ssr-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #d4c9a8; }
    .ssr-footer a { color: #8b6914; text-decoration: none; }
    .ssr-footer a:hover { text-decoration: underline; }
    .ssr-footer p { font-size: 13px; color: #888; }
    .ssr-zone { font-size: 14px; color: #555; margin-top: 4px; }
    .ssr-sub { font-size: 11px; color: #aaa; }
    @media (max-width: 480px) {
      .ssr-grid { grid-template-columns: 1fr; }
      .ssr-container { padding: 20px 14px; }
    }
  </style>
</head>
<body>
  <div class="ssr-container">
    <!-- Header -->
    <div class="ssr-header">
      <h1>${escape(title)}</h1>
      <div class="ssr-issn">
        ISSN: ${escape(issn)}
        ${indices ? `<span style="margin-left:8px">${indices}</span>` : ''}
      </div>
    </div>

    <!-- Stats Grid -->
    ${journal.if_2024 || zone2023 != null || reviewCycle ? `
    <div class="ssr-section">
      <h2>Journal Metrics</h2>
      <div class="ssr-grid">
        ${journal.if_2024 ? `
        <div class="ssr-stat">
          <div class="ssr-stat-v">${escape(String(journal.if_2024))}</div>
          <div class="ssr-stat-k">Impact Factor (2024)</div>
          ${journal.if_rank ? `<div class="ssr-sub">${escape(journal.if_rank)}</div>` : ''}
        </div>` : ''}
        ${journal.if_quartile ? `
        <div class="ssr-stat">
          <div class="ssr-stat-v">${escape(journal.if_quartile)}</div>
          <div class="ssr-stat-k">JCR Quartile</div>
        </div>` : ''}
        ${zone2023 != null ? `
        <div class="ssr-stat">
          <div class="ssr-stat-v">Zone ${escape(String(zone2023))}</div>
          <div class="ssr-stat-k">CAS Zone (${journal.cas_zone_2023 ? '2023' : ''})</div>
          <div class="ssr-sub">${escape(journal.cas_major_cn || '')}</div>
        </div>` : ''}
        ${reviewCycle ? `
        <div class="ssr-stat">
          <div class="ssr-stat-v" style="font-size:16px">${reviewCycle}</div>
          <div class="ssr-stat-k">Review Cycle</div>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- Publisher & Categories -->
    <div class="ssr-section">
      <h2>Journal Information</h2>
      ${journal.publisher ? `<p style="margin-bottom:6px"><strong>Publisher:</strong> ${escape(journal.publisher)}</p>` : ''}
      ${categories ? `<p style="margin-bottom:6px"><strong>WoS Categories:</strong> ${escape(categories)}</p>` : ''}
      ${journal.esi_category ? `<p style="margin-bottom:6px"><strong>ESI Category:</strong> ${escape(journal.esi_category)}</p>` : ''}
      ${journal.country ? `<p><strong>Country:</strong> ${escape(journal.country)}</p>` : ''}
    </div>

    <!-- Index Badges -->
    ${Array.isArray(journal.indices) && journal.indices.length ? `
    <div class="ssr-section">
      <h2>Indexing</h2>
      <div class="ssr-meta">
        ${journal.indices.map(i => {
          const cls = `badge badge-${i.toLowerCase()}`;
          return `<span class="${cls}">${escape(i)}</span>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- OpenAlex Research Topics -->
    ${oaTopics.length ? `
    <div class="ssr-section">
      <h2>Research Topics</h2>
      <div class="ssr-meta">
        ${renderTopics(oaTopics)}
      </div>
    </div>` : ''}

    <!-- DOAJ info -->
    ${journal.doaj?.review ? `
    <div class="ssr-section">
      <h2>Open Access</h2>
      <p style="font-size:14px;color:#555">
        <strong>Review:</strong> ${escape(journal.doaj.review)}<br>
        ${journal.doaj.apc === 'Yes' ? `<strong>APC:</strong> ${escape(journal.doaj.fee || 'Yes')}` : `<strong>APC:</strong> No`}<br>
        ${journal.doaj.lic ? `<strong>License:</strong> ${escape(journal.doaj.lic)}` : ''}
      </p>
    </div>` : ''}

    <!-- Footer -->
    <div class="ssr-footer">
      <p>
        <a href="${escape(baseUrl)}/#/j/${escape(issn)}">Open interactive profile</a>
        &nbsp;·&nbsp;
        <a href="${escape(baseUrl)}/">AILatest Journal</a>
      </p>
      <p style="margin-top:6px">Last updated: ${fmtDate(new Date().toISOString())}</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Request handler ──

export async function onRequest(context) {
  const { request, params } = context;
  const issn = (params.issn || '').replace(/[^0-9\-]/g, '');

  if (!issn || issn.length < 4) {
    return new Response('Invalid ISSN', { status: 400 });
  }

  try {
    const [journals, oa, rc] = await Promise.all([
      getJournals(),
      getOA(),
      getReviewCycles(),
    ]);

    // Find journal by ISSN or EISSN
    const journal = Array.isArray(journals)
      ? journals.find(j => (j.issn || '') === issn || (j.eissn || '') === issn)
      : null;

    if (!journal) {
      return new Response('Journal not found', { status: 404 });
    }

    const oaData = oa[issn] || null;
    const rcData = rc[issn] || null;
    const baseUrl = 'https://journal.ailatest.org';

    const html = renderJournalPage(journal, oaData, rcData, baseUrl);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err) {
    console.error('SSR error:', err?.message || err);
    return new Response('Internal error', { status: 500 });
  }
}
