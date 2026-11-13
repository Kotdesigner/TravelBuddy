<script>
  import { oeffneNeu } from './neu.js'
  import InfoKnopf from './InfoKnopf.svelte'
  // V14: Mehr → Buchungen. Jede Buchung an einem Ort: Termin, Buchungsnummer, Kosten und Belege.
  // Termine kommen aus dem Reisekalender oder sind selbst eingetragen, Kosten aus den Ausgaben
  // vorab (über die Termin-ID verbunden). Was die App nicht sicher zuordnen kann, steht oben zum Bestätigen.
  import { t, je } from './i18n.js'
  import { buchungen, vorabKosten, updateVorabKosten, reisen, gesamtStart, belegeAnhaengen, aendereTermin } from './userdata.js'
  import { etappenMitDatum } from './plan.js'
  import { buchungenMitKosten, buendle, verbindungsVorschlaege, uhrzeitIn, kostenPasst, istEchteBuchung } from './buchung.js'
  import { katInfo } from './reisekalender.js'
  import { mitWochentag, dezimal, tagMonat } from './format.js'
  import { heuteTag } from './heute.js'
  import { betragVon } from './kosten.js'
  import { speichereBeleg, eigenerPfad, belegLabel } from './belege.js'
  import { zeigeToast } from './toast.js'
  import BelegKnoepfe from './BelegKnoepfe.svelte'
  import BuchungEinfuegen from './BuchungEinfuegen.svelte'
  import BuchungAendern from './BuchungAendern.svelte'

  let { geh = () => {} } = $props()

  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const events = $derived($buchungen?.events || [])
  const liste = $derived(buchungenMitKosten(events, $vorabKosten, eintraege).filter(istEchteBuchung))
  const offenBestaetigen = $derived(verbindungsVorschlaege($vorabKosten, buendle(events), eintraege).filter((v) => !v.sicher))
  const ohneTermin = $derived($vorabKosten.filter((k) => !k.terminId && !k.ohneBuchung && !offenBestaetigen.some((v) => v.kostenId === k.id)))

  let wahl = $state('kommend')
  let neuAuf = $state(false)
  const gezeigt = $derived(wahl === 'alle' ? liste : wahl === 'kommend' ? liste.filter((b) => b.bis >= $heuteTag) : liste.filter((b) => b.bis < $heuteTag).reverse())
  const offenSumme = $derived(liste.flatMap((b) => b.offen).length)

  const kostenText = (k) => `${dezimal(betragVon(k.betrag), 2)} ${k.waehrung}`
  const uhrzeiten = (b) => b.termine.map((e) => e.zeit || uhrzeitIn(e.sub)).filter(Boolean)

  async function kopieren(ref) {
    try { await navigator.clipboard.writeText(ref); zeigeToast(je('Buchungsnummer kopiert ✓', 'Booking number copied ✓'), 'ok') }
    catch { zeigeToast(ref, 'info', 4000) }
  }
  function bezahlt(k) { updateVorabKosten(k.id, { zahlung: 'bezahlt', datum: $heuteTag }); zeigeToast(je('Als bezahlt vermerkt ✓', 'Marked as paid ✓'), 'ok') }
  function verbinden(kostenId, terminId) { updateVorabKosten(kostenId, { terminId }) }
  function keineBuchung(kostenId) { updateVorabKosten(kostenId, { ohneBuchung: true }) }
  function kostenLoesen(k) { updateVorabKosten(k.id, { terminId: null }) }

  async function belegDazu(b, dateien) {
    const neu = [], belegt = new Set()
    try {
      for (const d of dateien) {
        const pfad = eigenerPfad(b.id, d.name, belegt)
        belegt.add(pfad)
        await speichereBeleg(pfad, d)
        neu.push({ ziel: b.id, label: belegLabel(d.name), datei: pfad })
      }
      try { await navigator.storage?.persist?.() } catch {}
    } catch (err) { zeigeToast(t('Speichern fehlgeschlagen: ') + (err?.message || err), 'fehler', 4000) }
    if (neu.length) { belegeAnhaengen(neu); zeigeToast(je('Beleg gespeichert ✓', 'Document saved ✓'), 'ok') }
  }
  function nummerSetzen(b, wert) { const v = wert.trim(); if (v !== b.ref) aendereTermin(b.id, { ref: v }) }
  // V44: Ändern, umbuchen, stornieren und löschen in einem Blatt — für jede Buchung, auch die aus dem Kalender.
  let aendernId = $state(null)
  const aendern = $derived(aendernId ? liste.find((x) => x.id === aendernId) || null : null)
  // Zum Zuordnen nur Ausgaben, deren Art zur Buchung passt (ein Flug bekommt keine Drohne angeboten)
  const kostenWahl = (b) => ohneTermin.filter((k) => KOSTEN_ART.has(k.kat) && kostenPasst(k.kat, b.kat)).map((k) => ({ id: k.id, label: `${k.text || '…'} · ${kostenText(k)}` }))
  const KOSTEN_ART = new Set(['kosten_unterkunft', 'kosten_flug', 'kosten_bahn', 'kosten_bus', 'kosten_boot', 'kosten_mietfahrzeug', 'kosten_attraktion', 'kosten_sonstiges'])
</script>

<section class="bu" aria-label={je('Buchungen', 'Bookings')}>
  <p class="bu-k">{je('Alles Gebuchte an einer Stelle: wann, Buchungsnummer, was es kostet und die Belege. Dieselben Angaben stehen am Tag, in der Etappe, im Kalender und unter Kosten.', 'Everything booked in one place: when, booking number, cost and documents. The same details show on the day, in the leg, the calendar and under costs.')}<InfoKnopf id="buchung" /></p>

  <div class="bu-kopf">
    <div class="segment" role="group" aria-label={je('Auswahl', 'Selection')}>
      {#each [['kommend', je('Kommende', 'Upcoming')], ['vorbei', je('Vorbei', 'Past')], ['alle', je('Alle', 'All')]] as [w, l]}
        <button class:an={wahl === w} aria-pressed={wahl === w} onclick={() => (wahl = w)}>{l}</button>
      {/each}
    </div>
    <button class="btn-primary" onclick={() => (neuAuf = !neuAuf)} aria-expanded={neuAuf}>{neuAuf ? je('Schließen', 'Close') : je('+ Buchung', '+ Booking')}</button>
  </div>
  {#if neuAuf}<BuchungEinfuegen onfertig={() => (neuAuf = false)} />{/if}

  {#if offenSumme}
    <p class="bu-offen" role="status">💳 {offenSumme === 1 ? je('1 Betrag ist noch vor Ort zu zahlen', '1 amount still to pay on site') : je(`${offenSumme} Beträge sind noch vor Ort zu zahlen`, `${offenSumme} amounts still to pay on site`)}</p>
  {/if}

  {#if offenBestaetigen.length}
    <div class="bu-karte bu-pruefen">
      <h2>{je('Zum Bestätigen', 'To confirm')}</h2>
      <p class="bu-k">{je('Diese Ausgaben passen wahrscheinlich zu einer Buchung. Stimmt das?', 'These costs probably belong to a booking. Correct?')}</p>
      <ul>
        {#each offenBestaetigen as v (v.kostenId)}
          {@const k = $vorabKosten.find((x) => x.id === v.kostenId)}
          {#if k}
            <li>
              <span class="bu-pz"><b>{k.text}</b> <small>{kostenText(k)}</small><small>→ {v.titel}, {mitWochentag(v.von)}</small></span>
              <span class="bu-knoepfe">
                <button class="btn" onclick={() => verbinden(k.id, v.terminId)}>{je('Ja', 'Yes')}</button>
                <select aria-label={je('Andere Buchung', 'Other booking')} onchange={(e) => { if (e.currentTarget.value) verbinden(k.id, e.currentTarget.value) }}>
                  <option value="">{je('Andere …', 'Other …')}</option>
                  {#each liste as b (b.id)}<option value={b.id}>{tagMonat(b.von)} · {b.titel}</option>{/each}
                </select>
                <button class="btn btn-ghost" onclick={() => keineBuchung(k.id)}>{je('Keine', 'None')}</button>
              </span>
            </li>
          {/if}
        {/each}
      </ul>
    </div>
  {/if}

  {#if !gezeigt.length}
    <p class="bu-leer">{wahl === 'kommend' ? je('Keine kommenden Buchungen.', 'No upcoming bookings.') : je('Keine Buchungen.', 'No bookings.')}
      {je('Füg eine Bestätigungsmail ein, die App füllt die Felder aus, oder trag sie von Hand ein.', 'Paste a confirmation email and the app fills in the fields, or enter it by hand.')}</p>
    <button class="btn-primary bu-leer-knopf" onclick={() => oeffneNeu('buchung')}>{je('+ Buchung eintragen', '+ Add booking')}</button>
  {/if}
  <ul class="bu-liste">
    {#each gezeigt as b (b.id)}
      {@const zeiten = uhrzeiten(b)}
      <li class="bu-karte" class:vorbei={b.bis < $heuteTag} class:weg={!!b.storniert || !!b.umgebucht} style="--farbe:{b.etappe?.farbe || 'var(--line-stark)'}">
        {#if b.storniert}<p class="bu-weg-marke">{je('Storniert', 'Cancelled')}{b.stornoGrund ? ' · ' + b.stornoGrund : ''}</p>
        {:else if b.umgebucht}<p class="bu-weg-marke">{je('Umgebucht', 'Rebooked')}</p>{/if}
        <div class="bu-titel">
          <span class="bu-i" aria-hidden="true">{b.termine[0].emoji || katInfo(b.kat).icon}</span>
          <span><b>{b.titel}</b>
            <small>{mitWochentag(b.von)}{#if b.bis !== b.von}{' '}{je('bis', 'to')}{' '}{mitWochentag(b.bis)}{/if}{#if zeiten.length}{' · '}{zeiten.join(' / ')}{/if}</small>
            {#if b.etappe}<small class="bu-etappe">{je('Etappe', 'Leg')} {b.etappe.name}</small>{/if}
          </span>
        </div>
        {#each b.termine as e (e.id)}{#if e.sub}<p class="bu-sub">{e.sub}</p>{/if}{/each}

        <div class="bu-zeile">
          <span class="bu-l">{je('Buchungsnr.', 'Booking no.')}</span>
          {#if b.ref}
            <code>{b.ref}</code>
            <button class="bu-mini" onclick={() => kopieren(b.ref)} aria-label={je('Buchungsnummer kopieren', 'Copy booking number')}>📋</button>
          {:else}
            <input class="bu-ein" placeholder={je('eintragen', 'enter')} aria-label={je('Buchungsnummer', 'Booking number')} onchange={(e) => nummerSetzen(b, e.currentTarget.value)} />
          {/if}
        </div>

        <div class="bu-zeile bu-kosten">
          <span class="bu-l">{je('Kosten', 'Cost')}</span>
          {#if b.kosten.length}
            <span class="bu-kl">
              {#each b.kosten as k (k.id)}
                <span class="bu-k1">
                  <b>{kostenText(k)}</b>
                  {#if k.zahlung === 'vorOrt'}
                    <span class="bu-faellig">{je('vor Ort zu zahlen', 'pay on site')}</span>
                    <button class="bu-mini" onclick={() => bezahlt(k)}>{je('✓ bezahlt', '✓ paid')}</button>
                  {:else}
                    <small>{je('bezahlt', 'paid')} {tagMonat(k.datum)}</small>
                  {/if}
                  <button class="bu-mini bu-weg" onclick={() => kostenLoesen(k)} aria-label={je('Kosten von der Buchung lösen', 'Detach cost')}>✕</button>
                {#if b.storniert || k.erstattung}
                  <select class="bu-erst" aria-label={je('Erstattung', 'Refund')} value={k.erstattung || 'offen'}
                    onchange={(e) => updateVorabKosten(k.id, { erstattung: e.currentTarget.value })}>
                    <option value="offen">{je('Erstattung offen', 'Refund pending')}</option>
                    <option value="voll">{je('voll erstattet', 'fully refunded')}</option>
                    <option value="keine">{je('nichts zurück', 'nothing back')}</option>
                  </select>
                {/if}
                </span>
              {/each}
            </span>
          {:else if kostenWahl(b).length}
            <select aria-label={je('Ausgabe zuordnen', 'Assign cost')} onchange={(e) => { if (e.currentTarget.value) verbinden(e.currentTarget.value, b.id) }}>
              <option value="">{je('Ausgabe zuordnen …', 'Assign cost …')}</option>
              {#each kostenWahl(b) as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
            </select>
          {:else}
            <small class="bu-nichts">{je('keine eingetragen', 'none entered')}</small>
          {/if}
        </div>

        <div class="bu-zeile">
          <span class="bu-l">{je('Belege', 'Documents')}</span>
          <span class="bu-belege">
            <BelegKnoepfe docs={b.docs} entfernbar />
            <label class="bu-mini bu-datei">{je('📎 dazu', '📎 add')}<input type="file" multiple accept="application/pdf,image/*" onchange={(e) => { belegDazu(b, [...e.currentTarget.files]); e.currentTarget.value = '' }} /></label>
          </span>
        </div>

        <div class="bu-fuss">
          <button class="btn btn-ghost" onclick={() => geh('logbuch/tag/' + b.von)}>{je('Tag öffnen', 'Open day')}</button>
          {#if b.etappe}<button class="btn btn-ghost" onclick={() => geh('plan/etappe/' + b.etappe.id)}>{je('Etappe', 'Leg')}</button>{/if}
          <button class="btn btn-ghost" onclick={() => (aendernId = b.id)}>{je('Ändern', 'Change')}</button>
        </div>
      </li>
    {/each}
  </ul>
</section>

{#if aendern}
  <BuchungAendern buchung={aendern} onfertig={() => (aendernId = null)} onabbruch={() => (aendernId = null)} />
{/if}

<style>
  .bu { display: flex; flex-direction: column; gap: 12px; }
  .bu-k { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.5; }
  .bu-kopf { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .bu-offen { margin: 0; padding: 8px 12px; border-radius: var(--radius-s); background: var(--flaeche); border: 1px solid var(--line-stark); font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .bu-leer { margin: 0; color: var(--muted); font-size: calc(14px * var(--schrift, 1)); }
  .bu-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .bu-karte { border: 1px solid var(--line); border-left: 4px solid var(--farbe, var(--line-stark)); border-radius: var(--radius-m); background: var(--karte, var(--flaeche)); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .bu-karte.vorbei { opacity: 0.8; }
  .bu-karte.weg { opacity: 0.66; border-left-color: var(--line-stark); }
  .bu-karte.weg .bu-titel b { text-decoration: line-through; }
  .bu-erst { font-size: calc(12.5px * var(--schrift, 1)); min-height: 34px; padding: 2px 6px; }
  .bu-weg-marke { margin: 0; align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: var(--flaeche); border: 1px solid var(--line-stark); color: var(--muted); font-size: calc(12px * var(--schrift, 1)); font-weight: 700; }
  .bu-pruefen { border-left-color: var(--brand); }
  .bu-pruefen h2 { margin: 0; font-size: calc(15px * var(--schrift, 1)); }
  .bu-pruefen ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .bu-pruefen li { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); padding-top: 8px; }
  .bu-pz { display: flex; flex-direction: column; min-width: 0; font-size: calc(14px * var(--schrift, 1)); }
  .bu-pz small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .bu-knoepfe { display: flex; gap: 6px; flex-wrap: nowrap; align-items: center; width: 100%; }
  .bu-knoepfe select { flex: 1 1 auto; width: auto; }
  @media (min-width: 900px) { .bu-knoepfe { width: auto; } .bu-knoepfe select, .bu-kosten select { flex: 0 1 280px; max-width: 280px; } }
  .bu-titel { display: flex; gap: 10px; align-items: flex-start; }
  .bu-titel > span:last-child { display: flex; flex-direction: column; min-width: 0; font-size: calc(15px * var(--schrift, 1)); }
  .bu-titel small { color: var(--muted); font-size: calc(13px * var(--schrift, 1)); }
  .bu-etappe { font-weight: 700; }
  .bu-i { font-size: calc(22px * var(--schrift, 1)); line-height: 1.2; }
  .bu-sub { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .bu-zeile { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: calc(14px * var(--schrift, 1)); min-height: 36px; border-top: 1px solid var(--line); padding-top: 6px; }
  .bu-l { flex: 0 0 96px; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; }
  .bu-zeile code { font-size: calc(15px * var(--schrift, 1)); font-weight: 700; letter-spacing: 0.03em; user-select: all; overflow-wrap: anywhere; }
  .bu-kl { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
  .bu-k1 { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .bu-k1 small, .bu-nichts { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .bu-faellig { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--warn, #b45309); }
  .bu-belege { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1; min-width: 0; }
  .bu-mini::after { content: ''; position: absolute; inset: -6px 0; }
  .bu-mini { position: relative; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); border-radius: var(--radius-s); min-height: 32px; min-width: 32px; padding: 2px 8px; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; display: inline-flex; align-items: center; }
  .bu-weg { border: none; background: none; color: var(--muted); }
  .bu-datei input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .bu-datei { position: relative; }
  .bu-ein, .bu select { font-size: max(16px, calc(14px * var(--schrift, 1))); min-height: 36px; padding: 4px 8px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); min-width: 0; max-width: 100%; }
  .bu-fuss { display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid var(--line); padding-top: 6px; }
  .bu-rot { color: var(--danger, #b91c1c); }
  .bu-leer-knopf { align-self: flex-start; margin: 4px 0 12px; }
</style>
