<script>
  // Stopps ohne Kartenpunkt: Die App sucht sie selbst im Netz und schlägt Treffer vor.
  import { je } from './i18n.js'
  import { online } from './netz.js'
  import { reisen, updateReise } from './userdata.js'
  import { sucheOnline } from './ort-suche.js'
  import { ohnePunkt } from './plan.js'

  let { liste = [] } = $props()

  let treffer = $state({}), keiner = $state({})
  const namen = $derived(ohnePunkt(liste).filter((n) => !keiner[n]))

  $effect(() => {
    const offen = namen.filter((n) => !(n in treffer)), netz = $online
    if (!offen.length || !netz) return
    let aktuell = true
    ;(async () => {
      for (const n of offen.slice(0, 8)) {
        if (!aktuell) return
        try { treffer[n] = await sucheOnline(n) } catch { treffer[n] = [] }
      }
    })()
    return () => { aktuell = false }
  })

  // Derselbe Name bekommt überall denselben Punkt, auch in anderen Etappen
  function nimm(name, o) {
    for (const r of $reisen) {
      if (!(r.stops || []).some((s) => s.name === name && s.lat == null)) continue
      updateReise(r.id, { stops: r.stops.map((s) => (s.name === name && s.lat == null ? { ...s, lat: o.lat, lon: o.lon } : s)) })
    }
  }
</script>

{#if namen.length}
  <section class="bedien gv">
    <div class="bedien-block">
      <span class="bedien-titel">{je('Orte ohne Kartenpunkt', 'Places without a map point')}</span>
      <p class="bedien-text">{$online ? je('Wähle den richtigen Treffer, die Koordinaten kommen dann von selbst.', 'Pick the right match, the coordinates follow by themselves.') : je('Für die Vorschläge braucht es Netz.', 'Suggestions need a connection.')}</p>
    </div>
    {#each namen as n (n)}
      <div class="bedien-block">
        <span class="gv-name">{n}</span>
        {#if treffer[n]?.length}
          {#each treffer[n] as o (o.lat + ',' + o.lon)}
            <button class="gv-wahl" onclick={() => nimm(n, o)}><b>{o.name}</b><small>{o.region}</small></button>
          {/each}
          <button class="gv-kein" onclick={() => (keiner[n] = true)}>{je('Keiner passt', 'None of these')}</button>
        {:else if treffer[n]}
          <p class="bedien-text">{je('Nichts gefunden. Trag den Ort unten im Suchfeld ein.', 'Nothing found. Enter the place in the search field below.')}</p>
        {:else if $online}
          <p class="bedien-text">{je('Suche im Netz …', 'Searching online …')}</p>
        {/if}
      </div>
    {/each}
  </section>
{/if}

<style>
  .gv-name { color: var(--ink); font-size: calc(15px * var(--schrift, 1)); font-weight: 800; }
  .gv-wahl { display: flex; flex-direction: column; gap: 1px; min-height: 44px; padding: 6px 12px; border: 1px solid var(--line-stark); border-radius: 10px; background: none; color: var(--ink); font-size: calc(14px * var(--schrift, 1)); text-align: left; cursor: pointer; }
  .gv-wahl small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .gv-kein { align-self: flex-start; min-height: 44px; padding: 0; border: none; background: none; color: var(--muted); font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
</style>
