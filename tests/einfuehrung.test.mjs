// Einführung beim ersten Öffnen (lib/einfuehrung.js, Einfuehrung.svelte).
// Ausführen: node tests/einfuehrung.test.mjs
import fs from 'node:fs'
import { SCHRITTE, bereinige, sollZeigen, istLeer, KEY } from '../src/lib/einfuehrung.js'
import { vorgabeStart } from '../src/lib/plan.js'

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
  p('acht Schritte, vom Willkommen bis zum Sichern', SCHRITTE.length === 8 && SCHRITTE[0] === 'willkommen' && SCHRITTE.at(-1) === 'sichern')
  p('Anlegen, Buchung und Dokumente sind dabei', ['start', 'etappe', 'buchung', 'dokumente'].every((s) => SCHRITTE.includes(s)))
  p('je Gerät, nicht im Backup', !fs.readFileSync(wurzel + 'lib/userdata.js', 'utf8').includes(KEY))
}

console.log('\n3  Startdatum ohne feste Vorgabe')
{
  p('Erster des nächsten Monats', vorgabeStart(new Date(2038, 2, 17)) === '2038-04-01')
  p('über den Jahreswechsel', vorgabeStart(new Date(2038, 11, 5)) === '2039-01-01')
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
