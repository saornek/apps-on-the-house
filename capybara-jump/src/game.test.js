/*
 * Capybara Jump - pure game logic tests.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { describe, it, expect } from 'vitest'
import {
  GRAVITY, JUMP_VY, CAPY_W, CAPY_H, CAPY_X,
  CAPY_HIT_X, CAPY_HIT_Y, CAPY_HIT_W, CAPY_HIT_H,
  OBS_WIDTH, GRASS_H,
  INITIAL_SPEED, MAX_SPEED, SPEED_INTERVAL,
  INITIAL_GAP, MIN_GAP,
  DEATH_OVERLAY_FRAMES, DEATH_OVERLAY_MS,
  TOP_OBSTACLE_TYPES, BOTTOM_OBSTACLE_TYPES,
  computeSpeed, computeGap, applyGravity, applyJump,
  nextY, spawnObstacle, tickObstacles, checkCollision, shouldShowDeathOverlay,
  selectObstacleVisual,
} from './game.js'

describe('computeSpeed', () => {
  it('returns initial speed at score 0', () => {
    expect(computeSpeed(0)).toBe(INITIAL_SPEED)
  })

  it('increases after each interval', () => {
    expect(computeSpeed(SPEED_INTERVAL)).toBeGreaterThan(INITIAL_SPEED)
  })

  it('never exceeds MAX_SPEED', () => {
    expect(computeSpeed(9999)).toBe(MAX_SPEED)
  })
})

describe('computeGap', () => {
  it('returns initial gap at score 0', () => {
    expect(computeGap(0)).toBe(INITIAL_GAP)
  })

  it('shrinks after each interval', () => {
    expect(computeGap(SPEED_INTERVAL)).toBeLessThan(INITIAL_GAP)
  })

  it('never goes below MIN_GAP', () => {
    expect(computeGap(9999)).toBe(MIN_GAP)
  })
})

describe('applyGravity', () => {
  it('increases vy by GRAVITY', () => {
    expect(applyGravity(0)).toBe(GRAVITY)
    expect(applyGravity(5)).toBe(5 + GRAVITY)
  })
})

describe('applyJump', () => {
  it('returns JUMP_VY as a negative upward velocity', () => {
    expect(applyJump()).toBe(JUMP_VY)
    expect(JUMP_VY).toBeLessThan(0)
  })
})

describe('nextY', () => {
  it('adds vy to y', () => {
    expect(nextY(100, 5)).toBe(105)
    expect(nextY(100, -3)).toBe(97)
  })
})

describe('spawnObstacle', () => {
  it('places obstacle at right edge of game', () => {
    const obs = spawnObstacle('id1', 400, 600, 0)
    expect(obs.x).toBe(400)
    expect(obs.id).toBe('id1')
    expect(obs.gapSize).toBe(INITIAL_GAP)
    expect(obs.gapTop).toBeGreaterThan(0)
    expect(obs.gapTop + obs.gapSize).toBeLessThan(600 - GRASS_H)
  })

  it('gap shrinks with score', () => {
    const obs = spawnObstacle('id2', 400, 600, 9999)
    expect(obs.gapSize).toBe(MIN_GAP)
  })

  it('adds snake and fence presence types to each obstacle', () => {
    const rolls = [0.4, 0.2]
    const obs = spawnObstacle('id3', 400, 600, 0, () => rolls.shift())
    expect(TOP_OBSTACLE_TYPES).toContain(obs.topType)
    expect(BOTTOM_OBSTACLE_TYPES).toContain(obs.bottomType)
    expect(obs.topType).toBe('none')
    expect(obs.bottomType).toBe('fence')
  })
})

describe('selectObstacleVisual', () => {
  it('starts with mostly one-sided obstacles', () => {
    expect(selectObstacleVisual(0, () => 0.1)).toEqual({ topType: 'none', bottomType: 'fence' })
    expect(selectObstacleVisual(0, () => 0.6)).toEqual({ topType: 'snake', bottomType: 'none' })
    expect(selectObstacleVisual(0, () => 0.95)).toEqual({ topType: 'snake', bottomType: 'fence' })
  })

  it('allows more combined snake and fence obstacles as score rises', () => {
    expect(selectObstacleVisual(20, () => 0.65)).toEqual({ topType: 'snake', bottomType: 'fence' })
  })
})

describe('tickObstacles', () => {
  it('moves obstacles left by speed', () => {
    const obs = [{ id: 'a', x: 200, gapTop: 100, gapSize: 180, scored: false }]
    const result = tickObstacles(obs, 3)
    expect(result[0].x).toBe(197)
  })

  it('removes obstacles that scroll off screen', () => {
    const obs = [{ id: 'a', x: -OBS_WIDTH - 20, gapTop: 100, gapSize: 180, scored: false }]
    const result = tickObstacles(obs, 3)
    expect(result).toHaveLength(0)
  })
})

describe('checkCollision', () => {
  const gameH = 600

  it('returns true when capybara hits ceiling', () => {
    expect(checkCollision(-CAPY_HIT_Y - 1, [], gameH)).toBe(true)
  })

  it('returns true when capybara hits floor', () => {
    expect(checkCollision(gameH - GRASS_H - CAPY_HIT_Y - CAPY_HIT_H + 1, [], gameH)).toBe(true)
  })

  it('ignores transparent sprite padding at the ceiling and floor', () => {
    expect(checkCollision(-CAPY_HIT_Y + 1, [], gameH)).toBe(false)
    expect(checkCollision(gameH - GRASS_H - CAPY_H + 1, [], gameH)).toBe(false)
  })

  it('returns false when capybara is in open sky', () => {
    expect(checkCollision(200, [], gameH)).toBe(false)
  })

  it('returns false when capybara is in the gap', () => {
    const obs = [{ x: CAPY_X - 10, gapTop: 180, gapSize: 200, scored: false }]
    expect(checkCollision(200, obs, gameH)).toBe(false)
  })

  it('returns true when capybara hits anaconda', () => {
    const obs = [{ x: CAPY_X - 10, gapTop: 300, gapSize: 200, scored: false, topType: 'snake', bottomType: 'fence' }]
    expect(checkCollision(100, obs, gameH)).toBe(true)
  })

  it('returns true when capybara hits fence', () => {
    const obs = [{ x: CAPY_X - 10, gapTop: 100, gapSize: 200, scored: false, topType: 'snake', bottomType: 'fence' }]
    expect(checkCollision(350, obs, gameH)).toBe(true)
  })

  it('does not collide with missing top obstacle on fence-only spawns', () => {
    const obs = [{ x: CAPY_X - 10, gapTop: 300, gapSize: 200, scored: false, topType: 'none', bottomType: 'fence' }]
    expect(checkCollision(100, obs, gameH)).toBe(false)
  })

  it('does not collide with missing bottom obstacle on snake-only spawns', () => {
    const obs = [{ x: CAPY_X - 10, gapTop: 100, gapSize: 200, scored: false, topType: 'snake', bottomType: 'none' }]
    expect(checkCollision(350, obs, gameH)).toBe(false)
  })

  it('returns false when obstacle is behind capybara', () => {
    const obs = [{ x: CAPY_X - OBS_WIDTH - 10, gapTop: 300, gapSize: 200, scored: false }]
    expect(checkCollision(100, obs, gameH)).toBe(false)
  })

  it('returns false when obstacle is ahead and not yet reached', () => {
    const obs = [{ x: CAPY_X + CAPY_W + 10, gapTop: 300, gapSize: 200, scored: false }]
    expect(checkCollision(100, obs, gameH)).toBe(false)
  })

  it('uses the capybara body instead of the full sprite rectangle for obstacle hits', () => {
    const obs = [{
      x: CAPY_X + CAPY_HIT_X + CAPY_HIT_W + 1,
      gapTop: 300,
      gapSize: 200,
      scored: false,
      topType: 'snake',
      bottomType: 'fence',
    }]
    expect(checkCollision(100, obs, gameH)).toBe(false)
  })
})

describe('shouldShowDeathOverlay', () => {
  it('waits until the death animation has had enough real time before showing score overlay', () => {
    expect(shouldShowDeathOverlay(0, 0)).toBe(false)
    expect(shouldShowDeathOverlay(DEATH_OVERLAY_FRAMES, DEATH_OVERLAY_MS - 1)).toBe(false)
    expect(shouldShowDeathOverlay(0, DEATH_OVERLAY_MS)).toBe(true)
  })
})
