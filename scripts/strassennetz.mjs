// Baut die Offline-Straßennetze eines Gebiets aus OpenStreetMap (V29).
// Vorher am Rechner (osmium, Daten von Geofabrik):
//   osmium tags-filter australia-latest.osm.pbf w/highway=motorway,…,track -o strassen.osm.pbf
//   osmium extract -b <w,s,e,n> -s complete_ways strassen.osm.pbf -o wa.osm.pbf
//   osmium add-locations-to-ways --ignore-missing-nodes wa.osm.pbf -o wa-loc.osm.pbf
// Dann: node scripts/strassennetz.mjs wa ../osm-daten/wa-loc.osm.pbf
// Ergebnis: public/routing/wa-haupt.bin (Lösung 2), public/routing/wa-pisten.bin (Lösung 3), netze.json
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import fs from 'node:fs'
import { baueNetz, netzAlsDatei, HAUPT_MAX_KLASSE } from './strassennetz-kern.mjs'

const [gebiet, datei] = process.argv.slice(2)
if (!gebiet || !datei) { console.error('Aufruf: node scripts/strassennetz.mjs <gebiet> <datei-loc.osm.pbf>'); process.exit(1) }
const NAMEN = { wa: 'Western Australia', vic: 'Melbourne und Umgebung', qld: 'Cairns bis Whitsundays' }

const entschluessle = (s) => s.replace(/%([0-9a-fA-F]+)%/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
const t0 = Date.now()
const wege = []
const osm = spawn('osmium', ['cat', '-t', 'way', '-f', 'opl,add_metadata=false,locations_on_ways=true', datei, '-o', '-'])
const zeilen = createInterface({ input: osm.stdout, crlfDelay: Infinity })
for await (const z of zeilen) {
  if (z[0] !== 'w') continue
  const ti = z.indexOf(' T'), ni = z.indexOf(' N')
  const tags = {}
  for (const kv of z.slice(ti + 2, ni).split(',')) { const g = kv.indexOf('='); if (g > 0) tags[entschluessle(kv.slice(0, g))] = entschluessle(kv.slice(g + 1)) }
  const refs = [], coords = []
  for (const n of z.slice(ni + 2).split(',')) {
    const x = n.indexOf('x'), y = n.indexOf('y')
    if (x < 0 || y < 0 || y === x + 1) continue
    refs.push(Number(n.slice(1, x))); coords.push([Number(n.slice(x + 1, y)), Number(n.slice(y + 1))])
  }
  if (refs.length >= 2) wege.push({ tags, refs, coords })
}
console.log(gebiet, wege.length, 'Wege gelesen in', Date.now() - t0, 'ms')

fs.mkdirSync('public/routing', { recursive: true })
const manifest = fs.existsSync('public/routing/netze.json') ? JSON.parse(fs.readFileSync('public/routing/netze.json', 'utf8')) : {}
manifest[gebiet] = { name: NAMEN[gebiet] || gebiet }
for (const [art, maxKlasse] of [['haupt', HAUPT_MAX_KLASSE], ['pisten', 8]]) {
  const t1 = Date.now()
  const netz = baueNetz((f) => { for (const w of wege) f(w) }, { maxKlasse, minKomponenteKm: art === 'haupt' ? 20 : 3 })
  const bin = netzAlsDatei(netz)
  fs.writeFileSync(`public/routing/${gebiet}-${art}.bin`, bin)
  const km = Math.round(netz.kanten.reduce((n, k) => n + k.len, 0) / 1000)
  const pisteKm = Math.round(netz.kanten.filter((k) => k.flags & 16).reduce((n, k) => n + k.len, 0) / 1000)
  manifest[gebiet][art] = { bytes: bin.length, knoten: netz.lon.length, kanten: netz.kanten.length, km, pisteKm }
  console.log(`${gebiet}-${art}: ${netz.lon.length} Knoten, ${netz.kanten.length} Kanten, ${km} km Straße (${pisteKm} km Piste), ${(bin.length / 1048576).toFixed(1)} MB, ${netz.entfernt} Kanten in kleinen Inseln entfernt, ${Date.now() - t1} ms`)
}
fs.writeFileSync('public/routing/netze.json', JSON.stringify(manifest, null, 1) + '\n')
