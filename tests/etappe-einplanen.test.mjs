// V39: Einplanen in deine Etappe. Welche Etappe passt zu einem Ort, Hin- und Heimreise bleiben draußen,
// ein langer Weiterflug mitten in der Reise macht eine Etappe nicht zur Heimreise, ohne eigenen Ort zählt die
// Ankunft der vorigen Etappe, sonst der Name. Ausgedachte Reise (2031), keine echten Daten.
// Ausführen: node tests/etappe-einplanen.test.mjs
import fs from 'node:fs'
import { etappenMitDatum } from '../src/lib/plan.js'
import { etappenFuerOrt, etappenZumEinplanen, istReiseImPlan } from '../src/lib/abschnitte.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

const P = { kiel: { name: 'Kiel', lat: 54.32, lon: 10.12 }, frankfurt: { name: 'Frankfurt', lat: 50.04, lon: 8.56 }, melbourne: { name: 'Melbourne', lat: -37.67, lon: 144.84 },
  cairns: { name: 'Cairns', lat: -16.88, lon: 145.75 }, proserpine: { name: 'Proserpine', lat: -20.49, lon: 148.55 }, perth: { name: 'Perth', lat: -31.94, lon: 115.97 },
  doha: { name: 'Doha', lat: 25.27, lon: 51.61 }, hamburg: { name: 'Hamburg', lat: 53.63, lon: 9.99 } }
const reisen = [
  { id: 'hin', typ: 'etappe', name: 'Hinreise', tage: 3, art: 'bahn', stops: [P.kiel, P.frankfurt] },
  { id: 'r-hin', typ: 'route', etappeId: 'hin', name: 'Frankfurt - Melbourne', art: 'flug', von: '2031-11-29', tage: 2, stops: [P.frankfurt, P.melbourne] },
  { id: 'mel', typ: 'etappe', name: 'Melbourne & Kinglake', tage: 4, art: 'flug', stops: [] },
  { id: 'cns', typ: 'etappe', name: 'Cairns & Great Barrier Reef', tage: 4, art: 'flug', stops: [P.melbourne, P.cairns] },
  { id: 'wit', typ: 'etappe', name: 'Whitsundays', tage: 4, art: 'flug', stops: [P.cairns, P.proserpine] },
  { id: 'r-wit', typ: 'route', etappeId: 'wit', name: 'Ab Proserpine', art: 'flug', von: '2031-12-11', tage: 1, stops: [P.proserpine, P.perth] },
  { id: 'wa', typ: 'etappe', name: 'Roadtrip', tage: 40, art: 'auto', stops: [] },
  { id: 'heim', typ: 'etappe', name: 'Heimreise', tage: 3, art: 'flug', stops: [P.perth, P.doha, P.hamburg] },
]
const eintraege = etappenMitDatum(reisen, '2031-11-29')
const namen = (l) => l.map((x) => (x.eintrag || x).reise.name).join(',')
const ort = (name, lat, lon, region = '') => ({ name, lat, lon, region })

console.log('\n1  Welche Etappe passt?')
p('Ort in Cairns: Cairns-Etappe (ihr Ziel), nicht die Whitsundays (dort nur Abflug)', namen(etappenFuerOrt(ort('Esplanade Lagoon', -16.92, 145.78, 'Cairns & Küste'), eintraege, reisen)) === 'Cairns & Great Barrier Reef')
p('Ort bei Airlie Beach: Whitsundays, obwohl dort ein Flug nach Perth abgeht', namen(etappenFuerOrt(ort('Airlie Beach', -20.27, 148.72, 'Whitsundays'), eintraege, reisen)) === 'Whitsundays')
p('Whitsundays ist keine Heimreise, die Heimreise schon, die Hinreise auch (über ihren Flug)', !istReiseImPlan(reisen.find((r) => r.id === 'wit'), eintraege, reisen) && istReiseImPlan(reisen.find((r) => r.id === 'heim'), eintraege, reisen) && istReiseImPlan(reisen.find((r) => r.id === 'hin'), eintraege, reisen))
p('Ort bei Melbourne: Etappe ohne eigenen Ort, dort wo die vorige ankommt (Melbourne)', namen(etappenFuerOrt(ort('Yarra Ranges', -37.76, 145.5, 'Yarra Ranges'), eintraege, reisen)) === 'Melbourne & Kinglake')
p('Ort im Südwesten von WA: Roadtrip (Ankunft in Perth)', namen(etappenFuerOrt(ort('Fremantle', -32.05, 115.75), eintraege, reisen)) === 'Roadtrip')
p('Ort weit weg von allem: keine Etappe in der Nähe', etappenFuerOrt(ort('Broome', -17.96, 122.24), eintraege, reisen).length === 0)
const ohneAnkunft = reisen.map((r) => (r.id === 'r-hin' ? { ...r, stops: [] } : r))
p('Ohne Ort und ohne Ankunft: der Name zählt (Kinglake)', etappenFuerOrt(ort('Masons Falls', null, null, 'Kinglake & Toolangi'), etappenMitDatum(ohneAnkunft, '2031-11-29'), ohneAnkunft).map((x) => x.grund + ':' + x.eintrag.reise.name).join() === 'name:Melbourne & Kinglake')

console.log('\n2  Fürs Menü')
const w = etappenZumEinplanen(ort('Broome', -17.96, 122.24), eintraege, reisen)
p('Weit weg: nichts oben, unter „Andere Etappe“ alle außer Hin- und Heimreise', w.nah.length === 0 && namen(w.andere) === 'Melbourne & Kinglake,Cairns & Great Barrier Reef,Whitsundays,Roadtrip', namen(w.andere))
const mitFahrt = [...reisen, { id: 'r-cns', typ: 'route', etappeId: 'cns', name: 'Cairns', art: 'auto', von: '2031-12-04', tage: 1, stops: [P.cairns] }]
const m = etappenZumEinplanen(ort('Esplanade Lagoon', -16.92, 145.78), etappenMitDatum(mitFahrt, '2031-11-29'), mitFahrt)
p('Hat die Etappe schon eine Fahrt: nicht mehr oben (der Ort kommt in diese Route)', m.nah.length === 0 && !namen(m.andere).includes('Cairns'), JSON.stringify({ nah: namen(m.nah), andere: namen(m.andere) }))

console.log('\n3  Einbindung')
const o = lies('src/lib/Ort.svelte')
p('Menü: „In deine Etappe“ oben, „Andere Etappe wählen …“ unten, ein Tipp legt die Route in der Etappe an', /In deine Etappe/.test(o) && /Andere Etappe wählen …/.test(o) && /neueRoute\(\{ name: e\.reise\.name, etappeId: e\.reise\.id, von: ersterFreierTag\(alleReisen, e\), tage: 1, stops: \[\{ name: ort\.name/.test(o) && o.indexOf('In deine Etappe') < o.indexOf("je('In eine Fahrt in der Nähe'"))
p('Hilfe erklärt es', /legt der erste Ort sie an, alle weiteren aus der Gegend kommen in dieselbe/.test(lies('src/lib/hilfe.js')))
p('keine Gedankenstriche in den neuen Texten', ![o.slice(o.indexOf('V39: In deine Etappe'), o.indexOf('let neuFrage')), lies('src/lib/hilfe.js')].some((t) => / [–—] /.test(t.replace(/\/\/.*$/gm, ''))))

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
