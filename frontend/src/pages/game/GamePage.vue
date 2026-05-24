<template>
  <div class="game-page">
    <header class="header">
      <a href="/" class="back-btn">← 返回</a>
      <h1>中国象棋对决</h1>
      <a href="/settings.html" class="settings-link">设置</a>
    </header>

    <div class="game-content">
      <div class="status-bar">
        <span class="turn" :class="currentTurn">{{ turnText }}</span>
        <span class="mode-tag">{{ modeTagText }}</span>
        <span class="move-count">第 {{ moveCount }} 步</span>
      </div>

      <div class="board-container">
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="errorMessage" class="error">
          <p>{{ errorMessage }}</p>
          <button class="btn btn-primary" @click="initGame">重试</button>
        </div>
        <ChessBoard
          v-else
          :board="boardData"
          :readonly="isSpectator"
          :selected-piece="selectedPiece"
          :valid-moves="validMoves"
          :last-move="lastMove"
          @cell-click="handleCellClick"
        />
      </div>

      <div class="controls">
        <button
          class="btn btn-secondary"
          :disabled="moveCount === 0 || isAIThinking || isSpectator || !configStore.allowUndo"
          @click="handleUndo"
        >
          悔棋
        </button>
        <button
          class="btn btn-primary"
          :disabled="isAIThinking || isSpectator || currentTurn !== humanSide"
          @click="handleHint"
        >
          提示
        </button>
        <button class="btn btn-secondary" :disabled="isAIThinking" @click="handleRestart">
          重新开始
        </button>
      </div>

      <div v-if="moveTip" class="move-tip">{{ moveTip }}</div>

      <div v-if="gameStatus !== 'playing'" class="game-result">
        <p>{{ resultText }}</p>
        <button class="btn btn-primary" @click="handleRestart">再来一局</button>
      </div>
    </div>

    <!-- AI 响应面板（固定在右侧） -->
    <div class="ai-panel">
      <h3 class="ai-panel-title">AI 思考过程</h3>
      <div v-if="isAIThinking" class="ai-thinking-indicator">
        <span class="dot-pulse"></span> AI 思考中...
      </div>
      <div class="ai-log" ref="aiLogRef">
        <div v-if="aiLogs.length === 0" class="ai-empty">等待 AI 走棋...</div>
        <div v-for="(log, i) in aiLogs" :key="i" class="ai-log-item">
          <div class="ai-log-header">
            <span class="ai-log-move">第 {{ log.moveNum }} 步 · {{ log.color === 'red' ? '红方' : '黑方' }}</span>
            <span class="ai-log-time">{{ log.time }}</span>
          </div>
          <div v-if="log.moveText" class="ai-log-move-text">{{ log.moveText }}</div>
          <div class="ai-log-thinking">{{ log.thinking }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import ChessBoard from '../../components/ChessBoard/ChessBoard.vue'
import { gameApi } from '../../utils/api'
import { useConfigStore } from '../../stores/config'
import { ChessEngine } from '../../utils/chess-engine'

const configStore = useConfigStore()
const localEngine = new ChessEngine()

const gameId = ref(null)
const gameState = ref(null)
const selectedPiece = ref(null)
const validMoves = ref([])
const lastMove = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const isAIThinking = ref(false)
const aiRunId = ref(0)

const boardData = computed(() => gameState.value?.board || createEmptyBoard())
const currentTurn = computed(() => gameState.value?.turn || 'red')
const gameStatus = computed(() => gameState.value?.status || 'playing')
const moveCount = computed(() => gameState.value?.moves?.length || 0)
const humanSide = computed(() => configStore.humanSide || 'red')
const isSpectator = computed(() => configStore.gameMode === 'ai_vs_ai')

const moveTip = ref('')
let moveTipTimer = null

const turnText = computed(() => (currentTurn.value === 'red' ? '红方走棋' : '黑方走棋'))
const modeTagText = computed(() => {
  if (configStore.gameMode === 'ai_vs_ai') return 'AI 观战'
  return humanSide.value === 'black' ? '人机 · 执黑' : '人机 · 执红'
})

const resultText = computed(() => {
  if (gameStatus.value === 'red_win') return '红方获胜！'
  if (gameStatus.value === 'black_win') return '黑方获胜！'
  if (gameStatus.value === 'draw') return '和棋！'
  return ''
})

// AI 响应日志
const aiLogs = ref([])
const aiLogRef = ref(null)

function addAiLog(aiMoveData, moveNum) {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const from = aiMoveData?.from
  const to = aiMoveData?.to
  const moveText = (from && to) ? `(${from.x},${from.y}) → (${to.x},${to.y})` : ''

  // 判断走棋方：奇数步为红方，偶数步为黑方（moveNum 从 1 开始，AI 总是对方）
  // 用 moveNum 判断更准确：AI 走棋时实际步数已经是 moveNum
  const isRedTurn = moveNum % 2 === 1

  aiLogs.value.push({
    moveNum,
    color: isRedTurn ? 'red' : 'black',
    time,
    moveText,
    thinking: aiMoveData?.thinking || '(无思考内容)'
  })

  nextTick(() => {
    const el = aiLogRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function createEmptyBoard() {
  const board = []
  for (let y = 0; y < 10; y++) {
    const row = []
    for (let x = 0; x < 9; x++) {
      row.push(null)
    }
    board.push(row)
  }
  return board
}

function sleepMs(ms) {
  const t = typeof ms === 'number' && ms > 0 ? ms : 0
  return new Promise((resolve) => setTimeout(resolve, t))
}

function showMoveTip(msg) {
  moveTip.value = msg
  if (moveTipTimer) clearTimeout(moveTipTimer)
  moveTipTimer = setTimeout(() => { moveTip.value = '' }, 3000)
}

function buildCreatePayload() {
  const opts = {
    timerMode: configStore.timerMode,
    moveTimeLimit: configStore.moveTimeLimit,
    redTimeLimit: configStore.redTimeLimit,
    blackTimeLimit: configStore.blackTimeLimit,
    firstPlayer: configStore.firstPlayer,
    allowUndo: configStore.allowUndo,
    autoForfeit: configStore.autoForfeit,
    aiRetryOnError: configStore.aiRetryOnError,
    aiThinkDelay: configStore.aiThinkDelay
  }
  const human = configStore.humanSide || 'red'
  if (configStore.gameMode === 'ai_vs_ai') {
    return {
      redPlayer: { type: 'ai' },
      blackPlayer: { type: 'ai' },
      options: opts
    }
  }
  return {
    redPlayer: human === 'red' ? { type: 'user' } : { type: 'ai' },
    blackPlayer: human === 'black' ? { type: 'user' } : { type: 'ai' },
    options: opts
  }
}

function syncEngine(state) {
  if (state?.board) {
    localEngine.loadBoard(state.board, state.turn || 'red')
  }
}

function getLocalValidMoves(piece) {
  return localEngine.getValidMovesForPosition({ x: piece.x, y: piece.y }).map(pos => ({ to: pos }))
}

async function drainAiUntilHuman(runId) {
  while (
    runId === aiRunId.value &&
    gameState.value?.status === 'playing'
  ) {
    const t = gameState.value.turn
    const p = t === 'red' ? gameState.value.players.red : gameState.value.players.black
    if (p.type !== 'ai') break

    isAIThinking.value = true
    try {
      await sleepMs(configStore.aiThinkDelay)
      if (runId !== aiRunId.value) break

      let res
      try {
        res = await gameApi.aiStep(gameId.value)
      } catch (err) {
        const msg = err?.message || err?.error || String(err)
        errorMessage.value = msg
        break
      }
      if (!res?.success) {
        errorMessage.value = res?.message || 'AI 走棋失败'
        break
      }
      gameState.value = res.data.gameState
      syncEngine(res.data.gameState)
      const moves = res.data.gameState?.moves || []
      if (moves.length) lastMove.value = moves[moves.length - 1]
      if (res.data.aiThinking || res.data.move) {
        addAiLog(
          { from: res.data.move?.from, to: res.data.move?.to, thinking: res.data.aiThinking },
          moves.length
        )
      }
    } finally {
      isAIThinking.value = false
    }
  }
}

async function runAiVsAiLoop(runId) {
  let steps = 0
  const maxSteps = 500
  while (
    steps++ < maxSteps &&
    runId === aiRunId.value &&
    gameState.value?.status === 'playing'
  ) {
    const t = gameState.value.turn
    const p = t === 'red' ? gameState.value.players.red : gameState.value.players.black
    if (p.type !== 'ai') break

    isAIThinking.value = true
    try {
      await sleepMs(configStore.aiThinkDelay)
      if (runId !== aiRunId.value) break

      let res
      try {
        res = await gameApi.aiStep(gameId.value)
      } catch (err) {
        const msg = err?.message || err?.error || String(err)
        errorMessage.value = msg
        break
      }
      if (!res?.success) {
        errorMessage.value = res?.message || 'AI 走棋失败'
        break
      }
      gameState.value = res.data.gameState
      syncEngine(res.data.gameState)
      const moves = res.data.gameState?.moves || []
      if (moves.length) lastMove.value = moves[moves.length - 1]
      if (res.data.aiThinking || res.data.move) {
        addAiLog(
          { from: res.data.move?.from, to: res.data.move?.to, thinking: res.data.aiThinking },
          moves.length
        )
      }
    } finally {
      isAIThinking.value = false
    }
  }
}

async function runContinuations(runId) {
  if (runId !== aiRunId.value || !gameState.value) return
  if (gameState.value.status !== 'playing') return

  if (configStore.gameMode === 'ai_vs_ai') {
    await runAiVsAiLoop(runId)
  } else {
    await drainAiUntilHuman(runId)
  }
}

async function initGame() {
  const runId = aiRunId.value
  try {
    loading.value = true
    errorMessage.value = ''
    aiLogs.value = []

    const result = await gameApi.create(buildCreatePayload())
    if (runId !== aiRunId.value) return

    if (result.success && result.data) {
      gameId.value = result.data.id
      gameState.value = result.data
      syncEngine(result.data)
      selectedPiece.value = null
      validMoves.value = []
      lastMove.value = null
      await runContinuations(runId)
    } else {
      throw new Error(result.message || '创建游戏失败')
    }
  } catch (error) {
    console.error('初始化游戏失败:', error)
    errorMessage.value = error.message || '连接服务器失败，请检查后端是否启动'
  } finally {
    if (runId === aiRunId.value) {
      loading.value = false
    }
  }
}

async function handleCellClick({ x, y, piece }) {
  if (isSpectator.value) return
  if (isAIThinking.value) return
  if (currentTurn.value !== humanSide.value) {
    showMoveTip('不是该方回合')
    return
  }

  try {
    if (selectedPiece.value) {
      const isValidMove = validMoves.value.some((m) => m.to?.x === x && m.to?.y === y)

      if (isValidMove) {
        const from = { x: selectedPiece.value.x, y: selectedPiece.value.y }
        const movePiece = selectedPiece.value

        // 乐观更新：立即在前端移动棋子
        const prevBoard = gameState.value.board
        const prevTurn = gameState.value.turn
        const boardCopy = prevBoard.map(row => [...row])
        boardCopy[y][x] = { type: movePiece.type, color: movePiece.color }
        boardCopy[from.y][from.x] = null
        gameState.value = {
          ...gameState.value,
          board: boardCopy,
          turn: prevTurn === 'red' ? 'black' : 'red'
        }
        syncEngine(gameState.value)
        lastMove.value = { from, to: { x, y }, piece: movePiece.type }
        selectedPiece.value = null
        validMoves.value = []

        // 后台发送走法，等待 AI 响应
        isAIThinking.value = true
        try {
          const result = await gameApi.move(gameId.value, {
            from,
            to: { x, y },
            player: prevTurn
          })

          if (result.success) {
            gameState.value = result.data.gameState || result.data
            syncEngine(gameState.value)
            lastMove.value = result.data.move
            if (result.data.aiMove) {
              const totalMoves = result.data.gameState?.moves?.length || 0
              addAiLog(result.data.aiMove, totalMoves)
            }
          } else {
            // 走法被后端拒绝，回滚乐观更新
            gameState.value = { ...gameState.value, board: prevBoard, turn: prevTurn }
            syncEngine(gameState.value)
            throw new Error(result.message || '走棋失败')
          }
        } catch (error) {
          // 任何错误都回滚到乐观更新前的状态
          gameState.value = { ...gameState.value, board: prevBoard, turn: prevTurn }
          syncEngine(gameState.value)
          console.error('走棋错误:', error)
          errorMessage.value = error.message || '走棋失败'
          setTimeout(() => { errorMessage.value = '' }, 3000)
        } finally {
          isAIThinking.value = false
        }
        return
      } else if (piece && piece.color === humanSide.value) {
        selectedPiece.value = { x, y, ...piece }
        validMoves.value = await getLocalValidMoves({ x, y, ...piece })
      } else {
        showMoveTip('不支持的走法')
      }
    } else {
      if (piece && piece.color === humanSide.value) {
        selectedPiece.value = { x, y, ...piece }
        validMoves.value = await getLocalValidMoves({ x, y, ...piece })
      }
    }
  } catch (error) {
    console.error('走棋错误:', error)
    errorMessage.value = error.message || '走棋失败'
    setTimeout(() => {
      errorMessage.value = ''
    }, 3000)
  }
}

async function handleUndo() {
  if (!gameId.value || isAIThinking.value || isSpectator.value || !configStore.allowUndo) return

  try {
    const result = await gameApi.undo(gameId.value)
    if (result.success) {
      gameState.value = result.data
      syncEngine(result.data)
      selectedPiece.value = null
      validMoves.value = []
      // 撤销最后一条 AI 日志
      if (aiLogs.value.length > 0) aiLogs.value.pop()
    } else {
      throw new Error(result.message || '悔棋失败')
    }
  } catch (error) {
    console.error('悔棋失败:', error)
    errorMessage.value = error.message
    setTimeout(() => {
      errorMessage.value = ''
    }, 3000)
  }
}

async function handleHint() {
  if (!gameId.value || isAIThinking.value || isSpectator.value || currentTurn.value !== humanSide.value) return

  try {
    const result = await gameApi.hint(gameId.value)
    if (result.success && result.data?.hint) {
      const h = result.data.hint
      const from = h.from
      const cell = gameState.value?.board?.[from.y]?.[from.x]
      selectedPiece.value = cell
        ? { x: from.x, y: from.y, type: cell.type, color: cell.color }
        : { x: from.x, y: from.y }
      validMoves.value = [{ to: h.to }]
    } else {
      throw new Error(result.message || '获取提示失败')
    }
  } catch (error) {
    console.error('获取提示失败:', error)
    errorMessage.value = error.message
    setTimeout(() => {
      errorMessage.value = ''
    }, 3000)
  }
}

function handleRestart() {
  aiRunId.value += 1
  selectedPiece.value = null
  validMoves.value = []
  lastMove.value = null
  initGame()
}

onMounted(() => {
  configStore.loadConfig()
  initGame()
})
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
}

.back-btn {
  color: #fff;
  text-decoration: none;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-right: 16px;
}

.settings-link {
  margin-left: auto;
  color: #d4a855;
  text-decoration: none;
  font-size: 14px;
  padding: 8px 12px;
}

.settings-link:hover {
  text-decoration: underline;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.header h1 {
  margin: 0;
  font-size: 20px;
  flex: 1;
  text-align: center;
}

.game-content {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

.mode-tag {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.turn {
  font-weight: bold;
}

.turn.red {
  color: #ff6b6b;
}

.turn.black {
  color: #fff;
}

.board-container {
  position: relative;
  min-height: 400px;
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #aaa;
}

.error p {
  color: #ff6b6b;
  margin-bottom: 16px;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #f5af19 0%, #f12711 100%);
  color: #fff;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.move-tip {
  text-align: center;
  padding: 8px 16px;
  margin-top: 12px;
  background: rgba(255, 107, 107, 0.15);
  color: #ff6b6b;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.game-result {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.game-result p {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 24px;
}

/* ── AI 响应面板（固定在右侧） ── */
.ai-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 320px;
  max-height: calc(100vh - 100px);
  background: rgba(0, 0, 0, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(8px);
  z-index: 50;
}

.ai-panel-title {
  margin: 0;
  padding: 14px 16px 10px;
  font-size: 15px;
  color: #d4a855;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.ai-thinking-indicator {
  padding: 10px 16px;
  font-size: 13px;
  color: #8be9fd;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dot-pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8be9fd;
  animation: dotPulse 1.2s infinite;
}

@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.1); }
}

.ai-log {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.ai-empty {
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
  text-align: center;
  padding-top: 40px;
}

.ai-log-item {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ai-log-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.ai-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.ai-log-move {
  font-size: 12px;
  font-weight: 600;
  color: #d4a855;
}

.ai-log-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.ai-log-move-text {
  font-size: 13px;
  color: #8be9fd;
  margin-bottom: 4px;
  font-family: monospace;
}

.ai-log-thinking {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 响应式：窄屏时隐藏 AI 面板 */
@media (max-width: 1024px) {
  .ai-panel {
    display: none;
  }
}
</style>
