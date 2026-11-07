<script>
  import { t } from './i18n.js'
  import { neueRoute, reisen, gesamtStart } from './userdata.js'
  import { etappenMitDatum, vermuteEtappe } from './plan.js'
  import { geh } from './navigation.js'
  import { get } from 'svelte/store'
  import { schriftAuf } from './kontrast.js'
  import { stoppsAusRoute } from './routen-ideen.js'
  import { je } from './i18n.js'
  import ZuordnenBlatt from './ZuordnenBlatt.svelte'
  import { orteAmTag } from './routen-verweise.js'

  // eingebettet: in der aufgeklappten Zeile der Übersicht, ohne eigenen Kopf
  let { routen = [], eingebettet = false, orteNachId = null, onort = null } = $props()

  let meldung = $state('')
  let mTimer

  function tageAusRoute(r) {
    for (const m of r.meta || []) {
      const t = m.match(/(\d+)\s*[–\-]?\s*(\d+)?\s*Tage/)
      if (t) return Math.max(+t[1], t[2] ? +t[2] : 0)
    }
    return (r.steps || []).length || 3
  }

  // V16: Eine Routen-Idee wird eine Route mit Zeitraum. Die App fragt, in welche Etappe, ab wann und wie lange
  // (vorher riet sie die Etappe und landete bei einer Route ab Perth in der Heimreise).
  let frage = $state(null)
  function uebernehmen(r) {
    const stops = stoppsAusRoute(r)
    frage = { r, stops, vorlage: { titel: r.titel, name: r.titel.replace(/^Route\s+/, ''), stops, tage: tageAusRoute(r) } }
  }
  function zuordnen(w) {
    const { r, stops } = frage
    frage = null
    const etappe = w.etappeId ? get(reisen).find((x) => x.id === w.etappeId) : null
    const id = neueRoute({ name: w.name, farbe: r.farbe, tage: w.tage, stops, etappeId: w.etappeId, von: w.von, idee: w.idee })
    meldung = w.idee ? je(`„${w.name}“ ist als Idee gemerkt${etappe ? ` in „${etappe.name}“` : ''}.`, `“${w.name}” is saved as an idea${etappe ? ` in “${etappe.name}”` : ''}.`)
      : je(`„${w.name}“ ist jetzt eine Route${etappe ? ` in „${etappe.name}“` : ''}.`, `“${w.name}” is now a route${etappe ? ` in “${etappe.name}”` : ''}.`)
    clearTimeout(mTimer); mTimer = setTimeout(() => (meldung = ''), 6000)
    letzte = { id, etappeId: w.etappeId || null }
  }
  let letzte = $state(null)
</script>

{#if frage}<ZuordnenBlatt vorlage={frage.vorlage} onfertig={zuordnen} onabbruch={() => (frage = null)} />{/if}
{#if meldung}<div class="uebernommen" role="status">✓ {meldung}
  {#if letzte}<button class="zur-route" onclick={() => geh(letzte.etappeId ? `plan/etappe/${letzte.etappeId}/${letzte.id}` : 'plan/route/' + letzte.id)}>{je('Öffnen', 'Open')}</button>{/if}</div>{/if}

{#each routen as r (r.id)}
  <article class="route" class:eingebettet id="ri-{r.id}" tabindex="-1" style={eingebettet ? `border-left-color:${r.farbe}` : null}>
    {#if !eingebettet}
    <div class="head" style="background:{r.farbe};color:{schriftAuf(r.farbe)}">
      <div class="titel">{r.titel}</div>
      {#if r.meta?.length}
        <div class="meta">{#each r.meta as m}<span>{m}</span>{/each}</div>
      {/if}
    </div>
    {/if}
    <div class="body">
      <div class="map">
        <!-- Eingebettet zeigt die große Karte darüber die Route: dann nur die Legende der Stopps -->
        {#if !eingebettet}{@html r.svg}{/if}
        {#if eingebettet}
          <!-- Nummern wie auf der Karte darüber: aus denselben Stopps erzeugt, nicht aus dem alten Legendentext -->
          <div class="legende">{#each stoppsAusRoute(r).filter((x) => x.lat != null) as st, n}{#if n} · {/if}<b>{n + 1}</b>&nbsp;{st.name}{/each}</div>
        {:else if r.legende}<div class="legende">{@html r.legende}</div>{/if}
        {#if r.caption && !eingebettet}<div class="caption">{r.caption}</div>{/if}
      </div>
      {#if r.summary}<p class="summary">{r.summary}</p>{/if}
      {#each r.steps as s, i}
        {@const amTag = orteNachId ? orteAmTag(r.id, i, orteNachId) : []}
        <div class="step" id="ri-{r.id}-tag-{i}">
          <div class="tag">{s.tag}</div>
          <div class="stext"><b>{s.titel}</b>{#if s.desc}<br /><span>{s.desc}</span>{/if}
            {#if amTag.length}
              <!-- Orte dieses Tages: antippen springt zum Ort mit allen Infos -->
              <span class="ri-orte">{#each amTag as o (o.id)}<button class="ri-ort" onclick={() => onort?.(o)}>{o.anzeigeName || o.name}</button>{/each}</span>
            {/if}
          </div>
        </div>
      {/each}
      <div class="links">
        <button class="uebernehmen-btn" onclick={() => uebernehmen(r)}>{je('➕ Als Route übernehmen', '➕ Add as a route')}</button>
        {#each r.links as l}
          <a class="maps-big" href={l.url} target="_blank" rel="noopener">{l.label}</a>
        {/each}
      </div>
    </div>
  </article>
{/each}

<style>
  .route { border-radius: var(--radius-m); overflow: clip; border: 1px solid var(--line); margin-bottom: 22px; background: var(--card); box-shadow: var(--shadow); }
  .route.eingebettet { margin: 4px 0 10px; box-shadow: none; border-left: 4px solid var(--line-stark); }
  .route.eingebettet .body { padding: 12px 14px; }
  .head { position: sticky; top: var(--kopf-h, 98px); z-index: 31; color: #fff; padding: 12px 16px; box-shadow: 0 2px 6px rgba(0, 0, 0, .18); }
  .titel { font-size: calc(18px * var(--schrift, 1)); font-weight: 800; }
  .meta { margin-top: 4px; font-size: calc(12.5px * var(--schrift, 1)); }
  .meta span { margin-right: 14px; }
  .body { padding: 16px 20px; }
  .map { float: left; width: 260px; margin: 0 20px 10px 0; }
  .map :global(svg) { width: 100%; height: auto; display: block; border-radius: 6px; }
  .ri-orte { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .ri-ort { min-height: 32px; padding: 0 10px; border: 1px solid var(--line-stark); border-radius: 8px; background: var(--card); color: var(--brand-text); font: inherit; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .ri-ort::before { content: '📍 '; }
  .legende { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 6px; line-height: 1.7; }
  .caption { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 4px; line-height: 1.5; }
  .summary { color: var(--muted); font-size: calc(13.8px * var(--schrift, 1)); margin: 0 0 14px; }
  .step { display: flex; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); }
  .step:first-of-type { border-top: none; }
  .tag { flex: 0 0 74px; font-weight: 700; color: var(--brand-text); font-size: calc(13px * var(--schrift, 1)); }
  .stext { font-size: calc(13px * var(--schrift, 1)); }
  .stext span { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .links { clear: both; padding-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .maps-big {
    font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border-radius: 8px; background: var(--card);
    color: var(--ink); border: 1px solid var(--line-stark); text-decoration: none;
  }
  .maps-big:hover { background: var(--flaeche-2); }
  .uebernehmen-btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border-radius: 8px; background: #2f7a63; color: #fff; border: 1px solid #2f7a63; cursor: pointer; }
  .zur-route { margin-left: 10px; min-height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--ok-linie); background: var(--card); color: var(--ok-text); font-weight: 700; cursor: pointer; }
  .uebernehmen-btn:hover { background: #276b56; }
  .uebernommen { position: sticky; top: var(--kopf-h, 98px); z-index: 5; background: var(--ok-flaeche); border: 1px solid var(--ok-linie); color: var(--ok-text); padding: 10px 14px; border-radius: 8px; font-size: calc(13px * var(--schrift, 1)); font-weight: 600; margin-bottom: 12px; }
  @media (max-width: 520px) {
    .map { float: none; width: 100%; margin: 0 0 12px; }
    .step { flex-direction: column; gap: 2px; }
    .tag { flex: none; }
  }
</style>
