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
  selectedMonster,
  draftBuild,
  onSelectMonster,
  onChangeStat,
  onReset,
  onReady,
}) {
  const validation = validateBuild(draftBuild)
  const heading = mode === 'single' ? 'Build your monster' : `Player ${setupIndex + 1}`
  const topTouchSetup = mode === 'local' && setupIndex === 1

  return (
    <main className={topTouchSetup ? 'screen setup-screen setup-screen--top-touch' : 'screen setup-screen'}>
      <header className="screen-heading">
        <p className="eyebrow">Pick your racket beast</p>
        <h1 data-screen-heading tabIndex="-1">{heading}</h1>
        <p>Spend exactly 20 stat points.</p>
      </header>

      <form
        className="setup-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (validation.valid) onReady()
        }}
      >
        <fieldset className="monster-picker">
          <legend>Monster</legend>
          <div className="monster-grid">
            {MONSTERS.map((monster) => {
              const selected = monster.id === selectedMonster
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
              <output aria-labelledby={`${stat}-label`}>{draftBuild[stat]}</output>
              <meter
                aria-labelledby={`${stat}-label`}
                min="1"
                max="9"
                value={draftBuild[stat]}
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
          <p className={validation.valid ? 'budget budget--ready' : 'budget'} aria-live="polite">
            {validation.valid
              ? '20 / 20 · Ready'
              : `${Math.abs(validation.remaining)} point${Math.abs(validation.remaining) === 1 ? '' : 's'} ${
                validation.remaining > 0 ? 'left' : 'over'
              }`}
          </p>
        </fieldset>

        <div className="setup-actions">
          <button className="button button--quiet" type="button" onClick={onReset}>
            Reset
          </button>
          <button className="button button--primary" type="submit" disabled={!validation.valid}>
            Ready
          </button>
        </div>
      </form>
    </main>
  )
}
