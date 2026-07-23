import { useEffect, useRef } from 'react'
import { createAiState, updateAi } from './game/ai.js'
import { WORLD_H, WORLD_W } from './game/config.js'
import {
  beginTouch,
  clearInput,
  endTouch,
  moveTouch,
  movementForPlayer,
  setKey,
} from './game/input.js'
import {
  advanceSimulation,
  setMovement,
  setServeAim,
} from './game/simulation.js'
import { drawFrame } from './render.js'

const ZERO_MOVEMENT = { x: 0, y: 0 }
const CONTROL_KEYS = new Set([
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
])

function worldPoint(canvas, event) {
  const bounds = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left) * (WORLD_W / bounds.width),
    y: (event.clientY - bounds.top) * (WORLD_H / bounds.height),
  }
}

function combinedMovement(first, second) {
  const x = first.x + second.x
  const y = first.y + second.y
  const magnitude = Math.hypot(x, y)
  return magnitude > 1 ? { x: x / magnitude, y: y / magnitude } : { x, y }
}

function snapshotKey(state) {
  const { currentServer, lastPoint, scores } = state.match
  return [
    state.phase,
    scores[0],
    scores[1],
    currentServer,
    lastPoint?.reason ?? '',
    state.cueId,
  ].join('|')
}

export default function GameCanvas({
  simulationRef,
  inputRef,
  paused,
  reducedMotion,
  onSnapshot,
}) {
  const canvasRef = useRef(null)
  const aiRef = useRef(null)
  const snapshotRef = useRef(null)
  const snapshotCallbackRef = useRef(onSnapshot)
  const reducedMotionRef = useRef(reducedMotion)

  useEffect(() => {
    snapshotCallbackRef.current = onSnapshot
  }, [onSnapshot])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  useEffect(() => {
    if (paused) clearInput(inputRef.current)
  }, [inputRef, paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const handleKeyDown = (event) => {
      if (!CONTROL_KEYS.has(event.code)) return
      event.preventDefault()
      setKey(inputRef.current, event.code, true)
    }
    const handleKeyUp = (event) => {
      if (!CONTROL_KEYS.has(event.code)) return
      event.preventDefault()
      setKey(inputRef.current, event.code, false)
    }
    const handleFocusLoss = () => clearInput(inputRef.current)
    const handleVisibilityChange = () => {
      if (document.hidden) clearInput(inputRef.current)
    }
    const handlePointerDown = (event) => {
      event.preventDefault()
      canvas.setPointerCapture(event.pointerId)
      const point = worldPoint(canvas, event)
      beginTouch(inputRef.current, event.pointerId, point.x, point.y, WORLD_H)
    }
    const handlePointerMove = (event) => {
      if (!inputRef.current.touches.has(event.pointerId)) return
      event.preventDefault()
      const point = worldPoint(canvas, event)
      moveTouch(inputRef.current, event.pointerId, point.x, point.y)
    }
    const handlePointerEnd = (event) => {
      event.preventDefault()
      endTouch(inputRef.current, event.pointerId)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleFocusLoss)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerEnd)
    canvas.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      clearInput(inputRef.current)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleFocusLoss)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerEnd)
      canvas.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [inputRef])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return undefined

    let animationFrame
    let lastTime = performance.now()

    const frame = (now) => {
      const state = simulationRef.current
      const elapsedMs = Math.max(0, now - lastTime)
      lastTime = now

      if (!paused) {
        const playerOneInput = movementForPlayer(inputRef.current, 0)
        const playerTwoInput = movementForPlayer(inputRef.current, 1)
        const opponent = state.match.players[1]
        const singlePlayer = opponent.kind === 'ai'
        let playerOneMovement = singlePlayer
          ? combinedMovement(playerOneInput, playerTwoInput)
          : playerOneInput
        let playerTwoMovement = playerTwoInput

        if (singlePlayer) {
          if (!aiRef.current || aiRef.current.difficulty !== opponent.difficulty) {
            aiRef.current = createAiState(opponent.difficulty)
          }
          playerTwoMovement = updateAi(aiRef.current, state, 1, elapsedMs)
        } else {
          aiRef.current = null
        }

        if (state.phase === 'countdown') {
          const serveMovement = state.match.currentServer === 0
            ? playerOneMovement
            : playerTwoMovement
          setServeAim(state, serveMovement)
          playerOneMovement = ZERO_MOVEMENT
          playerTwoMovement = ZERO_MOVEMENT
        }

        setMovement(state, 0, playerOneMovement)
        setMovement(state, 1, playerTwoMovement)
        advanceSimulation(state, elapsedMs)
      }

      drawFrame(ctx, state, now, reducedMotionRef.current)

      const nextSnapshotKey = snapshotKey(state)
      if (nextSnapshotKey !== snapshotRef.current) {
        snapshotRef.current = nextSnapshotKey
        snapshotCallbackRef.current?.(state)
      }

      animationFrame = requestAnimationFrame(frame)
    }

    animationFrame = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationFrame)
  }, [inputRef, paused, simulationRef])

  return (
    <canvas
      ref={canvasRef}
      width={WORLD_W}
      height={WORLD_H}
      aria-label="Tiebreak tennis court"
      className="game-canvas"
      role="img"
    />
  )
}
