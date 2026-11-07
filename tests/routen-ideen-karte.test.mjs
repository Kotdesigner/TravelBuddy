// Routen-Ideen auf der echten Karte (V28): Werkseinstellungen passen zusammen (jeder Stopp und jeder
// Ort im Tagesplan steht in der App), Routenfarben gut sichtbar in hell und dunkel, echte Straßen,
// Etappenorte mit Versorgung, Orte anwählbar, getrennte Kartenschalter, Wanderungen auf der Karte.
import fs from 'node:fs'
import { stoppsAusRoute } from '../src/lib/routen-ideen.js'
import { STOPP, TAG, ETAPPENORTE, NEU_ZUR_FREIGABE, orteAmTag } from '../src/lib/routen-verweise.js'
import { kurzName, tagVonStopp } from '../src/lib/routen-daten.js'
import { FARBEN } from '../src/lib/ueberblick-gl.js'
import { istKarteDunkel, GROSS_KEY, KARTEN_KEY } from '../src/lib/karten-thema.js'
import { gesamtsuche } from '../src/lib/gesamtsuche.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const json = (f) => JSON.parse(lies(f))
const routen = json('public/routen.json'), routenEn = json('public/routen.en.json'), orte = json('public/orte.json')
const etappen = json('public/etappenorte.json'), strassen = json('public/routen-strassen.json')
const ortIds = new Set(orte.map((o) => o.id)), etIds = new Set(etappen.map((e) => e.id))
const nachId0 = new Map(orte.map((o) => [o.id, o]))

console.log('\nWerkseinstellungen passen zusammen')
const alleStopps = [...routen, ...routenEn].flatMap((r) => stoppsAusRoute(r).map((s) => s.name))
const ohne = [...new Set(alleStopps)].filter((n) => !STOPP[n])
p('Jeder Stopp jeder Routen-Idee (de und en) hat einen Eintrag', !ohne.length, ohne.join(', '))
const falsch = Object.entries(STOPP).filter(([, v]) => (v.ort ? !ortIds.has(v.ort) : !etIds.has(v.etappe)))
p('… und der zeigt auf einen Ort oder Etappenort, den es gibt', !falsch.length, falsch.map(([k]) => k).join(', '))
p('Jede Route hat ihren Tagesplan mit Orten, Tag für Tag', routen.every((r) => TAG[r.id]?.length === r.steps.length) && routenEn.every((r) => TAG[r.id]?.length === r.steps.length))
const tagIds = Object.values(TAG).flat(2)
const unbekannt = [...new Set(tagIds)].filter((id) => !ortIds.has(id) && !NEU_ZUR_FREIGABE.includes(id))
p('Jeder Ort im Tagesplan steht in orte.json (oder wartet auf Freigabe)', !unbekannt.length, unbekannt.join(', '))
const schonDa = NEU_ZUR_FREIGABE.filter((id) => ortIds.has(id))
p('Freigegebene neue Orte stehen nicht mehr auf der Warteliste', !schonDa.length, schonDa.join(', '))
p('Nichts wartet mehr auf Freigabe, die drei neuen Orte sind da (mit Bild und englischem Text)', !NEU_ZUR_FREIGABE.length && ['super_pit_lookout', 'hutt_lagoon', 'carnarvon_space_museum'].every((id) => ortIds.has(id) && fs.existsSync(new URL('../public/bilder/' + id + '.jpg', import.meta.url)) && json('public/orte.en.json')[id]?.beschreibung))
p('Neue Orte ohne Gedankenstriche im Text', ['super_pit_lookout', 'hutt_lagoon', 'carnarvon_space_museum'].every((id) => !/ [–—] /.test(nachId0.get(id).beschreibung)))
const nachId = new Map(orte.map((o) => [o.id, o]))
p('Tagesplan zeigt die neuen Orte jetzt mit (Hutt Lagoon am Tag 2–3 von Nord 1)', orteAmTag('nord-route-nord-1-kusten-klassiker-mit-insider-camps', 1, nachId).map((o) => o.id).join() === 'lesueur_np_mount_lesueur,stockyard_gully_tunnel,hutt_lagoon,kalbarri_np_murchison_station')

console.log('\nEtappenorte')
const inAus = (e) => (e.lat < -13 && e.lat > -36 && e.lon > 112 && e.lon < 130) || (e.lat < -15 && e.lat > -39.5 && e.lon > 143 && e.lon < 147)
p('Jeder Etappenort aus der Liste ist erzeugt, in WA oder an der Ostküste, mit Versorgung und Gegend', ETAPPENORTE.every((e) => etIds.has(e.id)) && etappen.every((e) => inAus(e) && typeof e.versorgung === 'object' && e.tankKm != null && e.region && ['sueden', 'norden', 'osten'].includes(e.bereich)))
const gegenden = new Set(orte.map((o) => o.region))
p('Gegend jedes Etappenorts gibt es bei den Orten', etappen.every((e) => gegenden.has(e.region)), etappen.filter((e) => !gegenden.has(e.region)).map((e) => e.id).join())
p('Ostküste mit Stützpunkten: Melbourne, Kinglake, Healesville, Cairns, Port Douglas, Atherton', ['melbourne', 'kinglake', 'healesville', 'cairns', 'port_douglas', 'atherton'].every((id) => etappen.find((e) => e.id === id)?.bereich === 'osten'))
p('Kinglake in seiner Gegend, Warburton in Victoria (nicht WA), Exmouth bei Ningaloo', etappen.find((e) => e.id === 'kinglake').region === 'Kinglake & Toolangi' && etappen.find((e) => e.id === 'warburton').lat < -37 && etappen.find((e) => e.id === 'exmouth').region === 'Ningaloo & Exmouth')
p('Kein Etappenort ist zugleich ein Ort mit Kachel', etappen.every((e) => !ortIds.has(e.id)))
p('Condingup: letzte Tankstelle vor Israelite Bay', etappen.find((e) => e.id === 'condingup')?.versorgung.fuel >= 1)
p('Tag zum Stopp gefunden (Margaret River am Tag 1)', tagVonStopp(routen[0], 'Margaret River')?.tag === 'Tag 1')

console.log('\nEchte Straßen')
const km = (a, b) => { const r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)) }
p('Jede Route hat ihren Straßenverlauf', routen.every((r) => strassen[r.id]?.length >= 50))
p('Straße beginnt und endet an den Stopps (höchstens 10 km)', routen.every((r) => { const s = stoppsAusRoute(r).filter((x) => x.lat != null), g = strassen[r.id]; return km(g[0], [s[0].lon, s[0].lat]) < 10 && km(g[g.length - 1], [s[s.length - 1].lon, s[s.length - 1].lat]) < 10 }))
p('Datei offline im App-Speicher (JSON wird vorab gespeichert)', /globPatterns: \['\*\*\/\*\.\{js,css,html,svg,json/.test(lies('vite.config.js')))

console.log('\nRoutenfarben')
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const L = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const kon = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const oklab = ([r, g, b]) => { const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s] }
const deu = ([r, g, b]) => [0.29275 * r + 0.70725 * g, 0.29275 * r + 0.70725 * g, -0.02234 * r + 0.02234 * g + b]
const de = (a, b, sim) => { let A = hex(a).map(lin), B = hex(b).map(lin); if (sim) { A = sim(A); B = sim(B) } const x = oklab(A), y = oklab(B); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) }
const modi = [['hell', (r) => r.farbe], ['dunkel', (r) => r.farbeDunkel]]
p('Jede Route hat eine Farbe für hell und eine für dunkel', [...routen, ...routenEn].every((r) => /^#[0-9a-f]{6}$/.test(r.farbe) && /^#[0-9a-f]{6}$/.test(r.farbeDunkel)))
const schwach = modi.flatMap(([m, f]) => routen.filter((r) => kon(f(r), FARBEN[m].land) < 3 || kon(f(r), FARBEN[m].meer) < 2.5).map((r) => m + ' ' + kurzName(r.titel)))
p('Mindestens 3 : 1 zum Land (2,5 : 1 zum Meer), hell und dunkel', !schwach.length, schwach.join(', '))
const wieOrte = modi.flatMap(([m, f]) => routen.filter((r) => de(f(r), FARBEN[m].punkt) < 10 || de(f(r), FARBEN[m].strasse) < 15).map((r) => m + ' ' + kurzName(r.titel)))
p('Keine Route sieht aus wie die Orte (Orange) oder die Highways', !wieOrte.length, wieOrte.join(', '))
const nah = []
for (const [m, f] of modi) for (const g of ['sued', 'nord']) {
  const l = routen.filter((r) => r.gruppe === g)
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    if (de(f(l[i]), f(l[j])) < 10 || de(f(l[i]), f(l[j]), deu) < 6) nah.push(`${m} ${kurzName(l[i].titel)}/${kurzName(l[j].titel)}`)
  }
}
p('Routen einer Gegend gut zu unterscheiden, auch bei Rot-Grün-Schwäche (mit Namen an der Linie)', !nah.length, nah.join(', '))
p('Kurzname an der Linie', kurzName(routen[0].titel) === 'Süd 1' && kurzName(routen[3].titel) === 'Rückweg' && kurzName(routenEn[4].titel) === 'North 1')

console.log('\nKarte der Routen-Ideen')
const ru = lies('src/lib/RoutenUebersicht.svelte'), ug = lies('src/lib/UeberblickKarte.svelte'), rt = lies('src/lib/Routen.svelte'), app = lies('src/App.svelte')
p('Echte Karte mit Linien, Stopps und Orten an der Strecke, sonst die gezeichnete', /<UeberblickKarte art="nummern" \{linien\} punkte=\{stoppPunkte\} orte=\{orteAnRoute\}/.test(ru) && /\{:else\}\n    <UebersichtsKarte/.test(ru))
p('Orte bis 25 km an der Strecke, Stopps nicht doppelt', /\(abstandZur\(abfahrtPunkt\(o\), geo\)\?\.km \?\? 999\) <= 25/.test(ru) && /!stoppOrte\.has\(o\.id\)/.test(ru))
p('Ort antippen: Kurzinfo wie bei Orte, Zum Ort und Einplanen', /<OrtInfo o=\{auswahl\.o\}/.test(ru) && /kachelText=\{je\('Zum Ort ↗'/.test(ru) && /onzumort=\{zuOrtAusRoute\}/.test(app) && /querySelector\('\.reise-btn'\)\?\.click\(\)/.test(app))
p('Stopp antippen: Ort mit Nummer oder Etappenort mit Versorgung und Zum Tag', /nummer=\{auswahl\.nr\} nummerFarbe=/.test(ru) && /<EtappeInfo e=\{auswahl\.etappe\} nummer=\{auswahl\.nr\}/.test(ru) && /ontag=\{auswahl\.tag \? \(\) => zumTag\(auswahl\.r, auswahl\.tag\.i\)/.test(ru) && /class="ei-versorgung"/.test(lies('src/lib/EtappeInfo.svelte')))
p('Weitere Etappenorte an der Strecke als Häuschen', /etappen=\{etappenAnRoute\}/.test(ru) && /!stoppEtappen\.has\(e\.id\) && \(abstandZur\(e, geo\)\?\.km \?\? 999\) <= 25/.test(ru))
p('Sprung aus der Suche öffnet die Route', /ziel=\{ansicht\.id\}/.test(app) && /const z = ziel; if \(z && routen\.some/.test(ru))
p('Linie mit dem Finger treffbar, Name an der Linie, Rand hell oder dunkel', /id: 'linie-treffer'/.test(ug) && /id: 'linie-name'/.test(ug) && /'line-color': f\.linieRand/.test(ug) && /'line-offset': \['get', 'versatz'\]/.test(ug))
p('Tipp: Stopp vor Ort vor Etappenort vor Linie, daneben schließt', /\['nr-kreis', 'ort-kreis', 'etappe', 'linie-treffer'\]/.test(ug) && /if \(!f\) \{ onleer\?\.\(\); return \}/.test(ug))
p('Mehrere Orte an einer Stelle: „+3“, kleiner als Stopps', /\['concat', '\+', \['to-string', \['get', 'point_count'\]\]\]/.test(ug) && /'circle-radius': \['case', haufen, 9, 5\.5\]/.test(ug))
p('Tagesplan: Orte antippbar, alte Skizze weg, Tag anspringbar', /orteAmTag\(r\.id, i, orteNachId\)/.test(rt) && /class="ri-ort" onclick=\{\(\) => onort\?\.\(o\)\}/.test(rt) && /\{#if !eingebettet\}\{@html r\.svg\}\{\/if\}/.test(rt) && /id="ri-\{r\.id\}-tag-\{i\}"/.test(rt))

console.log('\nSuche findet Etappenorte')
const g = gesamtsuche('Norseman', { etappenorte: [{ id: 'norseman', name: 'Norseman', bereich: 'sueden', region: 'Jenseits von Esperance', routeId: 'sued-ruckweg-option-goldfields-schleife', artText: 'Etappenort', routenText: 'an Rückweg' }], texte: { etappenorte: 'Etappenorte' } })
const t = g.find((x) => x.id === 'etappenorte')?.treffer[0]
p('Treffer führt zur Karte seiner Gegend und zeigt ihn dort', t?.ziel === 'orte/sueden/etappe:norseman' && /Norseman/.test(t.titel))
p('Suchblatt bekommt die Routen und lädt die Etappenorte', /<Suchblatt orte=\{\[\.\.\.orte, \.\.\.\$eigeneOrte\]\} \{routen\}/.test(app) && /ladeEtappenorte\(\)\.then/.test(lies('src/lib/Suchblatt.svelte')))

console.log('\nEtappenorte auf den Karten der Gegenden (Variante A: kleines Zeichen)')
const rk = lies('src/lib/RegionKarte.svelte'), ei = lies('src/lib/EtappeInfo.svelte')
p('Häuschen unter den Sehenswürdigkeiten (deren Nummern liegen oben), ohne eigenen Namen', ug.indexOf("id: 'etappe'") > 0 && ug.indexOf("id: 'etappe'") < ug.indexOf("...kreise,") && !/id: 'etappe'[^\n]*text-field/.test(ug) && /'icon-allow-overlap': true/.test(ug))
p('Häuschen als Bild in hell, dunkel und gewählt (oranger Rand)', /map\.on\('styleimagemissing'/.test(ug) && /'haus-an-' \+ modus, 'haus-' \+ modus/.test(ug) && /x\.strokeStyle = an \? f\.punkt/.test(ug))
p('Karte der Gegend zeigt sie, Ort und Etappenort schließen sich gegenseitig', /\{etappen\} etappeGewaehlt=\{etappeWahl\} onetappe=\{waehleEtappe\}/.test(rk) && /const waehleOrt = \(id\) => \{ etappeWahl = null;/.test(rk) && /<EtappeInfo \{e\} nah=\{vonHierAus\(e, orte, nummer\)\}/.test(rk))
p('Info: Versorgung, Von hier aus, Google Maps, Als Stopp einplanen (Fahrt bis 300 km oder neue Route)', /je\('Von hier aus:'/.test(ei) && /je\('Als Stopp einplanen'/.test(ei) && /filter\(\(x\) => x\.km <= 300\)/.test(ei) && /stopHinzufuegen\(r\.id, stopp\)/.test(ei) && /oeffneNeu\('route'/.test(ei))
const { vonHierAus } = await import('../src/lib/routen-daten.js')
const kl = etappen.find((e) => e.id === 'kinglake'), klOrte = orte.filter((o) => o.region === 'Kinglake & Toolangi')
p('Von Kinglake aus: Jehosaphat Gully am nächsten', vonHierAus(kl, klOrte)[0]?.name === 'Jehosaphat Gully' && vonHierAus(kl, klOrte).length === 3)
p('Sprung aus der Suche: Gegend auf, Etappenort gewählt', /ansicht\.id\?\.startsWith\('etappe:'\)/.test(app) && /etappeFokus\.set\(id\)\n      await zurRegion\(e\.bereich, e\.region\)/.test(app) && /if \(!x \|\| x\.region !== titel\) return/.test(rk))

console.log('\nKartendesign getrennt')
p('Zwei Speicherplätze', KARTEN_KEY === 'tb-karten-thema' && GROSS_KEY === 'tb-karte-gross-thema')
p('Große Karte dunkel, Übersichtskarten hell: geht', istKarteDunkel('dunkel', 'hell', false) && !istKarteDunkel('hell', 'hell', false))
const ka = lies('src/lib/Karte.svelte'), kt = lies('src/lib/karten-thema.js')
p('Große Karte folgt nur ihrem eigenen Schalter', /\$grossDunkel/.test(ka) && !/kartenDunkel/.test(ka))
p('Knopf ◐ unter dem Speichern-Knopf, wechselt hell und dunkel', /map\.addControl\(baueExportKnopf\([^\n]*\n    map\.addControl\(baueThemaKnopf\(\), 'top-right'\)/.test(ka) && /grossUmschalten\(get\(grossDunkel\)\)/.test(ka) && /export const grossUmschalten = \(jetztDunkel\) => grossThema\.set\(jetztDunkel \? 'hell' : 'dunkel'\)/.test(kt))

console.log('\nWander-Ideen auf der echten Karte')
const wi = lies('src/lib/WanderIdeen.svelte')
p('Echte Karte, Ausschnitt = gewählte Gegend, sonst die gezeichnete', /<UeberblickKarte \{punkte\} \{linien\} gewaehlt=\{auswahl\} onpunkt=\{zeige\} onleer=/.test(wi) && /const rahmenPunkte = \$derived\(sichtbar\.map/.test(wi) && /\{:else\}\n      <UebersichtsKarte/.test(wi))
p('Im Sommer gesperrt rot, andere Gegend grau, in deiner Liste mit Ring', /\['==', \['get', 'rot'\], 1\], f\.rot/.test(ug) && /\['==', \['get', 'aus'\], 1\], f\.blass/.test(ug) && /\['==', \['get', 'ring'\], 1\]/.test(ug))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
