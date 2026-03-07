// 游戏页面逻辑
const { getGame, createGame, makeMove, undoMove, getHint } = require('../../utils/api')

const app = getApp()

Page({
  data: {
    gameId: '',
    gameState: null,
    selectedPiece: null,
    validMoves: [],
    lastMove: null,
    isLoading: false,
    errorMessage: '',
    gameStatus: 'ready',
    aiModel: 'basic',
    difficulty: 3
  },

  onLoad(options) {
    console.log('游戏页面加载', options)

    if (options.gameId) {
      this.setData({ gameId: options.gameId })
      this.loadGame(options.gameId)
    } else {
      this.createNewGame()
    }
  },

  onShow() {
    console.log('游戏页面显示')
  },

  onReady() {
    console.log('游戏页面准备就绪')
  },

  onHide() {
    console.log('游戏页面隐藏')
  },

  onUnload() {
    console.log('游戏页面卸载')
    this.disconnectSocket()
  },

  /**
   * 创建新游戏
   */
  async createNewGame() {
    this.setData({ isLoading: true, errorMessage: '' })

    try {
      const config = app.globalData?.gameConfig || {}
      const aiModel = config.aiModel || 'basic'
      const difficulty = config.difficulty || 3

      const result = await createGame({
        aiModel,
        difficulty,
        playerColor: 'red'
      })

      if (result.success && result.data) {
        const game = result.data
        this.setData({
          gameId: game.id,
          gameState: game,
          gameStatus: 'playing',
          aiModel,
          difficulty
        })

        this.connectSocket(game.id)

        wx.showToast({
          title: '游戏开始',
          icon: 'success'
        })
      } else {
        throw new Error(result.message || '创建游戏失败')
      }
    } catch (error) {
      console.error('创建游戏失败：', error)
      this.setData({
        errorMessage: error.message || '创建游戏失败，请重试',
        gameStatus: 'ready'
      })
      wx.showToast({
        title: error.message || '创建游戏失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  /**
   * 加载游戏
   */
  async loadGame(gameId) {
    this.setData({ isLoading: true, errorMessage: '' })

    try {
      const result = await getGame(gameId)

      if (result.success && result.data) {
        this.setData({
          gameState: result.data,
          gameStatus: result.data.status === 'playing' ? 'playing' : 'ended'
        })

        this.connectSocket(gameId)
      } else {
        throw new Error(result.message || '加载游戏失败')
      }
    } catch (error) {
      console.error('加载游戏失败：', error)
      this.setData({
        errorMessage: error.message || '加载游戏失败，请重试'
      })
      wx.showToast({
        title: error.message || '加载游戏失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  /**
   * 连接WebSocket
   */
  connectSocket(gameId) {
    const serverUrl = app.globalData?.serverUrl || 'http://localhost:3001'
    const wsUrl = serverUrl.replace('http', 'ws') + `/game-socket`

    console.log('连接Socket：', wsUrl)

    const socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => {
        console.log('Socket连接成功')
      }
    })

    socketTask.onOpen(() => {
      console.log('Socket连接打开')
      app.globalData.socketTask = socketTask
      app.globalData.isConnected = true

      socketTask.send({
        data: JSON.stringify({
          type: 'join',
          gameId
        })
      })
    })

    socketTask.onMessage((res) => {
      console.log('收到Socket消息：', res.data)
      try {
        const message = JSON.parse(res.data)
        this.handleSocketMessage(message)
      } catch (error) {
        console.error('解析Socket消息失败：', error)
      }
    })

    socketTask.onError((error) => {
      console.error('Socket错误：', error)
      app.globalData.isConnected = false
      wx.showToast({
        title: '连接断开',
        icon: 'none'
      })
    })

    socketTask.onClose(() => {
      console.log('Socket连接关闭')
      app.globalData.isConnected = false
    })
  },

  /**
   * 断开WebSocket
   */
  disconnectSocket() {
    const socketTask = app.globalData?.socketTask
    if (socketTask) {
      socketTask.close()
      app.globalData.socketTask = null
      app.globalData.isConnected = false
    }
  },

  /**
   * 处理Socket消息
   */
  handleSocketMessage(message) {
    switch (message.type) {
      case 'gameUpdate':
        this.setData({
          gameState: message.gameState,
          lastMove: message.lastMove
        })

        if (message.gameState.status !== 'playing') {
          this.handleGameEnd(message.gameState.status)
        }
        break

      case 'move':
        this.setData({
          lastMove: message.move
        })
        break

      case 'error':
        wx.showToast({
          title: message.message || '发生错误',
          icon: 'none'
        })
        break

      default:
        console.log('未知消息类型：', message.type)
    }
  },

  /**
   * 处理棋盘点击
   */
  handleBoardClick(e) {
    const { x, y, piece } = e.detail
    const { gameState, selectedPiece } = this.data

    if (!gameState || gameState.currentPlayer !== 'red') {
      return
    }

    if (piece && piece.color === 'red') {
      this.setData({
        selectedPiece: piece,
        validMoves: this.getValidMoves(piece)
      })
      return
    }

    if (selectedPiece) {
      const isValidMove = this.data.validMoves.some(
        (move) => move.to.x === x && move.to.y === y
      )

      if (isValidMove) {
        this.executeMove(selectedPiece, { x, y })
      } else {
        this.setData({
          selectedPiece: null,
          validMoves: []
        })
      }
    }
  },

  /**
   * 获取有效走法
   */
  getValidMoves(piece) {
    return []
  },

  /**
   * 执行走法
   */
  async executeMove(piece, to) {
    const { gameId } = this.data

    const from = { x: piece.x, y: piece.y }
    this.setData({
      lastMove: { from, to },
      selectedPiece: null,
      validMoves: []
    })

    try {
      const result = await makeMove(gameId, {
        from,
        to
      })

      if (result.success) {
        console.log('走棋成功')
      } else {
        throw new Error(result.message || '走棋失败')
      }
    } catch (error) {
      console.error('走棋失败：', error)
      wx.showToast({
        title: error.message || '走棋失败',
        icon: 'none'
      })
      this.loadGame(gameId)
    }
  },

  /**
   * 悔棋
   */
  async handleUndo() {
    const { gameId } = this.data

    wx.showModal({
      title: '确认悔棋',
      content: '确定要悔棋吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await undoMove(gameId)

            if (result.success) {
              wx.showToast({
                title: '悔棋成功',
                icon: 'success'
              })
            } else {
              throw new Error(result.message || '悔棋失败')
            }
          } catch (error) {
            console.error('悔棋失败：', error)
            wx.showToast({
              title: error.message || '悔棋失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  /**
   * 提示
   */
  async handleHint() {
    const { gameId } = this.data

    try {
      const result = await getHint(gameId)

      if (result.success && result.data) {
        const hint = result.data
        this.setData({
          selectedPiece: hint.from,
          validMoves: [{ from: hint.from, to: hint.to }]
        })

        wx.showToast({
          title: '已显示提示',
          icon: 'success'
        })
      } else {
        throw new Error(result.message || '获取提示失败')
      }
    } catch (error) {
      console.error('获取提示失败：', error)
      wx.showToast({
        title: error.message || '获取提示失败',
        icon: 'none'
      })
    }
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
          this.createNewGame()
        }
      }
    })
  },

  /**
   * 返回
   */
  handleBack() {
    wx.navigateBack()
  },

  /**
   * 处理游戏结束
   */
  handleGameEnd(status) {
    let title = ''
    let message = ''

    switch (status) {
      case 'red_win':
        title = '恭喜获胜！'
        message = '红方获胜'
        break
      case 'black_win':
        title = '游戏结束'
        message = '黑方获胜'
        break
      case 'draw':
        title = '游戏结束'
        message = '和棋'
        break
    }

    wx.showModal({
      title,
      content: message,
      showCancel: false,
      success: () => {
        this.setData({ gameStatus: 'ended' })
      }
    })
  }
})
