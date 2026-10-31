<script>
  // Testmodus: einen Standort wählen und eine Probe-Warnung einschalten. So lässt sich unterwegs
  // prüfen, ob alles meldet, ohne etwas umzuprogrammieren. Echte Warnungen laufen weiter.
  import { t } from './i18n.js'
  import { reisen } from './userdata.js'
  import { testmodus } from './warnlage-dienst.js'
  import OrtWahl from './OrtWahl.svelte'

  let { orte = [] } = $props()
  let auf = $state(false)
  const PROBEN = [
    ['', t('Keine, nur der Standort')],
    ['hier', t('Direkt am Standort')],
    ['nah', t('30 km entfernt')],
    ['route', t('Voraus auf der Route')],
  ]
  const setze = (patch) => testmodus.update((x) => ({ ...x, ...patch }))
  const ortGewaehlt = (o) => setze({ lat: o.lat, lon: o.lon, name: o.name })
  const aus = () => testmodus.set({ aktiv: false, lat: null, lon: null, name: '', probe: '' })
</script>

<div class="wt">
  <button class="wt-kopf" aria-expanded={auf} onclick={() => (auf = !auf)}>{t('🧪 Testmodus')} {#if $testmodus.aktiv}<span>{t('aktiv')}</span>{/if}</button>
  {#if auf}
    <p>{t('Prüfe die Warnungen an einem erfundenen Standort. Echte Warnungen laufen weiter, Probe-Warnungen sind überall als PROBE markiert.')}</p>
    <span class="wt-f">{t('Standort')}{#if $testmodus.name}: <b>{$testmodus.name}</b>{/if}
      <OrtWahl {orte} reisen={$reisen} label={t('Standort suchen')} platzhalter={t('z. B. Exmouth')} onwahl={ortGewaehlt} />
    </span>
    <div class="wt-probe" role="group" aria-label={t('Probe-Warnung')}>
      {#each PROBEN as [id, name]}
        <button class:an={$testmodus.probe === id} aria-pressed={$testmodus.probe === id} onclick={() => setze({ probe: id })}>{name}</button>
      {/each}
    </div>
    {#if $testmodus.probe === 'route' && !$reisen.some((r) => r.route?.geometry?.length > 2 && r.art !== 'flug')}<p>{t('Dafür braucht es eine Route mit berechneter Strecke.')}</p>{/if}
    <div class="wt-knoepfe">
      <button class="btn-primary" disabled={$testmodus.lat == null || $testmodus.aktiv} onclick={() => setze({ aktiv: true })}>{t('Testmodus starten')}</button>
      <button class="btn" disabled={!$testmodus.aktiv && $testmodus.lat == null} onclick={aus}>{t('Beenden')}</button>
    </div>
  {/if}
</div>

<style>
  .wt { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); }
  .wt p { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); }
  .wt-kopf { align-self: flex-start; min-height: 40px; padding: 0; border: none; background: none; color: var(--ink); font-weight: 700; font-size: calc(14.5px * var(--schrift, 1)); cursor: pointer; }
  .wt-kopf span { margin-left: 6px; padding: 1px 8px; border-radius: 10px; background: var(--flaeche-2); font-size: calc(12px * var(--schrift, 1)); }
  .wt-f { display: flex; flex-direction: column; gap: 4px; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); font-weight: 700; }
  .wt-probe { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .wt-probe button { min-height: 44px; padding: 4px 8px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--flaeche); color: var(--btn-ink); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
  .wt-probe button.an { background: var(--brand); border-color: var(--brand); color: #fff; }
  .wt-knoepfe { display: flex; gap: 8px; }
</style>
