// Anonyme Zählung der App-Starts (Umami): zählt nur auf der echten Adresse, schickt nur das Nötigste
import fs from 'node:fs'
import { zaehlenErlaubt, browserWillNicht, meldung, UMAMI_ID, ZAEHL_HOST, ZAEHL_ZIEL, TAKT_MS } from '../src/lib/zaehler.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const ID = '11111111-2222-3333-4444-555555555555'
const nav = {}

console.log('\n1  Wann gezählt wird')
p('Echte Adresse mit Kennung: ja', zaehlenErlaubt({ id: ID, host: ZAEHL_HOST, nav, aus: false }))
p('Ohne Kennung: nein', !zaehlenErlaubt({ id: '', host: ZAEHL_HOST, nav, aus: false }))
for (const host of ['localhost', '127.0.0.1', 'deploy-preview-3--travelbuddy-v1-wa.netlify.app', 'fremd.netlify.app', ''])
  p('Andere Adresse zählt nicht: ' + (host || '(leer)'), !zaehlenErlaubt({ id: ID, host, nav, aus: false }))
p('Selbst ausgeschaltet: nein', !zaehlenErlaubt({ id: ID, host: ZAEHL_HOST, nav, aus: true }))
p('Do Not Track: nein', !zaehlenErlaubt({ id: ID, host: ZAEHL_HOST, nav: { doNotTrack: '1' }, aus: false }))
p('Global Privacy Control: nein', !zaehlenErlaubt({ id: ID, host: ZAEHL_HOST, nav: { globalPrivacyControl: true }, aus: false }))
p('Do Not Track „0“ zählt', !browserWillNicht({ doNotTrack: '0' }))

console.log('\n2  Was gesendet wird')
const m = meldung(ID, ZAEHL_HOST)
p('Start: nur Kennung, Hostname und „/“', JSON.stringify(m) === JSON.stringify({ type: 'event', payload: { website: ID, hostname: ZAEHL_HOST, url: '/' } }), JSON.stringify(m))
const a = meldung(ID, ZAEHL_HOST, 'aktiv')
p('Weiter offen: Ereignis „aktiv“, sonst nichts', Object.keys(a.payload).sort().join() === 'hostname,name,url,website' && a.payload.name === 'aktiv')
p('Ziel ist Umami Cloud über https', ZAEHL_ZIEL === 'https://cloud.umami.is/api/send')
p('Takt 5 Minuten', TAKT_MS === 300000)
p('Kennung leer oder im Umami-Format', UMAMI_ID === '' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(UMAMI_ID))

console.log('\n3  Kein fremder Code, kein Cookie')
const z = lies('src/lib/zaehler.js')
p('Kein Umami-Skript in index.html', !/umami/i.test(lies('index.html')))
p('Ohne Cookies und ohne Referrer', /credentials: 'omit'/.test(z) && /referrerPolicy: 'no-referrer'/.test(z))
p('Offline wird nicht gezählt', /navigator\.onLine/.test(z))
p('Keine Bildschirmgröße, keine Sprache, kein Titel', !/screen|language|document\.title|referrer:/.test(z.replace(/^\s*\/\/.*$/gm, '')))

console.log('\n4  Eingebaut und erklärt')
p('Start ruft den Zähler', /starteZaehler\(\)/.test(lies('src/main.js')))
const r = lies('src/lib/Rechtliches.svelte')
p('Datenschutz erklärt die Zählung', /Anonyme Zählung der App-Starts/.test(r) && /umami\.is/.test(r))
p('Schalter zum Ausschalten', /type="checkbox" checked=\{!\$zaehlungAus\}/.test(r))
p('README nennt die Zählung (de und en)', /zählt nur anonym/.test(lies('README.md')) && /only counts anonymously/.test(lies('README.md')))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
