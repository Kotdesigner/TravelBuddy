<script>
  import { t } from './i18n.js'
  let { warnung = '', liste = [], quellen = '', fussnote = '' } = $props()
</script>

{#if warnung}<div class="warn">{@html warnung}</div>{/if}
<ul class="liste">
  {#each liste as li}<li>{@html li}</li>{/each}
</ul>
{#if quellen}
  <div class="quellen"><b>{t('Quellen (Auswahl):')}</b> <span>{quellen}</span></div>
{/if}
{#if fussnote}<p class="fn">{fussnote}</p>{/if}

<style>
  .warn {
    background: #fbeee7; border-left: 4px solid #c0392b; padding: 12px 16px; border-radius: 0 8px 8px 0;
    font-size: calc(13.5px * var(--schrift, 1)); color: #6b3a2f; line-height: 1.6;
  }
  .warn :global(b) { color: #7a2317; }
  .liste { padding-left: 20px; margin: 16px 0; }
  .liste li { font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); margin-bottom: 9px; line-height: 1.55; }
  .liste :global(b) { color: var(--ink); }
  .quellen { margin-top: 18px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); line-height: 1.6; background: var(--flaeche); padding: 12px 14px; border-radius: 8px; }
  .fn { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 14px; line-height: 1.6; }
</style>
