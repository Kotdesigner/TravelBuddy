<script>
  // Beim Öffnen leuchtet einmal fein die Temperatur am rechten Rand auf. Je höher die Zahl steht,
  // desto wärmer ist es. Nur mit frischem Wert vom Standort, sonst bleibt der Rand ruhig.
  import { meinePosition } from './warnlage-dienst.js'
  import { effekte } from './effekte.js'
  import { online } from './netz.js'
  import { temperaturJetzt, tempHoehe, tempFarbe } from './stimmung.js'

  const FRIST = 60000, PAUSE = 600000
  let wert = $state(null), lauf = $state(0)
  let offenSeit = Date.now(), fertig = false, wegSeit = 0, fragt = false

  async function versuche(pos) {
    if (fertig || fragt || !pos || !$online || !$effekte.temperatur || Date.now() - offenSeit > FRIST) return
    fragt = true
    const t = await temperaturJetzt(pos)
    fragt = false
    if (t == null || fertig) return
    fertig = true
    wert = Math.round(t); lauf++
  }
  $effect(() => { versuche($meinePosition) })
  $effect(() => {
    const sicht = () => {
      if (document.hidden) { wegSeit = Date.now(); return }
      if (wegSeit && Date.now() - wegSeit >= PAUSE) { offenSeit = Date.now(); fertig = false; versuche($meinePosition) }
    }
    document.addEventListener('visibilitychange', sicht)
    return () => document.removeEventListener('visibilitychange', sicht)
  })
</script>

{#key lauf}
  {#if wert != null}
    <div class="tg" style="top:{tempHoehe(wert)}%;--tf:{tempFarbe(wert)}" aria-hidden="true" onanimationend={() => (wert = null)}>{wert}°</div>
  {/if}
{/key}

<style>
  .tg { position: fixed; right: calc(7px + env(safe-area-inset-right, 0px)); z-index: 90; translate: 0 -50%; color: var(--tf); font-size: calc(30px * var(--schrift, 1)); font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; text-shadow: 0 0 10px var(--tf), 0 0 2px rgba(0, 0, 0, .35); pointer-events: none; transform-origin: right center; animation: tg-leuchten 1500ms cubic-bezier(.2, .7, .3, 1) 500ms both; }
  @keyframes tg-leuchten {
    0% { opacity: 0; transform: scale(1); }
    10% { opacity: .85; transform: scale(1); }
    55% { opacity: .55; transform: scale(.42); }
    100% { opacity: 0; transform: scale(.3); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tg { animation-name: tg-still; }
    @keyframes tg-still { 0%, 100% { opacity: 0; } 20%, 60% { opacity: .7; } }
  }
</style>
