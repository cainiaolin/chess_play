<template>
  <div class="home-page">
    <header class="header">
      <h1 class="title">中国象棋对决</h1>
      <p class="subtitle">经典对弈 · 智能AI · 实时观战</p>
    </header>

    <main class="main-content">
      <div class="action-buttons">
        <a href="/game.html" class="btn btn-primary btn-large">
          <span class="icon">♟</span>
          <span>开始对弈</span>
        </a>

        <a href="/spectate.html" class="btn btn-secondary btn-large">
          <span class="icon">👁</span>
          <span>观战模式</span>
        </a>

        <a href="/settings.html" class="btn btn-outline btn-large">
          <span class="icon">⚙</span>
          <span>游戏设置</span>
        </a>
      </div>

      <div class="info-section">
        <div class="info-card">
          <h3>游戏特色</h3>
          <ul>
            <li>智能 AI 对手</li>
            <li>多种难度选择</li>
            <li>实时悔棋功能</li>
            <li>走棋提示辅助</li>
          </ul>
        </div>

        <div class="info-card">
          <h3>当前配置</h3>
          <div class="config-info">
            <div class="config-item">
              <span class="label">对局模式:</span>
              <span class="value">{{ gameModeText }}</span>
            </div>
            <div class="config-item">
              <span class="label">AI 模型:</span>
              <span class="value">{{ aiModelText }}</span>
            </div>
            <div class="config-item">
              <span class="label">难度等级:</span>
              <span class="value">{{ configStore.difficulty }}</span>
            </div>
            <div class="config-item">
              <span class="label">服务器:</span>
              <span class="value">{{ serverUrlText }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="footer">
      <p>&copy; 2025 中国象棋对决 - 经典棋类游戏</p>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()

const gameModeText = computed(() => {
  if (configStore.gameMode === 'ai_vs_ai') return 'AI 观战（双 AI）'
  return configStore.humanSide === 'black' ? '人机 · 执黑' : '人机 · 执红'
})

const aiModelText = computed(() => {
  const modelMap = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    ollama: 'Ollama',
    local: '本地模型'
  }
  const r = modelMap[configStore.redAiModel] || configStore.redAiModel
  const b = modelMap[configStore.blackAiModel] || configStore.blackAiModel
  if (r === b) return r
  return `红 ${r} / 黑 ${b}`
})

const serverUrlText = computed(() => {
  const url = configStore.serverUrl
  if (url.includes('localhost')) {
    return '本地服务器'
  }
  return url.replace(/^https?:\/\//, '').split('/')[0]
})

onMounted(() => {
  configStore.loadConfig()
})
</script>

<style scoped src="./HomePage.scss"></style>
