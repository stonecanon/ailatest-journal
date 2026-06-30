(() => {
  const API = '/api/extension';
  const DEFAULT_ASSET = 'latest';

  function storageId(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        const bytes = new Uint32Array(2);
        crypto.getRandomValues(bytes);
        value = (crypto.randomUUID && crypto.randomUUID())
          || `id_${Date.now().toString(36)}_${bytes[0].toString(36)}${bytes[1].toString(36)}`;
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return '';
    }
  }

  function formatCount(value) {
    const n = Number(value || 0);
    const lang = document.documentElement.dataset.staticLang || document.documentElement.lang || navigator.language || 'zh-CN';
    return new Intl.NumberFormat(lang).format(n);
  }

  function setCount(asset, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    document.querySelectorAll(`[data-extension-download-count="${asset}"]`).forEach((el) => {
      el.textContent = formatCount(n);
    });
  }

  async function loadCount(asset = DEFAULT_ASSET) {
    const res = await fetch(`${API}/download-stats?asset=${encodeURIComponent(asset)}&t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`download stats ${res.status}`);
    const data = await res.json();
    setCount(asset, data.total);
  }

  function visibleAssets() {
    const assets = new Set();
    document.querySelectorAll('[data-extension-download-count]').forEach((el) => {
      assets.add(el.dataset.extensionDownloadCount || DEFAULT_ASSET);
    });
    return [...assets];
  }

  function decorateDownloadLinks() {
    const visitorId = storageId(localStorage, 'ailatest.visitor_id');
    const sessionId = storageId(sessionStorage, 'ailatest.session_id');
    document.querySelectorAll('[data-extension-download-link]').forEach((link) => {
      const url = new URL(link.getAttribute('href'), location.origin);
      if (visitorId) url.searchParams.set('visitor_id', visitorId);
      if (sessionId) url.searchParams.set('session_id', sessionId);
      link.href = url.pathname + url.search;
      link.addEventListener('click', () => {
        const asset = url.searchParams.get('asset') || DEFAULT_ASSET;
        window.setTimeout(() => loadCount(asset).catch(() => null), 1200);
        window.setTimeout(() => loadCount(asset).catch(() => null), 3500);
      });
    });
  }

  function boot() {
    decorateDownloadLinks();
    const refresh = () => visibleAssets().forEach(asset => loadCount(asset).catch(() => null));
    refresh();
    window.setInterval(refresh, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
