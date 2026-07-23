import { describe, expect, it } from 'vitest'
import { spritePlan } from './game/roster.js'
import { localRacketSide } from './render.js'

describe('directional racket rendering', () => {
  it.each([
    { playerIndex: 0, playerMirror: 1 },
    { playerIndex: 1, playerMirror: -1 },
  ])('keeps requested screen side for player $playerIndex', ({
    playerIndex,
    playerMirror,
  }) => {
    for (const screenDirection of [-1, 1]) {
      const localSide = localRacketSide(screenDirection, playerIndex)
      const head = spritePlan('crumblehorn', 'idle', localSide)
        .find((part) => part.part === 'racket-head')
      const renderedCenterX = (head.x + head.w / 2) * playerMirror

      expect(Math.sign(renderedCenterX)).toBe(screenDirection)
    }
  })
})
