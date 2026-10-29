<script>
  import { t, tn, je } from './i18n.js'
  // Tierwelt-Album: alle Arten als Kacheln. Gesehene in Farbe mit erstem Datum und Ort,
  // offene ausgegraut. Quelle sind die Sichtungen im Logbuch und „Lebend gesehen“.
  import { get } from 'svelte/store'
  import { journal, neuerJournalEintrag, updateJournalEintrag } from './userdata.js'
  import { album, ART, mitSichtung } from './tierwelt.js'
  import { zielEintrag } from './foto-zuordnung.js'
  import { tagMonat, tagMonatJahr } from './format.js'
  import { geh } from './navigation.js'
  import { zeigeToast } from './toast.js'
  import { dauer, klapp } from './motion.js'
  import SichtungFormular from './SichtungFormular.svelte'

  let { orte = [], ontag = (d) => geh('logbuch/tag/' + d) } = $props()

  const alb = $derived(album($journal))
  let gewaehlt = $state(null)     // Art-ID oder 'eigen:…'
  let formArt = $state(null)      // null = zu, '' = ohne Vorauswahl
  let detail = $state(null)

  const info = $derived(gewaehlt ? (alb.arten.find((a) => a.id === gewaehlt) || alb.eigene.find((a) => a.id === gewaehlt) || null) : null)

  function waehle(id) {
    gewaehlt = gewaehlt === id ? null : id
    formArt = null
    if (gewaehlt) requestAnimationFrame(() => detail?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  function eintragen(art = '') { formArt = art; gewaehlt = art || null }

  function speichern(s, datum) {
    const d = datum || ''
    const ziel = zielEintrag(get(journal), d)
    if (ziel) updateJournalEintrag(ziel.id, { sichtungen: mitSichtung(ziel.sichtungen, s) })
    else {
      const id = neuerJournalEintrag({ datum: d, ort: s.ort || '' })
      updateJournalEintrag(id, { sichtungen: [s] })
    }
    formArt = null
    gewaehlt = ART[s.art] ? s.art : null
    zeigeToast(t('{wert} am {tagMonat} eingetragen', { wert: ART[s.art]?.name || s.name, tagMonat: tagMonat(d) }), 'ok')
  }
  const kurzOrt = (s) => s?.ort || ''
</script>

<section class="tw" aria-labelledby="tw-titel">
  <header class="tw-kopf">
    <div>
      <h2 id="tw-titel">{t('Tierwelt')}</h2>
      <p class="tw-stand"><b>{t('{gesehen} von {gesamt}', { gesehen: alb.gesehen, gesamt: alb.gesamt })}</b> {t('gesehen')}{#if alb.eigene.length}{tn(alb.eigene.length, ', dazu {n} weitere Art', ', dazu {n} weitere Arten')}{/if}</p>
    </div>
    <button class="btn" onclick={() => eintragen('')}>{t('+ Sichtung')}</button>
  </header>
  <div class="tw-balken" role="progressbar" aria-label={t('Arten gesehen')} aria-valuemin="0" aria-valuemax={alb.gesamt} aria-valuenow={alb.gesehen}>
    <span style="transform: scaleX({alb.gesamt ? alb.gesehen / alb.gesamt : 0})"></span>
  </div>

  {#if formArt === ''}
    <div transition:klapp={{ duration: dauer(220) }}>
      <SichtungFormular {orte} mitDatum onspeichern={speichern} onabbrechen={() => (formArt = null)} />
    </div>
  {/if}

  <ul class="tw-raster">
    {#each alb.arten as a, i (a.id)}
      <li style="--i:{i}">
        <button class="tw-kachel" class:gesehen={a.gesehen} class:aktiv={gewaehlt === a.id} aria-expanded={gewaehlt === a.id} onclick={() => waehle(a.id)}
          aria-label="{a.name}, {a.gesehen ? t('gesehen, zuerst am {tagMonatJahr}', { tagMonatJahr: tagMonatJahr(a.erste.datum) }) : t('noch nicht gesehen')}">
          <span class="tw-emoji" aria-hidden="true">{a.emoji}</span>
          <span class="tw-name">{a.name}</span>
          {#if a.gesehen}
            <span class="tw-meta">{a.erste.datum ? tagMonat(a.erste.datum) : ''}{#if kurzOrt(a.erste)}, {kurzOrt(a.erste)}{/if}</span>
            {#if a.anzahl > 1}<span class="tw-zahl">{a.anzahl}×</span>{/if}
          {:else}
            <span class="tw-meta">{a.hinweis || je('noch offen', 'not seen yet')}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>

  {#if alb.eigene.length}
    <h3 class="tw-unter">{t('Außerdem gesehen')}</h3>
    <ul class="tw-raster">
      {#each alb.eigene as a (a.id)}
        <li>
          <button class="tw-kachel gesehen" class:aktiv={gewaehlt === a.id} aria-expanded={gewaehlt === a.id} onclick={() => waehle(a.id)}>
            <span class="tw-emoji" aria-hidden="true">{a.emoji}</span>
            <span class="tw-name">{a.name}</span>
            <span class="tw-meta">{a.erste.datum ? tagMonat(a.erste.datum) : ''}{#if kurzOrt(a.erste)}, {kurzOrt(a.erste)}{/if}</span>
            {#if a.anzahl > 1}<span class="tw-zahl">{a.anzahl}×</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if info}
    <div class="tw-detail" bind:this={detail} transition:klapp={{ duration: dauer(220) }} role="region" aria-labelledby="tw-d-titel">
      <div class="tw-d-kopf">
        <span class="tw-d-emoji" aria-hidden="true">{info.emoji}</span>
        <div>
          <h3 id="tw-d-titel">{info.name}</h3>
          <p>{info.gesehen ? tn(info.anzahl, '{n} Sichtung', '{n} Sichtungen') + (info.tiere > info.anzahl ? ', ' + t('{n} Tiere', { n: info.tiere }) : '') : (info.hinweis ? t('Noch nicht gesehen. {hinweis}.', { hinweis: info.hinweis }) : t('Noch nicht gesehen.'))}</p>
        </div>
      </div>
      {#if info.sichtungen.length}
        <ul class="tw-d-liste">
          {#each info.sichtungen as s (s.id)}
            <li>
              {#if s.foto}<img src={s.foto} alt={t('Foto: {name}', { name: info.name })} loading="lazy" />{/if}
              <div class="tw-d-txt">
                {#if s.datum}<button class="tw-d-tag" onclick={() => ontag(s.datum)}>{tagMonatJahr(s.datum)}</button>{/if}
                <span>{[s.ort, (s.anzahl || 1) > 1 ? t('{n} Tiere', { n: s.anzahl }) : '', s.strassenrand ? t('am Straßenrand') : ''].filter(Boolean).join(', ')}</span>
                {#if s.notiz}<small>{s.notiz}</small>{/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
      {#if formArt === info.id}
        <div transition:klapp={{ duration: dauer(220) }}>
          <SichtungFormular art={info.id} {orte} mitDatum onspeichern={speichern} onabbrechen={() => (formArt = null)} />
        </div>
      {:else if ART[info.id]}
        <button class="btn" onclick={() => (formArt = info.id)}>{info.gesehen ? t('Wieder gesehen: eintragen') : t('Gesehen: eintragen')}</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .tw { display: flex; flex-direction: column; gap: 14px; }
  .tw-kopf { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .tw-kopf h2 { margin: 0; font-size: calc(23px * var(--schrift, 1)); }
  .tw-stand { margin: 2px 0 0; font-size: calc(14.5px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .tw-stand b { color: var(--ink); }
  .tw-balken { height: 8px; border-radius: 4px; background: var(--flaeche-2); overflow: hidden; }
  .tw-balken span { display: block; height: 100%; background: var(--ok); transform-origin: left; transition: transform var(--t-slow) var(--ease-out); }

  .tw-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
  .tw-kachel {
    position: relative; width: 100%; min-height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 3px;
    padding: 10px 6px 8px; border-radius: var(--radius-m); border: 1px dashed var(--line-stark); background: var(--flaeche);
    color: var(--muted); cursor: pointer; text-align: center;
    transition: transform var(--t-feder) var(--ease-federnd), border-color var(--t-fast) var(--ease-out);
  }
  .tw-kachel.gesehen { border-style: solid; border-color: var(--line); background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
  .tw-kachel.aktiv { border-color: var(--brand); outline: 2px solid color-mix(in srgb, var(--brand) 30%, transparent); }
  .tw-emoji { font-size: calc(34px * var(--schrift, 1)); line-height: 1.1; filter: grayscale(1); opacity: 0.4; }
  .tw-kachel.gesehen .tw-emoji { filter: none; opacity: 1; }
  .tw-name { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; line-height: 1.2; }
  .tw-meta { font-size: calc(12px * var(--schrift, 1)); line-height: 1.25; color: var(--muted); }
  .tw-zahl { position: absolute; top: 6px; right: 8px; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--ok-text); background: var(--ok-flaeche); padding: 1px 6px; border-radius: 8px; }
  .tw-unter { margin: 4px 0 0; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); }

  .tw-detail { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; scroll-margin: 90px; }
  .tw-d-kopf { display: flex; align-items: center; gap: 12px; }
  .tw-d-emoji { font-size: calc(40px * var(--schrift, 1)); }
  .tw-d-kopf h3 { margin: 0; font-size: calc(18px * var(--schrift, 1)); }
  .tw-d-kopf p { margin: 2px 0 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); }
  .tw-d-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .tw-d-liste li { display: flex; gap: 10px; align-items: flex-start; }
  .tw-d-liste img { width: 88px; height: 66px; object-fit: cover; border-radius: 8px; flex: none; }
  .tw-d-txt { display: flex; flex-direction: column; gap: 2px; font-size: calc(14px * var(--schrift, 1)); min-width: 0; }
  .tw-d-txt small { color: var(--muted); font-size: calc(13px * var(--schrift, 1)); white-space: pre-line; }
  .tw-d-tag { align-self: flex-start; background: none; border: none; padding: 0; min-height: 32px; color: var(--brand-text); font-weight: 700; font-size: calc(14px * var(--schrift, 1)); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  @media (hover: hover) and (pointer: fine) { .tw-kachel:hover { border-color: var(--brand); } }
</style>
