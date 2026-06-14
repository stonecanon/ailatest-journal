(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};

  const STYLE = `
    :host { all: initial; }
    .wrap {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 5px;
      margin: 4px 0;
      max-width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.45;
      vertical-align: middle;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      max-width: 240px;
      padding: 2px 7px;
      border-radius: 2px;
      border: 0;
      color: #fff;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: .04em;
      line-height: 1.45;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    }
    .zone, .cas, .jcr, .if, .xr, .flagship { background: #735a3e; }
    .ccf { background: #72728d; }
    .biz { background: #724a58; }
    .tier { background: #72849b; }
    .index, .idx { background: #526b86; }
    .free { background: #1d6f42; }
    .warning { background: #b23a3a; }
    .onhold { background: #d94a1e; }
    .citic, .warnsoft { background: #6f665d; }
    .cssci { background: #6a3a8b; }
    .cssci-ext { background: #8a5aa6; }
    .pku { background: #a33a2a; }
    .zju { background: #1f5f5a; }
    .cscd { background: #4f6f7c; }
    .cstpcd { background: #4f6f7c; }
    .scd, .ami { background: #5a6b3a; }
    .ccft { background: #7a2030; }
    .nsfc { background: #0f766e; }
    a.pill { color: #fff; text-decoration: none; cursor: pointer; }
    a.pill:hover { filter: brightness(1.08); }
    .detail-link {
      display: inline-flex; align-items: center;
      color: #2457a6; font-size: 12px; font-weight: 700;
      text-decoration: underline; text-underline-offset: 2px;
      line-height: 1.45; white-space: nowrap;
    }
  `;

  function add(out, enabled, text, className, title) {
    if (!enabled || !text) return;
    out.push({ text: String(text), className: className || 'pill', title: title || '' });
  }

  function formatIf(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return n >= 10 ? n.toFixed(1) : String(n);
  }

  function cnkxText(cnkx) {
    if (!Array.isArray(cnkx) || !cnkx.length) return [];
    const visible = cnkx.slice(0, 3).map((item) => {
      const tier = item && item.tier ? item.tier : '';
      const domain = item && item.domain ? item.domain : '';
      return domain ? `科协 ${tier} ${domain}` : `科协 ${tier}`;
    });
    if (cnkx.length > 3) visible.push(`科协 +${cnkx.length - 3}`);
    return visible;
  }

  function makeBadges(journal, settings) {
    const j = journal || {};
    const s = settings || {};
    if (Array.isArray(j.display_badges) && j.display_badges.length) {
      const enabled = (badge) => {
        if (badge.group === 'index') return s.showIndex !== false && s.showDomestic !== false;
        if (badge.group === 'rating') return s.showCas !== false || s.showJcr !== false || s.showIf !== false || s.showBusiness !== false || s.showDomestic !== false;
        if (badge.group === 'access') return s.showFree !== false;
        if (badge.group === 'risk') return s.showWarnings !== false;
        return true;
      };
      return j.display_badges
        .filter(enabled)
        .map((badge) => ({
          text: badge.text,
          className: `pill ${badge.className || badge.group || 'index'}`,
          title: badge.title || '',
        }));
    }

    const out = [];

    add(out, s.showCas, j.cas_zone ? `中科院 ${j.cas_zone}区${j.cas_top ? ' TOP' : ''}` : '', 'pill zone');
    if (j.cas_xr && j.cas_xr.zone) {
      add(out, s.showCas, `新锐 ${j.cas_xr.zone}区${j.cas_xr.top ? ' TOP' : ''}`, 'pill xr');
    }
    add(out, s.showJcr, j.if_quartile, 'pill zone');
    add(out, s.showIf, j.if_2024 != null ? `IF ${formatIf(j.if_2024)}` : '', 'pill if');
    add(out, s.showCcf, j.ccf ? `CCF ${j.ccf}` : '', 'pill ccf');
    add(out, s.showBusiness, j.abdc ? `ABDC ${j.abdc}` : '', 'pill biz');
    add(out, s.showBusiness, j.abs ? `ABS ${j.abs}` : '', 'pill biz');

    const indices = Array.isArray(j.indices) ? j.indices.slice(0, 3) : [];
    indices.forEach((idx) => add(out, s.showIndex, idx, 'pill index'));
    add(out, s.showIndex, j.scopus ? 'Scopus' : '', 'pill index');

    add(out, s.showDomestic, j.cssci === 'core' ? 'CSSCI' : '', 'pill cssci');
    add(out, s.showDomestic, j.cssci === 'ext' ? 'CSSCI 扩展' : '', 'pill cssci-ext');
    add(out, s.showDomestic, j.pku ? '北大核心' : '', 'pill pku');
    cnkxText(j.cnkx).forEach((text) => add(out, s.showDomestic, text, 'pill tier'));
    add(out, s.showDomestic, j.cscd ? `CSCD ${j.cscd}` : '', 'pill cscd');
    add(out, s.showDomestic, j.ccft ? `CCF-T ${j.ccft}` : '', 'pill ccft');
    add(out, s.showDomestic, j.zju ? `浙大 ${j.zju}` : '', 'pill zju');
    add(out, s.showDomestic, j.nsfc_mgmt ? `NSFC ${j.nsfc_mgmt}` : '', 'pill nsfc');

    add(out, s.showWarnings, j.warning ? '预警' : '', 'pill warning');
    add(out, s.showWarnings, j.citic_warning ? '中信所预警' : '', 'pill citic');
    add(out, s.showWarnings, j.on_hold ? 'On Hold' : '', 'pill onhold');
    add(out, s.showWarnings, j.under_review ? 'Under Review' : '', 'pill onhold');

    add(out, s.showFree, j.free ? '免费发表' : '', 'pill free');
    add(out, s.showFree, j.doaj_apc === 'no' ? 'DOAJ 免 APC' : '', 'pill free');

    return out;
  }

  function renderBadges(journal, settings) {
    const host = document.createElement('span');
    host.className = 'ailatest-journal-badges';
    host.dataset.ailatestBadge = '1';

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const wrap = document.createElement('span');
    wrap.className = 'wrap';

    makeBadges(journal, settings).forEach((badge) => {
      const el = document.createElement('span');
      el.className = badge.className;
      el.textContent = badge.text;
      if (badge.title) el.title = badge.title;
      wrap.appendChild(el);
    });

    if (journal && journal.slug) {
      const link = document.createElement('a');
      link.className = 'detail-link';
      link.href = `https://journal.ailatest.org/journal/${encodeURIComponent(journal.slug)}/`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = ns.t ? ns.t('detail.link') : 'AILatest details';
      link.title = ns.t ? ns.t('detail.title') : 'View journal details - AILatest Journal';
      wrap.appendChild(link);
    }

    shadow.append(style, wrap);
    return host;
  }

  ns.badges = { renderBadges, makeBadges };
})(globalThis);
