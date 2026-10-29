<script>
  import { t } from './i18n.js'
  // Verstecktes Mini-Spiel (Easter-Egg): Tic-Tac-Toe. Du = ✕, Computer = ◯.
  // Bei Sieg ODER Niederlage (und Unentschieden) schließt es sich automatisch.
  import { modal } from './modal.js'
  let { onClose } = $props()

  let feld = $state(Array(9).fill(''))
  let status = $state('spielen') // spielen | gewonnen | verloren | unentschieden
  let sperre = $state(false)

  const LINIEN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  function gewinner(f) {
    for (const [a,b,c] of LINIEN) if (f[a] && f[a] === f[b] && f[b] === f[c]) return f[a]
    return null
  }
  const voll = (f) => f.every(Boolean)

  // Einfache, aber schlagbare KI: gewinnen → blocken → Mitte → Ecke → Rest.
  function computerZug(f) {
    const frei = f.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
    for (const i of frei) { const t = [...f]; t[i] = 'O'; if (gewinner(t) === 'O') return i }
    for (const i of frei) { const t = [...f]; t[i] = 'X'; if (gewinner(t) === 'X') return i }
    if (f[4] === '') return 4
    const ecken = [0, 2, 6, 8].filter((i) => f[i] === '')
    if (ecken.length) return ecken[Math.floor(Math.random() * ecken.length)]
    return frei[Math.floor(Math.random() * frei.length)]
  }

  let schliessTimer = 0
  function beende(ergebnis) {
    status = ergebnis
    schliessTimer = setTimeout(onClose, 1500)
  }
  $effect(() => () => clearTimeout(schliessTimer))

  function klick(i) {
    if (sperre || feld[i] || status !== 'spielen') return
    feld[i] = 'X'
    if (gewinner(feld) === 'X') return beende('gewonnen')
    if (voll(feld)) return beende('unentschieden')
    sperre = true
    setTimeout(() => {
      const zug = computerZug(feld)
      if (zug != null) feld[zug] = 'O'
      sperre = false
      if (gewinner(feld) === 'O') return beende('verloren')
      if (voll(feld)) return beende('unentschieden')
    }, 430)
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onClose() }} />

<div class="xoxo-back" data-dialog-hg onclick={onClose} role="presentation">
  <!-- Klicks im Spiel sollen den Hintergrund nicht schließen; Tastatur: Escape (use:modal) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="xoxo-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-label={t('XOXO-Spiel')} tabindex="-1" use:modal={{ onclose: onClose }}>
    <button class="xoxo-close" onclick={onClose} aria-label={t('schließen')}>✕</button>
    <div class="xoxo-titel">✕&nbsp;◯&nbsp;✕&nbsp;◯</div>
    <div class="xoxo-grid">
      {#each feld as z, i}
        <button class="zelle" onclick={() => klick(i)} disabled={!!z || status !== 'spielen'}>
          {#if z === 'X'}<span class="x">✕</span>{:else if z === 'O'}<span class="o">◯</span>{/if}
        </button>
      {/each}
    </div>
    {#if status === 'spielen'}
      <div class="xoxo-hint">{t('Du bist')} <b>✕</b> {t('· tippe ein Feld')}</div>
    {:else}
      <div class="xoxo-ergebnis">
        {#if status === 'gewonnen'}{t('🎉 Gewonnen!')}{:else if status === 'verloren'}{t('😅 Verloren')}{:else}{t('🤝 Unentschieden')}{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .xoxo-back {
    position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center;
    background: rgba(18, 12, 6, 0.5); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
    animation: xfade 0.2s ease;
  }
  @keyframes xfade { from { opacity: 0; } to { opacity: 1; } }
  .xoxo-card {
    position: relative; background: #fbf6ec; border-radius: 28px; padding: 26px 24px 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.45); text-align: center; width: min(86vw, 330px);
    animation: xpop 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.3);
  }
  @keyframes xpop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .xoxo-close { position: absolute; top: 8px; right: 12px; border: none; background: none; cursor: pointer; font-size: calc(15px * var(--schrift, 1)); color: #b3a48f; }
  .xoxo-titel { font-family: 'Anton', system-ui, sans-serif; letter-spacing: 4px; color: #8a3f16; font-size: calc(19px * var(--schrift, 1)); margin-bottom: 14px; }
  .xoxo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .zelle {
    aspect-ratio: 1; border: none; border-radius: 16px; background: #efe4d0; cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: calc(38px * var(--schrift, 1)); line-height: 1;
    transition: background 0.12s, transform 0.08s;
  }
  .zelle:hover:not(:disabled) { background: #e6d7bd; }
  .zelle:active:not(:disabled) { transform: scale(0.94); }
  .zelle:disabled { cursor: default; }
  .zelle .x { color: #b5451b; }
  .zelle .o { color: #2b6e73; }
  .xoxo-hint { margin-top: 14px; font-size: calc(13px * var(--schrift, 1)); color: #7a6a55; }
  .xoxo-ergebnis { margin-top: 14px; font-size: calc(19px * var(--schrift, 1)); font-weight: 800; color: #8a3f16; }
</style>
