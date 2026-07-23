const POINT_REASON = {
  out: 'ball out',
  net: 'into the net',
  'double-bounce': 'double bounce',
}

export function pointResultMessage(snapshot, players) {
  if (snapshot.phase !== 'point-result' || !snapshot.lastPoint) return ''
  const winner = players[snapshot.lastPoint.winner]
  return `${winner.name} wins the point · ${POINT_REASON[snapshot.lastPoint.reason]}`
}
