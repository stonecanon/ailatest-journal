/**
 * Rank landing pages: simple zh/en toggle for data-zh / data-en nodes.
 */
(() => {
  const KEY = "ailatest.lang";

  function isEn() {
    try {
      const s = localStorage.getItem(KEY) || "";
      if (/^en/i.test(s)) return true;
      if (/^zh/i.test(s)) return false;
    } catch (_) {}
    return (document.documentElement.lang || "").toLowerCase().startsWith("en");
  }

  function apply(en) {
    document.documentElement.lang = en ? "en" : "zh-CN";
    document.documentElement.setAttribute("data-ui-lang", en ? "en" : "zh-CN");
    document.querySelectorAll("[data-zh][data-en]").forEach((el) => {
      const t = en ? el.getAttribute("data-en") : el.getAttribute("data-zh");
      if (t != null && t !== "") el.textContent = t;
    });
    const btn = document.getElementById("rl-lang");
    if (btn) btn.textContent = en ? "中文" : "English";
    window.dispatchEvent(new CustomEvent('ailatest:langchange', { detail: { lang: en ? 'en' : 'zh-CN' } }));
  }

  function boot() {
    apply(isEn());
    document.getElementById("rl-lang")?.addEventListener("click", () => {
      const next = !isEn();
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
