import React, { useState } from 'react'
import { MONSTERS } from '../game/roster.js'
import ModalBoundary from './ModalBoundary.jsx'
import MonsterFigure from './MonsterFigure.jsx'

function HowToPlayDialog({ onClose }) {
  return (
    <ModalBoundary labelledBy="how-to-play-title" onClose={onClose}>
      <p className="eyebrow">Courtside notes</p>
      <h2 id="how-to-play-title">How to play</h2>
      <p>Move into the ball and your monster swings automatically.</p>
      <dl className="control-list">
        <div>
          <dt>Player 1</dt>
          <dd>W A S D, or drag on the lower court</dd>
        </div>
        <div>
          <dt>Player 2</dt>
          <dd>Arrow keys, or drag on the upper court</dd>
        </div>
      </dl>
      <p>First to 7 wins. At 6–6, win by 2.</p>
      <button className="button button--primary" type="button" onClick={onClose}>
        Got it
      </button>
    </ModalBoundary>
  )
}

export default function HomeScreen({
  phase,
  muted,
  disableLocalMultiplayer = false,
  onChooseMode,
  onChooseDifficulty,
  onBack,
  onToggleMute,
}) {
  const [showHelp, setShowHelp] = useState(false)

  if (phase === 'difficulty') {
    return (
      <main className="screen home-screen">
        <header className="brand-lockup brand-lockup--small">
          <p className="eyebrow">Choose your rival</p>
          <h1 data-screen-heading tabIndex="-1">Tiebreak</h1>
        </header>
        <section className="menu-panel" aria-labelledby="difficulty-title">
          <h2 id="difficulty-title">Laptop difficulty</h2>
          <div className="button-stack">
            <button type="button" onClick={() => onChooseDifficulty('easy')}>
              <span>Easy</span>
              <small>Late feet, generous returns</small>
            </button>
            <button type="button" onClick={() => onChooseDifficulty('normal')}>
              <span>Normal</span>
              <small>A steady club opponent</small>
            </button>
            <button type="button" onClick={() => onChooseDifficulty('hard')}>
              <span>Hard</span>
              <small>Quick reads, sharp recovery</small>
            </button>
          </div>
          <button className="button button--quiet" type="button" onClick={onBack}>
            Back
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="screen home-screen">
      <button
        className="icon-button mute-button"
        type="button"
        aria-label={muted ? 'Unmute game' : 'Mute game'}
        aria-pressed={muted}
        onClick={onToggleMute}
      >
        <span aria-hidden="true">{muted ? '×' : '♪'}</span>
      </button>

      <header className="brand-lockup">
        <p className="eyebrow">Monster court club</p>
        <h1 data-screen-heading tabIndex="-1">Tiebreak</h1>
        <p>First to 7 · Win by 2</p>
      </header>

      <div className="home-roster" aria-hidden="true">
        {MONSTERS.map((monster) => (
          <MonsterFigure key={monster.id} monsterId={monster.id} />
        ))}
      </div>

      <section className="menu-panel" aria-label="Start a match">
        <div className="button-stack">
          <button type="button" onClick={() => onChooseMode('single')}>
            <span>1 Player</span>
            <small>Take on the laptop</small>
          </button>
          <button
            type="button"
            disabled={disableLocalMultiplayer}
            onClick={() => onChooseMode('local')}
          >
            <span>2 Players</span>
            <small>{disableLocalMultiplayer ? 'Desktop only for now' : 'Share this court'}</small>
          </button>
        </div>
        <button className="button button--quiet" type="button" onClick={() => setShowHelp(true)}>
          How to play
        </button>
      </section>

      {showHelp && <HowToPlayDialog onClose={() => setShowHelp(false)} />}
    </main>
  )
}
