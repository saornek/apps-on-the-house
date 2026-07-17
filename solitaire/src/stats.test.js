/*
 * Solitaire - stats persistence tests.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { loadStats, recordGameStart, recordWin, recordAbandon } from './stats.js'

function makeFakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

describe('loadStats', () => {
  it('returns empty stats for both draw modes when storage is empty', () => {
    const stats = loadStats(makeFakeStorage())
    expect(stats[1]).toEqual({ played: 0, won: 0, streak: 0, bestStreak: 0, bestTimeMs: null })
    expect(stats[3]).toEqual({ played: 0, won: 0, streak: 0, bestStreak: 0, bestTimeMs: null })
  })

  it('falls back to empty stats if storage holds invalid JSON', () => {
    const storage = makeFakeStorage()
    storage.setItem('solitaire:stats:v1', 'not json')
    const stats = loadStats(storage)
    expect(stats[1].played).toBe(0)
  })
})

describe('recordGameStart / recordWin / recordAbandon', () => {
  let storage
  beforeEach(() => {
    storage = makeFakeStorage()
  })

  it('increments played count and persists it', () => {
    let stats = loadStats(storage)
    stats = recordGameStart(stats, 1, storage)
    expect(stats[1].played).toBe(1)
    expect(loadStats(storage)[1].played).toBe(1)
  })

  it('tracks wins, streaks, and best time independently per draw mode', () => {
    let stats = loadStats(storage)
    stats = recordGameStart(stats, 1, storage)
    stats = recordWin(stats, 1, 90000, storage)
    expect(stats[1]).toEqual({ played: 1, won: 1, streak: 1, bestStreak: 1, bestTimeMs: 90000 })
    expect(stats[3]).toEqual({ played: 0, won: 0, streak: 0, bestStreak: 0, bestTimeMs: null })

    stats = recordGameStart(stats, 1, storage)
    stats = recordWin(stats, 1, 60000, storage)
    expect(stats[1].bestTimeMs).toBe(60000)
    expect(stats[1].streak).toBe(2)
    expect(stats[1].bestStreak).toBe(2)
  })

  it('resets the current streak (but not bestStreak) on an abandoned game', () => {
    let stats = loadStats(storage)
    stats = recordGameStart(stats, 1, storage)
    stats = recordWin(stats, 1, 90000, storage)
    stats = recordGameStart(stats, 1, storage)
    stats = recordAbandon(stats, 1, storage)
    expect(stats[1].streak).toBe(0)
    expect(stats[1].bestStreak).toBe(1)
  })
})
