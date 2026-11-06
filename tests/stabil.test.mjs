// Stabilität: kaputte Sicherungen, Speicher voll, dauerhafter Speicher, Sprachnotizen
import fs from 'node:fs'
import { heileEintrag, heileListe, heileOrtDaten, heileBuchungen } from '../src/lib/heilen.js'
import { baueRecorder, restZeit, AUDIO_BITRATE, AUDIO_MAX_SEK } from '../src/lib/audio.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('\n1  Kaputte Einträge werden repariert')
const kaputt = { id: 'k1', name: null, stops: 'kein Array', tage: 'viele', farbe: 12, imGesamtplan: true }
const h = heileEintrag(kaputt)
p('stops als Text wird leere Liste', Array.isArray(h.stops) && h.stops.length === 0, JSON.stringify(h))
p('Tage als Text wird 1', h.tage === 1)
p('Farbe als Zahl fällt weg', !('farbe' in h))
p('name null bleibt null (gültig)', h.name === null)
p('Original bleibt unverändert', kaputt.stops === 'kein Array')
const j = heileEintrag({ id: 'j1', datum: 12345, fotos: 'x', audios: { a: 1 }, felder: 'quatsch', text: 42 })
p('Logbuch: fotos und audios werden Listen', Array.isArray(j.fotos) && Array.isArray(j.audios))
p('Logbuch: Datum als Zahl fällt weg', !('datum' in j))
p('Logbuch: felder wird Objekt', j.felder && typeof j.felder === 'object' && !Array.isArray(j.felder))
p('Logbuch: Text als Zahl wird Text', j.text === '42')
const st = heileEintrag({ id: 's', stops: [{ name: 'A' }, null, 'B', { name: 'C' }] })
p('Unbrauchbare Stopps fallen weg', st.stops.length === 2 && st.stops[1].name === 'C')
p('Tage als Zahlentext wird Zahl', heileEintrag({ id: 't', tage: '4' }).tage === 4)
p('Kein Objekt: null', heileEintrag('x') === null && heileEintrag([1]) === null && heileEintrag(null) === null)

console.log('\n2  Gültige Daten bleiben genau gleich')
const gut = { id: 'g', name: 'Perth', typ: 'etappe', tage: 3, farbe: '#c55', von: '2037-12-01', stops: [{ name: 'A', lat: 1, lon: 2 }], fotos: [], felder: { wetter: 'sonnig' } }
p('Gültiger Eintrag: dasselbe Objekt', heileEintrag(gut) === gut)
const liste = [gut, { id: 'g2', datum: '2037-12-02', fotos: [{ src: 'data:,' }], audios: [] }]
p('Gültige Liste: dieselbe Liste', heileListe(liste) === liste)
const gemischt = heileListe([gut, 'Müll', null, kaputt])
p('Gemischte Liste: Müll raus, Kaputtes geheilt', gemischt.length === 2 && gemischt[0] === gut && Array.isArray(gemischt[1].stops))
p('Keine Liste bleibt, wie sie ist', heileListe('x') === 'x')

console.log('\n3  Ort-Daten und Buchungen')
const od = heileOrtDaten({ o1: { notiz: 'gut', bilder: [] }, o2: { bilder: 'kaputt' }, o3: 'Müll' })
p('Ort mit kaputten Bildern geheilt, Müll weg', Array.isArray(od.o2.bilder) && !('o3' in od) && od.o1.notiz === 'gut')
p('Ort-Daten kein Objekt: leer', JSON.stringify(heileOrtDaten([1, 2])) === '{}')
const bu = heileBuchungen({ stand: 'x', events: [{ id: 'e', docs: 'kaputt', belege: 'Rechnung.pdf' }, 7] })
p('Buchungen: docs wird Liste, belege bleibt Text', Array.isArray(bu.events[0].docs) && bu.events[0].belege === 'Rechnung.pdf' && bu.events.length === 1)

console.log('\n4  Eingebaut in Import und Start')
const ud = lies('lib/userdata.js')
p('Import heilt die Listen', /sauber\[k\] = heileListe\(sauber\[k\]\)/.test(ud))
p('Import heilt Ort-Daten und Buchungen', /sauber\.daten = heileOrtDaten/.test(ud) && /sauber\.buchungen = heileBuchungen/.test(ud))
p('Start heilt über nachruesten', /heileListe\(liste\)\.map/.test(ud))
p('Start heilt Ort-Daten und Buchungen', /userData\.set\(heileOrtDaten\(data\)\)/.test(ud) && /buchungen\.set\(heileBuchungen\(bu\)\)/.test(ud))

console.log('\n5  Speicher voll wird sichtbar')
p('Fehlschlag meldet sich', /meldeSpeicher\(key, val, false, e2\)/.test(ud))
p('Leerer Fehler beim Abbruch zählt als Fehler', /tx\.error \|\| ev\?\.target\?\.error \|\| new DOMException/.test(ud))
p('Erfolg räumt die Meldung', /meldeSpeicher\(key, val, true\)/.test(ud))
p('Wetter-Vorrat zählt nicht', /NUR_VORRAT = new Set\(\[KEY_GEFAHR\]\)/.test(ud))
p('Speicher voll beim Festschreiben (abort) bricht das Warten ab', /tx\.onabort = \(\) => \{ db\.close\(\); reject/.test(ud))
for (const f of ['lib/flug-dienst.js', 'lib/strassenlage-dienst.js', 'lib/musik/speicher.js', 'lib/tagebuch-fotos.js', 'lib/belege.js', 'lib/tresor.js'])
  p('abort behandelt: ' + f, /\.onabort = /.test(lies(f)))
p('Erneut speichern versucht alle offenen Töpfe', /export async function nochmalSpeichern/.test(ud))
const sh = lies('lib/SpeicherHinweis.svelte'), app = lies('App.svelte')
p('Hinweis bleibt stehen (role=alert, kein Toast)', /role="alert"/.test(sh) && /\{#if \$speicherProblem\}/.test(sh))
p('Hinweis hat Backup-Knopf und Erneut speichern', /onBackup\?\.\(\)/.test(sh) && /Erneut speichern/.test(sh))
p('Hinweis steht oben in jeder Ansicht', /<main class="wrap"[^>]*>\s*<SpeicherHinweis onBackup=\{onExport\} \/>/.test(app))

console.log('\n6  Dauerhafter Speicher')
p('Wird beim ersten eigenen Eintrag erbeten', /bitteUmDauerhaft\(key, val\)/.test(ud) && /s\.persist\(\)/.test(ud))
p('Nur einmal je Start und nicht, wenn schon geschützt', /dauerhaftGefragt = true/.test(ud) && /s\.persisted\?\.\(\)/.test(ud))
const ss = lies('lib/SpeicherStand.svelte')
p('Mehr zeigt belegten und freien Speicher', /<SpeicherStand \/>/.test(app) && /estimate\(\)/.test(ss) && /persisted/.test(ss))

console.log('\n7  Sprachnotizen')
p('32 kbit/s und 5 Minuten', AUDIO_BITRATE === 32000 && AUDIO_MAX_SEK === 300)
let opt = null
class R1 { constructor(s, o) { opt = o } }
baueRecorder({}, R1)
p('Recorder bekommt die Bitrate', opt?.audioBitsPerSecond === 32000)
let zweiter = 0
class R2 { constructor(s, o) { if (o) throw new Error('nein'); zweiter++ } }
baueRecorder({}, R2)
p('Browser ohne Bitrate-Angabe: Aufnahme klappt trotzdem', zweiter === 1)
p('Restzeit am Anfang 5:00', restZeit(1000, 300, 1000) === '5:00')
p('Restzeit nach 55,5 s: 4:05', restZeit(0, 300, 55500) === '4:05')
p('Restzeit nie negativ', restZeit(0, 300, 999999) === '0:00')
const je = lies('lib/JournalEintrag.svelte')
p('Höchstdauer speichert wie Stopp', /onEnde: \(\) => \{ if \(aufnahme === a\) \{ toggleAufnahme\(\)/.test(je))
p('Laufende Aufnahme roh, damit der Vergleich greift', /let aufnahme = \$state\.raw\(null\)/.test(je))
p('Restzeit im Knopf', /noch \{zeit\}/.test(je))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
