import {
  BOUNCE_FACTOR,
  CONTACT_MAX_Z,
  CONTACT_MIN_Z,
  COURT_BOTTOM,
  COURT_TOP,
  FIXED_STEP_MS,
  GRAVITY,
  MAX_FRAME_MS,
  NET_Y,
  PLAYER_BASE_SPEED,
  PLAYER_NET_GAP,
  PLAYER_SPEED_PER_STAT,
} from './config.js'

export const AI_LEVELS = {
  easy: {
    reactionMs: 360,
    targetError: 76,
    recoveryBias: 0.35,
    shotWidth: 0.28,
    shotDepth: 0.25,
  },
  normal: {
    reactionMs: 210,
    targetError: 38,
    recoveryBias: 0.55,
    shotWidth: 0.56,
    shotDepth: 0.5,
  },
  hard: {
    reactionMs: 105,
    targetError: 14,
    recoveryBias: 0.72,
    shotWidth: 0.86,
    shotDepth: 0.72,
  },
}

const normalize = ({ x, y }) => {
  const magnitude = Math.hypot(x, y)
  return magnitude > 1 ? { x: x / magnitude, y: y / magnitude } : { x, y }
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function receivingBounds(playerIndex) {
  return playerIndex === 1
    ? { minY: COURT_TOP, maxY: NET_Y - PLAYER_NET_GAP }
    : { minY: NET_Y + PLAYER_NET_GAP, maxY: COURT_BOTTOM }
}

function canReach(player, target, elapsedSeconds) {
  const speed = PLAYER_BASE_SPEED + player.build.footwork * PLAYER_SPEED_PER_STAT
  return Math.hypot(target.x - player.x, target.y - player.y) <= speed * elapsedSeconds
}

function predictReturnTarget(simulation, playerIndex) {
  const player = simulation.players[playerIndex]
  const bounds = receivingBounds(playerIndex)
  const ball = {
    x: simulation.ball.x,
    y: simulation.ball.y,
    z: simulation.ball.z,
    vx: simulation.ball.vx,
    vy: simulation.ball.vy,
    vz: simulation.ball.vz,
    groundContacts: simulation.ball.groundContacts ?? 0,
  }
  const stepSeconds = FIXED_STEP_MS / 1000

  for (let elapsedMs = FIXED_STEP_MS; elapsedMs <= 2400; elapsedMs += FIXED_STEP_MS) {
    const previous = { x: ball.x, y: ball.y, z: ball.z }
    ball.x += ball.vx * stepSeconds
    ball.y += ball.vy * stepSeconds
    ball.z += ball.vz * stepSeconds
    ball.vz -= GRAVITY * stepSeconds

    if (ball.z <= 0 && ball.vz < 0) {
      if (ball.groundContacts >= 1) return null
      const fraction = clamp(previous.z / (previous.z - ball.z), 0, 1)
      ball.x = previous.x + (ball.x - previous.x) * fraction
      ball.y = previous.y + (ball.y - previous.y) * fraction
      ball.z = 0
      ball.groundContacts = 1
      ball.vz = Math.abs(ball.vz) * BOUNCE_FACTOR
    }

    const inReceiverHalf = ball.y >= bounds.minY && ball.y <= bounds.maxY
    const contactable =
      ball.groundContacts > 0 &&
      ball.z >= CONTACT_MIN_Z &&
      ball.z <= CONTACT_MAX_Z &&
      inReceiverHalf
    const target = {
      x: ball.x,
      y: clamp(ball.y, bounds.minY, bounds.maxY),
    }
    if (contactable && canReach(player, target, elapsedMs / 1000)) return target
  }

  return null
}

export function createAiState(difficulty) {
  const profile = AI_LEVELS[difficulty]
  if (!profile) throw new Error(`Unknown laptop difficulty: ${difficulty}`)
  return {
    difficulty,
    reactionMs: profile.reactionMs,
    cooldownMs: profile.reactionMs,
    movement: { x: 0, y: 0 },
    shotAim: { x: 0, y: 0 },
  }
}

function chooseDecision(ai, simulation, playerIndex, rng) {
  const profile = AI_LEVELS[ai.difficulty]
  const player = simulation.players[playerIndex]
  const ballApproaches = playerIndex === 1
    ? simulation.ball.vy < 0
    : simulation.ball.vy > 0
  const interceptionError = (rng() * 2 - 1) * profile.targetError
  const predictedTarget = ballApproaches ? predictReturnTarget(simulation, playerIndex) : null
  const targetX = ballApproaches
    ? (predictedTarget?.x ?? simulation.ball.x) + interceptionError
    : 240
  const homeY = playerIndex === 1 ? 120 : 600
  const targetY = predictedTarget?.y ?? (
    ballApproaches
      ? simulation.ball.y + (playerIndex === 1 ? -34 : 34)
      : player.y + (homeY - player.y) * profile.recoveryBias
  )
  ai.movement = normalize({
    x: (targetX - player.x) / 80,
    y: (targetY - player.y) / 80,
  })

  const shotSide = rng() < 0.5 ? -1 : 1
  const direction = playerIndex === 0 ? -1 : 1
  ai.shotAim = {
    x: shotSide * profile.shotWidth,
    y: direction * profile.shotDepth,
  }
}

export function updateAi(ai, simulation, playerIndex, elapsedMs, rng = Math.random) {
  if (simulation.phase !== 'rally') return ai.movement
  ai.cooldownMs -= Math.min(Math.max(0, elapsedMs), MAX_FRAME_MS)
  while (ai.cooldownMs <= 0) {
    chooseDecision(ai, simulation, playerIndex, rng)
    ai.cooldownMs += ai.reactionMs
  }
  return ai.movement
}
