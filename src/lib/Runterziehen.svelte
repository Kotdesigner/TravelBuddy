<script>
  // V36: Runterziehen zum Aktualisieren (runterziehen.js). V37: statt eines Pfeils gleitet von oben eine kleine
  // Bühne herein, jedes Mal mit einer anderen Figur (runterziehen-figuren.js): Känguru, Koala, Bumerang, Camper,
  // Sonne über dem Uluru, Schlange. Beim Ziehen spannt sich die Figur, an der Schwelle ist sie bereit, beim Laden
  // bewegt sie sich, bis die App neu lädt. Bei „Bewegung reduzieren“ steht sie still.
  import { onMount, tick } from 'svelte'
  import { je } from './i18n.js'
  import { zugWeite, bereit, senkrecht, darfStarten, aktualisiereApp, SCHWELLE } from './runterziehen.js'
  import { naechsteFigur, baue, zeichne } from './runterziehen-figuren.js'

  let weite = $state(0)        // gedämpfte Zugweite in px
  let laeuft = $state(false)   // aktualisiert gerade
  let sichtbar = $state(false)
  let start = null             // { x, y } beim Aufsetzen, null = keine Geste
  let zieht = false            // Geste erkannt (senkrecht nach unten)
  let gesummt = false
  let buehne = $state(null)    // <g> in der Bühne
  let figur = 'kaenguru', teile = null, beginn = 0, los = 0, uhr = 0
  const ruhig = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  function malen() {
    if (!teile) return
    const jetzt = performance.now()
    zeichne(figur, teile, { ph: laeuft ? 'laden' : weite >= SCHWELLE ? 'bereit' : 'ziehen', pull: weite / SCHWELLE, t: jetzt - beginn, l: laeuft ? jetzt - los : 0 }, ruhig)
    uhr = sichtbar ? requestAnimationFrame(malen) : 0
  }
  async function zeigen() {
    sichtbar = true; figur = naechsteFigur(); beginn = performance.now()
    await tick()
    if (buehne) { teile = baue(buehne, figur); cancelAnimationFrame(uhr); uhr = requestAnimationFrame(malen) }
  }
  function verstecken() { sichtbar = false; weite = 0; teile = null; cancelAnimationFrame(uhr); uhr = 0 }

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
      zeigen()
    }
    if (e.cancelable) e.preventDefault()   // die Seite selbst bewegt sich dabei nicht
    weite = zugWeite(dy)
    if (bereit(dy) && !gesummt) { gesummt = true; try { navigator.vibrate?.(10) } catch {} }
  }
  async function ende() {
    if (!start) return
    const freigabe = zieht && weite >= SCHWELLE
    start = null; zieht = false
    if (!freigabe) { verstecken(); return }
    laeuft = true; weite = SCHWELLE; los = performance.now()
    const r = await aktualisiereApp()
    if (r !== 'neu') { laeuft = false; verstecken() }
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
      cancelAnimationFrame(uhr)
    }
  })
  const fertig = $derived(weite >= SCHWELLE)
  // Bühne gleitet bis zur Schwelle ganz herein, danach nur noch ein wenig
  const versatz = $derived(-140 + Math.min(weite, SCHWELLE) / SCHWELLE * 140 + Math.max(0, weite - SCHWELLE) * 0.3)
</script>

{#if sichtbar}
  <div class="rz" class:fertig={fertig || laeuft} style={`transform: translate(-50%, ${versatz.toFixed(1)}px)`} role="status" aria-live="polite">
    <svg class="rz-buehne" viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g bind:this={buehne}></g></svg>
    <span class="rz-text">{laeuft ? je('Aktualisiere …', 'Updating …') : fertig ? je('Loslassen zum Aktualisieren', 'Release to update') : je('Zum Aktualisieren ziehen', 'Pull to update')}</span>
  </div>
{/if}

<style>
  .rz { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 8px); z-index: 2500; width: min(360px, calc(100% - 24px));
    display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 10px 10px; border-radius: 18px;
    background: var(--card); border: 1px solid var(--line-stark); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22); pointer-events: none; overflow: hidden; }
  .rz-buehne { width: 100%; height: 84px; display: block; }
  .rz-text { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); transition: color 160ms; }
  .rz.fertig .rz-text { color: var(--brand-text); }
</style>
