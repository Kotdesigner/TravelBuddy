<script>
  import { t, tn } from './i18n.js'
  // Mehrere Fotos auf einmal ins Logbuch: Aufnahmedatum und Ort aus den Bilddaten (EXIF)
  // lesen, jedes Foto seinem Tag zuordnen, vorher zeigen, was passiert.
  // Fotos ohne Datum landen auf einem Tag, den man selbst wählt.
  import { get } from 'svelte/store'
  import { onDestroy } from 'svelte'
  import { journal, neuerJournalEintrag, updateJournalEintrag } from './userdata.js'
  import { macheThumbnail, heute as heuteYmd } from './thumbnail.js'
  import { exifAusDatei } from './exif.js'
  import { planeFotos, zusammenfassung, zielEintrag, tagesPatch, standardTag } from './foto-zuordnung.js'
  import { mitWochentag } from './format.js'
  import { zeigeToast } from './toast.js'
  import { dauer, klapp } from './motion.js'

  let { orte = [], vorgabeTag = null, kompakt = false, neben = null } = $props()

  const uid = Math.random().toString(36).slice(2, 8)
  let eingabe = $state(null)
  let phase = $state('zu')            // zu | lesen | vorschau | speichern
  let fotos = $state([])               // [{ id, file, name, groesse, datum, zeit, lat, lon, url }]
  let raus = $state(new Set())
  let ohneDatumTag = $state('')
  let schritt = $state({ n: 0, von: 0 })
  let abbruch = false

  const plan = $derived(planeFotos(fotos, { orte, ohneDatumTag: ohneDatumTag || null, journal: $journal, ausgeschlossen: raus }))
  const zumSpeichern = $derived(plan.tage.reduce((n, t) => n + t.fotos.length, 0))
  const ohneOrt = $derived(plan.anzahl - plan.mitOrt)

  function waehlen() { eingabe?.click() }

  async function gewaehlt(e) {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    aufraeumen()
    abbruch = false
    phase = 'lesen'
    schritt = { n: 0, von: dateien.length }
    ohneDatumTag = standardTag({ vorgabe: vorgabeTag, heute: heuteYmd() })
    const liste = []
    for (const [i, f] of dateien.entries()) {
      if (abbruch) return
      const x = await exifAusDatei(f)
      liste.push({
        id: i + 1, file: f, name: f.name || t('Foto {wert}', { wert: i + 1 }), groesse: f.size, lastModified: f.lastModified,
        datum: x.datum, zeit: x.zeit, lat: x.lat, lon: x.lon,
        url: (() => { try { return URL.createObjectURL(f) } catch { return '' } })(),
      })
      schritt = { n: i + 1, von: dateien.length }
    }
    fotos = liste
    raus = new Set()
    phase = 'vorschau'
  }

  function aufraeumen() {
    for (const f of fotos) if (f.url) try { URL.revokeObjectURL(f.url) } catch {}
    fotos = []
  }
  function schliessen() {
    abbruch = true
    aufraeumen()
    phase = 'zu'
  }
  onDestroy(aufraeumen)

  function weglassen(id) { const s = new Set(raus); s.add(id); raus = s }

  async function uebernehmen() {
    const tage = plan.tage
    const gesamt = zumSpeichern
    if (!gesamt) return
    phase = 'speichern'
    abbruch = false
    schritt = { n: 0, von: gesamt }
    let gespeichert = 0, fehler = 0, neueTage = 0, tageMitFotos = 0
    for (const tag of tage) {
      const bilder = []
      for (const foto of tag.fotos) {
        if (abbruch) break
        try { bilder.push({ foto, src: await macheThumbnail(foto.file) }) } catch { fehler++ }
        schritt = { n: schritt.n + 1, von: gesamt }
      }
      if (!bilder.length) continue
      // Erst jetzt den aktuellen Stand holen: dazwischen kann sich das Logbuch geändert haben
      const ziel = zielEintrag(get(journal), tag.datum)
      const { patch, vorlage, neu } = tagesPatch(ziel, bilder)
      if (!neu) continue
      if (ziel) updateJournalEintrag(ziel.id, patch)
      else {
        const id = neuerJournalEintrag({ datum: tag.datum, ...vorlage, fotos: patch.fotos })
        updateJournalEintrag(id, { fotoMeta: patch.fotoMeta })
        neueTage++
      }
      gespeichert += neu
      tageMitFotos++
    }
    aufraeumen()
    phase = 'zu'
    if (gespeichert) {
      const meldung = t('{fotos} an {tage} einsortiert', { fotos: tn(gespeichert, '{n} Foto', '{n} Fotos'), tage: tn(tageMitFotos, '{n} Tag', '{n} Tagen') })
        + (neueTage ? ', ' + tn(neueTage, '{n} Tag neu angelegt', '{n} Tage neu angelegt') : '')
      zeigeToast(meldung, 'ok', 4000)
    }
    if (fehler) zeigeToast(tn(fehler, '{n} Bild ließ sich nicht öffnen. HEIC klappt nur in Safari.', '{n} Bilder ließen sich nicht öffnen. HEIC klappt nur in Safari.'), 'fehler', 6000)
  }
</script>

<div class="fi" class:kompakt class:offen={phase !== 'zu'}>
  <div class="fi-zeile">
  <button type="button" class={kompakt ? 'fi-knopf klein' : 'btn fi-knopf'} onclick={waehlen} disabled={phase === 'lesen' || phase === 'speichern'}
    aria-expanded={phase !== 'zu'} aria-controls="fi-panel-{uid}">
    <span aria-hidden="true">🗺️</span> {t('Fotos hinzufügen (mit Ort und Datum)')}
  </button>
  {#if neben}{@render neben()}{/if}
  </div>
  <input bind:this={eingabe} class="fi-datei" type="file" accept="image/*,.heic,.heif" multiple onchange={gewaehlt} tabindex="-1" aria-hidden="true" />
  {#if !kompakt && phase === 'zu'}
    <p class="fi-tipp">{t('Jedes Foto landet am Tag seiner Aufnahme. Am iPhone in der Fotoauswahl oben auf „Optionen“ tippen und „Ort“ einschalten, sonst entfernt iOS den Aufnahmeort.')}</p>
  {/if}

  {#if phase !== 'zu'}
    <section class="fi-panel" id="fi-panel-{uid}" aria-labelledby="fi-titel-{uid}" transition:klapp={{ duration: dauer(220) }}>
      <h3 id="fi-titel-{uid}">{t('Fotos einsortieren')}</h3>

      {#if phase === 'lesen'}
        <p class="fi-status" aria-live="polite">{t('Lese Aufnahmedaten … {n} von {von}', { n: schritt.n, von: schritt.von })}</p>
        <div class="fi-balken" aria-hidden="true"><span style="transform: scaleX({schritt.von ? schritt.n / schritt.von : 0})"></span></div>
        <button class="btn" onclick={schliessen}>{t('Abbrechen')}</button>

      {:else if phase === 'speichern'}
        <p class="fi-status" aria-live="polite">{t('Verkleinere und speichere … {n} von {von}', { n: schritt.n, von: schritt.von })}</p>
        <div class="fi-balken" aria-hidden="true"><span style="transform: scaleX({schritt.von ? schritt.n / schritt.von : 0})"></span></div>

      {:else}
        <p class="fi-summe" aria-live="polite"><b>{zusammenfassung(plan)}</b></p>
        {#if plan.doppelt}
          <p class="fi-hinweis">{tn(plan.doppelt, '{n} Foto ist schon im Logbuch und wird übersprungen.', '{n} Fotos sind schon im Logbuch und werden übersprungen.')}</p>
        {/if}
        {#if plan.anzahl && ohneOrt > 0}
          <p class="fi-hinweis">{t('{wert} Am iPhone: in der Fotoauswahl oben „Optionen“ antippen und „Ort“ einschalten, dann die Fotos neu wählen.', { wert: ohneOrt === plan.anzahl ? t('Kein Foto hat einen Aufnahmeort.') : tn(ohneOrt, '{n} Foto hat keinen Aufnahmeort.', '{n} Fotos haben keinen Aufnahmeort.') })}</p>
        {/if}

        {#if plan.ohneDatum.length}
          <div class="fi-ohne">
            <label for="fi-tag-{uid}">{tn(plan.ohneDatum.length, '{n} Foto ohne Aufnahmedatum kommt auf diesen Tag:', '{n} Fotos ohne Aufnahmedatum kommen auf diesen Tag:')}</label>
            <input id="fi-tag-{uid}" type="date" bind:value={ohneDatumTag} />
          </div>
        {/if}

        <ol class="fi-tage">
          {#each plan.tage as tg (tg.datum)}
            <li class="fi-tag">
              <div class="fi-tag-kopf">
                <b>{mitWochentag(tg.datum)}</b>
                <span class="fi-pill" class:neu={tg.neu}>{tg.neu ? t('neuer Eintrag') : t('kommt zu deinem Eintrag')}</span>
              </div>
              <ul class="fi-bilder">
                {#each tg.fotos as f (f.id)}
                  <li class="fi-bild">
                    {#if f.url}<img src={f.url} alt="" loading="lazy" onerror={(e) => e.currentTarget.classList.add('kaputt')} />{/if}
                    <span class="fi-ph" aria-hidden="true">📷</span>
                    {#if f.lat != null}<span class="fi-pin" title={f.ort?.name || t('mit Ort')} aria-hidden="true">📍</span>{/if}
                    <button class="fi-weg" onclick={() => weglassen(f.id)} aria-label={t('{name} nicht übernehmen', { name: f.name })}>✕</button>
                    {#if f.ort}<span class="fi-ort">{f.ort.name}</span>{/if}
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ol>

        <div class="fi-aktion">
          <button class="btn" onclick={schliessen}>{t('Abbrechen')}</button>
          <button class="btn-primary" onclick={uebernehmen} disabled={!zumSpeichern}>
            {zumSpeichern ? tn(zumSpeichern, '{n} Foto übernehmen', '{n} Fotos übernehmen') : t('Nichts zu übernehmen')}
          </button>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .fi { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; min-width: 0; }
  .fi.kompakt.offen { flex: 1 1 100%; }
  .fi-zeile { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; }
  .fi-knopf { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
  .fi-knopf.klein {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); background: none; border: 1px dashed var(--line-stark);
    border-radius: 8px; padding: 6px 10px; cursor: pointer; margin-top: 8px;
  }
  .fi-knopf:disabled { opacity: 0.5; cursor: default; }
  .fi-datei { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; overflow: hidden; }
  .fi-tipp { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; max-width: 60ch; }

  .fi-panel {
    align-self: stretch; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m);
    box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
  }
  .fi-panel h3 { margin: 0; font-size: calc(16px * var(--schrift, 1)); }
  .fi-status { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .fi-balken { height: 6px; border-radius: 3px; background: var(--flaeche-2); overflow: hidden; }
  .fi-balken span { display: block; height: 100%; background: var(--brand); transform-origin: left; transition: transform var(--t-med) var(--ease-out); }
  .fi-summe { margin: 0; font-size: calc(16px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .fi-hinweis { margin: 0; font-size: calc(13px * var(--schrift, 1)); line-height: 1.45; background: var(--flaeche); border-radius: var(--radius-s); padding: 8px 10px; color: var(--ink); }
  .fi-ohne { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: calc(13.5px * var(--schrift, 1)); }
  .fi-ohne input { min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); font-size: calc(15px * var(--schrift, 1)); }

  .fi-tage { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; max-height: 52vh; overflow-y: auto; overscroll-behavior: contain; }
  .fi-tag-kopf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: calc(14px * var(--schrift, 1)); margin-bottom: 6px; }
  .fi-pill { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 2px 8px; border-radius: 9px; background: var(--flaeche-2); color: var(--muted); }
  .fi-pill.neu { background: var(--ok-flaeche); color: var(--ok-text); }
  .fi-bilder { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
  .fi-bild { position: relative; width: 72px; display: flex; flex-direction: column; gap: 3px; }
  .fi-bild img, .fi-ph { width: 72px; height: 72px; border-radius: 8px; object-fit: cover; border: 1px solid var(--line); background: var(--flaeche-2); }
  .fi-bild img { position: relative; z-index: 1; }
  .fi-bild :global(img.kaputt) { visibility: hidden; }
  .fi-ph { position: absolute; top: 0; left: 0; display: grid; place-items: center; font-size: calc(22px * var(--schrift, 1)); }
  .fi-pin { position: absolute; z-index: 2; left: 3px; top: 50px; font-size: calc(13px * var(--schrift, 1)); filter: drop-shadow(0 1px 1px rgba(0,0,0,.4)); }
  .fi-weg {
    position: absolute; z-index: 2; top: -8px; right: -8px; width: 30px; height: 30px; border-radius: 50%;
    border: 2px solid var(--card); background: var(--ink); color: var(--bg); font-size: calc(12px * var(--schrift, 1)); cursor: pointer; line-height: 1;
  }
  /* Tippfläche größer als das sichtbare Kreuz */
  .fi-weg::after { content: ''; position: absolute; inset: -7px; }
  .fi-ort { font-size: calc(12px * var(--schrift, 1)); line-height: 1.2; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fi-aktion { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
</style>
