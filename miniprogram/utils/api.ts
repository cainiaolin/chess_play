// API 请求工具
const app = getApp<IAppOption>()

/**
 * 请求配置
 */
interface RequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: any
}

/**
 * 请求响应
 */
interface RequestResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}

/**
 * 通用请求方法
 */
function request<T = any>(config: RequestConfig): Promise<RequestResponse<T>> {
  return new Promise((resolve) => {
    const serverUrl = app.globalData?.serverUrl || 'http://localhost:3000'

    wx.request({
      url: `${serverUrl}${config.url}`,
      method: config.method || 'GET',
      data: config.data,
      header: {
        'content-type': 'application/json',
        ...config.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            success: true,
            data: res.data
          })
        } else {
          resolve({
            success: false,
            message: res.data?.message || '请求失败'
          })
        }
      },
      fail: (err) => {
        console.error('请求失败：', err)
        resolve({
          success: false,
          message: err.errMsg || '网络请求失败'
        })
      }
    })
  })
}

/**
 * 创建游戏
 */
export function createGame(params: {
  aiModel: string
  difficulty: number
  playerColor: 'red' | 'black'
}): Promise<RequestResponse<any>> {
  return request({
    url: '/api/games',
    method: 'POST',
    data: params
  })
}

/**
 * 获取游戏信息
 */
export function getGame(gameId: string): Promise<RequestResponse<any>> {
  return request({
    url: `/api/games/${gameId}`,
    method: 'GET'
  })
}

/**
 * 执行走法
 */
export function makeMove(gameId: string, move: {
  from: { x: number; y: number }
  to: { x: number; y: number }
}): Promise<RequestResponse<any>> {
  return request({
    url: `/api/games/${gameId}/move`,
    method: 'POST',
    data: move
  })
}

/**
 * 悔棋
 */
export function undoMove(gameId: string): Promise<RequestResponse<any>> {
  return request({
    url: `/api/games/${gameId}/undo`,
    method: 'POST'
  })
}

/**
 * 获取提示
 */
export function getHint(gameId: string): Promise<RequestResponse<any>> {
  return request({
    url: `/api/games/${gameId}/hint`,
    method: 'POST'
  })
}

/**
 * 获取游戏列表
 */
export function getGames(): Promise<RequestResponse<any[]>> {
  return request({
    url: '/api/games',
    method: 'GET'
  })
}

/**
 * 删除游戏
 */
export function deleteGame(gameId: string): Promise<RequestResponse<any>> {
  return request({
    url: `/api/games/${gameId}`,
    method: 'DELETE'
  })
}

/**
 * 获取AI模型列表
 */
export function getAIModels(): Promise<RequestResponse<any[]>> {
  return request({
    url: '/api/ai/models',
    method: 'GET'
  })
}

/**
 * 测试连接
 */
export function testConnection(): Promise<RequestResponse<any>> {
  return request({
    url: '/api/health',
    method: 'GET'
  })
}
