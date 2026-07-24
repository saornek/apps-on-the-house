import { balancedBuild, validateBuild } from './game/match.js'
import { MONSTERS } from './game/roster.js'

const AI_BUILDS = [
  { forehand: 7, backhand: 5, serve: 4, footwork: 4 },
  { forehand: 4, backhand: 6, serve: 6, footwork: 4 },
  { forehand: 5, backhand: 4, serve: 4, footwork: 7 },
]
const LAST_MONSTER_KEY = 'tiebreak:last-monster'

export const MAX_PLAYER_NAME_LENGTH = 10

function validMonsterId(monsterId) {
  return MONSTERS.some((monster) => monster.id === monsterId)
    ? monsterId
    : MONSTERS[0].id
}

function createDraft(index, monsterId) {
  return {
    name: `Player ${index + 1}`,
    monsterId: validMonsterId(monsterId),
    build: balancedBuild(),
  }
}

function createDrafts(monsterId) {
  return [createDraft(0, monsterId), createDraft(1, monsterId)]
}

function replaceAt(values, index, value) {
  return values.map((entry, entryIndex) => (entryIndex === index ? value : entry))
}

function updateActiveDraft(state, update) {
  const draft = state.drafts[state.setupIndex]
  return {
    ...state,
    drafts: replaceAt(state.drafts, state.setupIndex, update(draft)),
  }
}

export function validatePlayerName(name, otherName) {
  const normalized = String(name ?? '').trim()
  if (normalized.length === 0) {
    return { valid: false, normalized, error: 'Enter a name.' }
  }
  if (normalized.length > MAX_PLAYER_NAME_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Use ${MAX_PLAYER_NAME_LENGTH} characters or fewer.`,
    }
  }
  const normalizedOther = String(otherName ?? '').trim()
  if (
    normalizedOther
    && normalized.toLocaleLowerCase() === normalizedOther.toLocaleLowerCase()
  ) {
    return { valid: false, normalized, error: 'Choose a different name.' }
  }
  return { valid: true, normalized, error: null }
}

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

export function initialAppState(monsterId = MONSTERS[0].id) {
  return {
    phase: 'home',
    mode: null,
    difficulty: null,
    setupIndex: 0,
    players: [],
    drafts: createDrafts(monsterId),
    openingServer: Math.random() < 0.5 ? 0 : 1,
    finalMatch: null,
  }
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
        ...initialAppState(action.monsterId),
        mode: action.mode,
        phase: action.mode === 'single' ? 'difficulty' : 'setup',
      }
    case 'choose-difficulty':
      return { ...state, difficulty: action.difficulty, phase: 'setup' }
    case 'change-draft-name':
      if (state.mode !== 'local') return state
      return updateActiveDraft(state, (draft) => ({ ...draft, name: action.name }))
    case 'select-draft-monster':
      return updateActiveDraft(state, (draft) => ({
        ...draft,
        monsterId: validMonsterId(action.monsterId),
      }))
    case 'change-stat': {
      const draft = state.drafts[state.setupIndex]
      const nextBuild = {
        ...draft.build,
        [action.stat]: draft.build[action.stat] + action.delta,
      }
      const value = nextBuild[action.stat]
      if (value < 1 || value > 9) return state
      return updateActiveDraft(state, (entry) => ({ ...entry, build: nextBuild }))
    }
    case 'reset-build':
      return updateActiveDraft(state, (draft) => ({
        ...draft,
        build: balancedBuild(),
      }))
    case 'back':
      if (state.phase === 'difficulty') return initialAppState()
      if (state.phase !== 'setup') return state
      if (state.mode === 'single') {
        return { ...state, phase: 'difficulty', difficulty: null }
      }
      if (state.setupIndex === 1) {
        return { ...state, setupIndex: 0 }
      }
      return initialAppState()
    case 'confirm-player': {
      const activeDraft = state.drafts[state.setupIndex]
      if (!validateBuild(activeDraft.build).valid) {
        throw new Error('Confirm a valid twenty-point build.')
      }
      const otherName = state.mode === 'local'
        ? state.drafts[1 - state.setupIndex].name
        : undefined
      const nameValidation = validatePlayerName(activeDraft.name, otherName)
      if (!nameValidation.valid) throw new Error(nameValidation.error)

      const normalizedDraft = {
        ...activeDraft,
        name: nameValidation.normalized,
        build: { ...activeDraft.build },
      }
      const drafts = replaceAt(state.drafts, state.setupIndex, normalizedDraft)
      if (state.mode === 'local' && state.setupIndex === 0) {
        return { ...state, drafts, setupIndex: 1 }
      }

      const humanPlayer = (draft) => ({
        kind: 'human',
        name: draft.name,
        monsterId: draft.monsterId,
        build: { ...draft.build },
      })
      const players = state.mode === 'single'
        ? [humanPlayer(drafts[0]), laptopPlayer(state.difficulty)]
        : [humanPlayer(drafts[0]), humanPlayer(drafts[1])]
      return { ...state, drafts, players, phase: 'intro' }
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
