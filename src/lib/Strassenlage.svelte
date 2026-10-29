<script>
  import { t, tn } from './i18n.js'
  import { dezimal } from './format.js'
  // Straßenlage WA (Main Roads WA): Sperrungen und Hinweise an Orten, Standort und Routen.
  import { onMount } from 'svelte'
  import { online } from './netz.js'
  import { reisen, eigeneOrte } from './userdata.js'
  import { schriftAuf } from './kontrast.js'
  import { klapp, dauer } from './motion.js'
  import { strassenlage, starteStrassenlage, aktualisiereStrassenlage } from './strassenlage-dienst.js'
  import { strassenInDerNaehe, strassenAnRouten, formatPerth, alterText, KARTE_URL } from './strassenlage.js'

  let { orte = [], meinOrt = null, umkreisKm = 150 } = $props()

  onMount(() => { starteStrassenlage() })
  // Zurück aus dem Funkloch: neu holen (der Dienst hält 15 Minuten Abstand ein).
  $effect(() => { if ($online) aktualisiereStrassenlage() })

  const lage = $derived($strassenlage)
  const meineOrte = $derived(orte?.length ? orte : $eigeneOrte)
  const nah = $derived(strassenInDerNaehe(lage.meldungen, { orte: meineOrte, position: meinOrt, umkreisKm }))
  const routen = $derived(strassenAnRouten(lage.meldungen, $reisen))
  const sperrAnzahl = $derived(lage.meldungen.filter((m) => m.rang >= 3).length)

  const kmText = (km) => (km == null || km === Infinity ? '' : km < 1 ? t('direkt dort') : (km < 10 ? dezimal(km, 1) : Math.round(km)) + ' km')

  const ZEIGE = 3
  let nahAlle = $state(false)
  let waAlle = $state(false)
</script>

<section class="sl" aria-labelledby="sl-titel">
  <div class="sl-kopf">
    <h3 id="sl-titel" class="sl-titel">{t('🛣️ Straßenlage WA')}</h3>
    {#if lage.meldungen.length}
      <span class="sl-zahl">{tn(sperrAnzahl, '{n} Sperrung · {length} Meldungen gesamt', '{n} Sperrungen · {length} Meldungen gesamt', { length: lage.meldungen.length })}</span>
    {/if}
  </div>

  {#if lage.laden && !lage.meldungen.length}
    <p class="sl-leise">{t('Straßenmeldungen werden geladen …')}</p>
  {:else if !lage.zeit && !$online}
    <p class="sl-leise">{t('🌐 Noch kein Stand geladen. Mit Netz holt die App die Straßenlage selbst. Danach bleibt sie auch offline sichtbar.')}</p>
  {/if}

  {#if lage.fehler}
    <div class="sl-fehler">⚠️ {lage.fehler}.{#if lage.zeit} {t('Angezeigt wird der letzte bekannte Stand.')}{/if}</div>
  {:else if lage.ausCache && lage.zeit}
    <div class="sl-cache">{t('📴 Letzter bekannter Stand vom {formatPerth} (Perth).', { formatPerth: formatPerth(lage.zeit) })}{#if !$online} {t('Offline.')}{/if} {t('Kann veraltet sein.')}</div>
  {/if}

  {#if routen.length}
    <div class="sl-route" role="group" aria-label={t('Meldungen auf deinen Routen')}>
      <div class="sl-route-t">{t('Auf deinen geplanten Routen')}</div>
      {#each routen as t (t.reiseId + t.meldung.id)}
        <div class="sl-route-z">
          <span class="sl-pill" style="background:{t.meldung.farbe};color:{schriftAuf(t.meldung.farbe)}">{t.meldung.icon} {t.meldung.level}</span>
          <span><b>{t.text}</b>: {t.meldung.strasse}{#if t.meldung.artDe}, {t.meldung.artDe}{/if}</span>
        </div>
      {/each}
    </div>
  {:else if lage.zeit && $reisen.some((r) => r.route?.geometry)}
    <div class="sl-ok">{t('✓ Keine Meldung liegt näher als 2 km an deinen berechneten Routen.')}</div>
  {/if}

  {#snippet karte(m)}
    <article class="sl-karte" style="border-left:5px solid {m.farbe}">
      <div class="sl-k-kopf">
        <span class="sl-pill" style="background:{m.farbe};color:{schriftAuf(m.farbe)}">{m.icon} {m.level}</span>
        <span class="sl-strasse">{m.strasse}</span>
        {#if m.km != null && m.naheBei}<span class="sl-km">{m.km < 1 ? t('direkt bei {ort}', { ort: m.naheBei }) : t('{km} von {ort}', { km: kmText(m.km), ort: m.naheBei })}</span>{/if}
      </div>
      {#if m.art}<div class="sl-art"><b>{t('Art:')}</b> {m.artDe}{#if m.artDe !== m.art} <span class="sl-orig">({m.art})</span>{/if}</div>{/if}
      {#if m.sperrung && m.sperrungDe !== m.level}<div class="sl-art"><b>{t('Zustand:')}</b> {m.sperrungDe} <span class="sl-orig">({m.sperrung})</span></div>{/if}
      {#if m.hinweis}
        <div class="sl-hinweis">
          {#if m.hinweisDe.length}<span class="sl-de">{t('Kurz gesagt: {join}', { join: m.hinweisDe.join(' · ') })}</span>{/if}
          <span class="sl-orig" lang="en">„{m.hinweis}“</span>
        </div>
      {/if}
      {#if m.ort && m.ort !== m.strasse}<div class="sl-ort">📍 {m.ort}{#if m.region} · {m.region}{/if}</div>{/if}
      <div class="sl-fuss">
        {#if m.zeitMs}<span>{t('Stand {formatPerth} Perth · {alterText}', { formatPerth: formatPerth(m.zeitMs), alterText: alterText(m.zeitMs) })}</span>{:else}<span>{t('Stand unbekannt')}</span>{/if}
        {#if m.link}<a href={m.link} target="_blank" rel="noopener">{t('Details ↗')}</a>{/if}
      </div>
    </article>
  {/snippet}

  {#if lage.meldungen.length}
    <div class="sl-u-t">{t('In der Nähe deiner Orte und deines Standorts ({wert})', { wert: umkreisKm === 0 ? t('nur direkt') : t('Umkreis {km} km', { km: umkreisKm }) })}</div>
    {#if nah.length === 0}
      <div class="sl-ok">{t('✓ Keine Straßenmeldung im gewählten Umkreis.')}</div>
    {:else}
      <div class="sl-liste">
        {#each nah.slice(0, ZEIGE) as m (m.id)}{@render karte(m)}{/each}
      </div>
      {#if nah.length > ZEIGE}
        {#if nahAlle}
          <div class="sl-liste sl-mehr-liste" transition:klapp={{ duration: dauer(240) }}>
            {#each nah.slice(ZEIGE) as m (m.id)}{@render karte(m)}{/each}
          </div>
        {/if}
        <button class="sl-mehr" aria-expanded={nahAlle} onclick={() => (nahAlle = !nahAlle)}>
          {nahAlle ? t('▲ weniger anzeigen') : t('▼ {wert} weitere in der Nähe', { wert: nah.length - ZEIGE })}
        </button>
      {/if}
    {/if}

    <button class="sl-mehr" aria-expanded={waAlle} onclick={() => (waAlle = !waAlle)}>
      {waAlle ? t('▲ ganz WA ausblenden') : t('▼ Alle {length} Meldungen in WA', { length: lage.meldungen.length })}
    </button>
    {#if waAlle}
      <div class="sl-liste sl-mehr-liste" transition:klapp={{ duration: dauer(240) }}>
        {#each lage.meldungen as m (m.id)}{@render karte(m)}{/each}
      </div>
    {/if}
  {:else if lage.zeit && !lage.fehler}
    <div class="sl-ok">{t('✓ Main Roads WA meldet gerade keine Sperrungen.')}</div>
  {/if}

  <div class="sl-quelle">
    <a class="sl-karte-link" href={KARTE_URL} target="_blank" rel="noopener">{t('Offizielle Karte: travelmap.mainroads.wa.gov.au ↗')}</a>
    <span>{t('Quelle: Main Roads WA. Zeiten in Perther Ortszeit. Vor jeder Fahrt ins Outback die offizielle Karte prüfen oder 138 138 anrufen.')}</span>
  </div>
</section>

<style>
  .sl { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
  .sl-kopf { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .sl-titel { font-size: calc(14px * var(--schrift, 1)); font-weight: 700; color: var(--ink); margin: 0 0 6px; }
  .sl-zahl { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .sl-leise { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); margin: 4px 0; }
  .sl-fehler { background: var(--warn-flaeche); color: var(--warn-text); border-radius: 8px; padding: 7px 10px; font-size: calc(12.5px * var(--schrift, 1)); margin: 6px 0; }
  .sl-cache { background: var(--info-flaeche); border: 1px solid var(--info-linie); color: var(--info-text); border-radius: 8px; padding: 7px 10px; font-size: calc(12.5px * var(--schrift, 1)); margin: 6px 0; }
  .sl-ok { font-size: calc(13px * var(--schrift, 1)); color: var(--ok-text); background: var(--ok-flaeche); padding: 8px 12px; border-radius: 8px; margin: 6px 0; }
  .sl-route { background: var(--warn-flaeche); border: 1px solid var(--danger-linie, var(--line)); border-radius: 8px; padding: 9px 12px; margin: 8px 0; display: flex; flex-direction: column; gap: 6px; }
  .sl-route-t { font-size: calc(13px * var(--schrift, 1)); font-weight: 800; color: var(--warn-text); }
  .sl-route-z { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; font-size: calc(13px * var(--schrift, 1)); color: var(--ink); }
  .sl-u-t { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin: 10px 0 6px; }
  .sl-liste { display: flex; flex-direction: column; gap: 8px; }
  .sl-mehr-liste { margin-top: 8px; }
  .sl-karte { background: var(--eingabe); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .sl-k-kopf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sl-pill { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 2px 9px; border-radius: 10px; white-space: nowrap; }
  .sl-strasse { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); }
  .sl-km { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-left: auto; }
  .sl-art { font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); margin-top: 5px; }
  .sl-hinweis { display: flex; flex-direction: column; gap: 2px; margin-top: 5px; font-size: calc(12.5px * var(--schrift, 1)); line-height: 1.45; }
  .sl-de { color: var(--ink); font-weight: 600; }
  .sl-orig { color: var(--muted); }
  .sl-ort { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 4px; }
  .sl-fuss { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 6px; }
  .sl-fuss a { color: var(--info-text); font-weight: 700; }
  .sl-mehr {
    display: block; width: 100%; min-height: 44px; margin-top: 8px; padding: 8px 12px; cursor: pointer;
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); text-align: center;
    background: var(--flaeche); border: 1px dashed var(--line); border-radius: 8px;
  }
  .sl-mehr:hover { background: var(--flaeche-2); }
  .sl-mehr:focus-visible, .sl-karte-link:focus-visible, .sl-fuss a:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .sl-quelle { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .sl-karte-link { display: inline-flex; align-items: center; min-height: 44px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--info-text); }
</style>
