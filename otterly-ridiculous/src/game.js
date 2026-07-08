/*
 * Otterly Ridiculous
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

// --- World -----------------------------------------------------------------
export const WORLD_W = 480
export const WORLD_H = 640
export const SHORE = 0
export const GRASS_H = 80 // top grass bank the panda sits on; items land below it
export const PANDA_X = WORLD_W / 2
export const PANDA_Y = 6

// --- Otter -----------------------------------------------------------------
export const OTTER_RADIUS = 11
export const TURN_RATE = 4.0 // rad/s max steering toward the pointer target
export const POINTER_DEADZONE = 40 // px: cursor closer than this = swim straight, don't orbit
export const INITIAL_SPEED = 140 // px/s
export const MAX_SPEED = 220
export const SPEED_STEP = 10

// --- Items -----------------------------------------------------------------
export const ITEM_RADIUS = 9
export const PICKUP_RADIUS = 26
export const FLIGHT_MS = 600
export const DESPAWN_MS = 6000
export const FISH_SHARE = 0.6 // fish share of non-plastic throws
export const OTTER_AVOID = 64 // px: items won't land this close to the otter

// --- Chain -----------------------------------------------------------------
export const ROUND_ITEM_TARGET = 21
export const CHAIN_SPACING = 22
export const SELF_HIT_SKIP = 2

// --- Lives -----------------------------------------------------------------
export const MAX_LIVES = 3
export const INVINCIBLE_MS = 2000

// --- Ramp ------------------------------------------------------------------
export const RAMP_STEP_POINTS = 20
export const INITIAL_THROW_MS = 1600
export const MIN_THROW_MS = 700
export const THROW_MS_STEP = 150
export const INITIAL_PLASTIC_RATIO = 0.15
export const MAX_PLASTIC_RATIO = 0.35
export const PLASTIC_RATIO_STEP = 0.04

const HS_KEY = 'otterly-ridiculous:highscore'

function rampSteps(score) {
  return Math.floor(score / RAMP_STEP_POINTS)
}

export function computeThrowInterval(score) {
  return Math.max(INITIAL_THROW_MS - rampSteps(score) * THROW_MS_STEP, MIN_THROW_MS)
}

export function computePlasticRatio(score, multiplier = 1) {
  const multiplierSteps = Math.max(0, multiplier - 1)
  return Math.min(
    INITIAL_PLASTIC_RATIO + (rampSteps(score) + multiplierSteps) * PLASTIC_RATIO_STEP,
    MAX_PLASTIC_RATIO,
  )
}

export function computeSpeed(score) {
  return Math.min(INITIAL_SPEED + rampSteps(score) * SPEED_STEP, MAX_SPEED)
}

function worldW(state) {
  return state.worldW ?? WORLD_W
}

function worldH(state) {
  return state.worldH ?? WORLD_H
}

function pandaX(state) {
  return worldW(state) / 2
}

export function resizeWorld(state, nextW, nextH) {
  const prevW = worldW(state)
  const prevH = worldH(state)
  if (nextW <= 0 || nextH <= 0 || (nextW === prevW && nextH === prevH)) return

  const scaleX = nextW / prevW
  const scaleY = nextH / prevH
  state.x *= scaleX
  state.y *= scaleY
  state.worldW = nextW
  state.worldH = nextH
  state.path = state.path.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }))
  state.items = state.items.map((item) => ({
    ...item,
    x: item.x * scaleX,
    y: item.y * scaleY,
    fromX: item.fromX * scaleX,
    fromY: item.fromY * scaleY,
  }))
  if (state.steer.mode === 'pointer') {
    state.steer = {
      ...state.steer,
      targetX: state.steer.targetX * scaleX,
      targetY: state.steer.targetY * scaleY,
    }
  }
}

export function createGame({ worldW: nextW = WORLD_W, worldH: nextH = WORLD_H } = {}) {
  return {
    phase: 'idle', // idle | playing | gameover
    worldW: nextW,
    worldH: nextH,
    x: nextW / 2,
    y: nextH / 2,
    heading: -Math.PI / 2,
    steer: { mode: 'none' },
    path: [], // recent head positions, newest first
    chain: [], // towed items: { type }
    items: [], // lake items: { id, type, variant, x, y, fromX, fromY, airMs, floatMs }
    nextItemId: 1,
    throwCooldownMs: INITIAL_THROW_MS,
    score: 0,
    bankedScore: 0,
    multiplier: 1,
    lives: MAX_LIVES,
    invincibleMs: 0,
  }
}

export function startRun(options) {
  const state = createGame(options)
  state.phase = 'playing'
  return state
}

export function loadHighScore() {
  if (typeof localStorage === 'undefined') return 0
  const raw = Number(localStorage.getItem(HS_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function saveHighScore(score) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(HS_KEY, String(score))
}

const DIRECTION_ANGLES = {
  up: -Math.PI / 2,
  down: Math.PI / 2,
  left: Math.PI,
  right: 0,
}

export function setPointerTarget(state, x, y) {
  state.steer = { mode: 'pointer', targetX: x, targetY: y }
}

export function setDirection(state, dir) {
  state.steer = { mode: 'direction', targetAngle: DIRECTION_ANGLES[dir] }
}

function steerHeading(state, dt) {
  let target
  if (state.steer.mode === 'pointer') {
    const dx = state.steer.targetX - state.x
    const dy = state.steer.targetY - state.y
    // Cursor sitting near the otter would make it orbit the point; swim straight instead.
    if (dx * dx + dy * dy < POINTER_DEADZONE * POINTER_DEADZONE) return
    target = Math.atan2(dy, dx)
  } else if (state.steer.mode === 'direction') {
    target = state.steer.targetAngle
  } else {
    return
  }

  let diff = target - state.heading
  while (diff > Math.PI) diff -= 2 * Math.PI
  while (diff < -Math.PI) diff += 2 * Math.PI

  const maxTurn = TURN_RATE * dt
  state.heading += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn
}

function trimPath(state) {
  const maxLen = (state.chain.length + 2) * CHAIN_SPACING
  let walked = 0
  let prev = { x: state.x, y: state.y }
  for (let i = 0; i < state.path.length; i++) {
    walked += Math.hypot(state.path[i].x - prev.x, state.path[i].y - prev.y)
    prev = state.path[i]
    if (walked > maxLen) {
      state.path.length = i + 1
      return
    }
  }
}

export function chainPositions(state) {
  const positions = []
  if (state.chain.length === 0) return positions

  let need = CHAIN_SPACING
  let walked = 0
  let prev = { x: state.x, y: state.y }

  for (let i = 0; i < state.path.length && positions.length < state.chain.length; i++) {
    const p = state.path[i]
    const seg = Math.hypot(p.x - prev.x, p.y - prev.y)
    while (seg > 0 && walked + seg >= need && positions.length < state.chain.length) {
      const t = (need - walked) / seg
      positions.push({ x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t })
      need += CHAIN_SPACING
    }
    walked += seg
    prev = p
  }

  const tail = state.path[state.path.length - 1] ?? { x: state.x, y: state.y }
  while (positions.length < state.chain.length) positions.push({ x: tail.x, y: tail.y })

  return positions
}

export function pickItemType(score, rng = Math.random, multiplier = 1) {
  const roll = rng()
  const plasticRatio = computePlasticRatio(score, multiplier)
  if (roll < plasticRatio) return 'plastic'
  return (roll - plasticRatio) / (1 - plasticRatio) < FISH_SHARE ? 'fish' : 'rock'
}

export function spawnItem(state, rng = Math.random) {
  const marginX = SHORE + ITEM_RADIUS + 8
  const top = GRASS_H + ITEM_RADIUS + 8 // below the grass bank, never on it
  const bottom = worldH(state) - SHORE - ITEM_RADIUS - 8
  const type = pickItemType(state.score, rng, state.multiplier)
  const variant = type === 'plastic' ? (rng() < 0.5 ? 'bottle' : 'bag') : null

  // Land in open water; re-roll if it would drop right on top of the otter.
  let x = marginX + rng() * (worldW(state) - marginX * 2)
  let y = top + rng() * (bottom - top)
  for (let tries = 0; tries < 8 && Math.hypot(x - state.x, y - state.y) < OTTER_AVOID; tries++) {
    x = marginX + rng() * (worldW(state) - marginX * 2)
    y = top + rng() * (bottom - top)
  }

  return {
    id: state.nextItemId++,
    type,
    variant,
    x,
    y,
    fromX: pandaX(state),
    fromY: PANDA_Y + 40,
    airMs: FLIGHT_MS,
    floatMs: 0,
  }
}

function refreshScore(state) {
  state.score = state.bankedScore + state.chain.length * state.multiplier
}

function bankCompletedRounds(state) {
  while (state.chain.length >= ROUND_ITEM_TARGET) {
    state.bankedScore += ROUND_ITEM_TARGET * state.multiplier
    state.multiplier += 1
    state.chain.splice(0, ROUND_ITEM_TARGET)
    state.path = []
  }
  refreshScore(state)
}

function endRun(state) {
  state.phase = 'gameover'
  state.chain = []
}

export function tick(state, dtMs, rng = Math.random) {
  if (state.phase !== 'playing') return
  const dt = dtMs / 1000

  steerHeading(state, dt)

  const speed = computeSpeed(state.score)
  state.path.unshift({ x: state.x, y: state.y })
  trimPath(state)
  state.x += Math.cos(state.heading) * speed * dt
  state.y += Math.sin(state.heading) * speed * dt

  if (state.invincibleMs > 0) state.invincibleMs = Math.max(0, state.invincibleMs - dtMs)

  // Panda throws
  state.throwCooldownMs -= dtMs
  while (state.throwCooldownMs <= 0) {
    state.items.push(spawnItem(state, rng))
    state.throwCooldownMs += computeThrowInterval(state.score)
  }

  // Item lifecycle: flight, floating age, despawn
  for (const item of state.items) {
    if (item.airMs > 0) item.airMs = Math.max(0, item.airMs - dtMs)
    else item.floatMs += dtMs
  }
  state.items = state.items.filter((item) => item.airMs > 0 || item.floatMs < DESPAWN_MS)

  // Shore edge: instant game over
  if (
    state.x < SHORE + OTTER_RADIUS ||
    state.x > worldW(state) - SHORE - OTTER_RADIUS ||
    state.y < SHORE + OTTER_RADIUS ||
    state.y > worldH(state) - SHORE - OTTER_RADIUS
  ) {
    endRun(state)
    return
  }

  // Pickups and plastic hits
  const remaining = []
  for (const item of state.items) {
    if (state.phase !== 'playing' || item.airMs > 0) {
      remaining.push(item)
      continue
    }
    const dist = Math.hypot(item.x - state.x, item.y - state.y)
    if (dist > PICKUP_RADIUS) {
      remaining.push(item)
      continue
    }
    if (item.type === 'plastic') {
      if (state.invincibleMs > 0) remaining.push(item)
      else loseLife(state)
    } else {
      state.chain.push({ type: item.type })
      bankCompletedRounds(state)
    }
  }
  state.items = remaining

  // Self-collision with the towed chain
  if (state.phase === 'playing' && state.invincibleMs === 0) {
    const positions = chainPositions(state)
    for (let i = SELF_HIT_SKIP; i < positions.length; i++) {
      const dist = Math.hypot(positions[i].x - state.x, positions[i].y - state.y)
      if (dist < OTTER_RADIUS + ITEM_RADIUS) {
        loseLife(state)
        break
      }
    }
  }
}

export function loseLife(state) {
  state.lives -= 1
  const released = Math.floor(state.chain.length / 2)
  for (let i = 0; i < released; i++) state.chain.pop()
  refreshScore(state)
  if (state.lives <= 0) {
    endRun(state)
  } else {
    state.invincibleMs = INVINCIBLE_MS
  }
}
