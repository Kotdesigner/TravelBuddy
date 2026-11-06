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
    if (r.idee) continue   // V16: Ideen fährt man (noch) nicht
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
    // V16: auch Wanderungen, die an einer Route dieser Etappe hängen
    const routenIds = new Set(reisen.filter((r) => r?.typ === 'route' && r.etappeId === id).map((r) => r.id))
    const anWegen = wanderungen.filter((w) => (w.reiseId === id || routenIds.has(w.reiseId)) && proWanderung[w.id]).map((w) => proWanderung[w.id])
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
  const gebuendelt = buendleHinweise(hinweise)
  return { hier, drin: hier.filter((w) => w.km === 0), routen, proEtappe, proWanderung, hinweise: gebuendelt, zahl: hier.length + gebuendelt.length }
}

/**
 * V15: Dieselbe Warnung an mehreren Abschnitten derselben Art (etwa ein Buschfeuer neben vier Transfers) nur einmal.
 * Vorne steht der Abschnitt, auf dem man fährt, sonst der mit der Warnung am nächsten; `weitere` nennt die übrigen.
 */
export function buendleHinweise(hinweise = []) {
  const gruppen = new Map()
  for (const h of hinweise) {
    // Nur gleiche Art: Wanderung und Etappe mit derselben Warnung bleiben zwei Hinweise mit eigenem Ziel
    const k = h.w?.id != null ? `${h.art}|${h.w.id}` : `${h.art}:${h.id}`
    if (!gruppen.has(k)) gruppen.set(k, [])
    gruppen.get(k).push(h)
  }
  const rang = (h) => [h.aufRoute ? 0 : 1, h.art === 'route' ? (h.w.kmBis ?? 0) : 0, h.w?.km ?? 0]
  const vor = (a, b) => { const x = rang(a), y = rang(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0 }
  return [...gruppen.values()].map((g) => {
    const s = [...g].sort(vor)
    return s.length === 1 ? s[0] : { ...s[0], weitere: s.slice(1).map((h) => h.name) }
  })
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
  // Die Route, auf der man gerade steht. Sonst die erste, die eine Strecke hat.
  const wege = reisen.filter((x) => x.route?.geometry?.length > 2 && x.art !== 'flug')
  const r = wege.find((x) => punktAufRoute(x.route.geometry, pos.lat, pos.lon).km <= AUF_ROUTE_KM) || wege[0]
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
    // Zeichen in der Mitte eines Gebiets: auch beim Herauszoomen sofort zu finden.
    if (w.ringe?.length) {
      const r = w.ringe[0]
      const mitte = w.lat != null && w.lon != null ? [w.lon, w.lat] : [r.reduce((a, c) => a + c[0], 0) / r.length, r.reduce((a, c) => a + c[1], 0) / r.length]
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mitte }, properties: { ...props, art: 'zeichen' } })
    }
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

/**
 * V18: Ist ein Standort in Australien (Festland, Tasmanien, vorgelagerte Inseln)? Grober Rahmen um den
 * Kontinent. Weit weg (z. B. noch zu Hause) zeigt die App keinen Abstand „von dir“ und keinen Weg dorthin,
 * die Warnungen gelten dann deinen Orten und Routen.
 */
export const inAustralien = (lat, lon) => lat != null && lon != null && lat <= -9 && lat >= -45 && lon >= 112 && lon <= 155
export const mapsPosition = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
export const mapsWeg = (von, nach) => `https://www.google.com/maps/dir/?api=1&origin=${von.lat},${von.lon}&destination=${nach.lat},${nach.lon}`
