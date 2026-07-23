import { describe, expect, it } from 'vitest'
import { pointResultMessage } from './matchFeedback.js'

const players = [{ name: 'Player 1' }, { name: 'COM' }]
const lastPoint = { winner: 0, reason: 'net' }

describe('pointResultMessage', () => {
  it('announces a point only during the point-result phase', () => {
    expect(pointResultMessage({ phase: 'point-result', lastPoint }, players))
      .toBe('Player 1 wins the point · into the net')
    expect(pointResultMessage({ phase: 'countdown', lastPoint }, players)).toBe('')
    expect(pointResultMessage({ phase: 'rally', lastPoint }, players)).toBe('')
  })
})
