// PDF-Portfolios öffnen (lib/pdf-portfolio.js): Outlook mit Adobe PDFMaker legt Mails als Hülle
// ab, das iPhone zeigt davon nur „bitte in Acrobat öffnen“. Hier gebaute Test-PDFs, ausgedacht.
// Ausführen: node tests/pdf-portfolio.test.mjs
import zlib from 'node:zlib'
import { leseHuelle, zumAnzeigen, stroeme } from '../src/lib/pdf-portfolio.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const enc = (s) => Buffer.from(s, 'latin1')
const innen = (text) => enc(`%PDF-1.7\n1 0 obj <</Type/Catalog>> endobj\n% ${text}\n%%EOF\n`)
// Ein PDF aus Teilen zusammensetzen: Teile sind Text oder { nr, dict, daten }
function pdf(teile) {
  const out = [enc('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')]
  for (const x of teile) {
    if (typeof x === 'string') out.push(enc(x + '\n'))
    else out.push(enc(`${x.nr} 0 obj\n${x.dict}\nstream\r\n`), x.daten, enc('\r\nendstream\nendobj\n'))
  }
  out.push(enc('trailer <</Root 1 0 R>>\n%%EOF\n'))
  return new Uint8Array(Buffer.concat(out))
}
const text = async (blob) => Buffer.from(await blob.arrayBuffer()).toString('latin1')

console.log('\n1  Portfolio wie von PDFMaker: Katalog und Dateibeschreibung komprimiert, Typ fehlt')
{
  const objStm = zlib.deflateSync(enc('1 0 2 40 <</Type/Catalog/Collection<</View/D>>/Names 3 0 R>> <</Type/Filespec/UF(Mail.pdf)/EF<</F 7 0 R/UF 7 0 R>>>>'))
  const mail = innen('Danke für Ihre Buchung, Testbeleg')
  const datei = zlib.deflateSync(mail)
  const b = pdf([
    { nr: 9, dict: `<</Filter/FlateDecode/First 10/Length ${objStm.length}/N 2/Type/ObjStm>>`, daten: objStm },
    '4 0 obj <</Type/Page/Contents 5 0 R>> endobj',
    { nr: 5, dict: '<</Filter/FlateDecode/Length 12>>', daten: zlib.deflateSync(enc('BT (Acrobat) ET')).subarray(0, 12) },
    { nr: 7, dict: `<</DL ${mail.length}/Filter/FlateDecode/Length 8 0 R/Params<</Size ${mail.length}/CheckSum<00>>>>>`, daten: datei },
    `8 0 obj ${datei.length} endobj`,
  ])
  p('Datenströme gefunden, mit Objektnummer', stroeme(b).map((s) => s.nr).join() === '9,5,7', stroeme(b).map((s) => s.nr).join())
  const h = await leseHuelle(b)
  p('als Portfolio erkannt (/Collection im Objektstrom)', h.portfolio)
  p('die eingebettete Mail herausgeholt, Byte für Byte', h.dateien.length === 1 && h.dateien[0].istPdf && Buffer.compare(Buffer.from(h.dateien[0].bytes), mail) === 0)
  const a = await zumAnzeigen(new Blob([b], { type: 'application/pdf' }))
  p('beim Öffnen kommt die Mail, nicht die Hülle', a.art === 'datei' && (await text(a.blob)).includes('Danke für Ihre Buchung') && a.blob.type === 'application/pdf')
}

console.log('\n2  Andere PDFs bleiben, wie sie sind')
{
  const normal = pdf(['1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj', { nr: 3, dict: '<</Length 5>>', daten: enc('BT ET') }])
  const a = await zumAnzeigen(new Blob([normal], { type: 'application/pdf' }))
  p('normales PDF: unverändert', a.art === 'datei' && a.blob.size === normal.length)
  const anhang = pdf(['1 0 obj <</Type/Catalog/Names<</EmbeddedFiles 2 0 R>>>> endobj', '2 0 obj <</Type/Filespec/EF<</F 3 0 R>>>> endobj', { nr: 3, dict: '<</Type/EmbeddedFile/Length 20>>', daten: innen('x').subarray(0, 20) }])
  p('PDF mit Anhang, aber keine Hülle: unverändert', (await zumAnzeigen(new Blob([anhang], { type: 'application/pdf' }))).blob.size === anhang.length)
  const foto = new Blob([Buffer.from([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
  p('Foto: unverändert', (await zumAnzeigen(foto)).blob === foto)
  const kaputt = new Blob([enc('%PDF-1.7\n1 0 obj <</Collection<<>>>> endobj\n2 0 obj <</Type/EmbeddedFile/Filter/FlateDecode/Length 4>>\nstream\nabcd\nendstream\n')], { type: 'application/pdf' })
  const ka = await zumAnzeigen(kaputt)
  p('kaputter Datenstrom: die Hülle öffnet wie bisher, kein Fehler', ka.art === 'datei' && ka.blob === kaputt)
  p('kein PDF: nichts', (await leseHuelle(enc('Hallo'))).dateien.length === 0)
}

console.log('\n3  Portfolio mit mehreren Dokumenten')
{
  const d1 = innen('Mail'), d2 = innen('Anhang Ticket')
  const b = pdf([
    '1 0 obj <</Type/Catalog/Collection<<>>>> endobj',
    '2 0 obj <</Type/Filespec/EF<</F 3 0 R>>>> endobj',
    '4 0 obj <</Type/Filespec/EF<</F 5 0 R>>>> endobj',
    { nr: 3, dict: `<</Type/EmbeddedFile/Length ${d1.length}>>`, daten: d1 },
    { nr: 5, dict: `<</Filter/FlateDecode/Length ${zlib.deflateSync(d2).length}>>`, daten: zlib.deflateSync(d2) },
    '6 0 obj <</Type/Filespec/EF<</F 7 0 R>>>> endobj',
    { nr: 7, dict: '<</Type/EmbeddedFile/Length 4>>', daten: enc('Text') },
  ])
  const a = await zumAnzeigen(new Blob([b], { type: 'application/pdf' }))
  p('zwei PDFs darin: Auswahl, kein Nicht-PDF', a.art === 'liste' && a.dateien.length === 2 && (await text(a.dateien[1])).includes('Anhang Ticket'))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
