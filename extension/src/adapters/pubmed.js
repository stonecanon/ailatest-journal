(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  ns.adapters = ns.adapters || [];

  function textOf(el) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  // 详情页：标题触发器的 title 属性是完整刊名（最可靠）；搜索结果只有 ISO 缩写。
  function findEntries() {
    const out = [];

    const trigger = document.querySelector('#full-view-journal-trigger');
    if (trigger) {
      const full = trigger.getAttribute('title') || textOf(trigger);
      if (full) out.push({ anchorEl: trigger, journalName: full });
    }

    document.querySelectorAll('.docsum-journal-citation, .full-journal-citation').forEach((el) => {
      // "N Engl J Med. 2020 Jan;382(1):1-10." → 取首段刊名（缩写）
      const m = textOf(el).match(/^([^.;]+)/);
      const name = m && ns.cleanJournalName(m[1]);
      if (name && ns.likelyJournalName(name)) out.push({ anchorEl: el, journalName: name });
    });

    return out;
  }

  function insert(anchorEl, badgeNode) {
    if (!anchorEl || !badgeNode) return;
    const span = document.createElement('span');
    span.className = 'ailatest-badge-line';
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.flexWrap = 'wrap';
    span.style.gap = '4px';
    span.style.marginLeft = '6px';
    span.appendChild(badgeNode);
    anchorEl.insertAdjacentElement('afterend', span);
  }

  ns.adapters.push({
    id: 'pubmed',
    match: (host) => /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/i.test(host),
    findEntries,
    insert,
  });
})(globalThis);
