import { describe, expect, it } from 'vitest'
import { loadMute, saveMute } from './audio.js'

describe('mute preference', () => {
  it('loads and saves a boolean preference', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }
    expect(loadMute(storage)).toBe(false)
    saveMute(true, storage)
    expect(loadMute(storage)).toBe(true)
  })

  it('falls back safely when storage is blocked', () => {
    const blocked = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(loadMute(blocked)).toBe(false)
    expect(() => saveMute(true, blocked)).not.toThrow()
  })
})
