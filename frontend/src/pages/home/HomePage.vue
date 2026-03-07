<template>
  <div class="home-page">
    <header class="header">
      <h1 class="title">中国象棋对决</h1>
      <p class="subtitle">经典对弈 · 智能AI · 实时观战</p>
    </header>

    <main class="main-content">
      <div class="action-buttons">
        <button class="btn btn-primary btn-large" @click="startGame">
          <span class="icon">♟</span>
          <span>开始对弈</span>
        </button>

        <button class="btn btn-secondary btn-large" @click="goSpectate">
          <span class="icon">👁</span>
          <span>观战模式</span>
        </button>

        <button class="btn btn-outline btn-large" @click="goSettings">
          <span class="icon">⚙</span>
          <span>游戏设置</span>
        </button>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '../../stores/config'

const router = useRouter()
const configStore = useConfigStore()

const aiModelText = computed(() => {
  const modelMap = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    local: '本地模型'
  }
  return modelMap[configStore.aiModel] || configStore.aiModel
})

const serverUrlText = computed(() => {
  const url = configStore.serverUrl
  if (url.includes('localhost')) {
    return '本地服务器'
  }
  return url.replace(/^https?:\/\//, '').split('/')[0]
})

function startGame() {
  router.push('/game.html')
}

function goSpectate() {
  router.push('/spectate.html')
}

function goSettings() {
  router.push('/settings.html')
}

onMounted(() => {
  configStore.loadConfig()
})
</script>

<style scoped src="./HomePage.scss"></style>
