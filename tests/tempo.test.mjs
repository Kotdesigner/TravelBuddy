// Tempo: was die App beim Start und beim Aufbau der Ortskacheln bremste (V26)
import fs from 'node:fs'
import { sonnenZeiten, uhrzeitFormat } from '../src/lib/sonne.js'
import { ladePois, _leereCache } from '../src/lib/versorgung.js'
import { abstandZur } from '../src/lib/wander-zuordnung.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\nSonnenzeiten')
p('Ein Formatierer je Zeitzone, nicht je Aufruf', uhrzeitFormat('Australia/Perth') === uhrzeitFormat('Australia/Perth') && uhrzeitFormat('Australia/Perth') !== uhrzeitFormat('Australia/Sydney'))
const orte = JSON.parse(lies('public/orte.json'))
let t = performance.now(); for (const o of orte) sonnenZeiten(o.lat, o.lon, '2037-12-20'); const ms = performance.now() - t
p('146 Orte in unter 25 ms (vorher gut 50 ms)', ms < 25, ms.toFixed(1) + ' ms')
p('Zeiten stimmen weiter (Perth, Dezember)', /^0[45]:\d\d$/.test(sonnenZeiten(-31.95, 115.86, '2037-12-20').aufgang))
p('Fahrtag nutzt denselben Formatierer', /uhrzeitFormat\(tz\)\.format\(date\)/.test(lies('src/lib/fahrtag.js')))

console.log('\nVersorgungsdateien')
_leereCache()
let rufe = 0
const holer = async () => { rufe++; await new Promise((r) => setTimeout(r, 10)); return { ok: true, json: async () => [{ k: 'fuel', x: 1, y: 2 }] } }
const [a, b, c] = await Promise.all([ladePois('wa', holer), ladePois('wa', holer), ladePois('wa', holer)])
p('Gleichzeitige Anfragen holen die Datei nur einmal', rufe === 1 && a === b && b === c && a.length === 1)
await ladePois('wa', holer)
p('Danach aus dem Zwischenspeicher', rufe === 1)
_leereCache(); rufe = 0
await ladePois('x', async () => { rufe++; return { ok: false } }); await ladePois('x', async () => { rufe++; return { ok: false } })
p('Fehler oder leer: beim nächsten Mal neu versuchen', rufe === 2)
const nutzer = ['src/lib/routen-dienst.js', 'src/lib/Reisen.svelte', 'src/lib/Notfall.svelte', 'src/lib/Karte.svelte']
p('Tank-Analyse, Reisen, Notfall und Karte laden über dieselbe Funktion', nutzer.every((f) => !/fetch\(['`]\/pois-/.test(lies(f)) && /ladePois|holePois/.test(lies(f))))

console.log('\nStart und Kacheln')
const app = lies('src/App.svelte')
p('Weltkugel erst bauen, wenn man hinscrollt', /use:beiSicht=\{\(\) => \(reiseKarteAn = true\)\}/.test(app) && /\{#if reiseKarteAn\}/.test(app) && /export function beiSicht/.test(lies('src/lib/motion.js')))
p('Hinweise an der Route erst 3 Sekunden nach dem Start', /Math\.max\(400, 3000 - \(performance\.now\(\) - start\)\)/.test(lies('src/lib/RoutenDienst.svelte')))
p('Kacheln außerhalb des Bildschirms nicht vorab zeichnen', /\.or-grid > article\.card \{ content-visibility: auto;/.test(lies('src/app.css')))
const weit = { route: { geometry: [[150, -33], [151, -34]] }, stops: [] }
p('Weit entfernte Route ist sofort erledigt', abstandZur({ lat: -31.95, lon: 115.86 }, weit) === null)

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
