import { Chessboard, COLOR, INPUT_EVENT_TYPE, BORDER_TYPE, POINTER_EVENTS } from '../vendor/cm-chessboard/src/Chessboard.js'
import { Markers } from '../vendor/cm-chessboard/src/extensions/markers/Markers.js'
import { Arrows } from '../vendor/cm-chessboard/src/extensions/arrows/Arrows.js'
import { RightClickAnnotator } from '../vendor/cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js'
import { PromotionDialog, PROMOTION_DIALOG_RESULT_TYPE } from '../vendor/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js'
import { Accessibility } from '../vendor/cm-chessboard/src/extensions/accessibility/Accessibility.js'
import { Chess, SQUARES } from '../vendor/chessjs/chess.js'
import { GameTree, START_FEN, moveNumberLabel } from './gametree.js'
import { Engine, uciToMove } from './engine.js'
import { loadOpenings, openingFor } from './openings.js'
import { initPuzzles } from './puzzles.js'
import { PIECE_SPRITE } from './offline.js'
import { initTrain } from './train.js'
import { initPairings } from './pairings.js'
import { capturedFromFen, renderCaptures, whiteScore, scoreText, whitePercent, pvToSan, winChance, terminalScore, judgment } from './analysis.js'

import { MK_LAST, MK_CHECK, MK_SELECT, MK_WRONG, MK_GOOD, MK_HINT, AR_HINT } from './marks.js'

const ANNOTATION_CLASSES = new Set(['arrow-success', 'arrow-warning', 'arrow-info', 'arrow-danger',
  'marker-circle-success', 'marker-circle-warning', 'marker-circle-info', 'marker-circle-danger'])

// ---------- state ----------
const $ = sel => document.querySelector(sel)
const tree = new GameTree()
const engine = new Engine()
let mode = 'board' // 'board' | 'play' | 'puzzles' | 'train' | 'pairings' | 'setup'
const game = { active: false, over: false, userColor: 'w', level: 3, tip: null, thinking: false, result: '' }
const setup = { tool: 'wp', selected: null, previousFen: null }

const board = new Chessboard($('#board'), {
  position: START_FEN,
  assetsUrl: 'vendor/cm-chessboard/assets/',
  style: {
    cssClass: 'booked',
    borderType: BORDER_TYPE.frame,
    showCoordinates: true,
    pieces: { file: 'pieces/standard.svg' },
    animationDuration: 220
  },
  extensions: [
    { class: Markers },
    { class: Arrows },
    { class: RightClickAnnotator },
    { class: PromotionDialog },
    { class: Accessibility, props: { visuallyHidden: true, language: 'en' } }
  ]
})

// ---------- helpers ----------
function saveAnnotations() {
  const node = tree.current
  const arrows = board.getArrows().filter(a => ANNOTATION_CLASSES.has(a.type.class))
  const markers = board.getMarkers().filter(m => ANNOTATION_CLASSES.has(m.type.class))
  node.annotations = (arrows.length || markers.length) ? { arrows, markers } : null
}

function clearAnnotations() {
  board.setAnnotations({ arrows: [], markers: [] })
  tree.current.annotations = null
}

function navigate(fn) {
  if (mode === 'setup') return
  saveAnnotations()
  fn()
  render(true)
}

function canUserMove() {
  if (mode === 'board') return true
  if (mode === 'play') {
    return game.active && !game.over && !game.thinking && tree.current === game.tip &&
      tree.chessAt().turn() === game.userColor
  }
  if (mode === 'puzzles') return puzzles.canMove()
  if (mode === 'train') return train.canMove()
  return false
}

function statusText(chess) {
  if (chess.in_checkmate()) return `Checkmate. ${chess.turn() === 'w' ? 'Black' : 'White'} wins.`
  if (chess.in_stalemate()) return 'Stalemate. The game is a draw.'
  if (chess.insufficient_material()) return 'Draw by insufficient material.'
  if (chess.in_threefold_repetition()) return 'Draw by repetition.'
  if (chess.in_draw()) return 'Draw by the 50-move rule.'
  return ''
}

// ---------- rendering ----------
function render(animate = false) {
  const node = tree.current
  board.setPosition(node.fen, animate)
  for (const t of [MK_LAST, MK_CHECK, MK_SELECT, MK_WRONG, MK_GOOD, MK_HINT]) board.removeMarkers(t)
  board.removeArrows(AR_HINT)
  board.setAnnotations(node.annotations || { arrows: [], markers: [] })
  if (node.from) { board.addMarker(MK_LAST, node.from); board.addMarker(MK_LAST, node.to) }
  const chess = tree.chessAt()
  if (chess.in_check()) {
    const king = SQUARES.find(sq => { const p = chess.get(sq); return p && p.type === 'k' && p.color === chess.turn() })
    if (king) board.addMarker(MK_CHECK, king)
  }
  renderMoves()
  renderInfo(chess)
  renderCapturesBoth()
  clearStaleReview()
  requestAnalysis()
  if (mode === 'play') renderPlayPanel()
  if (mode === 'puzzles') puzzles.renderPanel()
  if (mode === 'train') train.renderPanel()
}

function renderInfo(chess) {
  const op = (mode === 'puzzles' || (mode === 'train' && tree.root.fen !== START_FEN)) ? null : openingFor(tree.pathToCurrent())
  $('#opening').textContent = op ? `${op.eco} ${op.name}` : ''
  const st = statusText(chess)
  const turn = chess.turn() === 'w' ? 'White to move' : 'Black to move'
  $('#status').textContent = st || turn
  $('#status').classList.toggle('status-end', !!st)
  const c = $('#comment')
  if (document.activeElement !== c) c.value = tree.current.comment || ''
}

// Move list: numbered rows with White and Black columns. Side lines and notes appear under the row.
function renderMoves() {
  const box = $('#moves')
  box.innerHTML = ''
  if (tree.root.comment) box.append(noteBlock(tree.root.comment))
  let row = null
  let node = tree.root
  while (node.children.length) {
    const [main, ...vars] = node.children
    const whiteMove = main.ply % 2 === 1
    if (whiteMove || !row || row.full) {
      row = newRow(main)
      box.append(row.el)
      if (!whiteMove) row.white.append(dots())
    }
    const cell = whiteMove ? row.white : row.black
    cell.append(moveEl(main, false, true))
    if (!whiteMove) row.full = true
    if (main.comment || vars.length) {
      if (main.comment) box.append(noteBlock(main.comment))
      for (const v of vars) box.append(variationBlock(v))
      row.full = true
    }
    node = main
  }
  if (!tree.root.children.length) {
    const p = document.createElement('p')
    p.className = 'muted empty'
    p.textContent = mode === 'puzzles' ? 'The puzzle moves will appear here.' : mode === 'train' ? 'The drill moves will appear here.' : 'Make a move on the board. Moves will appear here.'
    box.append(p)
  }
  // keep the selected move visible inside the list without scrolling the whole page
  const cur = box.querySelector('.move.current')
  if (cur) {
    const top = cur.offsetTop - box.offsetTop, bottom = top + cur.offsetHeight
    if (top < box.scrollTop) box.scrollTop = top - 8
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 8
  }
}

function newRow(node) {
  const el = document.createElement('div')
  el.className = 'mrow'
  const num = document.createElement('span')
  num.className = 'mno'
  num.textContent = Math.floor((node.ply - 1) / 2) + 1
  const white = document.createElement('span'); white.className = 'mcell'
  const black = document.createElement('span'); black.className = 'mcell'
  el.append(num, white, black)
  return { el, white, black, full: false }
}

function dots() { const s = document.createElement('span'); s.className = 'dots'; s.textContent = '…'; return s }

function moveEl(node, force, inTable = false) {
  const span = document.createElement('span')
  span.className = 'move' + (node === tree.current ? ' current' : '') + (inTable ? ' in-table' : '')
  span.dataset.id = node.id
  const label = inTable ? '' : moveNumberLabel(node, force)
  if (label) { const n = document.createElement('span'); n.className = 'num'; n.textContent = label + ' '; span.append(n) }
  span.append(node.san)
  if (node.judgment) {
    const j = document.createElement('span')
    j.className = 'judg judg-' + node.judgment.cls
    j.textContent = node.judgment.sym
    j.title = node.judgment.word
    span.append(j)
  }
  span.tabIndex = 0
  return span
}

// ---------- captured pieces ----------
function renderCapturesBoth() {
  const { taken, material } = capturedFromFen(tree.current.fen)
  const top = board.getOrientation() === COLOR.white ? 'b' : 'w'
  const bottom = top === 'w' ? 'b' : 'w'
  const ahead = c => (c === 'w' ? material : -material)
  renderCaptures($('#cap-top'), taken[top], ahead(top))
  renderCaptures($('#cap-bottom'), taken[bottom], ahead(bottom))
}

// ---------- analysis (Board tab) ----------
const analysis = { on: true, busy: false, timer: null, reviewing: false, reviewedKey: null }

// The review summary belongs to one game; clear it when the board holds a different game or the main line changes.
function mainlineKey() { return tree.root.id + ':' + tree.mainlineEnd().id }
function clearStaleReview() {
  if (analysis.reviewing || analysis.reviewedKey === null) return
  if (analysis.reviewedKey !== mainlineKey()) { analysis.reviewedKey = null; $('#an-review').innerHTML = '' }
}

// The evaluation bar shows who is ahead, never which move is best.
function analysisAllowed() {
  return analysis.on && !['setup', 'pairings', 'puzzles'].includes(mode) && !document.body.classList.contains('coords-on')
}

function requestAnalysis() {
  const show = analysisAllowed()
  document.body.classList.toggle('analysis-on', show)
  if (!show) return
  clearTimeout(analysis.timer)
  analysis.timer = setTimeout(runAnalysis, 150)
}

function showEval(ws, fen, pv) {
  if (tree.current.fen !== fen) return
  const pct = whitePercent(ws)
  const fill = $('#eval-fill')
  // the white part sits at the bottom when White is at the bottom of the board
  fill.style.height = (board.getOrientation() === COLOR.white ? pct : 100 - pct) + '%'
  $('#evalbar').classList.toggle('flipped', board.getOrientation() !== COLOR.white)
  $('#eval-num').textContent = scoreText(ws)
}

async function runAnalysis() {
  if (analysis.busy || analysis.reviewing) return
  const fen = tree.current.fen
  const term = terminalScore(fen)
  if (term) {
    const ws = term.draw ? { cp: 0 } : { mate: 0 }
    $('#eval-fill').style.height = term.draw ? '50%' : ((term.winner === 'w') === (board.getOrientation() === COLOR.white) ? '100%' : '0%')
    $('#eval-num').textContent = term.draw ? '½' : (term.winner === 'w' ? '1-0' : '0-1')
    void ws
    return
  }
  // let the computer opponent, puzzle checks and drills go first
  if (engine.pending > 0) { clearTimeout(analysis.timer); analysis.timer = setTimeout(runAnalysis, 400); return }
  analysis.busy = true
  try {
    const res = await engine.search(fen, {
      skill: 20, depth: 16, movetime: 1500, background: true,
      onInfo: info => { if (info.score) showEval(whiteScore(info.score, fen), fen, info.pv) }
    })
    if (res.score) showEval(whiteScore(res.score, fen), fen)
  } catch (e) { console.error(e) } finally {
    analysis.busy = false
    if (analysisAllowed() && tree.current.fen !== fen) requestAnalysis()
  }
}

function setAnalysis(on) {
  analysis.on = on
  $('#btn-analysis').setAttribute('aria-pressed', on)
  $('#btn-analysis').textContent = on ? 'Hide Evaluation Bar' : 'Show Evaluation Bar'
  if (on) engine.start().catch(() => toast('The computer could not start on this computer.'))
  requestAnalysis()
}

// Review the main line: find inaccuracies, mistakes, and blunders.
async function reviewGame() {
  if (analysis.reviewing) return
  const line = [tree.root]
  for (let n = tree.root; n.children.length;) { n = n.children[0]; line.push(n) }
  if (line.length < 2) { toast('Play or load a game first.'); return }
  analysis.reviewing = true
  $('#btn-review').disabled = true
  const evals = []
  try {
    await engine.start()
    for (let i = 0; i < line.length; i++) {
      $('#an-review').textContent = `Reviewing position ${i + 1} of ${line.length}…`
      const fen = line[i].fen
      const term = terminalScore(fen)
      if (term) { evals.push(term.draw ? 50 : (term.winner === 'w' ? 100 : 0)); continue }
      const res = await engine.search(fen, { skill: 20, depth: 13, movetime: 600 })
      evals.push(winChance(whiteScore(res.score, fen)))
    }
    const counts = { w: { blunder: 0, mistake: 0, inaccuracy: 0 }, b: { blunder: 0, mistake: 0, inaccuracy: 0 } }
    for (let i = 1; i < line.length; i++) {
      const mover = line[i - 1].fen.split(' ')[1]
      const drop = mover === 'w' ? evals[i - 1] - evals[i] : evals[i] - evals[i - 1]
      const j = judgment(drop)
      line[i].judgment = j
      if (j) counts[mover][j.word]++
    }
    const say = c => `${c.blunder} ${c.blunder === 1 ? 'blunder' : 'blunders'}, ${c.mistake} ${c.mistake === 1 ? 'mistake' : 'mistakes'}, ${c.inaccuracy} ${c.inaccuracy === 1 ? 'inaccuracy' : 'inaccuracies'}`
    $('#an-review').innerHTML = ''
    for (const [c, label] of [['w', 'White'], ['b', 'Black']]) {
      const p = document.createElement('p')
      p.textContent = `${label}: ${say(counts[c])}`
      $('#an-review').append(p)
    }
    const key = document.createElement('p')
    key.className = 'an-key'
    key.innerHTML = '<span class="judg judg-blunder">??</span> blunder <span class="judg judg-mistake">?</span> mistake <span class="judg judg-inaccuracy">?!</span> inaccuracy'
    $('#an-review').append(key)
    analysis.reviewedKey = mainlineKey()
    renderMoves()
  } catch (e) {
    console.error(e)
    $('#an-review').textContent = 'The review could not finish.'
  } finally {
    analysis.reviewing = false
    $('#btn-review').disabled = false
    requestAnalysis()
  }
}

function noteBlock(text) {
  const d = document.createElement('div')
  d.className = 'note-block'
  d.textContent = text
  return d
}

function commentEl(text) {
  const c = document.createElement('span')
  c.className = 'note'
  c.textContent = text
  return c
}

function variationBlock(v) {
  const d = document.createElement('div')
  d.className = 'var-block'
  d.append(moveEl(v, true))
  if (v.comment) d.append(commentEl(v.comment))
  writeInline(v, false, d)
  return d
}

function writeInline(node, force, container) {
  if (!node.children.length) return
  const [main, ...vars] = node.children
  container.append(moveEl(main, force))
  if (main.comment) container.append(commentEl(main.comment))
  for (const v of vars) {
    const box = document.createElement('span')
    box.className = 'variation'
    box.append(moveEl(v, true))
    if (v.comment) box.append(commentEl(v.comment))
    writeInline(v, false, box)
    container.append(box)
  }
  writeInline(main, vars.length > 0 || !!main.comment, container)
}

$('#moves').addEventListener('click', e => {
  const el = e.target.closest('.move')
  if (!el) return
  navigate(() => tree.goTo(tree.find(+el.dataset.id)))
})
$('#moves').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const el = e.target.closest('.move'); if (el) el.click() }
})

// ---------- move input ----------
function onInput(event) {
  if (event.type === INPUT_EVENT_TYPE.movingOverSquare) return
  if (event.type !== INPUT_EVENT_TYPE.moveInputFinished) board.removeLegalMovesMarkers()
  if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
    if (!canUserMove()) return false
    const chess = tree.chessAt()
    const piece = chess.get(event.squareFrom)
    if (!piece || piece.color !== chess.turn()) return false
    const moves = chess.moves({ square: event.squareFrom, verbose: true })
    board.addLegalMovesMarkers(moves)
    return moves.length > 0
  }
  if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
    const chess = tree.chessAt()
    const moves = chess.moves({ square: event.squareFrom, verbose: true }).filter(m => m.to === event.squareTo)
    if (!moves.length) return false
    if (moves.some(m => m.promotion)) {
      const color = chess.turn() === 'w' ? COLOR.white : COLOR.black
      board.showPromotionDialog(event.squareTo, color, result => {
        if (result.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) {
          const move = { from: event.squareFrom, to: event.squareTo, promotion: result.piece.charAt(1) }
          if (mode === 'puzzles' && !puzzles.accept(move)) { render(false); return }
          userMove(move)
        } else {
          render(false)
        }
      })
      return true
    }
    const move = { from: event.squareFrom, to: event.squareTo }
    if (mode === 'puzzles' && !puzzles.accept(move)) return false
    event.chessboard.state.moveInputProcess.then(() => userMove(move))
    return true
  }
}

function userMove(move) {
  saveAnnotations()
  const node = tree.play(move)
  if (!node) { render(false); return }
  if (mode === 'play') { game.tip = node; checkGameOver() }
  render(true)
  if (mode === 'play' && !game.over) computerTurn()
  if (mode === 'puzzles') puzzles.afterUserMove(node)
  if (mode === 'train') train.afterUserMove(node)
}

board.enableMoveInput(onInput)

// A plain left-click on the board clears drawn arrows and circles.
$('#board').addEventListener('pointerdown', e => {
  if (e.button === 0 && mode !== 'setup' && board.getAnnotations) {
    const a = board.getAnnotations()
    if (a.arrows.some(x => ANNOTATION_CLASSES.has(x.type.class)) || a.markers.some(x => ANNOTATION_CLASSES.has(x.type.class))) clearAnnotations()
  }
}, true)

// ---------- play the computer ----------
function checkGameOver() {
  const chess = tree.chessAt(game.tip)
  const st = statusText(chess)
  if (st) { game.over = true; game.result = st }
  return game.over
}

async function computerTurn() {
  if (!game.active || game.over) return
  const fenAtStart = game.tip.fen
  game.thinking = true
  renderPlayPanel()
  try {
    const uci = await engine.computerMove(fenAtStart, game.level)
    if (!game.active || game.tip.fen !== fenAtStart) return
    if (!uci) return
    saveAnnotations()
    tree.goTo(game.tip)
    game.tip = tree.play(uciToMove(uci))
    checkGameOver()
  } catch (e) {
    console.error(e)
    toast('The computer could not start. Try reloading the page.')
  } finally {
    game.thinking = false
    if (mode === 'play') render(true)
  }
}

function startGame() {
  const colorChoice = $('#play-color').value
  game.userColor = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice
  game.level = +$('#play-level').value
  const from = $('#play-from').value
  saveAnnotations()
  tree.reset(from === 'new' ? START_FEN : tree.current.fen)
  tree.headers = {
    White: game.userColor === 'w' ? 'Player' : `Computer (level ${game.level})`,
    Black: game.userColor === 'b' ? 'Player' : `Computer (level ${game.level})`
  }
  game.active = true; game.over = false; game.result = ''; game.tip = tree.current
  board.setOrientation(game.userColor === 'w' ? COLOR.white : COLOR.black)
  engine.start().catch(() => toast('The computer could not start on this computer.'))
  render(false)
  if (!checkGameOver() && tree.chessAt(game.tip).turn() !== game.userColor) computerTurn()
}

function endGame() {
  game.active = false; game.over = false; game.thinking = false
  engine.stop()
  renderPlayPanel()
}

function takeBack() {
  if (!game.active || game.thinking) return
  saveAnnotations()
  let n = game.tip.parent
  while (n && new Chess(n.fen).turn() !== game.userColor) n = n.parent
  if (!n) { toast('There is no move of yours to take back yet.'); return }
  tree.goTo(n)
  tree.truncateAfterCurrent()
  game.tip = n; game.over = false; game.result = ''
  render(false)
}

// First hint shows which piece to move; the second shows the move.
const playHint = { fen: null, move: null, stage: 0 }
async function hint() {
  if (!game.active || game.thinking || game.over) return
  if (tree.current !== game.tip) { tree.goTo(game.tip); render(false) }
  $('#hint-btn').disabled = true
  try {
    if (playHint.fen !== game.tip.fen) {
      const res = await engine.search(game.tip.fen, { skill: 20, depth: 14, movetime: 1200 })
      Object.assign(playHint, { fen: game.tip.fen, move: res.bestmove, stage: 0 })
    }
    if (!playHint.move || tree.current !== game.tip) return
    const m = uciToMove(playHint.move)
    playHint.stage++
    if (playHint.stage === 1) board.addMarker(MK_HINT, m.from)
    else { board.removeMarkers(MK_HINT); board.addArrow(AR_HINT, m.from, m.to) }
  } finally { $('#hint-btn').disabled = false }
}

function renderPlayPanel() {
  $('#play-setup').hidden = game.active
  $('#play-live').hidden = !game.active
  if (!game.active) return
  const you = game.userColor === 'w' ? 'White' : 'Black'
  $('#play-who').textContent = `You are playing ${you} against the computer at level ${game.level}.`
  let msg = ''
  if (game.over) msg = game.result + (game.result.includes('wins') ? (game.result.startsWith(you) ? ' Well played!' : ' Good game.') : '')
  else if (game.thinking) msg = 'The computer is thinking…'
  else if (tree.current !== game.tip) msg = 'You are looking at an earlier move. Click Back to Game to keep playing.'
  else msg = 'Your move.'
  $('#play-msg').textContent = msg
  $('#back-to-game').hidden = tree.current === game.tip
  $('#hint-btn').disabled = game.thinking || game.over
  $('#takeback-btn').disabled = game.thinking
}

$('#play-start').addEventListener('click', startGame)
$('#takeback-btn').addEventListener('click', takeBack)
$('#hint-btn').addEventListener('click', hint)
$('#back-to-game').addEventListener('click', () => navigate(() => tree.goTo(game.tip)))
$('#resign-btn').addEventListener('click', () => {
  if (!game.active) return
  if (!game.over) { game.over = true; game.result = `${game.userColor === 'w' ? 'White' : 'Black'} resigned.` }
  renderPlayPanel()
})
$('#newgame-btn').addEventListener('click', () => { endGame() })
$('#review-btn').addEventListener('click', () => { endGame(); setMode('board') })
$('#play-level').addEventListener('input', e => { $('#play-level-out').textContent = e.target.value })

// ---------- position setup ----------
const PALETTE = ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp']
const PIECE_NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }

function buildPalette() {
  const pal = $('#palette')
  const sprite = PIECE_SPRITE
  const pieceTool = p => ({ id: p, label: `${p[0] === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[p[1]]}` })
  const tools = [{ id: 'move', label: 'Move a piece' }, ...PALETTE.slice(0, 6).map(pieceTool),
    { id: 'erase', label: 'Remove a piece' }, ...PALETTE.slice(6).map(pieceTool)]
  for (const t of tools) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'tool'
    b.dataset.tool = t.id
    b.title = t.label
    b.setAttribute('aria-label', t.label)
    if (t.id === 'move') b.innerHTML = '<span class="tool-text">Move</span>'
    else if (t.id === 'erase') b.innerHTML = '<span class="tool-text">Erase</span>'
    else b.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="${sprite}#${t.id}"/></svg>`
    b.addEventListener('click', () => { setup.tool = t.id; setup.selected = null; board.removeMarkers(MK_SELECT); markTool() })
    pal.append(b)
  }
}
function markTool() {
  for (const b of document.querySelectorAll('#palette .tool')) b.classList.toggle('active', b.dataset.tool === setup.tool)
}

function onSetupSquare(e) {
  const sq = e.square
  if (!sq || (e.event && e.event.button === 2)) return
  if (setup.tool === 'move') {
    if (!setup.selected) {
      if (board.getPiece(sq)) { setup.selected = sq; board.addMarker(MK_SELECT, sq) }
    } else {
      if (sq !== setup.selected) {
        const piece = board.getPiece(setup.selected)
        board.setPiece(setup.selected, null)
        board.setPiece(sq, piece)
      }
      setup.selected = null
      board.removeMarkers(MK_SELECT)
    }
  } else if (setup.tool === 'erase') {
    board.setPiece(sq, null)
  } else {
    board.setPiece(sq, board.getPiece(sq) === setup.tool ? null : setup.tool)
  }
}

// In setup, right-click removes a piece instead of drawing arrows.
function setupRightClick(e) {
  if (e.button !== 2 && e.type !== 'contextmenu') return
  e.stopPropagation()
  e.preventDefault()
  if (e.type === 'mousedown') {
    const el = e.target.closest('[data-square]')
    if (el) board.setPiece(el.dataset.square, null)
  }
}

// Castling is allowed whenever the king and rook are still on their starting squares.
function castlingFromBoard() {
  const has = (sq, p) => board.getPiece(sq) === p
  let c = ''
  if (has('e1', 'wk') && has('h1', 'wr')) c += 'K'
  if (has('e1', 'wk') && has('a1', 'wr')) c += 'Q'
  if (has('e8', 'bk') && has('h8', 'br')) c += 'k'
  if (has('e8', 'bk') && has('a8', 'br')) c += 'q'
  return c || '-'
}

function setupFen() {
  const turn = document.querySelector('input[name="setup-turn"]:checked').value
  return `${board.getPosition()} ${turn} ${castlingFromBoard()} - 0 1`
}

export function checkPosition(fen) {
  const placement = fen.split(' ')[0]
  const count = ch => (placement.match(new RegExp(ch, 'g')) || []).length
  if (count('K') !== 1 || count('k') !== 1) return 'Each side needs exactly one king.'
  const ranks = placement.split('/')
  if (/[pP]/.test(ranks[0]) || /[pP]/.test(ranks[7])) return 'Pawns can’t be on the first or last row.'
  const v = new Chess().validate_fen(fen)
  if (!v.valid) return 'That position isn’t valid: ' + v.error
  const flipped = fen.replace(/ ([wb]) /, (_, t) => ` ${t === 'w' ? 'b' : 'w'} `)
  const other = new Chess()
  if (other.load(flipped) && other.in_check()) return 'The side not to move is in check. Change whose move it is.'
  return null
}

function enterSetup() {
  saveAnnotations()
  setup.previousFen = tree.current.fen
  document.querySelector(`input[name="setup-turn"][value="${tree.current.fen.split(' ')[1]}"]`).checked = true
  board.disableMoveInput()
  board.removeMarkers(); board.removeArrows()
  board.enableSquareSelect(POINTER_EVENTS.pointerdown, onSetupSquare)
  for (const t of ['mousedown', 'mouseup', 'contextmenu']) $('#board').addEventListener(t, setupRightClick, true)
  markTool()
}

function leaveSetup() {
  board.disableSquareSelect(POINTER_EVENTS.pointerdown)
  for (const t of ['mousedown', 'mouseup', 'contextmenu']) $('#board').removeEventListener(t, setupRightClick, true)
  board.removeMarkers(MK_SELECT)
  board.enableMoveInput(onInput)
}

$('#setup-done').addEventListener('click', () => {
  const fen = setupFen()
  const problem = checkPosition(fen)
  if (problem) { toast(problem); return }
  tree.reset(fen)
  setMode('board')
})
$('#setup-cancel').addEventListener('click', () => { board.setPosition(setup.previousFen, false); setMode('board') })
$('#setup-start').addEventListener('click', () => {
  board.setPosition(START_FEN, false)
  document.querySelector('input[name="setup-turn"][value="w"]').checked = true
})
$('#setup-clear').addEventListener('click', () => { board.setPosition('8/8/8/8/8/8/8/8', false) })
$('#setup-fen-load').addEventListener('click', () => {
  const fen = $('#setup-fen').value.trim()
  const full = fen.split(' ').length >= 4 ? fen : `${fen} w - - 0 1`
  const problem = checkPosition(full)
  if (problem) { toast(problem); return }
  tree.reset(full)
  setMode('board')
})

// ---------- modes ----------
function setMode(next) {
  if (mode === 'setup' && next !== 'setup') leaveSetup()
  if (mode === 'play' && next !== 'play' && game.active) endGame()
  if (mode === 'puzzles' && next !== 'puzzles') puzzles.leave()
  if (mode === 'train' && next !== 'train') train.leave()
  if (mode === 'pairings' && next !== 'pairings') pairings.leave()
  mode = next
  document.body.dataset.mode = mode
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', t.dataset.mode === mode || (mode === 'setup' && t.dataset.mode === 'board') ? 'true' : 'false')
  for (const id of ['board', 'play', 'puzzles', 'train', 'pairings', 'setup']) $(`#panel-${id}`).hidden = mode !== id
  $('#moves-card').hidden = mode === 'setup' || mode === 'pairings'
  requestAnalysis()
  if (mode === 'pairings') { pairings.enter(); return }
  if (mode === 'setup') {
    $('#opening').textContent = ''
    $('#status').textContent = 'Setting up a position'
    $('#status').classList.remove('status-end')
    enterSetup()
    return
  }
  if (mode === 'play') renderPlayPanel()
  if (mode === 'puzzles') { puzzles.enter(); return }
  if (mode === 'train') { train.enter(); return }
  render(false)
}

for (const t of document.querySelectorAll('.tab[data-mode]')) t.addEventListener('click', () => setMode(t.dataset.mode))
// the logo and title go back to the home screen (the Board tab)
$('#home-link').addEventListener('click', () => { setMode('board'); window.scrollTo(0, 0) })

// ---------- board tab buttons ----------
$('#btn-start').addEventListener('click', () => navigate(() => tree.toStart()))
$('#btn-back').addEventListener('click', () => navigate(() => tree.back()))
$('#btn-fwd').addEventListener('click', () => navigate(() => tree.forward()))
$('#btn-end').addEventListener('click', () => navigate(() => tree.toEnd()))
$('#btn-flip').addEventListener('click', flip)
$('#btn-setup').addEventListener('click', () => setMode('setup'))
$('#btn-new').addEventListener('click', () => { if (confirmLoss()) { tree.reset(START_FEN); board.setOrientation(COLOR.white); render(false) } })
$('#btn-undo').addEventListener('click', () => {
  if (!tree.current.parent) { toast('There is no move to undo.'); return }
  navigate(() => tree.deleteFromHere())
})
$('#btn-clear-arrows').addEventListener('click', clearAnnotations)
$('#btn-analysis').addEventListener('click', () => setAnalysis(!analysis.on))
$('#btn-review').addEventListener('click', reviewGame)
$('#btn-playhere').addEventListener('click', () => { $('#play-from').value = 'here'; setMode('play') })
$('#btn-copy-pgn').addEventListener('click', () => copyText(tree.toPgn(), 'PGN copied.'))
$('#btn-copy-fen').addEventListener('click', () => copyText(tree.current.fen, 'FEN copied.'))
$('#btn-download-pgn').addEventListener('click', () => {
  const blob = new Blob([tree.toPgn()], { type: 'application/x-chess-pgn' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'booked-for-chess.pgn'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
})
$('#btn-load').addEventListener('click', () => { $('#load-text').value = ''; $('#load-error').textContent = ''; $('#load-dialog').showModal() })
$('#load-go').addEventListener('click', e => {
  e.preventDefault()
  const text = $('#load-text').value.trim()
  if (!text) return
  try {
    if (/^[rnbqkpRNBQKP1-8]+(\/[rnbqkpRNBQKP1-8]+){7}(\s|$)/.test(text)) {
      const full = text.split(/\s+/).length >= 4 ? text : `${text} w - - 0 1`
      const problem = checkPosition(full)
      if (problem) throw new Error(problem)
      tree.reset(full)
    } else {
      const t = GameTree.fromPgn(text)
      Object.assign(tree, { root: t.root, current: t.root, headers: t.headers })
    }
    $('#load-dialog').close()
    render(false)
  } catch (err) {
    $('#load-error').textContent = err.message || 'That couldn’t be read as a game or position.'
  }
})
$('#load-cancel').addEventListener('click', () => $('#load-dialog').close())
$('#comment').addEventListener('input', e => { tree.current.comment = e.target.value; renderMoves() })

function confirmLoss() {
  return !tree.root.children.length || window.confirm('Start a new board? The current moves will be cleared.')
}

function flip() {
  board.setOrientation(board.getOrientation() === COLOR.white ? COLOR.black : COLOR.white, true)
  renderCapturesBoth()
  requestAnalysis()
}

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg) } catch { window.prompt('Copy this:', text) }
}

let toastTimer
function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { t.hidden = true }, 3500)
}

// ---------- projector view and keyboard ----------
function setProjector(on) {
  document.body.classList.toggle('projector', on)
  $('#btn-projector').setAttribute('aria-pressed', on)
  // full screen hides the browser toolbar and the Windows taskbar, which gives the board much more room
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {})
  } catch {}
}
function toggleProjector() { setProjector(!document.body.classList.contains('projector')) }
// leaving full screen with Esc also leaves Projector View
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('projector')) setProjector(false)
})
$('#btn-projector').addEventListener('click', toggleProjector)
$('#btn-projector-exit').addEventListener('click', toggleProjector)

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
  if ($('#load-dialog').open) return
  const k = e.key
  if (k === 'ArrowLeft') { navigate(() => tree.back()); e.preventDefault() }
  else if (k === 'ArrowRight') { navigate(() => tree.forward()); e.preventDefault() }
  else if (k === 'ArrowUp' || k === 'Home') { navigate(() => tree.toStart()); e.preventDefault() }
  else if (k === 'ArrowDown' || k === 'End') { navigate(() => tree.toEnd()); e.preventDefault() }
  else if (k === 'f' || k === 'F') flip()
  else if (k === 'p' || k === 'P') toggleProjector()
  else if (k === 'Escape' && document.body.classList.contains('projector')) toggleProjector()
})

// ---------- puzzles ----------
const puzzles = initPuzzles({ board, tree, render, toast, setMode: m => setMode(m), saveAnnotations, getMode: () => mode })
const train = initTrain({ board, tree, render, toast, engine,
  setInput: on => { if (on) board.enableMoveInput(onInput); else board.disableMoveInput() } })
const pairings = initPairings({ toast })

// ---------- start ----------
buildPalette()
setMode('board')
loadOpenings().then(() => { if (mode !== 'setup') renderInfo(tree.chessAt()) }).catch(() => {})
setTimeout(() => engine.start().catch(() => {}), 1500)
