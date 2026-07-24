import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const STYLES = readFileSync(new URL('./app.css', import.meta.url), 'utf8')

function ruleBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return STYLES.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('focus styling', () => {
  it('uses a dual-color focus ring that remains visible on light and dark surfaces', () => {
    const focusRule = STYLES.match(/button:focus-visible\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(focusRule).toMatch(/outline:\s*3px solid var\(--cream\)/)
    expect(focusRule).toMatch(/box-shadow:\s*0 0 0 6px var\(--ink\)\s*!important/)
    expect(focusRule).not.toContain('var(--sun)')
  })
})

describe('interactive text contrast', () => {
  it('uses the accessible dark clay behind cream primary-button text', () => {
    expect(ruleBody('.button--primary')).toMatch(/background:\s*var\(--clay-dark\)/)
    expect(ruleBody('.button--primary')).toMatch(/color:\s*var\(--cream\)/)
    expect(ruleBody('.button--primary:hover')).toMatch(
      /background:\s*var\(--clay-dark\)/,
    )
    expect(ruleBody('.button--primary:hover')).toMatch(/filter:\s*brightness\(0\.88\)/)
  })

  it('uses the accessible dark clay behind selected monster labels', () => {
    expect(ruleBody('.monster-card[aria-pressed="true"]')).toMatch(
      /background:\s*var\(--clay-dark\)/,
    )
    expect(ruleBody('.monster-card[aria-pressed="true"]')).toMatch(
      /color:\s*var\(--cream\)/,
    )
  })

  it('uses the accessible dark clay behind hovered and focused share links', () => {
    expect(ruleBody('.share-link:hover,\n.share-link:focus-visible')).toMatch(
      /background:\s*var\(--clay-dark\)/,
    )
    expect(ruleBody('.share-link:hover,\n.share-link:focus-visible')).toMatch(
      /color:\s*var\(--cream\)/,
    )
  })
})

describe('match canvas sizing', () => {
  it('fits the full 2:3 court against both dimensions of its grid row', () => {
    const frameRule = STYLES.match(/\.court-frame\s*\{([^}]*)\}/)?.[1] ?? ''
    const canvasRule = STYLES.match(/\.game-canvas\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(frameRule).toMatch(/container-type:\s*size/)
    expect(canvasRule).toMatch(/width:\s*min\(100cqw,\s*66\.666667cqh\)/)
    expect(canvasRule).toMatch(/height:\s*auto/)
    expect(canvasRule).not.toMatch(/height:\s*100%/)
    expect(canvasRule).toMatch(/aspect-ratio:\s*2\s*\/\s*3/)
  })
})
