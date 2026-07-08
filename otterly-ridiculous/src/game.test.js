/*
 * Otterly Ridiculous - game logic tests.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  WORLD_W,
  WORLD_H,
  MAX_LIVES,
  INITIAL_THROW_MS,
  MIN_THROW_MS,
  INITIAL_PLASTIC_RATIO,
  MAX_PLASTIC_RATIO,
  INITIAL_SPEED,
  MAX_SPEED,
  TURN_RATE,
  CHAIN_SPACING,
  SHORE,
  GRASS_H,
  ITEM_RADIUS,
  FLIGHT_MS,
  DESPAWN_MS,
  FISH_SHARE,
  OTTER_RADIUS,
  PICKUP_RADIUS,
  INVINCIBLE_MS,
  ROUND_ITEM_TARGET,
  computeThrowInterval,
  computePlasticRatio,
  computeSpeed,
  createGame,
  startRun,
  loadHighScore,
  saveHighScore,
  setPointerTarget,
  setDirection,
  tick,
  chainPositions,
  pickItemType,
  spawnItem,
  loseLife,
} from './game.js'

function floatingItem(state, type, x, y, variant = null) {
  return {
    id: state.nextItemId++,
    type,
    variant,
    x,
    y,
    fromX: 0,
    fromY: 0,
    airMs: 0,
    floatMs: 0,
  }
}

describe('difficulty ramp', () => {
  it('starts at the initial throw interval and shrinks per 20 points', () => {
    expect(computeThrowInterval(0)).toBe(INITIAL_THROW_MS)
    expect(computeThrowInterval(19)).toBe(INITIAL_THROW_MS)
    expect(computeThrowInterval(20)).toBe(INITIAL_THROW_MS - 150)
    expect(computeThrowInterval(40)).toBe(INITIAL_THROW_MS - 300)
  })

  it('never throws faster than the minimum interval', () => {
    expect(computeThrowInterval(100000)).toBe(MIN_THROW_MS)
  })

  it('plastic ratio ramps up and caps', () => {
    expect(computePlasticRatio(0)).toBeCloseTo(INITIAL_PLASTIC_RATIO)
    expect(computePlasticRatio(20)).toBeCloseTo(INITIAL_PLASTIC_RATIO + 0.04)
    expect(computePlasticRatio(100000)).toBeCloseTo(MAX_PLASTIC_RATIO)
  })

  it('plastic ratio increases with each multiplier round', () => {
    expect(computePlasticRatio(0, 1)).toBeCloseTo(INITIAL_PLASTIC_RATIO)
    expect(computePlasticRatio(0, 2)).toBeCloseTo(INITIAL_PLASTIC_RATIO + 0.04)
    expect(computePlasticRatio(0, 3)).toBeCloseTo(INITIAL_PLASTIC_RATIO + 0.08)
    expect(computePlasticRatio(0, 100)).toBeCloseTo(MAX_PLASTIC_RATIO)
  })

  it('otter speed ramps up and caps', () => {
    expect(computeSpeed(0)).toBe(INITIAL_SPEED)
    expect(computeSpeed(20)).toBe(INITIAL_SPEED + 10)
    expect(computeSpeed(100000)).toBe(MAX_SPEED)
  })
})

describe('createGame / startRun', () => {
  it('creates an idle game with the otter centered and full lives', () => {
    const state = createGame()
    expect(state.phase).toBe('idle')
    expect(state.x).toBe(WORLD_W / 2)
    expect(state.y).toBe(WORLD_H / 2)
    expect(state.lives).toBe(MAX_LIVES)
    expect(state.score).toBe(0)
    expect(state.multiplier).toBe(1)
    expect(state.bankedScore).toBe(0)
    expect(state.chain).toEqual([])
    expect(state.items).toEqual([])
    expect(state.path).toEqual([])
    expect(state.invincibleMs).toBe(0)
  })

  it('startRun returns a fresh playing state', () => {
    const state = startRun()
    expect(state.phase).toBe('playing')
    expect(state.score).toBe(0)
    expect(state.multiplier).toBe(1)
    expect(state.bankedScore).toBe(0)
    expect(state.lives).toBe(MAX_LIVES)
  })

  it('can create a game for a custom screen-sized world', () => {
    const state = createGame({ worldW: 1200, worldH: 700 })
    expect(state.worldW).toBe(1200)
    expect(state.worldH).toBe(700)
    expect(state.x).toBe(600)
    expect(state.y).toBe(350)
  })
})

describe('high score persistence', () => {
  const store = new Map()

  beforeEach(() => {
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    }
  })

  afterEach(() => {
    delete globalThis.localStorage
    store.clear()
  })

  it('returns 0 when nothing is stored', () => {
    expect(loadHighScore()).toBe(0)
  })

  it('round-trips a saved score', () => {
    saveHighScore(42)
    expect(loadHighScore()).toBe(42)
  })

  it('ignores garbage values', () => {
    globalThis.localStorage.setItem('otterly-ridiculous:highscore', 'not-a-number')
    expect(loadHighScore()).toBe(0)
  })
})

describe('steering and movement', () => {
  it('does nothing unless playing', () => {
    const state = createGame()
    const before = { x: state.x, y: state.y }
    tick(state, 100)
    expect(state.x).toBe(before.x)
    expect(state.y).toBe(before.y)
  })

  it('moves along its heading at the ramped speed', () => {
    const state = startRun()
    state.heading = 0 // facing right
    tick(state, 1000)
    expect(state.x).toBeCloseTo(WORLD_W / 2 + INITIAL_SPEED, 0)
    expect(state.y).toBeCloseTo(WORLD_H / 2, 0)
  })

  it('turns toward the pointer target at a limited rate', () => {
    const state = startRun()
    state.heading = -Math.PI / 2 // facing up
    setPointerTarget(state, state.x + 1000, state.y) // target directly right
    tick(state, 100)
    expect(state.heading).toBeCloseTo(-Math.PI / 2 + TURN_RATE * 0.1, 3)
  })

  it('snaps a swipe direction as the steering target', () => {
    const state = startRun()
    state.heading = 0
    setDirection(state, 'down')
    tick(state, 1000) // plenty of time to complete the turn
    expect(state.heading).toBeCloseTo(Math.PI / 2, 2)
  })

  it('records the path as it moves', () => {
    const state = startRun()
    state.heading = 0
    tick(state, 100)
    tick(state, 100)
    expect(state.path.length).toBeGreaterThanOrEqual(2)
    // newest first: path[0] is the more recent old position
    expect(state.path[0].x).toBeGreaterThan(state.path[1].x)
  })
})

describe('chainPositions', () => {
  it('returns empty when the chain is empty', () => {
    const state = startRun()
    expect(chainPositions(state)).toEqual([])
  })

  it('spaces items CHAIN_SPACING apart along a straight path', () => {
    const state = startRun()
    state.x = 200
    state.y = 100
    state.path = []
    for (let x = 202; x <= 400; x += 2) state.path.push({ x, y: 100 })
    state.chain = [{ type: 'fish' }, { type: 'rock' }, { type: 'fish' }]

    const positions = chainPositions(state)
    expect(positions).toHaveLength(3)
    expect(positions[0].x).toBeCloseTo(200 + CHAIN_SPACING, 1)
    expect(positions[1].x).toBeCloseTo(200 + CHAIN_SPACING * 2, 1)
    expect(positions[2].x).toBeCloseTo(200 + CHAIN_SPACING * 3, 1)
    for (const p of positions) expect(p.y).toBeCloseTo(100, 1)
  })

  it('stacks extra items at the path end when the path is short', () => {
    const state = startRun()
    state.x = 200
    state.y = 100
    state.path = [{ x: 210, y: 100 }]
    state.chain = [{ type: 'fish' }, { type: 'fish' }]
    const positions = chainPositions(state)
    expect(positions).toHaveLength(2)
  })
})

describe('pickItemType', () => {
  it('returns plastic when the roll lands under the plastic ratio', () => {
    expect(pickItemType(0, () => 0.05)).toBe('plastic')
  })

  it('splits the rest between fish and rock', () => {
    // roll 0.2: (0.2 - 0.15) / 0.85 = 0.058 < FISH_SHARE -> fish
    expect(pickItemType(0, () => 0.2)).toBe('fish')
    // roll 0.9: (0.9 - 0.15) / 0.85 = 0.88 >= FISH_SHARE -> rock
    expect(pickItemType(0, () => 0.9)).toBe('rock')
  })

  it('throws more plastic at higher scores', () => {
    // roll 0.2 is plastic once the ratio has ramped past 0.2 (score 40: 0.15 + 2*0.04 = 0.23)
    expect(pickItemType(40, () => 0.2)).toBe('plastic')
  })

  it('throws more plastic at higher multipliers', () => {
    expect(pickItemType(0, () => 0.16, 1)).toBe('fish')
    expect(pickItemType(0, () => 0.16, 2)).toBe('plastic')
  })
})

describe('spawnItem', () => {
  it('lands inside the water margin and starts in flight', () => {
    const state = startRun()
    const item = spawnItem(state, () => 0.5)
    const margin = SHORE + ITEM_RADIUS + 8
    expect(item.x).toBeGreaterThanOrEqual(margin)
    expect(item.x).toBeLessThanOrEqual(WORLD_W - margin)
    expect(item.y).toBeGreaterThanOrEqual(margin)
    expect(item.y).toBeLessThanOrEqual(WORLD_H - margin)
    expect(item.airMs).toBe(FLIGHT_MS)
    expect(item.floatMs).toBe(0)
  })

  it('lands inside the current screen-sized world', () => {
    const state = startRun({ worldW: 1200, worldH: 700 })
    const item = spawnItem(state, () => 0.5)
    const margin = SHORE + ITEM_RADIUS + 8
    expect(item.x).toBeGreaterThanOrEqual(margin)
    expect(item.x).toBeLessThanOrEqual(state.worldW - margin)
    expect(item.y).toBeGreaterThanOrEqual(GRASS_H + ITEM_RADIUS + 8)
    expect(item.y).toBeLessThanOrEqual(state.worldH - margin)
    expect(item.fromX).toBe(state.worldW / 2)
  })

  it('assigns unique ids', () => {
    const state = startRun()
    const a = spawnItem(state, () => 0.5)
    const b = spawnItem(state, () => 0.5)
    expect(a.id).not.toBe(b.id)
  })

  it('gives plastic a bottle or bag variant', () => {
    const state = startRun()
    const item = spawnItem(state, () => 0.01)
    expect(item.type).toBe('plastic')
    expect(['bottle', 'bag']).toContain(item.variant)
  })

  it('uses the current multiplier when choosing junk throws', () => {
    const state = startRun()
    state.multiplier = 2
    const item = spawnItem(state, () => 0.16)
    expect(item.type).toBe('plastic')
  })
})

describe('throw timer and item lifecycle in tick', () => {
  it('spawns an item when the throw cooldown elapses', () => {
    const state = startRun()
    expect(state.items).toHaveLength(0)
    tick(state, INITIAL_THROW_MS, () => 0.5)
    expect(state.items).toHaveLength(1)
  })

  it('lands flying items and ages floating ones', () => {
    const state = startRun()
    state.items.push({ ...spawnItem(state, () => 0.5), x: 60, y: 600 }) // far from otter
    tick(state, FLIGHT_MS, () => 0.99)
    const item = state.items.find((i) => i.x === 60)
    expect(item.airMs).toBe(0)
    tick(state, 500, () => 0.99)
    expect(item.floatMs).toBeGreaterThanOrEqual(500)
  })

  it('despawns items after DESPAWN_MS afloat', () => {
    const state = startRun()
    const item = { ...spawnItem(state, () => 0.5), x: 60, y: 600, airMs: 0, floatMs: DESPAWN_MS - 10 }
    state.items.push(item)
    tick(state, 50, () => 0.99)
    expect(state.items.find((i) => i.id === item.id)).toBeUndefined()
  })
})

describe('pickups and scoring', () => {
  it('collects a fish into the chain and scores 1 at the starting multiplier', () => {
    const state = startRun()
    state.heading = 0
    state.items.push(floatingItem(state, 'fish', state.x + 5, state.y))
    tick(state, 16, () => 0.99)
    expect(state.chain).toEqual([{ type: 'fish' }])
    expect(state.score).toBe(1)
    expect(state.multiplier).toBe(1)
    expect(state.items.filter((i) => i.type === 'fish')).toHaveLength(0)
  })

  it('collects each non-plastic item for the current multiplier value', () => {
    const state = startRun()
    state.heading = 0
    state.multiplier = 3
    state.items.push(floatingItem(state, 'rock', state.x + 5, state.y))
    tick(state, 16, () => 0.99)
    expect(state.score).toBe(3)
  })

  it('does not collect items still in flight', () => {
    const state = startRun()
    state.heading = 0
    const item = { ...floatingItem(state, 'fish', state.x + 5, state.y), airMs: 300 }
    state.items.push(item)
    tick(state, 16, () => 0.99)
    expect(state.chain).toHaveLength(0)
  })

  it('banks 20 carried items, clears the chain, and increases the multiplier', () => {
    const state = startRun()
    state.heading = 0
    state.chain = Array.from({ length: ROUND_ITEM_TARGET - 1 }, () => ({ type: 'rock' }))
    state.score = ROUND_ITEM_TARGET - 1
    state.items.push(floatingItem(state, 'fish', state.x + 5, state.y))

    tick(state, 16, () => 0.99)

    expect(state.chain).toHaveLength(0)
    expect(state.bankedScore).toBe(ROUND_ITEM_TARGET)
    expect(state.score).toBe(ROUND_ITEM_TARGET)
    expect(state.multiplier).toBe(2)
  })

  it('discards unbanked multiplier-round points when the run ends', () => {
    const state = startRun()
    state.multiplier = 2
    state.bankedScore = ROUND_ITEM_TARGET
    state.score = ROUND_ITEM_TARGET + 10
    state.lives = 1
    state.chain = Array.from({ length: 5 }, () => ({ type: 'fish' }))

    loseLife(state)

    expect(state.phase).toBe('gameover')
    expect(state.score).toBe(ROUND_ITEM_TARGET)
    expect(state.chain).toHaveLength(0)
  })
})

describe('loseLife', () => {
  it('releases the most recent half of the chain and refreshes the multiplier score', () => {
    const state = startRun()
    state.chain = [
      { type: 'fish' },
      { type: 'fish' },
      { type: 'rock' },
      { type: 'rock' },
      { type: 'fish' },
      { type: 'rock' },
      { type: 'fish' },
    ]
    state.score = 7
    loseLife(state)
    // floor(7/2) = 3 released from the end; the remaining 4 items are worth 1 each.
    expect(state.chain).toHaveLength(4)
    expect(state.chain.map((c) => c.type)).toEqual(['fish', 'fish', 'rock', 'rock'])
    expect(state.score).toBe(4)
    expect(state.lives).toBe(MAX_LIVES - 1)
    expect(state.invincibleMs).toBe(INVINCIBLE_MS)
  })

  it('ends the game at zero lives', () => {
    const state = startRun()
    state.lives = 1
    loseLife(state)
    expect(state.phase).toBe('gameover')
  })
})

describe('plastic hits', () => {
  it('costs a life and removes the plastic', () => {
    const state = startRun()
    state.heading = 0
    state.items.push(floatingItem(state, 'plastic', state.x + 5, state.y, 'bottle'))
    tick(state, 16, () => 0.99)
    expect(state.lives).toBe(MAX_LIVES - 1)
    expect(state.invincibleMs).toBeGreaterThan(0)
    expect(state.items.filter((i) => i.type === 'plastic')).toHaveLength(0)
  })

  it('passes through plastic while invincible', () => {
    const state = startRun()
    state.heading = 0
    state.invincibleMs = 1000
    state.items.push(floatingItem(state, 'plastic', state.x + 5, state.y, 'bag'))
    tick(state, 16, () => 0.99)
    expect(state.lives).toBe(MAX_LIVES)
    expect(state.items.filter((i) => i.type === 'plastic')).toHaveLength(1)
  })
})

describe('shore edge', () => {
  it('is an instant game over regardless of lives', () => {
    const state = startRun()
    state.x = SHORE + OTTER_RADIUS + 1
    state.y = WORLD_H / 2
    state.heading = Math.PI // swimming left into the shore
    tick(state, 200, () => 0.99)
    expect(state.phase).toBe('gameover')
    expect(state.lives).toBe(MAX_LIVES) // lives untouched - the edge skips the life system
  })
})

describe('self-collision', () => {
  it('loses a life when circling into its own chain', () => {
    const state = startRun()
    state.chain = Array.from({ length: 14 }, () => ({ type: 'rock' }))
    state.score = 14
    // steer in the tightest possible circle: pointer target always hard left of heading
    for (let i = 0; i < 400 && state.lives === MAX_LIVES && state.phase === 'playing'; i++) {
      setPointerTarget(
        state,
        state.x + Math.cos(state.heading + Math.PI / 2) * 100,
        state.y + Math.sin(state.heading + Math.PI / 2) * 100,
      )
      tick(state, 16, () => 0.99)
    }
    expect(state.lives).toBe(MAX_LIVES - 1)
    expect(state.chain).toHaveLength(7)
  })

  it('ignores the chain while invincible', () => {
    const state = startRun()
    state.chain = Array.from({ length: 14 }, () => ({ type: 'rock' }))
    state.invincibleMs = 100000
    for (let i = 0; i < 400 && state.phase === 'playing'; i++) {
      setPointerTarget(
        state,
        state.x + Math.cos(state.heading + Math.PI / 2) * 100,
        state.y + Math.sin(state.heading + Math.PI / 2) * 100,
      )
      tick(state, 16, () => 0.99)
    }
    expect(state.lives).toBe(MAX_LIVES)
  })
})
