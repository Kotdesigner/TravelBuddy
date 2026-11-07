<script>
  // Beim Fahren: Kommt man in die Nähe eines Fakts, erscheint unten ein kurzer Hinweis. Groß, ein Tipp weg,
  // verschwindet nach 25 Sekunden von selbst. Mit Netz holt die App dabei frische Fakten aus der Nähe.
  import { get } from 'svelte/store'
  import { je, istEn } from './i18n.js'
  import { zeigeToast } from './toast.js'
  import { online } from './netz.js'
  import { meinePosition } from './warnlage-dienst.js'
  import { standortStatus, folgeStandort } from './standort.js'
  import { fakten, gesehen, alsGesehen, funfactsCfg, waehle, faktenAusOrten, ladeGespeicherte, ladeInDerNaehe, abstandKm, vorlesen } from './funfacts.js'
  import { merkeFakt } from './funfacts-merken.js'

  let { orte = [] } = $props()
  ladeGespeicherte()

  const AB_KM = 3          // nach so viel Weg darf ein neuer Hinweis kommen
  // Der letzte Hinweisort bleibt über das Schließen der App hinaus gespeichert. Beim Öffnen gibt es keinen
  // Hinweis: Wer am Campingplatz die App öffnet, fährt nicht. Erst nach 3 km Weg kommt der nächste.
  const KEY_ORT = 'tb-funfacts-letzter-ort'
  let letzterOrt = (() => { try { return JSON.parse(localStorage.getItem(KEY_ORT) || 'null') } catch { return null } })()
  let ersterFix = true
  const merkeOrt = (p) => { letzterOrt = { lat: p.lat, lon: p.lon }; try { localStorage.setItem(KEY_ORT, JSON.stringify(letzterOrt)) } catch {} }
  let hinweis = $state(null)
  let uhr = null

  // Standort mitführen, solange die App sichtbar offen ist und „Beim Fahren“ an ist. Sonst kämen
  // Positionen nur beim Start, beim Zurückkommen oder mit offener Karte, und der Hinweis bliebe aus.
  // Im Hintergrund oder bei gesperrtem Bildschirm verfolgt eine Web-App ohnehin nichts.
  $effect(() => {
    if (!$funfactsCfg.an || !$funfactsCfg.fahren || $standortStatus !== 'erlaubt') return
    let ende = null
    const schalte = () => {
      if (document.visibilityState === 'visible') { if (!ende) ende = folgeStandort() }
      else if (ende) { ende(); ende = null }
    }
    schalte()
    document.addEventListener('visibilitychange', schalte)
    return () => { document.removeEventListener('visibilitychange', schalte); if (ende) ende() }
  })

  $effect(() => {
    const pos = $meinePosition, cfg = $funfactsCfg
    if (!pos || !cfg.an || !cfg.fahren) return
    if ($online) ladeInDerNaehe(pos, { sprache: istEn ? 'en' : 'de' })
    if (ersterFix) { ersterFix = false; if (!letzterOrt || abstandKm(letzterOrt, pos) < AB_KM) { merkeOrt(pos); return } }
    if (letzterOrt && abstandKm(letzterOrt, pos) < AB_KM) return
    const f = waehle([...Object.values($fakten), ...faktenAusOrten(orte)], pos, { umkreisKm: cfg.umkreisKm, gesehen: get(gesehen) })
    if (!f || get(gesehen).has(f.id)) return
    merkeOrt(pos)
    alsGesehen(f.id)
    hinweis = f
    if (cfg.vorlesen) vorlesen(f.text, f.sprache || (istEn ? 'en' : 'de'))
    clearTimeout(uhr)
    uhr = setTimeout(() => (hinweis = null), 25000)
  })
</script>

{#if hinweis}
  <div class="fu" role="status">
    <div class="fu-kopf"><span aria-hidden="true">💡</span><b>{hinweis.titel}</b>{#if hinweis.km != null}<small>{hinweis.km < 1 ? je('hier', 'here') : je('{km} km', '{km} km').replace('{km}', hinweis.km)}</small>{/if}</div>
    <p class="fu-text">{hinweis.text}</p>
    <div class="fu-knoepfe">
      <button onclick={() => vorlesen(hinweis.text, hinweis.sprache || (istEn ? 'en' : 'de'))}>🔊 {je('Vorlesen', 'Read aloud')}</button>
      <button onclick={() => { if (merkeFakt(hinweis)) zeigeToast(je('Gemerkt', 'Saved'), 'ok') }}>☆ {je('Merken', 'Save')}</button>
      <button aria-label={je('Schließen', 'Close')} onclick={() => (hinweis = null)}>✕</button>
    </div>
  </div>
{/if}

<style>
  .fu { position: fixed; z-index: var(--z-bar, 40); left: max(12px, env(safe-area-inset-left, 0px)); right: max(12px, env(safe-area-inset-right, 0px));
    bottom: calc(86px + env(safe-area-inset-bottom, 0px)); max-width: 560px; margin: 0 auto; background: var(--card); border: 1px solid var(--line-stark);
    border-radius: var(--radius-l); padding: 12px 14px; box-shadow: var(--shadow-float); animation: fu-rein var(--t-slow, .3s) var(--ease-out, ease-out); }
  @media (min-width: 900px), (orientation: landscape) and (min-width: 640px) { .fu { bottom: 20px; } }
  @keyframes fu-rein { from { transform: translateY(12px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .fu { animation: none; } }
  .fu-kopf { display: flex; align-items: baseline; gap: 8px; font-size: calc(15px * var(--schrift, 1)); }
  .fu-kopf small { margin-left: auto; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .fu-text { margin: 6px 0 8px; font-size: calc(17px * var(--schrift, 1)); line-height: 1.45; color: var(--ink); }
  .fu-knoepfe { display: flex; gap: 6px; }
  .fu-knoepfe button { min-height: 44px; padding: 0 12px; border-radius: var(--radius-s); border: 1px solid var(--line-stark); background: var(--card); color: var(--btn-ink); font-weight: 700; font-size: calc(14px * var(--schrift, 1)); cursor: pointer; }
</style>
