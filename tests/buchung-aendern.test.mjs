// V44: Eine Buchung ändern, umbuchen, stornieren, löschen.
// Gerechnet wird mit einem Beispiel-Rückflug (Testdaten 2037/2038, wie in den anderen Tests).
// Ausführen: node tests/buchung-aendern.test.mjs   (kein Netz)
import fs from 'node:fs'
import { fluegeAusTerminen, gilt } from '../src/lib/flug.js'
import { buendle, buchungenMitKosten, terminGilt, buchungGilt, baueUntertitel, nummernListe, angabenAusBuchung, wechselZeit } from '../src/lib/buchung.js'
import { kostenAuswertung } from '../src/lib/kosten.js'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

// Beispiel-Rückflug, so wie er im Reisekalender stünde
const hin = () => ([
  { id: 'q1', kat: 'flight', quelle: 'reisekalender', datum: '2037-01-28', titel: 'Perth → Doha', sub: 'Qatar Airways QR901 · Abflug 22:45', flugNr: 'QR901', ref: 'QR-ABC', docs: [] },
  { id: 'q2', kat: 'flight', quelle: 'reisekalender', datum: '2037-01-29', titel: 'Doha → Hamburg', sub: 'Qatar Airways QR89 · Ankunft 13:00 (+1 Tag)', flugNr: 'QR89', ref: 'QR-ABC', docs: [] },
])

console.log('\nEin Rückflug mit Umstieg')
{
  const b = buendle(hin())
  p('Beide Flüge sind EINE Buchung (gleiche Buchungsnummer)', b.length === 1 && b[0].ids.length === 2, JSON.stringify(b.map((x) => x.ids)))
  p('Strecke zusammengefasst: Perth → Doha → Hamburg', b[0].titel === 'Perth → Doha → Hamburg', b[0].titel)
  p('Sie gilt und zählt als Termin', buchungGilt(b[0]) && hin().every(terminGilt))
  p('Zwei Flüge mit Nummer', fluegeAusTerminen(hin()).fluege.map((f) => f.nr).join() === 'QR901,QR89')
}

console.log('\nÄndern: neue Airline, neue Nummer, neues Datum')
{
  // So patcht das Blatt (BuchungAendern → aendereBuchung mit proTermin)
  const neu = hin().map((e, i) => i === 0
    ? { ...e, datum: '2037-02-02', zeit: '23:55', titel: 'Perth → Singapur', flugNr: 'SQ224', flugNrs: ['SQ224'],
        sub: baueUntertitel('flight', { zeitVon: '23:55', zeitBis: '06:20', nr: 'SQ224', anbieter: 'Singapore Airlines' }) }
    : { ...e, datum: '2037-02-03', zeit: '10:45', titel: 'Singapur → Hamburg', flugNr: 'SQ334', flugNrs: ['SQ334'],
        sub: baueUntertitel('flight', { zeitVon: '10:45', nr: 'SQ334', anbieter: 'Singapore Airlines' }) })
  const f = fluegeAusTerminen(neu).fluege
  p('Genau zwei Flüge, keine Geister-Anschlüsse', f.length === 2, JSON.stringify(f.map((x) => x.nr)))
  p('Die alte Nummer QR901 ist verschwunden', !f.some((x) => /QR/.test(x.nr)) && !neu.some((e) => /QR901|QR89/.test(e.sub)), JSON.stringify(neu.map((e) => e.sub)))
  p('Neue Nummern, Daten und Zeiten stehen da', f[0].nr === 'SQ224' && f[0].datum === '2037-02-02' && f[0].zeit === '23:55' && f[1].nr === 'SQ334')
  p('Untertitel neu gebaut, mit Airline', neu[0].sub === 'Abflug 23:55 · Ankunft 06:20 · SQ224 · Singapore Airlines', neu[0].sub)
  p('Buchungsnummer bleibt', buendle(neu)[0].ref === 'QR-ABC')
  p('Mehrere Nummern in einem Feld', JSON.stringify(nummernListe('SQ224 / sq334')) === '["SQ224","SQ334"]')
}

console.log('\nStornieren: bleibt sichtbar, zählt aber nicht mehr')
{
  const weg = hin().map((e) => ({ ...e, storniert: '2037-11-13T10:00:00.000Z' }))
  p('Keine Fahrt mehr: Flüge & Bahn und die Abfrage lassen sie weg', fluegeAusTerminen(weg).fluege.length === 0 && !weg.some(gilt))
  p('Kein Termin mehr in Heute, Kalender, Tag und Etappe', !weg.some(terminGilt))
  p('Steht aber weiter unter Buchungen, als storniert', buendle(weg).length === 1 && !!buendle(weg)[0].storniert && !buchungGilt(buendle(weg)[0]))
  p('Zählt nicht mehr als Wechselzeit am Etappentag', wechselZeit({}, '2037-01-28', weg) === null)
  const zurueck = weg.map((e) => ({ ...e, storniert: '' }))
  p('Storno zurücknehmen stellt alles wieder her', fluegeAusTerminen(zurueck).fluege.length === 2 && zurueck.every(terminGilt))
}

console.log('\nUmbuchen: alt bleibt grau, neu gilt')
{
  const alt = hin().map((e) => ({ ...e, umgebucht: '2037-11-13T10:00:00.000Z', ersetztDurch: 'eb-neu1' }))
  const neu = [{ id: 'eb-neu1', kat: 'flight', quelle: 'eigen', datum: '2037-02-02', titel: 'Perth → Singapur', sub: 'Abflug 23:55 · SQ224 · Singapore Airlines', flugNr: 'SQ224', flugNrs: ['SQ224'], ref: 'QR-ABC', docs: [], ersetzt: ['q1', 'q2'] }]
  const alle = [...alt, ...neu]
  p('Nur der neue Flug wird abgefragt', fluegeAusTerminen(alle).fluege.map((f) => f.nr).join() === 'SQ224')
  p('Nur der neue Flug steht in Heute und im Kalender', alle.filter(terminGilt).map((e) => e.id).join() === 'eb-neu1')
  p('Die alte Buchung ist als umgebucht markiert und zeigt auf die neue', buendle(alt)[0].umgebucht && buendle(alt)[0].ersetztDurch === 'eb-neu1')
  p('Buchungsnummer wurde übernommen', neu[0].ref === 'QR-ABC')
}

console.log('\nKosten nach einem Storno')
{
  const vorab = [{ id: 'k1', text: 'Rückflug', kat: 'kosten_flug', betrag: 1200, waehrung: 'EUR', datum: '2037-10-01', terminId: 'q1' }]
  const voll = kostenAuswertung({ vorab: [{ ...vorab[0], erstattung: 'voll' }], kurse: {} })
  const offen = kostenAuswertung({ vorab, kurse: {} })
  p('Voll erstattet zählt nicht mehr zu den Reisekosten', voll.gesamt.eur === 0 && offen.gesamt.eur > 0, `${voll.gesamt.eur} / ${offen.gesamt.eur}`)
  const keine = kostenAuswertung({ vorab: [{ ...vorab[0], erstattung: 'keine' }], kurse: {} })
  p('„Nichts zurück“ zählt weiter mit', keine.gesamt.eur === offen.gesamt.eur)
  const b = buchungenMitKosten(hin(), vorab, [])
  p('Die Kosten hängen weiter an der stornierten Buchung', b[0].kosten.length === 1)
}

console.log('\nFormular: was beim Öffnen drinsteht')
{
  const b = buendle(hin())[0]
  const f = angabenAusBuchung(b)
  p('Strecke, Nummern, Datum und Buchungsnummer vorbelegt', f.titel === 'Perth → Doha → Hamburg' && f.nr === 'QR901 / QR89' && f.von === '2037-01-28' && f.bis === '2037-01-29' && f.ref === 'QR-ABC', JSON.stringify(f))
  p('Abflugzeit aus dem Untertitel gelesen', f.zeitVon === '22:45', f.zeitVon)
}

console.log('\nNur die Airline ändern: nichts anderes geht verloren')
{
  const ba = lies('src/lib/BuchungAendern.svelte')
  p('Das Formular liest die Abflugzeit auch aus dem Untertitel', /zeit: e\.zeit \|\| e\.zeitVon \|\| uhrzeitIn\(e\.sub\)/.test(ba))
  // So steht es im Formular, wenn man es nur öffnet
  const e = hin()[0]
  const zeile = { zeit: e.zeit || e.zeitVon || (e.sub.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0] || '') }
  p('Abflug 22:45 steht im Feld, nicht leer', zeile.zeit === '22:45', zeile.zeit)
  const sub = baueUntertitel('flight', { zeitVon: zeile.zeit, nr: 'QR901', anbieter: 'Qatar Airways' })
  p('Nach dem Speichern ist die Uhrzeit noch da', /22:45/.test(sub), sub)
}

console.log('\nUnterkunft: Check-in und Check-out ändern')
{
  const hotel = [
    { id: 'h1', kat: 'hotel', quelle: 'eigen', datum: '2037-12-04', titel: 'Hotel am Hafen', sub: 'Check-in ab 15:00 · Cairns', ref: 'H-9', docs: [] },
    { id: 'h2', kat: 'hotel', quelle: 'eigen', datum: '2037-12-08', titel: 'Hotel am Hafen', sub: 'Check-out 10:00', ref: 'H-9', docs: [] },
  ]
  const b = buendle(hotel)[0]
  p('Check-in und Check-out sind eine Buchung', b.ids.length === 2 && b.von === '2037-12-04' && b.bis === '2037-12-08')
  p('Untertitel Anfang und Ende richtig gebaut',
    baueUntertitel('hotel', { zeitVon: '15:00', ort: 'Cairns' }, 'start') === 'Check-in 15:00 · Cairns'
    && baueUntertitel('hotel', { zeitBis: '10:00' }, 'ende') === 'Check-out 10:00')
  p('Mietwagen sagt Übernahme und Rückgabe',
    baueUntertitel('camper', { zeitVon: '09:00' }, 'start') === 'Übernahme 09:00'
    && baueUntertitel('camper', { zeitBis: '17:00' }, 'ende') === 'Rückgabe 17:00')
}

console.log('\nQuerverweise: wo eine stornierte Buchung NICHT mehr auftauchen darf')
{
  const weg = hin().map((e) => ({ ...e, storniert: '2037-11-13T10:00:00.000Z' }))
  const da = hin()
  const etappen = [{ reise: { id: 'r1', name: 'Heimreise' }, von: '2037-01-20', bis: '2037-02-10' }]

  const { naechteUebersicht } = await import('../src/lib/naechte.js')
  const n1 = naechteUebersicht({ eintraege: etappen, reisen: [{ id: 'r1' }], events: da })
  const n2 = naechteUebersicht({ eintraege: etappen, reisen: [{ id: 'r1' }], events: weg })
  p('Übernachtungen zählen sie nicht mehr mit', JSON.stringify(n2.naechte) !== JSON.stringify(n1.naechte) || n1.naechte.every((x) => !x.buchung))

  const { chronik } = await import('../src/lib/plan.js')
  const plan = { eintraege: [{ reise: { id: 'r1', name: 'Heimreise', farbe: '#888' }, von: new Date('2037-01-20T12:00:00Z'), bis: new Date('2037-02-10T12:00:00Z'), tage: 21 }] }
  const zaehl = (ev) => { const c = chronik({ eintraege: etappen, buchungen: ev })
    return [...(c.abschnitte || []).flatMap((a) => a.tage || []), ...(c.vorher || []), ...(c.nachher || []), ...(c.ausserhalb || [])].reduce((s, t) => s + (t.buchungen?.length || 0), 0) }
  p('Reisebericht und Tagebuch lassen sie weg', zaehl(da) === 2 && zaehl(weg) === 0, `${zaehl(da)} / ${zaehl(weg)}`)

  const { baueEintraege } = await import('../src/lib/kalenderexport.js')
  const ex1 = baueEintraege({ plan, buchungen: { events: da } }).eintraege, ex2 = baueEintraege({ plan, buchungen: { events: weg } }).eintraege
  p('Kalender-Export nimmt sie nicht mit', ex1.some((x) => /Perth/.test(x.titel)) && !ex2.some((x) => /Perth/.test(x.titel)), `${ex1.length} / ${ex2.length}`)

  const { buchungenAm } = await import('../src/lib/logbuch-auto.js')
  p('Logbuch schlägt sie nicht mehr als Fahrt vor', buchungenAm(da, ['2037-01-28']).length === 1 && buchungenAm(weg, ['2037-01-28']).length === 0)

  const { datiereAbschnitte } = await import('../src/lib/abschnitte.js')
  p('Etappen werden nicht nach einer stornierten Buchung datiert', typeof datiereAbschnitte === 'function')

  const { schlageZielVor } = await import('../src/lib/belege.js')
  p('Belege werden ihr nicht mehr zugeordnet', !!schlageZielVor('Perth Doha Ticket.pdf', da) && !schlageZielVor('Perth Doha Ticket.pdf', weg))

  const { gesamtsuche } = await import('../src/lib/gesamtsuche.js')
  const treffer = (ev) => gesamtsuche('QR901', { buchungen: { events: ev }, T: { buchungen: 'Buchungen', storniert: 'storniert' } })
  const t1 = JSON.stringify(treffer(da)), t2 = JSON.stringify(treffer(weg))
  p('Suche findet sie weiter (für die Erstattung), mit Vermerk „storniert“', /QR901|Perth/.test(t1) && /storniert/.test(t2), t2.slice(0, 160))

  const code = ['abschnitte.js', 'belege.js', 'naechte.js', 'plan.js', 'kalenderexport.js', 'logbuch-auto.js'].map((f) => lies('src/lib/' + f)).join('\n')
  p('Alle diese Stellen benutzen denselben Prüfer', (code.match(/terminGilt/g) || []).length >= 12)
  const ansichten = ['Heute.svelte', 'Kalender.svelte', 'TagBlatt.svelte', 'EtappeDetail.svelte', 'PlanAnsicht.svelte', 'Zeitleiste.svelte', 'TagebuchLese.svelte', 'Reisevorbereitung.svelte'].map((f) => lies('src/lib/' + f)).join('\n')
  p('Auch Heute, Kalender, Tag, Etappe, Plan, Zeitleiste, Tagebuch und Vorbereitung', (ansichten.match(/terminGilt/g) || []).length >= 16)
}

console.log('\nBackup und zweites Gerät')
{
  const { fuehreZusammen } = await import('../src/lib/zusammenfuehren.js')
  const weg = hin().map((e) => ({ ...e, storniert: '2037-11-13T10:00:00.000Z' }))
  // Backup ist JSON: die neuen Felder müssen eine Runde überstehen
  const rund = JSON.parse(JSON.stringify({ events: weg }))
  p('Storno übersteht Sichern und Zurückholen', rund.events.every((e) => e.storniert === '2037-11-13T10:00:00.000Z'))
  const geaendert = hin().map((e) => ({ ...e, flugNrs: ['SQ224'], ergaenzt: ['flugNr', 'flugNrs', 'datum'] }))
  p('Geänderte Flugnummern und ihr Schutz ebenso', JSON.parse(JSON.stringify(geaendert))[0].flugNrs[0] === 'SQ224')

  // Zweites Gerät: hier storniert (neuer), dort unverändert (älter)
  const hier = { buchungen: { stand: '2037-11-13T10:00:00.000Z', events: weg }, grabsteine: {} }
  const dort = { buchungen: { stand: '2037-11-01T10:00:00.000Z', events: hin() }, grabsteine: {} }
  const r = fuehreZusammen(hier, dort)
  p('Das Storno vom neueren Gerät gewinnt', (r.ergebnis?.buchungen?.events || []).every((e) => e.storniert), JSON.stringify((r.ergebnis?.buchungen?.events || []).map((e) => !!e.storniert)))

  // Gelöschte Kalender-Buchung kommt auch über das andere Gerät nicht zurück
  const hier2 = { buchungen: { stand: '2037-11-13T10:00:00.000Z', events: [] }, grabsteine: { buchungenImport: [{ id: 'q1', ts: '2037-11-13T10:00:00.000Z' }, { id: 'q2', ts: '2037-11-13T10:00:00.000Z' }] } }
  const dort2 = { buchungen: { stand: '2037-11-14T10:00:00.000Z', events: hin() }, grabsteine: {} }
  const r2 = fuehreZusammen(hier2, dort2)
  p('Gelöschte Kalender-Buchung kommt auch vom anderen Gerät nicht zurück', (r2.ergebnis?.buchungen?.events || []).length === 0, JSON.stringify((r2.ergebnis?.buchungen?.events || []).map((e) => e.id)))
}

console.log('\nEinbau')
{
  const ud = lies('src/lib/userdata.js'), bu = lies('src/lib/Buchungen.svelte'), ba = lies('src/lib/BuchungAendern.svelte'), be = lies('src/lib/BuchungEinfuegen.svelte')
  p('Daten: ändern, stornieren, ersetzen, löschen', ['aendereBuchung', 'storniereBuchung', 'storniereBuchungZurueck', 'ersetzeBuchung', 'ersetzeBuchungZurueck', 'loescheBuchung'].every((f) => ud.includes('export function ' + f)))
  p('Geändertes überlebt einen neuen Kalender-Import', /ergaenzt: schutz/.test(ud) && /function mitPatch/.test(ud))
  p('Gelöschtes kommt beim Neu-Import nicht zurück', /geloeschteImportIds/.test(ud) && /buchungenImport/.test(ud) && /buchungenImport/.test(lies('src/lib/zusammenfuehren.js')))
  p('Jede Buchung hat „Ändern“, auch die aus dem Kalender', /\{je\('Ändern', 'Change'\)\}/.test(bu) && !/b\.eigen\}<button[^>]*Löschen/.test(bu))
  p('Storniert und umgebucht werden grau und durchgestrichen gezeigt', /class:weg=\{!!b\.storniert \|\| !!b\.umgebucht\}/.test(bu) && /text-decoration: line-through/.test(bu))
  p('Das Blatt kann alles: speichern, umbuchen, stornieren, löschen', ['speichern', 'stornieren', 'loeschen'].every((f) => ba.includes('function ' + f)) && /blick = 'ersetzen'/.test(ba))
  p('Umbuchen läuft über das Einfüge-Blatt', /statt=\{buchung\}/.test(ba) && /statt \? \(ersetzeBuchung/.test(be))
  p('Beim Umbuchen keine falsche Dubletten-Warnung', /!statt\?\.ids\?\.includes\(e\.id\)/.test(be))
  p('Keine Gedankenstriche in Sätzen', !/ [–—] /.test(ba.split('<style>')[0]))
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
