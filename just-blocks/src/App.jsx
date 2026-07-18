/*
 * Just Blocks — a calm block puzzle.
 * Part of Apps On The House. Free, no ads, no tracking.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import ShareButton from './ShareButton.jsx'

const SIZE = 8
const BEST_KEY = 'just-blocks:best'

// Warm palette that matches the Apps On The House tokens.
const COLORS = ['#C2693E', '#5B7A99', '#6E8B6A', '#C99A3F', '#B0573C', '#8A6D3B']

// Base polyomino shapes; rotations are generated from these.
const BASE_SHAPES = [
  [[0, 0]], // single
  [[0, 0], [0, 1]], // domino
  [[0, 0], [0, 1], [0, 2]], // 1x3
  [[0, 0], [0, 1], [0, 2], [0, 3]], // 1x4
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], // 1x5
  [[0, 0], [1, 0], [1, 1]], // corner (tromino)
  [[0, 0], [0, 1], [1, 0], [1, 1]], // 2x2 square
  [[0, 0], [1, 0], [2, 0], [2, 1]], // J / L
  [[0, 0], [0, 1], [0, 2], [1, 0]], // L variant
  [[0, 0], [0, 1], [1, 1], [1, 2]], // S / Z
  [[0, 1], [1, 0], [1, 1], [1, 2]], // T
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], // 2x3 block
  [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], // big corner (pentomino)
  [[0, 0], [0, 1], [0, 2], [1, 1]], // T (tetromino)
  [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], // 3x2 block
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], // 3x3 block
]

const norm = (cells) => {
  const minR = Math.min(...cells.map((c) => c[0]))
  const minC = Math.min(...cells.map((c) => c[1]))
  return cells
    .map(([r, c]) => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}
const rot = (cells) => cells.map(([r, c]) => [c, -r])
function variants(base) {
  const seen = new Map()
  let cur = norm(base)
  for (let i = 0; i < 4; i++) {
    const key = JSON.stringify(cur)
    if (!seen.has(key)) seen.set(key, cur)
    cur = norm(rot(cur))
  }
  return [...seen.values()]
}
const dims = (shape) => ({
  rows: Math.max(...shape.map((c) => c[0])) + 1,
  cols: Math.max(...shape.map((c) => c[1])) + 1,
})

// How often each base shape is drawn. The chunky symmetric pieces are rarer:
// 1x1 is the rarest, then 3x3, then 2x2; everything else is normal weight.
function weightFor(shape) {
  const { rows, cols } = dims(shape)
  const n = shape.length
  if (n === 1) return 0.12 // 1x1 — really rare
  if (rows === 3 && cols === 3 && n === 9) return 0.25 // 3x3
  if (rows === 2 && cols === 2 && n === 4) return 0.5 // 2x2
  return 1
}

// Group rotations by base shape, each with a draw weight. We pick a base by weight
// (so the symmetric chunky pieces stay rare), then a random rotation of it.
const SHAPES = BASE_SHAPES.map((b) => ({ variants: variants(b), weight: weightFor(b) }))
const POOL = SHAPES.flatMap((s) => s.variants)
const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0)
const randomShape = () => {
  let r = Math.random() * TOTAL_WEIGHT
  for (const s of SHAPES) {
    r -= s.weight
    if (r <= 0) return s.variants[(Math.random() * s.variants.length) | 0]
  }
  const last = SHAPES[SHAPES.length - 1]
  return last.variants[(Math.random() * last.variants.length) | 0]
}
const uid = () => Math.random().toString(36).slice(2)
const randomPiece = () => ({
  id: uid(),
  shape: randomShape(),
  color: COLORS[(Math.random() * COLORS.length) | 0],
})
const newTray = () => [randomPiece(), randomPiece(), randomPiece()]
const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null))

function canPlace(board, shape, r0, c0) {
  for (const [r, c] of shape) {
    const r1 = r0 + r
    const c1 = c0 + c
    if (r1 < 0 || c1 < 0 || r1 >= SIZE || c1 >= SIZE) return false
    if (board[r1][c1]) return false
  }
  return true
}
function placeOn(board, shape, r0, c0, color) {
  const b = board.map((row) => row.slice())
  for (const [r, c] of shape) b[r0 + r][c0 + c] = color
  return b
}
function clearLines(board) {
  const fullRows = []
  const fullCols = []
  for (let r = 0; r < SIZE; r++) if (board[r].every(Boolean)) fullRows.push(r)
  for (let c = 0; c < SIZE; c++) {
    let full = true
    for (let r = 0; r < SIZE; r++) if (!board[r][c]) { full = false; break }
    if (full) fullCols.push(c)
  }
  if (!fullRows.length && !fullCols.length) return { board, cleared: 0 }
  const b = board.map((row) => row.slice())
  for (const r of fullRows) for (let c = 0; c < SIZE; c++) b[r][c] = null
  for (const c of fullCols) for (let r = 0; r < SIZE; r++) b[r][c] = null
  return { board: b, cleared: fullRows.length + fullCols.length }
}
function anyFits(board, pieces) {
  for (const p of pieces) {
    if (!p) continue
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (canPlace(board, p.shape, r, c)) return true
  }
  return false
}

// Can this single shape be placed anywhere on the board?
function shapeFits(board, shape) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (canPlace(board, shape, r, c)) return true
  return false
}

// Is there any piece in the whole pool that could fit? (false => genuine game over)
function boardHasRoom(board) {
  return POOL.some((shape) => shapeFits(board, shape))
}

// Deal a tray of 3 such that at least one piece fits the given board, so a fresh
// deal never instantly ends a still-playable game. If the board is truly jammed
// (no pool piece fits anywhere), return a normal random tray and let it be game over.
function trayForBoard(board) {
  if (!boardHasRoom(board)) return newTray()
  for (let i = 0; i < 40; i++) {
    const t = [randomPiece(), randomPiece(), randomPiece()]
    if (t.some((p) => shapeFits(board, p.shape))) return t
  }
  // Fallback: force one guaranteed-fitting piece into a random slot.
  const fitting = POOL.filter((shape) => shapeFits(board, shape))
  const forced = {
    id: uid(),
    shape: fitting[(Math.random() * fitting.length) | 0],
    color: COLORS[(Math.random() * COLORS.length) | 0],
  }
  const t = [randomPiece(), randomPiece(), randomPiece()]
  t[(Math.random() * 3) | 0] = forced
  return t
}

export default function App() {
  const [board, setBoard] = useState(emptyBoard)
  const [tray, setTray] = useState(newTray)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem(BEST_KEY) || 0) } catch { return 0 }
  })
  const [over, setOver] = useState(false)
  const [drag, setDrag] = useState(null)
  const [flash, setFlash] = useState(() => new Set()) // cells currently clearing

  const boardRef = useRef(null)
  // Refs mirror state so the pointer handlers always read fresh values.
  const boardR = useRef(board); boardR.current = board
  const trayR = useRef(tray); trayR.current = tray

  // Persist best score.
  useEffect(() => {
    if (score > best) {
      setBest(score)
      try { localStorage.setItem(BEST_KEY, String(score)) } catch { /* ignore */ }
    }
  }, [score, best])

  // Game over when no current piece fits anywhere.
  // (Skip while lines are mid-clear, since the board is briefly still full.)
  useEffect(() => {
    if (!over && flash.size === 0 && tray.some(Boolean) && !anyFits(board, tray)) setOver(true)
  }, [board, tray, over, flash])

  function cellPx() {
    const el = boardRef.current
    return el ? el.getBoundingClientRect().width / SIZE : 40
  }

  function commitPlace(index, r0, c0) {
    const piece = trayR.current[index]
    if (!piece || !canPlace(boardR.current, piece.shape, r0, c0)) return
    const placed = placeOn(boardR.current, piece.shape, r0, c0, piece.color)

    // Find full rows/columns on the freshly-placed board.
    const fullRows = []
    const fullCols = []
    for (let r = 0; r < SIZE; r++) if (placed[r].every(Boolean)) fullRows.push(r)
    for (let c = 0; c < SIZE; c++) {
      let full = true
      for (let r = 0; r < SIZE; r++) if (!placed[r][c]) { full = false; break }
      if (full) fullCols.push(c)
    }
    const lines = fullRows.length + fullCols.length
    const gained = piece.shape.length + (lines > 0 ? lines * lines * 10 : 0)

    // Board after any clears — computed now so a tray refill can be checked against it.
    let cleared = placed
    if (lines > 0) {
      cleared = placed.map((row) => row.slice())
      for (const r of fullRows) for (let c = 0; c < SIZE; c++) cleared[r][c] = null
      for (const c of fullCols) for (let r = 0; r < SIZE; r++) cleared[r][c] = null
    }

    // Refill the tray when all three are used — dealing a set where at least one
    // piece fits the resulting board (so a fresh deal never instantly ends the game).
    let t = trayR.current.slice()
    t[index] = null
    if (t.every((x) => !x)) t = trayForBoard(cleared)

    setScore((s) => s + gained)
    setTray(t)
    setBoard(placed)

    if (lines === 0) return

    // Flash the cells that are about to clear, then remove them.
    const flashSet = new Set()
    for (const r of fullRows) for (let c = 0; c < SIZE; c++) flashSet.add(r * SIZE + c)
    for (const c of fullCols) for (let r = 0; r < SIZE; r++) flashSet.add(r * SIZE + c)
    setFlash(flashSet)
    window.setTimeout(() => {
      setBoard(cleared)
      setFlash(new Set())
    }, 440)
  }

  function startDrag(e, index) {
    if (over) return
    const piece = tray[index]
    if (!piece) return
    e.preventDefault()
    const cell = cellPx()
    const lift = e.pointerType === 'touch' ? cell * 1.4 : 0
    setDrag({ index, piece, x: e.clientX, y: e.clientY, cell, lift, preview: null })
  }

  // Pointer move / up while dragging.
  useEffect(() => {
    if (!drag) return
    const move = (e) => {
      if (e.cancelable) e.preventDefault()
      const rect = boardRef.current.getBoundingClientRect()
      const cell = rect.width / SIZE
      const { rows, cols } = dims(drag.piece.shape)
      const floatLeft = e.clientX - (cols * cell) / 2
      const floatTop = e.clientY - (rows * cell) / 2 - drag.lift
      const c0 = Math.round((floatLeft - rect.left) / cell)
      const r0 = Math.round((floatTop - rect.top) / cell)
      const valid = canPlace(boardR.current, drag.piece.shape, r0, c0)
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, cell, preview: { r: r0, c: c0, valid } } : d))
    }
    const end = () => {
      setDrag((d) => {
        if (d && d.preview && d.preview.valid) commitPlace(d.index, d.preview.r, d.preview.c)
        return null
      })
    }
    // Block iOS Safari from scrolling the page while a piece is being dragged.
    const blockTouch = (e) => {
      if (e.cancelable) e.preventDefault()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('touchmove', blockTouch, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('touchmove', blockTouch)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [drag])

  function restart() {
    setBoard(emptyBoard())
    setTray(newTray())
    setScore(0)
    setOver(false)
    setDrag(null)
    setFlash(new Set())
  }

  // Build the ghost-preview lookup.
  const previewCells = new Set()
  let previewValid = false
  if (drag && drag.preview) {
    previewValid = drag.preview.valid
    for (const [r, c] of drag.piece.shape) {
      const rr = drag.preview.r + r
      const cc = drag.preview.c + c
      if (rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE) previewCells.add(rr * SIZE + cc)
    }
  }

  return (
    <div className="game">
      <header className="game-head">
        <div className="brand">
          <span className="brand-name">Just Blocks</span>
          <a className="brand-by" href="/">
            <ArrowLeft size={11} /> Apps On The House
          </a>
        </div>
        <div className="scores">
          <div className="score-box">
            <div className="score-label">Score</div>
            <div className="score-value">{score}</div>
          </div>
          <div className="score-box">
            <div className="score-label">Best</div>
            <div className="score-value">{best}</div>
          </div>
          <button className="restart" onClick={restart} aria-label="Restart">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <div className="board-wrap">
        <div className="board" ref={boardRef}>
          {board.map((row, r) =>
            row.map((cell, c) => {
              const idx = r * SIZE + c
              const ghost = !cell && previewCells.has(idx)
              const cls =
                'cell' +
                (cell ? ' filled' : '') +
                (flash.has(idx) ? ' flash' : '') +
                (ghost ? (previewValid ? ' ghost' : ' ghost bad') : '')
              const style = cell
                ? { background: cell }
                : ghost && previewValid
                  ? { background: drag.piece.color }
                  : undefined
              return <div key={idx} className={cls} style={style} />
            }),
          )}
        </div>

        {over && (
          <div className="overlay">
            <div className="overlay-card">
              <h2>No moves left</h2>
              <p>
                Score <strong>{score}</strong>
                {score >= best && score > 0 ? ' — new best!' : ` · best ${best}`}
              </p>
              <div className="overlay-actions">
                <button className="btn btn-primary" onClick={restart}>
                  Play again
                </button>
                <ShareButton text={`I scored ${score} in Just Blocks. Can you beat me?`} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tray">
        {tray.map((piece, i) => {
          const beingDragged = drag && drag.index === i
          return (
            <div className="tray-slot" key={piece ? piece.id : `empty-${i}`}>
              {piece && !beingDragged && (
                <div
                  className="tray-piece"
                  onPointerDown={(e) => startDrag(e, i)}
                  style={gridStyle(piece.shape, 'var(--tcell)')}
                >
                  {renderBlocks(piece.shape, piece.color)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="hint">Drag a piece onto the grid. Fill a row or column to clear it.</p>

      {/* Floating piece that follows the pointer while dragging */}
      {drag && (
        <div
          className="floating"
          style={{
            left: drag.x - (dims(drag.piece.shape).cols * drag.cell) / 2,
            top: drag.y - (dims(drag.piece.shape).rows * drag.cell) / 2 - drag.lift,
            ...gridStyle(drag.piece.shape, drag.cell),
          }}
        >
          {renderBlocks(drag.piece.shape, drag.piece.color)}
        </div>
      )}
    </div>
  )
}

// --- small render helpers ---
function gridStyle(shape, cell) {
  const { rows, cols } = dims(shape)
  const size = typeof cell === 'number' ? `${cell}px` : cell || '1fr'
  return {
    gridTemplateColumns: `repeat(${cols}, ${size})`,
    gridTemplateRows: `repeat(${rows}, ${size})`,
  }
}
function renderBlocks(shape, color) {
  const { cols } = dims(shape)
  const filled = new Set(shape.map(([r, c]) => r * cols + c))
  const { rows } = dims(shape)
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = filled.has(r * cols + c)
      cells.push(
        <div
          key={`${r}-${c}`}
          className={on ? 'pblock' : 'pblock empty'}
          style={on ? { background: color } : undefined}
        />,
      )
    }
  }
  return cells
}
