import { describe, expect, it } from 'vitest'
import { AI_LEVELS, createAiState, updateAi } from './ai.js'

const simulation = {
  phase: 'rally',
  players: [{ x: 240, y: 620 }, { x: 240, y: 100 }],
  ball: { live: true, x: 330, y: 220, vx: 15, vy: -180 },
}

function sequence(values) {
  let index = 0
  return () => values[index++] ?? values.at(-1)
}

describe('laptop difficulty', () => {
  it('uses strategy and timing only, with no hidden speed or stat bonuses', () => {
    expect(createAiState('hard').reactionMs).toBeLessThan(createAiState('easy').reactionMs)
    for (const profile of Object.values(AI_LEVELS)) {
      expect(profile).not.toHaveProperty('speed')
      expect(profile).not.toHaveProperty('stats')
    }
  })

  it('waits for the reaction timer before changing movement', () => {
    const ai = createAiState('normal')
    expect(updateAi(ai, simulation, 1, 10, () => 0.5)).toEqual({ x: 0, y: 0 })
  })

  it('produces the same timer, movement, and aim across split frame time', () => {
    const oneFrame = createAiState('hard')
    const manyFrames = createAiState('hard')
    const manyRng = sequence([0.75, 1])
    oneFrame.cooldownMs = 50
    manyFrames.cooldownMs = 50

    updateAi(oneFrame, simulation, 1, 96, sequence([0.75, 1]))
    for (let frame = 0; frame < 6; frame += 1) {
      updateAi(manyFrames, simulation, 1, 16, manyRng)
    }

    expect(manyFrames).toEqual(oneFrame)
  })

  it('keeps interception error separate from return-shot aim', () => {
    const leftError = createAiState('normal')
    const rightError = createAiState('normal')
    leftError.cooldownMs = 0
    rightError.cooldownMs = 0

    updateAi(leftError, simulation, 1, 1000, sequence([0, 1]))
    updateAi(rightError, simulation, 1, 1000, sequence([1, 1]))

    expect(leftError.movement).not.toEqual(rightError.movement)
    expect(leftError.shotAim).toEqual(rightError.shotAim)
  })

  it('deliberately chooses wider return targets at higher difficulty', () => {
    const widths = ['easy', 'normal', 'hard'].map((difficulty) => {
      const ai = createAiState(difficulty)
      ai.cooldownMs = 0
      updateAi(ai, simulation, 1, 1000, sequence([0.5, 1]))
      expect(Math.hypot(ai.movement.x, ai.movement.y)).toBeLessThanOrEqual(1)
      return Math.abs(ai.shotAim.x)
    })

    expect(widths[1]).toBeGreaterThan(widths[0])
    expect(widths[2]).toBeGreaterThan(widths[1])
  })
})
