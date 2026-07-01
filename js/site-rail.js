(() => {
  const KEY = 'ailatest.pinnedRegionStations';
  const REGIONS = [
    { id: 'in', label: '印度', code: 'IN', href: '/in' },
    { id: 'my', label: '马来西亚', code: 'MY', href: '/my' },
    { id: 'kr', label: '韩国', code: 'KR', href: '/kr' },
  ];

  function readPinned() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(id => REGIONS.some(r => r.id === id)) : [];
    } catch (_) {
      return [];
    }
  }

  function writePinned(ids) {
    const valid = [...new Set(ids.filter(id => REGIONS.some(r => r.id === id)))];
    try { localStorage.setItem(KEY, JSON.stringify(valid)); } catch (_) {}
    return valid;
  }

  function railParts() {
    const rail = document.querySelector('.site-rail') || document.querySelector('.listing-rail');
    if (!rail) return null;
    const listing = rail.classList.contains('listing-rail');
    return {
      rail,
      linkClass: listing ? 'listing-rail-link' : 'site-rail-link',
      regionClass: listing ? 'listing-rail-region' : 'site-rail-region',
      menuClass: listing ? 'listing-rail-region-menu' : 'site-rail-region-menu',
      topClass: listing ? 'listing-rail-top' : 'site-rail-top',
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
    a.innerHTML = `<span>${region.code}</span><b>${region.label}</b>`;
    return a;
  }

  function apply() {
    const parts = railParts();
    if (!parts) return;
    const { rail, linkClass, regionClass, menuClass, topClass } = parts;
    const regionBox = rail.querySelector(`.${regionClass}`);
    if (!regionBox) return;
    const stationGroup = rail.querySelector(`.${topClass}`) || regionBox.parentElement || rail;
    const pinned = readPinned();

    REGIONS.forEach(region => {
      let link = rail.querySelector(`[data-region-station="${region.id}"]`);
      if (!link) {
        link = makePinnedLink(region, linkClass);
        stationGroup.insertBefore(link, regionBox);
      }
      link.hidden = !pinned.includes(region.id);
      link.classList.toggle('active', location.pathname.replace(/\/+$/, '') === region.href);
    });

    rail.querySelectorAll(`.${menuClass} a`).forEach(link => {
      const id = regionIdFromHref(link.href);
      if (!id) return;
      const active = pinned.includes(id);
      link.classList.toggle('active', active);
      link.setAttribute('aria-pressed', active ? 'true' : 'false');
      link.setAttribute('role', 'button');
    });
  }

  function bind() {
    const parts = railParts();
    if (!parts) return;
    const menu = parts.rail.querySelector(`.${parts.menuClass}`);
    menu?.querySelectorAll('a').forEach(link => {
      const id = regionIdFromHref(link.href);
      if (!id) return;
      link.addEventListener('click', (event) => {
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
