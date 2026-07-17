/*
 * Solitaire - local per-draw-mode stats, persisted to localStorage.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

const STORAGE_KEY = 'solitaire:stats:v1'

function emptyStats() {
  return { played: 0, won: 0, streak: 0, bestStreak: 0, bestTimeMs: null }
}

function defaultStorage() {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function loadStats(storage = defaultStorage()) {
  const fallback = { 1: emptyStats(), 3: emptyStats() }
  if (!storage) return fallback
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return { 1: { ...emptyStats(), ...parsed[1] }, 3: { ...emptyStats(), ...parsed[3] } }
  } catch {
    return fallback
  }
}

function persist(stats, storage) {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // localStorage unavailable (private browsing, quota) — stats just won't persist.
  }
}

export function recordGameStart(stats, drawMode, storage = defaultStorage()) {
  const updated = { ...stats, [drawMode]: { ...stats[drawMode], played: stats[drawMode].played + 1 } }
  persist(updated, storage)
  return updated
}

export function recordWin(stats, drawMode, timeMs, storage = defaultStorage()) {
  const s = stats[drawMode]
  const streak = s.streak + 1
  const updated = {
    ...stats,
    [drawMode]: {
      ...s,
      won: s.won + 1,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      bestTimeMs: s.bestTimeMs === null ? timeMs : Math.min(s.bestTimeMs, timeMs),
    },
  }
  persist(updated, storage)
  return updated
}

export function recordAbandon(stats, drawMode, storage = defaultStorage()) {
  const updated = { ...stats, [drawMode]: { ...stats[drawMode], streak: 0 } }
  persist(updated, storage)
  return updated
}
