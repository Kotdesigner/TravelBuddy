// Anonyme Zählung der App-Starts (GoatCounter): zählt nur auf der echten Adresse, schickt nur das Nötigste
import fs from 'node:fs'
import { zaehlenErlaubt, browserWillNicht, zaehlAdresse, ZAEHL_HOST, ZAEHL_ZIEL, PFAD_START, PFAD_AKTIV, TAKT_MS } from '../src/lib/zaehler.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const nav = {}

console.log('\n1  Wann gezählt wird')
p('Echte Adresse: ja', zaehlenErlaubt({ host: ZAEHL_HOST, nav, aus: false }))
for (const host of ['localhost', '127.0.0.1', 'deploy-preview-3--travelbuddy-v1-wa.netlify.app', 'fremd.netlify.app', 'kotdesigner.github.io', ''])
  p('Andere Adresse zählt nicht: ' + (host || '(leer)'), !zaehlenErlaubt({ host, nav, aus: false }))
p('Selbst ausgeschaltet: nein', !zaehlenErlaubt({ host: ZAEHL_HOST, nav, aus: true }))
p('Do Not Track: nein', !zaehlenErlaubt({ host: ZAEHL_HOST, nav: { doNotTrack: '1' }, aus: false }))
p('Global Privacy Control: nein', !zaehlenErlaubt({ host: ZAEHL_HOST, nav: { globalPrivacyControl: true }, aus: false }))
p('Do Not Track „0“ zählt', !browserWillNicht({ doNotTrack: '0' }))

console.log('\n2  Was gesendet wird')
const start = new URL(zaehlAdresse(false, 'abcde'))
p('Ziel ist GoatCounter der Website über https', ZAEHL_ZIEL === 'https://travelbuddy-oz.goatcounter.com/count' && start.origin + start.pathname === ZAEHL_ZIEL)
p('Start: nur Seitenname, Titel, kein Ereignis', [...start.searchParams.keys()].sort().join() === 'b,p,rnd,t' && start.searchParams.get('p') === PFAD_START, start.search)
const aktiv = new URL(zaehlAdresse(true, 'abcde'))
p('Weiter offen: Ereignis „app-aktiv“', aktiv.searchParams.get('p') === PFAD_AKTIV && aktiv.searchParams.get('e') === 'true')
p('Keine Bildschirmgröße, kein Referrer, keine Abfrage', !['s', 'r', 'q'].some((k) => start.searchParams.has(k) || aktiv.searchParams.has(k)))
p('App-Pfade fangen mit „app“ an (trennt sie von der Website)', /^app/.test(PFAD_START) && /^app/.test(PFAD_AKTIV))
p('Takt 5 Minuten', TAKT_MS === 300000)

console.log('\n3  Kein fremder Code, kein Cookie')
const z = lies('src/lib/zaehler.js')
p('Kein Zähl-Skript in index.html', !/goatcounter|umami|count\.js/i.test(lies('index.html')))
p('Ohne Cookies', /credentials: 'omit'/.test(z))
p('Offline wird nicht gezählt', /navigator\.onLine/.test(z))
p('Kein Umami mehr', !/umami/i.test(z + lies('src/lib/Rechtliches.svelte') + lies('README.md')))

console.log('\n4  Eingebaut und erklärt')
p('Start ruft den Zähler', /starteZaehler\(\)/.test(lies('src/main.js')))
const r = lies('src/lib/Rechtliches.svelte')
p('Datenschutz erklärt die Zählung mit GoatCounter', /Anonyme Zählung der App-Starts/.test(r) && /an GoatCounter \(goatcounter\.com/.test(r))
p('Schalter zum Ausschalten', /type="checkbox" checked=\{!\$zaehlungAus\}/.test(r))
p('README nennt die Zählung (de und en)', /zählt nur anonym[^\n]*GoatCounter/.test(lies('README.md')) && /only counts anonymously[^\n]*GoatCounter/.test(lies('README.md')))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
