/*
 * Capybara Jump - obstacle component.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

export default function Obstacle({ x, gapTop, gapSize, topType = 'snake', bottomType = 'fence' }) {
  const fenceTop = gapTop + gapSize
  const showSnake = topType === 'snake'
  const showFence = bottomType === 'fence'

  return (
    <div className="obstacle" style={{ left: x }}>
      {showSnake && (
        <div className="obstacle-top obstacle-top-snake" style={{ height: gapTop }}>
          <div className="snake-head" style={{ top: gapTop - 42 }}>
            <span className="snake-eye snake-eye-left" />
            <span className="snake-eye snake-eye-right" />
            <span className="snake-nostril snake-nostril-left" />
            <span className="snake-nostril snake-nostril-right" />
            <span className="snake-tongue" />
          </div>
        </div>
      )}

      {showFence && (
        <div className="obstacle-bottom obstacle-bottom-fence" style={{ top: fenceTop }}>
          <>
            <span className="fence-cap" />
            <span className="fence-knot fence-knot-top" />
            <span className="fence-knot fence-knot-bottom" />
          </>
        </div>
      )}
    </div>
  )
}
