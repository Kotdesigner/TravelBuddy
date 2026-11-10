// V34: Deinen Leuten Bescheid geben (Notfall). Nummern, Personen, SMS- und WhatsApp-Links, Texte,
// Speichern, Backup und Zusammenführen, Einbindung in Notfall, Heute, Bereit-Check und Datenschutz.
// Ausführen: node tests/bescheid.test.mjs  (kein Netz, keine echten Dienste)
import fs from 'node:fs'
import { get } from 'svelte/store'
import * as B from '../src/lib/bescheid.js'
import * as ud from '../src/lib/userdata.js'
import { fuehreZusammen } from '../src/lib/zusammenfuehren.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\n1  Nummern und Personen')
p('mit +49 und Leerzeichen', B.nummerSauber('+49 170 1234567') === '+491701234567')
p('mit 0049 und Bindestrichen', B.nummerSauber('0049 170-123 4567') === '+491701234567')
p('Australien +61', B.nummerSauber('+61 412 345 678') === '+61412345678')
p('ohne Ländervorwahl abgelehnt, mit Grund', B.nummerSauber('0170 1234567') === '' && B.nummerProblem('0170 1234567') === 'vorwahl')
p('leer und Unsinn', B.nummerProblem('') === 'leer' && B.nummerProblem('+12') === 'form' && B.nummerProblem('+49 abc') === 'form')
const k = B.bereinigeKontakt({ rolle: 'mama', nummer: '+49 170 1234567' })
p('Rolle ergibt den Namen, SMS ist Vorgabe', k.name === 'Mama' && k.wege.join() === 'sms' && k.nummer === '+491701234567')
p('unbekannte Rolle wird „Andere“, Name gekürzt', B.bereinigeKontakt({ rolle: 'chef', name: 'x'.repeat(50), nummer: '+491701234567' }).rolle === 'andere' && B.bereinigeKontakt({ name: 'x'.repeat(50), nummer: '+491701234567' }).name.length === 30)
p('ohne gültige Nummer keine Person', B.bereinigeKontakt({ rolle: 'papa', nummer: '0170' }) === null)
p('WhatsApp bleibt WhatsApp, auch aus älterem Eintrag mit weg', B.bereinigeKontakt({ nummer: '+491701234567', wege: ['whatsapp'] }).wege.join() === 'whatsapp' && B.bereinigeKontakt({ nummer: '+491701234567', weg: 'whatsapp' }).wege.join() === 'whatsapp')
p('beides möglich, Reihenfolge immer SMS vor WhatsApp, Unsinn fällt weg', B.bereinigeKontakt({ nummer: '+491701234567', wege: ['whatsapp', 'brieftaube', 'sms'] }).wege.join() === 'sms,whatsapp' && B.wegeText({ wege: ['sms', 'whatsapp'] }) === 'SMS + WhatsApp')
p('ohne Weg wird SMS genommen', B.bereinigeKontakt({ nummer: '+491701234567', wege: [] }).wege.join() === 'sms')
p('höchstens fünf Personen', B.MAX_PERSONEN === 5)

console.log('\n2  Links')
const txt = 'Mir geht\'s gut & alles ok?\nJa: Ä'
p('iPhone, eine Person', B.smsLink(['+491701234567'], txt, { ios: true }) === 'sms:+491701234567&body=' + encodeURIComponent(txt))
p('iPhone, mehrere: sms://open?addresses=', B.smsLink(['+491701234567', '+61412345678'], 'Hallo', { ios: true }) === 'sms://open?addresses=+491701234567,+61412345678&body=Hallo')
p('Android, mehrere: sms:a,b?body=', B.smsLink(['+491701234567', '+61412345678'], 'Hallo', { ios: false }) === 'sms:+491701234567,+61412345678?body=Hallo')
p('ohne Nummern kein Link', B.smsLink([], 'x') === null)
p('Text sicher verpackt (& ? Zeilenumbruch Umlaut)', !/[&?\n]/.test(decodeURIComponent('x').concat(B.smsLink(['+491'], txt, { ios: false }).split('?body=')[1])) && decodeURIComponent(B.smsLink(['+491'], txt, { ios: false }).split('?body=')[1]) === txt)
p('WhatsApp ohne Plus', B.whatsappLink('+491701234567', 'Hi du') === 'https://wa.me/491701234567?text=Hi%20du')
p('iPhone erkannt, auch iPad als Mac mit Touch, Android nicht', B.istIOS({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }) && B.istIOS({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', touch: 5 }) && !B.istIOS({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', touch: 0 }) && !B.istIOS({ ua: 'Mozilla/5.0 (Linux; Android 15)' }))
const leute = [{ id: 'a', name: 'Mama', nummer: '+491701234567', wege: ['sms'] }, { id: 'b', name: 'Papa', nummer: '+491709876543', wege: ['sms'] }, { id: 'c', name: 'Lena', nummer: '+61412345678', wege: ['whatsapp'] }]
const w = B.sendewege(leute, 'Hallo', { ios: true })
p('ein SMS-Link für alle SMS-Leute, je ein WhatsApp-Link', w.sms.namen.join() === 'Mama,Papa' && /addresses=\+491701234567,\+491709876543/.test(w.sms.link) && w.whatsapp.length === 1 && w.whatsapp[0].link.startsWith('https://wa.me/61412345678'))
p('nur WhatsApp: kein SMS-Knopf', B.sendewege([leute[2]], 'x').sms === null)
const mamaBeides = { id: 'm', name: 'Mama', nummer: '+491701234567', wege: ['sms', 'whatsapp'] }
const w2 = B.sendewege([mamaBeides, leute[1]], 'Hallo', { ios: false })
p('dieselbe Nummer zweimal angelegt: nur einmal in SMS und WhatsApp', (() => { const d = B.sendewege([mamaBeides, { ...mamaBeides, id: 'm2' }], 'x', { ios: false }); return d.sms.namen.length === 1 && d.whatsapp.length === 1 && !/,/.test(d.sms.link.split('?')[0]) })())
p('Mama mit beidem: in der SMS an alle und eigener WhatsApp-Knopf', w2.sms.namen.join() === 'Mama,Papa' && w2.whatsapp.length === 1 && w2.whatsapp[0].name === 'Mama' && w2.whatsapp[0].link.startsWith('https://wa.me/491701234567'))

console.log('\n3  Ort und Text')
p('bei Coral Bay (bis 5 km)', B.naechsterOrt(-23.14, 113.77) === 'bei Coral Bay')
p('etwa 23 km von Exmouth', /^etwa \d+ km von /.test(B.naechsterOrt(-22.13, 114.13) || ''), B.naechsterOrt(-22.13, 114.13))
p('weit weg von allem: kein Ortsname', B.naechsterOrt(52.52, 13.4) === null)
p('Orte der App zählen mit', B.naechsterOrt(-20.001, 120.001, [{ name: 'Mein Camp', lat: -20, lon: 120 }]) === 'bei Mein Camp')
const zeit = new Date(2031, 10, 10, 18, 40)
const gut = B.bescheidText({ art: 'ok', pos: { lat: -23.14, lon: 113.77 }, ort: 'bei Coral Bay', zeit })
p('„Mir geht\'s gut“ mit Ort, Uhrzeit, Karte', gut === "Mir geht's gut. Bin gerade bei Coral Bay, 10.11. 18:40 Ortszeit. Karte: https://maps.google.com/?q=-23.14000,113.77000 · gesendet mit TravelBuddy", gut)
p('ohne Standort nur Uhrzeit', B.bescheidText({ art: 'ok', zeit }) === "Mir geht's gut. 10.11. 18:40 Ortszeit · gesendet mit TravelBuddy")
const st = B.bescheidText({ art: 'standort', pos: { lat: -23.14, lon: 113.77, genauigkeit: 12.4 }, ort: 'bei Coral Bay', zeit })
p('Standort mit Koordinaten und Genauigkeit', st.startsWith('Mein Standort: -23.14000, 113.77000 (± 12 m), bei Coral Bay. Karte: https://maps.google.com/?q=') && st.includes('10.11. 18:40 Ortszeit'), st)
p('Leerzeichen vor „·“ bleiben stehen (Svelte kürzt sie am Anfang eines Blocks)', /\{` · ± \$\{pos\.genauigkeit\} m`\}/.test(lies('src/lib/BescheidBlatt.svelte')) && /<small>\{` · \$\{rollenName\(p\.rolle\)\}`\}<\/small>/.test(lies('src/lib/Notfall.svelte')))
p('kurz genug für SMS, ohne Gedankenstriche', gut.length < 200 && st.length < 200 && ![gut, st].some((t) => / [–—] /.test(t)))

console.log('\n4  Speichern, Backup, Zusammenführen')
{
  ud.notfallKontakte.set([])
  const mama = ud.speichereNotfallKontakt(B.bereinigeKontakt({ rolle: 'mama', nummer: '+491701234567' }))
  p('angelegt mit id und Stempel', mama.id && mama.geaendert && get(ud.notfallKontakte).length === 1)
  const neu = ud.speichereNotfallKontakt({ ...mama, name: 'Mutti' })
  p('ändern ersetzt, legt nicht doppelt an', get(ud.notfallKontakte).length === 1 && get(ud.notfallKontakte)[0].name === 'Mutti' && neu.geaendert >= mama.geaendert)
  const papa = ud.speichereNotfallKontakt(B.bereinigeKontakt({ rolle: 'papa', nummer: '+491709876543' }))
  ud.loescheNotfallKontakt(papa.id)
  p('löschen hinterlässt einen Lösch-Vermerk fürs Zusammenführen', get(ud.notfallKontakte).length === 1 && (get(ud.grabsteine).notfallKontakte || []).some((g) => g.id === papa.id))
  const sauber = ud.saeubereBackup({ notfallKontakte: get(ud.notfallKontakte), journal: [] })
  p('Backup nimmt sie mit', Array.isArray(sauber.notfallKontakte) && sauber.notfallKontakte[0].name === 'Mutti')
  p('kaputte Liste im Backup fällt weg statt abzustürzen', !('notfallKontakte' in ud.saeubereBackup({ notfallKontakte: 'kaputt', journal: [] })))
  const r = fuehreZusammen({ notfallKontakte: [] }, { notfallKontakte: get(ud.notfallKontakte), exportiert: new Date().toISOString() })
  p('Zusammenführen bringt sie aufs andere Gerät', (r.ergebnis.notfallKontakte || []).some((x) => x.name === 'Mutti'))
  const u = lies('src/lib/userdata.js')
  p('eigener Topf in der Gerätedatenbank, Notspeicher, Laden, Wiederherstellen', /KEY_KONTAKTE = 'notfall-kontakte-v1'/.test(u) && /autoSave\(notfallKontakte, KEY_KONTAKTE\)/.test(u) && /\[KEY_KONTAKTE\]: 'notfallKontakte'/.test(u) && /notfallKontakte: get\(notfallKontakte\)/.test(u) && /if \(Array\.isArray\(p\.notfallKontakte\)\) notfallKontakte\.set\(p\.notfallKontakte\)/.test(u))
}

console.log('\n5  Einbindung')
const nf = lies('src/lib/Notfall.svelte'), app = lies('src/App.svelte'), heute = lies('src/lib/Heute.svelte')
p('Notfall: Abschnitt mit Personen, „Mir geht\'s gut“ und „Mein Standort senden“ mit schnellem Senden', /Deinen Leuten Bescheid geben/.test(nf) && /schnellBescheid\('ok', \{ orte, pos: posFuerBescheid\(\) \}\)/.test(nf) && /schnellBescheid\('standort', \{ orte, pos: posFuerBescheid\(\) \}\)/.test(nf) && /personBlatt\.set\(\{\}\)/.test(nf))
p('Notfall-Reihenfolge: 000, deine Leute, Standort, nächste Hilfe, zugeklappt Teilen und Lebenszeichen', (() => { const a = [nf.indexOf('class="nf-000"'), nf.indexOf('class="karte nf-leute"'), nf.indexOf('class="karte standort"'), nf.indexOf("t('🧭 Nächste Hilfe')"), nf.indexOf('<details class="karte nf-mehr">')]; return a.every((x) => x > 0) && a.every((x, i) => !i || x > a[i - 1]) })())
p('000 groß als Anruf-Link, 112, 106 und RFDS klein darunter', /<a class="nf-000" href="tel:000">/.test(nf) && /NOTRUF\.filter\(\(n\) => !n\.haupt\)/.test(nf) && /\.nf-000 \{[^}]*min-height: 76px/.test(nf))
p('Standort bestimmt sich beim Öffnen, gilt dann für die ganze App', /onMount\(\(\) => \{ if \(!pos\) ortBestimmen\(\) \}\)/.test(nf) && /standort\.set\(\{ lat: pos\.lat, lon: pos\.lon, genauigkeit: pos\.acc, zeit: Date\.now\(\) \}\)/.test(nf))
p('Heute: SOS rechts oben im Bild neben der Musik, verdeckt keinen Text, führt in einem Tipp zum Notfall', /<a class="hero-sos" href="#\/mehr\/notfall"/.test(app) && /geh\('mehr\/notfall'\)/.test(app) && /\.hero > \.hero-sos \{[^}]*min-height: 44px/.test(app) && /\.hero > \.hero-sos \{[^}]*right: calc\(14px \+ 44px \+ 10px\)/.test(app) && !/\.hero > \.hero-sos \{[^}]*left:/.test(app))
p('Heute: „Angekommen?“ nutzt auch das schnelle Senden', /schnellBescheid\('ok', \{ orte \}\)/.test(heute))
p('Notfall: bisheriges Teilen und Lebenszeichen bleibt, klar benannt', /Standort teilen …/.test(nf) && /Nur Lebenszeichen speichern/.test(nf))
p('App: beide Blätter überall erreichbar', /\{#if \$bescheidBlatt\}<BescheidBlatt art=\{\$bescheidBlatt\.art\}/.test(app) && /\{#if \$personBlatt\}<PersonBlatt id=\{\$personBlatt\.id \|\| null\}/.test(app))
const bb = lies('src/lib/BescheidBlatt.svelte')
p('Senden-Blatt: Empfänger abwählbar, Vorschau, SMS- und WhatsApp-Links, Lebenszeichen', /type="checkbox"/.test(bb) && /bb-vorschau/.test(bb) && /link: wege\.sms\.link/.test(bb) && /\.\.\.wege\.whatsapp\.map/.test(bb) && /href=\{s\.link\}/.test(bb) && /target=\{s\.fremd \? '_blank' : undefined\} rel=\{s\.fremd \? 'noopener noreferrer' : undefined\}/.test(bb) && /neuerCheckin\(/.test(bb))
p('Senden-Blatt: ohne Standort kein „Standort senden“', /const gesperrt = \$derived\(art === 'standort' && !pos\)/.test(bb))
const pb = lies('src/lib/PersonBlatt.svelte')
p('Person anlegen: Rollen, Nummer als Telefonfeld, Kontakte nur wo möglich', /ROLLEN as \[r\]/.test(pb) && /type="tel" inputmode="tel"/.test(pb) && /'contacts' in navigator/.test(pb))
p('Person anlegen: klare Frage „Wie soll … Bescheid bekommen?“ mit Per SMS, Per WhatsApp, Beides', /Bescheid bekommen\?/.test(pb) && /type="radio" name="pb-weg"/.test(pb) && /id: 'sms', wege: \['sms'\]/.test(pb) && /id: 'whatsapp', wege: \['whatsapp'\]/.test(pb) && /id: 'beides', wege: \['sms', 'whatsapp'\]/.test(pb) && /erst SMS, dann WhatsApp/.test(pb))
p('Heute: am Tagesziel „Angekommen? Kurz Bescheid geben“, einmal am Tag wegtippbar', /<= 3 \? \{ nach:/.test(heute) && /Kurz Bescheid geben/.test(heute) && /ANKUNFT_KEY/.test(heute) && /\$notfallKontakte\.length/.test(heute))
p('Bereit für unterwegs: Punkt „Wichtige Personen angelegt“', /id: 'kontakte', titel: je\('Wichtige Personen angelegt'/.test(lies('src/lib/OfflineCheck.svelte')))
p('Datenschutz: nur Gerät und Backup, gesendet über SMS oder WhatsApp', /Deinen Leuten Bescheid geben/.test(lies('src/lib/Rechtliches.svelte')) && /überträgt sie an keinen Server/.test(lies('src/lib/Rechtliches.svelte')))
p('Hilfe hinter dem ⓘ', /bescheid: \{/.test(lies('src/lib/hilfe.js')) && /<InfoKnopf id="bescheid" \/>/.test(nf))
p('Zusammenführen kennt die Liste', /\['notfallKontakte', je\('Notfallkontakte', 'Emergency contacts'\), false\]/.test(lies('src/lib/zusammenfuehren.js')))
p('keine Gedankenstriche in den neuen Texten', ![nf.slice(nf.indexOf('nf-leute'), nf.indexOf('Anders teilen und Lebenszeichen')), bb, pb, lies('src/lib/bescheid.js')].some((t) => / [–—] /.test(t.replace(/\/\/.*$/gm, ''))))

p('Senden-Blatt: Schritte nacheinander, nächster leuchtet, Häkchen, am Ende Rückfrage', /class:haupt=\{s\.key === naechster\}/.test(bb) && /erledigt\[s\.key\] \? '✓' : i \+ 1/.test(bb) && /Alles geöffnet/.test(bb) && /Nacheinander, \$\{schritte\.length\} Schritte/.test(bb))

console.log('\n6  Schnell senden')
{
  const A = await import('../src/lib/bescheid-aktion.js')
  const jetzt = Date.UTC(2031, 10, 10, 10, 40)
  const nurSms = [{ id: 'a', name: 'Mama', nummer: '+491701234567', wege: ['sms'] }, { id: 'b', name: 'Papa', nummer: '+491709876543', wege: ['sms'] }]
  const hier = { lat: -23.1405, lon: 113.7712, genauigkeit: 14, zeit: jetzt - 60000 }
  p('alle nur SMS und frischer Standort: SMS direkt an alle', A.direktNummern(nurSms, hier, 'ok', jetzt)?.join() === '+491701234567,+491709876543')
  p('jemand mit WhatsApp: lieber das Blatt mit den Schritten', A.direktNummern([...nurSms, { id: 'c', name: 'Lena', nummer: '+61412345678', wege: ['sms', 'whatsapp'] }], hier, 'ok', jetzt) === null)
  p('Standort älter als 5 Minuten oder gar keiner: das Blatt holt einen neuen', A.direktNummern(nurSms, { ...hier, zeit: jetzt - 6 * 60000 }, 'ok', jetzt) === null && A.direktNummern(nurSms, null, 'standort', jetzt) === null)
  p('niemand angelegt: das Blatt (zum Anlegen)', A.direktNummern([], hier, 'ok', jetzt) === null)
  p('dieselbe Nummer zweimal nur einmal', A.direktNummern([nurSms[0], { ...nurSms[0], id: 'x' }], hier, 'ok', jetzt).length === 1)
  ud.notfallKontakte.set(nurSms)
  ud.checkins.set([])
  let geoeffnet = null
  const r = A.schnellBescheid('ok', { pos: hier, oeffne: (u) => (geoeffnet = u), jetzt })
  p('ein Tipp: SMS geöffnet, mit Text und beiden Nummern', r === 'sms' && /^sms:\+491701234567,\+491709876543/.test(geoeffnet) && /Coral%20Bay/.test(geoeffnet), geoeffnet)
  p('„Mir geht\'s gut“ speichert dabei ein Lebenszeichen', get(ud.checkins).length === 1)
  geoeffnet = null
  const r2 = A.schnellBescheid('standort', { pos: null, oeffne: (u) => (geoeffnet = u), jetzt })
  p('ohne Standort öffnet sich das Blatt, keine SMS', r2 === 'blatt' && geoeffnet === null && get(B.bescheidBlatt)?.art === 'standort')
  B.bescheidBlatt.set(null)
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
