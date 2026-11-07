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
const app = lies('src/App.svelte'), ou = lies('src/lib/OrteUebersicht.svelte'), ort = lies('src/lib/Ort.svelte'), uk = lies('src/lib/UebersichtsKarte.svelte')
p('Karte und Gegenden über Süden, Norden und Ostküste', ['sueden', 'norden', 'osten'].every((b) => app.includes(`<OrteUebersicht regionen={${b}} reisen={reisenOhneIdeen} bind:gegend={orteGegend.${b}} />`) && app.includes(`{#each nurGegend(${b}, orteGegend.${b}) as r}`)))
p('Gegend wählen zeigt nur deren Kacheln, unbekannte Gegend zeigt alle', /const nurGegend = \(liste, g\) => \(g === 'alle' \|\| !liste\.some\(\(r\) => r\.titel === g\) \? liste : liste\.filter/.test(app))
p('Inseln-Knopf mit Fähre', /inselGegend\(r\)\}⛴️/.test(ou))
p('Punkt antippen springt zur Kachel und hebt sie hervor', /getElementById\('ort-' \+ id\)/.test(ou) && /classList\.add\('ort-hl'\)/.test(ou) && /\.ort-hl \{ outline/.test(lies('src/app.css')))
p('Karte bleibt beim Wählen stehen (ganzer Reiter)', /rahmen="alle-punkte"/.test(ou) && /rahmen === 'alle-punkte'/.test(uk))
p('Genaue Küste aus der Offline-Karte, nachgeladen; grob nur bis dahin', /import\('\.\/kueste-fein\.js'\)/.test(uk) && /MIN_GROB = 2\.2, MIN_FEIN = 0\.3/.test(uk) && fs.existsSync(new URL('../src/lib/kueste-fein.js', import.meta.url)))
p('Gedränge: heranzoomen, auseinanderschieben, Häufungen als Blase mit Zahl', /zoomBeiEnge/.test(ou) && /function eng\(pts, r\)/.test(uk) && /class="uk-strich"/.test(uk) && /class="uk-haufen-zahl"/.test(uk) && /onclick=\{\(\) => \(lokal = h\.pts\)\}/.test(uk) && /Ganze Karte/.test(uk))
p('Pop-up am Punkt mit Mehr Infos zum Ort, Einplanen, Google Maps', /onpunkt=\{zeige\}/.test(ou) && /Mehr Infos zum Ort ↓/.test(ou) && /einplanen\(o\.id\)/.test(ou) && /closest\?\.\('\.ou-pop, \.uk-punkt'\)/.test(ou))
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
p('Fenster klar über der Karte: Schleier, Schatten, Griff', /\.karten-schleier \{/.test(css) && /\.karten-pop \{/.test(css) && /\.karten-pop::before/.test(css) && /class="ou-pop karten-pop"/.test(ou) && /class="wi-pop karten-pop"/.test(lies('src/lib/WanderIdeen.svelte')))

console.log('\nWeltkugel auf Heute')
const rk = lies('src/lib/ReiseKarte.svelte')
p('Abspielen, Film, Tempo und Zoom in einem Menü zum Aufklappen', /class="rk-menue-knopf" aria-expanded=\{abspielMenue\}/.test(rk) && /\{#if abspielMenue && !spielt\}/.test(rk) && /abspielMenue = false; abspielen\(\)/.test(rk) && /abspielMenue = false; oeffneFilm\(\)/.test(rk))
p('Während die Reise läuft: Anhalten direkt sichtbar', /class="bedien-knopf haupt rk-stopp" onclick=\{abspielen\}/.test(rk))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
