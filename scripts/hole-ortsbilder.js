// Vorschaubilder fuer neue Orte holen — gleiche Auswahllogik wie src/lib/ortdaten.js,
// nur fuer Node: Commons-Geosuche mit Motiv-Filter, sonst das Bild des Wikipedia-Artikels.
// Ablage als public/bilder/<id>.<ext>, damit die neuen Orte aussehen wie die 88 anderen.
//
//   node scripts/hole-ortsbilder.js <orte.json> [--nur-fehlende]
import fs from 'node:fs'
import path from 'node:path'

const BILD_TABU = /(bushfire|wildfire|fire|burn|flood|damage|destroy|crash|accident|wreck|memorial|grave|cemetery|funeral|protest|map|diagram|chart|graph|logo|coat.of.arms|flag|sign|plaque|signpost|roadsign|portrait|specimen|herbarium|atlas|\biss\d|astronaut|satellite|from.space|orbit|nasa|landsat|sentinel.\d)/i
const BILD_MUELL = /(sample.?photo|\bgcmp\b|\bimg[_-]?\d|\bdsc[_-]?\d|\bp\d{6,}|screenshot|scan\b|\bfig(ure)?[._ ]?\d)/i
const BILD_BONUS = /(national.?park|waterfall|beach|lake|river|valley|lookout|view|panorama|landscape|sunset|coast|mountain|forest|town|main.?street|esplanade|jetty|pier|harbour|marina|skyline)/i
const BILD_ART = /^[A-Z][a-z]{2,}\s[a-z]{3,}\b|molting|juvenile|male|female|subsp\.|\bvar\./

const KOPF = { 'User-Agent': 'WA-Reiseplan/1.0 (persoenliche Reiseplanung; kontakt via github)' }
const warte = (ms) => new Promise((r) => setTimeout(r, ms))

// Wikimedia drosselt harte Serien mit 429. Also: Grundpause zwischen allen Aufrufen,
// und bei 429/503 mit wachsendem Abstand erneut versuchen (Retry-After beachten).
let zuletzt = 0
async function hol(u, versuche = 4) {
  for (let v = 1; v <= versuche; v++) {
    const seit = Date.now() - zuletzt
    if (seit < 1100) await warte(1100 - seit)
    zuletzt = Date.now()
    const r = await fetch(u, { headers: KOPF })
    if (r.status !== 429 && r.status !== 503) return r
    const warteS = Number(r.headers.get('retry-after')) || 5 * v
    if (v === versuche) return r
    console.log(`     … gedrosselt (${r.status}), warte ${warteS}s`)
    await warte(warteS * 1000)
  }
}

async function commonsBild(lat, lon, name) {
  if (lat == null || lon == null) return null
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
      + '&generator=geosearch&ggsnamespace=6&ggslimit=20&ggsradius=10000'
      + `&ggscoord=${lat}|${lon}&prop=imageinfo&iiprop=url|size&iiurlwidth=1200`
    const r = await hol(url)
    if (!r.ok) return null
    const d = await r.json()
    const kandidaten = []
    for (const p of Object.values(d?.query?.pages || {})) {
      const info = p.imageinfo?.[0]
      const quelle = info?.thumburl || info?.url || ''
      if (!/\.(jpg|jpeg|png|webp)$/i.test(quelle)) continue
      const titel = (p.title || '').replace(/^File:/, '')
      if (BILD_TABU.test(titel) || BILD_MUELL.test(titel)) continue
      let punkte = 0
      if (name && titel.toLowerCase().includes(String(name).toLowerCase())) punkte += 10
      if (BILD_BONUS.test(titel)) punkte += 4
      if ((info?.width || 0) >= 1200) punkte += 1
      if (BILD_ART.test(titel)) punkte -= 12
      if ((info?.width || 0) < (info?.height || 0)) punkte -= 1
      kandidaten.push({ quelle, punkte, titel, seite: p.title })
    }
    if (!kandidaten.length) return null
    kandidaten.sort((a, b) => b.punkte - a.punkte)
    return kandidaten[0]
  } catch { return null }
}

// Entfernung in km (grob, reicht fuer „ist das ueberhaupt derselbe Ort?").
function km(aLat, aLon, bLat, bLon) {
  const R = 6371, r = Math.PI / 180
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
// Wortueberlappung zwischen gesuchtem Ort und Artikelnamen.
function passtName(name, titel) {
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9äöüß ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'der', 'die', 'das', 'und', 'park', 'mount', 'mt'].includes(w))
  const a = new Set(norm(name)), b = new Set(norm(titel))
  if (!a.size) return false
  let treffer = 0
  for (const w of a) if (b.has(w)) treffer++
  return treffer / a.size >= 0.5
}

/**
 * Bild aus dem Wikipedia-Artikel — aber NUR, wenn der Artikel wirklich diesen Ort meint.
 * Ohne diese Pruefung lieferte die Volltextsuche z. B. fuer „Rainforest Gallery" einen
 * Artikel, dessen Aufmacherbild ein ISS-Foto der Erde ist, und fuer „Masons Falls" den
 * Bahnhof Southern Cross. Der Abgleich der Artikel-Koordinate ist der harte Filter.
 */
async function wikiBild(name, lang, kontext, lat, lon) {
  try {
    const s = await hol(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json`
      + `&list=search&srlimit=3&srsearch=${encodeURIComponent(name + ' ' + (kontext || 'Australia'))}`)
    const treffer = s.ok ? ((await s.json())?.query?.search || []).map((x) => x.title) : []
    for (const titel of [...treffer, name]) {
      const r = await hol(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titel)}`)
      if (!r.ok) continue
      const d = await r.json()
      if (d.type === 'disambiguation') continue
      const quelle = d?.originalimage?.source || d?.thumbnail?.source || ''
      if (!quelle) continue
      const c = d.coordinates
      if (c && lat != null) {
        const abstand = km(lat, lon, c.lat, c.lon)
        if (abstand > 12) continue                       // anderer Ort — Bild waere falsch
      } else if (!passtName(name, d.title)) {
        continue                                          // ohne Koordinate: Name muss passen
      }
      return { quelle, titel: d.title, seite: d.content_urls?.desktop?.page,
        beleg: c ? `Artikel ${km(lat, lon, c.lat, c.lon).toFixed(1)} km entfernt` : 'Name passt' }
    }
    return null
  } catch { return null }
}

const ENDUNG = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

async function speichere(treffer, id, ordner) {
  const r = await hol(treffer.quelle)
  if (!r.ok) return null
  const typ = (r.headers.get('content-type') || '').split(';')[0]
  const ext = ENDUNG[typ]
  if (!ext) return null
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 25000) return null                      // unter 25 KB ist es ein Wappen oder Symbol, kein Foto
  const datei = `${id}${ext}`
  fs.writeFileSync(path.join(ordner, datei), buf)
  return { datei, bytes: buf.length, titel: treffer.titel, seite: treffer.seite }
}

const [, , quelldatei, ...rest] = process.argv
if (!quelldatei) { console.error('Aufruf: node scripts/hole-ortsbilder.js <orte.json> [--nur-fehlende]'); process.exit(1) }
const nurFehlende = rest.includes('--nur-fehlende')
const ORDNER = 'public/bilder'
fs.mkdirSync(ORDNER, { recursive: true })

const orte = JSON.parse(fs.readFileSync(quelldatei, 'utf8'))
const nachweis = []
const schonBenutzt = new Set()   // dasselbe Foto nicht zweimal vergeben
let ok = 0, leer = 0

for (const o of orte) {
  const schon = fs.readdirSync(ORDNER).find((f) => f.replace(/\.[^.]+$/, '') === o.id)
  if (nurFehlende && schon) { console.log(`  ⏭  ${o.name} — Bild vorhanden`); continue }

  const nah = await commonsBild(o.lat, o.lon, o.name)
  let treffer = nah && nah.punkte >= 10 ? nah : null            // 10 = Ortsname steckt im Dateinamen
  if (!treffer) treffer = (await wikiBild(o.name, 'de', o.region, o.lat, o.lon))
                       || (await wikiBild(o.name, 'en', o.region, o.lat, o.lon))
  if (!treffer && nah && nah.punkte >= 10) treffer = nah        // nur wenn der Ortsname im Dateinamen steckt
  // KEIN blinder Rueckfall auf „irgendein Foto aus der Naehe“: das lieferte ein
  // ISS-Foto der Erde und ein ausgestopftes Possum. Lieber gar kein Bild.

  if (treffer && schonBenutzt.has(treffer.quelle)) {
    console.log(`  ✗  ${o.name} — Foto schon bei einem anderen Ort vergeben`); leer++; continue }
  if (!treffer) { console.log(`  ✗  ${o.name} — kein passendes Bild (lieber keins als ein falsches)`); leer++; continue }
  const g = await speichere(treffer, o.id, ORDNER)
  if (!g) { console.log(`  ✗  ${o.name} — Download fehlgeschlagen`); leer++; continue }
  ok++
  schonBenutzt.add(treffer.quelle)
  console.log(`  ✓  ${o.name.slice(0, 32).padEnd(33)} ${(g.bytes / 1024).toFixed(0).padStart(4)} KB  ← ${String(g.titel).slice(0, 42)}${treffer.beleg ? '  [' + treffer.beleg + ']' : '  [Commons ' + treffer.punkte + 'P]'}`)
  nachweis.push({ id: o.id, name: o.name, datei: g.datei, motiv: g.titel, quelle: treffer.quelle, seite: g.seite })
}

fs.writeFileSync('public/bilder-nachweis.json', JSON.stringify(nachweis, null, 1))
console.log(`\n${ok} Bilder geholt, ${leer} ohne. Herkunft in public/bilder-nachweis.json`)
