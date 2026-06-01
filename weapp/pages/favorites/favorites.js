Page({
  data: {
    folders: [
      {
        id: 'architecture',
        title: '建筑学 list',
        desc: '建筑、城市、规划相关投稿备选',
        count: 12,
        preview: 'Automation in Construction · Building and Environment · Landscape and Urban Planning'
      },
      {
        id: 'free',
        title: '免费发表期刊',
        desc: '免 APC 或免费发表路径',
        count: 28,
        preview: 'Applied Energy · 2D Materials · 3 Biotech'
      },
      {
        id: 'graduation',
        title: '毕业投稿备选',
        desc: '按分区、审稿周期和投稿难度整理',
        count: 8,
        preview: 'Nano Energy · Advanced Materials · Energy Reports'
      }
    ],
    sharingFolder: null
  },

  createFolder() {
    wx.showToast({ title: '新建弹窗待接入', icon: 'none' })
  },

  openFolder(e) {
    wx.navigateTo({ url: `/pages/folder/folder?id=${encodeURIComponent(e.currentTarget.dataset.id)}` })
  },

  shareFolder(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ sharingFolder: this.data.folders.find(item => item.id === id) || null })
  },

  goTab(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.redirectTo({ url })
  },

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const folder = this.data.sharingFolder || this.data.folders[0]
    return {
      title: `${folder.title} - JournalAI分区速查`,
      path: `/pages/folder/folder?id=${encodeURIComponent(folder.id)}`
    }
  }
})
