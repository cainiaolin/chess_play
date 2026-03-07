// 小程序入口文件
App({
  onLaunch() {
    console.log('中国象棋对决小程序启动')

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 初始化用户配置
    this.initConfig()

    // 登录（可选）
    this.login()

    // 监听网络状态
    this.watchNetwork()
  },

  onShow() {
    console.log('小程序显示')
  },

  onHide() {
    console.log('小程序隐藏')
  },

  /**
   * 登录获取code
   */
  login() {
    wx.login({
      success: res => {
        if (res.code) {
          console.log('登录成功，code：', res.code)
          // 可将code发送到后端换取openId
          this.sendCodeToServer(res.code)
        } else {
          console.error('登录失败：', res.errMsg)
        }
      },
      fail: err => {
        console.error('wx.login失败：', err)
      }
    })
  },

  /**
   * 将code发送到服务器
   */
  sendCodeToServer(code) {
    wx.request({
      url: `${this.globalData.serverUrl}/api/auth/login`,
      method: 'POST',
      data: { code },
      success: res => {
        console.log('服务器登录响应：', res)
      },
      fail: err => {
        console.error('服务器登录失败：', err)
      }
    })
  },

  /**
   * 初始化配置
   */
  initConfig() {
    const config = wx.getStorageSync('gameConfig')
    if (!config) {
      const defaultConfig = {
        serverUrl: 'http://localhost:3001',
        aiModel: 'basic',
        difficulty: 3,
        enableSound: true,
        enableVibration: true
      }
      wx.setStorageSync('gameConfig', defaultConfig)
      this.globalData.gameConfig = defaultConfig
    } else {
      this.globalData.gameConfig = config
    }
  },

  /**
   * 更新配置
   */
  updateConfig(config) {
    const newConfig = { ...this.globalData.gameConfig, ...config }
    this.globalData.gameConfig = newConfig
    wx.setStorageSync('gameConfig', newConfig)
  },

  /**
   * 监听网络状态
   */
  watchNetwork() {
    wx.onNetworkStatusChange(res => {
      console.log('网络状态变化：', res)
      if (!res.isConnected) {
        wx.showToast({
          title: '网络断开连接',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  globalData: {
    userInfo: null,
    serverUrl: 'http://localhost:3001',
    gameConfig: null,
    socketTask: null,
    isConnected: false
  }
})
