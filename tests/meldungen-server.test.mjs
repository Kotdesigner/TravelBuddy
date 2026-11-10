// Meldungen V32, Server: Kern, Funktion und Bot mit Ersatz-Speicher und nachgebautem Telegram.
// Ausführen: node tests/meldungen-server.test.mjs  (kein Netz, kein echter Dienst)
import { macheKern, MAX_AKTIV } from '../netlify/meldungen-kern.mjs'
import funktion from '../netlify/functions/meldungen.mjs'
import bot from '../netlify/functions/meldungen-bot.mjs'
import { TAG_MS, MAX_LEBEN_TAGE } from '../src/lib/meldungen-regeln.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }

function ersatzSpeicher() {
  const m = new Map()
  return {
    m,
    async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)) },
    async delete(k) { m.delete(k) },
    async list({ prefix = '' } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } },
  }
}
function ersatzTelegram() {
  const rufe = []
  let nr = 100
  const holen = async (url, opt) => { const methode = url.split('/').pop(); const daten = JSON.parse(opt.body); rufe.push({ methode, daten }); return { json: async () => ({ ok: true, result: methode === 'sendMessage' ? { message_id: ++nr } : true }) } }
  return { rufe, holen }
}
const ENV = { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_GRUPPE: '-1001', TELEGRAM_ADMIN: '42', TELEGRAM_GEHEIM: 'geheimwort-test' }
const G1 = 'a'.repeat(32), G2 = 'b'.repeat(32), G3 = 'c'.repeat(32), G4 = 'd'.repeat(32)
let uhr = Date.UTC(2031, 11, 10, 2, 0)
let zaehl = 0
const zufall = (n) => (++zaehl).toString(16).padStart(n * 2, '0')
const neueMeldung = { art: 'weg', text: 'Pentecost River nicht passierbar, Wasser über der Radnabe.', name: 'Kim', lat: -15.78, lon: 127.86, ort: 'Pentecost River' }

console.log('\n1  Neu anlegen')
const sp = ersatzSpeicher(), tgx = ersatzTelegram()
const k = macheKern({ store: sp, env: ENV, holen: tgx.holen, jetzt: () => uhr, zufall })
const e1 = await k.neu(neueMeldung, { geraet: G1, wer: '1.2.3.4' })
p('angelegt, mit Schlüssel zum Zurückziehen', e1.status === 200 && e1.daten.ok && e1.daten.meldung.id && e1.daten.schluessel)
p('öffentlich ohne Gerät, Schlüssel und Stimmen-Listen', !('von' in e1.daten.meldung) && !('schluessel' in e1.daten.meldung) && e1.daten.meldung.ja === 0)
p('läuft 3 Tage, Gegend Kimberley', e1.daten.meldung.ablauf - e1.daten.meldung.erstellt === 3 * TAG_MS && e1.daten.meldung.gegend === 'kimberley')
const gespeichert = JSON.parse(sp.m.get('m/' + e1.daten.meldung.id))
p('gespeichert wird nur ein Prüfwert von Gerät und Schlüssel, keine Adresse', gespeichert.von !== G1 && gespeichert.von.length === 20 && gespeichert.schluessel !== e1.daten.schluessel && !JSON.stringify([...sp.m.values()]).includes('1.2.3.4'))
p('in die Gruppe und an den Admin mit Knöpfen', tgx.rufe.some((r) => r.methode === 'sendMessage' && r.daten.chat_id === '-1001' && /Pentecost River/.test(r.daten.text)) && tgx.rufe.some((r) => r.daten.chat_id === '42' && r.daten.reply_markup?.inline_keyboard?.[0]?.map((b) => b.text).join() === 'Passt,Löschen'))
p('Gruppentext ohne Gedankenstriche, mit Ablauf', !/ [–—] /.test(tgx.rufe[0].daten.text) && /gilt bis/.test(tgx.rufe[0].daten.text))
p('Nachrichtennummer der Gruppe gemerkt', JSON.parse(sp.m.get('m/' + e1.daten.meldung.id)).tgGruppe === 101)

console.log('\n2  Prüfen und Grenzen')
p('Telefonnummer abgewiesen', (await k.neu({ ...neueMeldung, text: 'Ruf an 0412 345 678 für Infos' }, { geraet: G1 })).daten.grund === 'nummer')
p('Link abgewiesen', (await k.neu({ ...neueMeldung, text: 'Mehr unter www.beispiel.com lesen' }, { geraet: G1 })).daten.grund === 'link')
p('Ort außerhalb Australiens abgewiesen', (await k.neu({ ...neueMeldung, lat: 52.5, lon: 13.4 }, { geraet: G1 })).daten.grund === 'ort')
p('unbekannte Art abgewiesen', (await k.neu({ ...neueMeldung, art: 'werbung' }, { geraet: G1 })).daten.grund === 'art')
p('ohne Gerätekennung abgewiesen', (await k.neu(neueMeldung, { geraet: 'xyz' })).status === 400)
for (let i = 0; i < 4; i++) await k.neu(neueMeldung, { geraet: G1, wer: '1.2.3.4' })
p('höchstens 5 je Gerät und Stunde', (await k.neu(neueMeldung, { geraet: G1, wer: '1.2.3.4' })).status === 429)
p('anderes Gerät darf weiter', (await k.neu(neueMeldung, { geraet: G2, wer: '1.2.3.4' })).status === 200)
uhr += 61 * 60 * 1000
p('nächste Stunde geht es wieder', (await k.neu(neueMeldung, { geraet: G1, wer: '1.2.3.4' })).status === 200)

console.log('\n3  Stimmen und Ablauf')
const id = e1.daten.meldung.id
let s = await k.stimme(id, 'ja', G2)
p('Stimmt noch zählt und verlängert', s.daten.meldung.ja === 1 && s.daten.meldung.ablauf > e1.daten.meldung.ablauf)
s = await k.stimme(id, 'ja', G2)
p('eine Stimme je Gerät', s.daten.meldung.ja === 1)
s = await k.stimme(id, 'nein', G2)
p('umstellbar: aus ja wird nein', s.daten.meldung.ja === 0 && s.daten.meldung.nein === 1)
const m0 = JSON.parse(sp.m.get('m/' + id))
for (let i = 0; i < 20; i++) { uhr += TAG_MS / 4; await k.stimme(id, 'ja', G3) }
p('nie länger als eine Woche nach dem Anlegen', JSON.parse(sp.m.get('m/' + id)).ablauf <= m0.erstellt + MAX_LEBEN_TAGE * TAG_MS)
uhr = m0.erstellt + 8 * TAG_MS
const liste = await k.liste()
p('abgelaufene fallen aus der Liste und aus dem Speicher', !liste.some((x) => x.id === id) && !sp.m.has('m/' + id))
p('abgelaufene bleiben in der Gruppe stehen (Verlauf)', !tgx.rufe.some((r) => r.methode === 'deleteMessage'))

console.log('\n4  Unpassend, Admin, Zurückziehen')
const e2 = await k.neu({ ...neueMeldung, art: 'tipp', text: 'Billig campen bei meinem Freund, schreib mir' }, { geraet: G4 })
const id2 = e2.daten.meldung.id
await k.unpassend(id2, G1); await k.unpassend(id2, G1); await k.unpassend(id2, G2)
p('zwei Geräte: noch sichtbar (doppelt zählt nicht)', (await k.liste()).some((x) => x.id === id2))
const vorher = tgx.rufe.length
await k.unpassend(id2, G3)
p('drei Geräte: ausgeblendet', !(await k.liste()).some((x) => x.id === id2))
p('aus der Gruppe genommen, der Admin bekommt „Wieder zeigen“ und „Löschen“', tgx.rufe.slice(vorher).some((r) => r.methode === 'deleteMessage') && tgx.rufe.slice(vorher).some((r) => r.daten.chat_id === '42' && /ausgeblendet/.test(r.daten.text) && r.daten.reply_markup.inline_keyboard[0][0].text === 'Wieder zeigen'))
p('Admin: wieder zeigen', (await k.admin('zeigen', id2)) === 'wieder sichtbar' && (await k.liste()).some((x) => x.id === id2))
p('Admin: löschen', (await k.admin('loeschen', id2)) === 'gelöscht' && !sp.m.has('m/' + id2))
const e3 = await k.neu({ ...neueMeldung, art: 'tiere', text: 'Viele Delfine am Strand, ab 7:30 Uhr', lat: -25.79, lon: 113.72, ort: 'Monkey Mia' }, { geraet: G4 })
p('Monkey Mia liegt in der Coral Coast', e3.daten.meldung.gegend === 'coral')
p('Zurückziehen mit falschem Schlüssel geht nicht', (await k.zurueck(e3.daten.meldung.id, 'falsch')).status === 403 && sp.m.has('m/' + e3.daten.meldung.id))
p('mit dem eigenen Schlüssel schon', (await k.zurueck(e3.daten.meldung.id, e3.daten.schluessel)).status === 200 && !sp.m.has('m/' + e3.daten.meldung.id))
p('ungültige id wird nicht gelesen', (await k.stimme('../../x', 'ja', G1)).status === 404)

console.log('\n5  Ohne Telegram')
const k2 = macheKern({ store: ersatzSpeicher(), env: {}, holen: async () => { throw new Error('darf nicht') }, jetzt: () => uhr, zufall })
p('Meldungen laufen auch ohne Bot', (await k2.neu(neueMeldung, { geraet: G1 })).status === 200 && (await k2.liste()).length === 1)

console.log('\n6  Funktion /api/meldungen')
const k3 = macheKern({ store: ersatzSpeicher(), env: {}, jetzt: () => uhr, zufall })
const post = (b) => new Request('https://x/api/meldungen', { method: 'POST', body: JSON.stringify(b), headers: { 'content-type': 'application/json' } })
let r = await funktion(post({ aktion: 'neu', geraet: G1, meldung: neueMeldung }), {}, { kern: k3 })
const j = await r.json()
p('POST neu', r.status === 200 && j.ok && j.schluessel)
r = await funktion(new Request('https://x/api/meldungen'), {}, { kern: k3 })
p('GET Liste', r.status === 200 && (await r.json()).meldungen.length === 1)
p('unbekannte Aktion', (await funktion(post({ aktion: 'loeschen-alle' }), {}, { kern: k3 })).status === 400)
p('kein JSON', (await funktion(new Request('https://x/api/meldungen', { method: 'POST', body: '{kaputt' }), {}, { kern: k3 })).status === 400)
p('zu groß', (await funktion(new Request('https://x/api/meldungen', { method: 'POST', body: 'x', headers: { 'content-length': '99999' } }), {}, { kern: k3 })).status === 413)
p('nicht gecacht', r.headers.get('cache-control') === 'no-store')

console.log('\n7  Bot /api/meldungen-bot')
const tg2 = ersatzTelegram()
const k4 = macheKern({ store: ersatzSpeicher(), env: ENV, holen: tg2.holen, jetzt: () => uhr, zufall })
const bp = (b, geheim = 'geheimwort-test') => new Request('https://x/api/meldungen-bot', { method: 'POST', body: JSON.stringify(b), headers: { 'x-telegram-bot-api-secret-token': geheim } })
p('ohne Geheimwort abgewiesen', (await bot(bp({}, 'falsch'), {}, { kern: k4, env: ENV })).status === 403)
p('ohne Variablen: nicht eingerichtet', (await bot(bp({}), {}, { kern: k4, env: {} })).status === 503)
await bot(bp({ message: { text: '/id', chat: { id: 4242 } } }), {}, { kern: k4, env: ENV })
p('/id nennt die Chat-ID', tg2.rufe.some((x) => x.methode === 'sendMessage' && /Chat-ID: 4242/.test(x.daten.text)))
const e4 = await k4.neu(neueMeldung, { geraet: G1 })
await bot(bp({ callback_query: { id: 'q1', from: { id: 99 }, data: 'loeschen:' + e4.daten.meldung.id } }), {}, { kern: k4, env: ENV })
p('Knopf von Fremden wirkt nicht', (await k4.liste()).length === 1)
await bot(bp({ callback_query: { id: 'q2', from: { id: 42 }, data: 'loeschen:' + e4.daten.meldung.id, message: { chat: { id: 42 }, message_id: 7 } } }), {}, { kern: k4, env: ENV })
p('Admin löscht mit einem Tipp, Knopf zeigt danach den Stand', (await k4.liste()).length === 0 && tg2.rufe.some((x) => x.methode === 'editMessageReplyMarkup' && /gelöscht/.test(x.daten.reply_markup.inline_keyboard[0][0].text)))
const einr = await bot(new Request('https://x/api/meldungen-bot?einrichten=geheimwort-test'), {}, { kern: k4, env: ENV })
p('Einrichten mit Geheimwort meldet den Bot bei Telegram an', einr.status === 200 && tg2.rufe.some((x) => x.methode === 'setWebhook' && x.daten.url === 'https://x/api/meldungen-bot' && x.daten.secret_token === 'geheimwort-test'))
p('Einrichten ohne Geheimwort nicht', (await bot(new Request('https://x/api/meldungen-bot?einrichten=raten'), {}, { kern: k4, env: ENV })).status === 403)
p('höchstens ' + MAX_AKTIV + ' in der Liste', MAX_AKTIV === 400)

console.log('\n8  Bedingtes Schreiben, Verzeichnis, Salz')
// Wie Netlify Blobs: ETag je Eintrag, onlyIfNew und onlyIfMatch; jede Operation gibt die Kontrolle kurz ab
function bedingterSpeicher() {
  const m = new Map(), tag = new Map(), rufe = { get: 0 }
  let n = 0
  return {
    m, rufe,
    async get(k) { rufe.get++; await null; return m.has(k) ? JSON.parse(m.get(k)) : null },
    async getWithMetadata(k) { rufe.get++; await null; return m.has(k) ? { data: JSON.parse(m.get(k)), etag: tag.get(k) } : null },
    async setJSON(k, v, o = {}) {
      await null
      if (o.onlyIfNew && m.has(k)) return { modified: false }
      if (o.onlyIfMatch && tag.get(k) !== o.onlyIfMatch) return { modified: false }
      m.set(k, JSON.stringify(v)); tag.set(k, 'e' + ++n)
      return { modified: true, etag: tag.get(k) }
    },
    async delete(k) { await null; m.delete(k); tag.delete(k) },
    async list({ prefix = '' } = {}) { await null; return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } },
  }
}
const geraet = (i) => i.toString(16).padStart(32, '0')
{
  const sb = bedingterSpeicher()
  const kb = macheKern({ store: sb, env: {}, jetzt: () => uhr })
  const parallel = await Promise.allSettled(Array.from({ length: 9 }, () => kb.neu(neueMeldung, { geraet: G1, wer: '9.9.9.9' })))
  const durch = parallel.filter((x) => x.status === 'fulfilled' && x.value.status === 200).length
  p('Spam-Grenze hält auch bei 9 gleichzeitigen Meldungen (höchstens 5)', durch >= 1 && durch <= 5, `durch ${durch}`)
  const idb = (await kb.liste())[0].id
  const stimmen = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => kb.stimme(idb, 'ja', geraet(100 + i), '10.0.0.' + i)))
  const gezaehlt = stimmen.filter((x) => x.status === 'fulfilled' && x.value.status === 200).length
  const ml = (await kb.liste()).find((x) => x.id === idb)
  p('6 gleichzeitige Stimmen gehen nicht verloren', ml.ja === gezaehlt && gezaehlt === 6, `ja ${ml.ja}, gezählt ${gezaehlt}`)
  sb.rufe.get = 0
  await kb.liste()
  p('Liste ist ein einziger Lesevorgang (Verzeichnis)', sb.rufe.get === 1, `gets ${sb.rufe.get}`)
  sb.m.delete('index')
  p('fehlt das Verzeichnis, baut es sich aus den Meldungen neu', (await kb.liste()).length === durch && sb.m.has('index'))
  const ein = JSON.parse(sb.m.get('m/' + idb))
  const { createHash } = await import('node:crypto')
  p('Prüfwerte mit geheimem Salz, nicht der blanke Hash', sb.m.has('geheim/salz') && ein.von !== createHash('sha256').update(G1).digest('hex').slice(0, 20))
  const kb2 = macheKern({ store: sb, env: {}, jetzt: () => uhr })
  const e5 = await kb.neu({ ...neueMeldung, text: 'Zweite Instanz soll zurückziehen können' }, { geraet: G2, wer: '8.8.8.8' })
  p('andere Funktions-Instanz nutzt dasselbe Salz (Zurückziehen klappt)', (await kb2.zurueck(e5.daten.meldung.id, e5.daten.schluessel)).status === 200)
}

{
  // Wie der lokale Netlify-Testspeicher: getWithMetadata ohne ETag. Darf nicht in Dauer-Konflikt laufen.
  const ohne = bedingterSpeicher()
  const echt = ohne.getWithMetadata
  ohne.getWithMetadata = async (k) => { const r = await echt(k); return r && { data: r.data } }
  const ko = macheKern({ store: ohne, env: {}, jetzt: () => uhr })
  const r1 = await ko.neu(neueMeldung, { geraet: G1, wer: '4.4.4.4' }), r2 = await ko.neu(neueMeldung, { geraet: G1, wer: '4.4.4.4' })
  p('Speicher ohne ETag: läuft trotzdem (ungeschützt)', r1.status === 200 && r2.status === 200 && (await ko.liste()).length === 2)
}

console.log('\n9  Missbrauch je Netzadresse')
{
  const sm = ersatzSpeicher()
  const km = macheKern({ store: sm, env: {}, jetzt: () => uhr, zufall })
  const opfer = (await km.neu({ ...neueMeldung, text: 'Gibb River Road offen, alle Furten flach' }, { geraet: G4, wer: '5.5.5.5' })).daten.meldung.id
  for (let i = 0; i < 3; i++) await km.unpassend(opfer, geraet(200 + i), '6.6.6.6')
  p('drei erfundene Geräte aus einem Netz blenden nicht aus', (await km.liste()).some((x) => x.id === opfer))
  await km.unpassend(opfer, geraet(210), '7.7.7.1'); await km.unpassend(opfer, geraet(211), '7.7.7.2')
  p('drei Geräte aus drei Netzen schon', !(await km.liste()).some((x) => x.id === opfer))
  const ziel = (await km.neu({ ...neueMeldung, text: 'Diesel in Fitzroy Crossing wieder da' }, { geraet: G4, wer: '5.5.5.5' })).daten.meldung.id
  const vorher = (await km.liste()).find((x) => x.id === ziel).ablauf
  let s9
  for (let i = 0; i < 4; i++) s9 = await km.stimme(ziel, 'nein', geraet(300 + i), '6.6.6.6')
  p('„Nicht mehr“ aus einem Netz zählt einmal, wird nicht blass', s9.daten.meldung.nein === 1)
  for (let i = 0; i < 4; i++) s9 = await km.stimme(ziel, 'ja', geraet(400 + i), '6.6.6.7')
  p('„Stimmt noch“ aus einem Netz verlängert nur einmal', s9.daten.meldung.ja === 1 && s9.daten.meldung.ablauf - vorher === TAG_MS)
  let letzte
  for (let i = 0; i < 61; i++) letzte = await km.stimme(ziel, i % 2 ? 'ja' : 'nein', geraet(500 + i), '6.6.6.8')
  p('höchstens 60 Stimmen je Netz und Stunde', letzte.status === 429)
  for (let i = 0; i < 31; i++) letzte = await km.stimme(ziel, 'ja', G3)
  p('höchstens 30 Stimmen je Gerät und Stunde', letzte.status === 429)
}

console.log('\n10  Ort und Name wie der Text geprüft, Bot in der Gruppe still')
{
  const ko = macheKern({ store: ersatzSpeicher(), env: {}, jetzt: () => uhr, zufall })
  const a = await ko.neu({ ...neueMeldung, ort: 'Ruf 0412 345 678 an', name: 'www.spamseite.com' }, { geraet: G1 })
  p('Nummer im Ort fällt weg, Link im Namen auch', a.status === 200 && a.daten.meldung.ort === '' && a.daten.meldung.name === '')
  const b = await ko.neu({ ...neueMeldung, ort: 'Monkey Mia Dolphin Resort', name: 'Kim' }, { geraet: G2 })
  p('normale Orte und Namen bleiben', b.daten.meldung.ort === 'Monkey Mia Dolphin Resort' && b.daten.meldung.name === 'Kim')
  const c = await ko.neu({ ...neueMeldung, name: 'kim@web.de' }, { geraet: G3 })
  p('Mailadresse als Name fällt weg', c.daten.meldung.name === '')
  const tg3 = ersatzTelegram()
  const k5 = macheKern({ store: ersatzSpeicher(), env: ENV, holen: tg3.holen, jetzt: () => uhr, zufall })
  await bot(bp({ message: { text: '/id@tb_bot', chat: { id: -1001, type: 'supergroup' } } }), {}, { kern: k5, env: ENV })
  p('/id in der Gruppe nach der Einrichtung: keine Antwort', !tg3.rufe.some((x) => x.methode === 'sendMessage'))
  await bot(bp({ message: { text: '/id', chat: { id: 42, type: 'private' } } }), {}, { kern: k5, env: ENV })
  p('privat antwortet er weiter', tg3.rufe.some((x) => x.methode === 'sendMessage' && /Chat-ID: 42/.test(x.daten.text)))
  await bot(bp({ message: { text: '/id', chat: { id: -1009, type: 'group' } } }), {}, { kern: k5, env: { ...ENV, TELEGRAM_GRUPPE: '' } })
  p('in der Gruppe, solange keine eingetragen ist, schon', tg3.rufe.some((x) => /Chat-ID: -1009/.test(x.daten.text)))
}

console.log('\n11  Mac-App darf die Funktion benutzen, fremde Seiten nicht')
{
  const kc = macheKern({ store: ersatzSpeicher(), env: {}, jetzt: () => uhr, zufall })
  const mit = (origin, method = 'GET', body) => funktion(new Request('https://x/api/meldungen', { method, body, headers: { origin, 'content-type': 'application/json' } }), {}, { kern: kc })
  const vor = await mit('http://127.0.0.1:8991', 'OPTIONS')
  p('Vorab-Anfrage der Mac-App: erlaubt', vor.status === 204 && vor.headers.get('access-control-allow-origin') === 'http://127.0.0.1:8991' && /POST/.test(vor.headers.get('access-control-allow-methods')) && /content-type/.test(vor.headers.get('access-control-allow-headers')))
  const fremdVor = await mit('https://boese.example', 'OPTIONS')
  p('Vorab-Anfrage einer fremden Seite: abgelehnt, ohne Freigabe', fremdVor.status === 403 && !fremdVor.headers.get('access-control-allow-origin'))
  const g = await mit('http://127.0.0.1:8991')
  p('Liste für die Mac-App mit Freigabe', g.status === 200 && g.headers.get('access-control-allow-origin') === 'http://127.0.0.1:8991' && g.headers.get('vary') === 'Origin')
  const n = await mit('http://127.0.0.1:8991', 'POST', JSON.stringify({ aktion: 'neu', geraet: G1, meldung: neueMeldung }))
  p('Melden aus der Mac-App mit Freigabe', n.status === 200 && n.headers.get('access-control-allow-origin') === 'http://127.0.0.1:8991')
  p('fremde Seite bekommt keine Freigabe', !(await mit('https://boese.example')).headers.get('access-control-allow-origin'))
  p('eigene Seite braucht keine', !(await funktion(new Request('https://x/api/meldungen'), {}, { kern: kc })).headers.get('access-control-allow-origin'))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
