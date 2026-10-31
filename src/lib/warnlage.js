// Was die amtlichen Warnungen für dich bedeuten: am Standort, auf den Routen vor dir, an Etappen und
// Wanderungen. Reine Rechnungen, die Stores stehen in warnlage-dienst.js.
//
// Flüge zählen nicht: ein Feuer unter der Flugroute geht einen nichts an. Vergangene Etappen auch nicht.
import { t } from './i18n.js'
import { warnungenFuer, warnungenAnRoute, bauWarnung, warnRahmen } from './warnungen.js'

const GRAD_KM = 111.32
export const AUF_ROUTE_KM = 40   // so nah an der Linie gilt man als unterwegs auf dieser Route
const BALD_TAGE = 14

const entfernung = (aLat, aLon, bLat, bLon) => Math.hypot((aLon - bLon) * Math.cos((aLat * Math.PI) / 180), aLat - bLat) * GRAD_KM

/** Nächster Punkt der Linie: wo stehe ich auf der Route? */
export function punktAufRoute(geo = [], lat, lon) {
  let index = 0, km = Infinity
  geo.forEach((p, i) => { const d = entfernung(lat, lon, p[1], p[0]); if (d < km) { km = d; index = i } })
  return { index, km }
}

const zusammen = (listen) => {
  const beste = new Map()
  for (const w of listen.flat()) if (!beste.has(w.id) || w.km < beste.get(w.id).km) beste.set(w.id, w)
  return [...beste.values()].sort((a, b) => b.rang - a.rang || a.km - b.km)
}

/**
 * @param standort   { lat, lon } oder null
 * @param eintraege  Etappen mit Datum aus etappenMitDatum
 * @param heute      'JJJJ-MM-TT'
 */
export function warnlage({ warnungen = [], standort = null, reisen = [], eintraege = [], wanderungen = [], umkreisKm = 150, heute = '' } = {}) {
  const hier = standort ? warnungenFuer(warnungen, standort.lat, standort.lon, umkreisKm) : []
  const etappeVon = new Map(eintraege.map((e) => [e.reise.id, e]))
  const vorbei = (id) => { const e = etappeVon.get(id); return !!e && e.bis < heute }

  const routen = []
  for (const r of reisen) {
    const geo = r.route?.geometry
    if (!geo?.length || r.art === 'flug' || vorbei(r.etappeId || r.id)) continue
    const stelle = standort ? punktAufRoute(geo, standort.lat, standort.lon) : null
    const aufRoute = !!stelle && stelle.km <= AUF_ROUTE_KM
    const treffer = warnungenAnRoute(warnungen, geo, umkreisKm, aufRoute ? stelle.index : 0)
    if (treffer.length) routen.push({ id: r.id, name: r.name, etappeId: r.etappeId || (r.typ === 'etappe' ? r.id : null), aufRoute, treffer: treffer.sort((a, b) => a.kmBis - b.kmBis) })
  }

  const proWanderung = {}
  for (const w of wanderungen) {
    if (w.lat == null || (w.datum && w.datum < heute)) continue
    const t = warnungenFuer(warnungen, w.lat, w.lon, umkreisKm)
    if (t.length) proWanderung[w.id] = t
  }

  const proEtappe = {}
  for (const e of eintraege) {
    if (e.bis < heute) continue
    const id = e.reise.id
    const stopps = (e.reise.stops || []).filter((s) => s.lat != null).map((s) => warnungenFuer(warnungen, s.lat, s.lon, umkreisKm))
    const anRouten = routen.filter((r) => r.etappeId === id || r.id === id).map((r) => r.treffer)
    const anWegen = wanderungen.filter((w) => w.reiseId === id && proWanderung[w.id]).map((w) => proWanderung[w.id])
    const liste = zusammen([...stopps, ...anRouten, ...anWegen])
    if (liste.length) proEtappe[id] = liste
  }

  const beginnt = (id) => etappeVon.get(id)?.von || ''
  const bald = (von) => !von || von <= tageSpaeter(heute, BALD_TAGE)
  const hinweise = [
    ...routen.filter((r) => r.aufRoute || bald(beginnt(r.etappeId))).map((r) => ({ art: 'route', id: r.id, name: r.name, aufRoute: r.aufRoute, w: r.treffer[0], ziel: r.etappeId && r.etappeId !== r.id ? `plan/etappe/${r.etappeId}/${r.id}` : `plan/route/${r.id}` })),
    ...wanderungen.filter((w) => proWanderung[w.id] && bald(w.datum)).map((w) => ({ art: 'wanderung', id: w.id, name: w.name, w: proWanderung[w.id][0], ziel: `plan/wanderungen/${w.id}` })),
    ...eintraege.filter((e) => proEtappe[e.reise.id] && !routen.some((r) => r.etappeId === e.reise.id || r.id === e.reise.id) && bald(e.von)).map((e) => ({ art: 'etappe', id: e.reise.id, name: e.reise.name, w: proEtappe[e.reise.id][0], ziel: `plan/etappe/${e.reise.id}` })),
  ]
  return { hier, drin: hier.filter((w) => w.km === 0), routen, proEtappe, proWanderung, hinweise, zahl: hier.length + hinweise.length }
}

function tageSpaeter(tag, n) {
  const d = new Date(tag + 'T12:00'); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- Testmodus ----------

export const PROBE_ARTEN = ['hier', 'nah', 'route']

function quadrat(lat, lon, grad) {
  return [[[lon - grad, lat - grad], [lon + grad, lat - grad], [lon + grad, lat + grad], [lon - grad, lat + grad], [lon - grad, lat - grad]]]
}
const probe = (art, rang, lat, lon, ort) => bauWarnung({
  id: 'probe:' + art, staat: 'TEST', rang, test: true, event: t('Probe'), titel: t('PROBE, kein echtes Ereignis'),
  text: t('Diese Warnung kommt aus dem Testmodus.'), ort, zeit: new Date().toISOString(), ringe: quadrat(lat, lon, 0.09), punkte: [[lon, lat]],
})

/** Eine erfundene Warnung für den Testmodus. Bei `route` zwei Drittel der nächsten Route voraus. */
export function probeWarnung(art, pos, reisen = []) {
  if (!pos) return null
  if (art === 'hier') return probe(art, 3, pos.lat, pos.lon, t('Dein Teststandort'))
  if (art === 'nah') return probe(art, 2, pos.lat, pos.lon + 30 / (GRAD_KM * Math.cos((pos.lat * Math.PI) / 180)), t('30 km östlich von dir'))
  const r = reisen.find((x) => x.route?.geometry?.length > 2 && x.art !== 'flug')
  if (!r) return null
  const geo = r.route.geometry
  const ab = punktAufRoute(geo, pos.lat, pos.lon)
  const start = ab.km <= AUF_ROUTE_KM ? ab.index : 0
  const p = geo[start + Math.floor(((geo.length - 1 - start) * 2) / 3)]
  return probe(art, 2, p[1], p[0], r.name)
}

// ---------- Karte ----------

export function kreis(lat, lon, km, punkte = 64) {
  const dLat = km / GRAD_KM, dLon = dLat / Math.cos((lat * Math.PI) / 180)
  return Array.from({ length: punkte + 1 }, (_, i) => { const a = (i / punkte) * 2 * Math.PI; return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)] })
}

/** Warngebiete, Umkreis und eigener Punkt als eine Sammlung für die Offline-Karte. */
export function warnGeoJson(warnungen = [], pos = null, umkreisKm = 0) {
  const features = []
  for (const w of warnungen) {
    const props = { farbe: w.farbe, id: w.id }
    for (const ring of w.ringe || []) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { ...props, art: 'flaeche' } })
    if (!w.ringe?.length) for (const p of w.punkte || []) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { ...props, art: 'punkt' } })
  }
  if (pos) {
    if (umkreisKm > 0) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: kreis(pos.lat, pos.lon, umkreisKm) }, properties: { art: 'umkreis' } })
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] }, properties: { art: 'ich' } })
  }
  return { type: 'FeatureCollection', features }
}

/** Ausschnitt für die Karte: das Warngebiet und, wenn bekannt, der eigene Punkt. */
export function warnAusschnitt(w, pos) {
  const r = warnRahmen(w)
  if (!r) return null
  const lon = pos ? [r[0], r[2], pos.lon] : [r[0], r[2]], lat = pos ? [r[1], r[3], pos.lat] : [r[1], r[3]]
  return [[Math.min(...lon), Math.min(...lat)], [Math.max(...lon), Math.max(...lat)]]
}

export const mapsPosition = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
export const mapsWeg = (von, nach) => `https://www.google.com/maps/dir/?api=1&origin=${von.lat},${von.lon}&destination=${nach.lat},${nach.lon}`
