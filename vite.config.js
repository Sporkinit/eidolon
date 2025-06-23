// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/eidolon/',  // <-- MATCH your GitHub repo name exactly
  plugins: [react()],
})
