/**
 * /ext/lookup — compact journal badge lookup for the browser extension.
 *
 * GET  /ext/lookup?issn=0140-6736
 * GET  /ext/lookup?name=the%20lancet
 * POST /ext/lookup { items: [{ issn?, name? }, ...] }
 */

import { CORS, json, loadJournals } from './deepseek-common.js';

const DEFAULT_LOOKUP_URL = 'https://journal.ailatest.org/data/ext_lookup.json.gz?v=20260806-ext-v2';
const ANONYMOUS_EXTENSION_FEATURES = {
  queries_per_day: 40,
  devices: 1,
  premium_labels: {},
};

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
  for (const value of [record.name, record.cn_name, ...(Array.isArray(record.aliases) ? record.aliases : [])]) {
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

function extensionFeatures(context = {}) {
  return context?.entitlements?.features?.extension || ANONYMOUS_EXTENSION_FEATURES;
}

function canShow(features, key) {
  return features?.premium_labels?.[key] === true;
}

function retractionCount(value) {
  const n = Number(value?.retractions_total ?? value?.total ?? value?.count ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function buildDisplayBadges(journal, features = ANONYMOUS_EXTENSION_FEATURES) {
  const j = journal || {};
  const out = [];
  const indices = Array.isArray(j.indices) ? j.indices : [];
  if (j.inspec) addBadge(out, 'index', 'Inspec', 'inspec', 'Inspec active source list · April 2026');
  if (j.fsta || j.fsta_full_text) addBadge(out, 'index', 'FSTA', 'fsta', 'FSTA with Full Text coverage (public full-text subset)');
  if (j.cabi) addBadge(out, 'index', 'CABI', 'cabi', 'CAB Abstracts serial cited report · September 2013');
  for (const idx of indices.slice(0, 5)) addBadge(out, 'index', idx, 'index', '收录索引');
  if (j.scopus && !indices.map(String).some((x) => x.toLowerCase() === 'scopus')) addBadge(out, 'index', 'Scopus', 'index', 'Scopus 收录');
  if (j.cstpcd) addBadge(out, 'index', '中国科技核心', 'cstpcd', '中国科技核心期刊目录');
  if (j.cscd) addBadge(out, 'index', typeof j.cscd === 'string' ? j.cscd : 'CSCD', 'cscd', '中国科学引文数据库');
  if (j.scd) addBadge(out, 'index', typeof j.scd === 'string' ? j.scd : 'SCD', 'scd', 'SCD 源期刊');
  if (j.ami) addBadge(out, 'index', `AMI ${typeof j.ami === 'string' ? j.ami : ''}`.trim(), 'ami', 'AMI 综合评价');
  if (j.cssci === 'core' || j.cssci === true) addBadge(out, 'index', 'CSSCI', 'cssci', 'CSSCI 来源期刊');
  if (j.cssci === 'ext') addBadge(out, 'index', 'CSSCI 扩展', 'cssci-ext', 'CSSCI 扩展版来源期刊');
  if (j.pku) addBadge(out, 'index', '北大核心', 'pku', '北大中文核心期刊要目总览');
  if (canShow(features, 'cnkx_tier') && Array.isArray(j.cnkx) && j.cnkx.length) {
    const cnkxBadges = [];
    const cnkxSeen = new Set();
    j.cnkx.forEach((item) => {
      const tier = String(item?.tier || '').toUpperCase();
      const domain = String(item?.domain || '').replace(/领域$/, '').trim();
      const text = domain ? `科协·${domain} ${tier}` : `科协 ${tier}`;
      if (cnkxSeen.has(text)) return;
      cnkxSeen.add(text);
      cnkxBadges.push({
        text,
        title: `中国科协高质量科技期刊分级目录${tier ? ' · ' + tier : ''}${item?.domain ? ' · ' + item.domain : ''}`,
      });
    });
    cnkxBadges.slice(0, 3).forEach((badge) => addBadge(out, 'rating', badge.text, 'tier', badge.title));
    if (cnkxBadges.length > 3) addBadge(out, 'rating', `科协 +${cnkxBadges.length - 3}`, 'tier', '中国科协高质量科技期刊分级目录');
  }
  if (j.if_quartile) addBadge(out, 'rating', `JCR ${String(j.if_quartile).toUpperCase()}`, 'zone', 'JCR 分区');
  if (canShow(features, 'cas_zone') && j.cas_zone) addBadge(out, 'rating', `中科院 ${j.cas_zone}区${j.cas_top ? '·TOP' : ''}`, 'zone', '中科院分区');
  if (canShow(features, 'cas_xr') && j.cas_xr?.zone) {
    addBadge(out, 'rating', `新锐 ${j.cas_xr.zone}区${j.cas_xr.top ? '·TOP' : ''}`, 'xr', '中科院 2026 新锐版分区');
  }
  if (j.if_2024 != null || j.if_latest != null) addBadge(out, 'rating', `IF ${displayIf(j.if_latest ?? j.if_2024)}`, 'if', '影响因子');
  if (j.ccf) addBadge(out, 'rating', `CCF ${j.ccf}`, 'ccf', 'CCF 推荐目录');
  if (j.ccft) addBadge(out, 'rating', `CCF-T ${j.ccft}`, 'ccft', 'CCF 中文科技期刊分级目录');
  if (j.zju) addBadge(out, 'rating', `浙大 ${j.zju}`, 'zju', '浙江大学期刊分级目录');
  if (j.nsfc_mgmt) addBadge(out, 'rating', `NSFC ${j.nsfc_mgmt}`, 'nsfc', '国家自然科学基金委管理科学部期刊目录');
  if (j.abdc) addBadge(out, 'rating', `ABDC ${typeof j.abdc === 'string' ? j.abdc : j.abdc.rating || ''}`, 'biz', 'ABDC Journal Quality List');
  if (j.abs) addBadge(out, 'rating', `ABS ${typeof j.abs === 'string' ? j.abs : j.abs.rating || ''}`, 'biz', 'ABS Academic Journal Guide');
  if (canShow(features, 'publish_fee')) {
    if (j.free) addBadge(out, 'access', '免费发表', 'free', '开放获取/免费发表信号');
    if (j.doaj?.apc && /^no$/i.test(String(j.doaj.apc))) addBadge(out, 'access', 'DOAJ 免 APC', 'free', 'DOAJ 收录且免 APC');
  }
  if (canShow(features, 'warning') && j.warning) addBadge(out, 'risk', 'Warning', 'warning', '国际期刊预警');
  if (canShow(features, 'citic_warning') && j.citic_warning) addBadge(out, 'risk', '中信所预警', 'citic', '中信所预警');
  if (canShow(features, 'on_hold') && j.on_hold) addBadge(out, 'risk', 'WoS On Hold', 'onhold', 'WoS 暂停收录');
  if (canShow(features, 'under_review') && j.under_review) addBadge(out, 'risk', 'Under Review', 'onhold', '审查中');
  const retractions = retractionCount(j.retraction);
  if (canShow(features, 'retraction') && retractions > 0) {
    addBadge(out, 'risk', `撤稿 ${retractions}`, 'retraction', 'Retraction Watch / retraction metrics');
  }
  return out;
}

function redactJournal(hit, features = ANONYMOUS_EXTENSION_FEATURES) {
  if (!hit) return null;
  const out = { ...hit };
  if (!canShow(features, 'cas_zone') && !canShow(features, 'cas_top')) {
    delete out.cas_zone;
    delete out.cas_top;
  }
  if (!canShow(features, 'cas_xr')) delete out.cas_xr;
  if (!canShow(features, 'cnkx_tier')) delete out.cnkx;
  if (!canShow(features, 'warning')) delete out.warning;
  if (!canShow(features, 'citic_warning')) delete out.citic_warning;
  if (!canShow(features, 'on_hold')) delete out.on_hold;
  if (!canShow(features, 'under_review')) delete out.under_review;
  if (!canShow(features, 'retraction')) delete out.retraction;
  if (!canShow(features, 'publish_fee')) {
    delete out.free;
    if (out.doaj && typeof out.doaj === 'object') {
      out.doaj = { ...out.doaj };
      delete out.doaj.apc;
      delete out.doaj.apc_fee;
      delete out.doaj.apc_usd;
    }
  }
  return { ...out, display_badges: buildDisplayBadges(out, features) };
}

let extensionQuotaReady = false;
async function ensureExtensionQuotaTables(env) {
  if (extensionQuotaReady || !env?.DB) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS extension_usage (
        scope_key   TEXT NOT NULL,
        day         TEXT NOT NULL,
        used        INTEGER NOT NULL DEFAULT 0,
        requests    INTEGER NOT NULL DEFAULT 0,
        heartbeats  INTEGER NOT NULL DEFAULT 0,
        last_seen_at INTEGER,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (scope_key, day)
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS extension_devices (
        user_id      INTEGER NOT NULL,
        install_id   TEXT NOT NULL,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, install_id)
      )`
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_extension_usage_day ON extension_usage(day, scope_key)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_extension_devices_user_seen ON extension_devices(user_id, last_seen_at)'),
  ]);
  // Production may already have the pre-usage version of extension_usage.
  // D1 migrations add these columns too, but keeping this guard makes the
  // endpoint self-healing when an older deployment receives a request first.
  try { await env.DB.prepare('ALTER TABLE extension_usage ADD COLUMN requests INTEGER NOT NULL DEFAULT 0').run(); } catch (_) {}
  try { await env.DB.prepare('ALTER TABLE extension_usage ADD COLUMN heartbeats INTEGER NOT NULL DEFAULT 0').run(); } catch (_) {}
  try { await env.DB.prepare('ALTER TABLE extension_usage ADD COLUMN last_seen_at INTEGER').run(); } catch (_) {}
  extensionQuotaReady = true;
}

function quotaScope(context = {}) {
  if (context.user?.id != null) return `user:${context.user.id}`;
  const ip = String(context.ipHash || '').trim();
  const install = String(context.installId || '').trim();
  return `anon:${ip || 'unknown'}:${install || 'browser'}`.slice(0, 240);
}

async function touchExtensionDevice(env, context, features) {
  const userId = context.user?.id;
  const installId = String(context.installId || '').trim().slice(0, 160);
  if (!env?.DB || userId == null || !installId || context.isOwner) return { ok: true };
  const maxDevices = Number(features?.devices);
  if (!Number.isFinite(maxDevices) || maxDevices <= 0) return { ok: false, code: 'device_limit', limit: 0, used: 0 };
  const now = Math.floor(Date.now() / 1000);
  await ensureExtensionQuotaTables(env);
  const existing = await env.DB.prepare(
    'SELECT install_id FROM extension_devices WHERE user_id = ? AND install_id = ?'
  ).bind(userId, installId).first();
  if (existing) {
    await env.DB.prepare(
      'UPDATE extension_devices SET last_seen_at = ? WHERE user_id = ? AND install_id = ?'
    ).bind(now, userId, installId).run();
    return { ok: true, used: null, limit: maxDevices };
  }
  const activeSince = now - 90 * 86400;
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM extension_devices WHERE user_id = ? AND last_seen_at >= ?'
  ).bind(userId, activeSince).first();
  const used = Number(row?.n || 0);
  if (used >= maxDevices) return { ok: false, code: 'device_limit', limit: maxDevices, used };
  await env.DB.prepare(
    `INSERT OR IGNORE INTO extension_devices (user_id, install_id, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?)`
  ).bind(userId, installId, now, now).run();
  return { ok: true, used: used + 1, limit: maxDevices };
}

async function consumeExtensionQuota(env, context, features, amount) {
  const limit = Number(features?.queries_per_day || 40);
  const count = Math.max(0, Number(amount || 0));
  const now = Math.floor(Date.now() / 1000);
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  if (!env?.DB || !count) return { ok: true, used: 0, limit, remaining: limit, day };
  if (count > limit) return { ok: false, code: 'extension_quota', used: 0, limit, remaining: 0, day };
  await ensureExtensionQuotaTables(env);
  const scope = quotaScope(context);
  const result = await env.DB.prepare(
    `INSERT INTO extension_usage (scope_key, day, used, requests, heartbeats, last_seen_at, updated_at)
     VALUES (?, ?, ?, 1, 0, ?, ?)
     ON CONFLICT(scope_key, day) DO UPDATE SET
       used = extension_usage.used + ?,
       requests = extension_usage.requests + 1,
       last_seen_at = ?,
       updated_at = ?
     WHERE extension_usage.used + ? <= ?`
  ).bind(scope, day, count, now, now, count, now, now, count, limit).run();
  if (!Number(result?.meta?.changes || 0)) {
    const row = await env.DB.prepare(
      'SELECT used FROM extension_usage WHERE scope_key = ? AND day = ?'
    ).bind(scope, day).first();
    const used = Number(row?.used || 0);
    return { ok: false, code: 'extension_quota', used, limit, remaining: Math.max(0, limit - used), day };
  }
  const row = await env.DB.prepare(
    'SELECT used FROM extension_usage WHERE scope_key = ? AND day = ?'
  ).bind(scope, day).first();
  const used = Number(row?.used || count);
  return { ok: true, used, limit, remaining: Math.max(0, limit - used), day };
}

/**
 * Record a lightweight daily activity heartbeat from the extension.  This is
 * deliberately separate from quota consumption so a cached lookup can still
 * count as an active installation without spending a lookup unit.
 */
export async function recordExtensionHeartbeat(env, context = {}) {
  if (!env?.DB) return { ok: true };
  const now = Math.floor(Date.now() / 1000);
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  await ensureExtensionQuotaTables(env);
  const scope = quotaScope(context);
  await env.DB.prepare(
    `INSERT INTO extension_usage (scope_key, day, used, requests, heartbeats, last_seen_at, updated_at)
     VALUES (?, ?, 0, 0, 1, ?, ?)
     ON CONFLICT(scope_key, day) DO UPDATE SET
       heartbeats = extension_usage.heartbeats + 1,
       last_seen_at = ?,
       updated_at = ?`
  ).bind(scope, day, now, now, now, now).run();
  return { ok: true, day };
}

export async function handleExtLookup(req, env, context = {}) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const features = extensionFeatures(context);
  const device = await touchExtensionDevice(env, context, features);
  if (!device.ok) {
    return json({
      ok: false,
      error: 'extension device limit reached',
      code: device.code,
      tier: context.entitlements?.product_tier || (context.user ? 'free' : 'anonymous'),
      devices: { used: device.used, limit: device.limit },
    }, 403);
  }

  let index;
  try {
    index = await loadLookupIndex(env);
  } catch (e) {
    return json({ ok: false, error: `lookup data failed: ${e.message}` }, 500);
  }

  const cacheHeaders = { 'Cache-Control': 'no-store' };
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const query = {
      issn: url.searchParams.get('issn') || '',
      name: url.searchParams.get('name') || '',
    };
    const quota = await consumeExtensionQuota(env, context, features, query.issn || query.name ? 1 : 0);
    if (!quota.ok) return json({ ok: false, error: 'extension lookup quota exceeded', code: quota.code, quota }, 429);
    const hit = lookupOne(index, query);
    return new Response(JSON.stringify(hit
      ? { ok: true, found: true, journal: redactJournal(hit, features), quota }
      : { ok: true, found: false, quota }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...cacheHeaders },
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : null;
    if (!items) return json({ ok: false, error: 'items[] required' }, 400);
    const validItems = items.filter((item) => item && (item.issn || item.name));
    const quota = await consumeExtensionQuota(env, context, features, validItems.length);
    if (!quota.ok) return json({ ok: false, error: 'extension lookup quota exceeded', code: quota.code, quota }, 429);
    const results = items.map((item) => redactJournal(lookupOne(index, item), features));
    return new Response(JSON.stringify({ ok: true, results, quota }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...cacheHeaders },
    });
  }

  return json({ ok: false, error: 'GET or POST only' }, 405);
}
