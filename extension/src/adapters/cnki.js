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

  function detailEntries() {
    const out = [];
    const selectors = [
      'a[href*="navi.cnki.net/knavi/journals"]',
      'a[href*="knavi.cnki.net/knavi/journals"]',
      'a[href*="dbcode=CJFD"]',
      '.sourinfo a',
      '.wxBaseinfo a',
      '.top-tip a'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((a) => {
      const hit = entry(a, textOf(a));
      if (hit) out.push(hit);
    });
    return out;
  }

  function resultRows() {
    const out = [];

    document.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.cells || []);
      if (cells.length < 4) return;
      const sourceCell = cells[3];
      const sourceAnchor = sourceCell.querySelector('a') || sourceCell;
      const hit = entry(sourceAnchor, textOf(sourceAnchor));
      if (hit) out.push(hit);
    });

    document.querySelectorAll('.source, [class*="source"], .result-source').forEach((el) => {
      const anchor = el.querySelector('a') || el;
      const hit = entry(anchor, textOf(anchor));
      if (hit) out.push(hit);
    });

    return out;
  }

  function insert(anchorEl, badgeNode) {
    if (!anchorEl || !badgeNode) return;
    const container = document.createElement('span');
    container.className = 'ailatest-badge-line';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.flexWrap = 'wrap';
    container.style.gap = '4px';
    container.style.marginLeft = '6px';
    container.appendChild(badgeNode);

    if (anchorEl.closest('td')) {
      anchorEl.insertAdjacentElement('afterend', container);
    } else {
      const line = document.createElement('div');
      line.className = 'ailatest-badge-block';
      line.style.margin = '4px 0 6px';
      line.appendChild(badgeNode);
      anchorEl.insertAdjacentElement('afterend', line);
    }
  }

  ns.adapters.push({
    id: 'cnki',
    match: (host) => /(^|\.)cnki\.net$/i.test(host),
    findEntries: () => [...detailEntries(), ...resultRows()],
    insert
  });
})(globalThis);
