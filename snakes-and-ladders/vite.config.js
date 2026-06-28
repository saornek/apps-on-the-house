import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' so the game works under /games/snakes-and-ladders/ on the main site.
export default defineConfig({
  base: './',
  plugins: [react()],
})
