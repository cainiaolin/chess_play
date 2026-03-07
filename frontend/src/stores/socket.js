import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io } from 'socket.io-client'

export const useSocketStore = defineStore('socket', () => {
  const socket = ref(null)
  const isConnected = ref(false)
  const currentRoom = ref(null)

  function connect(url) {
    if (socket.value) return

    socket.value = io(url, {
      path: '/game-socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      console.log('Socket connected')
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('Socket disconnected')
    })

    socket.value.on('error', (error) => {
      console.error('Socket error:', error)
    })
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
      currentRoom.value = null
    }
  }

  function join(gameId) {
    if (socket.value) {
      socket.value.emit('game:join', { gameId })
      currentRoom.value = gameId
    }
  }

  function leave(gameId) {
    if (socket.value) {
      socket.value.emit('game:leave', { gameId })
      if (currentRoom.value === gameId) {
        currentRoom.value = null
      }
    }
  }

  function subscribe(gameId, callback) {
    if (socket.value) {
      socket.value.emit('game:subscribe', { gameId })
      socket.value.on('game:state-update', callback)
      socket.value.on('game:ended', callback)
    }
  }

  function unsubscribe(gameId) {
    if (socket.value) {
      socket.value.emit('game:unsubscribe', { gameId })
      socket.value.off('game:state-update')
      socket.value.off('game:ended')
    }
  }

  return {
    socket, isConnected, currentRoom,
    connect, disconnect, join, leave, subscribe, unsubscribe
  }
})
