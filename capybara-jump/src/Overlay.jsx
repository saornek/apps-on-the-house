/*
 * Capybara Jump - idle and game-over overlays.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import ShareButton from './ShareButton.jsx'

export default function Overlay({ phase, score, highScore }) {
  if (phase === 'idle') {
    return (
      <div className="overlay">
        <div className="overlay-card">
          <h1 className="overlay-idle-title">Capybara Jump</h1>
          <p className="overlay-idle-hint">Tap to start</p>
        </div>
      </div>
    )
  }

  if (phase === 'dead') {
    return (
      <div className="overlay">
        <div className="overlay-card">
          <h2 className="overlay-title">Capybara Jump</h2>
          <p className="overlay-score-label">Score</p>
          <p className="overlay-score-value">{score}</p>
          <p className="overlay-best">
            Best: <span>{highScore}</span>
          </p>
          <div className="overlay-actions" onPointerDown={(event) => event.stopPropagation()}>
            <ShareButton text={`I scored ${score} in Capybara Jump — play free at Apps On The House!`} />
          </div>
          <p className="overlay-hint">Tap anywhere to restart</p>
        </div>
      </div>
    )
  }

  return null
}
