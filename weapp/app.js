App({
  globalData: {
    localDataReady: false,
    // 分包占位页解锁回调：root -> resolve 函数
    __localDataSubpackageWaiters: {}
  },

  onLaunch() {
    // 检查版本更新
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本已就绪，是否重启应用？',
              success(res) {
                if (res.confirm) {
                  updateManager.applyUpdate()
                }
              }
            })
          })
          updateManager.onUpdateFailed(function () {
            wx.showToast({ title: '更新下载失败', icon: 'none' })
          })
        }
      })
    }
  },

  /** 注册分包解锁等待（供占位页回调） */
  registerSubpackageWaiter(root, fn) {
    if (!root || typeof fn !== 'function') return
    this.globalData.__localDataSubpackageWaiters[root] = fn
  },

  /** 清除分包解锁等待 */
  clearSubpackageWaiter(root) {
    if (root && this.globalData.__localDataSubpackageWaiters) {
      delete this.globalData.__localDataSubpackageWaiters[root]
    }
  }
})
