// Orte-Karten auf der echten Offline-Karte (V27): Grenzen, Highways, Parks, Städte, zoombar bis
// ganz Australien, hinein nur bis zur sauberen Grenze, kleines Australien mit Ausschnitt,
// Kartendesign hell oder dunkel unter Mehr → Design. Dazu: Land mitten im Land (Kinglake).
import fs from 'node:fs'
import { istKarteDunkel, KARTEN_KEY, KARTEN_THEMEN } from '../src/lib/karten-thema.js'
import { MAX_ZOOM, MIN_ZOOM, GRENZEN, FARBEN, grundEbenen, kreisEbenen, rahmenUm, UEBERBLICK_NAME, UEBERBLICK_URL } from '../src/lib/ueberblick-gl.js'
import { LAND_FEIN } from '../src/lib/kueste-fein.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\nKartendesign hell oder dunkel')
p('Drei Wahlen, eigener Speicherplatz', KARTEN_THEMEN.join() === 'auto,hell,dunkel' && KARTEN_KEY === 'tb-karten-thema')
p('Eigene Wahl gewinnt gegen die App', istKarteDunkel('dunkel', 'hell', false) === true && istKarteDunkel('hell', 'dunkel', true) === false)
p('„Wie die App“ folgt der App', istKarteDunkel('auto', 'dunkel', false) === true && istKarteDunkel('auto', 'hell', true) === false)
p('App auf Auto: dann zählt das System', istKarteDunkel('auto', 'auto', true) === true && istKarteDunkel('auto', 'auto', false) === false)
const de = lies('src/lib/Design.svelte'), app = lies('src/App.svelte'), css = lies('src/app.css')
p('Unter Design: Abschnitt Karten mit zwei Schaltern (Übersichtskarten, Große Karte), je Wie die App, Hell, Dunkel', /<h2>\{je\('Karten', 'Maps'\)\}<\/h2>/.test(de) && /\[kartenThema, \$kartenThema, je\('Übersichtskarten'/.test(de) && /\[grossThema, \$grossThema, je\('Große Karte'/.test(de) && /\['auto', je\('Wie die App', 'Like the app'\)\], \['hell', t\('Hell'\)\], \['dunkel', t\('Dunkel'\)\]/.test(de) && /onclick=\{\(\) => wahl\.set\(m\)\}/.test(de))
p('Gleich beim Start gesetzt (data-karte am html)', /import '\.\/lib\/karten-thema\.js'/.test(app) && /setAttribute\('data-karte'/.test(lies('src/lib/karten-thema.js')))
p('Kartenfarben hängen an data-karte und stehen nach dem dunklen App-Block', css.indexOf(":root[data-karte='hell']") > css.indexOf(":root[data-theme='dark'] {\n  --karte-meer") && css.indexOf(":root[data-karte='dunkel']") > 0)
p('Hell und dunkel mit denselben Farben-Namen', Object.keys(FARBEN.hell).join() === Object.keys(FARBEN.dunkel).join())

console.log('\nGroße Karte unter Plan')
const ka = lies('src/lib/Karte.svelte')
const grund = ka.slice(ka.indexOf('const GRUND = {'), ka.indexOf('const faerbe'))
const schluessel = (teil) => [...teil.matchAll(/(?:^|[\s,{])'?([a-z-]+)'?: \{ '/g)].map((m) => m[1]).sort().join()
const hell = grund.slice(grund.indexOf('hell: {'), grund.indexOf('dunkel: {')), dunkel = grund.slice(grund.indexOf('dunkel: {'))
p('Grundfarben hell und dunkel für dieselben Ebenen', schluessel(hell) && schluessel(hell) === schluessel(dunkel), schluessel(hell) + ' / ' + schluessel(dunkel))
p('Stil startet in der gewählten Farbe, Wechsel ohne Neuaufbau', /layers: faerbe\(\[/.test(ka) && /\], \$grossDunkel\),/.test(ka) && /\$effect\(\(\) => \{ const d = \$grossDunkel; if \(mapGeladen\) faerbeKarte\(d\) \}\)/.test(ka) && /setPaintProperty\(id, k, v\)/.test(ka))
p('Versorgungspunkte bekommen die Farben, sobald sie da sind', /faerbeKarte\(get\(grossDunkel\)\)[^\n]*\n    poiGeladen = true/.test(ka))
p('Ein gemeinsames pmtiles-Protokoll für alle Karten', /await ladeKartenLib\(\)/.test(ka) && !/new pm\.Protocol\(\)|addProtocol\(/.test(ka) && (lies('src/lib/ueberblick-gl.js').match(/addProtocol\(/g) || []).length === 1)
p('Die große Karte wirft die Überblicks-Quelle nie weg (eigener Name)', UEBERBLICK_URL === 'pmtiles://' + UEBERBLICK_NAME && !lies('src/lib/karten-config.js').includes(UEBERBLICK_NAME))

console.log('\nZoom')
p('Heraus bis ganz Australien', MIN_ZOOM <= 3 && GRENZEN[0][0] <= 110 && GRENZEN[1][0] >= 155 && GRENZEN[0][1] <= -44 && GRENZEN[1][1] >= -10)
p('Hinein nur bis zur sauberen Grenze (Datei reicht bis Zoom 8)', MAX_ZOOM > 9 && MAX_ZOOM <= 11)
const ug = lies('src/lib/UeberblickKarte.svelte')
p('Karte nutzt die Grenzen, keine Zoom-Knöpfe, zwei Finger', /minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, maxBounds: GRENZEN/.test(ug) && /cooperativeGestures: true/.test(ug) && !/NavigationControl/.test(ug))
p('Antippen einer Häufung zoomt höchstens bis zur Grenze, dort der Reihe nach', /if \(z <= MAX_ZOOM\)/.test(ug) && /Math\.min\(MAX_ZOOM, z \+ 0\.3\)/.test(ug) && /getClusterLeaves/.test(ug) && /\(i \+ 1\) % liste\.length/.test(ug))
p('„Alles zeigen“ oder „Ganze Gegend“ erst nach dem Bewegen', /\{#if bewegt\}/.test(ug) && /if \(e\.originalEvent\) bewegt = true/.test(ug))

console.log('\nKarteninhalt')
const eb = grundEbenen(FARBEN.hell), id = (x) => eb.findIndex((l) => l.id === x)
p('Meer, Land, Parks, Staatsgrenzen, Highways, Städte und Orte', ['meer', 'land', 'park', 'grenze', 'wasser', 'strasse', 'staat', 'stadt', 'ort'].every((x) => id(x) >= 0))
p('Grenzen unter dem Meer (keine Seegrenzen in der Bass Strait)', id('grenze') < id('wasser') && id('land') < id('grenze'))
p('Kleinere Orte erst ab Zoom 7,5 als eigene Ebene (zoom im Filter zählt nur ganze Stufen)', eb[id('ort')].minzoom === 7.5 && !JSON.stringify(eb[id('ort')].filter).includes('zoom'))
const kr = kreisEbenen(FARBEN.dunkel, 'nr', { radius: 10, text: 'x', an: false })
p('Stil A: weißer Rand, weiße Zahl, weicher Schatten, auch dunkel', kr[0].paint['circle-blur'] > 0 && JSON.stringify(kr[1].paint['circle-stroke-color']).includes('#ffffff') && kr[2].paint['text-color'] === '#ffffff')
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
p('Weiße Zahl auf dem Kreis gut lesbar (mindestens 3,5 : 1)', ['hell', 'dunkel'].every((m) => kontrast(FARBEN[m].zahl, FARBEN[m].punkt) >= 3.5), kontrast('#ffffff', FARBEN.hell.punkt).toFixed(2))
p('Zahl hält Stadtnamen auf Abstand', kr[2].layout['text-padding'] >= 10)
const r = rahmenUm([[145.25, -37.5], [145.52, -37.57]], [0.5, 0.32])
p('Ausschnitt einer Gegend mindestens 0,5 × 0,32 Grad (ein Ort in der Nähe ist zu sehen)', Math.abs(r[1][0] - r[0][0] - 0.5) < 1e-9 && Math.abs(r[1][1] - r[0][1] - 0.32) < 1e-9)

console.log('\nKleines Australien mit Ausschnitt')
p('Oben rechts, der Rahmen läuft beim Verschieben mit', /class="ug-lage"/.test(ug) && /\.ug-lage \{ position: absolute; right: 8px; top: 8px;/.test(ug) && /map\.on\('move', lageNeu\)/.test(ug) && /class="ug-lage-rahmen"/.test(ug))
p('Ist fast ganz Australien zu sehen, fällt die Skizze weg', /if \(e - w > 36\) \{ lage = null; return \}/.test(ug))

console.log('\nEinbau und Ersatz')
const gk = lies('src/lib/OrteGesamtkarte.svelte'), rk = lies('src/lib/RegionKarte.svelte'), gl = lies('src/lib/ueberblick-gl.js')
p('Gesamtkarte: echte Karte mit Ringen, sonst die gezeichnete', /\{#if \$ueberblick === 'bereit' && glRinge\.length\}/.test(gk) && /<UeberblickKarte art="ringe"/.test(gk) && /\{:else if proj\}/.test(gk))
p('Gegend: echte Karte mit Nummern und Routen, sonst die gezeichnete', /\{#if \$ueberblick === 'bereit'\}/.test(rk) && /<UeberblickKarte art="nummern" \{punkte\} \{linien\} \{gewaehlt\}/.test(rk) && /\{:else\}\n  <div class="rk-karte">\n    <UebersichtsKarte/.test(rk))
p('Datei aus dem Speicher, sonst nur mit Netz und ohne Datensparmodus', /cache\.match\(url\)/.test(gl) && /if \(!get\(online\) \|\| sparen\) throw/.test(gl) && /navigator\.connection\?\.saveData/.test(gl))
p('Fehlt die Datei, beim nächsten Mal neu versuchen', /ueberblick\.set\('fehlt'\)\n      laden = null/.test(gl))
p('Außerhalb des Bildschirms wird die Karte abgebaut (wenige zugleich)', /new IntersectionObserver/.test(ug) && /else abbau\(\)/.test(ug) && /map\.remove\(\)/.test(ug))
p('Design-Wechsel stellt die Karte um, ohne Neuaufbau', /\$effect\(\(\) => \{ const d = \$kartenDunkel; untrack\(\(\) => map\?\.setStyle\(stil\(d\)\)\) \}\)/.test(ug))
p('Neue Daten ohne Neuaufbau, Ausschnitt nur bei anderen Orten neu', /getSource\('nr'\)\?\.setData\(d\)/.test(ug) && /rahmenKey/.test(ug))

console.log('\nGezeichnete Karten (Wanderungen, Routen-Ideen, Ersatz)')
const uk = lies('src/lib/UebersichtsKarte.svelte')
p('Land nur nach Rahmen gewählt, nichts fällt mitten im Land weg', !/every\(raus\)/.test(uk) && /const grobBoxen = AUS_RINGS\.map/.test(uk) && /\(feinBoxen \|\| grobBoxen\)\.filter/.test(uk))
// Kinglake: Ausschnitt liegt mitten im Land; die Fläche darum hat alle Eckpunkte außerhalb
const KL = { w: 145.2, e: 145.6, s: -37.62, n: -37.45 }
const box = (q) => q.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90])
const drin = ([x, y], q) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c } return c }
const kandidaten = LAND_FEIN.filter((q) => { const b = box(q); return b[2] >= KL.w && b[0] <= KL.e && b[3] >= KL.s && b[1] <= KL.n })
const landUmKinglake = kandidaten.filter((q) => drin([145.35, -37.53], q))
p('Kinglake liegt auf einer Landfläche, die der Rahmen findet', landUmKinglake.length >= 1)
p('… die früher wegfiel, weil keine Ecke im Ausschnitt lag', landUmKinglake.some((q) => q.every(([x, y]) => x < KL.w || x > KL.e || y < KL.s || y > KL.n)))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
