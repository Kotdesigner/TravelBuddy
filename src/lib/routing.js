// Straßen-Routing (OSRM, online) + Offline-Auswertungen (Luftlinie, Tank-Lücken).

import { tankLuecken } from './routenhinweise.js'
import { rundeAufSumme } from './runden.js'
import { t } from './i18n.js'
export function haversine(la1, lo1, la2, lo2) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (la2 - la1) * rad, dLon = (lo2 - lo1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Signatur der Stopps -> um zu erkennen, ob eine gespeicherte Route veraltet ist.
export function stopsSignatur(stops) {
  return (stops || []).filter((s) => s.lat != null).map((s) => s.lat.toFixed(3) + ',' + s.lon.toFixed(3)).join('|')
}

// Luftlinien-Gesamtdistanz (Offline-Schätzung).
export function luftlinieKm(stops) {
  const p = (stops || []).filter((s) => s.lat != null)
  let km = 0
  for (let i = 1; i < p.length; i++) km += haversine(p[i - 1].lat, p[i - 1].lon, p[i].lat, p[i].lon)
  return Math.round(km)
}

/** Flugstrecke: Luftlinie zwischen den Stopps, gleiche Form wie eine Straßenroute.
 *  Dauer grob geschätzt — Reisegeschwindigkeit ~800 km/h plus 45 min je Abschnitt
 *  für Rollen, Start und Landung. Reicht für die Reiseplanung. */
export function flugRoute(stops) {
  const p = (stops || []).filter((s) => s.lat != null)
  if (p.length < 2) throw new Error(t('Mindestens 2 Stopps mit Koordinaten nötig.'))
  const genauKm = [], genauMin = []
  for (let i = 1; i < p.length; i++) {
    const km = haversine(p[i - 1].lat, p[i - 1].lon, p[i].lat, p[i].lon)
    genauKm.push(km)
    genauMin.push((km / 800) * 60 + 45)
  }
  const legs = stimmigeAbschnitte(genauKm, genauMin)
  return {
    geometry: p.map((s) => [s.lon, s.lat]),      // gerade Verbindungen
    km: legs.reduce((n, l) => n + l.km, 0),
    dauerMin: legs.reduce((n, l) => n + l.dauerMin, 0),
    legs,
    flug: true, luftlinie: true, geschaetzt: true,
    berechnetAm: new Date().toISOString(),
    sig: stopsSignatur(stops),
  }
}

// Echte Straßenroute via OSRM (nur online). Liefert Geometrie + km + Fahrzeit.
export async function berechneRoute(stops) {
  const p = (stops || []).filter((s) => s.lat != null)
  if (p.length < 2) throw new Error(t('Mindestens 2 Stopps mit Koordinaten nötig.'))
  const coords = p.map((s) => `${s.lon},${s.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(t('Routing-Dienst nicht erreichbar (') + res.status + ').')
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(t('Keine Straßenroute gefunden.'))
  const rt = data.routes[0]
  // Abschnitte zwischen den Stopps (km + Fahrzeit). Gerundet so, dass sie zusammen genau die
  // Gesamtwerte ergeben (vorher einzeln gerundet: Coral Coast 1.930 statt 1.928 km).
  const legs = rt.legs?.length
    ? stimmigeAbschnitte(rt.legs.map((l) => l.distance / 1000), rt.legs.map((l) => l.duration / 60))
    : []
  return {
    geometry: rt.geometry.coordinates, // [[lon,lat], ...]
    km: legs.length ? legs.reduce((n, l) => n + l.km, 0) : Math.round(rt.distance / 1000),
    dauerMin: legs.length ? legs.reduce((n, l) => n + l.dauerMin, 0) : Math.round(rt.duration / 60),
    legs,
    berechnetAm: new Date().toISOString(),
    sig: stopsSignatur(stops),
  }
}

/** Genaue Abschnittswerte → ganze km und Minuten, die zusammen die gerundeten Summen ergeben. */
function stimmigeAbschnitte(genauKm, genauMin) {
  const km = rundeAufSumme(genauKm)
  const min = rundeAufSumme(genauMin)
  return km.map((k, i) => ({ km: k, dauerMin: min[i] }))
}

/**
 * Abschnitte einer gespeicherten Route, die genau zur Gesamtlänge und Gesamtfahrzeit passen.
 * Routen, die vor dem 15.10.2026 berechnet wurden, haben einzeln gerundete Abschnitte
 * (Summe bis zu einigen km daneben); hier wird der Unterschied auf die längsten Abschnitte
 * verteilt. Fehlende Fahrzeiten werden anteilig nach km ergänzt. Neue Routen bleiben unverändert.
 * @returns [{ km, dauerMin }] oder [] ohne Abschnitte
 */
export function stimmigeLegs(rt) {
  const legs = rt?.legs
  if (!legs?.length) return []
  const kmRoh = legs.map((l) => Number(l.km) || 0)
  const km = Number.isFinite(rt.km) ? rundeAufSumme(kmRoh, rt.km) : kmRoh
  const kmSumme = km.reduce((a, b) => a + b, 0)
  const alleMin = legs.every((l) => Number.isFinite(l.dauerMin))
  const minRoh = alleMin ? legs.map((l) => l.dauerMin)
    : Number.isFinite(rt.dauerMin) && kmSumme ? km.map((k) => rt.dauerMin * k / kmSumme) : null
  const min = minRoh ? (Number.isFinite(rt.dauerMin) ? rundeAufSumme(minRoh, rt.dauerMin) : minRoh) : null
  return km.map((k, i) => ({ ...legs[i], km: k, dauerMin: min ? min[i] : legs[i].dauerMin ?? null }))
}

// Größte Tank-Lücke entlang der Route (Tankstellen im Korridor auf die Route projiziert).
// Tank-Analyse: seit 19.09. über routenhinweise.js — zählt Tankstellen bei JEDEM Vorbeifahren
// und tastet die Route alle 1 km ab. Die alte Fassung sah jede Tankstelle nur einmal und maß
// nur bis zum nächsten Stützpunkt; am echten „Nord 3" ergab das eine Schein-Lücke von 990 km.
export function tankAnalyse(geometry, fuelPois, reichweiteKm, gesamtKm = null) {
  const t = tankLuecken(geometry, fuelPois, { reichweiteKm, abKm: 0, gesamtKm })
  if (!t) return null
  const groesste = t.luecken.reduce((m, l) => (!m || l.laenge > m.laenge ? l : m), null)
  return { anzahlTank: t.stationen, maxLuecke: t.maxLuecke, von: groesste?.von || '', bis: groesste?.bis || '', warnung: t.maxLuecke > reichweiteKm }
}

export function fahrzeitText(min) {
  if (min == null) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h} h ${m} min` : `${m} min`
}
