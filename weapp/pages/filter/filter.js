Page({
  data: {
    selectedMap: {},
    subjectIndex: 0,
    indices: ['SCIE', 'SSCI', 'AHCI', 'ESCI', 'EI', 'Scopus', 'DOAJ', 'MEDLINE'].map(v => ({ key: `indices:${v}`, value: v, label: v })),
    jcrZones: ['Q1', 'Q2', 'Q3', 'Q4'].map(v => ({ key: `jcr:${v}`, value: v, label: `JCR ${v}` })),
    casZones: ['1区', '2区', '3区', '4区', 'TOP'].map(v => ({ key: `cas:${v}`, value: v, label: v === 'TOP' ? '中科院 TOP' : `中科院 ${v}` })),
    xrZones: ['1区', '2区', '3区', '4区', 'TOP'].map(v => ({ key: `xr:${v}`, value: v, label: v === 'TOP' ? '新锐 TOP' : `新锐 ${v}` })),
    ratings: [
      { key: 'abdc:A*', value: 'A*', label: 'ABDC A*' },
      { key: 'abdc:A', value: 'A', label: 'ABDC A' },
      { key: 'abdc:B', value: 'B', label: 'ABDC B' },
      { key: 'abdc:C', value: 'C', label: 'ABDC C' },
      { key: 'abs:4*', value: '4*', label: 'ABS 4*' },
      { key: 'abs:4', value: '4', label: 'ABS 4' },
      { key: 'abs:3', value: '3', label: 'ABS 3' },
      { key: 'abs:2', value: '2', label: 'ABS 2' },
      { key: 'abs:1', value: '1', label: 'ABS 1' }
    ],
    features: [
      { key: 'feature:free', value: 'free', label: '免费发表' },
      { key: 'feature:warning', value: 'warning', label: '中科院预警' },
      { key: 'feature:citic_warning', value: 'citic_warning', label: '中信所预警' },
      { key: 'feature:oa', value: 'oa', label: '开放获取' }
    ],
    subjects: [
      '全部学科',
      '工程技术',
      '能源与燃料',
      '材料科学',
      '化学',
      '环境科学与生态学',
      '医学',
      '生物学',
      '计算机科学',
      '数学',
      '物理学',
      '地球科学',
      '农业科学',
      '经济管理',
      '心理学',
      '教育学',
      '社会科学',
      '人文艺术',
      '综合性期刊'
    ]
  },

  toggleOption(e) {
    const key = e.currentTarget.dataset.key
    const selectedMap = Object.assign({}, this.data.selectedMap)
    if (selectedMap[key]) {
      delete selectedMap[key]
    } else {
      selectedMap[key] = true
    }
    this.setData({ selectedMap })
  },

  onSubjectChange(e) {
    this.setData({ subjectIndex: Number(e.detail.value) || 0 })
  },

  resetFilters() {
    this.setData({ selectedMap: {}, subjectIndex: 0 })
  },

  applyFilters() {
    const filters = {}
    Object.keys(this.data.selectedMap).forEach((key) => {
      const [group, value] = key.split(':')
      if (!filters[group]) filters[group] = []
      filters[group].push(value)
    })
    const subject = this.data.subjects[this.data.subjectIndex]
    if (subject && subject !== '全部学科') filters.subject = subject
    wx.redirectTo({
      url: `/pages/index/index?filters=${encodeURIComponent(JSON.stringify(filters))}`
    })
  },

  goTab(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.redirectTo({ url })
  },

  backHome() {
    wx.redirectTo({ url: '/pages/index/index' })
  }
})
