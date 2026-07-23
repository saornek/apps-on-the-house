import { describe, expect, it } from 'vitest'
import { balancedBuild, createMatch } from './match.js'
import {
  advanceSimulation,
  createSimulation,
  serviceBoxFor,
  setMovement,
  setServeAim,
  startServe,
  strokeFor,
  movementSpeed,
  placementError,
  serveSpeed,
  shotSpeed,
  swingRecovery,
} from './simulation.js'
import {
  BOUNCE_FACTOR,
  COURT_BOTTOM,
  COURT_LEFT,
  COURT_RIGHT,
  COURT_TOP,
  FIXED_STEP_MS,
  GRAVITY,
  NET_HEIGHT,
  NET_Y,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
} from './config.js'

const players = [
  { kind: 'human', name: 'You', monsterId: 'crumblehorn', build: balancedBuild() },
  { kind: 'human', name: 'COM', monsterId: 'blinkblob', build: balancedBuild() },
]

const clonePlayers = (nextPlayers) => nextPlayers.map((player) => ({
  ...player,
  build: { ...player.build },
}))

const makeState = (openingServer = 0, nextPlayers = players) =>
  createSimulation(createMatch({ players: clonePlayers(nextPlayers), openingServer }))

function advanceFixed(state, durationMs, rng = () => 0.5) {
  const steps = Math.ceil(durationMs / FIXED_STEP_MS)
  for (let step = 0; step < steps; step += 1) {
    advanceSimulation(state, FIXED_STEP_MS, rng)
  }
  return state
}

function advanceUntil(state, predicate, limitMs = 5000, rng = () => 0.5) {
  const steps = Math.ceil(limitMs / FIXED_STEP_MS)
  for (let step = 0; step < steps; step += 1) {
    advanceSimulation(state, FIXED_STEP_MS, rng)
    if (predicate(state)) return state
  }
  throw new Error(`Simulation did not reach the expected state within ${limitMs}ms`)
}

function seededRng(seed) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
}

function launch(state, ball) {
  state.phase = 'rally'
  state.match.phase = 'rally'
  state.ball = {
    live: true,
    x: 240,
    y: 400,
    z: 40,
    vx: 0,
    vy: -120,
    vz: 100,
    lastHitter: 0,
    bounceHalf: null,
    bouncesInHalf: 0,
    groundContacts: 0,
    firstBounceHalf: null,
    ...ball,
  }
}

describe('players', () => {
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

  it('stays inside the playable half and side boundaries during realistic fixed-step play', () => {
    const state = makeState()
    state.phase = 'rally'
    state.match.phase = 'rally'
    state.ball.live = false
    setMovement(state, 0, { x: -1, y: -1 })

    advanceFixed(state, 5000)

    expect(state.players[0].x).toBe(PLAYER_MIN_X)
    expect(state.players[0].x).toBeLessThanOrEqual(PLAYER_MAX_X)
    expect(state.players[0].y).toBeGreaterThan(NET_Y)
  })

  it('selects opposite stroke sides for top and bottom players', () => {
    expect(strokeFor(0, 240, 280)).toBe('forehand')
    expect(strokeFor(0, 240, 200)).toBe('backhand')
    expect(strokeFor(1, 240, 200)).toBe('forehand')
    expect(strokeFor(1, 240, 280)).toBe('backhand')
  })
})

describe('legal serving', () => {
  it('lands every rating and aim extreme inside the selected service box for both servers', () => {
    for (const serverIndex of [0, 1]) {
      for (const totalPoints of [0, 1]) {
        for (const serveRating of [1, 9]) {
          for (const aimX of [-1, 1]) {
            for (const aimY of [-1, 1]) {
              const state = makeState(serverIndex)
              state.match.totalPoints = totalPoints
              state.match.currentServer = serverIndex
              state.players[serverIndex].build.serve = serveRating
              setServeAim(state, { x: aimX, y: aimY })
              const box = serviceBoxFor(state.match)

              startServe(state, () => aimX < 0 ? 0 : 1)
              advanceUntil(state, (next) => next.ball.groundContacts === 1)

              expect(state.ball.x).toBeGreaterThanOrEqual(box.left)
              expect(state.ball.x).toBeLessThanOrEqual(box.right)
              expect(state.ball.y).toBeGreaterThanOrEqual(box.top)
              expect(state.ball.y).toBeLessThanOrEqual(box.bottom)
              expect(state.match.lastPoint).toBeNull()
            }
          }
        }
      }
    }
  })

  it('uses horizontal and vertical aim while Serve rating changes legal pace and placement', () => {
    const samples = []
    for (const serveRating of [1, 9]) {
      for (const aim of [{ x: -1, y: 1 }, { x: 1, y: -1 }]) {
        const state = makeState()
        state.players[0].build.serve = serveRating
        setServeAim(state, aim)
        startServe(state, () => 1)
        const launchSpeed = Math.hypot(state.ball.vx, state.ball.vy)
        advanceUntil(state, (next) => next.ball.groundContacts === 1)
        samples.push({ serveRating, aim, launchSpeed, x: state.ball.x, y: state.ball.y })
      }
    }

    expect(samples[0].x).not.toBeCloseTo(samples[1].x, 2)
    expect(samples[0].y).not.toBeCloseTo(samples[1].y, 2)
    expect(samples[2].launchSpeed).toBeGreaterThan(samples[0].launchSpeed)
    expect(samples.every(({ x, y }) => (
      x >= COURT_LEFT && x <= COURT_RIGHT && y >= COURT_TOP && y <= COURT_BOTTOM
    ))).toBe(true)
  })
})

describe('terminal ball trajectories', () => {
  it.each([
    {
      name: 'player 0 bottom half',
      ball: { x: 120, y: 410, z: 5, vx: 0, vy: -100, vz: -300, lastHitter: 0 },
      winner: 1,
      illegalHalf: 0,
    },
    {
      name: 'player 1 top half',
      ball: { x: 360, y: 310, z: 5, vx: 0, vy: 100, vz: -300, lastHitter: 1 },
      winner: 0,
      illegalHalf: 1,
    },
  ])('calls $name first contact out before recording a legal bounce', ({
    ball,
    illegalHalf,
    winner,
  }) => {
    const state = makeState()
    const impactTime = (
      ball.vz + Math.sqrt(ball.vz ** 2 + 2 * GRAVITY * ball.z)
    ) / GRAVITY
    const contactY = ball.y + ball.vy * impactTime
    const reboundVz = Math.abs(ball.vz - GRAVITY * impactTime) * BOUNCE_FACTOR
    const timeFromBounceToNet = Math.abs(NET_Y - contactY) / Math.abs(ball.vy)
    const hypotheticalNetHeight =
      reboundVz * timeFromBounceToNet -
      GRAVITY * timeFromBounceToNet ** 2 / 2

    launch(state, ball)
    advanceUntil(state, (next) => next.phase === 'point-result')

    expect(hypotheticalNetHeight).toBeGreaterThan(NET_HEIGHT)
    expect(state.match.lastPoint).toEqual({ winner, reason: 'out' })
    expect(state.ball.firstBounceHalf).toBeNull()
    expect(state.ball.groundContacts).toBe(0)
    expect(state.ball.bouncesInHalf).toBe(0)
    expect(state.ball.bounceHalf).toBeNull()
    expect(illegalHalf).toBe(ball.lastHitter)
  })

  it.each([
    {
      name: 'top receiver half',
      ball: { x: 360, y: 400, vx: 55, vy: -120, lastHitter: 0 },
      winner: 0,
      receiverHalf: 1,
    },
    {
      name: 'bottom receiver half',
      ball: { x: 120, y: 320, vx: -55, vy: 120, lastHitter: 1 },
      winner: 1,
      receiverHalf: 0,
    },
  ])('awards $name second ground contact to the last hitter even when it lands out', ({
    ball,
    receiverHalf,
    winner,
  }) => {
    const state = makeState()
    launch(state, ball)

    advanceUntil(state, (next) => next.phase === 'point-result')

    expect(state.match.lastPoint).toEqual({ winner, reason: 'double-bounce' })
    expect(state.ball.firstBounceHalf).toBe(receiverHalf)
    expect(state.ball.x < COURT_LEFT || state.ball.x > COURT_RIGHT).toBe(true)
  })

  it('ends an ordinary legal trajectory on its second bounce', () => {
    const state = makeState()
    launch(state, { x: 240, y: 400, vx: 0, vy: -90, lastHitter: 0 })

    advanceUntil(state, (next) => next.phase === 'point-result')

    expect(state.match.lastPoint).toEqual({ winner: 0, reason: 'double-bounce' })
  })

  it('calls a first ground contact outside the court out', () => {
    const state = makeState()
    launch(state, { x: 420, y: 400, z: 20, vx: 100, vy: -100, vz: 0 })

    advanceUntil(state, (next) => next.phase === 'point-result')

    expect(state.match.lastPoint).toEqual({ winner: 1, reason: 'out' })
    expect(state.cue).toBe('out')
  })

  it('calls a low crossing at the net plane a net fault', () => {
    const state = makeState()
    launch(state, { y: 400, z: 20, vx: 0, vy: -200, vz: 0 })

    advanceUntil(state, (next) => next.phase === 'point-result')

    expect(state.match.lastPoint).toEqual({ winner: 1, reason: 'net' })
  })

  it('performs a real automatic return when an approaching ball reaches a player', () => {
    const state = makeState()
    const receiver = state.players[0]
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

    expect(state.ball.vy).toBeLessThan(0)
    expect(state.cue).toBe('hit')
  })
})

describe('signed rally depth', () => {
  it.each([
    { playerIndex: 0, direction: -1 },
    { playerIndex: 1, direction: 1 },
  ])('makes forward input deeper and backward input shorter for player $playerIndex', ({
    playerIndex,
    direction,
  }) => {
    const velocities = []
    for (const inputY of [direction, -direction]) {
      const state = makeState()
      const receiver = state.players[playerIndex]
      setMovement(state, playerIndex, { x: 0, y: inputY })
      launch(state, {
        x: receiver.x,
        y: receiver.y - direction * 20,
        z: 30,
        vx: 0,
        vy: -direction * 180,
        vz: 0,
        lastHitter: 1 - playerIndex,
      })
      advanceUntil(state, (next) => next.ball.lastHitter === playerIndex, 500)
      velocities.push(Math.abs(state.ball.vy))
    }

    expect(velocities[0]).toBeGreaterThan(velocities[1])
  })
})

describe('fixed-step outcomes', () => {
  it('matches complete simulation and AI outcomes across split render intervals', () => {
    const aiPlayers = [
      players[0],
      { ...players[1], kind: 'ai', difficulty: 'hard' },
    ]
    const oneFrame = makeState(0, aiPlayers)
    const manyFrames = makeState(0, aiPlayers)
    startServe(oneFrame, () => 0.5)
    startServe(manyFrames, () => 0.5)
    oneFrame.ai[1].cooldownMs = 50
    manyFrames.ai[1].cooldownMs = 50
    const oneRng = seededRng(17)
    const manyRng = seededRng(17)

    for (let frame = 0; frame < 60; frame += 1) {
      advanceSimulation(oneFrame, 48, oneRng)
    }
    for (let frame = 0; frame < 180; frame += 1) {
      advanceSimulation(manyFrames, 16, manyRng)
    }

    expect(oneFrame.ai[1].movement).not.toEqual({ x: 0, y: 0 })
    expect(oneFrame.ball.groundContacts).toBeGreaterThanOrEqual(1)
    expect(manyFrames).toEqual(oneFrame)
  })
})

describe('stat effects', () => {
  it('makes high ratings faster, more accurate, and quicker to recover', () => {
    expect(movementSpeed({ footwork: 9 })).toBeGreaterThan(movementSpeed({ footwork: 1 }))
    expect(swingRecovery({ footwork: 9 })).toBeLessThan(swingRecovery({ footwork: 1 }))
    expect(serveSpeed(9)).toBeGreaterThan(serveSpeed(1))
    expect(shotSpeed(9)).toBeGreaterThan(shotSpeed(1))
    expect(Math.abs(placementError(9, () => 1))).toBeLessThan(
      Math.abs(placementError(1, () => 1)),
    )
  })
})
