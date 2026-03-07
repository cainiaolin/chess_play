# 小程序转网站重构 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 将微信小程序项目重构为 Vue 3 多页网站，前端构建产物集成到现有 Express 服务器

**架构:** Vue 3 + Vite + Pinia + SCSS 多页应用，构建输出到 server/public/，由 Express 托管静态文件

**技术栈:** Vue 3 (Composition API), Vite, Pinia, Axios, Socket.io-client, SCSS

---

## Task 1: 初始化前端项目

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/public/index.html`
- Create: `frontend/src/styles/global.scss`

**Step 1: 创建 package.json**

Run: `mkdir -p frontend`

```json
{
  "name": "chess-web-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.7",
    "axios": "^1.6.0",
    "socket.io-client": "^4.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "sass": "^1.69.0",
    "vite": "^5.0.0"
  }
}
```

**Step 2: 安装依赖**

Run: `cd frontend && npm install`

Expected: node_modules 目录创建完成

**Step 3: 创建 Vite 配置**

```javascript
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

**Step 4: 创建全局样式**

Run: `mkdir -p frontend/src/styles`

```scss
// frontend/src/styles/global.scss
:root {
  --primary-color: #d43c33;
  --text-color: #333;
  --border-color: #ddd;
  --bg-color: #f5f5f5;
  --board-bg: #f0d9b5;
  --board-line: #8b4513;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-color);
  color: var(--text-color);
}

#app {
  width: 100%;
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }

  &.btn-primary {
    background: var(--primary-color);
    color: white;
  }

  &.btn-secondary {
    background: #666;
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

**Step 5: 提交初始化**

Run:
```bash
git add frontend/
git commit -m "feat: initialize Vue 3 frontend project with Vite"
```

---

## Task 2: 创建 Pinia Stores

**Files:**
- Create: `frontend/src/stores/game.js`
- Create: `frontend/src/stores/config.js`
- Create: `frontend/src/stores/socket.js`

**Step 1: 创建 Game Store**

Run: `mkdir -p frontend/src/stores`

```javascript
// frontend/src/stores/game.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { gameApi } from '../utils/api'

export const useGameStore = defineStore('game', () => {
  // State
  const gameId = ref(null)
  const gameState = ref(null)
  const selectedPiece = ref(null)
  const validMoves = ref([])
  const lastMove = ref(null)
  const isAIThinking = ref(false)

  // Getters
  const currentTurn = computed(() => gameState.value?.turn || 'red')
  const gameStatus = computed(() => gameState.value?.status || 'ready')
  const canUndo = computed(() => {
    return gameState.value?.moves?.length > 0
  })

  // Actions
  async function createGame(config) {
    const result = await gameApi.create(config)
    if (result.success) {
      gameId.value = result.data.id
      gameState.value = result.data
    }
    return result
  }

  async function loadGame(id) {
    const result = await gameApi.get(id)
    if (result.success) {
      gameId.value = id
      gameState.value = result.data
    }
    return result
  }

  async function makeMove(from, to) {
    const result = await gameApi.move(gameId.value, { from, to })
    if (result.success) {
      lastMove.value = result.data.move
      if (result.data.aiMove) {
        isAIThinking.value = true
      }
    }
    return result
  }

  async function undoMove() {
    const result = await gameApi.undo(gameId.value)
    return result
  }

  async function getHint() {
    const result = await gameApi.hint(gameId.value)
    return result
  }

  function updateGameState(newState) {
    gameState.value = newState
  }

  function selectPiece(piece) {
    selectedPiece.value = piece
  }

  function setValidMoves(moves) {
    validMoves.value = moves
  }

  function reset() {
    gameId.value = null
    gameState.value = null
    selectedPiece.value = null
    validMoves.value = []
    lastMove.value = null
    isAIThinking.value = false
  }

  return {
    // State
    gameId,
    gameState,
    selectedPiece,
    validMoves,
    lastMove,
    isAIThinking,
    // Getters
    currentTurn,
    gameStatus,
    canUndo,
    // Actions
    createGame,
    loadGame,
    makeMove,
    undoMove,
    getHint,
    updateGameState,
    selectPiece,
    setValidMoves,
    reset
  }
})
```

**Step 2: 创建 Config Store**

```javascript
// frontend/src/stores/config.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

const CONFIG_KEY = 'chess_game_config'

const defaultConfig = {
  serverUrl: 'http://localhost:3001',
  aiModel: 'deepseek',
  difficulty: 3,
  enableSound: true,
  enableVibration: true
}

export const useConfigStore = defineStore('config', () => {
  const serverUrl = ref(defaultConfig.serverUrl)
  const aiModel = ref(defaultConfig.aiModel)
  const difficulty = ref(defaultConfig.difficulty)
  const enableSound = ref(defaultConfig.enableSound)
  const enableVibration = ref(defaultConfig.enableVibration)

  function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) {
      const config = JSON.parse(saved)
      serverUrl.value = config.serverUrl || defaultConfig.serverUrl
      aiModel.value = config.aiModel || defaultConfig.aiModel
      difficulty.value = config.difficulty || defaultConfig.difficulty
      enableSound.value = config.enableSound ?? defaultConfig.enableSound
      enableVibration.value = config.enableVibration ?? defaultConfig.enableVibration
    }
  }

  function saveConfig() {
    const config = {
      serverUrl: serverUrl.value,
      aiModel: aiModel.value,
      difficulty: difficulty.value,
      enableSound: enableSound.value,
      enableVibration: enableVibration.value
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  }

  function updateConfig(values) {
    Object.assign({ serverUrl, aiModel, difficulty, enableSound, enableVibration }, values)
    saveConfig()
  }

  return {
    serverUrl,
    aiModel,
    difficulty,
    enableSound,
    enableVibration,
    loadConfig,
    saveConfig,
    updateConfig
  }
})
```

**Step 3: 创建 Socket Store**

```javascript
// frontend/src/stores/socket.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io } from 'socket.io-client'

export const useSocketStore = defineStore('socket', () => {
  const socket = ref(null)
  const isConnected = ref(false)
  const currentRoom = ref(null)

  const configStore = undefined // 会在使用时注入

  function connect(url) {
    if (socket.value) return

    socket.value = io(url, {
      path: '/game-socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      console.log('Socket connected')
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('Socket disconnected')
    })

    socket.value.on('error', (error) => {
      console.error('Socket error:', error)
    })
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
      currentRoom.value = null
    }
  }

  function join(gameId) {
    if (socket.value) {
      socket.value.emit('game:join', { gameId })
      currentRoom.value = gameId
    }
  }

  function leave(gameId) {
    if (socket.value) {
      socket.value.emit('game:leave', { gameId })
      if (currentRoom.value === gameId) {
        currentRoom.value = null
      }
    }
  }

  function subscribe(gameId, callback) {
    if (socket.value) {
      socket.value.emit('game:subscribe', { gameId })
      socket.value.on('game:state-update', callback)
      socket.value.on('game:ended', callback)
    }
  }

  function unsubscribe(gameId) {
    if (socket.value) {
      socket.value.emit('game:unsubscribe', { gameId })
      socket.value.off('game:state-update')
      socket.value.off('game:ended')
    }
  }

  return {
    socket,
    isConnected,
    currentRoom,
    connect,
    disconnect,
    join,
    leave,
    subscribe,
    unsubscribe
  }
})
```

**Step 4: 提交 Stores**

Run:
```bash
git add frontend/src/stores/
git commit -m "feat: add Pinia stores for game, config, and socket"
```

---

## Task 3: 创建 API 工具层

**Files:**
- Create: `frontend/src/utils/api.js`

**Step 1: 创建 API 模块**

Run: `mkdir -p frontend/src/utils`

```javascript
// frontend/src/utils/api.js
import axios from 'axios'

const API_BASE = '/api'

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
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
    return apiClient.post('/game/create', {
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'ai', model: config.aiModel || 'deepseek' }
    })
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

// 导出 axios 实例以供其他用途
export default apiClient
```

**Step 2: 提交 API 模块**

Run:
```bash
git add frontend/src/utils/
git commit -m "feat: add API utility layer with axios"
```

---

## Task 4: 创建共享组件 - ChessBoard

**Files:**
- Create: `frontend/src/components/ChessBoard/ChessBoard.vue`
- Create: `frontend/src/components/ChessBoard/ChessBoard.scss`

**Step 1: 创建 ChessBoard 组件**

Run: `mkdir -p frontend/src/components/ChessBoard`

```vue
<!-- frontend/src/components/ChessBoard/ChessBoard.vue -->
<template>
  <div class="chess-board">
    <div class="board-grid">
      <div
        v-for="(row, y) in board"
        :key="y"
        class="board-row"
      >
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="board-cell"
          :class="getCellClass(x, y, cell)"
          @click="handleCellClick(x, y, cell)"
        >
          <span v-if="cell" class="piece">{{ getPieceText(cell) }}</span>
          <span
            v-if="isValidMove(x, y)"
            class="move-indicator"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  board: {
    type: Array,
    default: () => []
  },
  readonly: {
    type: Boolean,
    default: false
  },
  selectedPiece: {
    type: Object,
    default: null
  },
  validMoves: {
    type: Array,
    default: () => []
  },
  lastMove: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['cell-click'])

// 棋子字符映射
const pieceChars = {
  // 红方
  'R': '俥', 'N': '傌', 'B': '相', 'A': '仕', 'K': '帅', 'C': '炮', 'P': '兵',
  // 黑方
  'r': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '将', 'c': '砲', 'p': '卒'
}

function getPieceText(piece) {
  if (!piece) return ''
  return pieceChars[piece.type] || ''
}

function getPieceColor(piece) {
  if (!piece) return ''
  return piece.color === 'red' ? 'red' : 'black'
}

function getCellClass(x, y, cell) {
  const classes = []

  if (cell) {
    classes.push('has-piece', getPieceColor(cell))
  }

  if (props.selectedPiece && props.selectedPiece.x === x && props.selectedPiece.y === y) {
    classes.push('selected')
  }

  if (props.lastMove) {
    if ((props.lastMove.from?.x === x && props.lastMove.from?.y === y) ||
        (props.lastMove.to?.x === x && props.lastMove.to?.y === y)) {
      classes.push('last-move')
    }
  }

  return classes.join(' ')
}

function isValidMove(x, y) {
  return props.validMoves.some(move => move.to?.x === x && move.to?.y === y)
}

function handleCellClick(x, y, cell) {
  if (props.readonly) return
  emit('cell-click', { x, y, piece: cell })
}
</script>

<style scoped src="./ChessBoard.scss"></style>
```

**Step 2: 创建 ChessBoard 样式**

```scss
// frontend/src/components/ChessBoard/ChessBoard.scss
.chess-board {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  padding: 10px;
  background: var(--board-bg);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.board-grid {
  display: grid;
  grid-template-rows: repeat(10, 1fr);
  gap: 2px;
  aspect-ratio: 9 / 10;
}

.board-row {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 2px;
}

.board-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--board-line);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  aspect-ratio: 1;

  &:hover {
    filter: brightness(1.1);
  }

  &.has-piece {
    background: var(--board-bg);
    border: 2px solid var(--board-line);

    &.red {
      .piece {
        color: #c00;
      }
    }

    &.black {
      .piece {
        color: #000;
      }
    }

    &.selected {
      border-color: var(--primary-color);
      box-shadow: 0 0 8px var(--primary-color);
    }
  }

  &.last-move {
    background: rgba(212, 60, 51, 0.2);
  }

  .piece {
    font-size: 28px;
    font-weight: bold;
    user-select: none;
  }

  .move-indicator {
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--primary-color);
    border-radius: 50%;
    opacity: 0.7;
    animation: pulse 1s infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.4;
  }
}
```

**Step 3: 提交 ChessBoard 组件**

Run:
```bash
git add frontend/src/components/ChessBoard/
git commit -m "feat: add ChessBoard component with styling"
```

---

## Task 5: 创建共享组件 - ControlPanel

**Files:**
- Create: `frontend/src/components/ControlPanel/ControlPanel.vue`
- Create: `frontend/src/components/ControlPanel/ControlPanel.scss`

**Step 1: 创建 ControlPanel 组件**

Run: `mkdir -p frontend/src/components/ControlPanel`

```vue
<!-- frontend/src/components/ControlPanel/ControlPanel.vue -->
<template>
  <div class="control-panel">
    <button
      class="btn btn-secondary"
      :disabled="!canUndo || isAIThinking"
      @click="$emit('undo')"
    >
      悔棋
    </button>
    <button
      class="btn btn-primary"
      :disabled="!canHint || isAIThinking"
      @click="$emit('hint')"
    >
      提示
    </button>
    <button
      class="btn btn-secondary"
      :disabled="isAIThinking"
      @click="$emit('restart')"
    >
      重新开始
    </button>
  </div>
</template>

<script setup>
defineProps({
  canUndo: {
    type: Boolean,
    default: false
  },
  canHint: {
    type: Boolean,
    default: true
  },
  isAIThinking: {
    type: Boolean,
    default: false
  }
})

defineEmits(['undo', 'hint', 'restart'])
</script>

<style scoped src="./ControlPanel.scss"></style>
```

**Step 2: 创建 ControlPanel 样式**

```scss
// frontend/src/components/ControlPanel/ControlPanel.scss
.control-panel {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin: 20px 0;
  flex-wrap: wrap;
}
```

**Step 3: 提交 ControlPanel 组件**

Run:
```bash
git add frontend/src/components/ControlPanel/
git commit -m "feat: add ControlPanel component"
```

---

## Task 6: 创建共享组件 - GameStatus

**Files:**
- Create: `frontend/src/components/GameStatus/GameStatus.vue`
- Create: `frontend/src/components/GameStatus/GameStatus.scss`

**Step 1: 创建 GameStatus 组件**

Run: `mkdir -p frontend/src/components/GameStatus`

```vue
<!-- frontend/src/components/GameStatus/GameStatus.vue -->
<template>
  <div class="game-status">
    <div class="status-item">
      <span class="label">状态:</span>
      <span class="value" :class="statusClass">{{ statusText }}</span>
    </div>
    <div class="status-item">
      <span class="label">回合:</span>
      <span class="value" :class="turnClass">{{ turnText }}</span>
    </div>
    <div v-if="moveCount !== undefined" class="status-item">
      <span class="label">步数:</span>
      <span class="value">{{ moveCount }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  turn: {
    type: String,
    default: 'red'
  },
  status: {
    type: String,
    default: 'playing'
  },
  moveCount: {
    type: Number,
    default: undefined
  }
})

const statusText = computed(() => {
  const statusMap = {
    playing: '对弈中',
    red_win: '红方获胜',
    black_win: '黑方获胜',
    draw: '和棋',
    ready: '准备'
  }
  return statusMap[props.status] || props.status
})

const statusClass = computed(() => {
  if (props.status === 'red_win') return 'red-win'
  if (props.status === 'black_win') return 'black-win'
  if (props.status === 'draw') return 'draw'
  return ''
})

const turnText = computed(() => {
  const turnMap = {
    red: '红方',
    black: '黑方'
  }
  return turnMap[props.turn] || props.turn
})

const turnClass = computed(() => {
  return props.turn === 'red' ? 'red-turn' : 'black-turn'
})
</script>

<style scoped src="./GameStatus.scss"></style>
```

**Step 2: 创建 GameStatus 样式**

```scss
// frontend/src/components/GameStatus/GameStatus.scss
.game-status {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin: 16px 0;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;

  .label {
    color: #666;
  }

  .value {
    font-weight: bold;

    &.red-turn {
      color: #c00;
    }

    &.black-turn {
      color: #000;
    }

    &.red-win {
      color: #c00;
      font-size: 18px;
    }

    &.black-win {
      color: #000;
      font-size: 18px;
    }

    &.draw {
      color: #666;
    }
  }
}
```

**Step 3: 提交 GameStatus 组件**

Run:
```bash
git add frontend/src/components/GameStatus/
git commit -m "feat: add GameStatus component"
```

---

## Task 7: 创建对弈页面

**Files:**
- Create: `frontend/public/game.html`
- Create: `frontend/src/pages/game/GamePage.vue`
- Create: `frontend/src/pages/game/main.js`

**Step 1: 创建 game.html 入口**

```html
<!-- frontend/public/game.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>对弈 - 中国象棋对决</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/pages/game/main.js"></script>
</body>
</html>
```

**Step 2: 创建 GamePage 组件**

Run: `mkdir -p frontend/src/pages/game`

```vue
<!-- frontend/src/pages/game/GamePage.vue -->
<template>
  <div class="game-page">
    <div class="container">
      <h1 class="page-title">中国象棋对决</h1>

      <GameStatus
        :turn="gameState?.turn"
        :status="gameState?.status"
        :move-count="gameState?.moves?.length"
      />

      <ChessBoard
        v-if="gameState?.board"
        :board="gameState.board"
        :selected-piece="selectedPiece"
        :valid-moves="validMoves"
        :last-move="lastMove"
        @cell-click="handleCellClick"
      />

      <ControlPanel
        :can-undo="canUndo"
        :can-hint="true"
        :is-a-i-thinking="isAIThinking"
        @undo="handleUndo"
        @hint="handleHint"
        @restart="handleRestart"
      />

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../../stores/game'
import { useConfigStore } from '../../stores/config'
import { useSocketStore } from '../../stores/socket'
import ChessBoard from '../../components/ChessBoard/ChessBoard.vue'
import ControlPanel from '../../components/ControlPanel/ControlPanel.vue'
import GameStatus from '../../components/GameStatus/GameStatus.vue'

const gameStore = useGameStore()
const configStore = useConfigStore()
const socketStore = useSocketStore()

const errorMessage = ref('')

// 从 store 获取响应式数据
const gameState = computed(() => gameStore.gameState)
const selectedPiece = computed(() => gameStore.selectedPiece)
const validMoves = computed(() => gameStore.validMoves)
const lastMove = computed(() => gameStore.lastMove)
const isAIThinking = computed(() => gameStore.isAIThinking)
const canUndo = computed(() => gameStore.canUndo)

onMounted(async () => {
  configStore.loadConfig()

  // 连接 WebSocket
  socketStore.connect(configStore.serverUrl)

  // 创建新游戏
  await createNewGame()
})

onUnmounted(() => {
  socketStore.disconnect()
})

async function createNewGame() {
  errorMessage.value = ''
  try {
    const result = await gameStore.createGame({
      aiModel: configStore.aiModel,
      difficulty: configStore.difficulty
    })

    if (result.success) {
      // 订阅游戏更新
      socketStore.subscribe(gameStore.gameId, handleGameUpdate)
    } else {
      errorMessage.value = result.message || '创建游戏失败'
    }
  } catch (error) {
    errorMessage.value = error.message || '创建游戏失败'
  }
}

function handleGameUpdate(data) {
  gameStore.updateGameState(data.gameState)
  gameStore.isAIThinking = false
}

function handleCellClick({ x, y, piece }) {
  const turn = gameState.value?.turn
  if (turn !== 'red') return // 只有红方回合可以操作

  if (piece && piece.color === 'red') {
    // 选中己方棋子
    gameStore.selectPiece({ ...piece, x, y })
    gameStore.setValidMoves([]) // TODO: 计算有效走法
  } else if (selectedPiece.value) {
    // 尝试走棋
    executeMove(selectedPiece.value, { x, y })
  }
}

async function executeMove(piece, to) {
  errorMessage.value = ''
  try {
    const from = { x: piece.x, y: piece.y }
    await gameStore.makeMove(from, to)
    gameStore.selectPiece(null)
    gameStore.setValidMoves([])
  } catch (error) {
    errorMessage.value = error.message || '走棋失败'
  }
}

async function handleUndo() {
  errorMessage.value = ''
  try {
    await gameStore.undoMove()
  } catch (error) {
    errorMessage.value = error.message || '悔棋失败'
  }
}

async function handleHint() {
  errorMessage.value = ''
  try {
    const result = await gameStore.getHint()
    if (result.success && result.data) {
      gameStore.selectPiece(result.data.from)
      gameStore.setValidMoves([{ from: result.data.from, to: result.data.to }])
    }
  } catch (error) {
    errorMessage.value = error.message || '获取提示失败'
  }
}

function handleRestart() {
  if (confirm('确定要重新开始游戏吗？')) {
    createNewGame()
  }
}
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  padding: 20px 0;
}

.page-title {
  text-align: center;
  margin-bottom: 20px;
  color: var(--text-color);
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fee;
  color: #c00;
  border-radius: 4px;
  text-align: center;
}
</style>
```

**Step 3: 创建 game 页面入口**

```javascript
// frontend/src/pages/game/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import GamePage from './GamePage.vue'
import '../../styles/global.scss'

const app = createApp(GamePage)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
```

**Step 4: 提交对弈页面**

Run:
```bash
git add frontend/public/game.html frontend/src/pages/game/
git commit -m "feat: add game page with chess board and controls"
```

---

## Task 8: 创建首页

**Files:**
- Create: `frontend/public/index.html`
- Create: `frontend/src/pages/home/HomePage.vue`
- Create: `frontend/src/pages/home/main.js`

**Step 1: 创建 index.html 入口**

```html
<!-- frontend/public/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>中国象棋对决</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/pages/home/main.js"></script>
</body>
</html>
```

**Step 2: 创建 HomePage 组件**

Run: `mkdir -p frontend/src/pages/home`

```vue
<!-- frontend/src/pages/home/HomePage.vue -->
<template>
  <div class="home-page">
    <div class="container">
      <div class="hero">
        <h1 class="title">中国象棋对决</h1>
        <p class="subtitle">AI 对弈 | 在线对战 | 观战学习</p>
      </div>

      <div class="actions">
        <a href="/game.html" class="btn btn-primary btn-large">
          开始对弈
        </a>
        <a href="/spectate.html" class="btn btn-secondary btn-large">
          观战模式
        </a>
        <a href="/settings.html" class="btn btn-secondary btn-large">
          游戏设置
        </a>
      </div>

      <div class="features">
        <div class="feature">
          <h3>AI 对弈</h3>
          <p>支持多种 AI 模型，不同难度等你挑战</p>
        </div>
        <div class="feature">
          <h3>在线对战</h3>
          <p>与好友实时对弈，切磋棋艺</p>
        </div>
        <div class="feature">
          <h3>观战学习</h3>
          <p>观看高手对局，提升棋力</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 首页无需复杂逻辑
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero {
  text-align: center;
  margin-bottom: 48px;
}

.title {
  font-size: 48px;
  font-weight: bold;
  color: var(--text-color);
  margin-bottom: 16px;
}

.subtitle {
  font-size: 18px;
  color: #666;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 64px;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.btn-large {
  padding: 16px 32px;
  font-size: 18px;
  text-align: center;
  text-decoration: none;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.feature {
  text-align: center;
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  h3 {
    margin-bottom: 8px;
    color: var(--text-color);
  }

  p {
    color: #666;
    font-size: 14px;
  }
}
</style>
```

**Step 3: 创建 home 页面入口**

```javascript
// frontend/src/pages/home/main.js
import { createApp } from 'vue'
import HomePage from './HomePage.vue'
import '../../styles/global.scss'

const app = createApp(HomePage)
app.mount('#app')
```

**Step 4: 提交首页**

Run:
```bash
git add frontend/public/index.html frontend/src/pages/home/
git commit -m "feat: add home page with navigation"
```

---

## Task 9: 创建设置页面

**Files:**
- Create: `frontend/public/settings.html`
- Create: `frontend/src/pages/settings/SettingsPage.vue`
- Create: `frontend/src/pages/settings/main.js`

**Step 1: 创建 settings.html 入口**

```html
<!-- frontend/public/settings.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>设置 - 中国象棋对决</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/pages/settings/main.js"></script>
</body>
</html>
```

**Step 2: 创建 SettingsPage 组件**

Run: `mkdir -p frontend/src/pages/settings`

```vue
<!-- frontend/src/pages/settings/SettingsPage.vue -->
<template>
  <div class="settings-page">
    <div class="container">
      <h1 class="page-title">游戏设置</h1>

      <div class="settings-section">
        <h2>AI 设置</h2>
        <div class="setting-item">
          <label>AI 模型</label>
          <select v-model="localConfig.aiModel">
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="qianfan">百度文心一言</option>
          </select>
        </div>
        <div class="setting-item">
          <label>难度: {{ localConfig.difficulty }}</label>
          <input
            v-model.number="localConfig.difficulty"
            type="range"
            min="1"
            max="5"
            step="1"
          >
        </div>
      </div>

      <div class="settings-section">
        <h2>体验设置</h2>
        <div class="setting-item">
          <label>
            <input v-model="localConfig.enableSound" type="checkbox">
            启用音效
          </label>
        </div>
        <div class="setting-item">
          <label>
            <input v-model="localConfig.enableVibration" type="checkbox">
            启用振动（移动设备）
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h2>服务器设置</h2>
        <div class="setting-item">
          <label>服务器地址</label>
          <input v-model="localConfig.serverUrl" type="text" placeholder="http://localhost:3001">
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="saveSettings">保存设置</button>
        <a href="/" class="btn btn-secondary">返回首页</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()

const localConfig = ref({
  serverUrl: '',
  aiModel: 'deepseek',
  difficulty: 3,
  enableSound: true,
  enableVibration: true
})

onMounted(() => {
  configStore.loadConfig()
  localConfig.value = {
    serverUrl: configStore.serverUrl,
    aiModel: configStore.aiModel,
    difficulty: configStore.difficulty,
    enableSound: configStore.enableSound,
    enableVibration: configStore.enableVibration
  }
})

function saveSettings() {
  configStore.updateConfig(localConfig.value)
  alert('设置已保存')
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding: 20px 0;
}

.page-title {
  text-align: center;
  margin-bottom: 32px;
}

.settings-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  h2 {
    font-size: 18px;
    margin-bottom: 16px;
    color: var(--text-color);
  }
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #eee;

  &:last-child {
    border-bottom: none;
  }

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-color);
  }

  select, input[type="text"] {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 14px;
  }

  input[type="range"] {
    width: 150px;
  }

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
  }
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 24px;

  .btn {
    text-decoration: none;
    display: inline-block;
  }
}
</style>
```

**Step 3: 创建 settings 页面入口**

```javascript
// frontend/src/pages/settings/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SettingsPage from './SettingsPage.vue'
import '../../styles/global.scss'

const app = createApp(SettingsPage)
app.use(createPinia())
app.mount('#app')
```

**Step 4: 提交设置页面**

Run:
```bash
git add frontend/public/settings.html frontend/src/pages/settings/
git commit -m "feat: add settings page with configuration options"
```

---

## Task 10: 创建观战页面

**Files:**
- Create: `frontend/public/spectate.html`
- Create: `frontend/src/pages/spectate/SpectatePage.vue`
- Create: `frontend/src/pages/spectate/main.js`
- Create: `frontend/src/components/GameList/GameList.vue`

**Step 1: 创建 GameList 组件**

Run: `mkdir -p frontend/src/components/GameList`

```vue
<!-- frontend/src/components/GameList/GameList.vue -->
<template>
  <div class="game-list">
    <h2>活跃游戏</h2>
    <div v-if="games.length === 0" class="empty">
      暂无活跃游戏
    </div>
    <div v-else class="games">
      <div
        v-for="game in games"
        :key="game.id"
        class="game-item"
        @click="$emit('select', game.id)"
      >
        <div class="game-info">
          <span class="game-id">{{ game.id.slice(0, 8) }}...</span>
          <span class="game-status" :class="game.status">
            {{ getStatusText(game.status) }}
          </span>
        </div>
        <div class="game-players">
          <span class="player red">红方: {{ getPlayerText(game.players?.red) }}</span>
          <span class="player black">黑方: {{ getPlayerText(game.players?.black) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  games: {
    type: Array,
    default: () => []
  }
})

defineEmits(['select'])

function getStatusText(status) {
  const map = {
    playing: '对弈中',
    red_win: '红方胜',
    black_win: '黑方胜',
    draw: '和棋'
  }
  return map[status] || status
}

function getPlayerText(player) {
  if (!player) return '-'
  return player.type === 'ai' ? `AI (${player.model})` : '玩家'
}
</script>

<style scoped>
.game-list {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;

  h2 {
    margin-bottom: 16px;
    font-size: 18px;
  }
}

.empty {
  text-align: center;
  padding: 32px;
  color: #999;
}

.games {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game-item {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #eee;
  }
}

.game-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.game-id {
  font-family: monospace;
  font-size: 14px;
  color: #666;
}

.game-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;

  &.playing {
    background: #e3f2e9;
    color: #2e7d32;
  }
}

.game-players {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}

.player {
  &.red { color: #c00; }
  &.black { color: #000; }
}
</style>
```

**Step 2: 创建 spectate.html 入口**

```html
<!-- frontend/public/spectate.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>观战 - 中国象棋对决</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/pages/spectate/main.js"></script>
</body>
</html>
```

**Step 3: 创建 SpectatePage 组件**

Run: `mkdir -p frontend/src/pages/spectate`

```vue
<!-- frontend/src/pages/spectate/SpectatePage.vue -->
<template>
  <div class="spectate-page">
    <div class="container">
      <h1 class="page-title">观战模式</h1>

      <div v-if="!selectedGameId">
        <GameList
          :games="games"
          @select="selectGame"
        />
        <button class="btn btn-secondary" @click="loadGames">刷新列表</button>
        <a href="/" class="btn btn-secondary">返回首页</a>
      </div>

      <div v-else>
        <button class="btn btn-secondary" @click="backToList">返回列表</button>

        <GameStatus
          :turn="gameState?.turn"
          :status="gameState?.status"
          :move-count="gameState?.moves?.length"
        />

        <ChessBoard
          v-if="gameState?.board"
          :board="gameState.board"
          :readonly="true"
          :last-move="lastMove"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { gameApi } from '../../utils/api'
import { useSocketStore } from '../../stores/socket'
import ChessBoard from '../../components/ChessBoard/ChessBoard.vue'
import GameStatus from '../../components/GameStatus/GameStatus.vue'
import GameList from '../../components/GameList/GameList.vue'

const socketStore = useSocketStore()

const games = ref([])
const selectedGameId = ref(null)
const gameState = ref(null)
const lastMove = ref(null)

onMounted(() => {
  loadGames()
})

onUnmounted(() => {
  if (selectedGameId.value) {
    socketStore.unsubscribe(selectedGameId.value)
  }
})

async function loadGames() {
  try {
    const result = await gameApi.list()
    if (result.success) {
      games.value = result.data || []
    }
  } catch (error) {
    console.error('加载游戏列表失败:', error)
  }
}

function selectGame(gameId) {
  selectedGameId.value = gameId
  loadGame(gameId)
}

async function loadGame(gameId) {
  try {
    const result = await gameApi.get(gameId)
    if (result.success) {
      gameState.value = result.data
      // 订阅游戏更新
      socketStore.subscribe(gameId, handleGameUpdate)
    }
  } catch (error) {
    console.error('加载游戏失败:', error)
  }
}

function handleGameUpdate(data) {
  gameState.value = data.gameState
  lastMove.value = data.lastMove
}

function backToList() {
  if (selectedGameId.value) {
    socketStore.unsubscribe(selectedGameId.value)
  }
  selectedGameId.value = null
  gameState.value = null
  lastMove.value = null
}
</script>

<style scoped>
.spectate-page {
  min-height: 100vh;
  padding: 20px 0;
}

.page-title {
  text-align: center;
  margin-bottom: 20px;
}
</style>
```

**Step 4: 创建 spectate 页面入口**

```javascript
// frontend/src/pages/spectate/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SpectatePage from './SpectatePage.vue'
import '../../styles/global.scss'

const app = createApp(SpectatePage)
app.use(createPinia())
app.mount('#app')
```

**Step 5: 提交观战页面**

Run:
```bash
git add frontend/public/spectate.html frontend/src/pages/spectate/ frontend/src/components/GameList/
git commit -m "feat: add spectate page with game list"
```

---

## Task 11: 修改服务器以支持静态文件托管

**Files:**
- Modify: `server/src/app.ts`

**Step 1: 查看现有 app.ts 结构**

Run: `cat server/src/app.ts`

**Step 2: 添加静态文件服务**

在 `server/src/app.ts` 中添加：

```typescript
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ... 现有代码 ...

// 在所有路由之后添加静态文件服务
app.use(express.static(path.join(__dirname, '../public')))

// SPA fallback（可选，用于前端路由）
app.get('*', (req, res) => {
  // 只对 HTML 请求返回 index.html
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, '../public/index.html'))
  } else {
    res.status(404).send('Not Found')
  }
})
```

**Step 3: 提交服务器修改**

Run:
```bash
git add server/src/app.ts
git commit -m "feat: add static file serving for frontend"
```

---

## Task 12: 构建和测试

**Step 1: 构建前端**

Run: `cd frontend && npm run build`

Expected: 构建成功，文件输出到 `server/public/`

**Step 2: 启动服务器**

Run: `cd server && npm start`

Expected: 服务器在 http://localhost:3001 启动

**Step 3: 测试访问**

在浏览器中访问:
- http://localhost:3001/ - 首页
- http://localhost:3001/game.html - 对弈页面
- http://localhost:3001/spectate.html - 观战页面
- http://localhost:3001/settings.html - 设置页面

**Step 4: 验证功能**

1. 首页导航是否正常
2. 对弈页面能否创建游戏
3. 设置页面能否保存配置
4. WebSocket 连接是否正常

**Step 5: 提交最终版本**

Run:
```bash
git add .
git commit -m "feat: complete miniprogram to web refactoring"
```

---

## 验收标准

- [ ] 首页可以正常访问和导航
- [ ] 对弈页面可以创建游戏并与 AI 对弈
- [ ] 棋盘显示正确，点击可以走棋
- [ ] 悔棋、提示功能正常
- [ ] 设置页面可以配置并保存
- [ ] 观战页面可以显示游戏列表
- [ ] WebSocket 实时更新正常
- [ ] 响应式布局在不同屏幕尺寸下正常
- [ ] 构建产物正确输出到 server/public/

## 参考

- 设计文档: `docs/plans/2025-03-07-miniprogram-to-web-refactor-design.md`
- 小程序源码: `miniprogram/`
- 服务器文档: `server/README.md`
