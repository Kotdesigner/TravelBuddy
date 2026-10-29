// Straßenlage WA (lib/strassenlage.js, lib/strassenlage-dienst.js): Parser, Einstufung,
// Datum, Abstand zur Linie, Routenbezug, Abruf mit nachgestelltem fetch.
// Ausführen: node tests/strassenlage.test.mjs
import {
  liesStrassen, stufeAus, uebersetze, begriffDeutsch, datumPerth, formatPerth, alterText,
  holeStrassenlage, strassenInDerNaehe, strassenAnRouten, zaehleStrassen, routenMitLinie,
  MAINROADS_URL, KARTE_URL, STRASSEN_STUFE,
} from '../src/lib/strassenlage.js'
import { abstandKm, warnungFuer } from '../src/lib/warnungen.js'
import { strassenlage, aktualisiereStrassenlage, _zuruecksetzen } from '../src/lib/strassenlage-dienst.js'
import { get } from 'svelte/store'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const nah = (a, b, tol) => Math.abs(a - b) <= tol

// Echtes Beispiel (Antwort vom 11.10.2037), Geometrie vereinfacht: Mullewa → Mount Magnet.
const ECHT = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[115.51, -28.54], [116.5, -28.3], [117.84, -28.06]] },
  properties: {
    FID: 12045, Id: 236828,
    Location: 'Geraldton Mt Magnet Rd from Mullewa to Mount Magnet - Pavement Damage\r\n',
    IncidentTy: 'Pothole / Road Surface Damage', ClosureTyp: 'Road open with caution', publishExt: 'Yes',
    EntryDate: '11/10/2037 12:24:18', UpdateDate: '11/10/2037 12:24:15',
    Road: 'Geraldton Mt Magnet Rd', Region: 'Mid West Gascoyne', Suburb: 'City of Greater Geraldton',
    TrafficImp: 'Isolated Pavement Damage. Exercise Extreme Caution.', SeeMoreUrl: '', LocalRoadName: '',
  },
}
// Gerade Strecke auf 20° Süd: Great Northern Hwy, gesperrt wegen Überflutung.
const LAT = -20
const lonBeiKm = (k, lat = LAT) => 120 + k / (111.32 * Math.cos(lat * Math.PI / 180))
const latBeiKm = (k) => LAT + k / 110.57
const GESPERRT = {
  type: 'Feature',
  geometry: { type: 'MultiLineString', coordinates: [[[lonBeiKm(100), LAT], [lonBeiKm(120), LAT]], [[lonBeiKm(120), LAT], [lonBeiKm(130), LAT]]] },
  properties: {
    Id: 1, Location: 'Great Northern Hwy near Sandfire - Flooding', IncidentTy: 'Flooding', ClosureTyp: 'Road Closed',
    publishExt: 'Yes', UpdateDate: '03/01/2038 06:05:00', Road: 'Great Northern Hwy',
    TrafficImp: 'Road Closed due to Flooding. Water over road. Avoid travel.', SeeMoreUrl: 'https://www.mainroads.wa.gov.au/x',
  },
}
const PUNKT = {
  type: 'Feature', geometry: { type: 'Point', coordinates: [lonBeiKm(300), LAT] },
  properties: { Id: 2, Location: 'Bridge', IncidentTy: 'Bushfire', ClosureTyp: 'Partial closure', publishExt: 'Yes', UpdateDate: '01/12/2037 23:59:00', Road: 'Broome Hwy', TrafficImp: 'Bushfire. Smoke. Expect delays.' },
}
const UNBEKANNT = {
  type: 'Feature', geometry: { type: 'Point', coordinates: [lonBeiKm(500), LAT] },
  properties: { Id: 3, ClosureTyp: 'Something New Here', IncidentTy: '', publishExt: 'Yes', UpdateDate: 'kaputt', Road: '', LocalRoadName: 'Smith St', Location: 'Smith St' },
}
const VERSTECKT = { type: 'Feature', geometry: { type: 'Point', coordinates: [120, -20] }, properties: { Id: 4, publishExt: 'No', ClosureTyp: 'Road Closed' } }
const OHNE_GEO = { type: 'Feature', geometry: null, properties: { Id: 5, publishExt: 'Yes', ClosureTyp: 'Road Closed' } }
const FC = { type: 'FeatureCollection', features: [ECHT, GESPERRT, PUNKT, UNBEKANNT, VERSTECKT, OHNE_GEO] }

console.log('\n1  Einstufung')
p('Road Closed = 3', stufeAus('Road Closed') === 3)
p('ROAD CLOSED (Großschrift) = 3', stufeAus('ROAD CLOSED') === 3)
p('Partial closure = 2', stufeAus('Partial closure') === 2)
p('Road Closed to Heavy Vehicles = 2', stufeAus('Road Closed to Heavy Vehicles') === 2)
p('Lane closure = 2', stufeAus('Lane closure') === 2)
p('Road open with caution = 1', stufeAus('Road open with caution') === 1)
p('Road Open = 0', stufeAus('Road Open') === 0)
p('unbekannt = 1 (robust)', stufeAus('Something New Here') === 1)
p('leer = 1', stufeAus('') === 1 && stufeAus(null) === 1)
p('Sperrung höher als Vorsicht', stufeAus('Road Closed') > stufeAus('Road open with caution'))

console.log('\n2  Übersetzung')
{
  const u = uebersetze('Isolated Pavement Damage. Exercise Extreme Caution.')
  p('Fahrbahnschäden erkannt', u.includes('Fahrbahnschäden'), u.join(' | '))
  p('äußerste Vorsicht statt doppelt „vorsichtig“', u.includes('äußerste Vorsicht') && !u.includes('vorsichtig fahren'), u.join(' | '))
  p('stellenweise als Zusatz', u.includes('stellenweise'))
}
{
  const u = uebersetze('Road Closed due to Flooding. Water over road. Avoid travel.')
  p('gesperrt, überflutet, Wasser, meiden', ['gesperrt', 'überflutet', 'Wasser auf der Fahrbahn', 'Gebiet meiden'].every((x) => u.includes(x)), u.join(' | '))
}
p('Road open with caution → befahrbar mit Vorsicht', begriffDeutsch('Road open with caution') === 'befahrbar mit Vorsicht')
p('Road Closed → gesperrt', begriffDeutsch('Road Closed') === 'gesperrt')
p('Bushfire → Buschfeuer', begriffDeutsch('Bushfire') === 'Buschfeuer')
p('heavy vehicles nicht als „gesperrt“', begriffDeutsch('Road Closed to Heavy Vehicles') === 'für Lkw und Gespanne gesperrt')
p('Unbekanntes bleibt Original', begriffDeutsch('Xyz Thing') === 'Xyz Thing')
p('„Drainage“ ist kein Regen', !uebersetze('Drainage works').includes('Starkregen'))

console.log('\n3  Datum (dd/mm/yyyy, Perth UTC+8)')
{
  const ms = datumPerth('11/10/2037 12:24:15')
  p('11/10 ist 11. Oktober, 04:24 UTC', new Date(ms).toISOString() === '2037-10-11T04:24:15.000Z', new Date(ms).toISOString())
  p('Anzeige in Perther Zeit', formatPerth(ms) === '11.10.2037, 12:24 Uhr', formatPerth(ms))
  p('03/01/2038 ist 3. Januar', new Date(datumPerth('03/01/2038 06:05:00')).toISOString() === '2038-01-02T22:05:00.000Z')
  p('Uhrzeit mit PM', new Date(datumPerth('5/1/2038 1:30 PM')).toISOString() === '2038-01-05T05:30:00.000Z')
  p('Millisekunden direkt', datumPerth(1760156655000) === 1760156655000)
  p('kaputt → null', datumPerth('kaputt') === null && datumPerth('') === null && datumPerth('32/13/2037') === null)
  p('alterText', alterText(Date.now() - 3 * 3600e3) === 'vor 3 Std.' && alterText(Date.now() - 50 * 3600e3) === 'vor 2 Tagen')
}

console.log('\n4  Parser')
const M = liesStrassen(FC)
p('4 sichtbare Meldungen (publishExt No und ohne Geometrie fliegen raus)', M.length === 4, String(M.length))
p('Sperrung steht oben', M[0].id === 'mrwa:1' && M[0].rang === 3 && M[0].level === 'gesperrt')
{
  const e = M.find((m) => m.id === 'mrwa:236828')
  p('echtes Beispiel: Straße', e.strasse === 'Geraldton Mt Magnet Rd')
  p('echtes Beispiel: Location ohne \\r\\n', e.ort === 'Geraldton Mt Magnet Rd from Mullewa to Mount Magnet - Pavement Damage')
  p('echtes Beispiel: Art übersetzt', e.artDe.includes('Fahrbahnschäden') && e.art === 'Pothole / Road Surface Damage', e.artDe)
  p('echtes Beispiel: Rang 1, Vorsicht', e.rang === 1 && e.sperrungDe === 'befahrbar mit Vorsicht')
  p('echtes Beispiel: Stand', e.zeit === '2037-10-11T04:24:15.000Z')
  p('echtes Beispiel: Linie übernommen', e.linien.length === 1 && e.linien[0].length === 3 && e.punkte.length === 0)
  p('leerer SeeMoreUrl → kein Link', e.link === '')
}
p('MultiLineString → 2 Linien', M.find((m) => m.id === 'mrwa:1').linien.length === 2)
p('SeeMoreUrl übernommen', M.find((m) => m.id === 'mrwa:1').link === 'https://www.mainroads.wa.gov.au/x')
p('Punkt → punkte', M.find((m) => m.id === 'mrwa:2').punkte.length === 1)
{
  const u = M.find((m) => m.id === 'mrwa:3')
  p('unbekannt: robust, Rang 1, Name aus LocalRoadName', u.rang === 1 && u.strasse === 'Smith St' && u.zeit === null)
  p('unbekannte Sperrart bleibt lesbar', u.sperrungDe === 'Something New Here')
}
p('leere Antwort → []', liesStrassen({}).length === 0 && liesStrassen(null).length === 0)
p('Stufen-Tabelle vollständig', [0, 1, 2, 3].every((k) => STRASSEN_STUFE[k]?.label))

console.log('\n5  Abstand Punkt zu Strecke')
{
  const g = M.find((m) => m.id === 'mrwa:1')
  // 5 km nördlich der Linienmitte: Abstand 5 km, nicht Abstand zum nächsten Stützpunkt (~10 km)
  const d = abstandKm(g, latBeiKm(5), lonBeiKm(110))
  p('5 km neben der Linienmitte = 5 km', nah(d, 5, 0.15), d.toFixed(2))
  p('auf der Linie = 0', abstandKm(g, LAT, lonBeiKm(115)) < 0.05)
  p('hinter dem Ende: Abstand zum Endpunkt', nah(abstandKm(g, LAT, lonBeiKm(140)), 10, 0.2))
  const pk = M.find((m) => m.id === 'mrwa:2')
  p('Punktmeldung: Punktabstand', nah(abstandKm(pk, LAT, lonBeiKm(320)), 20, 0.3))
  p('alte Warnung ohne linien geht weiter', abstandKm({ ringe: [], punkte: [[120, -20]] }, -20, 120) === 0)
  p('warnungFuer versteht Linien', warnungFuer([g], latBeiKm(5), lonBeiKm(110), 10)?.id === 'mrwa:1')
}

console.log('\n6  Nähe zu Orten und Standort')
{
  const orte = [{ id: 'a', name: 'Sandfire', lat: latBeiKm(30), lon: lonBeiKm(110) }, { id: 'b', name: 'Weit weg', lat: -32, lon: 116 }]
  const n = strassenInDerNaehe(M, { orte, umkreisKm: 50 })
  p('Sperrung bei Sandfire im Umkreis 50 km', n.some((m) => m.id === 'mrwa:1' && m.naheBei === 'Sandfire' && nah(m.km, 30, 0.5)))
  p('Umkreis 10 km: nichts', strassenInDerNaehe(M, { orte, umkreisKm: 10 }).length === 0)
  const s = strassenInDerNaehe(M, { position: { lat: LAT, lon: lonBeiKm(305) }, umkreisKm: 10 })
  p('Standort neben Punktmeldung', s.length === 1 && s[0].naheBei === 'deinem Standort')
}

console.log('\n7  Routenbezug (≤ 2 km)')
{
  // Route „Nord 3“: startet bei km 0 und läuft genau die Straße entlang bis km 200.
  const geo = []; for (let k = 0; k <= 200; k += 25) geo.push([lonBeiKm(k), LAT + 0.005]) // ~0,55 km versetzt
  // Route „Süd 1“: 10 km südlich parallel, darf nicht anschlagen.
  const geoS = []; for (let k = 0; k <= 200; k += 25) geoS.push([lonBeiKm(k), latBeiKm(-10)])
  // Route „Quer“: kreuzt die Sperrung bei km 115 senkrecht.
  const geoQ = [[lonBeiKm(115), latBeiKm(-50)], [lonBeiKm(115), latBeiKm(50)]]
  const reisen = [
    { id: 'n3', name: 'Nord 3', route: { geometry: geo } },
    { id: 's1', name: 'Süd 1', route: { geometry: geoS } },
    { id: 'q', name: 'Quer', route: { geometry: geoQ } },
    { id: 'f', name: 'Flug', art: 'flug', route: { geometry: geo } },
    { id: 'x', name: 'ohne Linie', stops: [] },
  ]
  p('nur gefahrene Routen mit Linie', routenMitLinie(reisen).map((r) => r.id).join(',') === 'n3,s1,q')
  const t = strassenAnRouten(M, reisen)
  const n3 = t.find((x) => x.reiseId === 'n3' && x.meldung.id === 'mrwa:1')
  p('Nord 3 betroffen', !!n3)
  p('Nord 3: von km ~100 bis ~130', n3 && nah(n3.kmVon, 98.5, 2) && nah(n3.kmBis, 131.5, 2), n3 && `${n3.kmVon.toFixed(1)}..${n3.kmBis.toFixed(1)}`)
  p('Text nennt Route und km', n3 && /^Betrifft deine Route Nord 3 zwischen km \d+ und \d+$/.test(n3.text), n3?.text)
  p('Süd 1 (10 km daneben) nicht betroffen', !t.some((x) => x.reiseId === 's1'))
  const q = t.find((x) => x.reiseId === 'q')
  p('Querroute: bei km 50', q && q.text === 'Betrifft deine Route Quer bei km 50', q?.text)
  p('Flugstrecke ignoriert', !t.some((x) => x.reiseId === 'f'))
  p('Punktmeldung bei km 300 liegt nicht auf Nord 3', !t.some((x) => x.meldung.id === 'mrwa:2'))
  p('keine Hilfsfelder zurückgelassen', M.every((m) => !('_bbox' in m)))
  const z = zaehleStrassen(M, { orte: [], reisen, umkreisKm: 0 })
  p('Zählung: 1 Sperrung auf Route, getrennt gezählt', z.sperrungen === 1 && z.sperrungenAufRoute === 1 && z.aufRoute === 1 && z.gesamt === 1, JSON.stringify(z))
}

console.log('\n8  Abruf mit nachgestelltem fetch')
{
  let url = ''
  const gut = async (u) => { url = u; return { ok: true, status: 200, json: async () => FC } }
  const r = await holeStrassenlage(gut)
  p('richtige Adresse', url === MAINROADS_URL)
  p('liefert Meldungen', r.fehler === null && r.meldungen.length === 4)
  const h500 = await holeStrassenlage(async () => ({ ok: false, status: 500 }))
  p('HTTP 500 → Quellenfehler, keine Meldungen', h500.meldungen === null && /Main Roads WA: HTTP 500/.test(h500.fehler), h500.fehler)
  const netz = await holeStrassenlage(async () => { throw new TypeError('Failed to fetch') })
  p('Netzfehler → Quellenfehler', netz.meldungen === null && /Main Roads WA/.test(netz.fehler))
  const arcErr = await holeStrassenlage(async () => ({ ok: true, json: async () => ({ error: { code: 400, message: 'Invalid query' } }) }))
  p('ArcGIS-Fehler im JSON erkannt', arcErr.meldungen === null && /Invalid query/.test(arcErr.fehler))
  p('Kartenlink', KARTE_URL === 'https://travelmap.mainroads.wa.gov.au/')
}

console.log('\n9  Dienst: Zustand und letzter Stand')
{
  _zuruecksetzen()
  let gespeichert = null
  const speichern = async (w) => { gespeichert = w }
  await aktualisiereStrassenlage({ erzwingen: true, fetchFn: async () => ({ ok: true, json: async () => FC }), speichern })
  let s = get(strassenlage)
  p('frisch geladen', s.meldungen.length === 4 && !s.ausCache && !s.fehler && s.zeit > 0)
  p('für offline gespeichert', gespeichert?.meldungen?.length === 4 && gespeichert.zeit === s.zeit)
  let aufrufe = 0
  await aktualisiereStrassenlage({ fetchFn: async () => { aufrufe++; return { ok: true, json: async () => FC } }, speichern })
  p('innerhalb 15 Min. kein neuer Abruf', aufrufe === 0)
  await aktualisiereStrassenlage({ erzwingen: true, fetchFn: async () => { throw new TypeError('offline') }, speichern })
  s = get(strassenlage)
  p('Fehler: alter Stand bleibt, als letzter Stand markiert', s.meldungen.length === 4 && s.ausCache && /Main Roads WA/.test(s.fehler))
}

console.log(`\n${ok} bestanden · ${bad} gescheitert`)
process.exit(bad ? 1 : 0)
