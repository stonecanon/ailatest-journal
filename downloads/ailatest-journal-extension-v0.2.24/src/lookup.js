(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  const API_URL = 'https://api.ailatest.org/ext/lookup';
  const HEARTBEAT_URL = 'https://api.ailatest.org/ext/heartbeat';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = 'lookup:v5:';
  const HEARTBEAT_DAY_KEY = 'ajUsageHeartbeatDay';

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
  function productTier(user) {
    if (!user) return 'free';
    if (user.is_owner || user.plan === 'owner') return 'pro';
    const tier = String(user.entitlements?.tier || user.tier || user.plan || 'free').toLowerCase();
    if (tier === 'pro' || tier === 'max') return 'pro';
    if (tier === 'plus' || tier === 'trial') return 'plus';
    return 'free';
  }

  function tierAllowsPublishFee(user) {
    return productTier(user) !== 'free';
  }

  function tierAllowsWorkflow(user) {
    // 收藏导出 / Zotero·Notion·Obsidian — Pro+
    return productTier(user) !== 'free';
  }

  const FREE_FULLTEXT_LIMIT = 30;
  const FULLTEXT_KEY = 'ajFulltextUsage';

  async function getFulltextUsage() {
    const local = storageArea('local');
    const st = await storageGet(local, [FULLTEXT_KEY]);
    const raw = st[FULLTEXT_KEY] || {};
    const keys = Array.isArray(raw.keys) ? raw.keys.map(String) : [];
    return { keys };
  }

  async function saveFulltextUsage(u) {
    const local = storageArea('local');
    await storageSet(local, { [FULLTEXT_KEY]: { keys: (u.keys || []).slice(0, 500) } });
  }

  async function checkFulltextQuota(articleKey) {
    const local = storageArea('local');
    const { ajUser } = await storageGet(local, ['ajUser']);
    if (productTier(ajUser) !== 'free') {
      return { ok: true, unlimited: true, limit: null, used: 0, remaining: null };
    }
    const u = await getFulltextUsage();
    if (articleKey && u.keys.includes(articleKey)) {
      return {
        ok: true,
        unlimited: false,
        limit: FREE_FULLTEXT_LIMIT,
        used: u.keys.length,
        remaining: Math.max(0, FREE_FULLTEXT_LIMIT - u.keys.length),
      };
    }
    if (u.keys.length >= FREE_FULLTEXT_LIMIT) {
      return {
        ok: false,
        unlimited: false,
        limit: FREE_FULLTEXT_LIMIT,
        used: u.keys.length,
        remaining: 0,
      };
    }
    return {
      ok: true,
      unlimited: false,
      limit: FREE_FULLTEXT_LIMIT,
      used: u.keys.length,
      remaining: FREE_FULLTEXT_LIMIT - u.keys.length,
    };
  }

  async function consumeFulltextQuota(articleKey) {
    const gate = await checkFulltextQuota(articleKey);
    if (!gate.ok) return gate;
    if (gate.unlimited || !articleKey) return gate;
    const u = await getFulltextUsage();
    if (!u.keys.includes(articleKey)) {
      u.keys.push(articleKey);
      await saveFulltextUsage(u);
    }
    return {
      ok: true,
      unlimited: false,
      limit: FREE_FULLTEXT_LIMIT,
      used: u.keys.length,
      remaining: Math.max(0, FREE_FULLTEXT_LIMIT - u.keys.length),
    };
  }

  async function getSettings() {
    const sync = storageArea('sync');
    const local = storageArea('local');
    const saved = await storageGet(sync, ['ajSettings', ...Object.keys(DEFAULT_SETTINGS)]);
    const { ajUser } = await storageGet(local, ['ajUser']);
    // 兼容两种存法：整对象 ajSettings（popup 新版）或扁平键（旧版）
    const obj = saved.ajSettings && typeof saved.ajSettings === 'object' ? saved.ajSettings : saved;
    return {
      ...DEFAULT_SETTINGS,
      ...obj,
      colors: { ...(obj.colors || {}) },
      allowPublishFee: tierAllowsPublishFee(ajUser),
      allowWorkflow: tierAllowsWorkflow(ajUser),
      productTier: productTier(ajUser),
    };
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

  // Once per UTC day, record that this installed extension was opened.  The
  // server stores only an anonymised scope and aggregate counters; no page
  // contents, email, or raw IP is sent by this heartbeat.
  async function maybeHeartbeat() {
    const local = storageArea('local');
    if (!local) return;
    const day = new Date().toISOString().slice(0, 10);
    const state = await storageGet(local, [HEARTBEAT_DAY_KEY]);
    if (state[HEARTBEAT_DAY_KEY] === day) return;
    // Mark before the network request so multiple content-script frames do
    // not produce duplicate daily heartbeats for the same installation.
    await storageSet(local, { [HEARTBEAT_DAY_KEY]: day });
    try {
      await fetch(HEARTBEAT_URL, {
        method: 'POST',
        headers: await authHeaders(),
        body: '{}',
        cache: 'no-store',
      });
    } catch (_) {
      // Usage telemetry must never interrupt journal badge rendering.
    }
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

  ns.lookup = {
    batchLookup,
    heartbeat: maybeHeartbeat,
    getSettings,
    setSettings,
    queryKey,
    apiUrl: API_URL,
    productTier,
    tierAllowsWorkflow,
    checkFulltextQuota,
    consumeFulltextQuota,
    FREE_FULLTEXT_LIMIT,
  };
  // Telemetry is deliberately deferred so it never competes with the first
  // journal lookup on a newly opened page.
  setTimeout(() => { void maybeHeartbeat(); }, 5000);
})(globalThis);
