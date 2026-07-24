import { MAX_FRAME_MS } from './config.js'

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
  const targetX = ballApproaches ? simulation.ball.x + interceptionError : 240
  const homeY = playerIndex === 1 ? 120 : 600
  const targetY = ballApproaches
    ? simulation.ball.y + (playerIndex === 1 ? -34 : 34)
    : player.y + (homeY - player.y) * profile.recoveryBias
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
