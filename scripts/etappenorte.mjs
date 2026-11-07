// Erzeugt public/etappenorte.json: Städte und Roadhouses zum Tanken, Einkaufen und Übernachten, an denen
// die Routen-Ideen halten oder die Stützpunkt einer Gegend sind (WA und Ostküste). Koordinaten aus dem
// Eintrag (koord), aus WA_ORTE oder aus der Offline-Karte (australien.pmtiles, Ebene places).
// Versorgung im Umkreis von 10 km aus den Offline-Daten (pois-*.json). Gegend = die des nächsten Orts.
// Aufruf im App-Ordner: node scripts/etappenorte.mjs
import fs from 'node:fs'
import zlib from 'node:zlib'
import { PMTiles } from '../node_modules/pmtiles/dist/esm/index.js'
import { VectorTile } from '../node_modules/@mapbox/vector-tile/index.js'
import { PbfReader as Pbf } from '../node_modules/pbf/index.js'
import { WA_ORTE } from '../src/lib/wa-orte.js'
import { ETAPPENORTE } from '../src/lib/routen-verweise.js'

class Datei { constructor(p) { this.fd = fs.openSync(p, 'r'); this.p = p } getKey() { return this.p } async getBytes(o, l) { const b = Buffer.alloc(l); fs.readSync(this.fd, b, 0, l, o); return { data: b.buffer.slice(b.byteOffset, b.byteOffset + l) } } }
const pm = new PMTiles(new Datei('public/karten/australien.pmtiles'))
// Alle Ortsnamen in WA aus der Offline-Karte (Zoom 8)
const Z = 8, lx = (lon) => Math.floor(((lon + 180) / 360) * 2 ** Z), ly = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z)
const karte = new Map()
const BEREICHE = [[112.5, -35.5, 129.5, -13], [143.5, -39, 146.8, -37], [144.8, -17.9, 146.3, -16]]
for (const [w, s2, e2, n2] of BEREICHE) for (let x = lx(w); x <= lx(e2); x++) for (let y = ly(n2); y <= ly(s2); y++) {
  const t = await pm.getZxy(Z, x, y); if (!t) continue
  let buf = Buffer.from(t.data); if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf)
  const ly2 = new VectorTile(new Pbf(buf)).layers.places; if (!ly2) continue
  for (let i = 0; i < ly2.length; i++) { const f = ly2.feature(i); if (f.properties.kind !== 'locality') continue; const g = f.toGeoJSON(x, y, Z).geometry.coordinates; if (!karte.has(f.properties.name)) karte.set(f.properties.name, [+g[1].toFixed(4), +g[0].toFixed(4)]) }
}
const pois = ['wa', 'melbourne', 'cairns', 'whitsundays'].flatMap((n) => JSON.parse(fs.readFileSync(`public/pois-${n}.json`, 'utf8')))
const orte = JSON.parse(fs.readFileSync('public/orte.json', 'utf8')).filter((o) => o.lat != null)
const BEREICH = { sued: ['Süden'], nord: ['Norden'], ost: ['Ostküste'], beide: ['Süden', 'Norden'] }
const bereichVon = (abschnitt) => (abschnitt.startsWith('Süden') ? 'sueden' : abschnitt.startsWith('Norden') ? 'norden' : 'osten')
const km = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)) }
const ARTEN = ['fuel', 'wasser', 'laden', 'klinik', 'werkstatt', 'camp', 'wc']
const out = []
for (const e of ETAPPENORTE) {
  const k = e.koord || WA_ORTE[e.name] || karte.get(e.name) || karte.get(e.suche || '')
  if (!k) throw new Error('Keine Koordinaten für ' + e.name)
  const nah = pois.filter((p) => km(k, [p.y, p.x]) <= 10)
  const versorgung = Object.fromEntries(ARTEN.map((a) => [a, nah.filter((p) => p.k === a).length]).filter(([, n]) => n))
  const tank = pois.filter((p) => p.k === 'fuel').map((p) => km(k, [p.y, p.x])).sort((a, b) => a - b)[0]
  // Gegend: die des nächsten Orts mit Kachel im selben Teil (Süden, Norden, Ostküste). Städte liegen an Land:
  // Inseln-Gegenden nur, wenn bis 150 km kein anderer Ort liegt (Perth). Sonst von Hand (region).
  const naheOrte = orte.filter((o) => BEREICH[e.gegend].some((b) => o.abschnitt.startsWith(b))).map((o) => ({ o, d: km(k, [o.lat, o.lon]) })).sort((a, b) => a.d - b.d)
  const land = naheOrte.find((x) => !x.o.region.startsWith('Inseln') && x.d <= 150)
  const naechster = e.region ? orte.find((o) => o.region === e.region) : (land || naheOrte[0]).o
  if (!naechster) throw new Error('Gegend fehlt für ' + e.name)
  out.push({ id: e.id, name: e.name, art: e.art, gegend: e.gegend, lat: k[0], lon: k[1], versorgung, tankKm: tank != null ? Math.round(tank) : null, region: naechster.region, bereich: bereichVon(naechster.abschnitt) })
  console.log(e.name.padEnd(20), k.join(','), 'Tank', Math.round(tank), 'km ·', naechster.region, e.koord ? '(Koordinaten von Hand)' : WA_ORTE[e.name] ? '' : '(aus Karte)')
}
fs.writeFileSync('public/etappenorte.json', JSON.stringify(out, null, 1) + '\n')
console.log(out.length, 'Etappenorte geschrieben')
