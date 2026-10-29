// Musik unterwegs: Zustand (DiscoveryStateService).
//
// Reine Funktionen, die einen Zustand nehmen und einen neuen liefern. Dadurch lassen sie
// sich ohne Browser testen (tests/musik.test.mjs). Gespeichert wird der Zustand im selben
// IndexedDB-Topf wie der Rest der App (speicher.js), aber NICHT im Backup: Welche Titel in
// der Playlist stehen, weiß Spotify selbst; das hier ist nur das Gedächtnis des Geräts.
//
// Zustände eines Titels:
//   entdeckt   – eine Quelle hat ihn genannt (Titel + Künstler, noch ohne Spotify-ID)
//   geprueft   – auf Spotify eindeutig gefunden, hat eine Track-ID
//   wartend    – soll in die Playlist, Schreibversuch läuft oder steht aus
//   hinzugefuegt – Spotify hat das Hinzufügen bestätigt (nur DAS zählt für den Zähler)
//   fehler     – Hinzufügen fehlgeschlagen
//   doppelt    – stand schon in der Playlist
import { t } from '../i18n.js'
export const STATUS = ['entdeckt', 'geprueft', 'wartend', 'hinzugefuegt', 'fehler', 'doppelt']

export const LEER = Object.freeze({
  version: 1,
  playlist: null,          // { id, name, url }
  titel: {},               // spotifyId → Titel-Datensatz
  regionen: {},            // regionId → { name, ebene, zuletzt, status, quelle }
  ausstehend: [],          // regionIds, die offline erkannt wurden und noch gesucht werden
  letzterOrt: null,        // { lat, lon, zeit, regionId }
  protokoll: [],           // [{ zeit, art: 'info'|'ok'|'fehler', text }]
})

const jetztIso = () => new Date().toISOString()

export function protokolliere(z, art, text, zeit = jetztIso()) {
  const p = [{ zeit, art, text }, ...(z.protokoll || [])].slice(0, 120)
  return { ...z, protokoll: p }
}

/** Kandidaten mit Spotify-ID vormerken. Bekannte IDs werden nicht neu angelegt. */
export function vormerken(z, kandidaten, { zeit = jetztIso() } = {}) {
  const titel = { ...z.titel }
  const neu = []
  for (const k of kandidaten) {
    if (!k?.spotifyId) continue
    const alt = titel[k.spotifyId]
    if (alt) continue
    titel[k.spotifyId] = {
      spotifyId: k.spotifyId, uri: k.uri || `spotify:track:${k.spotifyId}`,
      titel: k.titel, kuenstler: k.kuenstler, url: k.url || null,
      quelle: k.quelle || '', ebene: k.ebene || 'national', gebiet: k.gebiet || '', art: k.art || null, stil: k.stil || null,
      regionId: k.regionId || null, regionName: k.regionName || '',
      status: 'wartend', entdeckt: zeit, hinzugefuegt: null, gesehen: false, fehler: null,
    }
    neu.push(k.spotifyId)
  }
  return { z: { ...z, titel }, neu }
}

function setze(z, ids, patch) {
  const titel = { ...z.titel }
  for (const id of ids) if (titel[id]) titel[id] = { ...titel[id], ...patch }
  return { ...z, titel }
}

/** Nur nach BESTÄTIGTEM Erfolg von Spotify aufrufen. */
export const alsHinzugefuegt = (z, ids, zeit = jetztIso()) => setze(z, ids, { status: 'hinzugefuegt', hinzugefuegt: zeit, gesehen: false, fehler: null })
export const alsFehler = (z, ids, text) => setze(z, ids, { status: 'fehler', fehler: String(text || t('unbekannt')) })
export const alsDoppelt = (z, ids) => setze(z, ids, { status: 'doppelt' })

/** Neue, noch nicht angesehene Titel (für den Zähler am Symbol). */
export function neueTitel(z) {
  return Object.values(z.titel || {})
    .filter((t) => t.status === 'hinzugefuegt' && !t.gesehen)
    .sort((a, b) => (b.hinzugefuegt || '').localeCompare(a.hinzugefuegt || ''))
}
export const neueAnzahl = (z) => neueTitel(z).length

export function alleGesehen(z) {
  return setze(z, Object.values(z.titel || {}).filter((t) => t.status === 'hinzugefuegt' && !t.gesehen).map((t) => t.spotifyId), { gesehen: true })
}

/** Welche Titel sind schon in der Playlist oder auf dem Weg dorthin? */
export function bekannteIds(z) {
  return new Set(Object.values(z.titel || {}).filter((t) => ['wartend', 'hinzugefuegt', 'doppelt'].includes(t.status)).map((t) => t.spotifyId))
}

export function regionMerken(z, region, status, zeit = jetztIso()) {
  const alt = z.regionen?.[region.id] || {}
  return { ...z, regionen: { ...z.regionen, [region.id]: { ...alt, name: region.name, ebene: region.ebene, ...(region.welt ? { welt: true, land: region.land, landName: region.landName, staatName: region.staatName } : {}), ...(region.staat ? { staat: region.staat, land: region.land } : {}), ...(region.umgebung ? { umgebung: region.umgebung, umgebungWeit: region.umgebungWeit || [] } : {}), status, zuletzt: zeit } } }
}
export function ausstehendDazu(z, regionId) {
  return z.ausstehend.includes(regionId) ? z : { ...z, ausstehend: [...z.ausstehend, regionId] }
}
export function ausstehendWeg(z, regionId) {
  return { ...z, ausstehend: z.ausstehend.filter((x) => x !== regionId) }
}

/** Standortdaten löschen: letzter Ort, Regionen und Gebiete an den Titeln. Die Titel selbst
    bleiben (sie stehen in der Playlist), nur ohne Ortsbezug. */
/** Von vorne anfangen: alle gesammelten Titel, Orte und das Protokoll weg. Die verknüpfte
 *  Playlist bleibt verknüpft, Einstellungen und Spotify-Anmeldung liegen woanders und bleiben. */
export function vonVorn(z, { entfernt = 0, zeit = jetztIso() } = {}) {
  const text = entfernt ? t('Von vorne angefangen, {entfernt} Titel aus der Playlist genommen', { entfernt }) : t('Von vorne angefangen (Playlist unverändert)')
  return protokolliere({ ...LEER, playlist: z.playlist || null }, 'info', text, zeit)
}

/** Spotify-URIs der Titel, die TravelBuddy selbst in die Playlist eingetragen hat */
export function eigeneUris(z) {
  return Object.values(z.titel || {}).filter((t) => t.status === 'hinzugefuegt').map((t) => t.uri || `spotify:track:${t.spotifyId}`)
}

export function standortVergessen(z) {
  const titel = Object.fromEntries(Object.entries(z.titel || {}).map(([id, t]) => [id, { ...t, regionId: null, regionName: '', gebiet: '' }]))
  return { ...z, titel, regionen: {}, ausstehend: [], letzterOrt: null }
}
