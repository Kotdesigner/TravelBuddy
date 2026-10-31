// Warnlage: Standort, Route voraus, Etappe, Wanderung, Gebietsgröße, Testmodus, Karte. Mit erfundenen Warnungen.
// Ausführen: node tests/warnlage.test.mjs
import fs from 'node:fs'
import { warnungenAnRoute, warnRahmen, warnMitte, gebietGroesse } from '../src/lib/warnungen.js'
import { warnlage, punktAufRoute, probeWarnung, warnGeoJson, warnAusschnitt, kreis, mapsPosition, mapsWeg } from '../src/lib/warnlage.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz !== '' ? '  → ' + zusatz : ''}`) }
}
const KM = 111.32
const quadrat = (lat, lon, g) => [[[lon - g, lat - g], [lon + g, lat - g], [lon + g, lat + g], [lon - g, lat + g], [lon - g, lat - g]]]
const warnung = (id, lat, lon, rang = 2, g = 0.1) => ({ id, rang, level: 'Watch & Act', titel: id, ringe: quadrat(lat, lon, g), punkte: [], linien: [], farbe: '#e8730c' })
// 700 km gerade nach Osten auf 20° Süd, Punkte alle 5 km
const cos = Math.cos((20 * Math.PI) / 180)
const lonBei = (km) => 120 + km / (KM * cos)
const linie = (abstand = 5) => Array.from({ length: Math.floor(700 / abstand) + 1 }, (_, i) => [lonBei(i * abstand), -20])
const route = (id, weitere = {}) => ({ id, typ: 'route', name: id, art: 'auto', stops: [], route: { geometry: linie() }, ...weitere })
const eintrag = (id, von, bis, weitere = {}) => ({ von, bis, tage: 5, reise: { id, name: id, stops: [], ...weitere } })
const HEUTE = '2037-03-10'

console.log('\n1  Standort')
{
  const w = warnung('feuer', -30, 120)
  const drin = warnlage({ warnungen: [w], standort: { lat: -30, lon: 120 }, heute: HEUTE })
  p('mitten im Warngebiet', drin.drin.length === 1 && drin.hier[0].km === 0)
  const nah = warnlage({ warnungen: [w], standort: { lat: -30, lon: 120.5 }, umkreisKm: 150, heute: HEUTE })
  p('daneben mit Entfernung', nah.drin.length === 0 && nah.hier.length === 1 && Math.abs(nah.hier[0].km - 38.5) < 3, nah.hier[0]?.km)
  p('außerhalb des Umkreises nichts', warnlage({ warnungen: [w], standort: { lat: -30, lon: 125 }, umkreisKm: 150, heute: HEUTE }).hier.length === 0)
  p('ohne Standort nichts', warnlage({ warnungen: [w], heute: HEUTE }).hier.length === 0)
}

console.log('\n2  Route vorausschauen')
{
  const w = warnung('feuer', -20, lonBei(650), 2, 0.05)
  const anfang = warnlage({ warnungen: [w], standort: { lat: -20, lon: lonBei(0) }, reisen: [route('r')], umkreisKm: 0, heute: HEUTE })
  const t0 = anfang.routen[0]?.treffer[0]
  p('Feuer am Ende der 700 km wird gefunden', t0 && t0.km === 0)
  p('Kilometer voraus stimmen', Math.abs(t0.kmBis - 640) < 12, t0?.kmBis)
  p('Standort auf der Route erkannt', anfang.routen[0].aufRoute)
  const mitte = warnlage({ warnungen: [w], standort: { lat: -20, lon: lonBei(400) }, reisen: [route('r')], umkreisKm: 0, heute: HEUTE })
  p('Kilometer werden weniger', Math.abs(mitte.routen[0].treffer[0].kmBis - 240) < 12, mitte.routen[0].treffer[0].kmBis)
  const hinten = warnung('alt', -20, lonBei(100), 2, 0.05)
  const danach = warnlage({ warnungen: [hinten], standort: { lat: -20, lon: lonBei(400) }, reisen: [route('r')], umkreisKm: 0, heute: HEUTE })
  p('Warnung hinter dir zählt nicht', danach.routen.length === 0)
  const weg = warnlage({ warnungen: [hinten], standort: { lat: -33, lon: 115 }, reisen: [route('r')], umkreisKm: 0, heute: HEUTE })
  p('abseits der Route: ganze Strecke ab Start', weg.routen.length === 1 && !weg.routen[0].aufRoute && Math.abs(weg.routen[0].treffer[0].kmBis - 90) < 12, weg.routen[0]?.treffer[0].kmBis)
  p('Flug zählt nicht', warnlage({ warnungen: [w], reisen: [route('r', { art: 'flug' })], umkreisKm: 0, heute: HEUTE }).routen.length === 0)
  p('Route einer vergangenen Etappe zählt nicht', warnlage({ warnungen: [w], reisen: [route('r', { etappeId: 'e' })], eintraege: [eintrag('e', '2037-01-01', '2037-01-05')], umkreisKm: 0, heute: HEUTE }).routen.length === 0)
  p('nächste Warnung zuerst', warnlage({ warnungen: [w, warnung('nah', -20, lonBei(200), 1, 0.05)], reisen: [route('r')], umkreisKm: 0, heute: HEUTE }).routen[0].treffer[0].id === 'nah')
}

console.log('\n3  Jede Teilstrecke')
{
  for (const abstand of [5, 40, 120]) {
    let n = 0, treffer = 0
    const ende = (linie(abstand).length - 1) * abstand
    for (let k = 10; k < ende - 5; k += 7) { n++; if (warnungenAnRoute([warnung('x', -20, lonBei(k), 2, 0.02)], linie(abstand), 0).length) treffer++ }
    p(`Linienpunkte alle ${abstand} km: nichts wird übersehen`, treffer === n, `${treffer} von ${n}`)
  }
  p('nur zwei Punkte reichen', warnungenAnRoute([warnung('x', -20, lonBei(350), 2, 0.02)], [[lonBei(0), -20], [lonBei(700), -20]], 0).length === 1)
  p('Warnung weit weg bleibt draußen', warnungenAnRoute([warnung('x', -30, 120)], linie(), 150).length === 0)
  const s = Date.now(); warnungenAnRoute(Array.from({ length: 40 }, (_, i) => warnung('w' + i, -20 - i * 0.3, 120 + i * 0.2)), Array.from({ length: 20000 }, (_, i) => [120 + i * 0.00035, -20]), 150)
  p('schnell genug fürs iPhone', Date.now() - s < 400, Date.now() - s + ' ms')
}

console.log('\n4  Etappe und Wanderung')
{
  const w = warnung('feuer', -22, 148)
  const a = warnlage({
    warnungen: [w], umkreisKm: 25, heute: HEUTE,
    eintraege: [eintrag('e1', '2037-03-09', '2037-03-15', { stops: [{ name: 'Stopp', lat: -22, lon: 148 }] }), eintrag('e2', '2037-02-01', '2037-02-05', { stops: [{ name: 'Alt', lat: -22, lon: 148 }] }), eintrag('e3', '2037-03-20', '2037-03-25', { stops: [{ name: 'Weit', lat: -30, lon: 120 }] })],
    wanderungen: [{ id: 'w1', name: 'Tour', lat: -22, lon: 148, datum: '2037-03-11', reiseId: 'e3' }, { id: 'w2', name: 'Vorbei', lat: -22, lon: 148, datum: '2037-03-01' }, { id: 'w3', name: 'Weit', lat: -30, lon: 120, datum: '' }, { id: 'w4', name: 'Ohne Ort' }],
  })
  p('Etappe mit Stopp im Warngebiet', a.proEtappe.e1?.[0].id === 'feuer')
  p('vergangene Etappe zählt nicht', !a.proEtappe.e2)
  p('Wanderung zählt zur Etappe', a.proEtappe.e3?.[0].id === 'feuer')
  p('Wanderung im Warngebiet', a.proWanderung.w1?.[0].km === 0)
  p('vergangene und ferne Wanderung nicht', !a.proWanderung.w2 && !a.proWanderung.w3 && !a.proWanderung.w4)
  p('Heute nennt Wanderung und Etappe', a.hinweise.some((h) => h.art === 'wanderung' && h.ziel === 'plan/wanderungen/w1') && a.hinweise.some((h) => h.art === 'etappe' && h.id === 'e1'), JSON.stringify(a.hinweise.map((h) => h.art + h.id)))
  const fern = warnlage({ warnungen: [w], umkreisKm: 25, heute: HEUTE, wanderungen: [{ id: 'w', name: 'Später', lat: -22, lon: 148, datum: '2037-06-01' }] })
  p('Wanderung in drei Monaten nur an der Wanderung', fern.proWanderung.w && !fern.hinweise.length)
}

console.log('\n5  Position und Größe')
{
  const w = warnung('feuer', -20, 120, 2, 0.1)
  const g = gebietGroesse(w)
  p('Fläche', Math.abs(g.flaecheKm2 - (22.26 * 22.26 * cos)) < 8, g.flaecheKm2)
  p('Ausdehnung', Math.abs(g.hoeheKm - 22.26) < 0.1 && Math.abs(g.breiteKm - 22.26 * cos) < 0.1, `${g.breiteKm} × ${g.hoeheKm}`)
  p('nur ein Punkt hat keine Größe', gebietGroesse({ ringe: [], punkte: [[120, -20]] }) === null)
  p('Mitte des Gebiets', Math.abs(warnMitte(w).lat + 20) < 0.001 && Math.abs(warnMitte(w).lon - 120) < 0.001)
  p('Meldepunkt hat Vorrang', warnMitte({ ...w, punkte: [[121, -21]] }).lon === 121)
  p('Rahmen', warnRahmen(w).join() === [119.9, -20.1, 120.1, -19.9].join())
  p('Google Maps Position', mapsPosition({ lat: -20, lon: 120 }) === 'https://www.google.com/maps/search/?api=1&query=-20,120')
  p('Google Maps Weg', mapsWeg({ lat: -20, lon: 120 }, { lat: -21, lon: 121 }).includes('origin=-20,120&destination=-21,121'))
}

console.log('\n6  Testmodus')
{
  const pos = { lat: -20, lon: lonBei(0) }
  const hier = probeWarnung('hier', pos)
  p('Probe am Standort ist höchste Stufe und markiert', hier.rang === 3 && hier.test && /PROBE/.test(hier.titel))
  p('Probe hier löst „im Warngebiet“ aus', warnlage({ warnungen: [hier], standort: pos, heute: HEUTE }).drin.length === 1)
  const nah = probeWarnung('nah', pos)
  const n = warnlage({ warnungen: [nah], standort: pos, heute: HEUTE }).hier[0]
  p('Probe nah ist etwa 20 km entfernt', n.km > 15 && n.km < 30, n.km)
  const r = probeWarnung('route', pos, [route('r')])
  const l = warnlage({ warnungen: [r], standort: pos, reisen: [route('r')], umkreisKm: 0, heute: HEUTE })
  p('Probe auf der Route liegt voraus', l.routen[0]?.treffer[0].kmBis > 400, l.routen[0]?.treffer[0].kmBis)
  p('ohne Route keine Probe auf der Route', probeWarnung('route', pos, []) === null)
  p('ohne Standort keine Probe', probeWarnung('hier', null) === null)
}

console.log('\n7  Karte')
{
  const w = warnung('feuer', -20, 120)
  const f = warnGeoJson([w, { id: 'p', farbe: '#000', ringe: [], punkte: [[121, -21]] }], { lat: -19, lon: 119 }, 100).features
  p('Gebiet, Punkt, Umkreis und eigener Punkt', ['flaeche', 'punkt', 'umkreis', 'ich'].every((a) => f.some((x) => x.properties.art === a)), f.map((x) => x.properties.art))
  p('ohne Standort kein eigener Punkt', !warnGeoJson([w], null, 100).features.some((x) => x.properties.art === 'ich'))
  p('Umkreis 0 ohne Kreis', !warnGeoJson([], { lat: -19, lon: 119 }, 0).features.some((x) => x.properties.art === 'umkreis'))
  const k = kreis(-20, 120, 100)
  p('Kreis ist geschlossen und 100 km groß', Math.abs(k[0][0] - k.at(-1)[0]) < 1e-9 && Math.abs(Math.max(...k.map((x) => x[1])) + 20 - 100 / KM) < 0.001)
  const a = warnAusschnitt(w, { lat: -19, lon: 119 })
  p('Ausschnitt enthält Warnung und Standort', a[0][0] === 119 && a[1][1] === -19 && a[0][1] === -20.1)
}

console.log('\n8  Einbau')
{
  const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
  p('Wetterdienst kann die Warnungen nicht mitreißen', !/Promise\.all\(\[\s*holeGefahren/.test(src('App.svelte')) && src('App.svelte').indexOf('await holeWarnungen()') < src('App.svelte').indexOf('await holeGefahren(punkte)'))
  p('Warnungen werden auch nach dem Hintergrund neu geholt', /addEventListener\('visibilitychange', nachsehen\)/.test(src('App.svelte')))
  p('Karte hat den Knopf für Warngebiete', /warn-knopf/.test(src('lib/Karte.svelte')) && /tb-karte-warn/.test(src('lib/Karte.svelte')))
  p('Heute zeigt die Warnlage', src('lib/Heute.svelte').includes('WarnLage'))
  p('Gefahrenlage zeigt Lage, Knöpfe und Testmodus', ['WarnLage', 'WarnKnoepfe', 'WarnTest'].every((x) => src('lib/Gefahren.svelte').includes(x)))
  p('Karte zeichnet Warnungen', src('lib/Karte.svelte').includes('warnGeoJson'))
  p('Plan, Etappe und Wanderung kennen die Lage', ['lib/PlanAnsicht.svelte', 'lib/EtappeDetail.svelte', 'lib/Wanderungen.svelte'].every((f) => src(f).includes('$lage')))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
