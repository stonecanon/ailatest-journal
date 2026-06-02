Page({
  data: {
    loggedIn: false,
    user: null,
    currentLang: 'zh-CN',
    languageLabel: '中文',
    showLanguagePanel: false,
    languages: [
      { code: 'zh-CN', label: '中文', native: '简体中文' },
      { code: 'zh-TW', label: '繁中', native: '繁體中文' },
      { code: 'ja', label: '日本語', native: '日本語' },
      { code: 'ko', label: '한국어', native: '한국어' },
      { code: 'en', label: 'English', native: 'English' },
      { code: 'es', label: 'Español', native: 'Español' },
      { code: 'pt', label: 'Português', native: 'Português' },
      { code: 'fr', label: 'Français', native: 'Français' }
    ],
    stats: [
      { label: '收藏', value: 0 },
      { label: '浏览', value: 0 },
      { label: '荐刊', value: 0 }
    ]
  },

  onLoad() {
    const currentLang = wx.getStorageSync('journalai.lang') || 'zh-CN'
    this.setLanguageState(currentLang)
  },

  signIn() {
    wx.showToast({
      title: '登录接口待接入',
      icon: 'none'
    })
  },

  chooseLanguage(e) {
    const code = e.currentTarget.dataset.code
    this.setLanguageState(code)
    wx.setStorageSync('journalai.lang', code)
    wx.showToast({
      title: '语言已保存',
      icon: 'none'
    })
    this.setData({ showLanguagePanel: false })
  },

  toggleLanguagePanel() {
    this.setData({ showLanguagePanel: !this.data.showLanguagePanel })
  },

  setLanguageState(code) {
    const fallback = this.data.languages[0]
    const current = this.data.languages.find(item => item.code === code) || fallback
    this.setData({
      currentLang: current.code,
      languageLabel: current.label,
      languages: this.data.languages.map(item => ({
        ...item,
        active: item.code === current.code
      }))
    })
  },

  goTab(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.redirectTo({ url })
  }
})
