// journal.ailatest.org 登录态桥接：网站登录（含 GitHub/Google OAuth）后，
// 把 localStorage 的 ailatest.user 同步到 chrome.storage.local.ajUser，
// 供 popup 显示与 /ext/lookup 的服务端验证（更高查询额度）使用。单向：网站→插件。

(function () {
  let lastToken = null;

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
  // signup 页是本标签页写 localStorage，storage 事件不触发，轮询兜底（10 分钟后停）
  const timer = setInterval(sync, 1500);
  setTimeout(() => clearInterval(timer), 10 * 60 * 1000);
  window.addEventListener('storage', (e) => { if (e.key === 'ailatest.user') sync(); });
})();
