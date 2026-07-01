/*
 * Capybara Jump - pure game logic.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

export const GRAVITY = 0.55
export const JUMP_VY = -10

export const CAPY_W = 96
export const CAPY_H = 88
export const CAPY_X = 48
export const CAPY_HIT_X = 14
export const CAPY_HIT_Y = 20
export const CAPY_HIT_W = 66
export const CAPY_HIT_H = 48

export const OBS_WIDTH = 76
export const GRASS_H = 64

export const INITIAL_SPEED = 3
export const MAX_SPEED = 7
export const SPEED_INCREMENT = 0.4
export const SPEED_INTERVAL = 10
export const INITIAL_GAP = 220
export const MIN_GAP = 150
export const GAP_SHRINK = 6
export const OBS_SPAWN_DIST = 340
export const DEATH_OVERLAY_FRAMES = 150
export const DEATH_OVERLAY_MS = 2200
export const TOP_OBSTACLE_TYPES = ['none', 'snake']
export const BOTTOM_OBSTACLE_TYPES = ['none', 'fence']

const HS_KEY = 'capybara-jump:highscore'

export function computeSpeed(score) {
  const steps = Math.floor(score / SPEED_INTERVAL)
  return Math.min(INITIAL_SPEED + steps * SPEED_INCREMENT, MAX_SPEED)
}

export function computeGap(score) {
  const steps = Math.floor(score / SPEED_INTERVAL)
  return Math.max(INITIAL_GAP - steps * GAP_SHRINK, MIN_GAP)
}

export function applyGravity(vy) {
  return vy + GRAVITY
}

export function applyJump() {
  return JUMP_VY
}

export function nextY(y, vy) {
  return y + vy
}

export function selectObstacleVisual(score = 0, rng = Math.random) {
  const roll = rng()
  const combinedThreshold = score < SPEED_INTERVAL ? 0.9 : 0.6

  if (roll < 0.45) return { topType: 'none', bottomType: 'fence' }
  if (roll < combinedThreshold) return { topType: 'snake', bottomType: 'none' }
  return { topType: 'snake', bottomType: 'fence' }
}

export function spawnObstacle(id, gameW, gameH, score, rng = Math.random) {
  const gapSize = computeGap(score)
  const minGapTop = 60
  const maxGapTop = gameH - GRASS_H - gapSize - 60
  const gapTop = minGapTop + rng() * Math.max(0, maxGapTop - minGapTop)
  const visual = selectObstacleVisual(score, rng)

  return { id, x: gameW, gapTop, gapSize, scored: false, ...visual }
}

export function tickObstacles(obstacles, speed) {
  return obstacles
    .map((obstacle) => ({ ...obstacle, x: obstacle.x - speed }))
    .filter((obstacle) => obstacle.x > -OBS_WIDTH - 10)
}

export function checkCollision(capyY, obstacles, gameH) {
  const capyLeft = CAPY_X + CAPY_HIT_X
  const capyRight = capyLeft + CAPY_HIT_W
  const capyTop = capyY + CAPY_HIT_Y
  const capyBottom = capyTop + CAPY_HIT_H

  if (capyTop < 0) return true
  if (capyBottom > gameH - GRASS_H) return true

  for (const obstacle of obstacles) {
    const overlapX = capyRight > obstacle.x && capyLeft < obstacle.x + OBS_WIDTH
    if (!overlapX) continue

    const hasTop = obstacle.topType !== 'none'
    const hasBottom = obstacle.bottomType !== 'none'
    const hitsTop = hasTop && capyTop < obstacle.gapTop
    const hitsBottom = hasBottom && capyBottom > obstacle.gapTop + obstacle.gapSize

    if (hitsTop || hitsBottom) return true
  }

  return false
}

export function shouldShowDeathOverlay(deadFrames, deathElapsedMs = 0) {
  return deathElapsedMs >= DEATH_OVERLAY_MS
}

export function loadHighScore() {
  if (typeof localStorage === 'undefined') return 0

  const raw = Number(localStorage.getItem(HS_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function saveHighScore(score) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(HS_KEY, String(score))
}
