import { describe, expect, it } from 'vitest'
import {
  balancedBuild,
  validateBuild,
  createMatch,
  isMatchWon,
  serverForPoint,
  awardPoint,
  createRematch,
} from './match.js'

const player = (name) => ({ name, monsterId: 'crumblehorn', build: balancedBuild() })

describe('stat builds', () => {
  it('starts at a balanced twenty-point build', () => {
    expect(balancedBuild()).toEqual({ forehand: 5, backhand: 5, serve: 5, footwork: 5 })
    expect(validateBuild(balancedBuild())).toEqual({ valid: true, remaining: 0, error: null })
  })

  it('rejects totals and values outside the rules', () => {
    expect(validateBuild({ forehand: 9, backhand: 9, serve: 9, footwork: 9 }).valid).toBe(false)
    expect(validateBuild({ forehand: 0, backhand: 9, serve: 6, footwork: 5 }).valid).toBe(false)
  })
})

describe('match scoring', () => {
  it('requires seven points and a two-point lead', () => {
    expect(isMatchWon([7, 5])).toBe(true)
    expect(isMatchWon([7, 6])).toBe(false)
    expect(isMatchWon([12, 10])).toBe(true)
  })

  it('continues through 7-6 and finishes at 8-6', () => {
    let match = createMatch({ players: [player('You'), player('COM')], openingServer: 0 })
    match = { ...match, scores: [6, 6], totalPoints: 12 }
    match = awardPoint(match, 0, 'out')
    expect(match.scores).toEqual([7, 6])
    expect(match.phase).toBe('point-result')
    match = awardPoint(match, 0, 'double-bounce')
    expect(match.scores).toEqual([8, 6])
    expect(match.phase).toBe('match-over')
  })
})

describe('serve rotation', () => {
  it('uses one opening serve followed by groups of two', () => {
    expect(Array.from({ length: 8 }, (_, total) => serverForPoint(0, total))).toEqual(
      [0, 1, 1, 0, 0, 1, 1, 0],
    )
  })

  it('switches the opening server on rematch', () => {
    const match = createMatch({ players: [player('You'), player('COM')], openingServer: 0 })
    expect(createRematch(match).openingServer).toBe(1)
  })
})
