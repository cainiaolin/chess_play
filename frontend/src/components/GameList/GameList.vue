<template>
  <div class="game-list">
    <div class="list-header">
      <h3>对局列表</h3>
      <button class="refresh-btn" @click="$emit('refresh')">
        <span>🔄</span>
        <span>刷新</span>
      </button>
    </div>

    <div v-if="loading" class="loading">
      加载中...
    </div>

    <div v-else-if="games.length === 0" class="empty">
      <p>暂无对局</p>
      <button class="btn btn-primary" @click="$emit('refresh')">
        刷新列表
      </button>
    </div>

    <div v-else class="games-grid">
      <div
        v-for="game in games"
        :key="game.id"
        class="game-card"
        @click="$emit('select-game', game.id)"
      >
        <div class="game-header">
          <span class="game-id">#{{ game.id.slice(-6) }}</span>
          <span class="game-status" :class="statusClass(game.status)">
            {{ statusText(game.status) }}
          </span>
        </div>

        <div class="game-info">
          <div class="info-row">
            <span class="label">回合:</span>
            <span class="value">{{ game.turn === 'red' ? '红方' : '黑方' }}</span>
          </div>
          <div class="info-row">
            <span class="label">步数:</span>
            <span class="value">{{ game.moves?.length || 0 }}</span>
          </div>
          <div class="info-row">
            <span class="label">模式:</span>
            <span class="value">{{ game.mode || 'AI 对战' }}</span>
          </div>
        </div>

        <div class="game-footer">
          <span class="spectate-hint">点击观战</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  games: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['refresh', 'select-game'])

function statusText(status) {
  const statusMap = {
    playing: '对弈中',
    red_win: '红胜',
    black_win: '黑胜',
    draw: '和棋',
    ready: '准备'
  }
  return statusMap[status] || status
}

function statusClass(status) {
  if (status === 'playing') return 'status-playing'
  if (status === 'red_win') return 'status-red-win'
  if (status === 'black_win') return 'status-black-win'
  if (status === 'draw') return 'status-draw'
  return ''
}
</script>

<style scoped src="./GameList.scss"></style>
