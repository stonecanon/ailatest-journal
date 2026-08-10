(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};

  function clean(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escBib(value) {
    return clean(value)
      .replace(/\\/g, '\\\\')
      .replace(/[{}]/g, '\\$&')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
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
    const m = String(date).match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  function cleanTitle(title) {
    let t = clean(title);
    // 去掉站点后缀 / 期刊站标题尾巴
    t = t.replace(/\s*[\|\-–—:：]\s*(Google Scholar|PubMed|ScienceDirect|Springer|Wiley|Nature|IEEE Xplore|CNKI|知网|万方).*$/i, '');
    t = t.replace(/\s*[-–—]\s*(Full Text|Abstract|HTML|PDF)\s*$/i, '');
    return clean(t);
  }

  function cleanJournal(journal) {
    let j = clean(journal);
    j = j.replace(/\s*[\|\-–—].*$/, '');
    return clean(j);
  }

  function cleanDoi(doi) {
    let d = clean(doi).replace(/^doi:\s*/i, '');
    d = d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    return d;
  }

  /**
   * 解析作者为 { family, given, literal }，兼容：
   * - "Smith, John A."
   * - "John A. Smith"
   * - "张三" / "Zhang San"
   * - "Smith JA; Doe J" / 逗号或分号列表
   */
  function parseAuthorToken(raw) {
    let s = clean(raw)
      .replace(/\s+and\s+/gi, ';')
      .replace(/\s*[&,;，；]\s*$/g, '');
    if (!s) return null;
    // 去掉上标/角色
    s = s.replace(/\d+/g, '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || /^(et al\.?|and others)$/i.test(s)) return null;

    // "Last, First Middle"
    if (s.includes(',')) {
      const [family, ...rest] = s.split(',').map(clean).filter(Boolean);
      const given = rest.join(' ').trim();
      if (family) return { family, given, literal: s };
    }

    // 中文姓名 2–4 字
    if (/^[\u4e00-\u9fff]{2,4}$/.test(s)) {
      return { family: s.slice(0, 1), given: s.slice(1), literal: s };
    }

    // "First Middle Last" / "J. A. Smith"
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { family: parts[0], given: '', literal: s };
    }
    if (parts.length >= 2) {
      const family = parts[parts.length - 1];
      const given = parts.slice(0, -1).join(' ');
      return { family, given, literal: s };
    }
    return { family: s, given: '', literal: s };
  }

  function parseAuthors(list) {
    const out = [];
    const seen = new Set();
    const push = (raw) => {
      // 拆分 ; / and / ， 列表（避免 "Smith, John" 被逗号误拆：仅在无 "Last, First" 模式时按逗号拆）
      let chunks = [raw];
      if (/;|；|\band\b/i.test(raw)) {
        chunks = raw.split(/\s*(?:;|；|\band\b)\s*/i);
      } else if (raw.includes(',') && !/^[A-Za-z][^,]*,\s*[A-Za-z]/.test(raw.trim())) {
        // "John Smith, Jane Doe" 风格
        chunks = raw.split(/\s*,\s*/);
      }
      chunks.forEach((c) => {
        const a = parseAuthorToken(c);
        if (!a) return;
        const key = `${a.family}|${a.given}`.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(a);
      });
    };

    (Array.isArray(list) ? list : [list]).forEach((item) => {
      const s = clean(item);
      if (!s) return;
      push(s);
    });
    return out;
  }

  function authorRis(a) {
    // RIS: Family, Given
    if (a.given) return `${a.family}, ${a.given}`;
    return a.family || a.literal;
  }

  function authorBib(a) {
    // BibTeX: Family, Given
    if (a.given) return `${a.family}, ${a.given}`;
    return a.family || a.literal;
  }

  function authorEnw(a) {
    if (a.given) return `${a.family}, ${a.given}`;
    return a.family || a.literal;
  }

  function authorsApa(authors) {
    if (!authors.length) return '';
    const fmt = (a) => {
      if (!a.given) return a.family;
      // 中文姓名不拆成缩写
      if (/[\u4e00-\u9fff]/.test(a.family + a.given)) return `${a.family}${a.given}`;
      // APA: Family, I. J.
      const initials = a.given
        .split(/[\s.]+/)
        .filter(Boolean)
        .map((p) => p[0].toUpperCase() + '.')
        .join(' ');
      return `${a.family}, ${initials}`;
    };
    if (authors.length === 1) return fmt(authors[0]);
    if (authors.length === 2) return `${fmt(authors[0])}, & ${fmt(authors[1])}`;
    if (authors.length <= 20) {
      return authors.slice(0, -1).map(fmt).join(', ') + ', & ' + fmt(authors[authors.length - 1]);
    }
    return authors.slice(0, 19).map(fmt).join(', ') + ', ... ' + fmt(authors[authors.length - 1]);
  }

  function authorsGbt(authors) {
    // GB/T 7714：英文 Family Given 缩写；中文姓名连写
    return authors.map((a) => {
      if (/[\u4e00-\u9fff]/.test(a.family + a.given)) {
        return `${a.family}${a.given}`;
      }
      if (!a.given) return a.family;
      const initials = a.given
        .split(/[\s.]+/)
        .filter(Boolean)
        .map((p) => p[0].toUpperCase())
        .join('');
      return `${a.family} ${initials}`;
    }).join(', ');
  }

  function authorsAma(authors) {
    // AMA: Family IJ
    return authors.map((a) => {
      if (!a.given) return a.family;
      if (/[\u4e00-\u9fff]/.test(a.family + a.given)) return `${a.family}${a.given}`;
      const initials = a.given
        .split(/[\s.]+/)
        .filter(Boolean)
        .map((p) => p[0].toUpperCase())
        .join('');
      return `${a.family} ${initials}`;
    }).join(', ');
  }

  function authorsAcs(authors) {
    // ACS: Family, A. B.; Doe, C.
    return authors.map((a) => {
      if (!a.given) return a.family;
      if (/[\u4e00-\u9fff]/.test(a.family + a.given)) return `${a.family}${a.given}`;
      const initials = a.given
        .split(/[\s.]+/)
        .filter(Boolean)
        .map((p) => p[0].toUpperCase() + '.')
        .join(' ');
      return `${a.family}, ${initials}`;
    }).join('; ');
  }

  function citationKey(data) {
    const firstAuthor = clean((data.authorsParsed && data.authorsParsed[0] && data.authorsParsed[0].family)
      || (data.authors || [])[0]
      || 'article').split(/\s+/).pop() || 'article';
    const key = `${firstAuthor}${yearOf(data) || 'nd'}`.replace(/[^a-z0-9_:-]/gi, '');
    return key || 'article';
  }

  function fromDocument(extra = {}) {
    const rawAuthors = (extra.authors && extra.authors.length)
      ? extra.authors
      : meta('citation_author');
    const authorsParsed = parseAuthors(rawAuthors);
    const doi = cleanDoi(first(extra.doi, meta('citation_doi'), meta('dc.Identifier'), meta('DC.identifier')));
    const title = cleanTitle(first(extra.title, meta('citation_title'), meta('dc.Title'), meta('DC.title'), meta('og:title'), document.title));
    const journal = cleanJournal(first(extra.journal, meta('citation_journal_title'), meta('dc.Source'), meta('DC.source'), meta('citation_journal_abbrev')));
    return {
      title,
      journal,
      authors: authorsParsed.map((a) => a.literal || authorRis(a)),
      authorsParsed,
      abstract: first(extra.abstract, meta('citation_abstract'), meta('dc.Description'), meta('DC.description'), meta('description')),
      year: first(extra.year, meta('citation_publication_date'), meta('citation_online_date'), meta('dc.Date'), meta('DC.date')),
      date: first(extra.date, meta('citation_publication_date'), meta('citation_online_date'), meta('dc.Date'), meta('DC.date')),
      volume: first(extra.volume, meta('citation_volume')),
      issue: first(extra.issue, meta('citation_issue')),
      firstPage: first(extra.firstPage, meta('citation_firstpage')),
      lastPage: first(extra.lastPage, meta('citation_lastpage')),
      doi,
      issn: first(extra.issn, meta('citation_issn')),
      eissn: first(extra.eissn, meta('citation_eissn')),
      url: first(extra.url, meta('citation_public_url'), meta('og:url'), location.href).split('#')[0],
      pdfUrl: first(extra.pdfUrl, meta('citation_pdf_url')),
    };
  }

  function ris(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const lines = ['TY  - JOUR'];
    authors.forEach((a) => lines.push(`AU  - ${authorRis(a)}`));
    if (data.title) lines.push(`TI  - ${clean(data.title)}`);
    if (data.journal) lines.push(`JO  - ${clean(data.journal)}`);
    if (data.journal) lines.push(`T2  - ${clean(data.journal)}`);
    if (yearOf(data)) lines.push(`PY  - ${yearOf(data)}`);
    if (data.volume) lines.push(`VL  - ${clean(data.volume)}`);
    if (data.issue) lines.push(`IS  - ${clean(data.issue)}`);
    if (data.firstPage) lines.push(`SP  - ${clean(data.firstPage)}`);
    if (data.lastPage) lines.push(`EP  - ${clean(data.lastPage)}`);
    if (data.doi) lines.push(`DO  - ${cleanDoi(data.doi)}`);
    if (data.issn) lines.push(`SN  - ${clean(data.issn)}`);
    if (data.eissn && data.eissn !== data.issn) lines.push(`SN  - ${clean(data.eissn)}`);
    if (data.url) lines.push(`UR  - ${clean(data.url)}`);
    if (data.pdfUrl) lines.push(`L1  - ${clean(data.pdfUrl)}`);
    if (data.abstract) lines.push(`AB  - ${clean(data.abstract)}`);
    lines.push('ER  - ');
    return lines.join('\r\n') + '\r\n';
  }

  function enw(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const lines = ['%0 Journal Article'];
    authors.forEach((a) => lines.push(`%A ${authorEnw(a)}`));
    if (data.title) lines.push(`%T ${clean(data.title)}`);
    if (data.journal) lines.push(`%J ${clean(data.journal)}`);
    if (yearOf(data)) lines.push(`%D ${yearOf(data)}`);
    if (data.volume) lines.push(`%V ${clean(data.volume)}`);
    if (data.issue) lines.push(`%N ${clean(data.issue)}`);
    if (data.firstPage || data.lastPage) {
      const pages = [data.firstPage, data.lastPage].filter(Boolean).join('-');
      if (pages) lines.push(`%P ${pages}`);
    }
    if (data.doi) lines.push(`%R ${cleanDoi(data.doi)}`);
    if (data.issn) lines.push(`%@ ${clean(data.issn)}`);
    if (data.url) lines.push(`%U ${clean(data.url)}`);
    if (data.pdfUrl) lines.push(`%> ${clean(data.pdfUrl)}`);
    if (data.abstract) lines.push(`%X ${clean(data.abstract)}`);
    return lines.join('\r\n') + '\r\n';
  }

  function bibtex(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const pages = data.firstPage
      ? `${clean(data.firstPage)}${data.lastPage ? '--' + clean(data.lastPage) : ''}`
      : '';
    const fields = [
      ['title', data.title],
      ['author', authors.map(authorBib).join(' and ')],
      ['journal', data.journal],
      ['year', yearOf(data)],
      ['volume', data.volume],
      ['number', data.issue],
      ['pages', pages],
      ['doi', cleanDoi(data.doi)],
      ['issn', data.issn],
      ['url', data.url],
    ].filter(([, v]) => clean(v));
    return `@article{${citationKey(data)},\n${fields.map(([k, v]) => `  ${k} = {${escBib(v)}}`).join(',\n')}\n}\n`;
  }

  function apa(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const authorStr = authorsApa(authors);
    const year = yearOf(data) || 'n.d.';
    const title = clean(data.title);
    const journal = clean(data.journal);
    const vol = clean(data.volume);
    const iss = clean(data.issue);
    const pages = data.firstPage
      ? `${clean(data.firstPage)}${data.lastPage ? '–' + clean(data.lastPage) : ''}`
      : '';
    let body = '';
    if (authorStr) body += `${authorStr} `;
    body += `(${year}). `;
    if (title) body += `${title.endsWith('.') ? title : title + '.'} `;
    if (journal) {
      body += `${journal}`;
      if (vol) body += `, ${vol}`;
      if (iss) body += `(${iss})`;
      if (pages) body += `, ${pages}`;
      body += '.';
    }
    if (data.doi) body += ` https://doi.org/${cleanDoi(data.doi)}`;
    return body.replace(/\s+/g, ' ').trim();
  }

  function ama(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const authorStr = authorsAma(authors);
    const year = yearOf(data);
    const title = clean(data.title);
    const journal = clean(data.journal);
    const vol = clean(data.volume);
    const iss = clean(data.issue);
    const pages = data.firstPage
      ? `${clean(data.firstPage)}${data.lastPage ? '-' + clean(data.lastPage) : ''}`
      : '';
    let s = '';
    if (authorStr) s += `${authorStr}. `;
    if (title) s += `${title.endsWith('.') ? title : title + '.'} `;
    if (journal) s += `${journal}. `;
    if (year) s += `${year}`;
    if (vol) s += `;${vol}`;
    if (iss) s += `(${iss})`;
    if (pages) s += `:${pages}`;
    s += '.';
    if (data.doi) s += ` doi:${cleanDoi(data.doi)}`;
    return s.replace(/\s+/g, ' ').trim();
  }

  function acs(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const authorStr = authorsAcs(authors);
    const year = yearOf(data);
    const title = clean(data.title);
    const journal = clean(data.journal);
    const vol = clean(data.volume);
    const pages = data.firstPage
      ? `${clean(data.firstPage)}${data.lastPage ? '-' + clean(data.lastPage) : ''}`
      : '';
    // ACS: Authors. Title. *Journal* **Year**, *Volume*, pages. DOI
    let s = '';
    if (authorStr) s += `${authorStr}. `;
    if (title) s += `${title} `;
    if (journal) s += `${journal} `;
    if (year) s += `${year}`;
    if (vol) s += `, ${vol}`;
    if (pages) s += `, ${pages}`;
    s += '.';
    if (data.doi) s += ` https://doi.org/${cleanDoi(data.doi)}`;
    return s.replace(/\s+/g, ' ').trim();
  }

  function gbt(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const authorStr = authorsGbt(authors);
    const year = yearOf(data);
    const title = clean(data.title);
    const journal = clean(data.journal);
    const vol = clean(data.volume);
    const iss = clean(data.issue);
    const pages = data.firstPage
      ? `${clean(data.firstPage)}${data.lastPage ? '-' + clean(data.lastPage) : ''}`
      : '';
    // GB/T 7714—2015 期刊：[J]
    let s = '';
    if (authorStr) s += `${authorStr}. `;
    if (title) s += `${title}[J]. `;
    if (journal) s += `${journal}`;
    if (year) s += `, ${year}`;
    if (vol) s += `, ${vol}`;
    if (iss) s += `(${iss})`;
    if (pages) s += `: ${pages}`;
    s += '.';
    if (data.doi) s += ` DOI:${cleanDoi(data.doi)}.`;
    return s.replace(/\s+/g, ' ').trim();
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  function download(filename, text, type = 'text/plain;charset=utf-8') {
    downloadBlob(filename, new Blob(['\uFEFF' + text], { type }));
  }

  function markdownValue(value) {
    return clean(value).replace(/"/g, '\\"');
  }

  function markdownList(authors) {
    const list = Array.isArray(authors) && authors[0] && authors[0].family
      ? authors.map((a) => (a.given ? `${a.family}, ${a.given}` : a.family))
      : (authors || []).map(clean);
    return list.filter(Boolean).join('; ');
  }

  function citationMarkdown(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const title = clean(data.title) || 'Untitled article';
    const authorLine = markdownList(authors);
    const year = yearOf(data);
    const reference = apa(data) || gbt(data) || title;
    const lines = [
      '---',
      `title: "${markdownValue(title)}"`,
      authorLine ? `authors: "${markdownValue(authorLine)}"` : '',
      data.journal ? `journal: "${markdownValue(data.journal)}"` : '',
      year ? `year: "${markdownValue(year)}"` : '',
      data.doi ? `doi: "${markdownValue(cleanDoi(data.doi))}"` : '',
      `saved_at: "${new Date().toISOString()}"`,
      'source: "AILatest Journal Extension"',
      '---',
      '',
      `# ${title}`,
      '',
      '## Authors',
      '',
      authorLine || '—',
      '',
      '## Abstract',
      '',
      clean(data.abstract) || '—',
      '',
      '## Reference (APA)',
      '',
      reference,
      '',
    ].filter((line) => line !== '').join('\n');
    return `${lines}\n`;
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        if (root.chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(key, (res) => resolve(res && res[key]));
          return;
        }
      } catch (_) {}
      try {
        resolve(JSON.parse(localStorage.getItem(key) || 'null'));
      } catch (_) {
        resolve(null);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      try {
        if (root.chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [key]: value }, resolve);
          return;
        }
      } catch (_) {}
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
      resolve();
    });
  }

  async function saveCitation(data, format) {
    const key = 'ajCitationLibrary';
    const list = await storageGet(key);
    const library = Array.isArray(list) ? list : [];
    const id = `${citationKey(data)}-${Date.now().toString(36)}`;
    const record = {
      id,
      format: format || 'md',
      title: clean(data.title),
      authors: (data.authorsParsed || parseAuthors(data.authors)).map((a) => authorRis(a)),
      abstract: clean(data.abstract),
      reference: apa(data) || gbt(data) || clean(data.title),
      journal: clean(data.journal),
      year: yearOf(data),
      doi: cleanDoi(data.doi),
      url: clean(data.url),
      pdfUrl: clean(data.pdfUrl),
      savedAt: new Date().toISOString(),
      source: location.href,
    };
    library.unshift(record);
    await storageSet(key, library.slice(0, 500));
    return record;
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 12) {
    const chars = Array.from(clean(text));
    if (!chars.length) return y;
    let line = '';
    let lines = 0;
    for (const ch of chars) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxWidth) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        line = ch;
        lines += 1;
        if (lines >= maxLines) return y;
      } else {
        line = next;
      }
    }
    if (line && lines < maxLines) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  function bytesFromString(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }

  function pdfWithJpeg(jpeg, imageWidth, imageHeight) {
    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 32;
    const drawW = pageW - margin * 2;
    const drawH = Math.min(pageH - margin * 2, drawW * imageHeight / imageWidth);
    const drawX = margin;
    const drawY = pageH - margin - drawH;
    const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ\n`;
    const chunks = [];
    const offsets = [0];
    let pos = 0;
    const push = (chunk) => {
      const bytes = typeof chunk === 'string' ? bytesFromString(chunk) : chunk;
      chunks.push(bytes);
      pos += bytes.length;
    };
    const obj = (id, body) => {
      offsets[id] = pos;
      push(`${id} 0 obj\n${body}\nendobj\n`);
    };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4] = pos;
    push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream\nendobj\n');
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
    const xref = pos;
    push(`xref\n0 6\n0000000000 65535 f \n`);
    for (let i = 1; i <= 5; i += 1) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function citationPdf(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6b3f18';
    ctx.font = '700 34px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    ctx.fillText('AILatest Journal Citation Card', 80, 96);
    ctx.fillStyle = '#1f2933';
    ctx.font = '800 46px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    let y = wrapCanvasText(ctx, data.title || 'Untitled article', 80, 190, 1040, 62, 7) + 22;
    ctx.font = '500 25px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    ctx.fillStyle = '#46546a';
    const rows = [
      ['Authors', markdownList(authors)],
      ['Abstract', clean(data.abstract) || '—'],
    ].filter(([, value]) => clean(value));
    for (const [label, value] of rows) {
      ctx.fillStyle = '#8a5a2b';
      ctx.font = '800 24px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
      ctx.fillText(`${label}:`, 80, y);
      ctx.fillStyle = '#2f3a45';
      ctx.font = '500 24px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
      y = wrapCanvasText(ctx, value, 245, y, 875, 34, label === 'Abstract' ? 10 : 4) + 10;
    }
    ctx.fillStyle = '#8a5a2b';
    ctx.font = '800 28px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    ctx.fillText('Reference (APA)', 80, y + 30);
    ctx.fillStyle = '#2f3a45';
    ctx.font = '500 24px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    wrapCanvasText(ctx, apa(data) || gbt(data) || data.title, 80, y + 78, 1040, 36, 10);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    return pdfWithJpeg(jpeg, canvas.width, canvas.height);
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
    btn.style.cssText = 'width:auto!important;min-width:0!important;border:1px solid #d8cbb9;background:#fffdf8;border-radius:4px;padding:1px 6px;color:#6b3f18;font-weight:700;cursor:pointer;font-size:12px;line-height:1.45;';
    return btn;
  }

  function select(options) {
    const sel = document.createElement('select');
    sel.style.cssText = 'width:auto!important;min-width:54px!important;max-width:110px!important;height:auto!important;border:1px solid #d8cbb9;background:#fff;border-radius:4px;padding:1px 20px 1px 6px;color:#4b4032;font-weight:700;font-size:12px;line-height:1.45;';
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
    if (fmt === 'ama') return { text: ama(data), mode: 'copy' };
    if (fmt === 'acs') return { text: acs(data), mode: 'copy' };
    if (fmt === 'gbt') return { text: gbt(data), mode: 'copy' };
    return null;
  }

  function toZoteroItem(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const pages = data.firstPage
      ? `${clean(data.firstPage)}${data.lastPage ? '-' + clean(data.lastPage) : ''}`
      : '';
    return {
      itemType: 'journalArticle',
      title: clean(data.title) || 'Untitled',
      creators: authors.map((a) => ({
        creatorType: 'author',
        firstName: a.given || '',
        lastName: a.family || a.literal || '',
      })),
      publicationTitle: clean(data.journal),
      date: yearOf(data) || clean(data.date),
      volume: clean(data.volume),
      issue: clean(data.issue),
      pages,
      DOI: cleanDoi(data.doi),
      ISSN: clean(data.issn),
      url: clean(data.url),
      abstractNote: clean(data.abstract),
      accessDate: new Date().toISOString().slice(0, 10),
    };
  }

  async function sendToZotero(data) {
    const item = toZoteroItem(data);
    const endpoints = [
      'http://127.0.0.1:23119/connector/saveItems',
      'http://localhost:23119/connector/saveItems',
    ];
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Zotero-Connector-API-Version': '2',
          },
          body: JSON.stringify({ items: [item], uri: clean(data.url) || location.href }),
        });
        if (resp.ok || resp.status === 201 || resp.status === 200) return { ok: true, via: 'connector' };
      } catch (_) {}
    }
    // 回退：下载 RIS，Zotero Connector / 桌面端可导入
    download(`${citationKey(data)}.ris`, ris(data));
    return { ok: true, via: 'ris' };
  }

  function sendToObsidian(data) {
    const md = citationMarkdown(data);
    const file = `AILatest/${citationKey(data)}`.replace(/[\\/:*?"<>|]+/g, '-');
    if (md.length < 12000) {
      const uri = `obsidian://new?file=${encodeURIComponent(file)}&content=${encodeURIComponent(md)}`;
      try {
        const a = document.createElement('a');
        a.href = uri;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (_) {
        window.location.href = uri;
      }
    }
    download(`${citationKey(data)}.md`, md, 'text/markdown;charset=utf-8');
    return { ok: true };
  }

  async function sendToNotion(data) {
    const authors = data.authorsParsed || parseAuthors(data.authors);
    const authorLine = markdownList(authors);
    // Notion 粘贴友好：标题 + 属性块 + APA 引用
    const text = [
      clean(data.title) || 'Untitled',
      '',
      authorLine ? `Authors: ${authorLine}` : '',
      data.journal ? `Journal: ${clean(data.journal)}` : '',
      yearOf(data) ? `Year: ${yearOf(data)}` : '',
      data.doi ? `DOI: https://doi.org/${cleanDoi(data.doi)}` : '',
      data.url ? `URL: ${clean(data.url)}` : '',
      '',
      clean(data.abstract) ? `Abstract\n${clean(data.abstract)}` : '',
      '',
      `Reference (APA)\n${apa(data) || gbt(data) || clean(data.title)}`,
      '',
      '— via AILatest Journal',
    ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
    await copy(text);
    try {
      window.open('https://www.notion.so/new', '_blank', 'noopener');
    } catch (_) {}
    return { ok: true };
  }

  function flashBtn(btn, okText, restoreText, ms = 1400) {
    const old = restoreText || btn.textContent;
    btn.textContent = okText;
    setTimeout(() => { btn.textContent = old; }, ms);
  }

  async function requireWorkflow(btn) {
    const settings = ns.lookup && ns.lookup.getSettings ? await ns.lookup.getSettings() : {};
    if (settings.allowWorkflow) return true;
    if (btn) flashBtn(btn, ns.t ? ns.t('citation.proOnly') : 'Pro only', btn.dataset.restore || btn.textContent, 1600);
    try {
      window.open('https://journal.ailatest.org/pricing.html', '_blank', 'noopener');
    } catch (_) {}
    return false;
  }

  function fulltextKey(data) {
    const doi = cleanDoi(data && data.doi);
    if (doi) return `doi:${doi.toLowerCase()}`;
    const url = clean(data && (data.url || data.pdfUrl)).split('#')[0].toLowerCase();
    if (url) return `url:${url}`;
    const title = clean(data && data.title).toLowerCase().slice(0, 120);
    return title ? `t:${title}` : '';
  }

  function renderTools(extra = {}) {
    const data = fromDocument(extra);
    if (!data.title && !data.doi) return null;
    const reference = apa(data) || gbt(data) || clean(data.title)
      || (data.doi ? `https://doi.org/${cleanDoi(data.doi)}` : '');
    if (!reference) return null;
    const bar = document.createElement('div');
    bar.className = 'ailatest-citation-tools';
    bar.dataset.ailatestUi = '1';
    bar.style.cssText = 'display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0 0 0 4px;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;vertical-align:middle;';
    const copyBtn = button(ns.t ? ns.t('citation.copyReference') : 'Copy reference');
    copyBtn.dataset.restore = copyBtn.textContent;
    copyBtn.title = ns.t ? ns.t('citation.copyReferenceTitle') : 'Copy the plain-text reference';
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await copy(reference);
      flashBtn(copyBtn, ns.t ? ns.t('citation.copied') : 'Copied', copyBtn.dataset.restore, 1200);
    });
    bar.append(copyBtn);
    return bar;
  }

  async function citationCounts(data) {
    const out = [];
    const doi = cleanDoi(data && data.doi);
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
    const btn = button(ns.t ? ns.t('citation.count', { count: total }) : `Citations ${total}`);
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
        const oa = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(cleanDoi(data.doi))}`).then(r => r.ok ? r.json() : null);
        const locs = [oa && oa.best_oa_location, ...(Array.isArray(oa && oa.oa_locations) ? oa.oa_locations : [])].filter(Boolean);
        const hit = locs.find((x) => x && (x.pdf_url || x.landing_page_url));
        if (hit) return hit.pdf_url || hit.landing_page_url;
      } catch (_) {}
    }
    return '';
  }

  function sourceCandidates(data) {
    const doi = cleanDoi(data.doi);
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
    bar.style.cssText = 'display:inline-flex;position:relative;align-items:center;gap:4px;margin:0 0 0 4px;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;vertical-align:middle;';
    const openBtn = button(ns.t ? ns.t('source.fulltext') : 'Full text');
    const menuBtn = button(ns.t ? ns.t('source.sources') : 'Sources');
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
      const key = fulltextKey(data);
      if (ns.lookup && ns.lookup.checkFulltextQuota) {
        const gate = await ns.lookup.checkFulltextQuota(key);
        if (!gate.ok) {
          openBtn.textContent = ns.t ? ns.t('source.limitReached') : 'Limit';
          setTimeout(() => { openBtn.textContent = ns.t ? ns.t('source.fulltext') : 'Full text'; }, 1400);
          try { window.open('https://journal.ailatest.org/pricing.html', '_blank', 'noopener'); } catch (_) {}
          return;
        }
      }
      const old = openBtn.textContent;
      openBtn.textContent = ns.t ? ns.t('source.finding') : 'Finding';
      const url = await resolveOpenAccessUrl(data);
      openBtn.textContent = old;
      if (url) {
        if (ns.lookup && ns.lookup.consumeFulltextQuota) await ns.lookup.consumeFulltextQuota(key);
        window.open(url, '_blank', 'noopener');
      } else menu.hidden = false;
    });
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    bar.append(openBtn, menuBtn, menu);
    return bar;
  }

  ns.citations = {
    fromDocument,
    renderTools,
    renderSourceLinks,
    renderCitationCounts,
    citationCounts,
    sendToZotero,
    sendToObsidian,
    sendToNotion,
    formats: { ris, enw, bibtex, apa, ama, acs, gbt, markdown: citationMarkdown },
    parseAuthors,
  };
})(globalThis);
