// Kleiner EXIF-Leser ohne fremde Bibliothek: Aufnahmezeit und GPS aus JPEG und HEIC.
//
// Gelesen werden nur die Felder, die das Logbuch braucht:
//   DateTimeOriginal (0x9003), OffsetTimeOriginal (0x9011), ersatzweise
//   DateTimeDigitized (0x9004) bzw. DateTime (0x0132) und OffsetTime (0x9010);
//   GPSLatitudeRef/GPSLatitude (1/2), GPSLongitudeRef/GPSLongitude (3/4).
//
// Kaputte Dateien dürfen nie eine Ausnahme werfen. Jeder Zugriff prüft die Grenzen,
// IFD-Ketten werden gegen Schleifen gesichert. Im Zweifel kommt LEER zurück und das
// Foto gilt als „ohne Daten“.

export const LEER = Object.freeze({ datum: null, uhrzeit: null, offset: null, zeit: null, lat: null, lon: null })

const T_DATETIME = 0x0132, T_EXIF_IFD = 0x8769, T_GPS_IFD = 0x8825
const T_ORIGINAL = 0x9003, T_DIGITIZED = 0x9004, T_OFFSET = 0x9010, T_OFFSET_ORIGINAL = 0x9011
const GROESSE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

function alsBytes(eingabe) {
  if (!eingabe) return null
  if (eingabe instanceof Uint8Array) return eingabe
  if (eingabe instanceof ArrayBuffer) return new Uint8Array(eingabe)
  if (ArrayBuffer.isView(eingabe)) return new Uint8Array(eingabe.buffer, eingabe.byteOffset, eingabe.byteLength)
  return null
}

const ascii = (b, o, n) => {
  let s = ''
  for (let i = 0; i < n && o + i < b.length; i++) s += String.fromCharCode(b[o + i])
  return s
}

// ---------------------------------------------------------------------------
// TIFF-Struktur (steckt in JPEG-APP1 und im HEIC-Exif-Element)
// ---------------------------------------------------------------------------

/** Liest die gewünschten Felder aus einem TIFF-Block, der bei `start` beginnt. */
export function leseTiff(eingabe, start = 0, ende = null) {
  const b = alsBytes(eingabe)
  if (!b) return { ...LEER }
  const stop = Math.min(b.length, ende ?? b.length)
  if (start < 0 || start + 8 > stop) return { ...LEER }
  const ordnung = ascii(b, start, 2)
  if (ordnung !== 'II' && ordnung !== 'MM') return { ...LEER }
  const le = ordnung === 'II'
  const u16 = (o) => (o < start || o + 2 > stop) ? null : (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1])
  const u32 = (o) => (o < start || o + 4 > stop) ? null
    : (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
          : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
  if (u16(start + 2) !== 42) return { ...LEER }

  // Ein IFD als Karte tag → { typ, anzahl, wertOffset }
  const besucht = new Set()
  function ifd(rel) {
    const karte = new Map()
    if (rel == null || besucht.has(rel)) return karte
    besucht.add(rel)
    const o = start + rel
    const n = u16(o)
    if (n == null || n > 1000) return karte
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12
      const tag = u16(e), typ = u16(e + 2), anzahl = u32(e + 4)
      if (tag == null || typ == null || anzahl == null) break
      const g = GROESSE[typ]
      if (!g || anzahl > 1e6) continue
      const laenge = g * anzahl
      const wertOffset = laenge <= 4 ? e + 8 : (() => { const r = u32(e + 8); return r == null ? null : start + r })()
      if (wertOffset == null || wertOffset + laenge > stop) continue
      karte.set(tag, { typ, anzahl, wertOffset })
    }
    return karte
  }
  const text = (eintrag) => {
    if (!eintrag || eintrag.typ !== 2) return null
    return ascii(b, eintrag.wertOffset, eintrag.anzahl).replace(/\0[\s\S]*$/, '').trim() || null
  }
  const rationale = (eintrag) => {
    if (!eintrag || (eintrag.typ !== 5 && eintrag.typ !== 10)) return null
    const out = []
    for (let i = 0; i < eintrag.anzahl; i++) {
      let z = u32(eintrag.wertOffset + i * 8), n = u32(eintrag.wertOffset + i * 8 + 4)
      if (z == null || n == null) return null
      if (eintrag.typ === 10) { z = z | 0; n = n | 0 }
      if (n === 0) return null
      out.push(z / n)
    }
    return out
  }
  const zeiger = (karte, tag) => {
    const e = karte.get(tag)
    if (!e || (e.typ !== 4 && e.typ !== 3 && e.typ !== 13)) return null
    return e.typ === 3 ? u16(e.wertOffset) : u32(e.wertOffset)
  }

  const ifd0 = ifd(u32(start + 4))
  const exifIfd = ifd(zeiger(ifd0, T_EXIF_IFD))
  const gpsIfd = ifd(zeiger(ifd0, T_GPS_IFD))

  const roh = text(exifIfd.get(T_ORIGINAL)) || text(exifIfd.get(T_DIGITIZED)) || text(ifd0.get(T_DATETIME))
  const offsetRoh = text(exifIfd.get(T_OFFSET_ORIGINAL)) || text(exifIfd.get(T_OFFSET))
  const zeit = zerlegeZeit(roh, offsetRoh)

  let lat = null, lon = null
  const la = rationale(gpsIfd.get(2)), lo = rationale(gpsIfd.get(4))
  const laRef = (text(gpsIfd.get(1)) || 'N').toUpperCase(), loRef = (text(gpsIfd.get(3)) || 'E').toUpperCase()
  const grad = (w) => (w && w.length >= 1 ? w[0] + (w[1] || 0) / 60 + (w[2] || 0) / 3600 : null)
  const gLa = grad(la), gLo = grad(lo)
  if (gLa != null && gLo != null && isFinite(gLa) && isFinite(gLo)) {
    const a = laRef.startsWith('S') ? -Math.abs(gLa) : Math.abs(gLa)
    const c = loRef.startsWith('W') ? -Math.abs(gLo) : Math.abs(gLo)
    // 0/0 ist fast immer ein leerer GPS-Block, kein Ort im Golf von Guinea.
    if (Math.abs(a) <= 90 && Math.abs(c) <= 180 && !(a === 0 && c === 0)) {
      lat = Math.round(a * 1e6) / 1e6
      lon = Math.round(c * 1e6) / 1e6
    }
  }
  return { ...zeit, lat, lon }
}

/** „2026:12:05 18:30:12“ (+ „+08:00“) → Datum, Uhrzeit, Offset und ISO-Zeit. */
export function zerlegeZeit(roh, offsetRoh = null) {
  const m = String(roh || '').match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return { datum: null, uhrzeit: null, offset: null, zeit: null }
  const [, J, Mo, T, h, mi, s = '00'] = m
  const j = +J, mo = +Mo, t = +T
  if (j < 1990 || j > 2100 || mo < 1 || mo > 12 || t < 1 || t > 31 || +h > 23 || +mi > 59 || +s > 60) {
    return { datum: null, uhrzeit: null, offset: null, zeit: null }
  }
  // Kalender prüfen (31. Februar fällt hier heraus)
  const probe = new Date(Date.UTC(j, mo - 1, t))
  if (probe.getUTCMonth() !== mo - 1) return { datum: null, uhrzeit: null, offset: null, zeit: null }
  const datum = `${J}-${Mo}-${T}`
  const uhrzeit = `${h}:${mi}:${s}`
  const om = String(offsetRoh || '').trim().match(/^([+-])(\d{2}):?(\d{2})$/)
  const offset = om && +om[2] <= 14 && +om[3] < 60 ? `${om[1]}${om[2]}:${om[3]}` : null
  return { datum, uhrzeit, offset, zeit: `${datum}T${uhrzeit}${offset || ''}` }
}

// ---------------------------------------------------------------------------
// JPEG: Segmente bis zum APP1 mit „Exif\0\0“ durchgehen
// ---------------------------------------------------------------------------

export function leseJpeg(eingabe) {
  const b = alsBytes(eingabe)
  if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return { ...LEER }
  let o = 2
  for (let runde = 0; runde < 400 && o + 4 <= b.length; runde++) {
    if (b[o] !== 0xff) return { ...LEER }
    const marker = b[o + 1]
    if (marker === 0xff) { o++; continue }                // Füllbytes
    if (marker === 0xd9 || marker === 0xda) break        // Ende oder Bilddaten: kein EXIF mehr
    if (marker >= 0xd0 && marker <= 0xd7) { o += 2; continue }
    const laenge = (b[o + 2] << 8) | b[o + 3]
    if (laenge < 2) return { ...LEER }
    if (marker === 0xe1 && ascii(b, o + 4, 6) === 'Exif\0\0') {
      return leseTiff(b, o + 10, Math.min(b.length, o + 2 + laenge))
    }
    o += 2 + laenge
  }
  return { ...LEER }
}

// ---------------------------------------------------------------------------
// HEIC/HEIF (ISO-BMFF): meta → iinf (Element vom Typ „Exif“) → iloc (Lage in der Datei)
// ---------------------------------------------------------------------------

export function istHeic(eingabe) {
  const b = alsBytes(eingabe)
  if (!b || b.length < 12 || ascii(b, 4, 4) !== 'ftyp') return false
  const marken = ascii(b, 8, Math.min(32, b.length - 8))
  return /heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif/.test(marken)
}

/** Sucht das Exif-Element einer HEIC-Datei. Liefert { offset, laenge } in der Datei oder null. */
export function heicExifLage(eingabe) {
  const b = alsBytes(eingabe)
  if (!istHeic(b)) return null
  const u16 = (o) => (o + 2 > b.length ? null : (b[o] << 8) | b[o + 1])
  const u32 = (o) => (o + 4 > b.length ? null : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
  const uN = (o, n) => (n === 0 ? 0 : n === 2 ? u16(o) : n === 4 ? u32(o) : n === 8 ? (u32(o) * 2 ** 32 + u32(o + 4)) : null)

  // Kästen einer Ebene: [{ typ, start, inhalt, ende }]
  function kaesten(von, bis) {
    const out = []
    let o = von
    for (let i = 0; i < 500 && o + 8 <= bis; i++) {
      let groesse = u32(o)
      const typ = ascii(b, o + 4, 4)
      let kopf = 8
      if (groesse === 1) { groesse = uN(o + 8, 8); kopf = 16 }
      else if (groesse === 0) groesse = bis - o
      if (groesse == null || groesse < kopf || o + groesse > bis + 0) {
        // Abgeschnittene Datei: den Kasten trotzdem bis zum Ende nehmen
        if (groesse != null && groesse >= kopf) out.push({ typ, start: o, inhalt: o + kopf, ende: bis })
        break
      }
      out.push({ typ, start: o, inhalt: o + kopf, ende: o + groesse })
      o += groesse
    }
    return out
  }
  const meta = kaesten(0, b.length).find((k) => k.typ === 'meta')
  if (!meta) return null
  const kinder = kaesten(meta.inhalt + 4, meta.ende)   // meta ist ein FullBox (4 Byte Version/Flags)

  // iinf: Element-ID des Exif-Blocks finden
  let exifId = null
  const iinf = kinder.find((k) => k.typ === 'iinf')
  if (iinf) {
    const v = b[iinf.inhalt]
    const nOff = iinf.inhalt + 4
    const startInfe = nOff + (v === 0 ? 2 : 4)
    for (const infe of kaesten(startInfe, iinf.ende)) {
      if (infe.typ !== 'infe') continue
      const iv = b[infe.inhalt]
      if (iv < 2) continue
      const id = iv === 2 ? u16(infe.inhalt + 4) : u32(infe.inhalt + 4)
      const tOff = infe.inhalt + 4 + (iv === 2 ? 2 : 4) + 2
      if (ascii(b, tOff, 4) === 'Exif') { exifId = id; break }
    }
  }
  if (exifId == null) return null

  // iloc: Lage des Elements
  const iloc = kinder.find((k) => k.typ === 'iloc')
  if (!iloc) return null
  const v = b[iloc.inhalt]
  let o = iloc.inhalt + 4
  const a = b[o], c = b[o + 1]
  const offsetGr = a >> 4, laengeGr = a & 15, basisGr = c >> 4, indexGr = v === 1 || v === 2 ? c & 15 : 0
  o += 2
  const anzahl = v < 2 ? u16(o) : u32(o)
  o += v < 2 ? 2 : 4
  if (anzahl == null || anzahl > 10000) return null
  for (let i = 0; i < anzahl && o < iloc.ende; i++) {
    const id = v < 2 ? u16(o) : u32(o); o += v < 2 ? 2 : 4
    if (v === 1 || v === 2) o += 2                      // construction_method
    o += 2                                               // data_reference_index
    const basis = uN(o, basisGr); o += basisGr
    const nExt = u16(o); o += 2
    if (basis == null || nExt == null) return null
    let erste = null
    for (let e = 0; e < nExt; e++) {
      if (indexGr) o += indexGr
      const eo = uN(o, offsetGr); o += offsetGr
      const el = uN(o, laengeGr); o += laengeGr
      if (eo == null || el == null) return null
      if (erste == null) erste = { offset: basis + eo, laenge: el }
    }
    if (id === exifId && erste) return erste
  }
  return null
}

/** Exif-Element einer HEIC: 4 Byte Versatz zum TIFF-Kopf, dann (meist) „Exif\0\0“ und TIFF. */
export function leseHeicExifBlock(eingabe) {
  const b = alsBytes(eingabe)
  if (!b || b.length < 12) return { ...LEER }
  const vers = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
  const start = 4 + vers
  if (start + 8 <= b.length) {
    const r = leseTiff(b, start)
    if (r.datum || r.lat != null) return r
  }
  // Manche Programme schreiben den Versatz falsch: nach dem TIFF-Kopf suchen
  return sucheTiff(b)
}

/** Notnagel: „Exif\0\0“ gefolgt von einem TIFF-Kopf irgendwo im Puffer. */
export function sucheTiff(eingabe) {
  const b = alsBytes(eingabe)
  if (!b) return { ...LEER }
  for (let i = 0; i + 14 <= b.length; i++) {
    if (b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66 && b[i + 4] === 0 && b[i + 5] === 0) {
      const r = leseTiff(b, i + 6)
      if (r.datum || r.lat != null) return r
    }
  }
  return { ...LEER }
}

/**
 * Liest Aufnahmezeit und Ort aus einem vollständigen Dateipuffer (JPEG oder HEIC).
 * Wirft nie; ohne Daten kommt LEER zurück.
 */
export function leseExif(eingabe) {
  try {
    const b = alsBytes(eingabe)
    if (!b || b.length < 4) return { ...LEER }
    if (b[0] === 0xff && b[1] === 0xd8) return leseJpeg(b)
    if (istHeic(b)) {
      const lage = heicExifLage(b)
      if (lage && lage.offset + lage.laenge <= b.length) return leseHeicExifBlock(b.subarray(lage.offset, lage.offset + lage.laenge))
      return sucheTiff(b.subarray(0, Math.min(b.length, 4 * 1024 * 1024)))
    }
    if (ascii(b, 0, 2) === 'II' || ascii(b, 0, 2) === 'MM') return leseTiff(b, 0)
    return { ...LEER }
  } catch {
    return { ...LEER }
  }
}

const leseStueck = async (datei, von, bis) => new Uint8Array(await datei.slice(von, bis).arrayBuffer())

/**
 * Für eine gewählte Datei (File/Blob): liest nur die nötigen Stücke, nicht das ganze Bild.
 * JPEG: die ersten 256 KB (APP1 darf höchstens 64 KB groß sein).
 * HEIC: Anfang mit meta-Kasten, dann gezielt das Exif-Element.
 */
export async function exifAusDatei(datei) {
  try {
    if (!datei || typeof datei.slice !== 'function') return { ...LEER }
    const anfang = await leseStueck(datei, 0, 256 * 1024)
    if (anfang[0] === 0xff && anfang[1] === 0xd8) return leseJpeg(anfang)
    if (istHeic(anfang)) {
      let kopf = anfang
      let lage = heicExifLage(kopf)
      if (!lage && datei.size > kopf.length) {
        kopf = await leseStueck(datei, 0, Math.min(datei.size, 2 * 1024 * 1024))
        lage = heicExifLage(kopf)
      }
      if (lage && lage.laenge > 0 && lage.laenge < 4 * 1024 * 1024) {
        return leseHeicExifBlock(await leseStueck(datei, lage.offset, lage.offset + lage.laenge))
      }
      return sucheTiff(kopf)
    }
    return { ...LEER }
  } catch {
    return { ...LEER }
  }
}
