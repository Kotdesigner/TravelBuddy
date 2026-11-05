// Dateien von Dokumenten auf einem zweiten Gerät zuordnen (V18). Ausgedachte Daten.
import { fehlendeDateien, ordneDokumenteZu } from '../src/lib/dokument-dateien.js'
let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const DOKS = [
  { id: 'd1', typ: 'Reisepass', dateien: [{ datei: 'eigen/dok-d1/Pass.pdf', name: 'Pass.pdf', groesse: 1000 }, { datei: 'eigen/dok-d1/Pass-Rueckseite.jpg', name: 'Pass-Rueckseite.jpg', groesse: 2000 }] },
  { id: 'd2', typ: 'Visum', dateien: [{ datei: 'eigen/dok-d2/Visum.pdf', name: 'Visum.pdf' }] },
  { id: 'd3', typ: 'Versicherung', dateien: [{ datei: 'eigen/dok-d3/Police.pdf', name: 'Police.pdf', groesse: 500 }] },
]
const lokal = new Set(['eigen/dok-d3/Police.pdf'])
const fehlt = fehlendeDateien(DOKS, (pf) => lokal.has(pf))
p('fehlend: drei Dateien, die vorhandene nicht', fehlt.length === 3 && !fehlt.some((x) => x.datei.includes('Police')), JSON.stringify(fehlt.map((x) => x.name)))
const r = ordneDokumenteZu(fehlt, [{ name: 'pass.PDF', size: 1000 }, { name: 'Visum.pdf', size: 777 }, { name: 'Pass-Rueckseite.jpg', size: 2000 }, { name: 'Urlaub.jpg', size: 5 }])
p('Name ohne Groß und klein, Größe passt', r.zugeordnet.some((z) => z.ziel.datei === 'eigen/dok-d1/Pass.pdf'))
p('ohne bekannte Größe reicht der Name', r.zugeordnet.some((z) => z.ziel.datei === 'eigen/dok-d2/Visum.pdf'))
p('alle drei zugeordnet, fremde Datei bleibt übrig', r.zugeordnet.length === 3 && r.uebrig.length === 1 && r.uebrig[0].name === 'Urlaub.jpg' && !r.offen.length)
const falsch = ordneDokumenteZu(fehlendeDateien(DOKS, () => false), [{ name: 'Pass.pdf', size: 999 }])
p('falsche Größe: nicht zugeordnet', !falsch.zugeordnet.length && falsch.uebrig.length === 1)
const doppelt = [{ id: 'a', dateien: [{ datei: 'eigen/dok-a/Scan.pdf', name: 'Scan.pdf' }] }, { id: 'b', dateien: [{ datei: 'eigen/dok-b/Scan.pdf', name: 'Scan.pdf' }] }]
const mehrdeutig = ordneDokumenteZu(fehlendeDateien(doppelt, () => false), [{ name: 'Scan.pdf', size: 10 }])
p('gleicher Name ohne Größe an zwei Dokumenten: lieber nicht raten', !mehrdeutig.zugeordnet.length && mehrdeutig.offen.length === 2)
const zwei = [{ id: 'a', dateien: [{ datei: 'eigen/dok-a/Scan.pdf', name: 'Scan.pdf', groesse: 10 }] }, { id: 'b', dateien: [{ datei: 'eigen/dok-b/Scan.pdf', name: 'Scan.pdf', groesse: 10 }] }]
const beide = ordneDokumenteZu(fehlendeDateien(zwei, () => false), [{ name: 'Scan.pdf', size: 10 }])
p('dieselbe Datei an zwei Dokumenten (Größe bekannt): beide bekommen sie', beide.zugeordnet.length === 2 && !beide.offen.length)
p('nichts gewählt: alles bleibt offen', ordneDokumenteZu(fehlt, []).offen.length === 3)
console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
