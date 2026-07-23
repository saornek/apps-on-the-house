# Tiebreak Racket Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each monster's attached racket follow and remember screen-left or screen-right movement, with the actual serve/return aim taking priority at contact.

**Architecture:** Store a normalized `racketDirection` (`-1` or `1`) on each simulated player and update it through the existing movement, serve-aim, and return paths. Keep the primitive monster art as the single source of truth by reflecting only the racket head, handle, and connecting arm inside `spritePlan`, then convert screen direction to local sprite direction in the canvas renderer.

**Tech Stack:** React 19, JavaScript, Canvas 2D, SVG pixel primitives, Vitest, Vite

## Global Constraints

- Left input places the racket on the screen-left side; right input places it on the screen-right side.
- Centered, vertical-only, or horizontal input with absolute value at most `0.05` preserves the last side.
- Serve and return aim with horizontal magnitude greater than `0.05` becomes authoritative for the swing.
- Keyboard, touch, and laptop movement share the same state path.
- The racket head, handle, and arm reflect together and remain geometrically attached.
- Monster bodies continue to face the court; menu/setup monster illustrations keep their existing default pose side.
- Do not add dependencies, raster assets, network requests, stat modifiers, or unrelated refactors.
- Follow strict RED → GREEN → REFACTOR: no production edit before the covering test has failed for the expected missing behavior.

---

### Task 1: Persistent Directional Rackets

**Files:**
- Modify: `tiebreak/src/game/simulation.js`
- Modify: `tiebreak/src/game/simulation.test.js`
- Modify: `tiebreak/src/game/roster.js`
- Modify: `tiebreak/src/game/roster.test.js`
- Modify: `tiebreak/src/render.js`
- Create: `tiebreak/src/render.test.js`

**Interfaces:**
- Consumes: `setMovement(state, playerIndex, vector)`, `setServeAim(state, vector)`, `spritePlan(monsterId, pose)`, and the existing player-index canvas mirror.
- Produces: `player.racketDirection: -1 | 1`, `spritePlan(monsterId, pose, racketSide?)`, and `localRacketSide(screenDirection, playerIndex): -1 | 1`.

- [ ] **Step 1: Add failing simulation-state tests**

In `tiebreak/src/game/simulation.test.js`, add tests that express remembered
direction and shot priority:

```js
it('remembers horizontal racket direction and ignores centered or vertical input', () => {
  const state = makeState()

  expect(state.players.map((player) => player.racketDirection)).toEqual([1, 1])

  setMovement(state, 0, { x: -1, y: 0 })
  expect(state.players[0].racketDirection).toBe(-1)

  setMovement(state, 0, { x: 0, y: -1 })
  setMovement(state, 0, { x: 0.05, y: 0 })
  expect(state.players[0].racketDirection).toBe(-1)

  setMovement(state, 0, { x: 1, y: 0 })
  expect(state.players[0].racketDirection).toBe(1)
})

it('uses serve aim as the server racket direction without changing the receiver', () => {
  const state = makeState(1)

  setServeAim(state, { x: -1, y: 0 })

  expect(state.players[1].racketDirection).toBe(-1)
  expect(state.players[0].racketDirection).toBe(1)
})

it('uses horizontal return aim as the racket direction at contact', () => {
  const state = makeState()
  const receiver = state.players[0]
  receiver.input = { x: -1, y: -1 }
  receiver.racketDirection = 1
  launch(state, {
    x: receiver.x,
    y: receiver.y - 20,
    z: 30,
    vx: 0,
    vy: 180,
    vz: 0,
    lastHitter: 1,
  })

  advanceUntil(state, (next) => next.ball.lastHitter === 0, 500)

  expect(state.players[0].racketDirection).toBe(-1)
})

it('uses the laptop shot target instead of its interception direction at contact', () => {
  const aiPlayers = [
    players[0],
    { ...players[1], kind: 'ai', difficulty: 'hard' },
  ]
  const state = makeState(0, aiPlayers)
  const receiver = state.players[1]
  state.ai[1].movement = { x: 1, y: 0 }
  state.ai[1].shotAim = { x: -1, y: 1 }
  state.ai[1].cooldownMs = 1000
  receiver.racketDirection = 1
  launch(state, {
    x: receiver.x,
    y: receiver.y + 20,
    z: 30,
    vx: 0,
    vy: -180,
    vz: 0,
    lastHitter: 0,
  })

  advanceUntil(state, (next) => next.ball.lastHitter === 1, 500)

  expect(state.players[1].racketDirection).toBe(-1)
})
```

- [ ] **Step 2: Run the focused simulation tests and verify RED**

Run:

```bash
cd tiebreak
npm test -- src/game/simulation.test.js
```

Expected: FAIL because new simulated players have no `racketDirection` and the
movement/aim paths do not update it.

- [ ] **Step 3: Implement the minimal simulation state**

In `tiebreak/src/game/simulation.js`, add one private dead-zone helper:

```js
const RACKET_DIRECTION_DEAD_ZONE = 0.05

function rememberRacketDirection(player, horizontalAim) {
  if (Math.abs(horizontalAim) > RACKET_DIRECTION_DEAD_ZONE) {
    player.racketDirection = horizontalAim < 0 ? -1 : 1
  }
}
```

Add `racketDirection: 1` to both player objects created by
`createSimulation`. In `setMovement`, normalize the vector once, assign it to
`player.input`, and pass its `x` value to `rememberRacketDirection`. In
`setServeAim`, normalize once, assign it to `state.serveAim`, and update only
`state.players[state.match.currentServer]`.

In `returnBall`, after selecting `aim` and before assigning ball velocity, call:

```js
rememberRacketDirection(player, aim.x)
```

Use the unmodified aim rather than randomized placement error so neutral input
preserves the last side.

- [ ] **Step 4: Run the focused simulation tests and verify GREEN**

Run:

```bash
cd tiebreak
npm test -- src/game/simulation.test.js
```

Expected: all simulation tests PASS with no warnings.

- [ ] **Step 5: Add failing two-sided sprite geometry tests**

Replace the single default-side geometry loop in
`tiebreak/src/game/roster.test.js` with a loop over both `racketSide` values:

```js
for (const racketSide of [-1, 1]) {
  const parts = spritePlan(monster.id, pose, racketSide)
  const head = parts.find((part) => part.part === 'racket-head')
  const handle = parts.find((part) => part.part === 'racket-handle')
  const arm = parts.find((part) => part.part === 'racket-arm')
  const silhouette = parts.filter((part) => (
    !part.part.startsWith('racket-') && !part.part.startsWith('eye') &&
    part.part !== 'pupil' && !part.part.startsWith('fang')
  ))

  expect(Math.sign(head.x + head.w / 2), `${monster.id}/${pose}/${racketSide} side`)
    .toBe(racketSide)
  expect(touches(head, handle), `${monster.id}/${pose}/${racketSide} head-to-handle`)
    .toBe(true)
  expect(touches(handle, arm), `${monster.id}/${pose}/${racketSide} handle-to-arm`)
    .toBe(true)
  expect(
    silhouette.some((part) => touches(part, arm)),
    `${monster.id}/${pose}/${racketSide} arm-to-silhouette`,
  ).toBe(true)
}
```

Retain the existing defined-part assertions inside this loop.

- [ ] **Step 6: Add a failing screen-direction renderer test**

Create `tiebreak/src/render.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { spritePlan } from './game/roster.js'
import { localRacketSide } from './render.js'

describe('directional racket rendering', () => {
  it.each([
    { playerIndex: 0, playerMirror: 1 },
    { playerIndex: 1, playerMirror: -1 },
  ])('keeps requested screen side for player $playerIndex', ({
    playerIndex,
    playerMirror,
  }) => {
    for (const screenDirection of [-1, 1]) {
      const localSide = localRacketSide(screenDirection, playerIndex)
      const head = spritePlan('crumblehorn', 'idle', localSide)
        .find((part) => part.part === 'racket-head')
      const renderedCenterX = (head.x + head.w / 2) * playerMirror

      expect(Math.sign(renderedCenterX)).toBe(screenDirection)
    }
  })
})
```

- [ ] **Step 7: Run the sprite/render tests and verify RED**

Run:

```bash
cd tiebreak
npm test -- src/game/roster.test.js src/render.test.js
```

Expected: FAIL because `spritePlan` ignores the third argument and
`localRacketSide` is not exported.

- [ ] **Step 8: Implement reflected racket geometry**

In `tiebreak/src/game/roster.js`, change the public signature to:

```js
export function spritePlan(monsterId, pose, racketSideOverride) {
```

Keep `POSE` as the source of default artwork. Replace the current racket X
calculation with:

```js
const defaultRacketHeadX = offset.racketSide * 7 + offset.racketX
const defaultRacketSide = Math.sign(defaultRacketHeadX) || 1
const racketSide = racketSideOverride == null
  ? defaultRacketSide
  : Math.sign(racketSideOverride) || defaultRacketSide
const racketHeadX = racketSide * Math.abs(defaultRacketHeadX)
const racketHandleX = racketHeadX + racketSide
```

Use this normalized `racketSide` for `armStartX`. Do not reflect body, facial,
or body-pose primitives.

- [ ] **Step 9: Wire screen direction into the canvas renderer**

In `tiebreak/src/render.js`, export:

```js
export function localRacketSide(screenDirection, playerIndex) {
  const normalizedScreenDirection = screenDirection < 0 ? -1 : 1
  const playerMirror = playerIndex === 0 ? 1 : -1
  return normalizedScreenDirection * playerMirror
}
```

In `drawMonster`, keep the current full-sprite player mirror, calculate the local
racket side from `player.racketDirection ?? 1`, and pass it as the third
`spritePlan` argument:

```js
const racketSide = localRacketSide(player.racketDirection ?? 1, playerIndex)
for (const primitive of spritePlan(player.monsterId, pose, racketSide)) {
```

Do not change `MonsterFigure`; omitting the optional argument preserves menu and
setup illustration defaults.

- [ ] **Step 10: Run focused tests and verify GREEN**

Run:

```bash
cd tiebreak
npm test -- src/game/simulation.test.js src/game/roster.test.js src/render.test.js
```

Expected: all focused tests PASS with no warnings.

- [ ] **Step 11: Run the full game verification**

Run:

```bash
cd tiebreak
npm test
npm run build
git diff --check
```

Expected: all test files PASS, the Vite production build succeeds, and
`git diff --check` emits no output.

- [ ] **Step 12: Commit the feature**

```bash
git add \
  tiebreak/src/game/simulation.js \
  tiebreak/src/game/simulation.test.js \
  tiebreak/src/game/roster.js \
  tiebreak/src/game/roster.test.js \
  tiebreak/src/render.js \
  tiebreak/src/render.test.js
git commit -m "feat: aim Tiebreak rackets with movement"
```

- [ ] **Step 13: Browser playtest**

After the implementation review is clean, rebuild and open the production game.
Start a one-player match, tap `A`, capture the remembered screen-left racket
pose, tap `D`, and capture the remembered screen-right pose. Confirm at game
scale that the racket head, handle, and arm remain attached; the body continues
to face the court; and the HUD/court layout is unchanged.
