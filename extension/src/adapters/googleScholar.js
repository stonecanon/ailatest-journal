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
          pdfUrl: pdfUrlFromRow(row),
          originalIndex: index,
        });
      }
    });
    return out;
  }

  function insert(anchorEl, badgeNode) {
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
    bar.innerHTML = '<b style="font-size:12px">AILatest 排序</b><button data-aj-sort="if">按 IF</button><button data-aj-sort="cites">按引用量</button><button data-aj-sort="original">恢复原顺序</button><span id="ailatest-scholar-status" style="color:#8a7d6a">已加载，正在识别期刊...</span>';
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
      text = '已加载，正在识别期刊...';
    } else if (info.phase === 'empty') {
      text = '已加载，但未识别到期刊来源；请等页面加载完成或刷新';
    } else if (info.phase === 'lookup') {
      text = `识别到 ${info.total || 0} 本，正在查询：${(info.names || []).join('；')}`;
    } else if (info.phase === 'done') {
      text = `识别到 ${info.total || 0} 本，命中 ${info.hits || 0} 本${info.hits ? '' : `；已试：${(info.names || []).join('；')}`}`;
    } else if (info.phase === 'error') {
      text = `查询失败：${info.message || 'unknown error'}`;
    }
    if (text && el.textContent !== text) el.textContent = text;
  }

  function sortScholar(mode) {
    const rows = Array.from(document.querySelectorAll('.gs_r')).filter((row) => row.parentElement);
    if (!rows.length) return;
    const parent = rows[0].parentElement;
    const value = (row) => {
      if (mode === 'if') return Number(row.dataset.ailatestIf || 0);
      if (mode === 'cites') return Number(row.dataset.ailatestCites || 0);
      return -Number(row.dataset.ailatestOriginalIndex || 0);
    };
    rows.sort((a, b) => value(b) - value(a));
    rows.forEach((row) => parent.appendChild(row));
  }

  function insertOpenAccessButton(entry) {
    if (!entry || !entry.rowEl || entry.rowEl.querySelector('.ailatest-oa-btn')) return;
    const actions = entry.rowEl.querySelector('.gs_fl') || entry.anchorEl;
    if (!actions) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ailatest-oa-btn';
    btn.dataset.ailatestUi = '1';
    btn.textContent = entry.pdfUrl ? 'OA PDF' : '开放全文';
    btn.title = '仅查找合法开放获取全文；不接入 Sci-Hub';
    btn.style.cssText = 'margin-left:8px;border:1px solid #d8cbb9;background:#fffdf8;border-radius:4px;padding:1px 6px;color:#6b3f18;font-size:12px;cursor:pointer;';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (entry.pdfUrl) {
        window.open(entry.pdfUrl, '_blank', 'noopener');
        return;
      }
      if (!entry.doi) {
        alert('没有在当前结果里识别到 DOI，暂时无法自动查找公开全文。');
        return;
      }
      const old = btn.textContent;
      btn.textContent = '查找中...';
      btn.disabled = true;
      try {
        const url = `https://api.openalex.org/works/doi:${encodeURIComponent(entry.doi)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
        const data = await res.json();
        const locs = [data.best_oa_location, ...(Array.isArray(data.oa_locations) ? data.oa_locations : [])].filter(Boolean);
        const hit = locs.find((x) => x.pdf_url || x.landing_page_url) || null;
        const oaUrl = hit && (hit.pdf_url || hit.landing_page_url);
        if (!oaUrl) throw new Error('no_open_access_url');
        window.open(oaUrl, '_blank', 'noopener');
      } catch (_) {
        alert('没有找到公开可下载全文。插件不会跳转 Sci-Hub，只支持公开 OA 来源。');
      } finally {
        btn.textContent = old;
        btn.disabled = false;
      }
    });
    actions.appendChild(btn);
  }

  ns.adapters.push({
    id: 'google-scholar',
    match: (host) => /^scholar\.google\./i.test(host),
    findEntries,
    insert,
    afterLookup,
    ensureTools: ensureScholarTools,
    updateStatus,
    insertOpenAccessButton,
  });
})(globalThis);
