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
import { createAiState, updateAi } from './ai.js'
import { awardPoint } from './match.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const length = (vector) => Math.hypot(vector.x, vector.y)
const normalize = (vector) => {
  const magnitude = length(vector)
  return magnitude > 1 ? { x: vector.x / magnitude, y: vector.y / magnitude } : vector
}
const halfForY = (y) => (y < NET_Y ? 1 : 0)
const SERVICE_MARGIN = 12
const SERVICE_NET_MARGIN = 52
const RACKET_DIRECTION_DEAD_ZONE = 0.05

function rememberRacketDirection(player, horizontalAim) {
  if (Math.abs(horizontalAim) > RACKET_DIRECTION_DEAD_ZONE) {
    player.racketDirection = horizontalAim < 0 ? -1 : 1
  }
}

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
    cue: null,
    cueId: 0,
    countdownMs: COUNTDOWN_MS,
    pointResultMs: 0,
    accumulatorMs: 0,
    serveAim: { x: 0, y: -1 },
    ai: match.players.map((player) => (
      player.kind === 'ai' ? createAiState(player.difficulty) : null
    )),
    players: [
      {
        x: WORLD_W / 2, y: COURT_BOTTOM - 52, input: { x: 0, y: 0 },
        recoveryMs: 0, pose: 'idle', racketDirection: 1, ...match.players[0],
      },
      {
        x: WORLD_W / 2, y: COURT_TOP + 52, input: { x: 0, y: 0 },
        recoveryMs: 0, pose: 'idle', racketDirection: 1, ...match.players[1],
      },
    ],
    ball: {
      live: false, x: WORLD_W / 2, y: COURT_BOTTOM - 72, z: 28,
      vx: 0, vy: 0, vz: 0, lastHitter: null, bounceHalf: null, bouncesInHalf: 0,
      groundContacts: 0, firstBounceHalf: null,
    },
  }
}

function emitCue(state, name) {
  state.cue = name
  state.cueId += 1
}

export function setMovement(state, playerIndex, vector) {
  const player = state.players[playerIndex]
  const input = normalize({
    x: clamp(Number(vector.x) || 0, -1, 1),
    y: clamp(Number(vector.y) || 0, -1, 1),
  })
  player.input = input
  rememberRacketDirection(player, input.x)
}

export function setServeAim(state, vector) {
  const aim = normalize({
    x: clamp(Number(vector.x) || 0, -1, 1),
    y: clamp(Number(vector.y) || 0, -1, 1),
  })
  state.serveAim = aim
  rememberRacketDirection(state.players[state.match.currentServer], aim.x)
}

export function serviceBoxFor(match) {
  const serverIndex = match.currentServer
  const deucePoint = match.totalPoints % 2 === 0
  const targetLeft = serverIndex === 0 ? deucePoint : !deucePoint
  const centerX = (COURT_LEFT + COURT_RIGHT) / 2
  const receiverIsTop = serverIndex === 0
  const serviceLine = receiverIsTop
    ? COURT_TOP + (NET_Y - COURT_TOP) / 2
    : NET_Y + (COURT_BOTTOM - NET_Y) / 2
  return {
    left: targetLeft ? COURT_LEFT : centerX,
    right: targetLeft ? centerX : COURT_RIGHT,
    top: receiverIsTop ? serviceLine : NET_Y,
    bottom: receiverIsTop ? NET_Y : serviceLine,
  }
}

function serveTarget(state, serverIndex, rng) {
  const server = state.players[serverIndex]
  const direction = serverIndex === 0 ? -1 : 1
  const box = serviceBoxFor(state.match)
  const ratingRange = (server.build.serve - 1) / 8
  const centerX = (box.left + box.right) / 2
  const halfWidth = (box.right - box.left) / 2 - SERVICE_MARGIN
  const usableWidth = halfWidth * (0.58 + ratingRange * 0.36)
  const errorX = placementError(server.build.serve, rng) * halfWidth * 0.45
  const x = clamp(
    centerX + state.serveAim.x * usableWidth + errorX,
    box.left + SERVICE_MARGIN,
    box.right - SERVICE_MARGIN,
  )
  const nearNet = direction < 0
    ? box.bottom - SERVICE_NET_MARGIN
    : box.top + SERVICE_NET_MARGIN
  const deep = direction < 0
    ? box.top + SERVICE_MARGIN
    : box.bottom - SERVICE_MARGIN
  const forward = clamp(state.serveAim.y * direction, -1, 1)
  const depth = (forward + 1) / 2
  const y = nearNet + (deep - nearNet) * depth
  return { x, y }
}

export function startServe(state, rng = Math.random) {
  const serverIndex = state.match.currentServer
  const server = state.players[serverIndex]
  const direction = serverIndex === 0 ? -1 : 1
  const speed = serveSpeed(server.build.serve)
  const x = server.x
  const y = server.y + direction * 20
  const z = 42
  const target = serveTarget(state, serverIndex, rng)
  const distance = Math.hypot(target.x - x, target.y - y)
  const flightTime = distance / speed
  state.phase = 'rally'
  state.match.phase = 'rally'
  state.ball = {
    live: true,
    x,
    y,
    z,
    vx: (target.x - x) / flightTime,
    vy: (target.y - y) / flightTime,
    vz: (GRAVITY * flightTime * flightTime / 2 - z) / flightTime,
    lastHitter: serverIndex,
    bounceHalf: null,
    bouncesInHalf: 0,
    groundContacts: 0,
    firstBounceHalf: null,
  }
  server.pose = 'serve'
  server.recoveryMs = 300
  emitCue(state, 'serve')
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
  emitCue(
    state,
    state.match.phase === 'match-over'
      ? 'win'
      : reason === 'net' || reason === 'out'
        ? reason
        : 'point',
  )
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
  const aiAim = state.ai?.[playerIndex]?.shotAim
  const aim = aiAim ?? (
    length(player.input) > 0.05 ? player.input : { x: 0, y: direction }
  )
  const speed = shotSpeed(rating)
  rememberRacketDirection(player, aim.x)
  const aimX = clamp(aim.x + placementError(rating, rng), -1, 1)
  const forward = clamp(aim.y * direction, -1, 1)
  state.ball.vx = aimX * speed * 0.72
  state.ball.vy = direction * speed * (0.78 + forward * 0.22)
  state.ball.vz = 220
  state.ball.lastHitter = playerIndex
  state.ball.bounceHalf = null
  state.ball.bouncesInHalf = 0
  state.ball.groundContacts = 0
  state.ball.firstBounceHalf = null
  player.pose = stroke
  player.recoveryMs = swingRecovery(player.build)
  emitCue(state, 'hit')
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
  const previousX = state.ball.x
  const previousY = state.ball.y
  const previousZ = state.ball.z
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
    const contactFraction = clamp(previousZ / (previousZ - state.ball.z), 0, 1)
    state.ball.x = previousX + (state.ball.x - previousX) * contactFraction
    state.ball.y = previousY + (state.ball.y - previousY) * contactFraction
    state.ball.z = 0
    const groundContacts = state.ball.groundContacts ??
      (state.ball.bouncesInHalf > 0 ? 1 : 0)
    if (groundContacts >= 1) {
      finishPoint(state, state.ball.lastHitter, 'double-bounce')
      return
    }
    const inside =
      state.ball.x >= COURT_LEFT && state.ball.x <= COURT_RIGHT &&
      state.ball.y >= COURT_TOP && state.ball.y <= COURT_BOTTOM
    const bounceHalf = halfForY(state.ball.y)
    if (!inside || bounceHalf !== 1 - state.ball.lastHitter) {
      finishPoint(state, 1 - state.ball.lastHitter, 'out')
      return
    }
    state.ball.groundContacts = 1
    state.ball.firstBounceHalf = bounceHalf
    state.ball.bouncesInHalf = 1
    state.ball.bounceHalf = bounceHalf
    state.ball.vz = Math.abs(state.ball.vz) * BOUNCE_FACTOR
    emitCue(state, 'bounce')
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
      const cueId = state.cueId
      const next = createSimulation({ ...state.match, phase: 'countdown' })
      next.cueId = cueId
      Object.assign(state, next)
    }
    return
  }
  if (state.phase !== 'rally') return
  state.ai?.forEach((ai, playerIndex) => {
    if (!ai) return
    const movement = updateAi(ai, state, playerIndex, dt * 1000, rng)
    setMovement(state, playerIndex, movement)
  })
  movePlayers(state, dt)
  stepBall(state, dt, rng)
}

export function advanceSimulation(state, elapsedMs, rng = Math.random) {
  state.accumulatorMs += Math.min(Math.max(0, elapsedMs), MAX_FRAME_MS)
  while (state.accumulatorMs + 0.000001 >= FIXED_STEP_MS) {
    fixedStep(state, FIXED_STEP_MS / 1000, rng)
    state.accumulatorMs = Number((state.accumulatorMs - FIXED_STEP_MS).toFixed(9))
  }
  return state
}
