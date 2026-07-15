(() => {
  const STRINGS = {
    'zh-CN': {
      nav_about: '关于',
      nav_home: '首页',
      download_center: '下载中心',
      rail_global: '全球',
      rail_china: '中国',
      rail_india: '印度',
      rail_malaysia: '马来西亚',
      rail_korea: '韩国',
      rail_regions: '地区',
      rail_rankings: '榜单',
      rail_saved: '收藏',
      rail_account: '我的',
      nav_pricing: '订阅',
      nav_extension: '插件内测',
      nav_contact: '联系',
      nav_login: '注册 / 登录',
      footer_tag: '期刊检索 · 分区评级 · 投稿决策',
      footer_product: '产品',
      footer_support: '支持',
      footer_legal: '条款',
      footer_about: '关于',
      footer_pricing: '订阅',
      footer_contact: '联系',
      footer_matrix: '联系矩阵',
      footer_ailatest: '关于 AILatest',
      footer_terms: '使用条款',
      footer_privacy: '隐私政策',
      footer_refund: '退款政策',
      footer_download: '下载中心',
      footer_global: '全球',
      footer_china: '中国',
      footer_rankings: '榜单',
      lang_toggle: 'English',
      pricing_title: '订阅即将开放 | AILatest Journal',
      pricing_desc: 'AILatest Journal 订阅功能即将开放。当前主推浏览器插件内测版，可在 Google Scholar、PubMed、知网等页面显示期刊徽章。',
      extension_title: '下载中心 | AILatest Journal',
      extension_desc: 'AILatest Journal 下载中心，提供浏览器插件内测版、Skill、MCP 服务和后续移动端入口。',
      about_title: '关于我们 | AILatest Journal',
      about_desc: 'AILatest Journal 数据来源与更新时间：WoS、JCR、中科院分区、EI、Scopus、DOAJ、OpenAlex 等公开评级与元数据汇总说明。',
      contact_title: '联系我们 | AILatest Journal',
      contact_desc: '联系 AILatest Journal：产品反馈、数据纠错、商务合作与媒体联系。'
    },
    en: {
      nav_about: 'About',
      nav_home: 'Home',
      download_center: 'Download Center',
      rail_global: 'Global',
      rail_china: 'China',
      rail_india: 'India',
      rail_malaysia: 'Malaysia',
      rail_korea: 'Korea',
      rail_regions: 'Regions',
      rail_rankings: 'Rankings',
      rail_saved: 'Saved',
      rail_account: 'Account',
      nav_pricing: 'Subscribe',
      nav_extension: 'Extension beta',
      nav_contact: 'Contact',
      nav_login: 'Sign in',
      footer_tag: 'Search · rankings · submission decisions',
      footer_product: 'Product',
      footer_support: 'Support',
      footer_legal: 'Legal',
      footer_about: 'About',
      footer_pricing: 'Subscribe',
      footer_contact: 'Contact',
      footer_matrix: 'Contact matrix',
      footer_ailatest: 'About AILatest',
      footer_terms: 'Terms',
      footer_privacy: 'Privacy',
      footer_refund: 'Refund',
      footer_download: 'Download Center',
      footer_global: 'Global',
      footer_china: 'China',
      footer_rankings: 'Rankings',
      lang_toggle: '中文',
      pricing_title: 'Subscription Coming Soon | AILatest Journal',
      pricing_desc: 'AILatest Journal subscription is coming soon. For now, try the browser extension beta for journal badges on Google Scholar, PubMed, CNKI and more.',
      extension_title: 'Download Center | AILatest Journal',
      extension_desc: 'AILatest Journal Download Center for the browser extension beta, Skill, MCP service and future mobile entries.',
      about_title: 'About | AILatest Journal',
      about_desc: 'AILatest Journal data sources and cutoffs: WoS, JCR, CAS zones, EI, Scopus, DOAJ, OpenAlex and more.',
      contact_title: 'Contact | AILatest Journal',
      contact_desc: 'Contact AILatest Journal for product feedback, data corrections, business and media.'
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

  /** 全站静态页统一页脚（对齐 Todo 落地页：品牌 + 产品 / 支持 / 条款 + 底栏） */
  function unifiedFooterHtml(dict) {
    return `
    <div class="site-foot-grid">
      <div class="site-foot-brand">
        <a class="site-foot-logo" href="/" aria-label="AILatest Journal">
          <img class="site-foot-mark" src="/icons/favicon-32.png" width="22" height="22" alt="" decoding="async" />
          <span class="site-foot-name">AILatest <em>Journal</em></span>
        </a>
        <p data-static-i18n="footer_tag">${dict.footer_tag}</p>
      </div>
      <div class="site-foot-col">
        <h4 data-static-i18n="footer_product">${dict.footer_product}</h4>
        <a href="/global" data-static-i18n="footer_global">${dict.footer_global}</a>
        <a href="/cn" data-static-i18n="footer_china">${dict.footer_china}</a>
        <a href="/rankings/" data-static-i18n="footer_rankings">${dict.footer_rankings}</a>
        <a href="/extension.html" data-static-i18n="footer_download">${dict.footer_download}</a>
        <a href="/about" data-static-i18n="footer_about">${dict.footer_about}</a>
      </div>
      <div class="site-foot-col">
        <h4 data-static-i18n="footer_support">${dict.footer_support}</h4>
        <a href="/contact" data-static-i18n="footer_contact">${dict.footer_contact}</a>
        <a href="https://ailatest.org/connect.html" target="_blank" rel="noopener noreferrer" data-static-i18n="footer_matrix">${dict.footer_matrix}</a>
        <a href="mailto:contact@ailatest.org">contact@ailatest.org</a>
        <a href="https://ailatest.org" target="_blank" rel="noopener noreferrer" data-static-i18n="footer_ailatest">${dict.footer_ailatest}</a>
      </div>
      <div class="site-foot-col">
        <h4 data-static-i18n="footer_legal">${dict.footer_legal}</h4>
        <a href="/privacy" data-static-i18n="footer_privacy">${dict.footer_privacy}</a>
        <a href="/terms" data-static-i18n="footer_terms">${dict.footer_terms}</a>
        <a href="/refund" data-static-i18n="footer_refund">${dict.footer_refund}</a>
      </div>
    </div>
    <div class="site-foot-bottom">
      <a class="site-foot-copy" href="https://ailatest.org" target="_blank" rel="noopener noreferrer" title="AILatest">© 2026 AILatest</a>
      <div class="site-foot-quick">
        <a href="/extension.html" data-static-i18n="footer_download">${dict.footer_download}</a>
        <a href="/contact" data-static-i18n="footer_contact">${dict.footer_contact}</a>
        <a href="https://ailatest.org/connect.html" target="_blank" rel="noopener noreferrer" data-static-i18n="footer_matrix">${dict.footer_matrix}</a>
        <a href="/privacy" data-static-i18n="footer_privacy">${dict.footer_privacy}</a>
        <a href="/terms" data-static-i18n="footer_terms">${dict.footer_terms}</a>
      </div>
    </div>`;
  }

  function applyUnifiedFooter(lang) {
    const dict = STRINGS[lang] || STRINGS.en;
    document.querySelectorAll('footer.page-foot').forEach((foot) => {
      foot.innerHTML = unifiedFooterHtml(dict);
    });
  }

  function applyLang(lang) {
    const dict = STRINGS[lang] || STRINGS.en;
    document.documentElement.lang = lang;
    document.documentElement.dataset.staticLang = lang;
    try { localStorage.setItem('ailatest.lang', lang); } catch {}

    // 先统一页脚结构，再跑 i18n 文本（页脚内节点会被重建）
    applyUnifiedFooter(lang);

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
    document.querySelector('[data-static-lang-toggle]')?.addEventListener('click', () => {
      lang = lang === 'zh-CN' ? 'en' : 'zh-CN';
      applyLang(lang);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
