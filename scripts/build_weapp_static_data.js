const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.resolve(__dirname, '..')
const SOURCE = path.join(ROOT, 'data', 'journals.json.gz')
const OUT_DIR = path.join(ROOT, 'data', 'weapp')
const DETAIL_DIR = path.join(OUT_DIR, 'details')

const SUBJECT_ZH = {
  'ENERGY & FUELS': '能源与燃料',
  'ENGINEERING, CHEMICAL': '工程：化工',
  'CHEMISTRY, MULTIDISCIPLINARY': '化学：综合',
  'CHEMISTRY, MEDICINAL': '药物化学',
  'CHEMISTRY, PHYSICAL': '物理化学',
  'MATERIALS SCIENCE, MULTIDISCIPLINARY': '材料科学：综合',
  'NANOSCIENCE & NANOTECHNOLOGY': '纳米科学与纳米技术',
  'ENVIRONMENTAL SCIENCES': '环境科学',
  'ENVIRONMENTAL ENGINEERING': '环境工程',
  ENGINEERING: '工程技术',
  'BIOLOGY & BIOCHEMISTRY': '生物学与生物化学',
  'CLINICAL MEDICINE': '临床医学',
  'COMPUTER SCIENCE': '计算机科学',
  ECONOMICS: '经济学',
  MANAGEMENT: '管理学',
  'EDUCATION & EDUCATIONAL RESEARCH': '教育学与教育研究',
  PSYCHOLOGY: '心理学',
  'MULTIDISCIPLINARY SCIENCES': '综合性科学'
}

function asArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean).map(v => typeof v === 'string' ? v.trim() : v).filter(Boolean)
  return String(value).split(/[;；|,]/).map(v => v.trim()).filter(Boolean)
}

function cleanIndex(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^OAJ$/i.test(text)) return 'OAJ'
  return text
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))]
}

function titleCaseAllCaps(name) {
  const text = String(name || '').trim()
  if (!text) return ''
  if (/[a-z]/.test(text)) return text
  return text.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
}

function initials(title) {
  const letters = String(title || '')
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s[0])
    .join('')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()
  return letters || 'J'
}

function zoneText(zone, top) {
  if (!zone) return '-'
  const text = String(zone)
  return `${text}${text.includes('区') ? '' : '区'}${top ? ' TOP' : ''}`
}

function reviewMonths(row) {
  const direct = row.crossref && row.crossref.avg_months
  if (direct) return `约 ${Number(direct).toFixed(1).replace(/\.0$/, '')} 个月`
  const weeks = row.doaj && row.doaj.review_weeks
  if (weeks) {
    const months = Number(weeks) / 4
    return `约 ${months.toFixed(1).replace(/\.0$/, '')} 个月`
  }
  return '审稿周期待查'
}

function freeText(row) {
  if (row.free === true) return '免费发表'
  const apc = row.doaj && row.doaj.apc
  if (String(apc || '').toLowerCase() === 'no') return '免费发表'
  return '付费发表'
}

function oaText(row) {
  if (row.doaj || row.doaj_only) return 'OA 开放访问'
  if (row.free === true) return '可免费发表'
  return '未标记为全 OA'
}

function apcText(row) {
  if (row.doaj && row.doaj.fee) return String(row.doaj.fee)
  if (row.free === true) return '0'
  return '以官网为准'
}

function subjectZh(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = raw.toUpperCase().replace(/\s+/g, ' ')
  return SUBJECT_ZH[key] || raw
}

function casSubText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return `${value.name || ''}${value.zone ? ` · ${value.zone}区` : ''}${value.top ? ' TOP' : ''}`.trim()
}

function cnkxText(value) {
  if (!value) return '-'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(item => `${item.domain || ''}${item.tier ? ` ${item.tier}` : ''}`.trim()).filter(Boolean).join('；') || '-'
  }
  return value.tier || value.rating || '-'
}

function ratingText(value) {
  if (!value) return '-'
  if (typeof value === 'string') return value
  return value.rating || value.tier || value.level || '-'
}

function normalize(row, idx) {
  const title = titleCaseAllCaps(row.name || row.cn_name || 'Unknown Journal')
  const indices = uniq(asArray(row.indices).map(cleanIndex).concat([
    row.scopus ? 'Scopus' : '',
    row.medline ? 'MEDLINE' : '',
    row.oaj ? 'OAJ' : '',
    row.doaj || row.doaj_only ? 'DOAJ' : ''
  ]))
  const wosSubjects = uniq(asArray(row.wos_categories || row.jcr_cats).map(subjectZh))
  const eiSubjects = uniq(asArray(row.ei_subjects).map(subjectZh))
  const casSubcategories = asArray(row.cas_sub_cats).map(casSubText).filter(Boolean)
  const mainSubject = subjectZh(row.cas_major_cn || row.cnki_major || row.jcr_cat || row.esi_category || row.wos_categories && row.wos_categories[0])
  const slug = row.slug || `journal-${idx}`
  const item = {
    id: row.issn || row.eissn || slug,
    slug,
    title,
    cnName: row.cn_name || '',
    issn: row.issn || row.eissn || '-',
    eissn: row.eissn || '',
    publisher: row.publisher || '',
    country: row.country || '',
    ifText: row.if_2024 == null || row.if_2024 === '' ? '-' : String(row.if_2024),
    ifValue: Number(row.if_2024) || 0,
    ifRank: row.if_rank || '',
    jcr: row.if_quartile || '-',
    jcrCat: subjectZh(row.jcr_cat || row.jcr_cats && row.jcr_cats[0]),
    cas: zoneText(row.cas_zone || row.cas_major_zone, row.cas_top),
    casMajor: row.cas_major_cn || row.cas_major_cat || '',
    xr: zoneText(row.cas_xr && row.cas_xr.zone, row.cas_xr && row.cas_xr.top),
    cnkx: cnkxText(row.cnkx),
    abdc: ratingText(row.abdc),
    abs: ratingText(row.abs),
    ccf: ratingText(row.ccf),
    reviewCycle: reviewMonths(row),
    freeText: freeText(row),
    apc: apcText(row),
    oa: oaText(row),
    website: row.doaj && row.doaj.u || '',
    badges: indices.slice(0, 6),
    indices,
    initials: initials(title),
    logoTone: ['tone-orange', 'tone-green', 'tone-blue'][idx % 3],
    subject: mainSubject,
    wosSubjects,
    eiSubjects,
    jcrSubcategories: uniq(asArray(row.jcr_cats).map(v => `${subjectZh(v)} · ${row.if_quartile || '-'}`)),
    casSubcategories,
    esiSubject: subjectZh(row.esi_category),
    pubmed: row.pubmed ? 'PubMed 收录' : '未标记',
    pmc: row.pmc ? 'PMC 全文存档' : '未标记',
    warning: row.warning ? `中科院预警：${row.warning}` : '无中科院预警记录',
    citicWarning: row.citic_warning ? `中信所预警：${row.citic_warning}` : '无中信所预警记录',
    searchText: [
      title, row.cn_name, row.issn, row.eissn, row.abbr20, row.publisher, row.country,
      indices.join(' '), mainSubject, wosSubjects.join(' '), eiSubjects.join(' '), row.if_quartile,
      row.cas_zone, row.cas_major_cn, row.cnki_major, row.ccf, row.abdc, row.abs
    ].filter(Boolean).join(' ').toLowerCase()
  }
  const feeSentence = item.freeText === '免费发表' ? '本刊免费发表，' : `本刊${item.oa}，付费发表，`
  const reviewSentence = item.reviewCycle === '审稿周期待查' ? '审稿周期待查。' : `审稿周期约为${item.reviewCycle.replace(/^约\s*/, '')}。`
  item.overview = `${title} 是一份学术期刊，主要面向${mainSubject || '相关学科'}等研究方向，为相关研究成果提供发表渠道。国际简称：${row.abbr20 || item.initials}，${item.cas !== '-' ? `中科院分区为 ${item.cas}，` : ''}${item.jcr !== '-' ? `JCR 分区为 ${item.jcr}，` : ''}${item.ifText !== '-' ? `影响因子 IF ${item.ifText}${item.ifRank ? `，IF 排名 ${item.ifRank}` : ''}。` : ''}${feeSentence}${reviewSentence}目前收录于${indices.length ? indices.join('/') : '相关数据库'}。`
  return item
}

function bucketForSlug(slug) {
  const first = String(slug || 'other')[0].toLowerCase()
  if (/^[a-z]$/.test(first)) return first
  if (/^\d$/.test(first)) return '0-9'
  return 'other'
}

function writeGzipJson(file, value) {
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(value)))
}

fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(DETAIL_DIR, { recursive: true })

const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(SOURCE)))
const normalized = rows.map(normalize)
const searchIndex = normalized.map(({ searchText, overview, jcrSubcategories, casSubcategories, wosSubjects, eiSubjects, ...item }) => ({
  ...item,
  searchText
}))

const buckets = {}
for (const item of normalized) {
  const bucket = bucketForSlug(item.slug)
  if (!buckets[bucket]) buckets[bucket] = []
  buckets[bucket].push(item)
}

for (const [bucket, items] of Object.entries(buckets)) {
  writeGzipJson(path.join(DETAIL_DIR, `${bucket}.json.gz`), items)
}

writeGzipJson(path.join(OUT_DIR, 'search-index.json.gz'), searchIndex)
fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({
  version: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
  total: normalized.length,
  search: 'search-index.json.gz',
  detailDir: 'details',
  buckets: Object.keys(buckets).sort()
}, null, 2))

const totalSize = fs.readdirSync(OUT_DIR, { recursive: true })
  .map(name => path.join(OUT_DIR, name))
  .filter(file => fs.statSync(file).isFile())
  .reduce((sum, file) => sum + fs.statSync(file).size, 0)

console.log(`Wrote ${normalized.length} journals`)
console.log(`Static data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
