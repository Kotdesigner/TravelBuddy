// Fun Facts: Vorab für die Route, live in der Nähe, Auswahl, Merken. Wikipedia nur nachgebaut.
import fs from 'node:fs'
import { get } from 'svelte/store'
import { abstandKm, routenPunkte, saeubere, saetze, bewerte, faktAusArtikel, faktenAusOrten, waehle, wikiAdresse, holePunkt, ladeFuerRoute, ladeInDerNaehe, _liveZuruecksetzen, fakten, vorabStand, routenKennung, sichereQuelle, saubereGelernt } from '../src/lib/funfacts.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('\n1  Route und Entfernung')
const perth = { lat: -31.9523, lon: 115.8613 }, freo = { lat: -32.0569, lon: 115.7439 }
p('Perth nach Fremantle etwa 16 km', Math.abs(abstandKm(perth, freo) - 16) < 2, abstandKm(perth, freo))
const reisen = [
  { id: 'alt', typ: 'route', von: '2037-01-01', tage: 2, stops: [{ name: 'Alt', lat: -20, lon: 120 }] },
  { id: 'a', typ: 'route', von: '2037-12-02', tage: 3, stops: [{ name: 'Perth', ...perth }, { name: 'Fremantle', ...freo }, { name: 'Nah', lat: -31.96, lon: 115.87 }] },
  { id: 'b', typ: 'etappe', von: '2037-12-01', tage: 2, stops: [{ name: 'Denham', lat: -25.926, lon: 113.535 }, { name: 'ohne Koordinaten' }] },
  { id: 'c', typ: 'route', stops: [{ name: 'Ohne Datum', lat: -23.14, lon: 113.78 }] },
]
const pk = routenPunkte(reisen, '2037-11-30')
p('Vergangene Routen fallen weg', !pk.some((x) => x.name === 'Alt'))
p('Nahe Punkte zählen einmal, ohne Koordinaten fällt weg', pk.length === 4 && !pk.some((x) => x.name === 'Nah' || x.name === 'ohne Koordinaten'), pk.map((x) => x.name).join())
p('Nach Datum sortiert, ohne Datum zuletzt', pk[0].name === 'Denham' && pk.at(-1).name === 'Ohne Datum')
p('Höchstens so viele Punkte wie erlaubt', routenPunkte(reisen, '2037-11-30', { max: 2 }).length === 2)
p('Kennung ändert sich mit der Route', routenKennung(reisen, '2037-11-30') !== routenKennung(reisen.slice(0, 2), '2037-11-30'))

console.log('\n2  Gute Sätze finden')
p('Vorlagenreste, Lautschrift und „englisch“-Klammern raus', saeubere('i2i3i6 Der Park (englisch Big Park) in Perth [pɜːθ] ist groß.') === 'Der Park in Perth ist groß.', saeubere('i2i3i6 Der Park (englisch Big Park) in Perth [pɜːθ] ist groß.'))
p('Keine Trennung bei Zahlen wie 3.200', saetze('Die Straße ist 3.200 km lang. Sie ist alt.').length === 2)
p('Superlativ schlägt Lageangabe', bewerte('The Murchison River is the second longest river in Western Australia.') > bewerte('It is located about 6 kilometres north east of Coral Bay.'))
p('Adressen zählen wenig', bewerte('Located at 143 Barrack Street in the central business district, it was a bar.') < 1)
p('Standardsatz „ist eine Stadt“ zählt wenig', bewerte('Kalbarri ist ein Ort in Western Australia.') < 1)
const seite = { pageid: 7, title: 'Shark Bay', fullurl: 'https://de.wikipedia.org/wiki/Shark_Bay', coordinates: [{ lat: -25.9, lon: 113.5 }], extract: 'Shark Bay ist eine Bucht in Western Australia. Sie hat mit etwa 4000 km² die weltweit größte Seegrasfläche.' }
const f = faktAusArtikel(seite, 'de')
p('Fakt nimmt den spannenden Satz', f?.text.startsWith('Sie hat mit etwa 4000 km²'), f?.text)
p('Fakt trägt Quelle, Titel, Ort und Sprache', f.quelle === seite.fullurl && f.titel === 'Shark Bay' && f.lat === -25.9 && f.id === 'wp-de-7' && f.sprache === 'de')
p('Langweiliger Artikel ergibt keinen Fakt', faktAusArtikel({ ...seite, extract: 'Ort ist eine Stadt in Australien.' }) === null)
p('Ohne Koordinaten kein Fakt', faktAusArtikel({ ...seite, coordinates: undefined }) === null)
const of = faktenAusOrten([{ id: 'x', name: 'Ort X', lat: -30, lon: 115, beschreibung: 'Schön. Hier steht der höchste Baum der Gegend mit 80 m.' }, { id: 'y', name: 'leer', lat: 1, lon: 1 }])
p('Ortsinfos der App werden zu Fakten', of.length === 1 && of[0].id === 'ort-x' && /höchste Baum/.test(of[0].text))

console.log('\n3  Auswahl')
const liste = [{ id: 'a', lat: -31.95, lon: 115.86 }, { id: 'b', lat: -31.96, lon: 115.87 }, { id: 'c', lat: -25, lon: 113 }]
p('Nur im Umkreis', waehle(liste, perth, { umkreisKm: 20 }).id === 'a' && waehle(liste, { lat: -10, lon: 130 }, { umkreisKm: 20 }) === null)
p('Noch nicht gesehene zuerst', waehle(liste, perth, { gesehen: new Set(['a']) }).id === 'b')
p('Alle gesehen: fängt von vorne an', waehle(liste, perth, { gesehen: new Set(['a', 'b']) }).id === 'a')
p('„Nächster“ überspringt den aktuellen', waehle(liste, perth, { ausser: 'a' }).id === 'b')
p('Spannender Fakt schlägt etwas näheren langweiligen', waehle([{ id: 'nah', lat: -31.9523, lon: 115.8613, wert: 0 }, { id: 'gut', lat: -31.96, lon: 115.87, wert: 5 }], perth).id === 'gut')
p('Ohne Punkt keine Auswahl', waehle(liste, null) === null)

console.log('\n4  Abrufen (nachgebaut)')
const adr = new URL(wikiAdresse({ lat: -25.92612345, lon: 113.5 }, 'de'))
p('Wikipedia-Adresse: Umkreis, Einleitung, Koordinaten, CORS', adr.host === 'de.wikipedia.org' && adr.searchParams.get('generator') === 'geosearch' && adr.searchParams.get('ggscoord') === '-25.92612|113.50000' && adr.searchParams.get('origin') === '*' && adr.searchParams.get('exintro') === '1')
const antwort = (lang, seiten) => Promise.resolve({ ok: true, status: 200, json: async () => ({ query: { pages: Object.fromEntries(seiten.map((s) => [s.pageid, s])) } }) })
let aufrufe = []
const laden = (u) => { const url = new URL(u); aufrufe.push(url.host); return url.host.startsWith('de.') ? antwort('de', []) : antwort('en', [{ ...seite, pageid: 9, extract: 'The reef is the largest fringing reef in Australia, about 260 km long.' }]) }
const pkt = await holePunkt({ lat: -23.1, lon: 113.8 }, 'de', { laden })
p('Ohne deutschen Artikel kommt der englische', pkt.length === 1 && pkt[0].sprache === 'en' && aufrufe.join() === 'de.wikipedia.org,en.wikipedia.org')
const zuViel = await holePunkt({ lat: 1, lon: 1 }, 'de', { laden: () => Promise.resolve({ ok: false, status: 429 }) }).catch((e) => e.message)
p('Zu viele Abfragen wird erkannt', zuViel === 'limit')

fakten.set({})
aufrufe = []
const warte = () => Promise.resolve()
const ladenRoute = (u) => { aufrufe.push(u); return antwort('de', [{ ...seite, pageid: aufrufe.length }]) }
await ladeFuerRoute(reisen, { laden: ladenRoute, warte, heute: '2037-11-30' })
p('Vorab: jeder Routenpunkt einmal abgefragt', aufrufe.length === 4, aufrufe.length)
p('Vorab: Fakten gespeichert', Object.keys(get(fakten)).length === 4)
p('Vorab: Fortschritt fertig', get(vorabStand).laeuft === false && get(vorabStand).fertig === 4 && get(vorabStand).gesamt === 4 && !!get(vorabStand).zeit)

_liveZuruecksetzen(); aufrufe = []
const jetzt = 1_000_000_000
await ladeInDerNaehe(perth, { laden: ladenRoute, jetzt })
await ladeInDerNaehe({ lat: perth.lat + 0.001, lon: perth.lon }, { laden: ladenRoute, jetzt: jetzt + 60e3 })
p('Live: nicht bei jeder Bewegung neu', aufrufe.length === 1, aufrufe.length)
await ladeInDerNaehe(freo, { laden: ladenRoute, jetzt: jetzt + 11 * 60e3 })
p('Live: nach Weg und Zeit wieder', aufrufe.length === 2, aufrufe.length)

console.log('\n5  Sicherheit')
p('Quelle: nur https von Wikipedia', sichereQuelle('https://de.wikipedia.org/wiki/Perth') === 'https://de.wikipedia.org/wiki/Perth' && sichereQuelle('javascript:alert(1)') === '' && sichereQuelle('http://de.wikipedia.org/x') === '' && sichereQuelle('https://wikipedia.org.boese.de/x') === '' && sichereQuelle('data:text/html,x') === '')
const praepariert = saubereGelernt([{ id: 'a', text: 'Eins', quelle: 'javascript:alert(1)' }, { id: 'a', text: 'Doppelt' }, { text: 'ohne Kennung' }, { text: 'ohne Kennung' }, null, 'Müll', { id: 'b', text: 42 }, { id: 'c', text: '   ' }])
p('Präparierte Liste: gefährlicher Link raus, Doppelte raus, Müll raus', praepariert.length === 2 && praepariert[0].quelle === '' && praepariert[1].id.startsWith('ff-'), JSON.stringify(praepariert))
p('Keine Liste ergibt leer', saubereGelernt('x').length === 0 && saubereGelernt(undefined).length === 0)
p('Fakt aus Wikipedia hat immer eine sichere Quelle', faktAusArtikel({ ...seite, fullurl: 'javascript:alert(1)' }).quelle === 'https://de.wikipedia.org/?curid=7')
p('Anzeige und Merken nutzen die Prüfung', /href=\{sichereQuelle\(aktuell\.quelle\)\}/.test(lies('lib/FunFactKarte.svelte')) && /saubereGelernt\(e\?\.gelernt\)/.test(lies('lib/funfacts-merken.js')) && /\{#each saubereGelernt\(e\.gelernt\) as g \(g\.id\)\}/.test(lies('lib/TagebuchLese.svelte')))
p('Texte nie als HTML', !/\{@html/.test(lies('lib/FunFactKarte.svelte') + lies('lib/FunFacts.svelte') + lies('lib/FunFactUnterwegs.svelte')) && /esc\(g\.text\)/.test(lies('lib/TagebuchLese.svelte')))

console.log('\n6  Eingebaut')
const app = lies('App.svelte'), heute = lies('lib/Heute.svelte'), bar = lies('lib/BottomBar.svelte'), gr = lies('lib/mehr-gruppen.js'), tl = lies('lib/TagebuchLese.svelte'), mk = lies('lib/funfacts-merken.js')
p('Unter Mehr in der Gruppe Unterhaltung', /punkte: \['funfacts', 'musik', 'quiz'\]/.test(gr) && /\['mehr\/funfacts', je\('💡 Fun Facts'/.test(app) && /\{ id: 'funfacts', icon: '💡'/.test(fs.readFileSync(new URL('../src/lib/mehr-eintraege.js', import.meta.url), 'utf8')))
p('Seite eingebunden', /ansicht\.unter === 'funfacts'\}\s*<FunFacts \/>/.test(app))
p('Karte auf Heute', /<FunFactKarte ersatz=\{faktOrt\} \{orte\} \{geh\} \/>/.test(heute))
p('Hinweis beim Fahren in der App', /<FunFactUnterwegs orte=/.test(app))
const fu = lies('lib/FunFactUnterwegs.svelte')
p('Fahrt-Hinweis: verfolgt den Standort nur sichtbar und mit Freigabe', /folgeStandort\(\)/.test(fu) && /\$standortStatus !== 'erlaubt'/.test(fu) && /visibilityState === 'visible'/.test(fu))
p('Fahrt-Hinweis: kein Hinweis beim Öffnen, Ort bleibt gespeichert, erst nach 3 km', /if \(ersterFix\)/.test(fu) && /localStorage\.setItem\(KEY_ORT/.test(fu) && /AB_KM = 3/.test(fu))
p('Vorab-Laden automatisch mit Netz, verzögert, auch nach Routenänderung', /vorabWennNoetig\(get\(reisen\)/.test(app) && /\$reisen\n    if \(laden \|\| !\$online\) return/.test(app))
p('Merken legt Fakt am Logbuch-Tag ab', /updateJournalEintrag\(id, \{ gelernt:/.test(mk) && /neuerJournalEintrag\(\{ datum/.test(mk))
p('Tagebuch zeigt „Heute gelernt“ (Ansicht und Druck)', (tl.match(/Heute gelernt/g) || []).length >= 2 && /saubereGelernt\(e\.gelernt\)\.length\n/.test(tl))
p('Reparatur kennt die Liste gelernt', /LISTEN_FELDER = \['gelernt'/.test(lies('lib/heilen.js')))
p('Datenschutz nennt Fun Facts', /Fun Facts/.test(lies('lib/Rechtliches.svelte')))
p('Kein Schlüssel nötig', !/api_key|apikey|Bearer/.test(lies('lib/funfacts.js')))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
