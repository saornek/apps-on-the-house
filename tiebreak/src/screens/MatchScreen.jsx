import { useEffect, useState } from 'react'
import GameCanvas from '../GameCanvas.jsx'
import ModalBoundary from './ModalBoundary.jsx'
import { pointResultMessage } from './matchFeedback.js'

function PauseDialog({ showingHelp, onShowHelp, onResume, onHome }) {
  return (
    <ModalBoundary
      labelledBy="pause-title"
      className="pause-dialog"
      onClose={() => {}}
    >
      <p className="eyebrow">Time out</p>
      <h2 id="pause-title">{showingHelp ? 'How to play' : 'Match paused'}</h2>
      {showingHelp ? (
        <>
          <p>Move into the ball. Your monster chooses forehand or backhand and swings for you.</p>
          <p>Player 1 uses W A S D. Player 2 uses the arrow keys. Touch players drag on their half.</p>
        </>
      ) : (
        <p>The court is frozen until you return.</p>
      )}
      <div className="dialog-actions">
        {!showingHelp && (
          <button className="button button--quiet" type="button" onClick={onShowHelp}>
            How to play
          </button>
        )}
        <button className="button button--primary" type="button" onClick={onResume}>
          Resume
        </button>
        <button className="button button--quiet" type="button" onClick={onHome}>
          Home
        </button>
      </div>
    </ModalBoundary>
  )
}

export default function MatchScreen({
  simulationRef,
  inputRef,
  audio,
  muted,
  reducedMotion,
  onFinish,
  onHome,
}) {
  const initialMatch = simulationRef.current.match
  const [paused, setPaused] = useState(false)
  const [showingHelp, setShowingHelp] = useState(false)
  const [snapshot, setSnapshot] = useState({
    phase: initialMatch.phase,
    scores: [...initialMatch.scores],
    currentServer: initialMatch.currentServer,
    lastPoint: initialMatch.lastPoint,
  })

  useEffect(() => {
    const pauseForVisibility = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', pauseForVisibility)
    return () => document.removeEventListener('visibilitychange', pauseForVisibility)
  }, [])

  const handleSnapshot = (simulation) => {
    const match = simulation.match
    audio.play(simulation.cue, muted)
    setSnapshot({
      phase: match.phase,
      scores: [...match.scores],
      currentServer: match.currentServer,
      lastPoint: match.lastPoint ? { ...match.lastPoint } : null,
    })
    if (match.phase === 'match-over') {
      onFinish({
        ...match,
        scores: [...match.scores],
        lastPoint: match.lastPoint ? { ...match.lastPoint } : null,
      })
    }
  }

  const players = initialMatch.players
  const pointMessage = pointResultMessage(snapshot, players)
  const liveMessage = [
    `${players[0].name} ${snapshot.scores[0]}, ${players[1].name} ${snapshot.scores[1]}.`,
    pointMessage,
    `${players[snapshot.currentServer].name} serves.`,
  ].filter(Boolean).join(' ')
  const faceToFace = players[1].kind === 'human'

  return (
    <main className={faceToFace ? 'screen match-screen match-screen--face-to-face' : 'screen match-screen'}>
      <h1 className="visually-hidden" data-screen-heading tabIndex="-1">
        Tiebreak match
      </h1>
      <section className="match-hud" aria-label="Match score">
        <div className={snapshot.currentServer === 0 ? 'score-player is-serving' : 'score-player'}>
          <span>{players[0].name}</span>
          <strong>{snapshot.scores[0]}</strong>
        </div>
        <div className="server-status">
          <span className="server-dot" aria-hidden="true" />
          <span>{players[snapshot.currentServer].name} serves</span>
        </div>
        <div className={snapshot.currentServer === 1 ? 'score-player is-serving' : 'score-player'}>
          <strong>{snapshot.scores[1]}</strong>
          <span>{players[1].name}</span>
        </div>
        <button
          className="icon-button pause-button"
          type="button"
          aria-label="Pause match"
          onClick={() => setPaused(true)}
        >
          <span aria-hidden="true">Ⅱ</span>
        </button>
      </section>

      <div className="court-frame">
        <GameCanvas
          simulationRef={simulationRef}
          inputRef={inputRef}
          paused={paused}
          reducedMotion={reducedMotion}
          onSnapshot={handleSnapshot}
        />
      </div>

      <p className="point-result">
        {pointMessage}
      </p>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
      <div className="match-controls" aria-label="Match controls">
        <p><strong>Keyboard</strong> P1: W A S D · P2: arrow keys</p>
        <p><strong>Touch</strong> Drag on your half of the court</p>
      </div>

      {paused && (
        <PauseDialog
          showingHelp={showingHelp}
          onShowHelp={() => setShowingHelp(true)}
          onResume={() => {
            setShowingHelp(false)
            setPaused(false)
          }}
          onHome={onHome}
        />
      )}
    </main>
  )
}
