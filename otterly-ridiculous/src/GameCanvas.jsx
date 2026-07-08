/*
 * Otterly Ridiculous - canvas host: game loop and input.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { useEffect, useRef } from 'react'
import { tick, setPointerTarget, setDirection, resizeWorld, WORLD_W, WORLD_H } from './game.js'
import { drawFrame } from './sprites.js'

const SWIPE_MIN_PX = 24
const MAX_FRAME_MS = 50
// Widest the play field is allowed to get (width / height). Portrait screens
// fill fully; wider screens are capped to this and centered, so the field
// never stretches into a landscape shape.
const MAX_FIELD_ASPECT = WORLD_W / WORLD_H

export default function GameCanvas({ gameRef, onHudChange, paused }) {
  const canvasRef = useRef(null)
  const hudRef = useRef({ phase: '', score: -1, lives: -1, multiplier: -1 })
  const touchRef = useRef(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    let rafId
    let last = performance.now()

    const stage = canvas.parentElement

    const syncCanvasSize = () => {
      if (!stage) return
      const availW = stage.clientWidth
      const availH = stage.clientHeight
      if (availW <= 0 || availH <= 0) return

      // Always fill the height; fill the width too on portrait screens, but cap
      // it on wide screens so the field stays a centered portrait column.
      const height = Math.max(1, Math.round(availH))
      let width = availW
      if (width / height > MAX_FIELD_ASPECT) width = height * MAX_FIELD_ASPECT
      width = Math.max(1, Math.round(width))

      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        ctx.imageSmoothingEnabled = false
      }
      resizeWorld(gameRef.current, width, height)
    }

    syncCanvasSize()
    const resizeObserver = new ResizeObserver(syncCanvasSize)
    if (stage) resizeObserver.observe(stage)

    const loop = (now) => {
      syncCanvasSize()
      const dt = Math.min(now - last, MAX_FRAME_MS)
      last = now
      const game = gameRef.current
      if (!pausedRef.current) tick(game, dt)
      drawFrame(ctx, game, now)

      const hud = hudRef.current
      if (
        hud.phase !== game.phase ||
        hud.score !== game.score ||
        hud.lives !== game.lives ||
        hud.multiplier !== game.multiplier
      ) {
        hudRef.current = {
          phase: game.phase,
          score: game.score,
          lives: game.lives,
          multiplier: game.multiplier,
        }
        onHudChange(hudRef.current)
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [gameRef, onHudChange])

  const toWorld = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const game = gameRef.current
    return {
      x: ((clientX - rect.left) / rect.width) * game.worldW,
      y: ((clientY - rect.top) / rect.height) * game.worldH,
    }
  }

  const handlePointerMove = (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
    const p = toWorld(e.clientX, e.clientY)
    setPointerTarget(gameRef.current, p.x, p.y)
  }

  const handleTouchStart = (e) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchMove = (e) => {
    if (!touchRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return
    const dir =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
    setDirection(gameRef.current, dir)
    touchRef.current = { x: t.clientX, y: t.clientY }
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onPointerMove={handlePointerMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    />
  )
}
