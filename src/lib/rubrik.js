// Eigene Orte in dieselbe Gliederung einsortieren wie die hinterlegten Vorschläge.
//
// Die Vorschläge tragen „abschnitt" (Süden/Norden/Ostküste) und „region" (z. B. „Margaret
// River & Augusta"). Nur wer beides hat, erscheint unter „Süden“, „Norden“ oder „Ostküste“
// und wird dort in die richtige Region einsortiert. Für einen eigenen Ort übernehmen wir
// die Rubrik des nächstgelegenen Vorschlags, das ist genau die Einteilung der Reise.
//
// Liegt ein Ort weit weg von allen Vorschlägen (mehr als 150 km), wäre der nächste
// Vorschlag eine falsche Region (Sydney stünde sonst bei Melbourne). Dann bestimmt die
// Lage den Abschnitt und das Verwaltungsgebiet (z. B. „New South Wales“) die Region.

let vorlagen = []

/** Die geladenen Vorschläge hinterlegen (einmalig beim App-Start). */
export function setzeVorlagen(liste) {
  vorlagen = Array.isArray(liste) ? liste : []
}

const km = (aLat, aLon, bLat, bLon) => {
  const x = (bLon - aLon) * Math.cos(((aLat + bLat) / 2) * Math.PI / 180) * 111.32
  const y = (bLat - aLat) * 110.57
  return Math.hypot(x, y)
}

/** { abschnitt, region, km } des nächstgelegenen Vorschlags, {} ohne Koordinaten
    oder wenn der nächste weiter als maxKm entfernt ist. */
export function naechsteRubrik(lat, lon, maxKm = Infinity) {
  if (lat == null || lon == null || !vorlagen.length) return {}
  let best = null, bestD = Infinity
  for (const o of vorlagen) {
    if (o.lat == null) continue
    const d = km(lat, lon, o.lat, o.lon)
    if (d < bestD) { bestD = d; best = o }
  }
  if (!best || bestD > maxKm) return {}
  return { abschnitt: best.abschnitt, region: best.region, km: Math.round(bestD) }
}

const abschnittMit = (anfang) => vorlagen.find((o) => o.abschnitt?.startsWith(anfang))?.abschnitt

/** Rubrik für einen neuen Ort: nächster Vorschlag bis 150 km, sonst nach Lage.
    `gebiet` ist das Verwaltungsgebiet aus der Ortssuche (z. B. „New South Wales“). */
export function rubrikFuer(lat, lon, { gebiet = '' } = {}) {
  const nah = naechsteRubrik(lat, lon, 150)
  if (nah.abschnitt) return nah
  if (lat == null || lon == null || !vorlagen.length) return {}
  // Westaustralien liegt westlich von 129° Ost, sein Süden etwa ab Kalbarri (28,5° Süd).
  // Osten: Victoria, New South Wales, Tasmanien (ab 141°) und Queensland (ab 138°, nördlich
  // von 26° Süd). Northern Territory und South Australia passen in keinen Abschnitt, solche
  // Orte stehen nur unter „Meine Orte“.
  const osten = lon >= 141 || (lon >= 138 && lat > -26)
  const abschnitt = lon < 129 ? (lat < -28.5 ? abschnittMit('Süden') : abschnittMit('Norden')) : osten ? abschnittMit('Ostküste') : null
  if (!abschnitt) return {}
  return { abschnitt, region: gebiet || 'Weitere Orte' }
}

/** Alle Abschnitte mit ihren Regionen, in der Reihenfolge der Liste (für die Auswahl). */
export function alleRubriken(orte = vorlagen) {
  const m = new Map()
  for (const o of orte) {
    if (!o.abschnitt || o.abschnitt === 'Meine Orte' || !o.region) continue
    if (!m.has(o.abschnitt)) m.set(o.abschnitt, [])
    const r = m.get(o.abschnitt)
    if (!r.includes(o.region)) r.push(o.region)
  }
  return [...m].map(([abschnitt, regionen]) => ({ abschnitt, regionen }))
}

/** Rubrik-Felder ergänzen, solange der Ort noch keine echte hat. */
export function rubrikPatch(ort, lat, lon, opt = {}) {
  const roh = !ort.abschnitt || ort.abschnitt === 'Meine Orte'
  if (!roh) return {}
  const r = rubrikFuer(lat, lon, opt)
  return r.abschnitt ? { abschnitt: r.abschnitt, region: r.region } : {}
}
