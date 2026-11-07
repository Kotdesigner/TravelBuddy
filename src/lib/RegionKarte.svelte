<script>
  // Karte einer aufgeklappten Gegend: genaue Küste, jeder Ort als Punkt mit Nummer (dieselbe Nummer
  // steht auf seiner Kachel), unten links eine kleine Lageskizze von Australien.
  // Ein Tipp auf einen Punkt zeigt die Kurzinfo UNTER der Karte (OrtInfo), so bleibt die Karte frei.
  // „Zur Kachel“ springt zur Kachel und hebt sie kurz hervor. Dazu die Etappenorte (weißes Häuschen):
  // Städte zum Tanken, Einkaufen und Übernachten, antippen zeigt Versorgung und Sehenswertes in der Nähe.
  import { tick } from 'svelte'
  import { t, je } from './i18n.js'
  import UebersichtsKarte from './UebersichtsKarte.svelte'
  import { punkteVon, zuordenbar } from './wander-zuordnung.js'
  import { AUS_RINGS } from './geo-australia.js'
  import OrtInfo from './OrtInfo.svelte'
  import UeberblickKarte from './UeberblickKarte.svelte'
  import { ueberblick, ladeUeberblick } from './ueberblick-gl.js'
  import { onMount } from 'svelte'
  import EtappeInfo from './EtappeInfo.svelte'
  import { ladeEtappenorte, etappeFokus, vonHierAus } from './routen-daten.js'

  let etappen = $state([])
  onMount(() => { ladeUeberblick(); ladeEtappenorte().then((e) => (etappen = e)) })

  let { orte = [], reisen = [], nummer = {}, titel = '' } = $props()

  let gewaehlt = $state(null)
  const punkte = $derived(orte.filter((o) => o.lat != null).map((o) => ({ id: o.id, lat: o.lat, lon: o.lon, nr: nummer[o.id], label: `${nummer[o.id]}. ${o.anzeigeName || o.name}`, an: true })))
  const linien = $derived(reisen.filter(zuordenbar).map((r) => ({ id: r.id, farbe: r.farbe || '#7a6fd6', punkte: punkteVon(r), an: true, label: r.name })))

  const o = $derived(gewaehlt ? orte.find((x) => x.id === gewaehlt) : null)
  // Etappenort gewählt (nur einer von beiden: Ort oder Etappenort)
  let etappeWahl = $state(null)
  const e = $derived(etappeWahl ? etappen.find((x) => x.id === etappeWahl) : null)
  const waehleOrt = (id) => { etappeWahl = null; gewaehlt = gewaehlt === id ? null : id }
  const waehleEtappe = (id) => { gewaehlt = null; etappeWahl = etappeWahl === id ? null : id }
  // Aus der Suche: gehört der Etappenort zu dieser Gegend, hier auswählen und die Karte zeigen
  let kartenEl = $state()
  $effect(() => {
    const id = $etappeFokus
    const x = id && etappen.find((y) => y.id === id)
    if (!x || x.region !== titel) return
    waehleEtappe(id); etappeFokus.set(null)
    setTimeout(() => kartenEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  })

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

<div class="rk" bind:this={kartenEl}>
  {#if $ueberblick === 'bereit'}
    <!-- Echte Offline-Karte: Ausschnitt mindestens so groß, dass ein bekannter Ort in der Nähe zu sehen ist -->
    <UeberblickKarte art="nummern" {punkte} {linien} {gewaehlt} onpunkt={waehleOrt} {etappen} etappeGewaehlt={etappeWahl} onetappe={waehleEtappe} onleer={() => { gewaehlt = null; etappeWahl = null }}
      spanne={[0.5, 0.32]} fitMax={10} hoehe={280} label={je(`Karte: ${titel}`, `Map: ${titel}`)} />
  {:else}
  <div class="rk-karte">
    <UebersichtsKarte {punkte} {linien} {gewaehlt} onpunkt={(id) => (gewaehlt = gewaehlt === id ? null : id)} label={je(`Karte: ${titel}`, `Map: ${titel}`)} hoehe={240} rahmen="punkte" />
    <svg class="rk-lage" width={IB} height={IH} viewBox="0 0 {IB} {IH}" aria-hidden="true">
      <rect width={IB} height={IH} rx="6" class="rk-lage-grund" />
      {#each iland as d}<path {d} class="rk-lage-land" />{/each}
      {#if iring}<circle cx={iring.x} cy={iring.y} r="5" class="rk-lage-ring" />{/if}
    </svg>
  </div>
  {/if}

  {#if o}
    <OrtInfo {o} nummer={nummer[o.id]} {reisen} onzu={() => (gewaehlt = null)} onkachel={zurKachel} />
  {:else if e}
    <EtappeInfo {e} nah={vonHierAus(e, orte, nummer)} onzu={() => (etappeWahl = null)} />
  {/if}
</div>

<style>
  .rk { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
  .rk-karte { position: relative; }
  .rk-lage { position: absolute; left: 8px; bottom: 8px; pointer-events: none; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25)); }
  .rk-lage-grund { fill: var(--karte-meer); stroke: var(--karte-kueste); stroke-opacity: 0.7; }
  .rk-lage-land { fill: var(--karte-land); stroke: var(--karte-kueste); stroke-width: 0.7; }
  .rk-lage-ring { fill: var(--karte-punkt); fill-opacity: 0.35; stroke: var(--karte-punkt); stroke-width: 1.5; }
</style>
