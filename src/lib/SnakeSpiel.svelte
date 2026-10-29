<script>
  import { t, tn } from './i18n.js'
  // Verstecktes Mini-Spiel 2 (Easter-Egg,): „snake" in die Suche.
  // Spielfeld ≈ ¾ des Bildschirms mit fester Bande — kein Durchtauchen, Rand berührt = Ende.
  // Steuerung: Wischen auf dem Feld oder Steuerkreuz darunter (iPhone), Pfeiltasten/WASD (Mac).
  // Leertaste oder P = Pause, Enter = nochmal, Escape = schließen. Rekord je Gerät.
  // Spielregeln: lib/snake.js (getestet in tests/snake.test.mjs).
  import { onMount, tick } from 'svelte'
  import { modal } from './modal.js'
  import { haptic } from './haptik.js'
  import { neuesSpiel, schritt, lenke, takt, raster } from './snake.js'

  let { onClose } = $props()

  const REKORD_KEY = 'wa-snake-rekord-v1'
  const leseRekord = () => { try { return Number(localStorage.getItem(REKORD_KEY)) || 0 } catch { return 0 } }
  let rekord = $state(leseRekord())
  let neuerRekord = $state(false)

  let karte = $state(), feldEl = $state(), bandeEl = $state(), canvas = $state()
  let r = { zelle: 0, spalten: 0, zeilen: 0 }
  let z = $state.raw(null)
  let phase = $state('bereit')     // bereit | laeuft | pause | vorbei
  let ansage = $state('')          // für VoiceOver
  let timer = null
  const farben = {}

  const punkte = $derived(z?.punkte ?? 0)
  const GRUND = { bande: t('💥 Gegen die Bande!'), selbst: t('💥 Selbst gebissen!'), gewonnen: t('🏆 Alles gefressen!') }

  // ---------- Zeichnen ----------
  function leseFarben() {
    const cs = getComputedStyle(feldEl)
    for (const k of ['boden', 'kachel', 'schlange', 'kopf', 'auge']) farben[k] = cs.getPropertyValue('--sn-' + k).trim()
  }

  function vermessen() {
    if (!feldEl || !canvas) return false
    const rand = 2 * 4   // Bande: 4 px je Seite
    const b = feldEl.getBoundingClientRect()
    const neu = raster(Math.max(0, b.width - rand), Math.max(0, b.height - rand))
    const anders = neu.spalten !== r.spalten || neu.zeilen !== r.zeilen || neu.zelle !== r.zelle
    r = neu
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const w = r.spalten * r.zelle, h = r.zeilen * r.zelle
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
    leseFarben()
    return anders
  }

  function rund(c, x, y, w, h, rad) {
    c.beginPath()
    if (c.roundRect) c.roundRect(x, y, w, h, rad)
    else c.rect(x, y, w, h)
  }

  function zeichne() {
    const c = canvas?.getContext('2d')
    if (!c || !z) return
    const s = r.zelle, W = r.spalten * s, H = r.zeilen * s
    c.fillStyle = farben.boden; c.fillRect(0, 0, W, H)
    c.fillStyle = farben.kachel
    for (let y = 0; y < r.zeilen; y++) for (let x = y % 2; x < r.spalten; x += 2) c.fillRect(x * s, y * s, s, s)

    if (z.futter) {
      c.font = `${Math.floor(s * 0.9)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('🐁', z.futter.x * s + s / 2, z.futter.y * s + s / 2 + 1)
    }
    for (let i = z.schlange.length - 1; i >= 0; i--) {
      const t = z.schlange[i]
      c.fillStyle = i === 0 ? farben.kopf : farben.schlange
      rund(c, t.x * s + 1, t.y * s + 1, s - 2, s - 2, s * 0.32); c.fill()
    }
    // Augen in Fahrtrichtung
    const k = z.schlange[0], d = { hoch: [0, -1], runter: [0, 1], links: [-1, 0], rechts: [1, 0] }[z.richtung]
    const mx = k.x * s + s / 2 + d[0] * s * 0.18, my = k.y * s + s / 2 + d[1] * s * 0.18
    const qx = -d[1] * s * 0.2, qy = d[0] * s * 0.2
    c.fillStyle = farben.auge
    for (const f of [1, -1]) { c.beginPath(); c.arc(mx + qx * f, my + qy * f, Math.max(1.5, s * 0.1), 0, Math.PI * 2); c.fill() }
  }

  // ---------- Ablauf ----------
  function schleife() {
    timer = null
    if (phase !== 'laeuft') return
    const vorher = z.punkte
    z = schritt(z)
    zeichne()
    if (z.vorbei) return ende()
    if (z.punkte > vorher) haptic(8)
    timer = setTimeout(schleife, takt(z.punkte))
  }

  function start() {
    clearTimeout(timer)
    if (!z || phase === 'vorbei' || phase === 'bereit' && z.vorbei) {
      z = neuesSpiel(r.spalten, r.zeilen); neuerRekord = false
    }
    phase = 'laeuft'
    ansage = t('Spiel läuft.')
    zeichne()
    // Der Start-Knopf verschwindet — Fokus im Dialog halten (Tastatur, VoiceOver)
    try { karte?.focus({ preventScroll: true }) } catch {}
    timer = setTimeout(schleife, takt(z.punkte))
  }

  function pausieren() {
    if (phase !== 'laeuft') return
    clearTimeout(timer); timer = null
    phase = 'pause'; ansage = 'Pause.'
  }

  function ende() {
    phase = 'vorbei'
    haptic.error()
    if (z.punkte > rekord) {
      rekord = z.punkte; neuerRekord = true
      try { localStorage.setItem(REKORD_KEY, String(rekord)) } catch {}
    }
    ansage = `${GRUND[z.vorbei] || 'Vorbei.'} ${tn(z.punkte, '{n} Maus', '{n} Mäuse')}.${neuerRekord ? ' ' + t('Neuer Rekord!') : ''}`
  }

  function lenken(wunsch) {
    if (phase === 'vorbei' || !z) return
    // Erster Wisch nach links: Schlange umdrehen statt geradeaus loszufahren
    if (phase === 'bereit' && wunsch === 'links' && z.richtung === 'rechts') {
      z = { ...z, schlange: [...z.schlange].reverse(), richtung: 'links' }
    }
    if (phase !== 'laeuft') start()
    z = lenke(z, wunsch)
  }

  // ---------- Eingaben ----------
  const TASTEN = { arrowup: 'hoch', arrowdown: 'runter', arrowleft: 'links', arrowright: 'rechts', w: 'hoch', s: 'runter', a: 'links', d: 'rechts' }
  function taste(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = (e.key || '').toLowerCase()
    if (k === 'escape') { e.preventDefault(); onClose(); return }
    if (TASTEN[k]) { e.preventDefault(); lenken(TASTEN[k]); return }
    const aufKnopf = e.target?.tagName === 'BUTTON'   // dort lösen Leertaste/Enter den Knopf aus
    if ((k === ' ' || k === 'p') && !aufKnopf) {
      e.preventDefault()
      if (phase === 'laeuft') pausieren(); else start()
    } else if (k === 'enter' && !aufKnopf && phase !== 'laeuft') { e.preventDefault(); start() }
  }

  // Wischen: Richtung, sobald der Finger 18 px gewandert ist; danach neu ansetzen — so
  // gelingen mehrere Kurven in einer Bewegung.
  let wisch = null
  function fingerAuf(e) {
    // Knöpfe (Los, Nochmal …) nicht abfangen — sonst landet ihr Tipp beim Feld statt beim Knopf
    if (e.pointerType === 'mouse' || e.target?.closest?.('button')) return
    wisch = { x: e.clientX, y: e.clientY, id: e.pointerId }
    try { feldEl.setPointerCapture(e.pointerId) } catch {}
  }
  function fingerZieht(e) {
    if (!wisch || e.pointerId !== wisch.id) return
    const dx = e.clientX - wisch.x, dy = e.clientY - wisch.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
    lenken(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch'))
    wisch = { ...wisch, x: e.clientX, y: e.clientY }
  }
  const fingerWeg = () => { wisch = null }

  // Fokus auf den Hauptknopf der Einblendung (Los / Weiter / Nochmal)
  function fokus(node) { tick().then(() => { try { node.focus({ preventScroll: true }) } catch {} }) }

  onMount(() => {
    vermessen()
    z = neuesSpiel(r.spalten, r.zeilen)
    zeichne()
    // Drehen / Fenstergröße: neues Raster → neues Spiel (die alte Schlange passt nicht mehr)
    const ro = new ResizeObserver(() => {
      if (vermessen()) {
        clearTimeout(timer); timer = null
        z = neuesSpiel(r.spalten, r.zeilen); phase = 'bereit'
      }
      zeichne()
    })
    ro.observe(feldEl)
    const sicht = () => { if (document.hidden) pausieren() }
    document.addEventListener('visibilitychange', sicht)
    return () => { ro.disconnect(); document.removeEventListener('visibilitychange', sicht); clearTimeout(timer) }
  })
</script>

<svelte:window onkeydown={taste} />

<div class="sn-back" data-dialog-hg role="presentation">
  <div class="sn-karte" bind:this={karte} role="dialog" aria-label={t('Snake-Spiel')} tabindex="-1"
    use:modal={{ onclose: onClose, fokus: '.sn-los', zurueck: '.such-knopf, .nav-suche' }}>
    <div class="sn-kopf">
      <span class="sn-titel" aria-hidden="true">{t('🐍 SNAKE')}</span>
      <span class="sn-wert" aria-label={t('Punkte: {punkte}', { punkte })}><span aria-hidden="true">🐁</span> {punkte}</span>
      <span class="sn-wert" aria-label={t('Rekord: {rekord}', { rekord })}><span aria-hidden="true">🏆</span> {rekord}</span>
      <span class="sn-luecke"></span>
      {#if phase === 'laeuft' || phase === 'pause'}
        <button class="sn-knopf" onclick={() => (phase === 'laeuft' ? pausieren() : start())}
          aria-label={phase === 'laeuft' ? t('Pause') : t('Weiter')}>{phase === 'laeuft' ? '⏸' : '▶'}</button>
      {/if}
      <button class="sn-knopf" onclick={onClose} aria-label={t('Spiel schließen')}>✕</button>
    </div>

    <!-- Wischen ist nur eine Abkürzung für den Finger; Tastatur und VoiceOver steuern über
         Pfeiltasten und das Steuerkreuz darunter. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sn-feld" bind:this={feldEl}
      onpointerdown={fingerAuf} onpointermove={fingerZieht} onpointerup={fingerWeg} onpointercancel={fingerWeg}>
      <div class="sn-bande" bind:this={bandeEl}>
        <canvas bind:this={canvas} aria-hidden="true"></canvas>
        {#if phase !== 'laeuft'}
          <div class="sn-overlay">
            <div class="sn-tafel">
              {#if phase === 'bereit'}
                <p class="sn-gross">{t('🐍 Snake')}</p>
                <p class="sn-text">{t('Fang die Mäuse! Wischen oder Pfeiltasten.')}<br>{t('Die Bande ist hart: Rand berührt = Ende.')}</p>
                <!-- „Schließen" auch hier, mitten im Bild — nicht nur das ✕ oben am Rand -->
                <div class="sn-reihe">
                  <button class="sn-los" use:fokus onclick={start}>{t('Los')}</button>
                  <button class="sn-zweit" onclick={onClose}>{t('Schließen')}</button>
                </div>
              {:else if phase === 'pause'}
                <p class="sn-gross">{t('Pause')}</p>
                <div class="sn-reihe">
                  <button class="sn-los" use:fokus onclick={start}>{t('Weiter')}</button>
                  <button class="sn-zweit" onclick={onClose}>{t('Schließen')}</button>
                </div>
              {:else}
                <p class="sn-gross">{GRUND[z?.vorbei] || t('Vorbei')}</p>
                <p class="sn-text"><b>{punkte}</b> {tn(punkte, 'Maus', 'Mäuse')}{#if neuerRekord}&nbsp;· <b>{t('🏆 Neuer Rekord!')}</b>{/if}</p>
                <div class="sn-reihe">
                  <button class="sn-los" use:fokus onclick={start}>{t('Nochmal')}</button>
                  <button class="sn-zweit" onclick={onClose}>{t('Schließen')}</button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="sn-kreuz" role="group" aria-label={t('Steuerung')}>
      <button class="sn-pfeil" onclick={() => lenken('links')} aria-label={t('links')}>◀</button>
      <button class="sn-pfeil" onclick={() => lenken('hoch')} aria-label={t('hoch')}>▲</button>
      <button class="sn-pfeil" onclick={() => lenken('runter')} aria-label={t('runter')}>▼</button>
      <button class="sn-pfeil" onclick={() => lenken('rechts')} aria-label={t('rechts')}>▶</button>
    </div>
    <p class="sn-tipp">{t('Pfeiltasten oder WASD · Leertaste = Pause · Esc = schließen')}</p>
    <p class="sn-sr" aria-live="polite">{ansage}</p>
  </div>
</div>

<style>
  .sn-back {
    position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center;
    background: rgba(18, 12, 6, 0.62); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    touch-action: none; animation: sn-ein 0.2s ease;
    /* Die App läuft randlos (viewport-fit=cover, Statusleiste durchsichtig). Ohne diesen Rand
       läge das ✕ unter Uhr/Dynamic Island — dort fängt iOS jeden Tipp ab. */
    --sicher-oben: env(safe-area-inset-top, 0px);
    --sicher-unten: env(safe-area-inset-bottom, 0px);
    --sicher-links: env(safe-area-inset-left, 0px);
    --sicher-rechts: env(safe-area-inset-right, 0px);
    box-sizing: border-box;
    padding: var(--sicher-oben) var(--sicher-rechts) 0 var(--sicher-links);
  }
  @keyframes sn-ein { from { opacity: 0; } }
  .sn-karte {
    display: flex; flex-direction: column; gap: 8px;
    width: calc(100vw - 12px - var(--sicher-links) - var(--sicher-rechts));
    max-height: calc(100dvh - 8px - var(--sicher-oben));
    padding: 8px 8px calc(8px + var(--sicher-unten));
    background: var(--card); color: var(--ink); border-radius: 22px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    outline: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  }
  .sn-kopf { display: flex; align-items: center; gap: 8px; padding: 0 2px 0 8px; min-height: 44px; }
  .sn-titel { font-family: 'Anton', system-ui, sans-serif; letter-spacing: 3px; font-size: calc(18px * var(--schrift, 1)); color: var(--brand-text); }
  .sn-wert { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; padding: 4px 10px; border-radius: 14px; background: var(--flaeche); border: 1px solid var(--line); }
  .sn-luecke { flex: 1; }
  .sn-knopf {
    width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line-stark); background: var(--flaeche);
    color: var(--ink); font-size: calc(16px * var(--schrift, 1)); cursor: pointer; touch-action: manipulation;
  }

  /* Spielfeld: ¾ der Bildschirmhöhe (iPhone hochkant: volle Breite) */
  /* … aber nie so hoch, dass Kopfzeile (✕) oder Steuerkreuz aus dem sicheren Bereich rutschen:
     144 px = Ränder 16 + Kopf 44 + Kreuz 56 + Abstände 16 + Luft 12 */
  .sn-feld {
    height: 75vh; height: min(75dvh, calc(100dvh - var(--sicher-oben) - var(--sicher-unten) - 144px));
    display: flex; align-items: center; justify-content: center;
    touch-action: none; overscroll-behavior: contain;
    --sn-boden: #efe2c4; --sn-kachel: #e9dab8; --sn-schlange: #3f7d3a; --sn-kopf: #20502a; --sn-auge: #fffbe6; --sn-bande: #8a3f16;
  }
  :global([data-theme='dark']) .sn-feld {
    --sn-boden: #2a2016; --sn-kachel: #31261a; --sn-schlange: #78b86a; --sn-kopf: #b5e09d; --sn-auge: #1b140c; --sn-bande: #c8743f;
  }
  .sn-bande { position: relative; border: 4px solid var(--sn-bande); border-radius: 6px; line-height: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
  .sn-bande canvas { display: block; }

  .sn-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 12px; line-height: normal; background: rgba(20, 14, 8, 0.28); }
  .sn-tafel {
    background: var(--card); color: var(--ink); border-radius: 18px; padding: 18px 20px; text-align: center;
    box-shadow: var(--shadow-float); max-width: 320px; border: 1px solid var(--line);
  }
  .sn-gross { margin: 0 0 6px; font-size: calc(22px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .sn-text { margin: 0 0 14px; font-size: calc(14px * var(--schrift, 1)); line-height: 1.45; color: var(--muted); }
  .sn-text b { color: var(--ink); }
  .sn-reihe { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .sn-los, .sn-zweit {
    min-height: 46px; padding: 0 26px; border-radius: 23px; font-size: calc(16px * var(--schrift, 1)); font-weight: 800; cursor: pointer; touch-action: manipulation;
  }
  .sn-los { border: none; background: var(--brand); color: #fff; }
  .sn-zweit { border: 1px solid var(--line-stark); background: var(--flaeche); color: var(--ink); }

  /* Steuerkreuz nur mit Finger; am Mac Pfeiltasten (Hinweiszeile) */
  .sn-kreuz { display: none; gap: 10px; justify-content: center; }
  .sn-pfeil {
    flex: 1; max-width: 86px; height: 56px; border-radius: 16px; border: 1px solid var(--line-stark);
    background: var(--flaeche); color: var(--ink); font-size: calc(20px * var(--schrift, 1)); cursor: pointer; touch-action: manipulation;
  }
  .sn-pfeil:active { background: var(--flaeche-2, #efe4d0); transform: scale(0.96); }
  .sn-tipp { margin: 0; text-align: center; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  @media (pointer: coarse) {
    .sn-kreuz { display: flex; }
    .sn-tipp { display: none; }
  }
  /* Querformat am Handy: kein Platz fürs Kreuz — Wischen genügt */
  @media (pointer: coarse) and (max-height: 500px) {
    .sn-kreuz { display: none; }
    .sn-kopf { min-height: 40px; }
    .sn-feld { height: min(75dvh, calc(100dvh - var(--sicher-oben) - var(--sicher-unten) - 76px)); }
  }
  /* Mac / großer Bildschirm: ¾ der Breite und ¾ der Höhe */
  @media (min-width: 900px) {
    .sn-karte { width: auto; padding: 10px 12px 12px; }
    .sn-feld { width: 75vw; height: 75vh; }
  }
  .sn-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; margin: 0; }
</style>
