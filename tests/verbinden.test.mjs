// Unterwegs verbinden (V31): Kontakt-Code, Kontakte von unterwegs, Orte und Routen teilen, externe Gruppen.
// Ausführen: node tests/verbinden.test.mjs  (kein Netz, kein echter Dienst)
import fs from 'node:fs'

// Kleiner Ersatz für localStorage, bevor das Modul lädt
const ablage = new Map()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => ablage.get(k) ?? null, setItem: (k, v) => ablage.set(k, String(v)), removeItem: (k) => ablage.delete(k) } })

const V = await import('../src/lib/verbinden.js')
const { get } = await import('svelte/store')

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\n1  Packen')
const roh = { n: 'Jörg 🦘', s: [['Perth', -31.95, 115.86, 2]] }
p('hin und zurück, auch Umlaute und Emoji', JSON.stringify(V.entpacke(V.packe(roh))) === JSON.stringify(roh))
p('nur Zeichen für Links: A–Z, a–z, 0–9, - und _', /^[A-Za-z0-9_-]+$/.test(V.packe({ x: '???>>>///+++' })))
p('Unsinn ergibt null', V.entpacke('%%%') === null && V.entpacke('') === null && V.entpacke('abc!') === null)
p('Liste statt Objekt ergibt null', V.entpacke(V.packe([1, 2])) === null)
p('zu lang ergibt null', V.entpacke('a'.repeat(7000)) === null)

console.log('\n2  Eingaben')
p('Telegram: @name, t.me/name und name', V.telegramName('@steve_oz') === 'steve_oz' && V.telegramName('https://t.me/steve_oz') === 'steve_oz' && V.telegramName('steve_oz') === 'steve_oz')
p('Telegram: zu kurz, Ziffer vorn, Sonderzeichen fallen weg', !V.telegramName('abc') && !V.telegramName('1steve') && !V.telegramName('steve oz') && !V.telegramName('javascript:alert(1)'))
p('Signal: Link aus der App und Nutzername', V.signalWert('https://signal.me/#eu/AbC123_-x') === 'https://signal.me/#eu/AbC123_-x' && V.signalWert('steve.42') === 'steve.42')
p('Signal: fremde Adressen und Unsinn fallen weg', !V.signalWert('https://evil.example/#eu/x') && !V.signalWert('javascript:alert(1)') && !V.signalWert('http://signal.me/#eu/abcd'))
p('WhatsApp: +49, 0049 und Leerzeichen', V.whatsappNummer('+49 170 1234567') === '491701234567' && V.whatsappNummer('0049 (170) 123-4567') === '491701234567')
p('WhatsApp: ohne Ländervorwahl oder zu kurz fällt weg', !V.whatsappNummer('0170 1234567') && !V.whatsappNummer('+49 123'))
p('Links zu den Messengern', V.telegramLink('@steve_oz') === 'https://t.me/steve_oz' && V.whatsappLink('+61 412 345 678') === 'https://wa.me/61412345678' && V.signalLink('steve.42') === null)
p('Text ohne Steuerzeichen, gekürzt', V.text('a\u0000b\n  c', 60) === 'a b c' && V.text('x'.repeat(99), 40).length === 40)

console.log('\n3  Kontakt-Code')
const prof = { name: 'Kim', telegram: '@kim_oz', signal: 'kim.42', whatsapp: '+49 170 1234567', zeigen: { telegram: true, signal: true } }
const k = V.codeInhalt(prof)
p('WhatsApp ist ohne ausdrückliches Einschalten nie im Code', !k.wa && k.tg === 'kim_oz' && k.sg === 'kim.42')
p('mit Einschalten kommt die Nummer dazu', V.codeInhalt({ ...prof, zeigen: { ...prof.zeigen, whatsapp: true } }).wa === '491701234567')
p('Ungültiges kommt nicht in den Code', !V.hatWeg(V.codeInhalt({ name: 'X', telegram: 'ab', signal: 'nix' })))
const link = V.kontaktLink(prof, 'https://beispiel.app/')
p('Link führt auf mehr/verbinden/k/…', link.startsWith('https://beispiel.app/#/mehr/verbinden/k/'))
const pfad = V.pfadAusCode(link)
p('Gescannter Link von anderer Adresse gibt den Pfad in dieser App', pfad?.startsWith('mehr/verbinden/k/'))
p('Fremde Codes werden nicht geöffnet', V.pfadAusCode('https://evil.example/') === null && V.pfadAusCode('#/mehr/backup') === null && V.pfadAusCode('WIFI:S:x;;') === null)
const gelesen = V.leseKontakt(pfad.split('/').pop())
p('Kontakt kommt heil an', gelesen?.name === 'Kim' && gelesen.telegram === 'kim_oz' && gelesen.signal === 'kim.42' && !gelesen.whatsapp)
p('Ohne einen Weg oder falsche Version: kein Kontakt', V.leseKontakt(V.packe({ v: 1, n: 'X' })) === null && V.leseKontakt(V.packe({ v: 2, n: 'X', tg: 'steve_oz' })) === null)
p('Untergeschobenes wird gesäubert', (() => { const x = V.leseKontakt(V.packe({ v: 1, n: '<b>Hi</b>', tg: 'javascript:alert(1)', wa: '+49 170 1234567' })); return x && !x.telegram && x.whatsapp === '491701234567' && x.name === '<b>Hi</b>' })())

// Code zeichnen wie QrCode.svelte und mit jsQR wieder lesen wie QrScanner.svelte
const qrcode = (await import('qrcode-generator')).default
const jsQR = (await import('jsqr')).default
function rundreise(inhalt) {
  const q = qrcode(0, 'M'); q.addData(inhalt, 'Byte'); q.make()
  const n = q.getModuleCount(), zelle = 4, rand = 4 * zelle, w = n * zelle + 2 * rand
  const px = new Uint8ClampedArray(w * w * 4).fill(255)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x))
    for (let dy = 0; dy < zelle; dy++) for (let dx = 0; dx < zelle; dx++) { const i = ((rand + y * zelle + dy) * w + rand + x * zelle + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0 }
  return jsQR(px, w, w)?.data
}
p('QR-Code des Kontakts lässt sich wieder lesen, Link unverändert', rundreise(link) === link)
const langeRoute = V.teilLink(V.routePaket({ name: 'Perth → Kununurra', stops: Array.from({ length: 10 }, (_, i) => ({ name: 'Ort Nummer ' + i, lat: -31.9 + i, lon: 115.8 + i, naechte: 1 })) }), 'https://travelbuddy-v1-wa.netlify.app/')
p('auch eine Route mit 10 Stopps', rundreise(langeRoute) === langeRoute)

console.log('\n4  Kontakte von unterwegs')
const a = V.kontaktMerken({ name: 'Lea', telegram: 'lea_reist' }, { ort: 'Karijini', datum: '2031-12-09' })
p('merken mit Ort und Datum', a?.name === 'Lea' && a.ort === 'Karijini' && a.datum === '2031-12-09')
V.kontaktMerken({ name: 'Lea und Tom', telegram: 'lea_reist' }, { ort: 'Exmouth', datum: '2031-12-12' })
const ks = get(V.kontakte)
p('derselbe Mensch nur einmal, erstes Treffen bleibt, Name frisch', ks.length === 1 && ks[0].name === 'Lea und Tom' && ks[0].ort === 'Karijini' && ks[0].datum === '2031-12-09')
p('steht auch im Speicher des Geräts', JSON.parse(ablage.get(V.KONTAKTE_KEY)).length === 1)
p('ohne Weg wird nichts gemerkt', V.kontaktMerken({ name: 'Niemand' }) === null)
p('erkennt Gemerkte', V.istGemerkt({ telegram: '@lea_reist' }) && !V.istGemerkt({ telegram: 'jemand_anders' }))
V.kontaktLoeschen(ks[0].id)
p('löschen', get(V.kontakte).length === 0)

console.log('\n5  Ort und Route teilen')
const ort = { id: 'karijini', name: 'Karijini NP', lat: -22.4867123, lon: 118.4498765, region: 'Pilbara', beschreibung: 'Schluchten und Pools', notiz: 'privat', bericht: 'privat', bilder: ['x'], tagebuch: [{ text: 'privat' }] }
const op = V.ortPaket(ort)
p('Ort aus der App: nur Name, Lage, Gegend und id, keine Notizen', JSON.stringify(Object.keys(op).sort()) === JSON.stringify(['id', 'la', 'lo', 'n', 'r', 't', 'v']) && !JSON.stringify(op).includes('privat'))
p('eigener Ort: mit kurzer Beschreibung, weil der andere ihn nicht kennt', V.ortPaket({ ...ort, id: 'eigen-abc' }).b === 'Schluchten und Pools')
p('Lage auf 5 Stellen (etwa 1 m)', op.la === -22.48671 && op.lo === 118.44988)
p('eigener Ort: ohne id, der andere hat ihn nicht', !('id' in V.ortPaket({ ...ort, id: 'eigen-abc' })))
const og = V.leseGeteilt('o', V.packe(op))
p('Ort kommt heil an', og?.typ === 'ort' && og.name === 'Karijini NP' && og.id === 'karijini' && og.lat === -22.48671)
p('Ort-Link ist kurz: unter 200 Zeichen', V.teilLink(op, 'https://travelbuddy-v1-wa.netlify.app/').length < 200)
const route = { name: 'Carnarvon → Exmouth', art: 'auto', allrad: true, von: '2031-12-10', etappeId: 'e1', route: { km: 367 }, umleitung: {},
  stops: [{ name: 'Carnarvon', lat: -24.88, lon: 113.66, naechte: 1, notiz: 'privat' }, { name: 'Coral Bay', lat: -23.14, lon: 113.77, naechte: 2 }, { name: 'Exmouth', lat: -21.93, lon: 114.13 }] }
const rp = V.routePaket(route)
p('Route: ohne Datum, Etappe, Rechnung und Notizen', !('von' in rp) && !JSON.stringify(rp).includes('e1') && !JSON.stringify(rp).includes('privat') && !JSON.stringify(rp).includes('367'))
const rg = V.leseGeteilt('r', V.packe(rp))
p('Route kommt heil an, mit Nächten und 4WD', rg?.typ === 'route' && rg.stops.length === 3 && rg.stops[1].naechte === 2 && rg.allrad === true && rg.art === 'auto')
p('höchstens 30 Stopps', V.routePaket({ name: 'Lang', stops: Array.from({ length: 50 }, (_, i) => ({ name: 'S' + i, lat: -30, lon: 115 })) }).s.length === 30)
p('weniger als 2 Stopps ist keine Route', V.leseGeteilt('r', V.packe({ v: 1, t: 'r', n: 'X', s: [['A', 1, 2, 0]] })) === null)
p('falscher Typ oder unbekanntes Verkehrsmittel', V.leseGeteilt('o', V.packe(rp)) === null && V.leseGeteilt('r', V.packe({ ...rp, a: 'rakete' })).art === 'auto')
p('Lage außerhalb der Erde fällt weg', V.leseGeteilt('o', V.packe({ v: 1, t: 'o', n: 'X', la: 200, lo: -500 })).lat === null)
p('Link führt auf mehr/verbinden/r/…', V.teilLink(rp, 'https://beispiel.app/').startsWith('https://beispiel.app/#/mehr/verbinden/r/'))
p('Typische Route passt in einen QR-Code', V.teilLink(V.routePaket({ name: 'Perth → Kununurra', stops: Array.from({ length: 10 }, (_, i) => ({ name: 'Ort Nummer ' + i, lat: -31.9 + i, lon: 115.8 + i, naechte: 1 })) }), 'https://travelbuddy-v1-wa.netlify.app/').length <= V.QR_MAX)

console.log('\n6  Externe Gruppen')
p('nur Einladungslinks von Telegram und Discord, ohne Kennzeichen als fremde Gruppe', JSON.stringify(V.bereinigeGruppen({ telegram: 'https://t.me/wa_roadtrip', discord: 'https://discord.gg/abc123' })) === JSON.stringify({ telegram: 'https://t.me/wa_roadtrip', discord: 'https://discord.gg/abc123', telegramEigen: false, discordEigen: false }))
p('alles andere fällt weg', JSON.stringify(V.bereinigeGruppen({ telegram: 'https://t.me.evil.com/x', discord: 'javascript:alert(1)' })) === JSON.stringify({ telegram: '', discord: '', telegramEigen: false, discordEigen: false }) && V.bereinigeGruppen({ telegram: 'http://t.me/abc' }).telegram === '')
const g1 = await V.ladeGruppen(async () => ({ ok: true, json: async () => ({ telegram: 'https://t.me/wa_roadtrip', discord: '' }) }))
p('lädt und merkt sich den Stand', g1.telegram === 'https://t.me/wa_roadtrip' && JSON.parse(ablage.get(V.GRUPPEN_KEY)).telegram === 'https://t.me/wa_roadtrip')
const g2 = await V.ladeGruppen(async () => { throw new Error('offline') })
p('ohne Netz bleibt der letzte Stand', g2.telegram === 'https://t.me/wa_roadtrip')
const datei = JSON.parse(lies('public/gruppen.json'))
const ausgeliefert = V.bereinigeGruppen(datei)
p('ausgeliefert: eigene TravelBuddy-Gruppe auf Telegram mit gültigem Einladungslink, kein Discord', ausgeliefert.telegram === datei.telegram && /^https:\/\/t\.me\/\+/.test(ausgeliefert.telegram) && ausgeliefert.telegramEigen === true && ausgeliefert.discord === '' && ausgeliefert.discordEigen === false)
p('eigen nur mit gültigem Link und ausdrücklichem true', V.bereinigeGruppen({ telegram: '', telegramEigen: true }).telegramEigen === false && V.bereinigeGruppen({ telegram: 'https://t.me/abc_def', telegramEigen: 'ja' }).telegramEigen === false)

console.log('\n7  Einbindung')
const app = lies('src/App.svelte'), heute = lies('src/lib/Heute.svelte'), ortS = lies('src/lib/Ort.svelte'), re = lies('src/lib/RouteEditor.svelte'), recht = lies('src/lib/Rechtliches.svelte'), vb = lies('src/lib/verbinden.js')
p('Mehr → Unterwegs verbinden, in der Gruppe Teilen und verbinden', /\['mehr\/verbinden', je\('🤝 Unterwegs verbinden'/.test(app) && /punkte: \['meldungen', 'verbinden', 'teilen'\]/.test(lies('src/lib/mehr-gruppen.js')))
p('Seite mit Unterpfad (k, o, r) und Sprung zum Ort', /<Verbinden id=\{ansicht\.id\} orte=\{\[\.\.\.orte, \.\.\.\$eigeneOrte\]\} \{geh\} zuort=\{zuOrt\} \/>/.test(app))
p('Gruppen-Links einmal nach dem Start laden', /ladeGruppen\(\)/.test(app))
p('Heute: Abschnitt nur mit Link, getrennt, ohne Inhalte aus der Gruppe', /\{#if \$gruppen\.telegram \|\| \$gruppen\.discord\}/.test(heute) && /rel="noopener noreferrer"/.test(heute) && /border: 1\.5px dashed/.test(heute))
p('Heute: eigene Gruppe heißt TravelBuddy-Gruppe und sagt, wer sie betreut; fremde bleiben als extern gekennzeichnet', /\$gruppen\.telegramEigen \? je\('TravelBuddy-Gruppe auf Telegram'/.test(heute) && /\{#if eigen\}\{je\('Öffnet Telegram\. Betreut von TravelBuddy/.test(heute) && /\{#if fremd\}\{je\('Externe Gruppen sind nicht von TravelBuddy betrieben/.test(heute) && /keine amtlichen Informationen/.test(heute))
p('Datenschutz: TravelBuddy-Gruppe vom Anbieter betreut, Nachrichten bei Telegram, Melden an die Admins', /Die TravelBuddy-Gruppe auf Telegram betreut der oben genannte Anbieter/.test(recht) && /Die Nachrichten liegen bei Telegram/.test(recht) && /den Admins oder über die Kontaktdaten oben melden/.test(recht))
p('Ortskachel: Ort teilen im Einplanen-Menü', /📤 Ort teilen/.test(ortS) && /<TeilenBlatt paket=\{ortPaket\(ort\)\}/.test(ortS))
p('Route: Route teilen neben Google Maps', /📤 Route teilen/.test(re) && /<TeilenBlatt paket=\{routePaket\(r\)\}/.test(re))
p('Datenschutz: Abschnitt zu Verbinden, Teilen und externen Gruppen', /Unterwegs verbinden, teilen und externe Gruppen/.test(recht) && /macht sie sich nicht zu eigen/.test(recht))
p('Kein Server: verbinden.js holt nur die Gruppen-Datei', (vb.match(/fetch|holen\(/g) || []).length <= 3 && !/https?:\/\/(?!t\.me|wa\.me|signal\.me|discord)/.test(vb.replace(/\/\/.*$/gm, '')))
p('Update-Fenster (ab V31) nennt Verbinden und Teilen', /UPDATE_VERSION = '1\.(29|[3-9]\d)'/.test(lies('src/lib/update-hinweis.js')) && /Unterwegs verbinden\./.test(lies('src/lib/UpdateHinweis.svelte')) && /Orte und Routen teilen\./.test(lies('src/lib/UpdateHinweis.svelte')))
p('Info-Knopf erklärt Verbinden', /verbinden: \{/.test(lies('src/lib/hilfe.js')) && /<InfoKnopf id="verbinden" \/>/.test(lies('src/lib/Verbinden.svelte')))

console.log('\n8  Nach der Prüfung (9.11.)')
ablage.set(V.KONTAKTE_KEY, '{}')
const V2 = await import('../src/lib/verbinden.js?kaputt')
p('kaputter Speicherwert: Modul lädt trotzdem, Kontakte leer', Array.isArray(get(V2.kontakte)) && get(V2.kontakte).length === 0)
ablage.set(V.KONTAKTE_KEY, '[{"id":"k1","name":"A","telegram":"abcde"},null,7,{"name":"ohne id"}]')
const V3 = await import('../src/lib/verbinden.js?gemischt')
p('nur brauchbare Einträge bleiben', get(V3.kontakte).length === 1 && get(V3.kontakte)[0].id === 'k1')
const qs = lies('src/lib/QrScanner.svelte'), vbs = lies('src/lib/Verbinden.svelte')
p('Scanner: schließt man vor der Freigabe, geht die Kamera sofort wieder aus', /if \(zu_ \|\| !video\) \{ s\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\); return \}/.test(qs) && /onDestroy\(\(\) => \{ zu_ = true; stopp\(\) \}\)/.test(qs))
p('Scanner: eingebauter Leser nur mit qr_code, sonst und bei Fehlern jsQR', /getSupportedFormats/.test(qs) && /formate\.includes\('qr_code'\)/.test(qs) && /if \(!jsqrAktiv\) \{ jsqrAktiv = true; leser = await jsqrLeser\(\) \}/.test(qs))
p('Scanner: ohne https eine passende Meldung', /isSecureContext/.test(qs) && /sichere Verbindung \(https\)/.test(qs))
p('Vorschläge nur einmal je Kontakt oder Route, „keine Etappe“ und leeres Feld bleiben', /if \(id === vorbelegt\) return/.test(vbs) && !/!zielEtappe\) zielEtappe =/.test(vbs) && !/!ortGetroffen\) ortGetroffen =/.test(vbs))
p('Eigener Link: geht Teilen nicht, steht er zum Kopieren da', /eigenerLink = true/.test(vbs) && /class="vb-link" readonly value=\{link\}/.test(vbs))
p('Seite und Teilen-Fenster laden erst beim Öffnen, nicht beim Start', /\{#await import\('\.\/lib\/Verbinden\.svelte'\)/.test(app) && /\{#await import\('\.\/TeilenBlatt\.svelte'\)/.test(ortS) && /\{#await import\('\.\/TeilenBlatt\.svelte'\)/.test(re) && !/import (Verbinden|TeilenBlatt) from/.test(app + ortS + re))

{
  // Netlify-Kopfzeilen: camera=() hat die Kamera der eigenen Seite gesperrt, der Scanner lief nur lokal
  const kopf = fs.readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
  const pp = kopf.match(/Permissions-Policy:\s*(.+)/)?.[1] || ''
  p('Live erlaubt die Kamera für die eigene Seite (Kontakt-Code scannen)', /camera=\(self\)/.test(pp) && !/camera=\(\)/.test(pp))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
