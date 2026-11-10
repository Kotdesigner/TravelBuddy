// V34: Deinen Leuten Bescheid geben (Notfall). V35: SOS an deine Leute, Geräte, WhatsApp Business, Kurzbefehl. Nummern, Personen, SMS- und WhatsApp-Links, Texte,
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
p('Heute: SOS rechts oben im Bild neben der Musik, verdeckt keinen Text, öffnet in einem Tipp das SOS-Blatt', /<a class="hero-sos" class:leer=\{!\$notfallKontakte\.length\} href="#\/mehr\/notfall" onclick=\{\(e\) => \{ e\.preventDefault\(\); sosBlatt\.set\(true\) \}\}/.test(app) && /\.hero > \.hero-sos \{[^}]*min-height: 44px/.test(app) && /\.hero > \.hero-sos \{[^}]*right: calc\(14px \+ 44px \+ 10px\)/.test(app) && !/\.hero > \.hero-sos \{[^}]*left:/.test(app))
p('Heute: „Angekommen?“ nutzt auch das schnelle Senden', /schnellBescheid\('ok', \{ orte \}\)/.test(heute))
p('Notfall: bisheriges Teilen und Lebenszeichen bleibt, klar benannt', /Standort teilen …/.test(nf) && /Nur Lebenszeichen speichern/.test(nf))
p('App: beide Blätter überall erreichbar', /\{#if \$bescheidBlatt\}<BescheidBlatt art=\{\$bescheidBlatt\.art\}/.test(app) && /\{#if \$personBlatt\}<PersonBlatt id=\{\$personBlatt\.id \|\| null\}/.test(app))
const bb = lies('src/lib/BescheidBlatt.svelte')
p('Senden-Blatt: Empfänger abwählbar, Vorschau, SMS- und WhatsApp-Links, Lebenszeichen', /type="checkbox"/.test(bb) && /bb-vorschau/.test(bb) && /link: wege\.sms\.link/.test(bb) && /wege\.whatsapp\.map\(/.test(bb) && /href=\{s\.link\}/.test(bb) && /target=\{s\.fremd \? '_blank' : undefined\} rel=\{s\.fremd \? 'noopener noreferrer' : undefined\}/.test(bb) && /neuerCheckin\(/.test(bb))
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
  const an = { geraet: 'android' }
  p('alle nur SMS und frischer Standort: SMS direkt an alle', A.direktNummern(nurSms, hier, 'ok', jetzt, an)?.join() === '+491701234567,+491709876543')
  p('jemand mit WhatsApp: lieber das Blatt mit den Schritten', A.direktNummern([...nurSms, { id: 'c', name: 'Lena', nummer: '+61412345678', wege: ['sms', 'whatsapp'] }], hier, 'ok', jetzt, an) === null)
  p('Standort älter als 5 Minuten oder gar keiner: das Blatt holt einen neuen', A.direktNummern(nurSms, { ...hier, zeit: jetzt - 6 * 60000 }, 'ok', jetzt, an) === null && A.direktNummern(nurSms, null, 'standort', jetzt, an) === null)
  p('niemand angelegt: das Blatt (zum Anlegen)', A.direktNummern([], hier, 'ok', jetzt, an) === null)
  p('dieselbe Nummer zweimal nur einmal', A.direktNummern([nurSms[0], { ...nurSms[0], id: 'x' }], hier, 'ok', jetzt, an).length === 1)
  ud.notfallKontakte.set(nurSms)
  ud.checkins.set([])
  let geoeffnet = null
  const r = A.schnellBescheid('ok', { pos: hier, oeffne: (u) => (geoeffnet = u), jetzt, geraet: 'android', kurzbefehl: false })
  p('ein Tipp: SMS geöffnet, mit Text und beiden Nummern', r === 'sms' && /^sms:\+491701234567,\+491709876543/.test(geoeffnet) && /Coral%20Bay/.test(geoeffnet), geoeffnet)
  p('„Mir geht\'s gut“ speichert dabei ein Lebenszeichen', get(ud.checkins).length === 1)
  geoeffnet = null
  const r2 = A.schnellBescheid('standort', { pos: null, oeffne: (u) => (geoeffnet = u), jetzt, geraet: 'android', kurzbefehl: false })
  p('ohne Standort öffnet sich das Blatt, keine SMS', r2 === 'blatt' && geoeffnet === null && get(B.bescheidBlatt)?.art === 'standort')
  B.bescheidBlatt.set(null)
}

console.log('\n7  V35: Geräte, WhatsApp Business, SOS, Kurzbefehl')
{
  const UA = {
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', linux: 'Mozilla/5.0 (X11; Linux x86_64)',
  }
  p('Gerät erkannt: iPhone, iPad (als Mac mit Touch), Android, Mac, Windows, sonst andere', B.geraetArt({ ua: UA.iphone }) === 'ios' && B.geraetArt({ ua: UA.mac, touch: 5 }) === 'ios' && B.geraetArt({ ua: UA.android }) === 'android' && B.geraetArt({ ua: UA.mac }) === 'mac' && B.geraetArt({ ua: UA.windows }) === 'windows' && B.geraetArt({ ua: UA.linux }) === 'andere')
  p('SMS-App öffnet sich auf iPhone, Android und Mac, nicht am Windows-PC', B.smsGeht('ios') && B.smsGeht('android') && B.smsGeht('mac') && !B.smsGeht('windows') && !B.smsGeht('andere'))
  p('Mac nimmt das Apple-Format, Windows das andere', B.smsLink(['+491', '+612'], 'x', { geraet: 'mac' }).startsWith('sms://open?addresses=') && B.smsLink(['+491', '+612'], 'x', { geraet: 'windows' }) === 'sms:+491,+612?body=x')
  const wb = B.whatsappLink('+491701234567', 'Hi du', { geraet: 'android', app: 'business' })
  p('Android mit WhatsApp Business: Intent mit Paket com.whatsapp.w4b, Rückfall auf wa.me', wb.startsWith('intent://send?phone=491701234567&text=Hi%20du#Intent;scheme=whatsapp;package=com.whatsapp.w4b;') && wb.includes('S.browser_fallback_url=' + encodeURIComponent('https://wa.me/491701234567?text=Hi%20du')) && wb.endsWith(';end'), wb)
  p('Android mit normalem WhatsApp: Paket com.whatsapp (keine Auswahl mehr)', /package=com\.whatsapp;/.test(B.whatsappLink('+491701234567', 'x', { geraet: 'android', app: 'whatsapp' })))
  p('Android ohne Wahl, iPhone, Mac und Windows: wa.me', [['android', null], ['ios', 'business'], ['mac', 'whatsapp'], ['windows', 'business']].every(([g, a]) => B.whatsappLink('+491701234567', 'x', { geraet: g, app: a }) === 'https://wa.me/491701234567?text=x'))
  p('Namen der beiden Apps', B.whatsappAppName('business') === 'WhatsApp Business' && B.whatsappAppName('whatsapp') === 'WhatsApp')
  const leute = [{ id: 'a', name: 'Mama', nummer: '+491701234567', wege: ['sms'] }, { id: 'c', name: 'Lena', nummer: '+61412345678', wege: ['whatsapp'] }]
  const ws = B.sendewege(leute, 'SOS', { geraet: 'android', alleSms: true })
  p('SOS: auch wer nur WhatsApp hat, bekommt die SMS; WhatsApp zusätzlich', ws.sms.namen.join() === 'Mama,Lena' && ws.whatsapp.length === 1 && ws.whatsapp[0].name === 'Lena')
  p('Einzeln senden: je Person ein eigener SMS-Link', ws.sms.einzeln.length === 2 && ws.sms.einzeln[1].link === 'sms:+61412345678?body=SOS')
  const zeit = new Date(2031, 10, 10, 18, 40)
  const sos = B.bescheidText({ art: 'sos', pos: { lat: -21.931, lon: 114.127, genauigkeit: 15, zeit: +zeit - 60000 }, ort: 'bei Exmouth', zeit })
  p('SOS-Text: Hilfe und Anruf zuerst, dann Standort, Karte, Ortszeit', sos === 'SOS: Ich brauche Hilfe! Bitte ruf mich an. Standort: -21.93100, 114.12700 (± 15 m), bei Exmouth. Karte: https://maps.google.com/?q=-21.93100,114.12700 · 10.11. 18:40 Ortszeit · gesendet mit TravelBuddy', sos)
  p('SOS mit älterem Standort nennt das Alter', /, Stand vor 20 min\. Karte:/.test(B.bescheidText({ art: 'sos', pos: { lat: -21.931, lon: 114.127, zeit: +zeit - 20 * 60000 }, zeit })))
  p('SOS ohne Standort geht trotzdem', B.bescheidText({ art: 'sos', zeit }) === 'SOS: Ich brauche Hilfe! Bitte ruf mich an. Standort gerade unbekannt. 10.11. 18:40 Ortszeit · gesendet mit TravelBuddy')
  p('SOS-Text ohne Emoji, ohne Gedankenstriche, unter 260 Zeichen', !/\p{Extended_Pictographic}/u.test(sos) && !/ [–—] /.test(sos) && sos.length < 260)
  p('Kurzbefehl: Link mit Namen und Text, nur iPhone, iPad und Mac', B.kurzbefehlLink('Hallo du') === 'shortcuts://run-shortcut?name=TravelBuddy%20Bescheid&input=text&text=Hallo%20du' && B.kurzbefehlGeht('ios') && B.kurzbefehlGeht('mac') && !B.kurzbefehlGeht('android') && !B.kurzbefehlGeht('windows') && B.kurzbefehlBereit(true, 'ios') && !B.kurzbefehlBereit(false, 'ios') && !B.kurzbefehlBereit(true, 'android'))

  const A = await import('../src/lib/bescheid-aktion.js')
  const jetzt = Date.UTC(2031, 10, 10, 10, 40)
  const hier = { lat: -21.931, lon: 114.127, genauigkeit: 15, zeit: jetzt - 60000 }
  p('SOS: SMS an alle sofort, auch mit WhatsApp-Leuten und ohne Standort', A.direktNummern(leute, null, 'sos', jetzt, { geraet: 'ios' })?.join() === '+491701234567,+61412345678')
  p('am Windows-PC nie direkt eine SMS (öffnet sich dort nicht), lieber das Blatt', A.direktNummern(leute, hier, 'sos', jetzt, { geraet: 'windows' }) === null && A.direktNummern([leute[0]], hier, 'ok', jetzt, { geraet: 'windows' }) === null)
  ud.notfallKontakte.set(leute); ud.checkins.set([]); B.bescheidBlatt.set(null)
  let url = null
  const r = A.schnellBescheid('sos', { pos: hier, oeffne: (u) => (url = u), jetzt, geraet: 'android', kurzbefehl: false })
  p('SOS am Android: SMS an alle offen, danach Blatt mit WhatsApp (SMS schon erledigt)', r === 'sms' && /^sms:\+491701234567,\+61412345678\?body=SOS%3A%20Ich%20brauche%20Hilfe/.test(url) && get(B.bescheidBlatt)?.art === 'sos' && get(B.bescheidBlatt)?.smsErledigt === true, url)
  p('SOS speichert ein Lebenszeichen „SOS an deine Leute“', get(ud.checkins).length === 1 && get(ud.checkins)[0].text === 'SOS an deine Leute')
  B.bescheidBlatt.set(null); url = null
  const r2 = A.schnellBescheid('sos', { pos: null, oeffne: (u) => (url = u), jetzt, geraet: 'ios', kurzbefehl: true })
  p('iPhone mit Kurzbefehl: SOS startet den Kurzbefehl, danach Blatt zur Sicherheit', r2 === 'kurzbefehl' && url?.startsWith('shortcuts://run-shortcut?name=TravelBuddy%20Bescheid&input=text&text=SOS%3A') && get(B.bescheidBlatt)?.kurzbefehl === true, url)
  B.bescheidBlatt.set(null); url = null
  ud.notfallKontakte.set([leute[0]])
  const r3 = A.schnellBescheid('ok', { pos: hier, oeffne: (u) => (url = u), jetzt, geraet: 'mac', kurzbefehl: true })
  p('Mac mit Kurzbefehl und frischem Standort: „Mir geht\'s gut“ über den Kurzbefehl', r3 === 'kurzbefehl' && /text=Mir%20geht/.test(url), url)
  url = null
  const r4 = A.schnellBescheid('ok', { pos: hier, oeffne: (u) => (url = u), jetzt, geraet: 'android', kurzbefehl: true })
  p('Android ignoriert den Kurzbefehl (gibt es dort nicht): normale SMS', r4 === 'sms' && url?.startsWith('sms:+491701234567?body='), url)
  url = null
  const r5 = A.schnellBescheid('ok', { pos: hier, oeffne: (u) => (url = u), jetzt, geraet: 'windows', kurzbefehl: false })
  p('Windows: Blatt mit WhatsApp, Kopieren und Hinweis statt einer SMS ins Leere', r5 === 'blatt' && url === null)
  B.bescheidBlatt.set(null)

  const nf = lies('src/lib/Notfall.svelte'), app = lies('src/App.svelte'), sb = lies('src/lib/SosBlatt.svelte'), kb = lies('src/lib/KurzbefehlBlatt.svelte'), bb = lies('src/lib/BescheidBlatt.svelte'), pb = lies('src/lib/PersonBlatt.svelte')
  p('Notfall: SOS an meine Leute direkt unter 000', nf.indexOf('class="nf-000"') < nf.indexOf('class="nf-sos"') && nf.indexOf('class="nf-sos"') < nf.indexOf('class="karte nf-leute"') && /class="nf-sos" onclick=\{\(\) => sosBlatt\.set\(true\)\}/.test(nf))
  p('Notfall: Kurzbefehl nur auf iPhone und Mac, WhatsApp-Wahl nur am Android, Hinweis am Windows-PC', /\{#if kurzbefehlGeht\(geraet\)\}/.test(nf) && /\{#if geraet === 'android' && mitWhatsapp\}/.test(nf) && /\{#if geraet === 'windows'\}/.test(nf))
  p('App: SOS- und Kurzbefehl-Blatt überall erreichbar, Senden-Blatt kennt erledigte SMS und Kurzbefehl', /\{#if \$sosBlatt\}<SosBlatt /.test(app) && /\{#if \$kurzbefehlBlatt\}<KurzbefehlBlatt /.test(app) && /smsErledigt=\{!!\$bescheidBlatt\.smsErledigt\} kurzbefehl=\{!!\$bescheidBlatt\.kurzbefehl\}/.test(app))
  p('SOS-Blatt: zweiter Tipp „SOS jetzt senden“, 000 und Abbrechen, kein Countdown (Browser würde ihn blockieren)', /onclick=\{senden\}/.test(sb) && /schnellBescheid\('sos', \{ orte \}\)/.test(sb) && /SOS jetzt senden/.test(sb) && /href="tel:000"/.test(sb) && /Abbrechen/.test(sb) && !/setInterval|setTimeout/.test(sb))
  p('SOS-Blatt: ohne Personen gleich „Person anlegen“', /personBlatt\.set\(\{\}\)/.test(sb))
  p('Kurzbefehl-Blatt: Schritte, genauer Name, Schalter, Probe mit beruhigendem Text', /Nachricht senden/.test(kb) && /Kurzbefehl-Eingabe/.test(kb) && /Beim Ausführen zeigen/.test(kb) && /\{KURZBEFEHL\}/.test(kb) && /type="checkbox" checked=\{\$kurzbefehlAn\}/.test(kb) && /kein Grund zur Sorge/.test(kb))
  p('Senden-Blatt: Kurzbefehl als erster Schritt, einzeln senden, Text kopieren, Windows-Hinweis, 000 beim SOS', /kurzbefehlLink\(nachricht\)/.test(bb) && /bb-einzeln/.test(bb) && /Text kopieren/.test(bb) && /Smartphone-Link/.test(bb) && /\{#if sos\}<a class="bedien-knopf bb-000" href="tel:000">/.test(bb) && /alleSms: sos/.test(bb) && /smsGeht\(geraet\) \? \[\.\.\.smsSchritt, \.\.\.waSchritte\] : \[\.\.\.waSchritte, \.\.\.smsSchritt\]/.test(bb))
  p('Person anlegen: am Android einmal „Über welches WhatsApp sendest du?“', /const android = geraetArt\(\) === 'android'/.test(pb) && /Über welches WhatsApp sendest du\?/.test(pb) && /whatsappApp\.set\(waWahl\)/.test(pb))
  p('Hilfe, Datenschutz und Update-Fenster nennen SOS und Kurzbefehl', /SOS an deine Leute/.test(lies('src/lib/hilfe.js')) && /Kurzbefehl/.test(lies('src/lib/hilfe.js')) && /Kein Server von TravelBuddy ist beteiligt/.test(lies('src/lib/Rechtliches.svelte')) && /\['🆘', je\('SOS an deine Leute\.'/.test(lies('src/lib/UpdateHinweis.svelte')))
  p('keine Gedankenstriche in SOS- und Kurzbefehl-Blatt', ![sb, kb].some((t) => / [–—] /.test(t.replace(/\/\/.*$/gm, ''))))
  ud.notfallKontakte.set([])
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
