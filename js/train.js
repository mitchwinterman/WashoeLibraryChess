// Woodpecker trainer: drill opening lines and endgame positions.
// Miss a move and the board goes back a step; play the right move and it keeps going.
import { COLOR } from '../vendor/cm-chessboard/src/Chessboard.js'
import { Chess } from '../vendor/chessjs/chess.js'
import { MK_WRONG, MK_GOOD, MK_HINT, AR_HINT } from './marks.js'
import { loadOpenings, openingList } from './openings.js'

// Starter lines, taken from the Lichess opening list.
export const STARTER_LINES = [
  { side: 'w', name: 'Italian Game: Giuoco Piano', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5' },
  { side: 'w', name: 'Italian Game: Fried Liver Attack', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7' },
  { side: 'w', name: 'Italian Game: Evans Gambit', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. O-O d6' },
  { side: 'w', name: 'Ruy Lopez: Closed', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3' },
  { side: 'w', name: 'Scotch Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4' },
  { side: 'w', name: 'Danish Gambit', pgn: '1. e4 e5 2. d4 exd4 3. c3' },
  { side: 'w', name: 'London System', pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Nc6 5. Nbd2 e6 6. c3' },
  { side: 'w', name: 'Queen’s Gambit Declined', pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. Nf3' },
  { side: 'b', name: 'Sicilian Defense: Najdorf Variation', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6' },
  { side: 'b', name: 'Sicilian Defense: Dragon Variation', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6' },
  { side: 'b', name: 'French Defense: Advance Variation', pgn: '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6' },
  { side: 'b', name: 'Caro-Kann Defense: Classical Variation', pgn: '1. e4 c6 2. d4 d5 3. Nd2 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7' },
  { side: 'b', name: 'Scandinavian Defense: Main Line', pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5' },
  { side: 'b', name: 'Petrov’s Defense', pgn: '1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4' },
  { side: 'b', name: 'Slav Defense', pgn: '1. d4 d5 2. c4 c6 3. Nc3 dxc4' },
  { side: 'b', name: 'Nimzo-Indian Defense', pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O' },
  { side: 'b', name: 'King’s Indian Defense', pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3' }
]

// Endgame positions. The computer plays the other side and checks every move.
export const ENDGAMES = [
  { name: 'Checkmate with a queen', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', side: 'w', goal: 'win' },
  { name: 'Checkmate with a rook', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', side: 'w', goal: 'win' },
  { name: 'Ladder mate with two rooks', fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1', side: 'w', goal: 'win' },
  { name: 'Checkmate with two bishops', fen: '8/8/3k4/8/8/8/8/2B1KB2 w - - 0 1', side: 'w', goal: 'win' },
  { name: 'King and pawn: king in front', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', side: 'w', goal: 'win' },
  { name: 'King and pawn: defend as Black', fen: '4k3/8/8/4P3/4K3/8/8/8 w - - 0 1', side: 'b', goal: 'draw' },
  { name: 'Lucena position: build a bridge', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', side: 'w', goal: 'win' },
  { name: 'Philidor position: hold the draw', fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1', side: 'b', goal: 'draw' }
]

const HOLD_MOVES = 10 // a draw goal is met after this many safe moves

function lineToUci(pgn) {
  const c = new Chess()
  const out = []
  for (const tok of pgn.split(/\s+/)) {
    if (!tok || /^\d+\./.test(tok)) continue
    const r = c.move(tok, { sloppy: true })
    if (!r) break
    out.push({ uci: r.from + r.to + (r.promotion || ''), san: r.san })
  }
  return out
}

const sideName = c => (c === 'w' ? 'White' : 'Black')

export function initTrain(ctx) {
  const { board, tree, render, toast, engine } = ctx
  const $ = s => document.querySelector(s)
  const tr = {
    kind: 'openings', item: null, moves: [], idx: 0, side: 'w', tip: null,
    state: 'idle', mistakes: 0, runs: [], startedAt: 0, goal: null, safeMoves: 0, timer: null, chosen: null,
    hint: { fen: null, move: null, stage: 0 }
  }

  // ---------- menus ----------
  function buildMenus() {
    const sel = $('#tr-starter')
    sel.innerHTML = '<option value="">Choose a line…</option>' +
      ['w', 'b'].map(s => `<optgroup label="Lines for ${sideName(s)}">` +
        STARTER_LINES.map((l, i) => l.side === s ? `<option value="${i}">${l.name}</option>` : '').join('') + '</optgroup>').join('')
    $('#tr-endgame').innerHTML = ENDGAMES.map((e, i) => `<option value="${i}">${e.name}</option>`).join('')
  }

  function choose(line) {
    tr.chosen = line
    $('#tr-chosen').hidden = false
    $('#tr-chosen-name').textContent = line.name
    $('#tr-chosen-line').textContent = line.pgn
    const guess = line.side || (/Defen[cs]e/.test(line.name) ? 'b' : 'w')
    $('#tr-side').value = guess
  }

  function search(q) {
    const box = $('#tr-results')
    box.innerHTML = ''
    q = q.trim().toLowerCase()
    if (q.length < 2) return
    const words = q.split(/\s+/)
    const hits = openingList.filter(o => words.every(w => o.name.toLowerCase().includes(w)))
      .sort((a, b) => a.pgn.length - b.pgn.length).slice(0, 40)
    if (!hits.length) { box.innerHTML = '<p class="muted">No openings match.</p>'; return }
    for (const h of hits) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'result'
      b.innerHTML = `<strong></strong><span></span>`
      b.querySelector('strong').textContent = h.name
      b.querySelector('span').textContent = h.pgn
      b.addEventListener('click', () => { choose({ name: h.name, pgn: h.pgn }); box.innerHTML = '' })
      box.append(b)
    }
  }

  // ---------- openings ----------
  function startOpening() {
    if (!tr.chosen) { toast('Choose a line first.'); return }
    tr.kind = 'openings'
    tr.item = tr.chosen
    tr.moves = lineToUci(tr.item.pgn)
    tr.side = $('#tr-side').value
    tr.runs = tr.runs.filter(r => r.key === tr.item.pgn)
    beginRun()
  }

  function beginRun() {
    clearTimeout(tr.timer)
    $('#tr-vars').hidden = true
    tr.hint = { fen: null, move: null, stage: 0 }
    tr.idx = 0; tr.mistakes = 0; tr.safeMoves = 0
    tr.startedAt = Date.now()
    tr.state = 'busy'
    const startFen = tr.kind === 'openings' ? undefined : tr.item.fen
    tree.reset(startFen)
    board.setOrientation(tr.side === 'w' ? COLOR.white : COLOR.black)
    tr.tip = tree.current
    render(false)
    showPanel()
    if (tr.kind === 'openings') {
      if (tree.chessAt().turn() !== tr.side) tr.timer = setTimeout(opponentBookMove, 600)
      else yourTurn()
    } else {
      prepareEndgame()
    }
  }

  function yourTurn(msg) {
    tr.state = 'yourturn'
    if (tr.kind === 'endgames') {
      // what the best move would score; the user's move is compared against it
      tr.best = engine.search(tr.tip.fen, { skill: 20, depth: 12, movetime: 700 }).then(r => userScore(r.score, true)).catch(() => null)
    }
    setMsg(msg || (tr.kind === 'openings' ? `Your move as ${sideName(tr.side)}.` : goalText()), msg ? 'good' : '')
    showPanel()
  }

  function opponentBookMove() {
    const m = tr.moves[tr.idx]
    tree.goTo(tr.tip)
    tree.play({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] })
    tr.idx++
    tr.tip = tree.current
    render(true)
    if (tr.idx >= tr.moves.length) finishRun()
    else yourTurn()
  }

  // ---------- endgames ----------
  function startEndgame() {
    tr.kind = 'endgames'
    tr.item = ENDGAMES[+$('#tr-endgame').value]
    tr.side = tr.item.side
    tr.runs = tr.runs.filter(r => r.key === tr.item.fen)
    tr.goal = tr.item.goal
    beginRun()
  }

  async function prepareEndgame() {
    setMsg('The computer is checking the position…')
    try {
      await engine.start()
      if (tree.chessAt().turn() !== tr.side) await engineReply()
      else yourTurn()
    } catch (e) {
      console.error(e)
      setMsg('The computer could not start, so endgame checking is off. Reload the page to try again.')
    }
  }

  // Score from the user's point of view, in centipawns (mate = ±100000).
  function userScore(score, userToMove) {
    if (!score) return 0
    let v = score.mate !== undefined ? (score.mate > 0 ? 100000 - score.mate : -100000 - score.mate) : score.cp
    return userToMove ? v : -v
  }

  function goalText() {
    if (tr.goal === 'win') return /Checkmate|mate/i.test(tr.item.name) ? `Checkmate the king as ${sideName(tr.side)}.` : `Win as ${sideName(tr.side)}: promote the pawn or checkmate.`
    return `Hold the draw as ${sideName(tr.side)} for ${HOLD_MOVES} moves.`
  }

  async function engineReply() {
    tr.state = 'busy'
    setMsg('The computer is thinking…')
    const res = await engine.search(tree.current.fen, { skill: 20, depth: 14, movetime: 900 })
    if (!res.bestmove) return
    tree.goTo(tr.tip)
    tree.play({ from: res.bestmove.slice(0, 2), to: res.bestmove.slice(2, 4), promotion: res.bestmove[4] })
    tr.tip = tree.current
    render(true)
    const c = tree.chessAt()
    if (c.game_over()) { endgameOver(c); return }
    yourTurn()
  }

  function endgameOver(c) {
    if (c.in_checkmate()) {
      if (c.turn() !== tr.side) finishRun()
      else { setMsg('You were checkmated. Try the run again.', 'wrong'); tr.state = 'done'; showPanel() }
      return
    }
    // draw by rule
    if (tr.goal === 'draw') finishRun()
    else { setMsg('That ended in a draw. Try the run again.', 'wrong'); tr.state = 'done'; showPanel() }
  }

  async function judgeEndgameMove(node) {
    tr.state = 'busy'
    setMsg('Checking your move…')
    const c = tree.chessAt(node)
    let ok
    if (c.in_checkmate()) ok = true
    else if (c.game_over()) ok = tr.goal === 'draw'
    else {
      const best = await tr.best
      const res = await engine.search(node.fen, { skill: 20, depth: 12, movetime: 700 })
      const s = userScore(res.score, false)
      const b = best === null ? s : best
      // a move fails if it gives up much of what the best move keeps
      ok = tr.goal === 'win' ? !((s < b - 150 && s < 600) || s <= 50) : !(s < -200 && s < b - 100)
    }
    if (!ok) { stepBack(node, tr.goal === 'win' ? 'That move lets the win slip away.' : 'That move loses.'); return }
    if (c.game_over()) { endgameOver(c); return }
    // a promotion that keeps the win completes pawn endgames
    if (tr.goal === 'win' && node.san.includes('=') && !/Checkmate|mate/i.test(tr.item.name)) { finishRun(); return }
    tr.safeMoves++
    if (tr.goal === 'draw' && tr.safeMoves >= HOLD_MOVES) { finishRun(); return }
    await engineReply()
  }

  // ---------- shared ----------
  function afterUserMove(node) {
    tr.tip = node
    if (tr.kind === 'openings') {
      const expected = tr.moves[tr.idx]
      if (node.uci !== expected.uci) { stepBack(node, 'That’s not the book move.'); return }
      tr.idx++
      if (tr.idx >= tr.moves.length) { finishRun(); return }
      tr.state = 'busy'
      tr.timer = setTimeout(opponentBookMove, 450)
    } else {
      judgeEndgameMove(node).catch(e => { console.error(e); yourTurn() })
    }
  }

  // Woodpecker rule: a missed move is taken back and you try again.
  function stepBack(node, why) {
    tr.mistakes++
    tr.state = 'busy'
    board.addMarker(MK_WRONG, node.to)
    setMsg(`${why} Going back a step. Try again.`, 'wrong')
    tr.timer = setTimeout(() => {
      tree.goTo(node)
      tree.deleteFromHere()
      tr.tip = tree.current
      render(true)
      tr.state = 'yourturn'
      showPanel()
    }, 900)
  }

  function finishRun() {
    tr.state = 'done'
    const secs = Math.round((Date.now() - tr.startedAt) / 1000)
    tr.runs.push({ key: tr.kind === 'openings' ? tr.item.pgn : tr.item.fen, mistakes: tr.mistakes, secs })
    const n = tr.runs.length
    setMsg(tr.mistakes ? `Run ${n} complete with ${tr.mistakes} ${tr.mistakes === 1 ? 'miss' : 'misses'}. Run it again!` : `Run ${n} complete with no misses!`, 'good')
    showPanel()
    if (tr.kind === 'openings') showVariations()
  }

  // Other lines of the same opening, best matches first: lines that branch off this one, then the rest of the family.
  async function showVariations() {
    await loadOpenings().catch(() => {})
    const family = tr.item.name.split(':')[0].trim()
    const mine = tr.moves.map(m => m.san)
    const shared = o => {
      const sans = o.pgn.split(/\s+/).filter(t => t && !/^\d+\./.test(t))
      let k = 0
      while (k < sans.length && k < mine.length && sans[k] === mine[k]) k++
      return { k, len: sans.length }
    }
    const seen = new Set([tr.item.pgn])
    const picks = openingList
      .filter(o => o.name.split(':')[0].trim() === family && !seen.has(o.pgn) && (seen.add(o.pgn), true))
      .map(o => ({ o, ...shared(o) }))
      .filter(x => x.len >= 4 && x.len <= 16 && x.k >= Math.min(2, mine.length))
      .sort((a, b) => b.k - a.k || a.len - b.len)
      .slice(0, 8)
    const box = $('#tr-vars-list')
    box.innerHTML = ''
    for (const { o } of picks) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'result'
      b.innerHTML = '<strong></strong><span></span>'
      b.querySelector('strong').textContent = o.name
      b.querySelector('span').textContent = o.pgn
      b.addEventListener('click', () => {
        tr.chosen = { name: o.name, pgn: o.pgn }
        tr.item = tr.chosen
        tr.moves = lineToUci(o.pgn)
        tr.runs = []
        beginRun()
      })
      box.append(b)
    }
    $('#tr-vars').hidden = !picks.length
  }

  // First hint shows which piece to move; the second shows the move.
  async function hint() {
    if (tr.state !== 'yourturn') return
    if (tree.current !== tr.tip) { tree.goTo(tr.tip); render(false) }
    const fen = tr.tip.fen
    if (tr.hint.fen !== fen) {
      let move = null
      if (tr.kind === 'openings') move = tr.moves[tr.idx].uci
      else {
        $('#tr-hint').disabled = true
        try { move = (await engine.search(fen, { skill: 20, depth: 14, movetime: 900 })).bestmove } finally { $('#tr-hint').disabled = false }
      }
      tr.hint = { fen, move, stage: 0 }
    }
    if (!tr.hint.move || tree.current.fen !== fen) return
    tr.hint.stage++
    const from = tr.hint.move.slice(0, 2), to = tr.hint.move.slice(2, 4)
    if (tr.hint.stage === 1) board.addMarker(MK_HINT, from)
    else { board.removeMarkers(MK_HINT); board.addArrow(AR_HINT, from, to) }
  }

  function setMsg(text, kind = '') {
    const m = $('#tr-msg')
    m.textContent = text
    m.className = 'play-msg' + (kind ? ` msg-${kind}` : '')
  }

  function fmt(secs) { return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` }

  function showPanel() {
    const live = tr.state !== 'idle'
    $('#tr-pick').hidden = live
    $('#tr-live').hidden = !live
    if (!live) return
    $('#tr-title').textContent = tr.item.name
    $('#tr-progress').textContent = tr.kind === 'openings'
      ? `Move ${Math.min(Math.floor(tr.idx / 2) + 1, Math.ceil(tr.moves.length / 2))} of ${Math.ceil(tr.moves.length / 2)} · You play ${sideName(tr.side)}`
      : `You play ${sideName(tr.side)}` + (tr.goal ? ` · Goal: ${tr.goal === 'win' ? 'win' : 'draw'}` : '')
    $('#tr-line').hidden = tr.kind !== 'openings'
    $('#tr-line-text').textContent = tr.kind === 'openings' ? tr.item.pgn : ''
    $('#tr-hint').disabled = tr.state !== 'yourturn'
    $('#tr-back').hidden = !(tr.state === 'yourturn' && tree.current !== tr.tip)
    const log = $('#tr-log')
    log.innerHTML = ''
    tr.runs.forEach((r, i) => {
      const li = document.createElement('li')
      li.textContent = `Run ${i + 1}: ${r.mistakes} ${r.mistakes === 1 ? 'miss' : 'misses'}, ${fmt(r.secs)}`
      log.append(li)
    })
    $('#tr-log-wrap').hidden = !tr.runs.length
  }

  function canMove() {
    return tr.state === 'yourturn' && tree.current === tr.tip && tree.chessAt().turn() === tr.side
  }

  function setKind(kind) {
    tr.kind = kind
    for (const b of document.querySelectorAll('.seg-btn')) b.setAttribute('aria-pressed', b.dataset.kind === kind)
    $('#tr-openings').hidden = kind !== 'openings'
    $('#tr-endgames').hidden = kind !== 'endgames'
    $('#tr-coords').hidden = kind !== 'coords'
    $('#tr-intro').hidden = kind === 'coords'
  }

  async function enter() {
    loadOpenings().catch(() => {})
    engine.start().catch(() => {})
    if (tr.state === 'idle') { render(false); showPanel(); return }
    tree.goTo(tr.tip)
    render(false)
    if (tr.state === 'paused') yourTurn()
  }

  function leave() {
    if (co.running || !$('#panel-coords').hidden) stopCoords()
    clearTimeout(tr.timer)
    if (tr.state !== 'idle' && tr.state !== 'done') tr.state = 'paused'
  }

  // ---------- coordinate trainer ----------
  const FILES = 'abcdefgh', RANKS = '12345678'
  const co = { running: false, target: null, score: 0, misses: 0, left: 0, timer: null, best: {} }
  const randSq = () => FILES[Math.floor(Math.random() * 8)] + RANKS[Math.floor(Math.random() * 8)]

  function startCoords() {
    co.mode = $('#co-mode').value
    co.sideChoice = $('#co-side').value
    co.secs = +$('#co-time').value
    co.score = 0; co.misses = 0; co.left = co.secs
    co.running = true
    document.body.classList.toggle('hide-coords', !$('#co-labels').checked)
    document.body.classList.add('coords-on')
    ctx.setInput(false)
    board.removeMarkers(); board.removeArrows()
    board.setPosition('8/8/8/8/8/8/8/8', false)
    $('#panel-train').hidden = true
    $('#panel-coords').hidden = false
    $('#co-again').hidden = true
    $('#co-stop').textContent = 'Stop'
    board.enableSquareSelect('pointerdown', onCoordClick)
    nextTarget()
    showTimer()
    clearInterval(co.timer)
    co.timer = setInterval(() => { co.left--; showTimer(); if (co.left <= 0) endCoords() }, 1000)
  }

  function nextTarget() {
    if (co.sideChoice === 'random') board.setOrientation(Math.random() < 0.5 ? COLOR.white : COLOR.black)
    else board.setOrientation(co.sideChoice === 'w' ? COLOR.white : COLOR.black)
    let t
    do { t = randSq() } while (t === co.target)
    co.target = t
    board.removeMarkers(MK_HINT)
    const choices = $('#co-choices')
    choices.innerHTML = ''
    if (co.mode === 'find') {
      $('#co-prompt').textContent = t
    } else {
      $('#co-prompt').textContent = 'Which square is outlined?'
      board.addMarker(MK_HINT, t)
      const opts = new Set([t])
      while (opts.size < 4) opts.add(randSq())
      for (const o of [...opts].sort(() => Math.random() - 0.5)) {
        const b = document.createElement('button')
        b.type = 'button'; b.className = 'btn btn-secondary co-choice'; b.textContent = o
        b.addEventListener('click', () => answer(o, null))
        choices.append(b)
      }
    }
    $('#co-score').textContent = `Score: ${co.score}` + (co.misses ? ` · Misses: ${co.misses}` : '')
  }

  function onCoordClick(e) {
    if (!co.running || co.mode !== 'find' || !e.square) return
    answer(e.square, e.square)
  }

  function answer(guess, square) {
    if (!co.running) return
    const right = guess === co.target
    if (right) co.score++; else co.misses++
    const mark = square || co.target
    board.addMarker(right ? MK_GOOD : MK_WRONG, mark)
    if (!right && square) board.addMarker(MK_GOOD, co.target)
    setTimeout(() => { board.removeMarkers(MK_GOOD); board.removeMarkers(MK_WRONG) }, right ? 250 : 700)
    nextTarget()
  }

  function showTimer() {
    const t = Math.max(0, co.left)
    $('#co-timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
    $('#co-timer').classList.toggle('timer-low', t <= 5)
  }

  function endCoords() {
    clearInterval(co.timer)
    co.running = false
    board.removeMarkers()
    const key = co.mode + co.secs
    const prev = co.best[key] || 0
    co.best[key] = Math.max(prev, co.score)
    $('#co-prompt').textContent = `Time! Score: ${co.score}`
    $('#co-choices').innerHTML = ''
    $('#co-score').textContent = (co.score > prev && prev > 0 ? 'New best this session! ' : '') + `Best this session: ${co.best[key]}` + (co.misses ? ` · Misses: ${co.misses}` : '')
    $('#co-again').hidden = false
    $('#co-stop').textContent = 'Done'
  }

  function stopCoords() {
    clearInterval(co.timer)
    co.running = false
    board.disableSquareSelect('pointerdown')
    board.removeMarkers()
    document.body.classList.remove('hide-coords', 'coords-on')
    $('#panel-coords').hidden = true
    $('#panel-train').hidden = false
    ctx.setInput(true)
    render(false)
  }

  // ---------- wiring ----------
  for (const b of document.querySelectorAll('.seg-btn')) b.addEventListener('click', () => setKind(b.dataset.kind))
  $('#tr-starter').addEventListener('change', e => { if (e.target.value !== '') choose(STARTER_LINES[+e.target.value]) })
  $('#tr-search').addEventListener('input', e => { loadOpenings().then(() => search(e.target.value)) })
  $('#tr-start').addEventListener('click', startOpening)
  $('#tr-start-endgame').addEventListener('click', startEndgame)
  $('#tr-again').addEventListener('click', () => { if (tr.item) beginRun() })
  $('#co-start').addEventListener('click', startCoords)
  $('#co-again').addEventListener('click', startCoords)
  $('#co-stop').addEventListener('click', () => { if (co.running) endCoords(); else stopCoords() })
  $('#tr-hint').addEventListener('click', hint)
  $('#tr-back').addEventListener('click', () => { tree.goTo(tr.tip); render(true) })
  $('#tr-change').addEventListener('click', () => { clearTimeout(tr.timer); tr.state = 'idle'; tr.runs = []; showPanel() })
  buildMenus()
  setKind('openings')
  if (location.search.includes('test')) window.__tr = tr

  return { enter, leave, canMove, afterUserMove, renderPanel: showPanel }
}
