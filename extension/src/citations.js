(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escBib(value) {
    return clean(value).replace(/[{}\\]/g, '\\$&');
  }

  function meta(name) {
    const values = Array.from(document.querySelectorAll(`meta[name="${name}"], meta[property="${name}"]`))
      .map((el) => clean(el.getAttribute('content')))
      .filter(Boolean);
    return values;
  }

  function first(...values) {
    for (const value of values.flat()) {
      const v = clean(value);
      if (v) return v;
    }
    return '';
  }

  function yearOf(data) {
    const date = first(data.date, data.year);
    const m = date.match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  function authorsText(authors, joiner = ', ') {
    return (authors || []).map(clean).filter(Boolean).join(joiner);
  }

  function citationKey(data) {
    const firstAuthor = clean((data.authors || [])[0] || 'article').split(/\s+/).pop() || 'article';
    return `${firstAuthor}${yearOf(data) || 'nd'}`.replace(/[^a-z0-9_:-]/gi, '');
  }

  function fromDocument(extra = {}) {
    const doi = first(extra.doi, meta('citation_doi'), meta('dc.Identifier')).replace(/^doi:\s*/i, '');
    return {
      title: first(extra.title, meta('citation_title'), meta('dc.Title'), meta('og:title'), document.title),
      journal: first(extra.journal, meta('citation_journal_title'), meta('dc.Source')),
      authors: (extra.authors && extra.authors.length ? extra.authors : meta('citation_author')).map(clean).filter(Boolean),
      year: first(extra.year, meta('citation_publication_date'), meta('citation_online_date'), meta('dc.Date')),
      date: first(extra.date, meta('citation_publication_date'), meta('citation_online_date'), meta('dc.Date')),
      volume: first(extra.volume, meta('citation_volume')),
      issue: first(extra.issue, meta('citation_issue')),
      firstPage: first(extra.firstPage, meta('citation_firstpage')),
      lastPage: first(extra.lastPage, meta('citation_lastpage')),
      doi,
      issn: first(extra.issn, meta('citation_issn'), meta('citation_eissn')),
      url: first(extra.url, meta('citation_public_url'), meta('og:url'), location.href),
      pdfUrl: first(extra.pdfUrl, meta('citation_pdf_url')),
    };
  }

  function ris(data) {
    const lines = ['TY  - JOUR'];
    (data.authors || []).forEach((a) => lines.push(`AU  - ${a}`));
    if (data.title) lines.push(`TI  - ${data.title}`);
    if (data.journal) lines.push(`JO  - ${data.journal}`);
    if (yearOf(data)) lines.push(`PY  - ${yearOf(data)}`);
    if (data.volume) lines.push(`VL  - ${data.volume}`);
    if (data.issue) lines.push(`IS  - ${data.issue}`);
    if (data.firstPage) lines.push(`SP  - ${data.firstPage}`);
    if (data.lastPage) lines.push(`EP  - ${data.lastPage}`);
    if (data.doi) lines.push(`DO  - ${data.doi}`);
    if (data.url) lines.push(`UR  - ${data.url}`);
    if (data.pdfUrl) lines.push(`L1  - ${data.pdfUrl}`);
    lines.push('ER  - ');
    return lines.join('\r\n') + '\r\n';
  }

  function enw(data) {
    const lines = ['%0 Journal Article'];
    (data.authors || []).forEach((a) => lines.push(`%A ${a}`));
    if (data.title) lines.push(`%T ${data.title}`);
    if (data.journal) lines.push(`%J ${data.journal}`);
    if (yearOf(data)) lines.push(`%D ${yearOf(data)}`);
    if (data.volume) lines.push(`%V ${data.volume}`);
    if (data.issue) lines.push(`%N ${data.issue}`);
    if (data.firstPage || data.lastPage) lines.push(`%P ${data.firstPage || ''}-${data.lastPage || ''}`.replace(/-$/, ''));
    if (data.doi) lines.push(`%R ${data.doi}`);
    if (data.url) lines.push(`%U ${data.url}`);
    if (data.pdfUrl) lines.push(`%> ${data.pdfUrl}`);
    return lines.join('\r\n') + '\r\n';
  }

  function bibtex(data) {
    const pages = data.firstPage || data.lastPage ? `${data.firstPage || ''}${data.lastPage ? '--' + data.lastPage : ''}` : '';
    const fields = [
      ['title', data.title],
      ['author', (data.authors || []).join(' and ')],
      ['journal', data.journal],
      ['year', yearOf(data)],
      ['volume', data.volume],
      ['number', data.issue],
      ['pages', pages],
      ['doi', data.doi],
      ['url', data.url],
    ].filter(([, v]) => clean(v));
    return `@article{${citationKey(data)},\n${fields.map(([k, v]) => `  ${k} = {${escBib(v)}}`).join(',\n')}\n}\n`;
  }

  function apa(data) {
    const authors = authorsText(data.authors) || '';
    return `${authors}${authors ? ' ' : ''}(${yearOf(data) || 'n.d.'}). ${data.title || ''}. ${data.journal || ''}${data.volume ? ', ' + data.volume : ''}${data.issue ? '(' + data.issue + ')' : ''}${data.firstPage ? ', ' + data.firstPage + (data.lastPage ? '-' + data.lastPage : '') : ''}.${data.doi ? ' https://doi.org/' + data.doi : ''}`.replace(/\s+/g, ' ').trim();
  }

  function numbered(data) {
    const pages = data.firstPage ? `:${data.firstPage}${data.lastPage ? '-' + data.lastPage : ''}` : '';
    return `${authorsText(data.authors)}. ${data.title}. ${data.journal}. ${yearOf(data)}${data.volume ? ';' + data.volume : ''}${data.issue ? '(' + data.issue + ')' : ''}${pages}.${data.doi ? ' doi:' + data.doi : ''}`.replace(/\s+/g, ' ').trim();
  }

  function gbt(data) {
    return `${authorsText(data.authors)}. ${data.title}[J]. ${data.journal}, ${yearOf(data)}${data.volume ? ', ' + data.volume : ''}${data.issue ? '(' + data.issue + ')' : ''}${data.firstPage ? ': ' + data.firstPage + (data.lastPage ? '-' + data.lastPage : '') : ''}.`.replace(/\s+/g, ' ').trim();
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function button(label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = 'border:1px solid #d8cbb9;background:#fffdf8;border-radius:4px;padding:2px 7px;color:#6b3f18;font-weight:700;cursor:pointer;';
    return btn;
  }

  function select(options) {
    const sel = document.createElement('select');
    sel.style.cssText = 'border:1px solid #d8cbb9;background:#fff;border-radius:4px;padding:2px 6px;color:#4b4032;font-weight:700;';
    options.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      sel.appendChild(opt);
    });
    return sel;
  }

  function formatPayload(data, fmt) {
    if (fmt === 'ris') return { filename: `${citationKey(data)}.ris`, text: ris(data), mode: 'download' };
    if (fmt === 'bib') return { filename: `${citationKey(data)}.bib`, text: bibtex(data), mode: 'download' };
    if (fmt === 'enw') return { filename: `${citationKey(data)}.enw`, text: enw(data), mode: 'download' };
    if (fmt === 'apa') return { text: apa(data), mode: 'copy' };
    if (fmt === 'ama') return { text: numbered(data), mode: 'copy' };
    if (fmt === 'acs') return { text: numbered(data), mode: 'copy' };
    if (fmt === 'gbt') return { text: gbt(data), mode: 'copy' };
    return null;
  }

  async function saveCitation(data) {
    const item = { ...data, savedAt: Date.now(), key: citationKey(data) };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const current = await chrome.storage.local.get('ajCitationLibrary');
      const list = Array.isArray(current.ajCitationLibrary) ? current.ajCitationLibrary : [];
      const next = [item, ...list.filter((x) => (x.doi || x.url) !== (item.doi || item.url))].slice(0, 500);
      await chrome.storage.local.set({ ajCitationLibrary: next });
      return true;
    }
    const key = 'ailatest.citationLibrary';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([item, ...list].slice(0, 500)));
    return true;
  }

  function renderTools(extra = {}) {
    const data = fromDocument(extra);
    if (!data.title && !data.doi) return null;
    const bar = document.createElement('div');
    bar.className = 'ailatest-citation-tools';
    bar.dataset.ailatestUi = '1';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 10px;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;';
    const fmt = select([
      ['ris', 'RIS'],
      ['bib', 'BibTeX'],
      ['enw', 'EndNote'],
      ['apa', 'APA'],
      ['ama', 'AMA'],
      ['acs', 'ACS'],
      ['gbt', 'GB/T 7714'],
    ]);
    const exportBtn = button('导出');
    exportBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const payload = formatPayload(data, fmt.value);
      if (!payload) return;
      if (payload.mode === 'download') download(payload.filename, payload.text);
      else {
        await copy(payload.text);
        exportBtn.textContent = '已复制';
        setTimeout(() => { exportBtn.textContent = '导出'; }, 1200);
      }
    });
    const saveBtn = button('保存');
    saveBtn.title = '保存到插件文献库；登录云同步通道接入后会自动同步';
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await saveCitation(data);
      saveBtn.textContent = '已保存';
      setTimeout(() => { saveBtn.textContent = '保存'; }, 1200);
    });
    const mendeleyBtn = button('Mendeley');
    mendeleyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(`https://www.mendeley.com/import/?url=${encodeURIComponent(data.url || location.href)}`, '_blank', 'noopener');
    });
    bar.append(fmt, exportBtn, saveBtn, mendeleyBtn);
    return bar;
  }

  async function citationCounts(data) {
    const out = [];
    const doi = clean(data && data.doi);
    if (!doi) return out;
    try {
      const oa = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`).then(r => r.ok ? r.json() : null);
      if (oa && oa.cited_by_count != null) out.push({ source: 'OpenAlex', count: oa.cited_by_count });
    } catch (_) {}
    try {
      const ss = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=citationCount`).then(r => r.ok ? r.json() : null);
      if (ss && ss.citationCount != null) out.push({ source: 'Semantic Scholar', count: ss.citationCount });
    } catch (_) {}
    try {
      const cr = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`).then(r => r.ok ? r.json() : null);
      const n = cr && cr.message && cr.message['is-referenced-by-count'];
      if (n != null) out.push({ source: 'Crossref', count: n });
    } catch (_) {}
    return out;
  }

  async function renderCitationCounts(extra = {}) {
    const data = fromDocument(extra);
    const counts = await citationCounts(data);
    if (!counts.length) return null;
    const box = document.createElement('div');
    box.className = 'ailatest-citation-counts';
    box.dataset.ailatestUi = '1';
    box.style.cssText = 'display:inline-flex;position:relative;margin:4px 0 8px;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#46546a;';
    const total = Math.max(...counts.map((x) => Number(x.count) || 0));
    const btn = button(`引用 ${total}`);
    btn.style.borderColor = '#d8dee8';
    btn.style.background = '#f8fafc';
    btn.style.color = '#46546a';
    const detail = document.createElement('div');
    detail.hidden = true;
    detail.style.cssText = 'position:absolute;z-index:2147483647;top:26px;left:0;min-width:180px;background:#fff;border:1px solid #d8dee8;border-radius:6px;box-shadow:0 8px 24px rgba(15,23,42,.12);padding:6px;color:#334155;';
    detail.innerHTML = counts.map((item) => `<div style="display:flex;justify-content:space-between;gap:18px;padding:3px 4px"><b>${item.source}</b><span>${item.count}</span></div>`).join('');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      detail.hidden = !detail.hidden;
    });
    box.append(btn, detail);
    return box;
  }

  async function resolveOpenAccessUrl(data) {
    if (data.pdfUrl) return data.pdfUrl;
    if (data.doi) {
      try {
        const oa = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(data.doi)}`).then(r => r.ok ? r.json() : null);
        const locs = [oa && oa.best_oa_location, ...(Array.isArray(oa && oa.oa_locations) ? oa.oa_locations : [])].filter(Boolean);
        const hit = locs.find((x) => x && (x.pdf_url || x.landing_page_url));
        if (hit) return hit.pdf_url || hit.landing_page_url;
      } catch (_) {}
    }
    return '';
  }

  function sourceCandidates(data) {
    const doi = clean(data.doi);
    const title = clean(data.title);
    return [
      ['OpenAlex', doi ? `https://openalex.org/doi/${encodeURIComponent(doi)}` : `https://openalex.org/works?search=${encodeURIComponent(title)}`],
      ['Unpaywall', doi ? `https://unpaywall.org/doi/${encodeURIComponent(doi)}` : ''],
      ['Semantic Scholar', doi ? `https://www.semanticscholar.org/search?q=${encodeURIComponent(doi)}` : `https://www.semanticscholar.org/search?q=${encodeURIComponent(title)}`],
      ['Crossref', doi ? `https://search.crossref.org/?q=${encodeURIComponent(doi)}` : `https://search.crossref.org/?q=${encodeURIComponent(title)}`],
      ['CORE', title ? `https://core.ac.uk/search?q=${encodeURIComponent(title)}` : ''],
      ['PubMed', doi ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(doi)}` : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(title)}`],
      ['ResearchGate', title ? `https://www.researchgate.net/search/publication?q=${encodeURIComponent(title)}` : ''],
    ].filter(([, url]) => url);
  }

  function renderSourceLinks(extra = {}) {
    const data = fromDocument(extra);
    const links = sourceCandidates(data);
    if (!links.length && !data.pdfUrl) return null;
    const bar = document.createElement('div');
    bar.className = 'ailatest-source-links';
    bar.dataset.ailatestUi = '1';
    bar.style.cssText = 'display:inline-flex;position:relative;align-items:center;gap:6px;margin:6px 0 10px;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;';
    const openBtn = button('全文');
    const menuBtn = button('来源');
    const menu = document.createElement('div');
    menu.hidden = true;
    menu.style.cssText = 'position:absolute;z-index:2147483647;top:28px;left:58px;min-width:180px;background:#fff;border:1px solid #d8cbb9;border-radius:6px;box-shadow:0 8px 24px rgba(15,23,42,.12);padding:6px;';
    links.forEach(([label, url]) => {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = label;
      a.style.cssText = 'display:block;padding:4px 6px;color:#6b3f18;font-weight:700;text-decoration:none;border-radius:4px;';
      a.addEventListener('mouseenter', () => { a.style.background = '#fff7ed'; });
      a.addEventListener('mouseleave', () => { a.style.background = 'transparent'; });
      menu.appendChild(a);
    });
    openBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const old = openBtn.textContent;
      openBtn.textContent = '查找中';
      const url = await resolveOpenAccessUrl(data);
      openBtn.textContent = old;
      if (url) window.open(url, '_blank', 'noopener');
      else menu.hidden = false;
    });
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    bar.append(openBtn, menuBtn, menu);
    return bar;
  }

  ns.citations = { fromDocument, renderTools, renderSourceLinks, renderCitationCounts, citationCounts, formats: { ris, enw, bibtex, apa, ama: numbered, acs: numbered, gbt } };
})(globalThis);
