// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: '/eidolon/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),   // Codex (React)
        game: resolve(__dirname, 'game.html'),    // Game (vanilla JS modules)
      },
    },
  },
})
