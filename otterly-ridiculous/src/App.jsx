/*
 * Otterly Ridiculous - app chrome: header, HUD, overlays.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { useCallback, useRef, useState } from 'react'
import { HelpCircle, Heart, ArrowLeft } from 'lucide-react'
import GameCanvas from './GameCanvas.jsx'
import ShareButton from './ShareButton.jsx'
import {
  createGame,
  startRun,
  loadHighScore,
  saveHighScore,
  setPointerTarget,
  MAX_LIVES,
  SHORE,
  ROUND_ITEM_TARGET,
} from './game.js'

const RESTART_LOCK_MS = 600

export default function App() {
  const gameRef = useRef(null)
  if (!gameRef.current) gameRef.current = createGame()

  const [hud, setHud] = useState({ phase: 'idle', score: 0, lives: MAX_LIVES, multiplier: 1 })
  const [best, setBest] = useState(loadHighScore)
  const [showHelp, setShowHelp] = useState(false)
  const [multToast, setMultToast] = useState(null)
  const overAtRef = useRef(0)
  const prevMultRef = useRef(1)
  const toastTimerRef = useRef(null)

  const handleHudChange = useCallback((next) => {
    setHud(next)
    // Friendly heads-up whenever the multiplier ticks up (a round was banked).
    if (next.phase === 'playing' && next.multiplier > prevMultRef.current) {
      setMultToast({ key: Date.now(), multiplier: next.multiplier })
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setMultToast(null), 2200)
    }
    prevMultRef.current = next.multiplier
    if (next.phase === 'gameover') {
      setMultToast(null)
      overAtRef.current = Date.now()
      setBest((prev) => {
        const top = Math.max(prev, next.score)
        if (top !== prev) saveHighScore(top)
        return top
      })
    }
  }, [])

  const handleStagePointerDown = (e) => {
    const phase = gameRef.current.phase
    if (phase === 'gameover' && Date.now() - overAtRef.current < RESTART_LOCK_MS) return
    if (phase === 'idle' || phase === 'gameover') {
      const canvas = e.currentTarget.querySelector('.game-canvas')
      const rect = canvas?.getBoundingClientRect()
      const worldW = Math.max(1, Math.round(canvas?.width || rect?.width || 480))
      const worldH = Math.max(1, Math.round(canvas?.height || rect?.height || 640))
      gameRef.current = startRun({ worldW, worldH })
      setHud({ phase: 'playing', score: 0, lives: MAX_LIVES, multiplier: 1 })
      prevMultRef.current = 1
      setMultToast(null)
      clearTimeout(toastTimerRef.current)

      if (canvas && rect) {
        const x = ((e.clientX - rect.left) / rect.width) * worldW
        const y = ((e.clientY - rect.top) / rect.height) * worldH
        const clampedX = Math.min(Math.max(x, SHORE + 60), worldW - SHORE - 60)
        const clampedY = Math.min(Math.max(y, SHORE + 60), worldH - SHORE - 60)
        setPointerTarget(gameRef.current, clampedX, clampedY)
      }
    }
  }

  return (
    <div className="app">
      <header className="game-head">
        <div className="head-title">
          <h1>Otterly Ridiculous</h1>
          <a className="byline back-link" href="/">
            <ArrowLeft size={11} /> Apps On The House
          </a>
        </div>
        <div className="head-right">
          <div className="score-pill">
            <span className="score-label">Score</span>
            <span className="score-val">{hud.score}</span>
          </div>
          <div className="score-pill">
            <span className="score-label">Best</span>
            <span className="score-val">{best}</span>
          </div>
          <div className="score-pill">
            <span className="score-label">Mult</span>
            <span className="score-val">x{hud.multiplier}</span>
          </div>
          <div className="lives" aria-label={`${hud.lives} lives left`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <Heart
                key={i}
                size={18}
                className={i < hud.lives ? 'heart' : 'heart heart-lost'}
                fill={i < hud.lives ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            ))}
          </div>
          {hud.phase !== 'playing' && (
            <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="How to play">
              <HelpCircle size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="stage" onPointerDown={handleStagePointerDown}>
        <GameCanvas gameRef={gameRef} onHudChange={handleHudChange} paused={showHelp} />

        {multToast && (
          <div className="mult-toast" key={multToast.key} role="status" aria-live="polite">
            <span className="mult-toast-big">x{multToast.multiplier}</span>
            <span className="mult-toast-sub">{ROUND_ITEM_TARGET} reached. You gained +1 multiplier!</span>
          </div>
        )}

        {hud.phase === 'idle' && (
          <div className="overlay">
            <div className="card overlay-card">
              <h2>Otterly Ridiculous</h2>
              <p>Catch fish and rocks. Every {ROUND_ITEM_TARGET} items banks your score and raises the multiplier.</p>
              <p className="text-muted">Tap or click to start</p>
            </div>
          </div>
        )}

        {hud.phase === 'gameover' && (
          <div className="overlay">
            <div className="card overlay-card">
              <h2>Game over</h2>
              <p className="final-score">Score {hud.score}</p>
              <p className="text-muted">Best {best}</p>
              <div className="share-row" onPointerDown={(e) => e.stopPropagation()}>
                <ShareButton
                  text={`I scored ${hud.score} in Otterly Ridiculous — play free at Apps On The House!`}
                />
              </div>
              <p className="text-muted">Tap anywhere to swim again</p>
            </div>
          </div>
        )}

        {showHelp && (
          <div className="overlay" onPointerDown={(e) => e.stopPropagation()}>
            <div className="card overlay-card help-card">
              <h2>How to play</h2>
              <p>Steer the otter with your mouse, or swipe on touch screens.</p>
              <p>
                The panda throws fish and rocks into the lake. Each one is worth the current
                multiplier, and every {ROUND_ITEM_TARGET} items banks your score before the multiplier rises.
              </p>
              <p>
                Plastic does not belong in the lake, and the otter knows it. Each plastic hit
                costs a life and half your collection. So does bumping into your own tail line.
              </p>
              <p>Touching the shore ends the swim instantly. Three lives per run.</p>
              <button className="btn btn-primary" onClick={() => setShowHelp(false)}>
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
