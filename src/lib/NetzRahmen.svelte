<script>
  // Schmaler, milchiger Lichtrand, solange die App nach außen spricht. Kurze Abrufe bleiben
  // unsichtbar, sonst flackert es. Sand für GPS, Blau für Daten, Grün für Spotify.
  import { netzAktiv } from './netz-aktivitaet.js'
  import { effekte } from './effekte.js'
  import { goldRahmen } from './stimmung.js'

  const FARBE = { gps: '#e8bd82', daten: '#8fc2ef', spotify: '#5fdc8f' }
  const ERST_NACH = 500, MINDESTENS = 1400

  let sichtbar = $state(false)
  let art = $state('daten')
  let warte, halte, seit = 0

  $effect(() => {
    const n = $netzAktiv
    const aktiv = n.spotify ? 'spotify' : n.gps ? 'gps' : n.daten ? 'daten' : null
    if (aktiv) {
      art = aktiv
      clearTimeout(halte)
      if (!sichtbar && !warte) warte = setTimeout(() => { warte = null; seit = Date.now(); sichtbar = true }, ERST_NACH)
    } else {
      clearTimeout(warte); warte = null
      if (sichtbar) halte = setTimeout(() => (sichtbar = false), Math.max(0, MINDESTENS - (Date.now() - seit)))
    }
  })
</script>

{#if $effekte.rahmen || $goldRahmen}<div class="netz-rahmen" class:an={($effekte.rahmen && sichtbar) || $goldRahmen} style="--nf:{$goldRahmen ? '#f0b453' : FARBE[art]}" aria-hidden="true"></div>{/if}
