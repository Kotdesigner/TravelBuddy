// Routen-Ideen (public/routen.json): Stopps mit Koordinaten aus den Google-Maps-Links.
import { findeKoordinaten } from './wa-orte.js'

// Stopps aus den Google-Maps-Links der Route ziehen (origin, waypoints, destination).
export function stoppsAusRoute(r) {
  const namen = []
  for (const l of r.links || []) {
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
