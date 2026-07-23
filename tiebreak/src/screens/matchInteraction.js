export const ONBOARDING_HINT = 'Move into the ball to swing · Hold a direction to aim'

export const HELP_INSTRUCTIONS = [
  'Move into the ball. Your monster chooses forehand or backhand and swings for you.',
  'Player 1 uses W A S D. Player 2 uses the arrow keys.',
  'Touch players drag on their half of the court.',
]

export function handleMatchEscape(event, paused, { focusPause, pause, resume }) {
  if (event.key !== 'Escape' || event.repeat) return
  event.preventDefault()
  event.stopPropagation()
  if (paused) {
    resume()
    return
  }
  focusPause()
  pause()
}

export function advanceLiveFrame(paused, advance) {
  if (!paused) advance()
}
