/*
 * Capybara Jump - stars death burst.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

const STAR_COLORS = [
  '#FFD700',
  '#FF6B6B',
  '#4ECDC4',
  '#FF8C42',
  '#C7F464',
  '#FF69B4',
  '#00CED1',
  '#FF4500',
]

const STAR_CONFIGS = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2
  const dist = 40 + Math.random() * 20

  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist),
    color: STAR_COLORS[index],
    delay: index * 30,
  }
})

export default function Stars({ capyX, capyY }) {
  return (
    <div className="stars" style={{ left: capyX + 21, top: capyY + 13 }}>
      {STAR_CONFIGS.map((star, index) => (
        <div
          key={index}
          className="star"
          style={{
            '--dx': `${star.dx}px`,
            '--dy': `${star.dy}px`,
            '--color': star.color,
            animationDelay: `${star.delay}ms`,
          }}
        />
      ))}
    </div>
  )
}
