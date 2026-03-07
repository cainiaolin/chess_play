const app = getApp()

Page({
  data: {
    apiKeys: {
      openai: '',
      deepseek: '',
      qiwens: ''
    },
    showKeys: {
      openai: false,
      deepseek: false,
      qiwens: false
    },
    apiKeyStatus: {
      openai: false,
      deepseek: false,
      qiwens: false
    },
    serverUrl: '',
    soundEnabled: true,
    vibrateEnabled: true,
    isTesting: false
  },

  onLoad() {
    this.loadSettings()
  },

  loadSettings() {
    try {
      const apiKeys = wx.getStorageSync('api_keys') || {}
      this.setData({ apiKeys })

      const apiKeyStatus = {
        openai: !!apiKeys.openai && apiKeys.openai.length > 0,
        deepseek: !!apiKeys.deepseek && apiKeys.deepseek.length > 0,
        qiwens: !!apiKeys.qiwens && apiKeys.qiwens.length > 0
      }
      this.setData({ apiKeyStatus })

      const serverUrl = wx.getStorageSync('server_url') || app.globalData.serverUrl || 'http://localhost:3001'
      this.setData({ serverUrl })
      app.globalData.serverUrl = serverUrl

      const gameSettings = wx.getStorageSync('game_settings') || {}
      this.setData({
        soundEnabled: gameSettings.soundEnabled !== false,
        vibrateEnabled: gameSettings.vibrateEnabled !== false
      })
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  },

  onOpenAIKeyInput(e) {
    this.setData({
      'apiKeys.openai': e.detail.value
    })
  },

  onDeepSeekKeyInput(e) {
    this.setData({
      'apiKeys.deepseek': e.detail.value
    })
  },

  onQiwensKeyInput(e) {
    this.setData({
      'apiKeys.qiwens': e.detail.value
    })
  },

  onToggleShowKey(e) {
    const provider = e.currentTarget.dataset.provider
    this.setData({
      [`showKeys.${provider}`]: !this.data.showKeys[provider]
    })
  },

  onSaveKey(e) {
    const provider = e.currentTarget.dataset.provider
    const apiKey = this.data.apiKeys[provider]

    if (!apiKey || apiKey.trim().length === 0) {
      wx.showToast({ title: '请输入 API 密钥', icon: 'none' })
      return
    }

    try {
      const apiKeys = wx.getStorageSync('api_keys') || {}
      apiKeys[provider] = apiKey.trim()
      wx.setStorageSync('api_keys', apiKeys)

      this.setData({
        [`apiKeyStatus.${provider}`]: true
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      console.error('保存失败:', error)
      wx.showToast({ title: '保存失败', icon: 'error' })
    }
  },

  onServerUrlInput(e) {
    this.setData({ serverUrl: e.detail.value })
  },

  async onTestConnection() {
    if (this.data.isTesting) return

    const url = this.data.serverUrl.trim()
    if (!url) {
      wx.showToast({ title: '请输入服务器地址', icon: 'none' })
      return
    }

    try {
      new URL(url)
    } catch {
      wx.showToast({ title: '请输入有效的 URL', icon: 'none' })
      return
    }

    this.setData({ isTesting: true })

    try {
      const response = await wx.request({
        url: `${url}/health`,
        method: 'GET',
        timeout: 5000
      })

      if (response.statusCode === 200) {
        wx.showToast({ title: '连接成功', icon: 'success' })

        wx.setStorageSync('server_url', url)
        app.globalData.serverUrl = url
      } else {
        wx.showToast({ title: '服务器响应异常', icon: 'none' })
      }
    } catch (error) {
      console.error('连接测试失败:', error)
      wx.showToast({ title: '连接失败', icon: 'none' })
    } finally {
      this.setData({ isTesting: false })
    }
  },

  onSoundChange(e) {
    const soundEnabled = e.detail.value
    this.setData({ soundEnabled })
    this.saveGameSettings({ soundEnabled })
  },

  onVibrateChange(e) {
    const vibrateEnabled = e.detail.value
    this.setData({ vibrateEnabled })
    this.saveGameSettings({ vibrateEnabled })
  },

  saveGameSettings(settings) {
    try {
      const gameSettings = wx.getStorageSync('game_settings') || {}
      Object.assign(gameSettings, settings)
      wx.setStorageSync('game_settings', gameSettings)
    } catch (error) {
      console.error('保存游戏设置失败:', error)
    }
  },

  onClearAllData() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地数据吗？此操作不可恢复。',
      confirmText: '确认清除',
      confirmColor: '#dc3545',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            wx.showToast({ title: '已清除所有数据', icon: 'success' })

            setTimeout(() => {
              this.loadSettings()
            }, 500)
          } catch (error) {
            wx.showToast({ title: '清除失败', icon: 'error' })
          }
        }
      }
    })
  }
})
