<template>
  <div class="spectate-page">
    <header class="header">
      <button class="back-btn" @click="goBack">
        <span>← 返回</span>
      </button>
      <h1>观战模式</h1>
    </header>

    <main class="main-content">
      <!-- 游戏列表 -->
      <div v-if="!selectedGameId" class="game-list-section">
        <GameList
          :games="games"
          :loading="loading"
          @refresh="loadGames"
          @select-game="selectGame"
        />
      </div>

      <!-- 观战界面 -->
      <div v-else class="spectate-section">
        <div class="spectate-header">
          <button class="btn btn-outline" @click="backToList">
            <span>← 返回列表</span>
          </button>
          <div class="game-info">
            <span class="game-id">对局 #{{ selectedGameId.slice(-6) }}</span>
          </div>
        </div>

        <GameStatus
          :turn="gameStore.currentTurn"
          :status="gameStore.gameStatus"
          :move-count="moveCount"
        />

        <ChessBoard
          :board="board"
          :readonly="true"
          :selected-piece="null"
          :valid-moves="[]"
          :last-move="gameStore.lastMove"
        />

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import ChessBoard from '../../components/ChessBoard/ChessBoard.vue'
import GameStatus from '../../components/GameStatus/GameStatus.vue'
import GameList from '../../components/GameList/GameList.vue'
import { useGameStore } from '../../stores/game'
import { useConfigStore } from '../../stores/config'
import { useSocketStore } from '../../stores/socket'
import { gameApi } from '../../utils/api'

const router = useRouter()
const gameStore = useGameStore()
const configStore = useConfigStore()
const socketStore = useSocketStore()

const games = ref([])
const loading = ref(false)
const selectedGameId = ref(null)
const errorMessage = ref('')

// 计算棋盘数据
const board = computed(() => {
  return gameStore.gameState?.board || []
})

const moveCount = computed(() => {
  return gameStore.gameState?.moves?.length || 0
})

// 加载游戏列表
async function loadGames() {
  try {
    loading.value = true
    errorMessage.value = ''

    const result = await gameApi.list()

    if (result.success) {
      games.value = result.data.games || []
    } else {
      throw new Error(result.message || '加载游戏列表失败')
    }
  } catch (error) {
    console.error('加载游戏列表失败:', error)
    errorMessage.value = error.message || '加载游戏列表失败，请重试'
  } finally {
    loading.value = false
  }
}

// 选择游戏观战
async function selectGame(gameId) {
  try {
    errorMessage.value = ''
    selectedGameId.value = gameId

    // 加载游戏状态
    const result = await gameStore.loadGame(gameId)

    if (!result.success) {
      throw new Error(result.message || '加载游戏失败')
    }

    // 连接 Socket
    if (!socketStore.isConnected) {
      socketStore.connect(configStore.serverUrl)
    }

    // 订阅游戏更新
    socketStore.subscribe(gameId, handleGameStateUpdate)
  } catch (error) {
    console.error('选择游戏失败:', error)
    errorMessage.value = error.message || '加载游戏失败，请重试'
    selectedGameId.value = null
  }
}

// 处理游戏状态更新
function handleGameStateUpdate(newState) {
  gameStore.updateGameState(newState)
}

// 返回列表
function backToList() {
  // 取消订阅
  if (selectedGameId.value) {
    socketStore.unsubscribe(selectedGameId.value)
  }

  // 重置状态
  selectedGameId.value = null
  gameStore.reset()
  errorMessage.value = ''

  // 重新加载列表
  loadGames()
}

function goBack() {
  router.push('/')
}

onMounted(() => {
  configStore.loadConfig()
  loadGames()
})

onUnmounted(() => {
  // 清理资源
  if (selectedGameId.value) {
    socketStore.unsubscribe(selectedGameId.value)
  }
})
</script>

<style scoped src="./SpectatePage.scss"></style>
