/*
 * Shape Crash — an endless, score-based match-3 with cute geometric blocks.
 * Part of Apps On The House. Free, no ads, no tracking.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, HelpCircle, X } from 'lucide-react'
import Shape from './shapes.jsx'
import {
  ROWS,
  COLS,
  SHUFFLE_BUDGET,
  generateBoard,
  shuffleBoard,
  resolveStep,
  collapse,
  scoreForClear,
  hasMatch,
  hasValidMove,
  bombClear,
} from './board.js'

const HS_KEY = 'shape-crash:highscore'
const SPECIAL_BONUS = 100

// Animation timings (ms).
const SWAP_MS = 180
const HIGHLIGHT_MS = 320
const POP_MS = 200
const FALL_MS = 280

const delay = (ms) => new Promise((res) => setTimeout(res, ms))
const cloneBoard = (b) => b.map((row) => row.slice())
const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1

function loadHighScore() {
  const raw = Number(localStorage.getItem(HS_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export default function App() {
  const [board, setBoard] = useState(() => generateBoard())
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(loadHighScore)
  const [shufflesUsed, setShufflesUsed] = useState(0)
  const [selected, setSelected] = useState(null)
  const [clearing, setClearing] = useState(() => new Set()) // tile ids popping
  const [highlight, setHighlight] = useState(() => new Set()) // tile ids a special is about to clear
  const [gameOver, setGameOver] = useState(false)
  const [newBest, setNewBest] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const boardRef = useRef(null)
  const seenIds = useRef(new Set())
  const drag = useRef(null)
  const busy = useRef(false)
  const scoreRef = useRef(0)
  const shufflesRef = useRef(0)
  const runBest = useRef(loadHighScore())

  const remaining = SHUFFLE_BUDGET - shufflesUsed

  // Keep refs in sync so async animation steps read fresh values.
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { shufflesRef.current = shufflesUsed }, [shufflesUsed])

  // Mark which tile ids are brand-new this render (for the drop-in animation).
  const appearIds = (() => {
    const next = new Set()
    for (const row of board) for (const t of row) if (t && !seenIds.current.has(t.id)) next.add(t.id)
    return next
  })()
  useEffect(() => {
    for (const row of board) for (const t of row) if (t) seenIds.current.add(t.id)
  }, [board])

  // Persist high score live.
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      try { localStorage.setItem(HS_KEY, String(score)) } catch { /* ignore */ }
    }
  }, [score, highScore])

  // iOS belt-and-suspenders: cancel touchmove on the board.
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const block = (e) => { if (e.cancelable) e.preventDefault() }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  // Close the rules popup with Escape.
  useEffect(() => {
    if (!showRules) return
    const onKey = (e) => { if (e.key === 'Escape') setShowRules(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showRules])

  const addScore = useCallback((gained) => {
    if (!gained) return
    scoreRef.current += gained
    setScore(scoreRef.current)
  }, [])

  const finishGame = useCallback((finalBoard) => {
    setBoard(finalBoard)
    setNewBest(scoreRef.current > runBest.current)
    setGameOver(true)
  }, [])

  // After the board settles, enforce the no-moves / shuffle-budget rule.
  const settle = useCallback(
    async (b) => {
      if (hasValidMove(b)) { setBoard(b); return }
      if (shufflesRef.current >= SHUFFLE_BUDGET) { finishGame(b); return }
      // auto-shuffle
      shufflesRef.current += 1
      setShufflesUsed(shufflesRef.current)
      await delay(POP_MS)
      setBoard(shuffleBoard(b))
    },
    [finishGame],
  )

  // Animate a clear → collapse → cascade loop starting from `startBoard`.
  const resolveAnimated = useCallback(
    async (startBoard, swapCells) => {
      let b = startBoard
      let first = true
      let cascade = 0
      for (;;) {
        const step = resolveStep(b, first ? swapCells : null)
        if (!step.anyMatch) break
        cascade += 1
        // Highlight phase: when a special fires, flash the cells it's blasting.
        if (step.activatedCells.length) {
          const hi = new Set()
          for (const { r, c } of step.activatedCells) if (b[r][c]) hi.add(b[r][c].id)
          setHighlight(hi)
          await delay(HIGHLIGHT_MS)
          setHighlight(new Set())
        }
        // Pop phase: tiles about to clear scale away.
        const ids = new Set()
        for (const { r, c } of step.clearedCells) if (b[r][c]) ids.add(b[r][c].id)
        setClearing(ids)
        await delay(POP_MS)
        // Collapse: remaining tiles fall, new tiles drop in.
        const collapsed = collapse(step.board)
        addScore(scoreForClear(step.cleared, cascade) + step.specials.length * SPECIAL_BONUS)
        setClearing(new Set())
        setBoard(collapsed)
        await delay(FALL_MS)
        b = collapsed
        first = false
      }
      return b
    },
    [addScore],
  )

  const attemptMove = useCallback(
    async (a, b) => {
      if (busy.current || gameOver) return
      const ta = board[a.r][a.c]
      const tb = board[b.r][b.c]
      if (!ta || !tb) return
      busy.current = true
      setSelected(null)

      if (ta.special === 'bomb' || tb.special === 'bomb') {
        // Color-bomb swap: pop everything of the target color, then cascade.
        const { board: cleared, clearedCells } = bombClear(board, a, b)
        const ids = new Set()
        for (const { r, c } of clearedCells) if (board[r][c]) ids.add(board[r][c].id)
        // Highlight every tile the rainbow is removing, then pop them.
        setHighlight(ids)
        await delay(HIGHLIGHT_MS)
        setHighlight(new Set())
        setClearing(ids)
        await delay(POP_MS)
        const collapsed = collapse(cleared)
        addScore(scoreForClear(clearedCells.length, 1) + SPECIAL_BONUS)
        setClearing(new Set())
        setBoard(collapsed)
        await delay(FALL_MS)
        const settledBoard = await resolveAnimated(collapsed, null)
        await settle(settledBoard)
        busy.current = false
        return
      }

      // Normal swap: animate the slide first.
      const swapped = cloneBoard(board)
      swapped[a.r][a.c] = tb
      swapped[b.r][b.c] = ta
      setBoard(swapped)
      await delay(SWAP_MS)

      if (!hasMatch(swapped)) {
        setBoard(board) // reject — slide back
        await delay(SWAP_MS)
        busy.current = false
        return
      }

      const settledBoard = await resolveAnimated(swapped, [a, b])
      await settle(settledBoard)
      busy.current = false
    },
    [board, gameOver, addScore, resolveAnimated, settle],
  )

  // --- Pointer input: drag-to-swap and tap-then-tap-adjacent --------------
  const onPointerDown = (e, r, c) => {
    if (gameOver || busy.current) return
    drag.current = { r, c, x: e.clientX, y: e.clientY, moved: false }
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || d.moved) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const cell = boardRef.current ? boardRef.current.clientWidth / COLS : 44
    const threshold = Math.max(14, cell * 0.35)
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return
    d.moved = true
    const target =
      Math.abs(dx) > Math.abs(dy)
        ? { r: d.r, c: d.c + (dx > 0 ? 1 : -1) }
        : { r: d.r + (dy > 0 ? 1 : -1), c: d.c }
    drag.current = null
    if (target.r >= 0 && target.r < ROWS && target.c >= 0 && target.c < COLS) {
      attemptMove({ r: d.r, c: d.c }, target)
    }
  }

  const onPointerUp = (r, c) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return // a drag handled it
    const cell = { r, c }
    if (!selected) setSelected(cell)
    else if (selected.r === r && selected.c === c) setSelected(null)
    else if (adjacent(selected, cell)) attemptMove(selected, cell)
    else setSelected(cell)
  }

  const onManualShuffle = async () => {
    if (gameOver || busy.current || remaining <= 0) return
    busy.current = true
    setSelected(null)
    shufflesRef.current += 1
    setShufflesUsed(shufflesRef.current)
    setBoard(shuffleBoard(board))
    await delay(FALL_MS)
    busy.current = false
  }

  const restart = () => {
    seenIds.current = new Set()
    scoreRef.current = 0
    shufflesRef.current = 0
    runBest.current = loadHighScore()
    setBoard(generateBoard())
    setScore(0)
    setShufflesUsed(0)
    setSelected(null)
    setClearing(new Set())
    setHighlight(new Set())
    setNewBest(false)
    setGameOver(false)
  }

  const cellPct = 100 / COLS

  return (
    <div className="game">
      <header className="game-head">
        <div className="brand">
          <span className="brand-name">Shape Crash</span>
          <span className="brand-by">Apps On The House</span>
        </div>
        <div className="scores">
          <div className="score-pill">
            <span className="score-label">Score</span>
            <span className="score-val">{score.toLocaleString()}</span>
          </div>
          <div className="score-pill best">
            <span className="score-label">Best</span>
            <span className="score-val">{highScore.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <div className="board-wrap">
        <div className="board" ref={boardRef} onPointerMove={onPointerMove}>
          <div className="cells">
            {Array.from({ length: ROWS * COLS }, (_, i) => (
              <div key={i} className={`sq ${(Math.floor(i / COLS) + (i % COLS)) % 2 ? 'sq--alt' : ''}`} />
            ))}
          </div>
          <div className="tiles">
            {board.map((row, r) =>
              row.map((tile, c) => {
                if (!tile) return null
                const isSel = selected && selected.r === r && selected.c === c
                const cls = [
                  'tile',
                  isSel ? 'selected' : '',
                  highlight.has(tile.id) ? 'highlight' : '',
                  clearing.has(tile.id) ? 'clearing' : '',
                  appearIds.has(tile.id) ? 'appear' : '',
                ].join(' ')
                return (
                  <div
                    key={tile.id}
                    className={cls}
                    style={{
                      left: `${c * cellPct}%`,
                      top: `${r * cellPct}%`,
                      width: `${cellPct}%`,
                      height: `${cellPct}%`,
                    }}
                    onPointerDown={(e) => onPointerDown(e, r, c)}
                    onPointerUp={() => onPointerUp(r, c)}
                  >
                    <Shape tile={tile} />
                  </div>
                )
              }),
            )}
          </div>
        </div>
      </div>

      <div className="controls">
        <button
          className="shuffle-btn"
          onClick={onManualShuffle}
          disabled={remaining <= 0 || gameOver}
          aria-label="Shuffle the board"
          title="Shuffle the board"
        >
          <RotateCcw size={20} strokeWidth={2.4} />
        </button>
        <div className="shuffle-count">
          <b>{remaining}</b> / {SHUFFLE_BUDGET} shuffles
        </div>
        <button className="help-btn" onClick={() => setShowRules(true)} aria-label="How to play">
          <HelpCircle size={16} strokeWidth={2.2} />
          How to play
        </button>
      </div>

      {showRules && (
        <div className="overlay-modal" onClick={() => setShowRules(false)}>
          <div className="overlay-card rules-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-x" onClick={() => setShowRules(false)} aria-label="Close">
              <X size={20} />
            </button>
            <h2>How to play</h2>
            <div className="rules-body">
              <p>
                Swap two touching shapes — <b>drag</b> one onto a neighbour, or <b>tap</b> one then
                tap an adjacent one. Line up <b>3 or more</b> of the same shape in a row or column to
                clear them and score. When a clear causes more shapes to fall into new matches
                (a <b>cascade</b>), each step scores more.
              </p>

              <h3>Special shapes</h3>
              <ul className="specials">
                <li>
                  <span className="ex"><Shape tile={{ id: 'ex-star', color: 2, special: 'striped', orient: 'row' }} /></span>
                  <div><b>Star</b> — make a line of <b>4</b> or a <b>2×2 square</b>. When cleared, it wipes its whole row or column.</div>
                </li>
                <li>
                  <span className="ex"><Shape tile={{ id: 'ex-heart', color: 0, special: 'wrapped' }} /></span>
                  <div><b>Heart</b> — make an <b>L or T</b> shape. When cleared, it blasts the surrounding 3×3.</div>
                </li>
                <li>
                  <span className="ex"><Shape tile={{ id: 'ex-bomb', color: -1, special: 'bomb' }} /></span>
                  <div><b>Rainbow</b> — make a line of <b>5</b>. Swap it with any shape to clear every shape of that colour.</div>
                </li>
              </ul>

              <h3>Shuffles</h3>
              <p>
                Stuck? Tap the
                <span className="rules-inline-icon"><RotateCcw size={15} strokeWidth={2.4} /></span>
                button to shuffle the board — you get <b>{SHUFFLE_BUDGET}</b> a game. If the board ever
                runs out of moves it shuffles on its own. When your shuffles run out, the game ends and
                your score is final.
              </p>
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="overlay-modal">
          <div className="overlay-card">
            <h2>Out of shuffles!</h2>
            {newBest && <span className="badge">★ New best score</span>}
            <div className="final-score">{score.toLocaleString()}</div>
            <p>Best: {highScore.toLocaleString()}</p>
            <button className="btn btn-primary" onClick={restart}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
