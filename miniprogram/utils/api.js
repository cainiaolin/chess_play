// API 请求工具
const app = getApp()

/**
 * 通用请求方法
 */
function request(config) {
  return new Promise((resolve) => {
    const serverUrl = app.globalData?.serverUrl || 'http://localhost:3001'

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
function createGame(params) {
  return request({
    url: '/api/games',
    method: 'POST',
    data: params
  })
}

/**
 * 获取游戏信息
 */
function getGame(gameId) {
  return request({
    url: `/api/games/${gameId}`,
    method: 'GET'
  })
}

/**
 * 执行走法
 */
function makeMove(gameId, move) {
  return request({
    url: `/api/games/${gameId}/move`,
    method: 'POST',
    data: move
  })
}

/**
 * 悔棋
 */
function undoMove(gameId) {
  return request({
    url: `/api/games/${gameId}/undo`,
    method: 'POST'
  })
}

/**
 * 获取提示
 */
function getHint(gameId) {
  return request({
    url: `/api/games/${gameId}/hint`,
    method: 'POST'
  })
}

/**
 * 获取游戏列表
 */
function getGames() {
  return request({
    url: '/api/games',
    method: 'GET'
  })
}

/**
 * 删除游戏
 */
function deleteGame(gameId) {
  return request({
    url: `/api/games/${gameId}`,
    method: 'DELETE'
  })
}

/**
 * 获取AI模型列表
 */
function getAIModels() {
  return request({
    url: '/api/ai/models',
    method: 'GET'
  })
}

/**
 * 测试连接
 */
function testConnection() {
  return request({
    url: '/health',
    method: 'GET'
  })
}

module.exports = {
  createGame,
  getGame,
  makeMove,
  undoMove,
  getHint,
  getGames,
  deleteGame,
  getAIModels,
  testConnection
}
