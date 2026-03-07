import axios from 'axios'

const API_BASE = '/api'

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000
})

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.data)
    return response.data
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message)
    return Promise.reject(error.response?.data || { message: error.message })
  }
)

// 游戏 API
export const gameApi = {
  // 创建游戏
  create: (config) => {
    return apiClient.post('/game/create', config)
  },

  // 获取游戏状态
  get: (gameId) => {
    return apiClient.get(`/game/${gameId}`)
  },

  // 执行走法
  move: (gameId, move) => {
    return apiClient.post(`/game/${gameId}/move`, move)
  },

  // 悔棋
  undo: (gameId) => {
    return apiClient.post(`/game/${gameId}/undo`)
  },

  // 获取提示
  hint: (gameId) => {
    return apiClient.get(`/game/${gameId}/hint`)
  },

  // 获取所有游戏（观战用）
  list: () => {
    return apiClient.get('/game')
  },

  // 删除游戏
  delete: (gameId) => {
    return apiClient.delete(`/game/${gameId}`)
  }
}
