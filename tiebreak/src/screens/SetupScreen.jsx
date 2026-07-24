import React from 'react'
import { validatePlayerName } from '../appState.js'
import { STAT_KEYS, validateBuild } from '../game/match.js'
import { MONSTERS } from '../game/roster.js'
import MonsterFigure from './MonsterFigure.jsx'

const STAT_LABELS = {
  forehand: 'Forehand',
  backhand: 'Backhand',
  serve: 'Serve',
  footwork: 'Footwork',
}

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
  const heading = mode === 'single' ? 'Build your monster' : `Player ${setupIndex + 1}`
  const topTouchSetup = mode === 'local' && setupIndex === 1

  return (
    <main className={topTouchSetup ? 'screen setup-screen setup-screen--top-touch' : 'screen setup-screen'}>
      <header className="screen-heading">
        <button
          className="button button--quiet setup-back"
          type="button"
          onClick={onBack}
        >
          Back
        </button>
        <p className="eyebrow">Pick your racket beast</p>
        <h1 data-screen-heading tabIndex="-1">{heading}</h1>
        <p>Spend exactly 20 stat points.</p>
      </header>

      <form
        className="setup-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (ready) onReady()
        }}
      >
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
        <fieldset className="monster-picker">
          <legend>Monster</legend>
          <div className="monster-grid">
            {MONSTERS.map((monster) => {
              const selected = monster.id === draft.monsterId
              return (
                <button
                  className="monster-card"
                  type="button"
                  key={monster.id}
                  aria-pressed={selected}
                  onClick={() => onSelectMonster(monster.id)}
                >
                  <MonsterFigure monsterId={monster.id} />
                  <span>{monster.name}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="stat-builder">
          <legend>Stats</legend>
          {STAT_KEYS.map((stat) => (
            <div className="stat-row" key={stat}>
              <span className="stat-label" id={`${stat}-label`}>{STAT_LABELS[stat]}</span>
              <button
                className="stat-stepper"
                type="button"
                aria-label={`Decrease ${STAT_LABELS[stat]}`}
                onClick={() => onChangeStat(stat, -1)}
              >
                −
              </button>
              <output aria-labelledby={`${stat}-label`}>{draft.build[stat]}</output>
              <meter
                aria-labelledby={`${stat}-label`}
                min="1"
                max="9"
                value={draft.build[stat]}
              />
              <button
                className="stat-stepper"
                type="button"
                aria-label={`Increase ${STAT_LABELS[stat]}`}
                onClick={() => onChangeStat(stat, 1)}
              >
                +
              </button>
            </div>
          ))}
          <p className={buildValidation.valid ? 'budget budget--ready' : 'budget'} aria-live="polite">
            {buildValidation.valid
              ? '20 / 20 · Ready'
              : `${Math.abs(buildValidation.remaining)} point${Math.abs(buildValidation.remaining) === 1 ? '' : 's'} ${
                buildValidation.remaining > 0 ? 'left' : 'over'
              }`}
          </p>
        </fieldset>

        <div className="setup-actions">
          <button className="button button--quiet" type="button" onClick={onReset}>
            Reset
          </button>
          <button className="button button--primary" type="submit" disabled={!ready}>
            Ready
          </button>
        </div>
      </form>
    </main>
  )
}
