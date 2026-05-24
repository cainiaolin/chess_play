<template>
  <div class="settings-page">
    <header class="header">
      <a href="/" class="back-btn">← 返回</a>
      <h1>游戏设置</h1>
    </header>

    <main class="main-content">
      <!-- 对局模式 -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="title-icon">🎯</span>
          对局模式
        </h2>
        <div class="difficulty-selector mode-selector">
          <button
            type="button"
            class="difficulty-btn"
            :class="{ active: config.gameMode === 'human_vs_ai' }"
            @click="setGameMode('human_vs_ai')"
          >
            人机对战
          </button>
          <button
            type="button"
            class="difficulty-btn"
            :class="{ active: config.gameMode === 'ai_vs_ai' }"
            @click="setGameMode('ai_vs_ai')"
          >
            AI 观战
          </button>
        </div>
        <p v-if="config.gameMode === 'ai_vs_ai'" class="mode-hint">
          红方与黑方均使用下方配置的 AI 模型自动走棋，适合对比不同模型或旁观棋局。
        </p>
        <div v-else class="form-field" style="margin-top: 12px;">
          <label>我执棋方</label>
          <select v-model="config.humanSide" class="form-select" @change="config.saveConfig()">
            <option value="red">红方（棋盘下方，传统先手）</option>
            <option value="black">黑方</option>
          </select>
          <small>先手仍由「计时设置」中的先手选择决定；若先手为 AI，开局会自动走棋。</small>
        </div>
      </section>

      <!-- AI 模型配置 -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="title-icon">🤖</span>
          AI 模型配置
        </h2>

        <!-- 玩家配置选择 -->
        <div class="player-config-selector">
          <button
            class="player-tab"
            :class="{ active: selectedPlayer === 'red' }"
            @click="selectedPlayer = 'red'"
          >
            <span class="player-icon red">红</span>
            红方配置
          </button>
          <button
            class="player-tab"
            :class="{ active: selectedPlayer === 'black' }"
            @click="selectedPlayer = 'black'"
          >
            <span class="player-icon black">黑</span>
            黑方配置
          </button>
        </div>

        <!-- AI 模型卡片列表 -->
        <div class="ai-models-list">
          <!-- 预设模型 -->
          <div
            v-for="model in presetModels"
            :key="selectedPlayer + '-' + model.id"
            class="ai-model-card"
            :class="{
              'is-selected': isModelSelected(model.id),
              'is-enabled': isModelEnabled(model.id)
            }"
          >
            <div class="model-header">
              <div class="model-info">
                <h3 class="model-name">{{ model.name }}</h3>
                <span class="model-badge preset-badge">预设</span>
              </div>
              <label class="switch-toggle">
                <input
                  type="checkbox"
                  :checked="isModelSelected(model.id)"
                  @change="selectModel(model.id)"
                >
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="model-body" v-if="isModelSelected(model.id)">
              <div class="form-field">
                <label>API 地址</label>
                <input
                  type="text"
                  :value="model.baseUrl"
                  readonly
                  class="form-input readonly"
                >
              </div>
              <div class="form-field">
                <label>API Key</label>
                <input
                  type="password"
                  :value="getApiKey(model.id)"
                  placeholder="sk-..."
                  class="form-input"
                  @input="saveApiKey(model.id, $event)"
                >
              </div>
              <div class="form-field">
                <label>思考超时（秒）</label>
                <input
                  type="number"
                  :value="getModelTimeout(model.id)"
                  min="5"
                  max="120"
                  class="form-input"
                  @input="saveModelTimeout(model.id, $event)"
                >
                <small>超时后自动判负</small>
              </div>
              <div class="form-field" v-if="selectedPlayer === 'black'">
                <label>提示词（系统指令）</label>
                <textarea
                  :value="getSystemPrompt(model.id)"
                  class="form-textarea"
                  rows="4"
                  @input="saveSystemPrompt(model.id, $event)"
                  placeholder="自定义系统提示词..."
                ></textarea>
              </div>
            </div>
          </div>

          <!-- 自定义模型 -->
          <div
            v-for="model in customModels"
            :key="selectedPlayer + '-' + model.id"
            class="ai-model-card custom-model"
            :class="{ 'is-selected': isModelSelected(model.id) }"
          >
            <div class="model-header">
              <div class="model-info">
                <h3 class="model-name">{{ model.name }}</h3>
                <span class="model-badge custom-badge">自定义</span>
              </div>
              <div class="model-actions">
                <button
                  class="btn-icon btn-delete"
                  @click="confirmDelete(model)"
                  title="删除模型"
                >
                  ✕
                </button>
                <label class="switch-toggle">
                  <input
                    type="checkbox"
                    :checked="isModelSelected(model.id)"
                    @change="selectModel(model.id)"
                  >
                  <span class="switch-slider"></span>
                </label>
              </div>
            </div>

            <div class="model-body" v-if="isModelSelected(model.id)">
              <div class="form-field">
                <label>API 地址</label>
                <input
                  type="text"
                  :value="model.baseUrl"
                  class="form-input"
                  @input="updateCustomModel(model.id, 'baseUrl', $event)"
                >
              </div>
              <div class="form-field">
                <label>API Key / Token</label>
                <input
                  type="password"
                  :value="getApiKey(model.id)"
                  placeholder="sk-... 或 token"
                  class="form-input"
                  @input="saveApiKey(model.id, $event)"
                >
              </div>
              <div class="form-field">
                <label>思考超时（秒）</label>
                <input
                  type="number"
                  :value="getModelTimeout(model.id)"
                  min="5"
                  max="120"
                  class="form-input"
                  @input="saveModelTimeout(model.id, $event)"
                >
                <small>超时后自动判负</small>
              </div>
              <!-- 自定义请求头 -->
              <div class="form-field">
                <label>自定义请求头（JSON格式）</label>
                <textarea
                  :value="getCustomHeaders(model.id)"
                  class="form-textarea"
                  rows="3"
                  @input="saveCustomHeaders(model.id, $event)"
                  placeholder='{"X-Custom-Header": "value"}'
                ></textarea>
              </div>
              <!-- 自定义请求体模板 -->
              <div class="form-field">
                <label>自定义请求体模板（JSON格式）</label>
                <textarea
                  :value="getRequestBodyTemplate(model.id)"
                  class="form-textarea"
                  rows="6"
                  @input="saveRequestBodyTemplate(model.id, $event)"
                  placeholder='自定义请求体，使用 {{board}}, {{role}}, {{history}} 作为占位符'
                ></textarea>
              </div>
              <div class="form-field">
                <label>提示词（系统指令）</label>
                <textarea
                  :value="getSystemPrompt(model.id)"
                  class="form-textarea"
                  rows="4"
                  @input="saveSystemPrompt(model.id, $event)"
                  placeholder="自定义系统提示词..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- 添加自定义模型按钮 -->
        <button class="btn-add-model" @click="showAddModel = true">
          <span class="add-icon">+</span>
          添加自定义 AI 模型
        </button>
      </section>

      <!-- 难度设置 -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="title-icon">⚡</span>
          AI 难度等级
        </h2>
        <div class="difficulty-selector">
          <button
            v-for="level in difficultyLevels"
            :key="level.value"
            type="button"
            class="difficulty-btn"
            :class="{ active: config.difficulty === level.value }"
            @click="config.difficulty = level.value; saveConfig()"
          >
            {{ level.label }}
          </button>
        </div>
      </section>

      <!-- 服务器配置 -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="title-icon">🌐</span>
          服务器配置
        </h2>
        <div class="form-field">
          <label>服务器地址</label>
          <input
            type="url"
            v-model="config.serverUrl"
            class="form-input"
            @blur="saveConfig()"
          >
        </div>
      </section>

      <!-- 游戏体验 -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="title-icon">🎮</span>
          游戏体验
        </h2>
        <div class="toggles-list">
          <div class="toggle-item">
            <div class="toggle-info">
              <span class="toggle-label">启用音效</span>
              <span class="toggle-desc">走棋和游戏事件时播放音效</span>
            </div>
            <label class="switch-toggle">
              <input
                type="checkbox"
                v-model="config.enableSound"
                @change="config.saveConfig()"
              >
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-info">
              <span class="toggle-label">启用震动</span>
              <span class="toggle-desc">移动设备上的震动反馈</span>
            </div>
            <label class="switch-toggle">
              <input
                type="checkbox"
                v-model="config.enableVibration"
                @change="config.saveConfig()"
              >
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-info">
              <span class="toggle-label">允许悔棋</span>
              <span class="toggle-desc">开启后玩家可以悔棋</span>
            </div>
            <label class="switch-toggle">
              <input
                type="checkbox"
                v-model="config.allowUndo"
                @change="config.saveConfig()"
              >
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-info">
              <span class="toggle-label">非法走子自动判负</span>
              <span class="toggle-desc">非法走子时直接判负</span>
            </div>
            <label class="switch-toggle">
              <input
                type="checkbox"
                v-model="config.autoForfeit"
                @change="config.saveConfig()"
              >
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="toggle-item">
            <div class="toggle-info">
              <span class="toggle-label">AI 走法非法时重试</span>
              <span class="toggle-desc">AI 返回非法走法时自动重试（最多 3 次），关闭则跳过该回合</span>
            </div>
            <label class="switch-toggle">
              <input
                type="checkbox"
                v-model="config.aiRetryOnError"
                @change="config.saveConfig()"
              >
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- 计时设置 -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="title-icon">⏱️</span>
          计时设置
        </h2>
        <div class="form-field">
          <label>计时模式</label>
          <select v-model="config.timerMode" @change="config.saveConfig()" class="form-select">
            <option value="per_move">单步限时</option>
            <option value="total_time">总对局限时</option>
          </select>
        </div>

        <div v-if="config.timerMode === 'per_move'" class="form-field">
          <label>单步限时（秒）</label>
          <input
            type="number"
            v-model.number="config.moveTimeLimit"
            min="5"
            max="120"
            @blur="config.saveConfig()"
            class="form-input"
          >
          <small>范围：5-120秒</small>
        </div>

        <div v-if="config.timerMode === 'total_time'" class="form-row">
          <div class="form-field">
            <label>红方时限（分钟）</label>
            <input
              type="number"
              v-model.number="config.redTimeLimit"
              min="1"
              max="30"
              @blur="config.saveConfig(); config.redTimeLimit *= 60"
              class="form-input"
            >
          </div>
          <div class="form-field">
            <label>黑方时限（分钟）</label>
            <input
              type="number"
              v-model.number="config.blackTimeLimit"
              min="1"
              max="30"
              @blur="config.saveConfig(); config.blackTimeLimit *= 60"
              class="form-input"
            >
          </div>
        </div>

        <div class="form-field">
          <label>AI思考间隔（秒）</label>
          <input
            type="number"
            v-model.number="config.aiThinkDelay"
            min="0.5"
            max="3"
            step="0.1"
            @blur="config.saveConfig(); config.aiThinkDelay *= 1000"
            class="form-input"
          >
          <small>范围：0.5-3秒</small>
        </div>

        <div class="form-field">
          <label>先手选择</label>
          <select v-model="config.firstPlayer" @change="config.saveConfig()" class="form-select">
            <option value="red">红方先手</option>
            <option value="black">黑方先手</option>
            <option value="random">随机</option>
          </select>
        </div>
      </section>

      <!-- 主题设置 -->
      <section class="settings-section">
        <h2 class="section-title">
          <span class="title-icon">🎨</span>
          主题设置
        </h2>
        <div class="theme-selector">
          <button
            class="theme-btn light-theme"
            :class="{ active: !isDarkTheme }"
            @click="setTheme('light')"
          >
            <span class="theme-preview"></span>
            浅色主题
          </button>
          <button
            class="theme-btn dark-theme"
            :class="{ active: isDarkTheme }"
            @click="setTheme('dark')"
          >
            <span class="theme-preview"></span>
            深色主题
          </button>
        </div>
      </section>

      <!-- 操作按钮 -->
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" @click="handleReset">
          恢复默认设置
        </button>
      </div>
    </main>

    <!-- 添加模型弹窗 -->
    <div v-if="showAddModel" class="modal-overlay" @click.self="showAddModel = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>添加自定义 AI 模型</h3>
          <button class="btn-close" @click="showAddModel = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>模型名称</label>
            <input
              type="text"
              v-model="newModel.name"
              placeholder="例如: Claude、Gemini 等"
              class="form-input"
            >
          </div>
          <div class="form-field">
            <label>API 地址</label>
            <input
              type="url"
              v-model="newModel.baseUrl"
              placeholder="https://api.example.com/v1"
              class="form-input"
            >
          </div>
          <div class="form-field">
            <label>API Key / Token</label>
            <input
              type="password"
              v-model="newModel.apiKey"
              placeholder="sk-... 或 Bearer token"
              class="form-input"
            >
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="showAddModel = false">
              取消
            </button>
            <button type="button" class="btn btn-primary" @click="addModel">
              添加
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 确认删除弹窗 -->
    <div v-if="modelToDelete" class="modal-overlay" @click.self="modelToDelete = null">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <h3>确认删除</h3>
        </div>
        <div class="modal-body">
          <p>确定要删除 AI 模型 "{{ modelToDelete.name }}" 吗？</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="modelToDelete = null">
              取消
            </button>
            <button type="button" class="btn btn-danger" @click="deleteModel">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存成功提示 -->
    <div v-if="saveSuccess" class="toast toast-success">
      ✓ 设置已保存
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()
const config = configStore

function setGameMode(mode) {
  config.gameMode = mode
  config.saveConfig()
}

// 当前选择的玩家（红方/黑方）
const selectedPlayer = ref('red')

// 主题设置
const isDarkTheme = ref(localStorage.getItem('chess_theme') === 'dark')

const saveSuccess = ref(false)
const showAddModel = ref(false)
const modelToDelete = ref(null)

// 设置主题
function setTheme(theme) {
  isDarkTheme.value = theme === 'dark'
  localStorage.setItem('chess_theme', theme)
  document.documentElement.classList.toggle('dark-theme', theme === 'dark')
}

const newModel = reactive({
  name: '',
  baseUrl: '',
  apiKey: ''
})

const difficultyLevels = [
  { value: 1, label: '简单' },
  { value: 2, label: '较易' },
  { value: 3, label: '中等' },
  { value: 4, label: '较难' },
  { value: 5, label: '困难' }
]

// 预设模型
const presetModels = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: ''
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: ''
  },
  {
    id: 'ollama',
    name: 'Ollama 本地',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: ''
  }
]

// 自定义模型
const customModels = computed(() => config.customAIModels || [])

// 获取当前玩家的模型ID
const currentPlayerModelId = computed(() => {
  return selectedPlayer.value === 'red'
    ? (config.redAiModel || 'deepseek')
    : (config.blackAiModel || 'deepseek')
})

// 检查模型是否被当前玩家选中
function isModelSelected(modelId) {
  return currentPlayerModelId.value === modelId
}

function isModelEnabled(modelId) {
  return true // 预设模型默认启用
}

function selectModel(modelId) {
  // 为当前玩家设置模型
  if (selectedPlayer.value === 'red') {
    config.redAiModel = modelId
  } else {
    config.blackAiModel = modelId
  }
  config.saveConfig()
}

// 获取API Key
function getApiKey(modelId) {
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  return localStorage.getItem(`ai_key_${playerPrefix}_${modelId}`) || ''
}

// 保存API Key
function saveApiKey(modelId, event) {
  const apiKey = event.target.value
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  localStorage.setItem(`ai_key_${playerPrefix}_${modelId}`, apiKey)
}

// 获取模型超时设置
function getModelTimeout(modelId) {
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  const timeout = localStorage.getItem(`ai_timeout_${playerPrefix}_${modelId}`)
  return timeout ? parseInt(timeout) : 60
}

// 保存模型超时设置
function saveModelTimeout(modelId, event) {
  const timeout = parseInt(event.target.value) || 60
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  localStorage.setItem(`ai_timeout_${playerPrefix}_${modelId}`, timeout.toString())
}

// 获取自定义请求头
function getCustomHeaders(modelId) {
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  return localStorage.getItem(`ai_headers_${playerPrefix}_${modelId}`) || ''
}

// 保存自定义请求头
function saveCustomHeaders(modelId, event) {
  const headers = event.target.value
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  localStorage.setItem(`ai_headers_${playerPrefix}_${modelId}`, headers)
}

// 获取请求体模板
function getRequestBodyTemplate(modelId) {
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  return localStorage.getItem(`ai_body_template_${playerPrefix}_${modelId}`) || ''
}

// 保存请求体模板
function saveRequestBodyTemplate(modelId, event) {
  const template = event.target.value
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  localStorage.setItem(`ai_body_template_${playerPrefix}_${modelId}`, template)
}

// 获取系统提示词
function getSystemPrompt(modelId) {
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  return localStorage.getItem(`ai_prompt_${playerPrefix}_${modelId}`) || ''
}

// 保存系统提示词
function saveSystemPrompt(modelId, event) {
  const prompt = event.target.value
  const playerPrefix = selectedPlayer.value === 'red' ? 'red' : 'black'
  localStorage.setItem(`ai_prompt_${playerPrefix}_${modelId}`, prompt)
}

function updateCustomModel(modelId, field, event) {
  const value = event.target.value
  config.updateCustomAIModel(modelId, { [field]: value })
}

function addModel() {
  if (!newModel.name || !newModel.baseUrl) {
    alert('请填写模型名称和 API 地址')
    return
  }

  config.addCustomAIModel({
    name: newModel.name,
    baseUrl: newModel.baseUrl,
    apiKey: newModel.apiKey
  })

  // 重置表单
  newModel.name = ''
  newModel.baseUrl = ''
  newModel.apiKey = ''

  showAddModel.value = false
  showSuccessToast()
}

function confirmDelete(model) {
  modelToDelete.value = model
}

function deleteModel() {
  if (modelToDelete.value) {
    config.deleteCustomAIModel(modelToDelete.value.id)
    modelToDelete.value = null
    showSuccessToast()
  }
}

function saveConfig() {
  config.saveConfig()
  showSuccessToast()
}

function handleReset() {
  if (confirm('确定要恢复默认设置吗？')) {
    localStorage.removeItem('chess_game_config')
    localStorage.removeItem('ai_key_deepseek')
    localStorage.removeItem('ai_key_openai')
    localStorage.removeItem('ai_key_ollama')
    config.loadConfig()
    showSuccessToast()
  }
}

function showSuccessToast() {
  saveSuccess.value = true
  setTimeout(() => {
    saveSuccess.value = false
  }, 2000)
}

onMounted(() => {
  config.loadConfig()

  // 加载保存的 API Key
  presetModels.forEach(model => {
    const savedKey = localStorage.getItem(`ai_key_${model.id}`)
    if (savedKey) model.apiKey = savedKey
  })
})
</script>

<style scoped src="./SettingsPage.scss"></style>
