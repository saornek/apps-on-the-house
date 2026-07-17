/*
 * Solitaire - Vite configuration.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
})
