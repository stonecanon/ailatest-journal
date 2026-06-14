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
    out.push({ anchorEl, journalName: hit ? hit.journalName : '', issn: extra.issn || '' });
  }

  function detailEntries() {
    const out = [];
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
      pushEntry(out, a, textOf(a), { issn: issnFromText(a.href || '') });
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
        pushEntry(out, sourceAnchor, labeled, { issn });
        return;
      }
      const anchors = Array.from(tr.querySelectorAll('a'));
      const sourceAnchor = anchors.find((a) => /(?:knavi|journals|dbcode=CJFD|dbcode=CCND|source|journal)/i.test(a.href || ''));
      if (sourceAnchor) {
        pushEntry(out, sourceAnchor, textOf(sourceAnchor), { issn });
        return;
      }
      const likelyCell = cells.find((td) => /(?:来源|刊名|出处|期刊|ISSN|CN\s*\d+)/i.test(textOf(td)));
      if (likelyCell) {
        const name = journalFromLabeledText(textOf(likelyCell));
        if (name || issn) pushEntry(out, likelyCell.querySelector('a') || likelyCell, name || textOf(likelyCell), { issn });
      }
    });

    document.querySelectorAll('.source, [class*="source"], .result-source, .result-item, .list-item, .fz14').forEach((el) => {
      const anchor = el.querySelector('a') || el;
      const name = journalFromLabeledText(textOf(el)) || textOf(anchor);
      pushEntry(out, anchor, name, { issn: issnFromText(textOf(el)) });
    });

    return out;
  }

  function insert(anchorEl, badgeNode) {
    if (!anchorEl || !badgeNode) return;
    const scope = anchorEl.closest('tr, .result-item, .list-item, [class*="result"], [class*="item"]') || anchorEl.parentElement || document;
    scope.querySelectorAll('.ailatest-badge-line, .ailatest-badge-block').forEach((el) => el.remove());
    const container = document.createElement('span');
    container.className = 'ailatest-badge-line';
    container.dataset.ailatestUi = '1';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.flexWrap = 'wrap';
    container.style.gap = '4px';
    container.style.marginLeft = '0';
    container.style.textAlign = 'left';
    container.appendChild(badgeNode);

    if (anchorEl.closest('td')) {
      anchorEl.insertAdjacentElement('afterend', container);
    } else {
      const line = document.createElement('div');
      line.className = 'ailatest-badge-block';
      line.dataset.ailatestUi = '1';
      line.style.display = 'flex';
      line.style.justifyContent = 'flex-start';
      line.style.alignItems = 'flex-start';
      line.style.textAlign = 'left';
      line.style.margin = '4px 0 6px 0';
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
