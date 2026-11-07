<script>
  // Kurzinfo zu einem Etappenort (Stadt zum Tanken, Einkaufen, Übernachten) unter einer Karte:
  // Versorgung im Umkreis von 10 km laut Offline-Daten, die nächsten Sehenswürdigkeiten der Gegend,
  // Google Maps und „Als Stopp einplanen“ in eine eigene Fahrt in der Nähe oder eine neue Route.
  import { je } from './i18n.js'
  import { reisen, stopHinzufuegen } from './userdata.js'
  import { istFahrt, istReiseEtappe } from './abschnitte.js'
  import { istRoute, abstandZurRoute } from './plan.js'
  import { oeffneNeu } from './neu.js'
  import { zeigeToast } from './toast.js'
  import { VERSORGUNG } from './routen-daten.js'
  import { dauer, klapp } from './motion.js'

  let { e, nummer = null, nummerFarbe = null, unter = '', nah = [], onzu = null, tagText = '', ontag = null } = $props()

  const ART = { stadt: () => je('Etappenort', 'Stopover town'), roadhouse: () => je('Roadhouse', 'Roadhouse') }
  const mapsUrl = $derived(`https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lon}`)
  let wahlAuf = $state(false)
  // Wie bei den Orten: nur eigene Fahrten bis 300 km, die nächste zuerst
  const fahrten = $derived($reisen.filter((r) => istRoute(r) && !r.idee && istFahrt(r) && !istReiseEtappe($reisen.find((x) => x.id === r.etappeId), $reisen))
    .map((r) => ({ r, km: abstandZurRoute(r, e) })).filter((x) => x.km <= 300).sort((a, b) => a.km - b.km))
  const stopp = $derived({ name: e.name, lat: e.lat, lon: e.lon })
  function inFahrt(r) {
    const { nach } = stopHinzufuegen(r.id, stopp)
    wahlAuf = false
    zeigeToast(nach ? je(`${e.name} in „${r.name}“ nach ${nach} eingefügt`, `${e.name} added to “${r.name}” after ${nach}`) : je(`${e.name} als Start von „${r.name}“ eingefügt`, `${e.name} added as the start of “${r.name}”`), 'ok')
  }
  function neueRoute() { wahlAuf = false; oeffneNeu('route', { stops: [{ ...stopp, img: null }] }) }
</script>

<div class="ei" transition:klapp={{ duration: dauer(180) }} role="region" aria-label={e.name}>
  <div class="ei-kopf">
    {#if nummer}<span class="ei-nr" style={nummerFarbe ? `background:${nummerFarbe}` : null}>{nummer}</span>
    {:else}<span class="ei-zeichen" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 5l8 6.5M6.5 10v9h11v-9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>{/if}
    <div class="ei-titel">
      <b>{e.name}</b>
      <small>{ART[e.art]?.() || je('Etappenort', 'Stopover town')} · {je('Tanken, Einkaufen, Übernachten', 'Fuel, shops, overnight')}{unter ? ` · ${unter}` : ''}</small>
    </div>
    <button class="ei-zu" onclick={() => onzu?.()} aria-label={je('Schließen', 'Close')}>✕</button>
  </div>
  <p class="ei-versorgung">
    {#each VERSORGUNG.filter(([k]) => e.versorgung?.[k]) as [k, zeichen] (k)}<span>{zeichen} {e.versorgung[k] > 9 ? '9+' : e.versorgung[k]}</span>{/each}
    {#if !e.versorgung?.fuel && e.tankKm != null}<span class="ei-warn">⛽ {je(`nächste Tankstelle ${e.tankKm} km`, `nearest fuel ${e.tankKm} km`)}</span>{/if}
  </p>
  <p class="ei-quelle">{je('Im Umkreis von 10 km laut Offline-Karte', 'Within 10 km according to the offline map')}</p>
  {#if nah.length}
    <p class="ei-nah"><b>{je('Von hier aus:', 'From here:')}</b>
      {#each nah as n (n.name)}<span>{#if n.nr}<i class="ei-onr">{n.nr}</i>{/if}{n.name} · {n.km} km</span>{/each}
    </p>
  {/if}
  <div class="ei-knoepfe">
    <a class="bedien-knopf" href={mapsUrl} target="_blank" rel="noopener">Google Maps</a>
    {#if ontag}
      <button class="bedien-knopf haupt" onclick={() => ontag?.()}>{tagText}</button>
    {:else}
      <button class="bedien-knopf haupt" aria-expanded={wahlAuf} onclick={() => (wahlAuf = !wahlAuf)}>{je('Als Stopp einplanen', 'Add as a stop')}</button>
    {/if}
  </div>
  {#if wahlAuf}
    <div class="ei-wahl" role="group" aria-label={je(`${e.name} einplanen`, `Add ${e.name}`)}>
      <span class="ei-wahl-titel">{fahrten.length ? je('In eine Fahrt in der Nähe', 'Into a nearby drive') : je('Keine eigene Fahrt bis 300 km in der Nähe', 'No drive of yours within 300 km')}</span>
      {#each fahrten as { r, km } (r.id)}
        <button onclick={() => inFahrt(r)}><span class="ei-dot" style="background:{r.farbe}"></span>{r.name}<small>{je(`${Math.round(km)} km von der Strecke`, `${Math.round(km)} km from the route`)}</small></button>
      {/each}
      <button class="ei-neu" onclick={neueRoute}>{je('＋ Neue Route mit diesem Ort …', '＋ New route with this place …')}</button>
    </div>
  {/if}
</div>

<style>
  .ei { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--line-stark); border-radius: 12px; background: var(--flaeche); }
  .ei p { margin: 0; }
  .ei-kopf { display: flex; gap: 10px; align-items: flex-start; }
  .ei-zeichen { flex: none; width: 42px; height: 42px; border-radius: 10px; border: 2px solid var(--ink); background: var(--card); color: var(--ink); display: flex; align-items: center; justify-content: center; }
  .ei-zeichen svg { width: 22px; height: 22px; }
  .ei-nr { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); background: var(--karte-punkt); color: #fff; font-weight: 800; font-size: calc(13px * var(--schrift, 1)); }
  .ei-titel { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ei-titel b { font-size: calc(15px * var(--schrift, 1)); color: var(--ink); }
  .ei-titel small { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ei-zu { width: 44px; height: 44px; flex: none; border: 1px solid var(--line-stark); border-radius: 9px; background: var(--card); color: var(--btn-ink); cursor: pointer; }
  .ei-versorgung { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); }
  .ei-warn { color: var(--warn-text, #b45309); }
  .ei-quelle { font-size: calc(11.5px * var(--schrift, 1)); color: var(--muted); }
  .ei-nah { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: calc(13px * var(--schrift, 1)); color: var(--ink); }
  .ei-nah b { flex-basis: 100%; font-size: calc(13px * var(--schrift, 1)); }
  .ei-onr { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-right: 4px; border-radius: 50%; background: var(--karte-punkt); color: #fff; font-size: calc(10px * var(--schrift, 1)); font-style: normal; font-weight: 800; vertical-align: 1px; }
  .ei-knoepfe { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 2px; }
  .ei-knoepfe .bedien-knopf { text-decoration: none; text-align: center; padding: 0 8px; font-size: calc(13px * var(--schrift, 1)); }
  .ei-wahl { display: flex; flex-direction: column; border: 1px solid var(--line-stark); border-radius: 10px; background: var(--card); overflow: hidden; }
  .ei-wahl-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); padding: 8px 10px 4px; }
  .ei-wahl button { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; min-height: 44px; padding: 6px 10px; border: none; border-top: 1px solid var(--line); background: none; color: var(--ink); font: inherit; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; text-align: left; cursor: pointer; }
  .ei-wahl button small { flex-basis: 100%; padding-left: 17px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .ei-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .ei-neu { color: var(--ok-text) !important; }
</style>
