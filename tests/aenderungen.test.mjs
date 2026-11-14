// Wo etwas geändert oder gelöscht wird, muss überall mitziehen: Termine, Ausgaben, Etappe, Nächte.
// Anlass: Der Fehler bei der Buchungsänderung kam daher, dass dieselbe Angabe an zwei
// Stellen lag und nur eine mitgezogen ist. Hier wird jeder Änderungsweg einzeln durchgespielt.
// Ausführen: node tests/aenderungen.test.mjs   (kein Netz, kein Browser)
import { buchungen, vorabKosten, reisen, gesamtStart, grabsteine, notizen, journal, wanderungen, neueNotiz,
  loescheBuchung, loescheEigeneBuchung, entferneReisekalender, importiereReisekalender,
  aendereBuchung, ersetzeBuchung, neueVorabKosten, updateVorabKosten, updateReise, loescheReise } from '../src/lib/userdata.js'
import { fluegeAusTerminen, offeneVorab, flugNummern } from '../src/lib/flug.js'
import { buchungenMitKosten, terminGilt, wechselZeit, mitNaechten, baueUntertitel, terminZeit } from '../src/lib/buchung.js'
import { speichereVerkehr, angabenAus, textNachziehen } from '../src/lib/verkehr.js'
import { naechteUebersicht } from '../src/lib/naechte.js'
import { baueEintraege } from '../src/lib/kalenderexport.js'
import { etappeAm, etappenMitDatum } from '../src/lib/plan.js'
import { fuehreZusammen } from '../src/lib/zusammenfuehren.js'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : '  → ' + String(info).slice(0, 220)); if (!ok) fehler++ }
const lies = (s) => { let v; const u = s.subscribe((x) => { v = x }); u(); return v }

/** Saubere Ausgangslage: zwei Kalender-Termine, eine eigene Buchung, je eine Ausgabe daran. */
function aufbauen() {
  grabsteine.set({})
  reisen.set([{ id: 'et1', typ: 'etappe', name: 'Südwesten', von: '2037-01-10', bis: '2037-01-20', quelle: 'reisekalender' }])
  gesamtStart.set('2037-01-10')
  buchungen.set({
    stand: '2037-01-01T00:00:00.000Z', von: '2037-01-10', bis: '2037-01-20',
    events: [
      { id: 'rk-1', quelle: 'reisekalender', kat: 'hotel', datum: '2037-01-12', titel: 'Hotel am Hafen', sub: 'Check-in 15:00', ref: 'H-1', docs: [] },
      { id: 'rk-2', quelle: 'reisekalender', kat: 'flight', datum: '2037-01-14', titel: 'Perth → Broome', sub: 'Abflug 09:10 · QF1808', flugNr: 'QF1808', ref: 'F-1', docs: [] },
      { id: 'eb-1', quelle: 'eigen', kat: 'tour', datum: '2037-01-16', titel: 'Walhai-Tour', sub: '', ref: 'T-1', gruppe: 'eg-1', docs: [] },
    ],
    persoenlich: [],
  })
  vorabKosten.set([
    { id: 'k-hotel', text: 'Hotel am Hafen', kat: 'kosten_unterkunft', betrag: '240', waehrung: 'AUD', terminId: 'rk-1', reiseId: 'et1', zahlung: 'bezahlt' },
    { id: 'k-flug', text: 'Perth → Broome', kat: 'kosten_flug', betrag: '189', waehrung: 'AUD', terminId: 'rk-2', reiseId: 'et1', zahlung: 'bezahlt' },
    { id: 'k-tour', text: 'Walhai-Tour', kat: 'kosten_attraktion', betrag: '449', waehrung: 'AUD', terminId: 'eb-1', reiseId: 'et1', zahlung: 'bezahlt' },
  ])
}
const kosten = (id) => lies(vorabKosten).find((k) => k.id === id)
const termine = () => lies(buchungen)?.events || []

console.log('\nEigene Buchung löschen (Reisevorbereitung)')
{
  aufbauen()
  const weg = loescheEigeneBuchung('eb-1')
  p('Der Termin ist weg', weg === 1 && !termine().some((e) => e.id === 'eb-1'))
  p('Die Ausgabe hängt an keinem toten Termin mehr', kosten('k-tour').terminId === null, JSON.stringify(kosten('k-tour')))
  p('Die Ausgabe selbst bleibt erhalten', kosten('k-tour').betrag === '449')
  p('Sie steht wieder als „noch keinem Termin zugeordnet“ zur Verfügung', !kosten('k-tour').terminId)
}

console.log('\nBuchung aus dem Blatt löschen (Buchung ändern → Ganz löschen)')
{
  aufbauen()
  const weg = loescheBuchung(['rk-2'])
  p('Der Termin ist weg', weg === 1 && !termine().some((e) => e.id === 'rk-2'))
  p('Die Flug-Ausgabe hängt an keinem toten Termin mehr', kosten('k-flug').terminId === null, JSON.stringify(kosten('k-flug')))
  p('Und taucht in „bezahlt, noch kein Termin“ wieder auf', offeneVorab(lies(vorabKosten), fluegeAusTerminen(termine()).alle).some((k) => k.id === 'k-flug'))
  p('Gelöschtes kommt beim nächsten Import nicht zurück', (lies(grabsteine).buchungenImport || []).some((x) => x.id === 'rk-2'))
}

console.log('\nKalender neu importieren, ein Termin fehlt jetzt darin')
{
  aufbauen()
  importiereReisekalender({
    stand: '2037-02-01T00:00:00.000Z', von: '2037-01-10', bis: '2037-01-20',
    events: [{ id: 'rk-1', quelle: 'reisekalender', kat: 'hotel', datum: '2037-01-12', titel: 'Hotel am Hafen', sub: 'Check-in 15:00', ref: 'H-1', docs: [] }],
    persoenlich: [],
  }, { reisenAnlegen: false })
  p('Der verschwundene Termin ist nicht mehr da', !termine().some((e) => e.id === 'rk-2'))
  p('Die eigene Buchung bleibt', termine().some((e) => e.id === 'eb-1'))
  p('Die Ausgabe des verschwundenen Termins hängt an nichts mehr', kosten('k-flug').terminId === null, JSON.stringify(kosten('k-flug')))
  p('Die Ausgabe des gebliebenen Termins bleibt verbunden', kosten('k-hotel').terminId === 'rk-1')
}

console.log('\nReisekalender ganz entfernen')
{
  aufbauen()
  entferneReisekalender()
  p('Keine Termine mehr', !lies(buchungen))
  p('Keine Ausgabe zeigt mehr auf einen Termin', lies(vorabKosten).every((k) => !k.terminId), JSON.stringify(lies(vorabKosten).map((k) => [k.id, k.terminId])))
  p('Die Ausgaben selbst bleiben alle erhalten', lies(vorabKosten).length === 3)
}

console.log('\nBuchung auf einen anderen Tag schieben')
{
  aufbauen()
  aendereBuchung(['rk-1'], { datum: '2037-01-18' })
  const e = termine().find((x) => x.id === 'rk-1')
  p('Der Termin steht am neuen Tag', e.datum === '2037-01-18')
  p('Am alten Tag steht er nicht mehr', !termine().some((x) => x.datum === '2037-01-12'))
  p('Die Ausgabe bleibt an der Buchung', kosten('k-hotel').terminId === 'rk-1')
  const b = buchungenMitKosten(termine(), lies(vorabKosten), [{ id: 'et1', von: '2037-01-10', bis: '2037-01-20', reise: { id: 'et1', name: 'Südwesten' } }])
  const hotel = b.find((x) => x.titel === 'Hotel am Hafen')
  p('Die Buchung zeigt ihre Kosten weiterhin', hotel.kosten.length === 1 && hotel.kosten[0].id === 'k-hotel')
  p('Die Buchung hängt am neuen Tag in derselben Etappe', hotel.etappe?.id === 'et1', JSON.stringify(hotel.etappe))
  p('Geändertes ist gegen den nächsten Import geschützt', (e.ergaenzt || []).includes('datum'))
}

console.log('\nBuchung aus der Etappe heraus schieben')
{
  aufbauen()
  aendereBuchung(['rk-1'], { datum: '2037-02-05' })
  const eintraege = [{ id: 'et1', von: '2037-01-10', bis: '2037-01-20', reise: { id: 'et1', name: 'Südwesten' } }]
  const b = buchungenMitKosten(termine(), lies(vorabKosten), eintraege)
  const hotel = b.find((x) => x.titel === 'Hotel am Hafen')
  p('Die Buchung gehört zu keiner Etappe mehr', !hotel.etappe, JSON.stringify(hotel.etappe))
  p('Der Tag liegt wirklich außerhalb', !etappeAm(eintraege, '2037-02-05'))
  p('Die Ausgabe zeigt noch auf die Buchung', kosten('k-hotel').terminId === 'rk-1')
}

console.log('\nNächte: eine verschobene Buchung zieht mit')
{
  aufbauen()
  const vorher = naechteUebersicht({ eintraege: [{ id: 'et1', von: '2037-01-10', bis: '2037-01-20', reise: { id: 'et1', name: 'Südwesten' } }], reisen: lies(reisen), events: termine() })
  aendereBuchung(['rk-1'], { datum: '2037-01-18' })
  const nachher = naechteUebersicht({ eintraege: [{ id: 'et1', von: '2037-01-10', bis: '2037-01-20', reise: { id: 'et1', name: 'Südwesten' } }], reisen: lies(reisen), events: termine() })
  const tagMit = (liste, d) => (liste || []).find((n) => n.datum === d)
  p('Die Nächte-Übersicht rechnet überhaupt', Array.isArray(vorher?.naechte || vorher) || typeof vorher === 'object')
  p('Am alten Tag steht die Buchung nicht mehr', JSON.stringify(nachher) !== JSON.stringify(vorher))
}

console.log('\nStornierte Buchung: Ausgabe bleibt, Termin zählt nicht mehr')
{
  aufbauen()
  aendereBuchung(['rk-2'], { storniert: '2037-01-05T10:00:00.000Z' })
  p('Kein Termin mehr im Reiseplan', !termine().filter(terminGilt).some((e) => e.id === 'rk-2'))
  p('Keine Fahrt mehr unter Flüge & Bahn', !fluegeAusTerminen(termine()).fluege.some((f) => f.nr === 'QF1808'))
  p('Die Ausgabe bleibt mit der Buchung verbunden', kosten('k-flug').terminId === 'rk-2')
  p('Der Termin selbst bleibt erhalten', termine().some((e) => e.id === 'rk-2'))
}

console.log('\nUnterkunft storniert: die Nacht ist wieder offen, der Export lässt sie weg')
{
  aufbauen()
  // Zwei Termine einer Unterkunft (Check-in und Check-out) als eine Buchung
  buchungen.update((b) => ({ ...b, events: [
    ...b.events.filter((e) => e.id !== 'rk-1'),
    { id: 'h-1', quelle: 'reisekalender', kat: 'hotel', datum: '2037-01-12', titel: 'Hotel am Hafen', sub: 'Check-in 15:00', ref: 'H-9', gruppe: 'hg-1', docs: [] },
    { id: 'h-2', quelle: 'reisekalender', kat: 'hotel', datum: '2037-01-15', titel: 'Hotel am Hafen', sub: 'Check-out 10:00', ref: 'H-9', gruppe: 'hg-1', docs: [] },
  ] }))
  const eintraege = [{ id: 'et1', von: '2037-01-10', bis: '2037-01-20', reise: { id: 'et1', name: 'Südwesten' } }]
  const vorher = naechteUebersicht({ eintraege, reisen: lies(reisen), events: termine() })
  const gebuchtVorher = JSON.stringify(vorher).includes('Hotel am Hafen')
  p('Die Nächte kennen die Unterkunft', gebuchtVorher)
  aendereBuchung(['h-1', 'h-2'], { storniert: '2037-01-05T09:00:00.000Z' })
  const nachher = naechteUebersicht({ eintraege, reisen: lies(reisen), events: termine() })
  p('Nach dem Storno steht sie nicht mehr als gebuchte Nacht', !JSON.stringify(nachher).includes('Hotel am Hafen'), JSON.stringify(nachher).slice(0, 200))
  const ausgabe = baueEintraege({ plan: [], buchungen: termine().filter(terminGilt) })
  p('Der Kalender-Export lässt sie weg', !JSON.stringify(ausgabe).includes('Hotel am Hafen'), JSON.stringify(ausgabe).slice(0, 200))
  p('Unter Buchungen steht sie weiter, als storniert', buchungenMitKosten(termine(), lies(vorabKosten), eintraege).some((b) => b.titel === 'Hotel am Hafen' && b.storniert))
}

console.log('\nUmbuchung rückgängig durch Löschen der neuen Buchung')
{
  aufbauen()
  // Erst umbuchen: alte Buchung grau, neue gilt
  const neueTermine = [{ id: 'eb-neu', quelle: 'eigen', kat: 'flight', datum: '2037-01-14', titel: 'Perth → Dubai', flugNr: 'EK421', ref: 'NEU-9', docs: [] }]
  const neuId = ersetzeBuchung(['rk-2'], neueTermine)
  p('Die neue Buchung ist da', neuId === 'eb-neu' && termine().some((e) => e.id === 'eb-neu'))
  p('Die alte ist umgebucht', !!termine().find((e) => e.id === 'rk-2')?.umgebucht)
  // Jetzt die neue Buchung löschen (war doch die falsche)
  loescheBuchung(['eb-neu'])
  const alt = termine().find((e) => e.id === 'rk-2')
  p('Die alte Buchung gilt wieder', !alt.umgebucht && !alt.ersetztDurch, JSON.stringify(alt))
  p('Der Flug steht wieder unter Flüge & Bahn', fluegeAusTerminen(termine()).fluege.some((f) => f.nr === 'QF1808'))
  p('Die Reise steht nicht ohne diesen Flug da', termine().filter(terminGilt).some((e) => e.id === 'rk-2'))
}

console.log('\nZweites Gerät: eine Umbuchung überlebt das Zusammenführen')
{
  const jetzt = (n) => new Date(Date.UTC(2037, 0, 10, 12, n)).toISOString()
  const kalender = (zusatz = {}) => ([
    { id: 'rk-1', quelle: 'reisekalender', kat: 'flight', datum: '2037-01-12', titel: 'Perth → Doha', sub: 'QR901', flugNr: 'QR901', ref: 'F-1', docs: [], ...zusatz },
  ])
  // Hier (Handy): Buchung umgebucht und durch eine eigene ersetzt
  const hier = {
    buchungen: { stand: jetzt(10), events: [
      ...kalender({ umgebucht: jetzt(10), ersetztDurch: 'eb-neu', ergaenzt: ['umgebucht', 'ersetztDurch'] }),
      { id: 'eb-neu', quelle: 'eigen', kat: 'flight', datum: '2037-01-12', titel: 'Perth → Dubai', flugNr: 'EK421', ref: 'NEU-1', docs: [] },
    ] },
  }
  // Datei (Rechner): kennt die Umbuchung nicht, ist aber neuer
  const datei = { buchungen: { stand: jetzt(30), events: kalender() } }
  const leer = { journal: [], wanderungen: [], eigeneOrte: [], notizen: [], dokumente: [], vorabKosten: [], reisen: [], checkins: [], packliste: {}, vorbereitung: {}, grabsteine: {} }
  const r = fuehreZusammen({ ...leer, ...hier }, { ...leer, ...datei }, { grundwerte: {} })
  const ev = r.ergebnis.buchungen.events
  const alt = ev.find((e) => e.id === 'rk-1')
  p('Die Fassung aus der Datei kommt (sie ist neuer)', !!alt)
  p('Die Buchung bleibt trotzdem umgebucht', !!alt.umgebucht && alt.ersetztDurch === 'eb-neu', JSON.stringify(alt))
  p('Die neue eigene Buchung bleibt erhalten', ev.some((e) => e.id === 'eb-neu'))
  p('Es steht nicht beides gleichzeitig als gültig da', ev.filter((e) => !e.umgebucht && !e.storniert && e.kat === 'flight').length === 1, JSON.stringify(ev.map((e) => [e.id, e.umgebucht || '-'])))

  // Und andersherum: das Storno kommt vom anderen Gerät, hier ist die Fassung neuer
  const hier2 = { buchungen: { stand: jetzt(30), events: kalender() } }
  const datei2 = { buchungen: { stand: jetzt(10), events: kalender({ storniert: jetzt(10), ergaenzt: ['storniert'] }) } }
  const r2 = fuehreZusammen({ ...leer, ...hier2 }, { ...leer, ...datei2 }, { grundwerte: {} })
  const alt2 = r2.ergebnis.buchungen.events.find((e) => e.id === 'rk-1')
  p('Ein Storno vom anderen Gerät kommt mit', !!alt2.storniert, JSON.stringify(alt2))
}

console.log('\nErgänzen: der Untertitel zieht mit')
{
  // Im Untertitel steht dieselbe Angabe nochmal als Text. Genau daraus lesen Kalender, Heute,
  // Wechselzeit und die Nächte. Wer unter Ergänzen die Zeit berichtigt, muss sie überall berichtigt
  // haben, sonst sieht es aus, als wäre nichts übernommen worden.
  aufbauen()
  await speichereVerkehr('flug', { nr: 'QF1810', datum: '2037-01-14', zeit: '11:25', ref: 'F-1', sitz: '14C' }, { id: 'rk-2' })
  const e = termine().find((x) => x.id === 'rk-2')
  p('Die neue Zeit steht im Untertitel', /11:25/.test(e.sub) && !/09:10/.test(e.sub), e.sub)
  p('Die neue Nummer steht im Untertitel', /QF1810/.test(e.sub) && !/QF1808/.test(e.sub), e.sub)
  p('Die Felder stimmen auch', e.zeit === '11:25' && flugNummern(e).join() === 'QF1810', JSON.stringify([e.zeit, e.flugNr, e.flugNrs]))
  p('Der Sitzplatz ist gespeichert', e.sitz === '14C', e.sitz)
  p('Flüge & Bahn fragt die neue Nummer ab', fluegeAusTerminen(termine()).fluege.some((f) => f.nr === 'QF1810' && f.zeit === '11:25'))
  p('Die Wechselzeit nimmt die neue Zeit', wechselZeit({ id: 'et1' }, '2037-01-14', termine())?.zeit === '11:25', JSON.stringify(wechselZeit({ id: 'et1' }, '2037-01-14', termine())))
}

console.log('\nErgänzen: Airline und Ankunft bleiben stehen')
{
  aufbauen()
  buchungen.update((b) => ({ ...b, events: b.events.map((e) => (e.id === 'rk-2'
    ? { ...e, sub: 'Qantas · Abflug 09:10 · Ankunft 12:40 · QF1808' } : e)) }))
  await speichereVerkehr('flug', { nr: 'QF1808', datum: '2037-01-14', zeit: '09:40', ref: 'F-1', sitz: '' }, { id: 'rk-2' })
  const e = termine().find((x) => x.id === 'rk-2')
  p('Nur die Abflugzeit ist ersetzt', e.sub === 'Qantas · Abflug 09:40 · Ankunft 12:40 · QF1808', e.sub)
}

console.log('\nErgänzen: eine falsche Nummer lässt sich entfernen')
{
  aufbauen()
  await speichereVerkehr('flug', { nr: '', datum: '2037-01-14', zeit: '09:10', ref: 'F-1', sitz: '' }, { id: 'rk-2' })
  const e = termine().find((x) => x.id === 'rk-2')
  p('Die Nummer ist aus dem Text raus', !/QF1808/.test(`${e.sub} ${e.titel}`), e.sub)
  p('Sie kommt auch nicht über den Heiler zurück', flugNummern(e).length === 0, JSON.stringify([e.flugNrs, e.ergaenzt]))
  p('Der Flug steht unter „Hier fehlt noch etwas“', fluegeAusTerminen(termine()).ohneNummer.some((x) => x.id === 'rk-2'))
}

console.log('\nUnterkunft ändern: „3 Nächte“ bleibt erhalten')
{
  const gebaut = baueUntertitel('hotel', { zeitVon: '16:00', ort: 'Hafen', anbieter: 'Hotel am Hafen' }, 'start')
  p('Der Hinweis wird mitgenommen', /3\s*Nächte/.test(mitNaechten(gebaut, 'Check-in 15:00 · 3 Nächte')), mitNaechten(gebaut, 'Check-in 15:00 · 3 Nächte'))
  p('Er wird nicht doppelt angehängt', (mitNaechten('Check-in 16:00 · 3 Nächte', 'Check-in 15:00 · 3 Nächte').match(/Nächte/g) || []).length === 1)
  p('Ohne Hinweis bleibt alles wie gebaut', mitNaechten(gebaut, 'Check-in 15:00 · Hafen') === gebaut)
  // Und die Nächte-Übersicht rechnet danach weiter mit drei Nächten statt mit einer
  const eintraege = [{ reise: { id: 'et1', name: 'Südwesten' }, von: '2037-01-10', bis: '2037-01-20' }]
  const hotel = (sub) => ({ stand: '2037-01-01T00:00:00.000Z', events: [
    { id: 'rk-9', quelle: 'reisekalender', kat: 'hotel', datum: '2037-01-12', titel: 'Hotel am Hafen', sub, ref: 'H-9', docs: [] },
  ], persoenlich: [] })
  buchungen.set(hotel(mitNaechten(gebaut, 'Check-in 15:00 · 3 Nächte')))
  const mit = naechteUebersicht({ eintraege, reisen: lies(reisen), events: termine() })
  p('Drei Nächte sind weiter gedeckt', mit.zahl.gebucht === 3, JSON.stringify(mit.zahl))
  buchungen.set(hotel(gebaut))
  const ohne = naechteUebersicht({ eintraege, reisen: lies(reisen), events: termine() })
  p('Ohne den Hinweis wäre es nur eine', ohne.zahl.gebucht === 1, JSON.stringify(ohne.zahl))
}

console.log('\nEtappe der Ausgabe zieht mit der Buchung mit')
{
  // Die Etappe steht bei der Ausgabe als Feld, bei der Buchung wird sie aus dem Datum gerechnet.
  // Beides muss zusammenbleiben, sonst zählt die Kosten-Seite bei der falschen Etappe.
  const zweiEtappen = () => { reisen.set([
    { id: 'et1', typ: 'etappe', name: 'Südwesten', tage: 5, quelle: 'reisekalender' },
    { id: 'et2', typ: 'etappe', name: 'Norden', tage: 6, quelle: 'reisekalender' },
  ]); gesamtStart.set('2037-01-10') }

  aufbauen(); zweiEtappen()
  aendereBuchung(['rk-1'], { datum: '2037-01-18' })
  p('Die Ausgabe hängt jetzt an der neuen Etappe', kosten('k-hotel').reiseId === 'et2', JSON.stringify(kosten('k-hotel')))
  p('Die Buchung selbst liegt dort auch', etappeAm(etappenMitDatum(lies(reisen), lies(gesamtStart)), '2037-01-18')?.reise.id === 'et2')

  // Von Hand anders gesetzt: das bleibt
  aufbauen(); zweiEtappen()
  updateVorabKosten('k-hotel', { reiseId: 'et2' })
  aendereBuchung(['rk-1'], { datum: '2037-01-13' })
  p('Eine von Hand gesetzte Etappe wird nicht überschrieben', kosten('k-hotel').reiseId === 'et2', JSON.stringify(kosten('k-hotel')))

  // Etappe kürzen: die Buchung rutscht in die nächste
  aufbauen(); zweiEtappen()
  updateReise('et1', { tage: 2 })
  p('Kürzere Etappe: die Ausgabe zieht mit', kosten('k-hotel').reiseId === 'et2', JSON.stringify([kosten('k-hotel').reiseId, etappenMitDatum(lies(reisen), lies(gesamtStart)).map((e) => [e.reise.id, e.von, e.bis])]))

  // Buchung ganz aus der Reise heraus: dann steht die Ausgabe ohne Etappe da
  aufbauen(); zweiEtappen()
  aendereBuchung(['rk-1'], { datum: '2037-03-01' })
  p('Buchung außerhalb: die Ausgabe steht ohne Etappe', !kosten('k-hotel').reiseId, JSON.stringify(kosten('k-hotel')))

  // Etappe löschen: die Buchung liegt dann im Zeitraum der nachrutschenden Etappe
  aufbauen(); zweiEtappen()
  loescheReise('et1')
  p('Nach dem Löschen hängt die Ausgabe an der Etappe, die den Tag jetzt deckt', kosten('k-hotel').reiseId === 'et2', JSON.stringify([kosten('k-hotel').reiseId, etappenMitDatum(lies(reisen), lies(gesamtStart)).map((e) => [e.reise.id, e.von, e.bis])]))
}

console.log('\nNeu-Import mit neuen Etappen: alles zieht mit')
{
  // Ein Neu-Import vergibt den Etappen neue IDs. Alles, was an einer Etappe hängt, muss mit:
  // Routen, Logbuchtage, Wanderungen, Ausgaben und Notizen.
  aufbauen()
  notizen.set([]); journal.set([]); wanderungen.set([])
  reisen.set([{ id: 'alt1', typ: 'etappe', name: 'Südwesten', quelle: 'reisekalender', tage: 5, von: '2037-01-10', kalenderVon: '2037-01-10' }])
  updateVorabKosten('k-hotel', { reiseId: 'alt1' })
  neueNotiz('frei', 'Tankstelle in Südwesten merken', 'alt1')
  const kalender = {
    stand: '2037-02-01T00:00:00.000Z', von: '2037-01-10', bis: '2037-01-20',
    events: [
      { id: 'rk-1', quelle: 'reisekalender', kat: 'hotel', datum: '2037-01-12', titel: 'Hotel am Hafen', sub: 'Check-in 15:00', ref: 'H-1', docs: [] },
      { id: 'rk-2', quelle: 'reisekalender', kat: 'flight', datum: '2037-01-14', titel: 'Perth → Broome', sub: 'Abflug 09:10 · QF1808', flugNr: 'QF1808', ref: 'F-1', docs: [] },
    ],
    persoenlich: [],
  }
  importiereReisekalender(kalender, { reisenAnlegen: true })
  const neueEtappen = lies(reisen).filter((r) => r.quelle === 'reisekalender')
  p('Es gibt wieder Etappen aus dem Kalender', neueEtappen.length > 0, JSON.stringify(neueEtappen.map((r) => [r.id, r.name])))
  p('Keine Etappe hat noch die alte Kennung', !lies(reisen).some((r) => r.id === 'alt1'))
  const hotel = kosten('k-hotel')
  p('Die Ausgabe hängt nicht mehr an der alten Etappe', hotel.reiseId !== 'alt1', JSON.stringify(hotel))
  p('Die Ausgabe hängt an der neuen Etappe aus dem Kalender', !!hotel.reiseId && lies(reisen).some((r) => r.id === hotel.reiseId && r.quelle === 'reisekalender'), JSON.stringify([hotel.reiseId, lies(reisen).map((r) => r.id)]))
  const notiz = lies(notizen).find((n) => /Tankstelle/.test(n.text))
  p('Die Notiz zeigt nicht mehr auf die alte Etappe', notiz.etappeId !== 'alt1', JSON.stringify(notiz))
  p('Die Notiz zeigt auf die neue Etappe', !!notiz.etappeId && lies(reisen).some((r) => r.id === notiz.etappeId && r.quelle === 'reisekalender'), JSON.stringify([notiz.etappeId, lies(reisen).map((r) => r.id)]))
  p('Der Notiztext bleibt erhalten', /Tankstelle/.test(notiz.text), notiz.text)
}

console.log('\nEntfernte Nummer bleibt auch nach dem Neu-Import weg')
{
  // Die geleerte Liste steht in `ergaenzt` und ist damit gegen den Kalender geschützt. Sonst käme
  // die falsche Nummer beim nächsten Import einfach wieder.
  aufbauen()
  await speichereVerkehr('flug', { nr: '', datum: '2037-01-14', zeit: '09:10', ref: 'F-1', sitz: '' }, { id: 'rk-2' })
  importiereReisekalender({
    stand: '2037-02-01T00:00:00.000Z', von: '2037-01-10', bis: '2037-01-20',
    events: [
      { id: 'rk-1', quelle: 'reisekalender', kat: 'hotel', datum: '2037-01-12', titel: 'Hotel am Hafen', sub: 'Check-in 15:00', ref: 'H-1', docs: [] },
      { id: 'rk-2', quelle: 'reisekalender', kat: 'flight', datum: '2037-01-14', titel: 'Perth → Broome', sub: 'Abflug 09:10 · QF1808', flugNr: 'QF1808', ref: 'F-1', docs: [] },
    ],
    persoenlich: [],
  }, { reisenAnlegen: false })
  const e = termine().find((x) => x.id === 'rk-2')
  p('Die entfernte Nummer kommt nicht zurück', flugNummern(e).length === 0, JSON.stringify([e.flugNr, e.flugNrs, e.sub, e.ergaenzt]))
  p('Der Flug steht weiter unter „Hier fehlt noch etwas“', fluegeAusTerminen(termine()).ohneNummer.some((x) => x.id === 'rk-2'))
}

console.log('\nErgänzen bei einem Umsteigeflug mit zwei Nummern')
{
  // Wie bei einer echten Buchung: zwei Nummern im Untertitel, die Zeit steht nur dort, kein Feld.
  aufbauen()
  buchungen.update((b) => ({ ...b, events: b.events.map((e) => (e.id === 'rk-2'
    ? { ...e, titel: 'Frankfurt → Melbourne', sub: 'Vietnam Airlines VN36 / VN779 · Abflug 13:55', flugNr: 'VN36', zeit: '' } : e)) }))
  const vor = angabenAus(termine().find((x) => x.id === 'rk-2'))
  p('Die Zeit aus dem Untertitel steht im Formular', vor.zeit === '13:55', JSON.stringify(vor))
  p('Die erste Nummer steht im Formular', vor.nr === 'VN36', JSON.stringify(vor))
  await speichereVerkehr('flug', { ...vor, nr: 'VN43' }, { id: 'rk-2' })
  const e = termine().find((x) => x.id === 'rk-2')
  p('Die berichtigte Nummer gilt, der Anschluss bleibt', flugNummern(e).join() === 'VN43,VN779', JSON.stringify([flugNummern(e), e.sub]))
  p('Die alte Nummer steht auch im Text nicht mehr', !/VN\s?36/.test(`${e.sub} ${e.titel}`), e.sub)
  p('Die Zeit im Text bleibt stehen', /13:55/.test(e.sub), e.sub)
  const abgefragt = fluegeAusTerminen(termine()).fluege.filter((f) => f.terminId === 'rk-2').map((f) => f.nr)
  p('Es werden zwei Flüge abgefragt, nicht drei', abgefragt.join() === 'VN43,VN779', JSON.stringify(abgefragt))
}

console.log('\nUmbuchen: das alte Ticket kommt unter „Erstattung offen“')
{
  aufbauen()
  ersetzeBuchung(['rk-2'], [{ id: 'eb-neu2', quelle: 'eigen', kat: 'flight', datum: '2037-01-15', titel: 'Perth → Darwin', sub: 'Abflug 08:00 · QF1900', flugNr: 'QF1900', flugNrs: ['QF1900'], docs: [] }])
  p('Die Ausgabe bleibt bei der alten Buchung', kosten('k-flug').terminId === 'rk-2', JSON.stringify(kosten('k-flug')))
  p('Sie steht jetzt unter „Erstattung offen“', kosten('k-flug').erstattung === 'offen', JSON.stringify(kosten('k-flug')))
  // Eine schon entschiedene Erstattung wird nicht überschrieben
  aufbauen()
  updateVorabKosten('k-flug', { erstattung: 'keine' })
  ersetzeBuchung(['rk-2'], [{ id: 'eb-neu3', quelle: 'eigen', kat: 'flight', datum: '2037-01-15', titel: 'Perth → Darwin', flugNr: 'QF1901', flugNrs: ['QF1901'], docs: [] }])
  p('Eine entschiedene Erstattung bleibt, wie sie ist', kosten('k-flug').erstattung === 'keine', JSON.stringify(kosten('k-flug')))
}

console.log('\nZeit berichtigen, wenn sie ohne Wort im Text steht')
{
  const flug = { sub: 'Beispiel Air ZZ471 · 21:35 · 7C', flugNr: 'ZZ471', flugNrs: ['ZZ471'], zeit: '21:35', titel: 'Exmouth → Karratha' }
  const a = textNachziehen(flug, 'flug', { zeit: '06:05', sitz: '7C' }, 'ZZ471')
  p('Die bloße Zeit im Text zieht mit', a.sub === 'Beispiel Air ZZ471 · 06:05 · 7C', JSON.stringify(a))
  const zug = { sub: 'ICE 100 · 17:05', zugNr: 'ICE100', zeit: '17:05', kat: 'train' }
  p('Beim Zug ebenso', textNachziehen(zug, 'zug', { zeit: '18:10' }, 'ICE100').sub === 'ICE 100 · 18:10', JSON.stringify(textNachziehen(zug, 'zug', { zeit: '18:10' }, 'ICE100')))
  const beides = textNachziehen(flug, 'flug', { zeit: '06:05' }, 'ZZ478')
  p('Nummer und Zeit zusammen', beides.sub === 'Beispiel Air ZZ478 · 06:05 · 7C', JSON.stringify(beides))
  p('Gleiche Zeit ändert nichts', textNachziehen(flug, 'flug', { zeit: '21:35' }, 'ZZ471').sub === undefined, JSON.stringify(textNachziehen(flug, 'flug', { zeit: '21:35' }, 'ZZ471')))
}

console.log('\nEine Ankunftszeit wird nie für die Abfahrt gehalten')
{
  const an = { sub: 'Ankunft 12:55 · EK 59 · Emirates', flugNr: 'EK 59', flugNrs: ['EK59'], zeit: '' }
  const a = textNachziehen(an, 'flug', { zeit: '22:20' }, 'EK59')
  p('Die Ankunft bleibt stehen', /Ankunft 12:55/.test(a.sub || ''), JSON.stringify(a))
  p('Die Abfahrt kommt dazu', /Abflug 22:20/.test(a.sub || ''), JSON.stringify(a))
  const fremd = { sub: '22:50 Uhr (Ortszeit)', zeit: '' }
  p('Eine fremde Zeit im Text wird nicht angefasst', textNachziehen(fremd, 'flug', { zeit: '09:00' }, '').sub === undefined, JSON.stringify(textNachziehen(fremd, 'flug', { zeit: '09:00' }, '')))
}

console.log('\nZeit leeren: sie darf nicht aus dem Text zurückkommen')
{
  const flug = { sub: 'Qatar Airways QR901 · Abflug 22:45', flugNr: 'QR901', flugNrs: ['QR901'], zeit: '22:45' }
  const a = textNachziehen(flug, 'flug', { zeit: '' }, 'QR901')
  p('Der beschriftete Text geht mit weg', a.sub === 'Qatar Airways QR901', JSON.stringify(a))
  p('Beim nächsten Öffnen steht das Feld leer', angabenAus({ ...flug, zeit: '', sub: a.sub }).zeit === '', JSON.stringify(angabenAus({ ...flug, zeit: '', sub: a.sub })))
  const bar = { sub: 'Beispiel Air ZZ471 · 21:35 · 7C', flugNr: 'ZZ471', flugNrs: ['ZZ471'], zeit: '21:35' }
  p('Auch die bloße Zeit geht mit weg', textNachziehen(bar, 'flug', { zeit: '' }, 'ZZ471').sub === 'Beispiel Air ZZ471 · 7C', JSON.stringify(textNachziehen(bar, 'flug', { zeit: '' }, 'ZZ471')))
  const spanne = { sub: 'Virgin Australia VA1293 · 08:35 → 11:05', flugNr: 'VA1293', flugNrs: ['VA1293'], zeit: '' }
  p('Eine Zeitspanne bleibt unangetastet', textNachziehen(spanne, 'flug', { zeit: '' }, 'VA1293').sub === undefined, JSON.stringify(textNachziehen(spanne, 'flug', { zeit: '' }, 'VA1293')))
}

console.log('\nDer ganze Weg am Termin mit bloßer Zeit')
{
  aufbauen()
  buchungen.update((b) => ({ ...b, events: [...b.events, { id: 'rk-9', quelle: 'reisekalender', kat: 'flight', datum: '2037-01-15',
    titel: 'Exmouth → Karratha', sub: 'Beispiel Air ZZ471 · 21:35 · 7C', flugNr: 'ZZ471', zeit: '21:35', sitz: '7C', ref: 'ZZTEST', docs: [] }] }))
  const vorher = angabenAus(termine().find((e) => e.id === 'rk-9'))
  p('Das Formular zeigt die vorhandene Zeit', vorher.zeit === '21:35', JSON.stringify(vorher))
  await speichereVerkehr('flug', { ...vorher, zeit: '06:05', nr: 'ZZ478' }, { id: 'rk-9' })
  const e = termine().find((x) => x.id === 'rk-9')
  p('Der Termin trägt die neue Zeit', e.zeit === '06:05', JSON.stringify(e))
  p('Der Text trägt sie auch', e.sub === 'Beispiel Air ZZ478 · 06:05 · 7C', e.sub)
  p('Die alte Zeit steht nirgends mehr', !/21:35/.test(`${e.sub} ${e.titel}`), e.sub)
  p('Wechselzeit und Nächte rechnen mit der neuen Zeit', terminZeit(e) === '06:05', terminZeit(e))
  const f = fluegeAusTerminen(termine()).fluege.find((x) => x.terminId === 'rk-9')
  p('Die Abfrage nimmt neue Nummer und Zeit', !!f && f.nr === 'ZZ478' && f.zeit === '06:05', JSON.stringify(f))
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
