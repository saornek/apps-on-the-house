import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { serviceWorkerPlugin } from './scripts/serviceWorkerPlugin.js'

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerPlugin()],
  test: { environment: 'node' },
})
