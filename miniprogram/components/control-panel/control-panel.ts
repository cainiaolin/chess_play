// 控制面板组件逻辑
Component({
  properties: {
    // 游戏状态
    gameStatus: {
      type: String,
      value: 'ready'
    },
    // 当前玩家
    currentPlayer: {
      type: String,
      value: 'red'
    },
    // 是否显示返回按钮
    showBack: {
      type: Boolean,
      value: true
    },
    // 按钮配置
    buttons: {
      type: Array,
      value: []
    }
  },

  data: {
    isThinking: false
  },

  methods: {
    /**
     * 悔棋
     */
    handleUndo() {
      if (this.data.gameStatus !== 'playing') {
        wx.showToast({
          title: '游戏未开始或已结束',
          icon: 'none'
        })
        return
      }

      this.triggerEvent('undo')
    },

    /**
     * 提示
     */
    handleHint() {
      if (this.data.gameStatus !== 'playing') {
        wx.showToast({
          title: '游戏未开始或已结束',
          icon: 'none'
        })
        return
      }

      this.triggerEvent('hint')
    },

    /**
     * 重新开始
     */
    handleRestart() {
      wx.showModal({
        title: '重新开始',
        content: '确定要重新开始游戏吗？',
        success: (res) => {
          if (res.confirm) {
            this.triggerEvent('restart')
          }
        }
      })
    },

    /**
     * 返回
     */
    handleBack() {
      wx.showModal({
        title: '退出游戏',
        content: '确定要退出当前游戏吗？',
        success: (res) => {
          if (res.confirm) {
            this.triggerEvent('back')
          }
        }
      })
    },

    /**
     * 设置
     */
    handleSettings() {
      wx.navigateTo({
        url: '/pages/settings/settings'
      })
    },

    /**
     * 分享
     */
    handleShare() {
      // 触发分享
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      })
    }
  },

  lifetimes: {
    attached() {
      console.log('控制面板组件加载')
    }
  }
})
