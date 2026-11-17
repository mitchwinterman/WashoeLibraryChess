// Filter the Lichess puzzle Parquet files into a compact JSON set for the site.
// Usage: node filter.mjs out.json file1.parquet file2.parquet ...
import { parquetMetadataAsync, parquetReadObjects, asyncBufferFromFile } from 'hyparquet/src/node.js' // npm install hyparquet
import { writeFileSync } from 'node:fs'

const [out, ...files] = process.argv.slice(2)
const PER_BUCKET = 120
const BANDS = [0, 1000, 1300, 1600, 1900, 2200, 9999]
const band = r => BANDS.findIndex((b, i) => r >= b && r < BANDS[i + 1])
const SKIP = new Set(['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'player'])

// seeded RNG so the selection is reproducible
let seed = 20270101
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

const buckets = new Map() // key -> {n, items[]}
let seen = 0, kept = 0
for (const f of files) {
  const file = await asyncBufferFromFile(f)
  const md = await parquetMetadataAsync(file)
  let start = 0
  for (const rg of md.row_groups) {
    const end = start + Number(rg.num_rows)
    const rows = await parquetReadObjects({ file, metadata: md, rowStart: start, rowEnd: end,
      columns: ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes', 'OpeningTags'] })
    for (const r of rows) {
      seen++
      if (r.Popularity < 90 || Number(r.NbPlays) < 500 || r.RatingDeviation > 80) continue
      kept++
      const p = { i: r.PuzzleId, f: r.FEN, m: r.Moves, r: r.Rating, t: r.Themes.filter(t => !SKIP.has(t)), o: r.OpeningTags?.[0] || undefined }
      const b = band(r.Rating)
      for (const t of p.t) {
        const key = t + '|' + b
        let bk = buckets.get(key)
        if (!bk) buckets.set(key, bk = { n: 0, items: [] })
        bk.n++
        if (bk.items.length < PER_BUCKET) bk.items.push(p)
        else { const j = Math.floor(rand() * bk.n); if (j < PER_BUCKET) bk.items[j] = p }
      }
    }
    start = end
  }
  console.error(f, 'done; seen', seen, 'quality', kept)
}
const chosen = new Map()
for (const bk of buckets.values()) for (const p of bk.items) chosen.set(p.i, p)
const list = [...chosen.values()].sort((a, b) => a.r - b.r)
writeFileSync(out, JSON.stringify(list))
const counts = {}
for (const p of list) for (const t of p.t) counts[t] = (counts[t] || 0) + 1
console.error('final', list.length, 'puzzles')
console.error(JSON.stringify(counts))
