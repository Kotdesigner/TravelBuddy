<script>
  // Kleine Übersichtskarte ohne Netz: echte Küstenlinie, Linien (Routen) und Punkte (Orte).
  // Der Ausschnitt passt sich an die hervorgehobenen Punkte und Linien an.
  // Küste: zuerst die grobe (sofort da), dann die genaue aus der Offline-Karte (kueste-fein.js, wird nachgeladen).
  // Liegen hervorgehobene Punkte im ganzen Ausschnitt aufeinander (eng), zoomt die Karte auf sie heran.
  // punkte: [{ id, lat, lon, an, rot, ring, nr }]  nr: Nummer im Punkt, passend zur Nummer auf der Kachel   linien: [{ id, farbe, punkte: [[lon, lat]], an, gestrichelt, versatz }]
  // versatz: Pixel quer zur Fahrtrichtung. Routen auf derselben Straße liegen so nebeneinander statt übereinander.
  import { onMount } from 'svelte'
  import { je } from './i18n.js'
  import { AUS_RINGS } from './geo-australia.js'

  // Einmal geladen, für alle Karten der App
  let fein = $state(null)
  let feinLaden = null
  onMount(() => {
    feinLaden ??= import('./kueste-fein.js')
    feinLaden.then((m) => { fein = m.LAND_FEIN }).catch(() => {})
  })

  let { punkte = [], linien = [], gewaehlt = null, onpunkt = null, onlinie = null, label = '', breite = 320, hoehe = 300, rahmen = 'alles', zoomBeiEnge = false } = $props()
  // rahmen: 'alles' = Ausschnitt aus Punkten und Linien, 'punkte' = nur aus den hervorgehobenen Punkten,
  // 'alle-punkte' = immer aus allen Punkten, der Ausschnitt bleibt beim Wählen einer Gegend stehen,
  // 'alle' = immer aus allen Punkten und Linien, auch den grauen

  function rahmenAus(pts) {
    if (!pts.length) return { w: 112, e: 130, n: -13, s: -36 }
    let w = 180, e = -180, s = 0, n = -90
    for (const [lon, lat] of pts) { w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat) }
    let sLon = Math.max(e - w, MIN), sLat = Math.max(n - s, MIN)
    const mLon = (w + e) / 2, mLat = (s + n) / 2
    const kx = Math.cos((mLat * Math.PI) / 180)
    if ((sLon * kx) / sLat < breite / hoehe) sLon = (sLat * (breite / hoehe)) / kx
    else sLat = (sLon * kx) / (breite / hoehe)
    sLon *= 1.22; sLat *= 1.22
    return { w: mLon - sLon / 2, e: mLon + sLon / 2, n: mLat + sLat / 2, s: mLat - sLat / 2 }
  }
  // Mindestausdehnung in Grad. Mit der genauen Küste darf es näher heran.
  const MIN_GROB = 2.2, MIN_FEIN = 0.3
  const MIN = $derived(fein ? MIN_FEIN : MIN_GROB)
  // Eng = mindestens zwei hervorgehobene Punkte haben einen Nachbarn näher als 12 Pixel
  function eng(pts, r) {
    const p = pts.map(([lon, lat]) => [((lon - r.w) / (r.e - r.w)) * breite, ((r.n - lat) / (r.n - r.s)) * hoehe])
    let n = 0
    for (let i = 0; i < p.length; i++) for (let j = 0; j < p.length; j++) if (i !== j && Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]) < 12) { n++; break }
    return n >= 2
  }
  // Tipp auf eine Häufung zoomt die Karte auf sie (nur in dieser Karte). „Ganze Karte“ setzt zurück,
  // ebenso jede neue Auswahl darüber (andere Gegend).
  let lokal = $state(null)
  // Selbst gezoomt oder verschoben (Knöpfe, zwei Finger, Ziehen, Strg und Mausrad): fester Ausschnitt
  let manuell = $state(null)
  const anSchluessel = $derived(punkte.filter((p) => p.an !== false).map((p) => p.id).join())
  $effect(() => { anSchluessel; lokal = null; manuell = null })
  const ausschnitt = $derived.by(() => {
    if (manuell) return manuell
    if (lokal) return rahmenAus(lokal)
    const voll = grundRahmen
    if (!zoomBeiEnge) return voll
    const an = punkte.filter((p) => p.an !== false).map((p) => [p.lon, p.lat])
    if (an.length < 2 || an.length === punkte.length || !eng(an, voll)) return voll
    return rahmenAus(an)
  })
  const grundRahmen = $derived.by(() => {
    const mitLinien = rahmen !== 'punkte' && rahmen !== 'alle-punkte'
    const fest = rahmen === 'alle-punkte' || rahmen === 'alle'
    const an = [...punkte.filter((p) => fest || p.an !== false).map((p) => [p.lon, p.lat]), ...(mitLinien ? linien.filter((l) => fest || l.an !== false).flatMap((l) => l.punkte) : [])]
    const pts = an.length ? an : [...punkte.map((p) => [p.lon, p.lat]), ...(mitLinien ? linien.flatMap((l) => l.punkte) : [])]
    return rahmenAus(pts)
  })
  // ---------- Selbst zoomen und verschieben ----------
  // Während der Geste wird nur der Inhalt per transform bewegt (flüssig), erst am Ende neu gezeichnet.
  let svgEl = $state(null)
  let geste = $state(null) // { tx, ty, k }
  const zeiger = new Map()
  let start = null, gezogen = false
  const vergroessert = $derived(!!(manuell || lokal))
  const spanMin = () => MIN * 0.8
  function zuEinheiten(e) {
    const r = svgEl.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * breite, ((e.clientY - r.top) / r.height) * hoehe]
  }
  // Neuer Ausschnitt aus Verschiebung (tx, ty) und Faktor k um den Ursprung
  function neuerAusschnitt(tx, ty, k) {
    const a = ausschnitt, lonPx = (a.e - a.w) / breite, latPx = (a.n - a.s) / hoehe
    const x0 = -tx / k, x1 = (breite - tx) / k, y0 = -ty / k, y1 = (hoehe - ty) / k
    let n = { w: a.w + x0 * lonPx, e: a.w + x1 * lonPx, n: a.n - y0 * latPx, s: a.n - y1 * latPx }
    // nicht näher als die Mindestausdehnung, nicht weiter weg als die Grundansicht
    const g = grundRahmen, spanG = g.e - g.w, span = n.e - n.w
    if (span >= spanG * 0.98) return null
    if (span < spanMin()) {
      const f = spanMin() / span, mx = (n.w + n.e) / 2, my = (n.n + n.s) / 2
      n = { w: mx - (n.e - n.w) * f / 2, e: mx + (n.e - n.w) * f / 2, n: my + (n.n - n.s) * f / 2, s: my - (n.n - n.s) * f / 2 }
    }
    return n
  }
  function zoomUm(f, cx = breite / 2, cy = hoehe / 2) {
    // f > 1 = näher heran. Verschiebung so, dass der Punkt (cx, cy) stehen bleibt
    manuell = neuerAusschnitt(cx - cx * f, cy - cy * f, f)
    if (!manuell) lokal = null
  }
  function runter(e) {
    if (!svgEl) return
    zeiger.set(e.pointerId, zuEinheiten(e))
    gezogen = false
    if (zeiger.size === 1 && !vergroessert && e.pointerType === 'touch') { start = null; return } // ein Finger ungezoomt: Seite scrollen
    const p = [...zeiger.values()]
    start = { p, tx: 0, ty: 0, k: 1 }
    geste = { tx: 0, ty: 0, k: 1 }
  }
  function bewege(e) {
    if (!start || !zeiger.has(e.pointerId)) return
    zeiger.set(e.pointerId, zuEinheiten(e))
    const p = [...zeiger.values()]
    if (p.length >= 2 && start.p.length >= 2) {
      const [a0, b0] = start.p, [a, b] = p
      const d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1, d = Math.hypot(b[0] - a[0], b[1] - a[1])
      const k = d / d0, m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      geste = { k, tx: m[0] - m0[0] * k, ty: m[1] - m0[1] * k }
      gezogen = true
    } else if (p.length === 1 && start.p.length === 1) {
      const dx = p[0][0] - start.p[0][0], dy = p[0][1] - start.p[0][1]
      if (!gezogen && Math.hypot(dx, dy) > 4) { gezogen = true; try { svgEl.setPointerCapture(e.pointerId) } catch {} }
      if (gezogen) geste = { k: 1, tx: dx, ty: dy }
    } else {
      start = { p, tx: 0, ty: 0, k: 1 }
    }
  }
  function hoch(e) {
    zeiger.delete(e.pointerId)
    if (!start) return
    if (zeiger.size === 0) {
      if (gezogen && geste) { const n = neuerAusschnitt(geste.tx, geste.ty, geste.k); manuell = n; if (!n) lokal = null }
      start = null; geste = null
    } else start = { p: [...zeiger.values()], tx: 0, ty: 0, k: 1 }
  }
  // Mausrad nur mit Strg oder Cmd (und Trackpad-Zwicken), sonst scrollt die Seite wie gewohnt
  function rad(e) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const [cx, cy] = zuEinheiten(e)
    zoomUm(Math.exp(-e.deltaY * 0.01), cx, cy)
  }
  // Nach dem Ziehen löst das Loslassen keinen Tipp auf Punkt oder Blase aus
  function klickFangen(e) { if (gezogen) { e.stopPropagation(); e.preventDefault(); gezogen = false } }
  function ganz() { manuell = null; lokal = null }

  const xy = (lon, lat) => [((lon - ausschnitt.w) / (ausschnitt.e - ausschnitt.w)) * breite, ((ausschnitt.n - lat) / (ausschnitt.n - ausschnitt.s)) * hoehe]
  const raus = ([x, y]) => x < -80 || x > breite + 80 || y < -80 || y > hoehe + 80
  // Linie quer zur Richtung verschieben: je Ecke die gemittelte Normale der beiden Nachbarstücke
  function versetze(d, off) {
    if (!off || d.length < 2) return d
    const n = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l] }
    return d.map((p, i) => {
      const n1 = i > 0 ? n(d[i - 1], p) : n(p, d[i + 1])
      const n2 = i < d.length - 1 ? n(p, d[i + 1]) : n1
      let nx = n1[0] + n2[0], ny = n1[1] + n2[1]
      const l = Math.hypot(nx, ny)
      if (l < 0.2) { nx = n1[0]; ny = n1[1] } else { nx /= l; ny /= l }
      // Spitze Ecken nicht ins Unendliche ziehen
      const k = Math.min(2, 1 / Math.max(0.5, nx * n1[0] + ny * n1[1]))
      return [p[0] + nx * off * k, p[1] + ny * off * k]
    })
  }
  const pfad = (d) => d.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)).join(' ')
  // Punkte, die fast aufeinanderliegen, ein Stück auseinanderschieben (hervorgehobene zuerst).
  // Ein feiner Strich führt dann von der echten Lage zum Punkt. Höchstens 16 Pixel Versatz.
  const mitNummern = $derived(punkte.some((p) => p.nr != null))
  const ABST = $derived(mitNummern ? 20 : 12), WEIT = $derived(mitNummern ? 22 : 16)
  // Häufungen: ab HAUFEN hervorgehobenen Punkten, die enger als HR Pixel um einen ersten liegen, eine Blase mit Zahl
  const HAUFEN = 4
  const HR = $derived(mitNummern ? 12 : 16)
  const haufen = $derived.by(() => {
    const q = punkte.filter((p) => p.an !== false).map((p) => { const [x, y] = xy(p.lon, p.lat); return { p, x, y } }).filter((a) => !raus([a.x, a.y]))
    const frei = new Set(q.map((_, i) => i)), aus = []
    for (let i = 0; i < q.length; i++) {
      if (!frei.has(i)) continue
      const mit = [...frei].filter((j) => Math.hypot(q[j].x - q[i].x, q[j].y - q[i].y) < HR)
      if (mit.length < HAUFEN) continue
      mit.forEach((j) => frei.delete(j))
      const glieder = mit.map((j) => q[j])
      aus.push({ id: 'haufen-' + glieder[0].p.id, n: glieder.length, ids: glieder.map((g) => g.p.id),
        x: glieder.reduce((s, g) => s + g.x, 0) / glieder.length, y: glieder.reduce((s, g) => s + g.y, 0) / glieder.length,
        pts: glieder.map((g) => [g.p.lon, g.p.lat]) })
    }
    // Blasen, die sich berühren, zu einer zusammenlegen
    for (let mehr = true; mehr;) {
      mehr = false
      for (let i = 0; i < aus.length && !mehr; i++) for (let j = i + 1; j < aus.length && !mehr; j++) {
        const a = aus[i], b = aus[j]
        if (Math.hypot(a.x - b.x, a.y - b.y) >= 30) continue
        const n = a.n + b.n
        aus[i] = { id: a.id, n, ids: [...a.ids, ...b.ids], pts: [...a.pts, ...b.pts], x: (a.x * a.n + b.x * b.n) / n, y: (a.y * a.n + b.y * b.n) / n }
        aus.splice(j, 1)
        mehr = true
      }
    }
    return aus
  })
  const imHaufen = $derived(new Set(haufen.flatMap((h) => h.ids)))
  const lagen = $derived.by(() => {
    const q = punkte.filter((p) => !imHaufen.has(p.id)).map((p, i) => { const [x, y] = xy(p.lon, p.lat); return { id: p.id, x0: x, y0: y, x, y, an: p.an !== false, i } })
    const nah = q.filter((a) => !raus([a.x0, a.y0]))
    for (let runde = 0; runde < 40; runde++) {
      let bewegt = false
      for (let i = 0; i < nah.length; i++) for (let j = i + 1; j < nah.length; j++) {
        const a = nah[i], b = nah[j]
        if (!a.an && !b.an) continue
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy)
        if (d >= ABST) continue
        if (d < 0.01) { const w = (j * 2.4) % (Math.PI * 2); dx = Math.cos(w); dy = Math.sin(w); d = 1 }
        const schub = (ABST - d) / 2, ux = dx / d, uy = dy / d
        // Graue Punkte weichen den hervorgehobenen ganz aus
        const fa = a.an && b.an ? 1 : a.an ? 0 : 2, fb = a.an && b.an ? 1 : b.an ? 0 : 2
        a.x -= ux * schub * fa; a.y -= uy * schub * fa; b.x += ux * schub * fb; b.y += uy * schub * fb
        bewegt = true
      }
      for (const a of nah) {
        const vx = a.x - a.x0, vy = a.y - a.y0, v = Math.hypot(vx, vy)
        if (v > WEIT) { a.x = a.x0 + (vx / v) * WEIT; a.y = a.y0 + (vy / v) * WEIT }
      }
      if (!bewegt) break
    }
    return Object.fromEntries(q.map((a) => [a.id, a]))
  })

  // Grobe Ringe außerhalb des Ausschnitts gleich weglassen (Rahmen je Ring vorab)
  const box = (r) => r.reduce((b, [lon, lat]) => [Math.min(b[0], lon), Math.min(b[1], lat), Math.max(b[2], lon), Math.max(b[3], lat)], [180, 90, -180, -90])
  const feinBoxen = $derived(fein ? fein.map((r) => [r, box(r)]) : null)
  const land = $derived.by(() => {
    const a = ausschnitt, mx = (a.e - a.w) * 0.3, my = (a.n - a.s) * 0.3
    const ringe = feinBoxen ? feinBoxen.filter(([, b]) => b[2] >= a.w - mx && b[0] <= a.e + mx && b[3] >= a.s - my && b[1] <= a.n + my).map(([r]) => r) : AUS_RINGS
    return ringe.map((r) => r.map(([lon, lat]) => xy(lon, lat))).filter((d) => !d.every(raus)).map((d) => pfad(d) + ' Z')
  })
  const striche = $derived(linien.map((l) => {
    const schritt = Math.max(1, Math.ceil(l.punkte.length / 250))
    const d = l.punkte.filter((_, i) => i % schritt === 0 || i === l.punkte.length - 1).map(([lon, lat]) => xy(lon, lat))
    return { ...l, d: d.length > 1 ? pfad(versetze(d, l.versatz || 0)) : '' }
  }).filter((l) => l.d))
</script>

<div class="uk-rahmen">
<svg class="uk" class:zoomt={vergroessert} viewBox="0 0 {breite} {hoehe}" role="img" aria-label={label} bind:this={svgEl}
  onpointerdown={runter} onpointermove={bewege} onpointerup={hoch} onpointercancel={hoch} onwheel={rad} onclickcapture={klickFangen}>
  <rect width={breite} height={hoehe} class="uk-meer" />
  <g transform={geste ? `translate(${geste.tx} ${geste.ty}) scale(${geste.k})` : null}>
  <!-- Küste in zwei Lagen: unten Fläche mit kräftigem Rand, oben Fläche mit Rand in Landfarbe.
       So bleibt die Küstenlinie sichtbar, die Nähte zwischen den Kachelstücken verschwinden. -->
  {#each land as d}<path {d} class="uk-land-rand" />{/each}
  {#each land as d}<path {d} class="uk-land" class:fein={!!fein} />{/each}
  {#each striche as l (l.id)}
    {#if onlinie}<path d={l.d} class="uk-linie-treffer" role="button" tabindex="-1" aria-label={l.label || ''} onclick={() => onlinie(l.id)} onkeydown={(e) => e.key === 'Enter' && onlinie(l.id)} />{/if}
    <path d={l.d} fill="none" stroke={l.an === false ? 'var(--aus-ink)' : l.farbe} stroke-width={gewaehlt === l.id ? 4.5 : l.an === false ? 1.5 : 2.8} stroke-dasharray={l.gestrichelt ? '5 4' : null} stroke-linejoin="round" stroke-linecap="round" opacity={l.an === false ? 0.45 : 0.9} pointer-events="none" />
  {/each}
  {#each punkte as p (p.id)}
    {@const l = lagen[p.id]}
    {#if l && Math.hypot(l.x - l.x0, l.y - l.y0) > 2 && !raus([l.x0, l.y0])}<line x1={l.x0} y1={l.y0} x2={l.x} y2={l.y} class="uk-strich" />{/if}
  {/each}
  {#each punkte as p (p.id)}
    {@const l = lagen[p.id]}
    {@const x = l?.x ?? 0}
    {@const y = l?.y ?? 0}
    {#if l && !raus([l.x0, l.y0])}
      <g class="uk-punkt" class:aus={p.an === false} class:rot={p.rot} class:gewaehlt={gewaehlt === p.id}
        role="button" tabindex="-1" aria-label={p.label || ''} onclick={() => onpunkt?.(p.id)} onkeydown={(e) => e.key === 'Enter' && onpunkt?.(p.id)}>
        <circle cx={x} cy={y} r="14" class="uk-treffer" />
        {#if p.nr != null}
          <circle cx={x} cy={y} r={gewaehlt === p.id ? 11.5 : 9.5} class="uk-kreis uk-nr-kreis" class:ring={p.ring} />
          <text {x} {y} class="uk-nr" text-anchor="middle" dominant-baseline="central">{p.nr}</text>
        {:else}
          <circle cx={x} cy={y} r={gewaehlt === p.id ? 8 : p.an === false ? 3.5 : 5.5} class="uk-kreis" class:ring={p.ring} />
        {/if}
      </g>
    {/if}
  {/each}
  {#each haufen as h (h.id)}
    <g class="uk-haufen" role="button" tabindex="-1" aria-label={je(`${h.n} Punkte, heranzoomen`, `${h.n} points, zoom in`)} onclick={() => (lokal = h.pts)} onkeydown={(e) => e.key === 'Enter' && (lokal = h.pts)}>
      <circle cx={h.x} cy={h.y} r={h.n > 9 ? 14 : 12} class="uk-haufen-kreis" />
      <text x={h.x} y={h.y} class="uk-haufen-zahl" text-anchor="middle" dominant-baseline="central">{h.n}</text>
    </g>
  {/each}
  </g>
</svg>
<div class="uk-zoom">
  <button onclick={() => zoomUm(1.7)} aria-label={je('Näher heran', 'Zoom in')}>+</button>
  <button onclick={() => zoomUm(1 / 1.7)} disabled={!vergroessert} aria-label={je('Weiter weg', 'Zoom out')}>−</button>
</div>
{#if vergroessert}<button class="uk-zurueck" onclick={ganz}>⤢ {je('Ganze Karte', 'Whole map')}</button>{/if}
</div>

<style>
  .uk-rahmen { position: relative; max-width: 560px; margin: 0 auto; }
  .uk-zoom { position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-stark); background: var(--card); box-shadow: var(--shadow); }
  .uk-zoom button { width: 40px; height: 40px; border: none; background: var(--card); color: var(--ink); font-size: calc(20px * var(--schrift, 1)); font-weight: 700; cursor: pointer; line-height: 1; }
  .uk-zoom button + button { border-top: 1px solid var(--line); }
  .uk-zoom button:disabled { color: var(--aus-ink); cursor: default; }
  .uk { touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  .uk.zoomt { touch-action: none; cursor: grab; }
  .uk-zurueck { position: absolute; right: 8px; bottom: 8px; min-height: 40px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); font-weight: 700; font-size: calc(12.5px * var(--schrift, 1)); cursor: pointer; box-shadow: var(--shadow); }
  .uk-haufen { cursor: pointer; }
  .uk-haufen-kreis { fill: var(--karte-punkt); stroke: var(--karte-saum); stroke-width: 2.5; }
  .uk-haufen-zahl { fill: var(--karte-zahl); font-weight: 800; font-size: calc(11px * var(--schrift, 1)); pointer-events: none; }
  .uk { display: block; width: 100%; max-width: 560px; margin: 0 auto; height: auto; border-radius: 10px; border: 1px solid var(--line); }
  .uk-meer { fill: var(--karte-meer); }
  .uk-land-rand { fill: var(--karte-land); stroke: var(--karte-kueste); stroke-width: 2.4; stroke-linejoin: round; }
  .uk-land { fill: var(--karte-land); stroke: var(--karte-land); stroke-width: 0.8; stroke-linejoin: round; }
  /* Genaue Küste besteht aus Kachelstücken: Rand in Landfarbe, damit keine Nähte zu sehen sind */
  .uk-linie-treffer { fill: none; stroke: transparent; stroke-width: 16; cursor: pointer; }
  .uk-punkt { cursor: pointer; }
  .uk-treffer { fill: transparent; }
  .uk-kreis { fill: var(--karte-punkt); stroke: var(--karte-saum); stroke-width: 2; }
  .uk-punkt.rot .uk-kreis { fill: #c0392b; }
  .uk-punkt.aus .uk-kreis { fill: var(--karte-blass); stroke-width: 1; opacity: 0.7; }
  .uk-nr { fill: var(--karte-zahl); font-weight: 800; font-size: calc(10.5px * var(--schrift, 1)); pointer-events: none; }
  .uk-punkt.gewaehlt .uk-nr-kreis { stroke: var(--ink); stroke-width: 3; }
  .uk-strich { stroke: var(--karte-strich); stroke-width: 1; opacity: 0.8; }
  .uk-kreis.ring { stroke: var(--ink); stroke-width: 2.5; }
  .uk-punkt.gewaehlt .uk-kreis { stroke: var(--ink); stroke-width: 3; }
</style>
