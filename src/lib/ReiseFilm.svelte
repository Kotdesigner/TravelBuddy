<script>
  import { t, LOCALE, tn } from './i18n.js'
  // Reise-Film: ein kurzes Video im Hochformat aus der Reise. Titel, je Etappe ein
  // Flug über die Weltkugel, die Route zeichnet sich ein, bis zu drei Fotos aus dem Logbuch,
  // am Ende die Bilanz. Gemalt wird auf ein eigenes Canvas (globus.js, kein MapLibre),
  // aufgenommen mit captureStream + MediaRecorder in Echtzeit.
  // Auch bei „Bewegung reduzieren“ erlaubt: das ist ein Export, nichts bewegt sich in der App.
  import { onDestroy } from 'svelte'
  import { modal } from './modal.js'
  import { blattRaus, ausblenden } from './motion.js'
  import { haptic } from './haptik.js'
  import { gesamtStart } from './userdata.js'
  import { filmDaten, waehleFormat, endung, FPS, BREITE, HOEHE } from './reisefilm.js'
  import { baueFilm } from './reisefilm-zeichnen.js'

  let { reisen = [], journal = [], schliessen = () => {} } = $props()

  const daten = $derived(filmDaten({ reisen, journal, gesamtStart: $gesamtStart }))
  const fotoZahl = $derived(daten.zeitplan.szenen.filter((s) => s.typ === 'foto').length)
  const kannAufnehmen = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
  const format = kannAufnehmen ? waehleFormat((m) => MediaRecorder.isTypeSupported(m)) : null
  const formatName = format ? (endung(format) === 'mp4' ? 'MP4' : 'WebM') : ''

  let phase = $state('start')          // start | vorbereiten | aufnahme | fertig | fehler
  let fortschritt = $state(0)          // 0..1
  let sekunden = $state(0)
  let pausiert = $state(false)
  let meldung = $state('')
  let video = $state(null)             // { url, datei, groesse }
  let leinwand = $state()

  let rec = null, strom = null, sperre = null, rafId = 0, abgebrochen = false

  // Im <body> anzeigen: Vorfahren mit transform würden sonst position: fixed einfangen
  function anBody(node) {
    document.body.appendChild(node)
    return { destroy() { node.remove() } }
  }

  async function wachHalten() {
    try { sperre = await navigator.wakeLock?.request('screen') } catch { sperre = null }
  }
  function aufraeumen() {
    cancelAnimationFrame(rafId)
    document.removeEventListener('visibilitychange', sichtbarkeit)
    try { strom?.getTracks().forEach((t) => t.stop()) } catch {}
    strom = null
    try { sperre?.release() } catch {}
    sperre = null
  }
  function sichtbarkeit() {
    if (!rec || phase !== 'aufnahme') return
    if (document.visibilityState === 'hidden') {
      pausiert = true
      try { if (rec.state === 'recording') rec.pause() } catch {}
    } else {
      try { if (rec.state === 'paused') rec.resume() } catch {}
      pausiert = false
      wachHalten()
    }
  }

  async function aufnehmen() {
    if (!kannAufnehmen || !format || !leinwand) return
    haptic()
    abgebrochen = false; meldung = ''; fortschritt = 0; sekunden = 0; pausiert = false
    freigeben()
    phase = 'vorbereiten'
    let film
    try {
      film = baueFilm(daten, leinwand, { breite: BREITE, hoehe: HOEHE })
      await film.vorbereiten((p) => (fortschritt = p))
      film.zeichne(0)
    } catch (e) {
      phase = 'fehler'; meldung = t('Der Film ließ sich nicht vorbereiten. ') + (e?.message || ''); return
    }
    if (abgebrochen) return
    const teile = []
    try {
      strom = leinwand.captureStream(FPS)
      rec = new MediaRecorder(strom, { mimeType: format, videoBitsPerSecond: 6_000_000 })
    } catch (e) {
      aufraeumen()
      phase = 'fehler'; meldung = t('Die Aufnahme ließ sich nicht starten. ') + (e?.message || ''); return
    }
    rec.ondataavailable = (e) => { if (e.data?.size) teile.push(e.data) }
    rec.onstop = () => {
      aufraeumen()
      if (abgebrochen) { phase = 'start'; rec = null; return }
      const typ = format.split(';')[0]
      const blob = new Blob(teile, { type: typ })
      if (!blob.size) { phase = 'fehler'; meldung = t('Die Aufnahme ist leer geblieben. Bitte noch einmal versuchen und die App dabei offen lassen.'); return }
      const name = `Reisefilm_Westaustralien.${endung(format)}`
      const datei = new File([blob], name, { type: typ })
      video = { url: URL.createObjectURL(blob), datei, groesse: blob.size, name }
      phase = 'fertig'
      rec = null
      haptic([10, 40, 10])
    }
    await wachHalten()
    document.addEventListener('visibilitychange', sichtbarkeit)
    phase = 'aufnahme'
    rec.start(1000)
    // Uhr läuft nur, solange die App sichtbar ist
    let zeit = 0, zuletzt = performance.now()
    const schritt = (jetzt) => {
      if (abgebrochen || !rec) return
      const dt = Math.min(0.1, (jetzt - zuletzt) / 1000)
      zuletzt = jetzt
      if (!pausiert) zeit += dt
      film.zeichne(zeit)
      sekunden = Math.min(film.gesamt, zeit)
      fortschritt = Math.min(1, zeit / film.gesamt)
      if (zeit >= film.gesamt + 0.25) { try { rec.stop() } catch {} return }
      rafId = requestAnimationFrame(schritt)
    }
    rafId = requestAnimationFrame(schritt)
  }

  function abbrechen() {
    abgebrochen = true
    haptic()
    if (rec && rec.state !== 'inactive') { try { rec.stop() } catch { aufraeumen(); phase = 'start' } }
    else { aufraeumen(); phase = 'start' }
  }
  function freigeben() {
    if (video?.url) URL.revokeObjectURL(video.url)
    video = null
  }

  const kannTeilen = $derived(!!(video && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [video.datei] })))
  async function teilen() {
    if (!video) return
    haptic()
    try { await navigator.share({ files: [video.datei], title: t('Reise-Film Westaustralien') }) }
    catch (e) { if (e?.name !== 'AbortError') meldung = t('Teilen hat nicht geklappt. Speichere den Film und teile ihn dann aus den Fotos oder Dateien.') }
  }

  function zu() {
    if (phase === 'aufnahme' || phase === 'vorbereiten') abbrechen()
    schliessen()
  }
  onDestroy(() => {
    abgebrochen = true
    try { if (rec && rec.state !== 'inactive') rec.stop() } catch {}
    aufraeumen()
    freigeben()
  })

  const mb = (n) => (n / 1048576).toLocaleString(LOCALE, { maximumFractionDigits: 1 })
  const s = (n) => Math.round(n)
</script>

<div class="rf-wurzel" use:anBody>
  <div class="rf-hg" out:ausblenden data-dialog-hg onclick={zu} aria-hidden="true"></div>
  <div class="rf" out:blattRaus role="dialog" aria-labelledby="rf-titel" use:modal={{ onclose: zu }}>
    <div class="rf-griff" aria-hidden="true"></div>
    <div class="rf-kopf">
      <h2 id="rf-titel">{t('🎬 Reise-Film')}</h2>
      <button class="rf-zu" onclick={zu} aria-label={t('Schließen')}>✕</button>
    </div>

    {#if !kannAufnehmen || !format}
      <p class="rf-hinweis warn" role="alert">{t('Dieser Browser kann keine Videos aufnehmen. Am iPhone klappt es in Safari ab iOS 14.5, am Mac in Safari, Chrome oder Firefox.')}</p>
    {:else if !daten.etappen.length}
      <p class="rf-hinweis">{t('Im Plan gibt es noch keine Etappen. Sobald du welche angelegt hast, entsteht daraus der Film.')}</p>
    {/if}

    <div class="rf-buehne" class:sichtbar={phase === 'vorbereiten' || phase === 'aufnahme'}>
      <canvas bind:this={leinwand} width={BREITE} height={HOEHE} class="rf-leinwand" aria-label={t('Vorschau der Aufnahme')}></canvas>
    </div>

    {#if phase === 'start' || phase === 'fehler'}
      <p class="rf-text">{t('Ein Video im Hochformat aus deiner Reise: Titel, für jede Etappe ein Flug über die Weltkugel, die Route und bis zu drei Fotos aus dem Logbuch. Am Ende die Bilanz.')}</p>
      {#if daten.etappen.length}
        <ul class="rf-fakten">
          <li><b>{s(daten.zeitplan.gesamt)} s</b><span>{t('Länge')}</span></li>
          <li><b>{daten.etappen.length}</b><span>{tn(daten.etappen.length, 'Etappe', 'Etappen')}</span></li>
          <li><b>{fotoZahl}</b><span>{tn(fotoZahl, 'Foto', 'Fotos')}</span></li>
          {#if formatName}<li><b>{formatName}</b><span>{BREITE} × {HOEHE}</span></li>{/if}
        </ul>
        <p class="rf-hinweis">{t('Die Aufnahme läuft in Echtzeit. Lass die App so lange offen und im Vordergrund, sonst hält sie an.')}</p>
      {/if}
      {#if meldung}<p class="rf-hinweis warn" role="alert">{meldung}</p>{/if}
      <button class="btn-primary rf-los" onclick={aufnehmen} disabled={!kannAufnehmen || !format || !daten.etappen.length}>{t('Film aufnehmen')}</button>
    {:else if phase === 'vorbereiten' || phase === 'aufnahme'}
      <div class="rf-stand" aria-live="polite">
        <div class="rf-balken" role="progressbar" aria-label={t('Fortschritt')} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(fortschritt * 100)}>
          <span style="transform: scaleX({fortschritt})"></span>
        </div>
        <p class="rf-zeit">
          {#if phase === 'vorbereiten'}{t('Fotos und Weltkugeln werden vorbereitet …')}
          {:else if pausiert}{t('Angehalten, solange die App im Hintergrund ist.')}
          {:else}{t('Aufnahme läuft: {s} von {s2} s', { s: s(sekunden), s2: s(daten.zeitplan.gesamt) })}{/if}
        </p>
      </div>
      <p class="rf-hinweis">{t('Bitte die App offen lassen, bis der Film fertig ist.')}</p>
      <button class="btn rf-ab" onclick={abbrechen}>{t('Abbrechen')}</button>
    {:else if phase === 'fertig' && video}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video class="rf-video" src={video.url} controls playsinline aria-label={t('Fertiger Reise-Film')}></video>
      <p class="rf-zeit">{t('Fertig: {formatName}, {mb} MB', { formatName, mb: mb(video.groesse) })}</p>
      {#if meldung}<p class="rf-hinweis warn" role="alert">{meldung}</p>{/if}
      <div class="rf-aktionen">
        {#if kannTeilen}<button class="btn-primary" onclick={teilen}>{t('Teilen')}</button>{/if}
        <a class={kannTeilen ? 'btn' : 'btn-primary'} href={video.url} download={video.name} onclick={() => haptic()}>{t('Speichern')}</a>
        <button class="btn btn-ghost" onclick={aufnehmen}>{t('Neu aufnehmen')}</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .rf-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.45); z-index: 130; animation: hg var(--t-med) var(--ease-out); }
  .rf {
    position: fixed; z-index: 131; left: 0; right: 0; bottom: 0; max-height: 94dvh; overflow: auto; overscroll-behavior: contain;
    background: var(--bg); color: var(--ink); border-radius: 22px 22px 0 0; box-shadow: var(--shadow-float);
    padding: 8px 18px calc(18px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 12px;
    animation: hoch var(--t-slow) var(--ease-spring);
  }
  @media (min-width: 900px) {
    .rf { left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); width: 520px; border-radius: var(--radius-l); padding: 18px 22px 20px; animation: rein var(--t-med) var(--ease-spring); }
    .rf-griff { display: none; }
  }
  .rf-griff { width: 40px; height: 5px; border-radius: 3px; background: var(--line-stark); align-self: center; margin-bottom: 4px; }
  .rf-kopf { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: calc(20px * var(--schrift, 1)); }
  .rf-zu { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--flaeche-2); color: var(--ink); font-size: calc(16px * var(--schrift, 1)); cursor: pointer; }
  .rf-text { margin: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.55; text-wrap: pretty; }
  .rf-hinweis { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.5; color: var(--muted); background: var(--flaeche); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 10px 12px; }
  .rf-hinweis.warn { color: var(--warn-text); background: var(--warn-flaeche); border-color: color-mix(in srgb, var(--warn) 45%, transparent); }
  .rf-fakten { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .rf-fakten li { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
  .rf-fakten b { font-size: calc(17px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .rf-fakten span { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .rf-los { min-height: 52px; font-size: calc(16px * var(--schrift, 1)); }

  /* Die Leinwand bleibt im Dokument (Safari nimmt sonst nichts auf), sichtbar nur beim Aufnehmen */
  .rf-buehne { display: flex; justify-content: center; }
  .rf-buehne:not(.sichtbar) { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
  .rf-leinwand { height: min(52dvh, 480px); width: auto; aspect-ratio: 9 / 16; border-radius: 14px; background: #050b17; box-shadow: var(--shadow-float); }

  .rf-stand { display: flex; flex-direction: column; gap: 8px; }
  .rf-balken { height: 8px; border-radius: 4px; background: var(--flaeche-2); overflow: hidden; }
  .rf-balken span { display: block; height: 100%; background: var(--brand); transform-origin: 0 50%; }
  .rf-zeit { margin: 0; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; color: var(--ink); text-align: center; font-variant-numeric: tabular-nums; }
  .rf-ab { align-self: center; min-width: 160px; }

  .rf-video { width: auto; max-width: 100%; height: min(56dvh, 520px); align-self: center; border-radius: 14px; background: #050b17; }
  .rf-aktionen { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  .rf-aktionen > * { flex: 1 1 140px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }

  @keyframes hg { from { opacity: 0; } }
  @keyframes hoch { from { transform: translateY(40px); opacity: 0.4; } }
  @keyframes rein { from { opacity: 0; transform: translate(-50%, -47%); } }
</style>
