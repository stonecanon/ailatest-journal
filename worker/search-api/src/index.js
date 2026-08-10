/**
 * AILatest Journal Search API — Cloudflare Worker
 *
 * 为微信小程序提供的搜索API，数据源来自 journal.ailatest.org 的静态构建产物。
 *
 * Endpoints:
 *   GET /search?q=&page=1&limit=20&indices=&zone=&topic=
 *   GET /journal/:id
 *   GET /journals/batch?ids=issn1,issn2
 *   GET /filters
 *
 * 部署：
 *   1. cd worker/search-api
 *   2. npx wrangler deploy
 *   3. 绑定自定义域名 search.ailatest.org
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

// ───────── data cache (global, survives warm starts) ─────────
let journalsCache = null;   // array of journal objects
let loadingPromise = null;   // shared loading promise (dedup concurrent cold starts)

async function loadJournals(env) {
  if (journalsCache) return journalsCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const url = env.JOURNALS_URL || 'https://journal.ailatest.org/data/journals.json.gz';
    console.log(`[search-api] Loading journals from ${url}...`);

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch journals: ${resp.status}`);

    // Decompress gzip
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
    console.log(`[search-api] Loaded ${journalsCache.length} journals`);
    return journalsCache;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

// ───────── helpers ─────────
function normalize(s) {
  return String(s || '').toLowerCase().trim();
}

function matchText(journal, q) {
  const ql = normalize(q);
  if (!ql) return false;
  const fields = ['name', 'abbr20', 'issn', 'eissn', 'cn_name'];
  for (const f of fields) {
    const v = normalize(journal[f]);
    if (v.includes(ql)) return true;
  }
  // Also search aliases
  const alias = journal.alias || [];
  if (Array.isArray(alias)) {
    for (const a of alias) {
      if (normalize(a).includes(ql)) return true;
    }
  }
  return false;
}

function matchFilters(journal, filters) {
  if (filters.indices) {
    const idxs = filters.indices.split(',').map(s => s.trim().toUpperCase());
    const jIdxs = (journal.indices || []).map(s => s.toUpperCase());
    if (!idxs.some(i => jIdxs.includes(i))) {
      // Also check ESI
      if (!(idxs.includes('ESI') && journal.esi_category)) return false;
    }
  }
  if (filters.zone) {
    const zones = filters.zone.split(',').map(s => s.trim());
    const jZone = String(journal.cas_zone || '');
    if (!zones.includes(jZone)) return false;
  }
  if (filters.topic) {
    const topics = filters.topic.split(',').map(s => normalize(s));
    const jTopics = (journal.wos_categories || []).map(s => normalize(s));
    if (!topics.some(t => jTopics.includes(t))) return false;
  }
  if (filters.under_review === '1' && !journal.under_review) return false;
  if (filters.on_hold === '1' && !journal.on_hold) return false;
  if (filters.warning === '1' && !journal.warning) return false;
  if (filters.citic_warning === '1' && !journal.citic_warning) return false;
  return true;
}

function score(journal, q) {
  if (!q) return 0;
  const ql = normalize(q);
  let s = 0;
  // Exact match on name scores highest
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

// ───────── response helpers ─────────
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
    review_cycle: j.review_cycle_months,
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
    flagship: j.flagship,
    cnkx: j.cnkx,
    language_cn: j.language_cn,
  };
}

// ───────── route handlers ─────────
async function handleSearch(request, env) {
  const url = new URL(request.url);
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

  const journals = await loadJournals(env);

  // Filter + score
  let results = journals.filter(j => {
    if (q && !matchText(j, q)) return false;
    if (!matchFilters(j, filters)) return false;
    return true;
  });

  // Sort: if query exists, by relevance; else by IF descending
  if (q) {
    results.sort((a, b) => score(b, q) - score(a, q));
  } else {
    results.sort((a, b) => (b.if_2024 || 0) - (a.if_2024 || 0));
  }

  const total = results.length;
  const offset = (page - 1) * limit;
  const items = results.slice(offset, offset + limit).map(publicFields);

  return json({
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    items,
  });
}

async function handleJournal(request, env, id) {
  const journals = await loadJournals(env);
  const idl = id.toLowerCase();
  const found = journals.find(j =>
    (j.issn || '').toLowerCase() === idl ||
    (j.eissn || '').toLowerCase() === idl
  );
  if (!found) return err('Journal not found', 404);
  return json(publicFields(found));
}

async function handleBatch(request, env) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get('ids') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const journals = await loadJournals(env);
  const idSet = new Set(ids);
  const found = journals.filter(j =>
    idSet.has((j.issn || '').toLowerCase()) ||
    idSet.has((j.eissn || '').toLowerCase())
  );
  return json(found.map(publicFields));
}

async function handleFilters(env) {
  const journals = await loadJournals(env);

  // Indices
  const indices = new Set();
  for (const j of journals) {
    for (const i of (j.indices || [])) indices.add(i);
  }
  if (journals.some(j => j.esi_category)) indices.add('ESI');

  // CAS zones
  const zones = new Set();
  for (const j of journals) {
    const z = j.cas_zone;
    if (z) zones.add(String(z));
  }

  // WoS topics
  const topics = {};
  for (const j of journals) {
    for (const c of (j.wos_categories || [])) {
      topics[c] = (topics[c] || 0) + 1;
    }
  }
  const topicList = Object.entries(topics)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const stats = {
    total: journals.length,
    under_review: journals.filter(j => j.under_review).length,
    on_hold: journals.filter(j => j.on_hold).length,
    warning: journals.filter(j => j.warning).length,
    citic_warning: journals.filter(j => j.citic_warning).length,
  };

  return json({
    indices: [...indices].sort(),
    zones: [...zones].sort(),
    topics: topicList,
    stats,
  });
}

// ───────── main entry ─────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...CORS } });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/search' || path === '/api/search') {
        return await handleSearch(request, env);
      }
      if (path === '/filters' || path === '/api/filters') {
        return await handleFilters(env);
      }
      if (path === '/journals/batch' || path === '/api/journals/batch') {
        return await handleBatch(request, env);
      }
      const journalMatch = path.match(/^\/journal\/(.+)$/) || path.match(/^\/api\/journal\/(.+)$/);
      if (journalMatch) {
        return await handleJournal(request, env, journalMatch[1]);
      }

      // Root/health
      if (path === '/' || path === '/api') {
        return json({
          service: 'AILatest Journal Search API',
          version: '1.0',
          endpoints: {
            search: 'GET /search?q=&page=1&limit=20&indices=&zone=&topic=',
            journal: 'GET /journal/:issn',
            batch: 'GET /journals/batch?ids=issn1,issn2',
            filters: 'GET /filters',
          },
        });
      }

      return err('Not found', 404);
    } catch (e) {
      console.error('[search-api] Error:', e);
      return err(e.message, 500);
    }
  },
};
