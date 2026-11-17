// Pairing tool for meetup nights: Swiss, round robin, or casual pairings, with results and standings.
// The event is kept in this browser (localStorage) so a page reload doesn't lose it.

const KEY = 'booked-for-chess-event'
const RESULTS = { w: [1, 0], d: [0.5, 0.5], b: [0, 1] }

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}
function save(ev) {
  try { localStorage.setItem(KEY, JSON.stringify(ev)) } catch {}
}
function blankEvent() {
  return { players: [], format: 'swiss', rounds: 4, started: false, roundList: [], nextId: 1 }
}

export function initPairings({ toast }) {
  const $ = s => document.querySelector(s)
  let ev = load() || blankEvent()
  const app = () => $('#pr-app')

  // ---------- scoring ----------
  function standings() {
    const rows = ev.players.map(p => ({ p, pts: 0, games: 0, opps: [], whites: 0, lastColor: null, hadBye: false }))
    const byId = Object.fromEntries(rows.map(r => [r.p.id, r]))
    for (const round of ev.roundList) {
      for (const g of round.games) {
        if (g.bye) { const r = byId[g.white]; if (r) { r.pts += 1; r.hadBye = true } continue }
        const w = byId[g.white], b = byId[g.black]
        if (w) { w.opps.push(g.black); w.whites++; w.lastColor = 'w' }
        if (b) { b.opps.push(g.white); b.lastColor = 'b' }
        if (!g.result) continue
        const [pw, pb] = RESULTS[g.result]
        if (w) { w.pts += pw; w.games++ }
        if (b) { b.pts += pb; b.games++ }
      }
    }
    // Buchholz tiebreak: total points of opponents
    for (const r of rows) r.tb = r.opps.reduce((s, id) => s + (byId[id] ? byId[id].pts : 0), 0)
    rows.sort((a, b) => b.pts - a.pts || b.tb - a.tb || a.p.id - b.p.id)
    return rows
  }

  // ---------- pairing ----------
  function colorOrder(a, b, board) {
    // fewer whites gets white; otherwise alternate from last game; otherwise alternate by board
    if (a.whites !== b.whites) return a.whites < b.whites ? [a, b] : [b, a]
    if (a.lastColor !== b.lastColor) return a.lastColor === 'b' ? [a, b] : [b, a]
    return board % 2 ? [b, a] : [a, b]
  }

  function pairSwiss(active) {
    const rows = standings().filter(r => active.has(r.p.id))
    let bye = null
    if (rows.length % 2) {
      // lowest-ranked player without a bye sits out (and gets 1 point)
      for (let i = rows.length - 1; i >= 0; i--) if (!rows[i].hadBye) { bye = rows.splice(i, 1)[0]; break }
      if (!bye) bye = rows.pop()
    }
    const tryPair = (list, allowRepeat) => {
      if (!list.length) return []
      const [first, ...rest] = list
      for (let i = 0; i < rest.length; i++) {
        if (!allowRepeat && first.opps.includes(rest[i].p.id)) continue
        const sub = tryPair(rest.filter((_, k) => k !== i), allowRepeat)
        if (sub) return [[first, rest[i]], ...sub]
      }
      return null
    }
    const pairs = tryPair(rows, false) || tryPair(rows, true) || []
    const games = pairs.map(([a, b], i) => { const [w, bl] = colorOrder(a, b, i); return { white: w.p.id, black: bl.p.id, result: null } })
    if (bye) games.push({ white: bye.p.id, bye: true })
    return games
  }

  function pairCasual(active) {
    const rows = standings().filter(r => active.has(r.p.id)).sort(() => Math.random() - 0.5)
    const last = ev.roundList.length ? ev.roundList[ev.roundList.length - 1].games : []
    const lastOpp = id => { const g = last.find(x => x.white === id || x.black === id); return g ? (g.white === id ? g.black : g.white) : null }
    const games = []
    while (rows.length > 1) {
      const a = rows.shift()
      let k = rows.findIndex(r => r.p.id !== lastOpp(a.p.id))
      if (k < 0) k = 0
      const b = rows.splice(k, 1)[0]
      const [w, bl] = colorOrder(a, b, games.length)
      games.push({ white: w.p.id, black: bl.p.id, result: null })
    }
    if (rows.length) games.push({ white: rows[0].p.id, bye: true })
    return games
  }

  // Round robin by the circle method; a "bye" seat is added for an odd number of players.
  function roundRobinSchedule(ids) {
    const seats = ids.slice()
    if (seats.length % 2) seats.push(null)
    const n = seats.length
    const rounds = []
    for (let r = 0; r < n - 1; r++) {
      const games = []
      for (let i = 0; i < n / 2; i++) {
        let a = seats[i], b = seats[n - 1 - i]
        if (i === 0 && r % 2) [a, b] = [b, a]
        else if (i > 0 && (r + i) % 2) [a, b] = [b, a]
        if (a === null || b === null) games.push({ white: a === null ? b : a, bye: true })
        else games.push({ white: a, black: b, result: null })
      }
      rounds.push({ games })
      seats.splice(1, 0, seats.pop()) // rotate all but the first seat
    }
    return rounds
  }

  function startEvent() {
    const here = ev.players.filter(p => p.here)
    if (here.length < 2) { toast('Add at least two players who are here tonight.'); return }
    ev.format = $('#pr-format').value
    ev.rounds = +$('#pr-rounds').value
    ev.started = true
    ev.roundList = []
    if (ev.format === 'rr') {
      ev.schedule = roundRobinSchedule(here.map(p => p.id))
      ev.rounds = ev.schedule.length
      ev.roundList.push(ev.schedule[0])
    } else {
      ev.roundList.push({ games: (ev.format === 'swiss' ? pairSwiss : pairCasual)(new Set(here.map(p => p.id))) })
    }
    save(ev); draw()
  }

  function nextRound() {
    const cur = ev.roundList[ev.roundList.length - 1]
    if (cur.games.some(g => !g.bye && !g.result)) { toast('Enter every result before pairing the next round.'); return }
    if (ev.format === 'rr') {
      if (ev.roundList.length >= ev.schedule.length) return
      ev.roundList.push(ev.schedule[ev.roundList.length])
    } else {
      const active = new Set(ev.players.filter(p => p.here).map(p => p.id))
      if (active.size < 2) { toast('At least two players need to be here.'); return }
      ev.roundList.push({ games: (ev.format === 'swiss' ? pairSwiss : pairCasual)(active) })
    }
    save(ev); draw()
  }

  // ---------- drawing ----------
  const nameOf = id => (ev.players.find(p => p.id === id) || { name: '?' }).name
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  function draw() {
    const el = app()
    if (!ev.started) { drawSetup(el); return }
    const roundNo = ev.roundList.length
    const cur = ev.roundList[roundNo - 1]
    const done = !cur.games.some(g => !g.bye && !g.result)
    const finished = done && (ev.format !== 'casual') && roundNo >= ev.rounds
    const fmt = { swiss: 'Swiss', rr: 'Round robin', casual: 'Casual' }[ev.format]
    el.innerHTML = `
      <p class="pr-sub">${fmt} · Round ${roundNo}${ev.format === 'casual' ? '' : ` of ${ev.rounds}`}</p>
      <table class="pr-table pr-games">
        <thead><tr><th>Board</th><th>White</th><th>Black</th><th>Result</th></tr></thead>
        <tbody>${cur.games.map((g, i) => g.bye
          ? `<tr><td>–</td><td colspan="2"><strong>${esc(nameOf(g.white))}</strong> sits out this round (bye, 1 point)</td><td></td></tr>`
          : `<tr><td>${i + 1}</td><td>${esc(nameOf(g.white))}</td><td>${esc(nameOf(g.black))}</td>
             <td class="pr-res">${['w', 'd', 'b'].map(r => `<button class="pr-rbtn${g.result === r ? ' on' : ''}" data-g="${i}" data-r="${r}" aria-pressed="${g.result === r}">${{ w: '1–0', d: '½–½', b: '0–1' }[r]}</button>`).join('')}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="btn-row pr-actions">
        ${finished ? '<p class="play-msg msg-good">Event complete!</p>' : `<button id="pr-next" class="btn"${done ? '' : ' disabled'}>Pair Round ${roundNo + 1}</button>`}
        ${roundNo > 1 ? '<button id="pr-undo-round" class="btn btn-secondary">Undo Last Pairing</button>' : ''}
      </div>
      <h3 class="log-head">Standings</h3>
      <table class="pr-table">
        <thead><tr><th>#</th><th>Player</th><th>Points</th><th>Games</th>${ev.format === 'swiss' ? '<th title="Tiebreak: total points of opponents">Tiebreak</th>' : ''}</tr></thead>
        <tbody>${standings().map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.p.name)}${r.p.here ? '' : ' <span class="muted">(left)</span>'}</td><td><strong>${fmtPts(r.pts)}</strong></td><td>${r.games}</td>${ev.format === 'swiss' ? `<td>${fmtPts(r.tb)}</td>` : ''}</tr>`).join('')}</tbody>
      </table>
      <details class="more pr-manage">
        <summary>Players arriving or leaving</summary>
        ${ev.format === 'rr' ? '<p class="hint-text">Round robin schedules are fixed, so players can’t be added once it starts.</p>' : `
        <div class="inline-row"><input id="pr-late" type="text" placeholder="Add a late arrival" autocomplete="off"><button id="pr-late-add" class="btn btn-secondary">Add</button></div>`}
        <ul class="pr-here">${ev.players.map(p => `<li><label class="check"><input type="checkbox" data-here="${p.id}" ${p.here ? 'checked' : ''}${ev.format === 'rr' ? ' disabled' : ''}> ${esc(p.name)} is here</label></li>`).join('')}</ul>
      </details>
      <button id="pr-reset" class="btn btn-secondary pr-reset">End Event and Start Over</button>`
    el.querySelectorAll('.pr-rbtn').forEach(b => b.addEventListener('click', () => {
      const g = cur.games[+b.dataset.g]
      g.result = g.result === b.dataset.r ? null : b.dataset.r
      save(ev); draw()
    }))
    $('#pr-next')?.addEventListener('click', nextRound)
    $('#pr-undo-round')?.addEventListener('click', () => {
      if (!window.confirm('Remove the latest round and its results?')) return
      ev.roundList.pop(); save(ev); draw()
    })
    $('#pr-late-add')?.addEventListener('click', () => addPlayer($('#pr-late').value))
    $('#pr-late')?.addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(e.target.value) })
    el.querySelectorAll('[data-here]').forEach(c => c.addEventListener('change', () => {
      const p = ev.players.find(x => x.id === +c.dataset.here); p.here = c.checked; save(ev); draw()
    }))
    $('#pr-reset').addEventListener('click', () => {
      if (!window.confirm('End this event? Pairings and results will be cleared. The player list stays.')) return
      const keep = ev.players.map(p => ({ ...p, here: true }))
      ev = blankEvent(); ev.players = keep; ev.nextId = Math.max(0, ...keep.map(p => p.id)) + 1
      save(ev); draw()
    })
  }

  function drawSetup(el) {
    el.innerHTML = `
      <p class="hint-text">Add tonight’s players, choose a format, and start. Results and standings are kept in this browser until you start over.</p>
      <div class="inline-row"><input id="pr-name" type="text" placeholder="Player name" autocomplete="off"><button id="pr-add" class="btn">Add</button></div>
      <ul class="pr-list">${ev.players.map(p => `<li><label class="check"><input type="checkbox" data-here="${p.id}" ${p.here ? 'checked' : ''}> ${esc(p.name)}</label><button class="pr-x" data-del="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button></li>`).join('')}</ul>
      <p class="pr-count">${ev.players.filter(p => p.here).length} players here</p>
      <label class="field">Format
        <select id="pr-format">
          <option value="swiss">Swiss: players with similar scores meet</option>
          <option value="rr">Round robin: everyone plays everyone</option>
          <option value="casual">Casual: new random opponent each round</option>
        </select>
      </label>
      <label class="field" id="pr-rounds-wrap">Rounds
        <select id="pr-rounds">${[2, 3, 4, 5, 6, 7].map(n => `<option${n === ev.rounds ? ' selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <button id="pr-start" class="btn btn-big">Pair Round 1</button>`
    $('#pr-format').value = ev.format
    const syncRounds = () => { $('#pr-rounds-wrap').hidden = $('#pr-format').value !== 'swiss' }
    $('#pr-format').addEventListener('change', syncRounds); syncRounds()
    $('#pr-add').addEventListener('click', () => addPlayer($('#pr-name').value))
    $('#pr-name').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(e.target.value) })
    el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      ev.players = ev.players.filter(p => p.id !== +b.dataset.del); save(ev); draw()
    }))
    el.querySelectorAll('[data-here]').forEach(c => c.addEventListener('change', () => {
      ev.players.find(x => x.id === +c.dataset.here).here = c.checked; save(ev); draw()
    }))
    $('#pr-start').addEventListener('click', startEvent)
    $('#pr-name').focus()
  }

  function addPlayer(name) {
    name = name.trim()
    if (!name) return
    if (ev.players.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast(`${name} is already on the list.`); return }
    ev.players.push({ id: ev.nextId++, name, here: true })
    save(ev); draw()
    const box = $('#pr-name') || $('#pr-late')
    if (box) box.focus()
  }

  function fmtPts(n) { return Number.isInteger(n) ? String(n) : (Math.floor(n) ? Math.floor(n) : '') + '½' }

  return {
    enter() { document.body.classList.add('no-board'); draw() },
    leave() { document.body.classList.remove('no-board') }
  }
}
