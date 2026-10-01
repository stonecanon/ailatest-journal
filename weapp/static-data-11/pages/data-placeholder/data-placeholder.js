Page({
  onLoad(options) {
    const app = typeof getApp === 'function' ? getApp() : null
    const waiters = app && app.globalData && app.globalData.__localDataSubpackageWaiters
    const root = String((options && options.root) || '')
    if (waiters && typeof waiters[root] === 'function') waiters[root]()
  }
})
