// Versorgung entlang einer Route: reine Rechnungen, offline, ohne Stores.
//
// Quelle sind die mitgelieferten OpenStreetMap-Punkte in public/pois-<region>.json
// ({ k: Kategorie, n: Name, y: Breite, x: Länge }). Jeder Punkt im Korridor neben der Strecke
// bekommt seinen Streckenkilometer. Fährt die Route zweimal vorbei (hin und zurück), zählt er
// für beide Male, wie bei den Tank-Lücken in routenhinweise.js.
import { stichproben, baueGitter, durchgaenge, stoppKmAufRoute, distanzKm, streckenOhne } from './routenhinweise.js'
import { dezimal } from './format.js'
import { t, jeSprache } from './i18n.js'

export const KATEGORIEN = jeSprache(() => ([
  { k: 'fuel', label: t('Tankstelle'), mehrzahl: t('Tankstellen'), emoji: '⛽' },
  { k: 'wasser', label: t('Wasser'), mehrzahl: t('Wasser'), emoji: '💧' },
  { k: 'wc', label: t('Toilette'), mehrzahl: t('Toiletten'), emoji: '🚻' },
  { k: 'camp', label: t('Camping'), mehrzahl: t('Camps'), emoji: '🏕️' },
  { k: 'rast', label: t('Rastplatz'), mehrzahl: t('Rastplätze'), emoji: '🅿️' },
  { k: 'laden', label: t('Laden'), mehrzahl: t('Läden'), emoji: '🛒' },
  { k: 'werkstatt', label: t('Werkstatt'), mehrzahl: t('Werkstätten'), emoji: '🔧' },
  { k: 'klinik', label: 'Klinik/Arzt', mehrzahl: t('Kliniken'), emoji: '🏥' },
]))
export const KAT = jeSprache(() => Object.fromEntries(KATEGORIEN.map((k) => [k.k, k])))

/** Tankstellen dürfen etwas weiter weg liegen (wie bei den Tank-Lücken), der Rest 3 km. */
export const KORRIDOR = { fuel: 5, standard: 3 }
export const korridorFuer = (k, korridor = KORRIDOR) => korridor[k] ?? korridor.standard

/** Ab dieser Länge gilt eine Strecke ohne Tankstelle bzw. Wasser als lang. */
export const LUECKE_AB = { fuel: 150, wasser: 150 }

const MARKE = /^(bp|bp connect|ampol|ampol foodary|shell|coles express|caltex|puma|united|liberty|mobil|7-eleven|metro|eg|eg ampol|vibe|on the run|otr|gull)$/i

/**
 * Punkte im Korridor neben der Route, nach Streckenkilometer sortiert.
 * @param geometrie  [[lon,lat] …]
 * @param pois       [{ k, n, y, x }]
 * @param o.ortsnamen [{ name, lat, lon }] für namenlose Punkte („Wasser bei Carnarvon“)
 * @param o.gesamtKm  Länge laut Route (eicht die Streckenkilometer, siehe stichproben)
 * @returns [{ k, name, km, abstand, lat, lon }]
 */
export function versorgungAnRoute(geometrie, pois, { korridor = KORRIDOR, kategorien = Object.keys(KAT), ortsnamen = [], gesamtKm = null } = {}) {
  const proben = stichproben(geometrie, 1, gesamtKm)
  if (!proben.length) return []
  const gitter = baueGitter(proben)
  const erlaubt = new Set(kategorien)
  const maxK = Math.max(...Object.values(korridor))
  // Grob vorsortieren: nur Punkte im Rechteck um die Strecke
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const p of proben) { if (p.x < w) w = p.x; if (p.x > e) e = p.x; if (p.y < s) s = p.y; if (p.y > n) n = p.y }
  const rand = maxK / 80 + 0.05
  const naechsterOrt = (lon, lat) => {
    let best = null
    for (const o of ortsnamen) {
      if (o?.lat == null) continue
      const d = distanzKm(lon, lat, o.lon, o.lat)
      if (d <= 40 && (!best || d < best.d)) best = { d, name: o.name }
    }
    return best?.name || null
  }
  const out = []
  for (const p of pois || []) {
    if (!erlaubt.has(p.k) || p.x < w - rand || p.x > e + rand || p.y < s - rand || p.y > n + rand) continue
    const treffer = durchgaenge(gitter, p.x, p.y, korridorFuer(p.k, korridor))
    if (!treffer.length) continue
    let name = (p.n || '').trim()
    if (!name || MARKE.test(name)) {
      const ort = naechsterOrt(p.x, p.y)
      const art = name || KAT[p.k]?.label || t('Punkt')
      name = ort ? t('{art} bei {ort}', { art, ort }) : art
    }
    for (const tr of treffer) out.push({ k: p.k, name, km: tr.km, abstand: tr.abstand, lat: p.y, lon: p.x })
  }
  out.sort((a, b) => a.km - b.km)
  // Doppelte (gleiche Kategorie, gleicher Name, unter 1 km auseinander) zusammenfassen
  const ergebnis = []
  for (const x of out) {
    let dup = null
    for (let i = ergebnis.length - 1; i >= 0 && x.km - ergebnis[i].km < 1; i--) {
      if (ergebnis[i].k === x.k && ergebnis[i].name === x.name) { dup = ergebnis[i]; break }
    }
    if (dup) { if (x.abstand < dup.abstand) Object.assign(dup, x); continue }
    ergebnis.push({ ...x })
  }
  return ergebnis.map((x) => ({ ...x, km: Math.round(x.km), abstand: Math.round(x.abstand * 10) / 10 }))
}

/**
 * Lange Strecken ohne eine Kategorie (Start und Ziel zählen als Grenze, nicht als Versorgung).
 * Rechnet mit derselben Funktion wie der Tank-Hinweis der Route (`streckenOhne`).
 * @returns [{ k, vonKm, bisKm, laenge, von, bis, ueberReichweite }] in Fahrtrichtung
 */
export function luecken(liste, gesamtKm, k, { abKm = LUECKE_AB[k] ?? 150, start = t('Start'), ziel = t('Ziel'), reichweiteKm = Infinity } = {}) {
  const punkte = (liste || []).filter((x) => x.k === k)
  return streckenOhne(punkte, gesamtKm, { abKm, start, ziel, reichweiteKm }).luecken.map((l) => ({ k, ...l }))
}

/** Die längste Strecke einer Liste (für die Kurzzeile), sonst null. */
export const laengste = (ls) => (ls || []).reduce((m, l) => (!m || l.laenge > m.laenge ? l : m), null)

/** Gesamtlänge der Linie in km (wie die Stichproben sie messen). */
export function linienKm(geometrie) {
  const p = stichproben(geometrie, 5)
  return p.length ? p[p.length - 1].km : 0
}

/**
 * Die Liste nach Abschnitten zwischen den Stopps gruppieren.
 * Mit `legs` (stimmige Abschnitte der Route) liegen die Grenzen genau bei den aufsummierten
 * km, die auch am Stopp stehen („127 km ab Perth“); sonst aus der Lage der Stopps auf der Linie.
 * @returns [{ von, nach, vonKm, bisKm, punkte: [...] }]
 */
export function nachAbschnitten(geometrie, stopps, liste, { gesamtKm = null, legs = null } = {}) {
  const proben = stichproben(geometrie, 1, gesamtKm)
  if (!proben.length) return []
  const gesamt = Math.round(proben[proben.length - 1].km)
  const mit = (stopps || []).filter((s) => s && s.lat != null && s.lon != null)
  let grenzen
  if (legs && legs.length === mit.length - 1) {
    grenzen = [0]
    for (const l of legs) grenzen.push(grenzen[grenzen.length - 1] + (Number(l.km) || 0))
  } else {
    const pos = stoppKmAufRoute(baueGitter(proben), mit)
    grenzen = pos.map((p, i) => (i === mit.length - 1 ? gesamt : Math.round(p)))
  }
  const gruppen = []
  for (let i = 1; i < mit.length; i++) {
    gruppen.push({ von: mit[i - 1].name, nach: mit[i].name, vonKm: grenzen[i - 1], bisKm: grenzen[i], punkte: [] })
  }
  if (!gruppen.length) gruppen.push({ von: t('Start'), nach: t('Ziel'), vonKm: 0, bisKm: Math.round(gesamt), punkte: [] })
  for (const x of liste) {
    let g = gruppen.findIndex((gr) => x.km <= gr.bisKm)
    if (g < 0) g = gruppen.length - 1
    gruppen[g].punkte.push(x)
  }
  return gruppen
}

/** Links zu Kartendiensten, wie im Kartenfenster der Offline-Karte. */
export const googleLink = (x) => `https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lon}`
export const appleLink = (x) => `https://maps.apple.com/?ll=${x.lat},${x.lon}&q=${encodeURIComponent(x.name || t('Ort'))}`

/** „1,2 km“ bzw. „direkt an der Strecke“ unter 200 m. */
export function abstandText(km) {
  if (km < 0.2) return t('direkt an der Strecke')
  return t('{km} km neben der Strecke', { km: dezimal(Math.round(km * 10) / 10) })
}

/** POI-Dateien laden (mit Zwischenspeicher). `holer` ist fetch oder eine Attrappe im Test. */
const cache = new Map()
export async function ladePois(regionId, holer = typeof fetch !== 'undefined' ? fetch : null) {
  if (!regionId || !holer) return []
  if (cache.has(regionId)) return cache.get(regionId)
  let liste = []
  try {
    const r = await holer('/pois-' + regionId + '.json')
    liste = r.ok ? await r.json() : []
  } catch { liste = [] }
  if (!Array.isArray(liste)) liste = []
  if (liste.length) cache.set(regionId, liste)
  return liste
}
export const _leereCache = () => cache.clear()
