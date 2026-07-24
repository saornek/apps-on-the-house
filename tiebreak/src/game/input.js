const DEADZONE = 8
const KEYMAPS = [
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' },
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
]

export function createInputState() {
  return { keys: new Set(), touches: new Map() }
}

export function setKey(input, code, down) {
  if (down) input.keys.add(code)
  else input.keys.delete(code)
}

export function beginTouch(input, id, x, y, worldH) {
  const playerIndex = y >= worldH / 2 ? 0 : 1
  if ([...input.touches.values()].some((touch) => touch.playerIndex === playerIndex)) return
  input.touches.set(id, { playerIndex, startX: x, startY: y, x, y })
}

export function moveTouch(input, id, x, y) {
  const touch = input.touches.get(id)
  if (!touch) return
  touch.x = x
  touch.y = y
}

export function endTouch(input, id) {
  input.touches.delete(id)
}

export function clearInput(input) {
  input.keys.clear()
  input.touches.clear()
}

const axis = (negative, positive) => Number(positive) - Number(negative)
const clampAxis = (value) => Math.max(-1, Math.min(1, value))

export function movementForPlayer(input, playerIndex) {
  const map = KEYMAPS[playerIndex]
  let x = axis(input.keys.has(map.left), input.keys.has(map.right))
  let y = axis(input.keys.has(map.up), input.keys.has(map.down))
  const touch = [...input.touches.values()].find((entry) => entry.playerIndex === playerIndex)
  if (touch) {
    const rotation = playerIndex === 1 ? -1 : 1
    const dx = (touch.x - touch.startX) * rotation
    const dy = (touch.y - touch.startY) * rotation
    x = Math.abs(dx) < DEADZONE ? 0 : clampAxis(dx / 48)
    y = Math.abs(dy) < DEADZONE ? 0 : clampAxis(dy / 48)
  }
  const magnitude = Math.hypot(x, y)
  return magnitude > 1 ? { x: x / magnitude, y: y / magnitude } : { x, y }
}
