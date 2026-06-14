(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  ns.adapters = ns.adapters || [];

  function textOf(el) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  const SCHOLAR_SOURCE_ALIASES = new Map([
    ['hum soc sci commun', 'Humanities & Social Sciences Communications'],
    ['humanit soc sci commun', 'Humanities & Social Sciences Communications'],
    ['humanities social sciences commun', 'Humanities & Social Sciences Communications'],
    ['hssc', 'Humanities & Social Sciences Communications'],
  ]);

  function expandScholarSourceAlias(value) {
    const key = ns.norm(value);
    return SCHOLAR_SOURCE_ALIASES.get(key) || '';
  }

  function cleanScholarSource(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';

    const parts = raw.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    const candidates = [];
    if (parts.length >= 2) candidates.push(parts[1]);
    if (parts.length >= 3) candidates.push(parts[parts.length - 2]);
    candidates.push(raw);

    for (let source of candidates) {
      source = source
      .replace(/\b(?:19|20)\d{2}\b.*$/g, '')
      .replace(/\b\d+\s*(?:\(\d+\))?\s*[:,]\s*\d+.*$/g, '')
      .replace(/\s*,\s*$/, '')
      .trim();

      source = ns.cleanJournalName(source);
      source = expandScholarSourceAlias(source) || source;
      if (!source || !ns.likelyJournalName(source)) continue;
      if (/^(?:citations?|related articles|all versions|library search)$/i.test(source)) continue;
      return source;
    }
    return '';
  }

  function cleanScholarTitleFallback(value) {
    const raw = String(value || '').replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim();
    const m = raw.match(/\b(?:journal|transactions|proceedings|review|reviews|letters|annals|bulletin|magazine|quarterly)\b.*$/i);
    return m ? cleanScholarSource(m[0]) : '';
  }

  function citationCount(row) {
    const txt = textOf(row);
    const m = txt.match(/\bCited by\s+([0-9,]+)/i) || txt.match(/被引用\s*([0-9,]+)/) || txt.match(/引用次数\s*[:：]?\s*([0-9,]+)/);
    return m ? Number(String(m[1]).replace(/,/g, '')) || 0 : 0;
  }

  function doiFromRow(row) {
    const texts = [textOf(row)];
    row.querySelectorAll('a[href]').forEach((a) => texts.push(a.href || '', textOf(a)));
    for (const value of texts) {
      const m = String(value || '').match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      if (m) return m[0].replace(/[)\].,;]+$/, '');
    }
    return '';
  }

  function paperTitleFromRow(row) {
    const title = row && row.querySelector('.gs_rt');
    if (!title) return '';
    const clone = title.cloneNode(true);
    clone.querySelectorAll('.gs_ctu, .gs_ctc, .gs_ct1, .gs_ct2').forEach((el) => el.remove());
    return textOf(clone).replace(/^\[[^\]]+\]\s*/, '').trim();
  }

  function pdfUrlFromRow(row) {
    const links = Array.from(row.querySelectorAll('a[href]'));
    const pdf = links.find((a) => /\.pdf(?:[?#]|$)/i.test(a.href || '') || /\[\s*PDF\s*\]/i.test(textOf(a)));
    return pdf ? pdf.href : '';
  }

  function hasResultList() {
    return !!document.querySelector('#gs_res_ccl_mid .gs_r, #gs_bdy_ccl .gs_r, .gs_r .gs_ri');
  }

  function findEntries() {
    const out = [];
    if (!hasResultList()) return out;
    document.querySelectorAll('.gs_r').forEach((row, index) => {
      const body = row.querySelector('.gs_ri') || row;
      const meta = body.querySelector('.gs_a');
      const title = body.querySelector('.gs_rt, h3') || meta || body;
      const journalName = cleanScholarSource(textOf(meta)) || cleanScholarTitleFallback(textOf(title));
      if (journalName) {
        out.push({
          anchorEl: title,
          rowEl: row,
          journalName,
          citationCount: citationCount(row),
          doi: doiFromRow(row),
          paperTitle: paperTitleFromRow(row),
          pdfUrl: pdfUrlFromRow(row),
          originalIndex: index,
        });
      }
    });
    return out;
  }

  function insert(anchorEl, badgeNode) {
    const row = anchorEl && anchorEl.closest ? anchorEl.closest('.gs_r') : null;
    if (row) row.querySelectorAll('.ailatest-badge-block').forEach((el) => el.remove());
    const line = document.createElement('div');
    line.className = 'ailatest-badge-block';
    line.dataset.ailatestUi = '1';
    line.style.display = 'flex';
    line.style.flexWrap = 'wrap';
    line.style.alignItems = 'center';
    line.style.gap = '4px';
    line.style.margin = '3px 0 2px';
    line.appendChild(badgeNode);

    const meta = anchorEl && anchorEl.parentElement ? anchorEl.parentElement.querySelector('.gs_a') : null;
    (meta || anchorEl).insertAdjacentElement('afterend', line);
  }

  function afterLookup(entry, journal) {
    if (!entry || !entry.rowEl) return;
    entry.rowEl.dataset.ailatestIf = journal && journal.if_2024 != null ? String(Number(journal.if_2024) || 0) : '0';
    entry.rowEl.dataset.ailatestCites = String(entry.citationCount || 0);
    entry.rowEl.dataset.ailatestOriginalIndex = String(entry.originalIndex || 0);
  }

  function ensureScholarTools() {
    if (!hasResultList()) return;
    if (document.getElementById('ailatest-scholar-tools')) return;
    const container = document.querySelector('#gs_res_ccl_mid') || document.querySelector('#gs_bdy_ccl');
    if (!container) return;
    const bar = document.createElement('div');
    bar.id = 'ailatest-scholar-tools';
    bar.dataset.ailatestUi = '1';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 10px;padding:8px 10px;border:1px solid #e5ded3;border-radius:6px;background:#fffdf8;color:#4b4032;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;';
    bar.innerHTML = `<b style="font-size:12px">${ns.t ? ns.t('sort.title') : 'AILatest sort'}</b><button data-aj-sort="if">${ns.t ? ns.t('sort.if') : 'By IF'}</button><button data-aj-sort="cites">${ns.t ? ns.t('sort.cites') : 'By citations'}</button><button data-aj-sort="original">${ns.t ? ns.t('sort.original') : 'Original order'}</button><span id="ailatest-scholar-status" style="color:#8a7d6a">${ns.t ? ns.t('status.loaded') : 'Loaded, identifying journals...'}</span>`;
    bar.querySelectorAll('button').forEach((btn) => {
      btn.style.cssText = 'border:1px solid #d8cbb9;background:#fff;border-radius:5px;padding:3px 8px;cursor:pointer;color:#6b3f18;font-weight:700;';
      btn.addEventListener('click', () => sortScholar(btn.dataset.ajSort));
    });
    container.insertAdjacentElement('beforebegin', bar);
  }

  function updateStatus(info = {}) {
    ensureScholarTools();
    const el = document.getElementById('ailatest-scholar-status');
    if (!el) return;
    let text = '';
    if (info.phase === 'loaded') {
      text = ns.t ? ns.t('status.loaded') : 'Loaded, identifying journals...';
    } else if (info.phase === 'empty') {
      text = ns.t ? ns.t('status.empty') : 'Loaded, but no journal source was detected.';
    } else if (info.phase === 'lookup') {
      text = ns.t ? ns.t('status.lookup', { total: info.total || 0, names: (info.names || []).join('；') }) : `Found ${info.total || 0} sources`;
    } else if (info.phase === 'done') {
      const suffix = info.hits ? '' : (ns.t ? ns.t('status.tried', { names: (info.names || []).join('；') }) : `; tried: ${(info.names || []).join('; ')}`);
      text = ns.t ? ns.t('status.done', { total: info.total || 0, hits: info.hits || 0, suffix }) : `Found ${info.total || 0} sources, matched ${info.hits || 0}${suffix}`;
    } else if (info.phase === 'error') {
      text = ns.t ? ns.t('status.error', { message: info.message || 'unknown error' }) : `Lookup failed: ${info.message || 'unknown error'}`;
    }
    if (text && el.textContent !== text) el.textContent = text;
  }

  function sortScholar(mode) {
    const rows = Array.from(document.querySelectorAll('.gs_r'))
      .filter((row) => row.parentElement && Object.prototype.hasOwnProperty.call(row.dataset, 'ailatestOriginalIndex'));
    if (!rows.length) return;
    const parents = Array.from(new Set(rows.map((row) => row.parentElement)));
    const value = (row) => {
      if (mode === 'if') return Number(row.dataset.ailatestIf || 0);
      if (mode === 'cites') return Number(row.dataset.ailatestCites || 0);
      return -Number(row.dataset.ailatestOriginalIndex || 0);
    };
    parents.forEach((parent) => {
      const slots = Array.from(parent.children)
        .filter((child) => child.matches && child.matches('.gs_r') && Object.prototype.hasOwnProperty.call(child.dataset, 'ailatestOriginalIndex'));
      const sorted = slots.slice().sort((a, b) => value(b) - value(a));
      slots.forEach((slot, index) => parent.insertBefore(sorted[index], slot));
    });
  }

  function openAccessUrlFromWork(data) {
    const locs = [data && data.best_oa_location, ...(Array.isArray(data && data.oa_locations) ? data.oa_locations : [])].filter(Boolean);
    const hit = locs.find((x) => x && (x.pdf_url || x.landing_page_url)) || null;
    return hit && (hit.pdf_url || hit.landing_page_url) || '';
  }

  async function findOpenAccessUrl(entry) {
    if (entry.pdfUrl) return entry.pdfUrl;
    if (entry.doi) {
      const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(entry.doi)}`);
      if (res.ok) {
        const url = openAccessUrlFromWork(await res.json());
        if (url) return url;
      }
    }
    const title = String(entry.paperTitle || '').trim();
    if (title) {
      const params = new URLSearchParams({ search: title, per_page: '3' });
      const res = await fetch(`https://api.openalex.org/works?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const works = Array.isArray(data.results) ? data.results : [];
        for (const work of works) {
          const url = openAccessUrlFromWork(work);
          if (url) return url;
        }
      }
    }
    return '';
  }

  function journalFromOpenAlexWork(work) {
    const source = work && (work.primary_location && work.primary_location.source
      || work.host_venue
      || work.best_oa_location && work.best_oa_location.source);
    if (!source) return null;
    const name = source.display_name || source.display_name_alternatives && source.display_name_alternatives[0] || '';
    const issn = source.issn_l || Array.isArray(source.issn) && source.issn[0] || '';
    return name ? { name, issn } : null;
  }

  async function resolveJournalName(entry) {
    if (!entry) return null;
    // Google Scholar result rows already expose a source string. If that source
    // is not in our journal index, do not use title search to guess a journal:
    // title-only OpenAlex matches can point at a different paper/journal and
    // produce false SCI/JCR badges for ordinary or Chinese sources.
    if (entry.journalName) return null;
    if (entry.doi) {
      const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(entry.doi)}`);
      if (res.ok) {
        const hit = journalFromOpenAlexWork(await res.json());
        if (hit) return hit;
      }
    }
    return null;
  }

  function insertOpenAccessButton(entry) {
    if (!entry || !entry.rowEl || entry.rowEl.querySelector('.ailatest-scholar-inline-tools')) return;
    const line = entry.rowEl.querySelector('.ailatest-badge-block');
    if (!line) return;
    const data = {
      doi: entry.doi,
      title: entry.paperTitle,
      journal: entry.journalName,
      url: entry.rowEl.querySelector('.gs_rt a[href]')?.href || location.href,
      pdfUrl: entry.pdfUrl,
    };
    const wrap = document.createElement('span');
    wrap.className = 'ailatest-scholar-inline-tools';
    wrap.dataset.ailatestUi = '1';
    wrap.style.cssText = 'display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px;margin-left:2px;';
    const sources = ns.citations && ns.citations.renderSourceLinks ? ns.citations.renderSourceLinks(data) : null;
    const tools = ns.citations && ns.citations.renderTools ? ns.citations.renderTools(data) : null;
    if (sources) wrap.appendChild(sources);
    if (tools) wrap.appendChild(tools);
    if (wrap.childNodes.length) line.appendChild(wrap);
  }

  ns.adapters.push({
    id: 'google-scholar',
    match: (host) => /^scholar\.google\./i.test(host) || /^(xs2\.dailyheadlines\.cc|scholar\.lanfanshu\.cn)$/i.test(host),
    findEntries,
    insert,
    afterLookup,
    ensureTools: ensureScholarTools,
    updateStatus,
    insertOpenAccessButton,
    resolveJournalName,
  });
})(globalThis);
