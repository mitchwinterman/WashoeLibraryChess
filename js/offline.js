// The offline copy (opened straight from a folder, no web server) sets window.BFC_OFFLINE before loading the app.
// Browsers block fetch() and outside sprite files there, so data is loaded as plain scripts instead.
export const OFFLINE = typeof window !== 'undefined' && !!window.BFC_OFFLINE

// Piece sprite reference: online it's the sprite file; offline the sprite is already inside the page.
export const PIECE_SPRITE = OFFLINE ? '' : 'vendor/cm-chessboard/assets/pieces/standard.svg'

const loaded = {}
export function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = resolve
      s.onerror = () => reject(new Error('Could not load ' + src))
      document.head.append(s)
    })
  }
  return loaded[src]
}
