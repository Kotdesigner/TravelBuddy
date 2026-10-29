<script>
  import { blattRaus, ausblenden } from './motion.js'
  import { dialogAnfrage } from './dialog.js'
  import { modal } from './modal.js'
  import { haptic } from './haptik.js'
  const d = $derived($dialogAnfrage)
  $effect(() => { if (d?.gefahr) haptic() })
</script>

{#if d}
  <div class="dh-hg" out:ausblenden data-dialog-hg onclick={() => d.antwort(false)} aria-hidden="true"></div>
  <div class="dh" out:ausblenden={{ skala: 0.96 }} role="alertdialog" aria-labelledby={d.titel ? 'dh-titel' : undefined} aria-describedby={d.text ? 'dh-text' : undefined}
    use:modal={{ onclose: () => d.antwort(false), fokus: d.gefahr ? '.dh-nein' : '.dh-ja' }}>
    {#if d.titel}<h2 id="dh-titel">{d.titel}</h2>{/if}
    {#if d.text}<p id="dh-text">{d.text}</p>{/if}
    <div class="dh-knoepfe" class:einzeln={!d.nein}>
      {#if d.nein}<button class="dh-nein" onclick={() => d.antwort(false)}>{d.nein}</button>{/if}
      <button class="dh-ja" class:gefahr={d.gefahr} onclick={() => d.antwort(true)}>{d.ja}</button>
    </div>
  </div>
{/if}

<style>
  .dh-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.42); z-index: 140; animation: hg var(--t-med) var(--ease-out); }
  .dh {
    position: fixed; z-index: 141; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - 40px)); max-height: 86vh; max-height: 86dvh; overflow: auto; overscroll-behavior: contain;
    background: var(--card); color: var(--ink);
    border-radius: var(--radius-l); box-shadow: var(--shadow-float); padding: 22px 20px 16px;
    animation: rein var(--t-med) var(--ease-spring);
  }
  h2 { margin: 0 0 6px; font-size: calc(18px * var(--schrift, 1)); line-height: 1.3; }
  p { margin: 0 0 16px; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); white-space: pre-line; }
  .dh-knoepfe { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .dh-knoepfe.einzeln { grid-template-columns: 1fr; }
  .dh-knoepfe button { min-height: 48px; border-radius: var(--radius-m); font-size: calc(16px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .dh-nein { background: var(--flaeche-2); color: var(--ink); border: 1px solid var(--line); }
  .dh-ja { background: var(--brand); color: #fff; border: none; }
  .dh-ja.gefahr { background: var(--danger); }
  @keyframes hg { from { opacity: 0; } }
  @keyframes rein { from { opacity: 0; transform: translate(-50%, -46%) scale(0.97); } }
</style>
