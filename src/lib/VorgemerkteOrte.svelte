<script>
  // V16: Alle vorgemerkten Orte auf einen Blick, mit Stand: schon in einer Route, an einer Route
  // vorgeschlagen (bis 100 km), oder noch keine Route in Reichweite.
  import { je } from './i18n.js'
  import { userData, reisen, updateOrt } from './userdata.js'
  import { istRoute } from './plan.js'
  import { hinweise } from './routen-dienst.js'
  import { norm } from './suche.js'

  let { orte = [], geh = () => {} } = $props()

  const vorgemerkt = $derived(orte.filter((o) => $userData[o.id]?.vorgemerkt))
  const routen = $derived($reisen.filter((r) => istRoute(r) && !r.idee))
  function stand(o) {
    const drin = routen.find((r) => (r.stops || []).some((s) => norm(s.name) === norm(o.name)
      || (s.lat != null && o.lat != null && Math.abs(s.lat - o.lat) < 0.02 && Math.abs(s.lon - o.lon) < 0.02)))
    if (drin) return { art: 'drin', r: drin }
    for (const r of routen) {
      const v = ($hinweise[r.id]?.vorschlaege || []).find((x) => x.ort.id === o.id)
      if (v) return { art: 'nah', r, km: v.abstand }
    }
    return { art: 'offen' }
  }
  const ziel = (r) => (r.etappeId ? `plan/etappe/${r.etappeId}/${r.id}` : 'plan/route/' + r.id)
</script>

{#if vorgemerkt.length}
  <section class="vo" aria-label={je('Vorgemerkte Orte', 'Saved places')}>
    <h3>⭐ {je('Vorgemerkt', 'Saved for later')} <span class="vo-zahl">{vorgemerkt.length}</span></h3>
    <p class="vo-k">{je('Liegt eine Route bis 100 km entfernt, schlägt die App den Ort dort als Erstes vor.', 'When a route passes within 100 km, the app suggests the place there first.')}</p>
    <ul>
      {#each vorgemerkt as o (o.id)}
        {@const s = stand(o)}
        <li>
          <span class="vo-t"><b>{o.name}</b>
            <small>
              {#if s.art === 'drin'}{je(`in „${s.r.name}“`, `in “${s.r.name}”`)}
              {:else if s.art === 'nah'}{je(`${s.km} km neben „${s.r.name}“, dort einfügen`, `${s.km} km from “${s.r.name}”, add it there`)}
              {:else}{je('noch keine Route in Reichweite', 'no route nearby yet')}{/if}
            </small>
          </span>
          {#if s.art !== 'offen'}<button class="vo-k-btn" onclick={() => geh(ziel(s.r))}>{je('Route', 'Route')} ›</button>{/if}
          <button class="vo-x" onclick={() => updateOrt(o.id, { vorgemerkt: false })} aria-label={je(`${o.name} nicht mehr vormerken`, `Remove ${o.name} from saved`)}>✕</button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .vo { margin: 4px 0 16px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--card); display: flex; flex-direction: column; gap: 6px; }
  h3 { margin: 0; font-size: calc(15px * var(--schrift, 1)); }
  .vo-zahl { color: var(--muted); font-weight: 700; }
  .vo-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  li { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--line); padding: 6px 0; min-height: 44px; }
  .vo-t { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: calc(14px * var(--schrift, 1)); overflow-wrap: anywhere; }
  .vo-t small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .vo-k-btn { border: none; background: none; color: var(--brand-text); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; min-height: 36px; }
  .vo-x { width: 36px; height: 36px; border: none; background: none; color: var(--muted); cursor: pointer; }
</style>
