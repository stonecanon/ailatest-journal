/**
 * /ext/lookup — compact journal badge lookup for the browser extension.
 *
 * GET  /ext/lookup?issn=0140-6736
 * GET  /ext/lookup?name=the%20lancet
 * POST /ext/lookup { items: [{ issn?, name? }, ...] }
 */

import { CORS, json, loadJournals } from './deepseek-common.js';

const DEFAULT_LOOKUP_URL = 'https://journal.ailatest.org/data/ext_lookup.json.gz';

let lookupCache = null;
let lookupPromise = null;

function issnKey(value) {
  return String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');
}

async function fetchJsonMaybeGzip(url) {
  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = isGzip
    ? await new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

function addRecord(index, record) {
  if (!record) return;
  for (const value of [record.issn, record.eissn]) {
    const key = issnKey(value);
    if (key && !index.byIssn.has(key)) index.byIssn.set(key, record);
  }
  for (const value of [record.name, record.cn_name]) {
    const key = norm(value);
    if (key && !index.byName.has(key)) index.byName.set(key, record);
  }
}

function buildIndex(records) {
  const index = { byIssn: new Map(), byName: new Map() };
  for (const record of records || []) addRecord(index, record);
  return index;
}

async function loadLookupIndex(env) {
  if (lookupCache) return lookupCache;
  if (!lookupPromise) {
    lookupPromise = (async () => {
      try {
        const data = await fetchJsonMaybeGzip(env.EXT_LOOKUP_URL || DEFAULT_LOOKUP_URL);
        lookupCache = buildIndex(Array.isArray(data) ? data : (data.journals || data.records || []));
      } catch (e) {
        console.warn('[ext-lookup] compact lookup failed; using journals fallback:', e?.message || e);
        lookupCache = buildIndex(await loadJournals(env));
      }
      return lookupCache;
    })().catch((e) => {
      lookupPromise = null;
      throw e;
    });
  }
  return lookupPromise;
}

function lookupOne(index, query) {
  const ik = issnKey(query?.issn);
  if (ik && index.byIssn.has(ik)) return index.byIssn.get(ik);
  const nk = norm(query?.name);
  if (nk && index.byName.has(nk)) return index.byName.get(nk);
  return null;
}

function displayIf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '';
}

function addBadge(out, group, text, className = group, title = '') {
  if (!text) return;
  out.push({ group, text: String(text), className, title });
}

function buildDisplayBadges(journal) {
  const j = journal || {};
  const out = [];
  const indices = Array.isArray(j.indices) ? j.indices : [];
  for (const idx of indices.slice(0, 5)) addBadge(out, 'index', idx, 'index', '收录索引');
  if (j.scopus && !indices.map(String).some((x) => x.toLowerCase() === 'scopus')) addBadge(out, 'index', 'Scopus', 'index', 'Scopus 收录');
  if (j.cstpcd) addBadge(out, 'index', '中国科技核心', 'cstpcd', '中国科技核心期刊目录');
  if (j.cscd) addBadge(out, 'index', typeof j.cscd === 'string' ? j.cscd : 'CSCD', 'cscd', '中国科学引文数据库');
  if (j.cssci === 'core' || j.cssci === true) addBadge(out, 'index', 'CSSCI', 'cssci', 'CSSCI 来源期刊');
  if (j.cssci === 'ext') addBadge(out, 'index', 'CSSCI 扩展', 'cssci-ext', 'CSSCI 扩展版来源期刊');
  if (j.pku) addBadge(out, 'index', '北大核心', 'pku', '北大中文核心期刊要目总览');
  if (j.if_quartile) addBadge(out, 'rating', `JCR ${String(j.if_quartile).toUpperCase()}`, 'zone', 'JCR 分区');
  if (j.cas_zone) addBadge(out, 'rating', `中科院 ${j.cas_zone}区${j.cas_top ? '·TOP' : ''}`, 'zone', '中科院分区');
  if (j.if_2024 != null || j.if_latest != null) addBadge(out, 'rating', `IF ${displayIf(j.if_latest ?? j.if_2024)}`, 'if', '影响因子');
  if (j.ccf) addBadge(out, 'rating', `CCF ${j.ccf}`, 'ccf', 'CCF 推荐目录');
  if (j.abdc) addBadge(out, 'rating', `ABDC ${typeof j.abdc === 'string' ? j.abdc : j.abdc.rating || ''}`, 'biz', 'ABDC Journal Quality List');
  if (j.abs) addBadge(out, 'rating', `ABS ${typeof j.abs === 'string' ? j.abs : j.abs.rating || ''}`, 'biz', 'ABS Academic Journal Guide');
  if (j.free) addBadge(out, 'access', '免费发表', 'free', '开放获取/免费发表信号');
  if (j.doaj?.apc && /^no$/i.test(String(j.doaj.apc))) addBadge(out, 'access', 'DOAJ 免 APC', 'free', 'DOAJ 收录且免 APC');
  if (j.warning) addBadge(out, 'risk', 'Warning', 'warning', '国际期刊预警');
  if (j.citic_warning) addBadge(out, 'risk', '中信所预警', 'citic', '中信所预警');
  if (j.on_hold) addBadge(out, 'risk', 'WoS On Hold', 'onhold', 'WoS 暂停收录');
  if (j.under_review) addBadge(out, 'risk', 'Under Review', 'onhold', '审查中');
  return out;
}

function withDisplayBadges(hit) {
  if (!hit) return null;
  return { ...hit, display_badges: buildDisplayBadges(hit) };
}

export async function handleExtLookup(req, env) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  let index;
  try {
    index = await loadLookupIndex(env);
  } catch (e) {
    return json({ ok: false, error: `lookup data failed: ${e.message}` }, 500);
  }

  const cacheHeaders = { 'Cache-Control': 'public, max-age=86400' };
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const hit = lookupOne(index, {
      issn: url.searchParams.get('issn') || '',
      name: url.searchParams.get('name') || '',
    });
    return new Response(JSON.stringify(hit ? { ok: true, found: true, journal: withDisplayBadges(hit) } : { ok: true, found: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...cacheHeaders },
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : null;
    if (!items) return json({ ok: false, error: 'items[] required' }, 400);
    const results = items.map((item) => withDisplayBadges(lookupOne(index, item)));
    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...cacheHeaders },
    });
  }

  return json({ ok: false, error: 'GET or POST only' }, 405);
}
