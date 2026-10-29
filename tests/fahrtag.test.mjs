// Unterwegs fahren: Fahrtag-Planer, Versorgung an der Route, Offline-Check.
// Ausführen: node tests/fahrtag.test.mjs
import { schaetzMinuten, pausenMinuten, abschnitte, zusammen, losfahrPlan, fahrtag, sonneAm, uhrzeit,
  dauerText, heutigeFahrt, fahrDatum, ankunft } from '../src/lib/fahrtag.js'
import { versorgungAnRoute, luecken, nachAbschnitten, abstandText, ladePois, appleLink, googleLink, _leereCache } from '../src/lib/versorgung.js'
import { benoetigteKartenteile, benoetigtePoiDateien, routenStand, sicherungTage } from '../src/lib/offlinecheck.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

// Gerade Strecke nach Norden auf 115° Ost: 1° Breite ≈ 110,57 km
const LINIE = []
for (let i = 0; i <= 100; i++) LINIE.push([115, -31 + i * 0.05])     // 5° ≈ 553 km
const PERTH = { name: 'Perth', lat: -31.95, lon: 115.86 }
const GERALDTON = { name: 'Geraldton', lat: -28.78, lon: 114.61 }
const CARNARVON = { name: 'Carnarvon', lat: -24.88, lon: 113.66 }

console.log('\n1  Fahrzeit und Pausen')
p('80 km/h: 400 km sind 300 min', schaetzMinuten(400) === 300)
p('keine Pause bis 2 h', pausenMinuten(120) === 0 && pausenMinuten(90) === 0)
p('2 h 01 min: eine Pause', pausenMinuten(121) === 15)
p('4 h: eine Pause (nicht direkt vor Ankunft)', pausenMinuten(240) === 15)
p('5 h: zwei Pausen', pausenMinuten(300) === 30)
p('Unsinn wird 0', pausenMinuten(null) === 0 && pausenMinuten(-5) === 0)
p('Dauer als Text', dauerText(245) === '4 h 05 min' && dauerText(45) === '45 min')

console.log('\n2  Abschnitte')
{
  const r = { stops: [PERTH, GERALDTON, CARNARVON], route: { km: 900, dauerMin: 600, legs: [{ km: 420, dauerMin: 280 }, { km: 480, dauerMin: 320 }] } }
  const a = abschnitte(r)
  p('zwei Abschnitte aus OSRM-Legs', a.length === 2 && a[0].km === 420 && a[1].fahrMin === 320 && !a[0].geschaetzt)
  p('Namen und Ziel', a[0].von === 'Perth' && a[0].nach === 'Geraldton' && a[1].ziel.lat === CARNARVON.lat)
  const g = zusammen(a)
  p('zusammengefasst', g.km === 900 && g.fahrMin === 600 && g.von === 'Perth' && g.nach === 'Carnarvon' && g.teile === 2)
}
{
  const r = { stops: [PERTH, GERALDTON, CARNARVON], route: { km: 900, dauerMin: 600 } }
  const a = abschnitte(r)
  p('ohne Legs: km nach Anteil, Zeit anteilig nach km', a.length === 2 && a[0].km + a[1].km >= 899 && a[0].km + a[1].km <= 901
    && Math.abs(a[0].fahrMin - Math.round(600 * a[0].km / 900)) <= 1, JSON.stringify(a.map((x) => [x.km, x.fahrMin])))
}
{
  const a = abschnitte({ stops: [PERTH, { name: 'ohne Punkt' }, GERALDTON] })
  p('ohne Route: Schätzung, Stopp ohne Koordinaten übersprungen', a.length === 1 && a[0].geschaetzt && a[0].fahrMin === schaetzMinuten(a[0].km) && a[0].nachIdx === 2)
  p('veraltete Route wird nicht genutzt', abschnitte({ stops: [PERTH, GERALDTON], route: { km: 999, dauerMin: 10, legs: [{ km: 999, dauerMin: 10 }] } }, { aktuell: false })[0].km !== 999)
  p('Stopp-Datum wandert in den Abschnitt', abschnitte({ stops: [PERTH, { ...GERALDTON, datum: '2037-12-02' }] })[0].datum === '2037-12-02')
}

console.log('\n3  Losfahrzeit')
{
  const unter = new Date('2037-12-01T11:00:00Z')            // 19:00 in Perth
  const auf = new Date('2037-11-30T21:00:00Z')   // 05:00 in Perth
  const pl = losfahrPlan({ fahrMin: 300, untergang: unter, aufgang: auf })
  p('5 h Fahrt + 30 min Pause + 30 min Puffer: 13:00', uhrzeit(pl.losSpaetestens, 'Australia/Perth') === '13:00', uhrzeit(pl.losSpaetestens, 'Australia/Perth'))
  p('passt ins Tageslicht', pl.reichtLicht && pl.teile === 1 && pl.unterwegsMin === 330)
  const lang = losfahrPlan({ fahrMin: 16 * 60, untergang: unter, aufgang: auf })
  p('16 h Fahrt: reicht nicht, teilen', !lang.reichtLicht && lang.teile >= 2, JSON.stringify(lang))
  p('Ankunft bei sofortigem Start', ankunft(new Date('2037-12-01T05:00:00Z'), 90).toISOString() === '2037-12-01T06:30:00.000Z')
}
{
  const s = sonneAm(-24.88, 113.66, '2037-12-01')
  const u = uhrzeit(s.untergang, 'Australia/Perth')
  p('Sonnenuntergang Carnarvon Anfang Dezember zwischen 18:30 und 19:15', u >= '18:30' && u <= '19:15', u)
  p('Dämmerungsende nach Sonnenuntergang', s.daemmerungEnde > s.untergang)
  const f = fahrtag({ start: PERTH, ziel: CARNARVON, km: 900, fahrMin: 600 }, '2037-12-01')
  p('Fahrtag Perth → Carnarvon: Zeitzone Perth, Text gesetzt', f.tz === 'Australia/Perth' && /^\d\d:\d\d$/.test(f.losText) && f.pausenMin === 60)
  p('10 h + 1 h Pause + Puffer: los spätestens gegen 7 Uhr', f.losText >= '06:30' && f.losText <= '07:45', f.losText)
  const mel = fahrtag({ start: { lat: -37.8, lon: 144.9 }, ziel: { lat: -37.5, lon: 145.2 }, km: 60, fahrMin: 60 }, '2037-12-01')
  p('Melbourne: Zeitzone Sydney (Sommerzeit)', mel.tz === 'Australia/Sydney' && mel.untergangText >= '20:00', mel.untergangText)
  const sehrLang = fahrtag({ start: PERTH, ziel: { lat: -17.96, lon: 122.24 }, km: 2200, fahrMin: 1500 }, '2037-12-01')
  p('Perth → Broome an einem Tag: teilen, km je Teil', !sehrLang.reichtLicht && sehrLang.teile >= 2 && sehrLang.kmJeTeil > 0)
  p('ungültiges Datum: nichts', fahrtag({ ziel: PERTH, fahrMin: 10 }, 'morgen') === null)
}

console.log('\n4  Fahrdatum und heutige Fahrt')
{
  const etappe = { id: 'e1', typ: 'etappe', name: 'Nord', von: '2037-12-10', tage: 5 }
  const r1 = { id: 'r1', typ: 'route', etappeId: 'e1', name: 'Nord 1', art: 'auto', stops: [PERTH, GERALDTON, CARNARVON] }
  const flug = { id: 'f1', typ: 'route', etappeId: 'e1', art: 'flug', stops: [PERTH, CARNARVON] }
  const reisen = [etappe, r1, flug]
  p('Fahrdatum: Etappe in Zukunft → erster Tag', fahrDatum(r1, reisen, null, '2037-11-01') === '2037-12-10')
  p('Fahrdatum: Etappe läuft → heute', fahrDatum(r1, reisen, null, '2037-12-12') === '2037-12-12')
  p('Fahrdatum: Route mit eigenem Datum', fahrDatum({ ...r1, datum: '2037-12-13' }, reisen, null, '2037-12-12') === '2037-12-13')
  p('ohne Hinweis keine heutige Fahrt', heutigeFahrt({ reisen, heute: '2037-12-11' }) === null)
  p('außerhalb der Reise nichts', heutigeFahrt({ reisen, heute: '2037-11-01' }) === null)
  const j = [{ datum: '2037-12-11', reiseId: 'r1', legIdx: 1 }]
  const h = heutigeFahrt({ reisen, heute: '2037-12-11', journal: j })
  p('Logbuch wählt Abschnitt Geraldton → Carnarvon', h && h.quelle === 'logbuch' && h.fahrt.von === 'Geraldton' && h.fahrt.nach === 'Carnarvon' && h.plan?.losText)
  const ganz = heutigeFahrt({ reisen, heute: '2037-12-11', journal: [{ datum: '2037-12-11', reiseId: 'r1', legIdx: null }] })
  p('Logbuch ohne Abschnitt: ganze Route', ganz && ganz.fahrt.teile === 2)
  const mitStoppDatum = [etappe, { ...r1, stops: [PERTH, { ...GERALDTON, datum: '2037-12-12' }, CARNARVON] }]
  const h2 = heutigeFahrt({ reisen: mitStoppDatum, heute: '2037-12-12' })
  p('Stopp-Datum heute: Abschnitt dorthin', h2 && h2.quelle === 'stoppdatum' && h2.fahrt.nach === 'Geraldton')
  const kurz = [{ ...etappe, tage: 1 }, r1]
  p('eintägige Etappe mit einer Route', heutigeFahrt({ reisen: kurz, heute: '2037-12-10' })?.quelle === 'etappe')
  p('Flug zählt nie als Fahrt', heutigeFahrt({ reisen: [{ ...etappe, tage: 1 }, flug], heute: '2037-12-10' }) === null)
  const anreise = [{ ...etappe, stops: [PERTH, GERALDTON], art: 'auto' }]
  p('Anreise am ersten Tag', heutigeFahrt({ reisen: anreise, heute: '2037-12-10' })?.quelle === 'anreise')
  p('Anreise nicht am zweiten Tag', heutigeFahrt({ reisen: anreise, heute: '2037-12-11' }) === null)
}

console.log('\n5  Versorgung im Korridor')
{
  const pois = [
    { k: 'fuel', n: 'Roadhouse A', x: 115.0, y: -30.5 },             // auf der Linie, km ≈ 55
    { k: 'wasser', n: 'Tank', x: 115.02, y: -30.0 },                  // ≈ 1,9 km daneben
    { k: 'wasser', n: 'weit weg', x: 115.2, y: -29.5 },               // ≈ 19 km daneben
    { k: 'wc', n: '', x: 115.01, y: -29.0 },                          // namenlos
    { k: 'sicht', n: 'Aussicht', x: 115.0, y: -29.0 },                // keine Versorgung
    { k: 'fuel', n: 'BP', x: 115.04, y: -27.0 },                      // 3,9 km: Tankstelle bis 5 km
    { k: 'camp', n: 'Camp fern', x: 115.04, y: -27.0 },               // 3,9 km: Camp nur bis 3 km
    { k: 'fuel', n: 'Roadhouse A', x: 115.0, y: -30.497 },            // Doppel
  ]
  const l = versorgungAnRoute(LINIE, pois, { ortsnamen: [{ name: 'Testort', lat: -29.0, lon: 115.1 }, { name: 'Nordort', lat: -27.0, lon: 115.1 }] })
  p('nur Versorgung, nur im Korridor', l.length === 4, JSON.stringify(l.map((x) => x.name)))
  p('nach km sortiert', l.every((x, i) => !i || l[i - 1].km <= x.km))
  p('km der Tankstelle ≈ 55', Math.abs(l[0].km - 55) <= 2, String(l[0].km))
  p('Abstand Wasser ≈ 1,9 km', l[1].k === 'wasser' && Math.abs(l[1].abstand - 1.9) <= 0.3, String(l[1].abstand))
  p('namenlose Toilette heißt nach dem Ort', l[2].name === 'Toilette bei Testort', l[2].name)
  p('Markenname bekommt Ort', l[3].name === 'BP bei Nordort', l[3].name)
  p('Doppelte zusammengefasst', l.filter((x) => x.name === 'Roadhouse A').length === 1)
  p('Abstand als Text', abstandText(1.24) === '1,2 km neben der Strecke' && abstandText(0.1) === 'direkt an der Strecke')
  p('Kartenlinks', googleLink(l[0]).includes('query=-30.5,115') && appleLink(l[0]).includes('ll=-30.5,115') && appleLink(l[0]).includes('Roadhouse%20A'))

  // Hin und zurück: die Tankstelle zählt für beide Male
  const hinZurueck = [...LINIE, ...[...LINIE].reverse()]
  const z = versorgungAnRoute(hinZurueck, [{ k: 'fuel', n: 'Mitte', x: 115, y: -28.5 }])
  p('Hin- und Rückweg: zwei Durchgänge', z.length === 2 && z[1].km - z[0].km > 100, JSON.stringify(z.map((x) => x.km)))
}

console.log('\n6  Lücken')
{
  const liste = [{ k: 'fuel', km: 50, name: 'A' }, { k: 'wasser', km: 60, name: 'W' }, { k: 'fuel', km: 400, name: 'B' }, { k: 'fuel', km: 400.5, name: 'B2' }]
  const f = luecken(liste, 600, 'fuel', { start: 'Perth', ziel: 'Carnarvon' })
  p('Tank-Lücke A → B (350 km) und B → Ziel (200 km)', f.length === 2 && f[0].laenge === 350 && f[0].von === 'A' && f[1].bis === 'Carnarvon', JSON.stringify(f))
  const w = luecken(liste, 600, 'wasser')
  p('Wasser: 540 km ohne Wasser nach W', w.length === 1 && w[0].vonKm === 60 && w[0].laenge === 540)
  p('kurze Strecke ohne Lücke', luecken([], 120, 'fuel').length === 0)
  p('gar nichts an 600 km: eine Lücke über alles', luecken([], 600, 'wasser')[0]?.laenge === 600)
}

console.log('\n7  Gruppen nach Abschnitten')
{
  const stopps = [{ name: 'S', lat: -31, lon: 115 }, { name: 'M', lat: -28.5, lon: 115 }, { name: 'Z', lat: -26, lon: 115 }]
  const g = nachAbschnitten(LINIE, stopps, [{ k: 'fuel', km: 10 }, { k: 'fuel', km: 300 }, { k: 'wasser', km: 500 }])
  p('zwei Abschnitte', g.length === 2 && g[0].von === 'S' && g[1].nach === 'Z')
  p('Punkte richtig verteilt', g[0].punkte.length === 1 && g[1].punkte.length === 2, JSON.stringify(g.map((x) => [x.vonKm, x.bisKm, x.punkte.length])))
}

console.log('\n8  POIs laden (Netz nachgestellt)')
{
  _leereCache()
  let aufrufe = 0
  const holer = async (url) => { aufrufe++; return { ok: url === '/pois-wa.json', json: async () => [{ k: 'fuel', n: 'X', x: 1, y: 2 }] } }
  const a = await ladePois('wa', holer)
  const b = await ladePois('wa', holer)
  p('geladen und zwischengespeichert', a.length === 1 && b === a && aufrufe === 1)
  p('fehlende Datei: leer', (await ladePois('mars', holer)).length === 0)
  p('Netzfehler: leer', (await ladePois('cairns', async () => { throw new Error('offline') })).length === 0)
  p('ohne Region: leer', (await ladePois(null, holer)).length === 0)
}

console.log('\n9  Offline-Check')
{
  const reisen = [
    { id: 'e1', typ: 'etappe', von: '2037-12-01', tage: 10, stops: [{ name: 'Melbourne', lat: -37.81, lon: 144.96 }, { name: 'Kinglake', lat: -37.53, lon: 145.34 }] },
    { id: 'e2', typ: 'etappe', von: '2037-12-15', tage: 20 },
    { id: 'r1', typ: 'route', etappeId: 'e2', stops: [PERTH, CARNARVON], route: { geometry: [[1, 2], [3, 4]] } },
    { id: 'r2', typ: 'route', etappeId: 'e2', stops: [PERTH, GERALDTON] },
    { id: 'r3', typ: 'route', etappeId: 'e2', art: 'flug', stops: [PERTH, GERALDTON] },
    { id: 'r4', typ: 'route', etappeId: 'e1', stops: [PERTH, GERALDTON] },
  ]
  const k = benoetigteKartenteile(reisen).map((x) => x.id).sort().join()
  p('Kartenteile: Überblick, Melbourne, Westküste', k === 'australien,melbourne,wa', k)
  p('POI-Dateien der Reise', benoetigtePoiDateien(reisen).map((x) => x.datei).sort().join() === 'pois-melbourne.json,pois-wa.json')
  p('ohne Stopps: alle POI-Dateien', benoetigtePoiDateien([]).length === 4)
  const st = routenStand(reisen, null, '2037-12-12')
  p('Routen: Etappe e1 vorbei, Flug zählt nicht', st.gesamt === 2 && st.fertig === 1 && st.fehlen[0].id === 'r2', JSON.stringify(st))
  p('veraltete Linie zählt als fehlend', routenStand(reisen, null, '2037-12-12', (r) => r.id !== 'r1').fertig === 0)
  p('Sicherung vor 3 Tagen', sicherungTage('2037-12-09T10:00:00Z', Date.parse('2037-12-12T12:00:00Z')) === 3)
  p('nie gesichert', sicherungTage(null) === null && sicherungTage('quatsch') === null)
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
