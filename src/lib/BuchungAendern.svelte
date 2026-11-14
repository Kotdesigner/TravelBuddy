<script>
  // V44: Eine gebuchte Sache ändert sich: neuer Flug, anderes Zimmer, abgesagte Tour.
  // Hier an einer Stelle: Angaben berichtigen, durch eine neue Buchung ersetzen (umbuchen),
  // stornieren oder ganz löschen. Erreichbar von jeder Buchung aus, auch von den importierten.
  //
  // Warum Storno nicht löscht: Was gebucht war, bleibt nachvollziehbar, die Kosten behalten ihren
  // Beleg und eine Erstattung lässt sich eintragen. Angezeigt wird es grau und durchgestrichen.
  import { je, t } from './i18n.js'
  import { modal } from './modal.js'
  import { aendereBuchung, storniereBuchung, storniereBuchungZurueck, ersetzeBuchungZurueck, loescheBuchung, updateVorabKosten } from './userdata.js'
  import { angabenAusBuchung, baueUntertitel, mitNaechten, nummernListe, uhrzeitIn } from './buchung.js'
  import { flugNummern } from './flug.js'
  import { mitWochentag } from './format.js'
  import { loeschFrage, frage } from './dialog.js'
  import { zeigeToast } from './toast.js'
  import { haptic } from './haptik.js'
  import BuchungEinfuegen from './BuchungEinfuegen.svelte'

  /** buchung: ein Eintrag aus buchungenMitKosten (hat ids, termine, kosten). */
  // onwechsel: der erste Termin einer Buchung gibt ihr die ID. Nimmt man genau den heraus, muss
  // die Liste dahinter wissen, auf welchen Termin das offene Blatt jetzt zeigt.
  let { buchung, onfertig = () => {}, onabbruch = () => {}, onwechsel = () => {} } = $props()

  const kat = $derived(buchung?.kat || '')
  const fahrt = $derived(kat === 'flight' || kat === 'train')
  const termine = $derived(buchung?.termine || [])
  const mehrteilig = $derived(termine.length > 1)
  const storniert = $derived(!!buchung?.storniert)
  const umgebucht = $derived(!!buchung?.umgebucht)

  let blick = $state('form')           // 'form' | 'ersetzen'
  let f = $state(angabenAusBuchung(buchung))
  // Je Termin: Datum, Zeit und Nummer. So lassen sich auch Umsteigeflüge und Check-out ändern.
  let zeilen = $state(termine.map((e) => ({
    id: e.id,
    titel: e.titel || '',
    datum: e.datum || '',
    // Zeit auch aus dem Untertitel lesen („Abflug 22:45“). Sonst stünde das Feld leer da
    // und ein Speichern ohne Anfassen würde die Uhrzeit löschen.
    zeit: e.zeit || e.zeitVon || uhrzeitIn(e.sub) || '',
    zeitBis: e.zeitBis || '',
    // Nur gültige Nummern vorfüllen. Stand da einmal „EK“ und „421“, holt flugNummern() die
    // Nummer aus Titel oder Untertitel zurück, statt den Fehler im Feld weiterzureichen.
    nr: (kat === 'train' ? (e.zugNr || '') : (flugNummern(e).join(' / ') || e.flugNr || '')),
    // Sitzplatz gehört zum Abschnitt: bei einem Gabelflug hat jeder Flug seinen eigenen.
    sitz: e.sitz || '',
  })))

  // Gabelflug oder Umsteigeflug: Sitzplatz steht dann bei jedem Abschnitt, nicht einmal für alles.
  const sitzJeTeil = $derived(fahrt && mehrteilig)
  const rolleVon = (i) => (mehrteilig && i === zeilen.length - 1 ? 'ende' : 'start')
  const datumOk = $derived(zeilen.every((z) => /^\d{4}-\d{2}-\d{2}$/.test(z.datum)))
  const reihenfolgeOk = $derived(zeilen.every((z, i) => i === 0 || z.datum >= zeilen[i - 1].datum))
  const kannSpeichern = $derived(datumOk && reihenfolgeOk && (fahrt && mehrteilig ? zeilen.every((z) => !!z.titel.trim()) : !!f.titel.trim()))

  function speichern() {
    if (!kannSpeichern) return
    const proTermin = (e) => {
      const i = zeilen.findIndex((z) => z.id === e.id)
      if (i < 0) return {}
      const z = zeilen[i]
      const nrs = nummernListe(z.nr)
      const rolle = rolleVon(i)
      const felder = {
        titel: (z.titel || f.titel).trim(),
        datum: z.datum,
        zeit: z.zeit || '',
        zeitBis: z.zeitBis || '',
        // mitNaechten: „3 Nächte“ im alten Text ist die Grundlage der Nächte-Übersicht, wenn kein
        // Check-out dabeisteht. Der Hinweis muss das Ändern überleben.
        sub: mitNaechten(baueUntertitel(kat, {
          nr: z.nr, anbieter: f.anbieter, bahnhof: f.bahnhof,
          zeitVon: rolle === 'ende' && !fahrt ? '' : z.zeit,
          zeitBis: rolle === 'ende' && !fahrt ? (z.zeit || z.zeitBis) : z.zeitBis,
          ort: f.ort, ortBis: f.ortBis,
        }, rolle), e.sub),
      }
      if (kat === 'flight') { felder.flugNr = nrs[0] || ''; felder.flugNrs = nrs }
      if (kat === 'train') { felder.zugNr = nrs[0] || ''; felder.bahnhof = f.bahnhof.trim() }
      if (sitzJeTeil) felder.sitz = (z.sitz || '').trim()
      return felder
    }
    const gemeinsam = { ref: f.ref.trim(), anbieter: f.anbieter.trim() }
    if (!sitzJeTeil) gemeinsam.sitz = f.sitz.trim()
    aendereBuchung(buchung.ids, gemeinsam, proTermin)
    haptic()
    zeigeToast(je('Buchung geändert ✓', 'Booking updated ✓'), 'ok')
    onfertig()
  }

  async function stornieren() {
    if (storniert) { storniereBuchungZurueck(buchung.ids); zeigeToast(je('Storno zurückgenommen', 'Cancellation undone'), 'ok'); onfertig(); return }
    const ok = await frage({
      titel: t('„{titel}“ stornieren?', { titel: buchung.titel }),
      text: je('Die Buchung bleibt grau stehen, damit du später noch siehst, was gebucht war. Sie zählt nicht mehr als Termin und wird nicht mehr abgefragt.',
        'The booking stays, greyed out, so you can still see what was booked. It no longer counts as a date and is no longer checked.'),
      ja: je('Stornieren', 'Cancel booking'), gefahr: true, abbruch: true,
    })
    if (!ok) return
    storniereBuchung(buchung.ids)
    for (const k of buchung.kosten || []) updateVorabKosten(k.id, { erstattung: 'offen' })
    zeigeToast(je('Storniert. Trag unter Kosten ein, was du zurückbekommst.', 'Cancelled. Note under costs what you get back.'), 'ok', 4200)
    onfertig()
  }

  async function loeschen() {
    const ok = await loeschFrage(t('Buchung „{titel}“', { titel: buchung.titel }),
      je('Alle Termine dieser Buchung verschwinden, auch aus Heute und dem Kalender. Verbundene Kosten bleiben unter den Ausgaben vorab. Willst du sie nur absagen, nimm „Stornieren“.',
        'All dates of this booking are removed, also from Today and the calendar. Linked costs stay under upfront costs. To just call it off, use “Cancel booking”.'))
    if (!ok) return
    for (const k of buchung.kosten || []) updateVorabKosten(k.id, { terminId: null })
    loescheBuchung(buchung.ids)
    zeigeToast(je('Buchung gelöscht', 'Booking deleted'), 'ok')
    onfertig()
  }

  /**
   * Wie der Abschnitt in der Rückfrage heißt. „Abschnitt „Hotel am Hafen““ sagte nicht, welcher
   * der beiden gemeint ist: beim Hotel heißen Anfang und Ende gleich.
   */
  function teilName(z, i) {
    const was = (z.titel || '').trim()
    if (fahrt) return was ? je(`Abschnitt ${i + 1} „${was}“`, `Leg ${i + 1} “${was}”`) : je(`Abschnitt ${i + 1}`, `Leg ${i + 1}`)
    const rolle = i === 0 ? je('Anfang', 'Start') : je('Ende', 'End')
    return je(`${rolle} von „${buchung.titel}“`, `${rolle} of “${buchung.titel}”`)
  }

  /**
   * Einen einzelnen Abschnitt aus der Buchung nehmen.
   *
   * Nötig, seit sich Buchungen umbuchen lassen: steht ein Flug am Ende doppelt da, war bisher nur
   * die ganze Buchung zu löschen und alles neu einzutragen. Der letzte Abschnitt bleibt, denn dann
   * wäre es keine Buchung mehr: dafür gibt es unten „Ganz löschen“.
   */
  async function teilWeg(z, i) {
    if (zeilen.length < 2) return
    const ok = await loeschFrage(teilName(z, i),
      je('Nur dieser Abschnitt verschwindet, der Rest der Buchung bleibt. Verbundene Kosten bleiben unter den Ausgaben vorab.',
        'Only this leg is removed, the rest of the booking stays. Linked costs stay under upfront costs.'))
    if (!ok) return
    loescheBuchung([z.id])
    zeilen = zeilen.filter((x) => x.id !== z.id)
    haptic()
    zeigeToast(je('Abschnitt entfernt', 'Leg removed'), 'ok')
    // Die Buchung hieß nach ihrem ersten Termin. Ist der weg, zeigt das Blatt auf den nächsten.
    if (z.id === buchung.id) onwechsel(zeilen[0]?.id || null)
  }

  function umbuchungZurueck() { ersetzeBuchungZurueck(buchung.ids); zeigeToast(je('Umbuchung zurückgenommen', 'Rebooking undone'), 'ok'); onfertig() }

</script>

<div class="ba-hg" data-dialog-hg aria-hidden="true" onclick={onabbruch}></div>
<div class="ba" role="dialog" aria-labelledby="ba-titel" use:modal={{ onclose: onabbruch }}>
  <div class="ba-griff" aria-hidden="true"></div>
  <h2 id="ba-titel">{blick === 'ersetzen' ? je('Neue Buchung einfügen', 'Add the new booking') : je('Buchung ändern', 'Change booking')}</h2>
  <p class="ba-wer">{buchung.titel} · {mitWochentag(buchung.von)}</p>

  {#if blick === 'ersetzen'}
    <p class="ba-hinweis">{je('Füg die neue Bestätigungsmail ein. Die alte Buchung bleibt grau stehen, Buchungsnummer und Belege kommen mit.',
      'Paste the new confirmation email. The old booking stays greyed out, booking number and documents come along.')}</p>
    <BuchungEinfuegen kompakt statt={buchung} onfertig={() => onfertig()} />
    <button class="btn ba-zurueck" onclick={() => (blick = 'form')}>{je('Zurück', 'Back')}</button>
  {:else}
    {#if storniert}<p class="ba-marke">{je('Diese Buchung ist storniert.', 'This booking is cancelled.')}</p>{/if}
    {#if umgebucht}<p class="ba-marke">{je('Diese Buchung wurde umgebucht.', 'This booking was rebooked.')}</p>{/if}

    {#if !(fahrt && mehrteilig)}
      <!-- Bei Umsteigeflügen hat jeder Abschnitt unten seine eigene Strecke. Ein Feld hier oben
           wäre wirkungslos und damit irreführend. -->
      <div class="ba-feld">
        <label>{fahrt ? je('Strecke', 'Route') : je('Name', 'Name')}
          <input bind:value={f.titel} placeholder={fahrt ? 'Perth → Singapur' : je('Hotel am Hafen', 'Harbour Hotel')} />
        </label>
      </div>
    {/if}
    <div class="ba-zeile">
      <label>{fahrt ? je('Airline oder Bahn', 'Airline or railway') : je('Anbieter', 'Provider')}
        <input bind:value={f.anbieter} placeholder={fahrt ? 'Singapore Airlines' : 'Booking.com'} />
      </label>
      <label>{je('Buchungsnummer', 'Booking number')}<input bind:value={f.ref} autocapitalize="characters" autocomplete="off" /></label>
    </div>
    {#if kat === 'train'}
      <div class="ba-feld"><label>{je('Abfahrtsbahnhof', 'Departure station')}<input bind:value={f.bahnhof} placeholder="Mainz Hbf" /></label></div>
    {/if}
    {#if !fahrt}
      <div class="ba-zeile">
        <label>{je('Ort', 'Place')}<input bind:value={f.ort} placeholder="Perth" /></label>
        {#if mehrteilig}<label>{je('Ort am Ende', 'Place at the end')}<input bind:value={f.ortBis} placeholder="Perth" /></label>{/if}
      </div>
    {/if}

    <ul class="ba-teile">
      {#each zeilen as z, i (z.id)}
        <li>
          {#if mehrteilig}
            <span class="ba-kopf">
              <span class="ba-nr">{fahrt ? je(`Abschnitt ${i + 1}`, `Leg ${i + 1}`) : (i === 0 ? je('Anfang', 'Start') : je('Ende', 'End'))}</span>
              {#if zeilen.length > 1}
                <button class="ba-teil-weg" onclick={() => teilWeg(z, i)}
                  aria-label={je(`${teilName(z, i)} entfernen`, `Remove ${teilName(z, i)}`)}>✕</button>
              {/if}
            </span>
          {/if}
          {#if fahrt && mehrteilig}
            <label class="ba-breit">{je('Strecke', 'Route')}<input bind:value={z.titel} placeholder="Perth → Singapur" /></label>
          {/if}
          <div class="ba-zeile">
            <label>{je('Datum', 'Date')}<input type="date" bind:value={z.datum} /></label>
            <label>{kat === 'flight' ? je('Abflug', 'Departure') : kat === 'train' ? je('Abfahrt', 'Departure') : i === 0 && mehrteilig ? je('Check-in', 'Check-in') : je('Uhrzeit', 'Time')}
              <input type="time" step="60" bind:value={z.zeit} /></label>
            {#if fahrt}
              <label>{je('Ankunft', 'Arrival')}<input type="time" step="60" bind:value={z.zeitBis} /></label>
              <label>{kat === 'flight' ? je('Flugnummer(n)', 'Flight number(s)') : je('Zugnummer', 'Train number')}
                <input bind:value={z.nr} placeholder={kat === 'flight' ? 'SQ224 / SQ334' : 'ICE 100'} autocapitalize="characters" autocomplete="off" /></label>
            {/if}
            {#if sitzJeTeil}
              <label>{je('Sitzplatz', 'Seat')}<input bind:value={z.sitz} placeholder="12A" autocomplete="off" /></label>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    {#if kat === 'flight'}
      <p class="ba-k">{je('Mehrere Nummern mit Schrägstrich, wenn du umsteigst. Alte Nummern verschwinden beim Speichern.',
        'Several numbers with a slash if you change planes. Old numbers go away when you save.')}</p>
    {/if}
    {#if fahrt && !sitzJeTeil}
      <div class="ba-feld"><label>{je('Sitzplatz', 'Seat')}<input bind:value={f.sitz} placeholder="12A" autocomplete="off" /></label></div>
    {/if}
    {#if mehrteilig}
      <p class="ba-k">{je('Die Reihenfolge der Abschnitte kommt vom Datum. Soll einer woanders hin, ändere sein Datum.',
        'The order of the legs comes from the date. To move one, change its date.')}</p>
    {/if}
    {#if !reihenfolgeOk}<p class="ba-warn" role="status">{je('Ein Datum liegt vor dem Datum davor.', 'One date is before the one above it.')}</p>{/if}

    <div class="ba-knoepfe">
      <button class="btn-primary" disabled={!kannSpeichern} onclick={speichern}>{je('Speichern', 'Save')}</button>
      <button class="btn" onclick={onabbruch}>{je('Abbrechen', 'Cancel')}</button>
    </div>

    <div class="ba-weiter">
      <h3>{je('Sonst noch', 'Anything else')}</h3>
      {#if umgebucht}
        <button class="btn ba-voll" onclick={umbuchungZurueck}>{je('Umbuchung zurücknehmen', 'Undo rebooking')}</button>
      {:else}
        <button class="btn ba-voll" onclick={() => (blick = 'ersetzen')}>{je('🔁 Umbuchen: neue Buchung einfügen', '🔁 Rebook: add the new booking')}</button>
      {/if}
      <button class="btn ba-voll" onclick={stornieren}>{storniert ? je('Storno zurücknehmen', 'Undo cancellation') : je('🚫 Stornieren', '🚫 Cancel booking')}</button>
      <button class="btn ba-voll ba-rot" onclick={loeschen}>{je('🗑 Ganz löschen', '🗑 Delete completely')}</button>
    </div>
  {/if}
</div>

<style>
  /* Am Handy darf hinter dem Blatt nichts mitscrollen: der Hintergrund nimmt keine Wischgeste an,
     und am Ende der Liste wandert die Geste nicht auf die Seite dahinter (wie bei den anderen Blättern). */
  .ba-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); touch-action: none; }
  .ba { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(520px, calc(100% - 24px)); max-height: calc(100dvh - 40px); overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
    padding: 16px 16px 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); box-shadow: 0 22px 50px rgba(0, 0, 0, 0.45); }
  .ba-griff { width: 36px; height: 4px; border-radius: 2px; background: var(--line-stark); margin: -4px auto 10px; }
  .ba h2 { margin: 0; font-size: calc(18px * var(--schrift, 1)); }
  .ba-wer { margin: 2px 0 12px; color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); }
  .ba-hinweis, .ba-k { margin: 0 0 10px; color: var(--muted); font-size: calc(13px * var(--schrift, 1)); line-height: 1.5; }
  .ba-marke { margin: 0 0 10px; padding: 8px 10px; border-radius: var(--radius-s); background: var(--flaeche); border: 1px solid var(--line-stark); font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; }
  .ba-warn { margin: 6px 0 0; color: var(--danger); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; }
  .ba-feld, .ba-zeile { display: grid; gap: 8px; margin-bottom: 8px; }
  .ba-zeile { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
  .ba label { display: flex; flex-direction: column; gap: 4px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); font-weight: 700; min-width: 0; }
  .ba-breit { margin-bottom: 8px; }
  .ba input { font-size: max(16px, calc(14px * var(--schrift, 1))); min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); width: 100%; box-sizing: border-box; }
  .ba-teile { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .ba-teile li { border-top: 1px solid var(--line); padding-top: 10px; }
  .ba-kopf { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ba-teil-weg {
    width: 44px; min-height: 44px; border: none; background: none; color: var(--danger-text);
    font-size: calc(15px * var(--schrift, 1)); cursor: pointer; border-radius: 50%; flex: none;
  }
  .ba-nr { display: block; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-weight: 700; margin-bottom: 6px; }
  .ba-knoepfe { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .ba-knoepfe button { flex: 1 1 140px; min-height: 48px; }
  .ba-weiter { margin-top: 16px; border-top: 1px solid var(--line); padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .ba-weiter h3 { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .ba-voll { width: 100%; min-height: 48px; justify-content: center; }
  .ba-rot { color: var(--danger); }
  .ba-zurueck { width: 100%; min-height: 48px; margin-top: 10px; }
</style>
