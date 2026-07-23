import { STAT_BUDGET, STAT_MAX, STAT_MIN } from './config.js'

export const STAT_KEYS = ['forehand', 'backhand', 'serve', 'footwork']
export const POINT_REASONS = ['out', 'net', 'double-bounce']

export function balancedBuild() {
  return { forehand: 5, backhand: 5, serve: 5, footwork: 5 }
}

export function validateBuild(build) {
  const values = STAT_KEYS.map((key) => Number(build?.[key]))
  if (values.some((value) => !Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX)) {
    return { valid: false, remaining: NaN, error: `Each stat must be ${STAT_MIN}-${STAT_MAX}.` }
  }
  const spent = values.reduce((sum, value) => sum + value, 0)
  const remaining = STAT_BUDGET - spent
  return {
    valid: remaining === 0,
    remaining,
    error: remaining === 0 ? null : `Allocate exactly ${STAT_BUDGET} points.`,
  }
}

export function isMatchWon([left, right]) {
  return Math.max(left, right) >= 7 && Math.abs(left - right) >= 2
}

export function serverForPoint(openingServer, totalPoints) {
  if (totalPoints === 0) return openingServer
  const pairIndex = Math.floor((totalPoints - 1) / 2)
  return pairIndex % 2 === 0 ? 1 - openingServer : openingServer
}

export function createMatch({ players, openingServer = 0 }) {
  if (!Array.isArray(players) || players.length !== 2) throw new Error('Tiebreak needs two players.')
  if (players.some((entry) => !validateBuild(entry.build).valid)) {
    throw new Error('Both players need valid twenty-point builds.')
  }
  return {
    players,
    scores: [0, 0],
    openingServer,
    currentServer: openingServer,
    totalPoints: 0,
    phase: 'countdown',
    lastPoint: null,
  }
}

export function awardPoint(match, winner, reason) {
  if (![0, 1].includes(winner)) throw new Error('Point winner must be player 0 or 1.')
  if (!POINT_REASONS.includes(reason)) throw new Error(`Unknown point reason: ${reason}`)
  const scores = [...match.scores]
  scores[winner] += 1
  const totalPoints = match.totalPoints + 1
  return {
    ...match,
    scores,
    totalPoints,
    currentServer: serverForPoint(match.openingServer, totalPoints),
    phase: isMatchWon(scores) ? 'match-over' : 'point-result',
    lastPoint: { winner, reason },
  }
}

export function createRematch(match) {
  return createMatch({ players: match.players, openingServer: 1 - match.openingServer })
}
