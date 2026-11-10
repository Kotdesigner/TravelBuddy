<script>
  // V35: 7 schnelle Tipps irgendwo auf eine freie Fläche: Notruf 000 (notruf-tippen.js). Ab dem dritten Tipp eine
  // rote Fläche mit Zähler, die alle weiteren Tipps abfängt, damit darunter nichts verstellt wird. Der siebte Tipp
  // öffnet den Anruf (direkt aus dem Tipp, sonst würde der Browser ihn blockieren).
  import { onMount } from 'svelte'
  import { je } from './i18n.js'
  import { NOTRUF_NR, ANZAHL, ABSTAND_MS, ZEIGEN_AB, neuerZaehler, zaehltNicht, notrufTippenAn } from './notruf-tippen.js'
  import { sosBlatt } from './bescheid.js'

  let { anrufen = (nr) => { location.href = `tel:${nr}` } } = $props()

  const z = neuerZaehler()
  let stand = $state(0)        // 0: unsichtbar, 3 bis 6: Fläche mit Zähler
  let gewaehlt = $state(false) // nach dem siebten Tipp: Hinweis und SOS an deine Leute
  let uhr

  function tipp(e) {
    if (!$notrufTippenAn || gewaehlt) return
    if (zaehltNicht(e.target)) { if (!stand) z.zurueck(); return }
    const r = z.tipp(e.timeStamp || performance.now())
    clearTimeout(uhr)
    if (r === 'los') {
      stand = 0; gewaehlt = true
      e.preventDefault(); e.stopPropagation()
      anrufen(NOTRUF_NR)
      return
    }
    if (r >= ZEIGEN_AB) { stand = r; e.preventDefault(); e.stopPropagation() }
    // Zu lange Pause: alles zurück, Fläche weg
    uhr = setTimeout(() => { z.zurueck(); stand = 0 }, ABSTAND_MS + 150)
  }
  onMount(() => {
    document.addEventListener('click', tipp, true)
    return () => { document.removeEventListener('click', tipp, true); clearTimeout(uhr) }
  })
  function abbrechen(e) { e.stopPropagation(); clearTimeout(uhr); z.zurueck(); stand = 0 }
</script>

{#if stand}
  <div class="nt" role="alertdialog" aria-live="assertive" aria-label={je('Notruf durch Tippen', 'Emergency call by tapping')}>
    <div class="nt-mitte">
      <div class="nt-zahl">{ANZAHL - stand}</div>
      <p class="nt-text">{je(`Noch ${ANZAHL - stand}× tippen: Notruf ${NOTRUF_NR}`, `Tap ${ANZAHL - stand} more times: emergency call ${NOTRUF_NR}`)}</p>
      <button class="nt-weg" onclick={abbrechen}>{je('Abbrechen', 'Cancel')}</button>
    </div>
  </div>
{:else if gewaehlt}
  <div class="nt nt-fertig" role="alertdialog" aria-labelledby="nt-t">
    <div class="nt-mitte">
      <h2 id="nt-t">📞 {je(`Notruf ${NOTRUF_NR}`, `Emergency call ${NOTRUF_NR}`)}</h2>
      <p class="nt-text">{je('Das Telefon ist offen. Fragt das Handy noch einmal, tippe auf Anrufen.', 'The phone is open. If your phone asks again, tap Call.')}</p>
      <a class="nt-knopf nt-tel" href={`tel:${NOTRUF_NR}`}>📞 {je(`${NOTRUF_NR} anrufen`, `Call ${NOTRUF_NR}`)}</a>
      <button class="nt-knopf" onclick={() => { gewaehlt = false; sosBlatt.set(true) }}>🆘 {je('SOS an meine Leute', 'SOS to my people')}</button>
      <button class="nt-weg" onclick={() => (gewaehlt = false)}>{je('Schließen', 'Close')}</button>
    </div>
  </div>
{/if}

<style>
  .nt { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center; padding: 24px; background: rgb(150, 30, 20); color: #fff;
    -webkit-user-select: none; user-select: none; touch-action: manipulation; }
  .nt-fertig { background: rgb(28, 14, 10); }
  .nt-mitte { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 360px; text-align: center; }
  .nt-zahl { font-size: calc(96px * var(--schrift, 1)); font-weight: 900; line-height: 1; }
  .nt-text { margin: 0; font-size: calc(18px * var(--schrift, 1)); font-weight: 700; line-height: 1.4; }
  h2 { margin: 0; font-size: calc(26px * var(--schrift, 1)); }
  .nt-knopf { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 56px; border: 2px solid #fff; border-radius: 14px; background: none; color: #fff;
    font: inherit; font-size: calc(17px * var(--schrift, 1)); font-weight: 800; text-decoration: none; cursor: pointer; }
  .nt-tel { background: #c0392b; border-color: #c0392b; }
  .nt-weg { min-height: 48px; padding: 0 22px; border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 999px; background: none; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
</style>
