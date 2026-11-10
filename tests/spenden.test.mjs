// Kein Spenden-Knopf mehr (Steve, 10.11.: aus beiden Apps entfernt). Wacht darüber, dass er nicht zurückkommt.
// Ausführen: node tests/spenden.test.mjs  (kein Netz)
import fs from 'node:fs'
import path from 'node:path'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const wurzel = new URL('../', import.meta.url).pathname
const alle = (o) => fs.readdirSync(path.join(wurzel, o), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? alle(path.join(o, e.name)) : [path.join(o, e.name)])
const quellen = alle('src').filter((f) => /\.(js|svelte|css)$/.test(f) && !f.includes('/sprache/'))
const lies = (f) => fs.readFileSync(path.join(wurzel, f), 'utf8')
console.log('\nKein Spenden-Knopf')
p('keine PayPal-Adresse im Code', !quellen.some((f) => /paypal/i.test(lies(f))), quellen.filter((f) => /paypal/i.test(lies(f))).join(', '))
p('kein Spenden-Knopf in Fußzeile und unter Mehr', !/af-spende/.test(lies('src/App.svelte')) && !/mu-spende/.test(lies('src/lib/MehrUebersicht.svelte')))
p('spenden.js ist weg', !fs.existsSync(path.join(wurzel, 'src/lib/spenden.js')))
p('Datenschutz ohne PayPal-Abschnitt', !/Spenden über PayPal/.test(lies('src/lib/Rechtliches.svelte')))
if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
