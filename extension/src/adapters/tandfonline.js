(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  ns.adapters = ns.adapters || [];

  function textOf(el) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function meta(name) {
    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el ? (el.getAttribute('content') || '').trim() : '';
  }

  function journalName() {
    return meta('citation_journal_title')
      || meta('dc.Source')
      || textOf(document.querySelector('[data-testid="journal-title"], .journal-heading, .journal-title, a[href*="/journals/"]'));
  }

  function doi() {
    const fromMeta = meta('citation_doi') || meta('dc.Identifier');
    if (fromMeta) return fromMeta.replace(/^doi:\s*/i, '').trim();
    const m = location.pathname.match(/10\.\d{4,9}\/[^/?#]+/i);
    return m ? decodeURIComponent(m[0]) : '';
  }

  function paperTitle() {
    return meta('citation_title')
      || meta('dc.Title')
      || meta('og:title')
      || textOf(document.querySelector('h1'));
  }

  function anchor() {
    return document.querySelector('h1')
      || document.querySelector('[data-testid="journal-title"], .journal-heading, .journal-title')
      || document.body;
  }

  function findEntries() {
    const name = journalName();
    const d = doi();
    if (!name && !d) return [];
    return [{
      anchorEl: anchor(),
      rowEl: document.body,
      journalName: name,
      doi: d,
      paperTitle: paperTitle(),
      originalIndex: 0,
    }];
  }

  function insert(anchorEl, badgeNode) {
    if (!anchorEl || !badgeNode || document.querySelector('.ailatest-tandf-badge-block')) return;
    const block = document.createElement('div');
    block.className = 'ailatest-tandf-badge-block';
    block.dataset.ailatestUi = '1';
    block.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin:8px 0 10px;';
    block.appendChild(badgeNode);
    if (ns.citations) {
      const extra = { doi: doi(), title: paperTitle(), journal: journalName() };
      const cite = ns.citations.renderTools(extra);
      const sources = ns.citations.renderSourceLinks(extra);
      if (sources) block.appendChild(sources);
      if (cite) block.appendChild(cite);
      ns.citations.renderCitationCounts(extra).then((counts) => {
        if (counts && block.isConnected) block.appendChild(counts);
      }).catch(() => {});
    }
    anchorEl.insertAdjacentElement('afterend', block);
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
    if (!entry || !entry.doi) return null;
    const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(entry.doi)}`);
    if (!res.ok) return null;
    return journalFromOpenAlexWork(await res.json());
  }

  ns.adapters.push({
    id: 'tandfonline',
    match: (host) => /(^|\.)tandfonline\.com$/i.test(host),
    findEntries,
    insert,
    resolveJournalName,
  });
})(globalThis);
