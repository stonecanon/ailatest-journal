#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DATA_FILE = path.join(ROOT, 'data', 'journals.json')
const OUT_DIR = path.join(ROOT, 'weapp', 'cloudbase_import')
const TOP_N = 20

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\b(Of|And|In|For|The)\b/g, s => s.toLowerCase())
}

function cleanBadges(j) {
  return (j.indices || [])
    .filter(v => ['SCIE', 'SSCI', 'AHCI', 'ESCI', 'EI', 'Scopus', 'DOAJ', 'MEDLINE'].includes(v))
    .slice(0, 4)
}

function searchText(j) {
  return [
    j.name,
    j.cn_name,
    j.issn,
    j.eissn,
    j.abbr20,
    j.publisher,
    j.cas_major_cn,
    j.esi_category,
    ...(j.indices || []),
    ...(j.wos_categories || []),
    ...(j.ei_subjects || [])
  ].filter(Boolean).join(' ').toLowerCase()
}

function compact(j) {
  return {
    slug: j.slug,
    title: titleCase(j.name || j.title),
    name: j.name,
    cn_name: j.cn_name || '',
    issn: j.issn || '',
    eissn: j.eissn || '',
    publisher: j.publisher || '',
    indices: j.indices || [],
    if_2024: j.if_2024 || null,
    if_quartile: j.if_quartile || '',
    cas_zone: j.cas_zone || null,
    cas_top: !!j.cas_top,
    cas_major_cn: j.cas_major_cn || j.cas_major_cat || '',
    wos_categories: j.wos_categories || [],
    esi_category: j.esi_category || '',
    free: !!j.free,
    search_text: searchText(j),
    badges: cleanBadges(j)
  }
}

function detailDoc(j) {
  return {
    ...j,
    _id: j.slug,
    title: titleCase(j.name || j.title),
    badges: cleanBadges(j),
    search_text: searchText(j)
  }
}

function rankItem(j) {
  return {
    slug: j.slug,
    title: titleCase(j.name || j.title),
    issn: j.issn || j.eissn || '-',
    if_2024: j.if_2024 || null,
    ifText: j.if_2024 == null ? '-' : String(j.if_2024),
    if_quartile: j.if_quartile || '',
    jcr: j.if_quartile || '-',
    cas_zone: j.cas_zone || null,
    cas_top: !!j.cas_top,
    cas: j.cas_zone ? `${j.cas_zone}区${j.cas_top ? ' TOP' : ''}` : '-',
    indices: j.indices || [],
    badges: cleanBadges(j)
  }
}

function score(a, b) {
  const ai = Number(a.if_2024) || -1
  const bi = Number(b.if_2024) || -1
  if (bi !== ai) return bi - ai
  const az = a.cas_zone ? Number(a.cas_zone) : 99
  const bz = b.cas_zone ? Number(b.cas_zone) : 99
  if (az !== bz) return az - bz
  return String(a.name || '').localeCompare(String(b.name || ''))
}

function hasSubject(j, re) {
  return (j.wos_categories || []).some(v => re.test(v)) ||
    (j.ei_subjects || []).some(v => re.test(v)) ||
    re.test(j.esi_category || '') ||
    re.test(j.cas_major_cn || '')
}

const RANKING_SPECS = [
  ['index', 'scie', 'SCIE 期刊', j => (j.indices || []).includes('SCIE')],
  ['index', 'ssci', 'SSCI 期刊', j => (j.indices || []).includes('SSCI')],
  ['index', 'ahci', 'AHCI 期刊', j => (j.indices || []).includes('AHCI')],
  ['index', 'ei', 'EI Compendex', j => (j.indices || []).includes('EI')],
  ['index', 'scopus', 'Scopus 期刊', j => !!j.scopus || (j.indices || []).includes('Scopus')],
  ['index', 'doaj', 'DOAJ 期刊', j => !!j.doaj || !!j.doaj_only || (j.indices || []).includes('DOAJ')],
  ['subject', 'architecture', '建筑学', j => hasSubject(j, /Architecture|Building and Construction|Construction/i)],
  ['subject', 'energy-fuels', '能源与燃料', j => hasSubject(j, /Energy|Fuels/i)],
  ['subject', 'materials-science', '材料科学', j => hasSubject(j, /Materials/i)],
  ['subject', 'clinical-medicine', '临床医学', j => hasSubject(j, /Clinical Medicine|Medicine|Medical|Oncology|Surgery/i)],
  ['subject', 'computer-science', '计算机科学', j => hasSubject(j, /Computer Science|Artificial Intelligence|Information Systems|Software/i)],
  ['subject', 'economics', '经济学', j => hasSubject(j, /Economics|Finance|Business|Management/i)],
  ['zone', 'jcr-q1', 'JCR Q1', j => String(j.if_quartile).toUpperCase() === 'Q1'],
  ['zone', 'cas-1', '中科院 1 区', j => Number(j.cas_zone) === 1],
  ['zone', 'xinrui-1', '新锐 1 区', j => j.cas_xr && String(j.cas_xr.zone) === '1'],
  ['feature', 'free', '免费发表', j => j.free === true],
  ['feature', 'warning', '预警期刊', j => !!j.warning || !!j.citic_warning],
  ['feature', 'popular', '热门浏览', j => Number(j.if_2024) > 0]
]

function writeJsonl(file, rows) {
  fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
}

function main() {
  const journals = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const compactRows = journals.filter(j => j.slug).map(compact)
  writeJsonl(path.join(OUT_DIR, 'journal_search_index.jsonl'), compactRows)

  const detailRows = journals.filter(j => j.slug).map(detailDoc)
  writeJsonl(path.join(OUT_DIR, 'journals.jsonl'), detailRows)

  const rankingRows = RANKING_SPECS.map(([type, slug, title, predicate]) => ({
    _id: `${type}_${slug}`,
    type,
    slug,
    title,
    limit: TOP_N,
    sort: 'if_2024_desc',
    items: journals.filter(j => j.slug && predicate(j)).sort(score).slice(0, TOP_N).map(rankItem)
  }))
  writeJsonl(path.join(OUT_DIR, 'rankings.jsonl'), rankingRows)

  console.log(`Wrote ${compactRows.length} search docs`)
  console.log(`Wrote ${detailRows.length} journal detail docs`)
  console.log(`Wrote ${rankingRows.length} ranking docs`)
  console.log(OUT_DIR)
}

main()
