// Opening names from the Lichess chess-openings list (CC0).
import { Chess } from '../vendor/chessjs/chess.js'

let byPosition = null
let loading = null
export const openingList = [] // { eco, name, pgn }

const key = fen => fen.split(' ').slice(0, 4).join(' ')

export function loadOpenings() {
  if (!loading) {
    loading = Promise.all('abcde'.split('').map(l => fetch(`data/${l}.tsv`).then(r => r.text())))
      .then(files => {
        byPosition = new Map()
        for (const text of files) {
          for (const row of text.split('\n').slice(1)) {
            const [eco, name, pgn] = row.split('\t')
            if (!pgn) continue
            openingList.push({ eco, name, pgn: pgn.trim() })
            const chess = new Chess()
            for (const tok of pgn.split(/\s+/)) {
              if (!tok || /^\d+\./.test(tok)) continue
              if (!chess.move(tok, { sloppy: true })) break
            }
            byPosition.set(key(chess.fen()), { eco, name })
          }
        }
        return byPosition
      })
  }
  return loading
}

// Name of the opening for the deepest named position along a path of nodes.
export function openingFor(path) {
  if (!byPosition) return null
  for (let i = path.length - 1; i >= 0; i--) {
    const hit = byPosition.get(key(path[i].fen))
    if (hit) return hit
  }
  return null
}
