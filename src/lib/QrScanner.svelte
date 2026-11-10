<script>
  // Kamera auf, QR-Code lesen. Erst der eingebaute BarcodeDetector (Chrome, Android), sonst jsQR
  // (Apache-2.0, erst beim Scannen geladen), denn Safari am iPhone kann QR-Codes nicht selbst lesen.
  // Nichts verlässt das Gerät: Die Bilder bleiben im Speicher und werden nicht gesichert.
  import { onDestroy } from 'svelte'
  import { je } from './i18n.js'
  import { modal } from './modal.js'

  let { ontreffer = () => {}, onclose = () => {} } = $props()

  let video = $state(null)
  let fehler = $state('')
  let laeuft = false, strom = null, rahmen = 0, leser = null, zu_ = false
  const leinwand = typeof document !== 'undefined' ? document.createElement('canvas') : null

  async function start() {
    // Kamera gibt es im Browser nur über https (oder localhost)
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fehler = je('Die Kamera geht hier nur über eine sichere Verbindung (https). Scanne den Code mit der Kamera-App.', 'The camera only works here over a secure connection (https). Scan the code with the camera app.')
      return
    }
    let s
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    } catch {
      if (!zu_) fehler = je('Die Kamera ist nicht freigegeben. Erlaube sie in den Einstellungen des Browsers oder scanne den Code mit der Kamera-App.', 'The camera is not allowed. Allow it in the browser settings or scan the code with the camera app.')
      return
    }
    // Schon geschlossen, während die Freigabe lief: Kamera sofort wieder aus
    if (zu_ || !video) { s.getTracks().forEach((t) => t.stop()); return }
    strom = s
    video.srcObject = strom
    await video.play().catch(() => {})
    if (zu_) { stopp(); return }
    // Eingebauter Leser nur, wenn er QR-Codes auch wirklich kann, sonst jsQR
    if ('BarcodeDetector' in globalThis) {
      try {
        const formate = await globalThis.BarcodeDetector.getSupportedFormats?.()
        if (!formate || formate.includes('qr_code')) { const d = new globalThis.BarcodeDetector({ formats: ['qr_code'] }); leser = async (v) => (await d.detect(v))[0]?.rawValue || null }
      } catch { leser = null }
    }
    if (!leser) { jsqrAktiv = true; leser = await jsqrLeser() }
    laeuft = true
    schleife()
  }
  let jsqrAktiv = false
  async function jsqrLeser() {
      const jsQR = (await import('jsqr')).default
      const ctx = leinwand.getContext('2d', { willReadFrequently: true })
      return async (v) => {
        const w = v.videoWidth, h = v.videoHeight
        if (!w || !h) return null
        const s = Math.min(1, 640 / Math.max(w, h))
        leinwand.width = Math.round(w * s); leinwand.height = Math.round(h * s)
        ctx.drawImage(v, 0, 0, leinwand.width, leinwand.height)
        const bild = ctx.getImageData(0, 0, leinwand.width, leinwand.height)
        return jsQR(bild.data, bild.width, bild.height, { inversionAttempts: 'dontInvert' })?.data || null
      }
  }
  async function schleife() {
    if (!laeuft) return
    try {
      const t = video?.readyState >= 2 ? await leser(video) : null
      if (t) { stopp(); ontreffer(t); return }
    } catch {
      // Der eingebaute Leser streikt: einmal auf jsQR wechseln statt endlos leer zu laufen
      if (!jsqrAktiv) { jsqrAktiv = true; leser = await jsqrLeser() }
    }
    rahmen = setTimeout(schleife, 180)
  }
  function stopp() {
    laeuft = false
    clearTimeout(rahmen)
    strom?.getTracks().forEach((t) => t.stop())
    strom = null
  }
  function zu() { zu_ = true; stopp(); onclose() }
  $effect(() => { if (video) start() })
  onDestroy(() => { zu_ = true; stopp() })
</script>

<div class="qs-hg" data-dialog-hg aria-hidden="true" onclick={zu}></div>
<div class="qs" role="dialog" aria-label={je('Code scannen', 'Scan code')} use:modal={{ onclose: zu, fokus: '.qs-zu' }}>
  <p class="qs-t">{je('Halte die Kamera auf einen TravelBuddy-Code.', 'Point the camera at a TravelBuddy code.')}</p>
  {#if fehler}
    <p class="qs-f" role="alert">{fehler}</p>
  {:else}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline muted></video>
  {/if}
  <button class="bedien-knopf qs-zu" onclick={zu}>{je('Schließen', 'Close')}</button>
</div>

<style>
  .qs-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.7); }
  .qs { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(380px, calc(100% - 28px)); padding: 16px; border-radius: 18px;
    background: var(--card); color: var(--ink); border: 1px solid var(--line-stark); display: flex; flex-direction: column; gap: 12px; }
  .qs-t { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .qs-f { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--warn-text, var(--ink)); }
  video { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; background: #000; }
</style>
