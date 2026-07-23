export const MONSTERS = [
  { id: 'crumblehorn', name: 'Crumblehorn', body: '#FFD054', shade: '#C2693E', shape: 'horned' },
  { id: 'mossbyte', name: 'Mossbyte', body: '#77D6BF', shade: '#397A70', shape: 'square' },
  { id: 'blinkblob', name: 'Blinkblob', body: '#EF8FA8', shade: '#A94F6A', shape: 'cyclops' },
  { id: 'pebblefang', name: 'Pebblefang', body: '#8297D8', shade: '#4A568D', shape: 'round' },
]

export const REQUIRED_POSES = [
  'idle',
  'run-a',
  'run-b',
  'serve',
  'forehand',
  'backhand',
  'win',
  'lose',
]

const POSE = {
  idle: { bodyX: 0, bodyY: 0, racketX: 0, racketY: 0, racketSide: 1 },
  'run-a': { bodyX: -1, bodyY: 0, racketX: 0, racketY: 1, racketSide: 1 },
  'run-b': { bodyX: 1, bodyY: -1, racketX: 1, racketY: 0, racketSide: 1 },
  serve: { bodyX: 0, bodyY: -1, racketX: 1, racketY: -8, racketSide: 1 },
  forehand: { bodyX: 1, bodyY: 0, racketX: 7, racketY: -3, racketSide: 1 },
  backhand: { bodyX: -1, bodyY: 0, racketX: -7, racketY: -3, racketSide: -1 },
  win: { bodyX: 0, bodyY: -3, racketX: 1, racketY: -10, racketSide: 1 },
  lose: { bodyX: 0, bodyY: 2, racketX: 4, racketY: 2, racketSide: 1 },
}

const INK = '#173A42'
const EYE = '#FFF3CF'

const rect = (part, x, y, w, h, color) => ({ part, kind: 'rect', x, y, w, h, color })

function silhouette(monster, offset) {
  const { bodyX: x, bodyY: y } = offset

  if (monster.shape === 'horned') {
    return [
      rect('body', x - 5, y - 9, 10, 13, monster.body),
      rect('body-shade', x - 5, y + 1, 10, 3, monster.shade),
      rect('horn-left', x - 5, y - 12, 2, 3, monster.shade),
      rect('horn-left-tip', x - 4, y - 14, 1, 2, monster.shade),
      rect('horn-right', x + 3, y - 12, 2, 3, monster.shade),
      rect('horn-right-tip', x + 3, y - 14, 1, 2, monster.shade),
      rect('eye-left', x - 3, y - 6, 2, 2, INK),
      rect('eye-right', x + 1, y - 6, 2, 2, INK),
    ]
  }

  if (monster.shape === 'square') {
    return [
      rect('body', x - 6, y - 10, 12, 14, monster.body),
      rect('body-shade', x - 6, y + 1, 12, 3, monster.shade),
      rect('eye-left', x - 4, y - 6, 3, 2, INK),
      rect('eye-right', x + 1, y - 6, 3, 2, INK),
    ]
  }

  if (monster.shape === 'cyclops') {
    return [
      rect('body', x - 5, y - 9, 10, 13, monster.body),
      rect('round-top', x - 3, y - 11, 6, 2, monster.body),
      rect('body-shade', x - 4, y + 2, 8, 3, monster.shade),
      rect('eye', x - 2, y - 7, 4, 4, EYE),
      rect('pupil', x - 1, y - 6, 2, 2, INK),
    ]
  }

  return [
    rect('body', x - 5, y - 9, 10, 13, monster.body),
    rect('round-top', x - 3, y - 11, 6, 2, monster.body),
    rect('round-left', x - 6, y - 7, 1, 8, monster.body),
    rect('round-right', x + 5, y - 7, 1, 8, monster.body),
    rect('body-shade', x - 4, y + 2, 8, 3, monster.shade),
    rect('eye-left', x - 3, y - 6, 2, 2, INK),
    rect('eye-right', x + 1, y - 6, 2, 2, INK),
    rect('fang-left', x - 3, y - 2, 1, 3, EYE),
    rect('fang-right', x + 2, y - 2, 1, 3, EYE),
  ]
}

export function spritePlan(monsterId, pose) {
  const monster = MONSTERS.find((entry) => entry.id === monsterId)
  if (!monster) throw new Error(`Unknown monster id: ${monsterId}`)

  const offset = POSE[pose]
  if (!offset) throw new Error(`Unknown monster pose: ${pose}`)

  const racketHeadX = offset.racketSide * 7 + offset.racketX
  const racketHandleX = racketHeadX + offset.racketSide

  return [
    ...silhouette(monster, offset),
    {
      part: 'racket-head',
      kind: 'outline',
      x: racketHeadX,
      y: -8 + offset.racketY,
      w: 6,
      h: 8,
      color: INK,
    },
    rect('racket-handle', racketHandleX, offset.racketY, 2, 7, INK),
  ]
}
