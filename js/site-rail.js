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

  function canonicalRailMarkup() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const active = (href) => {
      const target = href.replace(/\/+$/, '') || '/';
      return path === target || (target.endsWith('.html') && path === target.slice(0, -5));
    };
    const current = (href) => active(href) ? ' active' : '';
    const ariaCurrent = (href) => active(href) ? ' aria-current="page"' : '';
    return `
      <nav class="rail-top" aria-label="${'\u7ad9\u70b9'}">
        <a class="rail-nav-btn" href="/global" aria-label="${'\u5168\u7403\u671f\u520a'}" title="${'\u5168\u7403\u671f\u520a'}">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 3.4 9A14 14 0 0 1 12 21a14 14 0 0 1-3.4-9A14 14 0 0 1 12 3Z"/></svg>
          <span data-static-i18n="rail_global">${'\u5168\u7403'}</span>
        </a>
        <a class="rail-nav-btn rail-region-station" data-region-station="dom" href="/cn" aria-label="${'\u4e2d\u56fd\u671f\u520a'}" title="${'\u4e2d\u56fd\u671f\u520a'}"><span class="rail-flag" aria-hidden="true">CN</span><span data-static-i18n="rail_china">${'\u4e2d\u56fd'}</span></a>
        <a class="rail-nav-btn rail-region-station" data-region-station="in" href="/in" aria-label="${'\u5370\u5ea6\u671f\u520a'}" title="${'\u5370\u5ea6\u671f\u520a'}" hidden><span class="rail-flag" aria-hidden="true">IN</span><span data-static-i18n="rail_india">${'\u5370\u5ea6'}</span></a>
        <a class="rail-nav-btn rail-region-station" data-region-station="my" href="/my" aria-label="${'\u9a6c\u6765\u897f\u4e9a\u671f\u520a'}" title="${'\u9a6c\u6765\u897f\u4e9a\u671f\u520a'}" hidden><span class="rail-flag" aria-hidden="true">MY</span><span data-static-i18n="rail_malaysia">${'\u9a6c\u6765\u897f\u4e9a'}</span></a>
        <a class="rail-nav-btn rail-region-station" data-region-station="kr" href="/kr" aria-label="${'\u97e9\u56fd\u671f\u520a'}" title="${'\u97e9\u56fd\u671f\u520a'}" hidden><span class="rail-flag" aria-hidden="true">KR</span><span data-static-i18n="rail_korea">${'\u97e9\u56fd'}</span></a>
        <div class="rail-region-picker">
          <button class="rail-nav-btn rail-region-toggle" type="button" aria-label="${'\u5730\u533a\u7ad9\u70b9'}" title="${'\u5730\u533a\u7ad9\u70b9'}" aria-expanded="false"><span class="rail-flag rail-region-symbol" aria-hidden="true">\u00b7\u00b7\u00b7</span><span><span data-static-i18n="rail_regions">${'\u5730\u533a'}</span><b class="rail-caret" aria-hidden="true">\u25be</b></span></button>
          <div class="rail-region-menu" aria-label="${'\u5730\u533a\u7ad9\u70b9'}"></div>
        </div>
      </nav>
      <div class="rail-bottom" aria-label="${'\u8d26\u6237\u4e0e\u5de5\u5177'}">
        <a class="rail-nav-btn rail-pricing-btn${current('/pricing.html')}" id="pricing-rail-link" href="/pricing.html"${ariaCurrent('/pricing.html')} aria-label="${'\u8ba2\u9605'}" title="${'\u8ba2\u9605'}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 16.7l.9-5L4.8 8.2l5-.7L12 3z"/><path d="M12 17v4"/></svg><span data-static-i18n="nav_pricing">${'\u8ba2\u9605'}</span></a>
        <a class="rail-nav-btn${current('/extension.html')}" id="download-center-rail-link" href="/extension.html"${ariaCurrent('/extension.html')} aria-label="${'\u4e0b\u8f7d'}" title="${'\u4e0b\u8f7d'}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg><span data-static-i18n="download_center">${'\u4e0b\u8f7d'}</span></a>
        <a class="rail-nav-btn${current('/rankings')}" id="rankings-btn" href="/rankings/"${ariaCurrent('/rankings')} data-tab="rank" aria-label="${'\u699c\u5355'}" title="${'\u699c\u5355'}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 21V11"/><path d="M12 21V7"/><path d="M16 21V3"/><path d="M4 21h16"/></svg><span data-static-i18n="rail_rankings">${'\u699c\u5355'}</span></a>
        <a class="rail-nav-btn${current('/favorites')}" id="fav-header-btn" href="/favorites"${ariaCurrent('/favorites')} aria-label="${'\u6211\u7684\u6536\u85cf'}" title="${'\u6211\u7684\u6536\u85cf'}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.7l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3.7z"/></svg><span data-static-i18n="rail_saved">${'\u6536\u85cf'}</span></a>
        <a class="rail-nav-btn${current('/account')}" id="account-credit-badge" href="/account"${ariaCurrent('/account')} aria-label="${'\u6211\u7684'}" title="${'\u6211\u7684'}"><span class="rail-avatar" aria-hidden="true">${'\u6211'}</span><span data-static-i18n="rail_account">${'\u6211\u7684'}</span></a>
      </div>`;
  }

  function upgradeLegacyRail() {
    const rail = document.querySelector('.site-rail');
    if (!rail) return;
    rail.className = 'app-rail';
    rail.innerHTML = canonicalRailMarkup();
  }

  /** 已有 .app-rail 但缺订阅入口时补上（下载页等硬编码侧栏） */
  function ensurePricingRailLink() {
    const bottom = document.querySelector('.app-rail .rail-bottom');
    if (!bottom) return;
    if (bottom.querySelector('#pricing-rail-link, .rail-pricing-btn, a[href*="pricing"]')) return;
    const a = document.createElement('a');
    a.className = 'rail-nav-btn rail-pricing-btn';
    a.id = 'pricing-rail-link';
    a.href = '/pricing.html';
    a.setAttribute('aria-label', '订阅');
    a.title = '订阅';
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 16.7l.9-5L4.8 8.2l5-.7L12 3z"/><path d="M12 17v4"/></svg><span data-static-i18n="nav_pricing">订阅</span>';
    const download = bottom.querySelector('#download-center-rail-link, a[href*="extension"]');
    if (download) bottom.insertBefore(a, download);
    else bottom.prepend(a);
  }

  /** 侧栏「下载中心」文案统一为「下载」 */
  function normalizeDownloadLabel() {
    document.querySelectorAll('#download-center-rail-link span, a[href*="extension.html"] span[data-static-i18n="download_center"]').forEach((el) => {
      if (/下载中心|Download Center/i.test(el.textContent || '')) {
        el.textContent = /[A-Za-z]/.test(el.textContent) && !/[\u4e00-\u9fff]/.test(el.textContent) ? 'Download' : '下载';
      }
    });
    const link = document.getElementById('download-center-rail-link');
    if (link) {
      if (link.getAttribute('aria-label') === '下载中心') link.setAttribute('aria-label', '下载');
      if (link.getAttribute('title') === '下载中心') link.setAttribute('title', '下载');
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
      memoryPinned = Array.isArray(saved) ? saved.filter(id => REGIONS.some(r => r.id === id)) : DEFAULT_PINNED.slice();
      if (!localStorage.getItem(MIGRATION_KEY) && !memoryPinned.includes('dom')) {
        memoryPinned = ['dom', ...memoryPinned];
        localStorage.setItem(KEY, JSON.stringify(memoryPinned));
        localStorage.setItem(MIGRATION_KEY, '1');
      }
      return memoryPinned;
    } catch (_) {
      return memoryPinned.length ? memoryPinned : DEFAULT_PINNED.slice();
    }
  }

  function writePinned(ids) {
    const valid = [...new Set(ids.filter(id => REGIONS.some(r => r.id === id)))];
    memoryPinned = valid;
    try { localStorage.setItem(KEY, JSON.stringify(valid)); } catch (_) {}
    try { localStorage.setItem(MIGRATION_KEY, '1'); } catch (_) {}
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
      return REGIONS.find(r => path === r.href)?.id || '';
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
    REGIONS.forEach(region => {
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

    REGIONS.forEach(region => {
      let link = rail.querySelector(`[data-region-station="${region.id}"]`);
      if (!link) link = normalizeLegacyRegionLink(rail, region);
      if (!link) {
        link = makePinnedLink(region, linkClass);
        stationGroup.insertBefore(link, regionBox);
      }
      link.hidden = !pinned.includes(region.id);
      link.classList.toggle('active', location.pathname.replace(/\/+$/, '') === region.href);
    });

    rail.querySelectorAll(`.${menuClass} a, .${menuClass} [data-region-pin]`).forEach(link => {
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
    upgradeLegacyRail();
    ensurePricingRailLink();
    normalizeDownloadLabel();
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
    menu?.querySelectorAll('a, [data-region-pin]').forEach(link => {
      const id = link.dataset.regionPin || regionIdFromHref(link.href);
      if (!id) return;
      link.addEventListener('click', (event) => {
        if (!parts.app && link.tagName === 'A') return;
        event.preventDefault();
        const pinned = readPinned();
        writePinned(pinned.includes(id) ? pinned.filter(x => x !== id) : [...pinned, id]);
        apply();
      });
    });
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
