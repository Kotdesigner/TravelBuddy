// „Großes Update“: einmal für bisherige Nutzer, nie für neue, jederzeit über Mehr, „Updates“.
// Dieselbe Datei in der eigenen App und in der Basic.
import fs from 'node:fs'
import { updateZeigen, updateGesehen, UPDATE_KEY, UPDATE_VERSION, UPDATE_NAME } from '../src/lib/update-hinweis.js'
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
const vorher = speicher({ 'wa-sprache': 'de', [UPDATE_KEY]: '1.26' })
p('Älteres Update gesehen: das neue erscheint wieder beim ersten Start', updateZeigen(vorher) === true)
p('Ohne Speicher: kein Fenster, kein Absturz', updateZeigen(null) === false && updateZeigen({ getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }) === false)
p('Name der Fassung im Fenster', /^TravelBuddy (V\d+|Basic \d+\.\d+)$/.test(UPDATE_NAME) && UPDATE_NAME.endsWith(UPDATE_VERSION), UPDATE_NAME)

console.log('\nInhalt')
const app = lies('src/App.svelte'), uh = lies('src/lib/UpdateHinweis.svelte')
p('Oben die Zahlen zur Offline-Berechnung: 0,4 %, 22 von 22, 0,06 s', /const ZAHLEN = \[/.test(uh) && /je\('0,4 %', '0\.4 %'\)/.test(uh) && /je\('22 von 22', '22 of 22'\)/.test(uh) && /je\('0,06 s', '0\.06 s'\)/.test(uh) && uh.indexOf('uh-zahlen') < uh.indexOf('uh-liste"'))
const jetztTeil = uh.slice(uh.indexOf('const JETZT = ['), uh.indexOf('const NEU = ['))
const neuTeil = uh.slice(uh.indexOf('const NEU = ['), uh.indexOf('function zu()'))
p('Basic 1.36: oben „Das ist neu“ mit vier Punkten (Etappe, Einplanen am Handy, Notfall, Melden), vor den Zahlen, ohne Netlify-Punkt', (jetztTeil.match(/\['[^']+', je\(/g) || []).length === 4 && /Orte direkt in deine Etappe/.test(jetztTeil) && /Einplanen geht am Handy wieder/.test(jetztTeil) && /Sicherer im Notfall/.test(jetztTeil) && /Melden, klar erklärt/.test(jetztTeil) && !/Netlify/.test(jetztTeil) && uh.indexOf('uh-jetzt') < uh.indexOf('uh-zahlen') && /je\('Das ist neu', 'What’s new'\)/.test(uh))
p('1.32: dreizehn Neuerungen, deutsch und englisch, Runterziehen vorn, dann SOS, Bescheid geben, Meldungen, Verbinden, Teilen, Telegram-Gruppe und die Offline-Routen', (neuTeil.match(/\['[^']+', je\(/g) || []).length === 13 && neuTeil.indexOf("['🔄', je('Runterziehen") < neuTeil.indexOf("['🆘'") && neuTeil.indexOf("['🆘', je('SOS an deine Leute") < neuTeil.indexOf("['👨‍👩‍👧'") && neuTeil.indexOf("['👨‍👩‍👧', je('Deinen Leuten Bescheid geben") < neuTeil.indexOf("['📣'") && neuTeil.indexOf("['📣', je('Meldungen für andere Reisende") < neuTeil.indexOf("['🤝', je('Unterwegs verbinden") && neuTeil.indexOf("['🤝'") < neuTeil.indexOf("['📤'") && neuTeil.indexOf("['📤'") < neuTeil.indexOf("['👥', je('TravelBuddy-Gruppe auf Telegram") && neuTeil.indexOf("['👥'") < neuTeil.indexOf("['🛣️', je('Routen ohne Netz") && neuTeil.indexOf("['🛣️', je('Routen ohne Netz") < neuTeil.indexOf("['🪨'"))
p('Sperrungen, 4WD und Pisten-Netz genannt', /Sperrungen umfahren/.test(uh) && /4WD-Schalter an der Route|2WD oder 4WD/.test(uh) && /Pisten-Netz je Gebiet/.test(uh))
p('Keine Gedankenstriche in Sätzen', !/ [–—] /.test(uh))

console.log('\nEinbau')
p('Prüfung vor der Sprachfrage', app.indexOf('let updateOffen = $state(updateZeigen())') > 0 && app.indexOf('let updateOffen = $state(updateZeigen())') < app.indexOf('let sprachFrage = $state(spracheOffen())'))
p('Nicht gleichzeitig mit der Sprachfrage (in der Basic auch nicht mit Installieren und Einführung)', /\{#if updateOffen && !sprachFrage( && !\$installOffen && !\$einfuehrung)?\}<UpdateHinweis/.test(app))
p('Jedes Schließen merkt sich die Version (Knopf, Hintergrund, Esc)', /function zu\(\) \{ updateGesehen\(\); onfertig\(\) \}/.test(uh) && /onclick=\{zu\}/.test(uh) && /use:modal=\{\{ onclose: zu/.test(uh))
p('Handbuch-Knopf führt ins Handbuch', /onhandbuch=\{\(\) => geh\('mehr\/handbuch'\)\}/.test(app))
const me = fs.readFileSync(new URL('../src/lib/mehr-eintraege.js', import.meta.url), 'utf8')
p('Unter Mehr, App und Einstellungen: „Updates“ öffnet das Fenster, keine eigene Seite, auch im iPhone-Blatt', /\{ id: 'updates', icon: '📋', label: je\('Updates', 'Updates'\)/.test(me) && me.indexOf("id: 'updates'") > me.indexOf("id: 'handbuch'") && /updates: \(\) => \(updateOffen = true\)/.test(app) && /onUpdates=\{\(\) => \(updateOffen = true\)\}/.test(app))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
