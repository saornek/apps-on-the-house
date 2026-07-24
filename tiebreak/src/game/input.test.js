import { describe, expect, it } from 'vitest'
import {
  beginTouch,
  clearInput,
  createInputState,
  endTouch,
  moveTouch,
  movementForPlayer,
  setKey,
} from './input.js'

describe('keyboard input', () => {
  it('maps WASD to player zero and arrows to player one', () => {
    const input = createInputState()
    setKey(input, 'KeyW', true)
    setKey(input, 'ArrowRight', true)
    expect(movementForPlayer(input, 0)).toEqual({ x: 0, y: -1 })
    expect(movementForPlayer(input, 1)).toEqual({ x: 1, y: 0 })
  })

  it('clears stuck input', () => {
    const input = createInputState()
    setKey(input, 'KeyA', true)
    clearInput(input)
    expect(movementForPlayer(input, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe('multi-touch input', () => {
  it('owns one simultaneous touch per court half', () => {
    const input = createInputState()
    beginTouch(input, 10, 100, 600, 720)
    beginTouch(input, 11, 380, 120, 720)
    moveTouch(input, 10, 140, 600)
    moveTouch(input, 11, 340, 120)
    expect(movementForPlayer(input, 0).x).toBeGreaterThan(0)
    expect(movementForPlayer(input, 1).x).toBeGreaterThan(0)
    endTouch(input, 10)
    expect(movementForPlayer(input, 0)).toEqual({ x: 0, y: 0 })
  })
})
