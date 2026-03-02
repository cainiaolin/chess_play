// WebSocket 连接管理
const app = getApp<IAppOption>()

interface SocketMessage {
  type: string
  data?: any
}

class SocketManager {
  private socketTask: WechatMiniprogram.SocketTask | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private messageHandlers: Map<string, Array<(data: any) => void>> = new Map()
  private isConnected = false

  /**
   * 连接Socket
   */
  connect(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('连接Socket：', url)

      this.socketTask = wx.connectSocket({
        url,
        success: () => {
          console.log('Socket连接成功')
        },
        fail: (err) => {
          console.error('Socket连接失败：', err)
          this.handleReconnect(url)
          resolve(false)
        }
      })

      this.socketTask.onOpen(() => {
        console.log('Socket连接打开')
        this.isConnected = true
        this.reconnectAttempts = 0
        app.globalData!.socketTask = this.socketTask
        app.globalData!.isConnected = true
        resolve(true)
      })

      this.socketTask.onMessage((res) => {
        console.log('收到Socket消息：', res.data)
        try {
          const message = JSON.parse(res.data) as SocketMessage
          this.handleMessage(message)
        } catch (error) {
          console.error('解析Socket消息失败：', error)
        }
      })

      this.socketTask.onError((error) => {
        console.error('Socket错误：', error)
        this.isConnected = false
        app.globalData!.isConnected = false
        this.handleReconnect(url)
      })

      this.socketTask.onClose(() => {
        console.log('Socket连接关闭')
        this.isConnected = false
        app.globalData!.isConnected = false
        this.handleReconnect(url)
      })
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socketTask) {
      this.socketTask.close()
      this.socketTask = null
    }

    this.isConnected = false
    this.messageHandlers.clear()
  }

  /**
   * 发送消息
   */
  send(message: any) {
    if (!this.isConnected || !this.socketTask) {
      console.error('Socket未连接，无法发送消息')
      return false
    }

    try {
      this.socketTask.send({
        data: JSON.stringify(message)
      })
      return true
    } catch (error) {
      console.error('发送Socket消息失败：', error)
      return false
    }
  }

  /**
   * 注册消息处理器
   */
  on(type: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, [])
    }
    this.messageHandlers.get(type)!.push(handler)
  }

  /**
   * 移除消息处理器
   */
  off(type: string, handler?: (data: any) => void) {
    if (!this.messageHandlers.has(type)) {
      return
    }

    if (handler) {
      const handlers = this.messageHandlers.get(type)!
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    } else {
      this.messageHandlers.delete(type)
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: SocketMessage) {
    const { type, data } = message

    // 调用类型对应的处理器
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type)!
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error('消息处理失败：', error)
        }
      })
    }

    // 调用通用处理器
    if (this.messageHandlers.has('*')) {
      const handlers = this.messageHandlers.get('*')!
      handlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('消息处理失败：', error)
        }
      })
    }
  }

  /**
   * 处理重连
   */
  private handleReconnect(url: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数')
      wx.showToast({
        title: '连接失败',
        icon: 'none'
      })
      return
    }

    this.reconnectAttempts++
    console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect(url)
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  /**
   * 获取连接状态
   */
  getStatus(): boolean {
    return this.isConnected
  }
}

// 导出单例
export const socketManager = new SocketManager()

// 导出便捷方法
export function connectSocket(url: string): Promise<boolean> {
  return socketManager.connect(url)
}

export function disconnectSocket() {
  socketManager.disconnect()
}

export function sendSocketMessage(message: any): boolean {
  return socketManager.send(message)
}

export function onSocketMessage(type: string, handler: (data: any) => void) {
  socketManager.on(type, handler)
}

export function offSocketMessage(type: string, handler?: (data: any) => void) {
  socketManager.off(type, handler)
}

export function getSocketStatus(): boolean {
  return socketManager.getStatus()
}
