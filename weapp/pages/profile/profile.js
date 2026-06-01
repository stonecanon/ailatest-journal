Page({
  data: {
    loggedIn: false,
    user: null,
    stats: [
      { label: '收藏', value: 0 },
      { label: '浏览', value: 0 },
      { label: '荐刊', value: 0 }
    ]
  },

  signIn() {
    wx.showToast({
      title: '登录接口待接入',
      icon: 'none'
    })
  },

  goTab(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.redirectTo({ url })
  }
})
