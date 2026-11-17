// Puzzles: Lichess puzzles (CC0) filtered by theme and difficulty, plus printable worksheets.
import { Chessboard, COLOR, BORDER_TYPE } from '../vendor/cm-chessboard/src/Chessboard.js'
import { Chess } from '../vendor/chessjs/chess.js'
import { MK_WRONG, MK_HINT, AR_HINT } from './marks.js'
import { OFFLINE, loadScript } from './offline.js'

export const DIFFICULTIES = [
  { id: 'any', label: 'Any difficulty', min: 0, max: 9999 },
  { id: '1', label: 'Beginner (rated under 1000)', min: 0, max: 999 },
  { id: '2', label: 'Easy (rated 1000 to 1299)', min: 1000, max: 1299 },
  { id: '3', label: 'Intermediate (rated 1300 to 1599)', min: 1300, max: 1599 },
  { id: '4', label: 'Advanced (rated 1600 to 1899)', min: 1600, max: 1899 },
  { id: '5', label: 'Expert (rated 1900 to 2199)', min: 1900, max: 2199 },
  { id: '6', label: 'Master (rated 2200 and up)', min: 2200, max: 9999 }
]

// Friendly names for the Lichess theme tags, grouped for the menu.
const THEME_GROUPS = [
  ['Tactics', {
    fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discoveredAttack: 'Discovered attack', discoveredCheck: 'Discovered check',
    doubleCheck: 'Double check', hangingPiece: 'Hanging piece', trappedPiece: 'Trapped piece', sacrifice: 'Sacrifice',
    deflection: 'Deflection', attraction: 'Attraction', capturingDefender: 'Capture the defender', clearance: 'Clearance',
    interference: 'Interference', intermezzo: 'In-between move', xRayAttack: 'X-ray attack', quietMove: 'Quiet move',
    defensiveMove: 'Defensive move', zugzwang: 'Zugzwang', exposedKing: 'Exposed king', kingsideAttack: 'Kingside attack',
    queensideAttack: 'Queenside attack', attackingF2F7: 'Attacking f2 or f7', advancedPawn: 'Advanced pawn',
    promotion: 'Promotion', underPromotion: 'Underpromotion', enPassant: 'En passant', castling: 'Castling'
  }],
  ['Checkmates', {
    mate: 'Checkmate (any kind)', mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', mateIn4: 'Mate in 4', mateIn5: 'Mate in 5 or more',
    backRankMate: 'Back rank mate', smotheredMate: 'Smothered mate', anastasiaMate: 'Anastasia’s mate', arabianMate: 'Arabian mate',
    bodenMate: 'Boden’s mate', doubleBishopMate: 'Double bishop mate', dovetailMate: 'Dovetail mate', hookMate: 'Hook mate',
    operaMate: 'Opera mate', pillsburysMate: 'Pillsbury’s mate', morphysMate: 'Morphy’s mate', epauletteMate: 'Epaulette mate',
    swallowstailMate: 'Swallow’s tail mate', cornerMate: 'Corner mate', killBoxMate: 'Kill box mate', triangleMate: 'Triangle mate',
    vukovicMate: 'Vukovic mate', balestraMate: 'Balestra mate', blindSwineMate: 'Blind swine mate'
  }],
  ['Game phase', {
    opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame', pawnEndgame: 'Pawn endgame', rookEndgame: 'Rook endgame',
    bishopEndgame: 'Bishop endgame', knightEndgame: 'Knight endgame', queenEndgame: 'Queen endgame', queenRookEndgame: 'Queen and rook endgame'
  }],
  ['Goal', { crushing: 'Win big material', advantage: 'Win an advantage', equality: 'Save the game' }]
]
export const THEME_NAMES = Object.assign({}, ...THEME_GROUPS.map(g => g[1]))
export const themeName = t => THEME_NAMES[t] || t

let all = null
let loading = null
function loadPuzzles() {
  if (!loading) {
    loading = (OFFLINE ? loadScript('data/puzzles.js').then(() => window.BFC_PUZZLES)
      : fetch('data/puzzles.json').then(r => { if (!r.ok) throw new Error('load'); return r.json() })).then(d => (all = d))
  }
  return loading
}

export function matching(theme, diffId) {
  const d = DIFFICULTIES.find(x => x.id === diffId) || DIFFICULTIES[0]
  return all.filter(p => p.r >= d.min && p.r <= d.max && (theme === 'any' || p.t.includes(theme) || (theme === 'mateIn5' && p.t.includes('mateIn5'))))
}

const sideName = c => (c === 'w' ? 'White' : 'Black')

export function initPuzzles(ctx) {
  const { board, tree, render, toast } = ctx
  const $ = s => document.querySelector(s)
  const pz = {
    current: null, sol: [], step: 0, color: 'w', tip: null, state: 'idle',
    mistakes: 0, hints: 0, revealed: false, lastAccepted: null, seen: new Set(),
    attempted: 0, cleanSolves: 0, timer: null, timeLeft: 0, replyTimer: null
  }

  // ----- menus -----
  function buildMenus() {
    const sel = $('#pz-theme')
    sel.innerHTML = '<option value="any">Any theme</option>'
    for (const [group, names] of THEME_GROUPS) {
      const og = document.createElement('optgroup')
      og.label = group
      for (const [id, label] of Object.entries(names)) {
        const o = document.createElement('option'); o.value = id; o.textContent = label; og.append(o)
      }
      sel.append(og)
    }
    const ds = $('#pz-diff')
    ds.innerHTML = DIFFICULTIES.map(d => `<option value="${d.id}">${d.label}</option>`).join('')
    ds.value = '2'
    $('#ws-theme').innerHTML = sel.innerHTML
    $('#ws-diff').innerHTML = ds.innerHTML
    $('#ws-diff').value = '2'
  }

  // ----- solving -----
  function nextPuzzle() {
    const pool = matching($('#pz-theme').value, $('#pz-diff').value)
    if (!pool.length) { toast('No puzzles match that theme and difficulty. Try another difficulty.'); return }
    let fresh = pool.filter(p => !pz.seen.has(p.i))
    if (!fresh.length) { for (const p of pool) pz.seen.delete(p.i); fresh = pool }
    start(fresh[Math.floor(Math.random() * fresh.length)])
  }

  function start(p) {
    clearTimeout(pz.replyTimer)
    pz.current = p
    pz.seen.add(p.i)
    pz.sol = p.m.split(' ')
    pz.step = 0
    pz.mistakes = 0; pz.hints = 0; pz.revealed = false
    pz.state = 'intro'
    pz.attempted++
    tree.reset(p.f)
    // the first move in the data is the opponent's; the solver plays the other side
    pz.color = p.f.split(' ')[1] === 'w' ? 'b' : 'w'
    board.setOrientation(pz.color === 'w' ? COLOR.white : COLOR.black)
    render(false)
    pz.replyTimer = setTimeout(() => {
      playSol()
      pz.tip = tree.current
      pz.state = 'solving'
      render(true)
      startTimer()
    }, 700)
    renderPanel()
  }

  function playSol() {
    const u = pz.sol[pz.step]
    tree.play({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
    pz.step++
  }

  // Called before the user's move is played. Returns true if the move is correct.
  function accept(move) {
    if (pz.state !== 'solving') return false
    const uci = move.from + move.to + (move.promotion || '')
    const expected = pz.sol[pz.step]
    if (uci === expected) { pz.lastAccepted = 'line'; return true }
    // any move that delivers checkmate also solves the puzzle
    const c = tree.chessAt()
    if (c.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' }) && c.in_checkmate()) { pz.lastAccepted = 'mate'; return true }
    pz.mistakes++
    board.removeMarkers(MK_WRONG)
    board.addMarker(MK_WRONG, move.to)
    setTimeout(() => board.removeMarkers(MK_WRONG), 900)
    $('#pz-msg').textContent = 'Not quite. Try again.'
    $('#pz-msg').className = 'play-msg msg-wrong'
    return false
  }

  function afterUserMove(node) {
    pz.step++
    pz.tip = node
    if (pz.lastAccepted === 'mate' || pz.step >= pz.sol.length) { solved(); return }
    pz.state = 'reply'
    renderPanel()
    pz.replyTimer = setTimeout(() => {
      tree.goTo(pz.tip)
      playSol()
      pz.tip = tree.current
      pz.state = 'solving'
      render(true)
      $('#pz-msg').textContent = 'Good move! Keep going.'
      $('#pz-msg').className = 'play-msg msg-good'
    }, 500)
  }

  function solved() {
    pz.state = 'done'
    stopTimer()
    if (!pz.mistakes && !pz.hints && !pz.revealed) pz.cleanSolves++
    renderPanel()
  }

  function hint() {
    if (pz.state !== 'solving') return
    tree.goTo(pz.tip); render(false)
    const u = pz.sol[pz.step]
    pz.hints++
    if (pz.hints === 1) board.addMarker(MK_HINT, u.slice(0, 2))
    else board.addArrow(AR_HINT, u.slice(0, 2), u.slice(2, 4))
    renderPanel()
  }

  function reveal() {
    if (!pz.current || pz.state === 'done' || pz.state === 'intro') return
    clearTimeout(pz.replyTimer)
    pz.revealed = true
    pz.state = 'revealing'
    stopTimer()
    $('#pz-timer').hidden = true
    tree.goTo(pz.tip)
    const stepOnce = () => {
      if (pz.step >= pz.sol.length) { pz.tip = tree.current; pz.state = 'done'; renderPanel(); return }
      playSol()
      pz.tip = tree.current
      render(true)
      pz.replyTimer = setTimeout(stepOnce, 900)
    }
    renderPanel()
    stepOnce()
  }

  // ----- timer -----
  function startTimer() {
    stopTimer()
    const secs = +$('#pz-timer-len').value
    if (!secs) { $('#pz-timer').hidden = true; return }
    pz.timeLeft = secs
    $('#pz-timer').hidden = false
    showTime()
    pz.timer = setInterval(() => {
      pz.timeLeft--
      showTime()
      if (pz.timeLeft <= 0) stopTimer()
    }, 1000)
  }
  function stopTimer() { clearInterval(pz.timer); pz.timer = null }
  function showTime() {
    const t = Math.max(0, pz.timeLeft)
    $('#pz-timer').textContent = t > 0 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : 'Time’s up!'
    $('#pz-timer').classList.toggle('timer-low', t <= 10)
  }

  // ----- panel -----
  function renderPanel() {
    const p = pz.current
    $('#pz-live').hidden = !p
    $('#pz-new').hidden = !!p
    if (!p) return
    const who = sideName(pz.color)
    const msg = $('#pz-msg')
    if (pz.state === 'intro') { msg.textContent = `${who} to move. Watch the last move…`; msg.className = 'play-msg' }
    else if (pz.state === 'done') {
      msg.textContent = pz.revealed ? 'Here’s the solution.' : (pz.mistakes || pz.hints ? 'Solved!' : 'Solved on the first try!')
      msg.className = 'play-msg msg-good'
    } else if (pz.state === 'solving' && tree.current !== pz.tip) {
      msg.textContent = 'You are looking at an earlier move. Click Back to Puzzle.'; msg.className = 'play-msg'
    } else if (pz.state === 'solving' && !/msg-(wrong|good)/.test(msg.className)) {
      msg.textContent = `${who} to move. Find the best move.`; msg.className = 'play-msg'
    }
    const showThemes = pz.state === 'done'
    $('#pz-info').textContent = `Rating ${p.r}` + (showThemes ? ` · ${p.t.filter(t => THEME_NAMES[t] && t !== 'mate').map(themeName).join(', ')}` : '')
    $('#pz-score').textContent = `Solved on the first try: ${pz.cleanSolves} of ${pz.attempted}`
    $('#pz-hint').disabled = pz.state !== 'solving'
    $('#pz-reveal').disabled = !(pz.state === 'solving' || pz.state === 'reply')
    $('#pz-back').hidden = !(pz.state === 'solving' && tree.current !== pz.tip)
  }

  function canMove() {
    return pz.state === 'solving' && tree.current === pz.tip && tree.chessAt().turn() === pz.color
  }

  async function enter() {
    $('#pz-loading').hidden = !!all
    try {
      await loadPuzzles()
    } catch {
      $('#pz-loading').textContent = 'The puzzles could not load. Check the internet connection and reload the page.'
      return
    }
    $('#pz-loading').hidden = true
    if (!pz.current) { render(false); renderPanel(); return }
    tree.goTo(pz.tip || tree.current)
    render(false)
  }

  function leave() {
    clearTimeout(pz.replyTimer)
    stopTimer()
    if (pz.state !== 'done') pz.state = pz.current ? 'paused' : 'idle'
  }

  // ----- worksheet -----
  async function printWorksheet() {
    await loadPuzzles()
    const theme = $('#ws-theme').value
    const diff = $('#ws-diff').value
    const count = +$('#ws-count').value
    const pool = matching(theme, diff)
    if (!pool.length) { toast('No puzzles match that theme and difficulty.'); return }
    const picks = []
    const used = new Set()
    while (picks.length < Math.min(count, pool.length)) {
      const p = pool[Math.floor(Math.random() * pool.length)]
      if (!used.has(p.i)) { used.add(p.i); picks.push(p) }
    }
    picks.sort((a, b) => a.r - b.r)
    const area = $('#print-area')
    area.innerHTML = ''
    const themeLabel = theme === 'any' ? 'Mixed Themes' : themeName(theme)
    const diffLabel = DIFFICULTIES.find(d => d.id === diff).label
    const header = () => {
      const h = document.createElement('div')
      h.className = 'ws-header'
      h.innerHTML = `<div><h1>Booked for Chess Puzzles: ${esc(themeLabel)}</h1><p>${esc(diffLabel)}</p></div><p class="ws-name">Name: ______________________</p>`
      return h
    }
    const perPage = 6
    const boards = []
    for (let pageStart = 0; pageStart < picks.length; pageStart += perPage) {
      const page = document.createElement('section')
      page.className = 'ws-page'
      page.append(header())
      const grid = document.createElement('div')
      grid.className = 'ws-grid'
      picks.slice(pageStart, pageStart + perPage).forEach((p, k) => {
        const n = pageStart + k + 1
        const info = puzzlePosition(p)
        const cell = document.createElement('div')
        cell.className = 'ws-cell'
        const b = document.createElement('div')
        b.className = 'ws-board'
        const cap = document.createElement('p')
        cap.className = 'ws-cap'
        cap.innerHTML = `<strong>${n}.</strong> ${sideName(info.turn)} to move <span class="ws-small">Rating ${p.r}</span>`
        const ans = document.createElement('p')
        ans.className = 'ws-line'
        ans.textContent = 'Answer: ______________________________'
        cell.append(cap, b, ans)
        grid.append(cell)
        boards.push({ el: b, fen: info.fen, turn: info.turn })
      })
      page.append(grid)
      page.append(footer())
      area.append(page)
    }
    // answer key
    const key = document.createElement('section')
    key.className = 'ws-page ws-key'
    key.innerHTML = `<div class="ws-header"><div><h1>Answer Key: ${esc(themeLabel)}</h1><p>${esc(diffLabel)}</p></div></div>`
    const ol = document.createElement('ol')
    for (const p of picks) {
      const li = document.createElement('li')
      li.textContent = solutionText(p)
      ol.append(li)
    }
    key.append(ol, footer())
    area.append(key)

    area.classList.add('building')
    const made = boards.map(x => new Chessboard(x.el, {
      position: x.fen,
      orientation: x.turn === 'w' ? COLOR.white : COLOR.black,
      assetsUrl: 'vendor/cm-chessboard/assets/',
      responsive: false,
      style: { cssClass: 'print', borderType: BORDER_TYPE.frame, showCoordinates: true, pieces: { file: 'pieces/standard.svg' }, animationDuration: 0 }
    }))
    await Promise.all(made.map(b => b.initialized || Promise.resolve()))
    await new Promise(r => setTimeout(r, 700))
    area.classList.remove('building')
    window.print()
  }

  function footer() {
    const f = document.createElement('p')
    f.className = 'ws-footer'
    f.textContent = 'Washoe County Library System · Puzzles from the Lichess puzzle database'
    return f
  }

  ctx.printWorksheet = printWorksheet
  if (location.search.includes('test')) window.__pz = pz

  $('#pz-new').addEventListener('click', async () => { await loadPuzzles(); nextPuzzle() })
  $('#pz-next').addEventListener('click', nextPuzzle)
  $('#pz-retry').addEventListener('click', () => pz.current && (pz.attempted--, start(pz.current)))
  $('#pz-hint').addEventListener('click', hint)
  $('#pz-reveal').addEventListener('click', reveal)
  $('#pz-back').addEventListener('click', () => { tree.goTo(pz.tip); render(true) })
  $('#pz-analyze').addEventListener('click', () => { if (pz.current) ctx.setMode('board') })
  $('#ws-print').addEventListener('click', () => printWorksheet().catch(e => { console.error(e); toast('The worksheet could not be made.') }))
  buildMenus()

  return { enter, leave, canMove, accept, afterUserMove, renderPanel }
}

// Position the solver sees (after the opponent's first move), and whose turn it is.
export function puzzlePosition(p) {
  const c = new Chess(p.f)
  const u = p.m.split(' ')[0]
  c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
  return { fen: c.fen(), turn: c.turn() }
}

export function solutionText(p) {
  const c = new Chess(p.f)
  const moves = p.m.split(' ')
  const first = moves.shift()
  c.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] })
  const parts = []
  moves.forEach((u, k) => {
    const [, turn, , , , full] = c.fen().split(' ')
    const r = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
    if (!r) return
    if (turn === 'w') parts.push(`${full}. ${r.san}`)
    else parts.push(k === 0 ? `${full}... ${r.san}` : r.san)
  })
  return parts.join(' ')
}

function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])) }
