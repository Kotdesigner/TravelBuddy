// „Großes Update“: einmal für bisherige Nutzer, nie für neue
import fs from 'node:fs'
import { updateZeigen, updateGesehen, UPDATE_KEY, UPDATE_VERSION } from '../src/lib/update-hinweis.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const speicher = (start = {}) => { const m = new Map(Object.entries(start)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }

console.log('\nWer sieht das Fenster?')
const alt = speicher({ 'wa-sprache': 'de' })
p('Bisheriger Nutzer (Sprache gespeichert) sieht es', updateZeigen(alt) === true)
updateGesehen(alt)
p('Nach dem Schließen nie wieder', alt.m.get(UPDATE_KEY) === UPDATE_VERSION && updateZeigen(alt) === false)
const alt2 = speicher({ 'tb-einfuehrung-v1': '{}' })
p('Auch wer nur die Einführung gespeichert hat', updateZeigen(alt2) === true)
const neu = speicher()
p('Neuer Nutzer sieht es nicht', updateZeigen(neu) === false)
p('… und auch später nicht, nachdem er die Sprache gewählt hat', (neu.setItem('wa-sprache', 'en'), updateZeigen(neu) === false))
const vorher = speicher({ 'wa-sprache': 'de', [UPDATE_KEY]: '1.24' })
p('Älteres Update gesehen: das neue erscheint wieder', updateZeigen(vorher) === true)
p('Ohne Speicher: kein Fenster, kein Absturz', updateZeigen(null) === false && updateZeigen({ getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }) === false)

console.log('\nEinbau')
const app = lies('src/App.svelte'), uh = lies('src/lib/UpdateHinweis.svelte')
p('Prüfung vor der Sprachfrage', app.indexOf('let updateOffen = $state(updateZeigen())') > 0 && app.indexOf('let updateOffen = $state(updateZeigen())') < app.indexOf('let sprachFrage = $state(spracheOffen())'))
p('Nicht gleichzeitig mit Sprachfrage, Installieren oder Einführung', /\{#if updateOffen && !sprachFrage && !\$installOffen && !\$einfuehrung\}<UpdateHinweis/.test(app))
p('Jedes Schließen merkt sich die Version (Knopf, Hintergrund, Esc)', /function zu\(\) \{ updateGesehen\(\); onfertig\(\) \}/.test(uh) && /onclick=\{zu\}/.test(uh) && /use:modal=\{\{ onclose: zu/.test(uh))
p('Acht Neuerungen, deutsch und englisch', (uh.match(/\['[^']+', je\(/g) || []).length === 8)
p('Handbuch-Knopf führt ins Handbuch', /onhandbuch=\{\(\) => geh\('mehr\/handbuch'\)\}/.test(app))
p('Keine Gedankenstriche in Sätzen', !/ [–—] /.test(uh))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
