// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/pokedex-vite/',  // <-- MATCH your GitHub repo name exactly
  plugins: [react()],
})
