// Cloudflare Pages Function — root catch-all
// - /journal/<name-slug>/  → generates SEO detail pages with FAQ + JSON-LD
// - /journal/<issn>/       → 301 redirects to name-slug URL
// - /rankings/<subject>     → static ranking pages (served by ASSETS)
// - /indexes/<name>         → static index listing pages (served by ASSETS)
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
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch (_) { break; }
  }
  return out;
}

function normalizeJournalSlug(s, stripAccents = true) {
  let out = decodeRoutePart(s).toLowerCase();
  if (stripAccents) out = out.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return out
    .replace(/^\/?journal\//, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function journalSlugCandidates(rawSlug) {
  const raw = decodeRoutePart(rawSlug).replace(/^\/?journal\//, '').replace(/\/+$/, '');
  const compactIssn = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return Array.from(new Set([
    raw, raw.toLowerCase(), normalizeJournalSlug(raw, false),
    normalizeJournalSlug(raw), raw.replace(/-/g, ''),
    compactIssn.length >= 7 ? compactIssn : '',
  ].filter(Boolean)));
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
  if (selector.test(html)) return html.replace(selector, replacement);
  return html.replace('</head>', `${replacement}\n</head>`);
}

// ───────── FAQ generation ─────────
function buildFAQ(j) {
  const name = j.n || 'Journal';
  const qa = [];

  // Q1: Impact Factor
  if (j.f != null) {
    qa.push({ q: `What is the Impact Factor of ${escJson(name)}?`, a: `The Impact Factor of ${escJson(name)} is ${j.f}.` });
  } else {
    qa.push({ q: `What is the Impact Factor of ${escJson(name)}?`, a: `Not available in the current database.` });
  }

  // Q2: JCR Quartile
  if (j.q) {
    qa.push({ q: `What is the JCR Quartile of ${escJson(name)}?`, a: `${escJson(name)} has a JCR quartile of ${j.q.toUpperCase()}.${j.ifr ? ' Rank: ' + j.ifr + '.' : ''}` });
  } else {
    qa.push({ q: `What is the JCR Quartile of ${escJson(name)}?`, a: `Not available in the current database.` });
  }

  // Q3: CAS Ranking
  if (j.z != null) {
    const casStr = j.cm ? ` (${escJson(j.cm)})` : '';
    qa.push({ q: `What is the CAS Ranking of ${escJson(name)}?`, a: `${escJson(name)} is ranked CAS ${j.z}区${casStr}.` });
  } else {
    qa.push({ q: `What is the CAS Ranking of ${escJson(name)}?`, a: `Not available in the current database.` });
  }

  // Q4: Indexing
  const allIdx = j.ia || j.ix || [];
  const idxParts = [];
  const idxChecks = [
    ['SCIE', allIdx.includes('SCIE')], ['SSCI', allIdx.includes('SSCI')],
    ['AHCI', allIdx.includes('AHCI')], ['ESCI', allIdx.includes('ESCI')],
    ['Scopus', j.sf === 1], ['PubMed', j.pb === 1],
    ['MEDLINE', j.md === 1], ['PMC', j.pc === 1],
    ['EI', allIdx.includes('EI')], ['DOAJ', j.dj === 1],
  ];
  for (const [name, active] of idxChecks) {
    if (active) idxParts.push(name);
  }
  if (idxParts.length) {
    qa.push({ q: `Is ${escJson(name)} indexed in SCI, SSCI, AHCI, ESCI, Scopus, PubMed, MEDLINE or PMC?`,
      a: `Yes, ${escJson(name)} is indexed in: ${idxParts.join(', ')}.` });
  } else {
    qa.push({ q: `Is ${escJson(name)} indexed in SCI, SSCI, AHCI, ESCI, Scopus, PubMed, MEDLINE or PMC?`,
      a: `Not available in the current database.` });
  }

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
    + `<div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><div itemprop="text">${esc(item.a)}</div></div>`
    + `</div>`
  ).join('\n');
  return `<section class="journal-faq"><h2>Frequently Asked Questions</h2>${items}</section>`;
}

function buildFAQJsonLd(j) {
  const qa = buildFAQ(j);
  const mainEntity = qa.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  }));
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  };
}

function buildWebPageJsonLd(j, seo) {
  const name = j.n || 'Journal';
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seo.title,
    description: seo.desc,
    url: seo.url,
    isPartOf: { '@type': 'WebSite', name: 'AILatest Journal', url: 'https://journal.ailatest.org/' },
    about: { '@type': 'Thing', name: name, additionalType: 'https://schema.org/Periodical' },
  };
}

function buildBreadcrumbJsonLd(j, seo) {
  const name = j.n || 'Journal';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://journal.ailatest.org/' },
      { '@type': 'ListItem', position: 2, name: 'Journals', item: 'https://journal.ailatest.org/' },
      { '@type': 'ListItem', position: 3, name: name, item: seo.url },
    ],
  };
}

function buildPeriodicalJsonLd(j) {
  const name = j.n || 'Journal';
  const issn = j.i || '';
  const eissn = j.is || '';
  const pd = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name,
    issn: issn.replace(/(\d{4})(\d{3}[\dX])/, '$1-$2'),
  };
  if (eissn) pd.eissn = eissn.replace(/(\d{4})(\d{3}[\dX])/, '$1-$2');
  const allIdx = j.ia || j.ix || [];
  if (allIdx.length) {
    pd.description = `Indexed in ${allIdx.join(', ')}.`;
  }
  if (j.p) pd.publisher = { '@type': 'Organization', name: j.p };
  if (j.f != null) pd.impactFactor = j.f;
  return pd;
}

// ───────── Related journals ─────────
function buildRelatedJournals(j, slug, index, origin) {
  const name = j.n || '';
  const publisher = j.p || '';
  const allIdx = j.ia || j.ix || [];
  const cats = j.wc || [];
  const related = [];
  const scored = {};

  // Score candidates by shared publisher, indices, categories
  for (const [key, entry] of Object.entries(index)) {
    if (key === slug || entry._r) continue;
    if (!entry.n) continue;
    let score = 0;
    // Same publisher
    if (publisher && entry.p && entry.p.toLowerCase() === publisher.toLowerCase()) score += 3;
    // Shared index (WoS core)
    if (allIdx.length && (entry.ia || entry.ix)) {
      const eIdx = entry.ia || entry.ix;
      for (const ix of allIdx) {
        if (eIdx.includes(ix)) { score += 1; break; }
      }
    }
    // Same WoS category
    if (cats.length && entry.wc) {
      for (const c of cats) {
        if (entry.wc.includes(c)) { score += 2; break; }
      }
    }
    if (score > 0) {
      scored[key] = { entry, score, key };
    }
  }

  const sorted = Object.values(scored).sort((a, b) => b.score - a.score).slice(0, 10);
  if (!sorted.length) return '';

  const links = sorted.map(s => {
    const en = s.entry;
    const enName = en.n || '';
    const enSlug = en.sl || s.key;
    const enIf = en.f != null ? ` (IF ${en.f})` : '';
    return `<li><a href="${origin}/journal/${esc(enSlug)}/">${esc(enName)}${enIf}</a></li>`;
  }).join('\n');

  return `<section class="related-journals"><h2>Related Journals</h2><ul>${links}</ul></section>`;
}

function buildRelatedJournalsJsonLd(j, slug, index, origin) {
  const name = j.n || '';
  const publisher = j.p || '';
  const allIdx = j.ia || j.ix || [];
  const cats = j.wc || [];
  const related = [];
  const scored = {};

  for (const [key, entry] of Object.entries(index)) {
    if (key === slug || entry._r) continue;
    if (!entry.n) continue;
    let score = 0;
    if (publisher && entry.p && entry.p.toLowerCase() === publisher.toLowerCase()) score += 3;
    if (allIdx.length && (entry.ia || entry.ix)) {
      const eIdx = entry.ia || entry.ix;
      for (const ix of allIdx) { if (eIdx.includes(ix)) { score += 1; break; } }
    }
    if (cats.length && entry.wc) {
      for (const c of cats) { if (entry.wc.includes(c)) { score += 2; break; } }
    }
    if (score > 0) related.push({ entry, score, key });
  }

  const top = related.sort((a, b) => b.score - a.score).slice(0, 10);
  if (!top.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Related Journals to ${name}`,
    itemListElement: top.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Periodical',
        name: s.entry.n,
        url: `${origin}/journal/${esc(s.entry.sl || s.key)}/`,
      },
    })),
  };
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
  const jsonldBlocks = [
    buildWebPageJsonLd(j, seo),
    buildBreadcrumbJsonLd(j, seo),
    buildFAQJsonLd(j),
    buildPeriodicalJsonLd(j),
  ];

  // Related journals JSON-LD
  const index = await loadIndex(ctx);
  const relatedLd = buildRelatedJournalsJsonLd(j, slug, index, origin);
  if (relatedLd) jsonldBlocks.push(relatedLd);

  const jsonldHtml = jsonldBlocks.map(b => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`).join('\n');
  html = html.replace('</head>', jsonldHtml + '\n</head>');

  // FAQ section: insert before the SPA root or before </body>
  const faqHtml = buildFAQHtml(j);
  const relatedHtml = buildRelatedJournals(j, slug, index, origin);
  const extraContent = `<div id="seo-content" style="display:none">${faqHtml}${relatedHtml}</div>`;
  html = html.replace('</body>', extraContent + '\n</body>');

  return html;
}

// ───────── Rankings page ─────────
async function rankingsPage(ctx, subject, origin) {
  const SUBJECTS = {
    'energy': { title: 'Energy', desc: 'Explore top Energy journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'architecture': { title: 'Architecture', desc: 'Explore top Architecture journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'environmental-science': { title: 'Environmental Science', desc: 'Explore top Environmental Science journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'medicine': { title: 'Medicine', desc: 'Explore top Medicine journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'computer-science': { title: 'Computer Science', desc: 'Explore top Computer Science journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'engineering': { title: 'Engineering', desc: 'Explore top Engineering journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'materials-science': { title: 'Materials Science', desc: 'Explore top Materials Science journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'social-sciences': { title: 'Social Sciences', desc: 'Explore top Social Sciences journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'management': { title: 'Management', desc: 'Explore top Management journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
    'education': { title: 'Education', desc: 'Explore top Education journals with Impact Factors, JCR Quartiles, CAS Rankings, indexing databases and submission information.' },
  };
  const subj = SUBJECTS[subject];
  if (!subj) return null;

  const index = await loadIndex(ctx);
  const esiMap = {
    'energy': 'ENERGY', 'environmental-science': 'ENVIRONMENT/ECOLOGY',
    'medicine': 'CLINICAL MEDICINE', 'computer-science': 'COMPUTER SCIENCE',
    'engineering': 'ENGINEERING', 'materials-science': 'MATERIALS SCIENCE',
    'social-sciences': 'SOCIAL SCIENCES, GENERAL',
    'management': 'ECONOMICS & BUSINESS', 'education': 'SOCIAL SCIENCES, GENERAL',
    'architecture': 'ENGINEERING',
  };
  const esiCat = esiMap[subject];

  let journals = [];
  for (const [key, entry] of Object.entries(index)) {
    if (entry._r) continue;
    if (!entry.n) continue;
    // Match by ESI category or WoS categories
    if (esiCat && entry.es === esiCat) {
      journals.push(entry);
      continue;
    }
    if (entry.wc && entry.wc.some(w => w.toLowerCase().includes(subject.replace('-',' ')))) {
      journals.push(entry);
    }
  }

  // Sort by IF descending
  journals.sort((a, b) => (b.f ?? -1) - (a.f ?? -1));
  const top100 = journals.slice(0, 100);

  const seoTitle = `Top ${subj.title} Journals by Impact Factor & Quartile | AILatest Journal`;
  const seoDesc = subj.desc;

  let rows = '';
  for (const j of top100) {
    const name = j.n || '';
    const slug = j.sl || '';
    const ifVal = j.f != null ? j.f : '—';
    const q = j.q || '—';
    const z = j.z != null ? `${j.z}区` : '—';
    const idx = (j.ia || j.ix || []).slice(0, 4).join(', ') || '—';
    const pub = j.p || '—';
    rows += `<tr><td><a href="${origin}/journal/${esc(slug)}/">${esc(name)}</a></td><td>${esc(String(ifVal))}</td><td>${esc(q.toUpperCase())}</td><td>${esc(z)}</td><td>${esc(idx)}</td><td>${esc(pub)}</td></tr>\n`;
  }

  let html = await loadAppShell(ctx);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seoTitle)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seoDesc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${origin}/rankings/${subject}/" />`);
  html = replaceMeta(html, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(seoTitle)}" />`);
  html = replaceMeta(html, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(seoDesc)}" />`);
  html = replaceMeta(html, /<meta name="robots"/i.test(html) ? /<meta name="robots"[^>]*>/i : null, '');
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace('</head>', '<meta name="robots" content="index,follow" />\n</head>');
  }

  // JSON-LD
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Top ${subj.title} Journals`,
    description: seoDesc,
    url: `${origin}/rankings/${subject}/`,
    itemListElement: top100.slice(0, 50).map((j, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Periodical', name: j.n, url: `${origin}/journal/${esc(j.sl || '')}/` },
    })),
  };
  html = html.replace('</head>', `<script type="application/ld+json">\n${JSON.stringify(listLd, null, 2)}\n</script>\n</head>`);

  const tableStyle = 'width:100%;border-collapse:collapse;font-size:13px';
  const thStyle = 'text-align:left;padding:8px;border-bottom:2px solid #ddd;font-weight:700;white-space:nowrap';
  const tdStyle = 'padding:8px;border-bottom:1px solid #eee;vertical-align:top';

  const content = `<div style="max-width:1000px;margin:0 auto;padding:20px">
<h1>Top ${esc(subj.title)} Journals</h1>
<p style="color:#666;margin-bottom:20px">${esc(seoDesc)}</p>
<p style="color:#888;font-size:13px;margin-bottom:16px">Showing ${top100.length} journals sorted by Impact Factor (descending).</p>
<table style="${tableStyle}">
<thead><tr>
<th style="${thStyle}">Journal Name</th><th style="${thStyle}">IF</th><th style="${thStyle}">JCR Q</th><th style="${thStyle}">CAS</th><th style="${thStyle}">Indexing</th><th style="${thStyle}">Publisher</th>
</tr></thead>
<tbody>${rows}</tbody></table>
<p style="margin-top:20px;font-size:13px"><a href="${origin}/">← Back to Journal Search</a></p>
</div>`;

  html = html.replace(/<\/body>/i, `${content}\n</body>`);

  return html;
}

// ───────── Indexes page ─────────
async function indexesPage(ctx, indexName, origin) {
  const INDEXES = {
    'sci': { title: 'SCI', desc: 'Browse SCI (Science Citation Index) indexed journals — multidisciplinary science coverage with Impact Factors, Quartiles and publisher information.' },
    'scie': { title: 'SCIE', desc: 'Browse SCIE (Science Citation Index Expanded) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.' },
    'ssci': { title: 'SSCI', desc: 'Browse SSCI (Social Sciences Citation Index) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.' },
    'ahci': { title: 'AHCI', desc: 'Browse AHCI (Arts & Humanities Citation Index) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.' },
    'esci': { title: 'ESCI', desc: 'Browse ESCI (Emerging Sources Citation Index) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.' },
    'scopus': { title: 'Scopus', desc: 'Browse Scopus indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.' },
    'pubmed': { title: 'PubMed', desc: 'Browse PubMed indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.' },
    'medline': { title: 'MEDLINE', desc: 'Browse MEDLINE indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.' },
    'pmc': { title: 'PMC', desc: 'Browse PMC (PubMed Central) indexed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers, ISSN and submission information.' },
    'doaj': { title: 'DOAJ', desc: 'Browse DOAJ (Directory of Open Access Journals) listed journals with Impact Factors, JCR Quartiles, CAS Rankings, publishers and ISSN.' },
  };
  const idx = INDEXES[indexName];
  if (!idx) return null;

  const index = await loadIndex(ctx);
  const journals = [];

  for (const [key, entry] of Object.entries(index)) {
    if (entry._r) continue;
    if (!entry.n) continue;
    const eIdx = entry.ia || entry.ix || [];
    let match = false;
    if (indexName === 'scopus') match = entry.sf === 1;
    else if (indexName === 'pubmed') match = entry.pb === 1;
    else if (indexName === 'medline') match = entry.md === 1;
    else if (indexName === 'pmc') match = entry.pc === 1;
    else if (indexName === 'doaj') match = entry.dj === 1;
    else if (indexName === 'sci') match = eIdx.includes('SCIE') || eIdx.includes('SCI');
    else match = eIdx.includes(indexName.toUpperCase());
    if (match) journals.push(entry);
  }

  journals.sort((a, b) => (b.f ?? -1) - (a.f ?? -1));
  const top200 = journals.slice(0, 200);

  const seoTitle = `${idx.title} Indexed Journals | AILatest Journal`;
  const seoDesc = idx.desc;

  let rows = '';
  for (const j of top200) {
    const name = j.n || '';
    const slug = j.sl || '';
    const ifVal = j.f != null ? j.f : '—';
    const q = j.q || '—';
    const z = j.z != null ? `${j.z}区` : '—';
    const issn = j.i || '';
    const pub = j.p || '—';
    rows += `<tr><td><a href="${origin}/journal/${esc(slug)}/">${esc(name)}</a></td><td>${esc(String(ifVal))}</td><td>${esc(q.toUpperCase())}</td><td>${esc(z)}</td><td>${esc(issn)}</td><td>${esc(pub)}</td></tr>\n`;
  }

  let html = await loadAppShell(ctx);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seoTitle)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seoDesc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${origin}/indexes/${indexName}/" />`);
  html = replaceMeta(html, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(seoTitle)}" />`);
  html = replaceMeta(html, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(seoDesc)}" />`);
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace('</head>', '<meta name="robots" content="index,follow" />\n</head>');
  }

  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${idx.title} Indexed Journals`,
    description: seoDesc,
    url: `${origin}/indexes/${indexName}/`,
    itemListElement: top200.slice(0, 50).map((j, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Periodical', name: j.n, url: `${origin}/journal/${esc(j.sl || '')}/` },
    })),
  };
  html = html.replace('</head>', `<script type="application/ld+json">\n${JSON.stringify(listLd, null, 2)}\n</script>\n</head>`);

  const tableStyle = 'width:100%;border-collapse:collapse;font-size:13px';
  const thStyle = 'text-align:left;padding:8px;border-bottom:2px solid #ddd;font-weight:700;white-space:nowrap';
  const tdStyle = 'padding:8px;border-bottom:1px solid #eee;vertical-align:top';

  const content = `<div style="max-width:1000px;margin:0 auto;padding:20px">
<h1>${esc(idx.title)} Indexed Journals</h1>
<p style="color:#666;margin-bottom:20px">${esc(seoDesc)}</p>
<p style="color:#888;font-size:13px;margin-bottom:16px">Showing ${top200.length} ${esc(idx.title)} indexed journals sorted by Impact Factor (descending).</p>
<table style="${tableStyle}">
<thead><tr>
<th style="${thStyle}">Journal Name</th><th style="${thStyle}">IF</th><th style="${thStyle}">JCR Q</th><th style="${thStyle}">CAS</th><th style="${thStyle}">ISSN</th><th style="${thStyle}">Publisher</th>
</tr></thead>
<tbody>${rows}</tbody></table>
<p style="margin-top:20px;font-size:13px"><a href="${origin}/">← Back to Journal Search</a></p>
</div>`;

  html = html.replace(/<\/body>/i, `${content}\n</body>`);

  return html;
}

// ───────── Sitemap ─────────
async function buildSitemap(ctx, origin) {
  const index = await loadIndex(ctx);
  const urls = [];
  urls.push({ loc: `${origin}/`, priority: '1.0' });

  // All /journal/<slug> pages
  for (const [key, entry] of Object.entries(index)) {
    if (entry._r) continue;
    const slug = entry.sl || key;
    urls.push({ loc: `${origin}/journal/${slug}/`, priority: '0.8' });
  }

  // /rankings pages
  const RANKINGS = ['energy','architecture','environmental-science','medicine','computer-science','engineering','materials-science','social-sciences','management','education'];
  urls.push({ loc: `${origin}/rankings/`, priority: '0.7' });
  for (const s of RANKINGS) {
    urls.push({ loc: `${origin}/rankings/${s}/`, priority: '0.7' });
  }

  // /indexes pages
  const INDEXES = ['sci','scie','ssci','ahci','esci','scopus','pubmed','medline','pmc','doaj'];
  urls.push({ loc: `${origin}/indexes/`, priority: '0.7' });
  for (const s of INDEXES) {
    urls.push({ loc: `${origin}/indexes/${s}/`, priority: '0.7' });
  }

  const xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
  xml.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const u of urls) {
    xml.push(`  <url><loc>${esc(u.loc)}</loc><priority>${u.priority}</priority></url>`);
  }
  xml.push('</urlset>');

  return new Response(xml.join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'application/xml;charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// ───────── Rankings and Indexes landing pages ─────────
async function rankingsLanding(ctx, origin) {
  const RANKINGS = [
    { slug: 'energy', title: 'Energy', desc: 'Energy journals covering renewable energy, fossil fuels, energy policy and energy storage.' },
    { slug: 'architecture', title: 'Architecture', desc: 'Architecture journals covering urban design, building science, landscape architecture and planning.' },
    { slug: 'environmental-science', title: 'Environmental Science', desc: 'Environmental science journals covering ecology, climate change, pollution and sustainability.' },
    { slug: 'medicine', title: 'Medicine', desc: 'Medical journals covering clinical medicine, surgery, pharmacology, public health and biomedical research.' },
    { slug: 'computer-science', title: 'Computer Science', desc: 'Computer science journals covering AI, data science, software engineering, networks and theoretical CS.' },
    { slug: 'engineering', title: 'Engineering', desc: 'Engineering journals covering civil, mechanical, electrical, chemical and aerospace engineering.' },
    { slug: 'materials-science', title: 'Materials Science', desc: 'Materials science journals covering nanomaterials, polymers, ceramics, metals and composites.' },
    { slug: 'social-sciences', title: 'Social Sciences', desc: 'Social sciences journals covering sociology, psychology, political science, geography and anthropology.' },
    { slug: 'management', title: 'Management', desc: 'Management journals covering business administration, organizational behavior, strategy and operations.' },
    { slug: 'education', title: 'Education', desc: 'Education journals covering pedagogy, curriculum development, educational technology and policy.' },
  ];

  const seoTitle = 'Journal Rankings by Subject | AILatest Journal';
  const seoDesc = 'Browse top journals by subject area: Energy, Architecture, Environmental Science, Medicine, Computer Science, Engineering, Materials Science, Social Sciences, Management, Education.';

  let html = await loadAppShell(ctx);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seoTitle)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seoDesc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${origin}/rankings/" />`);
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace('</head>', '<meta name="robots" content="index,follow" />\n</head>');
  }

  const listItems = RANKINGS.map(s =>
    `<li><a href="${origin}/rankings/${s.slug}/"><strong>${esc(s.title)}</strong></a> — ${esc(s.desc)}</li>`
  ).join('\n');

  const content = `<div style="max-width:800px;margin:0 auto;padding:20px">
<h1>Journal Rankings by Subject</h1>
<p style="color:#666;margin-bottom:20px">${esc(seoDesc)}</p>
<ul style="line-height:2">${listItems}</ul>
<p style="margin-top:20px;font-size:13px"><a href="${origin}/">← Back to Journal Search</a></p>
</div>`;

  html = html.replace(/<\/body>/i, `${content}\n</body>`);
  return html;
}

async function indexesLanding(ctx, origin) {
  const INDEX_LIST = [
    { slug: 'sci', title: 'SCI (Science Citation Index)', desc: 'Science Citation Index indexed journals.' },
    { slug: 'scie', title: 'SCIE (Science Citation Index Expanded)', desc: 'SCIE indexed journals with the broadest science coverage.' },
    { slug: 'ssci', title: 'SSCI (Social Sciences Citation Index)', desc: 'Social Sciences Citation Index indexed journals.' },
    { slug: 'ahci', title: 'AHCI (Arts & Humanities Citation Index)', desc: 'Arts & Humanities Citation Index indexed journals.' },
    { slug: 'esci', title: 'ESCI (Emerging Sources Citation Index)', desc: 'Emerging Sources Citation Index indexed journals.' },
    { slug: 'scopus', title: 'Scopus', desc: 'Scopus indexed journals from Elsevier.' },
    { slug: 'pubmed', title: 'PubMed', desc: 'PubMed indexed journals from the National Library of Medicine.' },
    { slug: 'medline', title: 'MEDLINE', desc: 'MEDLINE indexed journals from the National Library of Medicine.' },
    { slug: 'pmc', title: 'PMC (PubMed Central)', desc: 'PubMed Central indexed journals with full-text access.' },
    { slug: 'doaj', title: 'DOAJ (Directory of Open Access Journals)', desc: 'Open access journals listed in DOAJ.' },
  ];

  const seoTitle = 'Browse Journals by Indexing Database | AILatest Journal';
  const seoDesc = 'Browse academic journals indexed in SCI, SCIE, SSCI, AHCI, ESCI, Scopus, PubMed, MEDLINE, PMC and DOAJ.';

  let html = await loadAppShell(ctx);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(seoTitle)}</title>`);
  html = replaceMeta(html, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seoDesc)}" />`);
  html = replaceMeta(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${origin}/indexes/" />`);
  if (!/<meta name="robots"/i.test(html)) {
    html = html.replace('</head>', '<meta name="robots" content="index,follow" />\n</head>');
  }

  const listItems = INDEX_LIST.map(s =>
    `<li><a href="${origin}/indexes/${s.slug}/"><strong>${esc(s.title)}</strong></a> — ${esc(s.desc)}</li>`
  ).join('\n');

  const content = `<div style="max-width:800px;margin:0 auto;padding:20px">
<h1>Browse Journals by Indexing Database</h1>
<p style="color:#666;margin-bottom:20px">${esc(seoDesc)}</p>
<ul style="line-height:2">${listItems}</ul>
<p style="margin-top:20px;font-size:13px"><a href="${origin}/">← Back to Journal Search</a></p>
</div>`;

  html = html.replace(/<\/body>/i, `${content}\n</body>`);
  return html;
}

// ───────── 404 page ─────────
function notFound() {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>404 - Journal Not Found | AILatest Journal</title>
<meta name="robots" content="noindex,follow" />
<style>body{font-family:sans-serif;padding:40px;text-align:center}h1{font-size:48px;color:#ccc;margin:0}p{color:#666}a{color:#2563eb}</style>
</head><body>
<h1>404</h1><p>Journal not found.</p>
<p><a href="https://journal.ailatest.org/">← Back to Journal Search</a></p>
</body></html>`;
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}

// ───────── Main handler ─────────
export async function onRequest(ctx) {
  const { request } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Sitemap
    if (path === '/sitemap.xml') {
      return await buildSitemap(ctx, url.origin);
    }

    // Rankings landing page
    if (path === '/rankings' || path === '/rankings/') {
      return await rankingsLanding(ctx, url.origin);
    }

    // Rankings subject pages
    if (path.startsWith('/rankings/')) {
      const subject = path.replace('/rankings/', '').replace(/\/$/, '');
      if (subject) {
        const html = await rankingsPage(ctx, subject, url.origin);
        if (html) {
          return new Response(html, {
            headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' }
          });
        }
      }
    }

    // Indexes landing page  
    if (path === '/indexes' || path === '/indexes/') {
      return await indexesLanding(ctx, url.origin);
    }

    // Indexes subject pages
    if (path.startsWith('/indexes/')) {
      const indexName = path.replace('/indexes/', '').replace(/\/$/, '');
      if (indexName) {
        const html = await indexesPage(ctx, indexName, url.origin);
        if (html) {
          return new Response(html, {
            headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' }
          });
        }
      }
    }

    // Handle /journal/<slug>/
    if (path.startsWith('/journal/')) {
      const rawSlug = path.replace('/journal/', '').replace(/\/$/, '');
      if (!rawSlug) {
        return Response.redirect(url.origin + '/', 302);
      }

      const index = await loadIndex(ctx);
      const candidates = journalSlugCandidates(rawSlug);
      const slug = candidates.find(s => index[s]);
      let j = slug ? index[slug] : null;

      if (!j) {
        return notFound();
      }

      // ISSN-based entry → 301 redirect to name-slug
      if (j._r) {
        return Response.redirect(url.origin + '/journal/' + j._r + '/', 301);
      }

      const html = await journalPage(ctx, j, slug, url.origin);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=utf-8',
                   'Cache-Control': 'no-store, no-cache, must-revalidate',
                   'CDN-Cache-Control': 'no-store' }
      });
    }

    // All other routes: serve static assets
    return ctx.env.ASSETS.fetch(request);

  } catch (e) {
    try { return await ctx.env.ASSETS.fetch(request); } catch(_) {}
    return new Response(`Error: ${e.message}`, { status: 500,
      headers: { 'Content-Type': 'text/plain' } });
  }
}
