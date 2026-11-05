<script>
  // V17: Ausgabe über +Neu, im Aufbau der anderen Formulare im Neu-Blatt (Etappe, Route, Logbuch).
  // Kategorien in den vier Gruppen der Kosten-Seite, jede Gruppe aufklappbar wie die Themen im Logbuch.
  // Ein Tag der Reise (oder danach): landet wie die Schnelleingabe auf „Heute“ im Logbuch-Eintrag des Tages.
  // Ein Zeitraum: der Betrag wird gleichmäßig auf die Tage verteilt, jeder Tag bekommt seinen Anteil.
  // Ein Tag vor der Reise: wird eine Ausgabe vorab (Reisevorbereitung), so wie dort „+ Ausgabe“.
  import { je } from './i18n.js'
  import { reisen, gesamtStart, journal, neueVorabKosten } from './userdata.js'
  import { etappenMitDatum, planUeberblick, etappeAm, gueltigesDatum, deckt, tageZwischen } from './plan.js'
  import { KATEGORIE, KOSTEN_CLUSTER, clusterVon, betragVon, verteileBetrag } from './kosten.js'
  import { schnellAusgabe, ausgabeZeitraum, letzteKategorien } from './buchung-dienst.js'
  import { mitWochentag, dezimal, bereich } from './format.js'
  import { heuteTag } from './heute.js'
  import { zeigeToast } from './toast.js'
  import { haptic } from './haptik.js'
  import { klapp, dauer } from './motion.js'
  import { untrack } from 'svelte'

  let { vorlage = {}, onfertig = () => {} } = $props()

  const uid = Math.random().toString(36).slice(2, 7)
  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const start = $derived(planUeberblick(eintraege).start)

  let datum = $state(untrack(() => vorlage.datum) || $heuteTag)   // Vorlage nur als Startwert
  let bis = $state('')
  let zeitraum = $state(false)
  let kat = $state(letzteKategorien($journal, 1)[0] || 'kosten_essen')
  let offen = $state({ [clusterVon(untrack(() => kat))]: true })
  let betrag = $state('')
  let text = $state('')
  let waehrungVorab = $state('EUR')

  const vorab = $derived(!!start && gueltigesDatum(datum) && datum < start)
  const mehrereTage = $derived(zeitraum && !vorab && gueltigesDatum(bis) && bis > datum)
  const tage = $derived(mehrereTage ? tageZwischen(datum, bis) + 1 : 1)
  const teile = $derived(mehrereTage ? verteileBetrag(betrag, tage) : [])
  const etappe = $derived(gueltigesDatum(datum) && !vorab ? etappeAm(eintraege, datum) : null)
  const tagEintrag = $derived($journal.find((j) => deckt(j, datum)))
  // Ausgaben im Logbuch rechnen in der Währung ihres Eintrags; vorab darf man wählen
  const waehrung = $derived(vorab ? waehrungVorab : tagEintrag?.felder?.waehrung || 'AUD')
  const zeitraumFehlt = $derived(zeitraum && !vorab && !mehrereTage)
  const ok = $derived(gueltigesDatum(datum) && betragVon(betrag) > 0 && !!KATEGORIE[kat] && !zeitraumFehlt)

  function waehle(id) { kat = id; haptic() }
  const umschalten = (id) => (offen = { ...offen, [id]: !offen[id] })

  function eintragen(e) {
    e.preventDefault()
    if (!ok) return
    const k = KATEGORIE[kat]
    const summe = `${k.icon} ${dezimal(betragVon(betrag), 2)} ${waehrung}`
    if (vorab) {
      neueVorabKosten({ text: text.trim() || k.label, kat, betrag: betragVon(betrag), waehrung, datum, zahlung: 'bezahlt' })
      zeigeToast(je(`${summe} bei den Ausgaben vorab ✓`, `${summe} under expenses before the trip ✓`), 'ok')
    } else if (mehrereTage) {
      // Jeder Teil sagt, woher er kommt: „Wocheneinkauf · 1.–7. Dez, verteilt“
      const herkunft = je(`${bereich(datum, bis)}, verteilt`, `${bereich(datum, bis)}, spread`)
      const n = ausgabeZeitraum(datum, bis, { kat, betrag, text: text.trim() ? `${text.trim()} · ${herkunft}` : herkunft },
        (d) => etappeAm(eintraege, d)?.reise.id || null)
      if (!n) return
      zeigeToast(je(`${summe} auf ${n} Tage im Logbuch verteilt ✓`, `${summe} spread over ${n} days in the logbook ✓`), 'ok')
    } else {
      if (!schnellAusgabe(datum, { kat, betrag, text }, etappe?.reise.id || null)) return
      zeigeToast(je(`${summe} im Logbuch ✓`, `${summe} in the logbook ✓`), 'ok')
    }
    haptic.confirm()
    onfertig({ typ: 'ausgabe', datum, vorab })
  }
</script>

<form class="ag" onsubmit={eintragen} aria-label={je('Ausgabe eintragen', 'Add expense')}>
  <p class="ag-k">{je('Was hast du ausgegeben? Für einen Einkauf, der mehrere Tage reicht, wähle „Zeitraum“: Der Betrag wird auf die Tage verteilt.', 'What did you spend? For shopping that lasts several days, choose “Period”: the amount is spread over the days.')}</p>

  <div class="ag-zeile">
    <label class="ag-f">{je('Betrag', 'Amount')}
      <span class="ag-feld"><input inputmode="decimal" placeholder="0,00" bind:value={betrag} />
        {#if !vorab}<span class="ag-wae">{waehrung}</span>{/if}</span>
    </label>
    {#if vorab}
      <label class="ag-f ag-schmal">{je('Währung', 'Currency')}
        <select bind:value={waehrungVorab}><option value="EUR">EUR</option><option value="AUD">AUD</option></select>
      </label>
    {/if}
  </div>

  {#if !vorab}
    <div class="segment ag-wann" role="group" aria-label={je('Wann', 'When')}>
      <button type="button" class:an={!zeitraum} aria-pressed={!zeitraum} onclick={() => (zeitraum = false)}>{je('Ein Tag', 'One day')}</button>
      <button type="button" class:an={zeitraum} aria-pressed={zeitraum} onclick={() => (zeitraum = true)}>{je('Zeitraum', 'Period')}</button>
    </div>
  {/if}
  <div class="ag-zeile">
    <label class="ag-f">{zeitraum && !vorab ? je('Von', 'From') : je('Datum', 'Date')}<input type="date" bind:value={datum} /></label>
    {#if zeitraum && !vorab}
      <label class="ag-f">{je('Bis', 'To')}<input type="date" bind:value={bis} min={datum || undefined} /></label>
    {/if}
  </div>

  <div class="ag-kats" role="radiogroup" aria-labelledby="ag-kat-{uid}">
    <span class="ag-f" id="ag-kat-{uid}">{je('Kategorie', 'Category')}</span>
    {#each KOSTEN_CLUSTER as c (c.id)}
      {@const drin = c.kats.includes(kat)}
      <div class="modul" class:offen={offen[c.id]}>
        <button type="button" class="m-kopf" aria-expanded={!!offen[c.id]} onclick={() => umschalten(c.id)}>
          <span class="m-icon" aria-hidden="true">{c.icon}</span>
          <span class="m-titel">{c.label}<small>{drin ? `${KATEGORIE[kat].icon} ${KATEGORIE[kat].label}` : c.info}</small></span>
          {#if drin}<span class="m-zahl" aria-label={je('gewählt', 'selected')}>✓</span>{/if}
          <span class="aufklapp klein" class:offen={offen[c.id]} aria-hidden="true"></span>
        </button>
        {#if offen[c.id]}
          <div class="m-body" transition:klapp={{ duration: dauer(200) }}>
            {#each c.kats.filter((id) => KATEGORIE[id]) as id (id)}
              <button type="button" class="ag-kat" class:an={kat === id} role="radio" aria-checked={kat === id} onclick={() => waehle(id)}>
                <span aria-hidden="true">{KATEGORIE[id].icon}</span><span class="ag-kat-t">{KATEGORIE[id].label}</span>{#if kat === id}<span class="ag-haken" aria-hidden="true">✓</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <label class="ag-f">{je('Wofür? (optional)', 'What for? (optional)')}<input bind:value={text} placeholder={je('z. B. Wocheneinkauf in Carnarvon', 'e.g. weekly shop in Carnarvon')} /></label>

  <p class="ag-wo" aria-live="polite">
    {#if !gueltigesDatum(datum)}{je('Bitte ein Datum wählen.', 'Please pick a date.')}
    {:else if vorab}{je(`📍 ${mitWochentag(datum)} liegt vor der Reise. Die Ausgabe zählt zu den Ausgaben vorab (Reisevorbereitung).`, `📍 ${mitWochentag(datum)} is before the trip. It counts as an expense before the trip (trip preparation).`)}
    {:else if zeitraumFehlt}{je('Bitte ein Enddatum nach dem ersten Tag wählen.', 'Please pick an end date after the first day.')}
    {:else if mehrereTage}{je(`📍 ${bereich(datum, bis)}: ${tage} Tage im Logbuch, je ${teile.length ? dezimal(teile[0], 2) : '…'} ${waehrung}${teile.length && teile.at(-1) !== teile[0] ? ' (gerundet, zusammen genau der Betrag)' : ''}.`, `📍 ${bereich(datum, bis)}: ${tage} days in the logbook, ${teile.length ? dezimal(teile[0], 2) : '…'} ${waehrung} each${teile.length && teile.at(-1) !== teile[0] ? ' (rounded, adds up to the amount)' : ''}.`)}
    {:else if etappe}{je(`📍 Kommt in den Logbuch-Eintrag vom ${mitWochentag(datum)}, Etappe „${etappe.reise.name}“.`, `📍 Goes into the logbook entry for ${mitWochentag(datum)}, leg “${etappe.reise.name}”.`)}
    {:else}{je(`📍 Kommt in den Logbuch-Eintrag vom ${mitWochentag(datum)}.`, `📍 Goes into the logbook entry for ${mitWochentag(datum)}.`)}{/if}
  </p>

  <button class="btn-primary ag-los" type="submit" disabled={!ok}>{je('Ausgabe eintragen', 'Add expense')}</button>
</form>

<style>
  /* Maße wie im Neu-Blatt (NeuBlatt.svelte: nb-f, nb-zeile, nb-los), Gruppen wie die Themen im Logbuch */
  .ag { display: flex; flex-direction: column; gap: 12px; }
  .ag-k { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .ag-zeile { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
  .ag-f { display: flex; flex-direction: column; gap: 5px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); flex: 1 1 0; min-width: 0; }
  .ag-schmal { flex: 0 1 130px; }
  .ag-f input, .ag-f select { min-height: 46px; font-size: max(16px, calc(17px * var(--schrift, 1))); padding: 8px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); font-weight: 400; width: 100%; box-sizing: border-box; font-family: inherit; }
  .ag-feld { position: relative; display: block; }
  .ag-feld input { padding-right: 52px; font-variant-numeric: tabular-nums; }
  .ag-wae { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: calc(14px * var(--schrift, 1)); font-weight: 700; pointer-events: none; }
  .ag-wann { align-self: flex-start; }

  .ag-kats { display: flex; flex-direction: column; gap: 6px; }
  .modul { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .modul.offen { border-color: var(--line-stark); }
  .m-kopf { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 8px 7px 11px; min-height: 52px; background: var(--flaeche); border: none; cursor: pointer; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); text-align: left; }
  .m-icon { flex: none; font-size: calc(16px * var(--schrift, 1)); }
  .m-titel { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .m-titel small { font-weight: 400; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); overflow-wrap: anywhere; }
  .m-zahl { flex: none; color: var(--brand-text); font-weight: 800; }
  .m-body { display: flex; flex-direction: column; padding: 2px 0; background: var(--card); }
  .ag-kat { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 12px; border: none; border-top: 1px solid var(--line); border-radius: 0; background: none; color: var(--ink); font: inherit; font-size: calc(15px * var(--schrift, 1)); text-align: left; cursor: pointer; }
  .ag-kat:first-child { border-top: none; }
  .ag-kat-t { flex: 1; min-width: 0; }
  .ag-kat.an { color: var(--brand-text); font-weight: 700; background: var(--flaeche); }
  .ag-haken { flex: none; font-weight: 800; }

  .ag-wo { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 8px 10px; line-height: 1.45; }
  .ag-los { margin-top: 4px; min-height: 52px; font-size: calc(17px * var(--schrift, 1)); }
</style>
