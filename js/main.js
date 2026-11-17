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

// ---------- marker and arrow styles (colors set in css/site.css) ----------
const MK_LAST = { class: 'mk-last', slice: 'markerSquare' }
const MK_CHECK = { class: 'mk-check', slice: 'markerCircleFilled' }
const MK_SELECT = { class: 'mk-select', slice: 'markerFrame' }
const AR_HINT = { class: 'ar-hint' }
const ANNOTATION_CLASSES = new Set(['arrow-success', 'arrow-warning', 'arrow-info', 'arrow-danger',
  'marker-circle-success', 'marker-circle-warning', 'marker-circle-info', 'marker-circle-danger'])

// ---------- state ----------
const $ = sel => document.querySelector(sel)
const tree = new GameTree()
const engine = new Engine()
let mode = 'board' // 'board' | 'play' | 'setup'
const game = { active: false, over: false, userColor: 'w', level: 3, tip: null, thinking: false, result: '' }
const setup = { tool: 'wp', selected: null, turn: 'w', previousFen: null }

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
  board.removeMarkers(MK_LAST); board.removeMarkers(MK_CHECK); board.removeMarkers(MK_SELECT)
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
  if (mode === 'play') renderPlayPanel()
}

function renderInfo(chess) {
  const op = openingFor(tree.pathToCurrent())
  $('#opening').textContent = op ? `${op.eco} ${op.name}` : ''
  const st = statusText(chess)
  const turn = chess.turn() === 'w' ? 'White to move' : 'Black to move'
  $('#status').textContent = st || turn
  $('#status').classList.toggle('status-end', !!st)
  const c = $('#comment')
  if (document.activeElement !== c) c.value = tree.current.comment || ''
  c.disabled = mode !== 'board'
}

function renderMoves() {
  const box = $('#moves')
  box.innerHTML = ''
  if (tree.root.comment) box.append(commentEl(tree.root.comment))
  writeLine(tree.root, true, box, 0)
  if (!tree.root.children.length) {
    const p = document.createElement('p')
    p.className = 'muted'
    p.textContent = mode === 'play' ? 'Moves will appear here.' : 'Make a move on the board. Moves will appear here.'
    box.append(p)
  }
  const cur = box.querySelector('.move.current')
  if (cur) cur.scrollIntoView({ block: 'nearest' })
}

function moveEl(node, force) {
  const span = document.createElement('span')
  span.className = 'move' + (node === tree.current ? ' current' : '')
  span.dataset.id = node.id
  const label = moveNumberLabel(node, force)
  if (label) { const n = document.createElement('span'); n.className = 'num'; n.textContent = label + ' '; span.append(n) }
  span.append(node.san)
  span.tabIndex = 0
  return span
}

function commentEl(text) {
  const c = document.createElement('span')
  c.className = 'note'
  c.textContent = text
  return c
}

function writeLine(node, force, container, depth) {
  if (!node.children.length) return
  const [main, ...vars] = node.children
  container.append(moveEl(main, force))
  if (main.comment) container.append(commentEl(main.comment))
  for (const v of vars) {
    const box = document.createElement('span')
    box.className = 'variation depth-' + Math.min(depth + 1, 3)
    box.append(moveEl(v, true))
    if (v.comment) box.append(commentEl(v.comment))
    writeLine(v, false, box, depth + 1)
    container.append(box)
  }
  writeLine(main, vars.length > 0 || !!main.comment, container, depth)
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
          userMove({ from: event.squareFrom, to: event.squareTo, promotion: result.piece.charAt(1) })
        } else {
          render(false)
        }
      })
      return true
    }
    event.chessboard.state.moveInputProcess.then(() => userMove({ from: event.squareFrom, to: event.squareTo }))
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
}

board.enableMoveInput(onInput)

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
    if (!game.active || game.tip.fen !== fenAtStart) return // game changed while thinking
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
    render(true)
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
  tree.goTo(game.tip)
  // step back to the last position where it was the player's turn, before their last move
  let n = game.tip.parent
  while (n && new Chess(n.fen).turn() !== game.userColor) n = n.parent
  if (!n) { toast('There is no move of yours to take back yet.'); return }
  tree.goTo(n)
  tree.truncateAfterCurrent()
  game.tip = n; game.over = false; game.result = ''
  render(false)
}

async function hint() {
  if (!game.active || game.thinking || game.over) return
  tree.goTo(game.tip); render(false)
  $('#hint-btn').disabled = true
  try {
    const res = await engine.search(game.tip.fen, { skill: 20, depth: 14, movetime: 1200 })
    if (res.bestmove && tree.current === game.tip) {
      const m = uciToMove(res.bestmove)
      board.addArrow(AR_HINT, m.from, m.to)
    }
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
  const sprite = 'vendor/cm-chessboard/assets/pieces/standard.svg'
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
  if (!sq) return
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
  autoCastling()
}

function autoCastling() {
  const has = (sq, p) => board.getPiece(sq) === p
  const rules = { K: ['e1', 'wk', 'h1', 'wr'], Q: ['e1', 'wk', 'a1', 'wr'], k: ['e8', 'bk', 'h8', 'br'], q: ['e8', 'bk', 'a8', 'br'] }
  for (const [flag, [ks, kp, rs, rp]] of Object.entries(rules)) {
    const box = $(`#castle-${flag === flag.toUpperCase() ? 'w' : 'b'}${flag.toLowerCase()}`)
    const possible = has(ks, kp) && has(rs, rp)
    box.disabled = !possible
    if (!possible) box.checked = false
  }
}

function setupFen() {
  let castle = ''
  if ($('#castle-wk').checked) castle += 'K'
  if ($('#castle-wq').checked) castle += 'Q'
  if ($('#castle-bk').checked) castle += 'k'
  if ($('#castle-bq').checked) castle += 'q'
  const turn = document.querySelector('input[name="setup-turn"]:checked').value
  return `${board.getPosition()} ${turn} ${castle || '-'} - 0 1`
}

function checkPosition(fen) {
  const placement = fen.split(' ')[0]
  const count = ch => (placement.match(new RegExp(ch, 'g')) || []).length
  if (count('K') !== 1 || count('k') !== 1) return 'Each side needs exactly one king.'
  const ranks = placement.split('/')
  if (/[pP]/.test(ranks[0]) || /[pP]/.test(ranks[7])) return 'Pawns can’t be on the first or last row.'
  const v = new Chess().validate_fen(fen)
  if (!v.valid) return 'That position isn’t valid: ' + v.error
  // the side that just moved may not be in check
  const flipped = fen.replace(/ ([wb]) /, (_, t) => ` ${t === 'w' ? 'b' : 'w'} `)
  const other = new Chess()
  if (other.load(flipped) && other.in_check()) return 'The side not to move is in check. Change whose move it is.'
  return null
}

function enterSetup() {
  saveAnnotations()
  setup.previousFen = tree.current.fen
  const parts = tree.current.fen.split(' ')
  document.querySelector(`input[name="setup-turn"][value="${parts[1]}"]`).checked = true
  $('#castle-wk').checked = parts[2].includes('K'); $('#castle-wq').checked = parts[2].includes('Q')
  $('#castle-bk').checked = parts[2].includes('k'); $('#castle-bq').checked = parts[2].includes('q')
  board.disableMoveInput()
  board.removeMarkers(); board.removeArrows()
  board.enableSquareSelect(POINTER_EVENTS.pointerdown, onSetupSquare)
  autoCastling()
  markTool()
}

function leaveSetup() {
  board.disableSquareSelect(POINTER_EVENTS.pointerdown)
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
  autoCastling(); for (const id of ['wk', 'wq', 'bk', 'bq']) $(`#castle-${id}`).checked = true
})
$('#setup-clear').addEventListener('click', () => { board.setPosition('8/8/8/8/8/8/8/8', false); autoCastling() })
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
  mode = next
  document.body.dataset.mode = mode
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', t.dataset.mode === mode || (mode === 'setup' && t.dataset.mode === 'board') ? 'true' : 'false')
  $('#panel-board').hidden = mode !== 'board'
  $('#panel-play').hidden = mode !== 'play'
  $('#panel-setup').hidden = mode !== 'setup'
  $('#moves-card').hidden = mode === 'setup'
  if (mode === 'setup') { $('#opening').textContent = ''; $('#status').textContent = 'Setting up a position'; $('#status').classList.remove('status-end'); enterSetup(); return }
  if (mode === 'play') renderPlayPanel()
  render(false)
}

for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => setMode(t.dataset.mode))

// ---------- board tab buttons ----------
$('#btn-start').addEventListener('click', () => navigate(() => tree.toStart()))
$('#btn-back').addEventListener('click', () => navigate(() => tree.back()))
$('#btn-fwd').addEventListener('click', () => navigate(() => tree.forward()))
$('#btn-end').addEventListener('click', () => navigate(() => tree.toEnd()))
$('#btn-flip').addEventListener('click', flip)
$('#btn-setup').addEventListener('click', () => setMode('setup'))
$('#btn-new').addEventListener('click', () => { if (confirmLoss()) { tree.reset(START_FEN); board.setOrientation(COLOR.white); render(false) } })
$('#btn-delete').addEventListener('click', () => navigate(() => tree.deleteFromHere()))
$('#btn-promote').addEventListener('click', () => { tree.promote(); render(false) })
$('#btn-clear-arrows').addEventListener('click', () => { board.setAnnotations({ arrows: [], markers: [] }); tree.current.annotations = null })
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
$('#btn-load').addEventListener('click', () => { $('#load-text').value = ''; $('#load-dialog').showModal() })
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

// ---------- projector mode and keyboard ----------
function toggleProjector() {
  document.body.classList.toggle('projector')
  $('#btn-projector').setAttribute('aria-pressed', document.body.classList.contains('projector'))
}
$('#btn-projector').addEventListener('click', toggleProjector)

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
})

// ---------- start ----------
buildPalette()
setMode('board')
loadOpenings().then(() => renderInfo(tree.chessAt())).catch(() => {})
// warm up the engine in the background so the first game starts quickly
setTimeout(() => engine.start().catch(() => {}), 1500)
