<script>
  import TourenWahl from './TourenWahl.svelte'
  import { t, LOCALE } from './i18n.js'
  import { dezimal } from './format.js'
  import { fehlerText } from './fehlertext.js'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import { onMount, untrack } from 'svelte'
  import { schriftAuf } from './kontrast.js'
  import { REGIONEN, WA_GROSS, GROSSE_KARTE, POI_REGIONEN, KARTENGEBIET, imGebiet, kartenteilFuer, schneideZu, detailStufe, teileFuer }
    from './karten-config.js'
  import { grosseKarteAn, setzeGrosseKarte } from './karten-wahl.js'
  import { frage } from './dialog.js'
  import { CACHE, dateiUrl, kartenLauf, kartenStand, ladeKartenteile } from './karten-laden.js'
  import { online } from './netz.js'
  import { fahrzeitText } from './routing.js'
  import { FORMATE, DATEITYPEN, exportiereKarte, speichere } from './kartenexport.js'
  import { userData, journal } from './userdata.js'
  import { warnListe, meinePosition, warnUmkreis } from './warnlage-dienst.js'
  import { frageStandortAn, folgeStandort, standortHinweis, standortStatus, standortFehler } from './standort.js'
  import { zeigeToast } from './toast.js'
  import { get } from 'svelte/store'
  import { je } from './i18n.js'
  import { warnGeoJson, warnAusschnitt, inAustralien as punktInAustralien } from './warnlage.js'

  let { orte = [], reisen = [], warnFokus = null } = $props()
  // Mehrere Routen gleichzeitig sichtbar (Menge der gewählten Reise-IDs).
  let gewaehlteReisen = $state(new Set())
  const istGewaehlt = (id) => gewaehlteReisen.has(id)
  function toggleReise(id) {
    beruehrt = true
    const n = new Set(gewaehlteReisen)
    n.has(id) ? n.delete(id) : n.add(id)
    gewaehlteReisen = n
  }
  const alleReisen = () => { beruehrt = true; gewaehlteReisen = new Set(reisen.map((r) => r.id)) }
  const keineReisen = () => { beruehrt = true; gewaehlteReisen = new Set() }
  // Beim Öffnen alle Strecken innerhalb Australiens zeigen, solange der Nutzer die Auswahl
  // nicht selbst geändert hat (`beruehrt`).
  let beruehrt = false
  const inAustralien = (r) => {
    const p = (r.stops || []).filter((x) => x.lat != null)
    return p.length >= 2 && p.every((x) => x.lon > 110 && x.lon < 156 && x.lat < -9 && x.lat > -45)
  }
  $effect(() => {
    if (beruehrt || gewaehlteReisen.size || !reisen.length) return
    const ids = reisen.filter(inAustralien).map((r) => r.id)
    if (ids.length) gewaehlteReisen = new Set(ids)
  })

  // MapLibre (CSP-Build) + pmtiles dynamisch laden (eigener Chunk, kleineres Haupt-Bundle).
  let maplibregl = null
  let pmtilesLib = null
  let protocol = null
  const quellen = new Map() // region.id -> PMTiles (einmal geladen, im Speicher gehalten)
  let ladeFehler = $state(null)

  async function ladeLib() {
    if (maplibregl) return
    // Standard-Build: Vite bündelt MapLibres Worker selbst (keine CSP im Projekt -> Blob-Worker ok).
    const [ml, pm] = await Promise.all([import('./maplibre.js'), import('pmtiles')])
    maplibregl = ml.default ?? ml
    pmtilesLib = pm
    protocol = new pm.Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
  }

  // Ein Kartenteil wird einmalig als ganze Datei geholt und pmtiles liest LOKAL daraus.
  // So gibt es keine HTTP-Range-Anfragen — die vom Service-Worker/Worker-Zusammenspiel im
  // Prod-Build zerbrachen. Offline funktioniert es, weil die ganze Datei im Cache liegt.

  async function ladeRegion(region) {
    if (quellen.has(region.id)) {
      // als zuletzt benutzt ans Ende rücken — `entlade` wirft vorne weg
      const p = quellen.get(region.id); quellen.delete(region.id); quellen.set(region.id, p)
      return
    }
    const url = dateiUrl(region)
    let cache = null
    try { cache = await caches.open(CACHE) } catch {}
    // Zuerst im Cache nachsehen. Seit die Karte selbst zwischen den Teilen wechselt,
    // wird derselbe Teil öfter geöffnet — ihn jedes Mal neu abzulegen hieße, bis zu
    // 25 MB umzuschreiben. Und offline hängt es so nicht am Service-Worker.
    let resp = null
    try { resp = cache ? await cache.match(url) : null } catch {}
    const ausCache = !!resp
    if (!resp) {
      resp = await fetch(url, { mode: 'same-origin' })
      if (!resp.ok) throw new Error(t('Kartenteil „{name}" nicht verfügbar (offline noch nicht gespeichert?)', { name: region.name }))
    }
    const buf = await resp.arrayBuffer()
    if (!ausCache && cache) {
      // Fürs Offline SELBST ablegen — unabhängig davon, ob der Service-Worker schon die
      // Kontrolle hat. Erst löschen, dann ablegen: sonst entstehen ZWEI Einträge für
      // dieselbe Datei (einer vom Service-Worker) — gemessen 77,9 statt 75,8 MB.
      try {
        await cache.delete(url)
        await cache.put(url, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(buf.byteLength) } }))
        gecacht = new Set([...gecacht, region.id])
      } catch {}
    }
    const src = new pmtilesLib.FileSource(new File([buf], region.datei))
    const p = new pmtilesLib.PMTiles(src)
    // Header (und Verzeichnis-Wurzel) VORAB lesen: sonst kann die Karten-Quelle beim ersten
    // Tile-Request des Workers in eine Race Condition laufen und die Kacheln bleiben leer.
    try { await p.getHeader() } catch {}
    protocol.add(p) // registriert unter dem Dateinamen -> style-URL: pmtiles://<datei>
    quellen.set(region.id, p)
    entlade(region.id)
  }

  // Die großen Teile sind 25 MB. Alle sechs offen zu halten wären ~76 MB im
  // Arbeitsspeicher — auf dem iPhone zu viel. Also nur die drei zuletzt benutzten behalten;
  // den angezeigten nie wegwerfen. Erneutes Öffnen holt die Datei aus dem Cache, nicht aus dem Netz.
  function entlade(behalten) {
    while (quellen.size > 3) {
      const alt = [...quellen.keys()].find((id) => id !== behalten && id !== aktiv?.id)
      if (!alt) break
      const r = REGIONEN.find((x) => x.id === alt)
      try { protocol?.tiles?.delete(r.datei) } catch {}
      quellen.delete(alt)
    }
  }

  let container = $state()
  let map = null
  let aktiv = $state.raw(null)      // der Kartenteil, der gerade hinter der Karte steckt
  let mapGeladen = $state(false)
  let marker = []

  // ---------- Straßen ----------
  // Rangfolge nach dem Protomaps-Schema (`kind`, `kind_detail`): Highway und Fernstraße breit und
  // kräftig, Haupt- und Verbindungsstraßen mittel, Nebenstraßen schmal, Pisten und Wege gestrichelt.
  // Jede Straße bekommt einen dunklen Rand, damit sie sich vom hellen Land abhebt (Kontrast des
  // Rands zum Land 3,5 : 1 bis 7,5 : 1). Straßennummern (`shield_text`) stehen als Schild auf der
  // Linie, Straßennamen erst ab Zoomstufe 12 (in den Kacheln für WA ohnehin nur die Nummern).
  const RANG = ['match', ['get', 'kind_detail'],
    ['motorway', 'trunk'], 4, ['motorway_link', 'trunk_link', 'primary'], 3, ['primary_link', 'secondary'], 2.5,
    ['secondary_link', 'tertiary'], 2, ['tertiary_link'], 1.5, 1]
  const HAUPT = ['in', ['get', 'kind'], ['literal', ['highway', 'major_road']]]
  const NEBEN = ['==', ['get', 'kind'], 'minor_road']
  const PISTE = ['any', ['==', ['get', 'kind'], 'path'], ['in', ['get', 'kind_detail'], ['literal', ['track', 'unclassified']]]]
  // Breite in px: wächst mit dem Zoom, multipliziert mit dem Rang der Straße. `rand` legt die
  // Breite des Rands dazu; MapLibre erlaubt `zoom` nur ganz außen, daher je Stufe eingerechnet.
  const breite = (faktor = 1, rand = 0) => ['interpolate', ['exponential', 1.6], ['zoom'],
    ...[[4, 0.35], [8, 0.8], [11, 1.6], [14, 3.4]].flatMap(([z, b]) => [z, ['+', ['*', b * faktor, RANG], rand]])]
  const FUELLUNG = ['match', ['get', 'kind_detail'],
    ['motorway', 'motorway_link', 'trunk', 'trunk_link'], '#c8551f',
    ['primary', 'primary_link', 'secondary', 'secondary_link'], '#e08a3c', '#ffffff']
  // Versorgungspunkte unter Straßennamen und -nummern legen: obere Symbol-Ebenen werden zuerst
  // platziert, die Nummern verschwinden sonst zwischen den Punkten.
  const unterStrassenSchrift = () => (map?.getLayer('strasse-name') ? 'strasse-name' : undefined)
  function strassenEbenen() {
    const quelle = { source: 'protomaps', 'source-layer': 'roads' }
    const rund = { 'line-cap': 'round', 'line-join': 'round' }
    return [
      { id: 'strasse-faehre', type: 'line', ...quelle, filter: ['==', ['get', 'kind'], 'ferry'],
        paint: { 'line-color': '#2f6f99', 'line-width': 1.2, 'line-dasharray': [3, 2] } },
      { id: 'strasse-bahn', type: 'line', ...quelle, minzoom: 8, filter: ['==', ['get', 'kind'], 'rail'],
        paint: { 'line-color': '#6f6a64', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 1.6], 'line-dasharray': [4, 2] } },
      { id: 'strasse-piste', type: 'line', ...quelle, minzoom: 9, filter: PISTE, layout: rund,
        paint: { 'line-color': '#8a6a4a', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 2.2], 'line-dasharray': [2, 1.5] } },
      { id: 'strasse-neben-rand', type: 'line', ...quelle, minzoom: 10, filter: ['all', NEBEN, ['!', PISTE]], layout: rund,
        paint: { 'line-color': '#a0785a', 'line-width': breite(0.8, 1.4) } },
      { id: 'strasse-haupt-rand', type: 'line', ...quelle, filter: HAUPT, layout: { ...rund, 'line-sort-key': RANG },
        paint: { 'line-color': ['case', ['>=', RANG, 2.5], '#7a3b1e', '#a0785a'], 'line-width': breite(1, 1.6) } },
      { id: 'strasse-neben', type: 'line', ...quelle, minzoom: 10, filter: ['all', NEBEN, ['!', PISTE]], layout: rund,
        paint: { 'line-color': '#ffffff', 'line-width': breite(0.8) } },
      { id: 'strasse-haupt', type: 'line', ...quelle, filter: HAUPT, layout: { ...rund, 'line-sort-key': RANG },
        paint: { 'line-color': FUELLUNG, 'line-width': breite() } },
      { id: 'strasse-name', type: 'symbol', ...quelle, minzoom: 12, filter: ['has', 'name'],
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'symbol-spacing': 280 },
        paint: { 'text-color': '#4a3424', 'text-halo-color': '#fffdf8', 'text-halo-width': 1.6 } },
      // Straßennummer als kleines Schild: weiße Schrift auf dunklem Rand (Kontrast 8,5 : 1)
      { id: 'strasse-nummer', type: 'symbol', ...quelle, minzoom: 6, filter: ['all', HAUPT, ['has', 'shield_text']],
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'shield_text'], 'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10.5, 10, 12.5, 13, 14], 'text-rotation-alignment': 'viewport',
          'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 6, 220, 12, 420], 'text-padding': 6 },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#7a3b1e', 'text-halo-width': 3.5 } },
    ]
  }

  // Eigener, schlanker Kartenstil auf Basis des Protomaps-Kachelschemas.
  // Bewusst ausdrucks-arm gehalten (maximale Kompatibilität).
  function styleFor(region) {
    return {
      version: 8,
      glyphs: location.origin + '/fonts/{fontstack}/{range}.pbf',
      sources: {
        protomaps: {
          type: 'vector',
          url: 'pmtiles://' + region.datei,
          attribution: '© OpenStreetMap',
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#a2cae0' } },
        { id: 'erde', type: 'fill', source: 'protomaps', 'source-layer': 'earth', paint: { 'fill-color': '#f6f0e2' } },
        { id: 'landuse-gruen', type: 'fill', source: 'protomaps', 'source-layer': 'landuse', paint: { 'fill-color': '#d7e6c4', 'fill-opacity': 0.6 } },
        // Flüsse liegen in „water" als LINIEN. Ohne Filter schließt die Füllung jede Flusslinie
        // zur Fläche — gerade Kante von Anfang bis Ende → blaue Keile übers Land. Daher nur Polygone.
        { id: 'wasser', type: 'fill', source: 'protomaps', 'source-layer': 'water', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#a2cae0' } },
        { id: 'fluesse', type: 'line', source: 'protomaps', 'source-layer': 'water', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#8fbdd6', 'line-width': 1 } },
        ...strassenEbenen(),
        { id: 'grenze', type: 'line', source: 'protomaps', 'source-layer': 'boundaries', paint: { 'line-color': '#b09ab5', 'line-width': 0.7 } },
        {
          id: 'ort-label', type: 'symbol', source: 'protomaps', 'source-layer': 'places',
          layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 0.2] },
          paint: { 'text-color': '#4a4038', 'text-halo-color': '#f6f0e2', 'text-halo-width': 1.5 },
        },
      ],
    }
  }

  function addHillshade() {
    if (!map || map.getSource('dem')) return
    // Gelände-Schattierung von AWS Terrarium (nur online verfügbar).
    map.addSource('dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 13,
      attribution: 'Terrain: Mapzen/AWS',
    })
    const style = map.getStyle()
    const firstSymbol = style.layers.find((l) => l.type === 'symbol')?.id
    map.addLayer({
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem',
      paint: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#5a4a37' },
    }, firstSymbol)
  }

  // Vorschlagsorte lassen sich ausblenden — die Karte ist sonst zugepflastert.
  // BESUCHTE Orte bleiben IMMER sichtbar: was man dokumentiert hat, will man auf der
  // Karte wiederfinden, egal wie die Anzeige gerade eingestellt ist.
  let orteZeigen = $state(true)
  function istDokumentiert(id) {
    const u = $userData[id]
    if (u && ((u.notiz || '').trim() || (u.bericht || '').trim()
      || (u.bilder?.length) || (u.tagebuch?.length))) return true
    return $journal.some((e) => e.ortId === id)
  }
  const anzahlDokumentiert = $derived(orte.filter((o) => o.lat != null && istDokumentiert(o.id)).length)

  function setzePins() {
    marker.forEach((m) => m.remove())
    marker = []
    for (const o of orte) {
      if (o.lat == null) continue
      const besucht = istDokumentiert(o.id)
      if (!orteZeigen && !besucht) continue
      const el = document.createElement('div')
      el.className = besucht ? 'pin besucht' : 'pin'
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([o.lon, o.lat])
        .setPopup(new maplibregl.Popup({ offset: 12, closeButton: false })
          .setHTML(`<b>${esc(o.name)}</b>${besucht ? ' 📖' : ''}<br><span style="font-size:12px;color:#777">${esc(o.region || '')}</span>`))
        .addTo(map)
      marker.push(m)
    }
  }

  // ---------- Offline-POIs (Tankstellen, Wasser, Rastplätze … aus OpenStreetMap) ----------
  // Kleine Emoji ohne Hintergrund wären kaum lesbar, und MapLibre blendet sich berührende
  // Symbole aus. Deshalb zwei Ebenen:
  //   Punkt  — JEDER Eintrag, immer, genau an seiner Koordinate, Farbe je Kategorie.
  //   Plakette ab Zoom 10 — weißer Kreis mit Farbring und Emoji; ab Zoom 13 mit Namen.
  //            Wo es eng wird, gewinnt die wichtigere Kategorie (`rang`); der Punkt darunter
  //            bleibt trotzdem sichtbar — es geht also nichts verloren.
  const tourenWahl = $derived(reisen.map((r) => ({ id: r.id, name: r.name, farbe: r.farbe || '#c0392b', reise: r, flug: ['flug', 'bahn'].includes(r.art || 'auto'), zusatz: r.route ? `${r.route.km} km` : '' })))
  const POI_KAT = [
    // Farben so gewählt, dass die vier Standard-Kategorien klar auseinanderzuhalten sind
    // (erste Fassung: Rastplatz hellblau neben Wasser blau — auf der Karte kaum unterscheidbar).
    { k: 'fuel', label: t('Tankstelle'), emoji: '⛽', farbe: '#e8590c', rang: 1 },
    { k: 'wasser', label: t('Wasser'), emoji: '💧', farbe: '#1c7ed6', rang: 2 },
    { k: 'rast', label: t('Rastplatz'), emoji: '🅿️', farbe: '#8c6239', rang: 5 },
    { k: 'camp', label: t('Camping'), emoji: '🏕️', farbe: '#2f9e44', rang: 6 },
    { k: 'wc', label: t('Toilette'), emoji: '🚻', farbe: '#7048e8', rang: 8 },
    { k: 'laden', label: t('Laden'), emoji: '🛒', farbe: '#d6336c', rang: 7 },
    { k: 'werkstatt', label: t('Werkstatt'), emoji: '🔧', farbe: '#495057', rang: 4 },
    { k: 'klinik', label: 'Klinik/Arzt', emoji: '🏥', farbe: '#c92a2a', rang: 3 },
    { k: 'sicht', label: t('Sehenswert'), emoji: '👀', farbe: '#0c8599', rang: 9 },
  ]
  const POI_LAYER = ['poi-lyr', 'poi-punkt']
  let poiAktiv = $state({ fuel: true, wasser: true, rast: true, camp: true, wc: false, laden: false, werkstatt: false, klinik: false, sicht: false })
  let poiDaten = null            // alle POI-Dateien zusammen (einmal geladen, als Promise)
  let poiListe = []              // dieselben Daten, fertig geladen — zum Zählen
  let poiImBild = $state({})     // k -> Anzahl im sichtbaren Ausschnitt
  let poiGeladen = $state(false)

  // Plakette: weißer Kreis, Farbring, Emoji. 64 px bei pixelRatio 2 = 32 CSS-px bei icon-size 1.
  function plakette(emoji, farbe, size = 64) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size
    const ctx = cv.getContext('2d')
    const r = size / 2
    ctx.beginPath(); ctx.arc(r, r, r - 3, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'; ctx.fill()
    ctx.lineWidth = 5; ctx.strokeStyle = farbe; ctx.stroke()
    ctx.font = `${Math.round(size * 0.5)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(emoji, r, r + 2)
    return ctx.getImageData(0, 0, size, size)
  }

  const farbeNach = ['match', ['get', 'k'], ...POI_KAT.flatMap((kat) => [kat.k, kat.farbe]), '#666']
  const rangNach = ['match', ['get', 'k'], ...POI_KAT.flatMap((kat) => [kat.k, kat.rang]), 99]

  function setPoiFilter() {
    if (!map) return
    const an = POI_KAT.filter((kat) => poiAktiv[kat.k]).map((kat) => kat.k)
    for (const id of POI_LAYER) if (map.getLayer(id)) map.setFilter(id, ['in', ['get', 'k'], ['literal', an]])
  }

  // Zählen, was im Bild ist — damit sichtbar wird, dass nichts verschluckt wird, und damit
  // „0" außerhalb der Gebiete mit Daten eine Erklärung bekommt.
  function zaehlePois() {
    if (!map || !poiListe.length) return
    const b = map.getBounds()
    const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth()
    const z = {}
    for (const p of poiListe) if (p.x >= w && p.x <= e && p.y >= s && p.y <= n) z[p.k] = (z[p.k] || 0) + 1
    poiImBild = z
  }
  const poiSumme = $derived(POI_KAT.filter((kat) => poiAktiv[kat.k]).reduce((a, kat) => a + (poiImBild[kat.k] || 0), 0))
  const poiEinAn = $derived(POI_KAT.some((kat) => poiAktiv[kat.k]))
  // Was sonst noch im Bild ist — damit „0" nicht wie „keine Daten" aussieht (Phillip Island:
  // keine Tankstelle am Penguin Parade, aber Aussichtspunkte und Toiletten).
  const poiAndere = $derived(POI_KAT.filter((kat) => !poiAktiv[kat.k] && poiImBild[kat.k]))

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  // Tippen: ein Punkt ist nur 3–5 px groß — mit dem Finger trifft man ihn nie genau.
  // Deshalb im Umkreis von 11 px suchen und den nächsten nehmen.
  function poiKlick(e) {
    if (!map.getLayer('poi-punkt')) return
    // Tipp auf einen Orts-Pin: der hat sein eigenes Fenster
    if (e.originalEvent?.target?.closest?.('.maplibregl-marker, .maplibregl-popup')) return
    const { x, y } = e.point
    const treffer = map.queryRenderedFeatures([[x - 11, y - 11], [x + 11, y + 11]], { layers: POI_LAYER.filter((id) => map.getLayer(id)) })
    if (!treffer.length) return
    let f = treffer[0], best = Infinity
    for (const t of treffer) {
      const p = map.project(t.geometry.coordinates)
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < best) { best = d; f = t }
    }
    const kat = POI_KAT.find((k) => k.k === f.properties.k)
    const [lon, lat] = f.geometry.coordinates
    const name = f.properties.n || kat?.label || ''
    const q = encodeURIComponent(f.properties.n || kat?.label || t('Ort'))
    const html = `<b>${kat?.emoji || '📍'} ${esc(name)}</b><br>`
      + `<span style="font-size:12px;color:#777">${kat?.label || ''} · ${lat.toFixed(5)}, ${lon.toFixed(5)}</span><br>`
      + `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener" style="font-size:12px">Google Maps ↗</a>`
      + ` · <a href="https://maps.apple.com/?ll=${lat},${lon}&q=${q}" target="_blank" rel="noopener" style="font-size:12px">Apple Karten ↗</a>`
    new maplibregl.Popup({ offset: 14, closeButton: true }).setLngLat([lon, lat]).setHTML(html).addTo(map)
  }

  // Alle vier POI-Dateien liegen gleichzeitig auf der Karte (≈ 26.000 Punkte).
  // Die Gebiete überschneiden sich nicht, also gibt es keine Doppelten.
  async function addPois() {
    if (!map) return
    for (const kat of POI_KAT) {
      const id = 'poi-' + kat.k
      if (!map.hasImage(id)) { try { map.addImage(id, plakette(kat.emoji, kat.farbe), { pixelRatio: 2 }) } catch {} }
    }
    if (!poiDaten) {
      poiDaten = Promise.all(POI_REGIONEN.map((r) => fetch('/pois-' + r.id + '.json')
        .then((x) => (x.ok ? x.json() : [])).catch(() => []))).then((l) => l.flat())
    }
    const daten = await poiDaten
    if (!map) return
    poiListe = daten
    const fc = { type: 'FeatureCollection', features: daten.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.x, p.y] }, properties: { k: p.k, n: p.n } })) }
    if (map.getSource('pois')) { map.getSource('pois').setData(fc) }
    else {
      map.addSource('pois', { type: 'geojson', data: fc })
      map.addLayer({
        id: 'poi-punkt', type: 'circle', source: 'pois',
        paint: {
          'circle-color': farbeNach,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.6, 6, 2.6, 9, 4, 13, 5.5],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 7, 1, 11, 1.5],
          'circle-opacity': 0.95,
        },
      }, unterStrassenSchrift())
      map.addLayer({
        id: 'poi-lyr', type: 'symbol', source: 'pois', minzoom: 10,
        layout: {
          'icon-image': ['concat', 'poi-', ['get', 'k']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 13, 0.85, 16, 0.95],
          'icon-allow-overlap': false,
          'icon-padding': 1,
          'symbol-sort-key': rangNach,
          'text-field': ['step', ['zoom'], '', 13, ['get', 'n']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 1.25],
          'text-max-width': 9,
          'text-optional': true,
        },
        paint: { 'text-color': '#33322e', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
      }, unterStrassenSchrift())
      map.on('click', poiKlick)
      map.on('mousemove', (e) => {
        const { x, y } = e.point
        const da = map.getLayer('poi-punkt') && map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: POI_LAYER }).length
        map.getCanvas().style.cursor = da ? 'pointer' : ''
      })
      map.on('moveend', zaehlePois)
      warnNachOben()
    }
    setPoiFilter()
    poiGeladen = true
    zaehlePois()
  }

  // Die Karte wird EINMAL gebaut. Beim Verschieben und Zoomen tauscht `pruefeTeil()`
  // nur die Kachelquelle aus — Pins, Routen und POIs bleiben stehen.
  function baue() {
    const b = aktiv.id === 'australien' ? KARTENGEBIET : aktiv.bounds
    map = new maplibregl.Map({
      container,
      // MapLibre 5: `preserveDrawingBuffer` als Top-Level-Option wird ignoriert.
      canvasContextAttributes: { preserveDrawingBuffer: true },
      style: styleFor(aktiv),
      bounds: [[b[0], b[1]], [b[2], b[3]]],
      fitBoundsOptions: { padding: 8 },
      attributionControl: { compact: true },
    })
    if (import.meta.env.DEV) window.__karte = map   // nur für Tests auf dem Entwicklungsserver
    // VoiceOver: beide Karten hießen „Map" — jetzt unterscheidbar
    map.getCanvas().setAttribute('aria-label', je('Offline-Karte von Australien', 'Offline map of Australia'))
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(baueExportKnopf(() => (expOffen = true)), 'top-right')
    // Marker können sofort gesetzt werden (unabhängig vom 'load'-Event, das
    // bei manchen Umgebungen verzögert/nicht feuert).
    mapGeladen = true
    setzePins()
    // Gelände-Schattierung + Offline-POIs + Reise-Route nachladen, sobald die Karte bereit ist.
    const bereit = () => { if ($online) { try { addHillshade() } catch (e) {} } try { addPois() } catch (e) {} try { zeigeWarnungen() } catch (e) {} try { zeigeRoute() } catch (e) {} pruefeTeil() }
    map.on('load', bereit)
    map.once('idle', bereit)
    map.on('moveend', () => { zoomJetzt = map.getZoom(); pruefeTeil() })
  }

  // ---------- Welcher Kartenteil steckt gerade dahinter? ----------
  let wechselNr = 0
  let zoomJetzt = $state(0)       // nur für data-zoom / data-pruefungen (Fehlersuche/Tests), unsichtbar
  let pruefungen = $state(0)
  let laedtTeil = $state.raw(null)   // dieser Teil wird gerade nachgeladen
  let fehltHier = $state.raw(null)   // hier gäbe es mehr Details, der Teil ist aber nicht auf dem Gerät

  const flaeche = (r) => (r.bounds[2] - r.bounds[0]) * (r.bounds[3] - r.bounds[1])
  // Online geht alles; offline nur, was gespeichert oder schon im Speicher ist.
  const kartenteile = $derived(teileFuer($grosseKarteAn))
  const verfuegbar = () => kartenteile.filter((r) => $online || gecacht.has(r.id) || quellen.has(r.id))

  let teilTimer = 0
  async function pruefeTeil() {
    // Beim Export wird die Karte kurz auf Druckgröße gezogen — dabei nicht umschalten.
    if (!map || !aktiv || expLaeuft) return
    // Wie bei den Routen: nur auf den Stil warten, nicht auf jede Kachel (sonst hängt es ohne Netz)
    clearTimeout(teilTimer)
    if (map.style && map.style._loaded === false) { teilTimer = setTimeout(pruefeTeil, 250); return }
    const nr = ++wechselNr          // jede neue Bewegung macht ältere Ladevorgänge ungültig
    const b = map.getBounds()
    const ausschnitt = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    const zoom = map.getZoom()
    pruefungen++
    const ziel = kartenteilFuer(ausschnitt, zoom, aktiv, verfuegbar())
    const ideal = kartenteilFuer(ausschnitt, zoom, aktiv, kartenteile)
    fehltHier = ideal && ziel && ideal.maxzoom > ziel.maxzoom ? ideal : null
    laedtTeil = null
    if (!ziel || ziel.id === aktiv.id) return
    laedtTeil = ziel
    try {
      await ladeRegion(ziel)
      if (nr !== wechselNr || !map) return
      // Die alten Kacheln bleiben sichtbar, bis die neuen da sind (MapLibre: „expired").
      map.getSource('protomaps')?.setUrl('pmtiles://' + ziel.datei)
      aktiv = ziel
    } catch {
      if (nr === wechselNr) fehltHier = ziel
    } finally {
      if (nr === wechselNr) laedtTeil = null
    }
  }

  // POI-Filter aktualisieren, wenn Kategorien ein-/ausgeblendet werden.
  $effect(() => { JSON.stringify(poiAktiv); setPoiFilter() })
  function togglePoi(k) { poiAktiv[k] = !poiAktiv[k] }

  // ---------- Reise-Route auf der Karte ----------
  function routeFeature(reise) {
    if (!reise) return null
    let coords = reise.route?.geometry
    if (!coords || coords.length < 2) coords = (reise.stops || []).filter((s) => s.lat != null).map((s) => [s.lon, s.lat])
    if (!coords || coords.length < 2) return null
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }
  }
  // Jede Route wird gezeichnet, soweit sie im Kartengebiet liegt; Abschnitte außerhalb
  // (etwa Anreise über Asien oder Europa) stehen als Hinweis unter der Karte. Würde nur
  // gezeichnet, wenn alle Routen in einen Kartenteil passen, bliebe die Karte bei „Alle“ leer.
  let routeHinweis = $state({ draussen: [], ohneLinie: [] })
  const kurzListe = (l) => (l.length > 4 ? l.slice(0, 4).join(', ') + ' …' : l.join(', '))

  let routeTimer = 0
  function zeigeRoute() {
    if (!map || !mapGeladen) return
    // `mapGeladen` wird absichtlich sofort gesetzt (Marker brauchen den Stil nicht).
    // Quellen und Ebenen aber schon, sonst wirft MapLibre „Style is not done loading".
    // Geprüft wird nur, ob der Stil selbst steht. `isStyleLoaded()` wartet zusätzlich auf
    // alle Kacheln: schlägt eine fehl (Gelände ohne Netz), bleibt es falsch, und das alte
    // `once('idle')` käme nie. Dann fehlten die Routen, bis man die Karte bewegt.
    clearTimeout(routeTimer)
    const stilSteht = map.style ? map.style._loaded !== false : map.isStyleLoaded()
    if (!stilSteht) { routeTimer = setTimeout(zeigeRoute, 250); return }
    const gewaehlt = reisen.filter((r) => gewaehlteReisen.has(r.id))

    // Alle gewählten Routen als EINE Sammlung; Farbe und Strichmuster kommen
    // aus den Merkmalen, damit nicht je Reise eine eigene Ebene nötig ist.
    const feats = []
    const draussen = new Set()
    const ohneLinie = []
    for (const r of gewaehlt) {
      for (const s of r.stops || []) {
        if (s.lat != null && s.name && !imGebiet([s.lon, s.lat])) draussen.add(s.name)
      }
      const f = routeFeature(r)
      if (!f) { ohneLinie.push(r.name); continue }
      const teile = schneideZu(f.geometry.coordinates)
      if (!teile.length) continue
      feats.push({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: teile },
        properties: { farbe: r.farbe || '#c0392b', flug: ['flug', 'bahn'].includes(r.art || 'auto') ? 1 : 0 } })
    }
    routeHinweis = { draussen: [...draussen], ohneLinie }

    const daten = { type: 'FeatureCollection', features: feats }
    if (map.getSource('reiseroute')) map.getSource('reiseroute').setData(daten)
    else {
      map.addSource('reiseroute', { type: 'geojson', data: daten })
      const vor = map.getLayer('poi-punkt') ? 'poi-punkt' : undefined
      // Zwei Ebenen: `line-dasharray` darf in MapLibre nicht datengesteuert sein.
      // Dunkler Rand + weißer Saum, damit die Route über jedem Untergrund auffällt.
      map.addLayer({ id: 'reiseroute-rand', type: 'line', source: 'reiseroute',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1b1b1b', 'line-width': 10, 'line-opacity': 0.7 } }, vor)
      map.addLayer({ id: 'reiseroute-saum', type: 'line', source: 'reiseroute',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7.5 } }, vor)
      map.addLayer({ id: 'reiseroute-lyr', type: 'line', source: 'reiseroute',
        filter: ['!=', ['get', 'flug'], 1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'farbe'], 'line-width': 5 } }, vor)
      map.addLayer({ id: 'reiseroute-flug-lyr', type: 'line', source: 'reiseroute',
        filter: ['==', ['get', 'flug'], 1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'farbe'], 'line-width': 5,
          'line-dasharray': [2.2, 1.6] } }, vor)
      warnNachOben()
    }
    if (feats.length && !warnFokus) {
      try {
        const co = feats.flatMap((f) => f.geometry.coordinates.flat())
        const b = co.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(co[0], co[0]))
        // Danach feuert `moveend` → pruefeTeil() holt den passenden Kartenteil.
        map.fitBounds(b, { padding: 46, duration: 700, maxZoom: 12 })
      } catch {}
    }
  }
  // untrack: fitBounds kann `moveend` sofort auslösen, wenn der Ausschnitt schon passt. Was dabei
  // gelesen und geschrieben wird, darf nicht an diesem Effect hängen, sonst ruft er sich endlos selbst auf.
  $effect(() => { gewaehlteReisen; reisen; if (mapGeladen) untrack(zeigeRoute) })

  // Warngebiete, Umkreis und eigener Punkt liegen über allem. Sie kommen aus dem letzten Warnstand,
  // die Karte darunter aus den gesicherten Kartenteilen: das geht beides ohne Netz.
  // Der Knopf auf der Karte blendet Warngebiete und Umkreis aus, dein Punkt bleibt. Die Wahl bleibt gemerkt.
  let warnAn = $state((() => { try { return localStorage.getItem('tb-karte-warn') !== 'aus' } catch { return true } })())
  function warnUmschalten() {
    warnAn = !warnAn
    try { localStorage.setItem('tb-karte-warn', warnAn ? 'an' : 'aus') } catch {}
  }
  // Wer gezielt zu einer Warnung springt, will sie sehen
  $effect(() => { if (warnFokus) warnAn = true })

  let warnTimer = 0
  // Warnungen liegen immer über Route und Tankstellen & Co., egal was zuletzt dazukam.
  const WARN_EBENEN = ['warn-flaeche', 'warn-saum', 'warn-rand', 'warn-umkreis', 'warn-punkt', 'warn-zeichen']
  function warnNachOben() { for (const id of WARN_EBENEN) if (map?.getLayer(id)) map.moveLayer(id) }
  function zeigeWarnungen() {
    if (!map || !mapGeladen) return
    clearTimeout(warnTimer)
    const stilSteht = map.style ? map.style._loaded !== false : map.isStyleLoaded()
    if (!stilSteht) { warnTimer = setTimeout(zeigeWarnungen, 250); return }
    const daten = warnGeoJson(warnAn ? $warnListe : [], $meinePosition, warnAn ? $warnUmkreis : 0)
    if (map.getSource('warnlage')) map.getSource('warnlage').setData(daten)
    else {
      map.addSource('warnlage', { type: 'geojson', data: daten })
      const art = (a) => ['==', ['get', 'art'], a]
      // Warngebiete sollen sofort auffallen: kräftigere Fläche, weißer Saum unter einem breiten Rand,
      // Punktwarnungen und die Mitte jedes Gebiets als Kreis mit Ausrufezeichen. Der eigene Standort ist ein eigener Marker (zeigeIch).
      map.addLayer({ id: 'warn-flaeche', type: 'fill', source: 'warnlage', filter: art('flaeche'), paint: { 'fill-color': ['get', 'farbe'], 'fill-opacity': 0.42 } })
      map.addLayer({ id: 'warn-saum', type: 'line', source: 'warnlage', filter: art('flaeche'), layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 7], 'line-opacity': 0.9 } })
      map.addLayer({ id: 'warn-rand', type: 'line', source: 'warnlage', filter: art('flaeche'), layout: { 'line-join': 'round' }, paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 10, 4] } })
      map.addLayer({ id: 'warn-punkt', type: 'circle', source: 'warnlage', filter: ['any', art('punkt'), art('zeichen')], paint: { 'circle-color': ['get', 'farbe'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 9, 10, 13], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } })
      map.addLayer({ id: 'warn-zeichen', type: 'symbol', source: 'warnlage', filter: ['any', art('punkt'), art('zeichen')], layout: { 'text-field': '!', 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 13, 10, 17], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })
      map.addLayer({ id: 'warn-umkreis', type: 'line', source: 'warnlage', filter: art('umkreis'), paint: { 'line-color': '#1f6fd1', 'line-width': 2, 'line-dasharray': [2, 2] } })
    }
    const w = warnFokus && $warnListe.find((x) => x.id === warnFokus)
    const rahmen = w && warnAusschnitt(w, $meinePosition)
    if (rahmen) { try { map.fitBounds(rahmen, { padding: 60, duration: 700, maxZoom: 11 }) } catch {} }
  }
  $effect(() => { $warnListe; $meinePosition; $warnUmkreis; warnFokus; warnAn; if (mapGeladen) untrack(zeigeWarnungen) })

  // Standortpunkt als eigener Marker: liegt über Pins, Tankstellen & Co. und Warngebieten.
  let ichMarker = null
  function zeigeIch() {
    if (!map || !mapGeladen) return
    const p = $meinePosition
    if (!p || !punktInAustralien(p.lat, p.lon)) { ichMarker?.remove(); ichMarker = null; return }
    if (!ichMarker) {
      const el = document.createElement('div')
      el.className = 'ich-punkt'
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', je('Dein Standort', 'Your location'))
      el.innerHTML = '<span class="ich-halo"></span><span class="ich-kern"></span>'
      ichMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lon, p.lat]).addTo(map)
      el.style.zIndex = '20'
    } else ichMarker.setLngLat([p.lon, p.lat])
  }
  $effect(() => { $meinePosition; if (mapGeladen) untrack(zeigeIch) })

  // Eigener Standort: läuft ohne Netz über GPS. Mit erteilter Freigabe folgt der Punkt von selbst.
  let suchtOrt = $state(false)
  $effect(() => { if ($standortStatus === 'erlaubt') return folgeStandort() })
  async function zuMir() {
    suchtOrt = true
    const ok = await frageStandortAn({ hoheGenauigkeit: true, alterMs: 30000 })
    suchtOrt = false
    const p = get(meinePosition)
    if (!ok || !p) { zeigeToast(standortHinweis(get(standortStatus), get(standortFehler)) || t('Kein Standort verfügbar.'), 'fehler'); return }
    // Außerhalb Australiens gibt es auf der Offline-Karte nichts zu sehen: nicht ins Leere fliegen.
    if (!punktInAustralien(p.lat, p.lon)) { zeigeToast(je('Du bist gerade nicht in Australien. Die Offline-Karte zeigt nur Australien, dein Standort erscheint, sobald du dort bist.', 'You are not in Australia right now. The offline map only covers Australia, your location appears once you are there.'), 'info', 5000); return }
    map?.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 11), duration: 900 })
  }

  let laedt = $state(false)

  // Zuerst der Überblick über ganz Australien. Offline ohne ihn: der größte gespeicherte Teil.
  function startTeil() {
    const da = verfuegbar()
    return da.find((r) => r.id === 'australien') || [...da].sort((a, b) => flaeche(b) - flaeche(a))[0] || null
  }

  onMount(() => {
    let weg = false
    ;(async () => {
      laedt = true
      ladeFehler = null
      try {
        await ladeLib()
        await pruefeCache()
        const erster = startTeil()
        if (!erster) throw new Error(t('Die Offline-Karte liegt noch nicht auf diesem Gerät. Einmal mit Netz öffnen und „Ganz Australien sichern" tippen.'))
        await ladeRegion(erster)
        if (weg) return
        aktiv = erster
        baue()
      } catch (e) {
        if (!weg) ladeFehler = fehlerText(e)
      } finally {
        if (!weg) laedt = false
      }
    })()
    return () => { weg = true; if (map) { map.remove(); map = null } }
  })

  // Pins (neu) setzen, sobald Karte geladen ist oder sich Orte ändern.
  $effect(() => {
    orte.length
    orteZeigen
    $userData; $journal          // Pins nachziehen, sobald etwas dokumentiert wird
    if (mapGeladen && map) setzePins()
  })

  // ---- Alle Regionen auf einmal fuer offline sichern ----
  // Die .pmtiles liegen bewusst NICHT im Precache (sonst waeren es 96 MB bei der
  // Installation). Eine Region landet sonst erst dann offline, wenn man sie einmal
  // mit Netz geoeffnet hat — im Outback zu spaet. Deshalb dieser Knopf.
  let gecacht = $state(new Set())

  async function pruefeCache() {
    try {
      const c = await caches.open('karten-pmtiles-v2')
      const da = new Set()
      for (const r of REGIONEN) {
        if (await c.match(location.origin + '/karten/' + r.datei)) da.add(r.id)
      }
      gecacht = da
    } catch {}
  }

  async function alleSichern() {
    try { await ladeKartenteile(kartenteile.filter((r) => !gecacht.has(r.id))) }
    catch (e) { ladeFehler = t('Sichern fehlgeschlagen. ') + fehlerText(e) }
  }
  // Auch was die Einführung im Hintergrund lädt, zählt hier gleich mit
  $effect(() => { if ($kartenStand) pruefeCache() })

  // Große Karte ein: Sie kommt beim Hineinzoomen. Aus: Sie gibt ihren Speicher wieder frei.
  async function grosseKarteUmschalten() {
    if ($grosseKarteAn) {
      setzeGrosseKarte(false)
      await pruefeTeil()
      await entferneGrosse()
      return
    }
    const mb = WA_GROSS.map((r) => Math.round(r.mb))
    const ja = await frage({
      titel: t('Große Karte einschalten?'),
      text: t('Beim Hineinzoomen lädt die App den Teil von Western Australia, in dem du gerade bist, je {von} bis {bis} MB. Das geht am besten im WLAN. Ausschalten gibt den Speicher wieder frei.', { von: Math.min(...mb), bis: Math.max(...mb) }),
      ja: t('Einschalten'),
    })
    if (!ja) return
    setzeGrosseKarte(true)
    pruefeTeil()
  }

  // Den angezeigten Teil behält sie, falls ohne Netz gerade nichts anderes da ist
  async function entferneGrosse() {
    try {
      const c = await caches.open(CACHE)
      for (const r of WA_GROSS) {
        if (r.id === aktiv?.id) continue
        await c.delete(dateiUrl(r))
        try { protocol?.tiles?.delete(r.datei) } catch {}
        quellen.delete(r.id)
      }
      await pruefeCache()
    } catch {}
  }

  // ---- Export zum Drucken (siehe kartenexport.js) ----
  let expOffen = $state(false)
  let expLaeuft = $state(false)
  let expFormat = $state('a4-quer')
  let expTyp = $state('jpg')
  let expMeldung = $state('')


  // Export-Knopf als echtes Kartensteuerelement: MapLibre stapelt ihn dann selbst
  // unter Plus/Minus und er bekommt dasselbe Aussehen wie die Zoomknoepfe.
  // Frueher war das ein breiter Textknopf ueber der Karte — zu gross und aus der Reihe.
  function baueExportKnopf(onKlick) {
    return {
      onAdd() {
        const d = document.createElement('div')
        d.className = 'maplibregl-ctrl maplibregl-ctrl-group'
        const b = document.createElement('button')
        b.type = 'button'
        b.title = t('Karte als Bild speichern (drucken)')
        b.setAttribute('aria-label', 'Karte als Bild speichern')
        b.className = 'exp-ctrl'
        b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;margin:auto"><path d="M12 3v11"/><path d="m7.2 9.4 4.8 4.8 4.8-4.8"/><path d="M4.5 19.5h15"/></svg>'
        b.addEventListener('click', onKlick)
        d.appendChild(b)
        this._d = d
        return d
      },
      onRemove() { this._d?.remove() },
    }
  }

  async function exportiere() {
    if (!map || expLaeuft) return
    expLaeuft = true; expMeldung = ''
    try {
      const f = FORMATE.find((x) => x.id === expFormat)
      const { blob, breite, hoehe } = await exportiereKarte({
        vorlage: map, breite: f.breite, hoehe: f.hoehe, typ: expTyp,
        herkunft: '© OpenStreetMap',
        // Die Kachelquelle hängt am pmtiles-Protokoll; die zweite Karte greift auf
        // dieselbe registrierte Quelle zu, weil das Protokoll global ist.
      })
      const dt = DATEITYPEN.find((x) => x.id === expTyp)
      const jetzt = new Date(), stempel = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`
      speichere(blob, `Karte_${f.id}_${stempel}.${dt.endung}`)
      expMeldung = t('✓ {breite} × {hoehe} px · {toFixed} MB', { breite, hoehe, toFixed: dezimal(blob.size / 1048576, 1) })
    } catch (e) {
      expMeldung = t('Fehlgeschlagen. ') + fehlerText(e)
    }
    expLaeuft = false
  }

  const ichDa = $derived(!!$meinePosition && punktInAustralien($meinePosition.lat, $meinePosition.lon))
  const gespeichert = $derived(kartenteile.filter((r) => gecacht.has(r.id)).length)
  const alleDa = $derived(gespeichert === kartenteile.length)
  const gesamtMB = $derived(kartenteile.reduce((a, r) => a + r.mb, 0))
  const offenMB = $derived(kartenteile.filter((r) => !gecacht.has(r.id)).reduce((a, r) => a + r.mb, 0))
</script>

<div class="karten" data-zoom={zoomJetzt.toFixed(1)} data-teil={aktiv?.id || ''} data-pruefungen={pruefungen}>
  <div class="map-wrap">
    <div class="map" bind:this={container}></div>
    <button class="ort-knopf" class:sucht={suchtOrt} onclick={zuMir} aria-label={je('Mein Standort', 'My location')} title={je('Mein Standort', 'My location')}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg></button>
    {#if ($warnListe.length && warnAn) || ichDa}
      <p class="warn-legende">
        {#if $warnListe.length && warnAn}<span><i class="wl-flaeche" aria-hidden="true"></i>{t('Warngebiet')}</span>{/if}
        {#if ichDa}<span><i class="wl-ich" aria-hidden="true"></i>{t('Du')}</span>{/if}
        {#if ichDa && $warnUmkreis && warnAn}<span><i class="wl-kreis" aria-hidden="true"></i>{t('Umkreis {km} km', { km: $warnUmkreis })}</span>{/if}
      </p>
    {/if}
    {#if laedt}
      <div class="map-overlay">{t('🗺️ Karte wird geladen …')}</div>
    {:else if ladeFehler}
      <div class="map-overlay fehler">⚠️ {ladeFehler}</div>
    {:else if laedtTeil}
      <div class="teil-pille">{t('🔍 Mehr Details: {name} …', { name: laedtTeil.name })}</div>
    {:else if fehltHier}
      <div class="teil-pille warn">{t('📴 Mehr Details gibt es hier nur mit „{name}“, das liegt nicht auf diesem Gerät', { name: fehltHier.name })}</div>
    {:else if poiGeladen && poiEinAn && poiSumme === 0}
      <div class="teil-pille">
        {#if poiAndere.length}{t('Im Ausschnitt nichts davon, aber {join}. Oben einblenden oder herauszoomen.', { join: poiAndere.map((kat) => `${kat.emoji} ${poiImBild[kat.k]}`).join(' · ') })}
        {:else}{t('Hier sind keine Punkte gespeichert. Tankstellen & Co. gibt es offline für ganz WA, den Raum Melbourne, Cairns und die Whitsundays.')}{/if}
      </div>
    {/if}
    {#if expOffen}
      <div class="export-blatt" role="dialog" aria-label={je('Karte als Bild speichern', 'Save map as image')}>
        <div class="eb-kopf">
          <b>{je('Karte als Bild speichern', 'Save map as image')}</b>
          <button class="eb-zu" onclick={() => { expOffen = false; expMeldung = '' }} aria-label={je('Schließen', 'Close')}>✕</button>
        </div>
        <div class="eb-felder">
          <label><span>{je('Format', 'Format')}</span>
            <select class="bedien-feld" bind:value={expFormat} disabled={expLaeuft}>
              {#each FORMATE as f}<option value={f.id}>{f.label} · {f.breite}×{f.hoehe}</option>{/each}
            </select></label>
          <label><span>{je('Dateityp', 'File type')}</span>
            <select class="bedien-feld" bind:value={expTyp} disabled={expLaeuft}>
              {#each DATEITYPEN as t}<option value={t.id}>{t.label}</option>{/each}
            </select></label>
        </div>
        <button class="bedien-knopf haupt" onclick={exportiere} disabled={expLaeuft}>{expLaeuft ? t('rendert …') : t('↓ Speichern')}</button>
        {#if expMeldung}<p class="exp-msg" role="status">{expMeldung}</p>{/if}
      </div>
    {/if}
  </div>
  <div class="karten-fuss">
    <!-- Ebenen als Chips unter der Karte: die Karte bleibt frei, ein Tipp blendet ein oder aus. -->
    <div class="ebenen-karte">
      <span class="bedien-titel" id="ebenen-titel">{je('Was die Karte zeigt', 'What the map shows')}</span>
      <div class="ebenen" role="group" aria-labelledby="ebenen-titel">
      {#if $warnListe.length}
        <button class="ebene" class:an={warnAn} aria-pressed={warnAn} onclick={warnUmschalten} style="--pf:#e8730c;--pt:{schriftAuf('#e8730c')}"
          title={warnAn ? t('⚠️ Warngebiete ausblenden') : t('⚠️ Warngebiete einblenden')}>
          <span class="e-sym" aria-hidden="true">⚠️</span>{je('Warngebiete', 'Warnings')}
        </button>
      {/if}
      <button class="ebene" class:an={orteZeigen} aria-pressed={orteZeigen} onclick={() => (orteZeigen = !orteZeigen)} style="--pf:#c0392b;--pt:#fff"
        title={orteZeigen ? t('Vorschlagsorte ausblenden, besuchte bleiben') : t('Alle Orte deiner Sammlung zeigen')}>
        <span class="e-sym" aria-hidden="true">📍</span>{je('Alle Orte', 'All places')}{#if !orteZeigen && anzahlDokumentiert}<span class="e-zahl">{je(`nur ${anzahlDokumentiert} besuchte`, `only ${anzahlDokumentiert} visited`)}</span>{/if}
      </button>
      {#each POI_KAT as kat}
        <button class="ebene" class:an={poiAktiv[kat.k]} onclick={() => togglePoi(kat.k)} title={kat.label}
          style="--pf:{kat.farbe};--pt:{schriftAuf(kat.farbe)}" aria-pressed={poiAktiv[kat.k]}>
          <span class="e-sym" aria-hidden="true">{kat.emoji}</span>{kat.label}{#if poiAktiv[kat.k] && poiGeladen}<span class="e-zahl">{(poiImBild[kat.k] || 0).toLocaleString(LOCALE)}</span>{/if}
        </button>
      {/each}
      </div>
    </div>
    <!-- Offline-Stand mit Balken: auf einen Blick, wie viel der Karte ohne Netz geht. -->
    <div class="off-karte" class:fertig={alleDa}>
      <div class="off-kopf">
        <span class="off-titel">{alleDa ? '✅' : '📴'} {je('Offline-Karte', 'Offline map')}</span>
        <span class="off-stand">
          {#if alleDa}{je(`Ganz Australien gespeichert · ${Math.round(gesamtMB)} MB`, `All of Australia saved · ${Math.round(gesamtMB)} MB`)}
          {:else if $kartenLauf}{$kartenLauf.name || '…'} · {$kartenLauf.fertig}/{$kartenLauf.gesamt}
          {:else}{je(`${gespeichert} von ${kartenteile.length} Kartenteilen`, `${gespeichert} of ${kartenteile.length} map parts`)}{/if}
        </span>
      </div>
      <div class="off-balken" role="progressbar" aria-label={je('Offline gespeichert', 'Saved offline')}
        aria-valuemin="0" aria-valuemax={$kartenLauf ? $kartenLauf.gesamt : kartenteile.length} aria-valuenow={$kartenLauf ? $kartenLauf.fertig : gespeichert}>
        <i class:lauf={!!$kartenLauf} style="width:{Math.round(100 * ($kartenLauf ? ($kartenLauf.gesamt ? $kartenLauf.fertig / $kartenLauf.gesamt : 0) : gespeichert / kartenteile.length))}%"></i>
      </div>
      {#if !alleDa && !$kartenLauf}
        <button class="bedien-knopf" class:haupt={$online} onclick={alleSichern} disabled={!$online}>
          {$online ? t('📥 Ganz Australien sichern (~{round} MB)', { round: Math.round(offenMB) }) : t('zum Laden Netz nötig')}
        </button>
      {/if}
      {#if GROSSE_KARTE}
        <div class="gross-zeile">
          <button class="bedien-wahl" class:an={$grosseKarteAn} aria-pressed={$grosseKarteAn} onclick={grosseKarteUmschalten}>🛣️ {$grosseKarteAn ? t('Große Karte: an') : t('Große Karte einschalten')}</button>
          <span>{t('Jede Straße und Piste in Western Australia. Es lädt nur der Teil, in dem du unterwegs bist.')}</span>
        </div>
      {/if}
    </div>
    {#if reisen.length}
      <TourenWahl touren={tourenWahl} istAn={istGewaehlt} umschalten={toggleReise} alle={alleReisen} keine={keineReisen}
        alleAn={gewaehlteReisen.size === reisen.length} keineAn={gewaehlteReisen.size === 0}>
        {#snippet unten()}
          <div class="rs-meldungen">
      {#if gewaehlteReisen.size === 1}
        {@const rr = reisen.find((x) => gewaehlteReisen.has(x.id))}
        {#if rr?.route}
          <span class="rs-info">🛣️ <b>{rr.route.km} km</b> · ⏱️ {fahrzeitText(rr.route.dauerMin)}{#if rr.route.tank}&nbsp;{t('· ⛽ max {maxLuecke} km', { maxLuecke: rr.route.tank.maxLuecke })}{/if}</span>
        {:else}
          <span class="rs-info">{t('⤳ Luftlinie · km und Fahrzeit rechnet die Route im Plan')}</span>
        {/if}
      {:else if gewaehlteReisen.size > 1}
        {@const km = reisen.filter((x) => gewaehlteReisen.has(x.id)).reduce((a, x) => a + (x.route?.km || 0), 0)}
        <span class="rs-info">{t('{size} Routen', { size: gewaehlteReisen.size })}{#if km}&nbsp;· 🛣️ <b>{km} km</b> {t('zusammen')}{/if}</span>
      {/if}
      {#if routeHinweis.draussen.length}
        <span class="rs-warn">{t('✈️ Außerhalb der Karte: {kurzListe}. Gezeichnet ist der Teil über Australien.', { kurzListe: kurzListe(routeHinweis.draussen) })}</span>
      {/if}
      {#if routeHinweis.ohneLinie.length}
        <span class="rs-warn">{t('⚠️ Ohne Linie: {kurzListe}. Dafür braucht es mindestens zwei Stopps mit Koordinaten.', { kurzListe: kurzListe(routeHinweis.ohneLinie) })}</span>
      {/if}
          </div>
        {/snippet}
      </TourenWahl>
    {/if}
    <p class="bedien-text hinweis">
      {#if aktiv}{t('🔍 Details hier:')} <b>{detailStufe(aktiv)}</b> <span class="teil-name">({aktiv.name})</span> · {/if}
      {#if $online}{t('Gelände-Schattierung online')}{:else}{t('Gelände nur online')}{/if}
      {t('· Pins = deine {length} Orte · Tankstellen & Co.: Punkte immer, Symbole ab Zoom 10, Namen ab 13. Antippen zeigt Details.', { length: orte.filter((o) => o.lat != null).length })}
    </p>
  </div>
</div>

<style>
  /* Karte als großes Bild mit schwebender Bedienung, darunter die Einstellungen als Karten. */
  .karten { display: flex; flex-direction: column; gap: 12px; }
  .map-wrap { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-l, 16px); background: #cfe3ee; box-shadow: var(--shadow); isolation: isolate; }
  .map { height: clamp(380px, 66dvh, 760px); width: 100%; }

  /* Gemeinsames Aussehen der schwebenden Teile auf der Karte: leicht durchscheinend, Schatten, runde Ecken. */
  .ort-knopf, .warn-legende, .teil-pille, .export-blatt,
  .map-wrap :global(.maplibregl-ctrl-group) {
    background: color-mix(in srgb, var(--card) 90%, transparent);
    -webkit-backdrop-filter: blur(10px) saturate(1.3); backdrop-filter: blur(10px) saturate(1.3);
    border: 1px solid color-mix(in srgb, var(--line-stark) 70%, transparent);
    box-shadow: var(--shadow-float, 0 4px 14px rgba(0,0,0,.18));
    color: var(--ink);
  }

  /* Ebenen-Chips unter der Karte: alle sichtbar, umbrechend. */
  .ebenen-karte { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--card); }
  .ebenen { display: flex; flex-wrap: wrap; gap: 8px; }
  .ebene {
    position: relative; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 14px;
    border: 1px solid var(--line-stark); border-radius: 999px; background: none; font: inherit;
    font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted);
    white-space: nowrap; cursor: pointer; transition: background-color .15s, color .15s, border-color .15s;
  }
  .ebene::after { content: ''; position: absolute; inset: -2px 0; }
  .ebene:hover { color: var(--ink); border-color: var(--pf); }
  .ebene.an { background: var(--pf); border-color: var(--pf); color: var(--pt, #fff); }
  .e-sym { font-size: 1.05em; line-height: 1; }
  .ebene:not(.an) .e-sym { filter: grayscale(.6); opacity: .75; }
  .e-zahl { font-size: calc(11.5px * var(--schrift, 1)); font-weight: 800; font-variant-numeric: tabular-nums; padding: 1px 7px; border-radius: 999px; background: color-mix(in srgb, currentColor 18%, transparent); }

  /* MapLibre-Knöpfe im selben Stil, 44 px zum Tippen, unter den Chips. */
  .map-wrap :global(.maplibregl-ctrl-top-right .maplibregl-ctrl) { margin: 10px 10px 0 0; }
  .map-wrap :global(.maplibregl-ctrl-group) { border-radius: 14px; overflow: hidden; }
  .map-wrap :global(.maplibregl-ctrl-group:not(:empty)) { box-shadow: var(--shadow-float, 0 4px 14px rgba(0,0,0,.18)); }
  .map-wrap :global(.maplibregl-ctrl-group button) { width: 44px; height: 44px; background-color: transparent; color: var(--ink); }
  .map-wrap :global(.maplibregl-ctrl-group button + button) { border-top: 1px solid var(--line); }
  .map-wrap :global(.maplibregl-ctrl-group button:not(:disabled):hover) { background-color: color-mix(in srgb, var(--ink) 8%, transparent); }
  :global(:root[data-theme='dark']) .map-wrap :global(.maplibregl-ctrl-icon) { filter: invert(1) brightness(1.6); }
  .map-wrap :global(.maplibregl-ctrl-attrib) { border-radius: 10px 0 0 0; }

  .ort-knopf { position: absolute; right: 10px; bottom: 40px; z-index: 2; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; color: var(--brand-text); cursor: pointer; }
  .ort-knopf:hover { color: var(--brand); }
  .ort-knopf.sucht svg { animation: suche 1s linear infinite; }
  @keyframes suche { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .ort-knopf.sucht svg { animation: none; } .ort-knopf.sucht { opacity: .6; } }

  .warn-legende {
    position: absolute; left: 10px; bottom: 40px; z-index: 2; max-width: calc(100% - 84px); box-sizing: border-box;
    display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0; padding: 7px 12px; border-radius: 14px;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 600; color: var(--muted); pointer-events: none;
  }
  .warn-legende span { display: inline-flex; align-items: center; gap: 6px; }
  .warn-legende i { display: inline-block; width: 12px; height: 12px; }
  .wl-flaeche { background: rgba(232, 115, 12, 0.35); border: 2px solid #e8730c; border-radius: 3px; }
  .wl-ich { background: #1f6fd1; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px #1f6fd1; }
  .wl-kreis { border: 2px dashed #1f6fd1; border-radius: 50%; }

  .map-overlay {
    position: absolute; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 20px; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 600; color: var(--ink);
    background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(2px); pointer-events: none;
  }
  .map-overlay.fehler { color: var(--warn-text, #a23b2b); }
  /* Klein oben links: die Karte bleibt bedienbar, während ein Teil nachlädt. */
  .teil-pille {
    position: absolute; left: 10px; top: 10px; z-index: 2; max-width: calc(100% - 84px); box-sizing: border-box;
    padding: 6px 12px; border-radius: 12px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; line-height: 1.35;
    pointer-events: none;
  }
  .teil-pille.warn { color: var(--warn-text, #a05a1e); background: color-mix(in srgb, var(--warn-flaeche, #fdf1e0) 92%, transparent); }
  .teil-name { color: var(--muted); }

  /* Export als Blatt über der Karte statt Auswahlfelder in einer Zeile. */
  .export-blatt {
    position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 5; display: flex; flex-direction: column; gap: 10px;
    max-width: 420px; margin-left: auto; padding: 14px; border-radius: var(--radius-l, 16px);
    background: color-mix(in srgb, var(--card) 96%, transparent);
  }
  .eb-kopf { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .eb-zu { position: relative; width: 36px; height: 36px; border: none; border-radius: 50%; background: var(--flaeche-2, var(--flaeche)); color: var(--ink); cursor: pointer; font-size: calc(14px * var(--schrift, 1)); }
  .eb-zu::after { content: ''; position: absolute; inset: -4px; }
  .eb-felder { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 8px; }
  .eb-felder label { display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .exp-msg { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text, #1a7f37); }

  .karten-fuss { display: flex; flex-direction: column; gap: 12px; }
  .off-karte { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--card); }
  .off-kopf { display: flex; align-items: baseline; justify-content: space-between; gap: 6px 12px; flex-wrap: wrap; }
  .off-titel { font-weight: 800; font-size: calc(14.5px * var(--schrift, 1)); color: var(--ink); }
  .off-stand { font-size: calc(13px * var(--schrift, 1)); font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
  .off-karte.fertig .off-stand { color: var(--ok-text); }
  .off-balken { height: 8px; border-radius: 999px; background: var(--flaeche-2, var(--flaeche)); overflow: hidden; }
  .off-balken i { display: block; height: 100%; min-width: 8px; border-radius: inherit; background: var(--brand); transition: width .4s ease; }
  .off-karte.fertig .off-balken i { background: var(--ok-linie, #2f9e44); }
  .off-balken i.lauf { background-image: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent); background-size: 200% 100%; animation: lauf 1.2s linear infinite; }
  @keyframes lauf { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .off-balken i.lauf { animation: none; } }
  .gross-zeile { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid var(--line); font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .hinweis { padding: 0 4px; font-size: calc(12.5px * var(--schrift, 1)); }

  .rs-warn { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--warn-text, #a05a1e); background: var(--warn-flaeche, #fdf1e0);
    border: 1px solid var(--warn-linie, #e8c9a0); border-radius: 14px; padding: 4px 10px; }
  .rs-info { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .rs-meldungen { display: flex; flex-direction: column; gap: 6px; }
  .rs-meldungen:empty { display: none; }

  /* Standortpunkt: blau mit weißem Ring und ruhigem Puls, immer obenauf. */
  :global(.ich-punkt) { position: relative; width: 24px; height: 24px; pointer-events: none; }
  :global(.ich-kern) { position: absolute; inset: 2px; border-radius: 50%; background: #1f6fd1; border: 3px solid #fff; box-shadow: 0 1px 6px rgba(0,0,0,.5); }
  :global(.ich-halo) { position: absolute; inset: -12px; border-radius: 50%; background: rgba(31,111,209,.28); animation: -global-ich-puls 2.2s ease-out infinite; }
  @keyframes -global-ich-puls { 0% { transform: scale(.4); opacity: .9; } 100% { transform: scale(1.4); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { :global(.ich-halo) { animation: none; opacity: .5; } }
  :global(.maplibregl-popup) { z-index: 25; }
  :global(.pin) {
    width: 14px; height: 14px; background: #c0392b; border: 2px solid #fff;
    border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 1px 3px rgba(0,0,0,0.4); cursor: pointer;
  }
  /* Besuchte Orte heben sich ab — sie bleiben auch bei ausgeblendeten Vorschlägen. */
  :global(.pin.besucht) { background: #2f7a63; box-shadow: 0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.35); }
  /* Das Kartenfenster ist immer hell. Im dunklen Design erbte der Text sonst die helle Schrift
     der Seite und wäre auf Weiß kaum lesbar. Farben deshalb fest. */
  :global(.maplibregl-popup-content) { font-family: inherit; padding: 10px 14px; border-radius: 12px; color: #2b2620; background: #fffdf8; box-shadow: 0 6px 20px rgba(0,0,0,.22); }
  :global(.maplibregl-popup-content b) { color: #2b2620; }
  :global(.maplibregl-popup-content a) { color: #1864ab; font-weight: 600; }
  :global(.maplibregl-popup-close-button) { color: #5c534a; font-size: calc(18px * var(--schrift, 1)); padding: 0 6px; }
</style>
