import React from 'react'
import { spritePlan } from '../game/roster.js'

export default function MonsterFigure({ monsterId, pose = 'idle', label, className = '' }) {
  return (
    <svg
      className={`monster-figure monster-figure--${pose} ${className}`.trim()}
      viewBox="-22 -32 44 44"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      shapeRendering="crispEdges"
    >
      {spritePlan(monsterId, pose).map((primitive, index) => (
        <rect
          key={`${primitive.part}-${index}`}
          x={primitive.x}
          y={primitive.y}
          width={primitive.w}
          height={primitive.h}
          fill={primitive.kind === 'outline' ? 'none' : primitive.color}
          stroke={primitive.kind === 'outline' ? primitive.color : 'none'}
          strokeWidth={primitive.kind === 'outline' ? 1.5 : 0}
        />
      ))}
    </svg>
  )
}
