/**
 * Rank landing pages: simple zh/en toggle for data-zh / data-en nodes.
 */
(() => {
  const KEY = "ailatest.lang";

  function localLanguagePreference() {
    try {
      const query = new URLSearchParams(location.search).get('lang');
      if (query) return /^zh(?:-|$)/i.test(query) ? 'zh-CN' : 'en';
      const path = (location.pathname || '').replace(/\/+$/, '') || '/';
      if (path === '/zh' || path.startsWith('/zh/')) return 'zh-CN';
      if (path === '/en' || path.startsWith('/en/')) return 'en';
      if (localStorage.getItem('ailatest.lang.userSet') === '1') {
        const saved = localStorage.getItem(KEY) || '';
        if (saved) return /^zh/i.test(saved) ? 'zh-CN' : 'en';
      }
      const list = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
      const primary = list.find((item) => String(item || '').trim());
      if (/^zh(?:-|$)/i.test(String(primary || ''))) return 'zh-CN';
    } catch (_) {}
    return '';
  }

  function isEn() {
    const local = localLanguagePreference();
    if (local) {
      window.__journalLangLocalPreference = true;
      return local !== 'zh-CN';
    }
    const geo = window.__ailatestGeoLangState;
    if (geo?.ready && geo.known) return geo.lang !== 'zh-CN';
    return (document.documentElement.lang || "").toLowerCase().startsWith("en");
  }

  function apply(en, notify = true) {
    document.documentElement.lang = en ? "en" : "zh-CN";
    document.documentElement.setAttribute("data-ui-lang", en ? "en" : "zh-CN");
    document.querySelectorAll("[data-zh][data-en]").forEach((el) => {
      const t = en ? el.getAttribute("data-en") : el.getAttribute("data-zh");
      if (t != null && t !== "") el.textContent = t;
    });
    const btn = document.getElementById("rl-lang");
    if (btn) btn.textContent = en ? "中文" : "English";
    if (notify) window.dispatchEvent(new CustomEvent('ailatest:langchange', { detail: { lang: en ? 'en' : 'zh-CN' } }));
  }

  function boot() {
    apply(isEn());
    window.__ailatestGeoLangState?.promise?.then((state) => {
      if (!state?.known || window.__journalLangManualSession || window.__journalLangLocalPreference) return;
      apply(state.lang !== 'zh-CN', false);
    });
    window.addEventListener('ailatest:langchange', (event) => {
      if (window.__journalLangManualSession) return;
      const next = event.detail?.lang;
      if (next === 'en' || next === 'zh-CN') apply(next === 'en', false);
    });
    document.getElementById("rl-lang")?.addEventListener("click", () => {
      const next = !isEn();
      window.__journalLangManualSession = true;
      try {
        localStorage.setItem(KEY, next ? "en" : "zh-CN");
        localStorage.setItem("ailatest.lang.userSet", "1");
      } catch (_) {}
      apply(next);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
