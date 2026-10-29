// EXIF-Leser: Aufnahmezeit und GPS aus selbst gebauten JPEG- und HEIC-Bytes.
// Ausführen: node tests/exif.test.mjs
import { leseExif, leseJpeg, leseTiff, zerlegeZeit, istHeic, heicExifLage, exifAusDatei, LEER } from '../src/lib/exif.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const nah = (a, b, eps = 1e-5) => a != null && Math.abs(a - b) < eps

// ---------------------------------------------------------------------------
// Bausteine: TIFF mit IFD0 → Exif-IFD und GPS-IFD
// ---------------------------------------------------------------------------
function baueTiff({ le = false, datum = '2037:12:05 18:30:12', offset = '+08:00', datumFeld = 0x9003, gps = { lat: [17, 57, 36], latRef: 'S', lon: [122, 14, 24], lonRef: 'E' }, ifd0Datum = null } = {}) {
  const buf = new Uint8Array(2048)
  const dv = new DataView(buf.buffer)
  const w16 = (o, v) => dv.setUint16(o, v, le)
  const w32 = (o, v) => dv.setUint32(o, v, le)
  buf.set(le ? [0x49, 0x49] : [0x4d, 0x4d], 0)
  w16(2, 42); w32(4, 8)
  let frei = 600   // Bereich für lange Werte
  const ablegen = (bytes) => { const o = frei; buf.set(bytes, o); frei += bytes.length + (bytes.length % 2); return o }
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0)).concat([0])
  function ifd(at, eintraege) {
    w16(at, eintraege.length)
    eintraege.forEach((e, i) => {
      const o = at + 2 + i * 12
      w16(o, e.tag); w16(o + 2, e.typ); w32(o + 4, e.anzahl)
      if (e.inline) e.inline(o + 8)
      else w32(o + 8, e.wert)
    })
    w32(at + 2 + eintraege.length * 12, 0)
  }
  const asciiEintrag = (tag, s) => {
    const b = ascii(s)
    if (b.length <= 4) return { tag, typ: 2, anzahl: b.length, inline: (o) => buf.set(b, o) }
    return { tag, typ: 2, anzahl: b.length, wert: ablegen(b) }
  }
  const rational = (werte) => {
    const b = new Uint8Array(werte.length * 8)
    const d = new DataView(b.buffer)
    werte.forEach((w, i) => { const [z, n] = Array.isArray(w) ? w : [w, 1]; d.setUint32(i * 8, z, le); d.setUint32(i * 8 + 4, n, le) })
    return ablegen(b)
  }
  const ifd0 = []
  if (ifd0Datum) ifd0.push(asciiEintrag(0x0132, ifd0Datum))
  ifd0.push({ tag: 0x8769, typ: 4, anzahl: 1, wert: 200 })
  if (gps) ifd0.push({ tag: 0x8825, typ: 4, anzahl: 1, wert: 400 })
  ifd(8, ifd0)
  const exif = []
  if (datum) exif.push(asciiEintrag(datumFeld, datum))
  if (offset) exif.push(asciiEintrag(0x9011, offset))
  ifd(200, exif)
  if (gps) {
    ifd(400, [
      asciiEintrag(1, gps.latRef), { tag: 2, typ: 5, anzahl: 3, wert: rational(gps.lat) },
      asciiEintrag(3, gps.lonRef), { tag: 4, typ: 5, anzahl: 3, wert: rational(gps.lon) },
    ])
  }
  return buf.slice(0, frei)
}
function baueJpeg(tiff, { vorher = [] } = {}) {
  const app1Inhalt = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff])
  const laenge = app1Inhalt.length + 2
  const teile = [0xff, 0xd8]
  for (const s of vorher) teile.push(...s)
  teile.push(0xff, 0xe1, laenge >> 8, laenge & 255, ...app1Inhalt)
  teile.push(0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9)
  return new Uint8Array(teile)
}
const app0 = [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]

console.log('\n1  Zeit zerlegen')
{
  const z = zerlegeZeit('2037:12:05 18:30:12', '+08:00')
  p('Datum und Uhrzeit', z.datum === '2037-12-05' && z.uhrzeit === '18:30:12', JSON.stringify(z))
  p('Offset übernommen', z.offset === '+08:00' && z.zeit === '2037-12-05T18:30:12+08:00')
  p('ohne Offset: ISO ohne Zone', zerlegeZeit('2037:12:05 07:01:00').zeit === '2037-12-05T07:01:00')
  p('Nullen-Datum gilt nicht', zerlegeZeit('0000:00:00 00:00:00').datum === null)
  p('31. Februar gilt nicht', zerlegeZeit('2037:02:31 10:00:00').datum === null)
  p('kaputter Offset fällt weg', zerlegeZeit('2037:12:05 18:30:12', '+99:77').offset === null)
}

console.log('\n2  JPEG, große Endung (MM)')
{
  const r = leseExif(baueJpeg(baueTiff()))
  p('Datum gelesen', r.datum === '2037-12-05', JSON.stringify(r))
  p('Offset +08:00', r.offset === '+08:00')
  p('Breite Süd negativ (Broome)', nah(r.lat, -(17 + 57 / 60 + 36 / 3600)), String(r.lat))
  p('Länge Ost positiv', nah(r.lon, 122 + 14 / 60 + 24 / 3600), String(r.lon))
}

console.log('\n3  JPEG, kleine Endung (II), APP0 davor, Bruchteile in Sekunden')
{
  const t = baueTiff({ le: true, gps: { lat: [31, 57, [1234, 100]], latRef: 'S', lon: [115, 51, 0], lonRef: 'E' }, offset: null })
  const r = leseJpeg(baueJpeg(t, { vorher: [app0] }))
  p('Datum über APP0 hinweg', r.datum === '2037-12-05', JSON.stringify(r))
  p('ohne Offset: null', r.offset === null)
  p('Sekunden als Bruch (12,34)', nah(r.lat, -(31 + 57 / 60 + 12.34 / 3600)))
  p('Perth Länge', nah(r.lon, 115 + 51 / 60))
}

console.log('\n4  Ersatzfelder und Ränder')
{
  const r = leseExif(baueJpeg(baueTiff({ datumFeld: 0x9004, gps: null })))
  p('DateTimeDigitized als Ersatz', r.datum === '2037-12-05')
  p('ohne GPS: lat/lon null', r.lat === null && r.lon === null)
  const r2 = leseExif(baueJpeg(baueTiff({ datum: null, offset: null, ifd0Datum: '2038:01:02 09:00:00', gps: null })))
  p('DateTime aus IFD0 als letzter Ersatz', r2.datum === '2038-01-02', JSON.stringify(r2))
  const w = leseExif(baueJpeg(baueTiff({ gps: { lat: [33, 52, 0], latRef: 'N', lon: [151, 12, 0], lonRef: 'W' } })))
  p('Nord/West Vorzeichen', w.lat > 0 && w.lon < 0)
  const null0 = leseExif(baueJpeg(baueTiff({ gps: { lat: [0, 0, 0], latRef: 'N', lon: [0, 0, 0], lonRef: 'E' } })))
  p('0/0 gilt als kein Ort', null0.lat === null && null0.datum === '2037-12-05')
  const nenner0 = leseExif(baueJpeg(baueTiff({ gps: { lat: [[17, 0], 0, 0], latRef: 'S', lon: [122, 0, 0], lonRef: 'E' } })))
  p('Nenner 0: kein Ort, kein Absturz', nenner0.lat === null)
}

console.log('\n5  Robust gegen Unsinn')
{
  const leer = (r) => r && r.datum === null && r.lat === null
  p('null', leer(leseExif(null)))
  p('leerer Puffer', leer(leseExif(new Uint8Array(0))))
  p('PNG-Kopf', leer(leseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))))
  p('JPEG ohne APP1', leer(leseExif(new Uint8Array([0xff, 0xd8, ...app0, 0xff, 0xd9]))))
  const j = baueJpeg(baueTiff())
  let alleOk = true
  for (let n = 0; n < j.length; n += 7) {
    try { const r = leseExif(j.slice(0, n)); if (!r || typeof r !== 'object') alleOk = false } catch { alleOk = false }
  }
  p('abgeschnitten an jeder Stelle: kein Fehler', alleOk)
  // Zufallsrauschen in den TIFF-Block
  let zufallOk = true
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let runde = 0; runde < 300; runde++) {
    const k = baueJpeg(baueTiff({ le: runde % 2 === 0 }))
    for (let i = 0; i < 12; i++) k[12 + Math.floor(rnd() * (k.length - 12))] = Math.floor(rnd() * 256)
    try { leseExif(k) } catch { zufallOk = false }
  }
  p('300 zerwürfelte Dateien: kein Fehler', zufallOk)
  // Exif-Zeiger, der zurück auf IFD0 zeigt
  const t = baueTiff({ gps: null })
  new DataView(t.buffer).setUint32(8 + 2 + 8, 8, false)
  let schleife = true
  try { const r = leseTiff(t, 0); schleife = r.datum === null } catch { schleife = false }
  p('Schleife in IFD-Kette: kein Hängen', schleife)
  p('LEER ist eingefroren', Object.isFrozen(LEER))
}

// ---------------------------------------------------------------------------
// HEIC: ftyp, meta (iinf + iloc), mdat mit Exif-Element
// ---------------------------------------------------------------------------
function kasten(typ, inhalt) {
  const n = 8 + inhalt.length
  return new Uint8Array([n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255, ...[...typ].map((c) => c.charCodeAt(0)), ...inhalt])
}
const be16 = (v) => [(v >> 8) & 255, v & 255]
const be32 = (v) => [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]
const s4 = (s) => [...s].map((c) => c.charCodeAt(0))
function baueHeic(tiff, { mitExifKopf = true, iinfVersion = 0 } = {}) {
  const exifDaten = new Uint8Array([...be32(mitExifKopf ? 6 : 0), ...(mitExifKopf ? s4('Exif') : []), ...(mitExifKopf ? [0, 0] : []), ...tiff])
  const ftyp = kasten('ftyp', [...s4('heic'), 0, 0, 0, 0, ...s4('mif1'), ...s4('heic')])
  const infeBild = kasten('infe', [2, 0, 0, 0, ...be16(1), 0, 0, ...s4('hvc1'), 0])
  const infeExif = kasten('infe', [2, 0, 0, 0, ...be16(2), 0, 0, ...s4('Exif'), 0])
  const iinf = kasten('iinf', [iinfVersion, 0, 0, 0, ...(iinfVersion === 0 ? be16(2) : be32(2)), ...infeBild, ...infeExif])
  // iloc v0: offset 4, length 4, base 0
  const ilocLaenge = 8 + 4 + 2 + 2 + 2 * (2 + 2 + 2 + 8)
  const hdlr = kasten('hdlr', [0, 0, 0, 0, 0, 0, 0, 0, ...s4('pict'), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  const metaLaenge = 8 + 4 + hdlr.length + iinf.length + ilocLaenge
  const bildDaten = new Uint8Array(300).fill(0xab)
  const mdatStart = ftyp.length + metaLaenge
  const bildOffset = mdatStart + 8
  const exifOffset = bildOffset + bildDaten.length
  const iloc = kasten('iloc', [0, 0, 0, 0, 0x44, 0x00, ...be16(2),
    ...be16(1), 0, 0, ...be16(1), ...be32(bildOffset), ...be32(bildDaten.length),
    ...be16(2), 0, 0, ...be16(1), ...be32(exifOffset), ...be32(exifDaten.length)])
  const meta = kasten('meta', [0, 0, 0, 0, ...hdlr, ...iinf, ...iloc])
  const mdat = kasten('mdat', [...bildDaten, ...exifDaten])
  const out = new Uint8Array(ftyp.length + meta.length + mdat.length)
  out.set(ftyp, 0); out.set(meta, ftyp.length); out.set(mdat, ftyp.length + meta.length)
  if (meta.length !== metaLaenge) throw new Error('meta-Länge falsch berechnet ' + meta.length + ' ' + metaLaenge)
  return out
}

console.log('\n6  HEIC')
{
  const h = baueHeic(baueTiff())
  p('als HEIC erkannt', istHeic(h))
  p('JPEG ist kein HEIC', !istHeic(baueJpeg(baueTiff())))
  const lage = heicExifLage(h)
  p('Exif-Element über iinf/iloc gefunden', !!lage && lage.laenge > 20, JSON.stringify(lage))
  const r = leseExif(h)
  p('HEIC: Datum', r.datum === '2037-12-05', JSON.stringify(r))
  p('HEIC: Ort', nah(r.lat, -(17 + 57 / 60 + 36 / 3600)) && r.lon > 122)
  const r2 = leseExif(baueHeic(baueTiff({ le: true }), { iinfVersion: 1 }))
  p('HEIC mit iinf Version 1 und II', r2.datum === '2037-12-05' && r2.lat < 0, JSON.stringify(r2))
  const kaputt = baueHeic(baueTiff()).slice(0, 120)
  let ok2 = true
  try { const x = leseExif(kaputt); ok2 = x.datum === null } catch { ok2 = false }
  p('abgeschnittene HEIC: ohne Daten, kein Fehler', ok2)
}

console.log('\n7  Aus einer Datei (Blob) lesen')
{
  const blobJ = new Blob([baueJpeg(baueTiff())], { type: 'image/jpeg' })
  const rj = await exifAusDatei(blobJ)
  p('JPEG-Datei', rj.datum === '2037-12-05' && rj.lat < 0)
  // HEIC mit großem Bild davor: das Exif-Element liegt jenseits der ersten 256 KB
  const tiff = baueTiff()
  const h = baueHeic(tiff)
  const lage = heicExifLage(h)
  const gross = new Uint8Array(h.length + 600000)
  // mdat vergrößern: Bilddaten verschieben ist aufwendig, also Exif ans Ende kopieren und iloc umbiegen
  gross.set(h, 0)
  const exifBlock = h.slice(lage.offset, lage.offset + lage.laenge)
  const neuOffset = gross.length - exifBlock.length
  gross.set(exifBlock, neuOffset)
  // iloc-Eintrag 2 suchen und Offset überschreiben
  const s = String.fromCharCode(...gross.slice(0, 400))
  const il = s.indexOf('iloc')
  const pos = il + 4 + 4 + 2 + 2 + 14 + 2 + 2 + 2
  gross.set(be32(neuOffset), pos)
  const rh = await exifAusDatei(new Blob([gross]))
  p('HEIC: Exif weit hinten gezielt nachgeladen', rh.datum === '2037-12-05', JSON.stringify(rh))
  p('kein Blob: ohne Daten', (await exifAusDatei(null)).datum === null)
}

console.log(`\n${ok} bestanden · ${bad} gescheitert`)
process.exit(bad ? 1 : 0)
