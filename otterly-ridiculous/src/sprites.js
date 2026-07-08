/*
 * Otterly Ridiculous - pixel sprites and canvas renderer.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import {
  WORLD_W,
  WORLD_H,
  SHORE,
  GRASS_H,
  FLIGHT_MS,
  DESPAWN_MS,
  chainPositions,
  computeThrowInterval,
} from './game.js'

// --- Image sprites (panda + otter) ----------------------------------------
// Fish, rocks, and plastic stay as the pixel grids below; only the panda and
// otter use authored art. Until an image finishes loading, the matching grid
// sprite is drawn as a fallback so nothing pops in blank.
function loadImage(file) {
  const img = new Image()
  img.src = `${import.meta.env.BASE_URL}sprites/${file}`
  return img
}

const IMAGES = {
  pandaIdle: loadImage('panda-idle.png'),
  pandaThrow: loadImage('panda-throw.png'),
  otter: loadImage('otter.png'),
}

const PANDA_DRAW = 116 // on-canvas size of the panda image (square source)
const OTTER_DRAW_W = 100 // otter length along the swim direction (art faces right)
const OTTER_DRAW_H = 130 // otter body thickness (a bit fatter than long)
const PANDA_TOP = -8 // y of the panda image's top edge (sits on the grass)
const THROW_POSE_MS = 260 // how long the raised-arm frame shows after a launch

function imageReady(img) {
  return img.complete && img.naturalWidth > 0
}

const GRASS = {
  fill: '#7CA84E',
  shade: '#5C863A',
  blade: '#8FBB5E',
}

const COLORS = {
  water: '#7FA8C9',
  ripple: 'rgba(255, 255, 255, 0.35)',
}

const PAL = {
  b: '#6B4A2F', // otter dark brown
  B: '#8A6240', // otter light brown
  c: '#D9B99B', // otter muzzle cream
  k: '#1C1B19', // ink
  o: '#C2693E', // fish body (terracotta)
  t: '#5B7A99', // fish tail (dusty blue)
  g: '#8B857B', // rock dark
  G: '#A9A297', // rock light
  p: '#D24FB2', // plastic bright synthetic magenta
  d: '#9B3488', // plastic shade
  C: '#F2E9F4', // bottle cap (pale)
  w: '#FFFFFF', // panda white
  n: '#A9572F', // bucket dark
  N: '#C2693E', // bucket light
}

export const OTTER = [
  '.....bbbb.......',
  '....bBBBBb......',
  '....bBkBBBb.....',
  '....bBBBBccb....',
  '.....bBBBcck....',
  'bb...bBBBBbb....',
  'bBb.bBBBBBBb....',
  '.bBbBBBBBBBBb...',
  '..bBBBBBBBBBb...',
  '...bBBBBBBBb....',
  '....bbbbbbb.....',
]

export const FISH = [
  'tt...oooo.',
  '.tt.oooook',
  'ttoooooooo',
  '.tt.ooooo.',
  'tt...ooo..',
]

export const ROCK = [
  '..gggg..',
  '.gggGGg.',
  'gggGGGgg',
  'ggGGGggg',
  '.gggggg.',
  '..gggg..',
]

export const BOTTLE = [
  '..CC..',
  '..CC..',
  '.pppp.',
  '.pddp.',
  '.pppp.',
  '.pppp.',
  '.pdpp.',
  '.pppp.',
  '.pppp.',
  '.pddp.',
  '.pppp.',
  '.pppp.',
]

export const BAG = [
  '.pp....pp.',
  '.p.p..p.p.',
  '.p..pp..p.',
  '.pppppppp.',
  '.pdppppdp.',
  '.pppdpppp.',
  '.ppppppdp.',
  '.pdpppppp.',
  '.pppppppp.',
]

export const PANDA = [
  '..kk......kk....',
  '.kwwk....kwwk...',
  '.kwwwwwwwwwwk...',
  '.kwwkwwwwkwwk...',
  '.kwwkwwwwkwwk...',
  '.kwwwwkkwwwwk...',
  '..kwwwwwwwwk....',
  '..kkkwwwwkkk....',
  '.kkwwwwwwwwkk...',
  'kkkwwwwwwwwkkk..',
  'kk.wwwwwwww.kk..',
  '...kkkkkkkk.....',
  '...kk....kk.....',
]

export const BUCKET = [
  '.nNNNNn.',
  '.nNNNNn.',
  '.nNNNNn.',
  '..nNNn..',
  '..nnnn..',
]

export function drawSprite(ctx, grid, palette, x, y, scale = 3) {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    for (let c = 0; c < row.length; c++) {
      const color = palette[row[c]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), scale, scale)
    }
  }
}

function spriteSize(grid, scale = 3) {
  return { w: grid[0].length * scale, h: grid.length * scale }
}

function drawCentered(ctx, grid, x, y, scale = 3) {
  const { w, h } = spriteSize(grid, scale)
  drawSprite(ctx, grid, PAL, x - w / 2, y - h / 2, scale)
}

function itemGrid(item) {
  if (item.type === 'fish') return FISH
  if (item.type === 'rock') return ROCK
  return item.variant === 'bag' ? BAG : BOTTLE
}

function worldW(state) {
  return state.worldW ?? WORLD_W
}

function worldH(state) {
  return state.worldH ?? WORLD_H
}

function pandaX(state) {
  return worldW(state) / 2
}

function drawWater(ctx, state, timeMs) {
  const w = worldW(state)
  const h = worldH(state)
  ctx.fillStyle = COLORS.water
  ctx.fillRect(0, 0, w, h)

  // Drifting ripple arcs
  ctx.strokeStyle = COLORS.ripple
  ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    const px = SHORE + 60 + ((i * 97 + timeMs * 0.01) % (w - SHORE * 2 - 120))
    const py = SHORE + 80 + ((i * 173) % (h - SHORE * 2 - 160))
    const r = 8 + 4 * Math.sin(timeMs / 700 + i)
    ctx.beginPath()
    ctx.arc(px, py, Math.max(2, r), Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()
  }
}

function drawGrass(ctx, state) {
  const w = worldW(state)
  // Full-width grass bank across the top; the panda sits on it and items land
  // below it (enforced in game.js spawnItem).
  ctx.fillStyle = GRASS.fill
  ctx.fillRect(0, 0, w, GRASS_H)

  // Darker soil line at the water's edge
  ctx.fillStyle = GRASS.shade
  ctx.fillRect(0, GRASS_H - 5, w, 5)

  // Blades poking down into the water along the bank edge
  ctx.strokeStyle = GRASS.blade
  ctx.lineWidth = 2
  for (let x = 6; x < w; x += 15) {
    const h = 4 + ((x * 7) % 5)
    ctx.beginPath()
    ctx.moveTo(x, GRASS_H)
    ctx.lineTo(x, GRASS_H + h)
    ctx.stroke()
  }
}

function drawPanda(ctx, state) {
  // Show the raised-arm frame for a moment right after each throw. On a fresh
  // throw, throwCooldownMs resets to the full interval and counts down, so
  // "just threw" is when little time has elapsed since that reset.
  const interval = computeThrowInterval(state.score)
  const throwing =
    state.phase === 'playing' && interval - state.throwCooldownMs < THROW_POSE_MS
  const img = throwing ? IMAGES.pandaThrow : IMAGES.pandaIdle

  if (imageReady(img)) {
    ctx.drawImage(img, Math.round(pandaX(state) - PANDA_DRAW / 2), PANDA_TOP, PANDA_DRAW, PANDA_DRAW)
    return
  }

  // Fallback: grid panda + bucket until the image loads.
  const scale = 3
  const { w } = spriteSize(PANDA, scale)
  drawSprite(ctx, PANDA, PAL, pandaX(state) - w / 2, 2, scale)
  drawSprite(ctx, BUCKET, PAL, pandaX(state) + w / 2 - 6, 22, scale)
}

function drawItems(ctx, state, timeMs) {
  for (const item of state.items) {
    const grid = itemGrid(item)
    if (item.airMs > 0) {
      // Arc from the panda's bucket to the splash-down point
      const t = 1 - item.airMs / FLIGHT_MS
      const x = item.fromX + (item.x - item.fromX) * t
      const y = item.fromY + (item.y - item.fromY) * t - Math.sin(t * Math.PI) * 90
      // Landing shadow
      ctx.fillStyle = 'rgba(28, 27, 25, 0.18)'
      ctx.beginPath()
      ctx.ellipse(item.x, item.y, 10 * t + 2, 5 * t + 1, 0, 0, Math.PI * 2)
      ctx.fill()
      drawCentered(ctx, grid, x, y, 2)
    } else {
      // Blink during the last second before sinking
      const left = DESPAWN_MS - item.floatMs
      if (left < 1000 && Math.floor(timeMs / 120) % 2 === 0) continue
      const bob = Math.sin(timeMs / 350 + item.id) * 2
      drawCentered(ctx, grid, item.x, item.y + bob, 3)
    }
  }
}

function drawChain(ctx, state, timeMs) {
  const positions = chainPositions(state)
  for (let i = positions.length - 1; i >= 0; i--) {
    const grid = state.chain[i].type === 'fish' ? FISH : ROCK
    const bob = Math.sin(timeMs / 300 + i) * 2
    drawCentered(ctx, grid, positions[i].x, positions[i].y + bob, 2)
  }
}

function drawOtter(ctx, state, timeMs) {
  if (state.invincibleMs > 0 && Math.floor(timeMs / 120) % 2 === 0) return
  const bob = state.phase === 'idle' ? Math.sin(timeMs / 500) * 4 : 0
  ctx.save()
  ctx.translate(state.x, state.y + bob)
  ctx.rotate(state.heading)
  // The otter art faces right (heading 0). When heading points left, mirror
  // vertically so the otter stays upright instead of rotating belly-up.
  if (Math.abs(((state.heading + Math.PI) % (2 * Math.PI)) - Math.PI) > Math.PI / 2) {
    ctx.scale(1, -1)
  }
  if (imageReady(IMAGES.otter)) {
    ctx.drawImage(IMAGES.otter, -OTTER_DRAW_W / 2, -OTTER_DRAW_H / 2, OTTER_DRAW_W, OTTER_DRAW_H)
  } else {
    const { w, h } = spriteSize(OTTER, 3)
    drawSprite(ctx, OTTER, PAL, -w / 2, -h / 2, 3)
  }
  ctx.restore()
}

export function drawFrame(ctx, state, timeMs) {
  drawWater(ctx, state, timeMs)
  drawGrass(ctx, state)
  drawPanda(ctx, state)
  drawItems(ctx, state, timeMs)
  drawChain(ctx, state, timeMs)
  drawOtter(ctx, state, timeMs)
}
