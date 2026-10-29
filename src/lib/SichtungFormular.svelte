<script>
  import { t } from './i18n.js'
  // Eine Tier-Sichtung erfassen: Art (Liste oder frei), Anzahl, Ort, optional Standort,
  // Notiz und Foto. Speichert nichts selbst, sondern gibt die fertige Sichtung zurück.
  import { get } from 'svelte/store'
  import { ARTEN, neueSichtung, sichtungGueltig } from './tierwelt.js'
  import { naechsterOrt } from './foto-zuordnung.js'
  import { macheThumbnail, heute as heuteYmd } from './thumbnail.js'
  import { standort, standortStatus, standortFehler, frageStandortAn, standortHinweis, standortFrisch } from './standort.js'
  import { untrack } from 'svelte'
  import Stepper from './Stepper.svelte'

  let { art: startArt = '', ort: startOrt = '', lat: startLat = null, lon: startLon = null, orte = [], mitDatum = false, datum: startDatum = '',
    onspeichern = () => {}, onabbrechen = () => {} } = $props()

  const uid = Math.random().toString(36).slice(2, 8)
  // Startwerte nur einmal übernehmen; danach gehört das Formular dem Nutzer
  const start = untrack(() => ({ art: startArt, ort: startOrt, lat: startLat, lon: startLon, datum: startDatum }))
  let art = $state(start.art || '')
  let eigenName = $state('')
  let anzahl = $state(1)
  let ort = $state(start.ort || '')
  let lat = $state(start.lat), lon = $state(start.lon)
  let notiz = $state('')
  let foto = $state('')
  let datum = $state(start.datum || heuteYmd())
  let fotoFehler = $state('')
  let standortMeldung = $state('')
  let holt = $state(false)
  let fotoEingabe = $state(null)

  const entwurf = $derived(neueSichtung({ art, name: eigenName, anzahl, ort: ort.trim(), lat, lon, notiz: notiz.trim(), foto }))
  const gueltig = $derived(sichtungGueltig(entwurf) && (!mitDatum || /^\d{4}-\d{2}-\d{2}$/.test(datum)))

  async function standortHolen() {
    holt = true; standortMeldung = ''
    try {
      let s = get(standort)
      if (!standortFrisch(s)) { await frageStandortAn({ hoheGenauigkeit: true, alterMs: 60000 }); s = get(standort) }
      if (s && standortFrisch(s)) {
        lat = Math.round(s.lat * 1e5) / 1e5; lon = Math.round(s.lon * 1e5) / 1e5
        const n = naechsterOrt(lat, lon, orte)
        if (!ort.trim() && n) ort = n.name
        standortMeldung = t('Standort übernommen{wert}{wert2}', { wert: s.genauigkeit ? ` (± ${s.genauigkeit} m)` : '', wert2: n ? t(', nahe {name}', { name: n.name }) : '' })
      } else standortMeldung = standortHinweis(get(standortStatus), get(standortFehler)) || t('Kein Standort verfügbar.')
    } finally { holt = false }
  }
  async function fotoGewaehlt(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    fotoFehler = ''
    try { foto = await macheThumbnail(f, 1200, 0.8) } catch { fotoFehler = t('Das Bild ließ sich nicht öffnen.') }
  }
  function speichern() {
    if (!gueltig) return
    onspeichern(entwurf, mitDatum ? datum : null)
  }
</script>

<form class="sf" onsubmit={(e) => { e.preventDefault(); speichern() }} aria-labelledby="sf-t-{uid}">
  <h4 id="sf-t-{uid}" class="sf-titel">{t('Welches Tier?')}</h4>
  <div class="sf-arten" role="group" aria-labelledby="sf-t-{uid}">
    {#each ARTEN as a (a.id)}
      <button type="button" class="sf-art" class:an={art === a.id} aria-pressed={art === a.id} onclick={() => (art = art === a.id ? '' : a.id)}>
        <span aria-hidden="true">{a.emoji}</span> {a.name}
      </button>
    {/each}
    <button type="button" class="sf-art" class:an={art === 'eigen'} aria-pressed={art === 'eigen'} onclick={() => (art = art === 'eigen' ? '' : 'eigen')}>
      <span aria-hidden="true">🐾</span> {t('Anderes Tier')}
    </button>
  </div>
  {#if art === 'eigen'}
    <label class="sf-feld">{t('Name des Tiers')}<input type="text" bind:value={eigenName} placeholder={t('z. B. Schnabeltier')} enterkeyhint="done" /></label>
  {/if}

  <div class="sf-reihe">
    <span class="sf-lbl">{t('Wie viele?')}</span>
    <Stepper value={anzahl} min={1} max={999} label={t('Anzahl Tiere')} onchange={(v) => (anzahl = v)} />
  </div>

  {#if mitDatum}
    <label class="sf-feld">{t('Datum')}<input type="date" bind:value={datum} /></label>
  {/if}

  <label class="sf-feld">Wo?<input type="text" bind:value={ort} placeholder={t('Ort, Strand, Straße')} /></label>
  <div class="sf-standort">
    <button type="button" class="btn" onclick={standortHolen} disabled={holt}>{holt ? t('Suche Standort …') : t('📍 Meinen Standort nehmen')}</button>
    {#if lat != null && lon != null}
      <span class="sf-klein">{lat.toFixed(4)}, {lon.toFixed(4)} <button type="button" class="sf-link" onclick={() => { lat = null; lon = null; standortMeldung = '' }}>{t('entfernen')}</button></span>
    {/if}
    {#if standortMeldung}<span class="sf-klein" aria-live="polite">{standortMeldung}</span>{/if}
  </div>

  <label class="sf-feld">{t('Notiz')}<textarea rows="2" bind:value={notiz} placeholder={t('Was war besonders?')}></textarea></label>

  <div class="sf-foto">
    {#if foto}
      <img src={foto} alt={t('Foto der Sichtung')} />
      <button type="button" class="btn" onclick={() => (foto = '')}>{t('Foto entfernen')}</button>
    {:else}
      <button type="button" class="btn" onclick={() => fotoEingabe?.click()}>{t('📷 Foto dazu')}</button>
    {/if}
    <input bind:this={fotoEingabe} class="sf-datei" type="file" accept="image/*" onchange={fotoGewaehlt} tabindex="-1" aria-hidden="true" />
    {#if fotoFehler}<span class="sf-klein fehler">{fotoFehler}</span>{/if}
  </div>

  <div class="sf-aktion">
    <button type="button" class="btn" onclick={onabbrechen}>{t('Abbrechen')}</button>
    <button type="submit" class="btn-primary" disabled={!gueltig}>{t('Sichtung speichern')}</button>
  </div>
</form>

<style>
  .sf { display: flex; flex-direction: column; gap: 12px; padding: 12px; background: var(--flaeche); border-radius: var(--radius-m); border: 1px solid var(--line); }
  .sf-titel { margin: 0; font-size: calc(14px * var(--schrift, 1)); }
  .sf-arten { display: flex; flex-wrap: wrap; gap: 6px; }
  .sf-art {
    min-height: 44px; padding: 0 12px; border-radius: 22px; border: 1px solid var(--line-stark); background: var(--card);
    color: var(--ink); font-size: calc(13.5px * var(--schrift, 1)); font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
    transition: background-color var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
  }
  .sf-art.an { background: var(--brand); border-color: var(--brand); color: #fff; }
  .sf-feld { display: flex; flex-direction: column; gap: 4px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .sf-feld input, .sf-feld textarea {
    min-height: 44px; font-size: calc(15px * var(--schrift, 1)); padding: 8px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s);
    background: var(--eingabe); color: var(--ink); font-weight: 400; font-family: inherit;
  }
  .sf-reihe { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sf-lbl { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .sf-standort, .sf-foto { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .sf-klein { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .sf-klein.fehler { color: var(--danger-text); }
  .sf-link { background: none; border: none; color: var(--brand-text); font-weight: 700; cursor: pointer; padding: 6px 4px; min-height: 36px; }
  .sf-foto img { width: 88px; height: 66px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line); }
  .sf-datei { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .sf-aktion { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
</style>
