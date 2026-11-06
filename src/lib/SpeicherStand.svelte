<script>
  // Kleine Zeile unter „Mehr“: wie viel Platz TravelBuddy auf diesem Gerät belegt, wie viel noch
  // frei ist und ob der Browser die Daten vor dem automatischen Aufräumen schützt.
  import { onMount } from 'svelte'
  import { t } from './i18n.js'
  import { groesseText } from './tagebuch-fotos.js'
  import { speicherProblem } from './userdata.js'

  let stand = $state(null)

  async function lesen() {
    try {
      const s = navigator.storage
      if (!s?.estimate) return
      const [e, geschuetzt] = await Promise.all([s.estimate(), s.persisted ? s.persisted().catch(() => null) : null])
      stand = { belegt: e.usage || 0, frei: e.quota ? Math.max(0, e.quota - (e.usage || 0)) : null, geschuetzt }
    } catch {}
  }
  async function schuetzen() {
    try { await navigator.storage?.persist?.() } catch {}
    lesen()
  }
  onMount(lesen)
  // Nach einem Speicherfehler oder wenn er behoben ist, neu messen
  $effect(() => { $speicherProblem; lesen() })
</script>

{#if stand}
  <p class="ss" class:knapp={stand.frei != null && stand.frei < 200 * 1048576}>
    <span>{t('Speicher auf diesem Gerät: {belegt} belegt', { belegt: groesseText(stand.belegt) })}{#if stand.frei != null}{t(', noch {frei} frei', { frei: groesseText(stand.frei) })}{/if}.</span>
    {#if stand.geschuetzt === true}
      <span class="ss-gut">{t('Vor dem automatischen Löschen geschützt ✓')}</span>
    {:else if stand.geschuetzt === false}
      <span>{t('Der Browser darf die Daten bei Platzmangel löschen.')} <button class="ss-link" onclick={schuetzen}>{t('Schutz anfragen')}</button></span>
    {/if}
  </p>
{/if}

<style>
  .ss { margin: 14px 0 0; max-width: 520px; display: flex; flex-direction: column; gap: 2px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .ss.knapp { color: var(--warn-text); }
  .ss-gut { color: var(--ink); }
  .ss-link { background: none; border: 0; padding: 0 0 0 2px; min-height: 0; font: inherit; color: var(--accent); text-decoration: underline; cursor: pointer; }
</style>
