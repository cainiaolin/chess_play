<template>
  <div class="game-page">
    <GameStatus
      :turn="gameStore.currentTurn"
      :status="gameStore.gameStatus"
      :move-count="moveCount"
    />

    <ChessBoard
      :board="board"
      :selected-piece="gameStore.selectedPiece"
      :valid-moves="gameStore.validMoves"
      :last-move="gameStore.lastMove"
      @cell-click="handleCellClick"
    />

    <ControlPanel
      :can-undo="gameStore.canUndo"
      :can-hint="canHint"
      :is-ai-thinking="gameStore.isAIThinking"
      @undo="handleUndo"
      @hint="handleHint"
      @restart="handleRestart"
    />

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import ChessBoard from '../../components/ChessBoard/ChessBoard.vue'
import ControlPanel from '../../components/ControlPanel/ControlPanel.vue'
import GameStatus from '../../components/GameStatus/GameStatus.vue'
import { useGameStore } from '../../stores/game'
import { useConfigStore } from '../../stores/config'
import { useSocketStore } from '../../stores/socket'

const router = useRouter()
const gameStore = useGameStore()
const configStore = useConfigStore()
const socketStore = useSocketStore()

const errorMessage = ref('')
const canHint = ref(true)

// 计算棋盘数据
const board = computed(() => {
  return gameStore.gameState?.board || []
})

const moveCount = computed(() => {
  return gameStore.gameState?.moves?.length || 0
})

// 初始化游戏
async function initGame() {
  try {
    errorMessage.value = ''

    // 加载配置
    configStore.loadConfig()

    // 创建游戏
    const result = await gameStore.createGame({
      aiModel: configStore.aiModel,
      difficulty: configStore.difficulty
    })

    if (!result.success) {
      throw new Error(result.message || '创建游戏失败')
    }

    // 连接 Socket
    if (!socketStore.isConnected) {
      socketStore.connect(configStore.serverUrl)
    }

    // 加入游戏房间
    socketStore.join(gameStore.gameId)

    // 订阅游戏状态更新
    socketStore.subscribe(gameStore.gameId, handleGameStateUpdate)
  } catch (error) {
    console.error('初始化游戏失败:', error)
    errorMessage.value = error.message || '初始化游戏失败，请重试'
  }
}

// 处理游戏状态更新
function handleGameStateUpdate(newState) {
  gameStore.updateGameState(newState)
  gameStore.isAIThinking = false
}

// 处理棋盘点击
async function handleCellClick({ x, y, piece }) {
  try {
    errorMessage.value = ''

    // 如果已选中棋子，尝试移动
    if (gameStore.selectedPiece) {
      // 检查是否点击了有效移动位置
      const isValid = gameStore.validMoves.some(
        move => move.to?.x === x && move.to?.y === y
      )

      if (isValid) {
        // 执行移动
        const result = await gameStore.makeMove(
          gameStore.selectedPiece,
          { x, y }
        )

        if (result.success) {
          gameStore.selectPiece(null)
          gameStore.setValidMoves([])
        } else {
          throw new Error(result.message || '走棋失败')
        }
      } else if (piece && piece.color === gameStore.currentTurn) {
        // 选择另一个棋子
        gameStore.selectPiece({ x, y, ...piece })
        // TODO: 获取有效移动位置
        gameStore.setValidMoves([])
      } else {
        // 取消选择
        gameStore.selectPiece(null)
        gameStore.setValidMoves([])
      }
    } else {
      // 选择棋子
      if (piece && piece.color === gameStore.currentTurn) {
        gameStore.selectPiece({ x, y, ...piece })
        // TODO: 获取有效移动位置
        gameStore.setValidMoves([])
      }
    }
  } catch (error) {
    console.error('走棋错误:', error)
    errorMessage.value = error.message || '走棋失败，请重试'
  }
}

// 悔棋
async function handleUndo() {
  try {
    errorMessage.value = ''
    const result = await gameStore.undoMove()

    if (!result.success) {
      throw new Error(result.message || '悔棋失败')
    }
  } catch (error) {
    console.error('悔棋错误:', error)
    errorMessage.value = error.message || '悔棋失败，请重试'
  }
}

// 提示
async function handleHint() {
  try {
    errorMessage.value = ''
    const result = await gameStore.getHint()

    if (result.success && result.data.hint) {
      // 显示提示
      gameStore.selectPiece(result.data.hint.from)
      gameStore.setValidMoves([result.data.hint])
      canHint.value = false
      setTimeout(() => {
        canHint.value = true
      }, 3000)
    } else {
      throw new Error(result.message || '获取提示失败')
    }
  } catch (error) {
    console.error('提示错误:', error)
    errorMessage.value = error.message || '获取提示失败，请重试'
  }
}

// 重新开始
async function handleRestart() {
  try {
    errorMessage.value = ''

    // 离开当前房间
    if (gameStore.gameId) {
      socketStore.leave(gameStore.gameId)
      socketStore.unsubscribe(gameStore.gameId)
    }

    // 重置游戏状态
    gameStore.reset()

    // 重新初始化
    await initGame()
  } catch (error) {
    console.error('重新开始错误:', error)
    errorMessage.value = error.message || '重新开始失败，请重试'
  }
}

// 返回首页
function goHome() {
  router.push('/')
}

onMounted(() => {
  initGame()
})

onUnmounted(() => {
  // 清理资源
  if (gameStore.gameId) {
    socketStore.leave(gameStore.gameId)
    socketStore.unsubscribe(gameStore.gameId)
  }
})
</script>

<style scoped src="./GamePage.scss"></style>
