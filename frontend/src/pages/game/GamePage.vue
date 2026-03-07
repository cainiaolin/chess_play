<template>
  <div class="game-page">
    <header class="header">
      <a href="/" class="back-btn">← 返回</a>
      <h1>中国象棋对决</h1>
    </header>

    <div class="game-content">
      <div class="status-bar">
        <span class="turn" :class="currentTurn">{{ turnText }}</span>
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
          :selected-piece="selectedPiece"
          :valid-moves="validMoves"
          :last-move="lastMove"
          @cell-click="handleCellClick"
        />
      </div>

      <div class="controls">
        <button class="btn btn-secondary" :disabled="moveCount === 0" @click="handleUndo">
          悔棋
        </button>
        <button class="btn btn-primary" :disabled="isAIThinking" @click="handleHint">
          提示
        </button>
        <button class="btn btn-secondary" @click="handleRestart">
          重新开始
        </button>
      </div>

      <div v-if="gameStatus !== 'playing'" class="game-result">
        <p>{{ resultText }}</p>
        <button class="btn btn-primary" @click="handleRestart">再来一局</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ChessBoard from '../../components/ChessBoard/ChessBoard.vue'
import { gameApi } from '../../utils/api'

// 状态
const gameId = ref(null)
const gameState = ref(null)
const selectedPiece = ref(null)
const validMoves = ref([])
const lastMove = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const isAIThinking = ref(false)

// 计算属性
const boardData = computed(() => gameState.value?.board || createEmptyBoard())
const currentTurn = computed(() => gameState.value?.turn || 'red')
const gameStatus = computed(() => gameState.value?.status || 'playing')
const moveCount = computed(() => gameState.value?.moves?.length || 0)

const turnText = computed(() => currentTurn.value === 'red' ? '红方走棋' : '黑方走棋')
const resultText = computed(() => {
  if (gameStatus.value === 'red_win') return '红方获胜！'
  if (gameStatus.value === 'black_win') return '黑方获胜！'
  if (gameStatus.value === 'draw') return '和棋！'
  return ''
})

// 创建空棋盘
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

// 初始化游戏
async function initGame() {
  try {
    loading.value = true
    errorMessage.value = ''

    const result = await gameApi.create({
      redPlayer: { type: 'user' },
      blackPlayer: { type: 'ai', model: 'deepseek' }
    })

    if (result.success && result.data) {
      gameId.value = result.data.id
      gameState.value = result.data
      selectedPiece.value = null
      validMoves.value = []
      lastMove.value = null
    } else {
      throw new Error(result.message || '创建游戏失败')
    }
  } catch (error) {
    console.error('初始化游戏失败:', error)
    errorMessage.value = error.message || '连接服务器失败，请检查后端是否启动'
  } finally {
    loading.value = false
  }
}

// 处理棋盘点击
async function handleCellClick({ x, y, piece }) {
  if (isAIThinking.value) return
  if (currentTurn.value !== 'red') return // 只能在红方回合操作

  try {
    // 如果已选中棋子
    if (selectedPiece.value) {
      // 检查是否点击了有效移动位置
      const isValidMove = validMoves.value.some(
        m => m.to?.x === x && m.to?.y === y
      )

      if (isValidMove) {
        // 执行移动
        const result = await gameApi.move(gameId.value, {
          from: { x: selectedPiece.value.x, y: selectedPiece.value.y },
          to: { x, y }
        })

        if (result.success) {
          gameState.value = result.data.gameState || result.data
          lastMove.value = result.data.move
          selectedPiece.value = null
          validMoves.value = []

          // AI 走棋
          if (result.data.aiMove) {
            isAIThinking.value = true
            // 等待 AI 走棋完成（通过轮询或直接从响应获取）
            if (result.data.gameState) {
              gameState.value = result.data.gameState
              lastMove.value = result.data.aiMove
            }
            isAIThinking.value = false
          }
        } else {
          throw new Error(result.message || '走棋失败')
        }
      } else if (piece && piece.color === 'red') {
        // 选择另一个棋子
        selectedPiece.value = { x, y, ...piece }
        validMoves.value = getValidMoves({ x, y, ...piece })
      } else {
        // 取消选择
        selectedPiece.value = null
        validMoves.value = []
      }
    } else {
      // 选择棋子
      if (piece && piece.color === 'red') {
        selectedPiece.value = { x, y, ...piece }
        validMoves.value = getValidMoves({ x, y, ...piece })
      }
    }
  } catch (error) {
    console.error('走棋错误:', error)
    errorMessage.value = error.message || '走棋失败'
    setTimeout(() => { errorMessage.value = '' }, 3000)
  }
}

// 获取有效移动（简化版，实际应该从后端获取）
function getValidMoves(piece) {
  // 这里返回空数组，实际应该调用后端 API 获取
  // 或者在前端实现完整的象棋规则
  return []
}

// 悔棋
async function handleUndo() {
  if (!gameId.value || isAIThinking.value) return

  try {
    const result = await gameApi.undo(gameId.value)
    if (result.success) {
      gameState.value = result.data
    } else {
      throw new Error(result.message || '悔棋失败')
    }
  } catch (error) {
    console.error('悔棋失败:', error)
    errorMessage.value = error.message
    setTimeout(() => { errorMessage.value = '' }, 3000)
  }
}

// 提示
async function handleHint() {
  if (!gameId.value || isAIThinking.value) return

  try {
    const result = await gameApi.hint(gameId.value)
    if (result.success && result.data?.hint) {
      selectedPiece.value = result.data.hint.from
      validMoves.value = [result.data.hint]
    } else {
      throw new Error(result.message || '获取提示失败')
    }
  } catch (error) {
    console.error('获取提示失败:', error)
    errorMessage.value = error.message
    setTimeout(() => { errorMessage.value = '' }, 3000)
  }
}

// 重新开始
function handleRestart() {
  selectedPiece.value = null
  validMoves.value = []
  lastMove.value = null
  initGame()
}

onMounted(() => {
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

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.header h1 {
  margin: 0;
  font-size: 20px;
}

.game-content {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

.turn {
  font-weight: bold;
}

.turn.red { color: #ff6b6b; }
.turn.black { color: #fff; }

.board-container {
  position: relative;
  min-height: 400px;
}

.loading, .error {
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
</style>
