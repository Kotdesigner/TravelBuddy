// Echte Offline-Karte für die Übersichtskarten (Orte: Gesamtkarte und Gegenden).
// Grundlage ist die Datei „Australien-Überblick“ (australien.pmtiles, 10 MB, Zoom 0 bis 8) der
// Offline-Karte: Land, Meer, Staatsgrenzen, Highways, Nationalparks, Seen, Städte.
// Liegt die Datei nicht auf dem Gerät und es gibt kein Netz, zeigen die Karten die gezeichnete
// Fassung (UebersichtsKarte). MapLibre und pmtiles teilen sich EIN Protokoll mit der großen Karte.
import { writable, get } from 'svelte/store'
import { online } from './netz.js'

let lib = null
/** MapLibre + pmtiles einmal für die ganze App laden, ein gemeinsames pmtiles-Protokoll */
export function ladeKartenLib() {
  if (!lib) {
    // Basic: MapLibre 6 über maplibre.js (dort wird der Worker mitgeliefert)
    lib = Promise.all([import('./maplibre.js'), import('pmtiles')]).then(([ml, pm]) => {
      const maplibregl = ml.default ?? ml
      const protocol = new pm.Protocol()
      maplibregl.addProtocol('pmtiles', protocol.tile)
      return { maplibregl, pmtiles: pm, protocol }
    })
    lib.catch(() => { lib = null })
  }
  return lib
}

// Eigener Name im Protokoll: die große Karte darf ihre Teile wegwerfen, ohne diese Quelle zu treffen
export const UEBERBLICK_NAME = 'ueberblick-australien.pmtiles'
export const UEBERBLICK_URL = 'pmtiles://' + UEBERBLICK_NAME
const DATEI = '/karten/australien.pmtiles'
const CACHE = 'karten-pmtiles-v2'

// Die Datei reicht bis Zoom 8. Bis 10,5 bleibt die Darstellung sauber, darüber werden Parks
// eckig und Küsten grob. Deshalb lässt sich nicht weiter hineinzoomen.
export const MAX_ZOOM = 10.5
export const MIN_ZOOM = 2.6
export const GRENZEN = [[100, -50], [170, -4]]

/** 'aus' | 'laedt' | 'bereit' | 'fehlt' */
export const ueberblick = writable('aus')
let laden = null

/** Datei aus dem Kartenspeicher holen, sonst einmal laden (nur mit Netz und ohne Datensparmodus) */
export function ladeUeberblick() {
  if (laden) return laden
  ueberblick.set('laedt')
  laden = (async () => {
    try {
      const url = location.origin + DATEI
      let cache = null
      try { cache = await caches.open(CACHE) } catch {}
      let resp = null
      try { resp = cache ? await cache.match(url) : null } catch {}
      if (!resp) {
        const sparen = typeof navigator !== 'undefined' && navigator.connection?.saveData
        if (!get(online) || sparen) throw new Error('nicht auf dem Gerät')
        resp = await fetch(url, { mode: 'same-origin' })
        if (!resp.ok) throw new Error('nicht verfügbar')
        const kopie = resp.clone()
        // Fürs Offline ablegen (wie die große Karte: erst löschen, sonst zwei Einträge)
        if (cache) { try { await cache.delete(url); await cache.put(url, kopie) } catch {} }
      }
      const buf = await resp.arrayBuffer()
      const { pmtiles, protocol } = await ladeKartenLib()
      const p = new pmtiles.PMTiles(new pmtiles.FileSource(new File([buf], UEBERBLICK_NAME)))
      await p.getHeader()
      protocol.add(p)
      ueberblick.set('bereit')
      return true
    } catch {
      ueberblick.set('fehlt')
      laden = null   // beim nächsten Öffnen mit Netz noch einmal versuchen
      return false
    }
  })()
  return laden
}

// ---------- Farben ----------
export const FARBEN = {
  hell: { meer: '#cfe4ef', land: '#f1e7d3', park: '#d3e2b6', strasse: '#d9ac62', strasseRand: '#f1e7d3', grenze: '#8e7f9e',
    stadt: '#5b4f40', halo: '#f1e7d3', staat: '#9a8c78', fluss: '#a9cde0', punkt: '#c9612a', zahl: '#ffffff', saum: '#ffffff', ink: '#2b241c', blass: '#b9ad9a', rot: '#c62828', linieRand: '#ffffff' },
  dunkel: { meer: '#16303d', land: '#3d342b', park: '#3b4630', strasse: '#a07c47', strasseRand: '#3d342b', grenze: '#b3a2c2',
    stadt: '#e8dcc7', halo: '#2a231c', staat: '#a99a84', fluss: '#24495c', punkt: '#c9612a', zahl: '#ffffff', saum: '#ffffff', ink: '#f3eadb', blass: '#6d6152', rot: '#e5534b', linieRand: '#12100d' },
}

const STADT = ['all', ['==', ['get', 'kind'], 'locality'], ['==', ['get', 'kind_detail'], 'city']]
const ORT = ['all', ['==', ['get', 'kind'], 'locality'], ['!=', ['get', 'kind_detail'], 'city']]
const STRASSE = ['in', ['get', 'kind'], ['literal', ['highway', 'major_road']]]
const PARK = ['in', ['get', 'kind'], ['literal', ['national_park', 'nature_reserve', 'protected_area', 'park']]]

/** Ruhige Grundkarte: Meer, Land, Parks, Grenzen (unter dem Meer, so verschwinden Seegrenzen), Highways, Städte */
export function grundEbenen(f) {
  const q = { source: 'pm' }
  const schrift = { 'text-font': ['Noto Sans Regular'], 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'symbol-sort-key': ['coalesce', ['get', 'min_zoom'], 10] }
  return [
    { id: 'meer', type: 'background', paint: { 'background-color': f.meer } },
    { id: 'land', type: 'fill', ...q, 'source-layer': 'earth', paint: { 'fill-color': f.land, 'fill-antialias': false } },
    { id: 'park', type: 'fill', ...q, 'source-layer': 'landuse', filter: PARK, paint: { 'fill-color': f.park, 'fill-opacity': 0.95, 'fill-antialias': false } },
    { id: 'grenze', type: 'line', ...q, 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'region'], layout: { 'line-join': 'round' },
      paint: { 'line-color': f.grenze, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 1.6], 'line-dasharray': [3, 2], 'line-opacity': 0.9 } },
    { id: 'wasser', type: 'fill', ...q, 'source-layer': 'water', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': f.meer, 'fill-antialias': false } },
    { id: 'fluss', type: 'line', ...q, 'source-layer': 'water', minzoom: 7, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': f.fluss, 'line-width': 0.8 } },
    { id: 'strasse-rand', type: 'line', ...q, 'source-layer': 'roads', filter: STRASSE, layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': f.strasseRand, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 8, 3, 11, 4.6] } },
    { id: 'strasse', type: 'line', ...q, 'source-layer': 'roads', filter: STRASSE, layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': f.strasse, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.5, 11, 2.6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.55, 8, 0.9] } },
    { id: 'staat', type: 'symbol', ...q, 'source-layer': 'places', maxzoom: 8, filter: ['==', ['get', 'kind'], 'region'],
      layout: { 'text-field': ['upcase', ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-letter-spacing': 0.25, 'text-max-width': 6 },
      paint: { 'text-color': f.staat, 'text-halo-color': f.halo, 'text-halo-width': 1.2 } },
    { id: 'stadt-punkt', type: 'circle', ...q, 'source-layer': 'places', filter: STADT, paint: { 'circle-radius': 2, 'circle-color': f.stadt, 'circle-opacity': 0.7 } },
    { id: 'ort-punkt', type: 'circle', ...q, 'source-layer': 'places', minzoom: 7.5, filter: ORT, paint: { 'circle-radius': 1.6, 'circle-color': f.stadt, 'circle-opacity': 0.6 } },
    // Städte immer, kleinere Orte erst ab Zoom 7,5 (eigene Ebene: `zoom` in Filtern zählt nur ganze Kachelstufen)
    { id: 'stadt', type: 'symbol', ...q, 'source-layer': 'places', filter: STADT,
      layout: { ...schrift, 'text-field': ['get', 'name'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10.5, 10, 12], 'text-radial-offset': 0.5, 'text-padding': 4 },
      paint: { 'text-color': f.stadt, 'text-halo-color': f.halo, 'text-halo-width': 1.4, 'text-opacity': 0.9 } },
    { id: 'ort', type: 'symbol', ...q, 'source-layer': 'places', minzoom: 7.5, filter: ORT,
      layout: { ...schrift, 'text-field': ['get', 'name'], 'text-size': 10.5, 'text-radial-offset': 0.45, 'text-padding': 6 },
      paint: { 'text-color': f.stadt, 'text-halo-color': f.halo, 'text-halo-width': 1.3, 'text-opacity': 0.75 } },
  ]
}

/** Markierungen im Stil A: Kreis mit weißem Rand, weicher Schatten, weiße Zahl.
    radius: Ausdruck für den Kreisradius, text: Ausdruck für die Zahl, an: Ausdruck „hervorgehoben“ */
export function kreisEbenen(f, quelle, { radius, text, an }) {
  return [
    { id: quelle + '-schatten', type: 'circle', source: quelle, paint: { 'circle-radius': ['+', radius, 3], 'circle-color': '#000', 'circle-opacity': 0.28, 'circle-blur': 0.7, 'circle-translate': [0, 1.5] } },
    { id: quelle + '-kreis', type: 'circle', source: quelle,
      paint: { 'circle-radius': radius, 'circle-color': f.punkt, 'circle-stroke-color': ['case', an, f.ink, f.saum], 'circle-stroke-width': ['case', an, 3, 2.5] } },
    // text-padding: die Zahl hält Stadtnamen so weit fern, wie der Kreis groß ist
    { id: quelle + '-zahl', type: 'symbol', source: quelle,
      layout: { 'text-field': text, 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-allow-overlap': true, 'text-padding': 14 }, paint: { 'text-color': f.zahl } },
  ]
}

/** Rahmen [[w,s],[e,n]] um Punkte [lon,lat], mindestens spanne = [Grad Länge, Grad Breite] */
export function rahmenUm(pts, spanne = [0, 0]) {
  if (!pts.length) return null
  let w = 180, e = -180, s = 90, n = -90
  for (const [x, y] of pts) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y) }
  const mx = Math.max(0, spanne[0] - (e - w)) / 2, my = Math.max(0, spanne[1] - (n - s)) / 2
  return [[w - mx, s - my], [e + mx, n + my]]
}
