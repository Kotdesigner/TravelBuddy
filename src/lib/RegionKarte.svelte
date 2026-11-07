<script>
  // Karte einer aufgeklappten Gegend: genaue Küste, jeder Ort als Punkt mit Nummer (dieselbe Nummer
  // steht auf seiner Kachel), unten links eine kleine Lageskizze von Australien.
  // Ein Tipp auf einen Punkt zeigt die Kurzinfo UNTER der Karte, so bleibt die Karte frei.
  // „Zur Kachel“ springt zur Kachel und hebt sie kurz hervor.
  import { tick } from 'svelte'
  import { t, je } from './i18n.js'
  import UebersichtsKarte from './UebersichtsKarte.svelte'
  import { punkteVon, zuordenbar, abstandZur, NAH_KM } from './wander-zuordnung.js'
  import { INSELN, ANREISE_ZEICHEN, abfahrtPunkt } from './inseln.js'
  import { userData } from './userdata.js'
  import { reiseDatum } from './reisedatum.js'
  import { sonnenZeiten } from './sonne.js'
  import { AUS_RINGS } from './geo-australia.js'
  import { dauer, klapp } from './motion.js'

  let { orte = [], reisen = [], nummer = {}, titel = '' } = $props()

  let gewaehlt = $state(null)
  const punkte = $derived(orte.filter((o) => o.lat != null).map((o) => ({ id: o.id, lat: o.lat, lon: o.lon, nr: nummer[o.id], label: `${nummer[o.id]}. ${o.anzeigeName || o.name}`, an: true })))
  const linien = $derived(reisen.filter(zuordenbar).map((r) => ({ id: r.id, farbe: r.farbe || '#7a6fd6', punkte: punkteVon(r), an: true, label: r.name })))

  const o = $derived(gewaehlt ? orte.find((x) => x.id === gewaehlt) : null)
  const bildVon = (x) => $userData[x.id]?.bilder?.[0] || x.bildData || (x.bild ? '/' + x.bild : null)
  const sonne = $derived(o?.lat != null ? sonnenZeiten(o.lat, o.lon, $reiseDatum) : null)
  const nah = $derived.by(() => {
    if (!o) return null
    const p = abfahrtPunkt(o)
    let b = null
    for (const r of reisen) {
      if (!zuordenbar(r)) continue
      const a = abstandZur(p, r)
      if (a && a.km <= NAH_KM && (!b || a.km < b.km)) b = { name: r.name, km: a.km }
    }
    return b
  })
  const mapsUrl = (x) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(x.mapsQuery || `${x.lat},${x.lon}`)

  async function zurKachel(id, einplanen = false) {
    gewaehlt = null
    await tick()
    const el = document.getElementById('ort-' + id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    el.classList.add('ort-hl')
    setTimeout(() => el.classList.remove('ort-hl'), 2400)
    if (einplanen) setTimeout(() => el.querySelector('.reise-btn')?.click(), 450)
  }

  // Lageskizze: kleines Australien mit einem Ring um die Gegend
  const IB = 62, IH = 52
  const iproj = (() => {
    const w = 112, e = 154.5, n = -9.5, s = -44, kx = Math.cos((-27 * Math.PI) / 180)
    const f = Math.min(IB / ((e - w) * kx), IH / (n - s)), ox = (IB - (e - w) * kx * f) / 2, oy = (IH - (n - s) * f) / 2
    return ([lon, lat]) => [ox + (lon - w) * kx * f, oy + (n - lat) * f]
  })()
  const iland = AUS_RINGS.map((r) => r.map((p, i) => { const [x, y] = iproj(p); return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) }).join(' ') + ' Z')
  const iring = $derived.by(() => {
    const p = orte.filter((x) => x.lat != null)
    if (!p.length) return null
    const lon = p.reduce((s, x) => s + x.lon, 0) / p.length, lat = p.reduce((s, x) => s + x.lat, 0) / p.length
    const [x, y] = iproj([lon, lat])
    return { x, y }
  })
</script>

<div class="rk">
  <div class="rk-karte">
    <UebersichtsKarte {punkte} {linien} {gewaehlt} onpunkt={(id) => (gewaehlt = gewaehlt === id ? null : id)} label={je(`Karte: ${titel}`, `Map: ${titel}`)} hoehe={240} rahmen="punkte" />
    <svg class="rk-lage" width={IB} height={IH} viewBox="0 0 {IB} {IH}" aria-hidden="true">
      <rect width={IB} height={IH} rx="6" class="rk-lage-grund" />
      {#each iland as d}<path {d} class="rk-lage-land" />{/each}
      {#if iring}<circle cx={iring.x} cy={iring.y} r="5" class="rk-lage-ring" />{/if}
    </svg>
  </div>

  {#if o}
    {@const insel = INSELN[o.id]}
    {@const bild = bildVon(o)}
    <div class="rk-info" transition:klapp={{ duration: dauer(180) }} role="region" aria-label={o.anzeigeName || o.name}>
      <div class="rk-info-kopf">
        {#if bild}<img class="rk-bild" src={bild} alt="" />{:else}<span class="rk-bild leer" aria-hidden="true">{o.emoji || '📍'}</span>{/if}
        <div class="rk-info-titel">
          <b><span class="rk-nr">{nummer[o.id]}</span> {o.anzeigeName || o.name}</b>
          {#if o.tags?.length}<span class="rk-tags">{#each o.tags as tag}<span class="rk-tag" class:geheim={tag === 'GEHEIMTIPP'} class:wd={tag === 'NUR-4WD' || tag === 'EXPEDITION'}>{t(tag)}</span>{/each}</span>{/if}
        </div>
        <button class="rk-zu" onclick={() => (gewaehlt = null)} aria-label={je('Schließen', 'Close')}>✕</button>
      </div>
      {#if o.beschreibung}<p class="rk-text">{o.beschreibung}</p>{/if}
      <p class="rk-zeilen">
        {#if sonne}<span>🌅 {sonne.aufgang}</span><span>🌇 {sonne.untergang}</span>{/if}
        {#if insel}<span class="rk-anreise">{ANREISE_ZEICHEN[insel.art]} {insel.text}</span>{/if}
        {#if nah}<span class="rk-nah">🛣️ {nah.km < 1 ? je(`direkt an ${nah.name}`, `right on ${nah.name}`) : je(`${nah.km} km neben ${nah.name}`, `${nah.km} km from ${nah.name}`)}</span>{/if}
      </p>
      <div class="rk-knoepfe">
        <a class="bedien-knopf" href={mapsUrl(o)} target="_blank" rel="noopener">Google Maps</a>
        <button class="bedien-knopf" onclick={() => zurKachel(o.id, true)}>{je('Einplanen', 'Add to trip')}</button>
        <button class="bedien-knopf haupt" onclick={() => zurKachel(o.id)}>{je('Zur Kachel ↓', 'To the tile ↓')}</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .rk { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
  .rk-karte { position: relative; }
  .rk-lage { position: absolute; left: 8px; bottom: 8px; pointer-events: none; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25)); }
  .rk-lage-grund { fill: var(--card); stroke: var(--line); }
  .rk-lage-land { fill: var(--flaeche-2, var(--flaeche)); stroke: var(--muted); stroke-width: 0.6; stroke-opacity: 0.6; }
  .rk-lage-ring { fill: rgba(224, 123, 40, 0.2); stroke: #e07b28; stroke-width: 1.3; }
  .rk-info { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--line-stark); border-radius: 12px; background: var(--flaeche); }
  .rk-info-kopf { display: flex; gap: 10px; align-items: flex-start; }
  .rk-bild { width: 60px; height: 60px; flex: none; border-radius: 8px; object-fit: cover; background: var(--card); }
  .rk-bild.leer { display: flex; align-items: center; justify-content: center; font-size: calc(26px * var(--schrift, 1)); }
  .rk-info-titel { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .rk-info-titel b { font-size: calc(15px * var(--schrift, 1)); color: var(--ink); }
  .rk-nr { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; background: #c1662f; color: #fff; font-size: calc(11px * var(--schrift, 1)); font-weight: 800; vertical-align: 1px; }
  .rk-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .rk-tag { font-size: calc(11px * var(--schrift, 1)); font-weight: 800; padding: 2px 8px; border-radius: 20px; background: var(--ok-flaeche); color: var(--ok-text); }
  .rk-tag.geheim { background: var(--info-flaeche); color: var(--info-text); }
  .rk-tag.wd { background: var(--warn-flaeche); color: var(--btn-ink); }
  .rk-zu { width: 44px; height: 44px; flex: none; border: 1px solid var(--line-stark); border-radius: 9px; background: var(--card); color: var(--btn-ink); cursor: pointer; }
  .rk-info p { margin: 0; }
  .rk-text { font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .rk-zeilen { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .rk-anreise { color: var(--info-text); }
  .rk-nah { color: var(--brand-text); }
  .rk-knoepfe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 2px; }
  .rk-knoepfe .bedien-knopf { text-decoration: none; text-align: center; padding: 0 8px; font-size: calc(13px * var(--schrift, 1)); }
  @media (max-width: 380px) { .rk-knoepfe { grid-template-columns: 1fr 1fr; } .rk-knoepfe .haupt { grid-column: 1 / -1; } }
</style>
