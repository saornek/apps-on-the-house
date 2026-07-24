import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ResultScreen from './screens/ResultScreen.jsx'
import {
  buildShareContent,
  challengeText,
  copyShareText,
  shouldDismissShareMenu,
  tryNativeShare,
} from './ShareButton.jsx'

const players = [
  {
    kind: 'human',
    name: 'Nova',
    monsterId: 'crumblehorn',
    build: { forehand: 5, backhand: 5, serve: 5, footwork: 5 },
  },
  {
    kind: 'human',
    name: 'Orbit',
    monsterId: 'mossbyte',
    build: { forehand: 5, backhand: 5, serve: 5, footwork: 5 },
  },
]

describe('challenge copy', () => {
  it('formats either winner with the winner score first', () => {
    expect(challengeText({ players, scores: [7, 5] })).toBe(
      'Nova won 7–5 in Tiebreak. Can you beat that score?',
    )
    expect(challengeText({ players, scores: [8, 10] })).toBe(
      'Orbit won 10–8 in Tiebreak. Can you beat that score?',
    )
  })

  it('uses the current origin only on a games route', () => {
    const local = buildShareContent('Challenge', {
      origin: 'https://preview.example',
      pathname: '/games/tiebreak/',
    })
    const fallback = buildShareContent('Challenge', {
      origin: 'http://127.0.0.1:4174',
      pathname: '/',
    })

    expect(local.shareUrl).toBe('https://preview.example/games/tiebreak/')
    expect(fallback.shareUrl).toBe(
      'https://appsonthehouse.com/games/tiebreak/',
    )
    expect(fallback.fullText).toBe(
      'Challenge\n\nFree. No ads. No signup.\nhttps://appsonthehouse.com/games/tiebreak/',
    )
    expect(fallback.links.map((link) => link.label)).toEqual([
      'X',
      'Facebook',
      'LinkedIn',
      'WhatsApp',
    ])
    expect(decodeURIComponent(fallback.links[3].href)).toContain(
      fallback.fullText,
    )
  })
})

describe('share capability paths', () => {
  it('uses one native text payload and treats cancellation as handled', async () => {
    const share = vi.fn().mockRejectedValue(new Error('cancelled'))

    await expect(tryNativeShare({ share }, 'Complete message')).resolves.toBe(true)
    expect(share).toHaveBeenCalledWith({ text: 'Complete message' })
    await expect(tryNativeShare({}, 'Complete message')).resolves.toBe(false)
  })

  it('reports copy success or failure without throwing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await expect(
      copyShareText({ clipboard: { writeText } }, 'Complete message'),
    ).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('Complete message')
    await expect(copyShareText({}, 'Complete message')).resolves.toBe(false)
  })

  it('dismisses only for Escape or an outside pointer press', () => {
    const inside = {}
    const outside = {}
    const menu = { contains: (target) => target === inside }

    expect(shouldDismissShareMenu({ type: 'keydown', key: 'Escape' }, menu)).toBe(true)
    expect(shouldDismissShareMenu({ type: 'keydown', key: 'Enter' }, menu)).toBe(false)
    expect(shouldDismissShareMenu({ type: 'mousedown', target: inside }, menu)).toBe(false)
    expect(shouldDismissShareMenu({ type: 'mousedown', target: outside }, menu)).toBe(true)
  })
})

describe('result action integration', () => {
  it('places Challenge a Friend between Rematch and Home', () => {
    const markup = renderToStaticMarkup(
      <ResultScreen
        match={{ players, scores: [7, 5] }}
        onRematch={() => {}}
        onHome={() => {}}
      />,
    )

    const rematch = markup.indexOf('Rematch')
    const challenge = markup.indexOf('Challenge a Friend')
    const home = markup.indexOf('Home')
    expect(rematch).toBeGreaterThan(-1)
    expect(challenge).toBeGreaterThan(rematch)
    expect(home).toBeGreaterThan(challenge)
    expect(markup).toContain('aria-haspopup="menu"')
    expect(markup).toContain('aria-expanded="false"')
  })
})
