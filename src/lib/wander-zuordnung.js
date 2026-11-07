// Wanderungen und Routen zusammenbringen: Wie weit liegt ein Startpunkt neben einer Route oder Etappe,
// und welche ist die nächste? Wanderungen auf der Liste ordnen sich so von selbst der Route zu, die
// höchstens NAH_KM entfernt vorbeiführt (Feld reiseAuto: true). Wer selbst eine Route wählt oder
// „keine Angabe“ setzt, bekommt reiseAuto: false, dann rührt die App die Zuordnung nicht mehr an.
import { get } from 'svelte/store'
import { reisen as reisenStore, wanderungen as wanderStore, updateWanderung } from './userdata.js'
import { istRoute } from './plan.js'

export const NAH_KM = 25

const R = Math.PI / 180
export function km(aLat, aLon, bLat, bLon) {
  const dl = (bLat - aLat) * R, dn = (bLon - aLon) * R
  const h = Math.sin(dl / 2) ** 2 + Math.cos(aLat * R) * Math.cos(bLat * R) * Math.sin(dn / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** Taugt die Reise zum Zuordnen? Ideen, Flüge und Reisen ohne Punkte nicht. */
export function zuordenbar(r) {
  if (!r || r.idee) return false
  if (r.art === 'flug' || r.flug || r.route?.flug) return false
  return punkteVon(r).length > 0
}

/** Punkte einer Reise als [lon, lat]: berechnete Strecke, sonst die Stopps. */
export function punkteVon(r) {
  const g = r?.route?.geometry
  if (Array.isArray(g) && g.length > 1) return g
  return (r?.stops || []).filter((s) => s && s.lat != null && s.lon != null).map((s) => [s.lon, s.lat])
}

// Rahmen je Punktliste merken: liegt ein Ort weit außerhalb, ist die Route gleich erledigt
const rahmenCache = new WeakMap()
function rahmenVon(pts) {
  let b = rahmenCache.get(pts)
  if (!b) {
    b = [180, 90, -180, -90]
    for (const [lon, lat] of pts) { if (lon < b[0]) b[0] = lon; if (lat < b[1]) b[1] = lat; if (lon > b[2]) b[2] = lon; if (lat > b[3]) b[3] = lat }
    rahmenCache.set(pts, b)
  }
  return b
}

/** Abstand eines Punkts zur Reise in km und der nächste benannte Stopp. */
export function abstandZur(p, r) {
  const pts = punkteVon(r)
  if (!pts.length || p?.lat == null || p?.lon == null) return null
  const b = rahmenVon(pts)
  if (p.lon < b[0] - 4 || p.lon > b[2] + 4 || p.lat < b[1] - 3.6 || p.lat > b[3] + 3.6) return null
  let best = Infinity
  // Abstand zu jedem Streckenstück, nicht nur zu den Ecken: Routen aus wenigen Stopps sind gerade Linien.
  // Grobe Vorauswahl: Stücke, die mehr als gut 150 km entfernt liegen, sparen wir uns.
  const kx = Math.cos(p.lat * R) * 111.32, ky = 110.57
  const zuXY = ([lon, lat]) => [(lon - p.lon) * kx, (lat - p.lat) * ky]
  const weit = ([lon, lat]) => Math.abs(lat - p.lat) > 1.5 || Math.abs(lon - p.lon) > 1.8
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[i + 1] || pts[i]
    if (weit(a) && weit(b) && !((a[1] - p.lat) * (b[1] - p.lat) < 0 || (a[0] - p.lon) * (b[0] - p.lon) < 0)) continue
    const [ax, ay] = zuXY(a), [bx, by] = zuXY(b)
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0
    const k = Math.hypot(ax + t * dx, ay + t * dy)
    if (k < best) best = k
  }
  if (best > 400) best = Infinity
  if (best === Infinity) return null
  let stopp = null, stoppKm = Infinity
  for (const s of r.stops || []) {
    if (!s?.name || s.lat == null) continue
    const k = km(p.lat, p.lon, s.lat, s.lon)
    if (k < stoppKm) { stoppKm = k; stopp = s.name }
  }
  return { km: Math.round(best), stopp, stoppKm: Math.round(stoppKm) }
}

/** Nächste Route oder Etappe innerhalb von maxKm. Routen gewinnen bei gleichem Abstand. */
export function naechsteReise(p, reisen = [], maxKm = NAH_KM) {
  let treffer = null
  for (const r of reisen) {
    if (!zuordenbar(r)) continue
    const a = abstandZur(p, r)
    if (!a || a.km > maxKm) continue
    const besser = !treffer || a.km < treffer.km || (a.km === treffer.km && istRoute(r) && !istRoute(treffer.reise))
    if (besser) treffer = { reise: r, ...a }
  }
  return treffer
}

/** Darf die App diese Wanderung von selbst zuordnen? */
export const autoErlaubt = (w) => !!w && w.lat != null && w.lon != null && (w.reiseAuto === true || (!w.reiseId && w.reiseAuto !== false))

/** Änderungen für die automatische Zuordnung. Rückgabe: [{ id, patch }] */
export function autoZuordnung(wanderungen = [], reisen = [], maxKm = NAH_KM) {
  const aus = []
  for (const w of wanderungen) {
    if (!autoErlaubt(w)) continue
    const n = naechsteReise(w, reisen, maxKm)
    if (n) {
      if (w.reiseId !== n.reise.id || w.reiseAuto !== true) aus.push({ id: w.id, patch: { reiseId: n.reise.id, reiseAuto: true } })
    } else if (w.reiseAuto === true && w.reiseId) {
      aus.push({ id: w.id, patch: { reiseId: null, reiseAuto: null } })
    }
  }
  return aus
}

/** Läuft im Hintergrund, solange die App offen ist. Wartet kurz, damit Tippen an einer Route nicht ständig rechnet. */
export function starteWanderZuordnung(warte = 600) {
  let timer = 0
  const lauf = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      for (const { id, patch } of autoZuordnung(get(wanderStore), get(reisenStore))) updateWanderung(id, patch)
    }, warte)
  }
  const ab1 = reisenStore.subscribe(lauf)
  const ab2 = wanderStore.subscribe(lauf)
  return () => { clearTimeout(timer); ab1(); ab2() }
}
