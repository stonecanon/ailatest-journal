const FOLDERS = {
  architecture: {
    id: 'architecture',
    title: '建筑学 list',
    desc: '建筑、城市、规划相关投稿备选',
    journals: [
      { slug: 'automation-in-construction', title: 'Automation in Construction', issn: '0926-5805', ifText: '9.6', jcr: 'Q1', cas: '1区' },
      { slug: 'building-and-environment', title: 'Building and Environment', issn: '0360-1323', ifText: '7.1', jcr: 'Q1', cas: '2区' },
      { slug: 'landscape-and-urban-planning', title: 'Landscape and Urban Planning', issn: '0169-2046', ifText: '8.1', jcr: 'Q1', cas: '1区' }
    ]
  },
  free: {
    id: 'free',
    title: '免费发表期刊',
    desc: '免 APC 或保留免费发表路径',
    journals: [
      { slug: 'applied-energy', title: 'Applied Energy', issn: '0306-2619', ifText: '11', jcr: 'Q1', cas: '1区 TOP' },
      { slug: '2d-materials', title: '2D Materials', issn: '2053-1583', ifText: '4.3', jcr: 'Q2', cas: '3区' }
    ]
  },
  graduation: {
    id: 'graduation',
    title: '毕业投稿备选',
    desc: '按分区、审稿周期和投稿难度整理',
    journals: [
      { slug: 'nano-energy', title: 'Nano Energy', issn: '2211-2855', ifText: '17.1', jcr: 'Q1', cas: '1区' },
      { slug: 'advanced-materials', title: 'Advanced Materials', issn: '0935-9648', ifText: '26.8', jcr: 'Q1', cas: '1区 TOP' }
    ]
  }
}

Page({
  data: {
    folder: FOLDERS.architecture
  },

  onLoad(options = {}) {
    const id = decodeURIComponent(options.id || 'architecture')
    this.setData({ folder: FOLDERS[id] || FOLDERS.architecture })
  },

  openDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?slug=${encodeURIComponent(e.currentTarget.dataset.slug)}` })
  },

  onShareAppMessage() {
    return {
      title: `${this.data.folder.title} - JournalAI分区速查`,
      path: `/pages/folder/folder?id=${encodeURIComponent(this.data.folder.id)}`
    }
  }
})
