const app = getApp()
const localData = require('../../utils/localData')

function normalizeItem(row, idx) {
  const title = row.title || row.name || row.cn_name || 'Unknown Journal'
  return {
    slug: row.slug || row.id || row.issn || `${idx}`,
    title,
    issn: row.issn || row.eissn || '-',
    ifText: String(row.ifText || row.if_2024 || row.if || '-'),
    jcr: row.jcr || row.if_quartile || '-',
    cas: row.cas || (row.cas_zone ? `${row.cas_zone}区${row.cas_top ? ' TOP' : ''}` : '-'),
    badges: (row.badges || row.indices || []).slice(0, 4)
  }
}

Page({
  data: {
    title: '榜单',
    subtitle: 'Top 20 · 按影响因子排序',
    type: '',
    slug: '',
    loading: false,
    error: '',
    journals: []
  },

  onLoad(options = {}) {
    const title = decodeURIComponent(options.title || '榜单')
    const type = decodeURIComponent(options.type || '')
    const slug = decodeURIComponent(options.slug || '')
    this.setData({ title, type, slug, subtitle: 'Top 20 · 按影响因子排序' })
    this.fetchRank(type, slug)
  },

  fetchRank(type, slug) {
    this.setData({ loading: true, error: '' })
    if (app.globalData.cloudReady && wx.cloud) {
      api.getRanking({ type, slug, limit: 20 }).then((result) => {
        const items = Array.isArray(result.items) ? result.items : []
        this.setData({
          journals: items.slice(0, 20).map(normalizeItem),
          loading: false,
          error: ''
        })
      }).catch(() => {
        this.fetchLocalRank(type, slug)
      })
      return
    }
    this.fetchLocalRank(type, slug)
  },

  fetchLocalRank(type, slug) {
    localData.getRanking({ type, slug, limit: 20 })
      .then((items) => {
      this.setData({
        journals: items.slice(0, 20).map(normalizeItem),
        loading: false,
        error: ''
      })
      })
      .catch((err) => {
      this.setData({ journals: [], loading: false, error: `榜单数据读取失败：${err && err.message ? err.message : '未知错误'}` })
      })
  },

  openDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?slug=${encodeURIComponent(e.currentTarget.dataset.slug)}` })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.title} - JournalAI分区速查`,
      path: '/pages/rankings/rankings'
    }
  }
})
