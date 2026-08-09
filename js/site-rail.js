(() => {
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
        <a class="rail-nav-btn${current('/account')}" id="account-credit-badge" href="/account"${ariaCurrent('/account')} aria-label="我的" title="我的">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="9" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19"/></svg>
          <span data-static-i18n="rail_account">我的</span>
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
    if (!bottom || bottom.querySelector('#rankings-btn, a[href="/#rankings"]')) return;
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
