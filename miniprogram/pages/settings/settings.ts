const app = getApp();

Page({
  data: {
    // API 密钥
    apiKeys: {
      openai: '',
      deepseek: '',
      qiwens: ''
    },
    // API 密钥显示状态
    showKeys: {
      openai: false,
      deepseek: false,
      qiwens: false
    },
    // API 密钥配置状态
    apiKeyStatus: {
      openai: false,
      deepseek: false,
      qiwens: false
    },

    // 服务器地址
    serverUrl: '',

    // 游戏设置
    soundEnabled: true,
    vibrateEnabled: true,

    // 测试连接状态
    isTesting: false
  },

  onLoad() {
    this.loadSettings();
  },

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      // 加载 API 密钥
      const apiKeys = wx.getStorageSync('api_keys') || {};
      this.setData({ apiKeys });

      // 检查哪些密钥已配置
      const apiKeyStatus = {
        openai: !!apiKeys.openai && apiKeys.openai.length > 0,
        deepseek: !!apiKeys.deepseek && apiKeys.deepseek.length > 0,
        qiwens: !!apiKeys.qiwens && apiKeys.qiwens.length > 0
      };
      this.setData({ apiKeyStatus });

      // 加载服务器地址
      const serverUrl = wx.getStorageSync('server_url') || app.globalData.serverUrl || 'http://localhost:3001';
      this.setData({ serverUrl });
      app.globalData.serverUrl = serverUrl;

      // 加载游戏设置
      const gameSettings = wx.getStorageSync('game_settings') || {};
      this.setData({
        soundEnabled: gameSettings.soundEnabled !== false,
        vibrateEnabled: gameSettings.vibrateEnabled !== false
      });
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  },

  /**
   * OpenAI 密钥输入
   */
  onOpenAIKeyInput(e: any) {
    this.setData({
      'apiKeys.openai': e.detail.value
    });
  },

  /**
   * DeepSeek 密钥输入
   */
  onDeepSeekKeyInput(e: any) {
    this.setData({
      'apiKeys.deepseek': e.detail.value
    });
  },

  /**
   * 文心一言密钥输入
   */
  onQiwensKeyInput(e: any) {
    this.setData({
      'apiKeys.qiwens': e.detail.value
    });
  },

  /**
   * 切换密钥显示状态
   */
  onToggleShowKey(e: any) {
    const provider = e.currentTarget.dataset.provider;
    this.setData({
      [`showKeys.${provider}`]: !this.data.showKeys[provider as keyof typeof this.data.showKeys]
    });
  },

  /**
   * 保存密钥
   */
  onSaveKey(e: any) {
    const provider = e.currentTarget.dataset.provider;
    const apiKey = this.data.apiKeys[provider as keyof typeof this.data.apiKeys];

    if (!apiKey || apiKey.trim().length === 0) {
      wx.showToast({ title: '请输入 API 密钥', icon: 'none' });
      return;
    }

    try {
      // 保存到本地存储
      const apiKeys = wx.getStorageSync('api_keys') || {};
      apiKeys[provider] = apiKey.trim();
      wx.setStorageSync('api_keys', apiKeys);

      // 更新配置状态
      this.setData({
        [`apiKeyStatus.${provider}`]: true
      });

      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      console.error('保存失败:', error);
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  /**
   * 服务器地址输入
   */
  onServerUrlInput(e: any) {
    this.setData({ serverUrl: e.detail.value });
  },

  /**
   * 测试服务器连接
   */
  async onTestConnection() {
    if (this.data.isTesting) return;

    const url = this.data.serverUrl.trim();
    if (!url) {
      wx.showToast({ title: '请输入服务器地址', icon: 'none' });
      return;
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      wx.showToast({ title: '请输入有效的 URL', icon: 'none' });
      return;
    }

    this.setData({ isTesting: true });

    try {
      // 测试健康检查接口
      const response = await wx.request({
        url: `${url}/health`,
        method: 'GET',
        timeout: 5000
      });

      if (response.statusCode === 200) {
        wx.showToast({ title: '连接成功', icon: 'success' });

        // 保存服务器地址
        wx.setStorageSync('server_url', url);
        app.globalData.serverUrl = url;
      } else {
        wx.showToast({ title: '服务器响应异常', icon: 'none' });
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      wx.showToast({ title: '连接失败', icon: 'none' });
    } finally {
      this.setData({ isTesting: false });
    }
  },

  /**
   * 音效开关
   */
  onSoundChange(e: any) {
    const soundEnabled = e.detail.value;
    this.setData({ soundEnabled });
    this.saveGameSettings({ soundEnabled });
  },

  /**
   * 震动开关
   */
  onVibrateChange(e: any) {
    const vibrateEnabled = e.detail.value;
    this.setData({ vibrateEnabled });
    this.saveGameSettings({ vibrateEnabled });
  },

  /**
   * 保存游戏设置
   */
  saveGameSettings(settings: any) {
    try {
      const gameSettings = wx.getStorageSync('game_settings') || {};
      Object.assign(gameSettings, settings);
      wx.setStorageSync('game_settings', gameSettings);
    } catch (error) {
      console.error('保存游戏设置失败:', error);
    }
  },

  /**
   * 清除所有数据
   */
  onClearAllData() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地数据吗？此操作不可恢复。',
      confirmText: '确认清除',
      confirmColor: '#dc3545',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync();
            wx.showToast({ title: '已清除所有数据', icon: 'success' });

            // 重新加载页面
            setTimeout(() => {
              this.loadSettings();
            }, 500);
          } catch (error) {
            wx.showToast({ title: '清除失败', icon: 'error' });
          }
        }
      }
    });
  }
});
