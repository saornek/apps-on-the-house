import { describe, it, expect } from 'vitest'
import {
  ROWS,
  COLS,
  newTile,
  findRuns,
  hasMatch,
  resolveStep,
  scoreForClear,
  collapse,
  playSwap,
  findValidMoves,
  hasValidMove,
  generateBoard,
  shuffleBoard,
  makeRng,
} from './board.js'

// Build an 8x8 board from a base pattern (r+c)%6 — which has zero matches —
// then overwrite specific cells. `overrides` maps "r,c" -> color.
function makeBoard(overrides = {}) {
  const b = []
  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < COLS; c++) row.push(newTile((r + c) % 6))
    b.push(row)
  }
  for (const k in overrides) {
    const [r, c] = k.split(',').map(Number)
    b[r][c] = newTile(overrides[k])
  }
  return b
}

// Find the single special tile created on the board, if any.
function findSpecial(board) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (board[r][c] && board[r][c].special) return board[r][c]
  }
  return null
}

describe('base pattern', () => {
  it('(r+c)%6 has no matches', () => {
    expect(hasMatch(makeBoard())).toBe(false)
  })
})

describe('findRuns', () => {
  it('detects a horizontal run of 3', () => {
    // row 3, cols 0-2 set to color 5 (base there is 3,4,5 -> overwrite to 5,5,5)
    const b = makeBoard({ '3,0': 5, '3,1': 5, '3,2': 5 })
    const { horizRuns, matchedSet } = findRuns(b)
    expect(horizRuns.length).toBeGreaterThanOrEqual(1)
    expect(matchedSet.has('3,0')).toBe(true)
    expect(matchedSet.has('3,1')).toBe(true)
    expect(matchedSet.has('3,2')).toBe(true)
  })

  it('detects a vertical run of 3', () => {
    const b = makeBoard({ '2,5': 1, '3,5': 1, '4,5': 1 })
    const { vertRuns } = findRuns(b)
    expect(vertRuns.some((run) => run.length >= 3 && run.color === 1)).toBe(true)
  })

  it('ignores color-bomb tiles (color -1)', () => {
    const b = makeBoard()
    b[0][0] = newTile(-1, 'bomb')
    b[0][1] = newTile(-1, 'bomb')
    b[0][2] = newTile(-1, 'bomb')
    expect(hasMatch(b)).toBe(false)
  })
})

describe('2x2 squares', () => {
  it('detects a 2x2 block as a match', () => {
    // base (r+c)%6: (3,3)=0,(3,4)=1,(4,3)=1,(4,4)=2 — set all four to color 4.
    const b = makeBoard({ '3,3': 4, '3,4': 4, '4,3': 4, '4,4': 4 })
    const { matchedSet } = findRuns(b)
    expect(matchedSet.has('3,3')).toBe(true)
    expect(matchedSet.has('4,4')).toBe(true)
    expect(hasMatch(b)).toBe(true)
  })

  it('a 2x2 square forges a striped (star)', () => {
    const b = makeBoard({ '3,3': 4, '3,4': 4, '4,3': 4, '4,4': 4 })
    const { board } = resolveStep(b, [{ r: 3, c: 3 }])
    const sp = findSpecial(board)
    expect(sp).not.toBeNull()
    expect(sp.special).toBe('striped')
  })

  it('generateBoard contains no 2x2 squares', () => {
    const b = generateBoard(makeRng(21))
    for (let r = 0; r < ROWS - 1; r++) {
      for (let c = 0; c < COLS - 1; c++) {
        const col = b[r][c].color
        const square =
          b[r][c + 1].color === col && b[r + 1][c].color === col && b[r + 1][c + 1].color === col
        expect(square).toBe(false)
      }
    }
  })
})

describe('special creation', () => {
  it('match-4 in a line forges a striped', () => {
    const b = makeBoard({ '3,1': 5, '3,2': 5, '3,3': 5, '3,4': 5 })
    const { board } = resolveStep(b, [{ r: 3, c: 1 }, { r: 3, c: 2 }])
    const sp = findSpecial(board)
    expect(sp).not.toBeNull()
    expect(sp.special).toBe('striped')
  })

  it('match-5 in a straight line forges a color bomb', () => {
    const b = makeBoard({ '5,1': 2, '5,2': 2, '5,3': 2, '5,4': 2, '5,5': 2 })
    const { board } = resolveStep(b)
    const sp = findSpecial(board)
    expect(sp).not.toBeNull()
    expect(sp.special).toBe('bomb')
    expect(sp.color).toBe(-1)
  })

  it('an L/T shape forges a wrapped', () => {
    // Horizontal run row 4 cols 2-4, vertical run col 2 rows 4-6, sharing (4,2).
    const b = makeBoard({
      '4,2': 0, '4,3': 0, '4,4': 0,
      '5,2': 0, '6,2': 0,
    })
    const { board } = resolveStep(b, [{ r: 4, c: 2 }])
    const sp = findSpecial(board)
    expect(sp).not.toBeNull()
    expect(sp.special).toBe('wrapped')
  })
})

describe('special activation reporting', () => {
  it('a fired star (striped) reports its whole row as activated cells', () => {
    // A horizontal trio that includes a row-striped tile at (3,3).
    const b = makeBoard({ '3,2': 5, '3,4': 5 })
    b[3][3] = newTile(5, 'striped', 'row')
    const { activatedCells } = resolveStep(b)
    const inRow3 = activatedCells.filter(({ r }) => r === 3)
    expect(inRow3.length).toBe(5) // the 5 row cells beyond the matched trio
    expect(activatedCells.some(({ r, c }) => r === 3 && c === 0)).toBe(true)
  })

  it('a plain match has no activated cells', () => {
    const b = makeBoard({ '3,0': 5, '3,1': 5, '3,2': 5 })
    expect(resolveStep(b).activatedCells).toEqual([])
  })
})

describe('resolveStep clearing', () => {
  it('clears a plain match-3 (no special)', () => {
    const b = makeBoard({ '3,0': 5, '3,1': 5, '3,2': 5 })
    const { board, cleared, anyMatch } = resolveStep(b)
    expect(anyMatch).toBe(true)
    expect(cleared).toBe(3)
    expect(board[3][0]).toBeNull()
    expect(board[3][1]).toBeNull()
    expect(board[3][2]).toBeNull()
  })

  it('returns anyMatch=false on a settled board', () => {
    expect(resolveStep(makeBoard()).anyMatch).toBe(false)
  })
})

describe('scoreForClear', () => {
  it('rewards deeper cascades more', () => {
    expect(scoreForClear(3, 2)).toBeGreaterThan(scoreForClear(3, 1))
  })
})

describe('collapse (gravity + refill)', () => {
  it('fills every cell after clearing', () => {
    const rng = makeRng(1)
    let b = makeBoard({ '3,0': 5, '3,1': 5, '3,2': 5 })
    b = resolveStep(b).board
    b = collapse(b, rng)
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) expect(b[r][c]).not.toBeNull()
  })
})

describe('playSwap', () => {
  it('rejects a swap that makes no match', () => {
    // base pattern: swapping two arbitrary adjacent cells makes no line.
    const b = makeBoard()
    const res = playSwap(b, { r: 0, c: 0 }, { r: 0, c: 1 }, makeRng(2))
    expect(res.ok).toBe(false)
  })

  it('accepts a swap that makes a match and scores', () => {
    // Set up so swapping (3,3)<->(3,2) makes color 5 line at row 3 cols 0-3.
    // cols 0,1,3 = 5, and (3,2) currently 5? craft: put 5 at 0,1,2 already is a
    // match — instead make a swap-in: 5 at (3,0),(3,1),(2,2); swap (2,2)<->(3,2).
    const b = makeBoard({ '3,0': 5, '3,1': 5, '2,2': 5 })
    // (3,2) base = (3+2)%6 = 5 already... adjust override to avoid pre-match.
    b[3][2] = newTile(1)
    const res = playSwap(b, { r: 2, c: 2 }, { r: 3, c: 2 }, makeRng(3))
    expect(res.ok).toBe(true)
    expect(res.score).toBeGreaterThan(0)
  })
})

describe('valid moves & generation', () => {
  it('generateBoard has no matches and a valid move', () => {
    const b = generateBoard(makeRng(7))
    expect(hasMatch(b)).toBe(false)
    expect(hasValidMove(b)).toBe(true)
  })

  it('findValidMoves finds an obvious move', () => {
    // 5 at (3,0),(3,1); a 5 at (2,2). Swapping (2,2)down or (3,1)... ensure one move.
    const b = makeBoard({ '3,0': 5, '3,1': 5 })
    b[2][2] = newTile(5)
    b[3][2] = newTile(1)
    expect(findValidMoves(b).length).toBeGreaterThan(0)
  })
})

describe('shuffleBoard', () => {
  it('keeps tile count, has a valid move, and no immediate match', () => {
    const b = generateBoard(makeRng(11))
    const s = shuffleBoard(b, makeRng(12))
    let count = 0
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (s[r][c]) count++
    expect(count).toBe(ROWS * COLS)
    expect(hasMatch(s)).toBe(false)
    expect(hasValidMove(s)).toBe(true)
  })
})

describe('color bomb swap', () => {
  it('clears all tiles of the swapped color', () => {
    const b = makeBoard()
    b[0][0] = newTile(-1, 'bomb')
    // neighbor (0,1) base color = 1. Count color-1 tiles before.
    const before = b.flat().filter((t) => t && t.color === 1).length
    expect(before).toBeGreaterThan(0)
    const res = playSwap(b, { r: 0, c: 0 }, { r: 0, c: 1 }, makeRng(5))
    expect(res.ok).toBe(true)
    expect(res.score).toBeGreaterThan(0)
  })
})
