/*
 * Solitaire - a single playing card (face or back).
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { isRed, rankLabel, suitSymbol } from './game.js'

export default function Card({ card, selected, shaking, onClick, style }) {
  if (!card) {
    return <div className="card-slot" style={style} />
  }

  if (!card.faceUp) {
    return (
      <div
        className="pcard pcard-back"
        style={style}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      />
    )
  }

  const colorClass = isRed(card.suit) ? 'pcard-red' : 'pcard-black'
  const classes = ['pcard', 'pcard-face', colorClass]
  if (selected) classes.push('pcard-selected')
  if (shaking) classes.push('pcard-shake')

  return (
    <div
      className={classes.join(' ')}
      style={style}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${rankLabel(card.rank)} of ${card.suit}`}
    >
      <span className="pcard-corner pcard-corner-top">
        {rankLabel(card.rank)}
        {suitSymbol(card.suit)}
      </span>
      <span className="pcard-pip">{suitSymbol(card.suit)}</span>
      <span className="pcard-corner pcard-corner-bottom">
        {rankLabel(card.rank)}
        {suitSymbol(card.suit)}
      </span>
    </div>
  )
}
