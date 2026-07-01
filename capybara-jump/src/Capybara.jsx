/*
 * Capybara Jump - capybird sprite component.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 */

import { CAPY_X } from './game.js'

export default function Capybara({ y, dead }) {
  return (
    <div className={`capy${dead ? ' dead' : ''}`} style={{ left: CAPY_X, top: y }}>
      <img className="capy-img" src="capybird-frame-clean.png" alt="Capybara bird" draggable="false" />
    </div>
  )
}
