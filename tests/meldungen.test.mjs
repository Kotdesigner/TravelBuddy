// Meldungen V32, App-Seite: Regeln, Melden mit Warteschlange, Laden, Stimmen, Zurückziehen, Auswahl je Route,
// Ort und Gegend, und die Einbindung in Heute, Route, Ortskachel, Mehr und Datenschutz.
// Der Datendienst spricht hier mit dem echten Server-Code, aber mit Ersatz-Speicher. Kein Netz, kein Telegram.
import fs from 'node:fs'

const ablage = new Map()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => ablage.get(k) ?? null, setItem: (k, v) => ablage.set(k, String(v)), removeItem: (k) => ablage.delete(k) } })

const R = await import('../src/lib/meldungen-regeln.js')
const M = await import('../src/lib/meldungen.js')
const { macheKern } = await import('../netlify/meldungen-kern.mjs')
const funktion = (await import('../netlify/functions/meldungen.mjs')).default
const { get } = await import('svelte/store')

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

const speicher = new Map()
const store = { async get(k) { return speicher.has(k) ? JSON.parse(speicher.get(k)) : null }, async setJSON(k, v) { speicher.set(k, JSON.stringify(v)) }, async delete(k) { speicher.delete(k) }, async list({ prefix = '' } = {}) { return { blobs: [...speicher.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } } }
const kern = macheKern({ store, env: {} })
let netz = true
const holen = async (url, opt = {}) => { if (!netz) throw new TypeError('offline'); return funktion(new Request('https://tb.test' + url, opt), {}, { kern }) }

console.log('\n1  Regeln (gleich in App und Server)')
p('Arten', R.ARTEN.join() === 'weg,tiere,tanken,camping,wetter,tipp')
p('3 Tage, höchstens eine Woche', R.TAGE === 3 && R.MAX_LEBEN_TAGE === 7)
p('Gegenden: Broome Kimberley, Karratha Pilbara, Exmouth und Monkey Mia Coral Coast', R.gegendVon(-17.96, 122.24) === 'kimberley' && R.gegendVon(-20.74, 116.85) === 'pilbara' && R.gegendVon(-21.93, 114.13) === 'coral' && R.gegendVon(-25.79, 113.72) === 'coral')
p('Gegenden: Perth, Albany Süden, Kalgoorlie Outback, Melbourne, Cairns, Berlin draußen', R.gegendVon(-31.95, 115.86) === 'mitte' && R.gegendVon(-35.02, 117.88) === 'sueden' && R.gegendVon(-30.75, 121.47) === 'outback' && R.gegendVon(-37.81, 144.96) === 'victoria' && R.gegendVon(-16.92, 145.77) === 'queensland' && R.gegendVon(52.5, 13.4) === 'australien')
p('Text: zu kurz, Nummer, Mail, Link', R.textProblem('ok') === 'kurz' && R.textProblem('Ruf 0412 345 678 an bitte') === 'nummer' && R.textProblem('schreib an kim@web.de bitte') === 'mail' && R.textProblem('siehe www.camping.com dazu') === 'link' && R.textProblem('Pentecost River nicht passierbar') === null)
p('Uhrzeiten und Kilometer sind keine Telefonnummer', R.textProblem('Ab 7:30 Uhr, km 210 bis 245, 2,89 $') === null)
p('Name gesäubert', R.nameSauber('  Kim <b> ') === 'Kim b' && R.nameSauber('0412345678') === '')
p('Vorrang: Weg vor Tipp, blasse ans Ende', (() => { const l = R.sortiere([{ art: 'tipp', erstellt: 3, ja: 0, nein: 0 }, { art: 'weg', erstellt: 1, ja: 0, nein: 3 }, { art: 'weg', erstellt: 2, ja: 0, nein: 0 }]); return l[0].art === 'weg' && l[0].erstellt === 2 && l[2].nein === 3 })())

console.log('\n2  Melden, auch im Funkloch')
const roh = { art: 'weg', text: 'Pentecost River nicht passierbar, Wasser über der Radnabe.', name: 'Kim', lat: -15.78, lon: 127.86, ort: 'Pentecost River' }
p('Fehler wie der Server', (await M.melden({ ...roh, text: 'zu' }, { online: true, holen })).fehler === 'kurz')
netz = false
const e1 = await M.melden(roh, { online: false, holen })
p('ohne Netz: gespeichert, wartet', e1.eintrag?.status === 'wartet' && get(M.meine)[0].status === 'wartet' && JSON.parse(ablage.get('tb-meldungen-meine'))[0].status === 'wartet')
await M.sendeWartende(holen)
p('Netz noch weg: wartet weiter', get(M.meine)[0].status === 'wartet')
netz = true
await M.sendeWartende(holen)
const mein = get(M.meine)[0]
p('Netz da: veröffentlicht, mit Schlüssel', mein.status === 'live' && mein.id && mein.schluessel)
p('sofort in der Liste', get(M.meldungen).liste.some((m) => m.id === mein.id))
p('Gerätekennung bleibt gleich', M.geraetId() === M.geraetId() && /^[a-f0-9]{32}$/.test(M.geraetId()))

console.log('\n3  Laden und Auswahl')
await kern.neu({ art: 'tiere', text: 'Viele Delfine am Strand, ab 7:30 Uhr', name: 'Lea', lat: -25.79, lon: 113.72, ort: 'Monkey Mia' }, { geraet: 'f'.repeat(32) })
await kern.neu({ art: 'tanken', text: 'Diesel in El Questro wieder da', name: '', lat: -16.0, lon: 127.98, ort: 'El Questro' }, { geraet: 'e'.repeat(32) })
p('laden holt alle', (await M.laden(holen)) && get(M.meldungen).liste.length === 3)
p('Stand für offline gespeichert', JSON.parse(ablage.get('tb-meldungen-cache')).liste.length === 3)
netz = false
p('ohne Netz: letzter Stand bleibt', (await M.laden(holen)) === false && get(M.meldungen).liste.length === 3)
netz = true
const route = { route: { km: 400, geometry: [[123.6, -17.3], [125.0, -16.6], [126.4, -16.1], [127.86, -15.78], [128.0, -16.0]] } }
const anR = M.anRoute(route, get(M.meldungen).liste)
p('an der Route nach km: Fluss und El Questro, nicht Monkey Mia', anR.length === 2 && anR[0].art === 'weg' && anR[0].km < anR[1].km && !anR.some((m) => m.art === 'tiere'))
p('Route ohne Geometrie nimmt die Stopps', M.anRoute({ stops: [{ lat: -17.3, lon: 123.6 }, { lat: -15.78, lon: 127.86 }] }, get(M.meldungen).liste).length >= 1)
p('am Ort Monkey Mia (15 km)', M.nahe(-25.79, 113.72, get(M.meldungen).liste).length === 1 && M.nahe(-31.95, 115.86, get(M.meldungen).liste).length === 0)
p('in der Gegend, nach Art', M.inGegend('kimberley', get(M.meldungen).liste).length === 2 && M.inGegend('kimberley', get(M.meldungen).liste, { art: 'tanken' }).length === 1)

console.log('\n4  Stimmen, unpassend, zurückziehen')
const fremd = get(M.meldungen).liste.find((m) => m.art === 'tiere')
await M.stimme(fremd.id, 'ja', holen)
p('Stimmt noch: sofort sichtbar und gezählt', get(M.meldungen).liste.find((m) => m.id === fremd.id).ja === 1 && get(M.stimmen)[fremd.id] === 'ja')
await M.stimme(fremd.id, 'nein', holen)
const nach = get(M.meldungen).liste.find((m) => m.id === fremd.id)
p('umstellen: ja weg, nein dazu', nach.ja === 0 && nach.nein === 1)
await M.unpassend(fremd.id, holen)
p('unpassend gemerkt', get(M.stimmen)['u:' + fremd.id] === true)
p('Zurückziehen der eigenen', (await M.zurueckziehen(mein.lokalId, holen)) && get(M.meine)[0].status === 'zurueck' && !get(M.meldungen).liste.some((m) => m.id === mein.id))
netz = false
const e2 = await M.melden({ ...roh, text: 'Noch eine Meldung im Funkloch' }, { online: false, holen })
p('wartende lassen sich ohne Netz zurückziehen (nicht senden)', (await M.zurueckziehen(e2.eintrag.lokalId, holen)) && get(M.meine).find((m) => m.lokalId === e2.eintrag.lokalId).status === 'zurueck')
netz = true
await M.sendeWartende(holen)
p('zurückgezogene gehen nie raus', !get(M.meldungen).liste.some((m) => m.text === 'Noch eine Meldung im Funkloch'))

console.log('\n5  Einbindung')
const app = lies('src/App.svelte'), heute = lies('src/lib/Heute.svelte'), re = lies('src/lib/RouteEditor.svelte'), ort = lies('src/lib/Ort.svelte'), vb = lies('src/lib/Verbinden.svelte'), recht = lies('src/lib/Rechtliches.svelte'), neu = lies('src/lib/MeldungNeu.svelte'), blatt = lies('src/lib/MeldungBlatt.svelte')
p('App: Melden und Ansehen überall, Seite unter Mehr', /<MeldungNeu vorlage=\{\$meldenBlatt\}/.test(app) && /<MeldungBlatt id=\{\$meldungAuf\.id\}/.test(app) && /ansicht\.unter === 'meldungen'/.test(app) && /\['mehr\/meldungen', je\('📣 Meldungen'/.test(app))
p('App: beim Start und wenn Netz kommt erst senden, dann laden', /if \(\$ready && \$online\) sendeWartende\(\)\.then\(\(\) => meldungenLaden\(\)\)/.test(app))
p('Mehr: Gruppe Teilen und verbinden mit Meldungen vorn', /punkte: \['meldungen', 'verbinden', 'teilen'\]/.test(lies('src/lib/mehr-gruppen.js')) && /id: 'meldungen', icon: '📣'/.test(lies('src/lib/mehr-eintraege.js')))
p('Heute: Mit anderen Reisenden, Meldungen auf der Fahrt oder in der Gegend, melden, Gruppe', /Mit anderen Reisenden/.test(heute) && /aufDemWeg\(\{ reise: fahrtHeute\?\.reise/.test(heute) && /liste: weg\.mitBlassen/.test(heute) && /inGegend\(g, alle\)/.test(heute) && /Hier etwas melden/.test(heute) && /Gespräch, Fragen, Fotos/.test(heute) && !/leichter bei schwachem Netz/.test(heute))
p('Route: Meldungen an der Strecke nach km, nur Auto', /anRoute\(r, \$meldungen\.liste\)/.test(re) && /Meldungen an der Strecke/.test(re) && /artVon\(r\) === 'auto'/.test(re))
p('Ortskachel: Meldungen in der Nähe und Melden im Menü', /nahe\(ort\.lat, ort\.lon, \$meldungen\.liste\)/.test(ort) && /Hier etwas melden/.test(ort))
p('Unterwegs verbinden: drei Wege oben', /Mit allen: TravelBuddy-Gruppe/.test(vb) && /Mit einzelnen: dein Kontakt-Code/.test(vb) && /vb-wege/.test(vb))
p('Melden: erst Regeln und Name, Hinweis auf Fotos in der Gruppe, keine Fotos in der App', /schritt = \$state\(regelnGelesen\(\) \? 'form' : 'regeln'\)/.test(neu) && /Foto dazu\? In der TravelBuddy-Gruppe teilen/.test(neu) && !/type="file"|capture=/.test(neu))
p('Ansehen: Stimmt noch, Nicht mehr, Unpassend; eigene zurückziehen; ohne Netz gesperrt', /Stimmt noch/.test(blatt) && /Nicht mehr/.test(blatt) && /Unpassend melden/.test(blatt) && /Zurückziehen/.test(blatt) && /disabled=\{!\$online\}/.test(blatt))
p('Datenschutz: Meldungen, 3 Tage, Bot nur wenn eingerichtet, keine IP-Adressen', /Meldungen für andere Reisende/.test(recht) && /3 Tage gespeichert/.test(recht) && /Ist der TravelBuddy-Bot eingerichtet/.test(recht) && /keine IP-Adressen/.test(recht))
p('Kein Schlüssel im Code', !/TELEGRAM_BOT_TOKEN\s*[:=]\s*['"][^'"]+['"]/.test(lies('netlify/meldungen-kern.mjs') + lies('netlify/functions/meldungen-bot.mjs')))

console.log('\n6  Ohne Telegram, Nachsehen im Funkloch, nie doppelt')
{
  // eigener Speicher, damit die Spam-Grenze aus den Abschnitten oben nicht greift
  const sp = new Map()
  const st = { async get(k) { return sp.has(k) ? JSON.parse(sp.get(k)) : null }, async setJSON(k, v) { sp.set(k, JSON.stringify(v)) }, async delete(k) { sp.delete(k) }, async list({ prefix = '' } = {}) { return { blobs: [...sp.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } } }
  const k6 = macheKern({ store: st, env: {} })
  const holen6 = async (url, opt = {}) => funktion(new Request('https://tb.test' + url, opt), {}, { kern: k6 })
  const j = await (await holen6(M.API)).json()
  p('Server ohne Bot: gruppe false', j.ok && j.gruppe === false)
  await M.laden(holen6)
  p('App merkt sich „ohne Gruppe“, auch im Zwischenspeicher', get(M.meldungen).gruppe === false && JSON.parse(ablage.get('tb-meldungen-cache')).gruppe === false)
  const tgErsatz = async () => ({ json: async () => ({ ok: true, result: { message_id: 1 } }) })
  const kMit = macheKern({ store: st, env: { TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_GRUPPE: '-1' }, holen: tgErsatz })
  await M.laden(async (url, opt = {}) => funktion(new Request('https://tb.test' + url, opt), {}, { kern: kMit }))
  p('mit Bot und Gruppe: gruppe true', get(M.meldungen).gruppe === true)
  p('Bot ohne Gruppe zählt nicht', macheKern({ store: st, env: { TELEGRAM_BOT_TOKEN: 'x' } }).inGruppe() === false)
  await M.laden(holen6)

  let posts = 0
  const zaehlen = async (url, opt = {}) => { if (opt.method === 'POST') posts++; return holen6(url, opt) }
  const kaputt = async () => { throw new TypeError('Failed to fetch') }
  const e = await M.melden({ ...roh, text: 'Nanutarra Roadhouse hat bis morgen kein Diesel mehr.', lat: -22.53, lon: 115.5, ort: 'Nanutarra' }, { online: true, holen: kaputt })
  p('Funkloch trotz „online“: wartet', e.eintrag?.status === 'wartet')
  const vorher = get(M.meldungen).liste.length
  await Promise.all([M.nachsehen({ holen: zaehlen }), M.nachsehen({ holen: zaehlen }), M.sendeWartende(zaehlen)])
  p('Nachsehen sendet, dreimal gleichzeitig trotzdem nur ein Mal', posts === 1 && get(M.meine).find((m) => m.lokalId === e.eintrag.lokalId)?.status === 'live', `POSTs ${posts}`)
  p('…und die Liste hat sie', get(M.meldungen).liste.length === vorher + 1 && get(M.meldungen).liste.some((m) => m.ort === 'Nanutarra'))
  p('Server hat sie genau einmal', (await (await holen6(M.API)).json()).meldungen.filter((m) => m.ort === 'Nanutarra').length === 1)

  let gets = 0
  const zaehlGet = async (url, opt = {}) => { if (!opt.method || opt.method === 'GET') gets++; return holen6(url, opt) }
  await M.nachsehen({ holen: zaehlGet, jetzt: get(M.meldungen).stand + 60000 })
  p('frischer Stand und nichts wartet: lädt nicht neu', gets === 0)
  await M.nachsehen({ holen: zaehlGet, jetzt: get(M.meldungen).stand + M.FRISCH_MS + 1000 })
  p('Stand älter als 10 Minuten: lädt neu', gets === 1)

  const app = lies('src/App.svelte')
  p('App sieht alle zwei Minuten und beim Zurückkommen nach', /setInterval\(sehen, 120000\)/.test(app) && /addEventListener\('visibilitychange', sehen\)/.test(app) && /meldungenNachsehen\(\)/.test(app))
  const neuBlatt = lies('src/lib/MeldungNeu.svelte'), hilfe = lies('src/lib/hilfe.js')
  p('Texte nennen die Gruppe nur, wenn der Bot sie bedient', (neuBlatt.match(/\$meldungen\.gruppe/g) || []).length === 2 && /\$meldungen\.gruppe/.test(lies('src/lib/MeldungBlatt.svelte')) && /\$meldungen\.gruppe/.test(lies('src/lib/Meldungen.svelte')))
  p('Hilfe verspricht keine Gruppe mehr', !/Meldungen erscheinen auch in der TravelBuddy-Gruppe/.test(hilfe))
}

console.log('\n7  Heute: Klapp-Zeile, offen nur wenn etwas auf dem Weg liegt')
{
  const t0 = Date.UTC(2031, 6, 10, 2)
  const mk = (id, lat, lon, extra = {}) => ({ id, art: 'tiere', text: 'Test', lat, lon, gegend: 'coral', erstellt: t0, ablauf: t0 + 86400000, ja: 0, nein: 0, ...extra })
  const fahrt = { stops: [{ name: 'Exmouth', lat: -21.93, lon: 114.13 }, { name: 'Coral Bay', lat: -23.14, lon: 113.77 }] }
  const alle = [mk('a1', -22.5, 113.96), mk('a2', -20.74, 116.85), mk('a3', -22.8, 113.86, { nein: 2 }), mk('a4', -22.6, 113.93, { art: 'weg', versteckt: true })]
  const w = M.aufDemWeg({ reise: fahrt, alle, jetzt: t0 })
  p('auf der Strecke: nur was an der Route liegt, mit km', w.art === 'strecke' && w.liste.map((m) => m.id).join() === 'a1' && w.liste[0].km > 0)
  p('blasse und ausgeblendete zählen nicht, weit weg auch nicht', !w.liste.some((m) => ['a2', 'a3', 'a4'].includes(m.id)))
  p('alle Arten zählen', M.aufDemWeg({ reise: fahrt, alle: [mk('t1', -22.5, 113.96, { art: 'tipp' }), mk('c1', -22.5, 113.96, { art: 'camping' })], jetzt: t0 }).liste.length === 2)
  const n = M.aufDemWeg({ standort: { lat: -22.52, lon: 113.97 }, alle, jetzt: t0 })
  p('ohne Fahrt: um den Standort, bis 25 km', n.art === 'naehe' && n.liste.map((m) => m.id).join() === 'a1')
  p('ohne Fahrt und ohne Standort: nichts', M.aufDemWeg({ alle, jetzt: t0 }).liste.length === 0)
  p('abgelaufen zählt nicht', M.aufDemWeg({ reise: fahrt, alle, jetzt: t0 + 2 * 86400000 }).liste.length === 0)

  const l1 = [{ id: 'a1' }], l2 = [{ id: 'a1' }, { id: 'b2' }]
  p('etwas auf dem Weg: von selbst offen', M.vonSelbstOffen(l1, []) === true)
  p('nichts auf dem Weg: zu', M.vonSelbstOffen([], []) === false)
  p('zugeklappt: bleibt zu bei derselben Meldung', M.vonSelbstOffen(l1, ['a1']) === false)
  p('neue Meldung auf dem Weg: geht wieder auf', M.vonSelbstOffen(l2, ['a1']) === true)
  M.merkeZugeklappt(['a1', 'b2'])
  p('Zuklappen wird gemerkt', M.zugeklappt().join() === 'a1,b2')
  ablage.set('tb-heute-mit-zu', '{kaputt')
  p('kaputter Speicher: kein Absturz, leer', Array.isArray(M.zugeklappt()) && M.zugeklappt().length === 0)

  const h = lies('src/lib/Heute.svelte')
  p('Heute: Kopf ist ein Knopf mit aria-expanded, Inhalt klappt', /class="ht-mit-kopf" aria-expanded=\{mitOffen\}/.test(h) && /\{#if mitOffen\}\s*<div class="ht-mit-inhalt"/.test(h) && /transition:klapp/.test(h))
  p('Heute: zu zeigt „auf deiner Strecke“, „in deiner Nähe“ oder „nichts auf deinem Weg“', /auf deiner Strecke/.test(h) && /in deiner Nähe/.test(h) && /nichts auf deinem Weg/.test(h))
  p('Heute: Zuklappen merkt, was auf dem Weg lag', /merkeZugeklappt\(zuIds\)/.test(h) && /mitAuf \?\? vonSelbstOffen\(weg\.liste, zuIds\)/.test(h))
}

console.log('\n8  „Nicht senden“ während des Sendens, Zuklappen merkt dazu')
{
  const sp8 = new Map()
  const st8 = { async get(k) { return sp8.has(k) ? JSON.parse(sp8.get(k)) : null }, async setJSON(k, v) { sp8.set(k, JSON.stringify(v)) }, async delete(k) { sp8.delete(k) }, async list({ prefix = '' } = {}) { return { blobs: [...sp8.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } } }
  const k8 = macheKern({ store: st8, env: {} })
  let freigeben
  const tor = new Promise((r) => (freigeben = r))
  const aktionen = []
  const langsam = async (url, opt = {}) => {
    const b = opt.body ? JSON.parse(opt.body) : {}
    if (b.aktion) aktionen.push(b.aktion)
    if (b.aktion === 'neu') await tor
    return funktion(new Request('https://tb.test' + url, opt), {}, { kern: k8 })
  }
  const lauf = M.melden({ ...roh, text: 'Fortescue Roadhouse heute ohne Diesel, morgen wieder', lat: -21.3, lon: 116.13, ort: 'Fortescue' }, { online: true, holen: langsam })
  await new Promise((r) => setTimeout(r, 10))
  const lokal = get(M.meine).find((m) => m.roh.ort === 'Fortescue')
  p('während des Sendens: wartet', lokal?.status === 'wartet')
  p('„Nicht senden“ geht sofort', await M.zurueckziehen(lokal.lokalId, langsam))
  freigeben()
  await lauf
  const danach = get(M.meine).find((m) => m.lokalId === lokal.lokalId)
  p('bleibt zurückgezogen, statt veröffentlicht', danach.status === 'zurueck', danach.status)
  p('Server hat sie gleich wieder entfernt', aktionen.join() === 'neu,zurueck' && (await k8.liste()).length === 0)
  p('nicht in der Liste der App', !get(M.meldungen).liste.some((m) => m.ort === 'Fortescue'))

  p('Zuklappen nimmt dazu statt zu ersetzen', M.zuklappenMit(['a1', 'b2'], []).join() === 'a1,b2' && M.zuklappenMit(['a1'], ['c3']).join() === 'c3,a1')
  p('höchstens 50 gemerkt', M.zuklappenMit(Array.from({ length: 60 }, (_, i) => 'x' + i), ['neu']).length === 50 && M.zuklappenMit(Array.from({ length: 60 }, (_, i) => 'x' + i), ['neu'])[0] === 'neu')
  p('Heute nimmt beim Zuklappen dazu', /zuklappenMit\(zuIds, weg\.liste\.map/.test(lies('src/lib/Heute.svelte')))
}

console.log('\n9  Etappe: Hinweis am zugeklappten Block')
{
  const ed = lies('src/lib/EtappeDetail.svelte')
  p('Etappe zählt Meldungen an der Anreise', /etappeMeld = \$derived\(etappe && \(etappe\.art \|\| 'auto'\) === 'auto' \? anRoute\(etappe, \$meldungen\.liste\)\.length : 0\)/.test(ed))
  p('zugeklappt steht „Meldungen an der Strecke“ am Kopf', /\{#if etappeMeld && !anreiseOffen\}<small class="ed-meld">/.test(ed) && /Meldungen an der Strecke/.test(ed))
}

console.log('\n10  Offline und Seiten ohne Server (Basic)')
{
  p('Meldungen immer an dieselbe Seite', M.API === '/api/meldungen')
  const sw = fs.existsSync(new URL('../dist/sw.js', import.meta.url)) ? lies('dist/sw.js') : ''
  p('offline im Speicher: Verbinden, Teilen, QR, QR-Erkennung, Meldungen', !sw || ['Verbinden-', 'TeilenBlatt-', 'QrCode-', 'jsQR-', 'Meldungen-'].every((n) => sw.includes('assets/' + n)))
  p('Hinweis ohne Netz im Blatt mit Leerzeichen davor', /\{#if !\$online\}\{je\(' Abstimmen/.test(lies('src/lib/MeldungBlatt.svelte')))
  // Selbst veröffentlichte Kopie ohne Funktionen: 404 oder die App selbst statt Daten
  await M.laden(async () => new Response('nicht da', { status: 404 }))
  p('404: kein Server, gemerkt', get(M.meldungen).verfuegbar === false && JSON.parse(ablage.get('tb-meldungen-cache')).verfuegbar === false)
  let gesendet = 0
  await M.sendeWartende(async () => { gesendet++; return new Response('{}') })
  p('ohne Server wird nichts gesendet', gesendet === 0)
  const k10 = macheKern({ store: { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null }, async setJSON(k, v) { this.m.set(k, JSON.stringify(v)) }, async delete(k) { this.m.delete(k) }, async list({ prefix = '' } = {}) { return { blobs: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } } }, env: {} })
  await M.laden(async (url, opt = {}) => funktion(new Request('https://tb.test' + url, opt), {}, { kern: k10 }))
  p('Server wieder da: verfügbar', get(M.meldungen).verfuegbar === true)
  await M.laden(async () => new Response('<!doctype html><title>TravelBuddy</title>', { status: 200, headers: { 'content-type': 'text/html' } }))
  p('statische Seite liefert die App statt Daten: kein Server', get(M.meldungen).verfuegbar === false)
  await M.laden(async () => new Response('Fehler', { status: 500 }))
  p('Serverfehler ändert nichts am Merker', get(M.meldungen).verfuegbar === false)
  await M.laden(async (url, opt = {}) => funktion(new Request('https://tb.test' + url, opt), {}, { kern: k10 }))
  const app = lies('src/App.svelte'), ms = lies('src/lib/Meldungen.svelte')
  p('App öffnet das Melde-Blatt ohne Server nicht, sondern erklärt es', /\{#if \$meldenBlatt && \$meldungen\.verfuegbar !== false\}<MeldungNeu/.test(app) && /Meldungen gibt es auf dieser Seite nicht, nur in TravelBuddy auf \$\{OFFIZIELL\}/.test(app))
  p('Mehr, Meldungen sagt es auch', /\{#if \$meldungen\.verfuegbar === false\}/.test(ms) && /Diese Seite hat keinen Server für Meldungen/.test(ms))
}

console.log('\n11  Eigene Meldung bleibt im Zwischenspeicher')
{
  const k11 = macheKern({ store: { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null }, async setJSON(k, v) { this.m.set(k, JSON.stringify(v)) }, async delete(k) { this.m.delete(k) }, async list({ prefix = '' } = {}) { return { blobs: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } } }, env: {} })
  const h11 = async (url, opt = {}) => funktion(new Request('https://tb.test' + url, opt), {}, { kern: k11 })
  await M.laden(h11)
  const e = await M.melden({ ...roh, text: 'Ajana Kalbarri Road nach Regen nur einspurig befahrbar', lat: -27.71, lon: 114.16, ort: 'Kalbarri' }, { online: true, holen: h11 })
  const cache = JSON.parse(ablage.get('tb-meldungen-cache'))
  p('nach dem Melden steht sie auch im Zwischenspeicher (Neustart ohne Netz)', e.eintrag?.status === 'live' && cache.liste.some((m) => m.ort === 'Kalbarri'))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
