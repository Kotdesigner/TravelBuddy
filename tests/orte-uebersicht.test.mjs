// Orte und Routen-Ideen: Karte oben, Gegenden zum Wählen, Inseln mit Anreise, Abstand zur Route
import fs from 'node:fs'
import { INSELN, abfahrtPunkt, istInsel, ANREISE_ZEICHEN } from '../src/lib/inseln.js'
import { stoppsAusRoute } from '../src/lib/routen-ideen.js'
import { abstandZur } from '../src/lib/wander-zuordnung.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const orte = JSON.parse(lies('public/orte.json'))
const ortMap = new Map(orte.map((o) => [o.id, o]))

console.log('\nInseln')
const inselOrte = orte.filter((o) => o.region.startsWith('Inseln'))
p('Jede Insel aus orte.json hat eine Anreise', inselOrte.every((o) => INSELN[o.id]), inselOrte.filter((o) => !INSELN[o.id]).map((o) => o.id).join(', '))
p('Keine Anreise ohne passenden Ort', Object.keys(INSELN).every((id) => ortMap.has(id)))
p('Art, Hafen, Text und Koordinaten in WA', Object.values(INSELN).every((i) => ANREISE_ZEICHEN[i.art] && i.hafen && i.text && i.lat < -13 && i.lat > -36 && i.lon > 112 && i.lon < 129))
p('Rottnest: Fähre ab Fremantle', INSELN.rottnest_island_wadjemup.art === 'faehre' && /Fremantle/.test(INSELN.rottnest_island_wadjemup.text))
p('Abstand zählt bei Inseln ab dem Hafen, sonst ab dem Ort', abfahrtPunkt(ortMap.get('rottnest_island_wadjemup')).lon === 115.745 && abfahrtPunkt(ortMap.get('lucky_bay')) === ortMap.get('lucky_bay') && istInsel({ id: 'carnac_island' }) && !istInsel({ id: 'lucky_bay' }))
const perthRoute = { id: 'r', typ: 'route', name: 'Perth', stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Mandurah', lat: -32.53, lon: 115.72 }] }
p('Rottnest liegt über Fremantle nah an einer Route ab Perth', abstandZur(abfahrtPunkt(ortMap.get('rottnest_island_wadjemup')), perthRoute)?.km < 15)

console.log('\nOrte-Seite')
const app = lies('src/App.svelte'), gk = lies('src/lib/OrteGesamtkarte.svelte'), rk = lies('src/lib/RegionKarte.svelte'), ort = lies('src/lib/Ort.svelte'), uk = lies('src/lib/UebersichtsKarte.svelte')
p('Oben nur die Gesamtkarte, darunter die Gegenden (Süden, Norden, Ostküste)', ['sueden', 'norden', 'osten'].every((b) => app.includes(`<OrteGesamtkarte regionen={${b}} offen={orteOffen.${b}} onwahl={(r) => zurRegion('${b}', r)} />`) && app.includes(`<OrteRegionen regionen={${b}} bind:offen={orteOffen.${b}} reisen={reisenOhneIdeen}`)) && !/OrteUebersicht|orteGegend|nurGegend/.test(app))
const reg = lies('src/lib/OrteRegionen.svelte')
p('Gegenden zum Auf- und Zuklappen, zu Beginn zu', /let orteOffen = \$state\(\{ sueden: \{\}, norden: \{\}, osten: \{\} \}\)/.test(app) && /aria-expanded=\{auf\}/.test(reg) && /\{#if auf\}/.test(reg))
p('Suchergebnisse stehen offen, ohne Karte', /<OrteRegionen regionen=\{treffer\} alleOffen mitKarte=\{false\}/.test(app))
p('Ring auf der Gesamtkarte klappt die Gegend auf und springt hin', /onclick=\{\(\) => onwahl\?\.\(g\.r\.titel\)\}/.test(gk) && /async function zurRegion\(tab, titel\)/.test(app) && /data-region=\{r\.titel\}/.test(reg))
p('Balken in einer Liste: der nächste legt sich über den alten', /<div class="or-liste">/.test(reg) && /\.or-balken \{ position: sticky; top: var\(--kopf-h/.test(reg) && !/<section class="region">/.test(app))
p('Gesamtkarte: Ringe mit Anzahl, auseinandergerückt, kleines Australien mit Ausschnitt', /class="gk-kreis"/.test(gk) && /class="gk-zahl"/.test(gk) && /class="gk-strich"/.test(gk) && /class="gk-irahmen"/.test(gk) && !fs.existsSync(new URL('../src/lib/LageSkizze.svelte', import.meta.url)))
p('Offene Gegend: Karte mit Nummern wie auf den Kacheln, Lageskizze in der Ecke', /<RegionKarte orte=\{r\.orte\} \{reisen\} nummer=\{nr\}/.test(reg) && /nummer=\{mitKarte \? nr\[o\.id\] : null\}/.test(reg) && /nr: nummer\[o\.id\]/.test(rk) && /class="ort-nr"/.test(ort) && /class="rk-lage"/.test(rk) && /class="uk-nr"/.test(uk))
p('Keine doppelten Gegend-Knöpfe mehr; Routen und Wanderungen rechteckig wie der Rest', !fs.existsSync(new URL('../src/lib/OrteUebersicht.svelte', import.meta.url)) && /class="bedien-raster ru-chips"/.test(lies('src/lib/RoutenUebersicht.svelte')) && /class="bedien-raster wi-chips"/.test(lies('src/lib/WanderIdeen.svelte')))
p('Inseln-Kachel nennt die Fähre', /ANREISE_ZEICHEN\[insel\.art\]/.test(ort) && /ANREISE_ZEICHEN\[insel\.art\]/.test(rk))
p('Zur Kachel springt hin und hebt sie hervor', /getElementById\('ort-' \+ id\)/.test(rk) && /classList\.add\('ort-hl'\)/.test(rk) && /\.ort-hl \{ outline/.test(lies('src/app.css')))
p('Karte der Gegend nimmt nur ihre Orte als Ausschnitt', /rahmen="punkte"/.test(rk))
p('Genaue Küste aus der Offline-Karte, nachgeladen; grob nur bis dahin', /import\('\.\/kueste-fein\.js'\)/.test(uk) && /MIN_GROB = 2\.2, MIN_FEIN = 0\.3/.test(uk) && fs.existsSync(new URL('../src/lib/kueste-fein.js', import.meta.url)))
p('Gedränge: auseinanderschieben, Häufungen als Blase mit Zahl, Ganze Karte', /function eng\(pts, r\)/.test(uk) && /class="uk-strich"/.test(uk) && /class="uk-haufen-zahl"/.test(uk) && /onclick=\{\(\) => \(lokal = h\.pts\)\}/.test(uk) && /Ganze Karte/.test(uk))
p('Kurzinfo unter der Karte mit Google Maps, Einplanen, Zur Kachel', /class="rk-info"/.test(rk) && /Zur Kachel ↓/.test(rk) && /zurKachel\(o\.id, true\)/.test(rk) && /Google Maps/.test(rk))
p('Kachel: Anreise der Insel und Abstand zur Route', /<p class="anreise">\{ANREISE_ZEICHEN\[insel\.art\]\} \{insel\.text\}<\/p>/.test(ort) && /<p class="nah-route">/.test(ort) && /abfahrtPunkt\(ort\)/.test(ort))
p('Alle Infos der Kachel bleiben (Beschreibung, Sonne, Einplanen)', /<SonneWetter/.test(ort) && /tagpill/.test(ort))

console.log('\nRouten-Ideen')
const routen = JSON.parse(lies('public/routen.json'))
p('Jede Routen-Idee hat Stopps mit Koordinaten', routen.every((r) => { const s = stoppsAusRoute(r); return s.length >= 2 && s.every((x) => x.lat != null) }))
const ru = lies('src/lib/RoutenUebersicht.svelte'), rt = lies('src/lib/Routen.svelte')
p('Übersicht mit Karte, Süden und Norden, Zeile je Route mit Mini-Karte', /<UebersichtsKarte \{linien\}/.test(ru) && /\['sued', \(\) => je\('Süden'/.test(ru) && /class="ru-mini"/.test(ru))
p('Linien nebeneinander versetzt', /versatz: \(i - \(gleich\.length - 1\) \/ 2\) \* ABSTAND/.test(ru) && /function versetze\(d, off\)/.test(uk))
p('Zeile klappt die Route auf und zu, offene Route kräftig', /onclick=\{\(\) => umschalten\(r\.id\)\}/.test(ru) && /<Routen routen=\{\[r\]\} eingebettet \/>/.test(ru) && /an: !offen \|\| offen === r\.id/.test(ru))
p('Keine lange Liste der Routenkarten mehr unter der Übersicht', !/<Routen routen=\{routenSued\}/.test(app) && /<RoutenUebersicht \{routen\} bind:gruppe=\{routenGruppe\} \/>/.test(app))
p('Routenkarte eingebettet ohne eigenen Kopf', /eingebettet = false/.test(rt) && /\{#if !eingebettet\}/.test(rt) && /import \{ stoppsAusRoute \} from '\.\/routen-ideen\.js'/.test(rt))

console.log('\nSelbst zoomen und Fenster')
p('Knöpfe plus und minus, zwei Finger, Ziehen, Strg und Mausrad', /onclick=\{\(\) => zoomUm\(1\.7\)\}/.test(uk) && /onpointerdown=\{runter\} onpointermove=\{bewege\} onpointerup=\{hoch\}/.test(uk) && /onwheel=\{rad\}/.test(uk) && /if \(!\(e\.ctrlKey \|\| e\.metaKey\)\) return/.test(uk))
p('Ungezoomt scrollt ein Finger die Seite, gezoomt verschiebt er die Karte', /\.uk \{ touch-action: pan-y;/.test(uk) && /\.uk\.zoomt \{ touch-action: none;/.test(uk))
p('Während der Geste nur verschieben, am Ende neu zeichnen', /<g transform=\{geste \?/.test(uk) && /manuell = n/.test(uk))
p('Nach dem Ziehen kein versehentlicher Tipp', /onclickcapture=\{klickFangen\}/.test(uk))
const css = lies('src/app.css')
p('Fenster klar über der Karte bei den Wander-Ideen: Schleier, Schatten, Griff', /\.karten-schleier \{/.test(css) && /\.karten-pop \{/.test(css) && /\.karten-pop::before/.test(css) && /class="wi-pop karten-pop"/.test(lies('src/lib/WanderIdeen.svelte')))

const farben = lies('src/app.css')
p('Kartenfarben Atlas in hell und dunkel: Meer, Land, Küste, Punkt, Zahl', ['--karte-meer', '--karte-land', '--karte-kueste', '--karte-punkt', '--karte-zahl'].every((v) => (farben.match(new RegExp(v + ':', 'g')) || []).length === 2))
p('Alle Übersichtskarten nutzen die Kartenfarben', /fill: var\(--karte-meer\)/.test(uk) && /class="uk-land-rand"/.test(uk) && /fill: var\(--karte-land\)/.test(gk) && /fill: var\(--karte-punkt\)/.test(gk) && /var\(--karte-punkt\)/.test(rk) && /var\(--karte-punkt\)/.test(ort))
p('Keine Namen auf der Gesamtkarte', !/gk-name|<text[^>]*>\{t\(g\.r\.titel\)\}/.test(gk))

console.log('\nWeltkugel auf Heute')
const reiseK = lies('src/lib/ReiseKarte.svelte')
p('Abspielen, Film, Tempo und Zoom in einem Menü zum Aufklappen', /class="rk-menue-knopf" aria-expanded=\{abspielMenue\}/.test(reiseK) && /\{#if abspielMenue && !spielt\}/.test(reiseK) && /abspielMenue = false; abspielen\(\)/.test(reiseK) && /abspielMenue = false; oeffneFilm\(\)/.test(reiseK))
p('Während die Reise läuft: Anhalten direkt sichtbar', /class="bedien-knopf haupt rk-stopp" onclick=\{abspielen\}/.test(reiseK))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
