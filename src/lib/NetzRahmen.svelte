<script>
  // Schmaler, milchiger Lichtrand, solange die App nach außen spricht. Kurze Abrufe bleiben
  // unsichtbar, sonst flackert es. Sand für GPS, Blau für Daten, Grün für Spotify.
  import { netzAktiv } from './netz-aktivitaet.js'
  import { effekte } from './effekte.js'
  import { goldRahmen } from './stimmung.js'
  import { bildschirmEcke } from './ecken.js'
  import { istIOS, istIPad, laeuftAlsApp } from './install.js'

  // Nur vom Home-Bildschirm liegt die App an den Bildschirmecken an, im Browser-Tab ist der Rand eckig
  const geraet = { ua: navigator.userAgent, platform: navigator.platform, touch: navigator.maxTouchPoints || 0 }
  const ecke = laeuftAlsApp() ? bildschirmEcke({ breite: screen.width, hoehe: screen.height, ios: istIOS(geraet), ipad: istIPad(geraet) }) : 0

  const FARBE = { gps: '#e8bd82', daten: '#8fc2ef', spotify: '#5fdc8f' }
  const ERST_NACH = 150, MINDESTENS = 1400

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

{#if $effekte.rahmen || $goldRahmen}<div class="netz-rahmen" class:an={($effekte.rahmen && sichtbar) || $goldRahmen} style="--nf:{$goldRahmen ? '#f0b453' : FARBE[art]}; --nr-ecke:{ecke}px" aria-hidden="true"></div>{/if}
