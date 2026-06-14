/**
 * /ext/lookup — journal badge lookup for the browser extension.
 *
 *   GET  /ext/lookup?issn=0140-6736
 *   GET  /ext/lookup?name=the%20lancet
 *   POST /ext/lookup   { items: [{ issn?, name? }, ...] }   (<=100)
 *
 * Returns a compact badge object (or null/{found:false}) merged from
 * data/ext_lookup.json.gz (international + domestic rankings). ISSN match
 * wins; name falls back to the shared pick-match norm so it stays in sync
 * with the rest of the site.
 */

import { CORS, json } from './deepseek-common.js';
import PickMatch from '../../js/pick-match.js';

const DEFAULT_URL = 'https://journal.ailatest.org/data/ext_lookup.json.gz?v=20260614-geo-merge';
const FALLBACK_BASE = 'https://journal.ailatest.org/data';

let indexCache = null;       // { byIssn: Map, byName: Map }
let indexPromise = null;

function issnKey(v) {
  return String(v || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

// Loose name key: drop a leading English article so "The Lancet" == "Lancet".
function looseName(nk) {
  return nk ? nk.replace(/^(the|a|an) /, '') : '';
}

async function fetchTextMaybeGzip(url) {
  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  return isGzip
    ? await new Response(new Response(buf).body.pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(buf);
}

function records(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && Array.isArray(obj.records)) return obj.records;
  return [];
}

function addByIssn(byIssn, b) {
  for (const k of [issnKey(b.issn), issnKey(b.eissn)]) {
    if (k && !byIssn.has(k)) byIssn.set(k, b);
  }
}

function addByName(byName, b) {
  for (const raw of [b.name, b.cn_name]) {
    const nk = PickMatch.norm(raw);
    if (nk && !byName.has(nk)) byName.set(nk, b);
    const lk = looseName(nk);
    if (lk && lk !== nk && !byName.has(lk)) byName.set(lk, b);
  }
}

function indexBadge(byIssn, byName, b) {
  addByIssn(byIssn, b);
  addByName(byName, b);
}

function mergeFallbackData(journals, dom, cscd, cstpcd) {
  const byIssn = new Map();
  const byName = new Map();
  const badges = [];

  function newBadge(name = '', issn = '', eissn = '') {
    const b = { name: name || '', issn: issn || '', eissn: eissn || '' };
    badges.push(b);
    indexBadge(byIssn, byName, b);
    return b;
  }

  function findOrCreate({ name = '', issn = '', eissn = '' } = {}) {
    for (const k of [issnKey(issn), issnKey(eissn)]) {
      if (k && byIssn.has(k)) {
        const b = byIssn.get(k);
        const nk = PickMatch.norm(name);
        if (nk && !byName.has(nk)) byName.set(nk, b);
        if (/[\u4e00-\u9fff]/.test(String(name || '')) && !b.cn_name) b.cn_name = name;
        return b;
      }
    }
    const nk = PickMatch.norm(name);
    if (nk && byName.has(nk)) {
      const b = byName.get(nk);
      if (issn && !b.issn) b.issn = issn;
      if (eissn && !b.eissn) b.eissn = eissn;
      return b;
    }
    return newBadge(name, issn, eissn);
  }

  for (const j of journals || []) {
    const b = newBadge(j.name, j.issn, j.eissn);
    for (const key of ['cn_name', 'slug', 'if_2024', 'if_quartile', 'cas_zone', 'ccf', 'abdc', 'abs', 'indices']) {
      if (j[key] !== undefined && j[key] !== null && j[key] !== '') b[key] = j[key];
    }
    if (j.cas_top) b.cas_top = true;
    if (j.cas_xr?.zone) b.cas_xr = { zone: j.cas_xr.zone, top: !!j.cas_xr.top };
    if (j.scopus) b.scopus = true;
    if (j.free) b.free = true;
    if (j.doaj?.apc !== undefined && j.doaj.apc !== null && j.doaj.apc !== '') b.doaj_apc = String(j.doaj.apc);
    for (const key of ['warning', 'citic_warning', 'on_hold', 'under_review']) {
      if (j[key]) b[key] = true;
    }
    addByName(byName, b);
  }

  for (const r of records(dom?.cssci_core)) {
    if (r.name && !String(r.name).startsWith('序号')) findOrCreate({ name: r.name }).cssci = 'core';
  }
  for (const r of records(dom?.cssci_ext)) {
    if (r.name && !String(r.name).startsWith('序号')) {
      const b = findOrCreate({ name: r.name });
      if (!b.cssci) b.cssci = 'ext';
    }
  }
  for (const r of records(dom?.pku_core)) {
    if (r.name) findOrCreate({ name: r.name }).pku = true;
  }
  for (const r of records(dom?.zju)) {
    const name = String(r.name || '').replace(/\*+$/, '').trim();
    if (name) findOrCreate({ name, issn: r.issn }).zju = r.tier || '';
  }
  for (const r of records(dom?.nsfc_mgmt)) {
    if (r.name) findOrCreate({ name: r.name }).nsfc_mgmt = r.tier || '';
  }
  for (const r of records(dom?.ccft)) {
    const name = r.cn_name || r.en_name || '';
    if (name) findOrCreate({ name }).ccft = r.tier || '';
  }
  for (const r of records(dom?.cnkx)) {
    if (!r.name || !/^T[123]$/.test(r.tier || '')) continue;
    const b = findOrCreate({ name: r.name, issn: r.issn, eissn: r.eissn });
    const arr = b.cnkx || (b.cnkx = []);
    if (!arr.some(x => x.tier === r.tier && x.domain === (r.domain || ''))) {
      arr.push({ tier: r.tier, domain: r.domain || '' });
    }
  }
  for (const r of records(cscd)) {
    if (r.name) findOrCreate({ name: r.name, issn: r.issn }).cscd = r.database_label || r.database || 'CSCD';
  }
  for (const r of records(cstpcd)) {
    if (r.name) findOrCreate({ name: r.name, issn: r.issn }).cstpcd = true;
  }

  for (const b of badges) indexBadge(byIssn, byName, b);
  return { byIssn, byName };
}

async function loadFallbackIndex() {
  const [journalsText, domesticText, cscdText, cstpcdText] = await Promise.all([
    fetchTextMaybeGzip(`${FALLBACK_BASE}/journals.json.gz`),
    fetchTextMaybeGzip(`${FALLBACK_BASE}/domestic.json`),
    fetchTextMaybeGzip(`${FALLBACK_BASE}/cscd_journals.json`),
    fetchTextMaybeGzip(`${FALLBACK_BASE}/cstpcd_journals.json`),
  ]);
  return mergeFallbackData(
    JSON.parse(journalsText),
    JSON.parse(domesticText),
    JSON.parse(cscdText),
    JSON.parse(cstpcdText),
  );
}

async function loadIndex(env) {
  if (indexCache) return indexCache;
  if (!indexPromise) {
    indexPromise = (async () => {
      const url = env.EXT_LOOKUP_URL || DEFAULT_URL;
      const text = await fetchTextMaybeGzip(url);
      const data = JSON.parse(text);
      const journals = Array.isArray(data) ? data : (data.journals || []);
      const byIssn = new Map();
      const byName = new Map();
      for (const b of journals) {
        for (const k of [issnKey(b.issn), issnKey(b.eissn)]) {
          if (k && !byIssn.has(k)) byIssn.set(k, b);
        }
        for (const raw of [b.name, b.cn_name]) {
          const nk = PickMatch.norm(raw);
          if (nk && !byName.has(nk)) byName.set(nk, b);
          const lk = looseName(nk);
          if (lk && lk !== nk && !byName.has(lk)) byName.set(lk, b);
        }
      }
      indexCache = { byIssn, byName };
      return indexCache;
    })().catch(async e => {
      if (!String(e?.message || e).includes('Unexpected token')) {
        indexPromise = null;
        throw e;
      }
      const fallback = await loadFallbackIndex();
      indexCache = fallback;
      return fallback;
    }).catch(e => { indexPromise = null; throw e; });
  }
  return indexPromise;
}

function lookupOne(idx, q) {
  const ik = issnKey(q.issn);
  if (ik && idx.byIssn.has(ik)) return idx.byIssn.get(ik);
  const nk = PickMatch.norm(q.name);
  if (nk && idx.byName.has(nk)) return idx.byName.get(nk);
  const lk = looseName(nk);
  if (lk && idx.byName.has(lk)) return idx.byName.get(lk);
  return null;
}

function displayIf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '';
}

function pushBadge(out, group, text, className, title = '') {
  if (!text) return;
  out.push({ group, text: String(text), className: className || group, title });
}

function bestVhb(vhb) {
  const order = { 'A+': 5, A: 4, B: 3, C: 2, D: 1 };
  const arr = Array.isArray(vhb) ? vhb : [];
  return arr.reduce((best, item) => (!best || (order[item?.rating] || 0) > (order[best?.rating] || 0)) ? item : best, null);
}

function cscdLabel(cscd) {
  if (!cscd) return '';
  const raw = typeof cscd === 'string' ? cscd : (cscd.database || cscd.database_label || '');
  const code = String(raw || '').toUpperCase();
  if (code === 'C' || /核心|CORE/.test(code)) return 'CSCD-C';
  if (code === 'E' || /扩展|EXT/.test(code)) return 'CSCD-E';
  return code && /^CSCD-[CE]$/.test(code) ? code : 'CSCD';
}

function castDiscipline(domain) {
  return String(domain || '').replace(/领域$/, '').replace(/\s*(field|area)$/i, '').trim();
}

function castLabel(item) {
  const tier = item?.tier || '';
  const disc = castDiscipline(item?.domain);
  return disc ? `科协·${disc}${tier ? ' ' + tier : ''}` : `科协 ${tier}`.trim();
}

function buildDisplayBadges(journal) {
  const j = journal || {};
  const out = [];

  // 索引收录：先国际索引，再中文/国内目录。
  const indexOrder = ['SCIE', 'SSCI', 'AHCI', 'ESCI', 'EI'];
  const seenIdx = new Set();
  const indices = Array.isArray(j.indices) ? j.indices.map(x => String(x || '').toUpperCase()) : [];
  for (const idx of indexOrder) {
    if (indices.includes(idx) && !seenIdx.has(idx)) {
      seenIdx.add(idx);
      pushBadge(out, 'index', idx, 'index', '收录索引');
    }
  }
  if (j.scopus && j.scopus_active !== false) pushBadge(out, 'index', 'Scopus', 'index', 'Scopus 收录');
  if (j.cstpcd) pushBadge(out, 'index', '中国科技核心', 'cstpcd', '中国科技核心期刊目录 / CSTPCD');
  if (j.cscd) pushBadge(out, 'index', cscdLabel(j.cscd), 'cscd', '中国科学引文数据库');
  if (j.cssci === 'core') pushBadge(out, 'index', 'CSSCI', 'cssci', 'CSSCI 来源期刊');
  if (j.cssci === 'ext') pushBadge(out, 'index', 'CSSCI 扩展', 'cssci-ext', 'CSSCI 扩展版来源期刊');
  if (j.pku) pushBadge(out, 'index', '北大核心', 'pku', '北大中文核心期刊要目总览');
  if (j.scd) pushBadge(out, 'index', 'SCD', 'scd', `SCD ${j.scd.year || 2026}`);

  // 分级/评价：按网站详情里的层次口径。
  if (j.if_quartile) pushBadge(out, 'rating', `JCR ${String(j.if_quartile).toUpperCase()}`, 'zone', 'JCR 分区');
  if (j.cas_zone) pushBadge(out, 'rating', `中科院 ${j.cas_zone}区${j.cas_top ? '·TOP' : ''}`, 'zone', '中科院大类分区');
  if (j.cas_xr?.zone) pushBadge(out, 'rating', `新锐 ${j.cas_xr.zone}区${j.cas_xr.top ? '·TOP' : ''}`, 'xr', '中科院 2026 新锐版分区');
  if (j.if_2024 != null) pushBadge(out, 'rating', `IF ${displayIf(j.if_2024)}`, 'if', 'JCR 影响因子 2024');
  if (j.ccf) pushBadge(out, 'rating', `CCF ${j.ccf}`, 'ccf', 'CCF 推荐目录');
  if (j.abdc) pushBadge(out, 'rating', `ABDC ${typeof j.abdc === 'string' ? j.abdc : j.abdc.rating || ''}`, 'biz', 'ABDC Journal Quality List');
  if (j.abs) pushBadge(out, 'rating', `ABS ${typeof j.abs === 'string' ? j.abs : j.abs.rating || ''}`, 'biz', 'Chartered ABS AJG 2024');
  if (j.fms?.tier) pushBadge(out, 'rating', `FMS ${j.fms.tier}`, 'biz', 'FMS 管理科学高质量期刊');
  const vhb = bestVhb(j.vhb);
  if (vhb?.rating) {
    const count = Array.isArray(j.vhb) ? j.vhb.length : 1;
    pushBadge(out, 'rating', `VHB ${vhb.rating}`, 'biz', `VHB Rating 2024${vhb.area_code ? ' · ' + vhb.area_code : ''}${count > 1 ? ` · ${count} 个领域` : ''}`);
  }
  const cnrs = Array.isArray(j.cnrs) && j.cnrs[0];
  if (cnrs?.category) pushBadge(out, 'rating', `CNRS ${cnrs.category}`, 'biz', `CNRS Section 37 2020${cnrs.domain ? ' · ' + cnrs.domain : ''}`);
  if (j.ami?.tier) pushBadge(out, 'rating', `AMI ${j.ami.tier}`, 'ami', 'AMI 综合评价');
  if (Array.isArray(j.cnkx)) {
    const seenCast = new Set();
    for (const item of j.cnkx) {
      const label = castLabel(item);
      if (!label || seenCast.has(label)) continue;
      seenCast.add(label);
      pushBadge(out, 'rating', label, 'tier', `中国科协${item.tier ? ' ' + item.tier : ''}${item.domain ? ' · ' + item.domain : ''}`);
    }
  }
  if (j.ccft) pushBadge(out, 'rating', `CCF-T ${j.ccft}`, 'tier', 'CCF 计算领域高质量科技期刊 T 级');
  if (j.zju) pushBadge(out, 'rating', `浙大 ${j.zju}`, 'zju', '浙江大学期刊分级');
  if (j.nsfc_mgmt) pushBadge(out, 'rating', `NSFC ${j.nsfc_mgmt}`, 'nsfc', '国家自然科学基金委管理科学部目录');

  if (j.free) pushBadge(out, 'access', '免费发表', 'free', '提供 OA 发表选项');
  if (/^no$/i.test(String(j.doaj_apc || ''))) pushBadge(out, 'access', 'DOAJ 免 APC', 'free', 'DOAJ 收录且免 APC');

  if (j.warning) pushBadge(out, 'risk', '⚠ Warning', 'warning', '国际期刊预警名单');
  if (j.citic_warning) pushBadge(out, 'risk', '中信所预警', 'citic', '中信所预警');
  if (j.on_hold) pushBadge(out, 'risk', 'WoS On Hold', 'onhold', 'WoS 暂停收录');
  if (j.under_review) pushBadge(out, 'risk', '新锐 Under Review', 'onhold', '新锐版审查中');
  const retTotal = j.retraction?.retractions_total || j.retraction?.total;
  if (retTotal) {
    const rate = j.retraction?.rate_per_1000_10y ?? j.retraction?.rate10;
    pushBadge(out, 'risk', `RW ${retTotal}`, 'citic', `Retraction Watch 撤稿记录；用于风险提示，不作排名${rate != null ? ' · 10y ' + rate + '/1000' : ''}`);
  }

  return out;
}

function withDisplayBadges(hit) {
  if (!hit) return null;
  return { ...hit, display_badges: buildDisplayBadges(hit) };
}

export async function handleExtLookup(req, env) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  let idx;
  try {
    idx = await loadIndex(env);
  } catch (e) {
    return json({ ok: false, error: `lookup data failed: ${e.message}` }, 500);
  }

  const cacheHeaders = { 'Cache-Control': 'public, max-age=86400' };

  if (req.method === 'GET') {
    const u = new URL(req.url);
    const issn = u.searchParams.get('issn') || '';
    const name = u.searchParams.get('name') || '';
    if (!issn && !name) return json({ ok: false, error: 'issn or name required' }, 400);
    const hit = lookupOne(idx, { issn, name });
    return new Response(JSON.stringify(hit ? { ok: true, found: true, journal: withDisplayBadges(hit) } : { ok: true, found: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, ...cacheHeaders },
    });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
    const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : null;
    if (!items) return json({ ok: false, error: 'items[] required' }, 400);
    const results = items.map(it => withDisplayBadges(lookupOne(idx, { issn: it?.issn, name: it?.name })));
    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, ...cacheHeaders },
    });
  }

  return json({ ok: false, error: 'GET or POST only' }, 405);
}
