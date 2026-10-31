<script>
  // Zu einer Warnung: Größe des Gebiets, Abstand zu dir, Google Maps und die eigene Karte.
  import { t } from './i18n.js'
  import { zahl, dezimal } from './format.js'
  import { gebietGroesse, warnMitte, abstandKm } from './warnungen.js'
  import { mapsPosition, mapsWeg } from './warnlage.js'
  import { meinePosition } from './warnlage-dienst.js'

  let { w } = $props()
  const mitte = $derived(warnMitte(w))
  const groesse = $derived(gebietGroesse(w))
  const vonMir = $derived($meinePosition ? abstandKm(w, $meinePosition.lat, $meinePosition.lon) : null)
  const km = (x) => (x < 10 ? dezimal(x, 1) : zahl(Math.round(x)))
</script>

<div class="wk">
  {#if vonMir != null && vonMir < Infinity}<p class="wk-mir">{vonMir === 0 ? t('📍 Du bist in diesem Gebiet') : t('📍 {km} km von dir', { km: km(vonMir) })}</p>{/if}
  {#if groesse}<p>{t('Gebiet ca. {flaeche} km², etwa {breite} × {hoehe} km', { flaeche: zahl(Math.round(groesse.flaecheKm2)), breite: km(groesse.breiteKm), hoehe: km(groesse.hoeheKm) })}</p>
  {:else if mitte}<p>{t('Nur als Punkt gemeldet, Größe unbekannt')}</p>{/if}
  {#if mitte}
    <div class="wk-knoepfe">
      <a href="#/plan/karte/warnung/{encodeURIComponent(w.id)}">{t('🗺️ Auf der Karte')}</a>
      <a href={mapsPosition(mitte)} target="_blank" rel="noopener">{t('📍 Google Maps')}</a>
      {#if $meinePosition}<a href={mapsWeg($meinePosition, mitte)} target="_blank" rel="noopener">{t('🧭 Weg von mir')}</a>{/if}
    </div>
  {/if}
</div>

<style>
  .wk { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; font-size: calc(13px * var(--schrift, 1)); }
  .wk p { margin: 0; color: var(--muted); }
  .wk-mir { color: var(--ink) !important; font-weight: 700; }
  .wk-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  a { display: inline-flex; align-items: center; min-height: 36px; padding: 0 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--flaeche); color: var(--btn-ink); font-weight: 700; text-decoration: none; }
</style>
