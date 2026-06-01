Page({
  data: {
    webviewUrl: 'https://journal.ailatest.org/',
    loaded: false,
    error: false,
    errorMsg: ''
  },

  onLoad() {
    // 检查网络
    wx.getNetworkType({
      success: (res) => {
        if (res.networkType === 'none') {
          this.setData({
            error: true,
            errorMsg: '网络不可用，请检查连接后重试'
          })
        }
      }
    })
  },

  onLoadSuccess() {
    this.setData({ loaded: true, error: false })
  },

  onLoadError(e) {
    console.error('WebView load error:', e.detail)
    this.setData({
      loaded: false,
      error: true,
      errorMsg: '页面加载失败，请检查网络后重试'
    })
  },

  retry() {
    this.setData({
      error: false,
      errorMsg: '',
      loaded: false,
      webviewUrl: ''
    }, () => {
      // 重新设置 URL 触发加载
      this.setData({
        webviewUrl: 'https://journal.ailatest.org/'
      })
      // 重新检查网络
      wx.getNetworkType({
        success: (res) => {
          if (res.networkType === 'none') {
            this.setData({
              error: true,
              errorMsg: '网络不可用，请检查连接后重试'
            })
          }
        }
      })
    })
  },

  onShareAppMessage() {
    return {
      title: 'Journal Search - 期刊搜索与投稿决策工具',
      path: '/pages/index/index'
    }
  }
})
