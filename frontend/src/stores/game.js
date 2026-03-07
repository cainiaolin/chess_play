import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { gameApi } from '../utils/api'

export const useGameStore = defineStore('game', () => {
  // State
  const gameId = ref(null)
  const gameState = ref(null)
  const selectedPiece = ref(null)
  const validMoves = ref([])
  const lastMove = ref(null)
  const isAIThinking = ref(false)

  // Getters
  const currentTurn = computed(() => gameState.value?.turn || 'red')
  const gameStatus = computed(() => gameState.value?.status || 'ready')
  const canUndo = computed(() => {
    return gameState.value?.moves?.length > 0
  })

  // Actions
  async function createGame(config) {
    const result = await gameApi.create(config)
    if (result.success) {
      gameId.value = result.data.id
      gameState.value = result.data
    }
    return result
  }

  async function loadGame(id) {
    const result = await gameApi.get(id)
    if (result.success) {
      gameId.value = id
      gameState.value = result.data
    }
    return result
  }

  async function makeMove(from, to) {
    const result = await gameApi.move(gameId.value, { from, to })
    if (result.success) {
      lastMove.value = result.data.move
      if (result.data.aiMove) {
        isAIThinking.value = true
      }
    }
    return result
  }

  async function undoMove() {
    const result = await gameApi.undo(gameId.value)
    return result
  }

  async function getHint() {
    const result = await gameApi.hint(gameId.value)
    return result
  }

  function updateGameState(newState) {
    gameState.value = newState
  }

  function selectPiece(piece) {
    selectedPiece.value = piece
  }

  function setValidMoves(moves) {
    validMoves.value = moves
  }

  function reset() {
    gameId.value = null
    gameState.value = null
    selectedPiece.value = null
    validMoves.value = []
    lastMove.value = null
    isAIThinking.value = false
  }

  return {
    // State
    gameId, gameState, selectedPiece, validMoves, lastMove, isAIThinking,
    // Getters
    currentTurn, gameStatus, canUndo,
    // Actions
    createGame, loadGame, makeMove, undoMove, getHint,
    updateGameState, selectPiece, setValidMoves, reset
  }
})
