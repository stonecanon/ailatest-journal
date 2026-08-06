import { loadJournals } from './deepseek-common.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function normalizeUpper(value) {
  return String(value || '').trim().toUpperCase();
}

function asArray(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.flatMap(asArray);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values, max = 60) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const raw = String(value || '').trim();
    const key = normalize(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const v = normalize(value);
  return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

function parseIntBounded(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseSearchParams(url) {
  const read = (key) => {
    const all = url.searchParams.getAll(key).filter((v) => v != null && v !== '');
    if (all.length > 1) return all;
    return all[0] || '';
  };
  return {
    q: read('q') || read('query') || '',
    query: read('query') || read('q') || '',
    subjects: read('subjects') || read('subject') || read('topic'),
    indexes: read('indexes') || read('indices'),
    indices: read('indices') || read('indexes'),
    jcr_quartile: read('jcr_quartile') || read('jcr') || read('quartile'),
    cas_zone: read('cas_zone') || read('zone'),
    exclude_warning: read('exclude_warning'),
    sort_by: read('sort_by'),
    order: read('order'),
    page: read('page'),
    page_size: read('page_size') || read('limit'),
    limit: read('limit') || read('page_size'),
    warning: read('warning'),
    citic_warning: read('citic_warning'),
    on_hold: read('on_hold'),
    under_review: read('under_review'),
  };
}

async function parseSearchInput(request) {
  const url = new URL(request.url);
  const fromQuery = parseSearchParams(url);
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return fromQuery;
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return fromQuery;
  const body = await request.json().catch(() => ({}));
  return { ...fromQuery, ...(body && typeof body === 'object' ? body : {}) };
}

function textFields(journal) {
  return [
    journal.name,
    journal.cn_name,
    journal.abbr20,
    journal.issn,
    journal.eissn,
    ...(Array.isArray(journal.alias) ? journal.alias : []),
  ].filter(Boolean);
}

function matchText(journal, query) {
  const q = normalize(query);
  if (!q) return true;
  return textFields(journal).some((value) => normalize(value).includes(q));
}

function textScore(journal, query) {
  const q = normalize(query);
  if (!q) return 0;
  let score = 0;
  const name = normalize(journal.name);
  const abbr = normalize(journal.abbr20);
  const cnName = normalize(journal.cn_name);
  if (name === q) score += 120;
  else if (name.startsWith(q)) score += 80;
  else if (name.includes(q)) score += 35;
  if (normalize(journal.issn) === q || normalize(journal.eissn) === q) score += 100;
  if (abbr === q) score += 90;
  else if (abbr.startsWith(q)) score += 45;
  if (cnName && cnName.includes(q)) score += 35;
  for (const alias of Array.isArray(journal.alias) ? journal.alias : []) {
    const a = normalize(alias);
    if (a === q) score += 70;
    else if (a.includes(q)) score += 25;
  }
  return score;
}

function journalIndexTags(journal) {
  const tags = new Set((journal.indices || []).map(normalizeUpper).filter(Boolean));
  if (journal.esi_category) tags.add('ESI');
  if (journal.scopus) tags.add('SCOPUS');
  if (journal.pubmed) tags.add('PUBMED');
  if (journal.pmc) tags.add('PMC');
  if (journal.medline) tags.add('MEDLINE');
  if (journal.doaj) tags.add('DOAJ');
  if (journal.ei_status || (journal.ei_subjects || []).length) tags.add('EI');
  if (journal.ccf) tags.add('CCF');
  if (journal.abdc) tags.add('ABDC');
  if (journal.abs) tags.add('ABS');
  if (journal.cssci) tags.add('CSSCI');
  return tags;
}

function subjectTags(journal) {
  const casSub = Array.isArray(journal.cas_xr?.sub)
    ? journal.cas_xr.sub.flatMap((item) => [item.name, item.name_en, item.category, item.category_en])
    : [];
  return unique([
    ...(journal.wos_categories || []),
    ...(journal.ei_subjects || []),
    journal.esi_category,
    journal.cas_major_cat,
    journal.cas_major_cn,
    journal.cas_xr?.major_cn,
    journal.cas_xr?.major_en,
    journal.cnki_major,
    ...casSub,
  ], 80);
}

function hasWarning(journal) {
  return !!(journal.warning || journal.citic_warning || journal.on_hold || journal.under_review);
}

function matchesFilters(journal, filters) {
  const indexes = asArray(filters.indexes || filters.indices).map(normalizeUpper);
  if (indexes.length) {
    const tags = journalIndexTags(journal);
    if (!indexes.some((idx) => tags.has(idx))) return false;
  }

  const subjects = asArray(filters.subjects || filters.subject || filters.topic).map(normalize);
  if (subjects.length) {
    const fields = subjectTags(journal).map(normalize);
    if (!subjects.some((subject) => fields.some((field) => field === subject || field.includes(subject) || subject.includes(field)))) {
      return false;
    }
  }

  const jcrQuartiles = asArray(filters.jcr_quartile || filters.jcr || filters.quartile).map(normalizeUpper);
  if (jcrQuartiles.length && !jcrQuartiles.includes(normalizeUpper(journal.if_quartile))) return false;

  const casZones = asArray(filters.cas_zone || filters.zone).map((value) => String(value).replace(/[^0-9]/g, ''));
  if (casZones.length) {
    const zoneValues = [
      journal.cas_zone,
      journal.cas_xr?.zone,
    ].map((value) => String(value || '').replace(/[^0-9]/g, '')).filter(Boolean);
    if (!casZones.some((zone) => zoneValues.includes(zone))) return false;
  }

  if (parseBool(filters.exclude_warning) && hasWarning(journal)) return false;
  if (String(filters.warning || '') === '1' && !journal.warning) return false;
  if (String(filters.citic_warning || '') === '1' && !journal.citic_warning) return false;
  if (String(filters.on_hold || '') === '1' && !journal.on_hold) return false;
  if (String(filters.under_review || '') === '1' && !journal.under_review) return false;
  return true;
}

function impactFactor(journal) {
  const n = Number(journal.if_latest ?? journal.if_2025 ?? journal.if_2024);
  return Number.isFinite(n) ? n : null;
}

function jcrRankValue(journal) {
  const q = normalizeUpper(journal.if_quartile);
  const m = q.match(/Q([1-4])/);
  return m ? Number(m[1]) : 99;
}

function casRankValue(journal) {
  const z = Number(String(journal.cas_zone || journal.cas_xr?.zone || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(z) && z > 0 ? z : 99;
}

function reviewMonths(journal) {
  const n = Number(journal.review_cycle_months ?? journal.crossref?.avg_months ?? journal.crossref?.median_days / 30);
  return Number.isFinite(n) ? n : null;
}

function sortResults(results, filters, query) {
  const sortBy = normalize(filters.sort_by || (query ? 'relevance' : 'if'));
  const order = normalize(filters.order || 'desc') === 'asc' ? 'asc' : 'desc';
  const dir = order === 'asc' ? 1 : -1;
  const value = (journal) => {
    if (sortBy === 'relevance') return textScore(journal, query);
    if (sortBy === 'name') return normalize(journal.name);
    if (sortBy === 'jcr' || sortBy === 'jcr_quartile') return jcrRankValue(journal);
    if (sortBy === 'cas' || sortBy === 'cas_zone') return casRankValue(journal);
    if (sortBy === 'review') return reviewMonths(journal);
    return impactFactor(journal);
  };
  results.sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const aMissing = av == null || av === '' || av === 99;
    const bMissing = bv == null || bv === '' || bv === 99;
    if (aMissing && bMissing) return normalize(a.name).localeCompare(normalize(b.name), 'en');
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv), 'en') * (order === 'asc' ? 1 : -1);
    }
    return (av - bv) * dir;
  });
}

function publicFields(journal) {
  return {
    id: journal.issn || journal.eissn || '',
    name: journal.name,
    cn_name: journal.cn_name,
    abbr20: journal.abbr20,
    issn: journal.issn,
    eissn: journal.eissn,
    publisher: journal.publisher,
    if_2024: journal.if_2024,
    if_latest: journal.if_latest,
    if_latest_year: journal.if_latest_year,
    indices: journal.indices,
    esi_category: journal.esi_category,
    cas_zone: journal.cas_zone,
    cas_top: journal.cas_top,
    cas_xr: journal.cas_xr,
    if_quartile: journal.if_quartile,
    wos_categories: journal.wos_categories,
    review_cycle_months: journal.review_cycle_months,
    ccf: journal.ccf,
    abdc: journal.abdc,
    abs: journal.abs,
    scopus: journal.scopus,
    doaj: journal.doaj,
    free: journal.free,
    oaj: journal.oaj,
    warning: journal.warning,
    under_review: journal.under_review,
    on_hold: journal.on_hold,
    citic_warning: journal.citic_warning,
    slug: journal.slug,
  };
}

function journalUrl(journal, env) {
  const site = env?.SITE_URL || 'https://journal.ailatest.org';
  if (journal.slug) return `${site.replace(/\/$/, '')}/journal/${encodeURIComponent(journal.slug)}/`;
  return `${site.replace(/\/$/, '')}/?q=${encodeURIComponent(journal.name || journal.issn || '')}`;
}

function skillFields(journal, env, match = {}) {
  const ifValue = impactFactor(journal);
  return {
    title: journal.name,
    cn_name: journal.cn_name || '',
    issn: journal.issn || '',
    eissn: journal.eissn || '',
    publisher: journal.publisher || '',
    country: journal.country || '',
    url: journalUrl(journal, env),
    metrics: {
      if: ifValue,
      if_year: journal.if_latest_year || journal.jcr_year || (journal.if_2024 != null ? 2024 : null),
      if_rank: journal.if_rank || null,
      five_year_if: journal.five_year_if || null,
      jci: journal.jci || null,
    },
    jcr: {
      quartile: journal.if_quartile || '',
      category: (journal.wos_categories || [])[0] || '',
      year: journal.jcr_year || null,
      release_year: journal.jcr_release_year || null,
    },
    cas: {
      zone: journal.cas_zone || journal.cas_xr?.zone || null,
      top: !!(journal.cas_top || journal.cas_xr?.top),
      major: journal.cas_major_cn || journal.cas_xr?.major_cn || journal.cas_major_cat || '',
      major_zone: journal.cas_xr?.zone || null,
      subcategories: Array.isArray(journal.cas_xr?.sub) ? journal.cas_xr.sub : [],
      emerging: !!journal.cas_xr?.emerging,
    },
    indexes: Array.from(journalIndexTags(journal)),
    subjects: {
      wos: journal.wos_categories || [],
      esi: journal.esi_category || '',
      ei: journal.ei_subjects || [],
      cnkx: journal.cnki_major || journal.cas_major_cn || '',
    },
    access: {
      free: !!journal.free,
      doaj: !!journal.doaj,
      official_url: journal.url || journal.official_url || journal.homepage || '',
      apc: journal.oa?.apc || journal.doaj?.apc || '',
      apc_fee: journal.oa?.fee || journal.doaj?.fee || '',
      apc_usd: journal.apc_usd ?? null,
      license: journal.doaj?.license || journal.oa?.license || '',
    },
    review: {
      months: reviewMonths(journal),
      source: journal.crossref?.source || (journal.review_cycle_months ? 'AILatest' : ''),
    },
    risk: {
      warning: !!journal.warning,
      citic_warning: !!journal.citic_warning,
      on_hold: !!journal.on_hold,
      under_review: !!journal.under_review,
    },
    match: {
      score: Number(match.score || 0),
      matched_terms: match.matched_terms || [],
      basis: match.basis || [],
    },
  };
}

function quotaPolicy(context = {}) {
  const auth = context?.apiKey ? 'api_key' : (context?.user ? 'account' : 'public');
  return {
    status: 'public_beta',
    access: auth,
    api_key_supported: true,
    free_trial: true,
    free_search: 'limited initial credits per account',
    accounting: 'account-level credits, not daily reset',
    paid_modes: ['pay_as_you_go', 'subscription'],
    note: 'Skill/API and MCP are in public beta. Limits and response fields may change before general availability.',
  };
}

function normalizedSearch(filters) {
  return {
    query: String(filters.query || filters.q || '').trim(),
    subjects: asArray(filters.subjects || filters.subject || filters.topic),
    indexes: asArray(filters.indexes || filters.indices),
    jcr_quartile: asArray(filters.jcr_quartile || filters.jcr || filters.quartile),
    cas_zone: asArray(filters.cas_zone || filters.zone).map((value) => Number(String(value).replace(/[^0-9]/g, ''))).filter(Boolean),
    exclude_warning: parseBool(filters.exclude_warning),
    sort_by: normalize(filters.sort_by || ''),
    order: normalize(filters.order || 'desc') === 'asc' ? 'asc' : 'desc',
  };
}

function paginate(results, filters) {
  const page = parseIntBounded(filters.page, 1, 1, 100000);
  const pageSize = parseIntBounded(filters.page_size || filters.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  return {
    page,
    page_size: pageSize,
    total_pages: Math.ceil(results.length / pageSize),
    slice: results.slice(offset, offset + pageSize),
  };
}

function runSearch(journals, filters) {
  const query = String(filters.query || filters.q || '').trim();
  const results = journals.filter((journal) => {
    if (query && !matchText(journal, query)) return false;
    return matchesFilters(journal, filters);
  });
  sortResults(results, filters, query);
  return { query, results };
}

function extractRecommendTerms(input) {
  const raw = [
    input.title,
    input.abstract,
    ...(asArray(input.keywords)),
    input.query,
    input.q,
  ].filter(Boolean).join(' ');
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s&-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !['and', 'the', 'for', 'with', 'from', 'that', 'this', 'using', 'based'].includes(w));
  return unique(words, 30);
}

function recommendationScore(journal, terms) {
  const hay = normalize([
    journal.name,
    journal.cn_name,
    journal.esi_category,
    ...(journal.wos_categories || []),
    ...(journal.ei_subjects || []),
    journal.cas_major_cn,
    journal.cas_major_cat,
    journal.cnki_major,
  ].filter(Boolean).join(' | '));
  const matched = [];
  let score = 0;
  for (const term of terms) {
    const key = normalize(term);
    if (!key) continue;
    if (hay.includes(key)) {
      matched.push(term);
      score += key.length > 6 ? 3 : 2;
    }
  }
  const ifValue = impactFactor(journal);
  if (ifValue != null) score += Math.min(8, ifValue / 3);
  if (journal.if_quartile === 'Q1') score += 3;
  else if (journal.if_quartile === 'Q2') score += 2;
  if (journal.cas_zone === 1) score += 3;
  else if (journal.cas_zone === 2) score += 2;
  if (hasWarning(journal)) score -= 8;
  return { score, matched_terms: matched, basis: matched.length ? ['subject_match', 'journal_metrics'] : ['journal_metrics'] };
}

export async function buildPublicSearchResponse(request, env) {
  const filters = await parseSearchInput(request);
  const journals = await loadJournals(env);
  const { results } = runSearch(journals, filters);
  const page = paginate(results, filters);
  return {
    total: results.length,
    page: page.page,
    limit: page.page_size,
    page_size: page.page_size,
    total_pages: page.total_pages,
    items: page.slice.map(publicFields),
  };
}

export async function buildSkillSearchResponse(request, env, context = {}) {
  const filters = await parseSearchInput(request);
  const journals = await loadJournals(env);
  const { query, results } = runSearch(journals, filters);
  const page = paginate(results, filters);
  return {
    ok: true,
    mode: 'search',
    query,
    filters: normalizedSearch(filters),
    sort: {
      sort_by: normalize(filters.sort_by || (query ? 'relevance' : 'if')),
      order: normalize(filters.order || 'desc') === 'asc' ? 'asc' : 'desc',
    },
    total: results.length,
    page: page.page,
    page_size: page.page_size,
    total_pages: page.total_pages,
    items: page.slice.map((journal) => skillFields(journal, env, {
      score: query ? textScore(journal, query) : 0,
      matched_terms: query ? [query] : [],
      basis: query ? ['text_match'] : ['structured_filter'],
    })),
    quota_policy: quotaPolicy(context),
  };
}

export async function buildSkillRecommendResponse(request, env, context = {}) {
  const filters = await parseSearchInput(request);
  const terms = extractRecommendTerms(filters);
  const journals = await loadJournals(env);
  const baseFilters = { ...filters, query: '', q: '' };
  const candidates = journals.filter((journal) => matchesFilters(journal, baseFilters));
  const scored = candidates
    .map((journal) => ({ journal, match: recommendationScore(journal, terms) }))
    .filter((item) => terms.length ? item.match.matched_terms.length > 0 : item.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score);
  const page = paginate(scored, filters);
  return {
    ok: true,
    mode: 'recommend',
    query: [filters.title, filters.abstract, ...(asArray(filters.keywords))].filter(Boolean).join(' ').trim(),
    terms,
    filters: normalizedSearch(filters),
    total: scored.length,
    page: page.page,
    page_size: page.page_size,
    total_pages: page.total_pages,
    items: page.slice.map((item) => skillFields(item.journal, env, item.match)),
    notes: [
      'Structured-data recommendation only; verify scope and author instructions on the journal website.',
      'Use exclude_warning=true to remove warning, on-hold and under-review journals.',
    ],
    quota_policy: quotaPolicy(context),
  };
}

export function buildSkillQuotaResponse(context = {}) {
  return {
    ok: true,
    mode: 'quota',
    quota_policy: quotaPolicy(context),
  };
}
