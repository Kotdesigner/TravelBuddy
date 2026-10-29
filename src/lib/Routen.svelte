<script>
  import { t } from './i18n.js'
  import { neueRoute, reisen, gesamtStart } from './userdata.js'
  import { etappenMitDatum, vermuteEtappe } from './plan.js'
  import { geh } from './navigation.js'
  import { get } from 'svelte/store'
  import { schriftAuf } from './kontrast.js'
  import { findeKoordinaten } from './wa-orte.js'

  let { routen = [] } = $props()

  let meldung = $state('')
  let mTimer

  // Stopps aus den Google-Maps-Links der Route ziehen (origin, waypoints, destination).
  function stoppsAusRoute(r) {
    const namen = []
    for (const l of r.links || []) {
      let u
      try { u = new URL(l.url) } catch { continue }
      const p = u.searchParams
      const add = (v) => { if (v) namen.push(v) }
      add(p.get('origin'))
      const wp = p.get('waypoints')
      if (wp) wp.split('|').forEach((w) => add(w))
      add(p.get('destination'))
    }
    // aufeinanderfolgende Duplikate (Teil-Grenzen) entfernen
    const stops = []
    let letzter = null
    for (const voll of namen) {
      if (voll === letzter) continue
      letzter = voll
      const name = voll.replace(/,\s*Western Australia\s*$/i, '').replace(/,\s*Australia\s*$/i, '').trim()
      const koord = findeKoordinaten(voll)
      stops.push({ name, lat: koord ? koord[0] : null, lon: koord ? koord[1] : null, img: null })
    }
    return stops
  }

  function tageAusRoute(r) {
    for (const m of r.meta || []) {
      const t = m.match(/(\d+)\s*[–\-]?\s*(\d+)?\s*Tage/)
      if (t) return Math.max(+t[1], t[2] ? +t[2] : 0)
    }
    return (r.steps || []).length || 3
  }

  // Eine Routen-Idee wird eine Route in der passenden Etappe (meist der Roadtrip)
  function uebernehmen(r) {
    const stops = stoppsAusRoute(r)
    const etappe = vermuteEtappe({ stops }, etappenMitDatum(get(reisen), get(gesamtStart)))
    const id = neueRoute({ name: r.titel.replace(/^Route\s+/, ''), farbe: r.farbe, tage: tageAusRoute(r), stops, etappeId: etappe?.id || null })
    meldung = t('„{titel}“ ist jetzt eine Route{wert}.', { titel: r.titel, wert: etappe ? t(' in „{name}“', { name: etappe.name }) : '' })
    clearTimeout(mTimer); mTimer = setTimeout(() => (meldung = ''), 6000)
    letzte = { id, etappeId: etappe?.id || null }
  }
  let letzte = $state(null)
</script>

{#if meldung}<div class="uebernommen" role="status">✓ {meldung}
  {#if letzte}<button class="zur-route" onclick={() => geh(letzte.etappeId ? `plan/etappe/${letzte.etappeId}/${letzte.id}` : 'plan/route/' + letzte.id)}>{t('Route öffnen')}</button>{/if}</div>{/if}

{#each routen as r (r.id)}
  <article class="route">
    <div class="head" style="background:{r.farbe};color:{schriftAuf(r.farbe)}">
      <div class="titel">{r.titel}</div>
      {#if r.meta?.length}
        <div class="meta">{#each r.meta as m}<span>{m}</span>{/each}</div>
      {/if}
    </div>
    <div class="body">
      <div class="map">
        {@html r.svg}
        {#if r.legende}<div class="legende">{@html r.legende}</div>{/if}
        {#if r.caption}<div class="caption">{r.caption}</div>{/if}
      </div>
      {#if r.summary}<p class="summary">{r.summary}</p>{/if}
      {#each r.steps as s}
        <div class="step">
          <div class="tag">{s.tag}</div>
          <div class="stext"><b>{s.titel}</b>{#if s.desc}<br /><span>{s.desc}</span>{/if}</div>
        </div>
      {/each}
      <div class="links">
        <button class="uebernehmen-btn" onclick={() => uebernehmen(r)}>{t('➕ Als Route übernehmen')}</button>
        {#each r.links as l}
          <a class="maps-big" href={l.url} target="_blank" rel="noopener">{l.label}</a>
        {/each}
      </div>
    </div>
  </article>
{/each}

<style>
  .route { border-radius: 10px; overflow: hidden; border: 1px solid var(--line); margin-bottom: 22px; background: var(--card); box-shadow: var(--shadow); }
  .head { color: #fff; padding: 14px 20px; }
  .titel { font-size: calc(18px * var(--schrift, 1)); font-weight: 800; }
  .meta { margin-top: 4px; font-size: calc(12.5px * var(--schrift, 1)); }
  .meta span { margin-right: 14px; }
  .body { padding: 16px 20px; }
  .map { float: left; width: 260px; margin: 0 20px 10px 0; }
  .map :global(svg) { width: 100%; height: auto; display: block; border-radius: 6px; }
  .legende { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 6px; line-height: 1.7; }
  .caption { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 4px; line-height: 1.5; }
  .summary { color: var(--muted); font-size: calc(13.8px * var(--schrift, 1)); margin: 0 0 14px; }
  .step { display: flex; gap: 12px; padding: 7px 0; border-top: 1px solid #f0e9db; }
  .step:first-of-type { border-top: none; }
  .tag { flex: 0 0 74px; font-weight: 700; color: var(--brand-text); font-size: calc(13px * var(--schrift, 1)); }
  .stext { font-size: calc(13px * var(--schrift, 1)); }
  .stext span { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .links { clear: both; padding-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .maps-big {
    font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border-radius: 8px; background: var(--card);
    color: var(--ink); border: 1px solid var(--line-stark); text-decoration: none;
  }
  .maps-big:hover { background: #f4ecdc; }
  .uebernehmen-btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border-radius: 8px; background: #2f7a63; color: #fff; border: 1px solid #2f7a63; cursor: pointer; }
  .zur-route { margin-left: 10px; min-height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--ok-linie); background: var(--card); color: var(--ok-text); font-weight: 700; cursor: pointer; }
  .uebernehmen-btn:hover { background: #276b56; }
  .uebernommen { position: sticky; top: 60px; z-index: 5; background: var(--ok-flaeche); border: 1px solid var(--ok-linie); color: var(--ok-text); padding: 10px 14px; border-radius: 8px; font-size: calc(13px * var(--schrift, 1)); font-weight: 600; margin-bottom: 12px; }
  @media (max-width: 520px) {
    .map { float: none; width: 100%; margin: 0 0 12px; }
    .step { flex-direction: column; gap: 2px; }
  }
</style>
