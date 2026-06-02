/**
 * 纯本地数据模块 — 从小程序分包 static-data/ 读取期刊数据
 * 零网络、零后端、零备案
 */
const fflate = require('../vendor/fflate')

let manifestCache = null
let searchIndexCache = null
const detailBucketCache = {}
let dataReady = false
let readyResolve = null

function getFs() {
  if (!wx || !wx.getFileSystemManager) throw new Error('当前基础库不支持文件系统')
  return wx.getFileSystemManager()
}

function strFromU8(bytes) {
  if (fflate.strFromU8) return fflate.strFromU8(bytes)
  let text = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  try { return decodeURIComponent(escape(text)) }
  catch (err) { return text }
}

function readGzipJson(relPath) {
  const compressed = getFs().readFileSync(relPath)
  const text = strFromU8(fflate.gunzipSync(new Uint8Array(compressed)))
  return JSON.parse(text)
}

/** 预加载数据分包（启动时调用，确保分包文件可读） */
function preload() {
  if (dataReady) return Promise.resolve()
  if (readyResolve) return readyResolve

  readyResolve = new Promise((resolve, reject) => {
    const sub = wx.loadSubpackage({
      name: 'data',
      success() {
        dataReady = true
        resolve()
      },
      fail(err) {
        console.error('数据分包加载失败', err)
        reject(err)
      }
    })
    // 超时保护（15秒）
    setTimeout(() => {
      if (!dataReady) {
        dataReady = true
        resolve()
      }
    }, 15000)
  })
  return readyResolve
}

async function getManifest() {
  if (manifestCache) return manifestCache
  // 先从 unpacked 读取，如果找不到说明已加载
  try {
    manifestCache = readGzipJson('static-data/manifest.json')
    // 如果 manifest 没压缩，上面会抛异常，走下面
  } catch (e) {
    manifestCache = JSON.parse(getFs().readFileSync('static-data/manifest.json', 'utf8'))
  }
  return manifestCache
}

async function ensureSearchIndex() {
  if (searchIndexCache) return searchIndexCache
  try {
    searchIndexCache = readGzipJson('static-data/search-index.json.gz')
  } catch (e) {
    console.error('搜索索引加载失败', e)
    throw new Error('数据加载失败，请重试')
  }
  return searchIndexCache
}

function bucketForSlug(slug) {
  const first = String(slug || 'other')[0].toLowerCase()
  if (/^[a-z]$/.test(first)) return first
  if (/^\d$/.test(first)) return '0-9'
  return 'other'
}

async function getDetailBucket(slug) {
  const bucket = bucketForSlug(slug)
  if (!detailBucketCache[bucket]) {
    try {
      detailBucketCache[bucket] = readGzipJson(`static-data/details/${bucket}.json.gz`)
    } catch (e) {
      console.error(`详情桶加载失败: ${bucket}`, e)
      detailBucketCache[bucket] = []
    }
  }
  return detailBucketCache[bucket]
}

// ───────── 搜索/筛选工具 ─────────

function includesAny(values, targets) {
  if (!Array.isArray(targets) || !targets.length) return true
  const normalized = (values || []).map(v => String(v).toLowerCase())
  return targets.some(target => normalized.includes(String(target).toLowerCase()))
}

function textIncludesAny(text, targets) {
  if (!Array.isArray(targets) || !targets.length) return true
  const haystack = String(text || '').toLowerCase()
  return targets.some(target => haystack.includes(String(target).toLowerCase()))
}

function matchesFilters(item, filters = {}) {
  if (!includesAny(item.indices, filters.indices)) return false
  if (!textIncludesAny(item.jcr, filters.jcr)) return false
  if (Array.isArray(filters.cas) && filters.cas.length) {
    const cas = String(item.cas || '')
    const ok = filters.cas.some(v => v === 'TOP' ? cas.includes('TOP') : cas.includes(v))
    if (!ok) return false
  }
  if (Array.isArray(filters.xr) && filters.xr.length) {
    const xr = String(item.xr || '')
    const ok = filters.xr.some(v => v === 'TOP' ? xr.includes('TOP') : xr.includes(v))
    if (!ok) return false
  }
  if (!textIncludesAny(item.searchText, filters.subject ? [].concat(filters.subject) : [])) return false
  if (Array.isArray(filters.abdc) && filters.abdc.length && !filters.abdc.includes(item.abdc)) return false
  if (Array.isArray(filters.abs) && filters.abs.length && !filters.abs.includes(item.abs)) return false
  if (Array.isArray(filters.feature) && filters.feature.length) {
    if (filters.feature.includes('free') && item.freeText !== '免费发表') return false
    if (filters.feature.includes('warning') && !/预警：(?!无)/.test(`${item.warning || ''}${item.citicWarning || ''}`)) return false
  }
  return true
}

function normalizeListItem(item, idx) {
  return {
    id: item.id || item.slug || `${idx}`,
    slug: item.slug,
    title: item.title,
    issn: item.issn || '-',
    publisher: item.publisher || '',
    ifText: item.ifText || '-',
    jcr: item.jcr || '-',
    cas: item.cas || '-',
    xr: item.xr || '-',
    reviewCycle: item.reviewCycle || '审稿周期待查',
    freeText: item.freeText || '付费发表',
    badges: (item.badges || []).slice(0, 5),
    initials: item.initials || 'J',
    logoTone: item.logoTone || ['tone-orange', 'tone-green', 'tone-blue'][idx % 3]
  }
}

function scoreItem(item, terms, mode) {
  if (!terms.length) return Number(item.ifValue) || 0
  const title = String(item.title || '').toLowerCase()
  const issn = String(item.issn || '').toLowerCase()
  const subject = String(item.subject || '').toLowerCase()
  const phrase = terms.join(' ')
  let score = 0
  if (phrase && title === phrase) score += 260
  else if (phrase && title.includes(phrase)) score += 180
  for (const term of terms) {
    if (title === term) score += 120
    else if (title.startsWith(term)) score += 80
    else if (title.includes(term)) score += 45
    if (issn.includes(term)) score += 100
    if (subject.includes(term)) score += 20
    if (mode === 'pick' && String(item.searchText || '').includes(term)) score += 8
  }
  return score * 1000 + (Number(item.ifValue) || 0)
}

async function searchJournals({ q = '', filters = {}, mode = 'search', limit = 20 } = {}) {
  const start = Date.now()
  const manifest = await getManifest()
  const keyword = String(q || '').trim().toLowerCase()
  const terms = keyword.split(/\s+/).filter(Boolean)
  let results = (await ensureSearchIndex()).filter((item) => {
    if (!matchesFilters(item, filters)) return false
    if (!terms.length) return true
    const text = item.searchText || ''
    if (mode === 'pick') return terms.some(term => text.includes(term))
    return terms.every(term => text.includes(term))
  })

  const matchedCount = results.length
  results = results
    .sort((a, b) => scoreItem(b, terms, mode) - scoreItem(a, terms, mode))
    .slice(0, limit)

  return {
    items: results.map(r => normalizeListItem(r, 0)),
    total: matchedCount,
    elapsed: Date.now() - start,
    dataTotal: manifest.total
  }
}

async function getJournalDetail(slug) {
  const target = String(slug || '')
  const item = (await getDetailBucket(target)).find(row => row.slug === target)
  if (!item) throw new Error('没有找到这个期刊')
  return item
}

async function getRanking({ type = '', slug = '', limit = 20 } = {}) {
  const filters = {}
  if (type === 'index') filters.indices = [slug === 'ei' ? 'EI' : slug.toUpperCase()]
  if (type === 'zone') {
    if (slug === 'jcr-q1') filters.jcr = ['Q1']
    if (slug === 'cas-1') filters.cas = ['1区']
    if (slug === 'xinrui-1') filters.xr = ['1区']
  }
  if (type === 'feature') {
    if (slug === 'free') filters.feature = ['free']
    if (slug === 'warning') filters.feature = ['warning']
  }
  if (type === 'subject') filters.subject = [subjectSlugToQuery(slug)]
  return (await searchJournals({ filters, limit })).items
}

function subjectSlugToQuery(slug) {
  const map = {
    architecture: '建筑',
    'energy-fuels': '能源',
    'materials-science': '材料',
    'clinical-medicine': '医学',
    'computer-science': '计算机',
    economics: '经济'
  }
  return map[slug] || String(slug || '').replace(/-/g, ' ')
}

function clearCache() {
  manifestCache = null
  searchIndexCache = null
  Object.keys(detailBucketCache).forEach(key => delete detailBucketCache[key])
}

module.exports = {
  preload,
  getManifest,
  searchJournals,
  getJournalDetail,
  getRanking,
  clearCache
}
