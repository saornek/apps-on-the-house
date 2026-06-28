/*
 * Snakes & Ladders — a fair, cute dice game vs the computer.
 * Part of Apps On The House. Free, no ads, no tracking.
 * Copyright (C) 2026 Apps On The House
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Fairness: the die is a plain Math.random 1–6 for BOTH the player and the CPU.
 * Difficulty only changes the board (more ladders vs more snakes) — never the dice.
 */

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowLeft } from 'lucide-react'
import { CHARACTERS, CHAR_MAP } from './characters.jsx'

const LADDER_COLOR = '#CBA16A'
const SNAKE_COLOR = '#7FB791'

// How many ladders vs snakes each difficulty places. The dice stay fair —
// difficulty only shifts this ratio. The board itself is randomized every game.
const COUNTS = {
  easy: { ladders: 6, snakes: 2 },
  medium: { ladders: 5, snakes: 5 },
  hard: { ladders: 3, snakes: 7 },
}

const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1))

// Build a fresh random board. Squares 1 and 100 stay clear (start/finish), every
// snake/ladder uses distinct squares, and no jump lands on another jump's start
// (so there are no chains or loops).
function generateBoard(level) {
  const { ladders, snakes } = COUNTS[level] || COUNTS.medium
  const map = {}
  const used = new Set([1, 100])
  const place = (isLadder) => {
    for (let attempt = 0; attempt < 250; attempt++) {
      let from, to
      // Keep spans short (about a row or two) so lines stay tidy, not board-crossing.
      if (isLadder) {
        from = rint(2, 88)
        to = from + rint(9, Math.min(22, 99 - from))
      } else {
        from = rint(14, 99)
        to = from - rint(9, Math.min(22, from - 2))
      }
      if (to < 2 || to > 99 || to === from) continue
      if (used.has(from) || used.has(to)) continue
      map[from] = to
      used.add(from)
      used.add(to)
      return
    }
  }
  for (let i = 0; i < ladders; i++) place(true)
  for (let i = 0; i < snakes; i++) place(false)
  return map
}

const LEVELS = [
  { id: 'easy', label: 'Easy', blurb: 'Lots of ladders 🪜' },
  { id: 'medium', label: 'Medium', blurb: 'The classic mix' },
  { id: 'hard', label: 'Hard', blurb: 'A snake pit 🐍' },
]

const PLAYERS = { you: 'You', cpu: 'Computer' }

function cellCenter(n) {
  const r = Math.floor((n - 1) / 10)
  const i = (n - 1) % 10
  const col = r % 2 === 0 ? i : 9 - i
  const rowFromTop = 9 - r
  return { x: (col + 0.5) * 10, y: (rowFromTop + 0.5) * 10 }
}

function buildCells() {
  const cells = []
  for (let rowFromTop = 0; rowFromTop < 10; rowFromTop++) {
    const r = 9 - rowFromTop
    const leftToRight = r % 2 === 0
    for (let colDom = 0; colDom < 10; colDom++) {
      cells.push(r * 10 + (leftToRight ? colDom + 1 : 10 - colDom))
    }
  }
  return cells
}
const CELLS = buildCells()

const rollDie = () => 1 + Math.floor(Math.random() * 6)

// ---- token / character badge ----
function Token({ charId, player, className = '' }) {
  const C = CHAR_MAP[charId]?.Svg
  return (
    <span className={`tok tok--${player} ${className}`}>{C && <C className="tok-svg" />}</span>
  )
}

function Die({ value, rolling }) {
  const pips = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  }[value || 1]
  return (
    <div className={'die' + (rolling ? ' rolling' : '')} aria-label={value ? `Die showing ${value}` : 'Die'}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'pip on' : 'pip'} />
      ))}
    </div>
  )
}

// ---- snake & ladder drawings ----
function Snake({ a, b }) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len, py = dx / len
  const waves = Math.max(2, Math.round(len / 15))
  const amp = 2.2
  const N = 44
  let d = ''
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const off = Math.sin(t * waves * Math.PI * 2) * amp * Math.sin(Math.PI * t)
    const x = a.x + dx * t + px * off
    const y = a.y + dy * t + py * off
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2)
  }
  // head sits at the higher number (a)
  return (
    <g>
      <path d={d} fill="none" stroke={SNAKE_COLOR} strokeWidth="1.9" strokeLinecap="round" opacity="0.95" />
      <circle cx={a.x} cy={a.y} r="2.4" fill={SNAKE_COLOR} />
      <circle cx={a.x - 0.9} cy={a.y - 0.5} r="0.6" fill="#fff" />
      <circle cx={a.x + 0.9} cy={a.y - 0.5} r="0.6" fill="#fff" />
    </g>
  )
}

function Ladder({ a, b }) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = (-dy / len) * 1.7
  const py = (dx / len) * 1.7
  const a1 = { x: a.x + px, y: a.y + py }, a2 = { x: a.x - px, y: a.y - py }
  const b1 = { x: b.x + px, y: b.y + py }, b2 = { x: b.x - px, y: b.y - py }
  const rungs = Math.max(3, Math.round(len / 8))
  const rungEls = []
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs
    rungEls.push(
      <line key={i} x1={a1.x + (b1.x - a1.x) * t} y1={a1.y + (b1.y - a1.y) * t}
        x2={a2.x + (b2.x - a2.x) * t} y2={a2.y + (b2.y - a2.y) * t} strokeWidth="1" />,
    )
  }
  return (
    <g stroke={LADDER_COLOR} strokeLinecap="round">
      <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} strokeWidth="1.5" />
      <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} strokeWidth="1.5" />
      {rungEls}
    </g>
  )
}

export default function App() {
  const [screen, setScreen] = useState('setup')
  const [level, setLevel] = useState('medium')
  const [youChar, setYouChar] = useState('coffee')
  const [cpuChar, setCpuChar] = useState('cat')
  const [board, setBoard] = useState(() => generateBoard('medium'))
  const [pos, setPos] = useState({ you: 0, cpu: 0 })
  const [turn, setTurn] = useState('you')
  const [die, setDie] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [winner, setWinner] = useState(null)
  const [message, setMessage] = useState('Your turn — tap Roll.')

  const boardRef = useRef(board); boardRef.current = board
  const posRef = useRef(pos); posRef.current = pos
  const busyRef = useRef(busy); busyRef.current = busy
  const winnerRef = useRef(winner); winnerRef.current = winner
  const timers = useRef([])
  const rollTimer = useRef(null)
  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    clearInterval(rollTimer.current)
  }, [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  function startGame() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPos({ you: 0, cpu: 0 })
    setTurn('you')
    clearInterval(rollTimer.current)
    const fresh = generateBoard(level)
    boardRef.current = fresh
    setBoard(fresh)
    setDie(null)
    setRolling(false)
    setBusy(false)
    setWinner(null)
    setMessage('Your turn — tap Roll.')
    setScreen('play')
  }

  function setPlayerPos(player, p) {
    posRef.current = { ...posRef.current, [player]: p }
    setPos(posRef.current)
  }

  function takeTurn(player) {
    if (busyRef.current || winnerRef.current) return
    setBusy(true); busyRef.current = true
    setRolling(true)
    const iv = setInterval(() => setDie(rollDie()), 70)
    rollTimer.current = iv
    later(() => {
      clearInterval(iv)
      const roll = rollDie()
      setDie(roll)
      setRolling(false)
      applyRoll(player, roll)
    }, 520)
  }

  function applyRoll(player, roll) {
    const who = PLAYERS[player]
    const start = posRef.current[player]
    let dest = start + roll
    if (dest > 100) {
      setMessage(`${who} rolled ${roll} — need exactly ${100 - start} to finish.`)
      endTurn(player)
      return
    }
    setMessage(`${who} rolled ${roll}.`)
    setPlayerPos(player, dest)
    later(() => {
      const jump = boardRef.current[dest]
      if (jump) {
        const climbed = jump > dest
        setMessage(`${who} ${climbed ? 'climbed a ladder 🪜' : 'slid down a snake 🐍'} to ${jump}.`)
        setPlayerPos(player, jump)
        dest = jump
      }
      later(() => {
        if (dest === 100) {
          setWinner(player); winnerRef.current = player
          setMessage(`${who} reached 100!`)
          setBusy(false); busyRef.current = false
          return
        }
        endTurn(player)
      }, jump ? 500 : 250)
    }, 350)
  }

  function endTurn(player) {
    const next = player === 'you' ? 'cpu' : 'you'
    setTurn(next); setBusy(false); busyRef.current = false
    if (next === 'you') setMessage('Your turn — tap Roll.')
    else {
      setMessage('Computer is rolling…')
      later(() => takeTurn('cpu'), 750)
    }
  }

  // ---- Setup screen ----
  if (screen === 'setup') {
    return (
      <div className="game">
        <header className="game-head">
          <div className="brand">
            <span className="brand-name">Snakes &amp; Ladders</span>
            <span className="brand-by">Apps On The House</span>
          </div>
        </header>

        <div className="setup">
          <Picker title="You play as" value={youChar} player="you" onPick={setYouChar} />
          <Picker title="Computer plays as" value={cpuChar} player="cpu" onPick={setCpuChar} />

          <div className="setup-block">
            <span className="setup-title">Difficulty</span>
            <div className="levels">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  className={'level-card' + (level === l.id ? ' active' : '')}
                  onClick={() => setLevel(l.id)}
                >
                  <span className="level-label">{l.label}</span>
                  <span className="level-blurb">{l.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="fair-note">🎲 Fair dice for everyone — only the board changes.</p>
          <button className="btn btn-primary start-btn" onClick={startGame}>
            Start game
          </button>
        </div>
      </div>
    )
  }

  // ---- Game ----
  return (
    <div className="game">
      <header className="game-head">
        <div className="vs">
          <span className={'vs-side' + (turn === 'you' ? ' on' : '')}>
            <Token charId={youChar} player="you" className="chip" />
            You
          </span>
          <span className="vs-x">vs</span>
          <span className={'vs-side' + (turn === 'cpu' ? ' on' : '')}>
            <Token charId={cpuChar} player="cpu" className="chip" />
            Computer
          </span>
        </div>
        <button className="restart" onClick={() => setScreen('setup')} aria-label="New game">
          <RotateCcw size={18} />
        </button>
      </header>

      <div className="board-wrap">
        <div className="board">
          {CELLS.map((n, idx) => {
            const to = board[n]
            const kind = to ? (to > n ? 'ladder' : 'snake') : null
            const dark = (Math.floor(idx / 10) + (idx % 10)) % 2 === 0
            return (
              <div key={n} className={'sq' + (dark ? ' sq--alt' : '') + (kind ? ' sq--' + kind : '')}>
                <span className="sq-num">{n}</span>
                <span className="tokens">
                  {pos.you === n && <Token charId={youChar} player="you" />}
                  {pos.cpu === n && <Token charId={cpuChar} player="cpu" />}
                </span>
              </div>
            )
          })}
          <svg className="overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {Object.entries(board).map(([from, to]) => {
              const a = cellCenter(Number(from))
              const b = cellCenter(Number(to))
              return to > Number(from) ? (
                <Ladder key={from} a={a} b={b} />
              ) : (
                <Snake key={from} a={a} b={b} />
              )
            })}
          </svg>
        </div>
      </div>

      <div className="controls">
        <div className="start-row">
          {pos.you === 0 && <Token charId={youChar} player="you" />}
          {pos.cpu === 0 && <Token charId={cpuChar} player="cpu" />}
          {(pos.you === 0 || pos.cpu === 0) && <span className="start-label">waiting at start</span>}
        </div>
        <p className="status">{message}</p>
        <div className="roll-row">
          <Die value={die} rolling={rolling} />
          <button
            className="btn btn-primary roll-btn"
            onClick={() => takeTurn('you')}
            disabled={busy || winner || turn !== 'you'}
          >
            Roll
          </button>
        </div>
      </div>

      {winner && (
        <div className="overlay-modal">
          <div className="overlay-card">
            <Token charId={winner === 'you' ? youChar : cpuChar} player={winner} className="big" />
            <h2>{winner === 'you' ? 'You win! 🎉' : 'Computer wins'}</h2>
            <p>{winner === 'you' ? 'Nice rolling.' : 'So close — go again?'}</p>
            <div className="overlay-actions">
              <button className="btn btn-primary" onClick={startGame}>Play again</button>
              <button className="btn btn-outline" onClick={() => setScreen('setup')}>
                <ArrowLeft size={15} /> Change setup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Picker({ title, value, player, onPick }) {
  return (
    <div className="setup-block">
      <span className="setup-title">{title}</span>
      <div className="char-row">
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            className={'char-pick' + (value === c.id ? ' active' : '')}
            onClick={() => onPick(c.id)}
            aria-label={c.label}
            title={c.label}
          >
            <Token charId={c.id} player={player} />
          </button>
        ))}
      </div>
    </div>
  )
}
