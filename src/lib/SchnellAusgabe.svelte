<script>
  // V14: Ausgabe in drei Tipps auf der Startseite. Betrag, Kategorie (die zuletzt benutzten zuerst),
  // optional ein Wort dazu. Landet im Logbuch-Eintrag des Tages, der notfalls angelegt wird,
  // und zählt damit zur Etappe des Tages und in die Kosten.
  import { je } from './i18n.js'
  import { journal } from './userdata.js'
  import { deckt } from './plan.js'
  import { KATEGORIE, KOSTEN_KATEGORIEN, ausgabenVon, betragVon, ausgabenSumme } from './kosten.js'
  import { dezimal } from './format.js'
  import { schnellAusgabe, letzteKategorien } from './buchung-dienst.js'
  import { zeigeToast } from './toast.js'
  import { haptic } from './haptik.js'

  let { datum, etappeId = null, ontag = () => {}, betragFeld = $bindable() } = $props()

  const STANDARD = ['kosten_essen', 'kosten_lebensmittel', 'kosten_sprit', 'kosten_attraktion', 'kosten_bedarf', 'kosten_genuss']
  const zuletzt = $derived(letzteKategorien($journal))
  const chips = $derived([...new Set([...zuletzt, ...STANDARD])].filter((k) => KATEGORIE[k]).slice(0, 6))
  const eintrag = $derived($journal.find((j) => deckt(j, datum)))
  const heute = $derived(eintrag ? ausgabenVon(eintrag) : [])
  const waehrung = $derived(eintrag?.felder?.waehrung || 'AUD')

  let betrag = $state(''), kat = $state(''), text = $state('')
  $effect(() => { if (!kat && chips.length) kat = chips[0] })
  const ok = $derived(betragVon(betrag) > 0 && !!kat)

  function eintragen(e) {
    e.preventDefault()
    if (!ok) return
    if (!schnellAusgabe(datum, { kat, betrag, text }, etappeId)) return
    haptic()
    zeigeToast(je(`${KATEGORIE[kat].icon} ${dezimal(betragVon(betrag), 2)} ${waehrung} im Logbuch ✓`, `${KATEGORIE[kat].icon} ${dezimal(betragVon(betrag), 2)} ${waehrung} in the logbook ✓`), 'ok')
    betrag = ''; text = ''
  }
</script>

<form class="sa" onsubmit={eintragen} aria-label={je('Ausgabe eintragen', 'Add expense')}>
  <div class="sa-kopf">
    <h2>{je('💸 Ausgabe', '💸 Expense')}</h2>
    {#if heute.length}
      <button type="button" class="sa-summe" onclick={() => ontag(datum)}>{je('Heute', 'Today')} {dezimal(ausgabenSumme(heute), 2)} {waehrung} · {heute.length} <span aria-hidden="true">›</span></button>
    {/if}
  </div>
  <div class="sa-chips" role="radiogroup" aria-label={je('Kategorie', 'Category')}>
    {#each chips as k (k)}
      <button type="button" role="radio" aria-checked={kat === k} class:an={kat === k} onclick={() => (kat = k)}><span aria-hidden="true">{KATEGORIE[k].icon}</span> {KATEGORIE[k].label}</button>
    {/each}
    <select aria-label={je('Andere Kategorie', 'Other category')} value={chips.includes(kat) ? '' : kat} onchange={(e) => { if (e.currentTarget.value) kat = e.currentTarget.value }}>
      <option value="">{je('Andere …', 'Other …')}</option>
      {#each KOSTEN_KATEGORIEN.filter((k) => !chips.includes(k.id)) as k (k.id)}<option value={k.id}>{k.icon} {k.label}</option>{/each}
    </select>
  </div>
  <div class="sa-zeile">
    <label class="sa-betrag"><input bind:this={betragFeld} inputmode="decimal" placeholder={je('Betrag', 'Amount')} aria-label={je('Betrag', 'Amount')} bind:value={betrag} /><span>{waehrung}</span></label>
    <input placeholder={je('Wofür? (optional)', 'What for? (optional)')} aria-label={je('Wofür?', 'What for?')} bind:value={text} />
  </div>
  <button class="btn-primary" type="submit" disabled={!ok}>{je('Eintragen', 'Add')}</button>
</form>

<style>
  .sa { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 14px 16px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .sa-kopf { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  h2 { margin: 0; font-size: calc(15px * var(--schrift, 1)); }
  .sa-summe { border: none; background: none; color: var(--muted); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; min-height: 36px; font-variant-numeric: tabular-nums; }
  .sa-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .sa-chips button { border: 1px solid var(--line-stark); background: var(--flaeche); color: var(--ink); border-radius: 999px; min-height: 36px; padding: 4px 12px; font-size: calc(13.5px * var(--schrift, 1)); cursor: pointer; }
  .sa-chips button.an { background: var(--brand); border-color: var(--brand); color: var(--on-brand, #fff); font-weight: 700; }
  .sa-chips select { border-radius: 999px; min-height: 36px; padding: 4px 10px; }
  .sa-zeile { display: grid; grid-template-columns: 140px 1fr; gap: 6px; }
  .sa-betrag { position: relative; display: block; }
  .sa-betrag span { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: calc(13px * var(--schrift, 1)); pointer-events: none; }
  .sa-betrag input { padding-right: 44px; }
  input, select { font-size: max(16px, calc(14px * var(--schrift, 1))); min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); min-width: 0; width: 100%; box-sizing: border-box; }
  .sa-chips select { width: auto; }
</style>
