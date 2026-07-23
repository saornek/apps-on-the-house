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
  out: [130, 0.09],
  point: [520, 0.13],
  win: [660, 0.28],
}

export function createAudio() {
  let context = null
  let disabled = false

  const disable = () => {
    disabled = true
    context = null
  }
  const getContext = () => {
    if (disabled) return null
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!AudioContext) return null
    try {
      context ??= new AudioContext()
    } catch {
      disable()
      return null
    }
    return context
  }
  const resumeContext = (resolvedContext) => {
    if (!resolvedContext || disabled) return false
    try {
      const resumeResult = resolvedContext.resume?.()
      resumeResult?.catch?.(disable)
      return !disabled
    } catch {
      disable()
      return false
    }
  }

  return {
    unlock(muted = false) {
      if (muted || disabled) return
      const resolvedContext = getContext()
      resumeContext(resolvedContext)
    },
    play(name, muted = false) {
      if (muted || disabled || !CUES[name]) return
      const resolvedContext = getContext()
      if (!resolvedContext || !resumeContext(resolvedContext)) return
      const [frequency, duration] = CUES[name]
      try {
        const oscillator = resolvedContext.createOscillator()
        const gain = resolvedContext.createGain()
        oscillator.frequency.value = frequency
        oscillator.type = 'square'
        gain.gain.setValueAtTime(0.06, resolvedContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          resolvedContext.currentTime + duration,
        )
        oscillator.connect(gain)
        gain.connect(resolvedContext.destination)
        oscillator.start()
        oscillator.stop(resolvedContext.currentTime + duration)
      } catch {
        disable()
      }
    },
  }
}
