// journal.ailatest.org 登录态桥接：网站登录（含 GitHub/Google OAuth）后，
// 把 localStorage 的 ailatest.user 同步到 chrome.storage.local.ajUser，
// 供 popup 显示与 /ext/lookup 的服务端验证（更高查询额度）使用。单向：网站→插件。

(function () {
  let lastToken = null;

  function syncPublicationImport() {
    if (!/\/publication-footprint\/?$/i.test(location.pathname)) return;
    chrome.storage.local.get(['ajPublicationScholarImport', 'ajPublicationScholarImportAt'], (state) => {
      const payload = state && state.ajPublicationScholarImport;
      const importedAt = Number(state && state.ajPublicationScholarImportAt || 0);
      if (!payload || !importedAt || Date.now() - importedAt > 7 * 24 * 3600 * 1000) return;
      window.postMessage({
        source: 'ailatest-extension',
        type: 'publication-scholar-import',
        payload,
      }, '*');
    });
  }

  function syncSubmissionImport() {
    if (!/\/publication-footprint\/?$/i.test(location.pathname)) return;
    chrome.storage.local.get(['ajSubmissionSync', 'ajSubmissionSyncAt'], (state) => {
      const payload = state && state.ajSubmissionSync;
      const syncedAt = Number(state && state.ajSubmissionSyncAt || payload && payload.syncedAt || 0);
      if (!payload || !syncedAt || Date.now() - syncedAt > 7 * 24 * 3600 * 1000) return;
      window.postMessage({
        source: 'ailatest-extension',
        type: 'publication-submissions-sync',
        payload,
      }, '*');
    });
  }

  async function sync() {
    let u = null;
    try { u = JSON.parse(localStorage.getItem('ailatest.user') || 'null'); } catch (_) {}
    if (!u || !u.token || u.token === lastToken) return;
    lastToken = u.token;
    try {
      const { ajUser } = await chrome.storage.local.get('ajUser');
      if (ajUser && ajUser.token === u.token) return;
      await chrome.storage.local.set({ ajUser: u });
    } catch (_) { /* 扩展上下文失效时静默 */ }
  }

  sync();
  syncPublicationImport();
  syncSubmissionImport();
  // signup 页是本标签页写 localStorage，storage 事件不触发，轮询兜底（10 分钟后停）
  const timer = setInterval(sync, 1500);
  setTimeout(() => clearInterval(timer), 10 * 60 * 1000);
  window.addEventListener('storage', (e) => { if (e.key === 'ailatest.user') sync(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.ajPublicationScholarImport || changes.ajPublicationScholarImportAt) syncPublicationImport();
      if (changes.ajSubmissionSync || changes.ajSubmissionSyncAt) syncSubmissionImport();
    }
  });
})();
