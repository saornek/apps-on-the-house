import { balancedBuild, validateBuild } from './game/match.js'
import { MONSTERS } from './game/roster.js'

const AI_BUILDS = [
  { forehand: 7, backhand: 5, serve: 4, footwork: 4 },
  { forehand: 4, backhand: 6, serve: 6, footwork: 4 },
  { forehand: 5, backhand: 4, serve: 4, footwork: 7 },
]
const LAST_MONSTER_KEY = 'tiebreak:last-monster'

export function loadLastMonster(storage) {
  try {
    const resolvedStorage = storage === undefined ? globalThis.localStorage : storage
    const id = resolvedStorage?.getItem(LAST_MONSTER_KEY)
    return MONSTERS.some((monster) => monster.id === id) ? id : MONSTERS[0].id
  } catch {
    return MONSTERS[0].id
  }
}

export function saveLastMonster(monsterId, storage) {
  if (!MONSTERS.some((monster) => monster.id === monsterId)) return
  try {
    const resolvedStorage = storage === undefined ? globalThis.localStorage : storage
    resolvedStorage?.setItem(LAST_MONSTER_KEY, monsterId)
  } catch {
    return
  }
}

export function initialAppState() {
  return {
    phase: 'home',
    mode: null,
    difficulty: null,
    setupIndex: 0,
    players: [],
    draftBuild: balancedBuild(),
    openingServer: Math.random() < 0.5 ? 0 : 1,
    finalMatch: null,
  }
}

function humanPlayer(index, monsterId, build) {
  return { kind: 'human', name: `Player ${index + 1}`, monsterId, build }
}

function laptopPlayer(difficulty) {
  const index = { easy: 0, normal: 1, hard: 2 }[difficulty]
  return {
    kind: 'ai',
    name: 'COM',
    difficulty,
    monsterId: ['blinkblob', 'mossbyte', 'pebblefang'][index],
    build: AI_BUILDS[index],
  }
}

export function appReducer(state, action) {
  switch (action.type) {
    case 'choose-mode':
      return {
        ...initialAppState(),
        mode: action.mode,
        phase: action.mode === 'single' ? 'difficulty' : 'setup',
      }
    case 'choose-difficulty':
      return { ...state, difficulty: action.difficulty, phase: 'setup' }
    case 'change-stat': {
      const next = {
        ...state.draftBuild,
        [action.stat]: state.draftBuild[action.stat] + action.delta,
      }
      const value = next[action.stat]
      if (value < 1 || value > 9) return state
      return { ...state, draftBuild: next }
    }
    case 'reset-build':
      return { ...state, draftBuild: balancedBuild() }
    case 'confirm-player': {
      if (!validateBuild(action.build).valid) {
        throw new Error('Confirm a valid twenty-point build.')
      }
      const nextPlayers = [
        ...state.players,
        humanPlayer(state.setupIndex, action.monsterId, { ...action.build }),
      ]
      if (state.mode === 'local' && nextPlayers.length === 1) {
        return {
          ...state,
          players: nextPlayers,
          setupIndex: 1,
          draftBuild: balancedBuild(),
        }
      }
      const players = state.mode === 'single'
        ? [nextPlayers[0], laptopPlayer(state.difficulty)]
        : nextPlayers
      return { ...state, players, phase: 'intro', draftBuild: balancedBuild() }
    }
    case 'start-match':
      return { ...state, phase: 'match' }
    case 'finish-match':
      return { ...state, phase: 'result', finalMatch: action.match }
    case 'rematch':
      return {
        ...state,
        phase: 'intro',
        openingServer: 1 - state.openingServer,
        finalMatch: null,
      }
    case 'home':
      return initialAppState()
    default:
      return state
  }
}
