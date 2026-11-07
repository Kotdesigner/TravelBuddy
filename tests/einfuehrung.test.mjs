// Einführung beim ersten Öffnen (lib/einfuehrung.js, Einfuehrung.svelte).
// Ausführen: node tests/einfuehrung.test.mjs
import fs from 'node:fs'
import { SCHRITTE, bereinige, sollZeigen, istLeer, KEY } from '../src/lib/einfuehrung.js'
import { vorgabeStart, reiseZeitraum } from '../src/lib/plan.js'
import { fuehreZusammen } from '../src/lib/zusammenfuehren.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const wurzel = new URL('../src/', import.meta.url).pathname

console.log('\n1  Wann sie erscheint')
{
  p('erster Start, App leer: ja', sollZeigen(null, true))
  p('erster Start mit Daten (Backup eingespielt): nein', !sollZeigen(null, false))
  p('angefangen, nicht fertig (z. B. nach Sprachwechsel): ja, auch mit Daten', sollZeigen({ schritt: 3, fertig: false }, false))
  p('fertig oder „Später“: nie wieder von selbst', !sollZeigen({ schritt: 0, fertig: true }, true))
  p('leer erkannt', istLeer({ tagebuch: 0, reisen: 0, quiz: 0 }, 0))
  p('eine Etappe: nicht leer', !istLeer({ tagebuch: 0, reisen: 1 }, 0))
  p('eine Buchung: nicht leer', !istLeer({ reisen: 0 }, 1))
}

console.log('\n2  Gespeicherter Stand')
{
  p('unbrauchbar wird „noch nie gestartet“', bereinige(null) === null && bereinige('x') === null)
  p('Schritt wird begrenzt', bereinige({ schritt: 99 }).schritt === SCHRITTE.length - 1 && bereinige({ schritt: -2 }).schritt === 0 && bereinige({ schritt: 'a' }).schritt === 0)
  p('fertig bleibt', bereinige({ schritt: 2, fertig: true }).fertig === true)
  p('zwölf Schritte in der Reihenfolge von „Was baut worauf auf“: Aussehen, Datum, Fahrzeug, Netze, Etappe, Route, Geld, Tagebuch, Check', SCHRITTE.join() === 'willkommen,design,start,fahrzeug,routen,etappe,route,ausgaben,dokumente,orte,logbuch,bereit')
  {
    const ef = fs.readFileSync(new URL('../src/lib/Einfuehrung.svelte', import.meta.url), 'utf8'), es = fs.readFileSync(new URL('../src/lib/ErsteSchritte.svelte', import.meta.url), 'utf8')
    p('Schritt Offline-Routen: erklärt Hauptstraßen, Pisten-Netz und Sperrungen, lädt das Pisten-Netz je Gebiet direkt', /\{:else if id === 'routen'\}/.test(ef) && /onclick=\{\(\) => pisten\(g\)\}/.test(ef) && /pistenLaden\(g\)/.test(ef) && /Floodway/.test(ef) && /disabled=\{!\$online \|\| \$pistenLaedt\[g\]\}/.test(ef))
    const hilfe = fs.readFileSync(new URL('../src/lib/hilfe.js', import.meta.url), 'utf8')
    p('ⓘ „Was baut worauf auf“ gezielt je Schritt: alles beim Willkommen, je ein Teil bei Datum, Fahrzeug, Etappe, Route, Ausgaben, Orte, Logbuch, Bereit', ['aufbau', 'aufbau-datum', 'aufbau-route', 'aufbau-etappe', 'aufbau-ausgaben', 'aufbau-orte', 'aufbau-logbuch', 'aufbau-bereit'].every((id) => ef.includes(`<InfoKnopf id="${id}" />`) && (hilfe.includes(`'${id}': {`) || hilfe.includes(`${id}: {`))) && /Einmal eintragen, überall nutzen/.test(ef))
    p('Die Kette steht drin: erst Datum, dann Etappe, dann Route und Fahrzeug, dann Geld, zuletzt Tagebuch; WLAN-Hinweis bei Bereit; ein Eintrag, viele Stellen bei den Ausgaben', /erst das Datum, dann die Etappe, dann Route und Fahrzeug, dann das Geld, zuletzt das Tagebuch/.test(hilfe) && /Am besten zu Hause im WLAN/.test(hilfe) && /Ein Eintrag, viele Stellen/.test(hilfe))
    p('Design am Anfang: Erscheinungsbild, Karten, Schrift', /\{:else if id === 'design'\}/.test(ef) && /setzeTheme\(m\)/.test(ef) && /setzeKarten\(m\)/.test(ef) && /setzeSchrift\(s\.id\)/.test(ef))
    p('Fahrzeug: Reichweite und 2WD oder 4WD als Vorgabe für neue Routen', /\{:else if id === 'fahrzeug'\}/.test(ef) && /reichweite\.set\(v\)/.test(ef) && /allradVorgabe\.set\(true\)/.test(ef) && /neueRouteAllrad\(vorlage\)/.test(fs.readFileSync(new URL('../src/lib/userdata.js', import.meta.url), 'utf8')))
    p('Vorabausgaben statt Buchungen: Ausgabe vorab, Flug oder Zug mit Nummer, Buchungsmail', /\{:else if id === 'ausgaben'\}/.test(ef) && /blatt\('ausgabe'\)/.test(ef) && /blatt\('route', \{ art: 'flug' \}\)/.test(ef) && /blatt\('buchung'\)/.test(ef) && !/\{:else if id === 'buchung'\}/.test(ef))
    p('Bereit für unterwegs: Daten schützen, Home-Bildschirm, Backup, Notfall, Haken für Karten, Pisten-Netz, Routen', /\{:else if id === 'bereit'\}/.test(ef) && /navigator\.storage\?\.persist\?\.\(\)/.test(ef) && /onclick=\{appEinrichten\}/.test(ef) && /seite\('mehr\/backup'\)/.test(ef) && /seite\('mehr\/notfall'\)/.test(ef) && /karten-pmtiles-v2/.test(ef))
    p('Erste Schritte: Vorabausgaben statt Buchung', /id: 'ausgaben'/.test(es) && /oeffneNeu\('ausgabe'\)/.test(es) && !/id: 'buchung'/.test(es))
    p('Erste Schritte auf Heute: „Pisten-Netz laden“, hakt sich ab, sobald eins geladen ist, führt zur aufgeklappten Box', /id: 'pisten'/.test(es) && /fertig: Object\.values\(\$pistenStand\)\.some\(Boolean\)/.test(es) && /localStorage\.setItem\('tb-offline-routen-offen', '1'\); sessionStorage\.setItem\('tb-offline-routen-zeigen', '1'\)/.test(es) && /geh\('plan\/karte'\)/.test(es))
  }
  p('Anlegen, Route, Vorabausgaben und Dokumente sind dabei, Buchungen stecken im Schritt Vorabausgaben', ['start', 'etappe', 'route', 'ausgaben', 'dokumente'].every((s) => SCHRITTE.includes(s)) && !SCHRITTE.includes('buchung'))
  p('je Gerät, nicht im Backup', !fs.readFileSync(wurzel + 'lib/userdata.js', 'utf8').includes(KEY))
}

console.log('\n3  Startdatum ohne feste Vorgabe')
{
  p('Erster des nächsten Monats', vorgabeStart(new Date(2038, 2, 17)) === '2038-04-01')
  p('über den Jahreswechsel', vorgabeStart(new Date(2038, 11, 5)) === '2039-01-01')
}

console.log('\n3b Reisedauer: Zeitraum im Titelbild')
{
  const z = reiseZeitraum('2038-03-10', 45, {})
  p('Beginn plus 45 Tage, ohne Etappen', z?.von === '2038-03-10' && z.bis === '2038-04-23' && z.tage === 45, JSON.stringify(z))
  p('ohne Dauer und ohne Etappen: nichts', reiseZeitraum('2038-03-10', 0, {}) === null)
  p('Etappen allein reichen', reiseZeitraum('2038-03-10', 0, { start: '2038-03-12', ende: '2038-03-20' })?.bis === '2038-03-20')
  const w = reiseZeitraum('2038-03-10', 5, { start: '2038-03-12', ende: '2038-03-30' })
  p('Etappen verlängern den Zeitraum', w.von === '2038-03-10' && w.bis === '2038-03-30' && w.tage === 21, JSON.stringify(w))
  p('Unsinn wird ignoriert', reiseZeitraum('kein Datum', 10, {}) === null && reiseZeitraum('2038-03-10', 'x', {}) === null)
  const app = fs.readFileSync(wurzel + 'App.svelte', 'utf8')
  p('Titelbild nutzt den Zeitraum', /reiseZeitraum\(\$gesamtStart, \$reiseTage/.test(app) && /kopfZeit\.von/.test(app))
  p('im Plan änderbar', /reiseTage\.set/.test(fs.readFileSync(wurzel + 'lib/PlanAnsicht.svelte', 'utf8')))
  p('kommt ins Backup', /reiseTage: get\(reiseTage\)/.test(fs.readFileSync(wurzel + 'lib/userdata.js', 'utf8')))
  const leer = { reisen: [], journal: [], eigeneOrte: [], daten: {}, buchungen: { events: [] } }
  const r = fuehreZusammen({ ...leer, reiseTage: 0, skalarStand: {} }, { ...leer, reiseTage: 30, skalarStand: { reiseTage: '2026-05-01T00:00:00Z' } }, { grundwerte: { reiseTage: 0 } })
  p('Zusammenführen übernimmt die Dauer vom anderen Gerät', r.ergebnis.reiseTage === 30, String(r.ergebnis.reiseTage))
}

console.log('\n4  Einbindung')
{
  const app = fs.readFileSync(wurzel + 'App.svelte', 'utf8')
  const svelte = fs.readFileSync(wurzel + 'lib/Einfuehrung.svelte', 'utf8')
  p('in App.svelte eingebunden', /<Einfuehrung \{geh\}/.test(app))
  p('öffnet die echten Blätter für Etappe und Buchung', /blatt\('etappe'/.test(svelte) && /blatt\('buchung'\)/.test(svelte))
  p('führt zu den Belegen unter Buchungen', svelte.includes("seite('mehr/vorbereitung', '#bu-titel')") && fs.readFileSync(wurzel + 'lib/Reisevorbereitung.svelte', 'utf8').includes('id="bu-titel"'))
  p('noch einmal startbar: Mehr-Blatt und Seitenleiste', /onEinfuehrung/.test(fs.readFileSync(wurzel + 'lib/BottomBar.svelte', 'utf8')) && /onEinfuehrung/.test(fs.readFileSync(wurzel + 'lib/Seitenleiste.svelte', 'utf8')))
  p('keine Startdaten mehr (die waren privat)', !/startdaten/i.test(app))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
