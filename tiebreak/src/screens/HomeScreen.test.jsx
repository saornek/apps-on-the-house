import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import HomeScreen from './HomeScreen.jsx'

function renderHome(overrides = {}) {
  return renderToStaticMarkup(
    <HomeScreen
      phase="home"
      muted={false}
      onChooseMode={vi.fn()}
      onChooseDifficulty={vi.fn()}
      onBack={vi.fn()}
      onToggleMute={vi.fn()}
      {...overrides}
    />,
  )
}

describe('mode selection', () => {
  it('keeps local multiplayer available on desktop', () => {
    const markup = renderHome()

    expect(markup).toContain('2 Players')
    expect(markup).toContain('Share this court')
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>\s*<span>2 Players/)
  })

  it('disables local multiplayer on mobile', () => {
    const markup = renderHome({ disableLocalMultiplayer: true })

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>\s*<span>2 Players/)
    expect(markup).toContain('Desktop only for now')
  })
})
