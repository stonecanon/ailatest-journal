/**
 * Rank landing pages: simple zh/en toggle for data-zh / data-en nodes.
 */
(() => {
  const KEY = "ailatest.lang";

  function isEn() {
    const geo = window.__ailatestGeoLangState;
    if (geo?.ready && geo.known) return geo.lang !== 'zh-CN';
    // Until the IP probe resolves, keep the public default English. This
    // prevents an old Chinese localStorage value from leaking to global users.
    if (location.hostname && !/^(localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(location.hostname)) return true;
    try {
      const s = localStorage.getItem(KEY) || "";
      if (/^en/i.test(s)) return true;
      if (/^zh/i.test(s)) return false;
    } catch (_) {}
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
      if (!state?.known || window.__journalLangManualSession) return;
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
