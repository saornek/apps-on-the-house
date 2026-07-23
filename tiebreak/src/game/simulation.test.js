import { describe, expect, it } from 'vitest'
import { balancedBuild, createMatch } from './match.js'
import {
  advanceSimulation,
  createSimulation,
  setMovement,
  startServe,
  strokeFor,
  movementSpeed,
  placementError,
  serveSpeed,
  shotSpeed,
  swingRecovery,
} from './simulation.js'
import { NET_Y, PLAYER_MAX_X, PLAYER_MIN_X } from './config.js'

const players = [
  { name: 'You', monsterId: 'crumblehorn', build: balancedBuild() },
  { name: 'COM', monsterId: 'blinkblob', build: balancedBuild() },
]

const makeState = () => createSimulation(createMatch({ players, openingServer: 0 }))

describe('players', () => {
  it('stays inside the playable half and side boundaries', () => {
    const state = makeState()
    setMovement(state, 0, { x: -1, y: -1 })
    advanceSimulation(state, 10000)
    expect(state.players[0].x).toBeGreaterThanOrEqual(PLAYER_MIN_X)
    expect(state.players[0].x).toBeLessThanOrEqual(PLAYER_MAX_X)
    expect(state.players[0].y).toBeGreaterThan(NET_Y)
  })

  it('selects opposite stroke sides for top and bottom players', () => {
    expect(strokeFor(0, 240, 280)).toBe('forehand')
    expect(strokeFor(0, 240, 200)).toBe('backhand')
    expect(strokeFor(1, 240, 200)).toBe('forehand')
    expect(strokeFor(1, 240, 280)).toBe('backhand')
  })
})

describe('ball rules', () => {
  it('launches a legal automatic serve toward the receiver', () => {
    const state = makeState()
    startServe(state)
    expect(state.phase).toBe('rally')
    expect(state.ball.live).toBe(true)
    expect(state.ball.vy).toBeLessThan(0)
  })

  it('awards the point after the second bounce in one half', () => {
    const state = makeState()
    state.phase = 'rally'
    state.ball = {
      live: true, x: 240, y: 120, z: 1, vx: 0, vy: 0, vz: -50,
      lastHitter: 0, bounceHalf: 1, bouncesInHalf: 1,
    }
    advanceSimulation(state, 50)
    expect(state.match.lastPoint).toEqual({ winner: 0, reason: 'double-bounce' })
  })

  it('is stable when elapsed time is split across render frames', () => {
    const oneFrame = makeState()
    const manyFrames = makeState()
    startServe(oneFrame, () => 0.5)
    startServe(manyFrames, () => 0.5)
    advanceSimulation(oneFrame, 48)
    advanceSimulation(manyFrames, 16)
    advanceSimulation(manyFrames, 16)
    advanceSimulation(manyFrames, 16)
    expect(manyFrames.ball.x).toBeCloseTo(oneFrame.ball.x, 6)
    expect(manyFrames.ball.y).toBeCloseTo(oneFrame.ball.y, 6)
    expect(manyFrames.ball.z).toBeCloseTo(oneFrame.ball.z, 6)
  })
})

describe('stat effects', () => {
  it('makes high ratings faster, more accurate, and quicker to recover', () => {
    expect(movementSpeed({ footwork: 9 })).toBeGreaterThan(movementSpeed({ footwork: 1 }))
    expect(swingRecovery({ footwork: 9 })).toBeLessThan(swingRecovery({ footwork: 1 }))
    expect(serveSpeed(9)).toBeGreaterThan(serveSpeed(1))
    expect(shotSpeed(9)).toBeGreaterThan(shotSpeed(1))
    expect(Math.abs(placementError(9, () => 1))).toBeLessThan(
      Math.abs(placementError(1, () => 1)),
    )
  })
})
