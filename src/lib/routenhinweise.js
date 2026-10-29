// Hinweise entlang einer berechneten Route — reine Funktionen (ohne Netz, testbar).
//
// Ermittelt werden:
//   · Tankstellen: nicht nur die EINE größte Lücke, sondern jede lange Strecke ohne Tankstelle,
//     mit der letzten und der nächsten Tankstelle beim Namen.
//   · Sehenswertes: Orte aus der Sammlung, die an oder nahe der Route liegen, aber kein Stopp
//     sind — mit der Stelle, an der sie in die Stoppliste gehören.
//   · Wetter: Punkte entlang der ganzen Strecke, an denen die Vorhersage geprüft wird.
//
// Warum neu abtasten: OSRM liefert im Outback auf geraden Highways Stützpunkte, die über 10 km
// auseinanderliegen. Der Abstand „Tankstelle → nächster Stützpunkt" wäre dann viel zu groß,
// obwohl sie direkt an der Straße liegt. Deshalb wird die Linie alle ~1 km abgetastet.
import { t } from './i18n.js'

const RAD = Math.PI / 180
/** Schnelle Distanz (km) — für Abstände unter einigen hundert km genau genug. */
function km(lon1, lat1, lon2, lat2) {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * RAD) * 111.32
  const y = (lat2 - lat1) * 110.57
  return Math.sqrt(x * x + y * y)
}

/**
 * Die Linie gleichmäßig abtasten: [{ x, y, km }] mit km = Strecke ab Start.
 * Mit `gesamtKm` (Länge laut Straßenroute) werden alle km darauf geeicht: Das Ziel liegt dann
 * genau bei der Länge, die die App für die Route anzeigt. Die eigene Messung entlang der Linie
 * weicht sonst um einige km ab (Größenordnung 0,2 %).
 */
export function stichproben(geometrie, abstandKm = 1, gesamtKm = null) {
  const out = []
  if (!geometrie || geometrie.length < 2) return out
  let gesamt = 0
  out.push({ x: geometrie[0][0], y: geometrie[0][1], km: 0 })
  for (let i = 1; i < geometrie.length; i++) {
    const [x0, y0] = geometrie[i - 1], [x1, y1] = geometrie[i]
    const l = km(x0, y0, x1, y1)
    const n = Math.max(1, Math.ceil(l / abstandKm))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, km: gesamt + l * t })
    }
    gesamt += l
  }
  if (gesamtKm > 0 && gesamt > 0) {
    const f = gesamtKm / gesamt
    for (const p of out) p.km *= f
  }
  return out
}

/**
 * Strecken ohne Versorgung zwischen Punkten auf der Route (Tankstellen, Wasser …).
 * EINE Rechnung für den Routenhinweis und die Versorgung, damit beide dieselbe Zahl zeigen.
 * Jede Position wird einmal auf ganze km gerundet; jede Länge ist die Differenz zweier dieser
 * Zahlen. So gilt immer „von km + Länge = bis km“, und keine Anzeige weicht um 1 km ab.
 * @param punkte  [{ km, name }] nach km sortiert
 * @returns { luecken: [{ von, bis, vonKm, bisKm, laenge, ueberReichweite }], maxLuecke }
 */
export function streckenOhne(punkte, gesamtKm, { abKm = 150, start = t('Start'), ziel = t('Ziel'), reichweiteKm = Infinity } = {}) {
  const ende = Math.max(0, Math.round(gesamtKm || 0))
  // Mehrere Einträge am selben Ort (Roadhouse mit 2 Zapfsäulen) zählen als eine Stelle
  const marken = [{ km: 0, name: start }]
  for (const p of punkte || []) {
    const k = Math.min(ende, Math.max(0, Math.round(p.km)))
    if (k - marken[marken.length - 1].km > 1) marken.push({ km: k, name: p.name })
  }
  marken.push({ km: ende, name: ziel })
  const luecken = []
  let maxLuecke = 0
  for (let i = 1; i < marken.length; i++) {
    const laenge = marken[i].km - marken[i - 1].km
    if (laenge > maxLuecke) maxLuecke = laenge
    if (laenge >= abKm) {
      luecken.push({ von: marken[i - 1].name, bis: marken[i].name, vonKm: marken[i - 1].km,
        bisKm: marken[i].km, laenge, ueberReichweite: laenge > reichweiteKm })
    }
  }
  return { luecken, maxLuecke }
}

/** Gitter über die Stichproben — Nachbarsuche nur in umliegenden Zellen. */
export function baueGitter(proben, zelle = 0.2) {
  const m = new Map()
  proben.forEach((p, i) => {
    const k = Math.floor(p.x / zelle) + ':' + Math.floor(p.y / zelle)
    let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(i)
  })
  return { m, zelle, proben }
}

/** Alle Stichproben höchstens `maxKm` vom Punkt entfernt: [{ km, abstand }] (unsortiert). */
function inDerNaehe(gitter, lon, lat, maxKm) {
  const { m, zelle, proben } = gitter
  const r = Math.ceil(maxKm / (zelle * 80)) + 1          // 0,2° ≈ 16–22 km in Australien
  const cx = Math.floor(lon / zelle), cy = Math.floor(lat / zelle)
  const out = []
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const l = m.get((cx + dx) + ':' + (cy + dy))
      if (!l) continue
      for (const i of l) {
        const p = proben[i]
        const d = km(lon, lat, p.x, p.y)
        if (d <= maxKm) out.push({ km: p.km, abstand: d })
      }
    }
  }
  return out
}

/** Nächste Stelle der Route (ab `abKm`): { km, abstand } oder null, wenn weiter als maxKm. */
export function aufRoute(gitter, lon, lat, maxKm, abKm = -Infinity) {
  let best = null
  for (const c of inDerNaehe(gitter, lon, lat, maxKm)) {
    if (c.km < abKm) continue
    if (!best || c.abstand < best.abstand) best = c
  }
  return best
}

/**
 * JEDER Durchgang der Route an einem Punkt vorbei. Fährt die Route zweimal an derselben
 * Tankstelle vorbei (hin und zurück), zählt sie für beide Male. Würde nur der nächstgelegene
 * Durchgang gezählt, entstünde auf dem Rückweg eine Schein-Lücke von mehreren hundert km.
 */
export function durchgaenge(gitter, lon, lat, maxKm) {
  const c = inDerNaehe(gitter, lon, lat, maxKm).sort((a, b) => a.km - b.km)
  const out = []
  for (const p of c) {
    const letzt = out[out.length - 1]
    if (letzt && p.km - letzt.bisKm <= maxKm * 2 + 3) {     // gehört zum selben Vorbeifahren
      letzt.bisKm = p.km
      if (p.abstand < letzt.abstand) { letzt.abstand = p.abstand; letzt.km = p.km }
    } else out.push({ km: p.km, abstand: p.abstand, bisKm: p.km })
  }
  return out.map(({ km, abstand }) => ({ km, abstand }))
}

/**
 * Tankstellen an der Strecke und die Strecken dazwischen.
 * @returns { stationen, luecken: [{ von, bis, vonKm, bisKm, laenge, ueberReichweite }], maxLuecke, gesamtKm }
 *   `luecken` enthält nur Strecken ≥ `abKm`, in Fahrtrichtung sortiert.
 */
export function tankLuecken(geometrie, tankstellen, { korridorKm = 5, reichweiteKm = 500, abKm = 150, start = t('Start'), ziel = t('Ziel'), ortsnamen = [], gesamtKm = null } = {}) {
  const proben = stichproben(geometrie, 1, gesamtKm)
  if (!proben.length) return null
  const laenge = proben[proben.length - 1].km
  const gitter = baueGitter(proben)
  // Namenlose Tankstellen (in OSM häufig) und reine Markennamen („Ampol", „BP") nach dem
  // nächsten Ort benennen — „Ampol → BP" sagt unterwegs nichts, „Ampol bei Carnarvon" schon.
  const naechsterOrt = (t) => {
    let best = null
    for (const o of ortsnamen) {
      if (o.lat == null) continue
      const d = km(t.x, t.y, o.lon, o.lat)
      if (d <= 40 && (!best || d < best.d)) best = { d, name: o.name }
    }
    return best?.name || null
  }
  const benenne = (st) => {
    const ort = naechsterOrt(st)
    if (!st.n) return ort ? t('Tankstelle bei {ort}', { ort }) : t('Tankstelle')
    return MARKE.test(st.n.trim()) && ort ? t('{name} bei {ort}', { name: st.n, ort }) : st.n
  }
  const stationen = []
  for (const t of tankstellen) {
    for (const r of durchgaenge(gitter, t.x, t.y, korridorKm)) stationen.push({ km: r.km, name: benenne(t), abstand: r.abstand })
  }
  stationen.sort((a, b) => a.km - b.km)
  const { luecken, maxLuecke } = streckenOhne(stationen, laenge, { abKm, start, ziel, reichweiteKm })
  return { stationen: stationen.length, luecken, maxLuecke, gesamtKm: Math.round(laenge) }
}

const MARKE = /^(bp|bp connect|ampol|ampol foodary|shell|shell coles express|coles express|caltex|puma|united|liberty|mobil|7-eleven|vibe|metro|metro petroleum|eg|eg ampol|iga petrol|iga fuel|woolworths|on the run|otr|gull|better choice)$/i

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
// Wörter, die in vielen Namen stecken und nichts unterscheiden
const ALLGEMEIN = new Set(['national', 'park', 'np', 'beach', 'bay', 'island', 'islands', 'station', 'gorge', 'river',
  'creek', 'lake', 'mount', 'point', 'cape', 'range', 'track', 'lookout', 'nature', 'reserve', 'pool', 'springs',
  'north', 'south', 'east', 'west', 'the', 'and', 'und', 'von', 'bei', 'road', 'hwy', 'highway', 'roadhouse'])
const kennwoerter = (s) => norm(s).split(' ').filter((w) => w.length >= 5 && !ALLGEMEIN.has(w))

/**
 * Orte aus der Sammlung, die höchstens `maxKm` neben der Route liegen und noch kein Stopp sind.
 * `nachStopp` = Index in `stopps` (volle Liste), NACH dem der Ort eingefügt gehört.
 * Sortiert in Fahrtrichtung.
 */
export function orteAnRoute(geometrie, orte, stopps, { maxKm = 25, ignoriert = [], gesamtKm = null } = {}) {
  const proben = stichproben(geometrie, 1, gesamtKm)
  if (!proben.length) return []
  const gitter = baueGitter(proben)
  // Wo liegen die Stopps auf der Route? IN IHRER REIHENFOLGE: jeder Stopp wird erst hinter dem
  // vorigen gesucht — sonst fiele ein zweiter Besuch desselben Orts auf den ersten.
  // Stopps ohne Koordinaten übernehmen die Lage des Vorgängers.
  const stoppKm = []
  let letzt = 0
  for (const s of stopps || []) {
    if (s.lat != null && s.lon != null) {
      const r = aufRoute(gitter, s.lon, s.lat, 60, letzt - 1)
      if (r) letzt = r.km
    }
    stoppKm.push(letzt)
  }
  // Schon eingeplant? Gleicher Name, ein gemeinsames Kennwort („Karijini NP" = Stopp
  // „Karijini National Park") oder ein Stopp höchstens 5 km entfernt.
  const stoppNamen = new Set((stopps || []).map((s) => norm(s.name)))
  const stoppWoerter = new Set((stopps || []).flatMap((s) => kennwoerter(s.name)))
  const istStopp = (o) => stoppNamen.has(norm(o.name))
    || kennwoerter(o.name).some((w) => stoppWoerter.has(w))
    || (stopps || []).some((s) => s.lat != null && o.lat != null && km(s.lon, s.lat, o.lon, o.lat) < 5)
  const weg = new Set(ignoriert)
  const out = []
  for (const o of orte) {
    if (o.lat == null || o.lon == null || weg.has(o.id) || istStopp(o)) continue
    const r = aufRoute(gitter, o.lon, o.lat, maxKm)
    if (!r) continue
    let nach = 0
    for (let i = 0; i < stoppKm.length; i++) if (stoppKm[i] <= r.km) nach = i
    out.push({ ort: o, km: Math.round(r.km), abstand: Math.round(r.abstand), nachStopp: nach })
  }
  return out.sort((a, b) => a.km - b.km)
}

/** Punkte entlang der Strecke für die Wetterprüfung — etwa alle `alleKm`, mindestens Start und Ziel. */
export function wetterPunkte(geometrie, alleKm = 100, hoechstens = 60, gesamtKm = null) {
  const proben = stichproben(geometrie, 1, gesamtKm)
  if (!proben.length) return []
  const gesamt = proben[proben.length - 1].km
  const schritt = Math.max(alleKm, gesamt / hoechstens)
  const out = []
  let naechster = 0
  for (const p of proben) {
    if (p.km >= naechster) { out.push({ lon: p.x, lat: p.y, km: Math.round(p.km) }); naechster += schritt }
  }
  const z = proben[proben.length - 1]
  if (out[out.length - 1].km < Math.round(z.km) - 20) out.push({ lon: z.x, lat: z.y, km: Math.round(z.km) })
  return out
}

/** Neuen Stopp an der richtigen Stelle einfügen (nach Index `nach`). */
export function stoppEinfuegen(stopps, nach, ort) {
  const neu = { name: ort.name, lat: ort.lat ?? null, lon: ort.lon ?? null, img: ort.bild || ort.img || null }
  const l = [...(stopps || [])]
  l.splice(Math.min(l.length, nach + 1), 0, neu)
  return l
}

// ---------- Ergänzt für „Versorgung unterwegs“ (Arbeitspaket A) ----------

/** Distanz in km (gleiche Näherung wie oben), für andere Module. */
export const distanzKm = km

/**
 * Wo liegen die Stopps auf der Route? km ab Start, in Stopp-Reihenfolge (jeder Stopp wird
 * erst hinter dem vorigen gesucht, wie in orteAnRoute). Stopps ohne Koordinaten erben die
 * Lage des Vorgängers.
 */
export function stoppKmAufRoute(gitter, stopps, maxKm = 60) {
  const out = []
  let letzt = 0
  for (const s of stopps || []) {
    if (s && s.lat != null && s.lon != null) {
      const r = aufRoute(gitter, s.lon, s.lat, maxKm, letzt - 1)
      if (r) letzt = r.km
    }
    out.push(letzt)
  }
  return out
}
