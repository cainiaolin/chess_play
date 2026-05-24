import { defineStore } from 'pinia'
import { ref } from 'vue'

const CONFIG_KEY = 'chess_game_config'

// 预设的 AI 模型
const presetAIModels = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    enabled: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    enabled: false
  },
  {
    id: 'ollama',
    name: 'Ollama 本地',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    enabled: false
  }
]

const defaultConfig = {
  serverUrl: 'http://localhost:3001',
  /** human_vs_ai: 人机；ai_vs_ai: 双方 AI 自动对弈（观战） */
  gameMode: 'human_vs_ai',
  /** 人机模式下玩家执子颜色 */
  humanSide: 'red',
  aiModel: 'deepseek',
  redAiModel: 'deepseek',
  blackAiModel: 'deepseek',
  difficulty: 3,
  enableSound: true,
  enableVibration: true,
  customAIModels: [],
  // 计时模式配置
  timerMode: 'per_move',
  moveTimeLimit: 60,
  redTimeLimit: 600,
  blackTimeLimit: 600,
  firstPlayer: 'red',
  allowUndo: true,
  autoForfeit: true,
  aiRetryOnError: true,
  aiThinkDelay: 1000
}

export const useConfigStore = defineStore('config', () => {
  const serverUrl = ref(defaultConfig.serverUrl)
  const gameMode = ref(defaultConfig.gameMode)
  const humanSide = ref(defaultConfig.humanSide)
  const aiModel = ref(defaultConfig.aiModel)
  const redAiModel = ref(defaultConfig.redAiModel)
  const blackAiModel = ref(defaultConfig.blackAiModel)
  const difficulty = ref(defaultConfig.difficulty)
  const enableSound = ref(defaultConfig.enableSound)
  const enableVibration = ref(defaultConfig.enableVibration)
  const customAIModels = ref([])
  // 计时器配置
  const timerMode = ref(defaultConfig.timerMode)
  const moveTimeLimit = ref(defaultConfig.moveTimeLimit)
  const redTimeLimit = ref(defaultConfig.redTimeLimit)
  const blackTimeLimit = ref(defaultConfig.blackTimeLimit)
  const firstPlayer = ref(defaultConfig.firstPlayer)
  const allowUndo = ref(defaultConfig.allowUndo)
  const autoForfeit = ref(defaultConfig.autoForfeit)
  const aiRetryOnError = ref(defaultConfig.aiRetryOnError)
  const aiThinkDelay = ref(defaultConfig.aiThinkDelay)

  function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) {
      const config = JSON.parse(saved)
      serverUrl.value = config.serverUrl || defaultConfig.serverUrl
      gameMode.value = config.gameMode || defaultConfig.gameMode
      humanSide.value = config.humanSide || defaultConfig.humanSide
      aiModel.value = config.aiModel || defaultConfig.aiModel
      redAiModel.value = config.redAiModel || defaultConfig.redAiModel
      blackAiModel.value = config.blackAiModel || defaultConfig.blackAiModel
      difficulty.value = config.difficulty || defaultConfig.difficulty
      enableSound.value = config.enableSound ?? defaultConfig.enableSound
      enableVibration.value = config.enableVibration ?? defaultConfig.enableVibration
      customAIModels.value = config.customAIModels || []
      timerMode.value = config.timerMode || defaultConfig.timerMode
      moveTimeLimit.value = config.moveTimeLimit || defaultConfig.moveTimeLimit
      redTimeLimit.value = config.redTimeLimit || defaultConfig.redTimeLimit
      blackTimeLimit.value = config.blackTimeLimit || defaultConfig.blackTimeLimit
      firstPlayer.value = config.firstPlayer || defaultConfig.firstPlayer
      allowUndo.value = config.allowUndo ?? defaultConfig.allowUndo
      autoForfeit.value = config.autoForfeit ?? defaultConfig.autoForfeit
      aiRetryOnError.value = config.aiRetryOnError ?? defaultConfig.aiRetryOnError
      aiThinkDelay.value = config.aiThinkDelay || defaultConfig.aiThinkDelay
    }
  }

  function saveConfig() {
    const config = {
      serverUrl: serverUrl.value,
      gameMode: gameMode.value,
      humanSide: humanSide.value,
      aiModel: aiModel.value,
      redAiModel: redAiModel.value,
      blackAiModel: blackAiModel.value,
      difficulty: difficulty.value,
      enableSound: enableSound.value,
      enableVibration: enableVibration.value,
      customAIModels: customAIModels.value,
      timerMode: timerMode.value,
      moveTimeLimit: moveTimeLimit.value,
      redTimeLimit: redTimeLimit.value,
      blackTimeLimit: blackTimeLimit.value,
      firstPlayer: firstPlayer.value,
      allowUndo: allowUndo.value,
      autoForfeit: autoForfeit.value,
      aiRetryOnError: aiRetryOnError.value,
      aiThinkDelay: aiThinkDelay.value
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  }

  function updateConfig(values) {
    if (values.serverUrl !== undefined) serverUrl.value = values.serverUrl
    if (values.gameMode !== undefined) gameMode.value = values.gameMode
    if (values.humanSide !== undefined) humanSide.value = values.humanSide
    if (values.aiModel !== undefined) aiModel.value = values.aiModel
    if (values.redAiModel !== undefined) redAiModel.value = values.redAiModel
    if (values.blackAiModel !== undefined) blackAiModel.value = values.blackAiModel
    if (values.difficulty !== undefined) difficulty.value = values.difficulty
    if (values.enableSound !== undefined) enableSound.value = values.enableSound
    if (values.enableVibration !== undefined) enableVibration.value = values.enableVibration
    if (values.customAIModels !== undefined) customAIModels.value = values.customAIModels
    if (values.timerMode !== undefined) timerMode.value = values.timerMode
    if (values.moveTimeLimit !== undefined) moveTimeLimit.value = values.moveTimeLimit
    if (values.redTimeLimit !== undefined) redTimeLimit.value = values.redTimeLimit
    if (values.blackTimeLimit !== undefined) blackTimeLimit.value = values.blackTimeLimit
    if (values.firstPlayer !== undefined) firstPlayer.value = values.firstPlayer
    if (values.allowUndo !== undefined) allowUndo.value = values.allowUndo
    if (values.autoForfeit !== undefined) autoForfeit.value = values.autoForfeit
    if (values.aiRetryOnError !== undefined) aiRetryOnError.value = values.aiRetryOnError
    if (values.aiThinkDelay !== undefined) aiThinkDelay.value = values.aiThinkDelay
    saveConfig()
  }

  // 获取所有可用的 AI 模型（预设 + 自定义）
  function getAllAIModels() {
    return [...presetAIModels, ...customAIModels.value]
  }

  // 获取当前选中的 AI 模型配置
  function getCurrentAIModel() {
    const allModels = getAllAIModels()
    return allModels.find(m => m.id === aiModel.value) || presetAIModels[0]
  }

  // 添加自定义 AI 模型
  function addCustomAIModel(model) {
    const newModel = {
      id: 'custom_' + Date.now(),
      enabled: true,
      ...model
    }
    customAIModels.value.push(newModel)
    saveConfig()
    return newModel
  }

  // 更新自定义 AI 模型
  function updateCustomAIModel(modelId, updates) {
    const index = customAIModels.value.findIndex(m => m.id === modelId)
    if (index !== -1) {
      customAIModels.value[index] = { ...customAIModels.value[index], ...updates }
      saveConfig()
    }
  }

  // 删除自定义 AI 模型
  function deleteCustomAIModel(modelId) {
    const index = customAIModels.value.findIndex(m => m.id === modelId)
    if (index !== -1) {
      customAIModels.value.splice(index, 1)
      // 如果删除的是当前选中的模型，切换到默认模型
      if (aiModel.value === modelId) {
        aiModel.value = 'deepseek'
      }
      saveConfig()
    }
  }

  // 切换 AI 模型的启用状态
  function toggleAIModel(modelId, enabled) {
    // 对于自定义模型
    const customIndex = customAIModels.value.findIndex(m => m.id === modelId)
    if (customIndex !== -1) {
      customAIModels.value[customIndex].enabled = enabled
      saveConfig()
      return
    }
  }

  return {
    serverUrl, gameMode, humanSide, aiModel, redAiModel, blackAiModel, difficulty, enableSound, enableVibration, customAIModels,
    timerMode, moveTimeLimit, redTimeLimit, blackTimeLimit, firstPlayer, allowUndo, autoForfeit, aiRetryOnError, aiThinkDelay,
    loadConfig, saveConfig, updateConfig,
    getAllAIModels, getCurrentAIModel,
    addCustomAIModel, updateCustomAIModel, deleteCustomAIModel, toggleAIModel
  }
})
