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
  turn: { type: String, default: 'red' },
  status: { type: String, default: 'playing' },
  moveCount: { type: Number, default: undefined }
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
  const turnMap = { red: '红方', black: '黑方' }
  return turnMap[props.turn] || props.turn
})

const turnClass = computed(() => {
  return props.turn === 'red' ? 'red-turn' : 'black-turn'
})
</script>

<style scoped src="./GameStatus.scss"></style>
