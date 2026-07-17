/*
 * Solitaire - renders one pile: stock, waste, foundation, or tableau layout.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import Card from './Card.jsx'

export default function Pile({
  cards,
  layout, // 'single' | 'stack'
  emptyGlyph,
  isSelected, // (index) => bool
  isShaking,
  onCardClick, // (index) => void
  onEmptyClick,
  className = '',
}) {
  if (cards.length === 0) {
    return (
      <div
        className={`pile pile-empty ${className}`}
        onClick={onEmptyClick}
        role={onEmptyClick ? 'button' : undefined}
        tabIndex={onEmptyClick ? 0 : undefined}
      >
        {emptyGlyph && <span className="pile-empty-glyph">{emptyGlyph}</span>}
      </div>
    )
  }

  if (layout === 'single') {
    const topIndex = cards.length - 1
    return (
      <div className={`pile pile-single ${className}`}>
        <Card
          card={cards[topIndex]}
          selected={isSelected?.(topIndex)}
          shaking={isShaking}
          onClick={() => onCardClick(topIndex)}
        />
      </div>
    )
  }

  return (
    <div className={`pile pile-stack ${className}`}>
      {cards.map((card, i) => (
        <Card
          key={`${card.suit}${card.rank}`}
          card={card}
          selected={isSelected?.(i)}
          shaking={isShaking && i === cards.length - 1}
          onClick={() => onCardClick(i)}
          style={{ top: `calc(${i} * var(--stack-offset, 24px))`, zIndex: i }}
        />
      ))}
    </div>
  )
}
