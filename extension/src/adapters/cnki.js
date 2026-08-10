(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  ns.adapters = ns.adapters || [];

  function textOf(el) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function entry(anchorEl, rawName) {
    const journalName = ns.cleanJournalName(rawName);
    if (!ns.likelyJournalName(journalName)) return null;
    return { anchorEl, journalName };
  }

  function issnFromText(value) {
    const m = String(value || '').match(/\b\d{4}-\d{3}[\dXx]\b/);
    return m ? m[0] : '';
  }

  function journalFromLabeledText(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    const patterns = [
      /(?:来源|刊名|出处|期刊|Source|Journal)\s*[:：]\s*《?([^》,，;；|]{2,60})/i,
      /《([^》]{2,60})》/,
    ];
    for (const re of patterns) {
      const m = raw.match(re);
      if (!m) continue;
      const name = ns.cleanJournalName(m[1]);
      if (ns.likelyJournalName(name)) return name;
    }
    return '';
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  }

  function hasUsefulText(el) {
    return isVisible(el) && textOf(el).length > 0;
  }

  function looksLikeDate(value) {
    return /(?:19|20)\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2})?/.test(String(value || ''));
  }

  function looksLikeDocType(value) {
    return /^(?:期刊|会议|学位|报纸|图书|专利|标准|成果|法规|年鉴|Journal|Conference|Dissertation|Patent)$/i.test(String(value || '').trim());
  }

  function looksLikeJournalCell(el) {
    const raw = textOf(el);
    const name = ns.cleanJournalName(raw);
    if (!ns.likelyJournalName(name)) return false;
    if (/[\u4e00-\u9fff]/.test(name) && name.length > 34) return false;
    if (looksLikeDate(raw) || looksLikeDocType(raw)) return false;
    if (issnFromText(raw) && raw.length < 12) return false;
    if (/^(?:作者|题名|篇名|摘要|关键词|下载|被引|收藏|分享|导出)$/i.test(name)) return false;
    if (/[。！？!?]\s*$/.test(raw)) return false;
    return true;
  }

  function isHeaderRow(tr) {
    if (!tr) return false;
    if ((tr.querySelectorAll && tr.querySelectorAll('th').length)) return true;
    const text = textOf(tr);
    return /题名/.test(text) && /(?:作者|来源|发表时间|数据库|类型)/.test(text);
  }

  function headerSourceIndex(tr) {
    const table = tr && tr.closest && tr.closest('table');
    if (!table) return -1;
    const rows = Array.from(table.querySelectorAll('tr')).slice(0, 4);
    for (const row of rows) {
      if (row === tr) continue;
      const cells = Array.from(row.cells || []).filter(hasUsefulText);
      const index = cells.findIndex((cell) => /^(?:来源|刊名|期刊|期刊名|Source|Journal|Publication)$/i.test(textOf(cell)));
      if (index >= 0) return index;
    }
    return -1;
  }

  function previousCandidateCell(cells, startIndex) {
    for (let i = startIndex; i >= 0; i -= 1) {
      const cell = cells[i];
      if (!cell || !looksLikeJournalCell(cell)) continue;
      return cell;
    }
    return null;
  }

  function journalCellFromTableRow(tr) {
    const cells = Array.from(tr.cells || []).filter(hasUsefulText);
    if (cells.length < 3) return null;

    const headerIndex = headerSourceIndex(tr);
    if (headerIndex >= 0 && cells[headerIndex] && looksLikeJournalCell(cells[headerIndex])) {
      return cells[headerIndex];
    }

    const dateIndex = cells.findIndex((cell) => looksLikeDate(textOf(cell)));
    if (dateIndex > 0) {
      const cell = previousCandidateCell(cells, dateIndex - 1);
      if (cell) return cell;
    }

    const typeIndex = cells.findIndex((cell) => looksLikeDocType(textOf(cell)));
    if (typeIndex > 0) {
      const cell = previousCandidateCell(cells, typeIndex - 1);
      if (cell) return cell;
    }

    const linkedSource = cells
      .map((cell) => cell.querySelector('a[href*="knavi"], a[href*="journal"], a[href*="dbcode=CJFD"], a[href*="dbcode=CCND"]'))
      .find(Boolean);
    return linkedSource ? linkedSource.closest('td, [role="cell"]') : null;
  }

  function rowCells(row) {
    if (!row || row.tagName === 'TR') return Array.from(row.cells || []).filter(hasUsefulText);
    const direct = Array.from(row.children || []).filter(hasUsefulText);
    if (direct.length >= 3) return direct;
    return Array.from(row.querySelectorAll('[role="cell"], [class*="cell"], [class*="col"], li')).filter(hasUsefulText);
  }

  function journalCellFromListRow(row) {
    const cells = rowCells(row);
    if (cells.length < 3) return null;
    const sourceCell = cells.find((cell) => /(?:来源|刊名|期刊|Source|Journal)\s*[:：]/i.test(textOf(cell)) && looksLikeJournalCell(cell));
    if (sourceCell) return sourceCell;
    const dateIndex = cells.findIndex((cell) => looksLikeDate(textOf(cell)));
    if (dateIndex > 0) return previousCandidateCell(cells, dateIndex - 1);
    const typeIndex = cells.findIndex((cell) => looksLikeDocType(textOf(cell)));
    if (typeIndex > 0) return previousCandidateCell(cells, typeIndex - 1);
    return null;
  }

  function pushEntry(out, anchorEl, rawName, extra = {}) {
    if (!anchorEl) return;
    const hit = entry(anchorEl, rawName);
    if (!hit && !extra.issn) return;
    if (anchorEl.tagName === 'TR') return;
    out.push({
      anchorEl,
      journalName: hit ? hit.journalName : '',
      issn: extra.issn || '',
      placement: extra.placement || 'list'
    });
  }

  function detailTitleEl() {
    const selectors = [
      '.wx-tit h1',
      '.brief h1',
      '.doc-top h1',
      '.article h1',
      '.title h1',
      'h1'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && textOf(el).length > 5) return el;
    }
    return null;
  }

  function isDetailPage() {
    if (/\/kcms\d*\/|\/KCMS\d*\/|\/kns\/detail|[?&]dbcode=/i.test(location.href)) return true;
    return !!document.querySelector('.wx-tit, .brief, .doc-top, .wxBaseinfo, .sourinfo, .top-tip');
  }

  function detailEntries() {
    const out = [];
    if (!isDetailPage()) return out;
    const selectors = [
      'a[href*="navi.cnki.net/knavi/journals"]',
      'a[href*="knavi.cnki.net/knavi/journals"]',
      'a[href*="dbcode=CJFD"]',
      'a[href*="dbcode=CCND"]',
      'a[href*="Journal"]',
      'a[href*="journal"]',
      '.sourinfo a',
      '.wxBaseinfo a',
      '.top-tip a',
      '.source a',
      '[class*="source"] a'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((a) => {
      pushEntry(out, a, textOf(a), { issn: issnFromText(a.href || ''), placement: 'detail' });
    });
    return out;
  }

  function resultRows() {
    const out = [];

    document.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.cells || []);
      if (!cells.length) return;
      if (isHeaderRow(tr)) return;
      const rowText = textOf(tr);
      const issn = issnFromText(rowText);
      const inferredCell = journalCellFromTableRow(tr);
      if (inferredCell) {
        const anchor = inferredCell.querySelector('a') || inferredCell;
        pushEntry(out, anchor, textOf(inferredCell), { issn, placement: 'list' });
        return;
      }
      const labeled = journalFromLabeledText(rowText);
      if (labeled) {
        const sourceAnchor = Array.from(tr.querySelectorAll('a')).find((a) => textOf(a).includes(labeled)) || tr;
        if (sourceAnchor !== tr) pushEntry(out, sourceAnchor, labeled, { issn });
        return;
      }
      const anchors = Array.from(tr.querySelectorAll('a'));
      const sourceAnchor = anchors.find((a) => /(?:knavi|journals|dbcode=CJFD|dbcode=CCND|source|journal)/i.test(a.href || ''));
      if (sourceAnchor) {
        pushEntry(out, sourceAnchor, textOf(sourceAnchor), { issn });
        return;
      }
    });

    document.querySelectorAll('[role="row"], .result-item, .list-item, [class*="result-item"], [class*="list-item"], [class*="resultRow"], [class*="result-row"]').forEach((row) => {
      if (row.tagName === 'TR' || row.closest('tr')) return;
      const cell = journalCellFromListRow(row);
      if (!cell) return;
      const anchor = cell.querySelector('a') || cell;
      pushEntry(out, anchor, textOf(cell), { issn: issnFromText(textOf(row)), placement: 'list' });
    });

    document.querySelectorAll('.source, [class*="source"], .result-source, .result-item, .list-item, .fz14').forEach((el) => {
      const anchor = el.querySelector('a') || el;
      if (!anchor || anchor === el) return;
      const name = journalFromLabeledText(textOf(el)) || textOf(anchor);
      pushEntry(out, anchor, name, { issn: issnFromText(textOf(el)) });
    });

    return out;
  }

  function insert(anchorEl, badgeNode, entryInfo) {
    if (!anchorEl || !badgeNode) return;
    const isDetail = entryInfo && entryInfo.placement === 'detail';
    if (isDetail) badgeNode.setAttribute('data-align', 'center');
    if (badgeNode.dataset) delete badgeNode.dataset.nowrap;
    badgeNode.removeAttribute('data-nowrap');
    const scope = anchorEl.closest('tr, .result-item, .list-item, [class*="result"], [class*="item"]') || anchorEl.parentElement || document;
    scope.querySelectorAll('.ailatest-badge-line, .ailatest-badge-block').forEach((el) => el.remove());
    const tableCell = !isDetail && anchorEl.closest && anchorEl.closest('td, [role="cell"]');
    const inTableCell = !!tableCell;
    const container = document.createElement(inTableCell ? 'div' : 'span');
    container.className = 'ailatest-badge-line';
    container.dataset.ailatestUi = '1';
    container.style.display = inTableCell ? 'block' : 'inline-flex';
    container.style.alignItems = 'flex-start';
    container.style.flexWrap = 'wrap';
    container.style.gap = '4px';
    container.style.maxWidth = '100%';
    container.style.overflow = 'visible';
    container.style.whiteSpace = 'normal';
    container.style.marginLeft = '0';
    container.style.marginTop = inTableCell ? '3px' : '0';
    container.style.textAlign = 'left';
    container.style.verticalAlign = 'middle';
    badgeNode.style.display = 'block';
    badgeNode.style.width = '100%';
    badgeNode.style.maxWidth = '100%';
    badgeNode.style.whiteSpace = 'normal';
    container.appendChild(badgeNode);

    if (inTableCell) {
      container.style.width = '100%';
      container.style.minWidth = '0';
      if (anchorEl === tableCell) tableCell.appendChild(container);
      else anchorEl.insertAdjacentElement('afterend', container);
    } else {
      const line = document.createElement('div');
      line.className = 'ailatest-badge-block';
      line.dataset.ailatestUi = '1';
      line.style.display = 'flex';
      line.style.justifyContent = isDetail ? 'center' : 'flex-start';
      line.style.alignItems = 'center';
      line.style.flexWrap = 'wrap';
      line.style.maxWidth = '100%';
      line.style.overflow = 'visible';
      line.style.whiteSpace = 'normal';
      line.style.textAlign = isDetail ? 'center' : 'left';
      line.style.margin = isDetail ? '8px 0 10px 0' : '2px 0 4px 0';
      line.appendChild(badgeNode);
      const titleEl = isDetail ? detailTitleEl() : null;
      (titleEl || anchorEl).insertAdjacentElement('afterend', line);
    }
  }

  ns.adapters.push({
    id: 'cnki',
    match: (host) => /(^|\.)cnki\.net$/i.test(host),
    findEntries: () => [...detailEntries(), ...resultRows()],
    insert
  });
})(globalThis);
