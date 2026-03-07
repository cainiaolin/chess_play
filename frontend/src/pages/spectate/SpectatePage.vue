<template>
  <div class="spectate-page">
    <header class="header">
      <a href="/" class="back-btn">← 返回</a>
      <h1>观战模式</h1>
    </header>

    <div class="spectate-content">
      <!-- 游戏列表 -->
      <div v-if="!selectedGameId" class="game-list-section">
        <div class="list-header">
          <h2>对局列表</h2>
          <button class="btn btn-secondary" @click="loadGames">刷新</button>
        </div>

        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="games.length === 0" class="empty">
          <p>暂无进行中的对局</p>
        </div>
        <div v-else class="games-grid">
          <div
            v-for="game in games"
            :key="game.id"
            class="game-card"
            @click="selectGame(game.id)"
          >
            <div class="game-header">
              <span class="game-id">#{{ game.id.slice(-6) }}</span>
              <span class="game-status" :class="game.status">
                {{ statusText(game.status) }}
              </span>
            </div>
            <div class="game-info">
              <span>回合: {{ game.turn === 'red' ? '红方' : '黑方' }}</span>
              <span>步数: {{ game.moves?.length || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 观战界面 -->
      <div v-else class="spectate-section">
        <div class="spectate-header">
          <button class="btn btn-secondary" @click="backToList">← 返回列表</button>
          <span class="game-id">对局 #{{ selectedGameId.slice(-6) }}</span>
        </div>

        <div class="status-bar">
          <span class="turn" :class="currentTurn">{{ turnText }}</span>
          <span class="move-count">第 {{ moveCount }} 步</span>
        </div>

        <div v-if="loadingGame" class="loading">加载中...</div>
        <ChessBoard
          v-else
          :board="boardData"
          :readonly="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ChessBoard from '../../components/ChessBoard/ChessBoard.vue'
import { gameApi } from '../../utils/api'

const games = ref([])
const loading = ref(false)
const selectedGameId = ref(null)
const loadingGame = ref(false)
const gameState = ref(null)

// 计算属性
const boardData = computed(() => gameState.value?.board || [])
const currentTurn = computed(() => gameState.value?.turn || 'red')
const moveCount = computed(() => gameState.value?.moves?.length || 0)
const turnText = computed(() => currentTurn.value === 'red' ? '红方' : '黑方')

// 加载游戏列表
async function loadGames() {
  loading.value = true
  try {
    const result = await gameApi.list()
    if (result.success) {
      games.value = result.data || []
    }
  } catch (error) {
    console.error('加载游戏列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 选择游戏观战
async function selectGame(gameId) {
  selectedGameId.value = gameId
  loadingGame.value = true
  try {
    const result = await gameApi.get(gameId)
    if (result.success) {
      gameState.value = result.data
    }
  } catch (error) {
    console.error('加载游戏失败:', error)
  } finally {
    loadingGame.value = false
  }
}

// 返回列表
function backToList() {
  selectedGameId.value = null
  gameState.value = null
}

function statusText(status) {
  const map = {
    playing: '对弈中',
    red_win: '红胜',
    black_win: '黑胜',
    draw: '和棋'
  }
  return map[status] || status
}

onMounted(() => {
  loadGames()
})
</script>

<style scoped>
.spectate-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.1);
}

.back-btn {
  color: #fff;
  text-decoration: none;
  margin-right: 16px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.header h1 {
  margin: 0;
  font-size: 20px;
}

.spectate-content {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-header h2 {
  margin: 0;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #aaa;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.game-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.game-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.game-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.game-id {
  font-weight: bold;
}

.game-status.playing {
  color: #4caf50;
}

.game-info {
  display: flex;
  gap: 16px;
  color: #aaa;
  font-size: 14px;
}

.spectate-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.spectate-header .game-id {
  color: #aaa;
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
</style>
