export const ONBOARDING_HINT = 'Move into the ball to swing · Hold a direction to aim'

export function helpInstructions(players) {
  const keyboardHelp = players[1].kind === 'ai'
    ? `${players[0].name} uses W A S D or the arrow keys.`
    : `${players[0].name} uses W A S D. ${players[1].name} uses the arrow keys.`

  return [
    'Move into the ball. Your monster chooses forehand or backhand and swings for you.',
    keyboardHelp,
    'Touch players drag on their half of the court.',
  ]
}

export function handleMatchEscape(event, paused, { focusPause, pause }) {
  if (event.key !== 'Escape' || event.repeat) return
  event.preventDefault()
  event.stopPropagation()
  if (paused) return
  focusPause()
  pause()
}

export function advanceLiveFrame(paused, advance) {
  if (!paused) advance()
}
