/* ==========================================================================
   Shape Crash — pure game logic. No React, no DOM. Fully unit-testable.

   Board model: an 8x8 array of rows. Each cell is a tile object or null.
   Tile = { id, color, special, orient }
     - color:   0..NUM_COLORS-1 for a normal shape; -1 for a color bomb (rainbow).
     - special: null | 'striped' | 'wrapped' | 'bomb'
     - orient:  'row' | 'col' for striped (which line it clears); undefined otherwise.

   Match rules:
     - 3+ in a line of equal color clears.
     - 4 in a line  -> striped (clears its whole row or column).
     - L / T shape  -> wrapped (clears surrounding 3x3).
     - 5 in a line  -> color bomb (clears every tile of one color).
   Bombs (color -1) never form color matches; they activate on swap or when
   caught in another clear.
   ========================================================================== */

export const ROWS = 8
export const COLS = 8
export const NUM_COLORS = 6
export const SHUFFLE_BUDGET = 5
const BASE_POINTS = 10
const SPECIAL_BONUS = 100

// --- RNG ------------------------------------------------------------------
// mulberry32: tiny deterministic PRNG so logic is reproducible in tests.
export function makeRng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const defaultRng = Math.random

// --- Tiles ----------------------------------------------------------------
let _id = 1
export function newTile(color, special = null, orient = undefined) {
  return { id: _id++, color, special, orient }
}

const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS
const key = (r, c) => `${r},${c}`
const parseKey = (k) => k.split(',').map(Number)
const cloneBoard = (board) => board.map((row) => row.slice())

// --- Match detection ------------------------------------------------------
// Find 2x2 blocks of one color (top-left cell of each).
function findSquares(board) {
  const squares = []
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const t = board[r][c]
      if (!t || t.color < 0) continue
      const col = t.color
      if (
        board[r][c + 1] && board[r][c + 1].color === col &&
        board[r + 1][c] && board[r + 1][c].color === col &&
        board[r + 1][c + 1] && board[r + 1][c + 1].color === col
      ) {
        squares.push({
          cells: [{ r, c }, { r, c: c + 1 }, { r: r + 1, c }, { r: r + 1, c: c + 1 }],
          color: col,
        })
      }
    }
  }
  return squares
}

// Returns horizontal/vertical runs (length >= 3), 2x2 squares, and the union
// of all matched cells.
export function findRuns(board) {
  const horizRuns = []
  const vertRuns = []
  const matchedSet = new Set()

  for (let r = 0; r < ROWS; r++) {
    let c = 0
    while (c < COLS) {
      const t = board[r][c]
      if (!t || t.color < 0) { c++; continue }
      let c2 = c + 1
      while (c2 < COLS && board[r][c2] && board[r][c2].color === t.color) c2++
      const len = c2 - c
      if (len >= 3) {
        const cells = []
        for (let cc = c; cc < c2; cc++) { cells.push({ r, c: cc }); matchedSet.add(key(r, cc)) }
        horizRuns.push({ cells, length: len, color: t.color, orient: 'horiz' })
      }
      c = c2
    }
  }

  for (let c = 0; c < COLS; c++) {
    let r = 0
    while (r < ROWS) {
      const t = board[r][c]
      if (!t || t.color < 0) { r++; continue }
      let r2 = r + 1
      while (r2 < ROWS && board[r2][c] && board[r2][c].color === t.color) r2++
      const len = r2 - r
      if (len >= 3) {
        const cells = []
        for (let rr = r; rr < r2; rr++) { cells.push({ r: rr, c }); matchedSet.add(key(rr, c)) }
        vertRuns.push({ cells, length: len, color: t.color, orient: 'vert' })
      }
      r = r2
    }
  }

  const squares = findSquares(board)
  for (const sq of squares) for (const { r, c } of sq.cells) matchedSet.add(key(r, c))

  return { horizRuns, vertRuns, squares, matchedSet }
}

export function hasMatch(board) {
  return findRuns(board).matchedSet.size > 0
}

function mostCommonColor(board) {
  const counts = {}
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = board[r][c]
      if (t && t.color >= 0) counts[t.color] = (counts[t.color] || 0) + 1
    }
  }
  let best = 0
  let bestCount = -1
  for (const k in counts) {
    if (counts[k] > bestCount) { bestCount = counts[k]; best = Number(k) }
  }
  return best
}

// --- Special classification ----------------------------------------------
// Decide which special tiles to forge from the current runs. Priority:
// wrapped (L/T intersection) > bomb (>=5) > striped (==4).
export function classifySpecials(board, horizRuns, vertRuns, squares, swapCells) {
  const specials = []
  const usedRuns = new Set()
  const inSwap = (r, c) => !!swapCells && swapCells.some((s) => s.r === r && s.c === c)

  const hByCell = new Map()
  const vByCell = new Map()
  horizRuns.forEach((run, i) => run.cells.forEach(({ r, c }) => hByCell.set(key(r, c), i)))
  vertRuns.forEach((run, i) => run.cells.forEach(({ r, c }) => vByCell.set(key(r, c), i)))

  // Wrapped: a cell shared by a horizontal AND a vertical run (L / T shape).
  for (const k of hByCell.keys()) {
    if (!vByCell.has(k)) continue
    const hi = hByCell.get(k)
    const vi = vByCell.get(k)
    if (usedRuns.has('h' + hi) || usedRuns.has('v' + vi)) continue
    const [r, c] = parseKey(k)
    specials.push({ r, c, special: 'wrapped', color: board[r][c].color })
    usedRuns.add('h' + hi)
    usedRuns.add('v' + vi)
  }

  // Bomb (>=5) and striped (==4) from remaining straight runs.
  const allRuns = [
    ...horizRuns.map((run, i) => ({ run, tag: 'h' + i, orient: 'row' })),
    ...vertRuns.map((run, i) => ({ run, tag: 'v' + i, orient: 'col' })),
  ]
  for (const { run, tag, orient } of allRuns) {
    if (usedRuns.has(tag)) continue
    let special = null
    if (run.length >= 5) special = 'bomb'
    else if (run.length === 4) special = 'striped'
    if (!special) continue
    const cell = run.cells.find(({ r, c }) => inSwap(r, c)) || run.cells[Math.floor(run.length / 2)]
    specials.push({
      r: cell.r,
      c: cell.c,
      special,
      orient: special === 'striped' ? orient : undefined,
      color: special === 'bomb' ? -1 : board[cell.r][cell.c].color,
    })
    usedRuns.add(tag)
  }

  // Squares (2x2) forge a striped (star). Skip a square whose region is already
  // consumed by another special so overlapping squares don't stack stars.
  const placed = new Set(specials.map((s) => key(s.r, s.c)))
  const consumed = new Set()
  for (const sq of squares || []) {
    if (sq.cells.some(({ r, c }) => placed.has(key(r, c)) || consumed.has(key(r, c)))) continue
    const cell = sq.cells.find(({ r, c }) => inSwap(r, c)) || sq.cells[0]
    specials.push({ r: cell.r, c: cell.c, special: 'striped', orient: 'row', color: board[cell.r][cell.c].color })
    placed.add(key(cell.r, cell.c))
    for (const { r, c } of sq.cells) consumed.add(key(r, c))
  }

  return specials
}

// Expand a set of cleared cells by activating any specials caught within it.
function expandClears(board, baseSet) {
  const result = new Set(baseSet)
  const queue = [...baseSet]
  while (queue.length) {
    const k = queue.pop()
    const [r, c] = parseKey(k)
    const tile = board[r][c]
    if (!tile || !tile.special) continue
    const add = []
    if (tile.special === 'striped') {
      if (tile.orient === 'row') for (let cc = 0; cc < COLS; cc++) add.push([r, cc])
      else for (let rr = 0; rr < ROWS; rr++) add.push([rr, c])
    } else if (tile.special === 'wrapped') {
      for (let rr = r - 1; rr <= r + 1; rr++) {
        for (let cc = c - 1; cc <= c + 1; cc++) if (inBounds(rr, cc)) add.push([rr, cc])
      }
    } else if (tile.special === 'bomb') {
      const color = mostCommonColor(board)
      for (let rr = 0; rr < ROWS; rr++) {
        for (let cc = 0; cc < COLS; cc++) {
          const t = board[rr][cc]
          if (t && t.color === color) add.push([rr, cc])
        }
      }
    }
    for (const [rr, cc] of add) {
      const kk = key(rr, cc)
      if (!result.has(kk)) { result.add(kk); queue.push(kk) }
    }
  }
  return result
}

// Resolve a single clear step: clear matched cells, forge specials, activate
// any specials caught in the clear. Returns a new board (tile identity reused
// for untouched cells) and how many cells were cleared.
export function resolveStep(board, swapCells = null) {
  const { horizRuns, vertRuns, squares, matchedSet } = findRuns(board)
  if (matchedSet.size === 0) return { board, cleared: 0, clearedCells: [], activatedCells: [], anyMatch: false, specials: [] }

  const specials = classifySpecials(board, horizRuns, vertRuns, squares, swapCells)
  const protectedCells = new Set(specials.map((s) => key(s.r, s.c)))

  // Base match cells, then expanded by any specials caught in the clear.
  const baseSet = new Set()
  for (const k of matchedSet) if (!protectedCells.has(k)) baseSet.add(k)
  let clearSet = expandClears(board, baseSet)
  for (const k of protectedCells) clearSet.delete(k)

  // Cells cleared *because* a special fired (beyond the base match) — used to
  // highlight a special's blast radius before the pop.
  const activatedCells = []
  for (const k of clearSet) if (!baseSet.has(k)) { const [r, c] = parseKey(k); activatedCells.push({ r, c }) }

  const nb = cloneBoard(board)
  const clearedCells = []
  for (const k of clearSet) { const [r, c] = parseKey(k); clearedCells.push({ r, c }); nb[r][c] = null }
  for (const s of specials) nb[s.r][s.c] = newTile(s.color, s.special, s.orient)

  return { board: nb, cleared: clearSet.size, clearedCells, activatedCells, anyMatch: true, specials }
}

export function scoreForClear(count, cascade) {
  return count * BASE_POINTS * Math.max(1, cascade)
}

// --- Gravity & refill -----------------------------------------------------
function applyGravity(board) {
  const nb = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  for (let c = 0; c < COLS; c++) {
    let target = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c]) { nb[target][c] = board[r][c]; target-- }
    }
  }
  return nb
}

function refill(board, rng, numColors) {
  const nb = cloneBoard(board)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!nb[r][c]) nb[r][c] = newTile(Math.floor(rng() * numColors))
    }
  }
  return nb
}

export function collapse(board, rng = defaultRng, numColors = NUM_COLORS) {
  return refill(applyGravity(board), rng, numColors)
}

// --- Full resolution (cascades) ------------------------------------------
// Resolves the board to a settled state, returning total score and cascade depth.
export function resolveAll(board, rng = defaultRng, { numColors = NUM_COLORS, swapCells = null } = {}) {
  let total = 0
  let cascade = 0
  let specialsForged = 0
  let b = board
  let first = true
  for (;;) {
    const sc = first ? swapCells : null
    const { board: nb, cleared, anyMatch, specials } = resolveStep(b, sc)
    if (!anyMatch) break
    cascade++
    total += scoreForClear(cleared, cascade) + specials.length * SPECIAL_BONUS
    specialsForged += specials.length
    b = collapse(nb, rng, numColors)
    first = false
  }
  return { board: b, score: total, cascades: cascade, specialsForged }
}

// --- Player swap ----------------------------------------------------------
// Attempt to swap two adjacent cells. Returns { ok, board, score }.
// ok=false means the swap made no match and is rejected (caller swaps back).
export function playSwap(board, a, b, rng = defaultRng, { numColors = NUM_COLORS } = {}) {
  const ta = board[a.r][a.c]
  const tb = board[b.r][b.c]
  if (!ta || !tb) return { ok: false, board }

  // Color-bomb swap: clears every tile of the other tile's color.
  if (ta.special === 'bomb' || tb.special === 'bomb') {
    const bombCell = ta.special === 'bomb' ? a : b
    const other = ta.special === 'bomb' ? tb : ta
    const targetColor = other.color >= 0 ? other.color : mostCommonColor(board)
    let nb = cloneBoard(board)
    const clear = new Set()
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = nb[r][c]
        if (t && t.color === targetColor) clear.add(key(r, c))
      }
    }
    clear.add(key(bombCell.r, bombCell.c))
    const expanded = expandClears(nb, clear)
    for (const k of expanded) { const [r, c] = parseKey(k); nb[r][c] = null }
    let score = scoreForClear(expanded.size, 1) + SPECIAL_BONUS
    nb = collapse(nb, rng, numColors)
    const res = resolveAll(nb, rng, { numColors })
    return { ok: true, board: res.board, score: score + res.score }
  }

  // Normal swap.
  const nb = cloneBoard(board)
  nb[a.r][a.c] = tb
  nb[b.r][b.c] = ta
  if (!hasMatch(nb)) return { ok: false, board }
  const res = resolveAll(nb, rng, { numColors, swapCells: [a, b] })
  return { ok: true, board: res.board, score: res.score }
}

// Compute a color-bomb swap as a single clear (pre-collapse), so the UI can
// animate the pop. Returns { board (nulled, not collapsed), clearedCells }.
export function bombClear(board, a, b) {
  const ta = board[a.r][a.c]
  const bombCell = ta.special === 'bomb' ? a : b
  const other = ta.special === 'bomb' ? board[b.r][b.c] : ta
  const targetColor = other.color >= 0 ? other.color : mostCommonColor(board)
  const nb = cloneBoard(board)
  const clear = new Set()
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = nb[r][c]
      if (t && t.color === targetColor) clear.add(key(r, c))
    }
  }
  clear.add(key(bombCell.r, bombCell.c))
  const expanded = expandClears(nb, clear)
  const clearedCells = []
  for (const k of expanded) { const [r, c] = parseKey(k); clearedCells.push({ r, c }); nb[r][c] = null }
  return { board: nb, clearedCells }
}

// --- Valid moves & shuffle -----------------------------------------------
export function findValidMoves(board) {
  const moves = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = board[r][c]
      if (!t) continue
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nr = r + dr
        const nc = c + dc
        if (!inBounds(nr, nc)) continue
        const u = board[nr][nc]
        if (!u) continue
        if (t.special === 'bomb' || u.special === 'bomb') {
          moves.push({ a: { r, c }, b: { r: nr, c: nc } })
          continue
        }
        const nb = cloneBoard(board)
        nb[r][c] = u
        nb[nr][nc] = t
        if (hasMatch(nb)) moves.push({ a: { r, c }, b: { r: nr, c: nc } })
      }
    }
  }
  return moves
}

export function hasValidMove(board) {
  return findValidMoves(board).length > 0
}

// Generate a fresh board with no pre-existing matches and at least one move.
export function generateBoard(rng = defaultRng, { rows = ROWS, cols = COLS, numColors = NUM_COLORS } = {}) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const b = []
    for (let r = 0; r < rows; r++) {
      const row = []
      for (let c = 0; c < cols; c++) {
        let color
        do {
          color = Math.floor(rng() * numColors)
        } while (
          (c >= 2 && row[c - 1].color === color && row[c - 2].color === color) ||
          (r >= 2 && b[r - 1][c].color === color && b[r - 2][c].color === color) ||
          // avoid completing a 2x2 square with the cells up, left, and up-left
          (r >= 1 && c >= 1 &&
            b[r - 1][c].color === color &&
            row[c - 1].color === color &&
            b[r - 1][c - 1].color === color)
        )
        row.push(newTile(color))
      }
      b.push(row)
    }
    if (!hasMatch(b) && hasValidMove(b)) return b
  }
  // Extremely unlikely fallback.
  return generateBoard(rng, { rows, cols, numColors })
}

// Reshuffle existing tiles (keeps specials) into a board with a valid move
// and no immediate matches. Falls back to a fresh board if needed.
export function shuffleBoard(board, rng = defaultRng, { numColors = NUM_COLORS } = {}) {
  const tiles = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) tiles.push(board[r][c])

  for (let attempt = 0; attempt < 300; attempt++) {
    const arr = tiles.slice()
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    const nb = []
    let k = 0
    for (let r = 0; r < ROWS; r++) {
      const row = []
      for (let c = 0; c < COLS; c++) row.push(arr[k++] || newTile(Math.floor(rng() * numColors)))
      nb.push(row)
    }
    if (!hasMatch(nb) && hasValidMove(nb)) return nb
  }
  return generateBoard(rng, { numColors })
}
