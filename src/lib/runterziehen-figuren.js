// V37: Figuren fürs Runterziehen zum Aktualisieren, jedes Mal eine andere (Steves Wahl „alles im Wechsel“).
// Känguru, Koala, Bumerang, Camper, Sonne über dem Uluru, Schlange. Eigene, einfache Zeichnungen (kein Emoji),
// damit sie auf iPhone, Android und Windows gleich aussehen. Bühne 200 × 80, Boden bei y 66.
// zeichne() bekommt den Zustand { ph: 'ziehen' | 'bereit' | 'laden', pull: 0 bis 1 (1 = Schwelle), t, l }
// mit t = ms seit Beginn der Geste und l = ms seit dem Loslassen. Bei „Bewegung reduzieren“ steht die Figur still.

export const FIGUREN = ['kaenguru', 'koala', 'bumerang', 'camper', 'uluru', 'schlange']
const KEY = 'tb-runterziehen-figur'

/** Nächste Figur im Wechsel (über Neuladen hinweg gemerkt). Beim allerersten Mal das Känguru. */
export function naechsteFigur(ls = globalThis.localStorage) {
  let i = -1
  try { const roh = ls?.getItem(KEY); const v = Number(roh); if (roh != null && roh !== '' && Number.isInteger(v) && v >= 0) i = v } catch {}
  const n = (i + 1) % FIGUREN.length
  try { ls?.setItem(KEY, String(n)) } catch {}
  return FIGUREN[n]
}

const NS = 'http://www.w3.org/2000/svg'
function el(tag, attr, par) {
  const e = document.createElementNS(NS, tag)
  for (const k in attr) e.setAttribute(k, attr[k])
  if (par) par.appendChild(e)
  return e
}
const BRAUN = '#c47a42', BRAUN2 = '#b56d37', BRAUN3 = '#a8612f', DUNKEL = '#2b1a10'

const BAU = {
  kaenguru(g) {
    const k = el('g', {}, g)
    el('path', { d: 'M-12 6 Q-30 14 -42 30', stroke: BRAUN3, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, k)
    el('ellipse', { cx: 0, cy: 0, rx: 13, ry: 18, fill: BRAUN, transform: 'rotate(-22)' }, k)
    el('ellipse', { cx: 4, cy: 2, rx: 6, ry: 10, fill: '#e3b183', transform: 'rotate(-22)' }, k)
    el('ellipse', { cx: 1, cy: 15, rx: 11, ry: 8, fill: BRAUN2 }, k)
    el('ellipse', { cx: 10, cy: 23, rx: 13, ry: 3.5, fill: BRAUN3 }, k)
    el('ellipse', { cx: 11, cy: -20, rx: 8, ry: 6.5, fill: BRAUN }, k)
    el('ellipse', { cx: 19, cy: -18, rx: 5, ry: 3.6, fill: BRAUN }, k)
    el('ellipse', { cx: 7, cy: -29, rx: 2.6, ry: 6.5, fill: BRAUN2, transform: 'rotate(-12 7 -29)' }, k)
    el('ellipse', { cx: 12, cy: -30, rx: 2.6, ry: 6.5, fill: BRAUN2, transform: 'rotate(8 12 -30)' }, k)
    el('circle', { cx: 14, cy: -22, r: 1.3, fill: DUNKEL }, k)
    el('circle', { cx: 23, cy: -18.5, r: 1.2, fill: DUNKEL }, k)
    el('path', { d: 'M8 -6 q8 3 7 9', stroke: BRAUN2, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, k)
    return { k }
  },
  koala(g) {
    const ast = el('g', {}, g)
    el('path', { d: 'M-160 12 Q100 0 360 12', stroke: '#7a5a3a', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, ast)
    for (const [x, y, r] of [[28, 6, -30], [58, 4, 25], [148, 5, -20], [176, 9, 30]]) el('ellipse', { cx: x, cy: y + 5, rx: 9, ry: 3.5, fill: '#6aa36a', transform: `rotate(${r} ${x} ${y + 5})` }, ast)
    const k = el('g', {}, ast)
    el('path', { d: 'M88 8 Q86 20 90 26 M112 8 Q114 20 110 26', stroke: '#8b8f94', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, k)
    el('ellipse', { cx: 100, cy: 42, rx: 15, ry: 16, fill: '#9aa0a6' }, k)
    el('ellipse', { cx: 100, cy: 46, rx: 8, ry: 9, fill: '#c3c7cb' }, k)
    const kopf = el('g', {}, k)
    el('circle', { cx: 86, cy: 20, r: 7, fill: '#9aa0a6' }, kopf); el('circle', { cx: 114, cy: 20, r: 7, fill: '#9aa0a6' }, kopf)
    el('circle', { cx: 86, cy: 20, r: 3.5, fill: '#e7c9cf' }, kopf); el('circle', { cx: 114, cy: 20, r: 3.5, fill: '#e7c9cf' }, kopf)
    el('circle', { cx: 100, cy: 27, r: 11, fill: '#a9afb5' }, kopf)
    el('ellipse', { cx: 100, cy: 29, rx: 3.6, ry: 4.6, fill: '#2b2b2b' }, kopf)
    el('circle', { cx: 95, cy: 24, r: 1.3, fill: '#2b2b2b' }, kopf); el('circle', { cx: 105, cy: 24, r: 1.3, fill: '#2b2b2b' }, kopf)
    const blatt = el('ellipse', { cx: 0, cy: 0, rx: 6, ry: 2.6, fill: '#6aa36a' }, k)
    return { ast, k, kopf, blatt }
  },
  bumerang(g) {
    const spur = el('path', { fill: 'none', stroke: BRAUN, 'stroke-width': 1.2, 'stroke-dasharray': '3 4', opacity: 0 }, g)
    const k = el('g', {}, g)
    el('path', { d: 'M-2 2 Q-14 -8 -24 -20 Q-26 -24 -21 -24 Q-8 -14 4 -3 Z', fill: BRAUN }, k)
    el('path', { d: 'M-2 2 Q10 -2 24 -2 Q28 0 24 3 Q10 5 -3 6 Z', fill: BRAUN2 }, k)
    el('circle', { cx: -12, cy: -12, r: 1.6, fill: '#f0e1c9' }, k); el('circle', { cx: 12, cy: 1, r: 1.6, fill: '#f0e1c9' }, k)
    return { spur, k }
  },
  camper(g) {
    el('rect', { x: -200, y: 66, width: 600, height: 3, rx: 1.5, fill: '#c9bba5' }, g)
    const staub = el('g', {}, g)
    const puffs = [0, 1, 2].map(() => el('circle', { r: 4, fill: '#d8c7ad' }, staub))
    const k = el('g', {}, g)
    el('rect', { x: -26, y: -20, width: 46, height: 20, rx: 5, fill: '#f2f2ee', stroke: '#8b3e15', 'stroke-width': 1.5 }, k)
    el('path', { d: 'M20 -20 h6 q6 0 7 8 v12 h-13 z', fill: '#f2f2ee', stroke: '#8b3e15', 'stroke-width': 1.5 }, k)
    el('rect', { x: -22, y: -16, width: 14, height: 7, rx: 2, fill: '#9fc3d6' }, k); el('rect', { x: -5, y: -16, width: 14, height: 7, rx: 2, fill: '#9fc3d6' }, k)
    el('path', { d: 'M22 -17 h4 q4 0 5 6 h-9 z', fill: '#9fc3d6' }, k)
    el('rect', { x: -26, y: -6, width: 59, height: 3, fill: '#e07b28' }, k)
    const r = [-14, 20].map((x) => { const w = el('g', { transform: `translate(${x} 1)` }, k); el('circle', { r: 5, fill: '#2b2b2b' }, w); el('rect', { x: -0.8, y: -4, width: 1.6, height: 8, fill: '#bbb' }, w); return w })
    return { staub, puffs, k, r }
  },
  uluru(g) {
    const sonne = el('circle', { r: 9, fill: '#f0b041' }, g)
    el('path', { d: 'M20 64 Q30 42 62 38 Q100 32 140 38 Q172 42 182 64 Z', fill: '#b5532a' }, g)
    el('path', { d: 'M60 40 q4 10 2 22 M100 35 q3 12 0 27 M140 39 q-4 10 -2 23', stroke: '#93411f', 'stroke-width': 1.5, fill: 'none' }, g)
    el('rect', { x: -200, y: 62, width: 600, height: 20, fill: '#d99a5e' }, g)
    return { sonne }
  },
  schlange(g) {
    const koerper = el('path', { fill: 'none', stroke: '#5d8f3a', 'stroke-width': 6, 'stroke-linecap': 'round' }, g)
    const muster = el('path', { fill: 'none', stroke: '#d8c25a', 'stroke-width': 2, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round' }, g)
    const kopf = el('g', {}, g)
    el('ellipse', { cx: 0, cy: 0, rx: 6, ry: 4.5, fill: '#5d8f3a' }, kopf)
    el('circle', { cx: 2, cy: -1.5, r: 1.1, fill: '#1f1f1f' }, kopf)
    const zunge = el('path', { d: 'M6 0 l5 0 l2 -2 M11 0 l2 2', stroke: '#c0392b', 'stroke-width': 1.2, fill: 'none' }, kopf)
    return { koerper, muster, kopf, zunge }
  },
}

/** Figur in die Bühne (svg-Gruppe) zeichnen. Rückgabe: die beweglichen Teile */
export function baue(g, figur) {
  while (g.firstChild) g.removeChild(g.firstChild)
  return (BAU[figur] || BAU.kaenguru)(g)
}

const halb = (x) => Math.max(0, Math.min(1, x))
/** Eine Zeitscheibe zeichnen. ruhig = Bewegung reduzieren: Figur steht in ihrer Grundhaltung */
export function zeichne(figur, teile, { ph = 'ziehen', pull = 0, t = 0, l = 0 } = {}, ruhig = false) {
  const p = halb(pull)
  const laden = ph === 'laden' && !ruhig
  if (figur === 'kaenguru') {
    // kleiner gezeichnet (0,8), damit es beim Springen nicht oben anstößt; Füße stehen auf dem Boden
    let x = 100, y = 44, sy = 1 - 0.22 * p, sx = 1 + 0.08 * p
    if (ph === 'bereit' && !ruhig) x += Math.sin(t / 60) * 1.2
    if (laden) { const h = (l / 650) % 1; x = -20 + ((l / 1950) % 1) * 240; y = 44 - Math.sin(h * Math.PI) * 13; sy = h < 0.12 || h > 0.88 ? 0.86 : 1.04; sx = 1 }
    if (ruhig) { sy = 1; sx = 1 }
    teile.k.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.8 * sx).toFixed(3)} ${(0.8 * sy).toFixed(3)})`)
  } else if (figur === 'koala') {
    teile.k.setAttribute('transform', ruhig ? '' : `rotate(${(Math.sin(t / 700) * 3).toFixed(2)} 100 8)`)
    teile.kopf.setAttribute('transform', laden ? `translate(0 ${(Math.sin(l / 110) * 1.4).toFixed(2)})` : '')
    const b = laden ? Math.max(0.08, 1 - ((l / 3000) % 1)) : 1
    teile.blatt.setAttribute('transform', `translate(110 37) rotate(-35) scale(${b.toFixed(3)})`)
  } else if (figur === 'bumerang') {
    let x = 100, y = 40, r = p * 360, spur = 0
    if (laden) {
      const w = ((l / 1600) % 1) * 2 * Math.PI
      x = 100 + 70 * Math.sin(w); y = 40 - 16 * Math.sin(2 * w); r = l * 1.6; spur = 0.6
      let d = ''
      for (let i = 0; i <= 40; i++) { const v = (i / 40) * w; d += (i ? 'L' : 'M') + (100 + 70 * Math.sin(v)).toFixed(1) + ' ' + (40 - 16 * Math.sin(2 * v)).toFixed(1) }
      teile.spur.setAttribute('d', d)
    }
    if (ruhig) r = 0
    teile.spur.setAttribute('opacity', spur)
    teile.k.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(1)})`)
  } else if (figur === 'camper') {
    let x = -40 + p * 120, dreh = p * 200
    if (ph === 'bereit' && !ruhig) x = 80 + Math.sin(t / 50) * 0.8
    if (laden) { x = ((80 + l * 0.12 + 40) % 280) - 40; dreh = l * 0.9 }
    if (ruhig) x = 80
    teile.k.setAttribute('transform', `translate(${x.toFixed(1)} 62)`)
    teile.r.forEach((w, i) => w.setAttribute('transform', `translate(${i ? 20 : -14} 1) rotate(${dreh.toFixed(1)})`))
    teile.staub.setAttribute('opacity', laden ? 1 : 0)
    teile.puffs.forEach((pf, i) => { const a = ((l / 400) + i / 3) % 1; pf.setAttribute('cx', (x - 30 - a * 26).toFixed(1)); pf.setAttribute('cy', (60 - a * 8).toFixed(1)); pf.setAttribute('r', (3 + a * 5).toFixed(1)); pf.setAttribute('opacity', (1 - a).toFixed(2)) })
  } else if (figur === 'uluru') {
    let sx = 100, sy = 68 - p * 40
    if (laden) { const u = (l / 3000) % 1; sx = 40 + u * 120; sy = 36 - Math.sin(u * Math.PI) * 22 }
    if (ruhig) { sx = 100; sy = 28 }
    teile.sonne.setAttribute('cx', sx.toFixed(1)); teile.sonne.setAttribute('cy', sy.toFixed(1))
  } else if (figur === 'schlange') {
    const len = laden ? 170 : ruhig ? 120 : 12 + p * 158
    const shift = laden ? l * 0.12 : 0
    let d = '', hx = 0, hy = 0
    for (let i = 0; i <= len; i += 4) {
      const x = laden ? ((10 + i + shift) % 260) - 30 : 10 + i
      const y = 40 + Math.sin((i - shift) / 14) * 6
      d += (i && !(laden && x < hx) ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
      hx = x; hy = y
    }
    teile.koerper.setAttribute('d', d); teile.muster.setAttribute('d', d)
    teile.kopf.setAttribute('transform', `translate(${hx.toFixed(1)} ${hy.toFixed(1)})`)
    teile.zunge.setAttribute('opacity', !ruhig && Math.sin(t / 90) > 0 ? 1 : 0)
  }
}
