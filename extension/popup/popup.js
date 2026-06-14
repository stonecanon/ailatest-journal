(async function () {
  'use strict';

  const ns = globalThis.AILatestExt;
  const API = 'https://api.ailatest.org';
  const DEFAULT_COLORS = { cas: '#735a3e', jcr: '#735a3e', if: '#735a3e', idx: '#1f3a5f' };
  const $ = (id) => document.getElementById(id);

  // ── 账号 ───────────────────────────────────────────────
  function renderUser(ajUser) {
    const on = !!(ajUser && ajUser.token);
    $('logged-in').hidden = !on;
    $('logged-out').hidden = on;
    if (on) $('user-label').textContent = ajUser.name || ajUser.email || ajUser.login || '已登录';
  }

  async function readJson(resp, fallback) {
    let d = null;
    try { d = await resp.json(); } catch (_) {}
    if (!resp.ok || (d && d.error)) throw new Error((d && d.error) || fallback);
    return d;
  }

  chrome.storage.local.get(['ajUser', 'ajQuotaBlockedAt', 'ajQuotaInfo'], (st) => {
    renderUser(st.ajUser);
    if (st.ajQuotaBlockedAt && Date.now() - st.ajQuotaBlockedAt < 24 * 3600 * 1000 && !(st.ajUser && st.ajUser.token)) {
      const h = $('quota-hint');
      h.hidden = false;
      h.textContent = (st.ajQuotaInfo && st.ajQuotaInfo.error) || '匿名查询额度已用完，登录后可继续显示徽章';
    }
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && c.ajUser) renderUser(c.ajUser.newValue);
  });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('submit-btn');
    const msg = $('login-msg');
    const email = $('email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = '请输入有效邮箱'; msg.className = 'msg err'; return; }
    btn.disabled = true; msg.textContent = ''; msg.className = 'msg';
    try {
      if (btn.dataset.step === 'request') {
        await readJson(await fetch(`${API}/auth/email/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
        }), '发送验证码失败');
        $('email').readOnly = true;
        $('code').hidden = false; $('code').focus();
        btn.dataset.step = 'verify'; btn.textContent = '验证并登录';
        msg.textContent = '验证码已发送，10 分钟内有效'; msg.className = 'msg ok';
      } else {
        const d = await readJson(await fetch(`${API}/auth/email/verify`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: $('code').value.trim() }),
        }), '验证码错误');
        if (!d.token) throw new Error('验证失败：未收到登录凭证');
        await chrome.storage.local.set({ ajUser: { ...(d.user || {}), token: d.token } });
        renderUser({ ...(d.user || {}), token: d.token });
        $('quota-hint').hidden = true;
      }
    } catch (err) {
      msg.textContent = err.message; msg.className = 'msg err';
      if (btn.dataset.step === 'verify' && /请先请求验证码|验证码已过期/.test(err.message || '')) {
        btn.dataset.step = 'request'; btn.textContent = '注册 / 登录';
        $('code').value = ''; $('code').hidden = true; $('email').readOnly = false;
      }
    } finally { btn.disabled = false; }
  });

  $('oauth-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://journal.ailatest.org/signup.html?ext=1' });
  });
  $('logout-btn').addEventListener('click', async () => {
    await chrome.storage.local.remove('ajUser');
    renderUser(null);
  });

  // ── 徽章设置（主题 + 9 开关 + 4 自定义色），存 ajSettings ─────────
  const themeRow = $('theme-row');
  const toggles = $('toggles');
  const colorsBox = $('colors');
  const langSelect = $('lang-select');

  async function loadSettings() {
    const s = await ns.lookup.getSettings();
    if (langSelect) langSelect.value = s.lang || 'auto';
    const theme = ['site', 'light', 'dark'].includes(s.theme) ? s.theme : 'site';
    themeRow.querySelectorAll('input[type=radio]').forEach((r) => { r.checked = r.value === theme; });
    toggles.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = s[cb.dataset.setting] !== false; });
    colorsBox.querySelectorAll('input[type=color]').forEach((ci) => {
      ci.value = (s.colors || {})[ci.dataset.color] || DEFAULT_COLORS[ci.dataset.color];
    });
  }

  async function saveSettings() {
    const next = { theme: 'site', colors: {} };
    next.lang = langSelect?.value || 'auto';
    next.theme = themeRow.querySelector('input[type=radio]:checked')?.value || 'site';
    toggles.querySelectorAll('input[type=checkbox]').forEach((cb) => { next[cb.dataset.setting] = cb.checked; });
    colorsBox.querySelectorAll('input[type=color]').forEach((ci) => {
      if (ci.value.toLowerCase() !== DEFAULT_COLORS[ci.dataset.color]) next.colors[ci.dataset.color] = ci.value;
    });
    await ns.lookup.setSettings(next);
  }

  themeRow.addEventListener('change', saveSettings);
  langSelect?.addEventListener('change', saveSettings);
  toggles.addEventListener('change', saveSettings);
  colorsBox.addEventListener('change', saveSettings);
  $('reset-settings').addEventListener('click', async () => {
    await ns.lookup.setSettings({});
    loadSettings();
  });

  loadSettings();
})();
