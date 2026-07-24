import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  helpInstructions,
  ONBOARDING_HINT,
  advanceLiveFrame,
  handleMatchEscape,
} from './matchInteraction.js'

const MATCH_SCREEN_SOURCE = readFileSync(
  new URL('./MatchScreen.jsx', import.meta.url),
  'utf8',
)

function escapeEvent(repeat = false) {
  return {
    key: 'Escape',
    repeat,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }
}

describe('match pause interaction', () => {
  it('opens pause on Escape from a live match and focuses Pause for restoration', () => {
    const event = escapeEvent()
    const actions = { focusPause: vi.fn(), pause: vi.fn(), resume: vi.fn() }

    handleMatchEscape(event, false, actions)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(actions.focusPause).toHaveBeenCalledOnce()
    expect(actions.pause).toHaveBeenCalledOnce()
    expect(actions.resume).not.toHaveBeenCalled()
  })

  it('resumes on Escape while paused', () => {
    const event = escapeEvent()
    const actions = { focusPause: vi.fn(), pause: vi.fn(), resume: vi.fn() }

    handleMatchEscape(event, true, actions)

    expect(actions.resume).toHaveBeenCalledOnce()
    expect(actions.pause).not.toHaveBeenCalled()
  })

  it('ignores repeated Escape keydown events', () => {
    const event = escapeEvent(true)
    const actions = { focusPause: vi.fn(), pause: vi.fn(), resume: vi.fn() }

    handleMatchEscape(event, false, actions)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(actions.focusPause).not.toHaveBeenCalled()
    expect(actions.pause).not.toHaveBeenCalled()
    expect(actions.resume).not.toHaveBeenCalled()
  })

  it('does not advance the simulation while paused', () => {
    const advance = vi.fn()

    advanceLiveFrame(true, advance)
    expect(advance).not.toHaveBeenCalled()

    advanceLiveFrame(false, advance)
    expect(advance).toHaveBeenCalledOnce()
  })
})

describe('match instructions', () => {
  it('keeps the short hint concise and uses confirmed names in detailed controls', () => {
    const instructions = helpInstructions([
      { name: 'Nova' },
      { name: 'Orbit' },
    ]).join(' ')

    expect(ONBOARDING_HINT).not.toMatch(/W A S D|arrow keys|Touch/i)
    expect(instructions).toMatch(/Nova uses W A S D/)
    expect(instructions).toMatch(/Orbit uses the arrow keys/)
    expect(instructions).toMatch(/Touch/)
    expect(MATCH_SCREEN_SOURCE).not.toContain('className="match-controls"')
  })
})
