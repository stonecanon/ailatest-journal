const STORAGE_KEY = 'ailatest.favorites.v1'
const TRANSFER_FORMAT = 'ailatest-favorites'
const TRANSFER_TEXT_HEADER = 'AILATEST-FAVORITES-TEXT v1'
const DEFAULT_FOLDER_ID = 'default'
const DEFAULT_FOLDER_NAME = '默认收藏夹'

function text(value) {
  return String(value == null ? '' : value).trim()
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(value => text(value)))]
}

// 同步文件使用稳定的无标点 key，网页和小程序不会因为 ISSN 的连字符格式不同而重复收藏。
function itemKey(item = {}) {
  const raw = [item.key, item.issn, item.eissn, item.slug, item.title, item.name, item.journal_title]
    .map(value => text(value))
    .find(value => value && !['-', '—', 'NA', 'N/A', 'NULL'].includes(value.toUpperCase()))
  const value = text(raw).toUpperCase().replace(/[^A-Z0-9\u4E00-\u9FFF]/g, '')
  return value || `JOURNAL-${Date.now().toString(36)}`
}

function normalizeItem(item = {}) {
  const title = text(item.title || item.name || item.journal_title || item.cn_name || item.slug || item.issn || '未命名期刊')
  const key = itemKey(item)
  return {
    ...item,
    key,
    id: item.id || key,
    title,
    name: text(item.name || title),
    slug: text(item.slug),
    issn: text(item.issn),
    eissn: text(item.eissn),
    publisher: text(item.publisher),
    ifText: text(item.ifText || item.if_latest || item.if_2025 || item.if_2024 || item.if),
    jcr: text(item.jcr || item.if_quartile),
    cas: text(item.cas || item.cas_zone),
    badges: Array.isArray(item.badges) ? item.badges.slice(0, 8) : []
  }
}

function normalizeList(input = {}, index = 0) {
  const sourceItems = Array.isArray(input.items)
    ? input.items
    : (Array.isArray(input.journals) ? input.journals : [])
  const itemsByKey = {}
  sourceItems.forEach(item => {
    const normalized = normalizeItem(item)
    itemsByKey[normalized.key] = normalized
  })

  const rawIds = Array.isArray(input.ids) ? input.ids : []
  const ids = unique(rawIds.map(value => itemKey({ key: value })))
  Object.keys(itemsByKey).forEach(key => {
    if (!ids.includes(key)) ids.push(key)
  })

  const items = ids.map(key => itemsByKey[key] || normalizeItem({ key, title: key }))
  return {
    id: text(input.id) || `list-${index + 1}`,
    name: text(input.name || input.title) || '未命名收藏夹',
    desc: text(input.desc || input.description),
    ids,
    items
  }
}

function normalizeLists(lists) {
  const sources = Array.isArray(lists) ? lists : []
  const normalized = []
  const positions = new Map()

  sources.forEach((source, index) => {
    const list = normalizeList(source, index)
    if (list.id === DEFAULT_FOLDER_ID) {
      list.name = DEFAULT_FOLDER_NAME
      list.desc = list.desc || '收藏的期刊'
    }

    // 同一个收藏夹从网页和小程序合并导入时，按 id 合并内容；
    // 不同收藏夹允许收藏同一本期刊。
    const existingIndex = positions.get(list.id)
    if (existingIndex === undefined) {
      positions.set(list.id, normalized.length)
      normalized.push(list)
      return
    }
    const existing = normalized[existingIndex]
    normalized[existingIndex] = normalizeList({
      ...existing,
      ids: [...existing.ids, ...list.ids],
      items: [...existing.items, ...list.items]
    }, existingIndex)
  })

  const defaultIndex = normalized.findIndex(list => list.id === DEFAULT_FOLDER_ID)
  if (defaultIndex < 0) {
    normalized.unshift(normalizeList({
      id: DEFAULT_FOLDER_ID,
      name: DEFAULT_FOLDER_NAME,
      desc: '收藏的期刊',
      items: []
    }))
  } else if (defaultIndex > 0) {
    const [defaultList] = normalized.splice(defaultIndex, 1)
    normalized.unshift(defaultList)
  }
  return normalized
}

function loadLists(seed = []) {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const stored = parsed && Array.isArray(parsed.lists) ? parsed.lists : parsed
    if (Array.isArray(stored) && stored.length) return saveLists(stored)
  } catch (err) {
    console.warn('读取收藏夹失败', err)
  }
  return saveLists(seed)
}

function saveLists(lists) {
  const normalized = normalizeLists(lists)
  wx.setStorageSync(STORAGE_KEY, { version: 1, lists: normalized })
  return normalized
}

function exportPayload(lists, source = 'weapp') {
  return {
    format: TRANSFER_FORMAT,
    version: 1,
    source,
    exportedAt: new Date().toISOString(),
    lists: normalizeLists(lists).map(list => ({
      id: list.id,
      name: list.name,
      desc: list.desc,
      ids: list.ids,
      items: list.items
    }))
  }
}

function parseTransfer(value) {
  let payload = value
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload.replace(/^\uFEFF/, '')) }
    catch (err) { throw new Error('同步文件不是有效的 JSON') }
  }
  if (!payload || payload.format !== TRANSFER_FORMAT) {
    throw new Error('不是 AILatest Journal 收藏同步文件')
  }
  const lists = Array.isArray(payload.lists)
    ? payload.lists
    : (payload.list ? [payload.list] : (Array.isArray(payload.items) ? [{ name: DEFAULT_FOLDER_NAME, items: payload.items }] : []))
  if (!lists.length) throw new Error('同步文件中没有收藏夹')
  return { ...payload, lists: normalizeLists(lists) }
}

function looksLikeIssn(value) {
  const compact = text(value).replace(/[\s-]/g, '').toUpperCase()
  return /^\d{7}[\dX]$/.test(compact)
}

function plainTextIdentifier(item = {}) {
  const candidate = text(item.issn || item.eissn)
  return looksLikeIssn(candidate) ? candidate : ''
}

// 纯文本同步格式：第一行是格式标记，随后用「# 收藏夹：名称」分组；
// 每行是「ISSN<TAB>期刊名」，没有 ISSN 时只写期刊名。
function exportPlainText(lists) {
  const normalized = normalizeLists(lists)
  const rows = []
  normalized.forEach(list => {
    rows.push(`# 收藏夹：${list.name}`)
    const seen = new Set()
    list.items.forEach(item => {
      const normalizedItem = normalizeItem(item)
      if (seen.has(normalizedItem.key)) return
      seen.add(normalizedItem.key)
      const identifier = plainTextIdentifier(normalizedItem)
      const title = text(normalizedItem.title || normalizedItem.name || normalizedItem.slug || identifier)
      if (!identifier && !title) return
      rows.push(identifier ? `${identifier}\t${title}` : title)
    })
  })
  return [TRANSFER_TEXT_HEADER, ...rows].join('\n')
}

function parsePlainText(value) {
  const raw = text(value).replace(/^\uFEFF/, '')
  if (!raw) throw new Error('剪贴板中没有收藏内容')

  const parsedLists = []
  let currentList = null
  const getCurrentList = () => {
    if (!currentList) {
      currentList = { id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME, desc: '收藏的期刊', items: [] }
      parsedLists.push(currentList)
    }
    return currentList
  }
  raw.split(/\r?\n/).forEach(lineValue => {
    let line = text(lineValue)
    if (!line || /^AILATEST[- ]FAVORITES(?:-TEXT)?/i.test(line) || /^AILatest Journal Favorites$/i.test(line)) return
    const folderMatch = line.match(/^#\s*(?:收藏夹|文件夹|folder|list)\s*[：:]\s*(.+)$/i)
    if (folderMatch) {
      const name = text(folderMatch[1]) || DEFAULT_FOLDER_NAME
      currentList = parsedLists.find(list => list.name === name)
      if (!currentList) {
        currentList = {
          id: name === DEFAULT_FOLDER_NAME ? DEFAULT_FOLDER_ID : `list-${parsedLists.length + 1}`,
          name,
          desc: '收藏的期刊',
          items: []
        }
        parsedLists.push(currentList)
      }
      return
    }
    if (/^#/.test(line)) return
    line = line.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '').trim()
    if (!line) return

    const parts = line.split('\t').map(text).filter(Boolean)
    let identifier = ''
    let title = ''
    if (parts.length >= 2 && looksLikeIssn(parts[0])) {
      identifier = parts[0]
      title = parts.slice(1).join(' ')
    } else {
      title = parts.join(' ')
    }
    if (!title && identifier) title = identifier
    if (!title && !identifier) return

    const item = normalizeItem({
      key: identifier || title,
      title: title || identifier,
      name: title || identifier,
      issn: identifier
    })
    const target = getCurrentList()
    if (target.items.some(existing => existing.key === item.key)) return
    target.items.push(item)
  })

  if (!parsedLists.some(list => list.items.length)) throw new Error('剪贴板中没有可识别的期刊')
  return {
    format: TRANSFER_FORMAT,
    version: 1,
    source: 'clipboard',
    lists: parsedLists
  }
}

function copyPlainText(lists) {
  const content = exportPlainText(lists)
  const count = totalCount(lists)
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: content,
      success: () => resolve({ content, count }),
      fail: reject
    })
  })
}

function readPlainTextClipboard() {
  return new Promise((resolve, reject) => {
    if (typeof wx.getClipboardData !== 'function') {
      reject(new Error('当前微信版本不支持读取剪贴板'))
      return
    }
    wx.getClipboardData({
      success: result => resolve(String(result && result.data || '')),
      fail: reject
    })
  })
}

function mergeLists(current, incoming) {
  return normalizeLists([...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])])
}

function addToList(lists, listId, item) {
  const normalized = normalizeLists(lists)
  const target = normalized.find(list => list.id === listId) || normalized[0]
  if (!target) return normalized
  const normalizedItem = normalizeItem(item)
  if (!target.ids.includes(normalizedItem.key)) {
    target.ids.push(normalizedItem.key)
    target.items.push(normalizedItem)
  }
  return normalized
}

function removeFromLists(lists, key) {
  const normalizedKey = itemKey({ key })
  return normalizeLists(lists).map(list => ({
    ...list,
    ids: list.ids.filter(id => id !== normalizedKey),
    items: list.items.filter(item => itemKey(item) !== normalizedKey)
  }))
}

function writeTransferFile(payload) {
  const content = JSON.stringify(payload, null, 2)
  return new Promise((resolve, reject) => {
    const fallback = () => {
      wx.setClipboardData({
        data: content,
        success: () => resolve({ shared: false, copied: true }),
        fail: reject
      })
    }
    if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) return fallback()
    const filePath = `${wx.env.USER_DATA_PATH}/ailatest-favorites.json`
    wx.getFileSystemManager().writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => {
        if (typeof wx.shareFileMessage !== 'function') return fallback()
        wx.shareFileMessage({
          filePath,
          fileName: 'ailatest-favorites.json',
          success: () => resolve({ filePath, shared: true, copied: false }),
          fail: () => fallback()
        })
      },
      fail: reject
    })
  })
}

function chooseTransferFile() {
  return new Promise((resolve, reject) => {
    if (typeof wx.chooseMessageFile !== 'function') {
      reject(new Error('当前微信版本不支持选择文件，请从聊天文件中选择 JSON'))
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: result => {
        const file = result.tempFiles && result.tempFiles[0]
        if (!file || !file.path) return reject(new Error('没有选择文件'))
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: data => resolve(typeof data.data === 'string' ? data.data : String(data.data || '')),
          fail: reject
        })
      },
      fail: reject
    })
  })
}

function totalCount(lists) {
  return new Set(normalizeLists(lists).flatMap(list => list.ids)).size
}

module.exports = {
  STORAGE_KEY,
  DEFAULT_FOLDER_ID,
  DEFAULT_FOLDER_NAME,
  itemKey,
  normalizeItem,
  normalizeLists,
  loadLists,
  saveLists,
  exportPayload,
  parseTransfer,
  exportPlainText,
  parsePlainText,
  copyPlainText,
  readPlainTextClipboard,
  mergeLists,
  addToList,
  removeFromLists,
  writeTransferFile,
  chooseTransferFile,
  totalCount
}
