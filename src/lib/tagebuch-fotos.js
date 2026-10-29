// Fotos fürs Tagebuch, die NUR auf diesem Gerät liegen.
//
// Warum es das gibt: Logbuch-Fotos stecken als data-URL im Journal (2000 px, siehe
// thumbnail.js) und wandern mit jedem Backup. Für eine Handvoll Fotos unterwegs passt das.
// Hunderte Fotos fürs fertige Tagebuch würden Backup und iPhone-Speicher sprengen. Also
// liegen sie hier: in einer eigenen Datenbank im Browser, in höherer Auflösung (3000 px,
// genug für ein gedrucktes Fotobuch), dazu eine kleine Vorschau für die Anzeige.
// Nichts davon kommt ins Journal oder ins Backup.
//
// Eine bloße Verknüpfung zur Fotos-Mediathek kann eine Web-App nicht anlegen: Safari gibt
// aus der Mediathek nur Kopien über die Dateiauswahl heraus, ohne dauerhafte Kennung.
// Am Mac steht die Mediathek im Auswahlfenster links unter „Medien“, Eintrag „Fotos“.
//
// Eigene Datenbank wie bei den Belegen (`wa-belege`): keine Versionsanhebung am Topf der
// Nutzerdaten, und „Alle löschen“ kann nichts anderes treffen.
import { writable, derived } from 'svelte/store'
import { naechsterOrt, quellKennung } from './foto-zuordnung.js'
import { dezimal } from './format.js'
import { t } from './i18n.js'

export const DB_NAME = 'wa-tagebuch-fotos'
const ANGABEN = 'fotos'    // kleine Datensätze: Tag, Zeit, Ort, Größe
const BILDER = 'bilder'    // { gross: Blob, klein: Blob }, getrennt, damit die Liste ohne Bilddaten lädt

export const GROSS_PX = 3000
export const KLEIN_PX = 640
const GROSS_QUALITAET = 0.85
const KLEIN_QUALITAET = 0.78

let offen = null
function openDB() {
  if (!offen) {
    offen = new Promise((fertig, fehler) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const s of [ANGABEN, BILDER]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => { db.close(); offen = null }
        fertig(db)
      }
      req.onerror = () => fehler(req.error)
    }).catch((e) => { offen = null; throw e })
  }
  return offen
}

function tx(toepfe, modus, fn) {
  return openDB().then((db) => new Promise((fertig, fehler) => {
    const t = db.transaction(toepfe, modus)
    const req = fn(t)
    t.oncomplete = () => fertig(req?.result)
    t.onerror = () => fehler(t.error)
    t.onabort = () => fehler(t.error)
  }))
}

/** Aufnahmereihenfolge: Tag, Uhrzeit, Dateiname. */
export const nachAufnahme = (a, b) =>
  (a.datum || '').localeCompare(b.datum || '') || (a.zeit || '').localeCompare(b.zeit || '') || (a.name || '').localeCompare(b.name || '')

export const speicherBedarf = (liste) => (liste || []).reduce((n, f) => n + (f?.groesse || 0), 0)

/** „0,4 MB“, „212 MB“, „1,3 GB“ */
export function groesseText(bytes) {
  const mb = (Number(bytes) || 0) / 1048576
  if (mb >= 1000) return dezimal(mb / 1024, 1) + ' GB'
  return (mb >= 100 ? dezimal(mb, 0) : dezimal(mb, 1)) + ' MB'
}

/** Angaben aller Tagebuch-Fotos auf diesem Gerät, in Aufnahmereihenfolge. */
export const tagebuchFotos = writable([])
/** Belegter Speicher in Bytes (volle Fassung und Vorschau). */
export const tagebuchFotosGroesse = derived(tagebuchFotos, speicherBedarf)

export async function ladeTagebuchFotos() {
  try {
    const liste = (await tx([ANGABEN], 'readonly', (t) => t.objectStore(ANGABEN).getAll())) || []
    const sortiert = liste.filter((f) => f && f.id).sort(nachAufnahme)
    tagebuchFotos.set(sortiert)
    return sortiert
  } catch { tagebuchFotos.set([]); return [] }
}

/**
 * Ein Foto ablegen. `angaben` aus tagebuchAngaben(), `bild` = { gross, klein } als Blob.
 * Beides in EINER Transaktion: es gibt nie Angaben ohne Bild oder ein Bild ohne Angaben.
 * `melden: false` lässt den Store in Ruhe (beim Import vieler Fotos, danach ladeTagebuchFotos):
 * sonst zeichnet das Tagebuch nach jedem einzelnen Foto alles neu.
 */
export async function speichereTagebuchFoto(angaben, { gross, klein }, { melden = true } = {}) {
  if (!angaben?.id || !gross) throw new Error(t('Bild konnte nicht gelesen werden'))
  const a = { ...angaben, groesse: (gross.size || 0) + (klein?.size || 0) }
  await tx([ANGABEN, BILDER], 'readwrite', (t) => {
    t.objectStore(BILDER).put({ gross, klein: klein || gross }, a.id)
    return t.objectStore(ANGABEN).put(a, a.id)
  })
  if (melden) tagebuchFotos.update((l) => [...l.filter((f) => f.id !== a.id), a].sort(nachAufnahme))
  return a
}

/** Bilddaten eines Fotos: art 'gross' (3000 px) oder 'klein' (Vorschau). */
export async function holeTagebuchBild(id, art = 'gross') {
  try { return (await tx([BILDER], 'readonly', (t) => t.objectStore(BILDER).get(id)))?.[art] || null }
  catch { return null }
}

export async function loescheTagebuchFoto(id) {
  await tx([ANGABEN, BILDER], 'readwrite', (t) => {
    t.objectStore(BILDER).delete(id)
    return t.objectStore(ANGABEN).delete(id)
  })
  tagebuchFotos.update((l) => l.filter((f) => f.id !== id))
}

export async function loescheAlleTagebuchFotos() {
  await tx([ANGABEN, BILDER], 'readwrite', (t) => {
    t.objectStore(BILDER).clear()
    return t.objectStore(ANGABEN).clear()
  })
  tagebuchFotos.set([])
}

/** Wie viel der Browser dieser Seite noch gibt (Bytes) oder null, wenn er es nicht verrät. */
export async function speicherFrei() {
  try {
    const s = await navigator.storage?.estimate?.()
    return s && s.quota ? Math.max(0, s.quota - (s.usage || 0)) : null
  } catch { return null }
}

/** Den Browser bitten, die Daten nicht bei Platznot von selbst zu räumen. Fragt nie nach. */
export function bitteDauerhaft() {
  try { navigator.storage?.persist?.().catch(() => {}) } catch {}
}

// ---------- Zuordnung (rein, ohne Browser) ----------

/** Zu welcher Etappe gehört ein Tag? Wie in chronik(): überschneiden sich zwei, gehört er der später beginnenden. */
export function etappeIndex(etappen = [], datum) {
  if (!datum) return -1
  for (let i = 0; i < etappen.length; i++) {
    const e = etappen[i], n = etappen[i + 1]
    if (datum >= e.von && datum <= e.bis && !(n && datum >= n.von)) return i
  }
  return -1
}

/**
 * Fotos nach Etappe und Tag ordnen, wie die Kapitel im Tagebuch.
 * @param fotos   Liste mit Tag (Vorgabe: `datum`)
 * @param etappen aus etappenMitDatum()
 * @returns [{ id, art: 'etappe'|'vorher'|'zwischen'|'nachher', etappe, tage: [{ datum, fotos }] }]
 */
export function nachEtappeUndTag(fotos = [], etappen = [], tagVon = (f) => f.datum) {
  const proTag = new Map()
  for (const f of fotos || []) {
    const d = f && tagVon(f)
    if (!d) continue
    if (!proTag.has(d)) proTag.set(d, [])
    proTag.get(d).push(f)
  }
  const start = etappen[0]?.von
  const ende = etappen.length ? etappen.reduce((m, e) => (e.bis > m ? e.bis : m), etappen[0].bis) : null
  const gruppen = new Map()
  for (const datum of [...proTag.keys()].sort()) {
    const i = etappeIndex(etappen, datum)
    const art = i >= 0 ? 'etappe' : !start || datum < start ? 'vorher' : datum > ende ? 'nachher' : 'zwischen'
    const id = i >= 0 ? (etappen[i].reise?.id ?? etappen[i].id ?? 'etappe-' + i) : art
    if (!gruppen.has(id)) gruppen.set(id, { id, art, etappe: i >= 0 ? etappen[i] : null, tage: [] })
    gruppen.get(id).tage.push({ datum, fotos: proTag.get(datum).sort((a, b) => (a.zeit || '').localeCompare(b.zeit || '') || (a.name || '').localeCompare(b.name || '')) })
  }
  return [...gruppen.values()]
}

/**
 * Vorschau: gewählte Fotos fürs Tagebuch ordnen.
 *
 * Übersprungen wird, was schon im Tagebuch liegt (gleiche Quelldatei, oder gleiche
 * Aufnahmezeit und gleicher Name: am Mac hat dasselbe Foto bei jedem Export eine neue
 * Änderungszeit) und was unterwegs schon ins Logbuch kam (gleiche Quelldatei oder gleiche
 * Aufnahmezeit auf die Sekunde, denn das iPhone liefert dort einen anderen Dateinamen).
 *
 * @param fotos  [{ id, name, groesse, lastModified, datum, zeit, lat, lon }] aus exifAusDatei
 * @param opt    { etappen, orte, vorhandene (tagebuchFotos), journal, ohneDatumTag, ausgeschlossen:Set(id) }
 * @returns { gruppen, ohneDatum, anzahl, tageAnzahl, mitOrt, schonDa, imLogbuch, offen, zumSpeichern }
 */
export function planeTagebuchFotos(fotos = [], { etappen = [], orte = [], vorhandene = [], journal = [], ohneDatumTag = null, ausgeschlossen = null } = {}) {
  const daQuelle = new Set(), daZeitName = new Set()
  for (const f of vorhandene || []) {
    if (f?.quelle) daQuelle.add(f.quelle)
    if (f?.zeit && f.name) daZeitName.add(f.zeit + '|' + f.name)
  }
  const logQuelle = new Set(), logZeit = new Set()
  for (const e of journal || []) for (const m of e?.fotoMeta || []) {
    if (m?.quelle) logQuelle.add(m.quelle)
    if (m?.zeit) logZeit.add(m.zeit)
  }

  const gewaehlt = new Set()
  const liste = [], ohneDatum = []
  let anzahl = 0, mitOrt = 0, schonDa = 0, imLogbuch = 0
  for (const f of fotos || []) {
    if (!f || (ausgeschlossen && ausgeschlossen.has(f.id))) continue
    const quelle = quellKennung(f)
    if (gewaehlt.has(quelle) || daQuelle.has(quelle) || (f.zeit && f.name && daZeitName.has(f.zeit + '|' + f.name))) { schonDa++; continue }
    if (logQuelle.has(quelle) || (f.zeit && logZeit.has(f.zeit))) { imLogbuch++; continue }
    gewaehlt.add(quelle)
    const p = { ...f, quelle, ort: naechsterOrt(f.lat, f.lon, orte), tag: f.datum || ohneDatumTag || null }
    anzahl++
    if (f.lat != null && f.lon != null) mitOrt++
    if (!f.datum) ohneDatum.push(p)
    if (p.tag) liste.push(p)
  }
  const gruppen = nachEtappeUndTag(liste, etappen, (f) => f.tag)
  const tageAnzahl = gruppen.reduce((n, g) => n + g.tage.length, 0)
  return {
    gruppen, ohneDatum, anzahl, tageAnzahl, mitOrt, schonDa, imLogbuch,
    offen: ohneDatumTag ? 0 : ohneDatum.length, zumSpeichern: liste.length,
  }
}

const neueId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)

/** Was zu einem Foto gespeichert wird, ohne Bilddaten. `foto` aus planeTagebuchFotos. */
export function tagebuchAngaben(foto, { id = neueId(), breite = null, hoehe = null, jetzt = new Date().toISOString() } = {}) {
  return {
    id,
    datum: foto.tag || foto.datum || null,
    zeit: foto.zeit || null,
    ohneDatum: !foto.datum,
    quelle: foto.quelle || quellKennung(foto),
    name: foto.name || '',
    lat: foto.lat ?? null,
    lon: foto.lon ?? null,
    ort: foto.ort?.name || null,
    ortId: foto.ort?.id ?? null,
    km: foto.ort?.km ?? null,
    breite, hoehe,
    groesse: 0,
    hinzu: jetzt,
  }
}

// ---------- Im Browser: verkleinern und anzeigen ----------

function aufLeinwand(quelle, breite, hoehe, maxPx) {
  const s = Math.min(1, maxPx / Math.max(breite, hoehe))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(breite * s))
  cv.height = Math.max(1, Math.round(hoehe * s))
  const ctx = cv.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(quelle, 0, 0, cv.width, cv.height)
  return cv
}
// Chrome kodiert bei toBlob nur in Leerlaufzeit. Eine verborgene Seite hat keine, dann wartet
// jedes Bild rund eine Sekunde. Wer beim Import von hunderten Fotos den Tab wechselt, bekäme
// so ein Vielfaches der Zeit. Deshalb bei verborgener Seite der direkte Weg über toDataURL.
function ausDatenUrl(url) {
  const roh = atob(url.slice(url.indexOf(',') + 1))
  const bytes = new Uint8Array(roh.length)
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}
const alsJpeg = (cv, q) => (document.hidden
  ? Promise.resolve(ausDatenUrl(cv.toDataURL('image/jpeg', q)))
  : new Promise((ok, nein) => cv.toBlob((b) => (b ? ok(b) : nein(new Error(t('Bild konnte nicht gelesen werden')))), 'image/jpeg', q)))

/**
 * Zwei JPEG-Fassungen aus einer Bilddatei: groß (3000 px lange Kante) und Vorschau (640 px).
 * Die Vorschau entsteht aus der großen Fassung, das ist schneller und schärfer als direkt.
 * Die Ausrichtung übernimmt der Browser beim Zeichnen; Ort und Kamera stehen danach nicht
 * mehr in der Datei, sie liegen in den Angaben.
 */
export function macheTagebuchBild(file) {
  return new Promise((fertig, fehler) => {
    if (!file || !(file.type?.startsWith('image/') || /\.(heic|heif)$/i.test(file.name || ''))) return fehler(new Error(t('Keine Bilddatei')))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      let gross = null, klein = null
      try {
        gross = aufLeinwand(img, img.naturalWidth, img.naturalHeight, GROSS_PX)
        klein = aufLeinwand(gross, gross.width, gross.height, KLEIN_PX)
        const [g, k] = [await alsJpeg(gross, GROSS_QUALITAET), await alsJpeg(klein, KLEIN_QUALITAET)]
        fertig({ gross: g, klein: k, breite: gross.width, hoehe: gross.height })
      } catch (e) { fehler(e) }
      finally {
        URL.revokeObjectURL(url)
        // Safari gibt den Speicher großer Leinwände sonst erst spät frei
        for (const cv of [gross, klein]) if (cv) { cv.width = 0; cv.height = 0 }
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error(t('Bild konnte nicht gelesen werden'))) }
    img.src = url
  })
}

/**
 * Svelte-Aktion: zeigt ein Tagebuch-Foto, sobald es in die Nähe des sichtbaren Bereichs kommt.
 *   <img use:geraetBild={id} alt="…">                Vorschau
 *   <img use:geraetBild={{ id, art: 'gross' }} …>    volle Auflösung
 * Die Blob-Adresse wird beim Entfernen wieder freigegeben.
 */
export function geraetBild(node, wert) {
  let url = '', beobachter = null, lauf = 0, schluessel = ''
  const frei = () => { if (url) { URL.revokeObjectURL(url); url = '' } }
  const zerlege = (w) => (w && typeof w === 'object' ? { id: w.id, art: w.art || 'klein' } : { id: w, art: 'klein' })
  async function lade(w) {
    const nr = ++lauf
    const { id, art } = zerlege(w)
    const blob = id ? await holeTagebuchBild(id, art) : null
    if (nr !== lauf) return
    frei()
    if (!blob) { node.removeAttribute('src'); return }
    url = URL.createObjectURL(blob)
    node.src = url
  }
  function beobachte(w) {
    const { id, art } = zerlege(w)
    if (id + '|' + art === schluessel) return
    schluessel = id + '|' + art
    beobachter?.disconnect()
    if (typeof IntersectionObserver === 'undefined') { lade(w); return }
    beobachter = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return
      beobachter.disconnect(); beobachter = null
      lade(w)
    }, { rootMargin: '800px 0px' })
    beobachter.observe(node)
  }
  beobachte(wert)
  return {
    update(neu) { beobachte(neu) },
    destroy() { lauf++; beobachter?.disconnect(); frei() },
  }
}
