// Im Neu-Blatt angelegt gilt als gespeichert: Auf einer offenen Etappe zählt eine neue Route
// nicht als ungespeicherte Änderung. Vorher fragte die Etappe beim Öffnen der neuen Route
// „Änderungen verwerfen?“, und „Nicht speichern“ löschte die gerade angelegte Route wieder.
import fs from 'node:fs'
import { setzeWaechter, fragWaechter, alsGespeichert } from '../src/lib/navigation.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('\n1  Wächter und Übernehmen (navigation.js)')
const uebernommen = []
setzeWaechter(async () => false, (id) => uebernommen.push(id))
alsGespeichert('r1')
p('Angelegtes geht an die offene Seite', uebernommen.join() === 'r1', uebernommen.join())
alsGespeichert(undefined)
p('ohne id passiert nichts', uebernommen.length === 1)
p('der Wächter selbst bleibt, wie er ist', (await fragWaechter()) === false)
setzeWaechter(null)
alsGespeichert('r2')
p('ohne offene Seite geht nichts verloren und nichts schief', uebernommen.length === 1 && (await fragWaechter()) === true)
setzeWaechter(async () => true)
alsGespeichert('r3')
p('Seite ohne Übernehmen: kein Fehler', uebernommen.length === 1)
setzeWaechter(null)

console.log('\n2  Einbindung')
const app = lies('App.svelte'), leiste = lies('lib/AenderungsLeiste.svelte'), etappe = lies('lib/EtappeDetail.svelte')
const fertig = app.slice(app.indexOf('function neuFertig'), app.indexOf('function neuFertig') + 400)
p('App: nach dem Anlegen erst übernehmen, dann zur neuen Seite', /alsGespeichert\(r\.id\)[\s\S]*geh\(/.test(fertig))
p('Etappe: gibt das Übernehmen an die Leiste weiter', /setzeWaechter\(async[\s\S]*?\}, \(id\) => aenderung\?\.uebernehmen\(id\)\)/.test(etappe))
p('Leiste: nimmt Angelegtes in den Stand und in jeden Zwischenstand', /function uebernehmen\(id\)[\s\S]*stand = mit\(stand\); verlauf = verlauf\.map\(mit\)/.test(leiste))
p('Leiste: bietet uebernehmen nach außen an', /api = \{[^}]*geaendert[\s\S]*uebernehmen \}/.test(leiste))
p('Etappe: „+ Route anlegen“ läuft über das Neu-Blatt', /oeffneNeu\('route', \{ etappeId: etappe\.id \}\)/.test(etappe))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
