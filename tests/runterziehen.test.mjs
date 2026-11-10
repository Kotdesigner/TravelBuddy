// V36: Runterziehen zum Aktualisieren. Zugweite, Schwelle, wo die Geste starten darf, sicheres Neuladen.
// Ausführen: node tests/runterziehen.test.mjs  (kein Netz, keine echten Dienste)
import fs from 'node:fs'
import * as R from '../src/lib/runterziehen.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\n1  Zug')
p('gedämpft: Finger 100 px = 50 px, nach oben nichts', R.zugWeite(100) === 50 && R.zugWeite(-30) === 0 && R.zugWeite(0) === 0)
p('höchstens 120 px', R.zugWeite(1000) === 120)
p('Schwelle 72: erst ab 144 px Fingerweg', !R.bereit(140) && R.bereit(144))
p('nur eher senkrecht nach unten, Wischen zur Seite zählt nicht', R.senkrecht(10, 80) && !R.senkrecht(80, 60) && !R.senkrecht(0, -40))

console.log('\n2  Wo die Geste starten darf')
{
  const body = { tag: 'BODY' }
  // Ersatz-Element: closest(sel) findet sich selbst, wenn `art` im Selektor steht; scrollTop; Eltern bis body
  const el = (art = 'div', { scrollTop = 0, eltern = body } = {}) => ({ tagName: art.toUpperCase(), scrollTop, parentElement: eltern, closest: (sel) => (sel.split(',').map((s) => s.trim()).includes(art) ? {} : null) })
  const doc = (extra = {}) => ({ body, documentElement: {}, activeElement: null, querySelector: () => null, ...extra })
  p('ganz oben auf normaler Fläche: ja', R.darfStarten(el(), { scrollY: 0, doc: doc() }))
  p('Seite schon gescrollt: nein', !R.darfStarten(el(), { scrollY: 40, doc: doc() }))
  p('auf Karte, Weltkugel oder Feld: nein', ['.maplibregl-map', 'canvas', 'input', 'textarea', 'select', '[data-kein-runterziehen]'].every((a) => !R.darfStarten(el(a), { scrollY: 0, doc: doc() })))
  p('Blatt oder Dialog offen, rote Notruf-Fläche: nein', !R.darfStarten(el(), { scrollY: 0, doc: doc({ querySelector: (s) => (/aria-modal|\.nt/.test(s) ? {} : null) }) }))
  p('Tastatur offen (Feld hat den Fokus): nein', !R.darfStarten(el(), { scrollY: 0, doc: doc({ activeElement: { tagName: 'TEXTAREA' } }) }))
  const liste = el('div', { scrollTop: 30 })
  p('innere Liste nicht oben: nein; oben: ja', !R.darfStarten(el('div', { eltern: liste }), { scrollY: 0, doc: doc() }) && R.darfStarten(el('div', { eltern: el('div', { scrollTop: 0 }) }), { scrollY: 0, doc: doc() }))
  p('ohne Ziel: nein', !R.darfStarten(null, { scrollY: 0, doc: doc() }))
}

console.log('\n3  Sicher neu laden')
{
  const ablauf = []
  const warte = async (ms) => { ablauf.push('warte ' + ms) }
  const reg = { update: async () => { ablauf.push('update') }, installing: null, waiting: null }
  const sw = { getRegistration: async () => reg }
  let r = await R.aktualisiereApp({ frage: async () => false, sw, neuLaden: () => ablauf.push('neu'), warte })
  p('ungespeicherte Änderungen, „Abbrechen“: nichts passiert', r === 'abgebrochen' && ablauf.length === 0, ablauf.join())
  r = await R.aktualisiereApp({ frage: async () => true, sw, neuLaden: () => ablauf.push('neu'), warte })
  p('sonst: nach neuer Fassung sehen, kurz warten (Speichern), dann neu laden', r === 'neu' && ablauf.join() === 'update,warte 4000,warte 400,neu', ablauf.join())
  ablauf.length = 0; reg.installing = {}
  await R.aktualisiereApp({ frage: async () => true, sw, neuLaden: () => ablauf.push('neu'), warte })
  p('neue Fassung wird installiert: etwas länger warten (sie lädt dann selbst neu)', ablauf.includes('warte 3000') && ablauf.at(-1) === 'neu', ablauf.join())
  ablauf.length = 0
  await R.aktualisiereApp({ frage: async () => true, sw: { getRegistration: async () => { throw new Error('offline') } }, neuLaden: () => ablauf.push('neu'), warte })
  p('offline oder ohne Service-Worker: trotzdem neu laden (aus dem Vorrat)', ablauf.at(-1) === 'neu' && (await R.aktualisiereApp({ frage: async () => true, sw: undefined, neuLaden: () => ablauf.push('neu2'), warte })) === 'neu')
}

console.log('\n4  Einbindung')
{
  const rz = lies('src/lib/Runterziehen.svelte'), app = lies('src/App.svelte'), css = lies('src/app.css')
  p('überall in der App eingebunden', /<Runterziehen \/>/.test(app) && /import Runterziehen from '\.\/lib\/Runterziehen\.svelte'/.test(app))
  p('Fingerbewegung nur abgefangen, solange gezogen wird (nicht beim normalen Scrollen)', /document\.addEventListener\('touchmove', bewegt, o\)/.test(rz) && /const o = \{ passive: false \}/.test(rz) && /if \(e\.cancelable\) e\.preventDefault\(\)/.test(rz) && /if \(!zieht\) \{/.test(rz))
  p('Anzeige: ziehen, loslassen, aktualisiere', /Zum Aktualisieren ziehen/.test(rz) && /Loslassen zum Aktualisieren/.test(rz) && /Aktualisiere …/.test(rz))
  p('Browser-Runterziehen bleibt aus (kein doppeltes Neuladen, kein Wackeln)', /overscroll-behavior: none;/.test(css))
  p('ungespeicherte Änderungen fragen vorher (Wächter der Seite)', /import \{ fragWaechter \} from '\.\/navigation\.js'/.test(lies('src/lib/runterziehen.js')))
  p('Schriftgrößen mit Faktor, keine Gedankenstriche', !/font-size: \d+px/.test(rz) && ![rz, lies('src/lib/runterziehen.js')].some((t) => / [–—] /.test(t.replace(/\/\/.*$/gm, ''))))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
