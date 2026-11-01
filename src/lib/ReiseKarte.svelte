<script>
  import { t, je, LOCALE, tn } from './i18n.js'
  import { fehlerText } from './fehlertext.js'
  import { FORMATE, DATEITYPEN, exportiereKarte, speichere } from './kartenexport.js'
  import { schriftAuf } from './kontrast.js'
  // Reise-Karte der Startseite: echte Karte statt Schema.
  // • MapLibre mit Online-Kartenkacheln; offline Rückfall auf die echte
  //   Australien-Küstenlinie (liegt lokal vor) — funktioniert also immer.
  // • Alle Routen (Roadtrip + Vacation) mit nummerierten Stopps.
  // • Klick auf Route/Nummer öffnet ein Infofenster: Kennzahlen, Fotos zum
  //   Durchblättern, Logbuch-Einträge, Link zur Reise.
  // • Klick auf die Karte (bzw. ⤢) vergrößert sie auf Vollbild.
  // Die Karte ist eine Weltkugel. Beim Öffnen fliegt sie von
  // Deutschland nach Australien und zeichnet dabei die Flüge nach. „Reise abspielen“
  // fährt die Etappen der Reihe nach ab. Herangezoomt wird sie wie bisher zur flachen
  // Karte mit Straßen (OpenStreetMap, nur online). Offline bleibt die gemalte Kugel.
  import 'maplibre-gl/dist/maplibre-gl.css'
  import { AUS_RINGS } from './geo-australia.js'
  import { online } from './netz.js'
  import { fahrzeitText, haversine } from './routing.js'
  import { haptic } from './haptik.js'
  import { weltGeojson, gradnetz, verdichte } from './globus.js'
  import { gesamtStart } from './userdata.js'
  import { etappenMitDatum, routenDerEtappe } from './plan.js'
  import { bereich, dezimal, zahl } from './format.js'
  import { artDerTour, logbuchTouren, verlauf, punktBei, spitzenZoom, anzoom, zoomBei, dauerFuer, kmText, NAH_ZOOM, FAHRZEUG } from './reisefahrt.js'
  import ReiseFilm from './ReiseFilm.svelte'

  let {
    reisen = [], journal = [], orte = [], eigeneOrte = [], springeZu = () => {},
  } = $props()

  // Reise-Film: Video im Hochformat aus der Reise, eigenes Blatt
  let filmAuf = $state(false)
  function oeffneFilm() { if (spielt) anhalten(); filmAuf = true; haptic() }

  // ---- Export zum Drucken ----
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
        b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33322e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;margin:auto"><path d="M12 3v11"/><path d="m7.2 9.4 4.8 4.8 4.8-4.8"/><path d="M4.5 19.5h15"/></svg>'
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
        vorlage: map, breite: f.breite, hoehe: f.hoehe, typ: expTyp, hintergrund: '#0a1426',
        herkunft: $online ? t('© OpenStreetMap · WA-Reiseplan') : t('© Natural Earth · WA-Reiseplan'),
      })
      const dt = DATEITYPEN.find((x) => x.id === expTyp)
      const jetzt = new Date(), stempel = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`
      speichere(blob, `Reisekarte_${f.id}_${stempel}.${dt.endung}`)
      expMeldung = t('✓ {breite} × {hoehe} px · {toFixed} MB', { breite, hoehe, toFixed: dezimal(blob.size / 1048576, 1) })
    } catch (e) {
      expMeldung = t('Fehlgeschlagen. ') + fehlerText(e)
    }
    expLaeuft = false
  }

  let container = $state()
  let wurzel = $state()
  let gross = $state(false)          // Vollbild
  let gewaehlt = $state(null)        // ausgewählte Reise (Infofenster)

  // Welche Routen gezeichnet werden. LEERE Menge = noch nichts gewaehlt -> alle zeigen,
  // damit die Karte beim ersten Blick vollstaendig ist. „Keine" setzt einen Platzhalter,
  // damit sich „noch nie angefasst" von „bewusst alles aus" unterscheiden laesst.
  let sichtbar = $state(new Set())
  const istSichtbar = (id) => sichtbar.size === 0 || sichtbar.has(id)
  const zeigtAlle = $derived(sichtbar.size === 0 || (touren.length > 0 && touren.every((t) => sichtbar.has(t.id))))
  const nichtsSichtbar = $derived(sichtbar.size > 0 && !touren.some((t) => sichtbar.has(t.id)))

  function aktualisiereQuellen() {
    try {
      map?.getSource('routen')?.setData(routenGeojson())
      map?.getSource('stopps')?.setData(stoppsGeojson())
    } catch {}
  }
  function toggleSicht(id) {
    const n = new Set(sichtbar.size === 0 ? touren.map((t) => t.id) : [...sichtbar].filter((x) => x !== 'keine'))
    n.has(id) ? n.delete(id) : n.add(id)
    if (n.size === 0) n.add('keine')
    sichtbar = n
    if (gewaehlt && !n.has(gewaehlt.id)) gewaehlt = null   // kein Infofenster zu einer versteckten Route
    aktualisiereQuellen()
  }
  function alleSicht() { sichtbar = new Set(touren.map((t) => t.id)); aktualisiereQuellen() }
  function keineSicht() { sichtbar = new Set(['keine']); gewaehlt = null; aktualisiereQuellen() }
  let fotoIdx = $state(0)
  let map = null, maplibregl = null, bereit = $state(false), fehler = $state(null)

  // ---------- Reisen aufbereiten ----------
  const touren = $derived(reisen
    .map((r) => ({ r, typ: (r.art || 'auto') === 'flug' ? t('Flug') : r.art === 'bahn' ? t('Bahn') : r.art === 'boot' ? je('Schippern', 'Boating') : t('Fahrt'), farbe: r.farbe || '#c1662f' }))
    .map(({ r, typ, farbe }) => {
    const stops = (r.stops || []).filter((s) => s.lat != null && s.lon != null)
    // Echte Straßengeometrie bevorzugen, sonst Linie zwischen den Stopps.
    const roh = r.route?.geometry?.length >= 2 ? r.route.geometry : stops.map((s) => [s.lon, s.lat])
    const flug = ['flug', 'bahn', 'boot'].includes(r.art || 'auto')
    const geo = verdichte(roh, flug)
      return { id: r.id, name: r.name, typ, farbe, reise: r, stops, geo, flug }
    }).filter((t) => t.stops.length > 0))

  // Logbuch-Einträge einer Reise: erst die ausdrücklich verknüpften, dann solche,
  // die an einem Stopp der Route entstanden sind (auch ohne Verknüpfung).
  function eintraegeZu(t) {
    const alle = journal
    const direkt = alle.filter((e) => e.reiseId === t.id)
    const kennt = new Set(direkt.map((e) => e.id))
    const nah = alle
      .filter((e) => !kennt.has(e.id) && e.lat != null && e.lon != null
        && t.stops.some((s) => haversine(e.lat, e.lon, s.lat, s.lon) < 40))
      .map((e) => ({ ...e, nah: true }))
    return [...direkt, ...nah].sort((a, b) => (a.datum || '').localeCompare(b.datum || ''))
  }
  function fotosZu(t, eintraege) {
    const out = []
    for (const e of eintraege) for (const f of e.fotos || []) out.push({ src: f, datum: e.datum, ort: e.ort })
    for (const s of t.reise?.stops || []) if (s.img) out.push({ src: s.img, ort: s.name })
    return out
  }
  const infoEintraege = $derived(gewaehlt ? eintraegeZu(gewaehlt) : [])
  const infoFotos = $derived(gewaehlt ? fotosZu(gewaehlt, infoEintraege) : [])

  function waehle(id) {
    const t = touren.find((x) => x.id === id)
    if (!t) return
    gewaehlt = t; fotoIdx = 0
    haptic()
    zoomeAuf(t, 600)
  }

  // Rand so wählen, dass die Route nicht unter dem Infofenster verschwindet.
  function randFuer() {
    const h = container?.clientHeight || 360, b = container?.clientWidth || 360
    if (!gewaehlt) return 40
    if (!gross) return { top: 24, right: 24, bottom: Math.round(h * 0.5), left: 24 }
    return b < 560
      ? { top: 40, right: 28, bottom: Math.round(h * 0.55), left: 28 }   // Infofenster unten
      : { top: 50, right: Math.round(b * 0.46), bottom: 50, left: 50 }   // Infofenster rechts
  }

  /** Auf eine Tour zoomen — ohne Argument auf alle Touren zusammen. */
  function zoomeAuf(t = null, dauer = 0) {
    if (!map) return
    const quellen = t ? [t] : touren
    let b = [180, 90, -180, -90]
    for (const x of quellen) for (const c of x.geo) {
      b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])]
    }
    if (b[0] > b[2]) return
    try { map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: randFuer(), duration: dauer, maxZoom: 8 }) } catch {}
  }
  const kurzDat = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' }) } catch { return d || '' } }

  // ---------- GeoJSON ----------
  function routenGeojson() {
    return { type: 'FeatureCollection', features: touren.filter((t) => istSichtbar(t.id)).map((t) => ({
      type: 'Feature', id: t.id,
      properties: { id: t.id, name: t.name, farbe: t.farbe, flug: t.flug ? 1 : 0 },
      geometry: { type: 'LineString', coordinates: t.geo },
    })) }
  }
  function stoppsGeojson() {
    const f = []
    for (const t of touren.filter((x) => istSichtbar(x.id))) t.stops.forEach((s, i) => f.push({
      type: 'Feature',
      properties: { id: t.id, nr: String(i + 1), name: s.name || '', farbe: t.farbe },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    }))
    return { type: 'FeatureCollection', features: f }
  }
  // Jeder Ring ist eine eigene Landmasse (Festland, Tasmanien) — als MultiPolygon,
  // sonst würde der zweite Ring als Loch im ersten gelten.
  const landGeojson = {
    type: 'Feature', properties: {},
    geometry: { type: 'MultiPolygon', coordinates: AUS_RINGS.map((r) => [schliesse(r)]) },
  }
  function schliesse(ring) {
    const a = ring[0], z = ring[ring.length - 1]
    return a[0] === z[0] && a[1] === z[1] ? ring : [...ring, a]
  }

  let zerstoert = false
  async function init() {
    if (map || !container) return
    try {
      const ml = await import('maplibre-gl')
      if (zerstoert) return
      maplibregl = ml.default ?? ml
      map = new maplibregl.Map({
        container,
        // MapLibre 5: die frühere Top-Level-Option `preserveDrawingBuffer` wird
        // stillschweigend ignoriert (Vorgabe false). Ohne dies ist die Leinwand nach
        // dem Frame leer und der Export liefert ein schwarzes Bild.
        canvasContextAttributes: { preserveDrawingBuffer: true },
        style: {
          version: 8,
          projection: flach || (import.meta.env.DEV && window.__flach) ? { type: 'mercator' } : { type: 'globe' },
          // Atmosphäre um die Kugel; beim Heranzoomen blendet sie aus
          sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 0.85, 7, 0] },
          glyphs: location.origin + '/fonts/{fontstack}/{range}.pbf',
          sources: {
            // Grobe Weltkarte: ab Zoom 6 nur noch vergrößern, nicht neu zerlegen (spart Arbeit beim Fliegen)
            welt: { type: 'geojson', data: weltGeojson(), maxzoom: 6, tolerance: 0.6 },
            land: { type: 'geojson', data: landGeojson, maxzoom: 9 },
            netz: { type: 'geojson', data: gradnetz(), maxzoom: 4 },
            routen: { type: 'geojson', data: routenGeojson() },
            stopps: { type: 'geojson', data: stoppsGeojson() },
            flugspur: { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } },
          },
          layers: [
            { id: 'ozean', type: 'background', paint: { 'background-color': ['interpolate', ['linear'], ['zoom'], 1, '#1a4f74', 4, '#2b6a92', 6.5, '#a8cadf'] } },
            { id: 'netz', type: 'line', source: 'netz', paint: { 'line-color': '#ffffff', 'line-width': 0.7, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.16, 4.5, 0] } },
            { id: 'welt', type: 'fill', source: 'welt', paint: { 'fill-color': ['interpolate', ['linear'], ['zoom'], 2, '#d8b37b', 6.5, '#efe3c6'] } },
            { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': ['interpolate', ['linear'], ['zoom'], 2, '#cc8a58', 5, '#dcae80', 6.5, '#efe3c6'] } },
            { id: 'landkante', type: 'line', source: 'land', paint: { 'line-color': '#b98f5f', 'line-width': 0.8, 'line-opacity': 0.6 } },
          ],
        },
        center: [10, 28], zoom: zoomFuerRadius(0.4, 28),
        attributionControl: { compact: true },
        // iPhone: ein Finger scrollt die Seite, zwei Finger bewegen die Kugel (im Vollbild
        // reicht einer). Sonst bliebe man beim Scrollen an der Karte hängen.
        cooperativeGestures: beruehrung && !gross,
        locale: {
          'CooperativeGesturesHandler.MobileHelpText': t('Mit zwei Fingern drehen und zoomen'),
          'CooperativeGesturesHandler.MacHelpText': t('⌘ + Scrollen zum Zoomen'),
          'CooperativeGesturesHandler.WindowsHelpText': t('Strg + Scrollen zum Zoomen'),
          'NavigationControl.ZoomIn': t('Hineinzoomen'), 'NavigationControl.ZoomOut': t('Herauszoomen'),
        },
      })
      if (import.meta.env.DEV) window.__reisekarte = map   // nur für Tests auf dem Entwicklungsserver
      map.getCanvas().setAttribute('aria-label', 'Übersichtskarte der Reisen')   // VoiceOver: beide Karten hießen „Map"
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(baueExportKnopf(() => (expOffen = true)), 'top-right')

      map.on('load', () => {
        try { echteKacheln() } catch {}
        try { routenLayer() } catch {}
        bereit = true
        try { intro() } catch { try { startBlick() } catch {} }
      })
      waechter()
      map.on('move', licht)
      map.on('resize', licht)
      // Wer die Kugel anfasst, übernimmt: Einflug und Abspielen halten an
      for (const ev of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart']) map.on(ev, (e) => { if (e.originalEvent && (introLaeuft || spielt)) anhalten() })
      // Fehlende Kacheln (offline) sind kein Kartenfehler — dann greift der Küstenlinien-Rückfall.
      map.on('error', (e) => {
        if (bereit || e?.sourceId === 'osm') return
        fehler = t('Karte konnte nicht geladen werden')
      })
    } catch (e) { fehler = t('Karte nicht verfügbar') }
  }

  // Echte Kartenkacheln (nur online) — unter die Routen legen.
  function echteKacheln() {
    if (!map || !$online || map.getSource('osm')) return
    map.addSource('osm', {
      type: 'raster', tileSize: 256,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      maxzoom: 17, attribution: t('© OpenStreetMap-Mitwirkende'),
    })
    map.addLayer({ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3.6, 0, 5, 1], 'raster-saturation': -0.45 } }, 'landkante')
  }

  function routenLayer() {
    if (!map || map.getLayer('route-linie')) return
    // Dunkler Rand + weißer Saum: so bleibt auch eine grüne Route über grünem
    // OpenStreetMap-Gelände klar sichtbar.
    map.addLayer({
      id: 'route-rand', type: 'line', source: 'routen',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#1b1b1b', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 9, 10, 13], 'line-opacity': 0.75 },
    })
    map.addLayer({
      id: 'route-halo', type: 'line', source: 'routen',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 7, 10, 10.5], 'line-opacity': 1 },
    })
    map.addLayer({
      id: 'route-linie', type: 'line', source: 'routen',
      filter: ['!=', ['get', 'flug'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4.5, 10, 7] },
    })
    // Zweite Ebene nur fuer Fluege. Getrennt, weil `line-dasharray` in MapLibre NICHT
    // datengesteuert sein darf — ein `['case', …]` waere hier ein Laufzeitfehler.
    map.addLayer({
      id: 'route-linie-flug', type: 'line', source: 'routen',
      filter: ['==', ['get', 'flug'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4.5, 10, 7], 'line-dasharray': [2.2, 1.6] },
    })
    // Unsichtbare, breite Fangfläche fürs bequeme Antippen
    map.addLayer({ id: 'route-klick', type: 'line', source: 'routen', paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 26 } })
    // Spur, die der Einflug Stück für Stück zeichnet
    // Die Spur wächst über `line-gradient` (nur eine Malfarbe, kein neues GeoJSON je Bild)
    map.addLayer({ id: 'flugspur-rand', type: 'line', source: 'flugspur', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': 6.5, 'line-gradient': spurVerlauf(0, 'rgba(255,255,255,0.9)') } })
    map.addLayer({ id: 'flugspur', type: 'line', source: 'flugspur', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': 3.2, 'line-gradient': spurVerlauf(0, '#f08a3c') } })

    // Punkte wachsen mit dem Zoom; herausgezoomt bleiben sie klein, damit
    // eng beieinanderliegende Stopps nicht zu einem Klumpen verschmelzen.
    const zoomWert = (klein, gross) => ['interpolate', ['linear'], ['zoom'], 3, klein, 6, (klein + gross) / 2, 10, gross]
    map.addLayer({
      id: 'stopp-punkt', type: 'circle', source: 'stopps',
      paint: {
        'circle-radius': zoomWert(5.5, 13),
        'circle-color': ['get', 'farbe'],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': zoomWert(1.5, 2.5),
      },
    })
    map.addLayer({
      id: 'stopp-nr', type: 'symbol', source: 'stopps',
      layout: {
        'text-field': ['get', 'nr'], 'text-font': ['Noto Sans Regular'],
        'text-size': zoomWert(10, 13),
        'text-allow-overlap': false,        // gedrängte Nummern treten zurück
        'text-ignore-placement': false,
        'symbol-sort-key': ['to-number', ['get', 'nr']],
        'text-padding': 1,
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,.25)', 'text-halo-width': 0.6 },
    })

    for (const lyr of ['route-klick', 'stopp-punkt', 'stopp-nr']) {
      map.on('click', lyr, (e) => { const id = e.features?.[0]?.properties?.id; if (id) waehle(id) })
      map.on('mouseenter', lyr, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', lyr, () => (map.getCanvas().style.cursor = ''))
    }
  }

  function passeAn() { if (gewaehlt) zoomeAuf(gewaehlt); else startBlick() }

  // ---------- Kugel: Blick, Licht, Einflug, Abspielen ----------
  const RAD = Math.PI / 180
  const reduziert = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const hoehe = () => container?.clientHeight || 400
  const breite = () => container?.clientWidth || 400
  // Zoom, bei dem die Kugel auf dem Bildschirm `anteil` × kürzere Seite als Radius hat.
  // MapLibre stellt die Kamera 1,5 Bildhöhen vor die Kugel (Blickwinkel 36,87°); daraus
  // folgt der sichtbare Rand r = d·R / √((d+R)² − R²). Am 10.10. gemessen: stimmt aufs Pixel.
  function radiusZuZoom(r, lat) {
    const d = 1.5 * hoehe()
    const R = (r * r + r * Math.sqrt(r * r + d * d)) / d
    return Math.log2((R * 2 * Math.PI * Math.cos(lat * RAD)) / 512)
  }
  function zoomFuerRadius(anteil, lat) { return radiusZuZoom(anteil * Math.min(breite(), hoehe()), lat) }
  function sichtbarerRadius() {
    if (!map) return 0
    const lat = map.getCenter().lat, d = 1.5 * hoehe()
    const R = (512 * 2 ** map.getZoom()) / (2 * Math.PI * Math.cos(lat * RAD))
    return (d * R) / Math.sqrt((d + R) ** 2 - R * R)
  }
  // Licht von links oben als weicher Verlauf über der Kugel (MapLibre schattiert sie nicht)
  let lichtEl = $state()
  function licht() {
    if (!lichtEl || !map) return
    const r = sichtbarerRadius(), z = map.getZoom()
    // Nur solange die Kugel als Kugel zu sehen ist; danach wird sie flach
    const deck = flach ? 0 : z < 2.2 ? 1 : z > 2.9 ? 0 : (2.9 - z) / 0.7
    // Feste Grundgröße 100px, Lage und Größe nur über transform (kein Layout je Bild)
    lichtEl.style.transform = `translate(${breite() / 2 - r}px, ${hoehe() / 2 - r}px) scale(${(2 * r) / 100})`
    lichtEl.style.opacity = String(deck)
  }

  // Australien-Teil der Reise (ohne die Flüge nach Europa) als Ziel des Einflugs
  const inAustralien = ([lon, lat]) => lon > 110 && lon < 156 && lat < -9 && lat > -45
  function startBlick(dauer = 0) {
    if (!map) return
    const pkt = touren.flatMap((t) => t.stops.map((s) => [s.lon, s.lat])).filter(inAustralien)
    let lon = 134, lat = -26
    if (pkt.length) {
      lon = (Math.min(...pkt.map((p) => p[0])) + Math.max(...pkt.map((p) => p[0]))) / 2
      lat = (Math.min(...pkt.map((p) => p[1])) + Math.max(...pkt.map((p) => p[1]))) / 2
    }
    if (flach && pkt.length) {
      const b = pkt.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [180, 90, -180, -90])
      try { map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 34, duration: dauer, maxZoom: 7 }) } catch {}
      return
    }
    const w = breite(), h = hoehe()
    // Die Kugel soll als Kugel zu sehen sein: Radius gut die halbe kürzere Seite
    const r = Math.min(w, h) * (w > 700 ? 0.6 : 0.56)
    const ziel = { center: [lon, lat], zoom: radiusZuZoom(r, lat), bearing: 0, pitch: 0 }
    if (dauer) map.flyTo({ ...ziel, duration: dauer, curve: 1.2, essential: true })
    else map.jumpTo(ziel)
  }

  // Schutz für schwache Geräte: Kommt der Browser in den ersten Sekunden mit dem Zeichnen
  // nicht hinterher (kein neues Bild über eine Sekunde lang, obwohl die Seite sonst läuft),
  // wird die Kugel zur flachen Karte und der Einflug fällt aus. Gefunden in der Testumgebung
  // ohne Grafikkarte; auf Mac und iPhone sollte es nie greifen.
  let flachGeschaltet = $state(false)
  // Wahl Kugel oder flache Karte, merkt sich das Gerät
  let flach = $state((() => { try { return localStorage.getItem('tb-karte-flach') === '1' } catch { return false } })())
  function umschalten() {
    flach = !flach
    try { localStorage.setItem('tb-karte-flach', flach ? '1' : '0') } catch {}
    haptic()
    if (!map) return
    anhalten()
    try { map.setProjection({ type: flach ? 'mercator' : 'globe' }) } catch {}
    passeAn()
    licht()
  }
  function waechter() {
    if (import.meta.env.DEV && window.__keinWaechter) return
    const start = performance.now()
    let bild = start, uhr = start, haker = 0, aus = false
    const takt = () => { bild = performance.now(); if (!aus) requestAnimationFrame(takt) }
    requestAnimationFrame(takt)
    const id = setInterval(() => {
      const jetzt = performance.now()
      // Hängt die ganze Seite, kommt auch dieser Takt zu spät: das zählt doppelt
      if (document.visibilityState === 'visible' && (jetzt - bild > 1000 || jetzt - uhr > 1500)) haker += jetzt - uhr > 1500 ? 2 : 1
      uhr = jetzt
      if (haker >= 2 && map && !flachGeschaltet && !flach) {
        flachGeschaltet = true
        flach = true
        try { anhalten(); map.setProjection({ type: 'mercator' }); startBlick() } catch {}
      }
      if (flachGeschaltet || jetzt - start > 10000) { clearInterval(id); aus = true }
    }, 250)
  }

  let introLaeuft = $state(false)
  let spielt = $state(false)
  let beschriftung = $state(null)   // { titel, zeit, farbe } während des Abspielens
  let animNr = 0
  const flugFeatures = () => touren.filter((t) => t.flug && istSichtbar(t.id) && t.geo.length > 1)
  function setzeSichtbarkeit(an, dauer = 700) {
    if (!map?.getLayer('route-linie')) return
    for (const [id, eig] of [['route-rand', 'line-opacity'], ['route-halo', 'line-opacity'], ['route-linie', 'line-opacity'], ['route-linie-flug', 'line-opacity'], ['stopp-punkt', 'circle-opacity'], ['stopp-punkt', 'circle-stroke-opacity'], ['stopp-nr', 'text-opacity']]) {
      try {
        map.setPaintProperty(id, eig + '-transition', { duration: dauer, delay: 0 })
        const voll = id === 'route-rand' ? 0.75 : 1
        map.setPaintProperty(id, eig, an === true ? voll : an === false ? 0 : ['case', ['in', ['get', 'id'], ['literal', an]], voll, voll * 0.18])
      } catch {}
    }
  }
  function spurVerlauf(p, farbe) {
    const k = Math.min(0.999, Math.max(0.001, p))
    return ['step', ['line-progress'], farbe, k, 'rgba(0,0,0,0)']
  }
  function spurSetzen(liste) {
    map.getSource('flugspur')?.setData({ type: 'FeatureCollection', features: liste.map((t) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: t.geo } })) })
  }
  function spurZeichnen(anteil) {
    try {
      map.setPaintProperty('flugspur', 'line-gradient', spurVerlauf(anteil, '#f08a3c'))
      map.setPaintProperty('flugspur-rand', 'line-gradient', spurVerlauf(anteil, 'rgba(255,255,255,0.9)'))
    } catch {}
  }
  function intro() {
    let schonGesehen = false
    try { schonGesehen = sessionStorage.getItem('tb-einflug') === '1'; sessionStorage.setItem('tb-einflug', '1') } catch {}
    if (reduziert() || !touren.length || schonGesehen || (import.meta.env.DEV && window.__ohneIntro)) { startBlick(); return }
    introLaeuft = true
    const nr = ++animNr
    setzeSichtbarkeit(false, 0)
    // Der erste Flug der Reise (zeitlich), sonst alle Flüge
    const fl = flugFeatures().filter((t) => t.geo.some(inAustralien) && !t.geo.every(inAustralien))
    const liste = fl.length ? fl : flugFeatures()
    spurZeichnen(0)
    spurSetzen(liste)
    setTimeout(() => {
      if (nr !== animNr) return
      startBlick(5200)
      const t0 = performance.now()
      let zuletzt = 0
      const schritt = (t) => {
        if (nr !== animNr) return
        const p = Math.min(1, (t - t0) / 4600)
        if (t - zuletzt > 50 || p >= 1) { spurZeichnen(1 - Math.pow(1 - p, 2)); zuletzt = t }
        if (p < 1) requestAnimationFrame(schritt)
      }
      requestAnimationFrame(schritt)
      map.once('moveend', () => { if (nr === animNr) introFertig() })
    }, 650)
  }
  function introFertig() {
    introLaeuft = false
    setzeSichtbarkeit(true)
    setTimeout(() => map?.getSource('flugspur')?.setData({ type: 'FeatureCollection', features: [] }), 700)
  }
  function anhalten() {
    animNr++
    try { map.stop() } catch {}
    if (introLaeuft) introFertig()
    fahrzeugWeg()
    if (spielt) { spielt = false; beschriftung = null; setzeSichtbarkeit(true) }
  }

  // Eine Strecke abfahren: zum Start, langsam und dann schneller heranzoomen, das Verkehrsmittel fährt
  // los und die Kamera zoomt nur so weit heraus, wie es die Länge der Strecke verlangt.
  let fahrzeug = null
  function fahrzeugWeg() { fahrzeug?.remove(); fahrzeug = null }
  function zeitlauf(dauer, nr, schritt) {
    return new Promise((fertig) => {
      const start = performance.now()
      const takt = (jetzt) => {
        if (nr !== animNr || !map) return fertig(false)
        const p = Math.min(1, (jetzt - start) / dauer)
        schritt(p)
        if (p < 1) requestAnimationFrame(takt); else fertig(true)
      }
      requestAnimationFrame(takt)
    })
  }
  async function fahre(tour, e, nr) {
    const art = tour.art || artDerTour(tour.reise)
    // Boote fahren über Wasser, nicht die berechnete Straßenroute
    const v = verlauf(art === 'boot' ? tour.stops.map((x) => [x.lon, x.lat]) : tour.geo)
    const start = punktBei(v, 0), breitePx = Math.min(breite(), hoehe())
    beschriftung = { titel: tour.name || e.reise?.name, zeit: bereich(e.von, e.bis), farbe: tour.farbe }
    const mitte = map.getCenter()
    const weg = verlauf([[mitte.lng, mitte.lat], [start.lon, start.lat]]).gesamt
    if (weg > 150) {
      map.flyTo({ center: [start.lon, start.lat], zoom: Math.min(map.getZoom(), spitzenZoom(weg, breitePx, start.lat)), duration: Math.min(2600, 900 + weg / 3), curve: 1.5, essential: true })
      await new Promise((r) => setTimeout(r, Math.min(2600, 900 + weg / 3)))
      if (nr !== animNr) return false
    }
    const z0 = map.getZoom()
    if (!(await zeitlauf(1900, nr, (p) => map.jumpTo({ center: [start.lon, start.lat], zoom: z0 + (NAH_ZOOM - z0) * anzoom(p), bearing: 0, pitch: 0 })))) return false
    if (v.coords.length < 2 || v.gesamt < 0.2) return nr === animNr
    const el = document.createElement('div')
    el.className = 'rk-fahrzeug'
    el.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="${FAHRZEUG[art]}" fill="#fff" fill-rule="evenodd" stroke="#14100c" stroke-width="1"/></svg>`
    fahrzeugWeg()
    fahrzeug = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map', rotation: start.richtung }).setLngLat([start.lon, start.lat]).addTo(map)
    beschriftung = { ...beschriftung, km: kmText(v.gesamt, zahl) }
    await new Promise((r) => setTimeout(r, 700))
    const spitze = spitzenZoom(v.gesamt, breitePx, start.lat)
    const ok = await zeitlauf(dauerFuer(v.gesamt) * 1000, nr, (p) => {
      const q = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
      const o = punktBei(v, q)
      fahrzeug?.setLngLat([o.lon, o.lat]).setRotation(o.richtung)
      map.jumpTo({ center: [o.lon, o.lat], zoom: zoomBei(q, NAH_ZOOM, spitze) })
    })
    if (ok) await new Promise((r) => setTimeout(r, 450))
    fahrzeugWeg()
    return ok && nr === animNr
  }

  // Reise abspielen: Etappe für Etappe, in der Reihenfolge des Plans
  async function abspielen() {
    if (spielt) { anhalten(); return }
    if (!map) return
    anhalten()
    gewaehlt = null
    spielt = true
    haptic()
    const nr = ++animNr
    const warte = (ms) => new Promise((r) => setTimeout(r, ms))
    const etappen = etappenMitDatum(reisen, $gesamtStart)
    if (!reduziert()) {
      const logTouren = logbuchTouren(journal)
      const gefahren = new Set()
      for (const e of etappen) {
        const ids = [e.reise.id, ...routenDerEtappe(reisen, e.reise.id).map((r) => r.id)]
        const teile = ids.map((id) => touren.find((x) => x.id === id)).filter((x) => x?.geo?.length && x.reise.imFilm !== false)
        const vomTag = logTouren.filter((x) => x.datum >= e.von && x.datum <= e.bis)
        vomTag.forEach((x) => gefahren.add(x.id))
        if (teile.length) setzeSichtbarkeit(ids, 500)
        for (const tour of [...teile, ...vomTag]) { if (!(await fahre(tour, e, nr))) return }
      }
      for (const tour of logTouren.filter((x) => !gefahren.has(x.id))) { if (!(await fahre(tour, { von: tour.datum, bis: tour.datum }, nr))) return }
      if (nr !== animNr) return
      spielt = false; beschriftung = null
      setzeSichtbarkeit(true)
      startBlick(2200)
      return
    }
    for (const e of etappen) {
      if (nr !== animNr) return
      const ids = [e.reise.id, ...routenDerEtappe(reisen, e.reise.id).map((r) => r.id)]
      const teile = touren.filter((t) => ids.includes(t.id))
      const pkt = teile.flatMap((t) => t.geo)
      if (!pkt.length) continue
      beschriftung = { titel: e.reise.name, zeit: bereich(e.von, e.bis), farbe: e.reise.farbe || '#c1662f' }
      setzeSichtbarkeit(ids, 500)
      let b = [180, 90, -180, -90]
      for (const c of pkt) b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])]
      const rand = { top: 70, bottom: 40, left: 40, right: 40 }
      try {
        const cam = map.cameraForBounds([[b[0], b[1]], [b[2], b[3]]], { padding: rand, maxZoom: 5.2 })
        if (cam) map.flyTo({ ...cam, zoom: Math.min(cam.zoom, 5.2), bearing: 0, pitch: 0, duration: reduziert() ? 0 : 2600, curve: 1.3, essential: true })
      } catch {}
      await warte(reduziert() ? 2200 : 4300)
    }
    if (nr !== animNr) return
    spielt = false; beschriftung = null
    setzeSichtbarkeit(true)
    startBlick(reduziert() ? 0 : 2200)
  }

  // Kommt die Verbindung später (Outback!), Kacheln nachrüsten — die Karte
  // wurde dann offline mit der Küstenlinie aufgebaut.
  $effect(() => {
    if ($online && bereit) { try { echteKacheln() } catch {} }
  })

  // Daten ändern sich → Quellen aktualisieren
  $effect(() => {
    const _ = touren.length + JSON.stringify(touren.map((t) => t.id + t.geo.length))
    if (!map || !bereit) return
    try {
      map.getSource('routen')?.setData(routenGeojson())
      map.getSource('stopps')?.setData(stoppsGeojson())
    } catch {}
  })

  // Karte erst laden, wenn sie in die Nähe des Sichtfelds kommt (spart Leistung).
  // Zusätzlich ein Sicherheitsnetz: laden Inhalte darüber nach, verschiebt sich die
  // Karte aus dem Sichtfeld und der Beobachter würde sonst nie auslösen.
  $effect(() => {
    if (!container) return
    const io = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting)) { io.disconnect(); init() }
    }, { rootMargin: '400px 0px' })
    io.observe(container)
    const netz = setTimeout(() => { io.disconnect(); init() }, 3000)
    return () => { io.disconnect(); clearTimeout(netz) }
  })

  // Vollbild: Karte an <body> hängen. Sonst kann ein Vorfahre mit `transform`
  // (z. B. die Einblend-Animation) zum Bezugsrahmen für `position: fixed` werden —
  // das „Vollbild" bliebe dann im Textfluss kleben.
  let anker = null
  $effect(() => {
    if (!wurzel) return
    if (gross) {
      if (!anker) {
        anker = document.createComment('reisekarte')
        wurzel.parentNode?.insertBefore(anker, wurzel)
      }
      document.body.appendChild(wurzel)
      document.body.style.overflow = 'hidden'
    } else if (anker) {
      anker.parentNode?.insertBefore(wurzel, anker)
      anker.remove(); anker = null
      document.body.style.overflow = ''
    }
  })
  // Beim Verlassen: Karte und WebGL freigeben, ein ins <body> gehängtes Vollbild mitnehmen
  $effect(() => () => {
    zerstoert = true
    animNr++
    document.body.style.overflow = ''
    try { map?.remove() } catch {}
    map = null
    if (wurzel?.parentNode === document.body) wurzel.remove()
    anker?.remove(); anker = null
  })

  // Größe nach dem Vergrößern/Verkleinern anpassen
  $effect(() => {
    gross
    if (!map) return
    // Im Vollbild dreht schon ein Finger die Kugel, auf der Seite braucht es zwei
    try { if (beruehrung) gross ? map.cooperativeGestures.disable() : map.cooperativeGestures.enable() } catch {}
    setTimeout(() => { try { map.resize(); passeAn() } catch {} }, 300)
  })

  const beruehrung = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  function toggleGross() { gross = !gross; haptic() }
  // Direkt zur Etappe bzw. Route im Plan, nicht nur an den Anfang der Liste
  function zurReise() {
    const r = gewaehlt?.reise
    const ziel = !r ? 'plan' : r.typ === 'route' ? (r.etappeId ? `plan/etappe/${r.etappeId}/${r.id}` : 'plan/route/' + r.id) : 'plan/etappe/' + r.id
    gross = false; gewaehlt = null
    springeZu(ziel)
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { if (gewaehlt) gewaehlt = null; else if (gross) gross = false } }} />

<div class="rk" class:gross bind:this={wurzel}>
  <div class="rk-kopf">
    <h2 class="rk-titel">{t('🌍 Meine Reise-Karte')}</h2>
    <div class="rk-werkzeug">
      {#if bereit && touren.length}
        <button class="rk-spiel" class:an={spielt} onclick={abspielen} aria-pressed={spielt}>{spielt ? t('⏹ Anhalten') : t('▶ Reise abspielen')}</button>
        <button class="rk-spiel rk-film" onclick={oeffneFilm} aria-haspopup="dialog" title={t('Reise als Video aufnehmen')}>{t('🎬 Film')}</button>
      {/if}
      <button class="rk-btn" onclick={umschalten} title={flach ? t('Als Weltkugel zeigen') : t('Als flache Karte zeigen')} aria-label={flach ? t('Als Weltkugel zeigen') : t('Als flache Karte zeigen')}>{flach ? '🌍' : '🗺️'}</button>
      <span class="rk-zahl">{tn(touren.length, '{n} Tour', '{n} Touren')}</span>
      <button class="rk-btn" onclick={toggleGross} title={gross ? 'verkleinern' : t('vergrößern')}
        aria-label={gross ? t('Karte verkleinern') : t('Karte vergrößern')}>{gross ? '✕' : '⤢'}</button>
    </div>
  </div>

  <div class="rk-buehne">
    <div class="rk-sterne" aria-hidden="true"></div>
    <div class="rk-map" bind:this={container}></div>
    <div class="rk-licht" bind:this={lichtEl} aria-hidden="true"></div>
    {#if beschriftung}
      <div class="rk-etappe" style="--f:{beschriftung.farbe}" aria-live="polite"><b>{beschriftung.titel}</b><span>{beschriftung.zeit}{#if beschriftung.km}&nbsp;· {beschriftung.km}{/if}</span></div>
    {/if}

    {#if !bereit && !fehler}
      <div class="rk-lade">{t('Karte wird geladen …')}</div>
    {/if}
    {#if fehler}
      <div class="rk-lade fehler">{fehler}</div>
    {/if}
    {#if touren.length === 0 && bereit}
      <div class="rk-hinweis">{t('Sobald du im')} <b>{t('Plan')}</b> {t('eine Etappe oder Route mit Stopps anlegst, erscheint sie hier, mit nummerierten Stationen zum Antippen.')}</div>
    {/if}
    {#if !gross && bereit && touren.length}
      <button class="rk-lupe" onclick={toggleGross}>{t('⤢ Karte vergrößern')}</button>
    {/if}

    <!-- Infofenster zur angetippten Route -->
    <div class="exp-leiste">
      {#if expOffen}
        <div class="exp-box">
          <select bind:value={expFormat} disabled={expLaeuft}>
            {#each FORMATE as f}<option value={f.id}>{f.label} · {f.breite}×{f.hoehe}</option>{/each}
          </select>
          <select bind:value={expTyp} disabled={expLaeuft}>
            {#each DATEITYPEN as t}<option value={t.id}>{t.label}: {t.hinweis}</option>{/each}
          </select>
          <button class="exp-go" onclick={exportiere} disabled={expLaeuft}>
            {expLaeuft ? t('rendert …') : t('↓ Speichern')}
          </button>
          <button class="exp-zu" onclick={() => { expOffen = false; expMeldung = '' }} aria-label={t('schließen')}>✕</button>
          {#if expMeldung}<span class="exp-msg">{expMeldung}</span>{/if}
        </div>
      {/if}
    </div>
    {#if gewaehlt}
      <div class="info" class:gross>
        <div class="i-kopf" style="--f:{gewaehlt.farbe}">
          <span class="i-typ" style="color:{schriftAuf(gewaehlt.farbe)}">{gewaehlt.typ}</span>
          <span class="i-name">{gewaehlt.name}</span>
          <button class="i-zu" onclick={() => (gewaehlt = null)} aria-label={t('schließen')}>✕</button>
        </div>

        <div class="i-zahlen">
          {#if gewaehlt.reise.route?.km}<span>🛣️ <b>{gewaehlt.reise.route.km} km</b></span>{/if}
          {#if gewaehlt.reise.route?.dauerMin != null}<span>⏱️ <b>{fahrzeitText(gewaehlt.reise.route.dauerMin)}</b></span>{/if}
          {#if gewaehlt.reise.tage}<span>📅 <b>{t('{tage} Tage', { tage: gewaehlt.reise.tage })}</b></span>{/if}
          <span>📍 <b>{t('{length} Stopps', { length: gewaehlt.stops.length })}</b></span>
          {#if gewaehlt.reise.route?.tank?.warnung}<span class="i-warn">{t('⛽ Tank-Lücke {maxLuecke} km', { maxLuecke: gewaehlt.reise.route.tank.maxLuecke })}</span>{/if}
        </div>


        {#if infoFotos.length}
          <div class="i-foto">
            <img src={infoFotos[fotoIdx % infoFotos.length].src} alt={t('Reisefoto')} />
            {#if infoFotos.length > 1}
              <div class="f-steuer">
                <button onclick={() => (fotoIdx = (fotoIdx - 1 + infoFotos.length) % infoFotos.length)} aria-label={t('vorheriges Foto')}>‹</button>
                <span class="f-zaehler">{(fotoIdx % infoFotos.length) + 1} / {infoFotos.length}</span>
                <button onclick={() => (fotoIdx = (fotoIdx + 1) % infoFotos.length)} aria-label={t('nächstes Foto')}>›</button>
              </div>
            {/if}
            {#if infoFotos[fotoIdx % infoFotos.length].ort}
              <span class="f-bildtitel">{infoFotos[fotoIdx % infoFotos.length].ort}</span>
            {/if}
          </div>
        {/if}

        {#if infoEintraege.length}
          <div class="i-log">
            <div class="i-log-titel">{tn(infoEintraege.length, '📖 Logbuch · {n} Eintrag', '📖 Logbuch · {n} Einträge')}</div>
            {#each infoEintraege.slice(0, gross ? 6 : 2) as e}
              <div class="i-log-zeile">
                <b>{kurzDat(e.datum)}</b>{#if e.ort}&nbsp;· {e.ort}{/if}{#if e.nah}<span class="i-nah">{t('an der Route')}</span>{/if}
                {#if e.text}<span class="i-log-text">{e.text.slice(0, 90)}{e.text.length > 90 ? ' …' : ''}</span>{/if}
              </div>
            {/each}
            {#if infoEintraege.length > (gross ? 6 : 2)}<div class="i-log-mehr">{t('+ {wert} weitere', { wert: infoEintraege.length - (gross ? 6 : 2) })}</div>{/if}
          </div>
        {/if}

        <button class="i-link" onclick={zurReise}>{t('→ Zur Reise')}</button>

        {#if gross}
          <div class="i-stopps">
            {#each gewaehlt.stops as s, i}<span class="i-stopp"><i>{i + 1}</i>{s.name}</span>{/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if touren.length}
    <div class="rk-legende">
      <button class="rk-leg rk-alle" class:an={zeigtAlle} onclick={alleSicht}>{t('Alle')}</button>
      <button class="rk-leg" class:an={nichtsSichtbar} onclick={keineSicht}>{t('Keine')}</button>
      {#each touren as t}
        <button class="rk-leg" class:an={istSichtbar(t.id)} class:offen={gewaehlt?.id === t.id}
          onclick={() => toggleSicht(t.id)} ondblclick={() => waehle(t.id)}>
          <span class="rk-linie" class:flug={t.flug} style="--f:{t.farbe}"></span>{t.name}
        </button>
      {/each}
      <span class="rk-tipp">{t('Antippen blendet ein/aus · Route auf der Karte antippen für Details')}</span>
    </div>
  {/if}
</div>


{#if filmAuf}
  <ReiseFilm {reisen} {journal} schliessen={() => (filmAuf = false)} />
{/if}

<style>
  .rk { margin-bottom: 20px; }
  .rk-kopf { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 10px; margin-bottom: 10px; }
  @media (max-width: 520px) { .rk-zahl { display: none; } }
  .rk-titel { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); margin: 0; }
  .rk-werkzeug { display: inline-flex; align-items: center; gap: 10px; }
  .rk-zahl { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .rk-btn {
    width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line);
    background: var(--card); color: var(--brand-text); font-size: calc(16px * var(--schrift, 1)); cursor: pointer;
  }

  .rk-buehne {
    position: relative; border-radius: var(--radius-m); overflow: hidden;
    border: 1px solid var(--line); box-shadow: var(--shadow);
    /* Weltraum hinter der Kugel */
    background: radial-gradient(ellipse 80% 70% at 50% 45%, #15305a 0%, #0b1a33 45%, #050b17 100%);
  }
  .rk-sterne, .rk-sterne::after {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      radial-gradient(1px 1px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 27% 72%, #dfe9ff 50%, transparent 51%),
      radial-gradient(1.4px 1.4px at 41% 9%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 58% 84%, #fff 50%, transparent 51%),
      radial-gradient(1.2px 1.2px at 73% 26%, #cfe0ff 50%, transparent 51%), radial-gradient(1px 1px at 88% 61%, #fff 50%, transparent 51%),
      radial-gradient(1px 1px at 6% 52%, #fff 50%, transparent 51%), radial-gradient(1.3px 1.3px at 94% 12%, #fff 50%, transparent 51%),
      radial-gradient(1px 1px at 35% 44%, #e7efff 50%, transparent 51%), radial-gradient(1px 1px at 66% 50%, #fff 50%, transparent 51%);
    background-size: 340px 260px; opacity: 0.75;
  }
  /* Zweite Sternenschicht, versetzt. Bewusst ohne Dauer-Funkeln: eine endlose Animation
     unter der Karte zwingt den Browser, jedes Bild neu zusammenzusetzen (Akku). */
  .rk-sterne::after { content: ''; background-size: 230px 190px; background-position: 60px 40px; opacity: 0.4; }
  .rk-map { width: 100%; height: 460px; position: relative; z-index: 1; }
  /* Licht von links oben, Schatten zum Rand: macht aus der Kugel einen Körper */
  .rk-licht {
    position: absolute; z-index: 1; pointer-events: none; border-radius: 50%; left: 0; top: 0; width: 100px; height: 100px; opacity: 0;
    transform-origin: 0 0; will-change: transform;
    background: radial-gradient(circle at 34% 28%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.05) 26%, rgba(0,0,0,0) 48%, rgba(2,12,30,0.30) 80%, rgba(2,10,26,0.52) 100%);
    transition: opacity 400ms ease-out;
  }
  .rk-spiel {
    min-height: 44px; padding: 0 14px; border-radius: 22px; border: 1px solid var(--line-stark); background: var(--card);
    color: var(--brand-text); font-size: calc(13px * var(--schrift, 1)); font-weight: 800; cursor: pointer;
  }
  .rk-spiel.an { background: var(--brand); color: #fff; border-color: var(--brand); }
  .rk-film { padding: 0 12px; }
  .rk-werkzeug { flex-wrap: wrap; justify-content: flex-end; }
  .rk-etappe {
    position: absolute; z-index: 4; left: 12px; top: 12px; display: flex; flex-direction: column; gap: 1px;
    background: rgba(255, 253, 250, 0.94); border-left: 5px solid var(--f); border-radius: 10px; padding: 8px 12px;
    box-shadow: var(--shadow-float); animation: hoch 300ms var(--ease-spring);
  }
  .rk-etappe b { font-size: calc(14.5px * var(--schrift, 1)); color: #2b2621; }
  .rk-etappe span { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: #6b6157; }
  .rk.gross .rk-map { height: 100%; }

  .rk-lade, .rk-hinweis {
    position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 24px; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 600; color: var(--muted);
    background: color-mix(in srgb, var(--card) 88%, transparent); pointer-events: none;
  }
  .rk-hinweis { line-height: 1.55; } .rk-hinweis b { color: var(--ink); }
  .rk-lade.fehler { color: var(--danger); }

  .rk-lupe {
    position: absolute; left: 10px; bottom: 10px; z-index: 3;
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 9px 14px; min-height: 44px;
    border: 1px solid var(--line); border-radius: 20px; cursor: pointer;
    background: color-mix(in srgb, var(--card) 92%, transparent); color: var(--ink);
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  }

  /* Vollbild */
  .rk.gross {
    position: fixed; inset: 0; z-index: var(--z-overlay); margin: 0;
    display: flex; flex-direction: column; gap: 10px;
    background: var(--bg); border-radius: 0;
    padding: calc(14px + env(safe-area-inset-top, 0px)) 12px calc(10px + env(safe-area-inset-bottom, 0px));
  }
  .rk.gross .rk-buehne { flex: 1; min-height: 0; }

  /* Infofenster */
  .info {
    position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 3;
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m);
    box-shadow: var(--shadow-float); padding: 10px 12px 12px;
    max-height: 64%; overflow: auto;
    animation: hoch 260ms var(--ease-spring);
  }
  @keyframes hoch { from { transform: translateY(18px); opacity: 0; } }
  .info.gross { left: auto; right: 10px; top: 10px; bottom: 10px; width: min(380px, 42%); max-height: none; }

  .i-kopf { display: flex; align-items: center; gap: 8px; border-left: 4px solid var(--f); padding-left: 8px; }
  .i-typ { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #fff; background: var(--f); border-radius: 10px; padding: 2px 8px; }
  .i-name { flex: 1; font-size: calc(14px * var(--schrift, 1)); font-weight: 800; color: var(--ink); line-height: 1.3; }
  .info:not(.gross) .i-name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .i-zu { width: 44px; height: 44px; border: none; background: none; color: var(--muted); font-size: calc(15px * var(--schrift, 1)); cursor: pointer; }

  .i-zahlen { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 9px; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .i-zahlen b { color: var(--ink); font-size: calc(14px * var(--schrift, 1)); }
  .i-warn { color: var(--danger); font-weight: 700; }

  .i-stopps { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
  .i-stopp { display: inline-flex; align-items: center; gap: 5px; font-size: calc(12px * var(--schrift, 1)); font-weight: 600; color: var(--ink); background: var(--flaeche); border: 1px solid var(--line); border-radius: 14px; padding: 3px 9px 3px 3px; }
  .i-stopp i { width: 18px; height: 18px; border-radius: 50%; background: var(--brand); color: #fff; font-style: normal; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }

  .i-foto { position: relative; margin-top: 10px; border-radius: var(--radius-s); overflow: hidden; background: var(--flaeche); }
  .i-foto img { width: 100%; height: 104px; object-fit: cover; display: block; }
  .info.gross .i-foto img { height: 180px; }
  .f-steuer {
    position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-between;
    padding: 5px 6px; background: linear-gradient(to top, rgba(0,0,0,.55), transparent);
  }
  .f-steuer button { width: 44px; height: 44px; border: none; background: rgba(255,255,255,.9); color: #2b2621; border-radius: 8px; font-size: calc(18px * var(--schrift, 1)); font-weight: 800; cursor: pointer; }
  .f-zaehler { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
  .f-bildtitel { position: absolute; top: 6px; left: 8px; max-width: calc(100% - 16px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: #fff; background: rgba(0,0,0,.45); border-radius: 8px; padding: 2px 8px; }

  .i-log { margin-top: 11px; border-top: 1px dashed var(--line); padding-top: 9px; }
  .i-log-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); margin-bottom: 5px; }
  .i-log-zeile { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); padding: 3px 0; }
  .i-log-zeile b { color: var(--ink); }
  .i-log-text { display: block; font-size: calc(12px * var(--schrift, 1)); }
  .i-nah { margin-left: 6px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--brand-2); background: var(--flaeche); border-radius: 8px; padding: 1px 6px; }
  .i-log-mehr { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-style: italic; }

  .i-link {
    margin-top: 11px; width: 100%; min-height: 44px; border: none; border-radius: var(--radius-s);
    background: var(--brand); color: #fff; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 800; cursor: pointer;
  }

  .rk-legende { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 12px; margin-top: 10px; }
  .rk-leg {
    display: inline-flex; align-items: center; gap: 7px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700;
    color: var(--ink); background: var(--card); border: 1px solid var(--line);
    border-radius: 18px; padding: 6px 12px; min-height: 36px; cursor: pointer;
  }
  .rk-leg.an { border-color: var(--brand); background: var(--btn-flaeche); }
  /* Legendenstrich wie auf der Karte: Fahrt durchgezogen, Flug gestrichelt. */
  .rk-linie { width: 18px; height: 3px; border-radius: 2px; background: var(--f); }
  .rk-linie.flug {
    border-radius: 0;
    background: repeating-linear-gradient(to right, var(--f) 0 5px, transparent 5px 8px);
  }
  .rk-tipp { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }

  @media (max-width: 520px) {
    .rk-map { height: 380px; }
    .info.gross { left: 8px; right: 8px; top: auto; bottom: 8px; width: auto; max-height: 60%; }
  }
  .exp-leiste { position: absolute; left: 10px; bottom: 10px; z-index: 5; }
  .exp-go, .exp-zu {
    font: 600 calc(12.5px * var(--schrift, 1)) -apple-system, system-ui, sans-serif; cursor: pointer;
    border-radius: 8px; padding: 7px 11px; border: 1px solid var(--line-stark);
    background: rgba(255,253,250,0.94); color: var(--btn-ink);
  }
  .exp-box {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap; max-width: 92vw;
    background: rgba(255,253,250,0.96); border: 1px solid var(--line-stark);
    border-radius: 10px; padding: 7px 9px; box-shadow: var(--shadow);
  }
  .exp-box select { font-size: calc(12px * var(--schrift, 1)); padding: 5px 6px; border-radius: 7px; border: 1px solid var(--line); background: var(--eingabe); }
  .exp-go { background: var(--brand); color: #fff; border-color: var(--brand); }
  .exp-go:disabled { opacity: .6; }
  .exp-msg { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: #1a7f37; width: 100%; }
  /* Sichtbar kraeftig, ausgeblendet blass. Die geoeffnete Route bekommt zusaetzlich einen
     Rahmen, damit „ausgewaehlt" und „sichtbar" nicht verwechselt werden. */
  /* aus: lesbar (Kontrast ≥ 3 : 1), aber gestrichelt */
  .rk-leg:not(.an) { color: var(--muted); border-style: dashed; }
  .rk-leg.offen { box-shadow: inset 0 0 0 2px var(--brand); }
  .rk-alle.an { background: var(--brand); color: #fff; }

  .rk-leg { min-height: 44px; }
  /* Größere Tippfläche ohne größere Optik (Apple: 44 pt) */
  .rk-btn, .rk-spiel { position: relative; }
  .rk-btn::after, .rk-spiel::after, .rk-lupe::after { content: ''; position: absolute; inset: -4px; border-radius: inherit; }
  @media (pointer: coarse) {
    .rk :global(.maplibregl-ctrl-group button) { width: 44px; height: 44px; }
  }
  :global(.rk-fahrzeug) { filter: drop-shadow(0 2px 4px rgba(0,0,0,.55)); pointer-events: none; }
</style>
