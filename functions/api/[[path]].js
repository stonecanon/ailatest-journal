/**
 * AILatest Journal Search API — Cloudflare Pages Function
 *
 * 为微信小程序提供的搜索API，数据源来自 journal.ailatest.org 的静态构建产物。
 *
 * Endpoints:
 *   GET /api/stats
 *   GET /api/search?q=&page=1&limit=20&indices=&zone=&topic=
 *   GET /api/journal/:issn
 *   GET /api/journals/batch?ids=issn1,issn2
 *   GET /api/filters
 *   GET /api/scholar/profile?url=https://scholar.google.com/citations?user=...
 */

import { fetchScholarProfile } from '../../js/scholar-profile.js';

// ───────── helpers ─────────
const JOURNALS_URL = 'https://journal.ailatest.org/data/journals.json.gz';

let journalsCache = null;
let loadingPromise = null;

async function loadJournals() {
  if (journalsCache) return journalsCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const resp = await fetch(JOURNALS_URL);
    if (!resp.ok) throw new Error(`Failed to fetch journals: ${resp.status}`);
    const blob = await resp.blob();
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks = [];
    let totalLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLen += value.length;
    }
    const buf = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    const text = new TextDecoder().decode(buf);
    journalsCache = JSON.parse(text);
    return journalsCache;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

function normalize(s) {
  return String(s || '').toLowerCase().trim();
}

function matchText(journal, q) {
  const ql = normalize(q);
  if (!ql) return false;
  const fields = ['name', 'abbr20', 'issn', 'eissn', 'cn_name'];
  for (const f of fields) {
    if (normalize(journal[f]).includes(ql)) return true;
  }
  const alias = journal.alias || [];
  if (Array.isArray(alias)) {
    for (const a of alias) {
      if (normalize(a).includes(ql)) return true;
    }
  }
  return false;
}

function matchFilters(journal, f) {
  if (f.indices) {
    const idxs = f.indices.split(',').map(s => s.trim().toUpperCase());
    const jIdxs = (journal.indices || []).map(s => s.toUpperCase());
    if (!idxs.some(i => jIdxs.includes(i) || (i === 'ESI' && journal.esi_category))) return false;
  }
  if (f.zone) {
    const zones = f.zone.split(',').map(s => s.trim());
    if (!zones.includes(String(journal.cas_zone || ''))) return false;
  }
  if (f.topic) {
    const topics = f.topic.split(',').map(s => normalize(s));
    const jTopics = (journal.wos_categories || []).map(s => normalize(s));
    if (!topics.some(t => jTopics.includes(t))) return false;
  }
  if (f.under_review === '1' && !journal.under_review) return false;
  if (f.on_hold === '1' && !journal.on_hold) return false;
  if (f.warning === '1' && !journal.warning) return false;
  if (f.citic_warning === '1' && !journal.citic_warning) return false;
  return true;
}

function score(journal, q) {
  if (!q) return 0;
  const ql = normalize(q);
  let s = 0;
  if (normalize(journal.name) === ql) s += 100;
  else if (normalize(journal.name).startsWith(ql)) s += 50;
  else if (normalize(journal.name).includes(ql)) s += 20;
  if (normalize(journal.issn || '') === ql) s += 80;
  if (normalize(journal.eissn || '') === ql) s += 80;
  if (normalize(journal.abbr20 || '') === ql) s += 60;
  else if (normalize(journal.abbr20 || '').startsWith(ql)) s += 30;
  if (normalize(journal.cn_name || '').includes(ql)) s += 15;
  return s;
}

function publicFields(j) {
  return {
    id: j.issn || j.eissn || '',
    name: j.name,
    cn_name: j.cn_name,
    abbr20: j.abbr20,
    issn: j.issn,
    eissn: j.eissn,
    publisher: j.publisher,
    if_2024: j.if_2024,
    if_2025: j.if_2025,
    if_latest: j.if_latest,
    if_latest_year: j.if_latest_year,
    jif_without_self_cites_2025: j.jif_without_self_cites_2025,
    self_citation_rate_2025: j.self_citation_rate_2025,
    indices: j.indices,
    esi_category: j.esi_category,
    cas_zone: j.cas_zone,
    cas_top: j.cas_top,
    cas_xr: j.cas_xr,
    if_quartile: j.if_quartile,
    wos_categories: j.wos_categories,
    review_cycle_months: j.review_cycle_months,
    ccf: j.ccf,
    abdc: j.abdc,
    abs: j.abs,
    scopus: j.scopus,
    doaj: j.doaj,
    free: j.free,
    oaj: j.oaj,
    warning: j.warning,
    under_review: j.under_review,
    on_hold: j.on_hold,
    citic_warning: j.citic_warning,
  };
}

// ───────── route handlers ─────────
async function handleSearch(url) {
  const q = url.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const filters = {
    indices: url.searchParams.get('indices') || '',
    zone: url.searchParams.get('zone') || '',
    topic: url.searchParams.get('topic') || '',
    under_review: url.searchParams.get('under_review') || '',
    on_hold: url.searchParams.get('on_hold') || '',
    warning: url.searchParams.get('warning') || '',
    citic_warning: url.searchParams.get('citic_warning') || '',
  };

  const journals = await loadJournals();
  let results = journals.filter(j => {
    if (q && !matchText(j, q)) return false;
    if (!matchFilters(j, filters)) return false;
    return true;
  });

  if (q) {
    results.sort((a, b) => score(b, q) - score(a, q));
  } else {
    results.sort((a, b) => (b.if_2024 || 0) - (a.if_2024 || 0));
  }

  const total = results.length;
  const offset = (page - 1) * limit;
  const items = results.slice(offset, offset + limit).map(publicFields);

  return { total, page, limit, total_pages: Math.ceil(total / limit), items };
}

async function handleJournal(id) {
  const journals = await loadJournals();
  const idl = normalize(id);
  const found = journals.find(j =>
    normalize(j.issn) === idl || normalize(j.eissn) === idl
  );
  if (!found) return null;
  return publicFields(found);
}

async function handleBatch(url) {
  const ids = (url.searchParams.get('ids') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const journals = await loadJournals();
  const idSet = new Set(ids);
  return journals
    .filter(j => idSet.has(normalize(j.issn)) || idSet.has(normalize(j.eissn)))
    .map(publicFields);
}

async function handleFilters() {
  const journals = await loadJournals();

  const indices = new Set();
  for (const j of journals) {
    for (const i of (j.indices || [])) indices.add(i);
  }
  if (journals.some(j => j.esi_category)) indices.add('ESI');

  const zones = new Set();
  for (const j of journals) {
    if (j.cas_zone) zones.add(String(j.cas_zone));
  }

  const topics = {};
  for (const j of journals) {
    for (const c of (j.wos_categories || [])) {
      topics[c] = (topics[c] || 0) + 1;
    }
  }
  const topicList = Object.entries(topics)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  return {
    indices: [...indices].sort(),
    zones: [...zones].sort(),
    topics: topicList,
    stats: {
      total: journals.length,
      under_review: journals.filter(j => j.under_review).length,
      on_hold: journals.filter(j => j.on_hold).length,
      warning: journals.filter(j => j.warning).length,
      citic_warning: journals.filter(j => j.citic_warning).length,
    },
  };
}

async function handleStats() {
  const response = await fetch('https://journal.ailatest.org/data/meta.json');
  if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status}`);
  const meta = await response.json();
  return {
    journals: Number(meta.total || 0),
    last_updated: meta.last_updated_source || '',
    indices: meta.indices || {},
    with_if: Number(meta.with_if_2025 || meta.with_if_2024 || 0),
  };
}

async function handleScholarProfile(url) {
  return fetchScholarProfile(url.searchParams.get('url') || '', fetch);
}

// ───────── main entry ─────────
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: h });
  }

  try {
    let result;
    if (path === '/api/search') {
      result = await handleSearch(url);
    } else if (path === '/api/stats') {
      result = await handleStats();
    } else if (path === '/api/filters') {
      result = await handleFilters();
    } else if (path === '/api/scholar/profile') {
      result = await handleScholarProfile(url);
    } else if (path === '/api/journals/batch') {
      result = await handleBatch(url);
    } else if (path.startsWith('/api/journal/')) {
      const id = path.slice('/api/journal/'.length);
      result = await handleJournal(id);
      if (result === null) {
        return new Response(JSON.stringify({ error: 'Journal not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...h } });
      }
    } else {
      return new Response(JSON.stringify({
        service: 'AILatest Journal Search API',
        version: '1.0',
        docs: 'https://github.com/stonecanon/ailatest-journal',
      }), { headers: { 'Content-Type': 'application/json', ...h } });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...h },
    });
  } catch (e) {
    console.error('[search-api] Error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...h } });
  }
}
