const MUTE_KEY = 'tiebreak:muted'

export function loadMute(storage) {
  try {
    const resolvedStorage = storage === undefined ? globalThis.localStorage : storage
    return resolvedStorage?.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveMute(muted, storage) {
  try {
    const resolvedStorage = storage === undefined ? globalThis.localStorage : storage
    resolvedStorage?.setItem(MUTE_KEY, String(Boolean(muted)))
  } catch {
    return
  }
}

const CUES = {
  serve: [260, 0.06],
  hit: [420, 0.045],
  bounce: [180, 0.035],
  net: [95, 0.12],
  point: [520, 0.13],
  win: [660, 0.28],
}

export function createAudio() {
  let context = null

  const getContext = () => {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!AudioContext) return null
    context ??= new AudioContext()
    return context
  }

  return {
    unlock(muted = false) {
      if (muted) return
      getContext()?.resume?.().catch(() => {})
    },
    play(name, muted = false) {
      if (muted || !CUES[name]) return
      context = getContext()
      if (!context) return
      context.resume?.().catch(() => {})
      const [frequency, duration] = CUES[name]
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = frequency
      oscillator.type = 'square'
      gain.gain.setValueAtTime(0.06, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + duration)
    },
  }
}
