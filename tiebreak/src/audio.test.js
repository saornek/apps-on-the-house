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
  it('stays lazy and plays every named frequency and duration profile', () => {
    const originalAudioContext = globalThis.AudioContext
    const profiles = [
      ['serve', 260, 0.06],
      ['hit', 420, 0.045],
      ['bounce', 180, 0.035],
      ['net', 95, 0.12],
      ['point', 520, 0.13],
      ['win', 660, 0.28],
    ]
    const frequencies = []
    const rampTimes = []
    const stopTimes = []
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
          stop(time) {
            stopTimes.push(time)
          },
        }
      }

      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime(_value, time) {
              rampTimes.push(time)
            },
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

      for (const [cue] of profiles) {
        expect(() => audio.play(cue)).not.toThrow()
      }

      expect(contexts).toBe(1)
      expect(frequencies).toEqual(profiles.map(([, frequency]) => frequency))
      expect(rampTimes).toEqual(profiles.map(([, , duration]) => 10 + duration))
      expect(stopTimes).toEqual(profiles.map(([, , duration]) => 10 + duration))
    } finally {
      if (originalAudioContext) globalThis.AudioContext = originalAudioContext
      else delete globalThis.AudioContext
    }
  })
})
