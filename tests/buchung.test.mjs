// Buchungen: Termine bündeln, Kosten zuordnen, Wechselzeit.
import assert from 'node:assert/strict'
import { buendle, passendeBuchung, verbindungsVorschlaege, buchungenMitKosten, uhrzeitIn, wechselZeit, etappeJetzt, grundTitel } from '../src/lib/buchung.js'
const ev = [
  { id: 'h1', datum: '2037-12-08', kat: 'hotel', titel: 'Coral Lagoon Resort', sub: 'Check-in 14:00', ref: 'PB1' },
  { id: 'h2', datum: '2037-12-10', kat: 'hotel', titel: 'Coral Lagoon Resort', sub: 'Check-out 10:00', docs: [{ label: 'Voucher', datei: 'x.pdf' }] },
  { id: 'c1', datum: '2037-12-02', kat: 'car', titel: 'Mietwagen Ost', sub: 'Abholung 10:00' },
  { id: 'c2', datum: '2037-12-03', kat: 'car', titel: 'Mietwagen Ost Rückgabe', sub: 'Rückgabe 22:00' },
  { id: 'f1', datum: '2037-12-04', kat: 'flight', titel: 'Melbourne → Cairns', sub: 'Airline XY56 · 08:35 → 11:05' },
  { id: 'm1', datum: '2037-12-10', kat: 'hotel', titel: 'Seaside Lodge', sub: 'Check-in' },
]
const b = buendle(ev)
assert.equal(b.length, 4)
const palm = b.find((x) => x.titel === 'Coral Lagoon Resort')
assert.deepEqual([palm.von, palm.bis, palm.ref, palm.docs.length], ['2037-12-08', '2037-12-10', 'PB1', 1])
assert.equal(b.find((x) => x.kat === 'car').ids.length, 2)
assert.equal(grundTitel('Mietwagen Ost Rückgabe'), 'mietwagen ost')
assert.equal(grundTitel('Camper-Übernahme'), grundTitel('Camper-Rückgabe'))
assert.equal(passendeBuchung({ text: 'Coral Beach Resort Coral Lagoon', kat: 'kosten_unterkunft' }, b)?.buchung.id, 'h1')
assert.equal(passendeBuchung({ text: 'Mietwagen Ost', kat: 'kosten_mietfahrzeug' }, b)?.sicher, true)
assert.equal(passendeBuchung({ text: 'Drohne', kat: 'kosten_long' }, b), null)
assert.equal(passendeBuchung({ text: 'Flug nach Cairns', kat: 'kosten_flug' }, b)?.buchung.id, 'f1')
const eintraege = [{ reise: { id: 'mel' }, von: '2037-12-01', bis: '2037-12-04' }, { reise: { id: 'cai' }, von: '2037-12-04', bis: '2037-12-07' }, { reise: { id: 'whi' }, von: '2037-12-08', bis: '2037-12-11' }]
const v = verbindungsVorschlaege([{ id: 'k1', text: 'Seaside Lodge Hotel', kat: 'kosten_unterkunft' }, { id: 'k2', text: 'x', kat: 'kosten_flug', terminId: 'f1' }], b, eintraege)
assert.deepEqual(v.map((x) => [x.kostenId, x.terminId, x.sicher, x.etappe]), [['k1', 'm1', true, 'whi']])
const mk = buchungenMitKosten(ev, [{ id: 'k3', terminId: 'h2', betrag: '526.40', waehrung: 'AUD', zahlung: 'vorOrt' }], eintraege)
assert.equal(mk.find((x) => x.titel === 'Coral Lagoon Resort').offen.length, 1)
assert.equal(uhrzeitIn('Airline XY56 · 08:35 → 11:05'), '08:35')
assert.equal(uhrzeitIn('Check-in ab 9.30 Uhr'), '09:30')
assert.equal(wechselZeit({}, '2037-12-04', ev).zeit, '08:35')
assert.equal(wechselZeit({ wechselUm: '12:00' }, '2037-12-04', ev).zeit, '12:00')
assert.equal(etappeJetzt(eintraege, '2037-12-04', '07:00', ev).reise.id, 'mel')
assert.equal(etappeJetzt(eintraege, '2037-12-04', '09:00', ev).reise.id, 'cai')
assert.equal(etappeJetzt(eintraege, '2037-12-05', '07:00', ev).reise.id, 'cai')
const zwei = buendle([{ id: 'a', datum: '2037-12-04', kat: 'flight', titel: 'Melbourne → Cairns' }, { id: 'b', datum: '2037-12-08', kat: 'flight', titel: 'Cairns → Proserpine' }])
assert.deepEqual([passendeBuchung({ text: 'Flug nach Cairns', kat: 'kosten_flug' }, zwei).buchung.id, passendeBuchung({ text: 'Flug nach Cairns', kat: 'kosten_flug' }, zwei).sicher], ['a', true])
assert.equal(passendeBuchung({ text: 'Flug Cairns', kat: 'kosten_flug' }, zwei).sicher, false)
assert.equal(verbindungsVorschlaege([{ id: 'x', text: 'Flug', kat: 'kosten_flug', terminId: 'weg' }], zwei, []).length, 0)
const r = buendle([{ id: '1', datum: '2037-12-13', kat: 'camper', titel: 'Camper Explorer', ref: 'O-1' }, { id: '2', datum: '2037-12-25', kat: 'camper', titel: 'Weihnachten' }, { id: '3', datum: '2038-01-27', kat: 'camper', titel: 'Camper-Rückgabe', ref: 'O-1' },
  { id: '4', datum: '2038-01-28', kat: 'flight', titel: 'Perth → Doha', ref: 'FD' }, { id: '5', datum: '2038-01-29', kat: 'flight', titel: 'Doha → Hamburg', ref: 'FD' },
  { id: '6', datum: '2037-12-01', kat: 'hotel', titel: 'ibis Budget', ref: 'A' }, { id: '7', datum: '2037-12-20', kat: 'hotel', titel: 'ibis Budget', ref: 'B' }])
assert.deepEqual(r.map((b) => b.ids.join('+')).sort(), ['1+3', '2', '4+5', '6', '7'])
assert.equal(r.find((b) => b.ids.includes('2')).ref, '')
assert.equal(r.find((b) => b.ids.includes('4')).titel, 'Perth → Doha → Hamburg')
console.log('✓ Buchungen')
