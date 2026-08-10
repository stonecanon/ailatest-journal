/**
 * JCAR public journal-risk lookup.
 *
 * The JCAR detail endpoint requires a JCAR account, but its public journal
 * list exposes the same journal-level CAR fields.  We proxy only the public
 * list lookup here, keyed by ISSN (or an exact journal title fallback), and
 * cache the normalized response at the edge for one day.
 */

const JCAR_LIST_URL = 'https://www.jcarindex.com/ifs/public/jcar/getJournalList';
const JCAR_SITE_URL = 'https://www.jcarindex.com/#/view?id=';
const MAX_TEXT = 160;

function clean(value, max = MAX_TEXT) {
  return String(value || '').trim().slice(0, max);
}

function normalizeIssn(value) {
  const compact = clean(value, 32).toUpperCase().replace(/[^0-9X]/g, '');
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

function normalizeName(value) {
  return clean(value, MAX_TEXT).replace(/\s+/g, ' ').trim();
}

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      ...extra,
    },
  });
}

function publicJcarRecord(row, matchedBy, fetchedAt) {
  if (!row || !row.id) return null;
  return {
    id: Number(row.id),
    name: row.fullName || row.name || '',
    issn: row.issn || '',
    matched_by: matchedBy,
    car_index: row.carIndex,
    car_index_last_year: row.carIndexLastYear,
    car_index_before_last_year: row.carIndexBeforeLastYear,
    car_growth_rate: row.carIndexGrowthRate,
    risk_level: row.sciRiskRank || '',
    risk_level_last_year: row.sciRiskRankLastYear || '',
    problem_articles: row.curYearProblemArticleCount,
    article_count: row.curYearArticleCount,
    previous_problem_articles: row.lastYearProblemArticleCount,
    previous_article_count: row.lastYearArticleCount,
    source_url: `${JCAR_SITE_URL}${encodeURIComponent(String(row.id))}`,
    fetched_at: fetchedAt,
  };
}

async function lookupOne(params) {
  const url = new URL(JCAR_LIST_URL);
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('sortKey', 'name');
  url.searchParams.set('sortDirection', 'asc');
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'AILatest Journal JCAR reader' },
  });
  if (!response.ok) throw new Error(`JCAR upstream ${response.status}`);
  const payload = await response.json().catch(() => null);
  const rows = Array.isArray(payload?.data?.records) ? payload.data.records : [];
  return rows[0] || null;
}

async function lookupJcar(url) {
  const issns = [url.searchParams.get('issn'), url.searchParams.get('eissn')]
    .map(normalizeIssn)
    .filter(Boolean);
  const name = normalizeName(url.searchParams.get('name'));
  const fetchedAt = new Date().toISOString();
  // ISSN is the only authoritative match.  A title fallback is used only
  // when a journal record has no ISSN in the local snapshot.
  for (const issn of [...new Set(issns)]) {
    const row = await lookupOne({ issn });
    if (row) return publicJcarRecord(row, 'issn', fetchedAt);
  }
  if (name) {
    const row = await lookupOne({ name: name.toUpperCase() });
    if (row) {
      const rowName = normalizeName(row.fullName || row.name).toUpperCase();
      if (rowName === name.toUpperCase()) return publicJcarRecord(row, 'name', fetchedAt);
    }
  }
  return null;
}

export async function routeJcar(req, env, ctx) {
  const requestUrl = new URL(req.url);
  const issn = normalizeIssn(requestUrl.searchParams.get('issn'));
  const eissn = normalizeIssn(requestUrl.searchParams.get('eissn'));
  const name = normalizeName(requestUrl.searchParams.get('name'));
  if (!issn && !eissn && !name) return json({ ok: false, error: 'issn or name is required' }, 400);

  // The cache key intentionally contains only normalized lookup fields; no
  // auth headers or user identifiers are ever sent to JCAR.
  const cacheUrl = new URL('https://journal.ailatest.org/api/jcar');
  if (issn) cacheUrl.searchParams.set('issn', issn);
  if (eissn) cacheUrl.searchParams.set('eissn', eissn);
  if (name) cacheUrl.searchParams.set('name', name.toUpperCase());
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (_) {
    // Cache API is unavailable in some local Wrangler modes; continue.
  }

  try {
    const record = await lookupJcar(requestUrl);
    const response = json({ ok: true, source: 'jcar', record }, 200);
    try {
      const stored = response.clone();
      if (ctx?.waitUntil) ctx.waitUntil(caches.default.put(cacheKey, stored));
    } catch (_) {
      // A successful upstream response is still useful if edge cache is off.
    }
    return response;
  } catch (error) {
    console.warn('[jcar] lookup failed', error?.message || error);
    return json({ ok: false, source: 'jcar', record: null, error: 'upstream_unavailable' }, 200, {
      'Cache-Control': 'no-store',
    });
  }
}
