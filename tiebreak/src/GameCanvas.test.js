import { describe, expect, it } from 'vitest'
import * as GameCanvasModule from './GameCanvas.jsx'
import { FIXED_STEP_MS } from './game/config.js'
import { balancedBuild, createMatch } from './game/match.js'
import {
  advanceSimulation,
  createSimulation,
  setMovement,
} from './game/simulation.js'

const ZERO_MOVEMENT = { x: 0, y: 0 }

function singlePlayerState() {
  const build = balancedBuild()
  const players = [
    { kind: 'human', name: 'Player 1', monsterId: 'crumblehorn', build },
    {
      kind: 'ai',
      name: 'COM',
      monsterId: 'blinkblob',
      difficulty: 'normal',
      build,
    },
  ]
  const state = createSimulation(createMatch({ players, openingServer: 0 }))
  state.phase = 'rally'
  state.match.phase = 'rally'
  state.ball.live = false
  return state
}

describe('single-player frame input', () => {
  it('routes alternate human input only to player 0 before a fixed step', () => {
    const state = singlePlayerState()
    const [playerOneMovement, playerTwoMovement] =
      GameCanvasModule.routePlayerMovements(
        true,
        ZERO_MOVEMENT,
        { x: -1, y: 0 },
      )

    setMovement(state, 0, playerOneMovement)
    setMovement(state, 1, playerTwoMovement)
    advanceSimulation(state, FIXED_STEP_MS / 2)

    expect(state.accumulatorMs).toBeCloseTo(FIXED_STEP_MS / 2)
    expect(state.players[0].input).toEqual({ x: -1, y: 0 })
    expect(state.players[0].racketDirection).toBe(-1)
    expect(state.players[1].input).toEqual(ZERO_MOVEMENT)
    expect(state.players[1].racketDirection).toBe(1)
  })
})
