// Builds the offline copy of Booked for Chess: a folder that runs by double-clicking a file,
// with no internet and no web server.
//   node tools/build-offline.mjs <output folder>
// Needs the TypeScript compiler (tsc) to turn the site's modules into one plain script.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, normalize, posix } from 'node:path'
import { tmpdir } from 'node:os'

const root = new URL('..', import.meta.url).pathname
const out = process.argv[2]
if (!out) { console.error('Usage: node tools/build-offline.mjs <output folder>'); process.exit(1) }
const site = join(out, 'Booked for Chess Offline')
rmSync(site, { recursive: true, force: true })
mkdirSync(site, { recursive: true })

// 1. Turn the ES modules into CommonJS, then bundle them into one classic script.
const work = join(tmpdir(), 'bfc-offline-build')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
cpSync(join(root, 'js'), join(work, 'js'), { recursive: true })
cpSync(join(root, 'vendor'), join(work, 'vendor'), { recursive: true })
execSync('tsc --allowJs --module commonjs --outDir cjs --target es2020 --skipLibCheck --rootDir . js/main.js', { cwd: work, stdio: 'inherit' })

const modules = new Map()
function addModule(id) {
  if (modules.has(id)) return
  let code = readFileSync(join(work, 'cjs', id), 'utf8')
  modules.set(id, null)
  code = code.replace(/require\("([^"]+)"\)/g, (_, spec) => {
    const dep = posix.normalize(posix.join(posix.dirname(id), spec))
    addModule(dep)
    return `__req(${JSON.stringify(dep)})`
  })
  modules.set(id, code)
}
addModule('js/main.js')
let bundle = '// Booked for Chess (offline copy). Built from the site source; do not edit by hand.\n(function () {\n"use strict";\nconst __defs = {};\nconst __cache = {};\nfunction __req(id) {\n  if (__cache[id]) return __cache[id].exports;\n  const module = { exports: {} };\n  __cache[id] = module;\n  __defs[id](module, module.exports);\n  return module.exports;\n}\n'
for (const [id, code] of modules) bundle += `__defs[${JSON.stringify(id)}] = function (module, exports) {\n${code}\n};\n`
bundle += '__req("js/main.js");\n})();\n'
writeFileSync(join(site, 'app.js'), bundle)
console.log(`Bundled ${modules.size} modules`)

// 2. Page: load the bundle as a plain script and put the sprites inside the page.
const sprite = f => readFileSync(join(root, 'vendor/cm-chessboard/assets', f), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[^>]*>/i, '')
const hidden = 'style="transform: scale(0); position: absolute;" aria-hidden="true"'
let html = readFileSync(join(root, 'index.html'), 'utf8')
html = html.replace('<script type="module" src="js/main.js"></script>', '<script>window.BFC_OFFLINE = true</script>\n  <script src="app.js"></script>')
html = html.replace(/<body([^>]*)>/, `<body$1>
  <div id="cm-chessboard-sprite" ${hidden}>${sprite('pieces/standard.svg')}</div>
  <div id="cm-chessboard-markers" ${hidden}>${sprite('extensions/markers/markers.svg')}</div>
  <div id="cm-chessboard-arrows" ${hidden}>${sprite('extensions/arrows/arrows.svg')}</div>`)
html = html.replace('<span class="site-title">Booked for Chess</span>', '<span class="site-title">Booked for Chess <span class="offline-tag">Offline copy</span></span>')
html = html.replace('<title>Booked for Chess</title>', '<title>Booked for Chess (Offline)</title>')
writeFileSync(join(site, 'index.html'), html)

// 3. Styles, fonts, images, and board styles.
for (const d of ['css', 'fonts', 'img']) cpSync(join(root, d), join(site, d), { recursive: true })
for (const f of ['chessboard.css', 'extensions/markers/markers.css', 'extensions/arrows/arrows.css', 'extensions/promotion-dialog/promotion-dialog.css']) {
  const to = join(site, 'vendor/cm-chessboard/assets', f)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(join(root, 'vendor/cm-chessboard/assets', f), to)
}
cpSync(join(root, 'vendor/cm-chessboard/LICENSE'), join(site, 'vendor/cm-chessboard/LICENSE'))
cpSync(join(root, 'vendor/chessjs/LICENSE'), join(site, 'vendor/chessjs/LICENSE'))

// 4. Data and engine as plain scripts.
mkdirSync(join(site, 'data'), { recursive: true })
writeFileSync(join(site, 'data/puzzles.js'), 'window.BFC_PUZZLES = ' + readFileSync(join(root, 'data/puzzles.json'), 'utf8') + ';\n')
const tsv = 'abcde'.split('').map(l => readFileSync(join(root, `data/${l}.tsv`), 'utf8'))
writeFileSync(join(site, 'data/openings.js'), 'window.BFC_OPENINGS = ' + JSON.stringify(tsv) + ';\n')
mkdirSync(join(site, 'vendor/stockfish'), { recursive: true })
writeFileSync(join(site, 'vendor/stockfish/stockfish-asm-inline.js'),
  'window.BFC_STOCKFISH = ' + JSON.stringify(readFileSync(join(root, 'vendor/stockfish/stockfish.asm.js'), 'utf8')) + ';\n')
cpSync(join(root, 'vendor/stockfish/Copying.txt'), join(site, 'vendor/stockfish/Copying.txt'))

// 5. Launcher next to the folder.
writeFileSync(join(out, 'Open Booked for Chess (Offline).html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Opening Booked for Chess…</title>
<meta http-equiv="refresh" content="0; url=Booked%20for%20Chess%20Offline/index.html"></head>
<body style="font-family: Arial, sans-serif; padding: 2em;">
<p>Opening Booked for Chess… If nothing happens, <a href="Booked%20for%20Chess%20Offline/index.html">click here</a>.</p>
</body></html>
`)
console.log('Offline copy written to', out)
