# 小程序转网站重构设计方案

**日期**: 2025-03-07
**项目**: 中国象棋对决 - 小程序到 Web 网站重构

---

## 1. 概述

将微信小程序项目重构为传统多页网站（MPA），使用 Vue 3 + Vite + SCSS 技术栈，保留所有现有功能（AI对弈、观战模式、在线对战、设置功能），前端构建产物集成到现有 Express 服务器。

---

## 2. 技术栈

### 前端
- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **样式**: SCSS
- **状态管理**: Pinia
- **HTTP 客户端**: Axios
- **WebSocket**: Socket.io-client
- **路由**: 静态 HTML 文件（多页面）

### 后端
- **现有服务器**: Node.js + Express + Socket.IO + TypeScript
- **集成方式**: 静态文件托管

---

## 3. 项目结构

```
chess_play_web/
├── frontend/                 # 新增前端项目
│   ├── public/
│   │   ├── index.html       # 首页
│   │   ├── game.html        # 对弈页面入口
│   │   ├── spectate.html    # 观战页面入口
│   │   └── settings.html    # 设置页面入口
│   ├── src/
│   │   ├── pages/           # 各页面逻辑
│   │   │   ├── home/        # 首页
│   │   │   ├── game/        # 对弈页面
│   │   │   ├── spectate/    # 观战页面
│   │   │   └── settings/    # 设置页面
│   │   ├── components/      # 共享组件
│   │   │   ├── ChessBoard/  # 棋盘组件
│   │   │   ├── ControlPanel/# 控制面板
│   │   │   ├── GameStatus/  # 游戏状态
│   │   │   └── AIIndicator/ # AI 思考指示器
│   │   ├── composables/     # 组合式函数
│   │   │   ├── useSocket.js
│   │   │   └── useGame.js
│   │   ├── stores/          # Pinia 状态
│   │   │   ├── game.js
│   │   │   ├── config.js
│   │   │   └── socket.js
│   │   ├── utils/           # 工具函数
│   │   │   └── api.js
│   │   ├── styles/          # 全局样式
│   │   │   └── global.scss
│   │   └── assets/          # 静态资源
│   ├── vite.config.js
│   └── package.json
├── server/                   # 现有后端（保持不变）
│   └── public/              # 前端构建输出目录
└── miniprogram/             # 原小程序（归档）
```

---

## 4. 页面设计

### 4.1 首页 (index.html)
- **路由**: `/` 或 `/index.html`
- **功能**: 游戏介绍、开始游戏入口、观战入口、设置入口

### 4.2 对弈页面 (game.html)
- **路由**: `/game` 或 `/game.html`
- **功能**: 创建游戏、走棋、悔棋、提示、重新开始
- **组件**:
  - `ChessBoard`: 棋盘渲染和交互
  - `ControlPanel`: 操作按钮（悔棋、提示、重启）
  - `GameStatus`: 游戏状态显示（回合、胜负）
  - `AIIndicator`: AI 思考状态显示

### 4.3 观战页面 (spectate.html)
- **路由**: `/spectate` 或 `/spectate.html`
- **功能**: 列出活跃游戏、选择观战、实时观看
- **组件**:
  - `GameList`: 活跃游戏列表
  - `ChessBoard`: 只读棋盘展示
  - `SpectatorInfo`: 观战者信息面板

### 4.4 设置页面 (settings.html)
- **路由**: `/settings` 或 `/settings.html`
- **功能**: AI 模型选择、难度设置、音效开关
- **组件**:
  - `AISettings`: AI 配置（模型、难度）
  - `SoundSettings`: 音效和振动设置
  - `ServerConfig`: 服务器地址配置

---

## 5. 组件设计

### ChessBoard 组件
```javascript
// Props
{
  board: Array,        // 棋盘数据
  readonly: Boolean,   // 是否只读
  lastMove: Object     // 最后一着
}

// Events
{
  'cell-click': { x, y, piece }  // 格子点击
}
```

### ControlPanel 组件
```javascript
// Props
{
  canUndo: Boolean,
  canHint: Boolean,
  isAIThinking: Boolean
}

// Events
{
  undo: null,
  hint: null,
  restart: null
}
```

### GameStatus 组件
```javascript
// Props
{
  turn: String,        // 'red' | 'black'
  status: String,      // 'playing' | 'red_win' | 'black_win' | 'draw'
  moveCount: Number
}
```

---

## 6. 状态管理

### GameStore (游戏状态)
```javascript
{
  // State
  gameId: string | null
  gameState: GameState | null
  selectedPiece: Piece | null
  validMoves: Move[]
  lastMove: Move | null
  isAIThinking: boolean

  // Actions
  createGame(config)
  loadGame(gameId)
  makeMove(from, to)
  undoMove()
  getHint()
  subscribeToUpdates()

  // Getters
  currentTurn: 'red' | 'black'
  gameStatus: 'playing' | 'ended'
  canUndo: boolean
}
```

### ConfigStore (配置状态)
```javascript
{
  // State
  serverUrl: string
  aiModel: 'openai' | 'deepseek' | 'qianfan'
  difficulty: number (1-5)
  enableSound: boolean
  enableVibration: boolean

  // Actions
  loadConfig()      // 从 localStorage 加载
  saveConfig()      // 保存到 localStorage
  updateConfig(values)
}
```

### SocketStore (WebSocket 连接)
```javascript
{
  // State
  socket: Socket | null
  isConnected: boolean
  currentRoom: string | null

  // Actions
  connect(url)
  disconnect()
  join(gameId)
  leave(gameId)
}
```

---

## 7. API 层封装

### REST API
```javascript
// src/utils/api.js
export const gameApi = {
  create: (config) => axios.post('/api/game/create', config),
  get: (gameId) => axios.get(`/api/game/${gameId}`),
  move: (gameId, move) => axios.post(`/api/game/${gameId}/move`, move),
  undo: (gameId) => axios.post(`/api/game/${gameId}/undo`),
  hint: (gameId) => axios.get(`/api/game/${gameId}/hint`),
  list: () => axios.get('/api/game')  // 观战用
}
```

### WebSocket
```javascript
// src/composables/useSocket.js
export function useSocket() {
  const socketStore = useSocketStore()

  const connect = () => { /* 连接逻辑 */ }
  const onGameUpdate = (callback) => { /* 监听游戏更新 */ }

  return { connect, onGameUpdate }
}
```

---

## 8. Vite 配置

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],

  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'public/index.html'),
        game: resolve(__dirname, 'public/game.html'),
        spectate: resolve(__dirname, 'public/spectate.html'),
        settings: resolve(__dirname, 'public/settings.html')
      }
    },
    outDir: '../server/public',
    emptyOutDir: true
  },

  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/game-socket': {
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  }
})
```

---

## 9. 服务器集成

修改 `server/src/app.ts` 添加静态文件服务：

```typescript
import express from 'express'
import path from 'path'

const app = express()

// API 路由（现有）
app.use('/api', apiRoutes)

// WebSocket（现有）
io.of('/game-socket').on('connection', gameHandler)

// 静态文件服务（新增）
app.use(express.static(path.join(__dirname, '../public')))
```

---

## 10. 开发流程

### 开发模式
```bash
cd frontend
npm run dev          # Vite 开发服务器（端口 5173，带代理）
```

### 生产构建
```bash
cd frontend
npm run build        # 输出到 server/public
cd ../server
npm start            # 启动服务器（端口 3001）
```

### 访问地址
- 开发: `http://localhost:5173/`
- 生产: `http://localhost:3001/`

---

## 11. 依赖清单

### frontend/package.json
```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.7",
    "axios": "^1.6.0",
    "socket.io-client": "^4.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "sass": "^1.69.0"
  }
}
```

---

## 12. 迁移清单

### 需要迁移的小程序功能
- [x] AI 对弈功能
- [x] 观战模式
- [x] 在线对战
- [x] 设置功能

### 小程序到 Web 的主要变更
| 小程序 | Web |
|--------|-----|
| `wx.request` | `axios` |
| `wx.connectSocket` | `socket.io-client` |
| `wx.getStorageSync` | `localStorage` |
| `wx.showToast` | 自定义 Toast 组件 |
| `wx.showModal` | 自定义 Modal 组件 |
| `Page()` | Vue 组件 |
| `this.setData()` | Vue 响应式数据 |
