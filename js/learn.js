// Learn to Play: how each piece moves and captures, check, checkmate, stalemate, and the special rules.
import { COLOR, INPUT_EVENT_TYPE } from '../vendor/cm-chessboard/src/Chessboard.js'
import { PROMOTION_DIALOG_RESULT_TYPE } from '../vendor/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js'
import { Chess, SQUARES } from '../vendor/chessjs/chess.js'
import { MK_LAST, MK_CHECK, MK_WRONG, MK_HINT, AR_HINT } from './marks.js'
import { PIECE_SPRITE } from './offline.js'

const MK_STAR = { class: 'mk-star', slice: 'markerStar' }
const MK_DOT = { class: 'mk-dot', slice: 'markerDot' }
const MK_TARGET = { class: 'mk-target', slice: 'markerCircle' }

// ---------------------------------------------------------------------------
// Lessons. Piece lessons ("piece" steps) have no kings and the black pieces never move.
// Rule lessons ("rules" steps) are real positions checked with chess.js; White moves once.
// ---------------------------------------------------------------------------
export const LESSONS = [
  {
    id: 'welcome', group: 'Start Here', title: 'The Chessboard', icon: 'wp',
    steps: [
      { kind: 'info', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        text: 'Chess is played on a board of 64 squares, 8 across and 8 up. Each player starts with 16 pieces: 8 pawns, 2 rooks, 2 knights, 2 bishops, a queen, and a king. White always moves first, then players take turns, one move at a time.' },
      { kind: 'info', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        text: 'Setting up: the bottom-right square is always a light square. The queen starts on the square of her own color (the white queen on a light square), and the kings face each other. The rows of the board are numbered 1 to 8 and the columns are lettered a to h, so every square has a name, like e4.' },
      { kind: 'info', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        text: 'The goal of the game is checkmate: trapping the other player’s king so it can’t escape. First, learn how each piece moves. Click Next to meet the rook.' }
    ]
  },
  {
    id: 'rook', group: 'The Pieces', title: 'The Rook', icon: 'wr',
    steps: [
      { kind: 'piece', fen: '8/8/8/8/3R4/8/8/8', goal: { type: 'moves', n: 3 }, dots: true,
        text: 'The rook moves in straight lines: up, down, left, or right, as far as it wants. The dots show every square it can reach. Make 3 moves with the rook.' },
      { kind: 'piece', fen: '8/8/8/8/8/8/8/R7', goal: { type: 'stars', stars: ['a5', 'f5', 'f2'] },
        text: 'Collect all the stars by moving the rook onto them. Try to do it in as few moves as you can.' },
      { kind: 'piece', fen: '8/n6b/8/8/8/8/8/3R4', goal: { type: 'capture' },
        text: 'Pieces capture by moving onto an enemy piece’s square and taking its place. Capture both black pieces with the rook.' },
      { kind: 'piece', fen: 'r7/8/8/8/P7/8/8/R7', goal: { type: 'capture' }, movable: ['r'],
        text: 'Rooks can’t jump over pieces. Your own pawn is in the way, so find another route and capture the black rook.' }
    ]
  },
  {
    id: 'bishop', group: 'The Pieces', title: 'The Bishop', icon: 'wb',
    steps: [
      { kind: 'piece', fen: '8/8/8/8/3B4/8/8/8', goal: { type: 'moves', n: 3 }, dots: true,
        text: 'The bishop moves diagonally, as far as it wants. Make 3 moves with the bishop.' },
      { kind: 'piece', fen: '8/8/8/8/8/8/8/2B5', goal: { type: 'stars', stars: ['f4', 'h6', 'e3'] },
        text: 'Collect the stars. Notice the bishop always stays on squares of the same color.' },
      { kind: 'piece', fen: '3n4/8/8/6p1/8/8/8/2B5', goal: { type: 'capture' },
        text: 'Capture both black pieces with the bishop.' }
    ]
  },
  {
    id: 'queen', group: 'The Pieces', title: 'The Queen', icon: 'wq',
    steps: [
      { kind: 'piece', fen: '8/8/8/8/3Q4/8/8/8', goal: { type: 'moves', n: 3 }, dots: true,
        text: 'The queen is the most powerful piece. She moves like a rook and a bishop together: straight or diagonally, as far as she wants. Make 3 moves.' },
      { kind: 'piece', fen: '8/8/8/8/8/8/8/3Q4', goal: { type: 'stars', stars: ['d7', 'a4', 'h4'] },
        text: 'Collect the stars with the queen.' },
      { kind: 'piece', fen: 'b7/8/8/n6p/8/8/8/3Q4', goal: { type: 'capture' },
        text: 'Capture all three black pieces with the queen.' }
    ]
  },
  {
    id: 'king', group: 'The Pieces', title: 'The King', icon: 'wk',
    steps: [
      { kind: 'piece', fen: '8/8/8/8/4K3/8/8/8', goal: { type: 'moves', n: 3 }, dots: true,
        text: 'The king is the most important piece, but it moves slowly: just one square in any direction. Make 3 moves with the king.' },
      { kind: 'piece', fen: '8/8/8/8/8/8/8/4K3', goal: { type: 'stars', stars: ['e3', 'g4', 'f6'] },
        text: 'Collect the stars with the king, one step at a time.' },
      { kind: 'piece', fen: '8/8/8/2p5/3K4/4n3/8/8', goal: { type: 'capture' },
        text: 'The king captures the same way it moves. Capture both black pieces. (In a real game, a king may never move onto a square where it could be captured.)' }
    ]
  },
  {
    id: 'knight', group: 'The Pieces', title: 'The Knight', icon: 'wn',
    steps: [
      { kind: 'piece', fen: '8/8/8/8/3N4/8/8/8', goal: { type: 'moves', n: 3 }, dots: true,
        text: 'The knight moves in an L shape: two squares one way, then one square to the side. Make 3 moves with the knight.' },
      { kind: 'piece', fen: '8/8/8/8/8/8/PPPP4/1N6', goal: { type: 'stars', stars: ['c3'] }, movable: ['n'],
        text: 'The knight is the only piece that can jump over other pieces. Jump over your pawns to the star.' },
      { kind: 'piece', fen: '8/8/8/8/8/8/8/6N1', goal: { type: 'stars', stars: ['f3', 'e5', 'f7'] },
        text: 'Collect the stars with the knight.' },
      { kind: 'piece', fen: '8/8/5r2/3p4/8/2b5/8/1N6', goal: { type: 'capture' },
        text: 'Capture all three black pieces with the knight. Each capture lands you where the next one starts.' }
    ]
  },
  {
    id: 'pawn', group: 'The Pieces', title: 'The Pawn', icon: 'wp',
    steps: [
      { kind: 'piece', fen: '8/8/8/8/8/4P3/8/8', goal: { type: 'stars', stars: ['e6'] }, dots: true,
        text: 'Pawns move straight forward, one square at a time. They can never move backward. Move the pawn to the star.' },
      { kind: 'piece', fen: '8/8/8/8/8/8/4P3/8', goal: { type: 'stars', stars: ['e4'], maxMoves: 1 }, dots: true,
        text: 'On its very first move, a pawn may move two squares forward instead of one. Reach the star in one move.' },
      { kind: 'piece', fen: '8/8/8/3np3/4P3/8/8/8', goal: { type: 'capture', targets: ['d5'] },
        text: 'Pawns capture differently than they move: one square diagonally forward. A pawn can’t capture straight ahead, so the black pawn in front blocks it. Capture the knight.' },
      { kind: 'piece', fen: '8/1P6/8/8/8/8/8/8', goal: { type: 'promote' },
        text: 'When a pawn reaches the far side of the board, it is promoted: it turns into a queen, rook, bishop, or knight. Almost everyone picks a queen. Move the pawn to the last row and choose a piece.' }
    ]
  },
  {
    id: 'check', group: 'Winning the Game', title: 'Check', icon: 'bk',
    steps: [
      { kind: 'info', fen: '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', check: true,
        text: 'When a king is attacked, it is in check. Here the white rook attacks the black king. A player in check must get out of check right away; no other move is allowed.' },
      { kind: 'rules', fen: '4k3/8/8/8/8/8/8/R5K1 w - - 0 1', goal: { type: 'check' },
        text: 'Your turn: put the black king in check with your rook.' },
      { kind: 'rules', fen: '4r2k/8/8/8/8/8/8/4K3 w - - 0 1', goal: { type: 'escape', way: 'king' },
        text: 'Now your king is in check. There are three ways out. Way 1: move the king to a safe square.' },
      { kind: 'rules', fen: '4r2k/8/8/8/8/8/3B4/4K3 w - - 0 1', goal: { type: 'escape', way: 'block' },
        text: 'Way 2: block the check by putting a piece in the way. Use your bishop.' },
      { kind: 'rules', fen: 'R3r2k/8/8/8/8/8/8/4K3 w - - 0 1', goal: { type: 'escape', way: 'capture' },
        text: 'Way 3: capture the piece that is giving check. Use your rook.' }
    ]
  },
  {
    id: 'mate', group: 'Winning the Game', title: 'Checkmate', icon: 'wq',
    steps: [
      { kind: 'info', fen: 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', check: true,
        text: 'Checkmate is a check with no way out: the king can’t move to safety, nothing can block, and the attacker can’t be captured. Checkmate ends the game, and the player who gives it wins. Here Black’s own pawns trap the king.' },
      { kind: 'rules', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', goal: { type: 'mate' },
        text: 'Checkmate in one move. Look at the black king’s own pawns.' },
      { kind: 'rules', fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1', goal: { type: 'mate' },
        text: 'Checkmate in one move with the queen. Your king helps by guarding the squares next to the black king.' },
      { kind: 'rules', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', goal: { type: 'mate' },
        text: 'This trap happens in real games. Checkmate in one move. Hint: the pawn on f7 is guarded only by the black king.' }
    ]
  },
  {
    id: 'stalemate', group: 'Winning the Game', title: 'Stalemate', icon: 'bk',
    steps: [
      { kind: 'info', fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1',
        text: 'Stalemate: it’s Black’s turn, the black king is not in check, but Black has no legal move. Every square the king could go to is attacked. Stalemate is a draw, so nobody wins, even though White is far ahead!' },
      { kind: 'rules', fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1', goal: { type: 'mate' },
        text: 'Checkmate in one move, but be careful: one queen move here is stalemate, and that would throw away your win.' }
    ]
  },
  {
    id: 'castling', group: 'Special Rules', title: 'Castling', icon: 'wr',
    steps: [
      { kind: 'rules', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', goal: { type: 'castle', side: 'k' },
        text: 'Castling moves the king to safety and brings a rook into the game, in one move. Move the king two squares toward the rook on the right, and the rook jumps over to the king’s other side. Castle on the short side.' },
      { kind: 'rules', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', goal: { type: 'castle', side: 'q' },
        text: 'Now castle on the long side: move the king two squares to the left.' },
      { kind: 'info', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        text: 'Castling rules: the king and that rook must not have moved yet, the squares between them must be empty, and the king can’t castle out of check, through check, or into check.' }
    ]
  },
  {
    id: 'enpassant', group: 'Special Rules', title: 'En Passant', icon: 'wp',
    steps: [
      { kind: 'rules', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', last: ['d7', 'd5'], goal: { type: 'ep' },
        text: 'En passant is a special pawn capture. Black’s pawn just moved two squares, landing right beside your pawn. Right now, and only on this move, your pawn can capture it as if it had moved one square: move diagonally to d6.' }
    ]
  },
  {
    id: 'values', group: 'Special Rules', title: 'Piece Values', icon: 'bq',
    steps: [
      { kind: 'info', fen: '8/8/8/8/8/8/8/8', values: true,
        text: 'Pieces are worth different amounts. A pawn is worth 1, a knight or bishop 3, a rook 5, and a queen 9. The king is priceless, because losing it loses the game. Use these numbers to decide whether a trade is good.' },
      { kind: 'rules', fen: '7k/6n1/3p4/8/r2Q4/8/8/2K5 w - - 0 1', goal: { type: 'best', target: 'a4' },
        text: 'Your queen can capture three different black pieces. Which capture wins the most? Take it.' }
    ]
  }
]

// ---------------------------------------------------------------------------
// Simple move generator for the piece lessons (white pieces only; black pieces just sit there).
// ---------------------------------------------------------------------------
const F = 'abcdefgh'
const sq = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8) ? F[f] + (r + 1) : null
const fr = s => [F.indexOf(s[0]), +s[1] - 1]

export function placementToMap(placement) {
  const map = {}
  placement.split(' ')[0].split('/').forEach((row, i) => {
    let f = 0
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue }
      map[F[f] + (8 - i)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toLowerCase()
      f++
    }
  })
  return map
}

export function mapToPlacement(map) {
  const rows = []
  for (let r = 8; r >= 1; r--) {
    let row = '', empty = 0
    for (const f of F) {
      const p = map[f + r]
      if (!p) { empty++; continue }
      if (empty) { row += empty; empty = 0 }
      row += p[0] === 'w' ? p[1].toUpperCase() : p[1]
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join('/')
}

export function pieceMoves(map, from) {
  const p = map[from]
  if (!p || p[0] !== 'w') return []
  const [f, r] = fr(from)
  const out = []
  const slide = dirs => {
    for (const [df, dr] of dirs) {
      for (let k = 1; k < 8; k++) {
        const s = sq(f + df * k, r + dr * k)
        if (!s) break
        if (!map[s]) { out.push(s); continue }
        if (map[s][0] === 'b') out.push(s)
        break
      }
    }
  }
  const step = list => {
    for (const [df, dr] of list) {
      const s = sq(f + df, r + dr)
      if (s && (!map[s] || map[s][0] === 'b')) out.push(s)
    }
  }
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  switch (p[1]) {
    case 'r': slide(ORTHO); break
    case 'b': slide(DIAG); break
    case 'q': slide(ORTHO.concat(DIAG)); break
    case 'k': step(ORTHO.concat(DIAG)); break
    case 'n': step([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]); break
    case 'p': {
      const one = sq(f, r + 1)
      if (one && !map[one]) {
        out.push(one)
        const two = sq(f, r + 2)
        if (r === 1 && two && !map[two]) out.push(two)
      }
      for (const df of [-1, 1]) {
        const s = sq(f + df, r + 1)
        if (s && map[s] && map[s][0] === 'b') out.push(s)
      }
    }
  }
  return out
}

// Squares a piece of either color attacks (used to find which piece is giving check).
export function attacksFrom(map, from) {
  const p = map[from]
  if (!p) return []
  const [f, r] = fr(from)
  const out = []
  const slide = dirs => {
    for (const [df, dr] of dirs) {
      for (let k = 1; k < 8; k++) {
        const s = sq(f + df * k, r + dr * k)
        if (!s) break
        out.push(s)
        if (map[s]) break
      }
    }
  }
  const step = list => { for (const [df, dr] of list) { const s = sq(f + df, r + dr); if (s) out.push(s) } }
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  switch (p[1]) {
    case 'r': slide(ORTHO); break
    case 'b': slide(DIAG); break
    case 'q': slide(ORTHO.concat(DIAG)); break
    case 'k': step(ORTHO.concat(DIAG)); break
    case 'n': step([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]); break
    case 'p': step(p[0] === 'w' ? [[-1, 1], [1, 1]] : [[-1, -1], [1, -1]]); break
  }
  return out
}

// ---------------------------------------------------------------------------
export function initLearn(ctx) {
  const { board, toast } = ctx
  const $ = s => document.querySelector(s)
  const L = { lesson: null, stepIdx: 0, step: null, map: null, chess: null, stars: [], moves: 0, done: false,
    busy: false, hint: 0, finished: new Set(), timer: null }

  // star shape for the "collect the stars" steps, drawn in the 40x40 marker space
  if (!document.getElementById('learn-sprites')) {
    const holder = document.createElement('div')
    holder.id = 'learn-sprites'
    holder.setAttribute('aria-hidden', 'true')
    holder.style.cssText = 'position:absolute; transform:scale(0); width:0; height:0; overflow:hidden'
    holder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g id="markerStar"><polygon points="20.00,6.00 23.53,15.15 33.31,15.67 25.71,21.85 28.23,31.33 20.00,26.00 11.77,31.33 14.29,21.85 6.69,15.67 16.47,15.15"/></g></svg>'
    document.body.append(holder)
  }

  // ---------- lesson list ----------
  function drawList() {
    const box = $('#learn-list')
    box.innerHTML = ''
    let group = null, grid = null
    LESSONS.forEach((l, i) => {
      if (l.group !== group) {
        group = l.group
        const h = document.createElement('h3'); h.className = 'log-head'; h.textContent = group; box.append(h)
        grid = document.createElement('div'); grid.className = 'learn-grid'; box.append(grid)
      }
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'learn-card' + (L.finished.has(l.id) ? ' done' : '')
      b.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="${PIECE_SPRITE}#${l.icon}"/></svg><span></span>`
      b.querySelector('span').textContent = l.title + (L.finished.has(l.id) ? ' ✓' : '')
      b.addEventListener('click', () => openLesson(i, 0))
      grid.append(b)
    })
  }

  // ---------- running a step ----------
  function openLesson(i, stepIdx) {
    L.lessonIdx = i
    L.lesson = LESSONS[i]
    $('#learn-pick').hidden = true
    $('#learn-live').hidden = false
    loadStep(stepIdx)
  }

  function loadStep(idx) {
    clearTimeout(L.timer)
    L.stepIdx = idx
    L.step = L.lesson.steps[idx]
    L.moves = 0; L.done = false; L.busy = false; L.hint = 0; L.captured = 0
    const s = L.step
    board.setOrientation(COLOR.white)
    if (s.kind === 'piece') {
      L.map = placementToMap(s.fen)
      L.stars = s.goal.stars ? s.goal.stars.slice() : []
      L.chess = null
    } else {
      L.map = null
      L.stars = []
      L.chess = s.kind === 'rules' ? new Chess(s.fen) : null
    }
    draw(false)
    $('#learn-title').textContent = L.lesson.title
    $('#learn-progress').textContent = `Step ${idx + 1} of ${L.lesson.steps.length}`
    $('#learn-text').textContent = s.text
    renderValues(s.values)
    setMsg(s.kind === 'info' ? '' : 'Your turn.')
    if (s.kind === 'info') complete(null, true)
    updateButtons()
  }

  function renderValues(show) {
    const box = $('#learn-values')
    box.hidden = !show
    if (!show || box.childElementCount) return
    for (const [p, v] of [['wp', '1'], ['wn', '3'], ['wb', '3'], ['wr', '5'], ['wq', '9'], ['wk', '∞']]) {
      const d = document.createElement('div')
      d.className = 'value-item'
      d.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="${PIECE_SPRITE}#${p}"/></svg><strong>${v}</strong>`
      box.append(d)
    }
  }

  function currentFen() {
    if (L.step.kind === 'piece') return mapToPlacement(L.map)
    if (L.chess) return L.chess.fen()
    return L.step.fen
  }

  function draw(animate) {
    board.setPosition(currentFen().split(' ')[0], animate)
    board.removeMarkers(); board.removeArrows()
    for (const s of L.stars) board.addMarker(MK_STAR, s)
    const s = L.step
    if (s.kind === 'piece') {
      if (s.goal.targets) for (const t of s.goal.targets) if (L.map[t]) board.addMarker(MK_TARGET, t)
      if (s.dots) for (const from of movableSquares()) for (const to of pieceMoves(L.map, from)) board.addMarker(MK_DOT, to)
    }
    if (s.last && !L.moves) { board.addMarker(MK_LAST, s.last[0]); board.addMarker(MK_LAST, s.last[1]) }
    const c = L.chess || (s.check ? new Chess(s.fen) : null)
    if (c && c.in_check()) {
      const k = SQUARES.find(q => { const p = c.get(q); return p && p.type === 'k' && p.color === c.turn() })
      if (k) board.addMarker(MK_CHECK, k)
    }
  }

  function movableSquares() {
    const types = L.step.movable || null
    return Object.keys(L.map).filter(q => L.map[q][0] === 'w' && (!types || types.includes(L.map[q][1])))
  }

  // ---------- input ----------
  function onInput(event) {
    if (event.type === INPUT_EVENT_TYPE.movingOverSquare) return
    const s = L.step
    if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
      if (!s || s.kind === 'info' || L.done || L.busy) return false
      if (s.kind === 'piece') {
        if (!movableSquares().includes(event.squareFrom)) return false
        const moves = pieceMoves(L.map, event.squareFrom)
        if (!s.dots) board.addLegalMovesMarkers(moves.map(to => ({ to })))
        return moves.length > 0
      }
      const moves = L.chess.moves({ square: event.squareFrom, verbose: true })
      board.addLegalMovesMarkers(moves)
      return moves.length > 0
    }
    if (event.type === INPUT_EVENT_TYPE.validateMoveInput || event.type === INPUT_EVENT_TYPE.moveInputCanceled) board.removeLegalMovesMarkers()
    if (event.type !== INPUT_EVENT_TYPE.validateMoveInput) return
    const from = event.squareFrom, to = event.squareTo
    if (s.kind === 'piece') {
      if (!pieceMoves(L.map, from).includes(to)) return false
      const promo = L.map[from][1] === 'p' && to[1] === '8'
      L.busy = true
      if (promo) {
        board.showPromotionDialog(to, COLOR.white, result => {
          const piece = result.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected ? result.piece : 'wq'
          pieceMove(from, to, piece)
        })
      } else {
        event.chessboard.state.moveInputProcess.then(() => pieceMove(from, to))
      }
      return true
    }
    // rules step
    const legal = L.chess.moves({ verbose: true }).filter(m => m.from === from && m.to === to)
    if (!legal.length) return false
    L.busy = true
    if (legal.some(m => m.promotion)) {
      board.showPromotionDialog(to, COLOR.white, result => rulesMove({ from, to, promotion: result.piece ? result.piece[1] : 'q' }))
    } else {
      event.chessboard.state.moveInputProcess.then(() => rulesMove({ from, to }))
    }
    return true
  }

  function pieceMove(from, to, promoteTo) {
    const s = L.step
    const captured = L.map[to] && L.map[to][0] === 'b'
    L.map[to] = promoteTo || L.map[from]
    delete L.map[from]
    L.moves++
    if (captured) L.captured++
    const starHit = L.stars.indexOf(to)
    if (starHit >= 0) L.stars.splice(starHit, 1)
    L.busy = false
    draw(false)
    const g = s.goal
    if (g.type === 'moves') {
      if (L.moves >= g.n) complete('Nice! You’ve got it.')
      else setMsg(`Good. ${g.n - L.moves} more ${g.n - L.moves === 1 ? 'move' : 'moves'}.`)
    } else if (g.type === 'stars') {
      if (!L.stars.length) {
        if (g.maxMoves && L.moves > g.maxMoves) { fail(`That took ${L.moves} moves. Try to reach it in ${g.maxMoves}.`); return }
        complete(`All stars collected in ${L.moves} ${L.moves === 1 ? 'move' : 'moves'}!`)
      } else if (g.maxMoves && L.moves >= g.maxMoves) fail(`Try to reach the star in ${g.maxMoves === 1 ? 'one move' : g.maxMoves + ' moves'}.`)
      else setMsg(`${L.stars.length} ${L.stars.length === 1 ? 'star' : 'stars'} to go.`)
    } else if (g.type === 'capture') {
      const remaining = g.targets ? g.targets.filter(t => L.map[t] && L.map[t][0] === 'b').length : Object.values(L.map).filter(p => p[0] === 'b').length
      if (!remaining) complete(captured ? 'Captured! Well done.' : 'Done!')
      else setMsg(captured ? `Captured! ${remaining} to go.` : `${remaining} left to capture.`)
    } else if (g.type === 'promote') {
      if (to[1] === '8') complete(`Promoted to a ${({ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' })[L.map[to][1]]}!`)
      else setMsg('Keep going.')
    }
  }

  function rulesMove(m) {
    const s = L.step, g = s.goal
    const before = new Chess(L.chess.fen())
    const checkers = attackersOfKing(before)
    const r = L.chess.move(m)
    L.busy = false
    if (!r) { draw(false); return }
    L.moves++
    draw(false)
    board.addMarker(MK_LAST, r.from); board.addMarker(MK_LAST, r.to)
    let ok = false, why = ''
    switch (g.type) {
      case 'check':
        ok = L.chess.in_check(); why = 'That move doesn’t attack the king. Try again.'; break
      case 'mate':
        ok = L.chess.in_checkmate()
        why = L.chess.in_stalemate() ? 'Stalemate! Black can’t move but isn’t in check, so it’s a draw. Try again.'
          : L.chess.in_check() ? 'That’s check, but the king can escape. Try again.' : 'That isn’t checkmate. Try again.'
        break
      case 'escape': {
        const way = r.piece === 'k' && !(r.captured && checkers.includes(r.to)) ? 'king' : (r.captured && checkers.includes(r.to) ? 'capture' : 'block')
        ok = way === g.way
        why = `That gets out of check too! This time, try to ${({ king: 'move the king', block: 'block the check', capture: 'capture the checking piece' })[g.way]}.`
        break
      }
      case 'castle':
        ok = r.flags.includes(g.side); why = r.piece === 'k' ? 'Move the king two squares to castle. Try again.' : 'Use the king to castle: move it two squares. Try again.'; break
      case 'ep':
        ok = r.flags.includes('e'); why = 'Try capturing the black pawn en passant: move diagonally behind it.'; break
      case 'best':
        ok = r.to === g.target
        why = r.captured ? `That wins a ${({ p: 'pawn (1)', n: 'knight (3)', b: 'bishop (3)', r: 'rook (5)', q: 'queen (9)' })[r.captured]}. One capture wins more. Try again.` : 'Capture one of the black pieces. Try again.'
        break
    }
    if (ok) complete(successText(g, r))
    else fail(why)
  }

  function successText(g, r) {
    return ({
      check: 'Check! The black king is attacked.',
      mate: 'Checkmate! You win.',
      escape: 'You’re out of check.',
      castle: 'Castled! Your king is safe and your rook is ready.',
      ep: 'En passant! You captured the pawn as it passed by.',
      best: 'Right: the rook is worth 5, more than the knight (3) or the pawn (1).'
    })[g.type] || 'Done!'
    void r
  }

  // Squares of the enemy pieces that are giving check to the side to move.
  function attackersOfKing(chess) {
    const me = chess.turn()
    const map = placementToMap(chess.fen())
    const king = Object.keys(map).find(q => map[q] === me + 'k')
    if (!king || !chess.in_check()) return []
    return Object.keys(map).filter(q => map[q][0] !== me && attacksFrom(map, q).includes(king))
  }

  function fail(text) {
    L.busy = true
    setMsg(text, 'wrong')
    L.timer = setTimeout(() => { loadStep(L.stepIdx); setMsg(text, 'wrong') }, 1300)
  }

  function complete(text, quiet) {
    L.done = true
    if (!quiet) setMsg(text, 'good')
    if (L.stepIdx === L.lesson.steps.length - 1) L.finished.add(L.lesson.id)
    updateButtons()
  }

  function updateButtons() {
    const last = L.stepIdx === L.lesson.steps.length - 1
    const nextLesson = LESSONS[L.lessonIdx + 1]
    const next = $('#learn-next')
    next.disabled = !L.done
    next.textContent = !last ? 'Next' : nextLesson ? `Next: ${nextLesson.title}` : 'All Lessons'
    next.classList.toggle('btn-pulse', L.done)
    $('#learn-hint').hidden = L.step.kind === 'info'
    $('#learn-reset').hidden = L.step.kind === 'info'
    $('#learn-back').disabled = L.stepIdx === 0 && L.lessonIdx === 0
  }

  function setMsg(text, kind = '') {
    const m = $('#learn-msg')
    m.textContent = text
    m.className = 'play-msg' + (kind ? ` msg-${kind}` : '')
  }

  // ---------- hints: first the piece, then the move ----------
  function hintMove() {
    const s = L.step
    if (s.kind === 'rules') {
      const sol = L.chess.moves({ verbose: true }).find(m => {
        const c = new Chess(L.chess.fen()); const r = c.move(m)
        const g = s.goal
        if (g.type === 'check') return c.in_check()
        if (g.type === 'mate') return c.in_checkmate()
        if (g.type === 'castle') return r.flags.includes(g.side)
        if (g.type === 'ep') return r.flags.includes('e')
        if (g.type === 'best') return r.to === g.target
        if (g.type === 'escape') {
          const checkers = attackersOfKing(new Chess(L.chess.fen()))
          const way = r.piece === 'k' && !(r.captured && checkers.includes(r.to)) ? 'king' : (r.captured && checkers.includes(r.to) ? 'capture' : 'block')
          return way === g.way
        }
        return false
      })
      return sol ? [sol.from, sol.to] : null
    }
    // piece step: shortest path to a star or target (breadth-first search over the movable pieces)
    const g = s.goal
    const goals = new Set(g.type === 'stars' ? L.stars
      : g.type === 'capture' ? (g.targets || Object.keys(L.map).filter(q => L.map[q][0] === 'b'))
        : g.type === 'promote' ? ['a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8'] : [])
    for (const from of movableSquares()) {
      if (g.type === 'moves') { const m = pieceMoves(L.map, from); if (m.length) return [from, m[0]] }
      const seen = new Set([from])
      let frontier = pieceMoves(L.map, from).map(to => ({ to, first: to }))
      for (let depth = 0; depth < 6 && frontier.length; depth++) {
        const hit = frontier.find(x => goals.has(x.to))
        if (hit) return [from, hit.first]
        const next = []
        for (const x of frontier) {
          if (seen.has(x.to)) continue
          seen.add(x.to)
          if (L.map[x.to]) continue // can't pass through a capture
          const m = { ...L.map }; m[x.to] = m[from]; delete m[from]
          for (const to of pieceMoves(m, x.to)) next.push({ to, first: x.first })
        }
        frontier = next
      }
    }
    return null
  }

  function hint() {
    if (L.done || L.busy || L.step.kind === 'info') return
    const mv = hintMove()
    if (!mv) return
    L.hint++
    board.removeMarkers(MK_HINT); board.removeArrows(AR_HINT)
    if (L.hint === 1) board.addMarker(MK_HINT, mv[0])
    else board.addArrow(AR_HINT, mv[0], mv[1])
  }

  // ---------- navigation ----------
  function next() {
    if (!L.done) return
    if (L.stepIdx < L.lesson.steps.length - 1) { loadStep(L.stepIdx + 1); return }
    if (LESSONS[L.lessonIdx + 1]) openLesson(L.lessonIdx + 1, 0)
    else showList()
  }
  function back() {
    if (L.stepIdx > 0) loadStep(L.stepIdx - 1)
    else if (L.lessonIdx > 0) { const prev = LESSONS[L.lessonIdx - 1]; openLesson(L.lessonIdx - 1, prev.steps.length - 1) }
  }
  function showList() {
    clearTimeout(L.timer)
    L.lesson = null
    $('#learn-pick').hidden = false
    $('#learn-live').hidden = true
    drawList()
    board.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', false)
    board.removeMarkers(); board.removeArrows()
  }

  $('#learn-next').addEventListener('click', next)
  $('#learn-back').addEventListener('click', back)
  $('#learn-reset').addEventListener('click', () => loadStep(L.stepIdx))
  $('#learn-hint').addEventListener('click', hint)
  $('#learn-list-btn').addEventListener('click', showList)
  if (location.search.includes('test')) window.__learn = { L, LESSONS, open: openLesson, hintMove }

  return {
    enter() {
      document.body.classList.add('learn-on')
      ctx.setInputHandler(onInput)
      if (L.lesson) loadStep(L.stepIdx); else showList()
    },
    leave() {
      clearTimeout(L.timer)
      document.body.classList.remove('learn-on')
      board.removeMarkers(); board.removeArrows()
      ctx.setInputHandler(null)
    }
  }
}
