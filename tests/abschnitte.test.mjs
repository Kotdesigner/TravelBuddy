// V16: Abschnitte, Nächte und Machbarkeit. Ausführen: node tests/abschnitte.test.mjs
import assert from 'node:assert/strict'
import { bereichVon, abschnitteDerEtappe, abschnittAm, stelleAm, datiereAbschnitte, etappeVorschlag, istReiseEtappe, ersterFreierTag, tageAusText } from '../src/lib/abschnitte.js'
import { naechteUebersicht, naechteGruppen, dringendeNaechte, stoppNaechte, FEIERTAGE } from '../src/lib/naechte.js'
import { machbarkeit, fahrtAmTag, saisonHinweise } from '../src/lib/machbarkeit.js'
import { etappenMitDatum } from '../src/lib/plan.js'

const perth = { name: 'Perth', lat: -31.95, lon: 115.86 }
const reisen = [
  { id: 'hin', typ: 'etappe', name: 'Hinreise', von: '2037-11-29', tage: 3, art: 'bahn', stops: [{ name: 'Kiel', lat: 54.3, lon: 10.1 }, { name: 'Frankfurt', lat: 50.0, lon: 8.6 }, { name: 'Melbourne Airport', lat: -37.7, lon: 144.8 }] },
  { id: 'whi', typ: 'etappe', name: 'Whitsundays', von: '2037-12-08', tage: 4, art: 'flug', stops: [{ name: 'Cairns', lat: -16.9, lon: 145.7 }, { name: 'Proserpine', lat: -20.4, lon: 148.6 }] },
  { id: 'tra', typ: 'etappe', name: 'Roadtrip', von: '2037-12-12', tage: 47, art: 'auto', stops: [] },
  { id: 'heim', typ: 'etappe', name: 'Heimreise', von: '2038-01-27', tage: 3, art: 'flug', stops: [{ name: 'Perth Airport', lat: -31.94, lon: 115.97 }, { name: 'Doha', lat: 25.3, lon: 51.6 }, { name: 'Hamburg', lat: 53.6, lon: 10.0 }] },
  { id: 't1', typ: 'route', etappeId: 'whi', name: 'Transfer Flughafen - Hafen', art: 'bus', tage: 3, stops: [{ name: 'Proserpine Airport', lat: -20.5, lon: 148.6 }, { name: 'Shute Harbour', lat: -20.3, lon: 148.8 }] },
  { id: 't2', typ: 'route', etappeId: 'whi', name: 'Ab Coral Beach', art: 'boot', tage: 3, stops: [{ name: 'Coral Beach', lat: -20.3, lon: 148.9 }, { name: 'Shute Harbour', lat: -20.3, lon: 148.8 }] },
  { id: 't3', typ: 'route', etappeId: 'whi', name: 'Ab Shute Harbour', art: 'bus', tage: 3, stops: [{ name: 'Shute Harbour', lat: -20.3, lon: 148.8 }, { name: 'Airlie Beach', lat: -20.27, lon: 148.7 }] },
  { id: 'sued', typ: 'route', etappeId: 'tra', name: 'Süden', art: 'auto', von: '2037-12-14', tage: 5, stops: [{ ...perth, naechte: 0 }, { name: 'Margaret River', lat: -33.95, lon: 115.07, naechte: 2 }, { name: 'Augusta', lat: -34.31, lon: 115.16, naechte: 1 }, { name: 'Albany', lat: -35.02, lon: 117.88, naechte: 2 }] },
  { id: 'idee', typ: 'route', etappeId: 'tra', name: 'Nord 3', idee: true, stops: [perth] },
]
const events = [
  { id: 'e1', datum: '2037-11-29', kat: 'hotel', titel: 'Airport Hotel', sub: 'Check-in ab 15:00', ref: 'Z1' },
  { id: 'e2', datum: '2037-11-30', kat: 'hotel', titel: 'Airport Hotel', sub: 'Check-out bis 12:00' },
  { id: 'e3', datum: '2037-11-30', kat: 'flight', titel: 'Frankfurt → Melbourne', sub: 'XY12 · Abflug 13:55', ref: 'YI' },
  { id: 'e4', datum: '2037-12-01', kat: 'flight', titel: 'Ankunft Melbourne', sub: '22:50 Uhr' },
  { id: 'e5', datum: '2037-12-08', kat: 'shuttle', titel: 'Proserpine Airport → Shute Harbour', sub: 'Reef Shuttle', ref: '111222' },
  { id: 'e6', datum: '2037-12-10', kat: 'boat', titel: 'Coral Lagoon → Shute Harbour', ref: 'FN' },
  { id: 'e7', datum: '2037-12-08', kat: 'hotel', titel: 'Coral Lagoon Resort', ref: 'PB' },
  { id: 'e8', datum: '2037-12-10', kat: 'hotel', titel: 'Coral Lagoon Resort', sub: 'Check-out' },
  { id: 'e9', datum: '2037-12-13', kat: 'camper', titel: 'Camper Explorer', ref: 'O-1' },
  { id: 'e10', datum: '2038-01-27', kat: 'camper', titel: 'Camper-Rückgabe', ref: 'O-1' },
  { id: 'e11', datum: '2038-01-28', kat: 'flight', titel: 'Perth → Doha', sub: 'XY34 · Abflug 22:45', ref: 'FD' },
  { id: 'e12', datum: '2037-12-05', kat: 'stay', titel: 'Cairns', sub: 'Aufenthalt' },
]
const eintraege = etappenMitDatum(reisen, '2037-11-29')

// Abschnitte
assert.deepEqual(bereichVon(reisen.find((r) => r.id === 'sued')), { von: '2037-12-14', bis: '2037-12-18', tage: 5 })
assert.equal(bereichVon({ tage: 3 }), null)
const a = abschnitteDerEtappe(reisen, 'tra')
assert.deepEqual([a.eingeplant.map((r) => r.id), a.offen.length, a.ideen.map((r) => r.id)], [['sued'], 0, ['idee']])
assert.equal(abschnittAm(reisen, 'tra', '2037-12-15')?.id, 'sued')
assert.equal(abschnittAm(reisen, 'tra', '2037-12-20'), null)
assert.deepEqual([stelleAm(reisen, 'tra', '2037-12-16').tag, stelleAm(reisen, 'tra', '2037-12-16').tage], [3, 5])

// Umbau: Transfers bekommen Datum aus der Buchung, ohne passende Buchung bleiben sie offen
const d = datiereAbschnitte(reisen, events, eintraege)
assert.deepEqual(d.map((x) => [x.id, x.von, x.tage, x.terminId]), [['t1', '2037-12-08', 1, 'e5'], ['t2', '2037-12-10', 1, 'e6']])

// Vorschlag: nie Hin- oder Heimreise, Route ab Perth landet in Roadtrip
assert.equal(istReiseEtappe(reisen.find((r) => r.id === 'heim')), true)
assert.equal(istReiseEtappe(reisen.find((r) => r.id === 'whi')), false)
assert.equal(istReiseEtappe({ id: 'h2', stops: [{ name: 'Kiel', lat: 54.3, lon: 10.1 }, { name: 'Frankfurt', lat: 50.0, lon: 8.6 }] }, [{ id: 'r', typ: 'route', etappeId: 'h2', stops: [{ name: 'Frankfurt', lat: 50.0, lon: 8.6 }, { name: 'Melbourne', lat: -37.7, lon: 144.8 }] }]), true)
const v = etappeVorschlag([perth, { name: 'Albany', lat: -35.0, lon: 117.9 }], eintraege, reisen)
assert.deepEqual([v.etappe.reise.id, v.grund], ['tra', 'nah'])
const v2 = etappeVorschlag([perth], eintraege, reisen.filter((r) => !['sued', 'idee'].includes(r.id)))
assert.deepEqual([v2.etappe.reise.id, v2.grund], ['tra', 'laengste'])
assert.equal(ersterFreierTag(reisen, eintraege.find((e) => e.reise.id === 'tra')), '2037-12-12')
assert.equal(tageAusText(['⏱️ 10–12 Tage']), 12)
assert.equal(tageAusText(['⏱️ 3 Tage (29.–31. Dez.)']), 3)

// Nächte
assert.deepEqual(stoppNaechte(reisen.find((r) => r.id === 'sued')).map((n) => [n.datum, n.ort]), [['2037-12-14', 'Margaret River'], ['2037-12-15', 'Margaret River'], ['2037-12-16', 'Augusta'], ['2037-12-17', 'Albany'], ['2037-12-18', 'Albany']])
const u = naechteUebersicht({ eintraege, reisen, events })
const am = (x) => u.naechte.find((n) => n.datum === x)
assert.equal(am('2037-11-29').zustand, 'gebucht')
assert.equal(am('2037-11-30').zustand, 'flug')
assert.equal(am('2037-12-05').zustand, 'offen')       // „Aufenthalt“ ohne Buchung zählt nicht
assert.deepEqual([am('2037-12-08').zustand, am('2037-12-09').zustand, am('2037-12-10').zustand], ['gebucht', 'gebucht', 'offen'])
assert.deepEqual([am('2037-12-13').zustand, am('2037-12-15').zustand, am('2037-12-15').text], ['camper', 'geplant', 'Margaret River'])
assert.equal(am('2037-12-25').feiertag, 'Christmas Day')
assert.equal(am('2037-12-24').feiertag, 'vor Christmas Day')
assert.equal(am('2038-01-28').zustand, 'flug')
assert.equal(u.naechte.at(-1).datum, '2038-01-28')
assert.equal(Object.values(u.zahl).reduce((s, n) => s + n, 0), u.naechte.length)
const g = naechteGruppen(u.naechte)
assert.ok(g.length < u.naechte.length && g.every((x) => x.anzahl >= 1))
assert.ok(dringendeNaechte(u.naechte).some((n) => n.datum === '2037-12-25'))
assert.equal(FEIERTAGE['2037-12-28'], 'Boxing Day (Ersatztag)')

// Machbarkeit
const m = machbarkeit(reisen.find((r) => r.id === 'sued'))
assert.deepEqual(m.tage.map((t) => t.ruhetag), [false, true, false, false, true])
assert.deepEqual([m.fahrtage, m.ruhetage, m.verplant, m.frei, m.zuViel], [3, 2, 5, 0, 0])
assert.equal(m.tage[0].nach, 'Margaret River')
assert.ok(m.km > 500 && m.km < 1000, String(m.km))
assert.equal(fahrtAmTag(reisen.find((r) => r.id === 'sued'), '2037-12-16')?.nach, 'Augusta')
assert.equal(fahrtAmTag(reisen.find((r) => r.id === 'sued'), '2037-12-15'), null)
const lang = machbarkeit({ von: '2037-12-14', tage: 2, stops: [{ ...perth }, { name: 'Exmouth', lat: -21.93, lon: 114.13, naechte: 2 }] })
assert.equal(lang.lange.length, 1)
const knapp = machbarkeit({ von: '2037-12-14', tage: 2, stops: [{ ...perth, naechte: 2 }, { name: 'Augusta', lat: -34.31, lon: 115.16, naechte: 2 }] })
assert.deepEqual([knapp.zuViel, knapp.danach.length], [2, 1])
assert.deepEqual(saisonHinweise(reisen.find((r) => r.id === 'sued'), [{ id: 'o1', name: 'Albany Ort', lat: -35.02, lon: 117.89, saison: 'Im Dez voll' }, { id: 'o2', name: 'Broome', lat: -17.9, lon: 122.2, saison: 'Regenzeit' }]).map((x) => x.id), ['o1'])
console.log('✓ Abschnitte, Nächte, Machbarkeit')

// Fahrt des Tages aus dem Abschnitt
const { heutigeFahrt } = await import('../src/lib/fahrtag.js')
const f = heutigeFahrt({ reisen, gesamtStart: '2037-11-29', heute: '2037-12-16' })
assert.deepEqual([f?.quelle, f?.fahrt.von, f?.fahrt.nach], ['abschnitt', 'Margaret River', 'Augusta'])
assert.equal(heutigeFahrt({ reisen, gesamtStart: '2037-11-29', heute: '2037-12-15' })?.quelle === 'abschnitt', false)
console.log('✓ Fahrt des Tages aus dem Abschnitt')

// V16: Ausgabe an einer Route zählt zur Etappe der Route
const { kostenAuswertung } = await import('../src/lib/kosten.js')
const k = kostenAuswertung({ vorab: [{ id: 'k1', text: 'Camp', kat: 'kosten_unterkunft', betrag: '100', waehrung: 'EUR', datum: '2037-12-15', reiseId: 'sued' }], eintraege, reisen })
assert.equal(k.etappen.find((x) => x.id === 'tra')?.eur, 100)
assert.equal(k.etappen.some((x) => x.id === null), false)
console.log('✓ Kosten an Routen zählen zur Etappe')

// V16: Vorschläge bis 75 km, vorgemerkte bis 100 km und zuerst
const { vorschlaegeMitMerkern, vorgemerkteIds, UMKREIS_VORSCHLAG } = await import('../src/lib/routenhinweise.js')
const roh = [{ ort: { id: 'a' }, abstand: 10, km: 50 }, { ort: { id: 'b' }, abstand: 80, km: 20 }, { ort: { id: 'c' }, abstand: 90, km: 90 }, { ort: { id: 'd' }, abstand: 70, km: 5 }]
assert.equal(UMKREIS_VORSCHLAG, 75)
assert.deepEqual(vorschlaegeMitMerkern(roh, ['c']).map((v) => [v.ort.id, v.vorgemerkt]), [['c', true], ['d', false], ['a', false]])
assert.deepEqual(vorgemerkteIds({ x: { vorgemerkt: true }, y: { notiz: 'n' } }), ['x'])
console.log('✓ Vorschläge und vorgemerkte Orte')
