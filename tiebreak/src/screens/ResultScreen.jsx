import { MONSTERS } from '../game/roster.js'
import MonsterFigure from './MonsterFigure.jsx'

function monsterName(monsterId) {
  return MONSTERS.find((monster) => monster.id === monsterId)?.name ?? monsterId
}

export default function ResultScreen({ match, onRematch, onHome }) {
  const winnerIndex = match.scores[0] > match.scores[1] ? 0 : 1
  const loserIndex = 1 - winnerIndex
  const winner = match.players[winnerIndex]
  const loser = match.players[loserIndex]

  return (
    <main className="screen result-screen">
      <header className="result-heading">
        <p className="eyebrow">Match point</p>
        <h1>{winner.name} wins!</h1>
        <p className="final-score" aria-label={`Final score ${match.scores[0]} to ${match.scores[1]}`}>
          <strong>{match.scores[0]}</strong>
          <span>–</span>
          <strong>{match.scores[1]}</strong>
        </p>
      </header>

      <section className="result-podium" aria-label="Match result">
        <figure className="result-monster result-monster--winner">
          <MonsterFigure
            monsterId={winner.monsterId}
            pose="win"
            label={`${monsterName(winner.monsterId)} celebrating with a racket`}
          />
          <figcaption>{winner.name} · {monsterName(winner.monsterId)}</figcaption>
        </figure>
        <figure className="result-monster result-monster--loser">
          <MonsterFigure
            monsterId={loser.monsterId}
            pose="lose"
            label={`${monsterName(loser.monsterId)} holding a racket after the match`}
          />
          <figcaption>{loser.name} · {monsterName(loser.monsterId)}</figcaption>
        </figure>
      </section>

      <div className="result-actions">
        <button className="button button--primary" type="button" onClick={onRematch}>
          Rematch
        </button>
        <button className="button button--quiet" type="button" onClick={onHome}>
          Home
        </button>
      </div>
    </main>
  )
}
