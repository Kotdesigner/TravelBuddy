// Routen-Ideen (public/routen.json): Stopps mit Koordinaten aus den Google-Maps-Links.
import { findeKoordinaten } from './wa-orte.js'

// Stopps aus den Google-Maps-Links der Route ziehen (origin, waypoints, destination).
/** Routen-Idee braucht 4WD (laut 🚙-Angabe: „Echtes 4WD“, „Erfahrenes 4WD“, „Expedition“), nicht bei „2WD + …“ */
export function brauchtAllrad(r) {
  const fz = (r.meta || []).find((m) => m.includes('🚙')) || ''
  return /4WD|Expedition/i.test(fz) && !/🚙\s*(Überwiegend\s*|Mostly\s*)?2WD/i.test(fz)
}

export function stoppsAusRoute(r) {
  const namen = []
  for (const l of r.links || []) {
    // Optionale Verlängerungen (z. B. Nord 3: Karijini → Marble Bar) gehören nicht zur Route
    if (/^\W*Optional/i.test(l.label || '')) continue
    let u
    try { u = new URL(l.url) } catch { continue }
    const p = u.searchParams
    const add = (v) => { if (v) namen.push(v) }
    add(p.get('origin'))
    const wp = p.get('waypoints')
    if (wp) wp.split('|').forEach((w) => add(w))
    add(p.get('destination'))
  }
  // aufeinanderfolgende Duplikate (Teil-Grenzen) entfernen
  const stops = []
  let letzter = null
  for (const voll of namen) {
    if (voll === letzter) continue
    letzter = voll
    const name = voll.replace(/,\s*Western Australia\s*$/i, '').replace(/,\s*Australia\s*$/i, '').trim()
    const koord = findeKoordinaten(voll)
    stops.push({ name, lat: koord ? koord[0] : null, lon: koord ? koord[1] : null, img: null })
  }
  return stops
}
