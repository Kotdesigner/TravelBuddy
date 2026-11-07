<script>
  // Übersichtskarte auf der echten Offline-Karte: Orte (Gesamtkarte, Gegend), Routen-Ideen, Wander-Ideen.
  // art 'ringe': jede Gegend ein Kreis mit der Anzahl ihrer Orte. Liegen Gegenden dicht beieinander,
  //   fasst ein Kreis sie mit der Summe zusammen, Antippen zoomt hinein. Ein einzelner Kreis ruft onring.
  // art 'nummern': jeder Ort mit seiner Nummer wie auf der Kachel. Liegen zwei aufeinander, steht
  //   „5·6“ im Kreis, Antippen zoomt hinein. Dazu die Routen der Reise als Linien.
  // Zoomen mit zwei Fingern oder Strg/⌘ und Mausrad, keine Zoom-Knöpfe. Heraus bis ganz Australien,
  // hinein nur so weit, wie die Karte sauber aussieht (MAX_ZOOM). Oben rechts ein kleines Australien,
  // der Rahmen darin zeigt den Ausschnitt und läuft beim Verschieben und Zoomen mit.
  // Außerhalb des Bildschirms wird die Karte abgebaut, so bleiben es auch bei vielen offenen
  // Gegenden nur wenige gleichzeitig (das iPhone erlaubt nicht beliebig viele).
  import { onMount, untrack } from 'svelte'
  import { je } from './i18n.js'
  import { AUS_RINGS } from './geo-australia.js'
  import { kartenDunkel } from './karten-thema.js'
  import { ladeKartenLib, UEBERBLICK_URL, MAX_ZOOM, MIN_ZOOM, GRENZEN, FARBEN, grundEbenen, kreisEbenen, rahmenUm } from './ueberblick-gl.js'

  let {
    art = 'nummern', ringe = [], punkte = [], linien = [], orte = [], etappen = [], gewaehlt = null, etappeGewaehlt = null,
    onring = null, onpunkt = null, onlinie = null, onort = null, onetappe = null, onleer = null, hoehe = 300, label = '',
    rahmenPunkte = null, spanne = [0, 0], fitMax = 10,
  } = $props()
  // punkte: { id, lon, lat, nr?, farbe?, farbeDunkel?, an? (false = grau), rot? (im Sommer gesperrt), ring? (in deiner Liste) }
  // linien: { id, punkte, farbe, farbeDunkel?, versatz? (px nebeneinander), an? (false = grau), offen? (kräftig), kurz? (Name an der Linie) }
  // orte:   { id, lon, lat }: Orte aus der App an einer Route, klein und orange, Häufungen mit „+3“
  // etappen: { id, lon, lat }: Etappenorte (Städte zum Tanken, Einkaufen, Übernachten), weißes Häuschen,
  //          UNTER den Sehenswürdigkeiten, damit deren Nummern immer oben liegen

  const RAND = { top: 34, bottom: 30, left: 28, right: 28 }
  const ja = (v, std = true) => (v == null ? std : !!v)

  const ringDaten = $derived({ type: 'FeatureCollection', features: ringe.map((r) => ({ type: 'Feature', properties: { titel: r.titel, n: r.n, an: r.an ? 1 : 0 }, geometry: { type: 'Point', coordinates: [r.lon, r.lat] } })) })
  const punktDaten = $derived.by(() => {
    const d = $kartenDunkel
    return { type: 'FeatureCollection', features: punkte.filter((p) => p.lat != null).map((p) => {
      const props = { id: p.id, nr: p.nr ?? 0, an: p.id === gewaehlt ? 1 : 0, aus: ja(p.an) ? 0 : 1, rot: p.rot ? 1 : 0, ring: p.ring ? 1 : 0 }
      const farbe = d ? p.farbeDunkel || p.farbe : p.farbe
      if (farbe) props.farbe = farbe
      return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }
    }) }
  })
  const linienDaten = $derived.by(() => {
    const d = $kartenDunkel
    return { type: 'FeatureCollection', features: linien.filter((l) => l.punkte?.length > 1).map((l) => ({ type: 'Feature',
      properties: { id: l.id, farbe: (d ? l.farbeDunkel || l.farbe : l.farbe) || '#7a6fd6', versatz: l.versatz || 0, an: ja(l.an) ? 1 : 0, offen: l.offen ? 1 : 0, kurz: l.kurz || '' },
      geometry: { type: 'LineString', coordinates: l.punkte } })) }
  })
  const etappenDaten = $derived({ type: 'FeatureCollection', features: etappen.filter((e) => e.lat != null).map((e) => ({ type: 'Feature', properties: { id: e.id, an: e.id === etappeGewaehlt ? 1 : 0 }, geometry: { type: 'Point', coordinates: [e.lon, e.lat] } })) })
  const orteDaten = $derived({ type: 'FeatureCollection', features: orte.filter((o) => o.lat != null).map((o) => ({ type: 'Feature', properties: { id: o.id }, geometry: { type: 'Point', coordinates: [o.lon, o.lat] } })) })
  const rahmen = $derived(rahmenUm(rahmenPunkte || (art === 'ringe' ? ringe.map((r) => [r.lon, r.lat]) : punkte.filter((p) => p.lat != null).map((p) => [p.lon, p.lat])), spanne))
  // Nur ein anderer Ausschnitt setzt die Karte zurück, nicht jede neue Liste mit denselben Orten
  const rahmenKey = $derived(rahmen ? rahmen.flat().map((v) => v.toFixed(3)).join(',') : '')

  function stil(dunkel) {
    const f = FARBEN[dunkel ? 'dunkel' : 'hell']
    const sources = { pm: { type: 'vector', url: UEBERBLICK_URL } }
    let oben
    if (art === 'ringe') {
      sources.ring = { type: 'geojson', data: ringDaten, cluster: true, clusterRadius: 30, clusterMaxZoom: 12, clusterProperties: { summe: ['+', ['get', 'n']], an: ['max', ['get', 'an']] } }
      const wert = ['coalesce', ['get', 'summe'], ['get', 'n']]
      oben = kreisEbenen(f, 'ring', { radius: ['interpolate', ['linear'], wert, 1, 11, 30, 19], text: ['to-string', wert], an: ['==', ['get', 'an'], 1] })
    } else {
      sources.linie = { type: 'geojson', data: linienDaten }
      sources.ort = { type: 'geojson', data: orteDaten, cluster: true, clusterRadius: 22, clusterMaxZoom: 9 }
      sources.etappe = { type: 'geojson', data: etappenDaten }
      const modus = dunkel ? 'dunkel' : 'hell'
      sources.nr = { type: 'geojson', data: punktDaten, cluster: true, clusterRadius: 16, clusterMaxZoom: 12,
        clusterProperties: { von: ['min', ['get', 'nr']], bis: ['max', ['get', 'nr']], an: ['max', ['get', 'an']] } }
      const haufen = ['has', 'point_count']
      // Häufung mit Nummern: „5·6“ oder „4…7“, ohne Nummern: Anzahl. Einzelner Punkt: seine Nummer oder nichts
      const text = ['case', haufen,
        ['case', ['>', ['get', 'bis'], 0], ['concat', ['to-string', ['get', 'von']], ['case', ['==', ['get', 'point_count'], 2], '·', '…'], ['to-string', ['get', 'bis']]], ['to-string', ['get', 'point_count']]],
        ['case', ['>', ['get', 'nr'], 0], ['to-string', ['get', 'nr']], '']]
      const radius = ['case', haufen, 14, ['>', ['get', 'nr'], 0], 11, ['==', ['get', 'aus'], 1], 5, 7.5]
      const rund = { 'line-join': 'round', 'line-cap': 'round' }
      const an = ['==', ['get', 'an'], 1]
      const kreise = kreisEbenen(f, 'nr', { radius, text, an: ['any', an, ['==', ['get', 'ring'], 1]] })
      // Farbe: im Sommer gesperrt rot, sonst eigene Farbe (Stopp in Routenfarbe), sonst Orange; nicht gewählte Gegend grau
      kreise[1].paint['circle-color'] = ['case', haufen, f.punkt, ['==', ['get', 'aus'], 1], f.blass, ['==', ['get', 'rot'], 1], f.rot, ['has', 'farbe'], ['get', 'farbe'], f.punkt]
      kreise[0].paint['circle-opacity'] = ['case', ['==', ['get', 'aus'], 1], 0, 0.28]
      oben = [
        { id: 'linie-rand', type: 'line', source: 'linie', layout: rund, paint: { 'line-color': f.linieRand, 'line-width': ['case', ['==', ['get', 'offen'], 1], 8.5, 6], 'line-offset': ['get', 'versatz'], 'line-opacity': ['case', ['==', ['get', 'an'], 1], 0.9, 0] } },
        { id: 'linie', type: 'line', source: 'linie', layout: { ...rund, 'line-sort-key': ['get', 'an'] },
          paint: { 'line-color': ['case', ['==', ['get', 'an'], 1], ['get', 'farbe'], f.blass], 'line-width': ['case', ['==', ['get', 'offen'], 1], 5, 3.2], 'line-offset': ['get', 'versatz'], 'line-opacity': ['case', ['==', ['get', 'an'], 1], 1, 0.5] } },
        // Breiter, unsichtbarer Streifen: eine Linie lässt sich auch mit dem Finger treffen
        { id: 'linie-treffer', type: 'line', source: 'linie', layout: rund, paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 18, 'line-offset': ['get', 'versatz'] } },
        // Name an der Linie: zweites Merkmal neben der Farbe
        { id: 'linie-name', type: 'symbol', source: 'linie', filter: ['all', ['==', ['get', 'an'], 1], ['!=', ['get', 'kurz'], '']],
          layout: { 'symbol-placement': 'line', 'symbol-spacing': 260, 'text-field': ['get', 'kurz'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, -1.1] },
          paint: { 'text-color': ['get', 'farbe'], 'text-halo-color': f.linieRand, 'text-halo-width': 2 } },
        // Etappenorte: weißes Häuschen, unter allen Punkten; der Name steht klein auf der Grundkarte
        { id: 'etappe', type: 'symbol', source: 'etappe',
          layout: { 'icon-image': ['case', ['==', ['get', 'an'], 1], 'haus-an-' + modus, 'haus-' + modus], 'icon-allow-overlap': true, 'icon-ignore-placement': true } },
        // Orte an der Route: kleiner als Stopps, Häufungen mit „+3“
        { id: 'ort-schatten', type: 'circle', source: 'ort', paint: { 'circle-radius': ['case', haufen, 12, 8], 'circle-color': '#000', 'circle-opacity': 0.25, 'circle-blur': 0.7, 'circle-translate': [0, 1.5] } },
        { id: 'ort-kreis', type: 'circle', source: 'ort', paint: { 'circle-radius': ['case', haufen, 9, 5.5], 'circle-color': f.punkt, 'circle-stroke-color': f.saum, 'circle-stroke-width': 2 } },
        { id: 'ort-zahl', type: 'symbol', source: 'ort', filter: haufen,
          layout: { 'text-field': ['concat', '+', ['to-string', ['get', 'point_count']]], 'text-font': ['Noto Sans Regular'], 'text-size': 9.5, 'text-allow-overlap': true }, paint: { 'text-color': f.zahl } },
        ...kreise,
      ]
    }
    return { version: 8, glyphs: location.origin + '/fonts/{fontstack}/{range}.pbf', sources, layers: [...grundEbenen(f), ...oben] }
  }

  let box = $state()
  let map = null
  let sichtbar = false
  let kamera = null          // wohin der Nutzer gezoomt hatte, falls die Karte neu gebaut wird
  let bewegt = $state(false)
  // Was ein Tipp trifft, in dieser Reihenfolge
  const EBENEN = art === 'ringe' ? ['ring-kreis'] : ['nr-kreis', 'ort-kreis', 'etappe', 'linie-treffer']

  // Häuschen der Etappenorte als Bild für die Karte (hell, dunkel, gewählt mit orangem Rand)
  function hausBild(id) {
    const an = id.includes('-an-'), dunkel = id.endsWith('dunkel'), f = FARBEN[dunkel ? 'dunkel' : 'hell']
    const r = 2, g = 22 * r, c = document.createElement('canvas'); c.width = c.height = g + 8
    const x = c.getContext('2d')
    x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 3 * r; x.shadowOffsetY = r
    x.fillStyle = dunkel ? '#2a231c' : '#ffffff'
    x.strokeStyle = an ? f.punkt : dunkel ? '#e8dcc7' : '#3a2f25'; x.lineWidth = (an ? 3 : 2) * r
    const k = 4, w = g - 4
    x.beginPath(); x.roundRect(k, k - 1, w, w, 6 * r); x.fill(); x.shadowColor = 'transparent'; x.stroke()
    x.strokeStyle = dunkel ? '#f3eadb' : '#3a2f25'; x.lineWidth = 2.4 * r; x.lineCap = 'round'; x.lineJoin = 'round'
    const m = (v) => k + (v / 24) * w
    x.beginPath(); x.moveTo(m(6), m(12)); x.lineTo(m(12), m(7)); x.lineTo(m(18), m(12)); x.moveTo(m(8), m(11)); x.lineTo(m(8), m(17.5)); x.lineTo(m(16), m(17.5)); x.lineTo(m(16), m(11)); x.stroke()
    return { bild: x.getImageData(0, 0, c.width, c.height), pixelRatio: r }
  }
  const treffbar = () => EBENEN.filter((id) => map?.getLayer(id))

  async function baue() {
    if (map || !box) return
    let lib
    try { lib = await ladeKartenLib() } catch { return }
    if (map || !sichtbar || !box) return
    map = new lib.maplibregl.Map({
      container: box, style: stil($kartenDunkel),
      bounds: rahmen || undefined, fitBoundsOptions: { padding: RAND, maxZoom: fitMax },
      minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, maxBounds: GRENZEN, renderWorldCopies: false,
      cooperativeGestures: true, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': je('Zum Zoomen Strg gedrückt halten und scrollen', 'Hold Ctrl and scroll to zoom'),
        'CooperativeGesturesHandler.MacHelpText': je('Zum Zoomen ⌘ gedrückt halten und scrollen', 'Hold ⌘ and scroll to zoom'),
        'CooperativeGesturesHandler.MobileHelpText': je('Mit zwei Fingern verschieben und zoomen', 'Use two fingers to move and zoom'),
      },
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    if (kamera) map.jumpTo(kamera)
    map.getCanvas().setAttribute('aria-label', label)
    map.on('click', klick)
    map.on('styleimagemissing', (e) => { if (map && e.id.startsWith('haus-') && !map.hasImage(e.id)) { const b = hausBild(e.id); map.addImage(e.id, b.bild, { pixelRatio: b.pixelRatio }) } })
    map.on('mousemove', (e) => {
      const da = map.queryRenderedFeatures(e.point, { layers: treffbar() }).length
      map.getCanvas().style.cursor = da ? 'pointer' : ''
    })
    map.on('movestart', (e) => { if (e.originalEvent) bewegt = true })
    map.on('move', lageNeu)
    lageNeu()
  }

  function abbau() {
    if (!map) return
    kamera = bewegt ? { center: map.getCenter(), zoom: map.getZoom() } : null
    map.remove()
    map = null
  }

  // Ein Tipp: das oberste Getroffene zählt (Stopp vor Ort vor Linie), nichts getroffen ruft onleer
  async function klick(e) {
    if (!map) return
    const { x, y } = e.point
    const f = map.queryRenderedFeatures([[x - 4, y - 4], [x + 4, y + 4]], { layers: treffbar() })
      .sort((a, b) => EBENEN.indexOf(a.layer.id) - EBENEN.indexOf(b.layer.id))[0]
    if (!f) { onleer?.(); return }
    if (f.layer.id === 'linie-treffer') { onlinie?.(f.properties.id); return }
    if (f.layer.id === 'etappe') { onetappe?.(f.properties.id); return }
    const quelle = f.layer.id === 'ort-kreis' ? 'ort' : art === 'ringe' ? 'ring' : 'nr'
    if (f.properties.cluster) {
      const src = map.getSource(quelle)
      const z = await src.getClusterExpansionZoom(f.properties.cluster_id)
      if (z <= MAX_ZOOM) {
        map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(MAX_ZOOM, z + 0.3), duration: 450 })
        bewegt = true
        return
      }
      // Liegen sie selbst ganz nah noch aufeinander: bei jedem Tippen der nächste
      waehle(quelle, (await src.getClusterLeaves(f.properties.cluster_id, 50, 0)).map((x) => x.properties))
      return
    }
    waehle(quelle, [f.properties])
  }
  function waehle(quelle, liste) {
    if (!liste.length) return
    if (quelle === 'ring') { onring?.(liste[0].titel); return }
    if (quelle === 'ort') { onort?.(liste[0].id); return }
    liste.sort((a, b) => a.nr - b.nr)
    const i = liste.findIndex((p) => p.id === gewaehlt)
    onpunkt?.(liste[(i + 1) % liste.length].id)
  }

  function zurueck() {
    if (map && rahmen) map.fitBounds(rahmen, { padding: RAND, maxZoom: fitMax, duration: 450 })
    bewegt = false
  }

  // Lageskizze: kleines Australien, der Rahmen zeigt den Ausschnitt
  const IB = 64, IH = 54
  const iproj = (() => {
    const w = 112, e = 154.5, n = -9.5, s = -44, kx = Math.cos((-27 * Math.PI) / 180)
    const f = Math.min(IB / ((e - w) * kx), IH / (n - s)), ox = (IB - (e - w) * kx * f) / 2, oy = (IH - (n - s) * f) / 2
    return ([lon, lat]) => [ox + (lon - w) * kx * f, oy + (n - lat) * f]
  })()
  const iland = AUS_RINGS.map((r) => r.map((p, i) => { const [x, y] = iproj(p); return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) }).join(' ') + ' Z')
  let lage = $state(null)
  let raf = 0
  function lageNeu() {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      if (!map) return
      const b = map.getBounds(), w = b.getWest(), e = b.getEast(), n = b.getNorth(), s = b.getSouth()
      // Ist fast ganz Australien zu sehen, braucht es die Skizze nicht
      if (e - w > 36) { lage = null; return }
      const [x0, y0] = iproj([w, n]), [x1, y1] = iproj([e, s])
      const bb = Math.max(3, x1 - x0), hh = Math.max(3, y1 - y0)
      lage = { x: x0 + (x1 - x0 - bb) / 2, y: y0 + (y1 - y0 - hh) / 2, b: bb, h: hh }
    })
  }

  // Neue Daten in die laufende Karte, ohne sie neu zu bauen
  $effect(() => { const d = ringDaten; untrack(() => map?.getSource('ring')?.setData(d)) })
  $effect(() => { const d = punktDaten; untrack(() => map?.getSource('nr')?.setData(d)) })
  $effect(() => { const d = linienDaten; untrack(() => map?.getSource('linie')?.setData(d)) })
  $effect(() => { const d = orteDaten; untrack(() => map?.getSource('ort')?.setData(d)) })
  $effect(() => { const d = etappenDaten; untrack(() => map?.getSource('etappe')?.setData(d)) })
  // Kartendesign hell oder dunkel gewechselt: neuer Stil, die Daten stecken darin
  $effect(() => { const d = $kartenDunkel; untrack(() => map?.setStyle(stil(d))) })
  // Anderer Ausschnitt (andere Orte): Karte darauf einstellen
  $effect(() => {
    rahmenKey
    untrack(() => { kamera = null; if (map && rahmen) { map.fitBounds(rahmen, { padding: RAND, maxZoom: fitMax, duration: 450 }); bewegt = false } })
  })

  onMount(() => {
    const io = new IntersectionObserver((es) => {
      sichtbar = es.some((x) => x.isIntersecting)
      if (sichtbar) baue()
      else abbau()
    }, { rootMargin: '600px 0px' })
    io.observe(box)
    return () => { io.disconnect(); cancelAnimationFrame(raf); abbau() }
  })
</script>

<div class="ug" style="height: {hoehe}px" role="region" aria-label={label}>
  <div class="ug-karte" bind:this={box}></div>
  {#if lage}
    <svg class="ug-lage" width={IB} height={IH} viewBox="0 0 {IB} {IH}" aria-hidden="true">
      <rect width={IB} height={IH} rx="6" class="ug-lage-grund" />
      {#each iland as d}<path {d} class="ug-lage-land" />{/each}
      <rect x={lage.x} y={lage.y} width={lage.b} height={lage.h} class="ug-lage-rahmen" />
    </svg>
  {/if}
  <span class="ug-osm">© OpenStreetMap</span>
  {#if bewegt}
    <button class="ug-zurueck" onclick={zurueck}>⤢ {art === 'ringe' ? je('Alles zeigen', 'Show all') : je('Ganze Gegend', 'Whole area')}</button>
  {/if}
</div>

<style>
  .ug { position: relative; width: 100%; border-radius: 12px; overflow: hidden; background: var(--karte-meer); border: 1px solid var(--line); }
  .ug-karte { position: absolute; inset: 0; }
  .ug-lage { position: absolute; right: 8px; top: 8px; pointer-events: none; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25)); }
  .ug-lage-grund { fill: var(--karte-meer); stroke: var(--karte-kueste); stroke-opacity: 0.6; }
  .ug-lage-land { fill: var(--karte-land); stroke: var(--karte-kueste); stroke-width: 0.7; }
  .ug-lage-rahmen { fill: var(--karte-punkt); fill-opacity: 0.18; stroke: var(--karte-punkt); stroke-width: 1.5; }
  .ug-osm { position: absolute; left: 8px; bottom: 5px; font-size: calc(9.5px * var(--schrift, 1)); color: var(--karte-blass); pointer-events: none; }
  .ug-zurueck { position: absolute; right: 8px; bottom: 8px; min-height: 36px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--line-stark); background: var(--card); color: var(--btn-ink); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; box-shadow: var(--shadow); cursor: pointer; }
</style>
