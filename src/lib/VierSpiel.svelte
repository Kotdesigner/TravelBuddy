<script>
  import { t } from './i18n.js'
  // Verstecktes Mini-Spiel 3 (Easter-Egg,): „4444“ in die Suche.
  // Vier in einer Reihe gegen den Computer. Du bist gelb, der Computer türkis, wer anfängt,
  // wechselt jede Partie. Gewinnst du, wird der Computer stärker; verlierst du zweimal
  // hintereinander, nimmt er sich eine Stufe zurück. Jede Partie spielt er in einem anderen Stil.
  // Steuerung: Spalte antippen; am Mac Pfeiltasten und Enter oder die Ziffern 1 bis 7,
  // N = neue Partie, Escape = schließen. Stand je Gerät in localStorage.
  // Regeln und Computer: lib/vier.js (getestet in tests/vier.test.mjs), gerechnet im Worker.
  import { onMount, onDestroy } from 'svelte'
  import { modal } from './modal.js'
  import { haptic } from './haptik.js'
  import {
    SPALTEN, REIHEN, DU, COMPUTER, idx, neuesBrett, kannSetzen, setze, ergebnis, berechneZug,
    MAX_STUFE, LEERER_STAND, naechsterStand, neuerStil,
  } from './vier.js'

  let { onClose } = $props()

  const STUFEN_NAME = { 1: t('Anfänger'), 2: t('Gelegenheitsspieler'), 3: t('Fortgeschritten'), 4: t('Stark'), 5: t('Sehr stark'), 6: t('Meister'), 7: t('Großmeister') }
  const STIL_NAME = { angriff: t('angriffslustig'), abwehr: t('vorsichtig'), mitte: t('über die Mitte'), fallen: t('hinterlistig'), wild: t('unberechenbar') }

  const STAND_KEY = 'wa-vier-v1'
  const leseStand = () => { try { return { ...LEERER_STAND, ...JSON.parse(localStorage.getItem(STAND_KEY) || '{}') } } catch { return { ...LEERER_STAND } } }
  let stand = $state(leseStand())
  const merke = () => { try { localStorage.setItem(STAND_KEY, JSON.stringify(stand)) } catch {} }

  let brett = $state.raw(neuesBrett())
  let phase = $state('du')          // du | denkt | vorbei
  let stil = $state.raw(neuerStil())
  let linie = $state.raw(null)
  let meldung = $state('')
  let zeiger = $state(3)
  let spaltenEl = $state([])
  let zu = false

  const gewinnFelder = $derived(new Set(linie || []))
  const reihenOben = Array.from({ length: REIHEN }, (_, i) => REIHEN - 1 - i)
  const ruhig = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---------- Computer im Hintergrund ----------
  let rechner = null, auftrag = 0
  function holeRechner() {
    if (rechner === null) {
      try { rechner = new Worker(new URL('./vier-rechner.js', import.meta.url), { type: 'module' }) } catch { rechner = false }
    }
    return rechner
  }
  function rechne(felder, opt) {
    const w = holeRechner()
    const direkt = () => new Promise((ok) => setTimeout(() => ok(berechneZug(felder, opt)), 20))
    if (!w) return direkt()
    const nr = ++auftrag
    return new Promise((ok) => {
      w.onmessage = (e) => { if (e.data?.nr !== nr) return; e.data.fehler ? direkt().then(ok) : ok(e.data) }
      w.onerror = () => { rechner = false; direkt().then(ok) }
      w.postMessage({ nr, felder: [...felder], opt })
    })
  }
  const pause = (ms) => new Promise((r) => setTimeout(r, ms))

  // ---------- Ablauf ----------
  function neuePartie() {
    brett = neuesBrett()
    stil = neuerStil()
    linie = null
    meldung = ''
    if (stand.duBeginnst) phase = 'du'
    else computerZieht()
  }

  async function computerZieht() {
    phase = 'denkt'
    const start = Date.now()
    const r = await rechne(brett.felder, { stufe: stand.stufe, bonus: stand.bonus, stil: stil.id, vorliebe: stil.vorliebe })
    // Etwas Bedenkzeit auch dann, wenn er sofort weiß, was er will; der Stein soll erst landen
    await pause(Math.max(0, 600 - (Date.now() - start)))
    if (zu || phase !== 'denkt') return
    wirf(r.spalte, COMPUTER)
  }

  function wirf(s, wer) {
    const neu = setze(brett, s, wer)
    if (!neu) return
    brett = neu
    haptic(wer === DU ? 10 : 6)
    const e = ergebnis(brett)
    if (e) return ende(e)
    if (wer === DU) computerZieht()
    else phase = 'du'
  }

  function spielerZieht(s) {
    if (phase !== 'du' || !kannSetzen(brett, s)) return
    zeiger = s
    wirf(s, DU)
  }

  function ende(e) {
    phase = 'vorbei'
    linie = e.linie
    const ausgang = e.sieger === DU ? 'sieg' : e.sieger === COMPUTER ? 'niederlage' : 'remis'
    const vorher = stand
    stand = naechsterStand(vorher, ausgang)
    merke()
    const name = STUFEN_NAME[stand.stufe]
    if (ausgang === 'sieg') {
      meldung = stand.stufe > vorher.stufe ? t('Gewonnen! Der Computer legt nach: Stufe {stufe}, {name}.', { stufe: stand.stufe, name })
        : stand.bonus > vorher.bonus ? t('Gewonnen! Der Computer denkt ab jetzt länger nach.')
          : t('Gewonnen! Stärker wird der Computer nicht.')
      haptic([10, 40, 10, 40, 20])
    } else if (ausgang === 'niederlage') {
      meldung = stand.stufe < vorher.stufe || stand.bonus < vorher.bonus
        ? t('Verloren. Der Computer nimmt sich etwas zurück: Stufe {stufe}, {name}.', { stufe: stand.stufe, name })
        : t('Verloren.')
    } else meldung = t('Unentschieden.')
  }

  onMount(() => {
    if (!stand.duBeginnst) computerZieht()
    setTimeout(() => spaltenEl[3]?.focus({ preventScroll: true }), 50)
  })
  onDestroy(() => { zu = true; if (rechner) rechner.terminate() })

  // ---------- Tastatur ----------
  function taste(e) {
    if (e.key >= '1' && e.key <= '7') { e.preventDefault(); spielerZieht(Number(e.key) - 1); return }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      zeiger = (zeiger + (e.key === 'ArrowLeft' ? SPALTEN - 1 : 1)) % SPALTEN
      spaltenEl[zeiger]?.focus()
      return
    }
    if ((e.key === 'n' || e.key === 'N') && phase === 'vorbei') { e.preventDefault(); neuePartie() }
  }

  const frei = (s) => REIHEN - brett.hoehe[s]
  const steinKlasse = (v) => (v === DU ? 'du' : v === COMPUTER ? 'pc' : '')
  const spaltenText = (s) => t('Spalte {n}', { n: s + 1 }) + ', ' + (frei(s) ? t('{n} frei', { n: frei(s) }) : t('voll'))
  const status = $derived(phase === 'vorbei' ? meldung : phase === 'denkt' ? t('Der Computer denkt …') : t('Du bist dran'))
</script>

<svelte:window onkeydown={taste} />

<div class="vg-back" data-dialog-hg onclick={onClose} role="presentation">
  <!-- Klicks im Spiel sollen den Hintergrund nicht schließen; Tastatur: Escape (use:modal) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="vg-karte" onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="vg-titel" tabindex="-1" use:modal={{ onclose: onClose }}>
    <button class="vg-zu" onclick={onClose} aria-label={t('schließen')}>✕</button>
    <h2 class="vg-titel" id="vg-titel">{t('Vier in einer Reihe')}</h2>
    <p class="vg-gegner">
      {t('Stufe {stufe} von {max}', { stufe: stand.stufe, max: MAX_STUFE })} · {STUFEN_NAME[stand.stufe]}{#if stand.stufe === MAX_STUFE && stand.bonus}{' '}{'+'.repeat(stand.bonus)}{/if}
      <span class="vg-stil">{t('spielt heute {stil}', { stil: STIL_NAME[stil.id] })}</span>
    </p>

    <div class="vg-zeiger" aria-hidden="true">
      {#each Array(SPALTEN) as _, s}
        <span class="vg-vorschau" class:an={phase === 'du' && zeiger === s && kannSetzen(brett, s)}></span>
      {/each}
    </div>
    <div class="vg-brett" class:vorbei={phase === 'vorbei'} role="group" aria-label={t('Spielbrett, 7 Spalten')}>
      {#each Array(SPALTEN) as _, s}
        <button class="vg-spalte" bind:this={spaltenEl[s]} aria-label={spaltenText(s)} aria-disabled={phase !== 'du' || !kannSetzen(brett, s)}
          onclick={() => spielerZieht(s)} onmouseenter={() => (zeiger = s)} onfocus={() => (zeiger = s)}>
          {#each reihenOben as r (r)}
            {@const f = idx(s, r)}
            {@const v = brett.felder[f]}
            <span class="vg-feld">
              {#if v}
                <span class="vg-stein {steinKlasse(v)}" class:neu={f === brett.letzte && !ruhig} class:sieg={gewinnFelder.has(f)}
                  style="--fall:{REIHEN - r}"></span>
              {/if}
            </span>
          {/each}
        </button>
      {/each}
    </div>

    <p class="vg-status" class:denkt={phase === 'denkt'} aria-live="polite">
      {#if phase !== 'vorbei'}<span class="vg-punkt {phase === 'du' ? 'du' : 'pc'}" aria-hidden="true"></span>{/if}{status}
    </p>
    <div class="vg-fuss">
      <span class="vg-bilanz">{t('Du {siege} · Computer {niederlagen} · Remis {remis}', stand)}</span>
      {#if phase === 'vorbei'}
        <button class="vg-nochmal" onclick={neuePartie}>{stand.duBeginnst ? t('Nochmal, du beginnst') : t('Nochmal, der Computer beginnt')}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .vg-back {
    position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center;
    background: rgba(18, 12, 6, 0.5); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
    animation: vg-blende 0.2s ease; padding: 12px;
  }
  @keyframes vg-blende { from { opacity: 0; } to { opacity: 1; } }
  .vg-karte {
    position: relative; background: #fbf6ec; color: #2b2621; border-radius: 28px; padding: 22px 18px 18px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.45); text-align: center; width: min(94vw, 440px);
    animation: vg-auf 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.3);
  }
  @keyframes vg-auf { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .vg-zu { position: absolute; top: 6px; right: 8px; width: 44px; height: 44px; border: none; background: none; cursor: pointer; font-size: calc(15px * var(--schrift, 1)); color: #8a7a64; }
  .vg-titel { font-family: 'Anton', system-ui, sans-serif; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: #8a3f16; font-size: calc(22px * var(--schrift, 1)); margin: 0 0 4px; }
  .vg-gegner { margin: 0 0 10px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: #5a5248; line-height: 1.45; }
  .vg-stil { display: block; font-weight: 600; color: #7a6a55; }

  .vg-zeiger, .vg-brett { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .vg-zeiger { padding: 0 10px; height: 26px; align-items: end; }
  .vg-vorschau { justify-self: center; width: 70%; aspect-ratio: 1; max-height: 22px; max-width: 22px; border-radius: 50%; background: #f0b453; opacity: 0; transform: translateY(-4px); transition: opacity 0.12s, transform 0.12s; }
  .vg-vorschau.an { opacity: 0.9; transform: none; }
  .vg-brett { background: #8a3f16; border-radius: 18px; padding: 10px; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.18); }
  .vg-spalte {
    display: flex; flex-direction: column; gap: 6px; padding: 0; border: none; background: none; cursor: pointer;
    border-radius: 12px; overflow: hidden; -webkit-tap-highlight-color: transparent;
  }
  .vg-spalte[aria-disabled='true'] { cursor: default; }
  .vg-spalte:hover:not([aria-disabled='true']) .vg-feld { background: #f6ead4; }
  .vg-spalte:focus-visible { outline: 3px solid #f0b453; outline-offset: 2px; }
  .vg-feld { position: relative; aspect-ratio: 1; border-radius: 50%; background: #efe4d0; box-shadow: inset 0 3px 4px rgba(0,0,0,0.22); transition: background 0.12s; }
  .vg-stein { position: absolute; inset: 7%; border-radius: 50%; }
  .vg-stein.du { background: radial-gradient(circle at 35% 30%, #ffd88a, #f0b453 55%, #c98a25); }
  .vg-stein.pc { background: radial-gradient(circle at 35% 30%, #63a9ad, #2b6e73 55%, #1b4a4e); }
  /* Der Stein fällt durch die Spalte; die Spalte schneidet oben ab */
  .vg-stein.neu { animation: vg-fall calc(0.12s + var(--fall) * 0.055s) cubic-bezier(0.5, 0, 0.75, 0.25) both, vg-landung 0.18s ease-out calc(0.12s + var(--fall) * 0.055s); }
  @keyframes vg-fall { from { transform: translateY(calc(var(--fall) * -116%)); } to { transform: none; } }
  @keyframes vg-landung { 40% { transform: translateY(-6%) scaleY(0.94); } }
  .vg-brett.vorbei .vg-stein:not(.sieg) { opacity: 0.45; transition: opacity 0.4s; }
  .vg-stein.sieg { box-shadow: 0 0 0 3px #fff, 0 0 14px 4px rgba(255,255,255,0.7); animation: vg-puls 1.1s ease-in-out 0.3s infinite; }
  @keyframes vg-puls { 50% { transform: scale(0.88); } }

  .vg-status { margin: 12px 0 0; min-height: 22px; font-size: calc(15.5px * var(--schrift, 1)); font-weight: 800; color: #8a3f16; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .vg-punkt { width: 14px; height: 14px; border-radius: 50%; flex: none; }
  .vg-punkt.du { background: #f0b453; }
  .vg-punkt.pc { background: #2b6e73; }
  .vg-status.denkt .vg-punkt { animation: vg-puls 0.9s ease-in-out infinite; }
  .vg-fuss { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; justify-content: center; }
  .vg-bilanz { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: #7a6a55; font-variant-numeric: tabular-nums; }
  .vg-nochmal {
    min-height: 44px; padding: 0 16px; border: none; border-radius: 14px; cursor: pointer;
    background: #8a3f16; color: #fff; font-size: calc(14px * var(--schrift, 1)); font-weight: 800;
  }
  .vg-nochmal:hover { background: #7a3712; }
  @media (prefers-reduced-motion: reduce) {
    .vg-back, .vg-karte, .vg-stein.sieg, .vg-status.denkt .vg-punkt { animation: none; }
  }
</style>
