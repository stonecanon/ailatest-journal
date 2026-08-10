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

  function profileIdFromUrl() {
    try { return new URL(location.href).searchParams.get('user') || ''; } catch (_) { return ''; }
  }

  function profilePaper(row) {
    const title = textOf(row.querySelector('.gsc_a_at'));
    if (!title) return null;
    const gray = Array.from(row.querySelectorAll('.gs_gray')).map(textOf);
    const citation = textOf(row.querySelector('.gsc_a_c'));
    const year = textOf(row.querySelector('.gsc_a_y'));
    return {
      title,
      authors: gray[0] || '',
      venue: gray[1] || '',
      year: /^\d{4}$/.test(year) ? Number(year) : null,
      citations: Number((citation.match(/[0-9,]+/) || ['0'])[0].replace(/,/g, '')) || 0,
    };
  }

  function readProfilePayload() {
    const id = profileIdFromUrl();
    const name = textOf(document.querySelector('#gsc_prf_in'));
    const affiliation = textOf(document.querySelector('#gsc_prf_i .gsc_prf_il'));
    const rows = Array.from(document.querySelectorAll('#gsc_a_b tr.gsc_a_tr'))
      .map(profilePaper)
      .filter(Boolean);
    if (!id || !name || !rows.length) return null;
    const citationStats = Array.from(document.querySelectorAll('#gsc_rsb_st .gsc_rsb_std'))
      .map((node) => Number(textOf(node).replace(/,/g, '')) || 0);
    return {
      source: 'google-scholar-extension',
      profile_id: id,
      profile_url: location.href,
      name,
      affiliation,
      profile_citations: citationStats[0] || 0,
      papers: rows.slice(0, 200),
      paper_count: rows.length,
      imported_at: new Date().toISOString(),
      note: '由 AILatest Journal 浏览器插件在用户已打开的 Scholar 主页读取；结果只进入待确认区。',
    };
  }

  function ensureProfileImport() {
    if (!document.querySelector('#gsc_a_b') || !document.querySelector('#gsc_prf_in')) return;
    if (document.getElementById('ailatest-profile-import')) return;
    const anchor = document.querySelector('#gsc_prf_i') || document.querySelector('#gsc_prf');
    if (!anchor) return;
    const button = document.createElement('button');
    button.id = 'ailatest-profile-import';
    button.type = 'button';
    button.textContent = '导入 AILatest 发表足迹';
    button.style.cssText = 'display:inline-flex;align-items:center;min-height:30px;margin:10px 0 4px;padding:0 11px;border:1px solid #f97316;border-radius:999px;color:#9a4b12;background:#fff4e8;font:700 12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;cursor:pointer;';
    button.addEventListener('click', () => {
      const payload = readProfilePayload();
      if (!payload) {
        button.textContent = '暂未读取到论文列表';
        return;
      }
      try {
        chrome.storage.local.set({
          ajPublicationScholarImport: payload,
          ajPublicationScholarImportAt: Date.now(),
        });
        button.textContent = `已读取 ${payload.paper_count} 篇，打开发表足迹确认`;
        button.style.color = '#2f7d58';
        button.style.borderColor = '#b8dfca';
        button.style.background = '#edf8f1';
        window.open('https://journal.ailatest.org/publication-footprint/', '_blank', 'noopener');
      } catch (_) {
        button.textContent = '保存失败，请重试';
      }
    });
    anchor.appendChild(button);
  }

  function findEntries() {
    const out = [];
    if (!hasResultList()) return out;
    document.querySelectorAll('.gs_r').forEach((row, index) => {
      const body = row.querySelector('.gs_ri') || row;
      const meta = body.querySelector('.gs_a');
      const title = body.querySelector('.gs_rt, h3') || meta || body;
      const metaText = textOf(meta);
      const metaParts = metaText.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
      const authors = metaParts[0] || '';
      const yearMatch = metaText.match(/\b(?:19|20)\d{2}\b/);
      const journalName = cleanScholarSource(metaText) || cleanScholarTitleFallback(textOf(title));
      const doi = doiFromRow(row);
      const paperTitle = paperTitleFromRow(row);
      if (journalName || doi || paperTitle) {
        out.push({
          anchorEl: title,
          rowEl: row,
          journalName,
          authors,
          year: yearMatch ? yearMatch[0] : '',
          citationCount: citationCount(row),
          doi,
          paperTitle,
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
    const tools = row && row.querySelector('.ailatest-scholar-inline-tools');
    if (tools) line.insertAdjacentElement('afterend', tools);
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

  function normalizedTitle(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sameScholarTitle(a, b) {
    const left = normalizedTitle(a);
    const right = normalizedTitle(b);
    if (!left || !right) return false;
    if (left === right || left.includes(right) || right.includes(left)) return true;
    const aTokens = new Set(left.split(' ').filter((token) => token.length > 2));
    const bTokens = right.split(' ').filter((token) => token.length > 2);
    if (!aTokens.size || !bTokens.length) return false;
    const overlap = bTokens.filter((token) => aTokens.has(token)).length;
    return overlap / Math.max(aTokens.size, bTokens.length) >= 0.78;
  }

  async function workByScholarTitle(title) {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle || cleanTitle.length < 8) return null;
    const params = new URLSearchParams({ search: cleanTitle, per_page: '5' });
    const res = await fetch(`https://api.openalex.org/works?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const works = Array.isArray(data.results) ? data.results : [];
    return works.find((work) => sameScholarTitle(cleanTitle, work && work.display_name)) || null;
  }

  async function resolveJournalName(entry) {
    if (!entry) return null;
    if (entry.doi) {
      const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(entry.doi)}`);
      if (res.ok) {
        const hit = journalFromOpenAlexWork(await res.json());
        if (hit) return hit;
      }
    }
    const work = await workByScholarTitle(entry.paperTitle);
    if (work) return journalFromOpenAlexWork(work);
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
      authors: entry.authors,
      year: entry.year,
      url: entry.rowEl.querySelector('.gs_rt a[href]')?.href || location.href,
      pdfUrl: entry.pdfUrl,
    };
    const wrap = document.createElement('div');
    wrap.className = 'ailatest-scholar-inline-tools';
    wrap.dataset.ailatestUi = '1';
    wrap.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin:2px 0 4px;';
    const sources = ns.citations && ns.citations.renderSourceLinks ? ns.citations.renderSourceLinks(data) : null;
    const tools = ns.citations && ns.citations.renderTools ? ns.citations.renderTools(data) : null;
    if (sources) wrap.appendChild(sources);
    if (tools) wrap.appendChild(tools);
    if (wrap.childNodes.length) line.insertAdjacentElement('afterend', wrap);
  }

  ns.adapters.push({
    id: 'google-scholar',
    match: (host) => /^scholar\.google\./i.test(host) || /^(xs2\.dailyheadlines\.cc|scholar\.lanfanshu\.cn)$/i.test(host),
    findEntries,
    insert,
    afterLookup,
    ensureTools: ensureScholarTools,
    ensureProfileImport,
    updateStatus,
    insertOpenAccessButton,
    resolveJournalName,
  });
})(globalThis);
