import { describe, expect, it } from 'vitest'
import { createAudio, loadMute, saveMute } from './audio.js'

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

describe('audio cues', () => {
  it('stays lazy and plays every named profile with a synchronous resume implementation', () => {
    const originalAudioContext = globalThis.AudioContext
    const frequencies = []
    let contexts = 0

    class FakeAudioContext {
      constructor() {
        contexts += 1
        this.currentTime = 10
        this.destination = {}
      }

      resume() {}

      createOscillator() {
        return {
          frequency: {
            set value(frequency) {
              frequencies.push(frequency)
            },
          },
          connect() {
            return this
          },
          start() {},
          stop() {},
        }
      }

      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {
            return this
          },
        }
      }
    }

    globalThis.AudioContext = FakeAudioContext
    try {
      const audio = createAudio()
      expect(contexts).toBe(0)
      audio.play('unknown')
      audio.play('serve', true)
      expect(contexts).toBe(0)

      for (const cue of ['serve', 'hit', 'bounce', 'net', 'point', 'win']) {
        expect(() => audio.play(cue)).not.toThrow()
      }

      expect(contexts).toBe(1)
      expect(frequencies).toEqual([260, 420, 180, 95, 520, 660])
    } finally {
      if (originalAudioContext) globalThis.AudioContext = originalAudioContext
      else delete globalThis.AudioContext
    }
  })
})
