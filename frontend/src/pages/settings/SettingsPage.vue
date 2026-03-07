<template>
  <div class="settings-page">
    <header class="header">
      <button class="back-btn" @click="goBack">
        <span>← 返回</span>
      </button>
      <h1>游戏设置</h1>
    </header>

    <main class="main-content">
      <form @submit.prevent="handleSave" class="settings-form">
        <!-- AI 模型设置 -->
        <div class="form-section">
          <h2>AI 模型</h2>
          <div class="form-group">
            <label for="aiModel">AI 模型选择</label>
            <select
              id="aiModel"
              v-model="localConfig.aiModel"
              class="form-control"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="local">本地模型</option>
            </select>
            <small class="form-text">选择用于对弈的 AI 模型</small>
          </div>

          <div class="form-group">
            <label for="difficulty">难度等级</label>
            <div class="difficulty-selector">
              <button
                v-for="level in difficultyLevels"
                :key="level.value"
                type="button"
                class="difficulty-btn"
                :class="{ active: localConfig.difficulty === level.value }"
                @click="localConfig.difficulty = level.value"
              >
                {{ level.label }}
              </button>
            </div>
            <small class="form-text">AI 的思考深度（1-5级）</small>
          </div>
        </div>

        <!-- 服务器设置 -->
        <div class="form-section">
          <h2>服务器配置</h2>
          <div class="form-group">
            <label for="serverUrl">服务器地址</label>
            <input
              id="serverUrl"
              v-model="localConfig.serverUrl"
              type="url"
              class="form-control"
              placeholder="http://localhost:3001"
            />
            <small class="form-text">游戏服务器的 URL 地址</small>
          </div>
        </div>

        <!-- 游戏体验设置 -->
        <div class="form-section">
          <h2>游戏体验</h2>
          <div class="form-group">
            <div class="checkbox-group">
              <input
                id="enableSound"
                v-model="localConfig.enableSound"
                type="checkbox"
                class="form-checkbox"
              />
              <label for="enableSound">启用音效</label>
            </div>
            <small class="form-text">走棋和游戏事件时播放音效</small>
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input
                id="enableVibration"
                v-model="localConfig.enableVibration"
                type="checkbox"
                class="form-checkbox"
              />
              <label for="enableVibration">启用震动</label>
            </div>
            <small class="form-text">移动设备上的震动反馈</small>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            保存设置
          </button>
          <button type="button" class="btn btn-secondary" @click="handleReset">
            恢复默认
          </button>
        </div>
      </form>

      <!-- 保存成功提示 -->
      <div v-if="saveSuccess" class="success-message">
        ✓ 设置已保存
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '../../stores/config'

const router = useRouter()
const configStore = useConfigStore()

const saveSuccess = ref(false)
const localConfig = reactive({
  serverUrl: '',
  aiModel: '',
  difficulty: 3,
  enableSound: true,
  enableVibration: true
})

const difficultyLevels = [
  { value: 1, label: '简单' },
  { value: 2, label: '较易' },
  { value: 3, label: '中等' },
  { value: 4, label: '较难' },
  { value: 5, label: '困难' }
]

function goBack() {
  router.push('/')
}

function handleSave() {
  // 保存配置到 store
  configStore.updateConfig(localConfig)

  // 显示成功提示
  saveSuccess.value = true
  setTimeout(() => {
    saveSuccess.value = false
  }, 2000)
}

function handleReset() {
  // 恢复默认配置
  localConfig.serverUrl = 'http://localhost:3001'
  localConfig.aiModel = 'deepseek'
  localConfig.difficulty = 3
  localConfig.enableSound = true
  localConfig.enableVibration = true

  // 保存默认配置
  handleSave()
}

onMounted(() => {
  // 加载当前配置
  configStore.loadConfig()
  localConfig.serverUrl = configStore.serverUrl
  localConfig.aiModel = configStore.aiModel
  localConfig.difficulty = configStore.difficulty
  localConfig.enableSound = configStore.enableSound
  localConfig.enableVibration = configStore.enableVibration
})
</script>

<style scoped src="./SettingsPage.scss"></style>
