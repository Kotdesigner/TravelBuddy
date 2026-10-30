// Regeln der „einen Karte": welcher Kartenteil wird bei welchem Ausschnitt geladen,
// und wie werden Routen auf das Kartengebiet zugeschnitten.
// Ausführen: node tests/eine-karte.test.mjs
import fs from 'node:fs'
import { REGIONEN, WA_GROSS, GROSSE_KARTE, KARTENGEBIET, kartenteilFuer, schneideZu, imGebiet }
  from '../src/lib/karten-config.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const R = Object.fromEntries(REGIONEN.map((r) => [r.id, r]))

// Sichtbarer Ausschnitt einer Karte mit b × h Pixeln (512er-Kacheln wie in MapLibre).
function ausschnitt(lon, lat, zoom, b = 375, h = 500) {
  const gradProPx = 360 / (512 * 2 ** zoom)
  const dLon = b * gradProPx, dLat = h * gradProPx * Math.cos(lat * Math.PI / 180)
  return [lon - dLon / 2, lat - dLat / 2, lon + dLon / 2, lat + dLat / 2]
}
const teil = (lon, lat, zoom, aktuell = null, verfuegbar, b, h) =>
  kartenteilFuer(ausschnitt(lon, lat, zoom, b, h), zoom, aktuell, verfuegbar)?.id

console.log('\n1  Start und Überblick')
p('ganz Australien auf dem iPhone → grob', teil(134, -26, 3.1) === 'australien', teil(134, -26, 3.1))
p('ganz Australien auf dem Mac → grob', teil(134, -26, 4, null, undefined, 1200, 550) === 'australien')
p('Weltansicht (nichts deckt) → größte Überdeckung: grob', teil(90, 0, 1) === 'australien', teil(90, 0, 1))

console.log('\n2  Hineinzoomen wählt den feinsten Teil')
p('Melbourne, Zoom 11 → Melbourne & Kinglake', teil(145.0, -37.8, 11, R.australien) === 'melbourne')
p('Perth, Zoom 11 → Westküste', teil(115.86, -31.95, 11, R.australien) === 'wa')
p('Cairns, Zoom 12 → Cairns & Tablelands', teil(145.77, -16.92, 12, R.australien) === 'cairns')
p('Airlie Beach, Zoom 12 → Whitsundays', teil(148.72, -20.27, 12, R.australien) === 'whitsundays')
p('Brisbane, Zoom 11 → Ostküste', teil(153.03, -27.47, 11, R.australien) === 'ostkueste')
p('Uluru, Zoom 10 → grob (nichts Feineres vorhanden)', teil(131.04, -25.34, 10, R.australien) === 'australien')
p('Grenze WA/NT, Zoom 9 → grob, weil Westküste sie nicht ganz deckt',
  teil(129.2, -20, 9, R.wa) === 'australien', teil(129.2, -20, 9, R.wa))

console.log('\n3  Kein unnötiger Wechsel (jeder Wechsel = bis 25 MB in den Speicher)')
p('grob bleibt bis Zoom 8,9 über Perth', teil(115.86, -31.95, 8.9, R.australien) === 'australien')
p('ab Zoom 9 → Westküste', teil(115.86, -31.95, 9, R.australien) === 'wa')
p('Ostküste bleibt bei Zoom 10,5 über Melbourne (hat Zoom-10-Kacheln)',
  teil(145.0, -37.8, 10.5, R.ostkueste) === 'ostkueste')
p('Ostküste → Melbourne erst ab Zoom 11', teil(145.0, -37.8, 11, R.ostkueste) === 'melbourne')
p('herauszoomen: Melbourne bleibt, solange es deckt (Zoom 9)', teil(145.0, -37.8, 9, R.melbourne) === 'melbourne')
p('weiter heraus (Zoom 7): Melbourne deckt nicht mehr → gröbster Teil, der genügt (Überblick)',
  teil(145.0, -37.8, 7, R.melbourne) === 'australien', teil(145.0, -37.8, 7, R.melbourne))
p('noch weiter (Zoom 6): auch Ostküste deckt nicht mehr → grob', teil(145.0, -37.8, 6, R.ostkueste) === 'australien',
  teil(145.0, -37.8, 6, R.ostkueste))
p('Melbourne → Gippsland schieben, Zoom 12 → Ostküste', teil(146.5, -38.0, 12, R.melbourne) === 'ostkueste',
  teil(146.5, -38.0, 12, R.melbourne))
// Gemessen im Browser: „Nord 3" eingepasst → Zoom ≈ 4,55, Ausschnitt ragt über 112,5° West hinaus.
p('WA-Route eingepasst, Rand knapp draußen: grob bleibt (kein 10-MB-Wechsel ohne Gewinn)',
  teil(117, -26.5, 4.55, R.australien) === 'australien', teil(117, -26.5, 4.55, R.australien))
p('   ohne aktuellen Teil nimmt er den mit der größten Überdeckung', teil(117, -26.5, 4.55) === 'wa',
  teil(117, -26.5, 4.55))
p('knapp an der Grenze (4 % Luft) kein Hin und Her',
  teil(145.93, -37.8, 11, R.melbourne) === 'melbourne', teil(145.93, -37.8, 11, R.melbourne))

console.log('\n4  Offline: nur was gespeichert ist')
const nurGrob = [R.australien]
p('Melbourne Zoom 12, nur „grob" gespeichert → grob', teil(145.0, -37.8, 12, R.australien, nurGrob) === 'australien')
p('dasselbe mit allen Teilen → Melbourne (daraus entsteht der Hinweis „mehr Details …")',
  teil(145.0, -37.8, 12, R.australien) === 'melbourne')
p('nichts gespeichert → null', kartenteilFuer(ausschnitt(145, -37.8, 12), 12, null, []) === null)
p('nur Westküste gespeichert, Blick auf Melbourne → Westküste als einziger (leer, aber kein Absturz)',
  teil(145.0, -37.8, 12, null, [R.wa]) === 'wa')

console.log('\n4b Große Karte (npm run build:gross)')
{
  const G = Object.fromEntries(WA_GROSS.map((r) => [r.id, r]))
  const alle = [...REGIONEN, ...WA_GROSS]
  const gt = (lon, lat, zoom, aktuell = R.australien) => kartenteilFuer(ausschnitt(lon, lat, zoom), zoom, aktuell, alle)?.id
  p('normaler Build ohne große Teile', !GROSSE_KARTE && !REGIONEN.some((r) => G[r.id]))
  p('vier Teile, jeder unter 100 MB (GitHub-Grenze)', WA_GROSS.length === 4 && WA_GROSS.every((r) => r.mb < 100 && r.maxzoom === 14))
  p('Perth, Zoom 10 → noch die kleine Westküste (lädt nicht 75 MB)', gt(115.86, -31.95, 10) === 'wa', gt(115.86, -31.95, 10))
  p('Perth, Zoom 11 → Südwesten & Perth', gt(115.86, -31.95, 11) === 'wa-sued', gt(115.86, -31.95, 11))
  p('Kalbarri, Zoom 12 → Mittlere Westküste', gt(114.16, -27.71, 12) === 'wa-mitte', gt(114.16, -27.71, 12))
  p('Exmouth, Zoom 12 → Pilbara & Coral Coast', gt(114.13, -21.93, 12) === 'wa-nordwest', gt(114.13, -21.93, 12))
  p('Broome, Zoom 13 → Kimberley & Broome', gt(122.24, -17.96, 13) === 'wa-kimberley', gt(122.24, -17.96, 13))
  p('Melbourne bleibt unberührt', gt(145.0, -37.8, 12) === 'melbourne')
  p('Nachbarn überlappen sich (keine Lücke an den Grenzen)',
    G['wa-sued'].bounds[3] > G['wa-mitte'].bounds[1] && G['wa-mitte'].bounds[3] > G['wa-nordwest'].bounds[1] && G['wa-nordwest'].bounds[3] > G['wa-kimberley'].bounds[1])
}

console.log('\n5  Routen auf das Kartengebiet zuschneiden')
const perthBroome = [[115.86, -31.95], [117.88, -22.0], [122.24, -17.96]]
const innen = schneideZu(perthBroome)
p('ganz innen: ein Stück, alle Punkte unverändert',
  innen.length === 1 && JSON.stringify(innen[0]) === JSON.stringify(perthBroome))
const dohaMelb = schneideZu([[51.53, 25.29], [144.96, -37.81]])
p('Flug Doha → Melbourne: ein Stück', dohaMelb.length === 1)
p('   beginnt am Westrand des Kartengebiets', Math.abs(dohaMelb[0][0][0] - KARTENGEBIET[0]) < 1e-9,
  JSON.stringify(dohaMelb[0][0]))
p('   endet in Melbourne', JSON.stringify(dohaMelb[0][1]) === JSON.stringify([144.96, -37.81]))
p('Frankfurt → Doha: nichts', schneideZu([[8.57, 50.03], [51.53, 25.29]]).length === 0)
const rausRein = schneideZu([[115, -30], [100, -30], [100, -20], [115, -20]])
p('hinaus und wieder herein: zwei Stücke', rausRein.length === 2, JSON.stringify(rausRein))
p('ein Punkt allein ergibt keine Linie', schneideZu([[115, -30]]).length === 0)
p('imGebiet: Perth ja, Doha nein', imGebiet([115.86, -31.95]) && !imGebiet([51.53, 25.29]))

console.log('\n6  Kartenstil: Flüsse sind Linien, keine Flächen')
// Flüsse liegen in „water“ als Linien. Eine Füllung ohne Filter schließt jede Flusslinie
// zur Fläche → blaue Keile übers Land (z. B. Margaret River, Murchison bei Kalbarri).
const stil = fs.readFileSync(new URL('../src/lib/Karte.svelte', import.meta.url), 'utf8')
const ebene = (id) => (stil.match(new RegExp(`\\{ id: '${id}'[^\\n]*`)) || [''])[0]
p('Wasser-Füllung nimmt nur Flächen', /type: 'fill'/.test(ebene('wasser')) && ebene('wasser').includes("filter: ['==', '$type', 'Polygon']"), ebene('wasser'))
p('Flüsse als eigene Linien-Ebene', /type: 'line'/.test(ebene('fluesse')) && ebene('fluesse').includes("'source-layer': 'water'") && ebene('fluesse').includes("filter: ['==', '$type', 'LineString']"), ebene('fluesse'))

console.log('\n7  Kartenstil: Straßen nach Rang, mit Rand und Nummern')
{
  const kontrast = (a, b) => {
    const l = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
    const [x, y] = [l(a), l(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05)
  }
  const LAND = '#f6f0e2'
  p('keine einheitliche 1-px-Straße mehr', !/id: 'strassen', type: 'line'/.test(stil))
  for (const id of ['strasse-haupt-rand', 'strasse-haupt', 'strasse-neben-rand', 'strasse-neben', 'strasse-piste', 'strasse-bahn', 'strasse-faehre', 'strasse-name', 'strasse-nummer'])
    p(`Ebene ${id} vorhanden`, stil.includes(`id: '${id}'`))
  p('Rand der Hauptstraßen hebt sich ab (≥ 3 : 1)', kontrast('#7a3b1e', LAND) >= 3 && kontrast('#a0785a', LAND) >= 3, `${kontrast('#7a3b1e', LAND).toFixed(1)} / ${kontrast('#a0785a', LAND).toFixed(1)}`)
  p('Pisten gestrichelt und lesbar (≥ 3 : 1)', ebene('strasse-piste').includes('line-dasharray') || /strasse-piste[\s\S]{0,300}line-dasharray/.test(stil), kontrast('#8a6a4a', LAND).toFixed(1))
  p('Straßennummer als Schild lesbar (≥ 4,5 : 1)', kontrast('#ffffff', '#7a3b1e') >= 4.5)
  p('Versorgungspunkte liegen unter Straßennamen und -nummern', (stil.match(/unterStrassenSchrift\(\)\)/g) || []).length === 2)
  p('Zoom nur ganz außen in den Breiten (MapLibre-Regel)', !/\['\+', breite\(/.test(stil))
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
