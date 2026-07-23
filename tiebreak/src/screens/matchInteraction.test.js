import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  HELP_INSTRUCTIONS,
  ONBOARDING_HINT,
  advanceLiveFrame,
  handleMatchEscape,
} from './matchInteraction.js'

const MATCH_SCREEN_SOURCE = readFileSync(
  new URL('./MatchScreen.jsx', import.meta.url),
  'utf8',
)

function escapeEvent() {
  return {
    key: 'Escape',
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

  it('does not advance the simulation while paused', () => {
    const advance = vi.fn()

    advanceLiveFrame(true, advance)
    expect(advance).not.toHaveBeenCalled()

    advanceLiveFrame(false, advance)
    expect(advance).toHaveBeenCalledOnce()
  })
})

describe('match instructions', () => {
  it('keeps the short onboarding hint concise and detailed controls in help', () => {
    expect(ONBOARDING_HINT).not.toMatch(/W A S D|arrow keys|Touch/i)
    expect(HELP_INSTRUCTIONS.join(' ')).toMatch(/W A S D/)
    expect(HELP_INSTRUCTIONS.join(' ')).toMatch(/arrow keys/)
    expect(HELP_INSTRUCTIONS.join(' ')).toMatch(/Touch/)
    expect(MATCH_SCREEN_SOURCE).not.toContain('className="match-controls"')
  })
})
