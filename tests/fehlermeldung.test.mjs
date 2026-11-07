// Fehler melden: Formular, Technik-Zeilen, Versand an die eigene Netlify-Funktion, die über Resend mailt.
// Resend und Netlify werden nur nachgebaut, es geht keine echte Mail raus.
import fs from 'node:fs'
import {
  ZIEL, FELDER, MAX_BILDER, MAX_BYTES, HILFE, geraetUndBrowser, technikZeilen, technikText,
  sendefertig, emailOk, bildBytes, baueFormular, sende, istNetlify, mailLink, EMPFAENGER, issueLink, ISSUES,
} from '../src/lib/fehlermeldung.js'
import handler, { baueMail, zuViele, tagesGrenze, PRO_TAG, PRO_TAG_JE_ADRESSE, MAX_BILD_BYTES } from '../netlify/functions/fehlermeldung.mjs'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\n1  Gerät und Browser')
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1'
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36'
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0'
const gb = (ua, o) => Object.values(geraetUndBrowser(ua, o)).join(', ')
p('iPhone, Safari', gb(IPHONE) === 'iPhone, Safari', gb(IPHONE))
p('Mac, Chrome', gb(MAC_CHROME) === 'Mac, Chrome', gb(MAC_CHROME))
p('iPad gibt sich als Mac aus, Touch verrät es', gb(IPAD, { touch: 5 }) === 'iPad, Safari', gb(IPAD, { touch: 5 }))
p('Android-Handy, Chrome', gb(ANDROID) === 'Android-Handy, Chrome', gb(ANDROID))
p('Windows, Edge', gb(WIN_EDGE) === 'Windows, Edge', gb(WIN_EDGE))

console.log('\n2  Was mitgeht')
const z = technikZeilen({ version: 'Basic 1.24', build: '05.11.2037, 12:00', ua: IPHONE, sprache: 'de', breite: 402, hoehe: 874, seite: '#/orte/norden', alsApp: true })
const tx = technikText(z)
p('Version, Gerät, Sprache, Bildschirm, Seite', /Version: Basic 1\.24 · Build 05\.11\.2037/.test(tx) && /Gerät: iPhone, Safari, als App eingerichtet/.test(tx) && /Sprache: Deutsch/.test(tx) && /Bildschirm: 402 × 874/.test(tx) && /Zuletzt offen: #\/orte\/norden/.test(tx), tx)
p('Auf Englisch', /Device: Mac, Chrome/.test(technikText(technikZeilen({ ua: MAC_CHROME, sprache: 'en' }))))
p('Android auf Englisch', /Device: Android phone, Chrome/.test(technikText(technikZeilen({ ua: ANDROID, sprache: 'en' }))))
p('Leere Angaben fallen weg', !technikZeilen({ ua: IPHONE }).some(([k]) => /Zuletzt|Bildschirm/.test(k)))
p('Keine Reisedaten im Technik-Text', !/reise|logbuch|lat|lon|standort/i.test(tx))

console.log('\n3  Formular')
p('Hilfe im leeren Feld, deutsch und englisch, vier Fragen', HILFE.de.split('\n').length === 4 && HILFE.en.split('\n').length === 4 && /Wann tritt es auf/.test(HILFE.de))
p('Absenden erst mit Text', !sendefertig('') && !sendefertig('  ') && sendefertig('Karte bleibt leer'))
p('E-Mail freiwillig, aber wenn, dann vollständig', emailOk('') && emailOk('a@b.de') && !emailOk('a@b') && !emailOk('ab.de'))
class FD { constructor() { this.e = [] } append(k, v, n) { this.e.push([k, v, n]) } }
const bild = (n, size = 1000) => ({ name: n, size })
const fd = baueFormular({ text: '  Karte bleibt leer ', email: ' a@b.de ', technik: tx, bilder: [bild('a.jpg'), bild('b.jpg'), bild('c.jpg'), bild('d.jpg')] }, FD)
const k = fd.e.map(([x]) => x)
p('Kein Netlify-Forms-Name mehr', !k.includes('form-name'))
p('Text und E-Mail ohne Leerzeichen am Rand', fd.e.find(([x]) => x === 'beschreibung')[1] === 'Karte bleibt leer' && fd.e.find(([x]) => x === 'email')[1] === 'a@b.de')
p(`Höchstens ${MAX_BILDER} Bilder, je ein Feld`, k.filter((x) => x.startsWith('screenshot')).join() === 'screenshot1,screenshot2,screenshot3')
p('Alle Feldnamen bekannt', k.every((x) => FELDER.includes(x)), k.join())
p('Honigtopf-Feld leer', fd.e.find(([x]) => x === 'bot-field')[1] === '')
p('Bildgröße zusammengezählt', bildBytes([bild('a', 10), bild('b', 5)]) === 15)

console.log('\n4  Versand')
let anfrage = null
const okFetch = async (url, o) => { anfrage = { url, o }; return { ok: true, status: 200, json: async () => ({ ok: true }) } }
p('Erfolg nur mit Bestätigung der Funktion', (await sende(fd, { f: okFetch })).ok === true)
p('Ein bloßes „200“ ohne Bestätigung gilt nicht (lokale Vorschau)', (await sende(fd, { f: async () => ({ ok: true, status: 200, json: async () => { throw new Error('html') } }) })).ok === false)
p('Funktion meldet Fehler', (await sende(fd, { f: async () => ({ ok: false, status: 503, json: async () => ({ ok: false, grund: 'nicht-eingerichtet' }) }) })).info === 'nicht-eingerichtet')
p('POST an die Funktion, ohne eigenen Content-Type', anfrage.url === ZIEL && anfrage.o.method === 'POST' && !anfrage.o.headers && anfrage.o.body === fd)
p('Abgelehnt (z. B. 404)', (await sende(fd, { f: async () => ({ ok: false, status: 404, json: async () => ({}) }) })).grund === 'abgelehnt')
p('Ohne Netz', (await sende(fd, { f: async () => { throw new TypeError('Failed to fetch') } })).grund === 'netz')
p('Zu groß für die Funktion', (await sende(fd, { f: okFetch, groesse: MAX_BYTES + 1 })).grund === 'zu-gross' && MAX_BYTES < 5 * 1024 * 1024)

console.log('\n4b Nur auf Netlify direkt, sonst Mail-App')
p('Netlify-Seiten erkannt', istNetlify('travelbuddy-v1-wa.netlify.app'))
p('Lokal und Mac-App nicht', !istNetlify('localhost') && !istNetlify('127.0.0.1') && !istNetlify('') && !istNetlify('netlify.app.example.com'))
const ml = mailLink({ text: 'Karte grau', technik: 'Version: Basic 1.24', sprache: 'de' })
p('Mail-Link mit Empfänger, Betreff und Text', ml.startsWith('mailto:' + EMPFAENGER + '?subject=') && decodeURIComponent(ml).includes('Karte grau') && decodeURIComponent(ml).includes('Version: Basic 1.24'))
p('Basic: ohne Netlify über GitHub', /if \(!direkt\) return perGithub\(\)/.test(lies('src/lib/FehlerMelden.svelte')) && issueLink({ text: 'Karte grau\nmehr', technik: 'Version: Basic 1.24' }).startsWith(ISSUES + '?title=Karte%20grau&body='))

console.log('\n5  Funktion: Mail über Resend')
const anfrageMit = (felder, { methode = 'POST', ip = '203.0.113.' + Math.floor(Math.random() * 200) } = {}) => {
  const f = new FormData()
  for (const [k2, v] of Object.entries(felder)) f.append(k2, v)
  return [new Request('https://beispiel.netlify.app/api/fehlermeldung', { method: methode, ...(methode === 'POST' ? { body: f } : {}) }), { ip }]
}
const jpg = (n, groesse = 2000) => new File([new Uint8Array(groesse).fill(7)], n, { type: 'image/jpeg' })
let gesendet = null
const resend = async (url, o) => { gesendet = { url, o, mail: JSON.parse(o.body) }; return { ok: true } }
// Platzhalter ohne die Form echter Schlüssel, damit kein Geheimnis-Scanner anschlägt
const AN = 'empfaenger@example.com'
const env = { RESEND_API_KEY: 'platzhalter-schluessel-zum-testen', FEHLER_AN: AN }
const ruf = async (felder, o = {}, opts = {}) => { const [req, ctx] = anfrageMit(felder, o); const r = await handler(req, ctx, { f: resend, env, speicher: null, ...opts }); return { status: r.status, j: await r.json() } }
gesendet = null
let r1 = await ruf({ 'bot-field': '', beschreibung: 'Karte bleibt grau\nNach dem Tippen auf Google Maps', email: 'leser@example.com', technik: 'Version: Basic 1.24', screenshot1: jpg('bild.jpg') })
p('Meldung geht an Resend', r1.status === 200 && r1.j.ok === true && gesendet?.url === 'https://api.resend.com/emails')
p('Schlüssel nur im Kopf der Anfrage, aus der Umgebung', gesendet.o.headers.authorization === 'Bearer ' + env.RESEND_API_KEY && !JSON.stringify(gesendet.mail).includes(env.RESEND_API_KEY))
p('An die Adresse aus FEHLER_AN, Antwort an den Absender', JSON.stringify(gesendet.mail.to) === JSON.stringify([AN]) && gesendet.mail.reply_to === 'leser@example.com')
p('Betreff aus der ersten Zeile', gesendet.mail.subject === 'TravelBuddy Fehlermeldung: Karte bleibt grau')
p('Text mit Technik', /Nach dem Tippen/.test(gesendet.mail.text) && /Version: Basic 1.24/.test(gesendet.mail.text))
p('Bild als Anhang', gesendet.mail.attachments?.length === 1 && gesendet.mail.attachments[0].filename === 'bild.jpg' && gesendet.mail.attachments[0].content.length > 100)
gesendet = null
let r2 = await ruf({ 'bot-field': 'ich bin ein bot', beschreibung: 'Spam Spam Spam' })
p('Honigtopf: still verworfen, keine Mail', r2.status === 200 && r2.j.ok === true && gesendet === null)
p('Leerer Text abgelehnt', (await ruf({ beschreibung: '  ' })).status === 400)
p('Nur Bilder als Anhang', (await ruf({ beschreibung: 'Text da', screenshot1: new File(['x'], 'a.exe', { type: 'application/octet-stream' }) })).status === 415)
p('Zu großes Bild abgelehnt', (await ruf({ beschreibung: 'Text da', screenshot1: jpg('g.jpg', MAX_BILD_BYTES + 10) })).status === 413)
p('Ohne Schlüssel: klare Antwort, keine Mail', await (async () => { gesendet = null; const [req, ctx] = anfrageMit({ beschreibung: 'Text da' }); const r = await handler(req, ctx, { f: resend, env: {} }); return r.status === 503 && (await r.json()).grund === 'nicht-eingerichtet' && gesendet === null })())
p('Resend lehnt ab: Fehler zurück an die App', (await ruf({ beschreibung: 'Text da' }, {}, { f: async () => ({ ok: false }) })).j.grund === 'mail')
p('Nur POST', (await ruf({}, { methode: 'GET' })).status === 405)
p('Höchstens fünf je Minute und Adresse', (() => { const t = 1e6; for (let i = 0; i < 5; i++) if (zuViele('x', t + i)) return false; return zuViele('x', t + 10) && !zuViele('x', t + 61e3 + 10) })())
// Obergrenze pro Tag mit nachgebautem Netlify-Blobs-Speicher
function speicherNachbau() {
  const daten = new Map()
  return { daten,
    get: async (k) => (daten.has(k) ? JSON.parse(daten.get(k)) : null),
    setJSON: async (k, v) => { daten.set(k, JSON.stringify(v)) },
    list: async ({ prefix = '' } = {}) => ({ blobs: [...daten.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
    delete: async (k) => { daten.delete(k) },
  }
}
await (async () => {
  const sp = speicherNachbau(), tag = new Date('2037-03-02T10:00:00Z')
  let ok = true
  for (let i = 0; i < PRO_TAG_JE_ADRESSE; i++) if (await tagesGrenze(sp, '1.2.3.4', tag)) ok = false
  p('Je Adresse höchstens ' + PRO_TAG_JE_ADRESSE + ' am Tag', ok && (await tagesGrenze(sp, '1.2.3.4', tag)) === 'tageslimit' && (await tagesGrenze(sp, '5.6.7.8', tag)) === null)
  p('Adresse wird nicht gespeichert, nur ein Prüfwert', ![...sp.daten.values()].join('').includes('1.2.3.4'))
  const sp2 = speicherNachbau()
  for (let i = 0; i < PRO_TAG; i++) await tagesGrenze(sp2, 'a' + i, tag)
  p('Insgesamt höchstens ' + PRO_TAG + ' am Tag', (await tagesGrenze(sp2, 'neu', tag)) === 'tageslimit')
  const morgen = new Date('2037-03-03T10:00:00Z')
  p('Am nächsten Tag wieder frei, alter Zähler wird gelöscht', (await tagesGrenze(sp2, 'neu', morgen)) === null && await new Promise((r) => setTimeout(r, 20)).then(() => [...sp2.daten.keys()].join() === 'tag-2037-03-03'))
  p('Speicher kaputt: Meldung geht trotzdem durch', (await tagesGrenze({ get: async () => { throw new Error('weg') } }, 'x', tag)) === null && (await tagesGrenze(null, 'x', tag)) === null)
  const sp3 = speicherNachbau()
  for (let i = 0; i < PRO_TAG_JE_ADRESSE; i++) await tagesGrenze(sp3, 'gleich', new Date())
  gesendet = null
  const voll = await ruf({ beschreibung: 'Noch eine Meldung' }, { ip: 'gleich' }, { speicher: sp3 })
  p('Funktion: über der Grenze 429 „tageslimit“, keine Mail', voll.status === 429 && voll.j.grund === 'tageslimit' && gesendet === null)
  const sp4 = speicherNachbau()
  await ruf({ 'bot-field': 'bot', beschreibung: 'Spam Spam' }, {}, { speicher: sp4 })
  await ruf({ beschreibung: '  ' }, {}, { speicher: sp4 })
  p('Bots und leere Meldungen zählen nicht mit', sp4.daten.size === 0)
  const sp5 = speicherNachbau()
  await ruf({ beschreibung: 'Resend ist gerade weg' }, { ip: 'x5' }, { speicher: sp5, f: async () => ({ ok: false }) })
  p('Fehlgeschlagene Mail zählt nicht mit', [...sp5.daten.values()].every((v) => !JSON.parse(v).gesamt))
  const sp6 = speicherNachbau()
  for (let i = 0; i < PRO_TAG_JE_ADRESSE + 2; i++) await tagesGrenze(sp6, 'unbekannt', tag)
  p('Ohne bekannte Adresse nur die Gesamtgrenze', (await tagesGrenze(sp6, 'unbekannt', tag)) === null)
})()
const fn = lies('netlify/functions/fehlermeldung.mjs')
p('App zeigt eigene Meldung beim Tageslimit', /erg\.info === 'tageslimit'/.test(lies('src/lib/FehlerMelden.svelte')))
p('Datenschutz nennt den Tageszähler', /Prüfwert \(Hash\)/.test(lies('src/lib/Rechtliches.svelte')))
p('Netlify Blobs als Abhängigkeit', /"@netlify\/blobs"/.test(lies('package.json')))
p('Kein Schlüssel und keine Adresse im Code', !/re_[A-Za-z0-9]{10,}/.test(fn) && /env\.RESEND_API_KEY/.test(fn) && /env\.FEHLER_AN/.test(fn) && !/@outlook\.|@gmail\./.test(fn))
p('Ohne FEHLER_AN: nicht eingerichtet', await (async () => { const [req, ctx] = anfrageMit({ beschreibung: 'Text da' }); const r = await handler(req, ctx, { f: resend, env: { RESEND_API_KEY: 'x' } }); return r.status === 503 })())
p('Pfad /api/fehlermeldung', /path: '\/api\/fehlermeldung'/.test(fn) && ZIEL === '/api/fehlermeldung')
p('Netlify baut bei Änderungen der Funktion neu', /-- src public scripts netlify /.test(lies('netlify.toml')))
p('Feldnamen von App und Funktion passen', FELDER.every((x) => fn.includes(`'${x}'`) || (x.startsWith('screenshot') && fn.includes("'screenshot' + i"))))
p('Netlify-Forms-Seite entfernt', !fs.existsSync(new URL('../public/__forms.html', import.meta.url)))

console.log('\n6  Einbau')
const app = lies('src/App.svelte')
p('Seite da, aber nicht in der Mehr-Liste', /ansicht\.unter === 'fehler'/.test(app) && !/\['mehr\/fehler'/.test(app) && !/id: 'fehler'/.test(lies('src/lib/BottomBar.svelte')))
p('Link ganz unten mit rotem Bug', /class="af-fehler" href="#\/mehr\/fehler"><svg class="af-bug"/.test(app) && /\.af-bug \{ color: var\(--danger\)/.test(app))
p('Eigener Titel, keine Chip-Reihe', /ansicht\.unter === 'fehler' \? je\('Fehler melden'/.test(app) && /'backup', 'fehler'\]\.includes\(ansicht\.unter\)/.test(app))
const seite = lies('src/lib/FehlerMelden.svelte')
p('Danke-Hinweis nach dem Absenden', /Danke für die Rückmeldung! Ich werde mich dem schnellstmöglich widmen\./.test(seite))
p('Graue Hilfe als Platzhalter', /placeholder=\{istEn \? HILFE\.en : HILFE\.de\}/.test(seite))
p('Bildschirmfoto anfügen', /accept="image\/\*"/.test(seite) && /Bildschirmfoto anfügen/.test(seite))
p('Im Datenschutz genannt', /Resend/.test(lies('src/lib/Rechtliches.svelte')) && /Postfach bei Microsoft/.test(lies('src/lib/Rechtliches.svelte')))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
