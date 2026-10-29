// Reisebericht zum Teilen: keine privaten Felder, HTML sauber maskiert, Größe begrenzt.
// Ausführen: node tests/reisebericht.test.mjs
import { berichtModell, baueBerichtHtml, entschaerfe, esc, fotosZurAuswahl, dateiName, MAX_BYTES } from '../src/lib/reisebericht.js'
import { etappenMitDatum } from '../src/lib/plan.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const jpeg = (n, laenge = 40) => 'data:image/jpeg;base64,' + (String(n).replace(/[^A-Za-z0-9]/g, 'x') + 'A'.repeat(laenge)).slice(0, Math.max(laenge, 4))
const png = 'data:image/png;base64,iVBORw0KGgo='

// Testdaten mit allem, was NICHT hinein darf
const REISEN = [
  {
    id: 'E1', typ: 'etappe', name: 'Perth & <Süden>', von: '2037-11-30', tage: 5, farbe: '#aa3300',
    buchungsnummer: 'ABX778812', kosten: 1234.56, notiz: 'Notfallkontakt Mama 0049 171 5550123',
    stops: [{ name: 'Perth', lat: -31.9523, lon: 115.8613 }, { name: 'Pinnacles Lodge', lat: -30.6061, lon: 115.1592, unterkunft: true, buchung: 'HTL-99881' }],
    route: { km: 200, geometry: [[115.8613, -31.9523], [115.1592, -30.6061]] },
  },
  { id: 'R1', typ: 'route', etappeId: 'E1', name: 'Süd <script>alert(1)</script>', stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Albany "Hafen"', lat: -35.0228, lon: 117.8814 }] },
  { id: 'E2', typ: 'etappe', name: 'Broome', art: 'flug', von: '2037-12-10', tage: 3, stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Broome', lat: -17.9614, lon: 122.2359 }] },
]
const JOURNAL = [
  { id: 'j1', datum: '2037-12-01', ort: 'Fremantle', lat: -32.0569, lon: 115.7439, text: 'Toller Tag. Buchungsnr. QF55X12 nicht vergessen, Tel. +61 412 345 678, mail an a.b@example.org', fotos: [jpeg('a'), jpeg('b')], felder: { kosten_unterkunft: 189, kosten_essen: 42 }, audios: ['data:audio/mp4;base64,AAAA'] },
  { id: 'j2', datum: '2037-12-03', ort: 'Lancelin', text: 'Sanddünen <b>riesig</b> & windig', fotos: [jpeg('c')], felder: { distance_km: 120 } },
  { id: 'j3', datum: '2037-12-11', ort: 'Cable Beach', text: 'Kamele bei Sonnenuntergang', fotos: [jpeg('d')] },
  { id: 'j4', datum: '2038-01-20', ort: 'Geheim', text: 'außerhalb', fotos: [jpeg('e')] },
]
const START = '2037-11-29'

console.log('\n1  Escaping')
p('esc maskiert < > & " \'', esc(`<a href="x">'&'</a>`) === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
p('esc mit null', esc(null) === '' && esc(undefined) === '')

console.log('\n2  Entschärfen von Freitext')
p('Buchungsnummer mit Stichwort', !entschaerfe('Buchungsnr. QF55X12 merken').includes('QF55X12'))
p('Booking ref', !entschaerfe('Booking ref: 4711-0815').includes('4711'))
p('Bestätigungsnummer', !entschaerfe('Bestätigungsnummer AB12CD34').includes('AB12CD34'))
p('Code ohne Stichwort', !entschaerfe('Code QF1234X9 am Schalter').includes('QF1234X9'))
p('Telefonnummer', !entschaerfe('Ruf an: +61 412 345 678').includes('412'))
p('Mailadresse', !entschaerfe('schreib an a.b@example.org bitte').includes('example.org'))
p('normale Sätze bleiben', entschaerfe('Wir fuhren 412 km nach Albany, 4WD nötig.') === 'Wir fuhren 412 km nach Albany, 4WD nötig.')
p('Datum bleibt', entschaerfe('am 2037-12-03 und 29.11.2037') === 'am 2037-12-03 und 29.11.2037')
p('Wörter wie „Referendum“ bleiben', entschaerfe('Referendum heute').includes('Referendum'))

console.log('\n3  Modell: nur erlaubte Felder')
const modell = berichtModell({ reisen: REISEN, journal: JOURNAL, gesamtStart: START, mitTexten: false, fotoIds: ['j1:0', 'j2:0', 'j3:0', 'j4:0'] })
{
  const json = JSON.stringify(modell)
  p('2 Etappen', modell.etappen.length === 2)
  p('keine Koordinaten', !/-31\.95|115\.86|-30\.60|115\.15|lat|lon/.test(json), json.match(/lat|lon|-31\.9/)?.[0])
  p('keine Buchungsnummern', !json.includes('ABX778812') && !json.includes('HTL-99881') && !json.includes('QF55X12'))
  p('keine Kosten', !json.includes('1234.56') && !json.includes('189') && !/kosten/i.test(json))
  p('keine Notfallkontakte', !json.includes('Mama') && !json.includes('5550123'))
  p('keine Audios', !json.includes('audio'))
  p('ohne Häkchen keine Tagebuchtexte', modell.etappen.every((e) => e.eintraege.length === 0) && !json.includes('Toller Tag'))
  p('Routen mit Stoppnamen', modell.etappen[0].routen.some((r) => r.stopps.includes('Albany "Hafen"')))
  p('Orte als Namen', modell.etappen[0].orte.includes('Fremantle') && modell.etappen[0].orte.includes('Pinnacles Lodge'))
  p('Foto außerhalb der Etappen nicht dabei', !modell.etappen.some((e) => e.fotos.some((f) => f.id === 'j4:0')))
  p('nur ausgewählte Fotos', modell.etappen[0].fotos.map((f) => f.id).join() === 'j1:0,j2:0')
  p('Zeitraum und Tage', modell.von === '2037-11-30' && modell.bis === '2037-12-12' && modell.tage === 13)
}
{
  const m = berichtModell({ reisen: REISEN, journal: JOURNAL, gesamtStart: START, mitTexten: true })
  const json = JSON.stringify(m)
  p('mit Häkchen: Texte dabei', json.includes('Sanddünen') && json.includes('Kamele'))
  p('mit Texten: Codes, Telefon, Mail trotzdem entfernt', !json.includes('QF55X12') && !json.includes('412 345') && !json.includes('example.org'))
}
{
  const m = berichtModell({ reisen: REISEN, journal: JOURNAL, gesamtStart: START, etappenIds: ['E2'] })
  p('Auswahl: nur gewählte Etappe', m.etappen.length === 1 && m.etappen[0].name === 'Broome')
  p('Auswahl: Zeitraum der gewählten Etappe', m.von === '2037-12-10' && m.tage === 3)
}
{
  const etappen = etappenMitDatum(REISEN, START)
  const f = fotosZurAuswahl(JOURNAL, etappen)
  p('Fotos zur Auswahl: 4 im Reisezeitraum', f.length === 4 && f.every((x) => x.etappeId))
}

console.log('\n4  HTML')
{
  const m = berichtModell({ reisen: REISEN, journal: JOURNAL, gesamtStart: START, mitTexten: true, fotoIds: ['j1:0', 'j3:0'] })
  const r = baueBerichtHtml(m, { kugeln: { gesamt: png, E1: png, E2: 'javascript:alert(1)' }, erstellt: '2037-10-11' })
  const h = r.html
  p('vollständiges Dokument', h.startsWith('<!doctype html>') && h.includes('</html>'))
  p('kein Skript', !/<script/i.test(h) && !/javascript:/i.test(h) && !/\son\w+=/i.test(h))
  p('Content-Security-Policy ohne Skripte und ohne Netz', h.includes("default-src 'none'") && !h.includes('script-src'))
  p('Routenname mit <script> maskiert', h.includes('Süd &lt;script&gt;alert(1)&lt;/script&gt;'))
  p('Etappenname mit < und & maskiert', h.includes('Perth &amp; &lt;Süden&gt;'))
  p('Anführungszeichen maskiert', h.includes('Albany &quot;Hafen&quot;'))
  p('HTML im Tagebuchtext maskiert', h.includes('&lt;b&gt;riesig&lt;/b&gt;') && !h.includes('<b>riesig</b>'))
  p('keine Koordinaten im HTML', !/-31\.95|115\.86|-35\.02|117\.88|122\.23/.test(h))
  p('keine Buchungsnummer, Kosten, Notfall', !h.includes('ABX778812') && !h.includes('HTL-99881') && !h.includes('1234') && !h.includes('Mama'))
  p('Weltkugeln eingebettet, ungültige Bild-URL verworfen', (h.match(/data:image\/png/g) || []).length === 2)
  p('Fotos eingebettet', r.fotosDrin === 2 && (h.match(/data:image\/jpeg/g) || []).length === 2)
  p('ohne Schrift: System-Serif', h.includes('Georgia') && !h.includes('@font-face'))
  p('mit Schrift: als data-URL', baueBerichtHtml(m, { schrift: 'data:font/woff2;base64,d09GMgABAAAA' }).html.includes("src:url(data:font/woff2;base64,d09GMgABAAAA)"))
  p('fremde Schrift-URL verworfen', !baueBerichtHtml(m, { schrift: 'https://example.org/x.woff2' }).html.includes('example.org'))
  p('Größe gemessen', r.bytes === new TextEncoder().encode(h).length)
  p('Dateiname', dateiName(m) === 'Reisebericht_Western-Australia_2037-11.html', dateiName(m))
}

console.log('\n5  Größenbegrenzung')
{
  const viele = JOURNAL.map((j) => ({ ...j, fotos: (j.fotos || []).map((_, i) => jpeg(j.id + i, 300_000)) }))
  const ids = viele.flatMap((j) => j.fotos.map((_, i) => `${j.id}:${i}`))
  const m = berichtModell({ reisen: REISEN, journal: viele, gesamtStart: START, fotoIds: ids })
  const grenze = 700_000
  const r = baueBerichtHtml(m, { kugeln: { gesamt: png }, maxBytes: grenze })
  p('bleibt unter der Grenze', r.bytes <= grenze, `${r.bytes} > ${grenze}`)
  p('Fotos weggelassen und gemeldet', r.fotosWeg > 0 && r.fotosDrin + r.fotosWeg === 4, JSON.stringify({ drin: r.fotosDrin, weg: r.fotosWeg }))
  p('so viele Fotos wie möglich behalten', r.fotosDrin === 2, String(r.fotosDrin))
  p('erst Fotos, Kugeln bleiben', !r.ohneKugeln)
  const ohne = baueBerichtHtml(m, { maxBytes: MAX_BYTES })
  p('Standardgrenze 8 MB: alles passt', ohne.fotosWeg === 0 && ohne.bytes < MAX_BYTES)
  const klein = baueBerichtHtml(m, { kugeln: { gesamt: 'data:image/png;base64,' + 'A'.repeat(50_000) }, maxBytes: 20_000 })
  p('reicht es nicht: auch Kugeln weg', klein.ohneKugeln && klein.fotosDrin === 0 && klein.bytes <= 20_000, String(klein.bytes))
  const fotoSrc = new Map(ids.map((id) => [id, jpeg('klein' + id, 1000)]))
  const verkl = baueBerichtHtml(m, { fotoSrc, maxBytes: grenze })
  p('verkleinerte Fotos werden genommen', verkl.fotosDrin === 4 && verkl.bytes < 100_000)
}

console.log('\n6  Fotos fürs Tagebuch vom Gerät (nur Angaben, Bilddaten kommen verkleinert über fotoSrc)')
{
  // Angaben wie in tagebuch-fotos.js, ausgedacht; Koordinaten dürfen nie in den Bericht
  const GERAET = [
    { id: 'g1', datum: '2037-12-01', zeit: '2037-12-01T18:00:00+08:00', ort: 'Fremantle', lat: -32.0569, lon: 115.7439, name: 'IMG_0001.HEIC', quelle: 'IMG_0001.HEIC|1|2' },
    { id: 'g2', datum: '2037-12-11', ort: 'Ruf an: +61 412 345 678', lat: -17.9614, lon: 122.2359, name: 'IMG_0002.HEIC' },
    { id: 'g3', datum: '2038-01-20', ort: 'Geheim', name: 'IMG_0003.HEIC' },
  ]
  const etappen = etappenMitDatum(REISEN, START)
  const f = fotosZurAuswahl(JOURNAL, etappen, GERAET)
  const g = f.filter((x) => x.geraetId)
  p('Gerätefotos im Reisezeitraum zur Auswahl', g.length === 2 && g.map((x) => x.id).join() === 'g:g1,g:g2')
  p('ohne src, mit Etappe, Ort entschärft', g.every((x) => x.src === '' && x.etappeId) && !g[1].ort.includes('412'))
  p('keine Koordinaten, kein Dateiname, keine Quelle', !/-32\.05|115\.74|-17\.96|122\.23|IMG_|quelle|lat|lon/.test(JSON.stringify(g)))
  p('ohne Gerätefotos wie bisher', fotosZurAuswahl(JOURNAL, etappen).length === 4)
  const m = berichtModell({ reisen: REISEN, journal: JOURNAL, gesamtStart: START, fotoIds: ['j1:0', 'g:g1', 'g:g2', 'g:g3'], geraetFotos: GERAET })
  p('ausgewählte Gerätefotos im Modell, mit geraetId', m.etappen[0].fotos.map((x) => x.id).join() === 'j1:0,g:g1' && m.etappen[0].fotos[1].geraetId === 'g1' && m.etappen[1].fotos[0]?.id === 'g:g2')
  p('Logbuch-Fotos ohne geraetId', !('geraetId' in m.etappen[0].fotos[0]))
  p('keine Koordinaten im Modell', !/-32\.05|115\.74|-17\.96|122\.23/.test(JSON.stringify(m)))
  const ohne = baueBerichtHtml(m, {})
  p('ohne verkleinerte Fassung kein Gerätefoto und keine Blob-Adresse', ohne.fotosDrin === 1 && !ohne.html.includes('blob:'))
  const mit = baueBerichtHtml(m, { fotoSrc: new Map([['g:g1', jpeg('geraet1')], ['g:g2', jpeg('geraet2')]]) })
  p('mit verkleinerter Fassung eingebettet', mit.fotosDrin === 3 && mit.html.includes(jpeg('geraet1')) && mit.html.includes(jpeg('geraet2')))
  p('Blob-Adresse als fotoSrc wird verworfen', baueBerichtHtml(m, { fotoSrc: new Map([['g:g1', 'blob:http://localhost/abc']]) }).html.includes('blob:') === false)
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
