/*
 * Capybara Jump - game loop, state machine, and input handling.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import Capybara from './Capybara.jsx'
import Obstacle from './Obstacle.jsx'
import Stars from './Stars.jsx'
import Overlay from './Overlay.jsx'
import {
  CAPY_X,
  CAPY_H,
  OBS_WIDTH,
  OBS_SPAWN_DIST,
  applyGravity,
  applyJump,
  nextY,
  computeSpeed,
  spawnObstacle,
  tickObstacles,
  checkCollision,
  shouldShowDeathOverlay,
  loadHighScore,
  saveHighScore,
} from './game.js'

const INITIAL_VY = 0

export default function App() {
  const gameRef = useRef(null)
  const [, forceUpdate] = useState(0)
  const [showRules, setShowRules] = useState(false)

  const gs = useRef({
    phase: 'idle',
    capyY: 200,
    capyVY: INITIAL_VY,
    obstacles: [],
    score: 0,
    highScore: loadHighScore(),
    distanceTraveled: 0,
    nextSpawnAt: OBS_SPAWN_DIST,
    obstacleIdCounter: 0,
    deadFrames: 0,
    deathStartedAt: null,
    gameW: 860,
    gameH: 640,
    clouds: [
      { id: 0, x: 80, y: 60, w: 60, h: 20 },
      { id: 1, x: 240, y: 35, w: 80, h: 24 },
      { id: 2, x: 340, y: 90, w: 50, h: 16 },
    ],
    cloudIdCounter: 3,
  })

  useEffect(() => {
    const el = gameRef.current
    if (!el) return undefined

    const measure = () => {
      gs.current.gameW = el.clientWidth
      gs.current.gameH = el.clientHeight

      if (gs.current.phase === 'idle') {
        gs.current.capyY = el.clientHeight / 2 - CAPY_H / 2
      }
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  const handleInput = useCallback(() => {
    const s = gs.current
    if (showRules) return

    if (s.phase === 'idle') {
      s.phase = 'playing'
      s.capyVY = applyJump()
      forceUpdate((count) => count + 1)
      return
    }

    if (s.phase === 'playing') {
      s.capyVY = applyJump()
      return
    }

    const deathElapsedMs = s.deathStartedAt == null ? 0 : performance.now() - s.deathStartedAt

    if (s.phase === 'dead' && shouldShowDeathOverlay(s.deadFrames, deathElapsedMs)) {
      s.phase = 'playing'
      s.capyY = s.gameH / 2 - CAPY_H / 2
      s.capyVY = applyJump()
      s.obstacles = []
      s.score = 0
      s.distanceTraveled = 0
      s.nextSpawnAt = OBS_SPAWN_DIST
      s.obstacleIdCounter = 0
      s.deadFrames = 0
      s.deathStartedAt = null
      forceUpdate((count) => count + 1)
    }
  }, [showRules])

  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== 'Space') return

      event.preventDefault()
      handleInput()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleInput])

  useEffect(() => {
    let rafId

    const loop = () => {
      const s = gs.current

      if (s.phase === 'playing') {
        const speed = computeSpeed(s.score)

        s.capyVY = applyGravity(s.capyVY)
        s.capyY = nextY(s.capyY, s.capyVY)

        s.distanceTraveled += speed
        s.obstacles = tickObstacles(s.obstacles, speed)

        if (s.distanceTraveled >= s.nextSpawnAt) {
          s.obstacles.push(
            spawnObstacle(`obs-${s.obstacleIdCounter}`, s.gameW, s.gameH, s.score),
          )
          s.obstacleIdCounter += 1
          s.nextSpawnAt = s.distanceTraveled + OBS_SPAWN_DIST
        }

        const cloudSpeed = speed * 0.4
        s.clouds = s.clouds
          .map((cloud) => ({ ...cloud, x: cloud.x - cloudSpeed }))
          .filter((cloud) => cloud.x > -120)

        const rightmostCloud = s.clouds.reduce(
          (maxX, cloud) => Math.max(maxX, cloud.x + cloud.w),
          0,
        )

        if (rightmostCloud < s.gameW - 80) {
          const w = 40 + Math.floor(Math.random() * 60)
          const h = 14 + Math.floor(Math.random() * 14)

          s.clouds.push({
            id: s.cloudIdCounter,
            x: s.gameW + 20,
            y: 20 + Math.floor(Math.random() * (s.gameH * 0.35)),
            w,
            h,
          })
          s.cloudIdCounter += 1
        }

        for (const obstacle of s.obstacles) {
          if (!obstacle.scored && obstacle.x + OBS_WIDTH < CAPY_X) {
            obstacle.scored = true
            s.score += 1

            if (s.score > s.highScore) {
              s.highScore = s.score
              saveHighScore(s.highScore)
            }
          }
        }

        if (checkCollision(s.capyY, s.obstacles, s.gameH)) {
          s.phase = 'dead'
          s.deadFrames = 0
          s.deathStartedAt = performance.now()
        }
      } else if (s.phase === 'dead') {
        s.deadFrames += 1
      }

      forceUpdate((count) => count + 1)
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const s = gs.current
  const deathElapsedMs = s.deathStartedAt == null ? 0 : performance.now() - s.deathStartedAt
  const showScoreOverlay = s.phase === 'dead' && shouldShowDeathOverlay(s.deadFrames, deathElapsedMs)
  const showStars = s.phase === 'dead' && !showScoreOverlay
  const showOverlay = s.phase === 'idle' || showScoreOverlay

  return (
    <main className="game-page">
      <section className="game-shell" aria-label="Capybara Jump">
        <header className="game-head">
          <div className="brand">
            <span className="brand-name">Capybara Jump</span>
            <span className="brand-by">Apps On The House</span>
          </div>
          <div className="score-pill">
            <span className="score-label">Best</span>
            <span className="score-val">{s.highScore}</span>
          </div>
        </header>

        <div
          ref={gameRef}
          className="game-wrap"
          onPointerDown={(event) => {
            event.preventDefault()
            handleInput()
          }}
        >
      {s.phase === 'playing' && <div className="score-display">{s.score}</div>}

      <button
        className="help-btn"
        type="button"
        title="How to play"
        aria-label="How to play"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setShowRules(true)
        }}
      >
        <HelpCircle size={18} aria-hidden="true" />
      </button>

      {s.clouds.map((cloud) => (
        <div
          key={cloud.id}
          className="cloud"
          style={{ left: cloud.x, top: cloud.y, width: cloud.w, height: cloud.h }}
        />
      ))}

      {s.obstacles.map((obstacle) => (
        <Obstacle
          key={obstacle.id}
          x={obstacle.x}
          gapTop={obstacle.gapTop}
          gapSize={obstacle.gapSize}
          topType={obstacle.topType}
          bottomType={obstacle.bottomType}
        />
      ))}

      <Capybara y={s.capyY} dead={s.phase === 'dead'} />

      {showStars && <Stars capyX={CAPY_X} capyY={s.capyY} />}

      <div className="grass" />

      {showOverlay && <Overlay phase={s.phase} score={s.score} highScore={s.highScore} />}

      {showRules && (
        <div
          className="rules-overlay"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <div className="rules-card">
            <button
              className="rules-close"
              type="button"
              title="Close"
              aria-label="Close"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setShowRules(false)
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <h3>How to play</h3>
            <p>Tap or press Space to make the capybara jump.</p>
            <p>Fly through the gap between the hanging anaconda and the fence post.</p>
            <p>Each gap cleared scores one point. The gaps get narrower as your score climbs.</p>
            <p>Hit an anaconda, a fence, the sky, or the ground and the run ends.</p>
          </div>
        </div>
      )}
        </div>
      </section>
    </main>
  )
}
