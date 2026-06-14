(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  ns.adapters = ns.adapters || [];

  function textOf(el) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function doiFromText(value) {
    const m = String(value || '').match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    return m ? m[0].replace(/[)\].,;]+$/, '') : '';
  }

  function titleFromScope(scope) {
    return textOf(scope && scope.querySelector('.docsum-title, .heading-title, h1'));
  }

  function authorsFromScope(scope) {
    const txt = textOf(scope && scope.querySelector('.docsum-authors, .authors-list'));
    return txt ? txt.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 20) : [];
  }

  function yearFromText(value) {
    const m = String(value || '').match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  function enrichEntry(anchorEl, journalName, scope) {
    const citationText = textOf(anchorEl);
    const pmid = textOf(scope && scope.querySelector('.docsum-pmid, .current-id')).replace(/\D+/g, '');
    return {
      anchorEl,
      journalName,
      doi: doiFromText(citationText),
      paperTitle: titleFromScope(scope),
      authors: authorsFromScope(scope),
      year: yearFromText(citationText),
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : location.href,
    };
  }

  // 详情页：标题触发器的 title 属性是完整刊名（最可靠）；搜索结果只有 ISO 缩写。
  function findEntries() {
    const out = [];

    const trigger = document.querySelector('#full-view-journal-trigger');
    if (trigger) {
      const full = trigger.getAttribute('title') || textOf(trigger);
      if (full) out.push(enrichEntry(trigger, full, document.querySelector('.article-page, .full-view, main') || document));
    }

    document.querySelectorAll('.docsum-journal-citation, .full-journal-citation').forEach((el) => {
      // "N Engl J Med. 2020 Jan;382(1):1-10." → 取首段刊名（缩写）
      const m = textOf(el).match(/^([^.;]+)/);
      const name = m && ns.cleanJournalName(m[1]);
      if (name && ns.likelyJournalName(name)) {
        out.push(enrichEntry(el, name, el.closest('.docsum-content, .full-view, .docsum, article') || el.parentElement));
      }
    });

    return out;
  }

  function insert(anchorEl, badgeNode) {
    if (!anchorEl || !badgeNode) return;
    const scope = anchorEl.closest('.docsum-content, .full-view, .docsum, article') || anchorEl.parentElement || document;
    scope.querySelectorAll('.ailatest-badge-line').forEach((el) => el.remove());
    const span = document.createElement('span');
    span.className = 'ailatest-badge-line';
    span.dataset.ailatestUi = '1';
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.flexWrap = 'wrap';
    span.style.gap = '4px';
    span.style.marginLeft = '6px';
    span.appendChild(badgeNode);
    anchorEl.insertAdjacentElement('afterend', span);
  }

  function sourceFromOpenAlexWork(work) {
    const source = work && (work.primary_location && work.primary_location.source
      || work.host_venue
      || work.best_oa_location && work.best_oa_location.source);
    if (!source) return null;
    const name = source.display_name || source.display_name_alternatives && source.display_name_alternatives[0] || '';
    const issn = source.issn_l || Array.isArray(source.issn) && source.issn[0] || '';
    return name || issn ? { name, issn } : null;
  }

  async function resolveJournalName(entry) {
    if (!entry || !entry.doi) return null;
    const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(entry.doi)}`);
    if (!res.ok) return null;
    return sourceFromOpenAlexWork(await res.json());
  }

  function insertOpenAccessButton(entry) {
    if (!entry || !entry.anchorEl) return;
    const scope = entry.anchorEl.closest('.docsum-content, .full-view, .docsum, article') || entry.anchorEl.parentElement;
    if (!scope || scope.querySelector('.ailatest-pubmed-tools')) return;
    const data = {
      doi: entry.doi,
      title: entry.paperTitle,
      journal: entry.journalName,
      authors: entry.authors,
      year: entry.year,
      url: entry.url,
    };
    const block = document.createElement('div');
    block.className = 'ailatest-pubmed-tools';
    block.dataset.ailatestUi = '1';
    block.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0 2px;';
    const sources = ns.citations && ns.citations.renderSourceLinks ? ns.citations.renderSourceLinks(data) : null;
    const tools = ns.citations && ns.citations.renderTools ? ns.citations.renderTools(data) : null;
    if (sources) block.appendChild(sources);
    if (tools) block.appendChild(tools);
    if (!block.childNodes.length) return;
    const badgeLine = scope.querySelector('.ailatest-badge-line');
    (badgeLine || entry.anchorEl).insertAdjacentElement('afterend', block);
  }

  ns.adapters.push({
    id: 'pubmed',
    match: (host) => /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/i.test(host),
    findEntries,
    insert,
    resolveJournalName,
    insertOpenAccessButton,
  });
})(globalThis);
