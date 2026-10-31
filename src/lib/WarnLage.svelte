<script>
  // Deine Lage: bist du im Warngebiet, was liegt in der Nähe, was kommt auf Route, Etappe und Wanderung.
  // Auf „Heute“ kurz, in der Gefahrenlage mit Karte und Google Maps.
  import { t, tn } from './i18n.js'
  import { zahl, dezimal } from './format.js'
  import { lage, meinePosition, testmodus, warnDaten } from './warnlage-dienst.js'
  import { uhr } from './flug-dienst.js'
  import WarnKnoepfe from './WarnKnoepfe.svelte'

  let { gross = false, geh = () => {} } = $props()
  const STUNDE = 3600e3
  const ALT_STUNDEN = 6
  const alter = $derived($warnDaten.zeit ? Math.floor(($uhr - $warnDaten.zeit) / STUNDE) : null)
  const km = (x) => (x < 10 ? dezimal(x, 1) : zahl(Math.round(x)))
  const rund = (x) => zahl(Math.round(x / 10) * 10)
  const ART = { route: '🛣️', wanderung: '🥾', etappe: '📍' }
</script>

{#if $testmodus.aktiv}<p class="wl-test">{t('🧪 Testmodus aktiv: Standort {name} und Probe-Warnungen sind nicht echt.', { name: $testmodus.name || '–' })}</p>{/if}

{#if $lage.drin.length || $lage.hier.length || $lage.hinweise.length}
  <section class="wl" class:rot={$lage.drin.length} aria-label={t('Deine Warnlage')}>
    {#each $lage.drin as w (w.id)}
      <div class="wl-z stark">
        <b>{t('🚨 Du bist im Warngebiet')}</b>
        <span>{w.icon} {w.level}: {w.titel}</span>
        {#if gross}<WarnKnoepfe {w} />{/if}
      </div>
    {/each}
    {#each $lage.hier.filter((w) => w.km > 0).slice(0, gross ? 6 : 2) as w (w.id)}
      <div class="wl-z">
        <b>{w.icon} {t('{km} km von dir', { km: km(w.km) })}</b>
        <span>{w.level}: {w.titel}</span>
        {#if gross}<WarnKnoepfe {w} />{/if}
      </div>
    {/each}
    {#each $lage.hinweise.slice(0, gross ? 12 : 4) as h (h.art + h.id)}
      <button class="wl-z wl-knopf" onclick={() => geh(h.ziel)}>
        <b>{ART[h.art]} {h.name}</b>
        <span>
          {#if h.art === 'route' && h.aufRoute && h.w.kmBis < 10}{t('Direkt vor dir: {titel}', { titel: h.w.titel })}
          {:else if h.art === 'route' && h.aufRoute}{t('In etwa {km} km voraus: {titel}', { km: rund(h.w.kmBis), titel: h.w.titel })}
          {:else if h.art === 'route'}{t('Nach etwa {km} km Strecke: {titel}', { km: rund(h.w.kmBis), titel: h.w.titel })}
          {:else}{h.w.km === 0 ? t('Im Warngebiet: {titel}', { titel: h.w.titel }) : t('{km} km daneben: {titel}', { km: km(h.w.km), titel: h.w.titel })}{/if}
          {#if h.art === 'route' && h.w.km > 0}<small>{t('{km} km neben der Strecke', { km: km(h.w.km) })}</small>{/if}
        </span>
      </button>
    {/each}
    {#if !gross}<button class="wl-mehr" onclick={() => geh('mehr/gefahren')}>{t('Gefahrenlage öffnen ›')}</button>{/if}
  </section>
{/if}

{#if alter == null}
  {#if gross || $meinePosition}<p class="wl-alt">{t('Noch kein Warnstand geladen. Mit Netz einmal aktualisieren.')}</p>{/if}
{:else if alter >= ALT_STUNDEN}
  <p class="wl-alt">{tn(alter, 'Warnstand von vor {n} Stunde, die Lage kann sich geändert haben.', 'Warnstand von vor {n} Stunden, die Lage kann sich geändert haben.')}</p>
{/if}

<style>
  .wl { display: flex; flex-direction: column; gap: 8px; background: var(--warn-flaeche); border: 1px solid var(--danger-linie); border-radius: var(--radius-m); padding: 12px; color: var(--warn-text); }
  .wl.rot { background: var(--danger-flaeche); color: var(--ink); }
  .wl-z { display: flex; flex-direction: column; gap: 1px; font-size: calc(14px * var(--schrift, 1)); text-align: left; overflow-wrap: anywhere; }
  .wl-z.stark b { font-size: calc(17px * var(--schrift, 1)); color: var(--danger-text); }
  .wl-z small { display: block; font-size: calc(12.5px * var(--schrift, 1)); opacity: 0.85; }
  .wl-knopf { background: none; border: none; border-top: 1px solid var(--danger-linie); padding: 8px 0 0; color: inherit; cursor: pointer; font: inherit; min-height: 44px; }
  .wl-mehr { align-self: flex-start; min-height: 36px; padding: 0; border: none; background: none; color: inherit; font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); cursor: pointer; }
  .wl-test { margin: 0; padding: 8px 10px; border-radius: var(--radius-s); background: var(--flaeche-2); color: var(--ink); font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; }
  .wl-alt { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
</style>
