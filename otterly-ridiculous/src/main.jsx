/*
 * Otterly Ridiculous - an otter-steering, fish-collecting lake game.
 * Part of Apps On The House. Free, no ads, no ad tracking.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import './App.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  })
}
