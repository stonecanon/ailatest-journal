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

const DEFAULT_URL = 'https://journal.ailatest.org/data/ext_lookup.json.gz?v=20260612-lookup';
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
      if (k && byIssn.has(k)) return byIssn.get(k);
    }
    const nk = PickMatch.norm(name);
    if (nk && byName.has(nk)) return byName.get(nk);
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
    return new Response(JSON.stringify(hit ? { ok: true, found: true, journal: hit } : { ok: true, found: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, ...cacheHeaders },
    });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
    const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : null;
    if (!items) return json({ ok: false, error: 'items[] required' }, 400);
    const results = items.map(it => lookupOne(idx, { issn: it?.issn, name: it?.name }) || null);
    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, ...cacheHeaders },
    });
  }

  return json({ ok: false, error: 'GET or POST only' }, 405);
}
