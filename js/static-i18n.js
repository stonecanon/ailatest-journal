(() => {
  const STRINGS = {
    'zh-CN': {
      nav_about: '关于',
      nav_home: '首页',
      nav_features: '功能',
      nav_how: '怎么用',
      nav_rank: '榜单',
      download_center: '下载',
      rail_global: '全球',
      rail_china: '中国',
      rail_india: '印度',
      rail_malaysia: '马来西亚',
      rail_korea: '韩国',
      rail_regions: '地区',
      rail_rankings: '榜单',
      rail_saved: '收藏',
      rail_account: '设置',
      nav_pricing: '订阅',
      nav_extension: '插件内测',
      nav_contact: '联系',
      nav_login: '登录',
      footer_about: '关于',
      footer_pricing: '订阅',
      footer_contact: '联系',
      footer_terms: '条款',
      footer_privacy: '隐私',
      footer_refund: '退款',
      footer_download: '下载',
      footer_llms: 'llms.txt',
      lang_toggle: 'English',
      pricing_title: '订阅与定价 | AILatest Journal',
      pricing_desc: 'AILatest Journal 订阅：Free / Pro / Max。网站查刊永久开放；Pro 提升插件能力与额度；Max 含高额度 AI 荐刊与完整文献工作流。',
      extension_title: '下载 | AILatest Journal',
      extension_desc: 'AILatest Journal 下载：浏览器插件、Skill、MCP 与后续移动端入口。',
      about_title: '关于我们 | AILatest Journal',
      about_desc: 'AILatest Journal 数据来源与更新时间：WoS、JCR、中科院分区、EI、Scopus、DOAJ、OpenAlex 等公开评级与元数据汇总说明。',
      contact_title: '联系我们 | AILatest Journal',
      contact_desc: '联系 AILatest Journal：产品反馈、数据纠错、商务合作与媒体联系。',
      terms_title: '使用条款 | AILatest Journal',
      privacy_title: '隐私政策 | AILatest Journal',
      refund_title: '退款政策 | AILatest Journal',
      signup_title: '登录 | AILatest Journal'
    },
    en: {
      nav_about: 'About',
      nav_home: 'Home',
      nav_features: 'Features',
      nav_how: 'How it works',
      nav_rank: 'Rankings',
      download_center: 'Download',
      rail_global: 'Global',
      rail_china: 'China',
      rail_india: 'India',
      rail_malaysia: 'Malaysia',
      rail_korea: 'Korea',
      rail_regions: 'Regions',
      rail_rankings: 'Rankings',
      rail_saved: 'Saved',
      rail_account: 'Settings',
      nav_pricing: 'Pricing',
      nav_extension: 'Extension',
      nav_contact: 'Contact',
      nav_login: 'Sign in',
      footer_about: 'About',
      footer_pricing: 'Pricing',
      footer_contact: 'Contact',
      footer_terms: 'Terms',
      footer_privacy: 'Privacy',
      footer_refund: 'Refund',
      footer_download: 'Download',
      footer_llms: 'llms.txt',
      lang_toggle: '中文',
      pricing_title: 'Plans & Pricing | AILatest Journal',
      pricing_desc: 'AILatest Journal plans: Free / Pro / Max. Full website search forever free; Pro upgrades extension power and quotas; Max adds high-quota AI picks and full research workflow.',
      extension_title: 'Downloads | AILatest Journal',
      extension_desc: 'AILatest Journal downloads: browser extension, Skill, MCP and future mobile apps.',
      about_title: 'About | AILatest Journal',
      about_desc: 'AILatest Journal data sources and cutoffs: WoS, JCR, CAS zones, EI, Scopus, DOAJ, OpenAlex and more.',
      contact_title: 'Contact | AILatest Journal',
      contact_desc: 'Contact AILatest Journal for product feedback, data corrections, business and media.',
      terms_title: 'Terms | AILatest Journal',
      privacy_title: 'Privacy | AILatest Journal',
      refund_title: 'Refund | AILatest Journal',
      signup_title: 'Sign in | AILatest Journal'
    }
  };

  function normalize(code) {
    const value = String(code || '').trim().toLowerCase();
    if (!value) return 'en';
    if (value === 'zh' || value.startsWith('zh-cn') || value.startsWith('zh-hans')) return 'zh-CN';
    if (value.startsWith('zh-tw') || value.startsWith('zh-hk') || value.startsWith('zh-mo') || value.startsWith('zh-hant')) {
      return 'zh-CN'; // 静态页暂仅中/英，繁中回落简中
    }
    if (value.startsWith('zh')) return 'zh-CN';
    return 'en';
  }

  function detectBrowserLang() {
    const list = [];
    try {
      if (Array.isArray(navigator.languages)) list.push(...navigator.languages);
    } catch (_) {}
    try {
      if (navigator.language) list.push(navigator.language);
    } catch (_) {}
    for (const item of list) {
      const n = normalize(item);
      if (n) return n;
    }
    return 'en';
  }

  // IP 只负责没有本地语言信号时的默认值：CN = 简体中文，其他国家/地区 = English。
  // 用户明确选择、URL 语言入口，以及中文浏览器首选语言均优先于 IP。
  function probeGeoLanguage() {
    const existing = window.__ailatestGeoLangState;
    if (existing?.promise) return existing.promise;
    const state = { ready: false, known: false, country: '', lang: '' };
    state.promise = fetch('/geo', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const country = String(payload?.country || '').trim().toUpperCase();
        state.country = /^[A-Z]{2}$/.test(country) ? country : '';
        state.known = !!state.country;
        state.lang = state.country === 'CN' ? 'zh-CN' : 'en';
        state.ready = true;
        return state;
      })
      .catch(() => {
        state.ready = true;
        state.known = false;
        state.lang = '';
        return state;
      });
    window.__ailatestGeoLangState = state;
    return state.promise;
  }

  function synchronousGeoLanguage() {
    const state = window.__ailatestGeoLangState;
    return state?.ready && state.known ? state.lang : '';
  }

  function storedManualLanguage() {
    try {
      if (localStorage.getItem('ailatest.lang.userSet') !== '1') return '';
      const saved = localStorage.getItem('ailatest.lang');
      return saved ? normalize(saved) : '';
    } catch (_) {
      return '';
    }
  }

  function initialLang() {
    let localLang = '';
    let hasLocalPreference = false;
    try {
      const queryLang = new URLSearchParams(location.search).get('lang');
      if (queryLang) {
        localLang = normalize(queryLang);
        hasLocalPreference = true;
      }
    } catch (_) {}
    if (!localLang) {
      const path = location.pathname.replace(/\/+$/, '') || '/';
      if (path === '/zh' || path.startsWith('/zh/')) {
        localLang = 'zh-CN';
        hasLocalPreference = true;
      } else if (path === '/en' || path.startsWith('/en/')) {
        localLang = 'en';
        hasLocalPreference = true;
      }
    }
    if (!localLang) {
      localLang = storedManualLanguage();
      hasLocalPreference = !!localLang;
    }
    if (!localLang) {
      const browserLang = detectBrowserLang();
      if (browserLang === 'zh-CN') {
        localLang = browserLang;
        hasLocalPreference = true;
      } else {
        localLang = synchronousGeoLanguage() || browserLang;
      }
    }
    if (hasLocalPreference) window.__journalLangLocalPreference = true;
    return localLang || 'en';
  }

  /** 页脚已下线：移除静态页 footer 节点 */
  function applyUnifiedFooter() {
    document.querySelectorAll('footer.page-foot, footer.site-foot').forEach((foot) => {
      foot.remove();
    });
  }

  /** 顶栏当前页高亮：about/contact/pricing/download/… */
  function markActiveNav() {
    const page = String(document.body?.dataset?.staticPage || '').toLowerCase();
    const path = (location.pathname || '').replace(/\/+$/, '').toLowerCase() || '/';
    let key = page;
    if (!key) {
      if (path.endsWith('/about') || path.endsWith('/about.html')) key = 'about';
      else if (path.endsWith('/contact') || path.endsWith('/contact.html')) key = 'contact';
      else if (path.includes('pricing')) key = 'pricing';
      else if (path.includes('extension')) key = 'download';
      else if (path.includes('signup') || path.includes('login')) key = 'signup';
      else if (path.includes('terms')) key = 'terms';
      else if (path.includes('privacy')) key = 'privacy';
      else if (path.includes('refund')) key = 'refund';
    }
    // 条款 / 隐私 / 退款归在「关于」产品信息下高亮
    const navKey = (key === 'terms' || key === 'privacy' || key === 'refund') ? 'about' : key;
    const map = {
      about: 'about',
      contact: 'contact',
      pricing: 'pricing',
      download: 'download',
      extension: 'download',
      signup: 'home',
    };
    const active = map[navKey] || navKey;
    document.querySelectorAll('.page-head [data-nav], .pricing-head [data-nav], .pricing-route .home-top-nav [data-nav]').forEach((a) => {
      const on = a.getAttribute('data-nav') === active;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function applyLang(lang) {
    const dict = STRINGS[lang] || STRINGS.en;
    document.documentElement.lang = lang;
    document.documentElement.dataset.staticLang = lang;
    document.documentElement.setAttribute('data-ui-lang', lang);
    try {
      window.__journalUiLang = lang;
      window.__getJournalUiLang = () => lang;
    } catch (_) {}
    try { localStorage.setItem('ailatest.lang', lang); } catch {}

    applyUnifiedFooter();

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
    syncStaticAuth(lang);
    markActiveNav();
    // 订阅页等：语言切换后重刷年/月付与教育价文案
    try {
      if (typeof window.__syncPricingUi === 'function') window.__syncPricingUi();
      else if (typeof window.__syncEduCheckoutUi === 'function') window.__syncEduCheckoutUi();
      window.dispatchEvent(new CustomEvent('ailatest:langchange', { detail: { lang } }));
    } catch (_) {}
  }

  function readStaticUser() {
    try {
      const user = JSON.parse(localStorage.getItem('ailatest.user') || 'null');
      return user && (user.token || user.email || user.name || user.login) ? user : null;
    } catch {
      return null;
    }
  }

  function staticUserName(user) {
    return user.name || user.login || user.email || '我的';
  }

  function syncStaticAuth(lang) {
    const dict = STRINGS[lang] || STRINGS.en;
    const el = document.querySelector('[data-static-i18n="nav_login"].cta');
    if (!el) return;
    const user = readStaticUser();
    if (user) {
      el.textContent = staticUserName(user);
      el.href = '/account';
      el.title = user.email || staticUserName(user);
    } else {
      el.textContent = dict.nav_login;
      el.href = '/signup.html';
      el.removeAttribute('title');
    }
  }

  function bind() {
    let lang = initialLang();
    applyLang(lang);
    probeGeoLanguage().then((state) => {
      if (!state?.known || window.__journalLangManualSession || window.__journalLangLocalPreference) return;
      if (state.lang !== lang) {
        lang = state.lang;
        applyLang(lang);
      }
    });
    document.querySelector('[data-static-lang-toggle]')?.addEventListener('click', () => {
      lang = lang === 'zh-CN' ? 'en' : 'zh-CN';
      window.__journalLangManualSession = true;
      window.__journalLangLocalPreference = true;
      try { localStorage.setItem('ailatest.lang.userSet', '1'); } catch (_) {}
      applyLang(lang);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
