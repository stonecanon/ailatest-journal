const groups = [
  {
    title: '索引榜单',
    items: [
      { type: 'index', slug: 'scie', title: 'SCIE 期刊', count: 'Top 20' },
      { type: 'index', slug: 'ssci', title: 'SSCI 期刊', count: 'Top 20' },
      { type: 'index', slug: 'ahci', title: 'AHCI 期刊', count: 'Top 20' },
      { type: 'index', slug: 'ei', title: 'EI Compendex', count: 'Top 20' },
      { type: 'index', slug: 'scopus', title: 'Scopus 期刊', count: 'Top 20' },
      { type: 'index', slug: 'doaj', title: 'DOAJ 期刊', count: 'Top 20' }
    ]
  },
  {
    title: '学科榜单',
    items: [
      { type: 'subject', slug: 'architecture', title: '建筑学', count: 'Top 20' },
      { type: 'subject', slug: 'energy-fuels', title: '能源与燃料', count: 'Top 20' },
      { type: 'subject', slug: 'materials-science', title: '材料科学', count: 'Top 20' },
      { type: 'subject', slug: 'clinical-medicine', title: '临床医学', count: 'Top 20' },
      { type: 'subject', slug: 'computer-science', title: '计算机科学', count: 'Top 20' },
      { type: 'subject', slug: 'economics', title: '经济学', count: 'Top 20' }
    ]
  },
  {
    title: '分区与特色',
    items: [
      { type: 'zone', slug: 'jcr-q1', title: 'JCR Q1', count: 'Top 20' },
      { type: 'zone', slug: 'cas-1', title: '中科院 1 区', count: 'Top 20' },
      { type: 'zone', slug: 'xinrui-1', title: '新锐 1 区', count: 'Top 20' },
      { type: 'feature', slug: 'free', title: '免费发表', count: 'Top 20' },
      { type: 'feature', slug: 'warning', title: '预警期刊', count: 'Top 20' },
      { type: 'feature', slug: 'popular', title: '热门浏览', count: 'Top 20' }
    ]
  }
]

Page({
  data: { groups },

  openRank(e) {
    const { type, slug, title } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/ranklist/ranklist?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}`
    })
  },

  goTab(e) {
    const url = e.currentTarget.dataset.url
    if (url && url !== '/pages/rankings/rankings') wx.redirectTo({ url })
  }
})
