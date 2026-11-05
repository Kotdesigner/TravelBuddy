<script>
  // Änderungen an Etappen und Routen landen sofort im Speicher. Die Leiste merkt sich den Stand
  // beim Öffnen und jeden Zwischenstand, damit sich alles zurücknehmen lässt.
  import { get } from 'svelte/store'
  import { je } from './i18n.js'
  import { reisen, reisenZurueck, ready } from './userdata.js'
  import { zeigeToast } from './toast.js'
  import { aenderungsZeichen, imBereich } from './plan.js'

  let { etappeId = null, routeId = null, api = $bindable(null) } = $props()

  const kopie = (x) => JSON.parse(JSON.stringify(x))
  const jetzt = () => imBereich(get(reisen), etappeId, routeId)
  // V16: Den Stand erst merken, wenn die Daten geladen sind. Vorher war `stand` beim direkten Öffnen
  // einer Etappe leer, das Laden galt als Änderung, und „Nicht speichern“ löschte die Etappe.
  let gemerkt = $state(get(ready))
  let stand = $state.raw(get(ready) ? kopie(jetzt()) : []), verlauf = $state.raw([]), warten
  $effect(() => { if ($ready && !gemerkt) { stand = kopie(jetzt()); verlauf = []; gemerkt = true } })
  const zeichen = $derived(aenderungsZeichen(imBereich($reisen, etappeId, routeId)))
  const geaendert = $derived(gemerkt && zeichen !== aenderungsZeichen(stand))

  // Zwischenstände erst nach einer kurzen Pause, sonst wäre jeder Buchstabe ein Schritt
  $effect(() => {
    const z = zeichen
    if (!gemerkt) return
    clearTimeout(warten)
    warten = setTimeout(() => {
      const letzter = verlauf.at(-1) || stand
      if (z !== aenderungsZeichen(letzter)) verlauf = [...verlauf.slice(-29), kopie(jetzt())]
    }, 500)
    return () => clearTimeout(warten)
  })

  function setze(ziel) {
    // Nie auf „nichts“ zurücksetzen, solange es etwas gibt: das wäre ein Löschen, kein Zurücknehmen
    if (!ziel.length && jetzt().length) return
    const ids = [...new Set([...stand, ...jetzt(), ...verlauf.flat()].map((r) => r.id))]
    reisenZurueck(ids, kopie(ziel))
  }
  function rueckgaengig() {
    clearTimeout(warten)
    const ohneOffen = aenderungsZeichen(verlauf.at(-1) || stand) === zeichen ? verlauf.slice(0, -1) : verlauf
    setze(ohneOffen.at(-1) || stand)
    verlauf = ohneOffen
  }
  function verwerfen() {
    clearTimeout(warten)
    setze(stand); verlauf = []
    zeigeToast(je('Nicht gespeichert, der alte Stand ist zurück', 'Not saved, the old version is back'), 'info', 3500)
  }
  function speichern() {
    clearTimeout(warten)
    stand = kopie(jetzt()); verlauf = []
    zeigeToast(je('✓ Änderungen gespeichert', '✓ Changes saved'), 'ok', 3500)
  }
  $effect(() => { api = { get geaendert() { return geaendert }, speichern, verwerfen } })
</script>

{#if geaendert}
  <div class="al" role="region" aria-label={je('Ungespeicherte Änderungen', 'Unsaved changes')}>
    <button class="bedien-knopf" onclick={rueckgaengig}>{je('Rückgängig', 'Undo')}</button>
    <button class="bedien-knopf" onclick={verwerfen}>{je('Nicht speichern', "Don't save")}</button>
    <button class="bedien-knopf haupt" onclick={speichern}>{je('Speichern', 'Save')}</button>
  </div>
{/if}

<style>
  .al { position: sticky; bottom: calc(92px + env(safe-area-inset-bottom, 0px)); z-index: 25; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; padding: 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--card); box-shadow: 0 6px 18px rgba(0, 0, 0, .3); }
  @media (min-width: 900px) { .al { bottom: 14px; } }
</style>
