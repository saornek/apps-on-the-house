/*
 * 2048 board mechanics.
 * Part of Apps On The House. Free, no ads, no tracking.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

export const SIZE = 4
export const DIRECTIONS = ['up', 'down', 'left', 'right']

export const createEmptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0))

const cloneBoard = (board) => board.map((row) => row.slice())

const sameLine = (a, b) => a.length === b.length && a.every((value, index) => value === b[index])

const sameBoard = (a, b) => a.every((row, index) => sameLine(row, b[index]))

export function slideLine(line) {
  const compact = line.filter(Boolean)
  const merged = []
  let score = 0

  for (let i = 0; i < compact.length; i++) {
    const current = compact[i]
    const next = compact[i + 1]

    if (current === next) {
      const value = current * 2
      merged.push(value)
      score += value
      i += 1
    } else {
      merged.push(current)
    }
  }

  const result = [...merged, ...Array(SIZE - merged.length).fill(0)]
  return {
    line: result,
    score,
    moved: !sameLine(line, result),
  }
}

function getColumn(board, col) {
  return board.map((row) => row[col])
}

function setColumn(board, col, values) {
  for (let row = 0; row < SIZE; row++) board[row][col] = values[row]
}

export function moveBoard(board, direction) {
  if (!DIRECTIONS.includes(direction)) {
    throw new Error(`Unknown move direction: ${direction}`)
  }

  const next = createEmptyBoard()
  let score = 0

  if (direction === 'left' || direction === 'right') {
    for (let row = 0; row < SIZE; row++) {
      const source = direction === 'left' ? board[row] : board[row].toReversed()
      const moved = slideLine(source)
      next[row] = direction === 'left' ? moved.line : moved.line.toReversed()
      score += moved.score
    }
  } else {
    for (let col = 0; col < SIZE; col++) {
      const column = getColumn(board, col)
      const source = direction === 'up' ? column : column.toReversed()
      const moved = slideLine(source)
      setColumn(next, col, direction === 'up' ? moved.line : moved.line.toReversed())
      score += moved.score
    }
  }

  return {
    board: next,
    score,
    moved: !sameBoard(board, next),
  }
}

export function emptyCells(board) {
  const cells = []
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col] === 0) cells.push([row, col])
    }
  }
  return cells
}

export function addRandomTile(board, random = Math.random) {
  const cells = emptyCells(board)
  if (cells.length === 0) return cloneBoard(board)

  const next = cloneBoard(board)
  const cell = cells[Math.floor(random() * cells.length)]
  next[cell[0]][cell[1]] = random() < 0.9 ? 2 : 4
  return next
}

export function createInitialBoard(random = Math.random) {
  return addRandomTile(addRandomTile(createEmptyBoard(), random), random)
}

export function hasWon(board) {
  return board.some((row) => row.some((value) => value >= 2048))
}

export function hasMoves(board) {
  if (emptyCells(board).length > 0) return true

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = board[row][col]
      if (row < SIZE - 1 && board[row + 1][col] === value) return true
      if (col < SIZE - 1 && board[row][col + 1] === value) return true
    }
  }

  return false
}

export function isLost(board) {
  return !hasMoves(board)
}
