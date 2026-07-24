/*
 * Solitaire - mobile layout regression tests.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { describe, expect, it } from 'vitest'
import postcss from 'postcss'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = dirname(fileURLToPath(import.meta.url))
const css = [readFileSync(join(srcDir, 'tokens.css'), 'utf8'), readFileSync(join(srcDir, 'App.css'), 'utf8')].join('\n')
const root = postcss.parse(css)

function activeAtViewport(node, viewportWidth) {
  let current = node.parent
  while (current) {
    if (current.type === 'atrule' && current.name === 'media') {
      const maxWidth = current.params.match(/max-width:\s*(\d+)px/)
      if (maxWidth && viewportWidth > Number(maxWidth[1])) return false
    }
    current = current.parent
  }
  return true
}

function declarationsFor(selector, viewportWidth) {
  const declarations = {}
  root.walkRules((rule) => {
    if (rule.selector !== selector || !activeAtViewport(rule, viewportWidth)) return
    rule.walkDecls((decl) => {
      declarations[decl.prop] = decl.value
    })
  })
  return declarations
}

function resolveLength(value, viewportWidth, customProperties) {
  const trimmed = value.trim()

  if (trimmed.startsWith('var(')) {
    const name = trimmed.match(/var\((--[^)]+)\)/)?.[1]
    return resolveLength(customProperties[name], viewportWidth, customProperties)
  }

  if (trimmed.startsWith('calc(')) {
    const [, variableName, multiplier] = trimmed.match(/calc\(var\((--[^)]+)\)\s*\*\s*([0-9.]+)\)/)
    return resolveLength(customProperties[variableName], viewportWidth, customProperties) * Number(multiplier)
  }

  if (trimmed.startsWith('clamp(')) {
    const values = trimmed.slice('clamp('.length, -1).split(',').map((part) => part.trim())
    const min = resolveLength(values[0], viewportWidth, customProperties)
    const preferred = resolveLength(values[1], viewportWidth, customProperties)
    const max = resolveLength(values[2], viewportWidth, customProperties)
    return Math.min(Math.max(preferred, min), max)
  }

  if (trimmed.endsWith('rem')) return Number(trimmed.slice(0, -3)) * 16
  if (trimmed.endsWith('vw')) return (Number(trimmed.slice(0, -2)) / 100) * viewportWidth
  if (trimmed.endsWith('px')) return Number(trimmed.slice(0, -2))

  throw new Error(`Unsupported CSS length: ${value}`)
}

function resolveColor(value, customProperties) {
  const trimmed = value.trim()
  if (trimmed.startsWith('var(')) {
    const name = trimmed.match(/var\((--[^)]+)\)/)?.[1]
    return resolveColor(customProperties[name], customProperties)
  }

  const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
  if (!hex) throw new Error(`Unsupported CSS color: ${value}`)

  const channels =
    hex.length === 3
      ? hex.split('').map((c) => Number.parseInt(`${c}${c}`, 16))
      : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((c) => Number.parseInt(c, 16))
  return channels.map((channel) => channel / 255)
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a, b) {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b))
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (light + 0.05) / (dark + 0.05)
}

describe('mobile card layout', () => {
  it('keeps card labels readable on a narrow phone board', () => {
    const viewportWidth = 320
    const customProperties = declarationsFor(':root', viewportWidth)
    const bodyDeclarations = declarationsFor('body', viewportWidth)
    const cardFaceDeclarations = declarationsFor('.pcard-face', viewportWidth)
    const cardDeclarations = declarationsFor('.pcard-corner', viewportWidth)
    const pipDeclarations = declarationsFor('.pcard-pip', viewportWidth)
    const tableauDeclarations = declarationsFor('.tableau-row', viewportWidth)

    const cardWidth = resolveLength(customProperties['--card-w'], viewportWidth, customProperties)
    const tableColor = resolveColor(bodyDeclarations.background, customProperties)
    const cardFaceColor = resolveColor(cardFaceDeclarations.background, customProperties)
    const cornerFontSize = resolveLength(cardDeclarations['font-size'], viewportWidth, customProperties)
    const pipFontSize = resolveLength(pipDeclarations['font-size'], viewportWidth, customProperties)
    const boardGap = resolveLength(tableauDeclarations.gap, viewportWidth, customProperties)

    expect(cardWidth).toBeGreaterThanOrEqual(40)
    expect(relativeLuminance(tableColor)).toBeLessThan(0.2)
    expect(relativeLuminance(cardFaceColor)).toBeGreaterThan(0.92)
    expect(contrastRatio(tableColor, cardFaceColor)).toBeGreaterThan(5)
    expect(cornerFontSize).toBeGreaterThanOrEqual(13)
    expect(Number(cardDeclarations['font-weight'])).toBeGreaterThanOrEqual(700)
    expect(pipFontSize).toBeGreaterThanOrEqual(22)
    expect(Number(pipDeclarations['font-weight'])).toBeGreaterThanOrEqual(700)
    expect(cardWidth * 7 + boardGap * 6).toBeLessThanOrEqual(viewportWidth * 0.96)
  })
})
