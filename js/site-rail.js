(() => {
  // All static/listing pages share this bootstrap. IP is only the fallback:
  // an explicit URL, a remembered manual choice, or a Chinese browser locale
  // should keep the local language even when the visitor is abroad.
  function normalizeLocalLang(code) {
    const value = String(code || '').trim().toLowerCase().replace(/_/g, '-');
    if (!value) return '';
    if (value === 'zh' || value.startsWith('zh-')) return 'zh-CN';
    return 'en';
  }

  function detectLocalLanguage() {
    try {
      const query = new URLSearchParams(location.search).get('lang');
      if (query) return { lang: normalizeLocalLang(query), explicit: true };
      const path = (location.pathname || '').replace(/\/+$/, '') || '/';
      if (path === '/zh' || path.startsWith('/zh/')) return { lang: 'zh-CN', explicit: true };
      if (path === '/en' || path.startsWith('/en/')) return { lang: 'en', explicit: true };
      if (localStorage.getItem('ailatest.lang.userSet') === '1') {
        const saved = normalizeLocalLang(localStorage.getItem('ailatest.lang'));
        if (saved) return { lang: saved, explicit: true };
      }
    } catch (_) {}
    try {
      const languages = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
      const primary = languages.find((item) => String(item || '').trim());
      if (normalizeLocalLang(primary) === 'zh-CN') {
        return { lang: 'zh-CN', explicit: true };
      }
    } catch (_) {}
    return null;
  }

  const localLanguage = detectLocalLanguage();
  if (localLanguage?.lang) {
    window.__journalLangLocalPreference = true;
    document.documentElement.lang = localLanguage.lang;
    document.documentElement.setAttribute('data-ui-lang', localLanguage.lang);
    window.__journalUiLang = localLanguage.lang;
  }

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
    state.promise.then((result) => {
      if (!result?.known || window.__journalLangManualSession || window.__journalLangLocalPreference) return;
      const lang = result.lang === 'zh-CN' ? 'zh-CN' : 'en';
      document.documentElement.lang = lang;
      document.documentElement.setAttribute('data-ui-lang', lang);
      window.__journalUiLang = lang;
      applyListingLanguage(lang);
      document.querySelectorAll('[data-zh][data-en]').forEach((el) => {
        const text = el.getAttribute(lang === 'en' ? 'data-en' : 'data-zh');
        if (text != null && text !== '') el.textContent = text;
      });
      window.dispatchEvent(new CustomEvent('ailatest:langchange', { detail: { lang } }));
    });
    return state.promise;
  }

  probeGeoLanguage();

  // Generated subject/index landing pages predate static-i18n and contain a
  // small amount of Chinese template copy. Keep their visible shell aligned
  // with the IP-selected language without touching journal names or data.
  function applyListingLanguage(lang) {
    const isEnglish = lang === 'en';
    const listing = document.querySelector('.listing-topbar, body.rank-landing');
    if (!listing) return;
    const remember = (el) => {
      if (!el || el.dataset.geoZhText != null) return el?.dataset.geoZhText || '';
      el.dataset.geoZhText = el.textContent || '';
      return el.dataset.geoZhText;
    };
    const set = (el, enText) => {
      if (!el) return;
      const zhText = remember(el);
      el.textContent = isEnglish ? enText : zhText;
    };

    const stationNames = {
      dom: 'China',
      in: 'India',
      my: 'Malaysia',
      kr: 'Korea',
      pbn: 'Poland',
      isc: 'Iran',
      scielo: 'Latin America',
    };
    document.querySelectorAll('.app-rail [data-region-station]').forEach((link) => {
      const label = link.querySelector('span:not(.rail-flag)');
      const id = link.getAttribute('data-region-station');
      if (label && stationNames[id]) set(label, stationNames[id]);
    });
    document.querySelectorAll('.app-rail [data-region-pin]').forEach((link) => {
      const label = link.querySelector('span:not(.rail-flag)');
      const id = link.getAttribute('data-region-pin');
      if (label && stationNames[id]) set(label, stationNames[id]);
    });
    set(document.querySelector('.app-rail .rail-top > a[href="/global"] span:not(.rail-flag)'), 'Global');
    set(document.querySelector('.app-rail .rail-region-toggle span > span'), 'Regions');

    if (document.body?.classList.contains('rank-landing')) return;
    set(document.querySelector('.listing-section-title'), 'Journal rankings');
    const h1 = document.querySelector('.wrap h1, .listing-main h1, main h1');
    if (h1) {
      const zhText = remember(h1);
      const enText = zhText
        .replace(/\s*期刊\s*$/, ' Journals')
        .replace(/中科院预警/g, 'CAS warning')
        .replace(/中信所预警/g, 'CITIC warning')
        .replace(/预警名单/g, 'Warning list');
      set(h1, enText);
    }

    const breadcrumb = document.querySelector('.breadcrumb');
    breadcrumb?.querySelectorAll('a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const text = href === '/' ? 'Home'
        : href.includes('/subjects/') ? 'Subject rankings'
          : href.includes('/indexes/') ? (href.includes('warning') ? 'Warning list' : 'Index rankings')
            : 'Rankings';
      set(link, text);
    });

    document.querySelectorAll('th').forEach((th) => {
      const map = {
        '期刊': 'Journal',
        '影响因子': 'Impact factor',
        'JCR 分区': 'JCR quartile',
        '中科院': 'CAS',
        '索引': 'Indexing',
        '出版商': 'Publisher',
        '状态': 'Status',
      };
      const raw = remember(th);
      if (isEnglish && map[raw]) th.textContent = map[raw];
      else if (!isEnglish) th.textContent = raw;
    });

    const sub = document.querySelector('.sub');
    if (sub) {
      const zhText = remember(sub);
      let enText = zhText
        .replace(/\s*共\s*\d+\s*种期刊，按影响因子排序。?\s*$/, ' Sorted by impact factor.')
        .replace(/\s*按影响因子排序。?\s*$/, ' Sorted by impact factor.')
        .replace(/中科院文献情报中心国际期刊预警名单/g, 'CAS international journal warning list')
        .replace(/中信所\(中国科学技术信息研究所\)国际期刊预警名单\(2025\)/g, 'CITIC (China Institute of Scientific and Technical Information) international journal warning list (2025)')
        .replace(/含影响因子、分区、CAS 等级和索引信息/g, 'with impact factor, quartiles, CAS tiers and indexing information')
        .replace(/中信所国际期刊预警名单/g, 'CITIC international journal warning list')
        .replace(/Web of Science On Hold 期刊/g, 'Web of Science On Hold journals')
        .replace(/因质量问题被 Clarivate 暂停收录评估的期刊/g, 'journals whose indexing review was paused by Clarivate for quality concerns')
        .replace(/新锐版\(Under Review\)期刊/g, 'Emerging (Under Review) journals')
        .replace(/正在被 Web of Science 评审的期刊/g, 'journals currently under Web of Science review');
      set(sub, enText);
    }
    const count = document.querySelector('.count');
    if (count) {
      const zhText = remember(count);
      let enText = zhText
        .replace(/按影响因子降序展示前\s*(\d+)\s*\/\s*共\s*(\d+)\s*种期刊（字段与主站一致：IF · JCR · 中科院 · 索引 · 出版商）。?/, 'Top $1 of $2 journals by impact factor (same fields as the main site: IF · JCR · CAS · Indexing · Publisher).')
        .replace(/按影响因子降序展示\s*(\d+)\s*种\s*([^\s（]+)\s*收录期刊（字段与主站一致：IF · JCR · 中科院 · ISSN · 出版商）。?/, '$1 $2-indexed journals sorted by impact factor (same fields as the main site: IF · JCR · CAS · ISSN · Publisher).')
        .replace(/共\s*(\d+)\s*本中科院预警期刊（按原列表排序；字段：影响因子 · JCR · 中科院 · 状态 · 出版商）/, '$1 CAS warning journals (original list order; fields: impact factor · JCR · CAS · status · publisher)')
        .replace(/共\s*(\d+)\s*本中信所预警期刊（按原列表排序；字段：影响因子 · JCR · 中科院 · 状态 · 出版商）/, '$1 CITIC warning journals (original list order; fields: impact factor · JCR · CAS · status · publisher)')
        .replace(/共\s*(\d+)\s*本 WoS On Hold 期刊（按原列表排序；字段：影响因子 · JCR · 中科院 · 状态 · 出版商）/, '$1 WoS On Hold journals (original list order; fields: impact factor · JCR · CAS · status · publisher)')
        .replace(/共\s*(\d+)\s*本WoS On Hold期刊（按原列表排序；字段：影响因子 · JCR · 中科院 · 状态 · 出版商）/, '$1 WoS On Hold journals (original list order; fields: impact factor · JCR · CAS · status · publisher)')
        .replace(/共\s*(\d+)\s*本新锐 Under Review期刊（按原列表排序；字段：影响因子 · JCR · 中科院 · 状态 · 出版商）/, '$1 Emerging Under Review journals (original list order; fields: impact factor · JCR · CAS · status · publisher)')
        .replace(/中科院预警/g, 'CAS warning')
        .replace(/中信所预警/g, 'CITIC warning')
        .replace(/新锐 Under Review/g, 'Emerging Under Review');
      set(count, enText);
    }
    const back = document.querySelector('.back-wrap .back, .back-wrap a, .rl-back a');
    if (back) set(back, '← Back');

    document.querySelectorAll('.footer a, .rl-foot a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (href === '/about') set(link, 'About');
      else if (href === '/contact') set(link, 'Contact');
      else if (href === '/') set(link, 'AILatest Journal');
    });
  }

  // The first paint on production pages should use a local language signal
  // when present; otherwise keep English until /geo resolves.
  if (typeof location !== 'undefined'
    && !/^(localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(location.hostname || '')
    && !window.__ailatestGeoLangState?.ready) {
    const initial = localLanguage?.lang || 'en';
    document.documentElement.lang = initial;
    document.documentElement.setAttribute('data-ui-lang', initial);
    window.__journalUiLang = initial;
  }

  const KEY = 'ailatest.pinnedRegionStations';
  const MIGRATION_KEY = `${KEY}.v2`;
  let memoryPinned = [];
  const DEFAULT_PINNED = ['dom'];
  const REGIONS = [
    { id: 'dom', label: '中国', code: 'CN', href: '/cn' },
    { id: 'in', label: '印度', code: 'IN', href: '/in' },
    { id: 'my', label: '马来西亚', code: 'MY', href: '/my' },
    { id: 'kr', label: '韩国', code: 'KR', href: '/kr' },
    { id: 'pbn', label: '波兰', code: 'PL', href: '/pbn' },
    { id: 'isc', label: '伊朗', code: 'IR', href: '/isc' },
    { id: 'scielo', label: '拉美', code: 'LA', href: '/scielo' },
  ];

  /** Footer / legal / pricing / download shell pages share the main SPA rail. */
  function isStaticShellPage() {
    if (document.body?.dataset?.staticPage) return true;
    if (document.querySelector('link[href*="/css/static.css"]')) return true;
    const path = (location.pathname || '').replace(/\/+$/, '').toLowerCase() || '/';
    return /\/(about|contact|terms|privacy|refund|pricing|extension|signup)(\.html)?$/.test(path);
  }

  /**
   * Main app rail (index.html): Global + pinned regions + region picker |
   * Rankings + Fav + Me stay in the rail; pricing and download remain in
   * the shared home navigation.
   */
  function canonicalRailMarkup() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const active = (href) => {
      const target = href.replace(/\/+$/, '') || '/';
      return path === target || (target.endsWith('.html') && path === target.slice(0, -5));
    };
    const current = (href) => (active(href) ? ' active' : '');
    const ariaCurrent = (href) => (active(href) ? ' aria-current="page"' : '');
    const station = (id, code, label, href, hidden) =>
      `<a class="rail-nav-btn rail-region-station" data-region-station="${id}" href="${href}" aria-label="${label}期刊" title="${label}期刊"${hidden ? ' hidden' : ''}><span class="rail-flag" aria-hidden="true">${code}</span><span>${label}</span></a>`;

    return `
      <nav class="rail-top" aria-label="站点">
        <a class="rail-nav-btn${current('/global')}" href="/global" aria-label="全球期刊" title="全球期刊"${ariaCurrent('/global')}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 3.4 9A14 14 0 0 1 12 21a14 14 0 0 1-3.4-9A14 14 0 0 1 12 3Z"/></svg>
          <span data-static-i18n="rail_global">全球</span>
        </a>
        ${station('dom', 'CN', '中国', '/cn', false)}
        ${station('in', 'IN', '印度', '/in', true)}
        ${station('my', 'MY', '马来西亚', '/my', true)}
        ${station('kr', 'KR', '韩国', '/kr', true)}
        ${station('pbn', 'PL', '波兰', '/pbn', true)}
        ${station('isc', 'IR', '伊朗', '/isc', true)}
        ${station('scielo', 'LA', '拉美', '/scielo', true)}
        <div class="rail-region-picker">
          <button class="rail-nav-btn rail-region-toggle" type="button" aria-label="地区站点" title="地区站点" aria-expanded="false">
            <span class="rail-flag rail-region-symbol" aria-hidden="true">···</span>
            <span><span data-static-i18n="rail_regions">地区</span><b class="rail-caret" aria-hidden="true">▾</b></span>
          </button>
          <div class="rail-region-menu" aria-label="地区站点"></div>
        </div>
      </nav>
      <div class="rail-bottom" aria-label="账户">
        <a class="rail-nav-btn${current('/rankings') || current('/indexes') ? ' active' : ''}" id="rankings-btn" href="/#rankings" aria-label="榜单" title="索引排行榜与预警名单">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 21V11"/><path d="M12 21V7"/><path d="M16 21V3"/><path d="M4 21h16"/></svg>
          <span data-static-i18n="rail_rankings">榜单</span>
        </a>
        <a class="rail-nav-btn${current('/favorites')}" id="fav-header-btn" href="/favorites"${ariaCurrent('/favorites')} aria-label="我的收藏" title="我的收藏">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.7l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3.7z"/></svg>
          <span data-static-i18n="rail_saved">收藏</span>
        </a>
        <a class="rail-nav-btn${current('/account')}" id="account-credit-badge" data-tab="me" href="/account"${ariaCurrent('/account')} aria-label="设置" title="设置">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="9" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19"/></svg>
          <span data-static-i18n="rail_account">设置</span>
        </a>
      </div>`;
  }

  function ensureCanonicalRail() {
    let rail = document.querySelector('.app-rail') || document.querySelector('.site-rail');
    if (!rail) return null;

    const isLegacy = rail.classList.contains('site-rail');
    const missingPicker = !rail.querySelector('.rail-region-picker');
    const canonical = rail.classList.contains('app-rail')
      && !!rail.querySelector('.rail-top')
      && !!rail.querySelector('.rail-region-picker')
      && !!rail.querySelector('.rail-region-menu')
      && !!rail.querySelector('.rail-bottom .rail-nav-btn');
    const staticPage = isStaticShellPage();
    // Static shells that already ship the app-rail are enhanced in place.
    // Replacing a complete rail after first paint causes a visible font/size
    // jump. Legacy and incomplete rails still get rebuilt.
    if (!canonical && (staticPage || isLegacy || missingPicker)) {
      rail.className = 'app-rail';
      rail.setAttribute('aria-label', 'Primary navigation');
      rail.innerHTML = canonicalRailMarkup();
    }
    return rail;
  }

  function ensureRankLink(rail) {
    const bottom = rail?.querySelector('.rail-bottom');
    if (!bottom) return;
    // Listing pages already ship a rankings entry with a canonical path. Do
    // not inject a second button just because the link is `/rankings/` (or a
    // legacy `/indexes/` URL) instead of the home hash URL.
    const existing = bottom.querySelector(
      '#rankings-btn, a[href="/#rankings"], a[href="/rankings"], a[href="/rankings/"], a[href="/indexes"], a[href="/indexes/"]'
    );
    if (existing) {
      if (!existing.id) existing.id = 'rankings-btn';
      return;
    }
    const link = document.createElement('a');
    link.className = 'rail-nav-btn';
    link.id = 'rankings-btn';
    link.href = '/#rankings';
    link.setAttribute('aria-label', '榜单');
    link.title = '索引排行榜与预警名单';
    link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 21V11"/><path d="M12 21V7"/><path d="M16 21V3"/><path d="M4 21h16"/></svg><span data-static-i18n="rail_rankings">榜单</span>';
    const path = (location.pathname || '').replace(/\/+$/, '') || '/';
    if (path === '/rankings' || path === '/indexes' || path.startsWith('/indexes/')) link.classList.add('active');
    bottom.insertBefore(link, bottom.firstElementChild || null);
  }

  function readStoredJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function railLanguage() {
    try {
      const current = String(window.__journalUiLang || document.documentElement.getAttribute('data-ui-lang') || '').toLowerCase();
      if (current === 'en' || current.startsWith('en-')) return 'en';
      if (current === 'zh' || current.startsWith('zh-')) return 'zh';
      const saved = String(localStorage.getItem('ailatest.lang') || '').toLowerCase();
      if (saved === 'en' || saved === 'en-us') return 'en';
      if (document.documentElement.lang.toLowerCase() === 'en') return 'en';
    } catch (_) {}
    return 'zh';
  }

  function railLabel(zh, en) {
    return railLanguage() === 'en' ? en : zh;
  }

  function storedFavoriteCount() {
    const lists = readStoredJson('ailatest.favLists', null);
    if (Array.isArray(lists) && lists.length) {
      const ids = new Set();
      lists.forEach((list) => {
        if (Array.isArray(list?.ids)) list.ids.forEach((id) => ids.add(String(id)));
      });
      return ids.size;
    }
    const flat = readStoredJson('ailatest.favs', []);
    if (Array.isArray(flat)) return new Set(flat.map(String)).size;
    const data = readStoredJson('ailatest.favsData', {});
    return data && typeof data === 'object' ? Object.keys(data).length : 0;
  }

  function storedMembership() {
    const user = readStoredJson('ailatest.user', null);
    const ents = user?.entitlements || {};
    const raw = String(ents.tier || user?.tier || '').toLowerCase();
    const product = String(ents.product_tier || '').toLowerCase();
    const owner = !!(user?.is_owner || user?.plan === 'owner' || ents.is_owner || ents.plan === 'owner'
      || String(user?.email || '').toLowerCase() === 'jiantaoweng@gmail.com');
    if (owner || product === 'max' || raw === 'pro' || raw === 'max') {
      return { id: 'max', label: 'Max', cls: 'tier-max', user };
    }
    if (product === 'pro' || raw === 'plus') {
      return { id: 'pro', label: 'Pro', cls: 'tier-pro', user };
    }
    if (product === 'trial' || raw === 'trial') {
      return { id: 'trial', label: railLabel('试用', 'Trial'), cls: 'tier-trial', user };
    }
    return { id: 'free', label: 'FREE', cls: 'tier-free', user };
  }

  function ensureRailStateMarkup(rail) {
    const bottom = rail?.querySelector('.rail-bottom');
    if (!bottom) return;

    const rankings = bottom.querySelector('#rankings-btn, a[href="/#rankings"], a[href="/rankings"], a[href="/rankings/"], a[href="/indexes"], a[href="/indexes/"]');
    if (rankings) {
      rankings.id = 'rankings-btn';
      const label = rankings.querySelector('[data-rail-label]') || rankings.querySelector('span:not(.rail-flag):not(.fav-count-badge)');
      if (label) {
        label.dataset.railLabel = 'rankings';
        label.textContent = railLabel('榜单', 'Rankings');
      }
      rankings.setAttribute('aria-label', railLabel('榜单', 'Rankings'));
      rankings.title = railLabel('索引排行榜与预警名单', 'Index rankings and warning lists');
    }

    const fav = bottom.querySelector('#fav-header-btn, a[href="/favorites"], [data-tab="fav"]');
    if (fav) {
      fav.id = 'fav-header-btn';
      if (!fav.querySelector('.fav-count-badge')) {
        const badge = document.createElement('span');
        badge.id = 'fav-count-badge';
        badge.className = 'fav-count-badge';
        badge.hidden = true;
        fav.appendChild(badge);
      }
      const label = fav.querySelector('[data-rail-label]') || fav.querySelector('span:not(.rail-flag):not(.fav-count-badge)');
      if (label && !label.classList.contains('fav-count-badge')) {
        label.dataset.railLabel = 'saved';
        label.textContent = railLabel('收藏', 'Saved');
      }
      fav.setAttribute('aria-label', railLabel('我的收藏', 'Saved journals'));
      fav.title = railLabel('我的收藏', 'Saved journals');
    }

    const account = bottom.querySelector('#account-credit-badge, a[href="/account"], [data-tab="me"]');
    if (account) {
      account.id = 'account-credit-badge';
      account.classList.add('account-credit-badge');
      // Keep the rail entry on the settings surface.  The href remains as a
      // no-JS fallback for static shells, while the SPA click handler uses
      // data-tab=me and opens the in-place settings panel on mobile.
      account.dataset.tab = 'me';
      const icon = account.querySelector('svg');
      let label = account.querySelector('.rail-me-label');
      let chip = account.querySelector('.rail-tier-chip');
      // The shell is present in the HTML on current pages. Keep those nodes
      // in place so a deferred enhancement never causes a visible reflow.
      if (!icon || !label || !chip) {
        account.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="9" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19"/></svg><span class="rail-me-label" data-rail-label="settings"></span><span class="rail-tier-chip tier-free" aria-hidden="true">FREE</span>`;
        label = account.querySelector('.rail-me-label');
        chip = account.querySelector('.rail-tier-chip');
      }
      if (label) {
        const nextLabel = railLabel('设置', 'Settings');
        if (label.textContent !== nextLabel) label.textContent = nextLabel;
        label.dataset.railLabel = 'settings';
      }
      account.setAttribute('aria-label', railLabel('设置', 'Settings'));
      account.title = railLabel('设置', 'Settings');
      if (chip && !chip.textContent.trim()) chip.textContent = 'FREE';
    }
  }

  function updateRailState(rail) {
    const bottom = rail?.querySelector('.rail-bottom');
    if (!bottom) return;
    const fav = bottom.querySelector('#fav-header-btn');
    const badge = fav?.querySelector('.fav-count-badge');
    if (badge) {
      const count = storedFavoriteCount();
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count < 1;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    const account = bottom.querySelector('#account-credit-badge');
    if (account) {
      const membership = storedMembership();
      const chip = account.querySelector('.rail-tier-chip');
      if (chip) {
        chip.className = `rail-tier-chip ${membership.cls}`;
        chip.textContent = membership.label;
      }
      const title = membership.user
        ? railLabel('设置与账号', 'Settings & account')
        : railLabel('登录后查看会员与设置', 'Sign in for membership & settings');
      account.title = title;
      account.setAttribute('aria-label', title);
    }
  }

  function ensureHomeShellNav() {
    const nav = document.querySelector('.page-head-nav') || document.querySelector('.listing-topbar nav');
    if (!nav) return;
    const staticShell = !!nav.closest('.page-head');
    const langButton = staticShell ? nav.querySelector('[data-static-lang-toggle]') : null;
    const items = [
      ['/#feat', 'nav_features', 'features', '功能', 'Features'],
      ['/#how', 'nav_how', 'how', '怎么用', 'How it works'],
      ['/#rankings', 'nav_rank', 'rankings', '榜单', 'Rankings'],
      ['/pricing', 'nav_pricing', 'pricing', '订阅', 'Pricing'],
      ['/#download', 'download_center', 'download', '下载', 'Download'],
      ['/#contact', 'nav_contact', 'contact', '联系', 'Contact'],
    ];

    const links = [...nav.children].filter((el) => el.tagName === 'A');
    const canonical = links.length === items.length
      && items.every(([href, key, dataNav], index) => {
        const link = links[index];
        return link
          && link.getAttribute('href') === href
          && link.dataset.nav === dataNav
          && (!staticShell || link.dataset.staticI18n === key);
      })
      && (!staticShell || (langButton && nav.lastElementChild === langButton));

    const currentNav = (() => {
      const page = String(document.body?.dataset?.staticPage || '').toLowerCase();
      if (page === 'terms' || page === 'privacy' || page === 'refund') return 'about';
      if (page === 'about' || page === 'contact' || page === 'pricing') return page;
      const path = (location.pathname || '').toLowerCase();
      if (path.includes('/pricing')) return 'pricing';
      if (path.includes('/about') || path.includes('/terms') || path.includes('/privacy') || path.includes('/refund')) return 'about';
      if (path.includes('/contact')) return 'contact';
      if (path.includes('/indexes') || path.includes('/subjects')) return 'rankings';
      return '';
    })();

    // Do not clear and recreate a shell that is already canonical. Clearing
    // nav children after first paint is the source of the click-to-page flash
    // on static and listing pages.
    if (canonical) {
      links.forEach((link, index) => {
        const [, , dataNav, zh, en] = items[index];
        const text = railLanguage() === 'en' ? en : zh;
        if (link.textContent !== text) link.textContent = text;
        const active = dataNav === currentNav;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      if (staticShell && langButton) {
        langButton.textContent = railLanguage() === 'en' ? 'Language' : '语言';
        langButton.setAttribute('aria-label', railLanguage() === 'en' ? 'Change language' : '切换语言');
      }
      return;
    }

    nav.replaceChildren();
    items.forEach(([href, key, dataNav, zh, en]) => {
      const link = document.createElement('a');
      link.href = href;
      link.dataset.nav = dataNav;
      if (staticShell) link.dataset.staticI18n = key;
      link.textContent = railLanguage() === 'en' ? en : zh;
      nav.appendChild(link);
    });
    if (staticShell) {
      const toggle = langButton || document.createElement('button');
      toggle.className = 'static-lang-toggle';
      toggle.type = 'button';
      toggle.dataset.staticLangToggle = '';
      toggle.textContent = railLanguage() === 'en' ? 'Language' : '语言';
      toggle.setAttribute('aria-label', railLanguage() === 'en' ? 'Change language' : '切换语言');
      nav.appendChild(toggle);
    }
  }

  function readPinned() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        memoryPinned = DEFAULT_PINNED.slice();
        return memoryPinned;
      }
      const saved = JSON.parse(raw);
      memoryPinned = Array.isArray(saved) ? saved.filter((id) => REGIONS.some((r) => r.id === id)) : DEFAULT_PINNED.slice();
      if (!localStorage.getItem(MIGRATION_KEY) && !memoryPinned.includes('dom')) {
        memoryPinned = ['dom', ...memoryPinned];
        localStorage.setItem(KEY, JSON.stringify(memoryPinned));
        localStorage.setItem(MIGRATION_KEY, '1');
      }
      const collapseKey = `${KEY}.v3-collapse-all`;
      if (!localStorage.getItem(collapseKey)) {
        if (memoryPinned.length >= REGIONS.length) {
          memoryPinned = DEFAULT_PINNED.slice();
          localStorage.setItem(KEY, JSON.stringify(memoryPinned));
        }
        localStorage.setItem(collapseKey, '1');
      }
      return memoryPinned;
    } catch (_) {
      return memoryPinned.length ? memoryPinned : DEFAULT_PINNED.slice();
    }
  }

  function writePinned(ids) {
    const valid = [...new Set(ids.filter((id) => REGIONS.some((r) => r.id === id)))];
    memoryPinned = valid;
    try {
      localStorage.setItem(KEY, JSON.stringify(valid));
    } catch (_) {}
    try {
      localStorage.setItem(MIGRATION_KEY, '1');
    } catch (_) {}
    return valid;
  }

  function railParts() {
    const rail = document.querySelector('.app-rail') || document.querySelector('.site-rail') || document.querySelector('.listing-rail');
    if (!rail) return null;
    const app = rail.classList.contains('app-rail');
    const listing = rail.classList.contains('listing-rail');
    return {
      rail,
      app,
      linkClass: app ? 'rail-nav-btn' : listing ? 'listing-rail-link' : 'site-rail-link',
      regionClass: app ? 'rail-region-picker' : listing ? 'listing-rail-region' : 'site-rail-region',
      menuClass: app ? 'rail-region-menu' : listing ? 'listing-rail-region-menu' : 'site-rail-region-menu',
      topClass: app ? 'rail-top' : listing ? 'listing-rail-top' : 'site-rail-top',
    };
  }

  function regionIdFromHref(href) {
    try {
      const path = new URL(href, location.origin).pathname.replace(/\/+$/, '');
      return REGIONS.find((r) => path === r.href)?.id || '';
    } catch (_) {
      return '';
    }
  }

  function makePinnedLink(region, linkClass) {
    const a = document.createElement('a');
    a.className = `${linkClass} rail-region-station`;
    a.dataset.regionStation = region.id;
    a.href = region.href;
    if (linkClass === 'rail-nav-btn') {
      a.setAttribute('aria-label', `${region.label}期刊`);
      a.title = `${region.label}期刊`;
      a.innerHTML = `<span class="rail-flag" aria-hidden="true">${region.code}</span><span>${region.label}</span>`;
    } else {
      a.innerHTML = `<span>${region.code}</span><b>${region.label}</b>`;
    }
    return a;
  }

  function normalizeLegacyRegionLink(rail, region) {
    if (region.id !== 'dom') return null;
    const legacy = rail.querySelector('[data-tab="dom"], a[href="/cn"], a[href="/china"]');
    if (!legacy) return null;
    legacy.classList.add('rail-region-station');
    legacy.dataset.regionStation = region.id;
    if (!legacy.getAttribute('href') && legacy.tagName === 'A') legacy.href = region.href;
    return legacy;
  }

  function makeMenuOption(region, linkClass) {
    const appMenu = linkClass === 'rail-nav-btn';
    const el = document.createElement(appMenu ? 'button' : 'a');
    el.className = appMenu ? 'rail-region-option rail-nav-btn' : linkClass;
    el.dataset.regionPin = region.id;
    if (appMenu) {
      el.type = 'button';
      el.setAttribute('aria-label', `${region.label}期刊`);
      el.title = `${region.label}期刊`;
      el.innerHTML = `<span class="rail-flag" aria-hidden="true">${region.code}</span><span>${region.label}</span>`;
    } else {
      el.href = region.href;
      el.innerHTML = `<span>${region.code}</span><b>${region.label}</b>`;
    }
    return el;
  }

  function ensureMenuOptions(rail, menuClass, linkClass) {
    const menu = rail.querySelector(`.${menuClass}`);
    if (!menu) return;
    REGIONS.forEach((region) => {
      if (!menu.querySelector(`[data-region-pin="${region.id}"]`)) {
        menu.appendChild(makeMenuOption(region, linkClass));
      }
    });
  }

  function apply() {
    const parts = railParts();
    if (!parts) return;
    const { rail, linkClass, regionClass, menuClass, topClass } = parts;
    const regionBox = rail.querySelector(`.${regionClass}`);
    if (!regionBox) return;
    ensureMenuOptions(rail, menuClass, linkClass);
    const stationGroup = rail.querySelector(`.${topClass}`) || regionBox.parentElement || rail;
    const pinned = readPinned();

    REGIONS.forEach((region) => {
      let link = rail.querySelector(`[data-region-station="${region.id}"]`);
      if (!link) link = normalizeLegacyRegionLink(rail, region);
      if (!link) {
        link = makePinnedLink(region, linkClass);
        stationGroup.insertBefore(link, regionBox);
      }
      const show = pinned.includes(region.id);
      link.hidden = !show;
      if (show) link.removeAttribute('data-station-hidden');
      else link.setAttribute('data-station-hidden', '1');
      link.classList.toggle('active', location.pathname.replace(/\/+$/, '') === region.href);
    });

    rail.querySelectorAll(`.${menuClass} a, .${menuClass} [data-region-pin]`).forEach((link) => {
      const id = link.dataset.regionPin || regionIdFromHref(link.href);
      if (!id) return;
      const active = pinned.includes(id);
      link.classList.toggle('active', active);
      if (parts.app) {
        link.setAttribute('aria-pressed', active ? 'true' : 'false');
      } else {
        link.removeAttribute('aria-pressed');
        link.removeAttribute('role');
      }
    });
  }

  function bind() {
    const rail = ensureCanonicalRail();
    ensureRankLink(rail);
    ensureRailStateMarkup(rail);
    updateRailState(rail);
    ensureHomeShellNav();
    applyListingLanguage(railLanguage() === 'en' ? 'en' : 'zh-CN');
    const refreshRailState = () => {
      ensureRailStateMarkup(rail);
      updateRailState(rail);
      ensureHomeShellNav();
    };
    window.addEventListener('storage', refreshRailState);
    window.addEventListener('ailatest:langchange', refreshRailState);
    const parts = railParts();
    if (!parts) return;
    const menu = parts.rail.querySelector(`.${parts.menuClass}`);
    let closeAppMenu = () => {};
    if (parts.app) {
      const picker = parts.rail.querySelector('.rail-region-picker');
      const toggle = parts.rail.querySelector('.rail-region-toggle');
      const close = () => {
        if (menu?.parentElement === document.body) picker?.appendChild(menu);
        menu?.classList.remove('portal-open');
        picker?.classList.remove('open');
        toggle?.setAttribute('aria-expanded', 'false');
      };
      closeAppMenu = close;
      toggle?.addEventListener('click', (event) => {
        event.preventDefault();
        const open = !picker?.classList.contains('open');
        picker?.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && menu && window.matchMedia('(max-width: 900px)').matches) {
          menu.classList.add('portal-open');
          document.body.appendChild(menu);
        } else if (!open) {
          close();
        }
      });
      document.addEventListener('click', (event) => {
        if (picker && !picker.contains(event.target) && !menu?.contains(event.target)) close();
      });
      window.addEventListener('resize', close);
    }
    menu?.querySelectorAll('a, [data-region-pin]').forEach((link) => {
      const id = link.dataset.regionPin || regionIdFromHref(link.href);
      if (!id) return;
      link.addEventListener('click', (event) => {
        if (!parts.app && link.tagName === 'A') return;
        event.preventDefault();
        const pinned = readPinned();
        writePinned(pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id]);
        apply();
      });
    });
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
