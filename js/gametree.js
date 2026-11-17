// Game tree: a position with a main line and side variations.
import { Chess } from '../vendor/chessjs/chess.js'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

let nextId = 1

function plyFromFen(fen) {
  const parts = fen.split(' ')
  const full = parseInt(parts[5] || '1', 10) || 1
  return (full - 1) * 2 + (parts[1] === 'b' ? 1 : 0)
}

export class Node {
  constructor(parent, fen, move) {
    this.id = nextId++
    this.parent = parent
    this.children = []
    this.fen = fen
    this.san = move ? move.san : null
    this.uci = move ? move.from + move.to + (move.promotion || '') : null
    this.from = move ? move.from : null
    this.to = move ? move.to : null
    this.ply = parent ? parent.ply + 1 : plyFromFen(fen)
    this.comment = ''
    this.annotations = null
  }
}

export class GameTree {
  constructor(fen = START_FEN) {
    this.reset(fen)
  }

  reset(fen = START_FEN) {
    this.root = new Node(null, fen, null)
    this.current = this.root
    this.headers = {}
  }

  get startFen() { return this.root.fen }

  chessAt(node = this.current) {
    return new Chess(node.fen)
  }

  // Play a move ({from,to,promotion} or SAN) from the current node.
  // Returns the new node, or null if illegal.
  play(move) {
    const chess = this.chessAt()
    const result = chess.move(move, { sloppy: true })
    if (!result) return null
    const uci = result.from + result.to + (result.promotion || '')
    let child = this.current.children.find(c => c.uci === uci)
    if (!child) {
      child = new Node(this.current, chess.fen(), result)
      this.current.children.push(child)
    }
    this.current = child
    return child
  }

  goTo(node) { if (node) this.current = node }
  back() { if (this.current.parent) this.current = this.current.parent }
  forward() { if (this.current.children.length) this.current = this.current.children[0] }
  toStart() { this.current = this.root }
  toEnd() { while (this.current.children.length) this.current = this.current.children[0] }

  find(id) {
    const stack = [this.root]
    while (stack.length) {
      const n = stack.pop()
      if (n.id === id) return n
      stack.push(...n.children)
    }
    return null
  }

  // Remove the current node and everything after it.
  deleteFromHere() {
    const n = this.current
    if (!n.parent) return
    n.parent.children = n.parent.children.filter(c => c !== n)
    this.current = n.parent
  }

  // Make the current node's line the main line at its branch point.
  promote() {
    let n = this.current
    while (n.parent) {
      const sib = n.parent.children
      const i = sib.indexOf(n)
      if (i > 0) { sib.splice(i, 1); sib.unshift(n); return }
      n = n.parent
    }
  }

  // Remove everything after the current node (used for take-backs in games).
  truncateAfterCurrent() { this.current.children = [] }

  mainlineEnd(node = this.root) {
    while (node.children.length) node = node.children[0]
    return node
  }

  pathToCurrent() {
    const path = []
    for (let n = this.current; n; n = n.parent) path.unshift(n)
    return path
  }

  // ---- PGN export ----
  toPgn() {
    const h = Object.assign({ Event: 'Booked for Chess', Site: 'Washoe County Library System', Date: todayPgnDate(), White: '?', Black: '?', Result: '*' }, this.headers)
    if (this.root.fen !== START_FEN) { h.SetUp = '1'; h.FEN = this.root.fen }
    let out = Object.entries(h).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n') + '\n\n'
    const parts = []
    if (this.root.comment) parts.push(`{${this.root.comment}}`)
    writeLine(this.root, true, parts)
    parts.push(h.Result)
    out += wrap(parts.join(' '))
    return out + '\n'
  }

  // ---- PGN import (supports variations and comments) ----
  static fromPgn(text) {
    const headers = {}
    const body = text.replace(/^\s*\[(\w+)\s+"([^"]*)"\]\s*$/gm, (_, k, v) => { headers[k] = v; return '' })
    const fen = headers.FEN || START_FEN
    const tree = new GameTree(fen)
    delete headers.FEN; delete headers.SetUp
    tree.headers = headers
    const tokens = body.match(/\{[^}]*\}|;[^\n]*|\(|\)|\$\d+|\d+\.(\.\.)?|[^\s(){};]+/g) || []
    const stack = []
    let last = tree.root   // node the next move is played from
    let prev = tree.root   // node holding the most recent move (start point for a variation)
    for (const t of tokens) {
      if (t[0] === '{') { prev.comment = (prev.comment ? prev.comment + ' ' : '') + t.slice(1, -1).trim(); continue }
      if (t[0] === ';' || t[0] === '$') continue
      if (t === '(') { stack.push({ last, prev }); last = prev.parent || tree.root; continue }
      if (t === ')') { const s = stack.pop(); if (s) { last = s.last; prev = s.prev } continue }
      if (/^\d+\.(\.\.)?$/.test(t) || /^\d+\.+$/.test(t)) continue
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)) { if (!stack.length) tree.headers.Result = t; continue }
      const san = t.replace(/^\d+\.+/, '').replace(/[!?]+$/, '')
      if (!san) continue
      tree.current = last
      const node = tree.play(san)
      if (!node) throw new Error(`Could not read the move "${t}".`)
      prev = node
      last = node
    }
    tree.current = tree.root
    return tree
  }
}

function writeLine(node, forceNumber, parts) {
  if (!node.children.length) return
  const [main, ...vars] = node.children
  parts.push(moveText(main, forceNumber))
  if (main.comment) parts.push(`{${main.comment}}`)
  for (const v of vars) {
    const sub = [moveText(v, true)]
    if (v.comment) sub.push(`{${v.comment}}`)
    writeLine(v, false, sub)
    parts.push('(' + sub.join(' ') + ')')
  }
  writeLine(main, vars.length > 0 || !!main.comment, parts)
}

export function moveNumberLabel(node, force) {
  const moveNo = Math.floor((node.ply - 1) / 2) + 1
  const whiteMoved = node.ply % 2 === 1
  if (whiteMoved) return `${moveNo}.`
  return force ? `${moveNo}...` : ''
}

function moveText(node, force) {
  const label = moveNumberLabel(node, force)
  return label ? `${label} ${node.san}` : node.san
}

function wrap(s, width = 80) {
  const words = s.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) { lines.push(line.trim()); line = w } else line += ' ' + w
  }
  if (line.trim()) lines.push(line.trim())
  return lines.join('\n')
}

function todayPgnDate() {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
