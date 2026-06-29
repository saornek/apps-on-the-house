/* Shape Crash — the cute geometric blocks, as flat SVG.
   6 base shapes (circle, square, triangle, diamond, pentagon, hexagon), each its
   own flat color and silhouette. 3 specials: star (striped), heart (wrapped),
   rainbow disc (color bomb). */

export const SHAPE_COLORS = ['#F47FA0', '#6FC0E8', '#93D36A', '#F7C948', '#B292E6', '#F59B54']
export const SHAPE_NAMES = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon']

const STAR = '50,10 61,35 88,38 67,56 74,82 50,68 26,82 33,56 12,38 39,35'
const HEART =
  'M50,80 C12,53 18,26 40,29 C47,30 50,34 50,38 C50,34 53,30 60,29 C82,26 88,53 50,80 Z'

function bombWedges() {
  const cx = 50
  const cy = 50
  const r = 35
  const out = []
  for (let i = 0; i < 6; i++) {
    const a0 = ((-90 + i * 60) * Math.PI) / 180
    const a1 = ((-90 + (i + 1) * 60) * Math.PI) / 180
    const x0 = (cx + r * Math.cos(a0)).toFixed(1)
    const y0 = (cy + r * Math.sin(a0)).toFixed(1)
    const x1 = (cx + r * Math.cos(a1)).toFixed(1)
    const y1 = (cy + r * Math.sin(a1)).toFixed(1)
    out.push({ d: `M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`, fill: SHAPE_COLORS[i] })
  }
  return out
}
const BOMB_WEDGES = bombWedges()

// Soft white highlight that reads as a glossy "cute" sheen.
function Highlight() {
  return <ellipse cx="40" cy="34" rx="12" ry="8" fill="#ffffff" opacity="0.38" />
}

function BaseShape({ color }) {
  const fill = SHAPE_COLORS[color]
  const common = { fill, stroke: 'rgba(0,0,0,0.06)', strokeWidth: 2, strokeLinejoin: 'round' }
  switch (color) {
    case 0:
      return <circle cx="50" cy="50" r="35" {...common} />
    case 1:
      return <rect x="16" y="16" width="68" height="68" rx="16" {...common} />
    case 2:
      return <polygon points="50,16 85,82 15,82" {...common} />
    case 3:
      return <polygon points="50,13 87,50 50,87 13,50" {...common} />
    case 4:
      return <polygon points="50,12 86,38 72,81 28,81 14,38" {...common} />
    default:
      return <polygon points="88,50 69,83 31,83 12,50 31,17 69,17" {...common} />
  }
}

export default function Shape({ tile, size = 56 }) {
  if (!tile) return null
  const { color, special } = tile
  return (
    <svg
      className={`shape ${special ? 'shape-special shape-' + special : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {special === 'bomb' ? (
        <g>
          {BOMB_WEDGES.map((w, i) => (
            <path key={i} d={w.d} fill={w.fill} />
          ))}
          <circle cx="50" cy="50" r="35" fill="none" stroke="#ffffff" strokeWidth="4" />
          <circle cx="40" cy="38" r="7" fill="#ffffff" opacity="0.7" />
        </g>
      ) : special === 'striped' ? (
        <g>
          <polygon
            points={STAR}
            fill={SHAPE_COLORS[color]}
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="48" r="6" fill="#ffffff" opacity="0.55" />
        </g>
      ) : special === 'wrapped' ? (
        <g>
          <path
            d={HEART}
            fill={SHAPE_COLORS[color]}
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <ellipse cx="40" cy="40" rx="8" ry="5" fill="#ffffff" opacity="0.45" />
        </g>
      ) : (
        <g>
          <BaseShape color={color} />
          <Highlight />
        </g>
      )}
    </svg>
  )
}
