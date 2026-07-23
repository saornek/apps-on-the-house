import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  appReducer,
  initialAppState,
  loadLastMonster,
  saveLastMonster,
} from './appState.js'

const APP_SOURCE = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

describe('single-player flow', () => {
  it('collects mode, difficulty, and one human setup', () => {
    let state = initialAppState()
    state = appReducer(state, { type: 'choose-mode', mode: 'single' })
    expect(state.phase).toBe('difficulty')
    state = appReducer(state, { type: 'choose-difficulty', difficulty: 'normal' })
    expect(state.phase).toBe('setup')
    state = appReducer(state, {
      type: 'confirm-player',
      monsterId: 'crumblehorn',
      build: state.draftBuild,
    })
    expect(state.phase).toBe('intro')
    expect(state.players).toHaveLength(2)
    expect(state.players[1].kind).toBe('ai')
  })
})

describe('two-player flow', () => {
  it('collects two equal-budget players in sequence', () => {
    let state = appReducer(initialAppState(), { type: 'choose-mode', mode: 'local' })
    state = appReducer(state, {
      type: 'confirm-player',
      monsterId: 'mossbyte',
      build: state.draftBuild,
    })
    expect(state.phase).toBe('setup')
    expect(state.setupIndex).toBe(1)
    state = appReducer(state, {
      type: 'confirm-player',
      monsterId: 'blinkblob',
      build: state.draftBuild,
    })
    expect(state.phase).toBe('intro')
    expect(state.players.map((player) => player.monsterId)).toEqual(['mossbyte', 'blinkblob'])
  })
})

describe('intro opening server', () => {
  it('passes the setup server to the intro and names that player as first server', () => {
    let state = appReducer(initialAppState(), { type: 'choose-mode', mode: 'local' })
    state = { ...state, openingServer: 1 }
    state = appReducer(state, {
      type: 'confirm-player',
      monsterId: 'mossbyte',
      build: state.draftBuild,
    })
    state = appReducer(state, {
      type: 'confirm-player',
      monsterId: 'blinkblob',
      build: state.draftBuild,
    })

    expect(state.phase).toBe('intro')
    expect(state.players[state.openingServer].name).toBe('Player 2')
    expect(APP_SOURCE).toContain(
      'function IntroScreen({ players, openingServer, onStart })',
    )
    expect(APP_SOURCE).toContain('{players[openingServer].name} serves first.')
    expect(APP_SOURCE).toContain(
      '<IntroScreen players={state.players} openingServer={state.openingServer} onStart={startMatch} />',
    )
  })
})

describe('stat editing', () => {
  it('will not confirm an invalid allocation', () => {
    let state = appReducer(initialAppState(), { type: 'choose-mode', mode: 'local' })
    state = appReducer(state, { type: 'change-stat', stat: 'serve', delta: 1 })
    expect(() =>
      appReducer(state, {
        type: 'confirm-player',
        monsterId: 'crumblehorn',
        build: state.draftBuild,
      }),
    ).toThrow(/twenty-point/i)
  })
})

describe('last monster preference', () => {
  it('persists a valid cosmetic choice and survives blocked storage', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }
    saveLastMonster('mossbyte', storage)
    expect(loadLastMonster(storage)).toBe('mossbyte')
    expect(loadLastMonster({
      getItem: () => {
        throw new Error('blocked')
      },
    })).toBe('crumblehorn')
  })

  it('survives a blocked global localStorage getter', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage access blocked')
      },
    })

    try {
      expect(() => loadLastMonster()).not.toThrow()
      expect(loadLastMonster()).toBe('crumblehorn')
      expect(() => saveLastMonster('mossbyte')).not.toThrow()
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor)
      } else {
        delete globalThis.localStorage
      }
    }
  })
})
