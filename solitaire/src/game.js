/*
 * Solitaire - pure Klondike game logic (no DOM, no React).
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

export const SUITS = ['S', 'H', 'D', 'C']
const RED_SUITS = ['H', 'D']

export function isRed(suit) {
  return RED_SUITS.includes(suit)
}

export function suitSymbol(suit) {
  return { S: '♠', H: '♥', D: '♦', C: '♣' }[suit]
}

export function rankLabel(rank) {
  return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] || String(rank)
}

export function createShuffledDeck(random = Math.random) {
  const deck = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false })
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function deal(deck) {
  const tableau = Array.from({ length: 7 }, () => [])
  let cursor = 0
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[cursor++]
      tableau[col].push({ ...card, faceUp: row === col })
    }
  }
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }))
  return {
    stock,
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    tableau,
    selected: null,
    history: [],
  }
}

export function createGame(drawMode = 1, random = Math.random) {
  const deck = createShuffledDeck(random)
  const state = deal(deck)
  return { ...state, drawMode, moveCount: 0, startedAt: null }
}

const HISTORY_LIMIT = 200

function snapshot(state) {
  return {
    stock: state.stock,
    waste: state.waste,
    foundations: state.foundations,
    tableau: state.tableau,
    drawMode: state.drawMode,
    moveCount: state.moveCount,
    startedAt: state.startedAt,
  }
}

function pushHistory(state) {
  const trimmed = state.history.length >= HISTORY_LIMIT ? state.history.slice(1) : state.history
  return [...trimmed, snapshot(state)]
}

function topCard(pile) {
  return pile.length ? pile[pile.length - 1] : null
}

export function canStackTableau(card, targetPile) {
  const top = topCard(targetPile)
  if (!top) return card.rank === 13
  return top.rank === card.rank + 1 && isRed(top.suit) !== isRed(card.suit)
}

export function canStackFoundation(card, foundationPile) {
  const top = topCard(foundationPile)
  if (!top) return card.rank === 1
  return top.suit === card.suit && card.rank === top.rank + 1
}

function pileArray(state, pileId) {
  if (pileId === 'waste') return state.waste
  if (pileId.startsWith('foundation-')) return state.foundations[pileId.slice(11)] || null
  if (pileId.startsWith('tableau-')) {
    const col = Number(pileId.slice(8))
    if (!Number.isInteger(col) || col < 0 || col >= 7) return null
    return state.tableau[col]
  }
  return null
}

function isValidRun(pile, index) {
  for (let i = index; i < pile.length; i++) {
    if (!pile[i].faceUp) return false
    if (i > index) {
      const prev = pile[i - 1]
      const cur = pile[i]
      if (!(prev.rank === cur.rank + 1 && isRed(prev.suit) !== isRed(cur.suit))) return false
    }
  }
  return true
}

export function selectableRun(state, pileId, index) {
  const pile = pileArray(state, pileId)
  if (!pile) return null
  if (index < 0 || index >= pile.length) return null
  if (pileId === 'waste' || pileId.startsWith('foundation-')) {
    if (index !== pile.length - 1) return null
    return [pile[index]]
  }
  if (!pile[index].faceUp) return null
  if (!isValidRun(pile, index)) return null
  return pile.slice(index)
}

export function legalMoveTargets(state, source) {
  const run = selectableRun(state, source.pile, source.index)
  if (!run) return []
  const targets = []
  if (run.length === 1) {
    for (const suit of SUITS) {
      const id = `foundation-${suit}`
      if (id !== source.pile && suit === run[0].suit && canStackFoundation(run[0], state.foundations[suit]))
        targets.push(id)
    }
  }
  for (let col = 0; col < 7; col++) {
    const id = `tableau-${col}`
    if (id === source.pile) continue
    if (canStackTableau(run[0], state.tableau[col])) targets.push(id)
  }
  return targets
}

export function applyMove(state, source, destinationId) {
  const run = selectableRun(state, source.pile, source.index)
  if (!run) return null

  const isFoundationDest = destinationId.startsWith('foundation-')
  if (isFoundationDest) {
    if (run.length !== 1) return null
    const suit = destinationId.slice(11)
    if (suit !== run[0].suit) return null
    if (!canStackFoundation(run[0], state.foundations[suit])) return null
  } else if (destinationId.startsWith('tableau-')) {
    const col = Number(destinationId.slice(8))
    if (!Number.isInteger(col) || col < 0 || col >= 7) return null
    if (!canStackTableau(run[0], state.tableau[col])) return null
  } else {
    return null
  }

  const history = pushHistory(state)
  const sourcePile = pileArray(state, source.pile)
  const remaining = sourcePile.slice(0, source.index)

  let tableau = state.tableau
  let waste = state.waste
  let foundations = state.foundations

  if (source.pile === 'waste') {
    waste = remaining
  } else if (source.pile.startsWith('foundation-')) {
    foundations = { ...foundations, [source.pile.slice(11)]: remaining }
  } else {
    const col = Number(source.pile.slice(8))
    let newPile = remaining
    if (newPile.length > 0 && !newPile[newPile.length - 1].faceUp) {
      newPile = [...newPile.slice(0, -1), { ...newPile[newPile.length - 1], faceUp: true }]
    }
    tableau = tableau.map((p, i) => (i === col ? newPile : p))
  }

  if (isFoundationDest) {
    const suit = destinationId.slice(11)
    foundations = { ...foundations, [suit]: [...foundations[suit], run[0]] }
  } else {
    const col = Number(destinationId.slice(8))
    tableau = tableau.map((p, i) => (i === col ? [...p, ...run] : p))
  }

  return {
    ...state,
    waste,
    foundations,
    tableau,
    selected: null,
    history,
    moveCount: state.moveCount + 1,
    startedAt: state.startedAt ?? Date.now(),
  }
}

export function drawFromStock(state) {
  if (state.stock.length === 0 && state.waste.length === 0) return state

  const history = pushHistory(state)
  const startedAt = state.startedAt ?? Date.now()

  if (state.stock.length === 0) {
    const stock = [...state.waste].reverse().map((c) => ({ ...c, faceUp: false }))
    return { ...state, stock, waste: [], selected: null, history, moveCount: state.moveCount + 1, startedAt }
  }

  const n = Math.min(state.drawMode, state.stock.length)
  const drawn = state.stock.slice(state.stock.length - n).map((c) => ({ ...c, faceUp: true }))
  const stock = state.stock.slice(0, state.stock.length - n)
  const waste = [...state.waste, ...drawn]
  return { ...state, stock, waste, selected: null, history, moveCount: state.moveCount + 1, startedAt }
}

export function checkWin(state) {
  return SUITS.every((s) => state.foundations[s].length === 13)
}

export function canAutoComplete(state) {
  if (state.stock.length > 0) return false
  if (state.waste.some((c) => !c.faceUp)) return false
  return state.tableau.every((pile) => pile.every((c) => c.faceUp))
}

export function autoCompleteStep(state) {
  if (state.waste.length > 0) {
    const c = state.waste[state.waste.length - 1]
    if (canStackFoundation(c, state.foundations[c.suit])) {
      return applyMove(state, { pile: 'waste', index: state.waste.length - 1 }, `foundation-${c.suit}`)
    }
  }
  for (let col = 0; col < 7; col++) {
    const pile = state.tableau[col]
    if (pile.length === 0) continue
    const c = pile[pile.length - 1]
    if (canStackFoundation(c, state.foundations[c.suit])) {
      return applyMove(state, { pile: `tableau-${col}`, index: pile.length - 1 }, `foundation-${c.suit}`)
    }
  }
  return null
}

export function undo(state) {
  if (state.history.length === 0) return state
  const prev = state.history[state.history.length - 1]
  return { ...prev, selected: null, history: state.history.slice(0, -1) }
}
