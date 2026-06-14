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
      const rowText = textOf(tr);
      const issn = issnFromText(rowText);
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
    if (badgeNode.dataset) delete badgeNode.dataset.nowrap;
    badgeNode.removeAttribute('data-nowrap');
    const scope = anchorEl.closest('tr, .result-item, .list-item, [class*="result"], [class*="item"]') || anchorEl.parentElement || document;
    scope.querySelectorAll('.ailatest-badge-line, .ailatest-badge-block').forEach((el) => el.remove());
    const inTableCell = !!anchorEl.closest('td');
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
      anchorEl.insertAdjacentElement('afterend', container);
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