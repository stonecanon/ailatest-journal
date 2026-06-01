const app = getApp()

const SAMPLE_JOURNALS = [
  {
    id: '0306-2619',
    slug: 'applied-energy',
    title: 'Applied Energy',
    issn: '0306-2619',
    publisher: 'Elsevier',
    ifText: '11',
    jcr: 'Q1',
    cas: '1区 TOP',
    xr: '1区 TOP',
    reviewCycle: '约 2-3 个月',
    freeText: '免费发表',
    badges: ['SCIE', 'EI', 'Scopus'],
    initials: 'AE',
    logoTone: 'tone-orange'
  },
  {
    id: '1754-5692',
    slug: 'energy-environmental-science',
    title: 'Energy & Environmental Science',
    issn: '1754-5692',
    publisher: 'RSC',
    ifText: '30.8',
    jcr: 'Q1',
    cas: '1区 TOP',
    xr: '1区 TOP',
    reviewCycle: '约 2.5-3.5 个月',
    freeText: '付费发表',
    badges: ['SCIE', 'EI', 'Scopus'],
    initials: 'EES',
    logoTone: 'tone-green'
  },
  {
    id: '2211-2855',
    slug: 'nano-energy',
    title: 'Nano Energy',
    issn: '2211-2855',
    publisher: 'Elsevier',
    ifText: '17.1',
    jcr: 'Q1',
    cas: '1区',
    xr: '1区',
    reviewCycle: '约 1.5-2.5 个月',
    freeText: '付费发表',
    badges: ['SCIE', 'EI', 'Scopus'],
    initials: 'NE',
    logoTone: 'tone-blue'
  },
  {
    id: '0935-9648',
    slug: 'advanced-materials',
    title: 'Advanced Materials',
    issn: '0935-9648',
    publisher: 'Wiley',
    ifText: '26.8',
    jcr: 'Q1',
    cas: '1区 TOP',
    xr: '1区',
    reviewCycle: '约 2 个月',
    freeText: '付费发表',
    badges: ['SCIE', 'EI'],
    initials: 'AM',
    logoTone: 'tone-orange'
  }
]

function formatZone(zone, top) {
  if (!zone) return '-'
  const text = String(zone)
  return `${text}${String(text).includes('区') ? '' : '区'}${top ? ' TOP' : ''}`
}

function formatFree(row) {
  if (row.freeText) return row.freeText
  if (row.free === true) return '免费发表'
  return '付费发表'
}

function formatReviewCycle(row) {
  return toMonthCycle(row.reviewCycle || row.review_cycle || row.review_time || row.sd_review_cycle || row.acceptance_time)
}

function toMonthCycle(value) {
  if (!value) return '审稿周期待查'
  const text = String(value).trim()
  if (!text) return '审稿周期待查'
  if (/月|month/i.test(text)) return text
  const nums = text.match(/\d+(?:\.\d+)?/g)
  if (!nums || !/(周|week)/i.test(text)) return text
  const months = nums.map(n => {
    const month = Number(n) / 4
    return Number.isInteger(month) ? String(month) : month.toFixed(1).replace(/\.0$/, '')
  })
  return months.length >= 2 ? `约 ${months[0]}-${months[1]} 个月` : `约 ${months[0]} 个月`
}

function cleanBadges(rowBadges) {
  return (rowBadges || [])
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .filter(v => !/(JCR|中科院|新锐|科协|ABDC|ABS|Q[1-4]|[1-4]区|TOP|免费发表|付费发表|开放获取|OA)/i.test(v))
    .slice(0, 5)
}

function decorateOptions(options, selectedFilters) {
  return (options || []).map((item) => {
    const [group, value] = item.key.split(':')
    const selected = selectedFilters[group]
    return {
      ...item,
      active: Array.isArray(selected) ? selected.includes(value) : selected === value
    }
  })
}

function normalizeItem(row, idx) {
  const title = row.title || row.name || row.cn_name || 'Unknown Journal'
  const badges = cleanBadges(row.badges || row.indices || row.indexes || row.index_list)
  return {
    id: row.id || row.issn || row.eissn || row.slug || `${idx}`,
    slug: row.slug || row.id || row.issn || `${idx}`,
    title,
    issn: row.issn || row.id || '-',
    publisher: row.publisher || '',
    ifText: String(row.ifText || row.if_2024 || row.if || '-'),
    jcr: row.jcr || row.if_quartile || '-',
    cas: row.cas || formatZone(row.cas_zone, row.cas_top),
    xr: row.xr || row.xinrui || row.xr_zone_text || formatZone(row.xr_zone || row.xinrui_zone, row.xr_top || row.xinrui_top),
    reviewCycle: formatReviewCycle(row),
    freeText: formatFree(row),
    badges,
    initials: row.initials || title.split(/\s+/).map(s => s[0]).join('').slice(0, 3).toUpperCase(),
    logoTone: row.logoTone || ['tone-orange', 'tone-green', 'tone-blue'][idx % 3]
  }
}

Page({
  data: {
    mode: 'search',
    query: '',
    activeFilter: '',
    selectedFilters: {},
    filterSummary: '',
    currentOptions: [],
    searched: false,
    loading: false,
    total: SAMPLE_JOURNALS.length,
    journals: SAMPLE_JOURNALS,
    quickFilters: [
      { key: 'indices', label: '索引收录', icon: '▣' },
      { key: 'jcr', label: 'JCR分区', icon: '◈' },
      { key: 'cas', label: '中科院分区', icon: '▤' },
      { key: 'subject', label: '学科分类', icon: '☷' },
      { key: 'more', label: '更多筛选', icon: '☰' }
    ],
    inlineFilters: {
      indices: ['SCIE', 'SSCI', 'AHCI', 'ESCI', 'EI', 'Scopus', 'DOAJ', 'MEDLINE'].map(v => ({ key: `indices:${v}`, label: v })),
      jcr: ['Q1', 'Q2', 'Q3', 'Q4'].map(v => ({ key: `jcr:${v}`, label: `JCR ${v}` })),
      cas: ['1区', '2区', '3区', '4区', 'TOP'].map(v => ({ key: `cas:${v}`, label: v === 'TOP' ? '中科院 TOP' : `中科院 ${v}` })),
      subject: ['工程技术', '能源与燃料', '材料科学', '医学', '计算机科学', '经济管理', '建筑学', '环境科学'].map(v => ({ key: `subject:${v}`, label: v }))
    }
  },

  onLoad(options = {}) {
    if (options.filters) {
      try {
        const selectedFilters = JSON.parse(decodeURIComponent(options.filters))
        this.setData({
          selectedFilters,
          filterSummary: summarizeFilters(selectedFilters),
          searched: true
        })
      } catch (err) {
        this.setData({ selectedFilters: {}, filterSummary: '' })
      }
    }
    this.search('')
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode })
  },

  onInput(e) {
    this.setData({ query: e.detail.value })
  },

  useTag(e) {
    this.setData({ query: e.currentTarget.dataset.value, searched: true })
    this.search(e.currentTarget.dataset.value)
  },

  selectFilter(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'more') {
      wx.redirectTo({ url: '/pages/filter/filter' })
      return
    }
    const activeFilter = this.data.activeFilter === key ? '' : key
    this.setData({
      activeFilter,
      currentOptions: activeFilter ? decorateOptions(this.data.inlineFilters[activeFilter], this.data.selectedFilters) : []
    })
  },

  toggleInlineFilter(e) {
    const key = e.currentTarget.dataset.key
    const [group, value] = key.split(':')
    const selectedFilters = Object.assign({}, this.data.selectedFilters)
    const values = Array.isArray(selectedFilters[group]) ? selectedFilters[group].slice() : []
    const idx = values.indexOf(value)
    if (idx >= 0) values.splice(idx, 1)
    else values.push(value)
    if (values.length) selectedFilters[group] = values
    else delete selectedFilters[group]
    this.setData({
      selectedFilters,
      filterSummary: summarizeFilters(selectedFilters),
      currentOptions: decorateOptions(this.data.currentOptions, selectedFilters),
      searched: true
    })
    this.search(this.data.query)
  },

  runSearch() {
    this.setData({ searched: true })
    this.search(this.data.query)
  },

  shuffleFeatured() {
    const list = this.data.journals.slice().reverse()
    this.setData({ journals: list })
  },

  search(q) {
    this.setData({ loading: true })
    wx.request({
      url: `${app.globalData.apiBase}/journals/search`,
      method: 'GET',
      data: {
        q,
        limit: 20,
        filter: this.data.activeFilter,
        filters: JSON.stringify(this.data.selectedFilters || {}),
        mode: this.data.mode
      },
      success: (res) => {
        const items = res.data && Array.isArray(res.data.items) ? res.data.items : null
        if (items) {
          this.setData({
            journals: items.map(normalizeItem),
            total: res.data.total || items.length,
            loading: false
          })
          return
        }
        this.useFallback(q)
      },
      fail: () => this.useFallback(q)
    })
  },

  useFallback(q) {
    const keyword = String(q || '').trim().toLowerCase()
    const filtered = keyword
      ? SAMPLE_JOURNALS.filter(item =>
        item.title.toLowerCase().includes(keyword) ||
        item.issn.includes(keyword) ||
        item.badges.join(' ').toLowerCase().includes(keyword)
      )
      : SAMPLE_JOURNALS
    this.setData({ journals: filtered, total: filtered.length, loading: false })
  },

  openDetail(e) {
    wx.navigateTo({
      url: `/pages/detail/detail?slug=${encodeURIComponent(e.currentTarget.dataset.slug)}`
    })
  },

  goTab(e) {
    const url = e.currentTarget.dataset.url
    if (url && url !== '/pages/index/index') wx.redirectTo({ url })
  },

  onShareAppMessage() {
    return {
      title: 'JournalAI分区速查 - 期刊检索与推荐工具',
      path: '/pages/index/index'
    }
  }
})

function summarizeFilters(filters) {
  const labels = []
  ;['indices', 'jcr', 'cas', 'xr', 'abdc', 'abs', 'feature'].forEach((key) => {
    if (Array.isArray(filters[key]) && filters[key].length) labels.push(filters[key].join(' / '))
  })
  if (filters.subject) labels.push(filters.subject)
  return labels.slice(0, 4).join(' · ')
}
