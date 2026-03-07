import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/game-socket': {
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: './index.html',
        game: './game.html',
        spectate: './spectate.html',
        settings: './settings.html'
      }
    }
  }
})
