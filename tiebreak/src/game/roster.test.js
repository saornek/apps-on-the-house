import { describe, expect, it } from 'vitest'
import { MONSTERS, REQUIRED_POSES, spritePlan } from './roster.js'

function touches(first, second) {
  return (
    first.x <= second.x + second.w &&
    first.x + first.w >= second.x &&
    first.y <= second.y + second.h &&
    first.y + first.h >= second.y
  )
}

describe('monster roster', () => {
  it('ships four cosmetic monsters with no stat modifiers', () => {
    expect(MONSTERS).toHaveLength(4)
    expect(new Set(MONSTERS.map((monster) => monster.id)).size).toBe(4)
    expect(MONSTERS.every((monster) => !('stats' in monster))).toBe(true)
  })

  it('geometrically attaches every visible racket to every monster pose', () => {
    for (const monster of MONSTERS) {
      for (const pose of REQUIRED_POSES) {
        const parts = spritePlan(monster.id, pose)
        const head = parts.find((part) => part.part === 'racket-head')
        const handle = parts.find((part) => part.part === 'racket-handle')
        const arm = parts.find((part) => part.part === 'racket-arm')
        const silhouette = parts.filter((part) => (
          !part.part.startsWith('racket-') && !part.part.startsWith('eye') &&
          part.part !== 'pupil' && !part.part.startsWith('fang')
        ))

        expect(head, `${monster.id}/${pose} racket head`).toBeDefined()
        expect(handle, `${monster.id}/${pose} racket handle`).toBeDefined()
        expect(arm, `${monster.id}/${pose} racket arm`).toBeDefined()
        expect(touches(head, handle), `${monster.id}/${pose} head-to-handle`).toBe(true)
        expect(touches(handle, arm), `${monster.id}/${pose} handle-to-arm`).toBe(true)
        expect(
          silhouette.some((part) => touches(part, arm)),
          `${monster.id}/${pose} arm-to-silhouette`,
        ).toBe(true)
      }
    }
  })
})
