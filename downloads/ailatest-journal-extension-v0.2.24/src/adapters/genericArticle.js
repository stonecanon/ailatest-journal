(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  ns.adapters = ns.adapters || [];

  const SUPPORTED_HOSTS = [
    /(^|\.)link\.springer\.com$/i,
    /(^|\.)ieeexplore\.ieee\.org$/i,
    /(^|\.)dblp\.uni-trier\.de$/i,
    /(^|\.)webofknowledge\.com$/i,
    /(^|\.)webofscience\.com$/i,
    /(^|\.)xueshu\.baidu\.com$/i,
    /(^|\.)aminer\.cn$/i,
    /(^|\.)readpaper\.com$/i,
    /(^|\.)sciencedirect\.com$/i,
    /(^|\.)tsgyun\.com$/i,
    /(^|\.)embase\.com$/i,
    /(^|\.)scopus\.com$/i,
    /(^|\.)airitilibrary\.com$/i,
    /(^|\.)x-mol\.com$/i,
    /(^|\.)mdpi\.com$/i,
    /(^|\.)wiley\.com$/i,
    /(^|\.)onlinelibrary\.wiley\.com$/i,
    /(^|\.)mitpressjournals\.org$/i,
    /(^|\.)scilit\.com$/i,
    /(^|\.)europepmc\.org$/i,
    /(^|\.)semanticscholar\.org$/i,
    /(^|\.)arxiv\.org$/i,
  ];

  function textOf(el) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function meta(name) {
    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el ? (el.getAttribute('content') || '').trim() : '';
  }

  function doiFromPage() {
    const fromMeta = meta('citation_doi') || meta('dc.Identifier') || meta('dc.identifier');
    if (fromMeta) return fromMeta.replace(/^doi:\s*/i, '').trim();
    const texts = [location.href, textOf(document.querySelector('main, article, body'))];
    for (const value of texts) {
      const m = String(value || '').match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      if (m) return m[0].replace(/[)\].,;]+$/, '');
    }
    return '';
  }

  function journalName() {
    return meta('citation_journal_title')
      || meta('prism.publicationName')
      || meta('dc.Source')
      || meta('dc.source')
      || textOf(document.querySelector('[data-test="journal-title"], [data-testid="journal-title"], .journal-title, .JournalTitle, .publication-title, .issueSerialNavigation'));
  }

  function paperTitle() {
    return meta('citation_title')
      || meta('dc.Title')
      || meta('dc.title')
      || meta('og:title')
      || textOf(document.querySelector('h1'));
  }

  function anchor() {
    return document.querySelector('h1')
      || document.querySelector('[data-test="journal-title"], [data-testid="journal-title"], .journal-title, .publication-title')
      || document.body;
  }

  function findEntries() {
    const name = journalName();
    const doi = doiFromPage();
    if (!name && !doi) return [];
    return [{
      anchorEl: anchor(),
      rowEl: document.body,
      journalName: name,
      doi,
      paperTitle: paperTitle(),
      originalIndex: 0,
    }];
  }

  function insert(anchorEl, badgeNode, entry) {
    if (!anchorEl || !badgeNode || document.querySelector('.ailatest-generic-article-tools')) return;
    const block = document.createElement('div');
    block.className = 'ailatest-generic-article-tools';
    block.dataset.ailatestUi = '1';
    block.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin:8px 0 12px;';
    block.appendChild(badgeNode);
    if (ns.citations) {
      const extra = { doi: entry && entry.doi, title: entry && entry.paperTitle, journal: entry && entry.journalName };
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
    id: 'generic-article',
    match: (host) => SUPPORTED_HOSTS.some((re) => re.test(host)),
    findEntries,
    insert,
    resolveJournalName,
  });
})(globalThis);
