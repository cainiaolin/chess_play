import { defineStore } from 'pinia'
import { ref } from 'vue'

const CONFIG_KEY = 'chess_game_config'

const defaultConfig = {
  serverUrl: 'http://localhost:3001',
  aiModel: 'deepseek',
  difficulty: 3,
  enableSound: true,
  enableVibration: true
}

export const useConfigStore = defineStore('config', () => {
  const serverUrl = ref(defaultConfig.serverUrl)
  const aiModel = ref(defaultConfig.aiModel)
  const difficulty = ref(defaultConfig.difficulty)
  const enableSound = ref(defaultConfig.enableSound)
  const enableVibration = ref(defaultConfig.enableVibration)

  function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) {
      const config = JSON.parse(saved)
      serverUrl.value = config.serverUrl || defaultConfig.serverUrl
      aiModel.value = config.aiModel || defaultConfig.aiModel
      difficulty.value = config.difficulty || defaultConfig.difficulty
      enableSound.value = config.enableSound ?? defaultConfig.enableSound
      enableVibration.value = config.enableVibration ?? defaultConfig.enableVibration
    }
  }

  function saveConfig() {
    const config = {
      serverUrl: serverUrl.value,
      aiModel: aiModel.value,
      difficulty: difficulty.value,
      enableSound: enableSound.value,
      enableVibration: enableVibration.value
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  }

  function updateConfig(values) {
    if (values.serverUrl !== undefined) serverUrl.value = values.serverUrl
    if (values.aiModel !== undefined) aiModel.value = values.aiModel
    if (values.difficulty !== undefined) difficulty.value = values.difficulty
    if (values.enableSound !== undefined) enableSound.value = values.enableSound
    if (values.enableVibration !== undefined) enableVibration.value = values.enableVibration
    saveConfig()
  }

  return {
    serverUrl, aiModel, difficulty, enableSound, enableVibration,
    loadConfig, saveConfig, updateConfig
  }
})
