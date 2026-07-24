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

  it('does not resume on Escape while paused', () => {
    const event = escapeEvent()
    const actions = { focusPause: vi.fn(), pause: vi.fn(), resume: vi.fn() }

    handleMatchEscape(event, true, actions)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(actions.resume).not.toHaveBeenCalled()
    expect(actions.pause).not.toHaveBeenCalled()
  })

  it('disables the pause dialog ModalBoundary Escape close path', () => {
    const pauseDialogBoundary = MATCH_SCREEN_SOURCE.match(
      /function PauseDialog[\s\S]*?<ModalBoundary([\s\S]*?)>/,
    )?.[1] ?? ''

    expect(pauseDialogBoundary).toMatch(/closeOnEscape=\{false\}/)
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
  it('assigns both keyboard control schemes to player one against AI', () => {
    const instructions = helpInstructions([
      { name: 'Nova', kind: 'human' },
      { name: 'COM', kind: 'ai' },
    ])

    expect(instructions).toContain('Nova uses W A S D or the arrow keys.')
    expect(instructions.join(' ')).not.toMatch(/COM uses/)
    expect(instructions).toContain('Touch players drag on their half of the court.')
  })

  it('keeps separate keyboard controls and touch help in local mode', () => {
    const instructions = helpInstructions([
      { name: 'Nova', kind: 'human' },
      { name: 'Orbit', kind: 'human' },
    ])

    expect(ONBOARDING_HINT).not.toMatch(/W A S D|arrow keys|Touch/i)
    expect(instructions).toContain('Nova uses W A S D. Orbit uses the arrow keys.')
    expect(instructions).toContain('Touch players drag on their half of the court.')
    expect(MATCH_SCREEN_SOURCE).not.toContain('className="match-controls"')
  })
})
