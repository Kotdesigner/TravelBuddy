// Belege selbst zuordnen: Vorschlag aus dem Dateinamen, Speicherpfad, Anhängen und
// Abnehmen am Termin, Erhalt beim Neu-Import des Reisekalenders (lib/belege.js).
// Ausführen: node tests/belege-zuordnen.test.mjs
//
// Hintergrund (29.10.2026): Dateien, die die App nicht selbst erkannte, verwarf sie still.
// Aus einem Ordner am iPhone kam so scheinbar nichts an. Jetzt kommen sie in eine Maske.
// Alle Termine hier sind ausgedacht.
import { schlageZielVor, eigenerPfad, belegLabel, haengeBelegeAn, nimmBelegAb, eigeneBelegeUebernehmen, istBildDatei, kameraName, ordneZu, pfadHash } from '../src/lib/belege.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

const events = [
  { id: 'rk-1', datum: '2038-05-03', kat: 'flight', titel: 'Frankfurt → Singapur', sub: 'SQ 325', ref: 'K7PL2Q', docs: [{ label: 'E-Ticket', datei: 'Flug/eticket.pdf', art: 'doc' }] },
  { id: 'rk-2', datum: '2038-05-04', kat: 'flight', titel: 'Singapur → Perth', sub: 'SQ 223', ref: 'K7PL2Q', docs: [] },
  { id: 'rk-3', datum: '2038-05-04', kat: 'hotel', titel: 'Check-in Seaside Hotel', sub: 'Perth', ref: '4471902', docs: [] },
  { id: 'rk-4', datum: '2038-05-07', kat: 'hotel', titel: 'Check-out Seaside Hotel', sub: 'Perth', ref: '4471902', docs: [] },
  { id: 'rk-5', datum: '2038-05-07', kat: 'camper', titel: 'Übernahme Camper', sub: 'Apollo Perth', ref: 'AP-88123', docs: [] },
  { id: 'rk-6', datum: '2038-05-12', kat: 'train', titel: 'Indian Pacific', sub: 'Perth → Adelaide', ref: '', docs: [] },
  { id: 'rk-7', datum: '2038-05-09', kat: '', titel: 'Roadtrip', platzhalter: true, docs: [] },
]

console.log('\nVorschlag aus dem Dateinamen')
p('Buchungsnummer im Namen → Hotel (Check-in, nicht Check-out)', schlageZielVor('Bestaetigung_4471902.pdf', events) === 'rk-3', schlageZielVor('Bestaetigung_4471902.pdf', events))
p('Ortsname im Namen → Hotel', schlageZielVor('Hotel – Seaside – Buchungsbestätigung.pdf', events) === 'rk-3')
p('Zugname im Namen → Bahn', schlageZielVor('Indian_Pacific_Ticket.pdf', events) === 'rk-6')
p('Vermieter im Namen → Camper', schlageZielVor('Apollo Voucher.pdf', events) === 'rk-5')
p('nur „Buchungsbestätigung“ → kein Vorschlag', schlageZielVor('Buchungsbestätigung.pdf', events) === '')
p('zwei Flüge einer Buchung (gleiche Nummer) → der erste', schlageZielVor('Singapur.pdf', events) === 'rk-1')
const ohneNummer = events.map((e) => ({ ...e, ref: '' }))
p('zwei verschiedene Buchungen mit „Singapur“ → kein Raten', schlageZielVor('Singapur.pdf', ohneNummer) === '')
p('Ziel „Perth“ allein passt auf mehrere Buchungen → kein Vorschlag', schlageZielVor('Perth.pdf', events) === '')
p('Platzhaltertage werden nie vorgeschlagen', schlageZielVor('Roadtrip.pdf', events) === '')
p('leere Terminliste → kein Vorschlag', schlageZielVor('Seaside.pdf', []) === '')

console.log('\nSpeicherpfad und Anzeigename')
p('Pfad unter eigen/<Termin>/', eigenerPfad('rk-3', 'Rechnung.pdf') === 'eigen/rk-3/Rechnung.pdf')
p('belegter Pfad → „Name (2).pdf“', eigenerPfad('rk-3', 'Rechnung.pdf', new Set(['eigen/rk-3/Rechnung.pdf'])) === 'eigen/rk-3/Rechnung (2).pdf')
p('dritter Gleichstand → „(3)“', eigenerPfad('rk-3', 'Rechnung.pdf', new Set(['eigen/rk-3/Rechnung.pdf', 'eigen/rk-3/Rechnung (2).pdf'])) === 'eigen/rk-3/Rechnung (3).pdf')
p('Schrägstrich im Namen bricht den Pfad nicht', eigenerPfad('rk-3', 'a/b.pdf') === 'eigen/rk-3/a-b.pdf')
p('Umlaute einheitlich (NFC)', eigenerPfad('rk-3', 'Bestätigung.pdf'.normalize('NFD')) === 'eigen/rk-3/' + 'Bestätigung.pdf'.normalize('NFC'))
p('Anzeigename ohne Endung, Unterstriche als Leerzeichen', belegLabel('Indian_Pacific__Ticket.pdf') === 'Indian Pacific Ticket')
p('Anzeigename höchstens 60 Zeichen', belegLabel('x'.repeat(90) + '.pdf').length === 60)

console.log('\nAnhängen und Abnehmen')
const topf = { stand: '2026-10-01T00:00:00.000Z', von: '2038-05-03', bis: '2038-05-12', events, persoenlich: [{ id: 'rkp-pass', label: 'Reisepass', datei: 'Privat/pass.pdf' }] }
const neu = haengeBelegeAn(topf, [
  { ziel: 'rk-3', label: 'Rechnung', datei: 'eigen/rk-3/Rechnung.pdf' },
  { ziel: 'persoenlich', label: 'Versicherung', datei: 'eigen/persoenlich/Versicherung.pdf' },
  { ziel: '', label: 'ohne Ziel', datei: 'x.pdf' },
], () => 'abc')
const hotel = neu.events.find((e) => e.id === 'rk-3')
p('Beleg hängt am Termin, mit eigen: true', hotel.docs.length === 1 && hotel.docs[0].eigen === true && hotel.docs[0].label === 'Rechnung')
p('Eigenes Dokument kommt zu den persönlichen', neu.persoenlich.length === 2 && neu.persoenlich[1].eigen && neu.persoenlich[1].id === 'ep-abc')
p('Eintrag ohne Ziel wird übergangen', neu.events.every((e) => !(e.docs || []).some((d) => d.datei === 'x.pdf')))
p('Stand rückt vor (Zusammenführen sieht die neuere Fassung)', neu.stand > topf.stand)
p('Kalender-Belege bleiben, alter Topf unverändert', neu.events[0].docs.length === 1 && topf.events[2].docs.length === 0)
p('ohne Buchungen: leerer Topf wird angelegt', haengeBelegeAn(null, [{ ziel: 'persoenlich', label: 'Pass', datei: 'eigen/persoenlich/p.pdf' }]).persoenlich.length === 1)
p('leere Liste ändert nichts', haengeBelegeAn(topf, []) === topf)

const ab = nimmBelegAb(neu, 'eigen/rk-3/Rechnung.pdf')
p('Abnehmen entfernt den eigenen Beleg', ab.events.find((e) => e.id === 'rk-3').docs.length === 0)
const ab2 = nimmBelegAb(neu, 'Flug/eticket.pdf')
p('Kalender-Beleg lässt sich so nicht abnehmen', ab2.events[0].docs.length === 1)
p('Abnehmen bei den persönlichen Dokumenten', nimmBelegAb(neu, 'eigen/persoenlich/Versicherung.pdf').persoenlich.length === 1)

console.log('\nNeu-Import des Reisekalenders')
const neuImport = events.map((e) => ({ ...e, docs: [...(e.docs || [])] }))
neuImport.find((e) => e.id === 'rk-4').titel = 'Check-out Seaside Hotel (geändert)'
const nach = eigeneBelegeUebernehmen(neu.events, neuImport)
p('Eigener Beleg bleibt am Termin mit derselben ID', nach.find((e) => e.id === 'rk-3').docs.some((d) => d.datei === 'eigen/rk-3/Rechnung.pdf'))
p('Kalender-Belege kommen aus dem neuen Import, nicht doppelt', nach[0].docs.length === 1)
p('ohne eigene Belege: neue Termine unverändert zurück', eigeneBelegeUebernehmen(events, neuImport) === neuImport)
const zweimal = eigeneBelegeUebernehmen(neu.events, nach)
p('zweimal übernommen → trotzdem nur einmal', zweimal.find((e) => e.id === 'rk-3').docs.length === 1)
p('Termin, den es nicht mehr gibt: nichts bricht', eigeneBelegeUebernehmen(neu.events, neuImport.filter((e) => e.id !== 'rk-3')).length === neuImport.length - 1)

console.log('\nFotos vom Ticket (seit 29.10.2026)')
{
  const f = (name, type = '', size = 1000) => ({ name, type, size, webkitRelativePath: '' })
  p('Foto erkannt an Typ oder Endung', istBildDatei(f('IMG_1.jpeg', 'image/jpeg')) && istBildDatei(f('scan.HEIC')) && istBildDatei(f('x.png', '')) && istBildDatei(f('ohne', 'image/webp')))
  p('PDF ist kein Foto', !istBildDatei(f('Ticket.pdf', 'application/pdf')) && !istBildDatei(f('Ticket.pdf')) && !istBildDatei(null))
  const kamera = ['IMG_1234.jpeg', 'IMG_1234 (2).JPG', 'image.jpg', 'PXL_20371205_101530.jpg', 'Screenshot 2037-12-05 at 10.15.32.png', 'Bildschirmfoto 2037-12-05 um 10.15.32.png', 'Foto 12.12.26, 09 14 03.jpg']
  p('Kameranamen sagen nichts über den Beleg', kamera.every(kameraName), kamera.filter((n) => !kameraName(n)).join(' | '))
  const sprechend = ['Foto Qantas Ticket.jpg', 'Bild vom Hotel Broome.png', 'Imgur Export.png', 'Boarding QF123.jpg', 'Eintritt Rottnest.heic']
  p('sprechende Namen bleiben', sprechend.every((n) => !kameraName(n)), sprechend.filter(kameraName).join(' | '))
  // Ein Foto, das zufällig genau so groß ist wie ein PDF aus dem Kalender: mit Größentabelle
  // landete es dort. Deshalb gibt die Oberfläche Fotos ohne Größentabelle an ordneZu.
  const pfade = ['Flug/QF_Bestaetigung.pdf', 'Hotel/Buchung.pdf']
  const groessen = { [pfadHash('Hotel/Buchung.pdf')]: 4242 }
  const foto = f('IMG_0001.jpeg', 'image/jpeg', 4242)
  p('Gefahr: über die Größe allein hinge das Foto am Hotel', ordneZu([foto], pfade, groessen).zugeordnet[0]?.pfad === 'Hotel/Buchung.pdf')
  const ohneGroesse = ordneZu([foto], pfade, null)
  p('ohne Größentabelle kommt es in die Liste zum selbst Zuordnen', ohneGroesse.zugeordnet.length === 0 && ohneGroesse.unbekannt.length === 1)
  p('Foto mit dem Namen eines Kalender-Belegs wird weiter erkannt', ordneZu([f('Ticket.jpg', 'image/jpeg', 9)], ['Bahn/Ticket.jpg'], null).zugeordnet[0]?.pfad === 'Bahn/Ticket.jpg')
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
