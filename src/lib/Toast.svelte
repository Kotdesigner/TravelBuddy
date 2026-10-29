<script>
  // Toast-Anzeige: schwebt über der Bottom-Bar (mobil) bzw. unten rechts (Desktop).
  import { toasts } from './toast.js'
  import { fly } from 'svelte/transition'
  import { dauer } from './motion.js'

  const ICON = { ok: '✓', fehler: '✕', info: 'ℹ' }
</script>

<div class="toasts" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div class="toast {t.typ}" transition:fly={{ y: 14, duration: dauer(220) }}>
      <span class="t-ikon">{ICON[t.typ] || 'ℹ'}</span>{t.text}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed; left: 50%; transform: translateX(-50%);
    bottom: calc(126px + env(safe-area-inset-bottom, 0px));
    z-index: var(--z-overlay); display: flex; flex-direction: column; gap: 8px;
    align-items: center; pointer-events: none; width: max-content; max-width: 92vw;
  }
  .toast {
    display: inline-flex; align-items: center; gap: 9px;
    background: #2b2621; color: #fff; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700;
    padding: 11px 18px; border-radius: 22px; box-shadow: var(--shadow-float);
    max-width: 92vw;
  }
  .t-ikon {
    width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 800; background: rgba(255, 255, 255, 0.18);
  }
  .toast.ok .t-ikon { background: var(--ok); }
  .toast.fehler .t-ikon { background: var(--danger); }
  @media (min-width: 900px) {
    .toasts { left: auto; right: 24px; transform: none; bottom: 84px; align-items: flex-end; }
  }
</style>
