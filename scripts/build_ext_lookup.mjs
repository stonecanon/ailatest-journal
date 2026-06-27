import fs from 'fs';
import zlib from 'zlib';

const DATA_DIR = new URL('../data/', import.meta.url);
const OUT_FILE = new URL('../data/ext_lookup.json.gz', import.meta.url);

function readJson(name, gz = false) {
  const file = new URL(name, DATA_DIR);
  const raw = fs.readFileSync(file);
  const text = gz ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  return JSON.parse(text);
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');
}

function cleanCnCode(value) {
  return String(value || '').replace(/^CN/i, '').trim().toUpperCase();
}

function compactJournal(j) {
  const out = {};
  const fields = [
    'name', 'cn_name', 'issn', 'eissn', 'slug', 'publisher',
    'indices', 'scopus', 'cstpcd', 'cscd', 'cssci', 'pku',
    'if_quartile', 'cas_zone', 'cas_top', 'if_2024', 'if_latest',
    'cas_xr', 'ccf', 'abdc', 'abs', 'free',
    'warning', 'citic_warning', 'on_hold', 'under_review',
  ];
  fields.forEach((key) => {
    if (j[key] !== undefined && j[key] !== null && j[key] !== '') out[key] = j[key];
  });
  if (j.doaj && typeof j.doaj === 'object') {
    out.doaj = {
      apc: j.doaj.apc || '',
      lic: j.doaj.lic || '',
    };
  }
  return out;
}

const records = [];
const byName = new Map();
const byIssn = new Map();
const byCode = new Map();

function remember(record) {
  const names = [record.name, record.cn_name, ...(record.aliases || [])].filter(Boolean);
  names.forEach((name) => {
    const key = norm(name);
    if (key) byName.set(key, record);
  });
  [record.issn, record.eissn].filter(Boolean).forEach((issn) => byIssn.set(String(issn).toUpperCase(), record));
  if (record.cn_code) byCode.set(cleanCnCode(record.cn_code), record);
}

function findRecord(seed = {}) {
  for (const value of [seed.issn, seed.eissn].filter(Boolean)) {
    const hit = byIssn.get(String(value).toUpperCase());
    if (hit) return hit;
  }
  if (seed.cn_code) {
    const hit = byCode.get(cleanCnCode(seed.cn_code));
    if (hit) return hit;
  }
  for (const value of [seed.name, seed.cn_name, seed.en_name, seed.title, seed.journal_title].filter(Boolean)) {
    const hit = byName.get(norm(value));
    if (hit) return hit;
  }
  return null;
}

function ensureRecord(seed = {}) {
  const hit = findRecord(seed);
  if (hit) return hit;
  const record = {};
  record.name = seed.name || seed.cn_name || seed.en_name || seed.title || seed.journal_title || '';
  if (seed.cn_name && seed.cn_name !== record.name) record.cn_name = seed.cn_name;
  if (seed.en_name && seed.en_name !== record.name) {
    record.aliases = [...new Set([...(record.aliases || []), seed.en_name])];
  }
  if (seed.issn) record.issn = seed.issn;
  if (seed.eissn) record.eissn = seed.eissn;
  if (seed.cn_code) record.cn_code = seed.cn_code;
  records.push(record);
  remember(record);
  return record;
}

function pushUniqueArray(record, key, value) {
  if (!value) return;
  const arr = Array.isArray(record[key]) ? record[key] : [];
  const text = String(value);
  if (!arr.includes(text)) arr.push(text);
  record[key] = arr;
}

function mergeAlias(record, value) {
  if (!value || value === record.name || value === record.cn_name) return;
  record.aliases = [...new Set([...(record.aliases || []), value])];
}

function mergeDomestic(seed, patch) {
  const record = ensureRecord(seed);
  if (seed.cn_code && !record.cn_code) record.cn_code = seed.cn_code;
  if (seed.issn && !record.issn) record.issn = seed.issn;
  if (seed.eissn && !record.eissn) record.eissn = seed.eissn;
  if (seed.cn_name && !record.cn_name && seed.cn_name !== record.name) record.cn_name = seed.cn_name;
  Object.assign(record, patch);
  mergeAlias(record, seed.en_name);
  remember(record);
  return record;
}

const journalsRaw = readJson('journals.json.gz', true);
const journals = Array.isArray(journalsRaw) ? journalsRaw : (journalsRaw.journals || journalsRaw.records || []);
for (const journal of journals) {
  const record = compactJournal(journal);
  records.push(record);
  remember(record);
}

const domestic = readJson('domestic.json');

for (const r of (domestic.cnkx?.records || [])) {
  if (!r.name || !/^T[123]$/i.test(String(r.tier || ''))) continue;
  const record = ensureRecord(r);
  if (r.cn_code && !record.cn_code) record.cn_code = r.cn_code;
  if (r.issn && !record.issn) record.issn = r.issn;
  if (r.eissn && !record.eissn) record.eissn = r.eissn;
  const item = { tier: String(r.tier).toUpperCase(), domain: r.domain || '', subdomain: r.subdomain || '' };
  const key = `${item.tier}|${item.domain}|${item.subdomain}`;
  const existing = new Set((record.cnkx || []).map((x) => `${x.tier}|${x.domain || ''}|${x.subdomain || ''}`));
  if (!existing.has(key)) record.cnkx = [...(record.cnkx || []), item];
  remember(record);
}

(domestic.cssci_core || []).forEach((r) => mergeDomestic(r, { cssci: 'core', cssci_discipline: r.discipline || '' }));
(domestic.cssci_ext || []).forEach((r) => {
  if (!r.name || /^序号\s*期刊名称$/.test(r.name)) return;
  mergeDomestic(r, { cssci: 'ext', cssci_discipline: r.discipline || '' });
});
(domestic.pku_core || []).forEach((r) => mergeDomestic(r, { pku: true, pku_category: r.category || '' }));

for (const r of (domestic.cscd?.records || [])) {
  mergeDomestic(r, {
    cscd: String(r.database || '').toUpperCase() === 'E' ? 'E' : (String(r.database || '').toUpperCase() === 'C' ? 'C' : true),
  });
}

for (const r of (domestic.cstpcd?.records || [])) {
  mergeDomestic(r, { cstpcd: r.kind === 'popular_science' ? 'popular' : true });
}

for (const r of (domestic.scd?.records || [])) {
  mergeDomestic(r, { scd: r.newly_added ? 'SCD+' : 'SCD', scd_category: r.category || '' });
}

for (const r of (domestic.ami?.records || [])) {
  mergeDomestic(r, { ami: r.tier || true, ami_discipline: r.discipline || '' });
}

for (const r of (domestic.ccft || [])) {
  mergeDomestic({ name: r.cn_name, en_name: r.en_name, cn_code: r.cn_code }, { ccft: r.tier || true });
}

for (const r of (domestic.zju?.records || [])) {
  mergeDomestic({ ...r, name: String(r.name || '').replace(/\*$/, '') }, { zju: r.tier || true });
}

for (const r of (domestic.nsfc_mgmt?.records || [])) {
  mergeDomestic(r, { nsfc_mgmt: r.tier || true });
}

for (const r of (domestic.cnki_major?.records || [])) {
  const patch = {
    cn_code: r.cn_code || undefined,
    cnki_category: r.category || '',
    cnki_categories: r.categories || [],
    cnki_tags: r.tags || [],
  };
  if (r.compound_if) patch.cnki_compound_if = r.compound_if;
  if (r.comprehensive_if) patch.cnki_comprehensive_if = r.comprehensive_if;
  mergeDomestic(r, patch);
}

const output = records
  .filter((r) => r && (r.name || r.cn_name) && (
    r.issn || r.eissn || r.cn_code || r.slug || r.indices || r.cnkx || r.cssci || r.pku || r.cscd || r.cstpcd || r.scd || r.ami || r.ccft || r.zju || r.nsfc_mgmt || r.cnki_category
  ))
  .map((r) => {
    const clean = {};
    Object.keys(r).sort().forEach((key) => {
      const value = r[key];
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value) && !value.length) return;
      clean[key] = value;
    });
    return clean;
  });

const json = JSON.stringify(output);
fs.writeFileSync(OUT_FILE, zlib.gzipSync(json, { level: 9 }));
console.log(`wrote ${OUT_FILE.pathname} (${output.length.toLocaleString()} records, ${Buffer.byteLength(json).toLocaleString()} bytes raw)`);
