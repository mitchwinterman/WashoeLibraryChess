// Stockfish 10 (Stockfish.js by nmrugg, GPL-3.0) running in a Web Worker.
import { Chess } from '../vendor/chessjs/chess.js'

const WASM_URL = 'vendor/stockfish/stockfish.js'
const ASM_URL = 'vendor/stockfish/stockfish.asm.js'

// Computer strength levels shown to players as 1 through 8.
// randomChance: how often the computer plays a random legal move instead (keeps low levels beatable).
export const LEVELS = [
  null,
  { skill: 0, depth: 1, movetime: 50, randomChance: 0.45 },
  { skill: 1, depth: 2, movetime: 80, randomChance: 0.25 },
  { skill: 3, depth: 3, movetime: 120, randomChance: 0.12 },
  { skill: 6, depth: 5, movetime: 200, randomChance: 0.04 },
  { skill: 9, depth: 8, movetime: 350, randomChance: 0 },
  { skill: 12, depth: 11, movetime: 600, randomChance: 0 },
  { skill: 16, depth: 14, movetime: 900, randomChance: 0 },
  { skill: 20, depth: 18, movetime: 1500, randomChance: 0 }
]

export class Engine {
  constructor() {
    this.worker = null
    this.listeners = new Set()
    this.ready = null
    this.busy = Promise.resolve()
    this.pending = 0             // searches waiting or running
    this.backgroundRunning = false
  }

  start() {
    if (!this.ready) this.ready = this._boot(WASM_URL).catch(() => this._boot(ASM_URL))
    return this.ready
  }

  _boot(url) {
    return new Promise((resolve, reject) => {
      if (this.worker) this.worker.terminate()
      let worker
      try { worker = new Worker(url) } catch (e) { reject(e); return }
      this.worker = worker
      const timer = setTimeout(() => { cleanup(); reject(new Error('Engine did not start')) }, 15000)
      const onLine = line => {
        if (line === 'uciok') { this.send('isready') }
        if (line === 'readyok') { cleanup(); resolve(true) }
      }
      const cleanup = () => { clearTimeout(timer); this.listeners.delete(onLine) }
      worker.onmessage = e => { const line = typeof e.data === 'string' ? e.data : String(e.data); for (const l of [...this.listeners]) l(line) }
      worker.onerror = err => { cleanup(); reject(err) }
      this.listeners.add(onLine)
      this.send('uci')
    })
  }

  send(cmd) { this.worker && this.worker.postMessage(cmd) }

  // Run one search at a time.
  _queue(fn) {
    const run = this.busy.then(fn, fn)
    this.busy = run.catch(() => {})
    return run
  }

  // Search the position. Returns { bestmove, score } where score is from the side to move.
  // background: true marks a low-priority search (the analysis bar) that any other search interrupts.
  search(fen, { skill = 20, depth = 12, movetime = 1000, onInfo, background = false } = {}) {
    if (!background && this.backgroundRunning) this.send('stop')
    this.pending++
    return this._queue(async () => {
      await this.start()
      this.backgroundRunning = background
      return new Promise(resolve => {
        let score = null
        const onLine = line => {
          if (line.startsWith('info') && line.includes(' pv ')) {
            const cp = line.match(/score cp (-?\d+)/)
            const mate = line.match(/score mate (-?\d+)/)
            if (cp) score = { cp: +cp[1] }
            if (mate) score = { mate: +mate[1] }
            const pv = line.split(' pv ')[1]
            if (onInfo) onInfo({ score, pv: pv ? pv.split(' ') : [] })
          }
          if (line.startsWith('bestmove')) {
            this.listeners.delete(onLine)
            this.backgroundRunning = false
            this.pending--
            const best = line.split(' ')[1]
            resolve({ bestmove: best && best !== '(none)' ? best : null, score })
          }
        }
        this.listeners.add(onLine)
        this.send('ucinewgame')
        this.send(`setoption name Skill Level value ${skill}`)
        this.send(`position fen ${fen}`)
        this.send(`go depth ${depth} movetime ${movetime}`)
      })
    })
  }

  // Pick a move for the computer opponent at a given level (1-8).
  async computerMove(fen, level) {
    const L = LEVELS[level] || LEVELS[4]
    if (L.randomChance && Math.random() < L.randomChance) {
      const moves = new Chess(fen).moves({ verbose: true })
      if (moves.length) {
        const m = moves[Math.floor(Math.random() * moves.length)]
        await new Promise(r => setTimeout(r, 300))
        return m.from + m.to + (m.promotion || '')
      }
    }
    const res = await this.search(fen, L)
    return res.bestmove
  }

  stop() { this.send('stop') }
}

export function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }
}
