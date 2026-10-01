/**
 * 纯本地数据模块 — 从 16 个微信分包 (static-data-0 ~ static-data-15) 读取期刊数据
 * 零网络、零后端、零备案
 *
 * 分包布局：
 *   static-data-0 : manifest.bin + detail-index-<bucket>.bin
 *   static-data-1~4 : search-0~3.bin（列式 {fields, rows}）
 *   static-data-5~15 : details/<bucket>-<n>.bin（对象数组）
 *
 * 加载策略：启动只加载 data0(清单) + data1~4(搜索)，约 5.6MB；
 *          详情分包 data5~15 等点进详情页再按需加载。
 */
const fflate = require('../vendor/fflate')

// ───────── 缓存 ─────────
let manifestCache = null
let searchChunks = null   // [{ fields, idx, rows }]
let searchReady = null
const detailIndexCache = {}   // bucket -> { slug: path }
const detailFileCache = {}    // path -> [obj]
const loadedSubs = {}         // root -> true

// ───────── 基础工具 ─────────
function app() {
  return typeof getApp === 'function' ? getApp() : null
}

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

// ───────── 分包加载 ─────────
/**
 * 加载指定分包。name 为 app.json 中的分包 name，root 为分包根目录。
 * 占位页 onLoad 会回调 app.globalData.__localDataSubpackageWaiters[root]，
 * 这里同时挂载该回调做双保险（部分基础库 loadSubpackage success 触发时机偏晚）。
 */
function loadSubpackage(root, name) {
  if (loadedSubs[root]) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const a = app()
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      loadedSubs[root] = true
      if (a && a.clearSubpackageWaiter) a.clearSubpackageWaiter(root)
      resolve()
    }
    const fail = (err) => {
      if (settled) return
      settled = true
      if (a && a.clearSubpackageWaiter) a.clearSubpackageWaiter(root)
      reject(err)
    }
    if (a && a.registerSubpackageWaiter) a.registerSubpackageWaiter(root, done)

    if (!wx || !wx.loadSubpackage) { done(); return }
    wx.loadSubpackage({
      name: name,
      success: done,
      fail: fail
    })
    // 超时保护（12 秒）：避免个别基础库回调不触发导致整页卡死
    setTimeout(done, 12000)
  })
}

/** 启动预加载：清单(data0) + 搜索分片(data1~4) */
function preload() {
  if (searchReady) return searchReady
  searchReady = Promise.resolve()
    .then(() => loadSubpackage('static-data-0', 'data0'))
    .then(() => loadSubpackage('static-data-1', 'data1'))
    .then(() => loadSubpackage('static-data-2', 'data2'))
    .then(() => loadSubpackage('static-data-3', 'data3'))
    .then(() => loadSubpackage('static-data-4', 'data4'))
    .then(() => ensureSearch())
    .catch((err) => {
      console.error('本地数据预加载失败', err)
      searchReady = null
      throw err
    })
  return searchReady
}

// ───────── 清单 ─────────
function ensureManifest() {
  if (manifestCache) return Promise.resolve(manifestCache)
  return loadSubpackage('static-data-0', 'data0').then(() => {
    manifestCache = readGzipJson('static-data-0/manifest.bin')
    return manifestCache
  })
}

function getManifest() {
  return ensureManifest()
}

// ───────── 搜索索引 ─────────
function makeChunkReader(chunk) {
  const fields = chunk.fields || []
  const idx = {}
  for (let i = 0; i < fields.length; i++) idx[fields[i]] = i
  return { fields: fields, idx: idx, rows: chunk.rows || [] }
}

function ensureSearch() {
  if (searchChunks) return Promise.resolve(searchChunks)
  return ensureManifest().then((m) => {
    const paths = m.searchChunks || []
    const roots = []
    for (const p of paths) {
      const root = String(p).split('/')[0]
      if (roots.indexOf(root) === -1) roots.push(root)
    }
    return roots.reduce((chain, root, i) => {
      return chain.then(() => loadSubpackage(root, 'data' + root.replace('static-data-', '')))
    }, Promise.resolve()).then(() => {
      searchChunks = paths.map((p) => makeChunkReader(readGzipJson(p)))
      return searchChunks
    })
  })
}

/** 为一行的可搜索文本（补 searchText 缺失） */
const SEARCH_KEYS = ['title', 'cnName', 'abbreviation', 'abbreviationSearch', 'issn', 'eissn', 'publisher', 'sponsor', 'subject']
function rowSearchText(row, idx) {
  let s = ''
  if (idx.searchText != null && row[idx.searchText]) return String(row[idx.searchText]).toLowerCase()
  for (const k of SEARCH_KEYS) {
    const i = idx[k]
    if (i != null && row[i]) s += ' ' + row[i]
  }
  return s.toLowerCase()
}

// ───────── 行 → 对象 ─────────
function rowToObj(chunk, row) {
  const o = {}
  const fields = chunk.fields
  for (let i = 0; i < fields.length; i++) o[fields[i]] = row[i]
  return o
}

// ───────── 筛选匹配 ─────────
function asArr(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function toText(v) {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(' ')
  if (typeof v === 'object') return Object.keys(v).join(' ')
  return String(v)
}

function includesAny(values, targets) {
  if (!Array.isArray(targets) || !targets.length) return true
  const normalized = asArr(values).map(v => String(v).toLowerCase())
  return targets.some(target => normalized.includes(String(target).toLowerCase()))
}

function textIncludesAny(text, targets) {
  if (!Array.isArray(targets) || !targets.length) return true
  const haystack = String(text || '').toLowerCase()
  return targets.some(target => haystack.includes(String(target).toLowerCase()))
}

function matchesFilters(item, filters) {
  filters = filters || {}
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
  if (Array.isArray(filters.subject) && filters.subject.length) {
    if (!textIncludesAny(item.subject, filters.subject)) return false
  }
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
    cnName: item.cnName || '',
    issn: item.issn || '-',
    publisher: item.publisher || '',
    ifText: item.ifText || '-',
    ifValue: Number(item.ifValue) || 0,
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
  const cnName = String(item.cnName || '').toLowerCase()
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
    if (cnName.includes(term)) score += 40
    if (issn.includes(term)) score += 100
    if (subject.includes(term)) score += 20
    if (mode === 'pick') score += 8
  }
  return score * 1000 + (Number(item.ifValue) || 0)
}

// ───────── 搜索 ─────────
async function searchJournals(opts) {
  opts = opts || {}
  const q = opts.q || ''
  const filters = opts.filters || {}
  const mode = opts.mode || 'search'
  const limit = opts.limit || 20
  const start = Date.now()
  const manifest = await ensureManifest()
  await ensureSearch()

  const keyword = String(q || '').trim().toLowerCase()
  const terms = keyword.split(/\s+/).filter(Boolean)

  // 空筛选判定
  let noFilters = true
  const fk = Object.keys(filters)
  for (let i = 0; i < fk.length; i++) {
    const v = filters[fk[i]]
    if (v != null && !(Array.isArray(v) && v.length === 0)) { noFilters = false; break }
  }

  // 快速路径：无关键词、无筛选（首页首屏）→ 只按 IF 取 top limit，避免全量建对象
  if (!terms.length && noFilters) {
    const cand = []
    for (const chunk of searchChunks) {
      const fi = chunk.idx.ifValue
      for (let r = 0; r < chunk.rows.length; r++) {
        const row = chunk.rows[r]
        cand.push({ v: fi != null ? (Number(row[fi]) || 0) : 0, c: chunk, r: row })
      }
    }
    cand.sort((a, b) => b.v - a.v)
    const top = cand.slice(0, limit)
    return {
      items: top.map((t, i) => normalizeListItem(rowToObj(t.c, t.r), i)),
      total: cand.length,
      elapsed: Date.now() - start,
      dataTotal: manifest.total
    }
  }

  const out = []
  let matchedCount = 0

  for (const chunk of searchChunks) {
    const idx = chunk.idx
    for (let r = 0; r < chunk.rows.length; r++) {
      const row = chunk.rows[r]
      // 文本预筛（避免全量转对象）
      if (terms.length) {
        const text = rowSearchText(row, idx)
        const hit = mode === 'pick' ? terms.some(t => text.includes(t)) : terms.every(t => text.includes(t))
        if (!hit) continue
      }
      const obj = rowToObj(chunk, row)
      if (!matchesFilters(obj, filters)) continue
      matchedCount++
      out.push({ obj: obj, text: '' })
    }
  }

  out.sort((a, b) => scoreItem(b.obj, terms, mode) - scoreItem(a.obj, terms, mode))
  const top = out.slice(0, limit)
  return {
    items: top.map((it, i) => normalizeListItem(it.obj, i)),
    total: matchedCount,
    elapsed: Date.now() - start,
    dataTotal: manifest.total
  }
}

// ───────── 详情 ─────────
function bucketForSlug(slug) {
  const first = String(slug || '').charAt(0).toLowerCase()
  if (/^[a-z]$/.test(first)) return first
  if (/^\d$/.test(first)) return '0-9'
  return 'other'
}

function ensureDetailIndex(bucket) {
  if (detailIndexCache[bucket]) return Promise.resolve(detailIndexCache[bucket])
  return ensureManifest().then((m) => {
    const path = (m.detailIndexes || {})[bucket]
    if (!path) throw new Error('没有找到这个期刊')
    const root = String(path).split('/')[0]
    return loadSubpackage(root, 'data' + root.replace('static-data-', '')).then(() => {
      detailIndexCache[bucket] = readGzipJson(path)
      return detailIndexCache[bucket]
    })
  })
}

function readDetailFile(path) {
  if (detailFileCache[path]) return detailFileCache[path]
  try {
    detailFileCache[path] = readGzipJson(path)
  } catch (e) {
    detailFileCache[path] = []
  }
  return detailFileCache[path]
}

async function getJournalDetail(slug) {
  const target = String(slug || '')
  const bucket = bucketForSlug(target)
  const index = await ensureDetailIndex(bucket)
  const path = index[target]
  if (!path) throw new Error('没有找到这个期刊')
  const root = String(path).split('/')[0]
  await loadSubpackage(root, 'data' + root.replace('static-data-', ''))
  const arr = readDetailFile(path)
  const item = arr.find(row => row.slug === target)
  if (!item) throw new Error('没有找到这个期刊')
  return item
}

// ───────── 榜单 ─────────
async function getRanking(opts) {
  opts = opts || {}
  const type = opts.type || ''
  const slug = opts.slug || ''
  const limit = opts.limit || 20
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
  const res = await searchJournals({ filters: filters, limit: limit })
  return res.items
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
  searchChunks = null
  searchReady = null
  Object.keys(detailIndexCache).forEach(k => delete detailIndexCache[k])
  Object.keys(detailFileCache).forEach(k => delete detailFileCache[k])
  Object.keys(loadedSubs).forEach(k => delete loadedSubs[k])
}

module.exports = {
  preload,
  getManifest,
  searchJournals,
  getJournalDetail,
  getRanking,
  clearCache
}
