// Cloudflare Pages Function root catch-all.
// - /journal/<name-slug>/ renders the app shell with a server-visible journal detail page.
// - /journal/<issn>/ redirects to the canonical name slug.
// - /compare/<a>-vs-<b>/ renders a lightweight comparison page.
// - All other routes are served from static assets.

let indexCache = null;

async function loadIndex(ctx) {
  if (indexCache) return indexCache;
  const req = new Request('https://journal.ailatest.org/data/journal_index.json');
  const resp = await ctx.env.ASSETS.fetch(req);
  if (!resp.ok) throw new Error(`journal_index.json fetch failed: ${resp.status}`);
  indexCache = await resp.json();
  return indexCache;
}

async function loadAppShell(ctx) {
  const req = new Request('https://journal.ailatest.org/index.html');
  const resp = await ctx.env.ASSETS.fetch(req);
  if (!resp.ok) throw new Error(`index.html fetch failed: ${resp.status}`);
  return resp.text();
}

function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleCaseName(value) {
  const keep = new Set(['AI', 'IEEE', 'ACM', 'ACS', 'JAMA', 'BMJ', 'PNAS', 'PLOS', 'DNA', 'RNA']);
  return String(value || '')
    .toLowerCase()
    .replace(/\b([a-z][a-z0-9&'-]*)/g, (word) => {
      const upper = word.toUpperCase();
      if (keep.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
}

function decodeRoutePart(value) {
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

function normalizeJournalSlug(value, stripAccents = true) {
  let out = decodeRoutePart(value).toLowerCase();
  if (stripAccents) out = out.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return out
    .replace(/^\/?(?:journal|compare)\//, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function journalSlugCandidates(rawSlug) {
  const raw = decodeRoutePart(rawSlug).replace(/^\/?(?:journal|compare)\//, '').replace(/\/+$/, '');
  const compactIssn = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return Array.from(new Set([
    raw,
    raw.toLowerCase(),
    normalizeJournalSlug(raw, false),
    normalizeJournalSlug(raw),
    raw.replace(/-/g, ''),
    compactIssn.length >= 7 ? compactIssn : '',
  ].filter(Boolean)));
}

function replaceMeta(html, selector, replacement) {
  if (selector && selector.test(html)) return html.replace(selector, replacement);
  return html.replace('</head>', `${replacement}\n</head>`);
}

function stripAlternateLinks(html) {
  return html.replace(/<link\s+rel="alternate"[^>]*hreflang="[^"]*"[^>]*>\s*/gi, '');
}

function canonicalUrl(origin, slug) {
  return `${origin}/journal/${encodeURIComponent(slug)}/`;
}

function journalName(j) {
  return titleCaseName(j.n || j.e || j.c || 'Journal');
}

function fmt(value, empty = '-') {
  return value == null || value === '' ? empty : String(value);
}

function fmtMoney(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `$${n.toLocaleString('en-US')}`;
}

function oaText(j) {
  const label = String(j.oa || '').replace(/_/g, ' ');
  if (label) return label.replace(/\b\w/g, (c) => c.toUpperCase());
  if (j.doaj) return 'DOAJ open access';
  return '';
}

function subjectText(j) {
  const subjects = [...(j.wos || []), j.es].filter(Boolean);
  return Array.from(new Set(subjects)).slice(0, 8);
}

function coverageBadges(j) {
  const out = [];
  out.push(...(j.ix || []));
  if (j.sc) out.push('Scopus');
  if (j.med) out.push('MEDLINE');
  if (j.pm) out.push('PubMed');
  if (j.pmc) out.push('PMC');
  if (j.doaj) out.push('DOAJ');
  return Array.from(new Set(out.filter(Boolean))).slice(0, 10);
}

function journalSeo(j, slug, origin) {
  const name = journalName(j);
  const titleParts = [name];
  if (j.f != null) titleParts.push(`IF ${j.f}`);
  if (j.z != null) titleParts.push(`CAS ${j.z}`);
  if (j.q) titleParts.push(String(j.q).toUpperCase());
  if (j.ix && j.ix.length) titleParts.push(j.ix.slice(0, 2).join('/'));
  titleParts.push('AILatest Journal');

  const descParts = [`${name} journal information`];
  if (j.f != null) descParts.push(`Impact Factor ${j.f}`);
  if (j.q) descParts.push(`JCR ${String(j.q).toUpperCase()}`);
  if (j.z != null) descParts.push(`CAS ${j.z}`);
  if (j.ix && j.ix.length) descParts.push(`indexed in ${j.ix.join(', ')}`);
  if (j.p) descParts.push(`published by ${j.p}`);
  if (j.i) descParts.push(`ISSN ${j.i}`);

  let desc = descParts.join(', ') + '.';
  if (desc.length > 300) desc = desc.slice(0, 297) + '...';
  return { title: titleParts.join(' | '), desc, url: canonicalUrl(origin, slug) };
}

function metaTags(seo) {
  return [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.desc)}" />`,
    `<link rel="canonical" href="${esc(seo.url)}" />`,
    '<meta name="robots" content="index,follow" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${esc(seo.url)}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.desc)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.desc)}" />`,
  ].join('\n');
}

function buildFAQ(j) {
  const name = journalName(j);
  const oa = oaText(j);
  const apc = fmtMoney(j.apc);
  const annual = (j.ann || [])[0];
  return [
    {
      q: `What is the Impact Factor of ${name}?`,
      a: j.f != null ? `The latest Impact Factor recorded by AILatest Journal for ${name} is ${j.f}.` : `AILatest Journal does not currently have a verified Impact Factor for ${name}.`,
    },
    {
      q: `Is ${name} open access?`,
      a: oa ? `${name} is marked as ${oa}.` : `AILatest Journal does not currently show a verified open access status for ${name}.`,
    },
    {
      q: `What databases index ${name}?`,
      a: coverageBadges(j).length ? `${name} is marked with these coverage badges: ${coverageBadges(j).join(', ')}.` : `No indexing badges are currently available for ${name}.`,
    },
    {
      q: `What is the APC for ${name}?`,
      a: apc ? `The available APC estimate is ${apc}. Always confirm the final fee on the journal website.` : `AILatest Journal does not currently have a verified APC value for ${name}.`,
    },
    {
      q: `How many papers does ${name} publish each year?`,
      a: annual ? `The latest OpenAlex annual output in this database is ${annual.c} works in ${annual.y}.` : `Annual output data is not currently available for ${name}.`,
    },
  ];
}

function buildFAQHtml(j) {
  return `<section class="section faq">
    <h2>Frequently Asked Questions</h2>
    ${buildFAQ(j).map((item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join('')}
  </section>`;
}

function jsonLdBlocks(j, slug, seo, origin) {
  const name = journalName(j);
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: buildFAQ(j).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: 'AI Journals', item: `${origin}/` },
      { '@type': 'ListItem', position: 3, name, item: seo.url },
    ],
  };
  const periodical = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name,
    url: seo.url,
    issn: j.i || undefined,
    eissn: j.is || undefined,
    publisher: j.p ? { '@type': 'Organization', name: j.p } : undefined,
    description: seo.desc,
  };
  const webpage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seo.title,
    description: seo.desc,
    url: seo.url,
    isPartOf: { '@type': 'WebSite', name: 'AILatest Journal', url: `${origin}/` },
    about: { '@type': 'Thing', name, additionalType: 'https://schema.org/Periodical' },
  };
  return [webpage, breadcrumb, periodical, faq]
    .map((obj) => JSON.parse(JSON.stringify(obj)))
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');
}

function metricCards(j) {
  const cards = [];
  if (j.f != null) cards.push(['Impact Factor', j.f, 'JCR 2025 / 2024 metric']);
  if (j.q) cards.push(['JCR Quartile', String(j.q).toUpperCase(), 'Journal Citation Reports']);
  if (j.z != null) cards.push(['CAS Zone', `${j.z}${j.zt ? ' Top' : ''}`, 'CAS major tier']);
  if (j.sc) cards.push(['Scopus', 'Indexed', 'Active source list record']);
  if (oaText(j)) cards.push(['Open Access', oaText(j), j.doaj ? 'DOAJ/OpenAlex' : 'OpenAlex']);
  if (j.apc) cards.push(['APC', fmtMoney(j.apc), 'OpenAlex estimate']);
  if (j.ann && j.ann.length) cards.push(['Annual Output', `${j.ann[0].c}`, `${j.ann[0].y} works, OpenAlex`]);
  if (j.rt && j.rt.total) cards.push(['Retractions', j.rt.total, j.rt.rate10 != null ? `${j.rt.rate10}/1000 works, 10y` : 'Retraction Watch']);
  return cards.map(([label, value, note]) => `<div class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`).join('');
}

function badgeHtml(j) {
  const badges = coverageBadges(j);
  if (!badges.length && !j.tier) return '';
  return `<div class="badge-row">${badges.map((b) => `<span>${esc(b)}</span>`).join('')}${j.tier ? `<span>${esc(j.tier)}</span>` : ''}</div>`;
}

function summaryHtml(j) {
  const name = journalName(j);
  const subjects = subjectText(j);
  const subjectPhrase = subjects.length ? subjects.slice(0, 5).join(', ') : (j.es || 'its scholarly field');
  const publisher = j.p ? ` It is published by ${j.p}.` : '';
  const badges = coverageBadges(j);
  const indexing = badges.length ? ` The journal is currently tagged in AILatest with ${badges.join(', ')} coverage information.` : '';
  const metrics = [
    j.f != null ? `Impact Factor ${j.f}` : '',
    j.q ? `JCR ${String(j.q).toUpperCase()}` : '',
    j.z != null ? `CAS Zone ${j.z}` : '',
    oaText(j) ? oaText(j) : '',
  ].filter(Boolean).join(', ');
  const metricsText = metrics ? ` Key decision signals include ${metrics}.` : '';
  const apc = j.apc ? ` The available APC estimate is ${fmtMoney(j.apc)}, but authors should confirm final fees and waiver policies on the journal website.` : '';
  const annual = j.ann && j.ann.length ? ` Recent publication volume is available from OpenAlex; the latest record in this database shows ${j.ann[0].c} works in ${j.ann[0].y}.` : '';
  const caution = j.rt && j.rt.total ? ` Retraction Watch-linked records are also shown as a caution signal, with ${j.rt.total} total records matched in the current database.` : '';
  return `<section class="section summary">
    <h2>AI Journal Overview</h2>
    <p>${esc(`${name} is a scholarly journal connected with research in ${subjectPhrase}.${publisher}${indexing}${metricsText} Researchers can use this page to review indexing coverage, ranking signals, open access information, publication volume, risk signals, and similar journals before deciding whether to explore the journal further.${apc}${annual}${caution} The information is intended as a starting point for journal discovery and should be checked against the journal's official instructions before submission.`)}</p>
  </section>`;
}

function relatedHtml(j, index, origin) {
  const rel = (j.rel || []).map((slug) => [slug, index[slug]]).filter(([, item]) => item && !item._r).slice(0, 12);
  if (!rel.length) return '';
  return `<section class="section related">
    <h2>Similar Journals</h2>
    <div class="related-grid">
      ${rel.map(([slug, item]) => {
        const name = journalName(item);
        const meta = [item.f != null ? `IF ${item.f}` : '', item.q ? String(item.q).toUpperCase() : '', item.z != null ? `CAS ${item.z}` : '', (item.ix || [])[0] || ''].filter(Boolean).join(' · ');
        return `<a class="related-card" href="${origin}/journal/${encodeURIComponent(slug)}/"><strong>${esc(name)}</strong><span>${esc(meta || item.p || 'Journal details')}</span></a>`;
      }).join('')}
    </div>
  </section>`;
}

function topicsHtml(j, origin) {
  const links = [];
  const knownIndexes = new Set(['scopus', 'scie', 'ssci', 'ei', 'medline', 'esci', 'ahci', 'on-hold', 'under-review', 'warning', 'citic-warning']);
  for (const idx of j.ix || []) {
    const key = String(idx).toLowerCase();
    if (knownIndexes.has(key)) links.push([`${origin}/indexes/${key}/`, `${idx} indexed journals`]);
  }
  links.push([`${origin}/subjects/`, 'Browse journals by subject']);
  links.push([`${origin}/indexes/`, 'Browse journals by index']);
  return `<section class="section topics"><h2>Explore More</h2><div class="topic-row">${links.slice(0, 6).map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join('')}</div></section>`;
}

function journalPageHtml(j, slug, index, origin) {
  const seo = journalSeo(j, slug, origin);
  const name = journalName(j);
  const officialUrl = j.hp || '';
  const appUrl = `${origin}/#j/${encodeURIComponent(j.i || j.is || slug)}`;
  const officialCta = officialUrl
    ? `<a class="btn primary" href="${esc(officialUrl)}" target="_blank" rel="noopener nofollow">Journal Website / Submit</a>`
    : `<span class="btn disabled" aria-disabled="true">Official Website Unavailable</span>`;
  const issnLine = [j.i ? `ISSN ${j.i}` : '', j.is ? `eISSN ${j.is}` : ''].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
${metaTags(seo)}
${jsonLdBlocks(j, slug, seo, origin)}
<style>
:root{--bg:#f7f5f0;--paper:#fff;--ink:#1f1b16;--muted:#6f675d;--rule:#e4ddd0;--accent:#9a4f1f;--accent-dark:#733915;--blue:#24445f;--green:#2f7048;--red:#9f3d35;--shadow:0 10px 30px rgba(57,44,28,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.6}
a{color:inherit}.site-header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);border-bottom:1px solid var(--rule);backdrop-filter:blur(10px)}
.header-inner{max-width:1120px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:22px}.brand{font-weight:800;text-decoration:none;letter-spacing:.01em}.nav{display:flex;gap:16px;margin-left:auto}.nav a{font-size:14px;color:var(--muted);text-decoration:none}.search-link{border:1px solid var(--rule);padding:7px 12px;border-radius:6px;background:#faf8f3}
.wrap{max-width:1120px;margin:0 auto;padding:22px 20px 44px}.breadcrumb{font-size:13px;color:var(--muted);margin-bottom:14px}.breadcrumb a{color:var(--accent);text-decoration:none}
.hero{background:var(--paper);border:1px solid var(--rule);border-radius:10px;box-shadow:var(--shadow);padding:26px;display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px}.kicker{color:var(--accent);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.hero h1{font-size:34px;line-height:1.12;margin:7px 0 10px}.sub{color:var(--muted);font-size:15px}.badge-row{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0}.badge-row span{font-size:12px;font-weight:800;color:#fff;background:var(--blue);border-radius:4px;padding:4px 8px}.cta-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border-radius:7px;text-decoration:none;font-weight:800;border:1px solid var(--rule)}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.secondary{background:#fff;color:var(--accent-dark)}.btn.disabled{color:var(--muted);background:#f0ece4}
.fact-panel{background:#fbfaf7;border:1px solid var(--rule);border-radius:8px;padding:16px}.fact{padding:9px 0;border-bottom:1px solid var(--rule)}.fact:last-child{border-bottom:0}.fact span{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:800}.fact strong{font-size:14px}
.section{margin-top:18px;background:var(--paper);border:1px solid var(--rule);border-radius:10px;box-shadow:var(--shadow);padding:22px}.section h2{font-size:20px;margin:0 0 12px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.metric-card{border:1px solid var(--rule);border-radius:8px;padding:13px;background:#fbfaf7}.metric-card span{font-size:12px;color:var(--muted);font-weight:800}.metric-card strong{display:block;font-size:22px;line-height:1.2;margin:4px 0}.metric-card small{color:var(--muted)}
.related-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.related-card{display:block;text-decoration:none;border:1px solid var(--rule);border-radius:8px;padding:13px;background:#fbfaf7}.related-card strong{display:block}.related-card span{display:block;color:var(--muted);font-size:13px;margin-top:4px}.topic-row{display:flex;flex-wrap:wrap;gap:8px}.topic-row a{border:1px solid var(--rule);border-radius:999px;padding:7px 11px;text-decoration:none;background:#fbfaf7;color:var(--accent-dark);font-weight:700;font-size:13px}
.faq details{border-top:1px solid var(--rule);padding:12px 0}.faq details:first-of-type{border-top:0}.faq summary{cursor:pointer;font-weight:800}.faq p{color:var(--muted);margin:8px 0 0}.site-footer{max-width:1120px;margin:0 auto;padding:24px 20px 40px;color:var(--muted);font-size:13px}.site-footer a{color:var(--accent);text-decoration:none}
@media (max-width:760px){.header-inner{align-items:flex-start;flex-direction:column;gap:10px}.nav{margin-left:0;flex-wrap:wrap}.hero{grid-template-columns:1fr;padding:20px}.hero h1{font-size:27px}.wrap{padding:16px 12px 32px}}
</style>
</head>
<body>
<header class="site-header"><div class="header-inner"><a class="brand" href="${origin}/">AILatest Journal</a><nav class="nav"><a href="${origin}/">Journal</a><a href="https://grant.ailatest.org/">Grant</a><a href="${origin}/pick">AI Recommend</a><a class="search-link" href="${origin}/">Search journals</a></nav></div></header>
<main class="wrap">
  <nav class="breadcrumb"><a href="${origin}/">Home</a> / <a href="${origin}/">AI Journals</a> / ${esc(name)}</nav>
  <section class="hero">
    <div>
      <div class="kicker">Journal Details</div>
      <h1>${esc(name)}</h1>
      <p class="sub">${esc([j.a ? `Abbreviation: ${j.a}` : '', j.p ? `Publisher: ${j.p}` : '', issnLine].filter(Boolean).join(' · '))}</p>
      ${badgeHtml(j)}
      <div class="cta-row">${officialCta}<a class="btn secondary" href="${esc(appUrl)}">Open in AILatest</a></div>
    </div>
    <aside class="fact-panel">
      <div class="fact"><span>Impact Factor</span><strong>${esc(fmt(j.f))}</strong></div>
      <div class="fact"><span>JCR Quartile</span><strong>${esc(j.q ? String(j.q).toUpperCase() : '-')}</strong></div>
      <div class="fact"><span>CAS Zone</span><strong>${esc(j.z != null ? `${j.z}${j.zt ? ' Top' : ''}` : '-')}</strong></div>
      <div class="fact"><span>Open Access</span><strong>${esc(oaText(j) || '-')}</strong></div>
      <div class="fact"><span>APC</span><strong>${esc(fmtMoney(j.apc) || '-')}</strong></div>
    </aside>
  </section>
  ${summaryHtml(j)}
  <section class="section"><h2>Journal Metrics</h2><div class="metrics">${metricCards(j)}</div></section>
  ${relatedHtml(j, index, origin)}
  ${topicsHtml(j, origin)}
  ${buildFAQHtml(j)}
</main>
<footer class="site-footer">AILatest Journal helps researchers evaluate journals, grants, rankings, indexing coverage, open access information, and submission choices. <a href="${origin}/">Search more journals</a>.</footer>
</body>
</html>`;
}

function pill(text, cls = 'zone') {
  return text ? `<span class="${cls}">${esc(text)}</span>` : '';
}

function appCoverageBadges(j) {
  return [
    ...(j.ix || []).map((x) => pill(x, `badge b-${String(x).toLowerCase()}`)),
    j.sc ? pill('Scopus', 'badge b-scopus') : '',
    j.med ? pill('MEDLINE', 'badge b-medline') : '',
    j.pm ? pill('PubMed', 'badge b-pubmed') : '',
    j.pmc ? pill('PMC', 'badge b-pmc') : '',
  ].filter(Boolean).join('');
}

function appLevelBadges(j) {
  return [
    j.q ? pill(`JCR ${String(j.q).toUpperCase()}`, `zone jcr-${String(j.q).toLowerCase()}`) : '',
    j.z != null ? pill(`中科院 ${j.z}区${j.zt ? '·TOP' : ''}`, `zone zone-${j.z}`) : '',
    j.tier ? pill(j.tier, 'zone') : '',
  ].filter(Boolean).join('');
}

function appAccessBadges(j) {
  return [
    oaText(j) ? pill(oaText(j), 'free-pill') : '',
    j.doaj ? pill('DOAJ', 'badge b-doaj') : '',
  ].filter(Boolean).join('');
}

function appRiskBadges(j) {
  return j.rt && j.rt.total
    ? pill(`RW ${j.rt.total}`, 'warn-pill retraction-pill')
    : '';
}

function appStatsHtml(j) {
  const rows = [];
  if (j.f != null) rows.push(['IF', j.f, 'Impact Factor']);
  if (j.q) rows.push(['JCR', String(j.q).toUpperCase(), 'Quartile']);
  if (j.z != null) rows.push(['CAS', `${j.z}${j.zt ? ' TOP' : ''}`, 'CAS Zone']);
  if (j.ann && j.ann.length) rows.push(['Annual Output', j.ann[0].c, `${j.ann[0].y} works`]);
  if (j.apc) rows.push(['APC', fmtMoney(j.apc), 'Estimate']);
  if (j.sc) rows.push(['Scopus', 'Indexed', 'Active']);
  if (!rows.length) return '';
  return `<div class="stats-grid stats-count-${Math.min(rows.length, 4)}">${rows.map(([k, v, note]) => `
    <div class="stat"><span>${esc(k)}</span><b class="stat-v">${esc(v)}</b><small>${esc(note)}</small></div>
  `).join('')}</div>`;
}

function appRelatedHtml(j, index, origin) {
  const rel = (j.rel || []).map((s) => [s, index[s]]).filter(([, item]) => item && !item._r).slice(0, 8);
  if (!rel.length) return '';
  return `<div class="drawer-section related-section">
    <h4>Similar Journals</h4>
    <div class="related-grid">${rel.map(([s, item]) => {
      const meta = [item.f != null ? `IF ${item.f}` : '', item.q ? String(item.q).toUpperCase() : '', item.z != null ? `CAS ${item.z}` : '', (item.ix || [])[0] || ''].filter(Boolean).join(' · ');
      return `<a class="related-card" href="${origin}/journal/${encodeURIComponent(s)}/"><strong>${esc(journalName(item))}</strong><span>${esc(meta || item.p || 'Journal details')}</span></a>`;
    }).join('')}</div>
  </div>`;
}

function appDrawerBodyHtml(j, slug, index, origin) {
  const name = journalName(j);
  const fid = j.i || j.is || slug;
  const issnLine = [j.i ? `ISSN ${j.i}` : '', j.is ? `eISSN ${j.is}` : ''].filter(Boolean).join(' · ');
  const coverage = appCoverageBadges(j);
  const levels = appLevelBadges(j);
  const access = appAccessBadges(j);
  const risk = appRiskBadges(j);
  const official = j.hp
    ? `<a class="big-btn primary" href="${esc(j.hp)}" target="_blank" rel="noopener nofollow">Journal Website / Submit</a>`
    : '';
  const summary = summaryHtml(j)
    .replace('<section class="section summary">', '<div class="journal-overview"><div class="journal-overview-copy">')
    .replace('<h2>AI Journal Overview</h2>', '<h4>Journal Overview</h4>')
    .replace('</section>', '</div></div>');
  const faq = buildFAQHtml(j)
    .replace('<section class="section faq">', '<div class="drawer-section faq">')
    .replace('<h2>Frequently Asked Questions</h2>', '<h4>Frequently Asked Questions</h4>')
    .replace('</section>', '</div>');
  return `
    <div class="drawer-hero">
      <div class="drawer-titlebar">
        <div class="drawer-title-main">
          <div class="drawer-title-line"><h1 class="drawer-title">${esc(name)}</h1></div>
          ${j.c && j.c !== name ? `<div class="drawer-sub">${esc(j.c)}</div>` : ''}
        </div>
        <div class="drawer-actions">
          ${official}
          <button class="big-btn ghost" id="drawer-fav-big">☆ Add to favorites</button>
        </div>
      </div>
      <div class="drawer-issn">${esc([j.p ? `Publisher: ${j.p}` : '', issnLine].filter(Boolean).join(' · '))}<span class="drawer-views" id="drawer-views" data-fid="${esc(fid)}"></span></div>
      ${summary}
      ${(coverage || levels || access || risk) ? `<div class="hero-badge-grid">
        ${coverage ? `<div class="drawer-section badges-section"><h4>Indexed</h4><div class="badges">${coverage}</div></div>` : ''}
        ${levels ? `<div class="drawer-section badges-section"><h4>Ranking</h4><div class="badges">${levels}</div></div>` : ''}
        ${access ? `<div class="drawer-section badges-section"><h4>Access & Fees</h4><div class="badges">${access}</div></div>` : ''}
        ${risk ? `<div class="drawer-section badges-section"><h4>Caution</h4><div class="badges">${risk}</div></div>` : ''}
      </div>` : ''}
    </div>
    ${appStatsHtml(j)}
    <div class="journal-detail-masonry">
      ${topicsHtml(j, origin).replace('<section class="section topics">', '<div class="drawer-section topics">').replace('<h2>Explore More</h2>', '<h4>Explore More</h4>').replace('</section>', '</div>')}
      ${faq}
    </div>
    ${appRelatedHtml(j, index, origin)}
  `;
}

async function journalAppShellHtml(ctx, j, slug, index, origin) {
  const seo = journalSeo(j, slug, origin);
  let html = await loadAppShell(ctx);
  html = html.replace(/<html\s+lang="[^"]*"/i, '<html lang="en"');
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seo.desc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(seo.url)}" />`);
  html = replaceMeta(html, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${esc(seo.url)}" />`);
  html = replaceMeta(html, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(seo.title)}" />`);
  html = replaceMeta(html, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(seo.desc)}" />`);
  html = stripAlternateLinks(html);
  html = html.replace('</head>', `${jsonLdBlocks(j, slug, seo, origin)}\n</head>`);
  html = html.replace(/<body([^>]*)>/i, '<body$1 class="journal-route">');
  html = html.replace('<div id="drawer-scrim" class="drawer-scrim" hidden></div>', '<div id="drawer-scrim" class="drawer-scrim" hidden></div>');
  html = html.replace('<aside id="j-drawer" class="j-drawer" aria-hidden="true">', '<aside id="j-drawer" class="j-drawer open journal-page" aria-hidden="false">');
  html = html.replace('<div id="drawer-body" class="drawer-body"></div>', `<div id="drawer-body" class="drawer-body">${appDrawerBodyHtml(j, slug, index, origin)}</div>`);
  return html;
}

function localizedHomeSeo(path, origin) {
  const isZh = path.replace(/\/+$/, '') === '/zh';
  const isEn = path.replace(/\/+$/, '') === '/en';
  return {
    lang: isZh ? 'zh-CN' : 'en',
    title: isZh ? 'AILatest Journal - Journal Finder for Researchers' : 'AILatest Journal - Journal Finder, Rankings & Impact Factors',
    desc: 'AILatest Journal helps researchers search academic journals, compare impact factors, JCR quartiles, CAS tiers, indexing databases, open access signals, and AI-powered submission matches.',
    url: `${origin}${isZh ? '/zh' : isEn ? '/en' : ''}`,
  };
}

async function localizedHomePage(ctx, path, origin) {
  const seo = localizedHomeSeo(path, origin);
  let html = await loadAppShell(ctx);
  html = html.replace(/<html\s+lang="[^"]*"/i, `<html lang="${esc(seo.lang)}"`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seo.title)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seo.desc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(seo.url)}" />`);
  html = stripAlternateLinks(html);
  html = html.replace('</head>', `<link rel="alternate" href="${origin}/en" hreflang="en" />\n<link rel="alternate" href="${origin}/zh" hreflang="zh-CN" />\n<link rel="alternate" href="${origin}/" hreflang="x-default" />\n</head>`);
  return html;
}

function compareSeo(j1, j2, slug1, slug2, origin) {
  const n1 = journalName(j1);
  const n2 = journalName(j2);
  return {
    title: `${n1} vs ${n2} | Journal Comparison | AILatest Journal`,
    desc: `Compare ${n1} and ${n2} by impact factor, quartile, CAS tier, indexing, open access and publisher information.`,
    url: `${origin}/compare/${encodeURIComponent(slug1)}-vs-${encodeURIComponent(slug2)}/`,
  };
}

function compareCell(label, v1, v2) {
  return `<tr><th>${esc(label)}</th><td>${esc(fmt(v1))}</td><td>${esc(fmt(v2))}</td></tr>`;
}

function comparePageHtml(j1, j2, slug1, slug2, origin) {
  const seo = compareSeo(j1, j2, slug1, slug2, origin);
  const n1 = journalName(j1);
  const n2 = journalName(j2);
  const rows = [
    compareCell('Publisher', j1.p, j2.p),
    compareCell('ISSN', j1.i, j2.i),
    compareCell('Impact Factor', j1.f, j2.f),
    compareCell('JCR Quartile', j1.q ? String(j1.q).toUpperCase() : '', j2.q ? String(j2.q).toUpperCase() : ''),
    compareCell('CAS Zone', j1.z, j2.z),
    compareCell('Indexing', coverageBadges(j1).join(', '), coverageBadges(j2).join(', ')),
    compareCell('Open Access', oaText(j1), oaText(j2)),
  ].join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metaTags(seo)}<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:#f7f5f0;color:#1f1b16;margin:0;padding:24px}.wrap{max-width:900px;margin:0 auto;background:#fff;border:1px solid #e4ddd0;border-radius:10px;padding:24px}a{color:#9a4f1f}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #eee;padding:10px;text-align:left}thead th{background:#faf8f3}</style></head><body><main class="wrap"><p><a href="${origin}/">AILatest Journal</a></p><h1>${esc(n1)} vs ${esc(n2)}</h1><p>${esc(seo.desc)}</p><table><thead><tr><th>Metric</th><th><a href="${origin}/journal/${encodeURIComponent(slug1)}/">${esc(n1)}</a></th><th><a href="${origin}/journal/${encodeURIComponent(slug2)}/">${esc(n2)}</a></th></tr></thead><tbody>${rows}</tbody></table></main></body></html>`;
}

function notFound(message = 'Journal not found.') {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>404 - Not Found | AILatest Journal</title><meta name="robots" content="noindex,follow"><style>body{font-family:sans-serif;padding:40px;text-align:center}a{color:#9a4f1f}</style></head><body><h1>404</h1><p>${esc(message)}</p><p><a href="https://journal.ailatest.org/">Back to AILatest Journal</a></p></body></html>`;
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

export async function onRequest(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (path === '/' || path === '/en' || path === '/en/' || path === '/zh' || path === '/zh/') {
      const html = await localizedHomePage(ctx, path, url.origin);
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    if (path.startsWith('/journal/')) {
      const rawSlug = path.replace('/journal/', '').replace(/\/$/, '');
      if (!rawSlug) return Response.redirect(`${url.origin}/`, 302);
      const index = await loadIndex(ctx);
      const slug = journalSlugCandidates(rawSlug).find((candidate) => index[candidate]);
      const entry = slug ? index[slug] : null;
      if (!entry) return notFound();
      if (entry._r) return Response.redirect(`${url.origin}/journal/${entry._r}/`, 301);
      const html = await journalAppShellHtml(ctx, entry, slug, index, url.origin);
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    if (path.startsWith('/compare/')) {
      const raw = path.replace('/compare/', '').replace(/\/$/, '');
      const vsIdx = raw.lastIndexOf('-vs-');
      if (vsIdx < 1) return notFound('Invalid compare URL.');
      const index = await loadIndex(ctx);
      let slug1 = journalSlugCandidates(raw.slice(0, vsIdx)).find((candidate) => index[candidate]);
      let slug2 = journalSlugCandidates(raw.slice(vsIdx + 4)).find((candidate) => index[candidate]);
      if (!slug1 || !slug2) return notFound('One or both journals were not found.');
      if (index[slug1]._r) slug1 = index[slug1]._r;
      if (index[slug2]._r) slug2 = index[slug2]._r;
      const html = comparePageHtml(index[slug1], index[slug2], slug1, slug2, url.origin);
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    return ctx.env.ASSETS.fetch(request);
  } catch (error) {
    try {
      return await ctx.env.ASSETS.fetch(request);
    } catch (_) {
      return new Response(`Error: ${error.message}`, { status: 500, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    }
  }
}
