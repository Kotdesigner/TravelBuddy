<script>
  // Die Angaben zu einem Flug oder Zug: Nummer, Datum, Buchung, Sitzplatz und Beleg.
  // Dasselbe Formular in Route, Etappe, Vorabausgaben und unter Flüge & Bahn.
  import { t } from './i18n.js'
  let { art = 'flug', angaben = $bindable(), datei = $bindable(null) } = $props()
  const flug = $derived(art === 'flug')
</script>

<div class="vf">
  <div class="vf-zeile">
    <label>{flug ? t('Flugnummer') : t('Zugnummer')}<input bind:value={angaben.nr} placeholder={flug ? 'QF123' : 'ICE 100'} autocapitalize="characters" autocomplete="off" /></label>
    {#if !flug}<label>{t('Abfahrtsbahnhof')}<input bind:value={angaben.bahnhof} placeholder="Mainz Hbf" autocomplete="off" /></label>{/if}
  </div>
  <div class="vf-zeile">
    <label>{t('Datum')}<input type="date" bind:value={angaben.datum} /></label>
    <label>{flug ? t('Abflug') : t('Abfahrt')}<input type="time" bind:value={angaben.zeit} step="60" /></label>
  </div>
  <div class="vf-zeile">
    <label>{t('Buchungsnummer')}<input bind:value={angaben.ref} autocapitalize="characters" autocomplete="off" /></label>
    <label>{t('Sitzplatz')}<input bind:value={angaben.sitz} placeholder={flug ? '12A' : t('Wagen 7, Platz 21')} autocomplete="off" /></label>
  </div>
  <label class="vf-datei">{t('Dokument')}
    <input type="file" accept="application/pdf,image/*" onchange={(e) => (datei = e.currentTarget.files?.[0] || null)} />
  </label>
</div>

<style>
  .vf { display: flex; flex-direction: column; gap: 8px; }
  .vf-zeile { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); font-weight: 700; min-width: 0; }
  input { font-size: max(16px, calc(14px * var(--schrift, 1))); min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); min-width: 0; width: 100%; box-sizing: border-box; font-weight: 400; }
  .vf-datei input { padding: 10px; font-size: calc(14px * var(--schrift, 1)); }
</style>
