// 全局类型定义

declare interface WechatMiniprogram {
  // 扩展微信小程序类型
}

// 全局应用类型
interface IAppOption {
  globalData: {
    userInfo: {
      nickName: string
      avatarUrl: string
    } | null
    serverUrl: string
    gameConfig: {
      serverUrl: string
      aiModel: string
      difficulty: number
      enableSound: boolean
      enableVibration: boolean
    } | null
    socketTask: WechatMiniprogram.SocketTask | null
    isConnected: boolean
  }

  login(): void
  sendCodeToServer(code: string): void
  initConfig(): void
  updateConfig(config: any): void
  watchNetwork(): void
}

// 游戏状态类型
interface GameState {
  id: string
  fen: string
  currentPlayer: 'red' | 'black'
  status: 'playing' | 'red_win' | 'black_win' | 'draw'
  moveHistory: any[]
  redPlayer: string
  blackPlayer: string
}

// 棋子类型
interface ChessPiece {
  id: string
  type: 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p'
  color: 'red' | 'black'
  x: number
  y: number
  selected?: boolean
}

// 位置类型
interface Position {
  x: number
  y: number
}

// 有效走法类型
interface ValidMove {
  from: Position
  to: Position
}

// API 响应类型
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}
