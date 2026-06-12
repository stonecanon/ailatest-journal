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

const DEFAULT_URL = 'https://journal.ailatest.org/data/ext_lookup.json.gz';

let indexCache = null;       // { byIssn: Map, byName: Map }
let indexPromise = null;

function issnKey(v) {
  return String(v || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

// Loose name key: drop a leading English article so "The Lancet" == "Lancet".
function looseName(nk) {
  return nk ? nk.replace(/^(the|a|an) /, '') : '';
}

async function loadIndex(env) {
  if (indexCache) return indexCache;
  if (!indexPromise) {
    indexPromise = (async () => {
      const url = env.EXT_LOOKUP_URL || DEFAULT_URL;
      const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!res.ok) throw new Error(`ext_lookup ${res.status}`);
      const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
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
    })().catch(e => { indexPromise = null; throw e; });
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
