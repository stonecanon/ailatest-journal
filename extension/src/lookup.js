(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  const API_URL = 'https://journal.ailatest.org/api/ext/lookup';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = 'lookup:v1:';

  function storageArea(areaName) {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage[areaName] ? chrome.storage[areaName] : null;
  }

  function storageGet(area, keys) {
    return new Promise((resolve) => {
      if (!area) return resolve({});
      area.get(keys, (value) => resolve(value || {}));
    });
  }

  function storageSet(area, value) {
    return new Promise((resolve) => {
      if (!area) return resolve();
      area.set(value, () => resolve());
    });
  }

  function queryKey(item) {
    const issn = ns.issnKey(item && item.issn);
    if (issn) return `issn:${issn}`;
    const name = ns.norm(item && item.name);
    return name ? `name:${name}` : '';
  }

  async function getSettings() {
    const defaults = {
      showCas: true,
      showJcr: true,
      showIf: true,
      showCcf: true,
      showBusiness: true,
      showDomestic: true,
      showIndex: true,
      showWarnings: true,
      showFree: true
    };
    const sync = storageArea('sync');
    const saved = await storageGet(sync, Object.keys(defaults));
    return { ...defaults, ...saved };
  }

  async function setSettings(next) {
    await storageSet(storageArea('sync'), next || {});
  }

  async function batchLookup(items) {
    const cleanItems = (items || []).filter((item) => item && (item.issn || item.name)).slice(0, 100);
    if (!cleanItems.length) return [];

    const local = storageArea('local');
    const now = Date.now();
    const keys = cleanItems.map(queryKey);
    const storageKeys = keys.map((key) => CACHE_PREFIX + key);
    const cached = await storageGet(local, storageKeys);

    const results = new Array(cleanItems.length).fill(null);
    const misses = [];
    const missPositions = [];

    cleanItems.forEach((item, index) => {
      const key = storageKeys[index];
      const hit = cached[key];
      if (hit && now - hit.ts < CACHE_TTL_MS) {
        results[index] = hit.miss ? null : hit.value;
      } else {
        misses.push(item);
        missPositions.push(index);
      }
    });

    if (misses.length) {
      const fetched = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: misses })
      });
      if (!fetched.ok) throw new Error(`AILatest lookup failed: ${fetched.status}`);

      const data = await fetched.json();
      const remoteResults = Array.isArray(data.results) ? data.results : [];
      const updates = {};
      missPositions.forEach((position, remoteIndex) => {
        const value = remoteResults[remoteIndex] || null;
        results[position] = value;
        updates[storageKeys[position]] = value ? { ts: now, value } : { ts: now, miss: true };
      });
      await storageSet(local, updates);
    }

    return results;
  }

  ns.lookup = {
    batchLookup,
    getSettings,
    setSettings,
    queryKey,
    apiUrl: API_URL
  };
})(globalThis);
