const VIEW_KEY = 'ailatest.activity.views.v1'
const PICK_KEY = 'ailatest.activity.picks.v1'
const VIEW_LIMIT = 80
const PICK_LIMIT = 40

function text(value) {
  return String(value == null ? '' : value).trim()
}

function read(key) {
  try {
    const value = wx.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (err) {
    return []
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (err) {
    console.warn('保存活动记录失败', err)
  }
  return value
}

function itemKey(item = {}) {
  const raw = [item.key, item.issn, item.eissn, item.slug, item.title, item.name]
    .map(text)
    .find(value => value && !['-', '—', 'NA', 'N/A'].includes(value.toUpperCase()))
  return text(raw).toUpperCase().replace(/[^A-Z0-9\u4E00-\u9FFF]/g, '')
}

function toJournal(item = {}) {
  return {
    key: itemKey(item),
    slug: text(item.slug),
    title: text(item.title || item.name || item.journal_title || item.slug || '未命名期刊'),
    issn: text(item.issn),
    ifText: text(item.ifText || item.if_latest || item.if_2025 || item.if_2024 || item.if),
    jcr: text(item.jcr || item.if_quartile),
    cas: text(item.cas || item.cas_zone),
    viewedAt: Date.now()
  }
}

function loadViews() {
  return read(VIEW_KEY)
}

function recordView(item) {
  const entry = toJournal(item)
  if (!entry.key) return loadViews()
  const next = loadViews().filter(saved => saved && saved.key !== entry.key)
  next.unshift(entry)
  return write(VIEW_KEY, next.slice(0, VIEW_LIMIT))
}

function loadPicks() {
  return read(PICK_KEY)
}

function activityMillis(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n > 100000000000 ? n : n * 1000
}

function mergeViews(incoming = []) {
  const map = new Map()
  ;[].concat(loadViews(), Array.isArray(incoming) ? incoming : []).forEach(item => {
    if (!item || !item.key) return
    const previous = map.get(item.key)
    if (!previous || activityMillis(item.viewedAt || item.viewed_at) >= activityMillis(previous.viewedAt || previous.viewed_at)) {
      map.set(item.key, item)
    }
  })
  const next = [...map.values()]
    .sort((a, b) => activityMillis(b.viewedAt || b.viewed_at) - activityMillis(a.viewedAt || a.viewed_at))
    .slice(0, VIEW_LIMIT)
  return write(VIEW_KEY, next)
}

function mergePicks(incoming = []) {
  const map = new Map()
  ;[].concat(loadPicks(), Array.isArray(incoming) ? incoming : []).forEach(item => {
    if (!item || !item.key) return
    const previous = map.get(item.key)
    if (!previous || activityMillis(item.pickedAt || item.picked_at) >= activityMillis(previous.pickedAt || previous.picked_at)) {
      map.set(item.key, item)
    }
  })
  const next = [...map.values()]
    .sort((a, b) => activityMillis(b.pickedAt || b.picked_at) - activityMillis(a.pickedAt || a.picked_at))
    .slice(0, PICK_LIMIT)
  return write(PICK_KEY, next)
}

function recordPick(query, results = []) {
  const cleanQuery = text(query)
  if (!cleanQuery) return loadPicks()
  const key = cleanQuery.toLowerCase()
  const entry = {
    key,
    query: cleanQuery,
    results: results.slice(0, 8).map(toJournal),
    pickedAt: Date.now()
  }
  const next = loadPicks().filter(saved => saved && saved.key !== key)
  next.unshift(entry)
  return write(PICK_KEY, next.slice(0, PICK_LIMIT))
}

function clearViews() {
  return write(VIEW_KEY, [])
}

function clearPicks() {
  return write(PICK_KEY, [])
}

module.exports = {
  loadViews,
  recordView,
  loadPicks,
  recordPick,
  mergeViews,
  mergePicks,
  clearViews,
  clearPicks
}
