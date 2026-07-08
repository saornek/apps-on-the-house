/*
 * 2048 — a classic sliding tile puzzle.
 * Part of Apps On The House. Free, no ads, no tracking.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { addRandomTile, createInitialBoard, hasWon, isLost, moveBoard } from './board.js'
import ShareButton from './ShareButton.jsx'

const BEST_KEY = '2048:best'
const SWIPE_MIN = 28

const KEY_DIRECTIONS = new Map([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['w', 'up'],
  ['W', 'up'],
  ['a', 'left'],
  ['A', 'left'],
  ['s', 'down'],
  ['S', 'down'],
  ['d', 'right'],
  ['D', 'right'],
])

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0)
  } catch {
    return 0
  }
}

function Tile({ value }) {
  if (!value) return <div className="tile tile-empty" aria-hidden="true" />

  const capped = value >= 2048 ? 'super' : String(value)
  return (
    <div className={`tile tile-${capped}`} data-wide={value >= 1000 ? 'true' : undefined}>
      {value}
    </div>
  )
}

function ScoreBox({ label, value }) {
  return (
    <div className="score-box">
      <div className="score-label">{label}</div>
      <div className="score-value">{value}</div>
    </div>
  )
}

export default function App() {
  const [board, setBoard] = useState(() => createInitialBoard())
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [won, setWon] = useState(() => hasWon(board))
  const [keepPlaying, setKeepPlaying] = useState(false)
  const [lost, setLost] = useState(() => isLost(board))
  const pointerStart = useRef(null)

  const overlay = useMemo(() => {
    if (lost) return 'lost'
    if (won && !keepPlaying) return 'won'
    return null
  }, [keepPlaying, lost, won])

  const startNewGame = useCallback(() => {
    const fresh = createInitialBoard()
    setBoard(fresh)
    setScore(0)
    setWon(hasWon(fresh))
    setKeepPlaying(false)
    setLost(isLost(fresh))
  }, [])

  const commitMove = useCallback(
    (direction) => {
      if (lost || (won && !keepPlaying)) return

      const moved = moveBoard(board, direction)
      if (!moved.moved) return

      const next = addRandomTile(moved.board)
      const nextScore = score + moved.score

      setBoard(next)
      setScore(nextScore)
      setWon((alreadyWon) => alreadyWon || hasWon(next))
      setLost(isLost(next))

      if (nextScore > best) {
        setBest(nextScore)
        try {
          localStorage.setItem(BEST_KEY, String(nextScore))
        } catch {
          // Local storage can be unavailable in private modes; gameplay still works.
        }
      }
    },
    [best, board, keepPlaying, lost, score, won],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      const direction = KEY_DIRECTIONS.get(event.key)
      if (!direction) return
      event.preventDefault()
      commitMove(direction)
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commitMove])

  function onPointerDown(event) {
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return

    if (Math.abs(dx) > Math.abs(dy)) {
      commitMove(dx > 0 ? 'right' : 'left')
    } else {
      commitMove(dy > 0 ? 'down' : 'up')
    }
  }

  return (
    <main className="game" aria-label="2048 game">
      <header className="game-head">
        <div className="brand">
          <span className="brand-name">2048</span>
          <a className="brand-by" href="/">
            <ArrowLeft size={11} /> Apps On The House
          </a>
        </div>
        <div className="scores">
          <ScoreBox label="Score" value={score} />
          <ScoreBox label="Best" value={best} />
          <button className="restart" type="button" onClick={startNewGame} aria-label="New game">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <section
        className="board-wrap"
        aria-label="2048 board"
        onPointerDown={onPointerDown}
        onPointerCancel={() => {
          pointerStart.current = null
        }}
        onPointerUp={onPointerUp}
      >
        <div className="board">
          {board.flatMap((row, rowIndex) =>
            row.map((value, colIndex) => (
              <Tile key={`${rowIndex}-${colIndex}`} value={value} />
            )),
          )}
        </div>

        {overlay && (
          <div className="overlay" role="dialog" aria-modal="true">
            <div className="overlay-card">
              {overlay === 'won' ? (
                <>
                  <h2>2048 reached</h2>
                  <p>Beautiful. Keep sliding for a higher score?</p>
                  <div className="overlay-actions">
                    <button className="btn btn-primary" type="button" onClick={() => setKeepPlaying(true)}>
                      Keep going
                    </button>
                    <button className="btn btn-outline" type="button" onClick={startNewGame}>
                      New game
                    </button>
                    <ShareButton text={`I hit 2048 (score: ${score}) — play free at Apps On The House!`} />
                  </div>
                </>
              ) : (
                <>
                  <h2>Game over</h2>
                  <p>
                    Score <strong>{score}</strong>
                  </p>
                  <div className="overlay-actions">
                    <button className="btn btn-primary" type="button" onClick={startNewGame}>
                      New game
                    </button>
                    <ShareButton text={`I scored ${score} in 2048 — play free at Apps On The House!`} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <p className="hint">Use arrow keys, WASD, or swipe.</p>
    </main>
  )
}
