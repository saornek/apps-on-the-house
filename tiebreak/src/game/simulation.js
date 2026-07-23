import {
  BOUNCE_FACTOR,
  CONTACT_MAX_Z,
  CONTACT_MIN_Z,
  COURT_BOTTOM,
  COURT_LEFT,
  COURT_RIGHT,
  COURT_TOP,
  COUNTDOWN_MS,
  FIXED_STEP_MS,
  GRAVITY,
  MAX_FRAME_MS,
  NET_HEIGHT,
  NET_Y,
  PLAYER_BASE_SPEED,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_NET_GAP,
  PLAYER_SPEED_PER_STAT,
  POINT_RESULT_MS,
  REACH_X,
  REACH_Y,
  SERVE_BASE_SPEED,
  SERVE_SPEED_PER_STAT,
  SHOT_BASE_SPEED,
  SHOT_SPEED_PER_STAT,
  SWING_RECOVERY_BASE_MS,
  SWING_RECOVERY_PER_STAT_MS,
  WORLD_W,
} from './config.js'
import { awardPoint } from './match.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const length = (vector) => Math.hypot(vector.x, vector.y)
const normalize = (vector) => {
  const magnitude = length(vector)
  return magnitude > 1 ? { x: vector.x / magnitude, y: vector.y / magnitude } : vector
}
const halfForY = (y) => (y < NET_Y ? 1 : 0)

export const movementSpeed = (build) =>
  PLAYER_BASE_SPEED + build.footwork * PLAYER_SPEED_PER_STAT
export const swingRecovery = (build) =>
  Math.max(180, SWING_RECOVERY_BASE_MS - build.footwork * SWING_RECOVERY_PER_STAT_MS)
export const serveSpeed = (rating) => SERVE_BASE_SPEED + rating * SERVE_SPEED_PER_STAT
export const shotSpeed = (rating) => SHOT_BASE_SPEED + rating * SHOT_SPEED_PER_STAT
export const placementError = (rating, rng = Math.random) =>
  (rng() * 2 - 1) * (10 - rating) * 0.025

export function strokeFor(playerIndex, playerX, ballX) {
  const ballIsRight = ballX >= playerX
  return playerIndex === 0
    ? (ballIsRight ? 'forehand' : 'backhand')
    : (ballIsRight ? 'backhand' : 'forehand')
}

export function createSimulation(match) {
  return {
    match,
    phase: 'countdown',
    countdownMs: COUNTDOWN_MS,
    pointResultMs: 0,
    accumulatorMs: 0,
    serveAim: { x: 0, y: -1 },
    players: [
      {
        x: WORLD_W / 2, y: COURT_BOTTOM - 52, input: { x: 0, y: 0 },
        recoveryMs: 0, pose: 'idle', ...match.players[0],
      },
      {
        x: WORLD_W / 2, y: COURT_TOP + 52, input: { x: 0, y: 0 },
        recoveryMs: 0, pose: 'idle', ...match.players[1],
      },
    ],
    ball: {
      live: false, x: WORLD_W / 2, y: COURT_BOTTOM - 72, z: 28,
      vx: 0, vy: 0, vz: 0, lastHitter: null, bounceHalf: null, bouncesInHalf: 0,
    },
  }
}

export function setMovement(state, playerIndex, vector) {
  state.players[playerIndex].input = normalize({
    x: clamp(Number(vector.x) || 0, -1, 1),
    y: clamp(Number(vector.y) || 0, -1, 1),
  })
}

export function setServeAim(state, vector) {
  state.serveAim = normalize({
    x: clamp(Number(vector.x) || 0, -1, 1),
    y: clamp(Number(vector.y) || 0, -1, 1),
  })
}

export function startServe(state, rng = Math.random) {
  const serverIndex = state.match.currentServer
  const server = state.players[serverIndex]
  const direction = serverIndex === 0 ? -1 : 1
  const speed = serveSpeed(server.build.serve)
  const aimX = clamp(
    state.serveAim.x + placementError(server.build.serve, rng),
    -1,
    1,
  )
  state.phase = 'rally'
  state.match.phase = 'rally'
  state.ball = {
    live: true,
    x: server.x,
    y: server.y + direction * 20,
    z: 42,
    vx: aimX * speed * 0.42,
    vy: direction * speed,
    vz: 225,
    lastHitter: serverIndex,
    bounceHalf: null,
    bouncesInHalf: 0,
  }
  server.pose = 'serve'
  server.recoveryMs = 300
}

function finishPoint(state, winner, reason) {
  state.ball.live = false
  state.match = awardPoint(state.match, winner, reason)
  state.phase = state.match.phase
  state.pointResultMs = POINT_RESULT_MS
  for (const player of state.players) {
    player.input = { x: 0, y: 0 }
    player.pose = 'idle'
  }
}

function movePlayers(state, dt) {
  state.players.forEach((player, index) => {
    player.recoveryMs = Math.max(0, player.recoveryMs - dt * 1000)
    const speed = movementSpeed(player.build)
    player.x = clamp(player.x + player.input.x * speed * dt, PLAYER_MIN_X, PLAYER_MAX_X)
    const minY = index === 0 ? NET_Y + PLAYER_NET_GAP : COURT_TOP
    const maxY = index === 0 ? COURT_BOTTOM : NET_Y - PLAYER_NET_GAP
    player.y = clamp(player.y + player.input.y * speed * dt, minY, maxY)
    if (player.recoveryMs <= 0) {
      player.pose = length(player.input) > 0.05 ? 'run' : 'idle'
    }
  })
}

function returnBall(state, playerIndex, rng) {
  const player = state.players[playerIndex]
  const stroke = strokeFor(playerIndex, player.x, state.ball.x)
  const rating = player.build[stroke]
  const direction = playerIndex === 0 ? -1 : 1
  const aim = length(player.input) > 0.05 ? player.input : { x: 0, y: direction }
  const speed = shotSpeed(rating)
  const aimX = clamp(aim.x + placementError(rating, rng), -1, 1)
  state.ball.vx = aimX * speed * 0.72
  state.ball.vy = direction * speed * (0.78 + Math.abs(aim.y) * 0.22)
  state.ball.vz = 220
  state.ball.lastHitter = playerIndex
  state.ball.bounceHalf = null
  state.ball.bouncesInHalf = 0
  player.pose = stroke
  player.recoveryMs = swingRecovery(player.build)
}

function tryAutomaticReturns(state, rng) {
  for (let index = 0; index < state.players.length; index += 1) {
    const player = state.players[index]
    const ballApproaches = index === 0 ? state.ball.vy > 0 : state.ball.vy < 0
    const inReach =
      Math.abs(state.ball.x - player.x) <= REACH_X &&
      Math.abs(state.ball.y - player.y) <= REACH_Y &&
      state.ball.z >= CONTACT_MIN_Z &&
      state.ball.z <= CONTACT_MAX_Z
    if (state.ball.live && ballApproaches && inReach && player.recoveryMs <= 0) {
      returnBall(state, index, rng)
      return
    }
  }
}

function stepBall(state, dt, rng) {
  if (!state.ball.live) return
  const previousY = state.ball.y
  state.ball.x += state.ball.vx * dt
  state.ball.y += state.ball.vy * dt
  state.ball.z += state.ball.vz * dt
  state.ball.vz -= GRAVITY * dt

  const crossedNet = (previousY - NET_Y) * (state.ball.y - NET_Y) <= 0
  if (crossedNet && state.ball.z < NET_HEIGHT) {
    finishPoint(state, 1 - state.ball.lastHitter, 'net')
    return
  }

  if (state.ball.z <= 0 && state.ball.vz < 0) {
    state.ball.z = 0
    const inside =
      state.ball.x >= COURT_LEFT && state.ball.x <= COURT_RIGHT &&
      state.ball.y >= COURT_TOP && state.ball.y <= COURT_BOTTOM
    if (!inside) {
      finishPoint(state, 1 - state.ball.lastHitter, 'out')
      return
    }
    const bounceHalf = halfForY(state.ball.y)
    state.ball.bouncesInHalf =
      state.ball.bounceHalf === bounceHalf ? state.ball.bouncesInHalf + 1 : 1
    state.ball.bounceHalf = bounceHalf
    if (state.ball.bouncesInHalf >= 2) {
      finishPoint(state, 1 - bounceHalf, 'double-bounce')
      return
    }
    state.ball.vz = Math.abs(state.ball.vz) * BOUNCE_FACTOR
  }

  tryAutomaticReturns(state, rng)
}

function fixedStep(state, dt, rng) {
  if (state.phase === 'countdown') {
    state.countdownMs -= dt * 1000
    if (state.countdownMs <= 0) startServe(state, rng)
    return
  }
  if (state.phase === 'point-result') {
    state.pointResultMs -= dt * 1000
    if (state.pointResultMs <= 0) {
      const next = createSimulation({ ...state.match, phase: 'countdown' })
      Object.assign(state, next)
    }
    return
  }
  if (state.phase !== 'rally') return
  movePlayers(state, dt)
  stepBall(state, dt, rng)
}

export function advanceSimulation(state, elapsedMs, rng = Math.random) {
  state.accumulatorMs += Math.min(Math.max(0, elapsedMs), MAX_FRAME_MS)
  while (state.accumulatorMs + 0.000001 >= FIXED_STEP_MS) {
    fixedStep(state, FIXED_STEP_MS / 1000, rng)
    state.accumulatorMs -= FIXED_STEP_MS
  }
  return state
}
