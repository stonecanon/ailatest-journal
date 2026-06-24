(() => {
  const STRINGS = {
    'zh-CN': {
      nav_about: '关于',
      nav_pricing: '订阅',
      nav_extension: '插件内测',
      nav_contact: '联系',
      nav_login: '注册 / 登录',
      footer_about: '关于',
      footer_pricing: '订阅',
      footer_contact: '联系',
      lang_toggle: 'English',
      pricing_title: '订阅即将开放 | AILatest Journal',
      pricing_desc: 'AILatest Journal 订阅功能即将开放。当前主推浏览器插件内测版，可在 Google Scholar、PubMed、知网等页面显示期刊徽章。',
      extension_title: '浏览器插件内测版下载 | AILatest Journal',
      extension_desc: '下载 AILatest Journal 浏览器插件内测版，在 Google Scholar、PubMed、知网等页面试用期刊影响因子、中科院分区、JCR 分区和收录评级徽章。'
    },
    en: {
      nav_about: 'About',
      nav_pricing: 'Subscribe',
      nav_extension: 'Extension beta',
      nav_contact: 'Contact',
      nav_login: 'Sign in',
      footer_about: 'About',
      footer_pricing: 'Subscribe',
      footer_contact: 'Contact',
      lang_toggle: '中文',
      pricing_title: 'Subscription Coming Soon | AILatest Journal',
      pricing_desc: 'AILatest Journal subscription is coming soon. For now, try the browser extension beta for journal badges on Google Scholar, PubMed, CNKI and more.',
      extension_title: 'Browser Extension Beta Download | AILatest Journal',
      extension_desc: 'Download the AILatest Journal browser extension beta to show IF, CAS tiers, JCR quartiles, indexed databases and domestic ranking badges on Google Scholar, PubMed, CNKI and more.'
    }
  };

  function normalize(code) {
    const value = String(code || '').toLowerCase();
    return value.startsWith('zh') ? 'zh-CN' : 'en';
  }

  function initialLang() {
    const params = new URLSearchParams(location.search);
    const queryLang = params.get('lang');
    if (queryLang) return normalize(queryLang);
    try {
      const saved = localStorage.getItem('ailatest.lang');
      if (saved) return normalize(saved);
    } catch {}
    return normalize(navigator.language || 'en');
  }

  function applyLang(lang) {
    const dict = STRINGS[lang] || STRINGS.en;
    document.documentElement.lang = lang;
    document.documentElement.dataset.staticLang = lang;
    try { localStorage.setItem('ailatest.lang', lang); } catch {}

    document.querySelectorAll('[data-static-i18n]').forEach((el) => {
      const key = el.dataset.staticI18n;
      if (dict[key]) el.textContent = dict[key];
    });

    const page = document.body?.dataset.staticPage;
    if (page) {
      const title = dict[`${page}_title`];
      const desc = dict[`${page}_desc`];
      if (title) document.title = title;
      if (desc) {
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', desc);
      }
    }

    const toggle = document.querySelector('[data-static-lang-toggle]');
    if (toggle) {
      toggle.textContent = dict.lang_toggle;
      toggle.setAttribute('aria-label', lang === 'zh-CN' ? 'Switch to English' : '切换到中文');
    }
  }

  function bind() {
    let lang = initialLang();
    applyLang(lang);
    document.querySelector('[data-static-lang-toggle]')?.addEventListener('click', () => {
      lang = lang === 'zh-CN' ? 'en' : 'zh-CN';
      applyLang(lang);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
