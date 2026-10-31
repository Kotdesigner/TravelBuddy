<script>
  // Einzelne Ausgaben eines Logbuch-Eintrags: zweimal Tanken am Tag sind zwei Zeilen.
  // Die Summen je Kategorie schreibt kosten.js in die Felder, Bilanz und Tagebuch rechnen damit weiter.
  import { t, tn } from './i18n.js'
  import { updateJournalEintrag } from './userdata.js'
  import { KOSTEN_CLUSTER, KATEGORIE, ausgabenVon, betragVon, felderMitAusgaben, ausgabenSumme } from './kosten.js'
  import { eintragTage } from './plan.js'
  import { dezimal } from './format.js'
  import { haptic } from './haptik.js'

  let { eintrag } = $props()
  const liste = $derived(ausgabenVon(eintrag))
  const waehrung = $derived(eintrag.felder?.waehrung || 'AUD')
  const tage = $derived(eintragTage(eintrag).length)

  let kat = $state('kosten_essen'), betrag = $state(''), text = $state('')
  const neuOk = $derived(betragVon(betrag) > 0)

  function speichere(neu) {
    updateJournalEintrag(eintrag.id, { ausgaben: neu, felder: felderMitAusgaben(eintrag.felder, neu) })
  }
  function dazu(e) {
    e.preventDefault()
    if (!neuOk) return
    speichere([...liste, { id: Math.random().toString(36).slice(2, 10), kat, betrag: betragVon(betrag), text: text.trim() }])
    betrag = ''; text = ''
    haptic()
  }
</script>

<div class="al">
  <h4>{t('Ausgaben')}</h4>
  {#if liste.length}
    <ul>
      {#each liste as a (a.id)}
        <li>
          <span aria-hidden="true">{KATEGORIE[a.kat]?.icon || '🛒'}</span>
          <span class="al-txt">{KATEGORIE[a.kat]?.label || t('Sonstiges')}{#if a.text}<small>{a.text}</small>{/if}</span>
          <b>{dezimal(betragVon(a.betrag), 2)} {waehrung}</b>
          <button class="al-weg" aria-label={t('Ausgabe löschen')} onclick={() => speichere(liste.filter((x) => x.id !== a.id))}>✕</button>
        </li>
      {/each}
    </ul>
    <p class="al-summe">{t('Zusammen {betrag} {waehrung}', { betrag: dezimal(ausgabenSumme(liste), 2), waehrung })}</p>
  {/if}
  {#if tage > 1}<p class="al-k">{tn(tage, 'Gilt für {n} Tag und zählt einmal.', 'Gilt für alle {n} Tage und zählt einmal.')}</p>{/if}
  <form onsubmit={dazu}>
    <select aria-label={t('Kategorie')} bind:value={kat}>
      {#each KOSTEN_CLUSTER as c (c.id)}
        <optgroup label={c.label}>
          {#each c.kats as id (id)}<option value={id}>{KATEGORIE[id].icon} {KATEGORIE[id].label}</option>{/each}
        </optgroup>
      {/each}
    </select>
    <div class="al-zeile">
      <input class="al-betrag" inputmode="decimal" aria-label={t('Betrag')} placeholder={t('Betrag')} bind:value={betrag} />
      <input aria-label={t('Wofür?')} placeholder={t('Wofür? (optional)')} bind:value={text} />
    </div>
    <button class="btn" type="submit" disabled={!neuOk}>{t('+ Ausgabe')}</button>
  </form>
</div>

<style>
  .al { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 10px; }
  h4 { margin: 0; font-size: calc(14px * var(--schrift, 1)); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  li { display: flex; align-items: center; gap: 8px; min-height: 40px; border-bottom: 1px solid var(--line); font-size: calc(14px * var(--schrift, 1)); }
  .al-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-wrap: anywhere; }
  .al-txt small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  li b { flex: none; font-variant-numeric: tabular-nums; }
  .al-weg { flex: none; width: 36px; height: 36px; border: none; background: none; color: var(--muted); cursor: pointer; }
  .al-summe { margin: 0; text-align: right; font-weight: 800; font-size: calc(14px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .al-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  form { display: flex; flex-direction: column; gap: 6px; }
  .al-zeile { display: grid; grid-template-columns: 110px 1fr; gap: 6px; }
  select, input { font-size: max(16px, calc(14px * var(--schrift, 1))); min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); min-width: 0; width: 100%; box-sizing: border-box; }
</style>
