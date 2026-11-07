<script>
  // Oben auf Süden, Norden und Ostküste: eine ruhige Gesamtkarte im Stil der Lageskizze.
  // Jede Gegend ist ein Ring mit der Anzahl ihrer Orte, offene Gegenden sind kräftig gefüllt.
  // Ringe, die sich überdecken würden, rücken auseinander, ein feiner Strich zeigt die echte Lage.
  // Oben rechts ein kleines Australien mit dem gezeigten Ausschnitt. Ring antippen öffnet die Gegend.
  import { t, je } from './i18n.js'
  import { AUS_RINGS } from './geo-australia.js'

  let { regionen = [], offen = {}, onwahl = null } = $props()

  const B = 340, H = 250
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
  const mitte = (r) => { const o = r.orte.filter((x) => x.lat != null); return o.length ? [median(o.map((x) => x.lon)), median(o.map((x) => x.lat))] : null }

  const rahmen = $derived.by(() => {
    const pts = regionen.flatMap((r) => r.orte.filter((o) => o.lat != null).map((o) => [o.lon, o.lat]))
    if (!pts.length) return null
    let w = 180, e = -180, s = 0, n = -90
    for (const [lon, lat] of pts) { w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat) }
    const pad = Math.max(0.6, (e - w) * 0.08, (n - s) * 0.08)
    return { w: w - pad, e: e + pad, n: n + pad, s: s - pad }
  })
  // Gleichmäßiger Maßstab (Längengrade schrumpfen mit der Breite), Ausschnitt mittig
  const proj = $derived.by(() => {
    const r = rahmen
    if (!r) return null
    const kx = Math.cos((((r.n + r.s) / 2) * Math.PI) / 180)
    const f = Math.min(B / ((r.e - r.w) * kx), H / (r.n - r.s))
    const ox = (B - (r.e - r.w) * kx * f) / 2, oy = (H - (r.n - r.s) * f) / 2
    return ([lon, lat]) => [ox + (lon - r.w) * kx * f, oy + (r.n - lat) * f]
  })
  const pfad = (P, ring) => ring.map((p, i) => { const [x, y] = P(p); return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) }).join(' ') + ' Z'
  const land = $derived(proj ? AUS_RINGS.map((r) => pfad(proj, r)) : [])

  const ringe = $derived.by(() => {
    if (!proj) return []
    const q = regionen.map((r) => { const m = mitte(r); if (!m) return null; const [x, y] = proj(m); const rad = Math.min(21, 9 + r.orte.length * 0.9); return { r, x0: x, y0: y, x, y, rad } }).filter(Boolean)
    for (let runde = 0; runde < 60; runde++) {
      let bewegt = false
      for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) {
        const a = q[i], b = q[j]
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy)
        const soll = a.rad + b.rad + 3
        if (d >= soll) continue
        if (d < 0.01) { const w = j * 2.4; dx = Math.cos(w); dy = Math.sin(w); d = 1 }
        const schub = (soll - d) / 2, ux = dx / d, uy = dy / d
        a.x -= ux * schub; a.y -= uy * schub; b.x += ux * schub; b.y += uy * schub
        bewegt = true
      }
      for (const a of q) { a.x = Math.max(a.rad + 2, Math.min(B - a.rad - 2, a.x)); a.y = Math.max(a.rad + 2, Math.min(H - a.rad - 2, a.y)) }
      if (!bewegt) break
    }
    return q
  })

  // Kleines Australien oben rechts mit dem Ausschnitt
  const IB = 64, IH = 54
  const iproj = (() => {
    const w = 112, e = 154.5, n = -9.5, s = -44, kx = Math.cos((-27 * Math.PI) / 180)
    const f = Math.min(IB / ((e - w) * kx), IH / (n - s)), ox = (IB - (e - w) * kx * f) / 2, oy = (IH - (n - s) * f) / 2
    return ([lon, lat]) => [ox + (lon - w) * kx * f, oy + (n - lat) * f]
  })()
  const iland = AUS_RINGS.map((r) => pfad(iproj, r))
  const irahmen = $derived.by(() => {
    if (!rahmen) return null
    const [x0, y0] = iproj([rahmen.w, rahmen.n]), [x1, y1] = iproj([rahmen.e, rahmen.s])
    return { x: x0, y: y0, b: Math.max(3, x1 - x0), h: Math.max(3, y1 - y0) }
  })
</script>

{#if proj}
  <figure class="gk">
    <svg viewBox="0 0 {B} {H}" role="img" aria-label={je('Gesamtkarte mit den Gegenden', 'Overview map of the areas')}>
      <rect width={B} height={H} rx="8" class="gk-meer" />
      {#each land as d}<path {d} class="gk-land" />{/each}
      {#each ringe as g (g.r.titel)}
        {#if Math.hypot(g.x - g.x0, g.y - g.y0) > 3}<line x1={g.x0} y1={g.y0} x2={g.x} y2={g.y} class="gk-strich" /><circle cx={g.x0} cy={g.y0} r="1.8" class="gk-lage" />{/if}
      {/each}
      {#each ringe as g (g.r.titel)}
        <g class="gk-ring" class:an={offen[g.r.titel]} role="button" tabindex="0" aria-label={`${t(g.r.titel)}: ${g.r.orte.length}`}
          onclick={() => onwahl?.(g.r.titel)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onwahl?.(g.r.titel))}>
          <title>{t(g.r.titel)}</title>
          <circle cx={g.x} cy={g.y} r={g.rad + 6} class="gk-treffer" />
          <circle cx={g.x} cy={g.y} r={g.rad + 2.5} class="gk-saum" />
          <circle cx={g.x} cy={g.y} r={g.rad} class="gk-kreis" />
          <text x={g.x} y={g.y} class="gk-zahl" text-anchor="middle" dominant-baseline="central">{g.r.orte.length}</text>
        </g>
      {/each}
      <g transform="translate({B - IB - 6} 6)" aria-hidden="true">
        <rect width={IB} height={IH} rx="6" class="gk-einsatz" />
        {#each iland as d}<path {d} class="gk-iland" />{/each}
        {#if irahmen}<rect x={irahmen.x} y={irahmen.y} width={irahmen.b} height={irahmen.h} class="gk-irahmen" />{/if}
      </g>
    </svg>
    <figcaption>{je('Tippe eine Gegend an, um sie unten aufzuklappen.', 'Tap an area to open it below.')}</figcaption>
  </figure>
{/if}

<style>
  .gk { margin: 4px 0 10px; padding: 10px 10px 8px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .gk svg { width: 100%; max-width: 560px; height: auto; display: block; }
  .gk-meer { fill: var(--karte-meer); }
  .gk-land { fill: var(--karte-land); stroke: var(--karte-kueste); stroke-width: 1.4; stroke-linejoin: round; }
  .gk-strich { stroke: var(--karte-strich); stroke-width: 1; opacity: 0.85; }
  .gk-lage { fill: var(--karte-punkt); }
  .gk-ring { cursor: pointer; outline: none; }
  .gk-treffer { fill: transparent; }
  .gk-saum { fill: var(--karte-saum); opacity: 0.9; }
  .gk-kreis { fill: var(--karte-punkt); stroke: var(--karte-punkt); stroke-width: 2.4; transition: stroke 0.2s; }
  .gk-zahl { fill: var(--karte-zahl); font-weight: 800; font-size: calc(11px * var(--schrift, 1)); pointer-events: none; }
  /* Offene Gegend: dunkler Rand um den Ring */
  .gk-ring.an .gk-kreis { stroke: var(--ink); stroke-width: 3; }
  .gk-ring:focus-visible .gk-kreis { stroke: var(--ink); stroke-width: 2.5; }
  .gk-einsatz { fill: var(--karte-meer); stroke: var(--karte-kueste); stroke-opacity: 0.6; }
  .gk-iland { fill: var(--karte-land); stroke: var(--karte-kueste); stroke-width: 0.7; }
  .gk-irahmen { fill: none; stroke: var(--karte-punkt); stroke-width: 1.5; }
  figcaption { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 700; text-align: center; }
</style>
