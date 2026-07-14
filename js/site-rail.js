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
  ];

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
        if (parts.app) closeAppMenu();
        apply();
      });
    });
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
