(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  ns.adapters = ns.adapters || [];

  function textOf(el) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function cleanScholarSource(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';

    const parts = raw.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    let source = parts.length >= 2 ? parts[1] : raw;
    source = source
      .replace(/^(?:[A-Z][\w'.-]+(?:,\s*| and\s+| &\s+)){1,8}/, '')
      .replace(/\b(?:19|20)\d{2}\b.*$/g, '')
      .replace(/\b\d+\s*(?:\(\d+\))?\s*[:,]\s*\d+.*$/g, '')
      .replace(/\s*,\s*$/, '')
      .trim();

    source = ns.cleanJournalName(source);
    if (!source || !ns.likelyJournalName(source)) return '';
    if (/^(?:citations?|related articles|all versions)$/i.test(source)) return '';
    return source;
  }

  function findEntries() {
    const out = [];
    document.querySelectorAll('.gs_ri').forEach((row) => {
      const meta = row.querySelector('.gs_a');
      const title = row.querySelector('.gs_rt') || meta || row;
      const journalName = cleanScholarSource(textOf(meta));
      if (journalName) out.push({ anchorEl: title, journalName });
    });
    return out;
  }

  function insert(anchorEl, badgeNode) {
    const line = document.createElement('div');
    line.className = 'ailatest-badge-block';
    line.style.display = 'flex';
    line.style.flexWrap = 'wrap';
    line.style.alignItems = 'center';
    line.style.gap = '4px';
    line.style.margin = '3px 0 2px';
    line.appendChild(badgeNode);

    const meta = anchorEl && anchorEl.parentElement ? anchorEl.parentElement.querySelector('.gs_a') : null;
    (meta || anchorEl).insertAdjacentElement('afterend', line);
  }

  ns.adapters.push({
    id: 'google-scholar',
    match: (host) => /^scholar\.google\./i.test(host),
    findEntries,
    insert
  });
})(globalThis);
