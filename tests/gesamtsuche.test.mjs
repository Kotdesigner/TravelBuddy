// Suche über alles außer den Orten (lib/gesamtsuche.js): Tage, Tiere, Wanderungen, Buchungen,
// Etappen und Routen, Notizen, Packliste, Vorbereitung; Datum statt Text.
// Ausführen: node tests/gesamtsuche.test.mjs   (alle Daten ausgedacht)
import fs from 'node:fs'
import { gesamtsuche, datumAus, passtDatum, ausschnitt } from '../src/lib/gesamtsuche.js'
import { etappenMitDatum } from '../src/lib/plan.js'
import { ARTEN, artVon } from '../src/lib/tierwelt.js'
import { PACK_VORLAGE } from '../src/lib/packliste-daten.js'
import { VORBEREITUNG } from '../src/lib/vorbereitung-daten.js'
import { NOTIZ_TYP } from '../src/lib/notizen-typen.js'
import { katInfo } from '../src/lib/reisekalender.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

const REISEN = [
  { id: 'e1', typ: 'etappe', name: 'Coral Coast', von: '2038-05-04', tage: 9, stops: [{ name: 'Perth' }, { name: 'Kalbarri' }] },
  { id: 'r1', typ: 'route', etappeId: 'e1', name: 'Perth → Exmouth', stops: [{ name: 'Lancelin' }, { name: 'Coral Bay' }] },
]
const D = {
  journal: [
    { id: 'j1', datum: '2038-05-05', ort: 'The Pinnacles', text: 'Kalksteinsäulen im Abendlicht, danach der klarste Sternenhimmel.', felder: { roadkill_counts: { Känguru: 2 }, soundtrack: 'Midnight Oil' }, sichtungen: [{ art: 'emu', anzahl: 3 }, { art: 'kaenguru', anzahl: 6 }] },
    { id: 'j2', datum: '2038-05-08', ort: 'Coral Bay', text: 'Schnorcheln, eine Schildkröte zieht vorbei.', felder: {}, sichtungen: [{ art: 'kaenguru', anzahl: 1 }, { art: 'eigen', name: 'Riffhai' }] },
  ],
  wanderungen: [{ id: 'w1', name: 'Bluff Knoll', gebiet: 'Stirling Range', datum: '2038-05-10', km: 6, beschreibung: 'Steil, oben Wind.' }],
  buchungen: { events: [
    { id: 'b1', datum: '2038-05-01', kat: 'flight', titel: 'Ankunft Perth', sub: 'Qantas QF9', ref: 'XK4711', docs: [{ label: 'E-Ticket' }] },
    { id: 'b2', datum: '2038-05-04', kat: 'camper', titel: 'Camper-Übernahme', sub: 'Perth Depot' },
    { id: 'b3', datum: '2038-05-06', kat: 'hotel', titel: 'Platzhalter', platzhalter: true },
  ], persoenlich: [{ id: 'p1', label: 'Reisepass Scan' }] },
  notizen: [{ id: 'n1', typ: 'einkaufen', text: 'Sonnencreme 50+ und Fliegennetz kaufen', tsLokal: '2038-05-03T09:12' }],
  reisen: REISEN, etappen: etappenMitDatum(REISEN, '2038-05-01'), start: '2038-05-01',
  arten: ARTEN, artVon, katInfo, notizTyp: NOTIZ_TYP,
  packVorlage: PACK_VORLAGE, pack: { checked: { maxtrax: true }, custom: [{ id: 'c1', text: 'Schnorchelset', kat: 'fahrzeug' }] },
  vorbVorlage: VORBEREITUNG, vorb: { checked: {}, custom: [{ id: 'v1', text: 'Fliegennetz testen' }] },
  dokumente: [{ id: 'd1', typ: 'Reisepass', nummer: 'C01X00T47', gueltigBis: '2031-03-01', notiz: '' }],
  texte: { tage: 'Tage', tiere: 'Tiere', wanderungen: 'Wanderungen', buchungen: 'Buchungen', reisen: 'Reisen', notizen: 'Notizen', packliste: 'Packliste', vorbereitung: 'Vorbereitung', nochNicht: 'noch nicht gesehen' },
}
const suche = (q) => gesamtsuche(q, D)
const gruppe = (r, id) => r.find((g) => g.id === id)?.treffer || []
const ids = (r) => r.map((g) => g.id).join()

console.log('\n1  Was gefunden wird')
{
  const r = suche('känguru')
  p('Tier: Känguru mit Zahl und Tagen, führt zur Tierwelt', gruppe(r, 'tiere')[0]?.titel.includes('Känguru') && /7× gesehen an 2 Tagen/.test(gruppe(r, 'tiere')[0].unter) && gruppe(r, 'tiere')[0].ziel === 'logbuch/tiere', JSON.stringify(gruppe(r, 'tiere')[0]))
  p('dazu beide Tage mit Känguru (Zähler und Sichtung)', gruppe(r, 'tage').map((x) => x.ziel).join() === 'logbuch/tag/2038-05-05,logbuch/tag/2038-05-08')
  p('Wallaby nicht (kein Wort „känguru“)', !gruppe(r, 'tiere').some((x) => /Wallaby/.test(x.titel)))
  const k = suche('kanguru')
  p('ohne Umlaut genauso', gruppe(k, 'tiere').length === gruppe(r, 'tiere').length)
  p('eigenes Tier aus einer Sichtung', gruppe(suche('riffhai'), 'tiere')[0]?.unter && gruppe(suche('riffhai'), 'tage')[0]?.datum === '2038-05-08')
  p('Tier aus dem Katalog, noch nicht gesehen, kommt nach den gesehenen', gruppe(suche('dingo'), 'tiere')[0]?.unter === 'noch nicht gesehen')
  p('Text im Tag: Schildkröte → Coral Bay, mit Ausschnitt', gruppe(suche('schildkrote'), 'tage')[0]?.titel.includes('Coral Bay') && /Schildkröte/.test(gruppe(suche('schildkrote'), 'tage')[0].unter))
  p('Modul im Tag: Soundtrack', gruppe(suche('midnight oil'), 'tage')[0]?.datum === '2038-05-05')
  p('Wanderung über Gebiet, führt zur Wanderung', gruppe(suche('stirling'), 'wanderungen')[0]?.ziel === 'plan/wanderungen/w1')
  p('Buchung über Buchungsnummer', gruppe(suche('xk4711'), 'buchungen')[0]?.ziel === 'logbuch/tag/2038-05-01')
  p('Buchung über Fluglinie im Zusatz und Beleg-Namen', gruppe(suche('qantas'), 'buchungen').length === 1 && gruppe(suche('e-ticket'), 'buchungen').length === 1)
  p('Platzhalter-Termine nicht', !gruppe(suche('platzhalter'), 'buchungen').length)
  p('persönliches Dokument aus dem Kalender', gruppe(suche('reisepass'), 'buchungen').some((x) => x.ziel === 'mehr/vorbereitung'))
  p('Dokument aus der Vorbereitung, auch über die Nummer', gruppe(suche('c01x00'), 'vorbereitung')[0]?.titel.includes('Reisepass'))
  p('Etappe über Stopp, Route über Stopp', gruppe(suche('kalbarri'), 'reisen')[0]?.ziel === 'plan/etappe/e1' && gruppe(suche('lancelin'), 'reisen')[0]?.ziel === 'plan/route/r1')
  p('Notiz, führt zu den Notizen', gruppe(suche('sonnencreme'), 'notizen')[0]?.ziel === 'logbuch/notizen')
  const f = suche('fliegennetz')
  p('ein Wort, mehrere Bereiche: Notiz, Packliste (Vorlage), Vorbereitung', ids(f) === 'notizen,packliste,vorbereitung', ids(f))
  p('Packliste: Vorlage mit Haken und eigene Einträge', /✓$/.test(gruppe(suche('maxtrax'), 'packliste')[0]?.titel) && gruppe(suche('schnorchelset'), 'packliste')[0]?.unter.length > 0)
}

console.log('\n2  Mehrere Wörter, Reihenfolge, Grenzen')
{
  p('alle Wörter müssen vorkommen, egal wo', gruppe(suche('känguru coral'), 'tage').map((x) => x.datum).join() === '2038-05-08')
  p('Titel zählt mehr als Text', gruppe(suche('coral'), 'reisen')[0]?.titel === 'Coral Coast')
  p('ein Buchstabe sucht noch nicht', suche('k').length === 0 && suche(' ').length === 0)
  p('nichts gefunden: leer', suche('xyzxyz').length === 0)
  p('Gruppen in fester Reihenfolge', ids(suche('perth')) === 'buchungen,reisen', ids(suche('perth')))
}

console.log('\n3  Datum statt Text')
{
  p('3.12. / 3.12.2037 / 03.12', datumAus('3.12.').md === '12-03' && datumAus('3.12.2037').jahr === '2037' && datumAus('03.12').md === '12-03')
  p('3. Dezember / 3 Dez / Dec 3 / December 3rd', ['3. Dezember', '3 dez', 'Dec 3', 'December 3rd'].every((s) => datumAus(s)?.md === '12-03'))
  p('2037-12-03 und 3/12', datumAus('2037-12-03').jahr === '2037' && datumAus('3/12').md === '12-03')
  p('März mit Umlaut', datumAus('3. März')?.md === '03-03')
  p('Tag 5 = fünfter Reisetag', datumAus('Tag 5', { start: '2038-05-01' })?.md === '05-05' && datumAus('day 1', { start: '2038-05-01' })?.md === '05-01')
  p('kein Datum: 32.13., „3 Bäume“, Zahl allein', !datumAus('32.13.') && !datumAus('3 Bäume') && !datumAus('42'))
  p('passtDatum ohne Jahr: jedes Jahr', passtDatum('2038-05-05', { md: '05-05', jahr: null }) && !passtDatum('2038-05-05', { md: '05-05', jahr: '2037' }))
  const r = suche('5.5.')
  p('5.5.: Logbuch-Tag und Etappe, keine Tiere oder Packliste', gruppe(r, 'tage')[0]?.datum === '2038-05-05' && gruppe(r, 'reisen')[0]?.id === 'reise:e1' && !gruppe(r, 'tiere').length && !gruppe(r, 'packliste').length, ids(r))
  p('1. Mai: die Buchung an dem Tag', gruppe(suche('1. Mai'), 'buchungen')[0]?.titel.includes('Ankunft Perth'))
  p('Tag 3: die Notiz vom 3. Mai', gruppe(suche('Tag 3'), 'notizen').length === 1)
  p('Wanderung am 10.5.', gruppe(suche('10.5.'), 'wanderungen')[0]?.id === 'wand:w1')
}

console.log('\n4  Ausschnitt')
{
  const lang = 'Am Morgen Nebel über der Bucht, mittags dann endlich Sonne, und am Abend sahen wir eine Schildkröte am Strand liegen, ganz ruhig.'
  const a = ausschnitt(lang, ['schildkrote'])
  p('zeigt die Stelle mit dem Wort, mit Auslassungspunkten', a.includes('Schildkröte') && a.startsWith('…') && a.length <= 72, a)
  p('kurzer Text bleibt ganz', ausschnitt('Kurz.', ['kurz']) === 'Kurz.')
}

console.log('\n5  Im Suchblatt')
{
  const sb = fs.readFileSync(new URL('../src/lib/Suchblatt.svelte', import.meta.url), 'utf8')
  p('Suchblatt nutzt die Gesamtsuche und springt über ongeh', sb.includes('gesamtsuche(q,') && sb.includes('ongeh(ziel)'))
  p('Spiele-Wörter gehen weiter', /wort === '4444'/.test(sb) && /wort === 'sn4ke'/.test(sb))
  const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8')
  p('App öffnet das Ziel und schließt das Blatt', app.includes('ongeh={(p) => { sucheOffen = false; geh(p) }}'))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
