// Fotos mit Aufnahmedatum und Ort ins Logbuch einsortieren (reine Logik, ohne DOM).
//
// Datenformat am Logbuch-Eintrag (rückwärtskompatibel):
//   eintrag.fotos     = ['data:image/jpeg;base64,…', …]   unverändert, wie bisher nur Bilddaten
//   eintrag.fotoMeta  = [{ k, quelle, zeit, lat, lon, ort, ortId, km }, …]   NEU, optional
// Ein Meta-Eintrag hängt über `k` (Fingerabdruck der Bilddaten) am Foto, nicht über die
// Position. So bleiben die Angaben richtig, wenn ein anderes Gerät beim Zusammenführen
// Fotos ergänzt oder wenn ein Foto gelöscht wird. Alte Einträge ohne fotoMeta gehen weiter.
import { deckt } from './plan.js'
import { haversine } from './routing.js'
import { t, tn } from './i18n.js'

export const ORT_RADIUS_KM = 15

/** Kurzer Fingerabdruck einer Zeichenkette (FNV-1a 32 Bit plus Länge). */
export function fotoSchluessel(src) {
  const s = String(src || '')
  let h = 0x811c9dc5
  // Bei großen Bildern reicht jedes n-te Zeichen plus Anfang und Ende; Länge kommt dazu.
  const schritt = s.length > 200000 ? 7 : 1
  for (let i = 0; i < s.length; i += schritt) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  for (let i = Math.max(0, s.length - 64); i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return s.length.toString(36) + '-' + h.toString(36)
}

/** Angaben zu einem Foto eines Eintrags (oder null bei alten Fotos ohne Angaben). */
export function fotoInfo(eintrag, src) {
  const meta = eintrag?.fotoMeta
  if (!Array.isArray(meta) || !meta.length) return null
  const k = fotoSchluessel(src)
  return meta.find((m) => m && m.k === k) || null
}

/** Nach dem Löschen eines Fotos: Angaben entfernen, die zu keinem Foto mehr gehören. */
export function bereinigeMeta(fotos = [], meta = []) {
  if (!Array.isArray(meta)) return []
  const da = new Set((fotos || []).map(fotoSchluessel))
  return meta.filter((m) => m && da.has(m.k))
}

/** Nächster bekannter Ort im Umkreis (Vorgabe 15 km) oder null. */
export function naechsterOrt(lat, lon, orte = [], maxKm = ORT_RADIUS_KM) {
  if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return null
  let best = null
  for (const o of orte || []) {
    if (!o || o.lat == null || o.lon == null || !o.name) continue
    const km = haversine(lat, lon, Number(o.lat), Number(o.lon))
    if (km <= maxKm && (!best || km < best.km)) best = { id: o.id ?? null, name: o.name, km: Math.round(km * 10) / 10 }
  }
  return best
}

/** Eindeutige Kennung der Quelldatei, damit ein zweiter Import dasselbe Foto erkennt. */
export const quellKennung = (f) => [f.name || '', f.groesse ?? f.size ?? '', f.zeit || f.lastModified || ''].join('|')

/**
 * Vorschau: Fotos nach Tagen gruppieren.
 * @param fotos  [{ id, name, groesse, datum, zeit, lat, lon }]
 * @param opt    { orte, ohneDatumTag, journal, ausgeschlossen:Set(id) }
 * @returns { tage:[{ datum, fotos, eintragId, neu }], ohneDatum:[…], anzahl, tageAnzahl, mitOrt, doppelt }
 */
export function planeFotos(fotos = [], { orte = [], ohneDatumTag = null, journal = [], ausgeschlossen = null } = {}) {
  const schonDa = new Set()
  for (const e of journal || []) for (const m of e?.fotoMeta || []) if (m?.quelle) schonDa.add(m.quelle)

  const gruppen = new Map()
  const ohneDatum = []
  let mitOrt = 0, doppelt = 0, anzahl = 0
  for (const f of fotos) {
    if (!f || (ausgeschlossen && ausgeschlossen.has(f.id))) continue
    const quelle = quellKennung(f)
    if (schonDa.has(quelle)) { doppelt++; continue }
    const ort = naechsterOrt(f.lat, f.lon, orte)
    const p = { ...f, quelle, ort }
    if (f.lat != null && f.lon != null) mitOrt++
    anzahl++
    const tag = f.datum || ohneDatumTag
    if (!f.datum) ohneDatum.push(p)
    if (!tag) continue
    if (!gruppen.has(tag)) gruppen.set(tag, [])
    gruppen.get(tag).push(p)
  }
  const tage = [...gruppen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([datum, liste]) => {
    const e = zielEintrag(journal, datum)
    return { datum, fotos: liste.sort((a, b) => (a.zeit || '').localeCompare(b.zeit || '')), eintragId: e?.id || null, neu: !e }
  })
  return { tage, ohneDatum, anzahl, tageAnzahl: tage.length, mitOrt, doppelt, offen: !ohneDatumTag ? ohneDatum.length : 0 }
}

/** Text für die Vorschau: „12 Fotos · 5 Tage · 9 mit Ort“ */
export function zusammenfassung(plan) {
  const n = plan.anzahl, tage = plan.tageAnzahl
  const teile = [tn(n, '{n} Foto', '{n} Fotos'), tn(tage, '{n} Tag', '{n} Tage'), t('{n} mit Ort', { n: plan.mitOrt })]
  return teile.join(' · ')
}

/** Der Eintrag eines Tages, zu dem neue Fotos kommen: der erste mit diesem Datum. */
export function zielEintrag(journal = [], datum) {
  const alle = (journal || []).filter((e) => e && deckt(e, datum))
  if (!alle.length) return null
  // Bei mehreren Einträgen am selben Tag der älteste: das ist der „Haupteintrag“.
  // Die Liste ist neueste zuerst gespeichert, also der letzte Treffer.
  return alle[alle.length - 1]
}

/** Meta-Angaben für ein fertig verkleinertes Foto. */
export function metaFuer(foto, src) {
  return {
    k: fotoSchluessel(src),
    quelle: foto.quelle || quellKennung(foto),
    zeit: foto.zeit || null,
    lat: foto.lat ?? null,
    lon: foto.lon ?? null,
    ort: foto.ort?.name || null,
    ortId: foto.ort?.id ?? null,
    km: foto.ort?.km ?? null,
  }
}

/**
 * Was am Tag gespeichert wird. `bilder` = [{ foto, src }] (src = verkleinertes Bild).
 * Liefert für einen vorhandenen Eintrag ein Patch für updateJournalEintrag, für einen
 * neuen Tag die Vorlage für neuerJournalEintrag plus das Patch danach (fotoMeta kennt
 * neuerJournalEintrag nicht).
 */
export function tagesPatch(eintrag, bilder = []) {
  const alteFotos = eintrag?.fotos || []
  const alteMeta = Array.isArray(eintrag?.fotoMeta) ? eintrag.fotoMeta : []
  const vorhanden = new Set(alteFotos.map(fotoSchluessel))
  const neueFotos = [], neueMeta = []
  for (const { foto, src } of bilder) {
    if (!src) continue
    const m = metaFuer(foto, src)
    if (vorhanden.has(m.k)) continue
    vorhanden.add(m.k)
    neueFotos.push(src); neueMeta.push(m)
  }
  const patch = { fotos: [...alteFotos, ...neueFotos], fotoMeta: [...alteMeta, ...neueMeta] }
  // Ein frisch angelegter Tag bekommt den häufigsten bekannten Ort seiner Fotos.
  let vorlage = null
  if (!eintrag) {
    const zaehl = new Map()
    for (const { foto } of bilder) if (foto.ort) {
      const z = zaehl.get(foto.ort.name) || { n: 0, foto }
      z.n++; zaehl.set(foto.ort.name, z)
    }
    const top = [...zaehl.values()].sort((a, b) => b.n - a.n)[0]
    vorlage = top
      ? { ort: top.foto.ort.name, ortId: top.foto.ort.id ?? null, lat: top.foto.lat, lon: top.foto.lon }
      : {}
  }
  return { patch, vorlage, neu: neueFotos.length }
}

/** Standardtag für Fotos ohne Datum: der vorgegebene (Tag des Eintrags), sonst heute. */
export function standardTag({ vorgabe = null, heute = null } = {}) {
  return vorgabe || heute || null
}
