// Kaffeekasse in der Fußzeile. In V43 war der Spenden-Knopf raus, auf Steves Wunsch ist er
// wieder da — als Kaffeekasse, in beiden Apps.
//
// Diese Prüfung wacht nicht mehr darüber, dass der Knopf WEG ist, sondern darüber, wie er
// gebaut ist: ein gewöhnlicher Link, kein fremdes Skript, kein Zählpixel, mit Datenschutz-
// Abschnitt und sicherem Ziel. Genau daran hing damals die Kritik.
// Ausführen: node tests/spenden.test.mjs  (kein Netz)
import fs from 'node:fs'
import path from 'node:path'
import { PAYPAL, PAYPAL_NAME } from '../src/lib/spenden.js'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : '→ ' + info); if (!ok) fehler++ }
const wurzel = new URL('../', import.meta.url).pathname
const lies = (f) => fs.readFileSync(path.join(wurzel, f), 'utf8')
const alle = (o) => fs.readdirSync(path.join(wurzel, o), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? alle(path.join(o, e.name)) : [path.join(o, e.name)])
const quellen = alle('src').filter((f) => /\.(js|svelte|css|html)$/.test(f))

console.log('\nKaffeekasse')
{
  p('Die Adresse steht an einer einzigen Stelle', /^https:\/\/www\.paypal\.me\/[A-Za-z0-9_-]+$/.test(PAYPAL) && PAYPAL.endsWith(PAYPAL_NAME), PAYPAL)
  const andere = quellen.filter((f) => f !== 'src/lib/spenden.js' && /paypal\.me|paypal\.com/i.test(lies(f)))
  p('Keine zweite Adresse irgendwo im Code', !andere.length, andere.join(', '))

  const app = lies('src/App.svelte')
  p('Der Knopf steht in der Fußzeile', /class="af-kaffee"/.test(app))
  p('Er nimmt die Adresse aus spenden.js', /import \{ PAYPAL \} from '\.\/lib\/spenden\.js'/.test(app) && /href=\{PAYPAL\}/.test(app))
  p('Er heißt auf Deutsch und auf Englisch etwas', /Kaffee spendieren/.test(app) && /Tip for a coffee/.test(app))
  p('Er trägt das Kaffeesymbol', /☕/.test(app))
  p('Er öffnet ein neues Fenster und gibt die Seite nicht preis', /class="af-kaffee"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/.test(app))
  p('Die Tippfläche ist groß genug (44 px)', /\.af-kaffee \{[\s\S]{0,400}min-height: 44px/.test(app))
}

console.log('\nNichts Fremdes in der App')
{
  // Der Punkt, an dem solche Knöpfe sonst kippen: ein eingebundenes Widget. Das lädt fremdes
  // JavaScript, setzt Cookies und wäre offline ein Loch in der App.
  const fremd = quellen.filter((f) => /ko-fi\.com\/widget|buymeacoffee\.com\/widget|paypalobjects\.com|<script[^>]+paypal/i.test(lies(f)))
  p('Kein Spenden-Widget, kein fremdes Skript', !fremd.length, fremd.join(', '))
  p('Kein Zählpixel', !quellen.some((f) => /paypal[^"']*\.gif|pixel\.paypal/i.test(lies(f))))
}

console.log('\nDatenschutz sagt es')
{
  const r = lies('src/lib/Rechtliches.svelte')
  p('Es gibt einen Abschnitt zur Kaffeekasse', /Kaffeekasse über PayPal/.test(r))
  p('Er nennt PayPal mit Anschrift', /PayPal \(Europe\)/.test(r) && /Luxemburg/.test(r))
  p('Er sagt, dass die App nichts überträgt', /App überträgt dabei nichts/.test(r))
  p('Er sagt, dass es freiwillig ist', /freiwillig und ohne Gegenleistung/.test(r))
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
