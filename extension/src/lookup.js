(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  const API_URL = 'https://api.ailatest.org/ext/lookup';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = 'lookup:v2:';

  function storageArea(areaName) {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage[areaName] ? chrome.storage[areaName] : null;
  }
  function storageGet(area, keys) {
    return new Promise((resolve) => { if (!area) return resolve({}); area.get(keys, (v) => resolve(v || {})); });
  }
  function storageSet(area, value) {
    return new Promise((resolve) => { if (!area) return resolve(); area.set(value, () => resolve()); });
  }

  function queryKey(item) {
    const issn = ns.issnKey(item && item.issn);
    if (issn) return `issn:${issn}`;
    const name = ns.norm(item && item.name);
    return name ? `name:${name}` : '';
  }

  // 设置：徽章主题 + 各类显示开关 + 自定义颜色（4 主组）。默认全开、site 主题。
  // 显示开关按四大类组织：收录 / 分级 / 免费开放 / 预警
  const DEFAULT_SETTINGS = {
    theme: 'site',
    lang: 'auto',
    // 收录
    showIndex: true,      // 国际索引 SCIE/SSCI/AHCI/ESCI/EI/Scopus
    showCnIndex: true,    // 国内来源目录 北大核心/CSSCI/CSCD
    // 分级
    showCas: true,        // 中科院分区/新锐/MEGA
    showJcr: true,        // JCR 分区
    showIf: true,         // 影响因子
    showCcf: true,        // CCF 推荐
    showBusiness: true,   // 商科 ABDC/ABS/FMS/VHB/CNRS
    showCnTier: true,     // 国内分级 科协/CCF-T/SCD/AMI/浙大/NSFC
    // 免费开放 / 预警
    showFree: true,
    showWarnings: true,
    colors: {},
  };
  async function getSettings() {
    const sync = storageArea('sync');
    const saved = await storageGet(sync, ['ajSettings', ...Object.keys(DEFAULT_SETTINGS)]);
    // 兼容两种存法：整对象 ajSettings（popup 新版）或扁平键（旧版）
    const obj = saved.ajSettings && typeof saved.ajSettings === 'object' ? saved.ajSettings : saved;
    return { ...DEFAULT_SETTINGS, ...obj, colors: { ...(obj.colors || {}) } };
  }
  async function setSettings(next) {
    await storageSet(storageArea('sync'), { ajSettings: next || {} });
  }

  // 服务端验证：稳定 install-id（storage.local 持久）+ 登录 token（若已登录）
  async function authHeaders() {
    const local = storageArea('local');
    const { ajInstallId, ajUser } = await storageGet(local, ['ajInstallId', 'ajUser']);
    let installId = ajInstallId;
    if (!installId) {
      installId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2);
      await storageSet(local, { ajInstallId: installId });
    }
    const headers = { 'Content-Type': 'application/json', 'X-AJ-Install': installId };
    if (ajUser && ajUser.token) headers['Authorization'] = `Bearer ${ajUser.token}`;
    return headers;
  }

  async function batchLookup(items) {
    const cleanItems = (items || []).filter((it) => it && (it.issn || it.name)).slice(0, 100);
    if (!cleanItems.length) return [];

    const local = storageArea('local');
    const now = Date.now();
    const storageKeys = cleanItems.map((it) => CACHE_PREFIX + queryKey(it));
    const cached = await storageGet(local, storageKeys);

    const results = new Array(cleanItems.length).fill(null);
    const misses = [];
    const missPositions = [];
    cleanItems.forEach((it, i) => {
      const hit = cached[storageKeys[i]];
      if (hit && now - hit.ts < CACHE_TTL_MS) results[i] = hit.miss ? null : hit.value;
      else { misses.push(it); missPositions.push(i); }
    });

    if (misses.length) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ items: misses }),
      });
      if (res.status === 429) {
        // 配额用完：标记状态供 popup 提示，本批不写缓存（额度恢复后能重试）
        let info = {};
        try { info = await res.json(); } catch (_) {}
        await storageSet(local, { ajQuotaBlockedAt: now, ajQuotaInfo: info });
        const e = new Error(info.error || 'lookup quota exceeded');
        e.code = 'lookup_quota';
        throw e;
      }
      if (!res.ok) throw new Error(`AILatest lookup failed: ${res.status}`);
      const data = await res.json();
      const remote = Array.isArray(data.results) ? data.results : [];
      const updates = {};
      missPositions.forEach((pos, ri) => {
        const value = remote[ri] || null;
        results[pos] = value;
        updates[storageKeys[pos]] = value ? { ts: now, value } : { ts: now, miss: true };
      });
      updates.ajQuotaBlockedAt = 0; // 成功即清除配额拦截标记
      await storageSet(local, updates);
    }
    return results;
  }

  ns.lookup = { batchLookup, getSettings, setSettings, queryKey, apiUrl: API_URL };
})(globalThis);
