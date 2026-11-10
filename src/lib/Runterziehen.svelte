<script>
  // V36: Runterziehen zum Aktualisieren (runterziehen.js). Ganz oben nach unten ziehen: ein runder Pfeil kommt
  // von oben mit, ab der Schwelle dreht er sich und es heißt „Loslassen zum Aktualisieren“. Loslassen lädt neu.
  import { onMount } from 'svelte'
  import { je } from './i18n.js'
  import { zugWeite, bereit, senkrecht, darfStarten, aktualisiereApp, SCHWELLE } from './runterziehen.js'

  let weite = $state(0)        // gedämpfte Zugweite in px
  let laeuft = $state(false)   // aktualisiert gerade
  let start = null             // { x, y } beim Aufsetzen, null = keine Geste
  let zieht = false            // Geste erkannt (senkrecht nach unten)
  let gesummt = false

  function anfang(e) {
    if (laeuft || e.touches.length !== 1) { start = null; return }
    start = darfStarten(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
    zieht = false; gesummt = false
  }
  function bewegt(e) {
    if (!start) return
    const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y
    if (!zieht) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      if (!senkrecht(dx, dy) || (globalThis.scrollY || 0) > 0) { start = null; return }
      zieht = true
    }
    if (e.cancelable) e.preventDefault()   // die Seite selbst bewegt sich dabei nicht
    weite = zugWeite(dy)
    if (bereit(dy) && !gesummt) { gesummt = true; try { navigator.vibrate?.(10) } catch {} }
  }
  async function ende() {
    if (!start) return
    const los = zieht && weite >= SCHWELLE
    start = null; zieht = false
    if (!los) { weite = 0; return }
    laeuft = true; weite = SCHWELLE
    const r = await aktualisiereApp()
    if (r !== 'neu') { laeuft = false; weite = 0 }
  }
  onMount(() => {
    const o = { passive: false }
    document.addEventListener('touchstart', anfang, { passive: true })
    document.addEventListener('touchmove', bewegt, o)
    document.addEventListener('touchend', ende, { passive: true })
    document.addEventListener('touchcancel', ende, { passive: true })
    return () => {
      document.removeEventListener('touchstart', anfang)
      document.removeEventListener('touchmove', bewegt, o)
      document.removeEventListener('touchend', ende)
      document.removeEventListener('touchcancel', ende)
    }
  })
  const fertig = $derived(weite >= SCHWELLE)
</script>

{#if weite > 0 || laeuft}
  <div class="rz" style={`--weite: ${weite}px`} role="status" aria-live="polite">
    <span class="rz-kreis" class:fertig class:laeuft aria-hidden="true">
      {#if laeuft}<span class="rz-dreh"></span>{:else}<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 4v13m0 0-5-5m5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
    </span>
    <span class="rz-text">{laeuft ? je('Aktualisiere …', 'Updating …') : fertig ? je('Loslassen zum Aktualisieren', 'Release to update') : je('Zum Aktualisieren ziehen', 'Pull to update')}</span>
  </div>
{/if}

<style>
  .rz { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) - 52px); z-index: 2500; display: flex; flex-direction: column; align-items: center; gap: 6px;
    transform: translate(-50%, var(--weite)); pointer-events: none; }
  .rz-kreis { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--card); color: var(--brand-text); border: 1px solid var(--line-stark);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22); transition: transform 160ms var(--ease-out, ease-out), background-color 160ms; }
  .rz-kreis.fertig { transform: rotate(180deg); background: var(--brand); color: #fff; border-color: var(--brand); }
  .rz-dreh { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid currentColor; border-right-color: transparent; animation: rz-drehen 0.8s linear infinite; }
  .rz-kreis.laeuft { transform: none; background: var(--brand); color: #fff; border-color: var(--brand); }
  .rz-text { padding: 3px 10px; border-radius: 999px; background: var(--card); color: var(--ink); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18); white-space: nowrap; }
  @keyframes rz-drehen { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .rz-kreis { transition: none; } .rz-dreh { animation-duration: 2.4s; } }
</style>
