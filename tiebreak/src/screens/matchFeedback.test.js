import { describe, expect, it } from 'vitest'
import { countdownFeedback, pointResultMessage } from './matchFeedback.js'

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

describe('countdownFeedback', () => {
  it('surfaces the 2, 1, Serve sequence for visible and live-region feedback', () => {
    expect(countdownFeedback({ phase: 'countdown', countdownMs: 1800 })).toBe('2')
    expect(countdownFeedback({ phase: 'countdown', countdownMs: 900 })).toBe('1')
    expect(countdownFeedback({ phase: 'rally', cue: 'serve' })).toBe('Serve')
    expect(countdownFeedback({ phase: 'rally', cue: 'hit' })).toBe('')
  })
})
