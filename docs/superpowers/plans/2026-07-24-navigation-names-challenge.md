# Tiebreak Navigation, Names, and Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reversible setup navigation, unique 10-character local-player names, and the catalog-standard Challenge a Friend result action to Tiebreak.

**Architecture:** Move each player's setup draft into the existing pure reducer so Back navigation can preserve or reset state deterministically. Keep the setup screen controlled by the active draft, and implement sharing as a self-contained result-screen component with exported pure formatting and browser-capability helpers for Node-based tests.

**Tech Stack:** React 19.2, Vite 8.1, Vitest 3, React DOM server rendering, localStorage, Web Share API, Clipboard API, lucide-react 1.21

## Global Constraints

- Work in `/Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak` for game changes and `/Users/saornek/Claude/Projects/Free-Apps/website/.worktrees/tiebreak-catalog` for the website contract.
- Preserve all existing Tiebreak scoring, serve rotation, laptop AI, controls, racket direction, PWA, and offline behavior.
- Difficulty Back goes home; single-player setup Back goes to difficulty; local Player 1 Back goes home; local Player 2 Back goes to Player 1.
- Going back from local Player 2 preserves both drafts; returning home resets the flow and drafts.
- Local names default to `Player 1` and `Player 2`, trim on validation and confirmation, contain 1–10 characters, and are unique after trimming and case folding.
- Empty, over-10-character, and duplicate local names never enter confirmed match players.
- Name editing is local-multiplayer-only; single-player continues to display `Player 1`.
- Every valid stat build still totals exactly 20 points with each stat in the 1–9 range.
- The result action order is `Rematch`, `Challenge a Friend`, `Home` in both modes.
- Share copy is `{Winner name} won {winner score}–{loser score} in Tiebreak. Can you beat that score?`, followed by a blank line, `Free. No ads. No signup.`, and the canonical game URL on its own line.
- Share scores are winner-first even when the second match slot wins.
- The canonical route is `/games/tiebreak/`; non-game local previews fall back to `https://appsonthehouse.com/games/tiebreak/`.
- Native sharing passes one precomposed `text` value; desktop fallback offers X, Facebook, LinkedIn, WhatsApp, and Copy for Instagram.
- Escape and outside click close the share menu; native cancellation and clipboard failure are silent.
- Use bundled `lucide-react` `Share2` and `Check` icons with no runtime network request.
- Preserve the pixel clay/cream/deep-teal design, visible focus treatment, and responsive result/setup layouts.
- Follow strict RED → GREEN → REFACTOR for every production change.
- Do not push, change either worktree's branch, alter the website games submodule pointer, or touch unrelated changes.

## File Map

- `tiebreak/src/appState.js` — setup-draft creation, name validation, Back transitions, draft editing, and confirmed-player creation.
- `tiebreak/src/appState.test.js` — pure reducer coverage for preservation, reset, validation, replacement, and final player names.
- `tiebreak/src/App.jsx` — reducer initialization, persisted monster seeding, setup action wiring, and result composition.
- `tiebreak/src/screens/SetupScreen.jsx` — controlled draft UI, local name field, validation message, Back control, and combined Ready validity.
- `tiebreak/src/screens/SetupScreen.test.jsx` — server-rendered setup markup and App wiring assertions without a browser test dependency.
- `tiebreak/src/screens/matchInteraction.js` — custom-name-aware in-match help copy.
- `tiebreak/src/screens/matchInteraction.test.js` — help-copy name propagation coverage.
- `tiebreak/src/screens/MatchScreen.jsx` — pass confirmed match players into pause/help content.
- `tiebreak/src/ShareButton.jsx` — share text/URL/link helpers, browser capability helpers, native share, fallback menu, copy state, and dismissal behavior.
- `tiebreak/src/ShareButton.test.jsx` — pure helper tests plus server-rendered result action/accessibility assertions.
- `tiebreak/src/screens/ResultScreen.jsx` — winner-first challenge formatting and result action placement.
- `tiebreak/src/app.css` — setup-name, Back, share button, and share menu styling.
- `tiebreak/package.json` — bundled `lucide-react` dependency.
- `tiebreak/package-lock.json` — reproducible `lucide-react` resolution.
- `website/scripts/share-links.test.mjs` — Tiebreak canonical route, copy, button-label, and sharing-convention integration contract.

---

### Task 1: Reducer-Owned Setup Drafts and Name Rules

**Files:**
- Modify: `tiebreak/src/appState.js`
- Modify: `tiebreak/src/appState.test.js`

**Interfaces:**
- Produces: `MAX_PLAYER_NAME_LENGTH = 10`.
- Produces: `validatePlayerName(name, otherName?) -> { valid, normalized, error }`.
- Produces: reducer state `drafts: Array<{ name, monsterId, build }>` with the active entry at `drafts[setupIndex]`.
- Produces actions `{ type: 'change-draft-name', name }`, `{ type: 'select-draft-monster', monsterId }`, `{ type: 'change-stat', stat, delta }`, `{ type: 'reset-build' }`, `{ type: 'back' }`, and `{ type: 'confirm-player' }`.
- Changes `choose-mode` to consume `{ type: 'choose-mode', mode, monsterId }` so a newly entered flow is seeded from the persisted cosmetic preference.
- `confirm-player` consumes the active reducer draft and no longer accepts `monsterId` or `build`.

- [ ] **Step 1: Write failing name-validation and draft-shape tests**

In `tiebreak/src/appState.test.js`, import `MAX_PLAYER_NAME_LENGTH` and
`validatePlayerName`, then add:

```js
describe('player setup drafts', () => {
  it('creates independent default drafts from the preferred monster', () => {
    const state = appReducer(initialAppState(), {
      type: 'choose-mode',
      mode: 'local',
      monsterId: 'mossbyte',
    })

    expect(state.drafts).toEqual([
      {
        name: 'Player 1',
        monsterId: 'mossbyte',
        build: { forehand: 5, backhand: 5, serve: 5, footwork: 5 },
      },
      {
        name: 'Player 2',
        monsterId: 'mossbyte',
        build: { forehand: 5, backhand: 5, serve: 5, footwork: 5 },
      },
    ])
    expect(state.drafts[0].build).not.toBe(state.drafts[1].build)
  })
})

describe('player name validation', () => {
  it('accepts trimmed names from one through ten characters', () => {
    expect(MAX_PLAYER_NAME_LENGTH).toBe(10)
    expect(validatePlayerName(' A ')).toEqual({
      valid: true,
      normalized: 'A',
      error: null,
    })
    expect(validatePlayerName('1234567890').valid).toBe(true)
    expect(validatePlayerName('Pixel Pal').valid).toBe(true)
    expect(validatePlayerName('Mavi Şey').valid).toBe(true)
  })

  it('rejects empty, over-limit, and case-insensitive duplicate names', () => {
    expect(validatePlayerName('   ')).toEqual({
      valid: false,
      normalized: '',
      error: 'Enter a name.',
    })
    expect(validatePlayerName('12345678901').error).toBe(
      'Use 10 characters or fewer.',
    )
    expect(validatePlayerName(' alex ', 'Alex')).toEqual({
      valid: false,
      normalized: 'alex',
      error: 'Choose a different name.',
    })
  })
})
```

- [ ] **Step 2: Run the focused suite and verify RED**

Run:

```bash
cd /Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak/tiebreak
npm test -- src/appState.test.js
```

Expected: FAIL because `MAX_PLAYER_NAME_LENGTH`,
`validatePlayerName`, and `state.drafts` do not exist.

- [ ] **Step 3: Implement draft creation and pure name validation**

In `tiebreak/src/appState.js`, add these helpers above `initialAppState`:

```js
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
```

Change `initialAppState` to accept a preferred monster and replace
`draftBuild` with two drafts:

```js
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
```

Change `choose-mode` to initialize from `action.monsterId`:

```js
case 'choose-mode':
  return {
    ...initialAppState(action.monsterId),
    mode: action.mode,
    phase: action.mode === 'single' ? 'difficulty' : 'setup',
  }
```

- [ ] **Step 4: Run the focused suite and verify the first GREEN state**

Run:

```bash
npm test -- src/appState.test.js
```

Expected: the new draft/name tests PASS; existing tests that still read
`draftBuild` or pass confirmation payloads FAIL, establishing the next RED
state.

- [ ] **Step 5: Replace existing flow fixtures and add failing Back/preservation tests**

Update existing confirmation calls in `tiebreak/src/appState.test.js` to edit
the active draft through reducer actions and then dispatch
`{ type: 'confirm-player' }`. Add:

```js
function chooseLocal(monsterId = 'crumblehorn') {
  return appReducer(initialAppState(), {
    type: 'choose-mode',
    mode: 'local',
    monsterId,
  })
}

describe('setup Back navigation', () => {
  it('returns difficulty and local Player 1 to home with reset drafts', () => {
    let single = appReducer(initialAppState(), {
      type: 'choose-mode',
      mode: 'single',
      monsterId: 'mossbyte',
    })
    single = appReducer(single, { type: 'back' })
    expect(single.phase).toBe('home')
    expect(single.mode).toBeNull()

    let local = chooseLocal('mossbyte')
    local = appReducer(local, { type: 'change-draft-name', name: 'Kai' })
    local = appReducer(local, { type: 'back' })
    expect(local.phase).toBe('home')
    expect(local.drafts[0].name).toBe('Player 1')
  })

  it('returns single setup to difficulty while preserving its draft', () => {
    let state = appReducer(initialAppState(), {
      type: 'choose-mode',
      mode: 'single',
      monsterId: 'mossbyte',
    })
    state = appReducer(state, { type: 'choose-difficulty', difficulty: 'easy' })
    state = appReducer(state, {
      type: 'select-draft-monster',
      monsterId: 'blinkblob',
    })
    state = appReducer(state, { type: 'change-stat', stat: 'serve', delta: 1 })
    state = appReducer(state, { type: 'change-stat', stat: 'footwork', delta: -1 })
    const draft = state.drafts[0]

    state = appReducer(state, { type: 'back' })
    expect(state.phase).toBe('difficulty')
    expect(state.drafts[0]).toEqual(draft)

    state = appReducer(state, { type: 'choose-difficulty', difficulty: 'hard' })
    expect(state.phase).toBe('setup')
    expect(state.drafts[0]).toEqual(draft)
  })

  it('preserves both local drafts through Player 2 to Player 1 and back', () => {
    let state = chooseLocal()
    state = appReducer(state, { type: 'change-draft-name', name: '  Nova  ' })
    state = appReducer(state, {
      type: 'select-draft-monster',
      monsterId: 'mossbyte',
    })
    state = appReducer(state, { type: 'confirm-player' })
    state = appReducer(state, { type: 'change-draft-name', name: 'Orbit' })
    state = appReducer(state, {
      type: 'select-draft-monster',
      monsterId: 'blinkblob',
    })
    const playerTwoDraft = state.drafts[1]

    state = appReducer(state, { type: 'back' })
    expect(state.setupIndex).toBe(0)
    expect(state.drafts[0].name).toBe('Nova')
    expect(state.drafts[1]).toEqual(playerTwoDraft)

    state = appReducer(state, { type: 'change-draft-name', name: 'Nova X' })
    state = appReducer(state, { type: 'confirm-player' })
    expect(state.setupIndex).toBe(1)
    expect(state.drafts[0].name).toBe('Nova X')
    expect(state.drafts[1]).toEqual(playerTwoDraft)
  })
})
```

- [ ] **Step 6: Run the focused suite and verify the second RED state**

Run:

```bash
npm test -- src/appState.test.js
```

Expected: FAIL because draft-editing and `back` actions are not implemented
and confirmation still reads action payloads.

- [ ] **Step 7: Implement active-draft edits, Back transitions, and confirmation**

Replace the existing `change-stat`, `reset-build`, and `confirm-player` cases
in `appReducer`, and add the new cases:

```js
case 'change-draft-name':
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
```

Remove the old top-level `humanPlayer(index, monsterId, build)` helper.

- [ ] **Step 8: Add failing confirmation-boundary tests**

Add:

```js
describe('draft confirmation boundaries', () => {
  it('stores trimmed custom names and never appends duplicate player records', () => {
    let state = chooseLocal()
    state = appReducer(state, { type: 'change-draft-name', name: '  Nova  ' })
    state = appReducer(state, { type: 'confirm-player' })
    state = appReducer(state, { type: 'change-draft-name', name: 'Orbit' })
    state = appReducer(state, { type: 'back' })
    state = appReducer(state, { type: 'change-draft-name', name: 'Nova X' })
    state = appReducer(state, { type: 'confirm-player' })
    state = appReducer(state, { type: 'confirm-player' })

    expect(state.phase).toBe('intro')
    expect(state.players.map((player) => player.name)).toEqual(['Nova X', 'Orbit'])
    expect(state.players).toHaveLength(2)
  })

  it('rejects invalid names even when UI constraints are bypassed', () => {
    let state = chooseLocal()
    state = appReducer(state, { type: 'change-draft-name', name: '12345678901' })
    expect(() => appReducer(state, { type: 'confirm-player' })).toThrow(
      /10 characters/i,
    )

    state = appReducer(state, { type: 'change-draft-name', name: 'Alex' })
    state = appReducer(state, { type: 'confirm-player' })
    state = appReducer(state, { type: 'change-draft-name', name: ' alex ' })
    expect(() => appReducer(state, { type: 'confirm-player' })).toThrow(
      /different name/i,
    )
  })
})
```

- [ ] **Step 9: Run focused and full tests, then commit**

Run:

```bash
npm test -- src/appState.test.js
npm test
```

Expected: all reducer tests and the pre-existing game suite PASS with no
warnings.

Commit:

```bash
git add tiebreak/src/appState.js tiebreak/src/appState.test.js
git commit -m "feat: preserve Tiebreak player setup drafts"
```

---

### Task 2: Back and Local-Name Setup UI

**Files:**
- Modify: `tiebreak/src/App.jsx`
- Modify: `tiebreak/src/screens/SetupScreen.jsx`
- Modify: `tiebreak/src/screens/matchInteraction.js`
- Modify: `tiebreak/src/screens/matchInteraction.test.js`
- Modify: `tiebreak/src/screens/MatchScreen.jsx`
- Modify: `tiebreak/src/app.css`
- Create: `tiebreak/src/screens/SetupScreen.test.jsx`

**Interfaces:**
- Consumes: `state.drafts[state.setupIndex]`, `validatePlayerName`, and all Task 1 reducer actions.
- Changes `SetupScreen` props to `{ mode, setupIndex, draft, otherName, onBack, onChangeName, onSelectMonster, onChangeStat, onReset, onReady }`.
- `onReady` has no arguments and dispatches `{ type: 'confirm-player' }` after persisting the active draft's monster.
- Produces: `helpInstructions(players) -> string[]`, using confirmed names in the pause/help control copy.

- [ ] **Step 1: Write failing server-rendered setup tests**

Create `tiebreak/src/screens/SetupScreen.test.jsx`:

```jsx
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import SetupScreen from './SetupScreen.jsx'

const APP_SOURCE = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const STYLES = readFileSync(new URL('../app.css', import.meta.url), 'utf8')
const build = { forehand: 5, backhand: 5, serve: 5, footwork: 5 }

function renderSetup(overrides = {}) {
  return renderToStaticMarkup(
    <SetupScreen
      mode="local"
      setupIndex={0}
      draft={{ name: 'Player 1', monsterId: 'crumblehorn', build }}
      otherName="Player 2"
      onBack={vi.fn()}
      onChangeName={vi.fn()}
      onSelectMonster={vi.fn()}
      onChangeStat={vi.fn()}
      onReset={vi.fn()}
      onReady={vi.fn()}
      {...overrides}
    />,
  )
}

describe('local setup names', () => {
  it('renders a labeled ten-character field and enabled Ready for valid names', () => {
    const markup = renderSetup()

    expect(markup).toContain('for="player-name"')
    expect(markup).toContain('id="player-name"')
    expect(markup).toContain('maxlength="10"')
    expect(markup).toContain('autocomplete="off"')
    expect(markup).toContain('aria-describedby="player-name-status"')
    expect(markup).toContain('>Back</button>')
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Ready/)
  })

  it('announces duplicate-name errors and disables Ready', () => {
    const markup = renderSetup({
      draft: { name: ' alex ', monsterId: 'crumblehorn', build },
      otherName: 'Alex',
    })

    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('Choose a different name.')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Ready/)
  })

  it('keeps the single-player name fixed and hides the field', () => {
    const markup = renderSetup({
      mode: 'single',
      otherName: undefined,
    })

    expect(markup).not.toContain('id="player-name"')
    expect(markup).toContain('Build your monster')
  })
})

describe('setup orchestration', () => {
  it('uses reducer-owned drafts and setup Back actions', () => {
    expect(APP_SOURCE).toContain(
      'initialAppState(loadLastMonster())',
    )
    expect(APP_SOURCE).toContain(
      'draft={state.drafts[state.setupIndex]}',
    )
    expect(APP_SOURCE).toContain(
      "dispatch({ type: 'change-draft-name', name })",
    )
    expect(APP_SOURCE).toContain("dispatch({ type: 'back' })")
    expect(APP_SOURCE).not.toContain('useState(loadLastMonster)')
  })

  it('keeps setup Back visible and share/result actions wrappable', () => {
    expect(STYLES).toMatch(/\.screen-heading \.setup-back\s*\{[^}]*margin:/s)
    expect(STYLES).toMatch(/\.name-field\s*\{[^}]*display:\s*grid/s)
    expect(STYLES).toMatch(/\.result-actions\s*\{[^}]*flex-wrap:\s*wrap/s)
  })
})
```

In `tiebreak/src/screens/matchInteraction.test.js`, replace the
`HELP_INSTRUCTIONS` import with `helpInstructions` and replace the current
instructions test with:

```js
it('keeps the short hint concise and uses confirmed names in detailed controls', () => {
  const instructions = helpInstructions([
    { name: 'Nova' },
    { name: 'Orbit' },
  ]).join(' ')

  expect(ONBOARDING_HINT).not.toMatch(/W A S D|arrow keys|Touch/i)
  expect(instructions).toMatch(/Nova uses W A S D/)
  expect(instructions).toMatch(/Orbit uses the arrow keys/)
  expect(instructions).toMatch(/Touch/)
  expect(MATCH_SCREEN_SOURCE).not.toContain('className="match-controls"')
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/screens/SetupScreen.test.jsx src/screens/matchInteraction.test.js
```

Expected: FAIL because `SetupScreen` has the old prop API and renders no name
field or setup Back control, and `helpInstructions` does not exist.

- [ ] **Step 3: Convert SetupScreen to the active draft interface**

In `tiebreak/src/screens/SetupScreen.jsx`, import
`validatePlayerName` from `../appState.js`, change the function signature to:

```js
export default function SetupScreen({
  mode,
  setupIndex,
  draft,
  otherName,
  onBack,
  onChangeName,
  onSelectMonster,
  onChangeStat,
  onReset,
  onReady,
}) {
  const buildValidation = validateBuild(draft.build)
  const nameValidation = mode === 'local'
    ? validatePlayerName(draft.name, otherName)
    : { valid: true, normalized: draft.name, error: null }
  const ready = buildValidation.valid && nameValidation.valid
```

Replace all `selectedMonster` reads with `draft.monsterId`, all `draftBuild`
reads with `draft.build`, and the submit guard with:

```js
if (ready) onReady()
```

Add this native button as the first child of `.screen-heading`:

```jsx
<button
  className="button button--quiet setup-back"
  type="button"
  onClick={onBack}
>
  Back
</button>
```

Add this local-only field before the monster picker:

```jsx
{mode === 'local' && (
  <div className="name-field">
    <label htmlFor="player-name">Player name</label>
    <input
      id="player-name"
      name="player-name"
      type="text"
      value={draft.name}
      maxLength={10}
      autoComplete="off"
      aria-invalid={!nameValidation.valid}
      aria-describedby="player-name-status"
      onChange={(event) => onChangeName(event.target.value)}
    />
    <p
      id="player-name-status"
      className={nameValidation.valid ? 'name-status' : 'name-status name-status--error'}
      aria-live="polite"
    >
      {nameValidation.error ?? '1–10 characters.'}
    </p>
  </div>
)}
```

Use `buildValidation` for budget text and disable Ready with
`disabled={!ready}`.

- [ ] **Step 4: Move setup orchestration fully into the reducer**

In `tiebreak/src/App.jsx`, remove `selectedMonster` state and initialize the
reducer with the saved preference:

```js
const [state, dispatch] = useReducer(
  appReducer,
  undefined,
  () => initialAppState(loadLastMonster()),
)
```

When choosing a mode, dispatch:

```js
dispatch({ type: 'choose-mode', mode, monsterId: loadLastMonster() })
```

Render the setup screen with:

```jsx
<SetupScreen
  mode={state.mode}
  setupIndex={state.setupIndex}
  draft={state.drafts[state.setupIndex]}
  otherName={
    state.mode === 'local'
      ? state.drafts[1 - state.setupIndex].name
      : undefined
  }
  onBack={() => dispatch({ type: 'back' })}
  onChangeName={(name) => dispatch({ type: 'change-draft-name', name })}
  onSelectMonster={(monsterId) => {
    dispatch({ type: 'select-draft-monster', monsterId })
  }}
  onChangeStat={(stat, delta) => dispatch({ type: 'change-stat', stat, delta })}
  onReset={() => dispatch({ type: 'reset-build' })}
  onReady={() => {
    saveLastMonster(state.drafts[state.setupIndex].monsterId)
    dispatch({ type: 'confirm-player' })
  }}
/>
```

Change the difficulty screen's `onBack` to
`() => dispatch({ type: 'back' })`. Keep `returnHome` for live-match and
result Home actions.

- [ ] **Step 5: Propagate confirmed names into pause/help copy**

In `tiebreak/src/screens/matchInteraction.js`, replace
`HELP_INSTRUCTIONS` with:

```js
export function helpInstructions(players) {
  return [
    'Move into the ball. Your monster chooses forehand or backhand and swings for you.',
    `${players[0].name} uses W A S D. ${players[1].name} uses the arrow keys.`,
    'Touch players drag on their half of the court.',
  ]
}
```

In `tiebreak/src/screens/MatchScreen.jsx`, import `helpInstructions` instead
of `HELP_INSTRUCTIONS`, add `players` to the `PauseDialog` props, render
`helpInstructions(players).map(...)`, and pass the existing `players`
constant into `<PauseDialog players={players} ... />`.

- [ ] **Step 6: Add the setup field and Back styles**

In `tiebreak/src/app.css`, extend the existing setup styles:

```css
.screen-heading .setup-back {
  margin: 0 auto 1rem 0;
}

.name-field {
  display: grid;
  gap: 0.4rem;
  margin-bottom: 1.4rem;
}

.name-field label {
  font-family: var(--font-pixel);
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.name-field input {
  min-height: 3.25rem;
  padding: 0.65rem 0.8rem;
  border: 3px solid var(--ink);
  border-radius: 0;
  background: var(--panel);
  color: var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
}

.name-field input:focus-visible {
  outline: 3px solid var(--cream);
  outline-offset: 2px;
  box-shadow: 0 0 0 6px var(--ink);
}

.name-status {
  min-height: 1.25rem;
  margin: 0;
  font-size: 0.82rem;
  font-weight: 900;
}

.name-status--error {
  color: var(--clay-dark);
}
```

- [ ] **Step 7: Run focused/full tests and build, then commit**

Run:

```bash
npm test -- src/screens/SetupScreen.test.jsx src/screens/matchInteraction.test.js src/appState.test.js
npm test
npm run build
```

Expected: focused tests, the full game suite, and the production build PASS
without warnings.

Commit:

```bash
git add tiebreak/src/App.jsx tiebreak/src/screens/SetupScreen.jsx \
  tiebreak/src/screens/SetupScreen.test.jsx \
  tiebreak/src/screens/matchInteraction.js \
  tiebreak/src/screens/matchInteraction.test.js \
  tiebreak/src/screens/MatchScreen.jsx tiebreak/src/app.css
git commit -m "feat: add Tiebreak setup navigation and names"
```

---

### Task 3: Challenge a Friend and Website Sharing Contract

**Files:**
- Create: `tiebreak/src/ShareButton.jsx`
- Create: `tiebreak/src/ShareButton.test.jsx`
- Modify: `tiebreak/src/screens/ResultScreen.jsx`
- Modify: `tiebreak/src/app.css`
- Modify: `tiebreak/package.json`
- Modify: `tiebreak/package-lock.json`
- Modify: `/Users/saornek/Claude/Projects/Free-Apps/website/.worktrees/tiebreak-catalog/scripts/share-links.test.mjs`

**Interfaces:**
- Produces: `challengeText(match) -> string`.
- Produces: `buildShareContent(text, locationLike?) -> { shareUrl, shareText, fullText, links }`.
- Produces: `tryNativeShare(navigator, fullText) -> Promise<boolean>`, returning `true` whenever native sharing is available, including cancellation/failure, and `false` only when fallback should open.
- Produces: `copyShareText(navigator, fullText) -> Promise<boolean>`.
- Produces: `shouldDismissShareMenu(event, menuElement) -> boolean`.
- Produces: `<ShareButton text />`.
- Consumes: the final match already passed to `ResultScreen`.

- [ ] **Step 1: Write failing game helper/result tests**

Create `tiebreak/src/ShareButton.test.jsx`:

```jsx
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ResultScreen from './screens/ResultScreen.jsx'
import {
  buildShareContent,
  challengeText,
  copyShareText,
  shouldDismissShareMenu,
  tryNativeShare,
} from './ShareButton.jsx'

const players = [
  {
    kind: 'human',
    name: 'Nova',
    monsterId: 'crumblehorn',
    build: { forehand: 5, backhand: 5, serve: 5, footwork: 5 },
  },
  {
    kind: 'human',
    name: 'Orbit',
    monsterId: 'mossbyte',
    build: { forehand: 5, backhand: 5, serve: 5, footwork: 5 },
  },
]

describe('challenge copy', () => {
  it('formats either winner with the winner score first', () => {
    expect(challengeText({ players, scores: [7, 5] })).toBe(
      'Nova won 7–5 in Tiebreak. Can you beat that score?',
    )
    expect(challengeText({ players, scores: [8, 10] })).toBe(
      'Orbit won 10–8 in Tiebreak. Can you beat that score?',
    )
  })

  it('uses the current origin only on a games route', () => {
    const local = buildShareContent('Challenge', {
      origin: 'https://preview.example',
      pathname: '/games/tiebreak/',
    })
    const fallback = buildShareContent('Challenge', {
      origin: 'http://127.0.0.1:4174',
      pathname: '/',
    })

    expect(local.shareUrl).toBe('https://preview.example/games/tiebreak/')
    expect(fallback.shareUrl).toBe(
      'https://appsonthehouse.com/games/tiebreak/',
    )
    expect(fallback.fullText).toBe(
      'Challenge\n\nFree. No ads. No signup.\nhttps://appsonthehouse.com/games/tiebreak/',
    )
    expect(fallback.links.map((link) => link.label)).toEqual([
      'X',
      'Facebook',
      'LinkedIn',
      'WhatsApp',
    ])
    expect(decodeURIComponent(fallback.links[3].href)).toContain(
      fallback.fullText,
    )
  })
})

describe('share capability paths', () => {
  it('uses one native text payload and treats cancellation as handled', async () => {
    const share = vi.fn().mockRejectedValue(new Error('cancelled'))

    await expect(tryNativeShare({ share }, 'Complete message')).resolves.toBe(true)
    expect(share).toHaveBeenCalledWith({ text: 'Complete message' })
    await expect(tryNativeShare({}, 'Complete message')).resolves.toBe(false)
  })

  it('reports copy success or failure without throwing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await expect(
      copyShareText({ clipboard: { writeText } }, 'Complete message'),
    ).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('Complete message')
    await expect(copyShareText({}, 'Complete message')).resolves.toBe(false)
  })

  it('dismisses only for Escape or an outside pointer press', () => {
    const inside = {}
    const outside = {}
    const menu = { contains: (target) => target === inside }

    expect(shouldDismissShareMenu({ type: 'keydown', key: 'Escape' }, menu)).toBe(true)
    expect(shouldDismissShareMenu({ type: 'keydown', key: 'Enter' }, menu)).toBe(false)
    expect(shouldDismissShareMenu({ type: 'mousedown', target: inside }, menu)).toBe(false)
    expect(shouldDismissShareMenu({ type: 'mousedown', target: outside }, menu)).toBe(true)
  })
})

describe('result action integration', () => {
  it('places Challenge a Friend between Rematch and Home', () => {
    const markup = renderToStaticMarkup(
      <ResultScreen
        match={{ players, scores: [7, 5] }}
        onRematch={() => {}}
        onHome={() => {}}
      />,
    )

    const rematch = markup.indexOf('Rematch')
    const challenge = markup.indexOf('Challenge a Friend')
    const home = markup.indexOf('Home')
    expect(rematch).toBeGreaterThan(-1)
    expect(challenge).toBeGreaterThan(rematch)
    expect(home).toBeGreaterThan(challenge)
    expect(markup).toContain('aria-haspopup="menu"')
    expect(markup).toContain('aria-expanded="false"')
  })
})
```

- [ ] **Step 2: Extend the website contract before production code**

In
`/Users/saornek/Claude/Projects/Free-Apps/website/.worktrees/tiebreak-catalog/scripts/share-links.test.mjs`,
add:

```js
tiebreak: '/games/tiebreak/',
```

to `expectedGamePaths`, and add:

```js
'tiebreak/src/ShareButton.jsx': /\$\{winner\.name\} won \$\{match\.scores\[winnerIndex\]\}–\$\{match\.scores\[loserIndex\]\} in Tiebreak\. Can you beat that score\?/,
```

to `expectedChallengeMessages`.

Allow the feature worktree to be selected without changing the website
submodule pointer:

```js
const configuredGameRoot = process.env.GAMES_DIR
  ? resolve(root, process.env.GAMES_DIR)
  : null
const gameRoots = [
  configuredGameRoot,
  join(root, 'games'),
  join(workspaceRoot, 'games'),
].filter((gameRoot, index, roots) => (
  gameRoot && existsSync(gameRoot) && roots.indexOf(gameRoot) === index
))
```

Inside loops over `expectedGamePaths`, skip only a game package absent from
that particular transitional root:

```js
const gamePackagePath = join(gameRoot, game)
if (!existsSync(gamePackagePath)) continue
```

When `GAMES_DIR` is configured, require that it actually contains Tiebreak:

```js
if (configuredGameRoot) {
  assert.ok(
    existsSync(join(configuredGameRoot, 'tiebreak')),
    `configured GAMES_DIR must contain tiebreak: ${configuredGameRoot}`,
  )
}
```

At the start of the `expectedChallengeMessages` loop body, add:

```js
const [game] = appPath.split('/')
if (!existsSync(join(gameRoot, game))) continue
```

- [ ] **Step 3: Run both contracts and verify RED**

Run:

```bash
cd /Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak/tiebreak
npm test -- src/ShareButton.test.jsx

cd /Users/saornek/Claude/Projects/Free-Apps/website/.worktrees/tiebreak-catalog
GAMES_DIR=/Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak \
  npm run test:share-links
```

Expected: the game test FAILS because `ShareButton.jsx` is missing, and the
website contract FAILS because Tiebreak has no share component.

- [ ] **Step 4: Install the bundled icon dependency**

Run:

```bash
cd /Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak/tiebreak
npm install lucide-react@^1.21.0
```

Expected: exit 0, `package.json` contains
`"lucide-react": "^1.21.0"`, and `package-lock.json` is updated.

- [ ] **Step 5: Implement the share component and pure helpers**

Create `tiebreak/src/ShareButton.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'

export function challengeText(match) {
  const winnerIndex = match.scores[0] > match.scores[1] ? 0 : 1
  const loserIndex = 1 - winnerIndex
  const winner = match.players[winnerIndex]
  return `${winner.name} won ${match.scores[winnerIndex]}–${match.scores[loserIndex]} in Tiebreak. Can you beat that score?`
}

export function buildShareContent(text, locationLike = globalThis.location) {
  const gamePath = '/games/tiebreak/'
  const shareUrl = locationLike?.pathname?.startsWith('/games/')
    ? new URL(gamePath, locationLike.origin).href
    : 'https://appsonthehouse.com' + gamePath
  const shareText = `${text}\n\nFree. No ads. No signup.`
  const fullText = `${shareText}\n${shareUrl}`
  const links = [
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(fullText)}`,
    },
  ]
  return { shareUrl, shareText, fullText, links }
}

export async function tryNativeShare(navigator, fullText) {
  if (!navigator?.share) return false
  try {
    await navigator.share({ text: fullText })
  } catch {
    // Native cancellation or failure leaves the result screen unchanged.
  }
  return true
}

export async function copyShareText(navigator, fullText) {
  try {
    if (!navigator?.clipboard?.writeText) return false
    await navigator.clipboard.writeText(fullText)
    return true
  } catch {
    return false
  }
}

export function shouldDismissShareMenu(event, menuElement) {
  if (event.type === 'keydown') return event.key === 'Escape'
  return event.type === 'mousedown'
    && Boolean(menuElement)
    && !menuElement.contains(event.target)
}

export default function ShareButton({ text }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)
  const { fullText, links } = buildShareContent(text)

  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => {
      if (shouldDismissShareMenu(event, menuRef.current)) setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', dismiss)
    }
  }, [open])

  const handleShare = async () => {
    if (await tryNativeShare(globalThis.navigator, fullText)) return
    setOpen((value) => !value)
  }

  const handleCopy = async () => {
    if (!await copyShareText(globalThis.navigator, fullText)) return
    setCopied(true)
    globalThis.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="share-wrap" ref={menuRef}>
      <button
        className="button share-button"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleShare}
      >
        <Share2 size={15} /> Challenge a Friend
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {links.map((link) => (
            <a
              className="share-link"
              href={link.href}
              key={link.label}
              role="menuitem"
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
          <button
            className="share-link"
            type="button"
            role="menuitem"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check size={13} aria-hidden="true" />
                Copied
              </>
            ) : (
              'Copy for Instagram'
            )}
          </button>
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copied ? 'Challenge text copied.' : ''}
      </span>
    </div>
  )
}
```

- [ ] **Step 6: Insert sharing into the result action order**

In `tiebreak/src/screens/ResultScreen.jsx`, import:

```js
import ShareButton, { challengeText } from '../ShareButton.jsx'
```

Between the Rematch and Home buttons, render:

```jsx
<ShareButton text={challengeText(match)} />
```

- [ ] **Step 7: Add pixel-styled, responsive share menu CSS**

Append to the result styles in `tiebreak/src/app.css`:

```css
.share-wrap {
  position: relative;
}

.share-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-width: 12rem;
  margin: 0;
  background: var(--sun);
  color: var(--ink);
}

.share-menu {
  position: absolute;
  z-index: 5;
  bottom: calc(100% + 0.75rem);
  left: 50%;
  display: grid;
  width: min(16rem, calc(100vw - 2rem));
  padding: 0.55rem;
  border: 3px solid var(--ink);
  background: var(--panel);
  box-shadow: 5px 5px 0 var(--ink);
  transform: translateX(-50%);
}

.share-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.75rem;
  padding: 0.55rem 0.7rem;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-weight: 900;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.share-link:hover,
.share-link:focus-visible {
  background: var(--clay);
  color: var(--cream);
}
```

- [ ] **Step 8: Run focused contracts and verify GREEN**

Run:

```bash
cd /Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak/tiebreak
npm test -- src/ShareButton.test.jsx

cd /Users/saornek/Claude/Projects/Free-Apps/website/.worktrees/tiebreak-catalog
GAMES_DIR=/Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak \
  npm run test:share-links
```

Expected: both focused contracts PASS.

- [ ] **Step 9: Run both full suites and production builds**

Run:

```bash
cd /Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak/tiebreak
npm test
npm run build

cd /Users/saornek/Claude/Projects/Free-Apps/website/.worktrees/tiebreak-catalog
npm test
GAMES_DIR=/Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak npm run build
```

Expected: the complete game and website suites PASS, the game build emits
`tiebreak/dist`, and the assembled website emits
`dist/games/tiebreak/index.html`.

- [ ] **Step 10: Commit each repository without changing the submodule pointer**

In the game worktree:

```bash
git add tiebreak/package.json tiebreak/package-lock.json \
  tiebreak/src/ShareButton.jsx tiebreak/src/ShareButton.test.jsx \
  tiebreak/src/screens/ResultScreen.jsx tiebreak/src/app.css
git commit -m "feat: challenge friends from Tiebreak results"
```

In the website worktree:

```bash
git add scripts/share-links.test.mjs
git commit -m "test: cover Tiebreak challenge sharing"
```

---

### Task 4: Browser Playtest and Final Regression Gate

**Files:**
- Verify only; modify production or test files only if a newly reproduced defect requires a fresh failing test.

**Interfaces:**
- Consumes: the production game build from Tasks 1–3.
- Produces: evidence for desktop and narrow-mobile setup/result behavior, name propagation, Back transitions, and share fallback interaction.

- [ ] **Step 1: Start a production preview**

Run:

```bash
cd /Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak/tiebreak
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

Expected: Vite serves the production build at
`http://127.0.0.1:4174/`.

- [ ] **Step 2: Verify every setup transition and name boundary**

Using the in-app browser at desktop width:

1. Verify difficulty Back returns home.
2. Enter single-player setup, change monster/stats, go Back, choose a new
   difficulty, and verify the draft is preserved.
3. Enter local setup, verify defaults `Player 1` and `Player 2`.
4. Verify empty, 10-character, 11-character direct reducer coverage, and
   case-insensitive duplicate states; Ready is disabled for visible invalid
   states.
5. Set distinct names/monsters for both players, go Player 2 → Back → Player 1,
   edit Player 1, confirm, and verify Player 2's draft remains intact.
6. Verify local Player 1 Back returns home and a new flow restores defaults.

Expected: every destination and preservation/reset rule matches the approved
spec, with no console errors or inaccessible controls.

- [ ] **Step 3: Verify result names and sharing**

Complete or deterministically advance a local match, then verify:

1. both custom names appear in the intro, HUD, serve feedback, and result;
2. the in-match help dialog labels keyboard controls with both custom names;
3. result action order is Rematch, Challenge a Friend, Home;
4. desktop Challenge opens the fallback menu;
5. menu contains X, Facebook, LinkedIn, WhatsApp, and Copy for Instagram;
6. Escape and outside click close it;
7. Copy changes briefly to Copied;
8. result actions wrap without covering monsters or score.

Repeat the result layout at a narrow mobile viewport.

Expected: interaction and layout match the approved design with no console
errors.

- [ ] **Step 4: Run the final automated gate**

Run:

```bash
cd /Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak/tiebreak
npm test
npm run build

cd /Users/saornek/Claude/Projects/Free-Apps/website/.worktrees/tiebreak-catalog
npm test
GAMES_DIR=/Users/saornek/Claude/Projects/Free-Apps/games/.worktrees/tiebreak npm run build
```

Expected: all test suites and builds PASS after browser verification.
