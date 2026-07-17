/*
 * Solitaire - game logic tests.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { describe, it, expect } from 'vitest'
import { SUITS, isRed, suitSymbol, rankLabel, createShuffledDeck, deal, createGame } from './game.js'
import { canStackTableau, canStackFoundation, selectableRun, legalMoveTargets, applyMove, drawFromStock, undo } from './game.js'

describe('card helpers', () => {
  it('identifies red suits', () => {
    expect(isRed('H')).toBe(true)
    expect(isRed('D')).toBe(true)
    expect(isRed('S')).toBe(false)
    expect(isRed('C')).toBe(false)
  })

  it('renders suit symbols', () => {
    expect(suitSymbol('S')).toBe('♠')
    expect(suitSymbol('H')).toBe('♥')
    expect(suitSymbol('D')).toBe('♦')
    expect(suitSymbol('C')).toBe('♣')
  })

  it('renders rank labels', () => {
    expect(rankLabel(1)).toBe('A')
    expect(rankLabel(10)).toBe('10')
    expect(rankLabel(11)).toBe('J')
    expect(rankLabel(12)).toBe('Q')
    expect(rankLabel(13)).toBe('K')
  })
})

describe('createShuffledDeck', () => {
  it('creates 52 unique face-down cards, 13 per suit', () => {
    const deck = createShuffledDeck()
    expect(deck).toHaveLength(52)
    expect(deck.every((c) => c.faceUp === false)).toBe(true)
    for (const suit of SUITS) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13)
    }
    const seen = new Set(deck.map((c) => `${c.suit}${c.rank}`))
    expect(seen.size).toBe(52)
  })

  it('shuffles using the provided random function', () => {
    // A random() that always returns 0 produces a deterministic rotation.
    const ordered = createShuffledDeck(() => 0)
    expect(ordered[0]).toEqual({ suit: 'S', rank: 2, faceUp: false })
    expect(ordered[51]).toEqual({ suit: 'S', rank: 1, faceUp: false })
  })
})

function makeOrderedDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank, faceUp: false })
  }
  return deck
}

describe('deal', () => {
  it('deals 7 tableau piles of sizes 1..7 with only the top card face up', () => {
    const state = deal(makeOrderedDeck())
    expect(state.tableau).toHaveLength(7)
    state.tableau.forEach((pile, i) => {
      expect(pile).toHaveLength(i + 1)
      pile.forEach((card, idx) => {
        expect(card.faceUp).toBe(idx === pile.length - 1)
      })
    })
  })

  it('puts the remaining 24 cards face down in stock, empty waste/foundations', () => {
    const state = deal(makeOrderedDeck())
    expect(state.stock).toHaveLength(24)
    expect(state.stock.every((c) => c.faceUp === false)).toBe(true)
    expect(state.waste).toEqual([])
    expect(state.foundations).toEqual({ S: [], H: [], D: [], C: [] })
    expect(state.selected).toBeNull()
    expect(state.history).toEqual([])
  })

  it('deals every card from the deck exactly once', () => {
    const state = deal(makeOrderedDeck())
    const all = [...state.stock, ...state.tableau.flat()]
    expect(all).toHaveLength(52)
    const seen = new Set(all.map((c) => `${c.suit}${c.rank}`))
    expect(seen.size).toBe(52)
  })
})

describe('createGame', () => {
  it('composes a full GameState with the requested draw mode', () => {
    const state = createGame(3, () => 0)
    expect(state.drawMode).toBe(3)
    expect(state.moveCount).toBe(0)
    expect(state.startedAt).toBeNull()
    expect(state.tableau).toHaveLength(7)
    expect(state.stock).toHaveLength(24)
  })

  it('defaults to draw-1 when no draw mode is given', () => {
    const state = createGame(undefined, () => 0)
    expect(state.drawMode).toBe(1)
  })
})

function card(suit, rank, faceUp = true) {
  return { suit, rank, faceUp }
}

function baseState(overrides = {}) {
  return {
    stock: [],
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    tableau: [[], [], [], [], [], [], []],
    selected: null,
    drawMode: 1,
    history: [],
    moveCount: 0,
    startedAt: null,
    ...overrides,
  }
}

describe('canStackTableau', () => {
  it('allows a King onto an empty pile, nothing else', () => {
    expect(canStackTableau(card('S', 13), [])).toBe(true)
    expect(canStackTableau(card('S', 12), [])).toBe(false)
  })

  it('requires descending rank and alternating color onto a non-empty pile', () => {
    const target = [card('H', 8)] // red 8
    expect(canStackTableau(card('S', 7), target)).toBe(true) // black 7 onto red 8: legal
    expect(canStackTableau(card('D', 7), target)).toBe(false) // red 7 onto red 8: illegal (same color)
    expect(canStackTableau(card('S', 6), target)).toBe(false) // wrong rank
  })
})

describe('canStackFoundation', () => {
  it('requires an Ace to start an empty foundation', () => {
    expect(canStackFoundation(card('H', 1), [])).toBe(true)
    expect(canStackFoundation(card('H', 2), [])).toBe(false)
  })

  it('requires ascending rank of the same suit', () => {
    const foundation = [card('H', 1), card('H', 2)]
    expect(canStackFoundation(card('H', 3), foundation)).toBe(true)
    expect(canStackFoundation(card('D', 3), foundation)).toBe(false) // wrong suit
    expect(canStackFoundation(card('H', 4), foundation)).toBe(false) // wrong rank
  })
})

describe('selectableRun', () => {
  it('selects only the top card of waste or a foundation', () => {
    const state = baseState({ waste: [card('S', 5), card('H', 4)] })
    expect(selectableRun(state, 'waste', 1)).toEqual([card('H', 4)])
    expect(selectableRun(state, 'waste', 0)).toBeNull() // not the top card
  })

  it('selects a valid face-up descending alternating-color run in a tableau pile', () => {
    const tableau = [[card('C', 10, false), card('H', 9), card('S', 8), card('H', 7)]]
    const state = baseState({ tableau: [...tableau, [], [], [], [], [], []] })
    expect(selectableRun(state, 'tableau-0', 1)).toEqual([card('H', 9), card('S', 8), card('H', 7)])
    expect(selectableRun(state, 'tableau-0', 0)).toBeNull() // face-down card
  })

  it('rejects a tableau index whose run is not correctly sequenced', () => {
    const tableau = [[card('H', 9), card('H', 8)]] // same color, not a valid run
    const state = baseState({ tableau: [...tableau, [], [], [], [], [], []] })
    expect(selectableRun(state, 'tableau-0', 0)).toBeNull()
  })
})

describe('legalMoveTargets', () => {
  it('lists foundation targets only for single-card selections', () => {
    const state = baseState({
      waste: [card('H', 1)],
      tableau: [[card('S', 13)], [], [], [], [], [], []],
    })
    const targets = legalMoveTargets(state, { pile: 'waste', index: 0 })
    expect(targets).toContain('foundation-H')
  })

  it('excludes the source pile from tableau targets', () => {
    const tableau = [[card('S', 13)], [], [], [], [], [], []]
    const state = baseState({ tableau })
    const targets = legalMoveTargets(state, { pile: 'tableau-0', index: 0 })
    expect(targets).not.toContain('tableau-0')
  })

  it('only suggests the matching-suit empty foundation for an Ace, not all empty foundations', () => {
    const state = baseState({ waste: [card('H', 1)] })
    const targets = legalMoveTargets(state, { pile: 'waste', index: 0 })
    expect(targets).toEqual(['foundation-H'])
  })
})

describe('applyMove', () => {
  it('moves a card from waste to a legal foundation and records history/moveCount', () => {
    const state = baseState({ waste: [card('H', 1)] })
    const next = applyMove(state, { pile: 'waste', index: 0 }, 'foundation-H')
    expect(next.waste).toEqual([])
    expect(next.foundations.H).toEqual([card('H', 1)])
    expect(next.moveCount).toBe(1)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].selected).toBeUndefined()
    expect(next.history[0].history).toBeUndefined()
  })

  it('rejects an illegal foundation move and returns null', () => {
    const state = baseState({ waste: [card('H', 2)] })
    expect(applyMove(state, { pile: 'waste', index: 0 }, 'foundation-H')).toBeNull()
  })

  it('rejects dropping a card on the wrong-suit foundation slot', () => {
    const state = baseState({ waste: [card('H', 1)] })
    expect(applyMove(state, { pile: 'waste', index: 0 }, 'foundation-S')).toBeNull()
  })

  it('moves a whole face-up run between tableau piles', () => {
    const tableau = [
      [card('C', 10, false), card('H', 9), card('S', 8)],
      [card('S', 10)],
      [],
      [],
      [],
      [],
      [],
    ]
    const state = baseState({ tableau })
    const next = applyMove(state, { pile: 'tableau-0', index: 1 }, 'tableau-1')
    expect(next.tableau[1]).toEqual([card('S', 10), card('H', 9), card('S', 8)])
    expect(next.tableau[0]).toEqual([{ ...card('C', 10, false), faceUp: true }])
  })

  it('rejects moving a multi-card run onto a foundation', () => {
    const tableau = [[card('H', 9), card('S', 8)], [], [], [], [], [], []]
    const state = baseState({ tableau })
    expect(applyMove(state, { pile: 'tableau-0', index: 0 }, 'foundation-H')).toBeNull()
  })

  it('flips the newly exposed tableau card face up after a move', () => {
    const tableau = [[card('C', 10, false), card('H', 1)], [], [], [], [], [], []]
    const state = baseState({ tableau })
    const next = applyMove(state, { pile: 'tableau-0', index: 1 }, 'foundation-H')
    expect(next.tableau[0]).toEqual([{ ...card('C', 10, false), faceUp: true }])
  })

  it('returns null instead of throwing for a malformed source pile id', () => {
    const state = baseState({ waste: [card('H', 1)] })
    expect(() => applyMove(state, { pile: 'nonsense', index: 0 }, 'foundation-H')).not.toThrow()
    expect(applyMove(state, { pile: 'nonsense', index: 0 }, 'foundation-H')).toBeNull()
  })

  it('returns null instead of throwing for an out-of-range tableau destination', () => {
    const state = baseState({ waste: [card('H', 1)] })
    expect(() => applyMove(state, { pile: 'waste', index: 0 }, 'tableau-99')).not.toThrow()
    expect(applyMove(state, { pile: 'waste', index: 0 }, 'tableau-99')).toBeNull()
  })
})

describe('drawFromStock', () => {
  it('draws 1 card face up onto waste in draw-1 mode', () => {
    const state = baseState({ drawMode: 1, stock: [card('S', 5, false), card('H', 6, false)] })
    const next = drawFromStock(state)
    expect(next.stock).toEqual([card('S', 5, false)])
    expect(next.waste).toEqual([card('H', 6, true)])
    expect(next.moveCount).toBe(1)
  })

  it('draws up to 3 cards in draw-3 mode, fewer if the stock is short', () => {
    const state = baseState({ drawMode: 3, stock: [card('S', 5, false), card('H', 6, false)] })
    const next = drawFromStock(state)
    expect(next.stock).toEqual([])
    expect(next.waste).toEqual([card('S', 5, true), card('H', 6, true)])
  })

  it('preserves draw order across multiple draws so the most recent card is on top', () => {
    let state = baseState({
      drawMode: 1,
      stock: [card('S', 1, false), card('S', 2, false), card('S', 3, false)],
    })
    state = drawFromStock(state) // draws S3
    state = drawFromStock(state) // draws S2
    expect(state.waste).toEqual([card('S', 3, true), card('S', 2, true)])
  })

  it('redeals the waste back into the stock, face down, in original draw order', () => {
    let state = baseState({
      drawMode: 1,
      stock: [card('S', 1, false), card('S', 2, false)],
    })
    state = drawFromStock(state) // waste: [S2]
    state = drawFromStock(state) // waste: [S2, S1], stock empty
    expect(state.stock).toEqual([])
    state = drawFromStock(state) // redeal
    expect(state.waste).toEqual([])
    expect(state.stock).toEqual([card('S', 1, false), card('S', 2, false)])
  })

  it('does nothing when both stock and waste are empty', () => {
    const state = baseState({ stock: [], waste: [] })
    const next = drawFromStock(state)
    expect(next).toBe(state)
  })

  // Whole-pile reversal is correct Klondike redeal behavior; in draw-3 mode,
  // packet groupings naturally shift with each redeal (not a bug — part of draw-3 strategy).
  it('redeals via a whole-pile reversal in draw-3 mode (packet groupings are not preserved across redeals)', () => {
    let state = baseState({
      drawMode: 3,
      stock: [card('S', 1, false), card('S', 2, false), card('S', 3, false), card('S', 4, false), card('S', 5, false), card('S', 6, false)],
    })
    state = drawFromStock(state) // draws S4,S5,S6 -> waste: [S4,S5,S6]
    state = drawFromStock(state) // draws S1,S2,S3 -> waste: [S4,S5,S6,S1,S2,S3], stock empty
    expect(state.stock).toEqual([])
    state = drawFromStock(state) // redeal: whole-pile reverse of waste
    expect(state.waste).toEqual([])
    expect(state.stock).toEqual([
      card('S', 3, false),
      card('S', 2, false),
      card('S', 1, false),
      card('S', 6, false),
      card('S', 5, false),
      card('S', 4, false),
    ])
  })
})

import { checkWin, canAutoComplete, autoCompleteStep } from './game.js'

function fullFoundations() {
  const foundations = {}
  for (const suit of SUITS) {
    foundations[suit] = Array.from({ length: 13 }, (_, i) => card(suit, i + 1))
  }
  return foundations
}

describe('checkWin', () => {
  it('is true only when all four foundations have all 13 ranks', () => {
    expect(checkWin(baseState({ foundations: fullFoundations() }))).toBe(true)
    const partial = fullFoundations()
    partial.S = partial.S.slice(0, 12)
    expect(checkWin(baseState({ foundations: partial }))).toBe(false)
  })
})

describe('canAutoComplete', () => {
  it('is false while the stock still has cards', () => {
    const state = baseState({ stock: [card('S', 1, false)] })
    expect(canAutoComplete(state)).toBe(false)
  })

  it('is false while any waste or tableau card is face down', () => {
    const state = baseState({ tableau: [[card('S', 1, false)], [], [], [], [], [], []] })
    expect(canAutoComplete(state)).toBe(false)
  })

  it('is true once stock is empty and every remaining card is face up', () => {
    const state = baseState({
      waste: [card('H', 1)],
      tableau: [[card('S', 1)], [], [], [], [], [], []],
    })
    expect(canAutoComplete(state)).toBe(true)
  })
})

describe('autoCompleteStep', () => {
  it('moves the waste top card to its foundation when legal', () => {
    const state = baseState({ waste: [card('H', 1)] })
    const next = autoCompleteStep(state)
    expect(next.foundations.H).toEqual([card('H', 1)])
  })

  it('falls back to a tableau top card when the waste has no legal move', () => {
    const state = baseState({
      waste: [card('H', 5)], // not playable yet, foundation H empty
      tableau: [[card('S', 1)], [], [], [], [], [], []],
    })
    const next = autoCompleteStep(state)
    expect(next.foundations.S).toEqual([card('S', 1)])
  })

  it('returns null when no legal foundation move exists', () => {
    const state = baseState({ waste: [card('H', 5)] })
    expect(autoCompleteStep(state)).toBeNull()
  })
})

describe('undo', () => {
  it('restores the exact prior state after a move, and decrements moveCount', () => {
    const state = baseState({ waste: [card('H', 1)] })
    const afterMove = applyMove(state, { pile: 'waste', index: 0 }, 'foundation-H')
    const restored = undo(afterMove)
    expect(restored.waste).toEqual(state.waste)
    expect(restored.foundations).toEqual(state.foundations)
    expect(restored.moveCount).toBe(0)
    expect(restored.history).toEqual([])
  })

  it('restores the exact prior state after a stock draw', () => {
    const state = baseState({ drawMode: 1, stock: [card('S', 1, false)] })
    const afterDraw = drawFromStock(state)
    const restored = undo(afterDraw)
    expect(restored.stock).toEqual(state.stock)
    expect(restored.waste).toEqual(state.waste)
    expect(restored.moveCount).toBe(0)
  })

  it('is a no-op when there is no history', () => {
    const state = baseState()
    expect(undo(state)).toBe(state)
  })
})
