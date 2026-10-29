// Nachzuegler-Bilder: Commons gezielt NACH DEM NAMEN durchsuchen statt nur im Umkreis.
// Die Umkreissuche findet bei abgelegenen Orten nur zufaellige Nachbarfotos (daher das
// beruehmte ISS-Foto). Eine Namenssuche trifft die Sache — und die Datei-Koordinate,
// die Commons mitliefert, belegt sie.
//
//   node scripts/hole-bilder-namenssuche.js <orte.json>
import fs from 'node:fs'
import path from 'node:path'

const TABU = /(bushfire|wildfire|\bfire\b|burn|flood|damage|destroy|crash|accident|wreck|grave|cemetery|funeral|protest|\bmap\b|diagram|chart|graph|logo|coat.of.arms|flag|plaque|signpost|roadsign|portrait|specimen|herbarium|atlas|\biss\d|astronaut|satellite|from.space|orbit|nasa|landsat)/i
const MUELL = /(sample.?photo|\bgcmp\b|\bimg[_-]?\d|\bdsc[_-]?\d|\bp\d{6,}|screenshot|scan\b|\bfig(ure)?[._ ]?\d)/i
const KOPF = { 'User-Agent': 'WA-Reiseplan/1.0 (persoenliche Reiseplanung)' }
const warte = (ms) => new Promise((r) => setTimeout(r, ms))

let zuletzt = 0
async function hol(u, versuche = 4) {
  for (let v = 1; v <= versuche; v++) {
    const seit = Date.now() - zuletzt
    if (seit < 1200) await warte(1200 - seit)
    zuletzt = Date.now()
    const r = await fetch(u, { headers: KOPF })
    if (r.status !== 429 && r.status !== 503) return r
    const s = Number(r.headers.get('retry-after')) || 6 * v
    if (v === versuche) return r
    await warte(s * 1000)
  }
}

function km(aLat, aLon, bLat, bLon) {
  const R = 6371, r = Math.PI / 180
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Klammerzusaetze und Beiwerk raus: „Mount Bartle Frere (Suedgipfel, 1.622 m)" -> „Mount Bartle Frere"
function suchbegriffe(o) {
  const roh = o.name.replace(/\([^)]*\)/g, ' ').replace(/[–—]/g, ' ').trim()
  const teile = roh.split(/\s*[\/,]\s*/).map((x) => x.trim()).filter((x) => x.length > 3)
  return [...new Set([roh, ...teile])].slice(0, 3)
}

async function commonsNachName(o) {
  const kandidaten = []
  for (const begriff of suchbegriffe(o)) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
      + '&generator=search&gsrnamespace=6&gsrlimit=20'
      + `&gsrsearch=${encodeURIComponent(begriff)}`
      + '&prop=imageinfo|coordinates&iiprop=url|size&iiurlwidth=1000'
    const r = await hol(url)
    if (!r || !r.ok) continue
    const d = await r.json()
    for (const p of Object.values(d?.query?.pages || {})) {
      const info = p.imageinfo?.[0]
      const quelle = info?.thumburl || info?.url || ''
      if (!/\.(jpg|jpeg|png|webp)$/i.test(quelle)) continue
      const titel = (p.title || '').replace(/^File:/, '')
      if (TABU.test(titel) || MUELL.test(titel)) continue

      let punkte = 0
      const kern = begriff.toLowerCase()
      if (titel.toLowerCase().includes(kern)) punkte += 10
      else {
        // Alle bedeutungstragenden Woerter im Dateinamen? Auch gut.
        const w = kern.split(/\s+/).filter((x) => x.length > 3)
        if (w.length && w.every((x) => titel.toLowerCase().includes(x))) punkte += 8
      }
      // Der harte Beleg: die Datei ist dort verortet, wo der Ort liegt.
      const c = p.coordinates?.[0]
      let abstand = null
      if (c) {
        abstand = km(o.lat, o.lon, c.lat, c.lon)
        if (abstand <= 5) punkte += 9
        else if (abstand <= 20) punkte += 4
        else punkte -= 10                       // gleicher Name, anderer Erdteil
      }
      if ((info?.width || 0) >= 1000) punkte += 1
      if ((info?.width || 0) < (info?.height || 0)) punkte -= 1
      kandidaten.push({ quelle, punkte, titel, abstand })
    }
    if (kandidaten.some((k) => k.punkte >= 15)) break   // guter Treffer, weitere Begriffe sparen
  }
  if (!kandidaten.length) return null
  kandidaten.sort((a, b) => b.punkte - a.punkte)
  return kandidaten[0]
}

const ENDUNG = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
const ORDNER = 'public/bilder'
const orte = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const nachweis = fs.existsSync('public/bilder-nachweis.json')
  ? JSON.parse(fs.readFileSync('public/bilder-nachweis.json', 'utf8')) : []
const benutzt = new Set(nachweis.map((n) => n.quelle))
let ok = 0

for (const o of orte) {
  const t = await commonsNachName(o)
  if (!t || t.punkte < 10) {
    console.log(`  ✗  ${o.name.slice(0, 44).padEnd(45)} ${t ? 'bester Treffer nur ' + t.punkte + 'P: ' + t.titel.slice(0, 34) : 'nichts gefunden'}`)
    continue
  }
  if (benutzt.has(t.quelle)) { console.log(`  ✗  ${o.name.slice(0, 44).padEnd(45)} Foto schon vergeben`); continue }
  const r = await hol(t.quelle)
  const typ = (r.headers.get('content-type') || '').split(';')[0]
  const ext = ENDUNG[typ]
  if (!r.ok || !ext) { console.log(`  ✗  ${o.name} — Download fehlgeschlagen`); continue }
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 25000) { console.log(`  ✗  ${o.name} — zu klein (${buf.length} B), wohl ein Symbol`); continue }
  fs.writeFileSync(path.join(ORDNER, o.id + ext), buf)
  benutzt.add(t.quelle)
  nachweis.push({ id: o.id, name: o.name, datei: o.id + ext, motiv: t.titel, quelle: t.quelle })
  ok++
  console.log(`  ✓  ${o.name.slice(0, 44).padEnd(45)} ${String(t.punkte).padStart(2)}P ${t.abstand != null ? t.abstand.toFixed(1) + ' km' : 'ohne Geo'}  ← ${t.titel.slice(0, 44)}`)
}

fs.writeFileSync('public/bilder-nachweis.json', JSON.stringify(nachweis, null, 1))
console.log(`\n${ok} von ${orte.length} nachgeholt.`)
