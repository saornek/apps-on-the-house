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
      ['out', 130, 0.09],
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

  it('permanently degrades to silence when AudioContext construction throws', () => {
    const originalAudioContext = globalThis.AudioContext
    let attempts = 0
    globalThis.AudioContext = class {
      constructor() {
        attempts += 1
        throw new Error('audio unavailable')
      }
    }

    try {
      const audio = createAudio()
      expect(() => audio.unlock()).not.toThrow()
      expect(() => audio.play('serve')).not.toThrow()
      expect(() => audio.play('hit')).not.toThrow()
      expect(attempts).toBe(1)
    } finally {
      if (originalAudioContext) globalThis.AudioContext = originalAudioContext
      else delete globalThis.AudioContext
    }
  })

  it.each([
    'resume',
    'createOscillator',
    'createGain',
    'frequency',
    'setValueAtTime',
    'ramp',
    'oscillatorConnect',
    'gainConnect',
    'start',
    'stop',
  ])('silences every later cue after a throwing %s stage', (throwingStage) => {
    const originalAudioContext = globalThis.AudioContext
    let oscillatorCreations = 0
    const fail = (stage) => {
      if (throwingStage === stage) throw new Error(stage)
    }

    class ThrowingAudioContext {
      constructor() {
        this.currentTime = 3
        this.destination = {}
      }

      resume() {
        fail('resume')
      }

      createOscillator() {
        oscillatorCreations += 1
        fail('createOscillator')
        return {
          frequency: {
            set value(_value) {
              fail('frequency')
            },
          },
          connect() {
            fail('oscillatorConnect')
            return this
          },
          start() {
            fail('start')
          },
          stop() {
            fail('stop')
          },
        }
      }

      createGain() {
        fail('createGain')
        return {
          gain: {
            setValueAtTime() {
              fail('setValueAtTime')
            },
            exponentialRampToValueAtTime() {
              fail('ramp')
            },
          },
          connect() {
            fail('gainConnect')
            return this
          },
        }
      }
    }

    globalThis.AudioContext = ThrowingAudioContext
    try {
      const audio = createAudio()
      expect(() => audio.play('serve')).not.toThrow()
      const attemptsAfterFailure = oscillatorCreations
      expect(() => audio.play('hit')).not.toThrow()
      expect(oscillatorCreations).toBe(attemptsAfterFailure)
    } finally {
      if (originalAudioContext) globalThis.AudioContext = originalAudioContext
      else delete globalThis.AudioContext
    }
  })

  it('degrades to silence after an asynchronous resume rejection', async () => {
    const originalAudioContext = globalThis.AudioContext
    let oscillatorCreations = 0

    class RejectingAudioContext {
      constructor() {
        this.currentTime = 0
        this.destination = {}
      }

      resume() {
        return Promise.reject(new Error('blocked'))
      }

      createOscillator() {
        oscillatorCreations += 1
        return {
          frequency: { value: 0 },
          connect() { return this },
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
          connect() { return this },
        }
      }
    }

    globalThis.AudioContext = RejectingAudioContext
    try {
      const audio = createAudio()
      audio.play('serve')
      await Promise.resolve()
      const attemptsAfterFailure = oscillatorCreations
      audio.play('hit')
      expect(oscillatorCreations).toBe(attemptsAfterFailure)
    } finally {
      if (originalAudioContext) globalThis.AudioContext = originalAudioContext
      else delete globalThis.AudioContext
    }
  })
})
