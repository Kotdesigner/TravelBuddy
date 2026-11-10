// Spenden über PayPal (V33): Adresse an einer Stelle, Karte unter Mehr, Link unten, Datenschutz.
// Ausführen: node tests/spenden.test.mjs  (kein Netz)
import fs from 'node:fs'
import { PAYPAL, PAYPAL_NAME } from '../src/lib/spenden.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const alle = (dir) => fs.readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alle(dir + '/' + e.name) : [dir + '/' + e.name]))

console.log('\nSpenden')
p('PayPal-Adresse', PAYPAL_NAME === 'Kohlesonstbeule' && PAYPAL === 'https://www.paypal.me/Kohlesonstbeule')
p('nur https, keine Parameter, nichts angehängt', /^https:\/\/www\.paypal\.me\/[A-Za-z0-9]+$/.test(PAYPAL))
const quellen = alle('src').filter((f) => /\.(js|svelte)$/.test(f) && !f.endsWith('spenden.js') && !f.includes('/sprache/'))
p('keine zweite, fest eingetragene PayPal-Adresse im Code', !quellen.some((f) => /paypal\.me/i.test(lies(f))), quellen.filter((f) => /paypal\.me/i.test(lies(f))).join(', '))

const mu = lies('src/lib/MehrUebersicht.svelte')
p('Mehr: Karte ganz unten mit Knopf zu PayPal', /import \{ PAYPAL \} from '\.\/spenden\.js'/.test(mu) && /<a class="btn mu-spende-knopf" href=\{PAYPAL\} target="_blank" rel="noopener noreferrer">/.test(mu) && mu.indexOf('mu-spende') > mu.indexOf('{#each teile.gruppen'))
p('Mehr: freundlich und ehrlich (freiwillig, keine Spendenquittung)', /Dir gefällt TravelBuddy\?/.test(mu) && /kostenlos und ohne Werbung/.test(mu) && /Freiwillig und ohne Gegenleistung, eine Spendenquittung gibt es nicht/.test(mu) && /Enjoying TravelBuddy\?/.test(mu))
p('Mehr-Übersicht dient Mehr-Seite und iPhone-Blatt', /<MehrUebersicht /.test(lies('src/App.svelte')) && /<MehrUebersicht /.test(lies('src/lib/BottomBar.svelte')))
const app = lies('src/App.svelte')
p('Fußzeile: „Spenden“ neben Fehler melden und Datenschutz', /<a class="af-spende" href=\{PAYPAL\} target="_blank" rel="noopener noreferrer"/.test(app) && app.indexOf('af-spende') < app.indexOf('class="af-recht"'))
const recht = lies('src/lib/Rechtliches.svelte')
p('Datenschutz: PayPal, was übertragen wird, Rechtsgrundlage, keine Quittung', /Spenden über PayPal/.test(recht) && /Die App überträgt dabei nichts/.test(recht) && /Art\. 6 Abs\. 1 lit\. b und c DSGVO/.test(recht) && /Donations via PayPal/.test(recht))
p('keine Gedankenstriche in Sätzen', ![mu, recht].some((t) => / [–—] /.test(t)))

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
