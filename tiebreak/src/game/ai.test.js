import { describe, expect, it } from 'vitest'
import { createAiState, updateAi } from './ai.js'

const simulation = {
  phase: 'rally',
  players: [{ x: 240, y: 620 }, { x: 240, y: 100 }],
  ball: { live: true, x: 330, y: 220, vx: 15, vy: -180 },
}

describe('laptop difficulty', () => {
  it('gives hard a shorter reaction window than easy', () => {
    expect(createAiState('hard').reactionMs).toBeLessThan(createAiState('easy').reactionMs)
  })

  it('waits for the reaction timer before changing movement', () => {
    const ai = createAiState('normal')
    expect(updateAi(ai, simulation, 1, 10, () => 0.5)).toEqual({ x: 0, y: 0 })
  })

  it('keeps movement normalized and deterministic with injected randomness', () => {
    const ai = createAiState('hard')
    const movement = updateAi(ai, simulation, 1, 1000, () => 0.5)
    expect(Math.hypot(movement.x, movement.y)).toBeLessThanOrEqual(1)
    expect(movement.x).toBeGreaterThan(0)
  })
})
