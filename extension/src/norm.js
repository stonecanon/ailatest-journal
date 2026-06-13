(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};

  function norm(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[&]/g, ' and ')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function issnKey(value) {
    return String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  }

  function cleanJournalName(value) {
    let s = String(value || '')
      .replace(/[《》<>]/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*(?:vol|volume|issue|no\.?|pp\.?|pages?|页|卷|期|辑|版)[^)]*\)/ig, ' ')
      .replace(/\b(?:vol\.?|volume|issue|no\.?|pp\.?|pages?)\s*[\w()\-:,.]+/ig, ' ')
      .replace(/[，,;；]\s*(?:\d{4}|vol\.?|volume|issue|no\.?|pp\.?|pages?).*$/ig, '')
      .replace(/\s*[-–—]\s*(?:elsevier|springer|wiley|taylor|sage|nature|science|cell|mdpi|frontiers|oxford|cambridge|ieee|acm|pubmed|cnki|万方|维普).*/ig, '')
      .replace(/\b(?:19|20)\d{2}\b.*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    s = s.replace(/^(?:in|from|source|刊名|来源|出处)[:：\s]+/i, '').trim();
    return s;
  }

  function likelyJournalName(value) {
    const s = cleanJournalName(value);
    if (!s || s.length < 2 || s.length > 90) return false;
    if (/^\d+$/.test(s)) return false;
    if (/[。！？!?]\s*$/.test(s)) return false;
    if (/\b(?:patent|thesis|dissertation|book|conference|proceedings|arxiv|biorxiv|medrxiv|preprint)\b/i.test(s)) return false;
    return true;
  }

  ns.norm = norm;
  ns.issnKey = issnKey;
  ns.cleanJournalName = cleanJournalName;
  ns.likelyJournalName = likelyJournalName;
})(globalThis);
