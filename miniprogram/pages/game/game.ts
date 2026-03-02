// 游戏页面逻辑
import { getGame, createGame, makeMove, undoMove, getHint } from '../../utils/api'

interface GameState {
  id: string
  fen: string
  currentPlayer: 'red' | 'black'
  status: 'playing' | 'red_win' | 'black_win' | 'draw'
  moveHistory: any[]
  redPlayer: string
  blackPlayer: string
}

interface Position {
  x: number
  y: number
}

const app = getApp<IAppOption>()

Page({
  data: {
    gameId: '',
    gameState: null as GameState | null,
    selectedPiece: null as any,
    validMoves: [] as any[],
    lastMove: null as any,
    isLoading: false,
    errorMessage: '',
    gameStatus: 'ready', // ready, playing, ended
    aiModel: 'basic',
    difficulty: 3
  },

  onLoad(options: any) {
    console.log('游戏页面加载', options)

    // 如果有游戏ID，加载游戏
    if (options.gameId) {
      this.setData({ gameId: options.gameId })
      this.loadGame(options.gameId)
    } else {
      // 创建新游戏
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
    // 断开Socket连接
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

        // 连接Socket
        this.connectSocket(game.id)

        wx.showToast({
          title: '游戏开始',
          icon: 'success'
        })
      } else {
        throw new Error(result.message || '创建游戏失败')
      }
    } catch (error: any) {
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
  async loadGame(gameId: string) {
    this.setData({ isLoading: true, errorMessage: '' })

    try {
      const result = await getGame(gameId)

      if (result.success && result.data) {
        this.setData({
          gameState: result.data,
          gameStatus: result.data.status === 'playing' ? 'playing' : 'ended'
        })

        // 连接Socket
        this.connectSocket(gameId)
      } else {
        throw new Error(result.message || '加载游戏失败')
      }
    } catch (error: any) {
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
  connectSocket(gameId: string) {
    const serverUrl = app.globalData?.serverUrl || 'http://localhost:3000'
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
      app.globalData!.socketTask = socketTask
      app.globalData!.isConnected = true

      // 加入游戏房间
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
      app.globalData!.isConnected = false
      wx.showToast({
        title: '连接断开',
        icon: 'none'
      })
    })

    socketTask.onClose(() => {
      console.log('Socket连接关闭')
      app.globalData!.isConnected = false
    })
  },

  /**
   * 断开WebSocket
   */
  disconnectSocket() {
    const socketTask = app.globalData?.socketTask
    if (socketTask) {
      socketTask.close()
      app.globalData!.socketTask = null
      app.globalData!.isConnected = false
    }
  },

  /**
   * 处理Socket消息
   */
  handleSocketMessage(message: any) {
    switch (message.type) {
      case 'gameUpdate':
        // 游戏状态更新
        this.setData({
          gameState: message.gameState,
          lastMove: message.lastMove
        })

        // 检查游戏是否结束
        if (message.gameState.status !== 'playing') {
          this.handleGameEnd(message.gameState.status)
        }
        break

      case 'move':
        // 对手走棋
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
  handleBoardClick(e: any) {
    const { x, y, piece } = e.detail
    const { gameState, selectedPiece } = this.data

    if (!gameState || gameState.currentPlayer !== 'red') {
      // 只有红方回合才能操作
      return
    }

    // 如果点击的是己方棋子，选中它
    if (piece && piece.color === 'red') {
      this.setData({
        selectedPiece: piece,
        validMoves: this.getValidMoves(piece)
      })
      return
    }

    // 如果已选中棋子，尝试走子
    if (selectedPiece) {
      const isValidMove = this.data.validMoves.some(
        (move: any) => move.to.x === x && move.to.y === y
      )

      if (isValidMove) {
        this.executeMove(selectedPiece, { x, y })
      } else {
        // 取消选中
        this.setData({
          selectedPiece: null,
          validMoves: []
        })
      }
    }
  },

  /**
   * 获取有效走法（简化版）
   */
  getValidMoves(piece: any): any[] {
    // 这里应该调用后端API获取有效走法
    // 为了简化，这里返回一个空数组
    return []
  },

  /**
   * 执行走法（乐观更新）
   */
  async executeMove(piece: any, to: Position) {
    const { gameId } = this.data

    // 乐观更新UI
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
        // Socket会收到游戏更新，不需要手动更新
      } else {
        // 走棋失败，回滚
        throw new Error(result.message || '走棋失败')
      }
    } catch (error: any) {
      console.error('走棋失败：', error)
      wx.showToast({
        title: error.message || '走棋失败',
        icon: 'none'
      })
      // 回滚UI（重新加载游戏状态）
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
          } catch (error: any) {
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
    } catch (error: any) {
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
  handleGameEnd(status: string) {
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
