<script>
  import { t } from './i18n.js'
  let { tour } = $props()
</script>

{#if tour}
  <div class="flex">
    <div class="map">
      {@html tour.svg}
      {#each tour.legende as l}
        <div class="leg"><span class="swatch" style={l.stil}></span> {l.text}</div>
      {/each}
    </div>
    <div class="text">
      <h3>{t('Das Konzept')}</h3>
      {@html tour.text}
    </div>
  </div>
{/if}

<style>
  .flex { display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start; }
  .map { flex: 0 0 300px; }
  .map :global(svg) { width: 100%; height: auto; display: block; }
  .leg { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 6px; display: flex; align-items: center; gap: 8px; }
  .swatch { width: 22px; height: 8px; border-radius: 3px; display: inline-block; flex: 0 0 auto; }
  .text { flex: 1 1 320px; }
  .text h3 { color: var(--brand-text); margin: 0 0 8px; }
  .text :global(p) { font-size: calc(14px * var(--schrift, 1)); color: var(--muted); margin: 0 0 10px; }
  .text :global(b) { color: var(--ink); }
  @media (max-width: 520px) { .map { flex: 1 1 100%; } }
</style>
