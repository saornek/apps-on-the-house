import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset paths relative, so the game works whether it's served
// at a domain root or under a subpath (e.g. /just-blocks/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
