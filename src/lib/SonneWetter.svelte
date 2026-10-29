<script>
  import { t } from './i18n.js'
  import { sonnenZeiten, zeitzoneFuer } from './sonne.js'
  import { holeWetter } from './wetter.js'
  import { sterneBewertung, sterneIcon } from './sterne.js'
  import { reiseDatum } from './reisedatum.js'
  import { online } from './netz.js'

  // Ohne Angabe wird die Zeitzone aus den Koordinaten bestimmt (West- vs. Ostküste).
  let { lat, lon, tz = null, datum = null } = $props()
  const zone = $derived(tz || zeitzoneFuer(lat, lon))

  let offen = $state(false)
  let wetter = $state(null)
  let wetterLaden = $state(false)
  let wetterFehler = $state(null)

  // Datum des Tagebuch-Eintrags (falls übergeben), sonst das globale Reisedatum.
  const tag = $derived(datum || $reiseDatum)
  const s = $derived(sonnenZeiten(lat, lon, tag, zone))
  // Sternen-Eignung: Mond (offline) + Wolken (falls Wetter geladen).
  const sterne = $derived(sterneBewertung(lat, lon, tag, wetter?.wolken ?? null))

  async function toggle() {
    offen = !offen
    if (offen && $online && !wetter && !wetterLaden) {
      wetterLaden = true
      wetterFehler = null
      try { wetter = await holeWetter(lat, lon) }
      catch (e) { wetterFehler = t('Wetter nicht verfügbar') }
      wetterLaden = false
    }
  }
</script>

<div class="sw">
  <button class="strip" onclick={toggle} title={t('Sonne & Wetter')}>
    <span>🌅 {s.aufgang}</span>
    <span>🌇 {s.untergang}</span>
    {#if $online && wetter}<span>{wetter.icon} {wetter.temp}{wetter.einheit}</span>{/if}
    {#if sterne.sterne >= 2}<span class="stern" title={t('Gute Sternennacht ({label}, Mond {mondProzent}%)', { label: sterne.label, mondProzent: sterne.mondProzent })}>{sterneIcon(sterne.sterne)}</span>{/if}
    <span class="aufklapp klein sw-chev" class:offen={offen}></span>
  </button>

  {#if offen}
    <div class="details">
      <div class="sun-grid">
        <div><b>{t('🔵 Blaue Stunde')}</b><br />{t('früh {wert}–{wert2}', { wert: s.blauMorgen[0], wert2: s.blauMorgen[1] })}<br />{t('abends {wert}–{wert2}', { wert: s.blauAbend[0], wert2: s.blauAbend[1] })}</div>
        <div><b>{t('✨ Goldene Stunde')}</b><br />{t('früh {wert}–{wert2}', { wert: s.goldenMorgen[0], wert2: s.goldenMorgen[1] })}<br />{t('abends {wert}–{wert2}', { wert: s.goldenAbend[0], wert2: s.goldenAbend[1] })}</div>
      </div>
      <div class="noon">{t('☀️ Höchststand {mittag}', { mittag: s.mittag })}</div>

      <div class="astro">
        <b>{t('{sterneIcon} Sternenfotografie: {label}', { sterneIcon: sterneIcon(sterne.sterne), label: sterne.label })}</b>
        <span class="a-sub">{t('Mond {mondProzent}% ({phaseName})', { mondProzent: sterne.mondProzent, phaseName: sterne.phaseName })}{#if !sterne.astroDunkel}&nbsp;{t('· keine astronom. Dunkelheit')}{/if}{#if sterne.wolken != null}&nbsp;{t('· Wolken {wolken}%', { wolken: sterne.wolken })}{:else}&nbsp;{t('· Wolken online')}{/if}</span>
      </div>

      <div class="wetter">
        {#if !$online}
          <span class="offline">{t('🌐 Wetter nur online')}</span>
        {:else if wetterLaden}
          <span class="offline">{t('Wetter lädt …')}</span>
        {:else if wetterFehler}
          <span class="offline">{wetterFehler}</span>
        {:else if wetter}
          <span class="w-main">{wetter.icon} {wetter.temp}{wetter.einheit} · {wetter.text}</span>
          <span class="w-sub">{t('↑{max}° ↓{min}° · 💨 {wind} km/h · 💧 {feuchte}%', { max: wetter.max, min: wetter.min, wind: wetter.wind, feuchte: wetter.feuchte })}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .sw { border-top: 1px dashed var(--line); padding-top: 6px; }
  .strip {
    width: 100%; display: flex; align-items: center; gap: 10px; background: none; border: none;
    cursor: pointer; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); padding: 2px 0; font-weight: 600;
  }
  .strip .stern { font-size: calc(13px * var(--schrift, 1)); }
  .sw-chev { margin-left: auto; }
  .astro { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--line); font-size: calc(12px * var(--schrift, 1)); }
  .astro b { color: #3a3560; }
  .astro .a-sub { display: block; color: var(--muted); margin-top: 2px; }
  .details { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); padding: 6px 0 2px; }
  .sun-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sun-grid b { color: var(--btn-ink); font-size: calc(12px * var(--schrift, 1)); }
  .noon { margin-top: 6px; color: var(--muted); }
  .wetter { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--line); display: flex; flex-direction: column; gap: 2px; }
  .w-main { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); font-weight: 600; }
  .w-sub { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .offline { font-size: calc(12px * var(--schrift, 1)); color: #a99; }
  /* Größere Tippfläche ohne größere Optik (Apple: 44 pt) */
  .strip { position: relative; min-height: 32px; }
  .strip::after { content: ''; position: absolute; inset: -6px 0; }
</style>
