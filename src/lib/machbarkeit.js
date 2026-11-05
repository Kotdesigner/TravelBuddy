// V16: Ist ein Abschnitt machbar? Aus den Stopps mit ihren Nächten wird ein Tagesplan: an welchem Tag
// von wo nach wo, wie viele km und Stunden am Steuer, welche Tage Ruhetage sind und welche zu lang.
// Gefahren wird am Morgen nach der letzten Nacht an einem Stopp. Reine Rechnungen, ohne Speicher.
import { plusTage } from './plan.js'
import { abschnitte as legsVon, pausenMinuten } from './fahrtag.js'
import { bereichVon } from './abschnitte.js'

export const GRENZE_MIN = 5 * 60   // mehr als 5 Stunden am Steuer gilt als langer Tag

/**
 * @param r  ein Abschnitt mit von, tage, stops [{ name, lat, lon, naechte }] und optional route
 * @returns null ohne Datum, sonst { tage: [{ datum, von, nach, km, fahrMin, mitPausen, ruhetag, lang }],
 *           km, fahrMin, fahrtage, ruhetage, lange, verplant, frei, zuViel }
 */
export function machbarkeit(r, { grenzeMin = GRENZE_MIN, aktuell = true } = {}) {
  const b = bereichVon(r)
  if (!b) return null
  const legs = legsVon(r, { aktuell })
  const stops = r.stops || []
  const nAn = (idx) => Math.max(0, Math.round(Number(stops[idx]?.naechte) || 0))
  const verplant = stops.reduce((n, s, i) => n + nAn(i), 0)

  // Ankunftstag jedes Stopps: Stopp 0 ist der Start am ersten Tag, jeder weitere am Tag nach der
  // letzten Nacht am vorigen Stopp. Ohne Nächte am vorigen Stopp fährt man am selben Tag weiter.
  const ankunft = new Map()
  let d = b.von
  stops.forEach((s, i) => { ankunft.set(i, d); d = plusTage(d, nAn(i)) })

  const proTag = new Map()
  for (const l of legs) {
    const tag = ankunft.get(l.nachIdx)
    const t = proTag.get(tag) || { datum: tag, von: l.von, nach: l.nach, km: 0, fahrMin: 0 }
    t.nach = l.nach; t.km += l.km; t.fahrMin += l.fahrMin
    proTag.set(tag, t)
  }
  const tage = []
  for (let x = b.von; x <= b.bis; x = plusTage(x, 1)) {
    const t = proTag.get(x)
    if (t) { const mitPausen = t.fahrMin + pausenMinuten(t.fahrMin); tage.push({ ...t, mitPausen, ruhetag: false, lang: t.fahrMin > grenzeMin }) }
    else tage.push({ datum: x, von: '', nach: '', km: 0, fahrMin: 0, mitPausen: 0, ruhetag: true, lang: false })
  }
  // Fahrten nach dem letzten Tag des Abschnitts (zu wenig Tage für die Stopps)
  const danach = [...proTag.values()].filter((t) => t.datum > b.bis)
  const fahrtage = tage.filter((t) => !t.ruhetag)
  return {
    tage, km: legs.reduce((n, l) => n + l.km, 0), fahrMin: legs.reduce((n, l) => n + l.fahrMin, 0),
    fahrtage: fahrtage.length, ruhetage: tage.length - fahrtage.length, lange: fahrtage.filter((t) => t.lang),
    verplant, frei: Math.max(0, b.tage - verplant), zuViel: Math.max(0, verplant - b.tage), danach,
    geschaetzt: legs.some((l) => l.geschaetzt),
  }
}

/** Die Fahrt eines Tages aus einem eingeplanten Abschnitt oder null. */
export function fahrtAmTag(r, datum, o = {}) {
  const m = machbarkeit(r, o)
  return m?.tage.find((t) => t.datum === datum && !t.ruhetag) || null
}

/** Saison-Hinweise der Orte bis 25 km neben den Stopps, ohne Doppel. */
export function saisonHinweise(r, orte = [], umkreisKm = 25) {
  const st = (r?.stops || []).filter((s) => s.lat != null)
  const RAD = Math.PI / 180
  const km = (a, b) => { const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(s)) }
  const out = [], gesehen = new Set()
  for (const o of orte) {
    if (!o.saison || o.lat == null || gesehen.has(o.id)) continue
    if (st.some((s) => km(s, o) <= umkreisKm)) { gesehen.add(o.id); out.push({ id: o.id, name: o.name, text: o.saison }) }
  }
  return out
}
