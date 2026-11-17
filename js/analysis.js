// Analysis bar, best line, captured pieces, and game review.
import { Chess } from '../vendor/chessjs/chess.js'

const SPRITE = 'vendor/cm-chessboard/assets/pieces/standard.svg'
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 }
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 }

// ---------- captured pieces ----------
export function capturedFromFen(fen) {
  const placement = fen.split(' ')[0]
  const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } }
  for (const ch of placement) {
    const t = ch.toLowerCase()
    if (!(t in START_COUNT)) continue
    have[ch === t ? 'b' : 'w'][t]++
  }
  // pieces taken BY each side = the other side's missing pieces
  const taken = { w: [], b: [] }
  let material = 0 // positive = White ahead
  for (const t of ['q', 'r', 'b', 'n', 'p']) {
    for (let i = 0; i < Math.max(0, START_COUNT[t] - have.b[t]); i++) taken.w.push('b' + t)
    for (let i = 0; i < Math.max(0, START_COUNT[t] - have.w[t]); i++) taken.b.push('w' + t)
    material += (have.w[t] - have.b[t]) * VALUE[t]
  }
  return { taken, material }
}

export function renderCaptures(el, pieces, plus) {
  el.innerHTML = ''
  for (const p of pieces) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    s.setAttribute('viewBox', '0 0 40 40')
    s.setAttribute('class', 'cap-piece')
    s.innerHTML = `<use href="${SPRITE}#${p}"/>`
    el.append(s)
  }
  if (plus > 0) {
    const n = document.createElement('span')
    n.className = 'cap-plus'
    n.textContent = `+${plus}`
    el.append(n)
  }
  el.setAttribute('aria-label', pieces.length ? `Captured: ${pieces.length} pieces${plus > 0 ? `, ahead by ${plus}` : ''}` : 'No captures')
}

// ---------- evaluation helpers ----------
// Convert an engine score (from the side to move) to White's point of view.
export function whiteScore(score, fen) {
  if (!score) return null
  const sign = fen.split(' ')[1] === 'w' ? 1 : -1
  if (score.mate !== undefined) return { mate: score.mate * sign }
  return { cp: score.cp * sign }
}

export function scoreText(ws) {
  if (!ws) return ''
  if (ws.mate !== undefined) return ws.mate === 0 ? '#' : (ws.mate > 0 ? `M${ws.mate}` : `-M${-ws.mate}`)
  const v = ws.cp / 100
  return (v > 0 ? '+' : '') + v.toFixed(1)
}

// Share of the bar that is White, 0 to 100.
export function whitePercent(ws) {
  if (!ws) return 50
  if (ws.mate !== undefined) return ws.mate > 0 ? 100 : ws.mate < 0 ? 0 : 50
  const p = 2 / (1 + Math.exp(-0.004 * ws.cp)) - 1
  return Math.max(3, Math.min(97, 50 + 50 * p))
}

export function pvToSan(fen, pv, max = 8) {
  const c = new Chess(fen)
  const out = []
  for (const u of pv.slice(0, max)) {
    const before = c.fen().split(' ')
    const r = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
    if (!r) break
    const full = before[5]
    if (before[1] === 'w') out.push(`${full}. ${r.san}`)
    else out.push(out.length ? r.san : `${full}... ${r.san}`)
  }
  return out.join(' ')
}

// Winning chances for White, 0 to 100 (the same curve Lichess uses for move judgments).
export function winChance(ws) {
  if (!ws) return 50
  if (ws.mate !== undefined) return ws.mate > 0 ? 100 : ws.mate < 0 ? 0 : 50
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * ws.cp)) - 1)
}

export function terminalScore(fen) {
  const c = new Chess(fen)
  if (c.in_checkmate()) return { mate: 0, winner: c.turn() === 'w' ? 'b' : 'w' }
  if (c.game_over()) return { cp: 0, draw: true }
  return null
}

// Judge a move by how many points of winning chances it gave away.
export function judgment(drop) {
  if (drop >= 30) return { sym: '??', cls: 'blunder', word: 'blunder' }
  if (drop >= 20) return { sym: '?', cls: 'mistake', word: 'mistake' }
  if (drop >= 10) return { sym: '?!', cls: 'inaccuracy', word: 'inaccuracy' }
  return null
}
