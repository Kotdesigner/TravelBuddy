<script>
  // Handbuch als normale Seite der App (#/mehr/handbuch): kein eingebetteter Rahmen, kein PDF.
  // Das iPhone zeigt beides unzuverlässig, und im Home-Bildschirm-Fenster gibt es keinen Weg zurück.
  // Hier scrollt die Seite selbst, Zurück-Knopf und Leiste unten bleiben immer da.
  // Der Text kommt aus public/handbuch.html (offline im Service Worker). Der Shadow-Root hält
  // die Regeln des Handbuchs und die der App auseinander (beide haben z. B. `.inhalt`).
  import { onMount } from 'svelte'
  import { t, istEn } from './i18n.js'

  let blatt = $state(null)
  let fehler = $state(false)
  let geladen = $state(false)
  const imAppFenster = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches

  // Im eigenen Dokument gelten die Regeln für html und body, hier für den Host und das Blatt
  const umschreiben = (css) => css
    .replace(/:root\b/g, ':host')
    .replace(/(^|[\s,}])html(?=[\s,{])/gm, '$1:host')
    .replace(/(^|[\s,}])body(?=[\s,{])/gm, '$1.hb-blatt')

  onMount(async () => {
    try {
      const antwort = await fetch(istEn ? '/handbook.html' : '/handbuch.html')
      if (!antwort.ok) throw new Error(String(antwort.status))
      const dok = new DOMParser().parseFromString(await antwort.text(), 'text/html')
      const css = [...dok.querySelectorAll('style')].map((s) => umschreiben(s.textContent)).join('\n')
      const wurzel = blatt.attachShadow({ mode: 'open' })
      const stil = document.createElement('style')
      stil.textContent = css
      const inhalt = document.createElement('div')
      inhalt.className = 'hb-blatt'
      inhalt.append(...dok.body.childNodes)
      wurzel.append(stil, inhalt)
      geladen = true
    } catch { fehler = true }
  })
</script>

{#if fehler}
  <p class="hb-fehler">{t('Das Handbuch ließ sich nicht laden.')}</p>
{:else}
  <!-- Vom Home-Bildschirm führt ein PDF aus der App heraus, dort gibt es den Link nicht -->
  {#if geladen && !imAppFenster}<a class="hb-pdf" href={istEn ? '/handbook.pdf' : '/handbuch.pdf'} target="_blank" rel="noopener">{t('↗︎ PDF')}</a>{/if}
  <div class="hb-papier" bind:this={blatt}></div>
{/if}

<style>
  .hb-papier { display: block; background: #fff; color: #2b2621; border-radius: 12px; overflow: hidden; min-height: 60vh; }
  .hb-pdf { display: inline-block; margin-bottom: 10px; padding: 8px 12px; border-radius: 8px; background: var(--flaeche); color: var(--btn-ink); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; text-decoration: none; }
  .hb-fehler { color: var(--danger-text); font-size: calc(14px * var(--schrift, 1)); }
</style>
