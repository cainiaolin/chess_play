const app = getApp()

// 速度配置（毫秒）
const SPEED_CONFIG = {
  slow: 5000,
  normal: 2000,
  fast: 500
}

Page({
  data: {
    redModelIndex: 0,
    blackModelIndex: 1,
    aiModels: ['GPT-4', 'DeepSeek', '文心一言'],
    speed: 'normal',
    isStarting: false,

    gameStarted: false,
    isPaused: false,
    isThinking: false,
    moveCount: 0,
    currentTurnModel: '',

    gameState: {
      board: [],
      turn: 'red',
      status: 'playing',
      moves: [],
      lastMove: null
    },

    moveTimer: null,
    gameId: null
  },

  onLoad() {
    this.loadSettings()
  },

  onUnload() {
    this.clearMoveTimer()
  },

  loadSettings() {
    try {
      const settings = wx.getStorageSync('spectate_settings')
      if (settings) {
        this.setData({
          redModelIndex: settings.redModelIndex || 0,
          blackModelIndex: settings.blackModelIndex || 1,
          speed: settings.speed || 'normal'
        })
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  },

  saveSettings() {
    try {
      wx.setStorageSync('spectate_settings', {
        redModelIndex: this.data.redModelIndex,
        blackModelIndex: this.data.blackModelIndex,
        speed: this.data.speed
      })
    } catch (error) {
      console.error('保存设置失败:', error)
    }
  },

  onRedModelChange(e) {
    const modelIndex = e.detail.value
    this.setData({ redModelIndex: modelIndex })
    this.saveSettings()
  },

  onBlackModelChange(e) {
    const modelIndex = e.detail.value
    this.setData({ blackModelIndex: modelIndex })
    this.saveSettings()
  },

  onSpeedSelect(e) {
    const speed = e.currentTarget.dataset.speed
    this.setData({ speed })
    this.saveSettings()
  },

  async onStartGame() {
    if (this.data.isStarting) return

    this.setData({ isStarting: true })

    const modelMap = { 0: 'openai', 1: 'deepseek', 2: 'qiwens' }

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/game/create`,
        method: 'POST',
        data: {
          redPlayer: { type: 'ai', model: modelMap[this.data.redModelIndex] },
          blackPlayer: { type: 'ai', model: modelMap[this.data.blackModelIndex] }
        }
      })

      if (res.statusCode === 200 && res.data) {
        this.setData({
          gameId: res.data.id,
          gameState: res.data,
          gameStarted: true,
          moveCount: 0,
          isPaused: false
        })

        this.startAutoPlay()
      } else {
        wx.showToast({ title: '创建游戏失败', icon: 'error' })
      }
    } catch (error) {
      console.error('创建游戏失败:', error)
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ isStarting: false })
    }
  },

  startAutoPlay() {
    this.clearMoveTimer()

    const updateTurn = async () => {
      if (this.data.isPaused) {
        this.scheduleNextMove()
        return
      }

      const { gameState, gameId } = this.data
      if (gameState.status !== 'playing' || !gameId) {
        this.clearMoveTimer()
        return
      }

      const currentTurnModel = gameState.turn === 'red'
        ? this.data.aiModels[this.data.redModelIndex]
        : this.data.aiModels[this.data.blackModelIndex]
      this.setData({ isThinking: true, currentTurnModel })

      try {
        await this.sleep(SPEED_CONFIG[this.data.speed])

        const stateRes = await wx.request({
          url: `${app.globalData.serverUrl}/api/game/${gameId}`,
          method: 'GET'
        })

        if (stateRes.statusCode === 200 && stateRes.data) {
          const newGameState = stateRes.data
          const moveCount = newGameState.moves.length

          this.setData({
            gameState: newGameState,
            moveCount,
            isThinking: false
          })

          if (newGameState.status !== 'playing') {
            this.clearMoveTimer()
            this.showGameEnd(newGameState.status)
            return
          }

          this.scheduleNextMove()
        }
      } catch (error) {
        console.error('获取游戏状态失败:', error)
        this.setData({ isThinking: false })
        this.scheduleNextMove()
      }
    }

    updateTurn()
  },

  scheduleNextMove() {
    this.clearMoveTimer()
    this.setData({
      moveTimer: setTimeout(() => {
        this.startAutoPlay()
      }, SPEED_CONFIG[this.data.speed])
    })
  },

  clearMoveTimer() {
    if (this.data.moveTimer) {
      clearTimeout(this.data.moveTimer)
      this.setData({ moveTimer: null })
    }
  },

  onTogglePause() {
    const isPaused = !this.data.isPaused
    this.setData({ isPaused })

    wx.showToast({
      title: isPaused ? '已暂停' : '继续观战',
      icon: 'none'
    })
  },

  onRestart() {
    wx.showModal({
      title: '重新开始',
      content: '确定要重新开始观战吗？',
      success: (res) => {
        if (res.confirm) {
          this.clearMoveTimer()
          this.setData({
            gameStarted: false,
            gameState: {
              board: [],
              turn: 'red',
              status: 'playing',
              moves: [],
              lastMove: null
            },
            moveCount: 0,
            isPaused: false,
            isThinking: false
          })
        }
      }
    })
  },

  onExit() {
    this.clearMoveTimer()
    wx.navigateBack()
  },

  showGameEnd(status) {
    const redModel = this.data.aiModels[this.data.redModelIndex]
    const blackModel = this.data.aiModels[this.data.blackModelIndex]

    const messages = {
      'red_win': `${redModel} 获胜！`,
      'black_win': `${blackModel} 获胜！`,
      'draw': '双方和棋！'
    }

    wx.showModal({
      title: '对弈结束',
      content: messages[status] || '对弈结束',
      showCancel: false,
      confirmText: '重新观战',
      success: () => {
        this.clearMoveTimer()
        this.setData({
          gameStarted: false,
          gameState: {
            board: [],
            turn: 'red',
            status: 'playing',
            moves: [],
            lastMove: null
          },
          moveCount: 0
        })
      }
    })
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
})
