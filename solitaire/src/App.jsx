/*
 * Solitaire - app chrome: setup screen, header, board, win overlay.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { useEffect, useReducer, useRef, useState } from 'react'
import { ArrowLeft, BarChart2, Plus, Undo2 } from 'lucide-react'
import Pile from './Pile.jsx'
import ShareButton from './ShareButton.jsx'
import {
  createGame,
  suitSymbol,
  legalMoveTargets,
  selectableRun,
  applyMove,
  drawFromStock,
  undo,
  checkWin,
  canAutoComplete,
  autoCompleteStep,
} from './game.js'
import { loadStats, recordGameStart, recordWin, recordAbandon } from './stats.js'

const SUIT_ORDER = ['S', 'H', 'D', 'C']

function reducer(state, action) {
  switch (action.type) {
    case 'NEW_GAME':
      return { ...action.game, selected: null, shake: null, won: false }
    case 'SELECT': {
      const { pile, index } = action
      if (state.selected && state.selected.pile === pile && state.selected.index === index) {
        return { ...state, selected: null }
      }
      if (!state.selected) {
        // Only start a selection if there's an actual legal-to-select card here —
        // otherwise tapping an empty foundation/tableau slot would leave a phantom
        // selection pointing at nothing.
        if (!selectableRun(state, pile, index)) return state
        return { ...state, selected: { pile, index } }
      }
      // Something is already selected: any tap on a different pile is a destination
      // attempt. Destinations are addressed by pile id only (cards always land on
      // top), so the tapped index is irrelevant here.
      const next = applyMove(state, state.selected, pile)
      if (!next) return { ...state, selected: null, shake: pile }
      return { ...next, shake: null, won: checkWin(next) }
    }
    case 'DRAW':
      return { ...drawFromStock(state), selected: null, shake: null }
    case 'UNDO':
      return { ...undo(state), shake: null }
    case 'AUTO_STEP': {
      const next = autoCompleteStep(state)
      if (!next) return state
      return { ...next, won: checkWin(next) }
    }
    case 'CLEAR_SHAKE':
      return { ...state, shake: null }
    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, () => ({ ...createGame(1), shake: null, won: false }))
  const [phase, setPhase] = useState('setup') // 'setup' | 'playing'
  const [stats, setStats] = useState(loadStats)
  const [showStats, setShowStats] = useState(false)
  const [now, setNow] = useState(Date.now())
  const startedGameRef = useRef(false)

  useEffect(() => {
    if (state.shake) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_SHAKE' }), 300)
      return () => clearTimeout(t)
    }
  }, [state.shake])

  useEffect(() => {
    if (phase !== 'playing' || state.won) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [phase, state.won])

  useEffect(() => {
    if (state.won && !startedGameRef.current.won) {
      const timeMs = state.startedAt ? Date.now() - state.startedAt : 0
      setStats((s) => recordWin(s, state.drawMode, timeMs))
      startedGameRef.current.won = true
    }
  }, [state.won])

  useEffect(() => {
    if (!state.won || !canAutoComplete(state)) return
  }, [state])

  function startNewGame(drawMode) {
    if (startedGameRef.current && startedGameRef.current.phase === 'playing' && !startedGameRef.current.won) {
      setStats((s) => recordAbandon(s, startedGameRef.current.drawMode))
    }
    const game = createGame(drawMode)
    startedGameRef.current = { phase: 'playing', drawMode, won: false }
    setStats((s) => recordGameStart(s, drawMode))
    dispatch({ type: 'NEW_GAME', game })
    setPhase('playing')
  }

  function pileClick(pileId, index) {
    dispatch({ type: 'SELECT', pile: pileId, index })
  }

  function isSelected(pileId, index) {
    return state.selected?.pile === pileId && state.selected?.index === index
  }

  const targets = state.selected ? legalMoveTargets(state, state.selected) : []

  const elapsedMs = state.startedAt ? now - state.startedAt : 0

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000))
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  if (phase === 'setup') {
    return (
      <div className="app">
        <header className="game-head">
          <div className="head-title">
            <h1>Solitaire</h1>
            <a className="byline back-link" href="/">
              <ArrowLeft size={11} /> Apps On The House
            </a>
          </div>
        </header>
        <div className="overlay">
          <div className="card overlay-card">
            <h2>Solitaire</h2>
            <p>Move every card up to the four suit piles, Ace to King, to win. Tap a card, then tap where it should go.</p>
            <div className="setup-buttons">
              <button className="btn btn-primary" onClick={() => startNewGame(1)}>
                Draw 1
              </button>
              <button className="btn btn-outline" onClick={() => startNewGame(3)}>
                Draw 3
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="game-head">
        <div className="head-title">
          <h1>Solitaire</h1>
          <a className="byline back-link" href="/">
            <ArrowLeft size={11} /> Apps On The House
          </a>
        </div>
        <div className="head-right">
          <span className="score-pill">
            <span className="score-label">Moves</span>
            <span className="score-val">{state.moveCount}</span>
          </span>
          <span className="score-pill">
            <span className="score-label">Time</span>
            <span className="score-val">{formatTime(elapsedMs)}</span>
          </span>
          <button className="icon-btn" onClick={() => setShowStats(true)} aria-label="Stats">
            <BarChart2 size={18} />
          </button>
          <button className="icon-btn" onClick={() => dispatch({ type: 'UNDO' })} aria-label="Undo">
            <Undo2 size={18} />
          </button>
          <button className="icon-btn" onClick={() => setPhase('setup')} aria-label="New game">
            <Plus size={18} />
          </button>
        </div>
      </header>

      <div className="board">
        <div className="board-top-row">
          <div className="stock-waste">
            <Pile
              cards={state.stock}
              layout="single"
              onCardClick={() => dispatch({ type: 'DRAW' })}
              onEmptyClick={() => dispatch({ type: 'DRAW' })}
              emptyGlyph="↻"
              className="stock-pile"
            />
            <Pile
              cards={state.waste}
              layout="single"
              isSelected={(i) => isSelected('waste', i)}
              isShaking={state.shake === 'waste'}
              onCardClick={(i) => pileClick('waste', i)}
              className="waste-pile"
            />
          </div>
          <div className="foundations">
            {SUIT_ORDER.map((suit) => {
              const id = `foundation-${suit}`
              const cards = state.foundations[suit]
              return (
                <Pile
                  key={suit}
                  cards={cards}
                  layout="single"
                  emptyGlyph={suitSymbol(suit)}
                  isSelected={(i) => isSelected(id, i)}
                  isShaking={state.shake === id}
                  onCardClick={(i) => pileClick(id, i)}
                  onEmptyClick={() => pileClick(id, 0)}
                  className={`foundation-pile ${targets.includes(id) ? 'pile-target' : ''}`}
                />
              )
            })}
          </div>
        </div>

        <div className="tableau-row">
          {state.tableau.map((pile, col) => {
            const id = `tableau-${col}`
            return (
              <Pile
                key={col}
                cards={pile}
                layout="stack"
                isSelected={(i) => isSelected(id, i)}
                isShaking={state.shake === id}
                onCardClick={(i) => pileClick(id, i)}
                onEmptyClick={() => pileClick(id, 0)}
                className={`tableau-pile ${targets.includes(id) ? 'pile-target' : ''}`}
              />
            )
          })}
        </div>
      </div>

      {canAutoComplete(state) && !state.won && (
        <button className="btn btn-primary auto-complete-btn" onClick={() => dispatch({ type: 'AUTO_STEP' })}>
          Auto-complete
        </button>
      )}

      {state.won && (
        <div className="overlay">
          <div className="card overlay-card">
            <h2>You won!</h2>
            <p className="final-score">
              {formatTime(elapsedMs)} · {state.moveCount} moves
            </p>
            <div className="share-row">
              <ShareButton text={`I won Solitaire in ${formatTime(elapsedMs)} (${state.moveCount} moves)!`} />
            </div>
            <button className="btn btn-outline" onClick={() => setPhase('setup')}>
              New game
            </button>
          </div>
        </div>
      )}

      {showStats && (
        <div className="overlay" onClick={() => setShowStats(false)}>
          <div className="card overlay-card stats-card" onClick={(e) => e.stopPropagation()}>
            <h2>Stats</h2>
            {[1, 3].map((mode) => (
              <div className="stats-row" key={mode}>
                <h3>Draw {mode}</h3>
                <p>
                  Played {stats[mode].played} · Won {stats[mode].won}
                </p>
                <p>
                  Streak {stats[mode].streak} · Best streak {stats[mode].bestStreak}
                </p>
                <p>Best time {stats[mode].bestTimeMs != null ? formatTime(stats[mode].bestTimeMs) : '—'}</p>
              </div>
            ))}
            <button className="btn btn-outline" onClick={() => setShowStats(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
