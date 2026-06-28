/*
 * Cute characters for tokens. Each is a white silhouette (fill: currentColor)
 * with dark facial features, meant to sit inside a colored circular badge.
 */
const EYE = '#2b2521'

function Coffee(props) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect fill="currentColor" x="16" y="9" width="3" height="7" rx="1.5" />
      <rect fill="currentColor" x="23" y="8" width="3" height="8" rx="1.5" />
      <rect fill="currentColor" x="30" y="9" width="3" height="7" rx="1.5" />
      <path fill="currentColor" d="M11 21h23v6a11.5 11.5 0 0 1-11.5 11.5A11.5 11.5 0 0 1 11 27z" />
      <path fill="none" stroke="currentColor" strokeWidth="3.2" d="M34 23a6.5 6.5 0 0 1 0 11" />
      <circle fill={EYE} cx="19.5" cy="28" r="1.9" />
      <circle fill={EYE} cx="26.5" cy="28" r="1.9" />
      <path fill="none" stroke={EYE} strokeWidth="1.5" strokeLinecap="round" d="M20 32q3 3 6 0" />
    </svg>
  )
}

function Cat(props) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path fill="currentColor" d="M11 9 21 21 7 22z" />
      <path fill="currentColor" d="M37 9 27 21 41 22z" />
      <circle fill="currentColor" cx="24" cy="28" r="15" />
      <circle fill={EYE} cx="19" cy="27" r="2.1" />
      <circle fill={EYE} cx="29" cy="27" r="2.1" />
      <path fill={EYE} d="M22.5 31.5h3L24 33.5z" />
    </svg>
  )
}

function Dog(props) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect fill="currentColor" x="7" y="13" width="10" height="20" rx="5" />
      <rect fill="currentColor" x="31" y="13" width="10" height="20" rx="5" />
      <circle fill="currentColor" cx="24" cy="28" r="14" />
      <circle fill={EYE} cx="19" cy="27" r="2" />
      <circle fill={EYE} cx="29" cy="27" r="2" />
      <ellipse fill={EYE} cx="24" cy="32" rx="2.4" ry="1.8" />
    </svg>
  )
}

function Bunny(props) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect fill="currentColor" x="17.5" y="3" width="5.5" height="21" rx="2.75" />
      <rect fill="currentColor" x="25" y="3" width="5.5" height="21" rx="2.75" />
      <circle fill="currentColor" cx="24" cy="31" r="13" />
      <circle fill={EYE} cx="19.5" cy="30" r="2" />
      <circle fill={EYE} cx="28.5" cy="30" r="2" />
      <path fill={EYE} d="M22.5 34h3L24 35.8z" />
    </svg>
  )
}

function Fox(props) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path fill="currentColor" d="M9 11 22 20 7 23z" />
      <path fill="currentColor" d="M39 11 26 20 41 23z" />
      <path fill="currentColor" d="M10 21q14-5 28 0L24 43z" />
      <circle fill={EYE} cx="19" cy="26" r="2" />
      <circle fill={EYE} cx="29" cy="26" r="2" />
      <circle fill={EYE} cx="24" cy="34" r="2.2" />
    </svg>
  )
}

function Frog(props) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <ellipse fill="currentColor" cx="24" cy="28" rx="17" ry="13" />
      <circle fill="currentColor" cx="15" cy="14" r="8" />
      <circle fill="currentColor" cx="33" cy="14" r="8" />
      <circle fill={EYE} cx="15" cy="13" r="2.6" />
      <circle fill={EYE} cx="33" cy="13" r="2.6" />
      <path fill="none" stroke={EYE} strokeWidth="1.7" strokeLinecap="round" d="M17 31q7 5 14 0" />
    </svg>
  )
}

export const CHARACTERS = [
  { id: 'coffee', label: 'Coffee', Svg: Coffee },
  { id: 'cat', label: 'Cat', Svg: Cat },
  { id: 'dog', label: 'Dog', Svg: Dog },
  { id: 'bunny', label: 'Bunny', Svg: Bunny },
  { id: 'fox', label: 'Fox', Svg: Fox },
  { id: 'frog', label: 'Frog', Svg: Frog },
]

export const CHAR_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]))
