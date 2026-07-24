import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import SetupScreen from './SetupScreen.jsx'

const APP_SOURCE = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const STYLES = readFileSync(new URL('../app.css', import.meta.url), 'utf8')
const build = { forehand: 5, backhand: 5, serve: 5, footwork: 5 }

function renderSetup(overrides = {}) {
  return renderToStaticMarkup(
    <SetupScreen
      mode="local"
      setupIndex={0}
      draft={{ name: 'Player 1', monsterId: 'crumblehorn', build }}
      otherName="Player 2"
      onBack={vi.fn()}
      onChangeName={vi.fn()}
      onSelectMonster={vi.fn()}
      onChangeStat={vi.fn()}
      onReset={vi.fn()}
      onReady={vi.fn()}
      {...overrides}
    />,
  )
}

describe('local setup names', () => {
  it('renders a labeled ten-character field and enabled Ready for valid names', () => {
    const markup = renderSetup()

    expect(markup).toContain('for="player-name"')
    expect(markup).toContain('id="player-name"')
    expect(markup).toContain('maxLength="10"')
    expect(markup).toContain('autoComplete="off"')
    expect(markup).toContain('aria-describedby="player-name-status"')
    expect(markup).toContain('>Back</button>')
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Ready/)
  })

  it('announces duplicate-name errors and disables Ready', () => {
    const markup = renderSetup({
      draft: { name: ' alex ', monsterId: 'crumblehorn', build },
      otherName: 'Alex',
    })

    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('Choose a different name.')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Ready/)
  })

  it('keeps the single-player name fixed and hides the field', () => {
    const markup = renderSetup({
      mode: 'single',
      otherName: undefined,
    })

    expect(markup).not.toContain('id="player-name"')
    expect(markup).toContain('Build your monster')
  })
})

describe('setup orchestration', () => {
  it('uses reducer-owned drafts and setup Back actions', () => {
    expect(APP_SOURCE).toContain(
      'initialAppState(loadLastMonster())',
    )
    expect(APP_SOURCE).toContain(
      'draft={state.drafts[state.setupIndex]}',
    )
    expect(APP_SOURCE).toContain(
      "dispatch({ type: 'change-draft-name', name })",
    )
    expect(APP_SOURCE).toContain("dispatch({ type: 'back' })")
    expect(APP_SOURCE).not.toContain('useState(loadLastMonster)')
  })

  it('keeps setup Back visible and share/result actions wrappable', () => {
    expect(STYLES).toMatch(/\.screen-heading \.setup-back\s*\{[^}]*margin:/s)
    expect(STYLES).toMatch(/\.name-field\s*\{[^}]*display:\s*grid/s)
    expect(STYLES).toMatch(/\.result-actions\s*\{[^}]*flex-wrap:\s*wrap/s)
  })
})
