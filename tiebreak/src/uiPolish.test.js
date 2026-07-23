import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const STYLES = readFileSync(new URL('./app.css', import.meta.url), 'utf8')

describe('focus styling', () => {
  it('uses a dual-color focus ring that remains visible on light and dark surfaces', () => {
    const focusRule = STYLES.match(/button:focus-visible\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(focusRule).toMatch(/outline:\s*3px solid var\(--cream\)/)
    expect(focusRule).toMatch(/box-shadow:\s*0 0 0 6px var\(--ink\)\s*!important/)
    expect(focusRule).not.toContain('var(--sun)')
  })
})
