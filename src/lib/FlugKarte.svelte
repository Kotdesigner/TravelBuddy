<script>
  // Ein Flug mit allem, was die Abfrage weiß. Auf „Heute“ in kurz, auf der Flugseite in lang.
  // „Live“ oder „Nur Flugplan“ steht immer dabei: ohne Live-Daten heißt keine Verspätung nicht pünktlich.
  import { t, LOCALE } from './i18n.js'
  import { mitWochentag } from './format.js'
  import { statusText, verspaetung, istSchlecht, dauerText, abfrageDatum } from './flug.js'
  import BelegKnoepfe from './BelegKnoepfe.svelte'

  let { flug, stand = null, staende = {}, jetzt = Date.now(), umstieg = null, kurz = false, onabfragen = null, onaendern = null, laden = false } = $props()
  const bahn = $derived(flug.art === 'bahn')
  const d = $derived(stand?.daten || null)
  const datum = $derived(d?.ab.planDatum || abfrageDatum(flug, staende))
  const live = $derived(!!(d?.ab.live || d?.an.live))
  const schlecht = $derived(istSchlecht(d))
  const zeitFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
  const geholt = $derived(stand?.geholt ? zeitFmt.format(stand.geholt) : '')
</script>

<article class="fk" class:schlecht>
  <header class="fk-kopf">
    <span class="fk-nr">{bahn ? '🚆' : '✈️'} {flug.nr}</span>
    {#if d}<span class="fk-status" class:rot={schlecht}>{statusText(d, jetzt)}</span>{/if}
    {#if d}<span class="fk-art" class:an={live}>{live ? t('Live') : t('Nur Flugplan')}</span>{/if}
  </header>

  {#if d}
    <p class="fk-weg">{#if bahn}{d.ab.ort} → {d.an.ort}{:else}{d.ab.ort || d.ab.iata} ({d.ab.iata}) → {d.an.ort || d.an.iata} ({d.an.iata}){/if}</p>
    <p class="fk-klein">{mitWochentag(datum)}{#if d.airline}&nbsp;· {d.airline}{/if}{#if d.flugzeug && !kurz}&nbsp;· {d.flugzeug}{/if}</p>
    <div class="fk-spalten">
      {#each bahn ? [[t('Abfahrt'), d.ab]] : [[t('Abflug'), d.ab], [t('Ankunft'), d.an]] as [name, p]}
        {@const spaeter = verspaetung(p)}
        <div class="fk-seite">
          <span class="fk-name">{name}</span>
          <span class="fk-zeit">
            {#if p.neuZeit && p.neuZeit !== p.planZeit}<s>{p.planZeit}</s> <b class:rot={(spaeter ?? 0) >= 15}>{p.neuZeit}</b>{:else}<b>{p.planZeit || '–'}</b>{/if}
          </span>
          {#if spaeter && spaeter > 0}<span class="fk-klein rot">{t('{m} Min. später', { m: spaeter })}</span>{/if}
          <dl>
            {#if p.gleis}<dt>{t('Gleis')}</dt><dd>{p.gleis}{#if p.gleisAlt}&nbsp;<s>{p.gleisAlt}</s>{/if}</dd>{/if}
            {#if p.terminal}<dt>{t('Terminal')}</dt><dd>{p.terminal}</dd>{/if}
            {#if p.schalter}<dt>{t('Check-in')}</dt><dd>{p.schalter}</dd>{/if}
            {#if p.gate}<dt>{t('Gate')}</dt><dd>{p.gate}</dd>{/if}
            {#if p.band}<dt>{t('Gepäckband')}</dt><dd>{p.band}</dd>{/if}
          </dl>
        </div>
      {/each}
    </div>
    {#each d.hinweise || [] as h}<p class="fk-klein">{h}</p>{/each}
  {:else}
    <p class="fk-weg">{flug.titel}</p>
    <p class="fk-klein">{mitWochentag(datum)}{#if flug.zeit}&nbsp;· {t('{zeit} Uhr', { zeit: flug.zeit })}{/if}{#if bahn && flug.bahnhof}&nbsp;· {flug.bahnhof}{/if}</p>
    {#if bahn}<p class="fk-hinweis">{t('Live-Daten kommen etwa 3 Stunden vor der Abfahrt.')}</p>
    {:else if stand?.leer}<p class="fk-hinweis">{t('Der Dienst kennt diesen Flug an diesem Tag noch nicht. Die App sieht wieder nach.')}</p>{/if}
  {/if}

  {#if umstieg}
    <p class="fk-hinweis" class:rot={umstieg.knapp}>
      {#if umstieg.verpasst}{t('⚠️ Anschluss in {ort} ist nach diesen Zeiten nicht zu schaffen.', { ort: umstieg.ort })}
      {:else if umstieg.knapp}{t('⚠️ Umstieg in {ort} wird knapp: noch {dauer}.', { ort: umstieg.ort, dauer: dauerText(umstieg.minuten) })}
      {:else}{t('Umstieg in {ort}: {dauer}', { ort: umstieg.ort, dauer: dauerText(umstieg.minuten) })}{/if}
    </p>
  {/if}

  {#if !kurz}
    {#each stand?.verlauf || [] as v}
      <p class="fk-klein">{zeitFmt.format(v.zeit)}: {v.text}</p>
    {/each}
    {#if flug.sitz || flug.ref}<p class="fk-klein">{#if flug.ref}{t('Buchung {ref}', { ref: flug.ref })}{/if}{#if flug.ref && flug.sitz}{' · '}{/if}{#if flug.sitz}{t('Sitzplatz {wert}', { wert: flug.sitz })}{/if}</p>{/if}
    {#if flug.docs?.length}<BelegKnoepfe docs={flug.docs} klein />{/if}
    <footer class="fk-fuss">
      <span class="fk-klein">{#if geholt}{t('Abgefragt {zeit}', { zeit: geholt })}{/if}</span>
      <span class="fk-knoepfe">
        {#if onaendern}<button class="fk-knopf" onclick={() => onaendern(flug)}>{t('Ändern')}</button>{/if}
        {#if onabfragen}<button class="fk-knopf" disabled={laden} onclick={() => onabfragen(flug)}>{t('Aktualisieren')}</button>{/if}
      </span>
    </footer>
  {/if}
</article>

<style>
  .fk { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 6px; }
  .fk.schlecht { border-color: var(--danger-linie); background: var(--danger-flaeche); }
  .fk p { margin: 0; }
  .fk-kopf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .fk-nr { font-weight: 800; font-size: calc(17px * var(--schrift, 1)); }
  .fk-status { font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); color: var(--ok-text); }
  .fk-status.rot, .rot { color: var(--danger-text); }
  .fk-art { margin-left: auto; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 2px 8px; border-radius: 10px; background: var(--flaeche-2); color: var(--muted); }
  .fk-art.an { background: var(--ok-flaeche); color: var(--ok-text); }
  .fk-weg { font-weight: 700; font-size: calc(15px * var(--schrift, 1)); }
  .fk-klein { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .fk-klein.rot { color: var(--danger-text); font-weight: 700; }
  .fk-spalten { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
  .fk-seite { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .fk-name { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-weight: 700; }
  .fk-zeit { font-size: calc(19px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .fk-zeit s { font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .fk-zeit b { font-weight: 800; }
  .fk-zeit b.rot { color: var(--danger-text); }
  dl { margin: 2px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 1px 8px; font-size: calc(13.5px * var(--schrift, 1)); }
  dt { color: var(--muted); }
  dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
  .fk-hinweis { font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); border-radius: var(--radius-s); padding: 8px 10px; }
  .fk-hinweis.rot { background: var(--danger-flaeche); color: var(--danger-text); font-weight: 700; }
  .fk-fuss { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 2px; }
  .fk-knoepfe { display: flex; gap: 6px; flex: none; }
  .fk-knopf { min-height: 36px; padding: 0 12px; border-radius: var(--radius-s); border: 1px solid var(--line-stark); background: var(--flaeche); color: var(--btn-ink); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; flex: none; }
  .fk-knopf:disabled { opacity: 0.5; cursor: default; }
</style>
