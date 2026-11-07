<script>
  // „Wusstest du?“ auf Heute: ein Fakt zum Ort, an dem du bist, sonst zum ersten Stopp der Etappe.
  import { untrack } from 'svelte'
  import { get } from 'svelte/store'
  import { je, istEn } from './i18n.js'
  import { zeigeToast } from './toast.js'
  import { meinePosition } from './warnlage-dienst.js'
  import { fakten, gesehen, alsGesehen, funfactsCfg, waehle, faktenAusOrten, ladeGespeicherte, vorlesen, abstandKm, sichereQuelle } from './funfacts.js'
  import { merkeFakt, gemerkt } from './funfacts-merken.js'

  let { ersatz = null, orte = [], geh = () => {} } = $props()
  ladeGespeicherte()

  const punkt = $derived($meinePosition || ersatz)
  const wo = $derived($meinePosition ? je('hier', 'here') : ersatz?.name || je('nächster Stopp', 'next stop'))
  const alle = $derived([...Object.values($fakten), ...faktenAusOrten(orte)])
  let weiter = $state(0)
  let aktuell = $state(null)
  // Neu wählen nur bei „Nächster“, neuem Ort oder neuen Fakten, nicht wenn sich „gesehen“ ändert
  $effect(() => {
    weiter
    const an = $funfactsCfg.an, umkreis = Math.max(30, $funfactsCfg.umkreisKm), p = punkt, liste = alle
    untrack(() => {
      if (!an) { aktuell = null; return }
      const bisher = aktuell
      if (bisher && weiter === zuletztWeiter && liste.some((x) => x.id === bisher.id) && abstandKm(p, bisher) <= umkreis) return
      zuletztWeiter = weiter
      const f = waehle(liste, p, { umkreisKm: umkreis, gesehen: get(gesehen), ausser: bisher?.id })
      aktuell = f || null
      if (f) alsGesehen(f.id)
    })
  })
  let zuletztWeiter = -1
  const schonGemerkt = $derived(aktuell ? $gemerkt.some((g) => g.id === aktuell.id) : false)

  function merken() {
    if (merkeFakt(aktuell)) zeigeToast(je('Im Logbuch unter „Heute gelernt“ gemerkt', 'Saved to the logbook under “Learned today”'), 'ok')
  }
</script>

{#if aktuell}
  <section class="ff" aria-label={je('Wusstest du?', 'Did you know?')}>
    <div class="ff-kopf"><span class="ff-icon" aria-hidden="true">💡</span><b>{je('Wusstest du?', 'Did you know?')}</b><small>{aktuell.titel} · {wo}</small></div>
    <p class="ff-text">{aktuell.text}</p>
    <p class="ff-quelle">
      {#if sichereQuelle(aktuell.quelle)}<a href={sichereQuelle(aktuell.quelle)} target="_blank" rel="noopener">{je('Quelle', 'Source')}: {aktuell.quelleName} ↗</a>{:else}{je('Aus den Ortsinfos der App', 'From the app’s place info')}{/if}
      {#if !istEn && aktuell.sprache === 'en'} · {je('aus der englischen Wikipedia', 'from English Wikipedia')}{/if}
    </p>
    <div class="ff-knoepfe">
      <button class="ff-k" onclick={merken} disabled={schonGemerkt}>{schonGemerkt ? '⭐ ' + je('Gemerkt', 'Saved') : '☆ ' + je('Merken', 'Save')}</button>
      <button class="ff-k" onclick={() => vorlesen(aktuell.text, aktuell.sprache || (istEn ? 'en' : 'de'))}>🔊 {je('Vorlesen', 'Read aloud')}</button>
      <button class="ff-k" onclick={() => weiter++}>{je('Nächster', 'Next')}</button>
      <button class="ff-k ff-leise" onclick={() => geh('mehr/funfacts')}>{je('Alle', 'All')}</button>
    </div>
  </section>
{/if}

<style>
  .ff { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 14px 16px; box-shadow: var(--shadow); margin: 12px 0; }
  .ff-kopf { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; font-size: calc(15px * var(--schrift, 1)); }
  .ff-kopf small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); margin-left: auto; }
  .ff-icon { font-size: calc(18px * var(--schrift, 1)); }
  .ff-text { margin: 0 0 6px; font-size: calc(15px * var(--schrift, 1)); line-height: 1.55; color: var(--ink); }
  .ff-quelle { margin: 0 0 10px; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .ff-quelle a { color: var(--brand-text); }
  .ff-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; }
  .ff-k { min-height: 40px; padding: 0 12px; border-radius: var(--radius-s); border: 1px solid var(--line-stark); background: var(--card); color: var(--btn-ink); font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); cursor: pointer; }
  .ff-k:disabled { opacity: .7; cursor: default; }
  .ff-leise { border-color: transparent; color: var(--brand-text); }
</style>
