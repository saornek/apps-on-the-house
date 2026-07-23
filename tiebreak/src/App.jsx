import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  appReducer,
  initialAppState,
  loadLastMonster,
  saveLastMonster,
} from './appState.js'
import { createAudio, loadMute, saveMute } from './audio.js'
import { createInputState } from './game/input.js'
import { createMatch, STAT_KEYS } from './game/match.js'
import { MONSTERS } from './game/roster.js'
import { createSimulation } from './game/simulation.js'
import HomeScreen from './screens/HomeScreen.jsx'
import MatchScreen from './screens/MatchScreen.jsx'
import MonsterFigure from './screens/MonsterFigure.jsx'
import ResultScreen from './screens/ResultScreen.jsx'
import SetupScreen from './screens/SetupScreen.jsx'

const STAT_LABELS = {
  forehand: 'Forehand',
  backhand: 'Backhand',
  serve: 'Serve',
  footwork: 'Footwork',
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return undefined
    const update = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return reducedMotion
}

function monsterFor(monsterId) {
  return MONSTERS.find((monster) => monster.id === monsterId)
}

function IntroScreen({ players, onStart }) {
  useEffect(() => {
    const timer = window.setTimeout(onStart, 1800)
    return () => window.clearTimeout(timer)
  }, [onStart])

  return (
    <main className="screen intro-screen" aria-labelledby="intro-title">
      <p className="eyebrow">Next on court</p>
      <h1 id="intro-title" data-screen-heading tabIndex="-1">Ready?</h1>
      <section className="versus-card">
        {players.map((player, index) => {
          const monster = monsterFor(player.monsterId)
          return (
            <article className="intro-player" key={`${player.name}-${player.monsterId}`}>
              <p>{player.name}</p>
              <MonsterFigure
                monsterId={player.monsterId}
                label={`${monster.name} holding a racket`}
              />
              <h2>{monster.name}</h2>
              <dl>
                {STAT_KEYS.map((stat) => (
                  <div key={stat}>
                    <dt>{STAT_LABELS[stat]}</dt>
                    <dd>{player.build[stat]}</dd>
                  </div>
                ))}
              </dl>
              {index === 0 && <span className="versus-mark" aria-hidden="true">VS</span>}
            </article>
          )
        })}
      </section>
      <p className="intro-countdown" aria-live="polite">Match starts in a moment…</p>
    </main>
  )
}

function MatchSession({
  players,
  openingServer,
  audio,
  muted,
  reducedMotion,
  onFinish,
  onHome,
}) {
  const matchRef = useRef(null)
  const simulationRef = useRef(null)
  const inputRef = useRef(null)

  if (matchRef.current === null) {
    matchRef.current = createMatch({ players, openingServer })
    simulationRef.current = createSimulation(matchRef.current)
    inputRef.current = createInputState()
  }

  return (
    <MatchScreen
      simulationRef={simulationRef}
      inputRef={inputRef}
      audio={audio}
      muted={muted}
      reducedMotion={reducedMotion}
      onFinish={onFinish}
      onHome={onHome}
    />
  )
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initialAppState)
  const [selectedMonster, setSelectedMonster] = useState(loadLastMonster)
  const [muted, setMuted] = useState(loadMute)
  const audioRef = useRef(null)
  audioRef.current ??= createAudio()
  const reducedMotion = useReducedMotion()
  const startMatch = useCallback(() => dispatch({ type: 'start-match' }), [])
  const returnHome = useCallback(() => dispatch({ type: 'home' }), [])
  const finishMatch = useCallback((match) => {
    dispatch({ type: 'finish-match', match })
  }, [])

  useEffect(() => {
    document.querySelector('[data-screen-heading]')?.focus()
  }, [state.phase, state.setupIndex])

  if (state.phase === 'home' || state.phase === 'difficulty') {
    return (
      <HomeScreen
        phase={state.phase}
        muted={muted}
        onChooseMode={(mode) => {
          audioRef.current.unlock(muted)
          dispatch({ type: 'choose-mode', mode })
        }}
        onChooseDifficulty={(difficulty) => {
          dispatch({ type: 'choose-difficulty', difficulty })
        }}
        onBack={returnHome}
        onToggleMute={() => {
          setMuted((value) => {
            const next = !value
            saveMute(next)
            if (!next) audioRef.current.unlock(false)
            return next
          })
        }}
      />
    )
  }

  if (state.phase === 'setup') {
    return (
      <SetupScreen
        mode={state.mode}
        setupIndex={state.setupIndex}
        selectedMonster={selectedMonster}
        draftBuild={state.draftBuild}
        onSelectMonster={setSelectedMonster}
        onChangeStat={(stat, delta) => dispatch({ type: 'change-stat', stat, delta })}
        onReset={() => dispatch({ type: 'reset-build' })}
        onReady={() => {
          saveLastMonster(selectedMonster)
          dispatch({
            type: 'confirm-player',
            monsterId: selectedMonster,
            build: state.draftBuild,
          })
        }}
      />
    )
  }

  if (state.phase === 'intro') {
    return <IntroScreen players={state.players} onStart={startMatch} />
  }

  if (state.phase === 'match') {
    return (
      <MatchSession
        players={state.players}
        openingServer={state.openingServer}
        reducedMotion={reducedMotion}
        onFinish={finishMatch}
        onHome={returnHome}
        audio={audioRef.current}
        muted={muted}
      />
    )
  }

  if (state.phase === 'result') {
    return (
      <ResultScreen
        match={state.finalMatch}
        onRematch={() => dispatch({ type: 'rematch' })}
        onHome={returnHome}
      />
    )
  }

  return null
}
