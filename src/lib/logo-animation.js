// Animiertes App-Logo: Kugel dreht sich, die Route fließt zum Pin, alle 90 Sekunden fährt sie
// wie ein Zug zweimal um die Kugel und gleitet zurück. Gleiche Rechnung wie
// Advertisment/Logo/TravelBuddy-Logo-animiert.html (Werbung).
const NS = 'http://www.w3.org/2000/svg'
export const UMLAUF_ALLE = 90, UMLAUF_DAUER = 10, DREHUNG = 40   // Sekunden: Abstand, Dauer, eine Drehung der Kugel
const K = { x: 256, y: 222, r: 104 }                         // Kugel
const NEIGUNG = 0.32                                         // Blick leicht von oben (Bogenmaß)
const ROUTE = [[92, 414], [172, 374], [252, 400], [332, 354], [418, 390]]

const el = (n, a = {}, eltern) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (eltern) eltern.appendChild(e); return e }

export function grundgeruest(svg, id) {
  svg.innerHTML = ''
  const defs = el('defs', {}, svg)
  const himmel = el('linearGradient', { id: id + 'h', x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
  ;[['0', '#7a3b1e'], ['0.45', '#b5601f'], ['0.7', '#d98a3d'], ['1', '#e8c079']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, himmel))
  const sonne = el('radialGradient', { id: id + 's', cx: 0.38, cy: 0.34, r: 0.75 }, defs)
  ;[['0', '#fffaf0'], ['0.55', '#ffe7a6'], ['1', '#f4b552']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, sonne))
  const glanz = el('radialGradient', { id: id + 'g', cx: 0.5, cy: 0.5, r: 0.5 }, defs)
  ;[['0', 'rgba(255,224,138,.55)'], ['1', 'rgba(255,224,138,0)']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, glanz))
  const form = el('clipPath', { id: id + 'f' }, defs); el('rect', { width: 512, height: 512, rx: 114 }, form)
  const kugelForm = el('clipPath', { id: id + 'k' }, defs); el('circle', { cx: K.x, cy: K.y, r: K.r }, kugelForm)
  const g = el('g', { 'clip-path': `url(#${id}f)` }, svg)
  el('rect', { width: 512, height: 512, fill: `url(#${id}h)` }, g)
  const schein = el('circle', { cx: K.x, cy: K.y, r: K.r * 1.55, fill: `url(#${id}g)` }, g)
  const hinten = el('g', {}, g)                              // Teil des Umlaufs hinter der Kugel
  el('circle', { cx: K.x, cy: K.y, r: K.r, fill: `url(#${id}s)` }, g)
  const netz = el('g', { 'clip-path': `url(#${id}k)`, fill: 'none', stroke: '#c9772e', 'stroke-linecap': 'round' }, g)
  const routeG = el('g', {}, g)
  const vorne = el('g', {}, g)                               // Teil des Umlaufs vor der Kugel
  const pts = ROUTE.map((p) => p.join(',')).join(' ')
  const basis = el('polyline', { points: pts, fill: 'none', stroke: 'rgba(251,248,243,.45)', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, routeG)
  const punkte = el('polyline', { points: pts, fill: 'none', stroke: '#fbf8f3', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': '2 26' }, routeG)
  const laeufer = el('circle', { r: 9, fill: '#fff', opacity: 0.95 }, routeG)
  const pinRing = el('circle', { cx: 418, cy: 390, r: 17, fill: 'none', stroke: '#fbf8f3', 'stroke-width': 6 }, g)
  const pin = el('g', {}, g)
  el('circle', { cx: 418, cy: 390, r: 18, fill: '#fbf8f3' }, pin)
  el('circle', { cx: 418, cy: 390, r: 8.5, fill: '#c0392b' }, pin)
  return { schein, hinten, netz, routeG, basis, punkte, laeufer, pinRing, pin, vorne }
}

// Kugelpunkt (Breite b, Länge l) gedreht um d, geneigt, projiziert. z > 0: vorne.
function projiziere(b, l, d) {
  const x = Math.cos(b) * Math.sin(l + d), y = Math.sin(b), z = Math.cos(b) * Math.cos(l + d)
  const y2 = y * Math.cos(NEIGUNG) - z * Math.sin(NEIGUNG), z2 = y * Math.sin(NEIGUNG) + z * Math.cos(NEIGUNG)
  return [K.x + K.r * x, K.y - K.r * y2, z2]
}
function linie(eltern, punkte, breite, deckkraft) {
  // nur die vordere Hälfte zeichnen, in Stücken
  let d = '', an = false
  for (const [x, y, z] of punkte) { if (z > 0) { d += (an ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); an = true } else an = false }
  if (d) el('path', { d, 'stroke-width': breite, opacity: deckkraft }, eltern)
}
function zeichneNetz(netz, t) {
  netz.innerHTML = ''
  const d = (t / DREHUNG) * Math.PI * 2
  for (let i = 0; i < 12; i++) {                              // Längengrade, drehen sich
    const l = (i / 12) * Math.PI * 2, pk = []
    for (let s = 0; s <= 36; s++) pk.push(projiziere(-Math.PI / 2 + (s / 36) * Math.PI, l, d))
    linie(netz, pk, 3.2, 0.55)
  }
  for (const b of [-0.9, -0.45, 0, 0.45, 0.9]) {              // Breitengrade, fest
    const pk = []
    for (let s = 0; s <= 72; s++) pk.push(projiziere(b, (s / 72) * Math.PI * 2, 0))
    linie(netz, pk, b === 0 ? 3.6 : 2.8, b === 0 ? 0.6 : 0.45)
  }
}

// Punkt auf der Route bei Anteil f (0..1), nach Länge verteilt
const LAENGEN = ROUTE.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE[i][0], p[1] - ROUTE[i][1]))
const GESAMT = LAENGEN.reduce((a, b) => a + b, 0)
function aufRoute(f) {
  let rest = f * GESAMT
  for (let i = 0; i < LAENGEN.length; i++) {
    if (rest <= LAENGEN[i]) { const k = rest / LAENGEN[i]; return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * k, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * k] }
    rest -= LAENGEN[i]
  }
  return ROUTE[ROUTE.length - 1]
}
// Umlaufbahn: geneigter Ring um die Kugel. w fällt: rechts hoch, hinten über die Kugel, links runter, vorne quer.
const BAHN = { rx: K.r * 1.45, ry: K.r * 0.40, kipp: -0.2 }
function aufBahn(w) {
  const x = Math.cos(w) * BAHN.rx, y = Math.sin(w) * BAHN.ry
  return [K.x + x * Math.cos(BAHN.kipp) - y * Math.sin(BAHN.kipp), K.y + x * Math.sin(BAHN.kipp) + y * Math.cos(BAHN.kipp), Math.sin(w)]   // sin > 0: vorne
}
const glatt = (x) => x * x * (3 - 2 * x)
const sanft = (x) => x * x * x * (x * (x * 6 - 15) + 10)           // noch weicher an Anfang und Ende

// ---- Die Strecke für den Umlauf: eine einzige, glatte Bahn ----
// Route → Schwung nach oben auf die Umlaufbahn → zwei Runden um die Kugel → Schwung hinunter →
// dieselbe Route noch einmal. Die Punkte fahren darauf wie ein Zug: kein Sprung, kein Anheben.
const ABSTAND = 28                                              // wie die Punkte der gestrichelten Linie
const norm = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }
const bez = (a, b, c, d, k) => { const m = 1 - k; return [0, 1].map((j) => m * m * m * a[j] + 3 * m * m * k * b[j] + 3 * m * k * k * c[j] + k * k * k * d[j]) }
const W0 = Math.PI / 2                                          // Einstieg vorne unter der Kugel, Fahrt nach rechts
const BAHNWEG = Math.PI * 5.5                                   // zwei volle Runden, dann weiter bis zur linken Seite
function baueStrecke() {
  const pk = []                                                 // [x, y, z]
  const route = (n = 60) => { for (let i = 0; i <= n; i++) { const [x, y] = aufRoute(i / n); pk.push([x, y, 1]) } }
  const tangente = (w) => { const [x1, y1] = aufBahn(w), [x2, y2] = aufBahn(w - 0.002); return norm([x2 - x1, y2 - y1]) }
  route()
  const pin = ROUTE[ROUTE.length - 1], vorPin = norm([pin[0] - ROUTE[3][0], pin[1] - ROUTE[3][1]])
  // Schwung: vom Pin in einem Bogen nach oben links und von vorne in die Bahn
  const ein = aufBahn(W0), tEin = tangente(W0)
  for (let i = 1; i <= 90; i++) { const [x, y] = bez(pin, [pin[0] + vorPin[0] * 34 - 10, pin[1] + vorPin[1] * 34 - 96], [ein[0] - tEin[0] * 150, ein[1] - tEin[1] * 150 + 18], ein, i / 90); pk.push([x, y, 1]) }
  for (let i = 1; i <= 520; i++) { const w = W0 - (i / 520) * BAHNWEG; pk.push(aufBahn(w)) }
  const aus = aufBahn(W0 - BAHNWEG), tAus = tangente(W0 - BAHNWEG)
  const start = ROUTE[0], nachStart = norm([ROUTE[1][0] - start[0], ROUTE[1][1] - start[1]])
  // Länge bis hierher, damit die zweite Route genau ein Vielfaches des Punktabstands später beginnt
  const laengeBis = (arr) => arr.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - arr[i - 1][0], q[1] - arr[i - 1][1]) : 0), 0)
  const runter = []
  for (let i = 1; i <= 80; i++) runter.push(bez(aus, [aus[0] + tAus[0] * 110, aus[1] + tAus[1] * 110], [start[0] - nachStart[0] * 120, start[1] - nachStart[1] * 120], start, i / 80))
  const bisher = laengeBis(pk) + laengeBis([pk[pk.length - 1], ...runter])
  const zuschlag = Math.ceil((bisher - GESAMT_R()) / ABSTAND) * ABSTAND - (bisher - GESAMT_R())
  // Zuschlag: kleiner Bogen vor dem Start, damit Anfang und Ende genau zusammenpassen
  const vorStart = [start[0] - nachStart[0] * zuschlag, start[1] - nachStart[1] * zuschlag]
  runter.length = 0
  for (let i = 1; i <= 80; i++) runter.push(bez(aus, [aus[0] + tAus[0] * 110, aus[1] + tAus[1] * 110], [vorStart[0] - nachStart[0] * 120, vorStart[1] - nachStart[1] * 120], vorStart, i / 80))
  for (const [x, y] of runter) pk.push([x, y, 1])
  for (let i = 1; i <= 10; i++) pk.push([vorStart[0] + (start[0] - vorStart[0]) * i / 10, vorStart[1] + (start[1] - vorStart[1]) * i / 10, 1])
  const zweite = pk.length; route(); pk.splice(zweite, 1)
  // Bogenlängen
  const s = [0]
  for (let i = 1; i < pk.length; i++) s.push(s[i - 1] + Math.hypot(pk[i][0] - pk[i - 1][0], pk[i][1] - pk[i - 1][1]))
  return { pk, s, ende: s[s.length - 1] }
}
function GESAMT_R() { return GESAMT }
let STRECKE = null
function aufStrecke(pos) {
  const { pk, s } = STRECKE
  if (pos <= 0) return pk[0]
  let lo = 0, hi = s.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] < pos) lo = m; else hi = m }
  const k = (pos - s[lo]) / ((s[hi] - s[lo]) || 1)
  return [mische(pk[lo][0], pk[hi][0], k), mische(pk[lo][1], pk[hi][1], k), mische(pk[lo][2], pk[hi][2], k)]
}

const mische = (a, b, k) => a + (b - a) * k
const FLUSS = 22                                                // px/s, wie die Punkte im Ruhezustand fließen

export function zeichne(teile, t, umlaufStart) {
  if (!STRECKE) STRECKE = baueStrecke()
  const { schein, hinten, netz, basis, punkte, laeufer, pinRing, pin, vorne } = teile
  zeichneNetz(netz, t)
  schein.setAttribute('opacity', (0.75 + 0.25 * Math.sin(t * 1.4)).toFixed(3))
  const phase = (t * FLUSS) % ABSTAND
  punkte.setAttribute('stroke-dashoffset', (-phase).toFixed(2))  // Punkte fließen zum Pin
  const f = (t % 3.2) / 3.2
  const [lx, ly] = aufRoute(glatt(f)); laeufer.setAttribute('cx', lx); laeufer.setAttribute('cy', ly)
  const p = (t % 2.4) / 2.4
  pinRing.setAttribute('r', (17 + p * 26).toFixed(1))

  hinten.innerHTML = ''; vorne.innerHTML = ''
  const u = umlaufStart == null ? -1 : (t - umlaufStart) / UMLAUF_DAUER
  // Übergang Linie ↔ Zug in den ersten und letzten 0,4 s, die Punkte liegen dabei genau übereinander
  const blende = u < 0 || u > 1 ? 0 : Math.min(1, (t - umlaufStart) / 0.4, (umlaufStart + UMLAUF_DAUER - t) / 0.4)
  for (const e of [basis, punkte, pin]) e.setAttribute('opacity', (1 - blende).toFixed(3))
  laeufer.setAttribute('opacity', ((1 - blende) * Math.min(1, f * 6, (1 - f) * 6) * 0.95).toFixed(3))
  pinRing.setAttribute('opacity', ((1 - blende) * 0.9 * (1 - p)).toFixed(3))
  if (blende <= 0) return

  // Der Zug: Kopf ist der Pin. Er fährt die Strecke einmal ab, weich anfahrend und weich bremsend.
  const weg = STRECKE.ende - GESAMT                               // vom Pin bis zum Pin am Ende
  const vor = sanft(Math.min(1, Math.max(0, u))) * weg
  const kopf = GESAMT + vor
  const g = (ebene, o) => el('g', { opacity: (blende * o).toFixed(3) }, ebene)
  const gv = g(vorne, 1), gh = g(hinten, 0.55)
  // feine Linie unter den Punkten, vorne und hinten getrennt
  let dv = '', dh = '', an = null
  for (let q = vor; q <= kopf; q += 6) {
    const [x, y, z] = aufStrecke(q), seite = z > 0 ? 'v' : 'h'
    const stueck = (an === seite ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
    if (seite === 'v') dv += stueck; else dh += stueck
    an = seite
  }
  const linienArt = { fill: 'none', stroke: 'rgba(251,248,243,.45)', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  if (dv) el('path', { d: dv, ...linienArt }, gv)
  if (dh) el('path', { d: dh, ...linienArt }, gh)
  // die Punkte: dieselbe Teilung wie die gestrichelte Linie, nur um den Weg verschoben
  for (let lokal = phase + 1; lokal <= GESAMT - 14; lokal += ABSTAND) {
    const [x, y, z] = aufStrecke(vor + lokal)
    const tiefe = 0.78 + 0.22 * Math.max(0, z)
    el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (6.5 * tiefe).toFixed(1), fill: '#fbf8f3' }, z > 0 ? gv : gh)
  }
  const [px, py, pz] = aufStrecke(kopf), pt = 0.82 + 0.18 * Math.max(0, pz), pe = pz > 0 ? gv : gh
  el('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: (18 * pt).toFixed(1), fill: '#fbf8f3' }, pe)
  el('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: (8.5 * pt).toFixed(1), fill: '#c0392b' }, pe)
}
