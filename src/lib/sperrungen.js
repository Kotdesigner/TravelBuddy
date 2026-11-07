// Sperrungen in der Wegwahl (V29). Reine Logik ohne DOM, läuft im Hintergrund-Rechner und in den Tests.
//
// Quelle sind die Meldungen von Main Roads WA (strassenlage.js). Ihre Linien folgen der Straße, liegen
// aber nicht genau auf den Linien aus OpenStreetMap: mal ein paar Meter daneben, mal als Mittellinie
// zwischen zwei Fahrbahnen, mal gröber gezeichnet. Deshalb ordnet die App sie über Abstand UND Richtung
// zu: Alle 50 m entlang der Sperrung sucht sie die nächste Straße, die höchstens 40 m entfernt ist und
// höchstens 30° anders verläuft. So landet eine Sperrung nicht auf einer Querstraße, die sie kreuzt,
// und nicht auf einer Parallelstraße daneben.
//
// Was sperrt: „gesperrt“ (Rang 3) immer, „nur mit Allrad“ nur ohne 4WD. Flächenwarnungen (Feuer, Flut,
// Zyklon) sperren nie, sie bleiben Hinweise an der Route.
import { meter, punkt, ZELLE } from './offline-router.js'

export const SPERR_ABSTAND_M = 40
export const ZWEITE_FAHRBAHN_M = 25   // getrennte Fahrbahnen: auch die zweite, wenn sie so nah, parallel und Einbahn ist
export const SPERR_WINKEL_GRAD = 30
export const PROBE_M = 50
const COS_MIN = Math.cos((SPERR_WINKEL_GRAD * Math.PI) / 180)
const RAD = Math.PI / 180

/** Meldung „nur mit Allrad“ (4WD only) */
export const nurAllrad = (m) => /\b4wd\b|four[ -]wheel[ -]drive|\b4x4\b/i.test(`${m?.sperrung || ''} ${m?.art || ''} ${m?.hinweis || ''}`)

/** Sperrt diese Meldung die Straße für dieses Fahrzeug? */
export function sperrtFuer(m, { allrad = false } = {}) {
  if (!m || m.ringe?.length) return false               // Flächen sperren nie
  if (!(m.linien?.length || m.punkte?.length)) return false
  if (m.rang === 3) return true
  return m.rang === 2 && !allrad && nurAllrad(m)
}

// Punkte alle `schritt` Meter entlang einer Linie, mit Richtung (Einheitsvektor in Metern) und Länge
export function proben(linie, schritt = PROBE_M) {
  const out = []
  for (let i = 1; i < (linie || []).length; i++) {
    const [x0, y0] = linie[i - 1], [x1, y1] = linie[i]
    const l = meter(x0, y0, x1, y1)
    if (!(l > 0)) continue
    const kx = Math.cos(y0 * RAD), dx = (x1 - x0) * kx, dy = y1 - y0, n = Math.hypot(dx, dy)
    const teile = Math.max(1, Math.round(l / schritt))
    for (let k = 0; k < teile; k++) {
      const t = (k + 0.5) / teile
      out.push({ lon: x0 + (x1 - x0) * t, lat: y0 + (y1 - y0) * t, ux: dx / n, uy: dy / n, l: l / teile })
    }
  }
  return out
}

// Abstand Punkt zu Strecke in Metern und Richtung der Strecke (lokal flach gerechnet)
function zuStrecke(lon, lat, a, b) {
  const kx = Math.cos(lat * RAD) * 111320, ky = 110574
  const ax = (a[0] - lon) * kx, ay = (a[1] - lat) * ky, bx = (b[0] - lon) * kx, by = (b[1] - lat) * ky
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
  let t = l2 ? -(ax * dx + ay * dy) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const n = Math.sqrt(l2) || 1
  return { d: Math.hypot(ax + t * dx, ay + t * dy), ux: dx / n, uy: dy / n, t }
}

// Netzkanten zu einer Probe: die nächste, die nah genug liegt und in dieselbe Richtung läuft, dazu
// weitere parallele Kanten bis ZWEITE_FAHRBAHN_M (die Gegenfahrbahn einer getrennten Straße).
// Querstraßen fallen über die Richtung weg, Parallelstraßen über den Abstand.
function kantenZuProbe(net, s, maxM = SPERR_ABSTAND_M, mitRichtung = true) {
  const [w, so] = net.rahmen
  const cx = Math.floor((s.lon - w) / ZELLE), cy = Math.floor((s.lat - so) / ZELLE)
  const nah = new Map()
  for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
    if (x < 0 || y < 0 || x >= net.gw || y >= net.gh) continue
    const c = y * net.gw + x
    for (let j = net.zStart[c]; j < net.zStart[c + 1]; j++) {
      const i = net.zKante[j], k = net.zStueck[j]
      const z = zuStrecke(s.lon, s.lat, punkt(net, i, k), punkt(net, i, k + 1))
      if (z.d > maxM) continue
      if (mitRichtung && Math.abs(z.ux * s.ux + z.uy * s.uy) < COS_MIN) continue
      if (!nah.has(i) || z.d < nah.get(i)) nah.set(i, z.d)
    }
  }
  if (!nah.size) return []
  const sortiert = [...nah].sort((a, b) => a[1] - b[1])
  if (!mitRichtung) return [sortiert[0][0]]
  // Zweite Fahrbahn nur, wenn beide Einbahn sind (so trägt OSM getrennte Fahrbahnen ein);
  // eine Parallelstraße im Ort ist in beide Richtungen offen und bleibt frei für die Umleitung
  const [erste] = sortiert[0], einbahn = (i) => net.eFlag[i] & 32
  return sortiert.filter(([i, d], n) => n === 0 || (d <= ZWEITE_FAHRBAHN_M && einbahn(erste) && einbahn(i))).map(([i]) => i)
}

/**
 * Netzkanten, auf denen eine Meldung liegt. Eine Kante zählt, wenn ein spürbarer Teil der Sperrung auf
 * ihr liegt: mindestens 300 m, oder die halbe Sperrung, oder die halbe Kante (was davon kleiner ist).
 * Liefert { kanten, gedeckt (Anteil der Sperrung, der eine Straße fand), laengeM }.
 */
export function kantenFuerMeldung(net, m) {
  const treffer = new Map()
  let gesamt = 0, gefunden = 0
  for (const linie of m.linien || []) {
    if (linie.length === 1) { for (const e of kantenZuProbe(net, { lon: linie[0][0], lat: linie[0][1] }, 100, false)) treffer.set(e, Infinity); continue }
    for (const s of proben(linie)) {
      gesamt += s.l
      const es = kantenZuProbe(net, s)
      for (const e of es) treffer.set(e, (treffer.get(e) || 0) + s.l)
      if (es.length) gefunden += s.l
    }
  }
  // Punkt-Meldungen: die nächste Straße bis 100 m, Richtung unbekannt
  for (const p of m.punkte || []) for (const e of kantenZuProbe(net, { lon: p[0], lat: p[1] }, 100, false)) treffer.set(e, Infinity)
  const kanten = []
  for (const [e, gedecktM] of treffer) if (gedecktM >= Math.min(300, gesamt * 0.5, net.eLen[e] * 0.5)) kanten.push(e)
  return { kanten, gedeckt: gesamt ? gefunden / gesamt : (kanten.length ? 1 : 0), laengeM: gesamt }
}

/** Gesperrte Kanten für alle Meldungen, die für dieses Fahrzeug sperren: { gesperrt: Set, je: Map(id → Kanten) } */
export function sperrKanten(net, meldungen, { allrad = false } = {}) {
  const gesperrt = new Set(), je = new Map()
  for (const m of meldungen || []) {
    if (!sperrtFuer(m, { allrad })) continue
    const { kanten } = kantenFuerMeldung(net, m)
    je.set(m.id, kanten)
    for (const e of kanten) gesperrt.add(e)
  }
  return { gesperrt, je }
}

/**
 * Führt eine Route (Linie aus OSRM oder dem eigenen Netz) durch eine Sperrung? Gleiche Regel wie oben:
 * Abstand höchstens 40 m und gleiche Richtung, ein spürbarer Teil der Sperrung liegt auf der Route.
 * Liefert je Treffer { meldung, km } (km ab Start der Route), sortiert nach km.
 */
export function sperrungenAnRoute(geometrie, meldungen, { allrad = false } = {}) {
  const g = geometrie || []
  if (g.length < 2) return []
  // Raster der Routenstücke, Zellen etwa 1 km
  const Z = 0.01, zellen = new Map(), kmBis = [0]
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 1; i < g.length; i++) {
    const [x0, y0] = g[i - 1], [x1, y1] = g[i]
    kmBis.push(kmBis[i - 1] + meter(x0, y0, x1, y1) / 1000)
    minX = Math.min(minX, x0, x1); maxX = Math.max(maxX, x0, x1); minY = Math.min(minY, y0, y1); maxY = Math.max(maxY, y0, y1)
    for (let x = Math.floor(Math.min(x0, x1) / Z); x <= Math.floor(Math.max(x0, x1) / Z); x++)
      for (let y = Math.floor(Math.min(y0, y1) / Z); y <= Math.floor(Math.max(y0, y1) / Z); y++) {
        const k = x + ':' + y
        if (!zellen.has(k)) zellen.set(k, [])
        zellen.get(k).push(i)
      }
  }
  const rand = 0.002
  const naechstes = (s, maxM, mitRichtung) => {
    let best = null
    for (let x = Math.floor(s.lon / Z) - 1; x <= Math.floor(s.lon / Z) + 1; x++) for (let y = Math.floor(s.lat / Z) - 1; y <= Math.floor(s.lat / Z) + 1; y++) {
      for (const i of zellen.get(x + ':' + y) || []) {
        const z = zuStrecke(s.lon, s.lat, g[i - 1], g[i])
        if (z.d > maxM || (best && z.d >= best.d)) continue
        if (mitRichtung && Math.abs(z.ux * s.ux + z.uy * s.uy) < COS_MIN) continue
        best = { d: z.d, km: kmBis[i - 1] + (kmBis[i] - kmBis[i - 1]) * z.t }
      }
    }
    return best
  }
  const out = []
  for (const m of meldungen || []) {
    if (!sperrtFuer(m, { allrad })) continue
    const alle = [...(m.linien || []).flat(), ...(m.punkte || [])]
    if (!alle.some(([x, y]) => x >= minX - rand && x <= maxX + rand && y >= minY - rand && y <= maxY + rand)) continue
    let gesamt = 0, gedeckt = 0, km = Infinity
    for (const linie of m.linien || []) {
      for (const s of proben(linie)) {
        gesamt += s.l
        const b = naechstes(s, SPERR_ABSTAND_M, true)
        if (b) { gedeckt += s.l; km = Math.min(km, b.km) }
      }
    }
    let punktTreffer = false
    for (const [lon, lat] of [...(m.punkte || []), ...(m.linien || []).filter((l) => l.length === 1).map((l) => l[0])]) {
      const b = naechstes({ lon, lat }, 100, false)
      if (b) { punktTreffer = true; km = Math.min(km, b.km) }
    }
    if (punktTreffer || (gesamt && gedeckt >= Math.min(300, gesamt * 0.5))) out.push({ meldung: m, km: Math.round(km) })
  }
  return out.sort((a, b) => a.km - b.km)
}
