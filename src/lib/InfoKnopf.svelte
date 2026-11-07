<script>
  // V18: Kleiner ⓘ-Knopf neben einer Überschrift. Öffnet ein Blatt mit zwei, drei Sätzen aus hilfe.js:
  // was das ist, wofür, womit es zusammenhängt, dazu „Im Handbuch nachlesen“.
  import { je } from './i18n.js'
  import { HILFE, handbuchTeil } from './hilfe.js'
  import { modal } from './modal.js'
  import Zusammenhang from './Zusammenhang.svelte'

  let { id } = $props()
  const h = $derived(HILFE[id])
  let offen = $state(false)
  const zu = () => (offen = false)
  function handbuch() {
    handbuchTeil.set(h.teil)
    offen = false
    location.hash = '#/mehr/handbuch'
  }
</script>

{#if h}
  <button type="button" class="ik" onclick={(e) => { e.stopPropagation(); offen = true }} aria-label={je(`Was heißt „${h.titel}“?`, `What is “${h.titel}”?`)} aria-haspopup="dialog"><span aria-hidden="true">i</span></button>
  {#if offen}
    <div class="ik-hg" data-dialog-hg aria-hidden="true" onclick={zu}></div>
    <div class="ik-blatt" role="dialog" aria-labelledby="ik-{id}" use:modal={{ onclose: zu }}>
      <h2 id="ik-{id}">{h.titel}</h2>
      <!-- Ein Absatz ist Text oder [Stichwort, Text]: dann steht das Stichwort fett vorn (1.27, „Was baut worauf auf“) -->
      {#each h.text as absatz}<p>{#if Array.isArray(absatz)}<b>{absatz[0]}:</b> {absatz[1]}{:else}{absatz}{/if}</p>{/each}
      {#if h.bild}<Zusammenhang />{/if}
      <div class="ik-knoepfe">
        {#if h.teil}<button type="button" class="btn btn-ghost" onclick={handbuch}>{je(`Im Handbuch nachlesen (Teil ${h.teil})`, `Read more in the manual (part ${h.teil})`)}</button>{/if}
        <button type="button" class="btn-primary" onclick={zu}>{je('Verstanden', 'Got it')}</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* Sichtbar klein (22 px), Trefferfläche 44 px wie die anderen kleinen Knöpfe */
  .ik { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; margin: 0 0 0 6px; vertical-align: middle; flex: none;
    border: 1.5px solid var(--brand-text); border-radius: 50%; background: none; color: var(--brand-text); cursor: pointer;
    font: italic 800 calc(13px * var(--schrift, 1)) / 1 Georgia, 'Times New Roman', serif; }
  .ik::after { content: ''; position: absolute; inset: -11px; }
  .ik:hover { background: var(--flaeche); }
  .ik-hg { position: fixed; inset: 0; z-index: 900; background: rgba(20, 14, 8, 0.45); }
  .ik-blatt { position: fixed; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 901; transform: translateX(-50%); width: min(480px, calc(100% - 24px)); max-height: calc(100dvh - 40px); overflow: auto;
    display: flex; flex-direction: column; gap: 10px; padding: 18px; border-radius: var(--radius-l); background: var(--card); color: var(--ink); box-shadow: var(--shadow-float); text-align: left; font-weight: 400; }
  h2 { margin: 0; font-size: calc(18px * var(--schrift, 1)); }
  p { margin: 0; font-size: calc(14.5px * var(--schrift, 1)); line-height: 1.5; color: var(--ink); }
  .ik-knoepfe { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  @media (min-width: 900px) { .ik-blatt { top: 50%; bottom: auto; transform: translate(-50%, -50%); } }
</style>
