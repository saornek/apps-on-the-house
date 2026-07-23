import {
  COURT_BOTTOM,
  COURT_LEFT,
  COURT_RIGHT,
  COURT_TOP,
  NET_Y,
  WORLD_H,
  WORLD_W,
} from './game/config.js'
import { spritePlan } from './game/roster.js'

const COLORS = {
  surround: '#102F38',
  clay: '#CF6F45',
  clayDark: '#A74E36',
  line: '#FFF3CF',
  ink: '#173A42',
  ball: '#EFFF72',
}

function drawPrimitive(ctx, primitive, x, y, scale, mirror) {
  ctx.fillStyle = primitive.color
  const px = x + primitive.x * scale * mirror
  const py = y + primitive.y * scale
  const width = primitive.w * scale
  const height = primitive.h * scale
  if (primitive.kind === 'outline') {
    ctx.lineWidth = Math.max(1, scale)
    ctx.strokeStyle = primitive.color
    ctx.strokeRect(px, py, width * mirror, height)
  } else {
    ctx.fillRect(px, py, width * mirror, height)
  }
}

function drawMonster(ctx, player, playerIndex, now) {
  const running = player.pose === 'run'
  const pose = running ? (Math.floor(now / 130) % 2 ? 'run-a' : 'run-b') : player.pose
  const mirror = playerIndex === 0 ? 1 : -1
  const scale = 3
  for (const primitive of spritePlan(player.monsterId, pose)) {
    drawPrimitive(ctx, primitive, player.x, player.y, scale, mirror)
  }
}

function drawCourt(ctx) {
  ctx.fillStyle = COLORS.surround
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  ctx.fillStyle = COLORS.clayDark
  ctx.fillRect(
    COURT_LEFT - 7,
    COURT_TOP - 7,
    COURT_RIGHT - COURT_LEFT + 14,
    COURT_BOTTOM - COURT_TOP + 14,
  )
  ctx.fillStyle = COLORS.clay
  ctx.fillRect(COURT_LEFT, COURT_TOP, COURT_RIGHT - COURT_LEFT, COURT_BOTTOM - COURT_TOP)
  ctx.strokeStyle = COLORS.line
  ctx.lineWidth = 3
  ctx.strokeRect(COURT_LEFT, COURT_TOP, COURT_RIGHT - COURT_LEFT, COURT_BOTTOM - COURT_TOP)
  ctx.beginPath()
  ctx.moveTo((COURT_LEFT + COURT_RIGHT) / 2, COURT_TOP)
  ctx.lineTo((COURT_LEFT + COURT_RIGHT) / 2, COURT_BOTTOM)
  ctx.moveTo(COURT_LEFT, COURT_TOP + (NET_Y - COURT_TOP) / 2)
  ctx.lineTo(COURT_RIGHT, COURT_TOP + (NET_Y - COURT_TOP) / 2)
  ctx.moveTo(COURT_LEFT, NET_Y + (COURT_BOTTOM - NET_Y) / 2)
  ctx.lineTo(COURT_RIGHT, NET_Y + (COURT_BOTTOM - NET_Y) / 2)
  ctx.stroke()
  ctx.fillStyle = COLORS.line
  ctx.fillRect(COURT_LEFT - 7, NET_Y - 3, COURT_RIGHT - COURT_LEFT + 14, 6)
  ctx.fillStyle = COLORS.ink
  for (let x = COURT_LEFT - 4; x < COURT_RIGHT + 4; x += 9) {
    ctx.fillRect(x, NET_Y - 2, 4, 4)
  }
}

function drawBall(ctx, ball) {
  if (!ball.live) return
  ctx.fillStyle = 'rgba(23,58,66,.35)'
  ctx.beginPath()
  ctx.ellipse(ball.x, ball.y, 7, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COLORS.ball
  ctx.strokeStyle = COLORS.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(ball.x, ball.y - ball.z * 0.45, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

export function drawFrame(ctx, state, now, reducedMotion = false) {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  drawCourt(ctx)
  state.players.forEach((player, index) => {
    ctx.fillStyle = 'rgba(23,58,66,.3)'
    ctx.beginPath()
    ctx.ellipse(player.x, player.y + 10, 16, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    drawMonster(ctx, player, index, reducedMotion ? 0 : now)
  })
  drawBall(ctx, state.ball)
  ctx.restore()
}
