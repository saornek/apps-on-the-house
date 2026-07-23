import { describe, expect, it } from 'vitest'
import { MONSTERS, REQUIRED_POSES, spritePlan } from './roster.js'

describe('monster roster', () => {
  it('ships four cosmetic monsters with no stat modifiers', () => {
    expect(MONSTERS).toHaveLength(4)
    expect(new Set(MONSTERS.map((monster) => monster.id)).size).toBe(4)
    expect(MONSTERS.every((monster) => !('stats' in monster))).toBe(true)
  })

  it('includes a visible racket in every required pose', () => {
    for (const monster of MONSTERS) {
      for (const pose of REQUIRED_POSES) {
        const parts = spritePlan(monster.id, pose)
        expect(parts.some((part) => part.part === 'racket-head')).toBe(true)
        expect(parts.some((part) => part.part === 'racket-handle')).toBe(true)
      }
    }
  })
})
