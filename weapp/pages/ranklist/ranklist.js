const app = getApp()

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
    wx.request({
      url: `${app.globalData.apiBase}/rankings/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`,
      method: 'GET',
      data: { limit: 20 },
      success: (res) => {
        const items = res.data && Array.isArray(res.data.items) ? res.data.items : null
        if (!items) {
          this.setData({ journals: [], loading: false, error: '榜单接口待接入' })
          return
        }
        this.setData({
          journals: items.slice(0, 20).map(normalizeItem),
          loading: false,
          error: ''
        })
      },
      fail: () => {
        this.setData({ journals: [], loading: false, error: '榜单接口待接入' })
      }
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
