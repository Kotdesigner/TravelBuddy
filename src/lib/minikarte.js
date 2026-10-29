// Mini-Vorschau einer Route als SVG.
//
// Vorher lag hier eine fest auf Westaustralien geeichte Projektion
// (proj = lon - 112.3). Eine Ostküsten-Route landete damit außerhalb der
// Zeichenfläche und war schlicht nicht darstellbar. Jetzt wird der Ausschnitt
// aus den Punkten der Route berechnet — funktioniert überall in Australien.

import { AUS_RINGS } from './geo-australia.js'

/** Ausschnitt aus Punkten [[lon,lat], …] bestimmen, mit Rand und Mindestgröße. */
function ausschnitt(punkte, breite, hoehe) {
  let w = 180, sd = 0, e = -180, n = -90
  for (const [lon, lat] of punkte) {
    if (lon < w) w = lon
    if (lon > e) e = lon
    if (lat < sd) sd = lat
    if (lat > n) n = lat
  }
  // Mindestausdehnung, damit ein kurzer Abstecher nicht bildfüllend wirkt.
  const MIN = 2.5
  let spanLon = Math.max(e - w, MIN)
  let spanLat = Math.max(n - sd, MIN)
  const mLon = (w + e) / 2, mLat = (sd + n) / 2

  // Längengrade schrumpfen zu den Polen hin — sonst wirkt die Karte gestaucht.
  const kx = Math.cos((mLat * Math.PI) / 180)
  // Seitenverhältnis der Zeichenfläche angleichen (Rand: 12 %).
  const zielAR = breite / hoehe
  const istAR = (spanLon * kx) / spanLat
  if (istAR < zielAR) spanLon = (spanLat * zielAR) / kx
  else spanLat = (spanLon * kx) / zielAR
  spanLon *= 1.24; spanLat *= 1.24

  const w2 = mLon - spanLon / 2, e2 = mLon + spanLon / 2
  const n2 = mLat + spanLat / 2, s2 = mLat - spanLat / 2
  return (lon, lat) => [
    ((lon - w2) / (e2 - w2)) * breite,
    ((n2 - lat) / (n2 - s2)) * hoehe,
  ]
}

/**
 * Baut die Vorschau. Gibt null zurück, wenn keine Punkte vorliegen.
 * @param punkte [[lon,lat], …] der Route (Geometrie oder Stopps)
 * @param stopps [[lon,lat], …] die nummerierten Stopps
 */
export function baueVorschau(punkte, stopps, breite = 152, hoehe = 226) {
  if (!punkte?.length) return null
  const p = ausschnitt(punkte, breite, hoehe)
  const raus = ([x, y]) => x < -60 || x > breite + 60 || y < -60 || y > hoehe + 60

  // Küstenlinie als Hintergrund — grob beschnitten, damit das SVG klein bleibt.
  const land = []
  for (const ring of AUS_RINGS) {
    const d = ring.map(([lon, lat]) => p(lon, lat))
    if (d.every(raus)) continue
    land.push(d.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)).join(' ') + ' Z')
  }

  // Bei sehr vielen Geometriepunkten ausdünnen — 300 reichen für eine Vorschau.
  const schritt = Math.max(1, Math.ceil(punkte.length / 300))
  const linie = punkte
    .filter((_, i) => i % schritt === 0 || i === punkte.length - 1)
    .map(([lon, lat]) => p(lon, lat).map((n) => n.toFixed(1)).join(','))
    .join(' ')

  return { land, linie, punkte: (stopps || []).map(([lon, lat]) => p(lon, lat)) }
}
