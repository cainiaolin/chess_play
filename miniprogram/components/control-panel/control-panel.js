// 控制面板组件逻辑
Component({
  properties: {
    gameStatus: {
      type: String,
      value: 'ready'
    },
    currentPlayer: {
      type: String,
      value: 'red'
    },
    showBack: {
      type: Boolean,
      value: true
    },
    buttons: {
      type: Array,
      value: []
    }
  },

  data: {
    isThinking: false
  },

  methods: {
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

    handleSettings() {
      wx.navigateTo({
        url: '/pages/settings/settings'
      })
    },

    handleShare() {
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
