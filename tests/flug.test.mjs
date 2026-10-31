// Flugabfrage: Flüge erkennen, Takt, Kontingent, Antworten, Änderungen, Umstiege.
// Mit erfundenen Flügen, nie mit echten Reisedaten. Ausführen: node tests/flug.test.mjs
import fs from 'node:fs'
import {
  normalNummer, nummernImText, abflugzeitImText, fluegeAusTerminen, abfrageDatum, abstandStunden, faellig,
  naechsteGruppe, darfAbfragen, genutzt, monatVon, KONTINGENT, RESERVE, leseAntwort, verspaetung, statusText,
  aenderungen, umstiege, flugImFokus, istSchlecht, normalZug, zugnummernImText, bahnhofAusTitel, zugFaellig, leseZug,
  offeneVorab, verkehrOk, abflugMs,
} from '../src/lib/flug.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz !== '' ? '  → ' + zusatz : ''}`) }
}
const H = 3600e3

const antwort = (ab, an, ueber = {}) => [{
  number: 'XY 1', status: 'Expected', airline: { name: 'Beispiel Air' }, aircraft: { model: 'A320' },
  departure: { airport: { iata: 'AAA', municipalityName: 'Astadt' }, scheduledTime: { utc: `${ab}Z`, local: `${ab}+00:00` }, terminal: '1', quality: ['Basic'], ...ueber.ab },
  arrival: { airport: { iata: 'BBB', municipalityName: 'Bstadt' }, scheduledTime: { utc: `${an}Z`, local: `${an}+00:00` }, quality: ['Basic'], ...ueber.an },
  ...ueber.flug,
}]

console.log('\n1  Flugnummern')
{
  p('Schreibweisen', normalNummer('xy 036') === 'XY36' && normalNummer('QF-1') === 'QF1' && normalNummer('3K 123') === '3K123')
  p('kein Flug', normalNummer('Melbourne') === '' && normalNummer('') === '' && normalNummer('12 34') === '')
  p('zwei Nummern im Text', nummernImText('Beispiel Air XY12 / XY345 · Abflug 13:55').join() === 'XY12,XY345')
  p('Flugzeug und Uhrzeit sind keine Nummer', nummernImText('Airbus A320 · 08:35 → 11:05').length === 0)
  p('Abflugzeit', abflugzeitImText('XY1 · Abflug 13:55') === '13:55' && abflugzeitImText('XY1 · 08:35 → 11:05') === '08:35')
  p('Ankunft ist keine Abflugzeit', abflugzeitImText('XY1 · Ankunft 13:00 (+1 Tag)') === '')
}

console.log('\n2  Termine werden zu Flügen')
const termine = [
  { id: 'a', datum: '2037-03-01', kat: 'flight', titel: 'Astadt → Cstadt', sub: 'Beispiel Air XY12 / XY345 · Abflug 13:55', flugNr: 'XY12', ref: 'ABC123' },
  { id: 'b', datum: '2037-03-02', kat: 'flight', titel: 'Ankunft Cstadt', sub: '22:50 Uhr' },
  { id: 'c', datum: '2037-03-05', kat: 'flight', titel: 'Flug ohne Angabe', sub: '' },
  { id: 'd', datum: '2037-03-06', kat: 'hotel', titel: 'Hotel', sub: 'Zimmer XY12' },
  { id: 'e', datum: '2037-03-07', kat: '', titel: 'Neu', sub: '', flugNr: 'zz 7' },
  { id: 'f', datum: '2037-03-08', kat: 'stay', titel: 'Platzhalter', platzhalter: true, flugNr: 'XY9' },
]
{
  const { fluege, ohneNummer } = fluegeAusTerminen(termine)
  p('Termin mit zwei Nummern ergibt zwei Flüge', fluege.filter((f) => f.terminId === 'a').map((f) => f.nr).join() === 'XY12,XY345', fluege.map((f) => f.nr))
  p('Anschluss hängt am ersten Flug', fluege[1].anschlussVon === fluege[0].id && fluege[1].datum === null)
  p('Abflugzeit kommt aus dem Text', fluege[0].zeit === '13:55')
  p('jeder Termin mit Nummer zählt, auch ohne Art', fluege.some((f) => f.nr === 'ZZ7'))
  p('Hotel und Platzhalter sind keine Flüge', !fluege.some((f) => ['d', 'f'].includes(f.terminId)))
  p('„Ankunft“ fehlt nicht als Flug', !ohneNummer.some((e) => e.id === 'b'))
  p('Flug ohne Nummer wird gemeldet', ohneNummer.map((e) => e.id).join() === 'c')
  const staende = { [fluege[0].id]: { daten: leseAntwort(antwort('2037-03-01 13:55', '2037-03-02 06:30'), '2037-03-01') } }
  p('Anschluss nimmt den Ankunftstag des Vorgängers', abfrageDatum(fluege[1], staende) === '2037-03-02')
  p('ohne Antwort das Datum des Termins', abfrageDatum(fluege[1], {}) === '2037-03-01')
  const neu = fluegeAusTerminen([...termine, { id: 'g', datum: '2037-04-01', kat: 'flight', titel: 'Neu', flugNr: 'AB5' }])
  p('neuer Termin ist sofort ein Flug', neu.fluege.some((f) => f.nr === 'AB5'))
}

console.log('\n3  Takt')
{
  const flug = { id: 'x', datum: '2037-03-10', zeit: '12:00', terminDatum: '2037-03-10' }
  const abflug = Date.parse('2037-03-10T12:00:00')
  p('neuer Flug wird sofort geholt', faellig(flug, undefined, abflug - 60 * 24 * H))
  p('zu weit weg nicht', !faellig(flug, undefined, abflug - 360 * 24 * H))
  p('Abstände', [200, 100, 48, 12, 2].map(abstandStunden).join() === '156,24,8,2,0.5')
  p('sieben Tage reichen vor dem Löschen', abstandStunden(500) < 168)
  // Eine Woche Raster alle 15 Minuten, Flug mit 9 Stunden Dauer
  const landung = abflug + 9 * H
  const daten = { ab: { planMs: abflug }, an: { planMs: landung } }
  let stand = { geholt: abflug - 200 * H, daten }, n = 0
  for (let z = abflug - 168 * H; z < landung + 5 * H; z += 0.25 * H) if (faellig(flug, stand, z)) { n++; stand = { ...stand, geholt: z } }
  p('rund 31 Abfragen je Flug', n >= 28 && n <= 34, n)
  let st2 = { geholt: abflug - 200 * H, daten }, n2 = 0
  for (let z = abflug - 168 * H; z < landung + 5 * H; z += H) {
    const stunde = ((z / H) % 24 + 24) % 24
    if ([8, 13, 20].includes(Math.round(stunde)) && faellig(flug, st2, z)) { n2++; st2 = { ...st2, geholt: z } }
  }
  p('nur bei geöffneter App deutlich weniger', n2 < 16, n2)
  p('nach der Landung ist Schluss', !faellig(flug, { geholt: landung, daten }, landung + 4 * H))
  p('leere Antwort: seltener nachsehen', !faellig(flug, { geholt: abflug - 50 * H, leer: true }, abflug - 40 * H))
}

console.log('\n4  Kontingent und Taste')
{
  const jetzt = Date.parse('2037-03-10T12:00:00Z')
  const z = (anzahl, monat = monatVon(jetzt)) => ({ monat, anzahl })
  p('automatisch bis zur Reserve', darfAbfragen(z(KONTINGENT - RESERVE - 1), jetzt) && !darfAbfragen(z(KONTINGENT - RESERVE), jetzt))
  p('Taste nutzt die Reserve', darfAbfragen(z(KONTINGENT - 1), jetzt, { vonHand: true }) && !darfAbfragen(z(KONTINGENT), jetzt, { vonHand: true }))
  p('neuer Monat beginnt bei null', genutzt(z(150, '2037-02'), jetzt) === 0 && darfAbfragen(z(200, '2037-02'), jetzt))
  const { fluege } = fluegeAusTerminen(termine)
  const g = naechsteGruppe(fluege, {}, Date.parse('2037-02-20T12:00:00'))
  p('Taste holt nächsten Flug samt Anschluss', g.map((f) => f.nr).join() === 'XY12,XY345')
}

console.log('\n5  Antworten')
{
  const d = leseAntwort(antwort('2037-03-01 10:00', '2037-03-01 18:35', {
    ab: { revisedTime: { utc: '2037-03-01 10:25Z', local: '2037-03-01 11:25+01:00' }, gate: 'Z19', checkInDesk: '259-335', quality: ['Basic', 'Live'] },
    an: { baggageBelt: '5' },
  }), '2037-03-01')
  p('Felder', d.ab.gate === 'Z19' && d.ab.schalter === '259-335' && d.an.band === '5' && d.ab.iata === 'AAA' && d.ab.ort === 'Astadt')
  p('Zeitformat der Schnittstelle', d.ab.planMs === Date.parse('2037-03-01T10:00:00Z'))
  p('Ortszeit bleibt Ortszeit', d.ab.neuZeit === '11:25' && d.ab.planZeit === '10:00')
  p('Verspätung aus alter und neuer Zeit', verspaetung(d.ab) === 25, verspaetung(d.ab))
  p('Live oder nur Flugplan', d.ab.live === true && d.an.live === false)
  p('deutliche Verspätung zählt als schlecht', istSchlecht(d))
  const zwei = [...antwort('2037-02-28 23:00', '2037-03-01 05:00'), ...antwort('2037-03-01 23:00', '2037-03-02 05:00')]
  p('bei zwei Treffern zählt der gesuchte Tag', leseAntwort(zwei, '2037-03-01').ab.planDatum === '2037-03-01')
  p('leere Antwort', leseAntwort([], '2037-03-01') === null)
  const fliegt = leseAntwort(antwort('2037-03-01 10:00', '2037-03-01 18:00', { flug: { status: 'Departed' } }), '2037-03-01')
  p('ohne Live-Daten am Ziel: „Wohl gelandet“', statusText(fliegt, Date.parse('2037-03-01T19:00:00Z')) === 'Wohl gelandet')
  p('vor der Landung bleibt „Abgeflogen“', statusText(fliegt, Date.parse('2037-03-01T15:00:00Z')) === 'Abgeflogen')
}

console.log('\n6  Änderungen')
{
  const a = leseAntwort(antwort('2037-03-01 10:00', '2037-03-01 18:00', { ab: { gate: 'A1' } }), '2037-03-01')
  const b = leseAntwort(antwort('2037-03-01 10:00', '2037-03-01 18:00', { ab: { gate: 'B7', revisedTime: { utc: '2037-03-01 10:30Z', local: '2037-03-01 10:30+00:00' } } }), '2037-03-01')
  const c = aenderungen(a, b)
  p('Gatewechsel wird gemeldet', c.some((x) => x.text.includes('A1 → B7') && x.wichtig), JSON.stringify(c))
  p('neue Abflugzeit wird gemeldet', c.some((x) => x.text.includes('10:30')))
  p('gleiche Daten: nichts', aenderungen(a, a).length === 0)
  p('erste Antwort ist keine Änderung', aenderungen(undefined, a).length === 0)
  const x = leseAntwort(antwort('2037-03-01 10:00', '2037-03-01 18:00', { flug: { status: 'Canceled' } }), '2037-03-01')
  p('Annullierung ist wichtig', aenderungen(a, x).some((v) => v.wichtig && v.text === 'Annulliert'))
}

console.log('\n7  Umstiege und Hinweis vor dem Abflug')
{
  const { fluege } = fluegeAusTerminen(termine.slice(0, 1))
  const s = (ankunft, abflug) => ({
    [fluege[0].id]: { daten: leseAntwort(antwort('2037-03-01 10:00', ankunft), '2037-03-01') },
    [fluege[1].id]: { daten: leseAntwort(antwort(abflug, '2037-03-02 05:00'), abflug.slice(0, 10)) },
  })
  const ruhig = umstiege(fluege, s('2037-03-01 18:00', '2037-03-01 21:00'))[0]
  p('Umstiegszeit', ruhig.minuten === 180 && !ruhig.knapp)
  p('knapp unter einer Stunde', umstiege(fluege, s('2037-03-01 20:30', '2037-03-01 21:00'))[0].knapp)
  p('verpasst', umstiege(fluege, s('2037-03-01 21:30', '2037-03-01 21:00'))[0].verpasst)
  p('über 24 Stunden ist kein Umstieg', umstiege(fluege, s('2037-03-01 18:00', '2037-03-03 21:00')).length === 0)
  const f = { id: 'x', datum: '2037-03-10', zeit: '12:00', terminDatum: '2037-03-10' }
  const ab = Date.parse('2037-03-10T12:00:00')
  p('25 Stunden vorher noch nicht', flugImFokus([f], {}, ab - 25 * H) === null)
  p('23 Stunden vorher im Fokus', flugImFokus([f], {}, ab - 23 * H) === f)
  p('lange nach dem Abflug nicht mehr', flugImFokus([f], {}, ab + 6 * H) === null)
}

console.log('\n8  Bahn')
{
  p('Zugnummern', normalZug('ice 100') === 'ICE100' && normalZug('S 9') === 'S9' && normalZug('RE70') === 'RE70' && normalZug('Mainz') === '')
  p('Zugnummer im Text', zugnummernImText('Deutsche Bahn ICE 100 · 12:30').join() === 'ICE100')
  p('Bahnhof aus dem Titel', bahnhofAusTitel('Astadt → Bstadt') === 'Astadt Hbf' && bahnhofAusTitel('Berlin Ost → Bstadt') === 'Berlin Ost')
  const { zuege, ohneNummer, alle } = fluegeAusTerminen([
    { id: 'z1', datum: '2037-03-01', kat: 'train', titel: 'Astadt → Bstadt', sub: 'Beispielbahn', zugNr: 'ICE 100', zeit: '12:30', sitz: 'Wagen 7, Platz 21', ref: '777' },
    { id: 'z2', datum: '2037-03-02', kat: 'train', titel: 'Cstadt → Dstadt', sub: 'Beispielbahn' },
    { id: 'f1', datum: '2037-03-01', kat: 'flight', titel: 'Flug', flugNr: 'XY1', zeit: '09:00' },
  ])
  p('Zug wird erkannt', zuege.length === 1 && zuege[0].nr === 'ICE100' && zuege[0].art === 'bahn' && zuege[0].bahnhof === 'Astadt Hbf')
  p('Sitzplatz und Buchung bleiben', zuege[0].sitz === 'Wagen 7, Platz 21' && zuege[0].ref === '777')
  p('Zug ohne Nummer fehlt', ohneNummer.map((e) => e.id).join() === 'z2')
  p('Flüge und Züge in Reihenfolge', alle.map((f) => f.nr).join() === 'XY1,ICE100', alle.map((f) => f.nr))
  const z = zuege[0], ab = abflugMs(z)
  p('Tafel erst 3 Stunden vorher', !zugFaellig(z, null, ab - 4 * H) && zugFaellig(z, null, ab - 2 * H))
  p('alle 20 Minuten', !zugFaellig(z, { geholt: ab - 2 * H }, ab - 1.9 * H) && zugFaellig(z, { geholt: ab - 2 * H }, ab - 1.6 * H))
  const tafel = { departures: [
    { train: 'RE RE70', trainNumber: '11657', scheduledDeparture: '11:00', delayDeparture: 0, platform: '4', scheduledPlatform: '4', destination: 'Xdorf', messages: { delay: [], qos: [] } },
    { train: 'ICE 100', trainNumber: '100', scheduledDeparture: '12:30', delayDeparture: 12, platform: '5', scheduledPlatform: '3', destination: 'Bstadt', isCancelled: 0, messages: { delay: [{ text: 'Verspätung eines vorausfahrenden Zuges' }], qos: [] } },
    { train: 'ICE 100', scheduledDeparture: null },
  ] }
  const d = leseZug(tafel, z)
  p('richtiger Zug auf der Tafel', d.flugzeug === 'ICE 100' && d.an.ort === 'Bstadt')
  p('Verspätung und neue Zeit', verspaetung(d.ab) === 12 && d.ab.neuZeit === '12:42' && d.status === 'Delayed')
  p('Gleiswechsel', d.ab.gleis === '5' && d.ab.gleisAlt === '3')
  p('Hinweis der Bahn', d.hinweise[0].includes('vorausfahrenden'))
  p('Zug noch nicht auf der Tafel', leseZug({ departures: [] }, z) === null)
  p('Ausfall', leseZug({ departures: [{ ...tafel.departures[1], isCancelled: 1 }] }, z).status === 'Canceled')
  p('pünktlich', leseZug({ departures: [{ ...tafel.departures[1], delayDeparture: 0 }] }, z).status === 'OnTime')
  p('Linienzug', leseZug({ departures: [tafel.departures[0]] }, { ...z, nr: 'RE70' })?.ab.gleis === '4')
  p('Gleisänderung wird gemeldet', aenderungen(d, { ...d, ab: { ...d.ab, gleis: '7' } }).some((a) => a.text.includes('5 → 7')))
}

console.log('\n9  Vorabausgaben und Pflichtangaben')
{
  const alle = [{ nr: 'XY1' }]
  const vorab = [
    { id: 'a', kat: 'kosten_flug', text: 'Flug nach Astadt' },
    { id: 'b', kat: 'kosten_flug', text: 'Flug XY1 Hin' },
    { id: 'c', kat: 'kosten_flug', text: 'Verbunden', terminId: 'x' },
    { id: 'd', kat: 'kosten_flug', text: 'Abgehakt', keinTermin: true },
    { id: 'e', kat: 'kosten_bahn', text: 'Zug zum Flughafen' },
    { id: 'f', kat: 'kosten_technik', text: 'Kamera' },
  ]
  const o = offeneVorab(vorab, alle)
  p('offene Flüge und Züge aus Vorabausgaben', o.map((k) => k.id).join() === 'a,e', o.map((k) => k.id))
  p('Art kommt aus der Kategorie', o[1].art === 'bahn')
  p('Flug braucht Nummer und Datum', verkehrOk('flug', { nr: 'XY 1', datum: '2037-03-01' }) && !verkehrOk('flug', { nr: 'XY 1' }) && !verkehrOk('flug', { datum: '2037-03-01' }))
  p('Zug braucht auch den Bahnhof', verkehrOk('bahn', { nr: 'ICE 1', datum: '2037-03-01', bahnhof: 'Astadt' }) && !verkehrOk('bahn', { nr: 'ICE 1', datum: '2037-03-01' }))
}

console.log('\n10  Schlüssel und Quelle')
{
  const dienst = fs.readFileSync(new URL('../src/lib/flug-dienst.js', import.meta.url), 'utf8')
  const user = fs.readFileSync(new URL('../src/lib/userdata.js', import.meta.url), 'utf8')
  p('nur der Dienst kennt den Schlüssel, nicht das Backup', !/flug-schluessel|flugstatus/.test(user))
  p('Abfrage läuft über RapidAPI', dienst.includes('aerodatabox.p.rapidapi.com'))
  p('kein Schlüssel im Code', !/[0-9a-f]{40,}/i.test(dienst))
  p('Daten werden nach 7 Tagen gelöscht', /7 \* 24/.test(dienst))
  const seite = fs.readFileSync(new URL('../src/lib/Fluege.svelte', import.meta.url), 'utf8')
  p('Quellenangabe auf der Flugseite', /AeroDataBox/.test(seite))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
