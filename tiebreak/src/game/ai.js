export const AI_LEVELS = {
  easy: { reactionMs: 360, targetError: 76, recoveryBias: 0.35 },
  normal: { reactionMs: 210, targetError: 38, recoveryBias: 0.55 },
  hard: { reactionMs: 105, targetError: 14, recoveryBias: 0.72 },
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
  }
}

export function updateAi(ai, simulation, playerIndex, elapsedMs, rng = Math.random) {
  const profile = AI_LEVELS[ai.difficulty]
  ai.cooldownMs -= elapsedMs
  if (ai.cooldownMs > 0 || simulation.phase !== 'rally') return ai.movement
  ai.cooldownMs = ai.reactionMs

  const player = simulation.players[playerIndex]
  const ballApproaches = playerIndex === 1
    ? simulation.ball.vy < 0
    : simulation.ball.vy > 0
  const error = (rng() * 2 - 1) * profile.targetError
  const targetX = ballApproaches ? simulation.ball.x + error : 240
  const homeY = playerIndex === 1 ? 120 : 600
  const targetY = ballApproaches
    ? simulation.ball.y + (playerIndex === 1 ? -34 : 34)
    : player.y + (homeY - player.y) * profile.recoveryBias
  ai.movement = normalize({
    x: (targetX - player.x) / 80,
    y: (targetY - player.y) / 80,
  })
  return ai.movement
}
