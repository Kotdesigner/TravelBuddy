// „Bereit für unterwegs?“: reine Auswertungen für OfflineCheck.svelte (testbar ohne Browser).
import { REGIONEN, POI_REGIONEN } from './karten-config.js'
import { etappenMitDatum } from './plan.js'

const mitKoord = (s) => s && s.lat != null && s.lon != null
const enthaelt = (r, s) => s.lon >= r.bounds[0] && s.lon <= r.bounds[2] && s.lat >= r.bounds[1] && s.lat <= r.bounds[3]

/** Welche Kartenteile braucht die Reise? Je Stopp der feinste Teil, dazu immer der Überblick. */
export function benoetigteKartenteile(reisen) {
  const ids = new Set(['australien'])
  for (const r of reisen || []) {
    for (const s of r?.stops || []) {
      if (!mitKoord(s)) continue
      const best = REGIONEN.filter((g) => enthaelt(g, s)).sort((a, b) => b.maxzoom - a.maxzoom)[0]
      if (best) ids.add(best.id)
    }
  }
  return REGIONEN.filter((g) => ids.has(g.id))
}

/** POI-Dateien, die zur Reise gehören (Regionen mit mindestens einem Stopp); ohne Stopps alle. */
export function benoetigtePoiDateien(reisen) {
  const ids = new Set()
  for (const r of reisen || []) for (const s of r?.stops || []) {
    if (!mitKoord(s)) continue
    const g = POI_REGIONEN.filter((x) => enthaelt(x, s)).sort((a, b) => (a.bounds[2] - a.bounds[0]) - (b.bounds[2] - b.bounds[0]))[0]
    if (g) ids.add(g.id)
  }
  const liste = ids.size ? POI_REGIONEN.filter((g) => ids.has(g.id)) : POI_REGIONEN
  return liste.map((g) => ({ id: g.id, name: g.name, datei: 'pois-' + g.id + '.json' }))
}

/**
 * Stand der Straßenrouten: welche Auto-Strecken (Routen und Etappen mit Stopps) ab heute
 * noch keine berechnete Linie haben oder deren Linie nicht mehr zu den Stopps passt.
 * @param istAktuell (r) => true, wenn r.route zu r.stops passt
 */
export function routenStand(reisen, gesamtStart, heute, istAktuell = () => true) {
  const eintraege = etappenMitDatum(reisen, gesamtStart)
  const ende = new Map(eintraege.map((e) => [e.reise.id, e.bis]))
  const relevant = (reisen || []).filter((r) => {
    if ((r.stops || []).filter(mitKoord).length < 2) return false
    if ((r.art || 'auto') === 'flug' || r.route?.flug) return false
    const bis = ende.get(r.typ === 'route' ? r.etappeId : r.id)
    return !bis || bis >= heute
  })
  const fehlen = relevant.filter((r) => !(r.route?.geometry?.length > 1) || !istAktuell(r))
  return { gesamt: relevant.length, fertig: relevant.length - fehlen.length, fehlen }
}

/** Alter der letzten Sicherung in Tagen (null = nie). */
export function sicherungTage(gesichertIso, jetzt = Date.now()) {
  if (!gesichertIso) return null
  const t = Date.parse(gesichertIso)
  if (isNaN(t)) return null
  return Math.max(0, Math.floor((jetzt - t) / 86400000))
}
