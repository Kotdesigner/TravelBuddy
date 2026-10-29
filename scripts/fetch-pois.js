// Holt Outback-POIs aus OpenStreetMap (Overpass) für einen Kartenteil und schreibt kompaktes JSON
// nach public/pois-<id>.json.   Aufruf:  node scripts/fetch-pois.js melbourne
//
// 18.09.2026: Die Rechtecke kommen jetzt aus karten-config.js — vorher waren sie hier von Hand
// kleiner eingetragen als die Detailkarten, und 11 von Steves Orten (Marysville, Phillip Island,
// Mission Beach, Cape Tribulation …) lagen auf der Karte, aber ohne Tankstelle und Wasser.
// Außerdem schrieb das Skript noch in den alten Ordner App/App/ und lief mit "type": "module"
// gar nicht mehr (require).
import fs from 'node:fs'
import { POI_REGIONEN } from '../src/lib/karten-config.js'

const REGION = process.argv[2] || 'wa'
const region = POI_REGIONEN.find((r) => r.id === REGION)
if (!region) {
  console.error(`Unbekannt: ${REGION}. Möglich: ${POI_REGIONEN.map((r) => r.id).join(', ')}`)
  process.exit(1)
}
const [W, S, E, N] = region.bounds

// Tag -> Kategorie
const KAT = [
  ['fuel', ['amenity=fuel']],
  ['wasser', ['amenity=drinking_water', 'amenity=water_point', 'man_made=water_well', 'natural=spring']],
  ['rast', ['highway=rest_area', 'highway=services', 'tourism=picnic_site']],
  ['camp', ['tourism=camp_site', 'tourism=caravan_site']],
  ['wc', ['amenity=toilets']],
  ['laden', ['shop=supermarket', 'shop=convenience', 'shop=general']],
  ['werkstatt', ['shop=car_repair', 'shop=tyres', 'amenity=fuel_repair']],
  ['klinik', ['amenity=hospital', 'amenity=clinic', 'amenity=doctors', 'amenity=pharmacy']],
  ['sicht', ['tourism=viewpoint', 'tourism=attraction']],
]
const TAG2KAT = {}
for (const [kat, tags] of KAT) for (const t of tags) TAG2KAT[t] = kat

const filters = KAT.flatMap(([, tags]) => tags)
  .map((t) => { const [k, v] = t.split('='); return `nwr["${k}"="${v}"](${S},${W},${N},${E});` })
  .join('\n')
// Kein Mengen-Deckel mehr: bei 20.000 wäre der größere Melbourne-Ausschnitt still abgeschnitten worden.
const query = `[out:json][timeout:300];(\n${filters}\n);out center tags;`

function katVon(tags) {
  for (const [k, v] of Object.entries(tags || {})) {
    const kat = TAG2KAT[`${k}=${v}`]
    if (kat) return kat
  }
  return null
}

console.error(`[${REGION}] ${region.name} [${region.bounds.join(', ')}] — Overpass-Abfrage läuft …`)
const endpoint = process.env.OVERPASS || 'https://overpass-api.de/api/interpreter'
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': 'WA-Roadtrip-Planner/1.0 (personal offline map builder)',
  },
  body: 'data=' + encodeURIComponent(query),
})
if (!res.ok) { console.error('Overpass Fehler', res.status, (await res.text()).slice(0, 300)); process.exit(1) }
const data = await res.json()
if (data.remark) console.error('  Hinweis von Overpass:', data.remark)
const seen = new Set()
const out = []
const zaehler = {}
for (const el of data.elements || []) {
  const kat = katVon(el.tags)
  if (!kat) continue
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) continue
  const y = Math.round(lat * 1e5) / 1e5, x = Math.round(lon * 1e5) / 1e5
  const key = kat + y + x
  if (seen.has(key)) continue
  seen.add(key)
  const n = (el.tags?.name || '').slice(0, 60)
  out.push({ k: kat, n, y, x })
  zaehler[kat] = (zaehler[kat] || 0) + 1
}
if (out.length < 100) { console.error(`  Nur ${out.length} Punkte — verdächtig, Datei NICHT überschrieben.`); process.exit(1) }
const pfad = new URL(`../public/pois-${REGION}.json`, import.meta.url)
fs.writeFileSync(pfad, JSON.stringify(out))
const kb = (fs.statSync(pfad).size / 1024).toFixed(0)
console.error(`[${REGION}] ${out.length} POIs, ${kb} KB`)
console.error('  ', Object.entries(zaehler).map(([k, n]) => `${k}:${n}`).join('  '))
