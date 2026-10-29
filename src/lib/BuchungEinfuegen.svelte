<script>
  import { t, tn } from './i18n.js'
  // Buchung aus einer Bestätigungsmail einfügen: Text einfügen, „Erkennen“, prüfen,
  // „Übernehmen“. Die Erkennung läuft hier auf dem Gerät (buchung-erkennen.js), ohne Netz.
  // Angelegt wird über buchungenEinfuegen() im Buchungs-Topf, deshalb erscheint die
  // Buchung danach überall wie die aus dem Reisekalender (Heute, Etappe, Kalender).
  import { erkenne, alsFormular, alsBuchungen, formularOk, dubletten, stufe, ARTEN, artInfo, zahlAus } from './buchung-erkennen.js'
  import { reisen, gesamtStart, buchungen, buchungenEinfuegen, neueVorabKosten } from './userdata.js'
  import { etappenMitDatum, planUeberblick, etappeAm, vorgabeStart, plusTage } from './plan.js'
  import { bereich, mitWochentag } from './format.js'
  import { heuteTag } from './heute.js'
  import { frage } from './dialog.js'
  import { zeigeToast } from './toast.js'
  import { haptic } from './haptik.js'
  import { klapp, dauer } from './motion.js'

  /** kompakt: ohne eigene Überschrift (im Neu-Blatt). onfertig({ typ:'buchung', datum, etappeId, anzahl }) */
  let { kompakt = false, onfertig = () => {} } = $props()

  const uid = Math.random().toString(36).slice(2, 7)
  let text = $state('')
  let erkannt = $state(null)       // Ergebnis von erkenne()
  let f = $state(null)             // Formularwerte
  let geaendert = $state({})       // Felder, die der Nutzer angefasst hat (keine Prüfmarke mehr)
  let alsVorab = $state(false)
  let feldText = $state()

  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const ueber = $derived(planUeberblick(eintraege))
  // Reisezeitraum hilft bei Daten ohne Jahr und bei 03/12 gegen 12/03.
  const zeitraum = $derived(ueber.start ? { von: ueber.start, bis: ueber.ende } : { von: vorgabeStart(), bis: plusTage(vorgabeStart(), 120) })

  const kannZwischenablage = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText
  async function ausZwischenablage() {
    try {
      const inhalt = await navigator.clipboard.readText()
      if (inhalt?.trim()) { text = inhalt; erkennen() }
      else zeigeToast(t('Die Zwischenablage ist leer.'), 'info')
    } catch { zeigeToast(t('Kein Zugriff auf die Zwischenablage. Bitte ins Feld einfügen.'), 'info', 3200) }
  }

  function erkennen() {
    if (!text.trim()) return
    erkannt = erkenne(text, { zeitraum, heute: $heuteTag })
    f = alsFormular(erkannt)
    geaendert = {}
    alsVorab = false
    haptic()
  }
  function verwerfen() {
    erkannt = null; f = null; geaendert = {}
    feldText?.focus()
  }
  const anfassen = (k) => { if (!geaendert[k]) geaendert = { ...geaendert, [k]: true } }

  // Prüfmarke je Feld: nur solange der Nutzer das Feld nicht selbst bearbeitet hat.
  const MARKE = { sicher: 'sicher', pruefen: t('bitte prüfen'), unsicher: 'unsicher', leer: t('nicht gefunden') }
  const marke = (k) => {
    if (!erkannt || geaendert[k]) return null
    const s = stufe(erkannt[k]?.konfidenz || 0)
    return s === 'sicher' ? null : s
  }

  const BESCHRIFTUNG = {
    flug: [t('Abflug'), t('Ankunft'), t('Flughafen')],
    unterkunft: [t('Check-in'), t('Check-out'), t('Adresse')],
    fahrzeug: [t('Übernahme'), t('Rückgabe'), t('Übernahmeort')],
    tour: [t('Beginn'), t('Ende'), t('Treffpunkt')],
    faehre: [t('Abfahrt'), t('Rückfahrt'), t('Abfahrtsort')],
    sonstiges: [t('Beginn'), t('Ende'), t('Ort')],
  }
  const b = $derived(BESCHRIFTUNG[f?.art] || BESCHRIFTUNG.sonstiges)

  const etappe = $derived(f?.von ? etappeAm(eintraege, f.von) : null)
  const vorschau = $derived(f && formularOk(f) ? alsBuchungen($state.snapshot(f), { jetzt: '' }) : [])
  const doppelt = $derived(dubletten(($buchungen?.events || []), vorschau))
  const betragZahl = $derived(f?.betrag ? zahlAus(f.betrag) : null)
  const vorabMoeglich = $derived(betragZahl != null && ['AUD', 'EUR'].includes(f?.waehrung))
  const segmenteAn = $derived((f?.segmente || []).filter((s) => s.an).length)

  async function uebernehmen() {
    if (!f || !formularOk(f)) return
    const ev = alsBuchungen($state.snapshot(f))
    if (!ev.length) return
    if (doppelt.length && !(await frage({
      titel: t('Diese Buchung gibt es vielleicht schon'),
      text: t('Am {mitWochentag} steht schon „{titel}“ mit derselben Nummer oder demselben Namen. Trotzdem anlegen?', { mitWochentag: mitWochentag(doppelt[0].datum), titel: doppelt[0].titel }),
      ja: t('Trotzdem anlegen'),
    }))) return
    const n = buchungenEinfuegen(ev)
    if (alsVorab && vorabMoeglich) {
      neueVorabKosten({ text: f.titel.trim(), kat: artInfo(f.art).vorab, betrag: betragZahl, waehrung: f.waehrung, reiseId: etappe?.reise.id || null })
    }
    haptic.confirm()
    zeigeToast(n > 1 ? t('{n} Termine übernommen ✓', { n }) : t('Buchung übernommen ✓'), 'ok')
    const ergebnis = { typ: 'buchung', datum: ev[0].datum, etappeId: etappe?.reise.id || null, anzahl: n }
    text = ''; erkannt = null; f = null; geaendert = {}
    onfertig(ergebnis)
  }
</script>

<section class="be" class:kompakt aria-labelledby="be-titel-{uid}">
  {#if !kompakt}
    <h4 id="be-titel-{uid}" class="be-h">{t('✉️ Buchung aus Mail einfügen')}</h4>
  {:else}
    <h3 id="be-titel-{uid}" class="be-unsichtbar">{t('Buchung aus Mail einfügen')}</h3>
  {/if}
  <p class="be-k">{t('Bestätigungsmail öffnen, alles markieren, kopieren und hier einfügen. Die App liest Datum, Uhrzeit, Ort, Buchungsnummer und Preis heraus. Danach prüfst du alles und übernimmst es.')}</p>

  {#if !f}
    <label class="be-f" for="be-text-{uid}">{t('Mailtext hier einfügen')}</label>
    <textarea id="be-text-{uid}" bind:this={feldText} bind:value={text} rows="7"
      placeholder={t('z. B. „Your booking at … is confirmed. Check-in: Fri 4 Dec 2026 …“')}
      autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <div class="be-knoepfe">
      <button class="btn-primary be-los" onclick={erkennen} disabled={!text.trim()}>{t('Erkennen')}</button>
      {#if kannZwischenablage}<button class="btn" onclick={ausZwischenablage}>{t('📋 Aus Zwischenablage')}</button>{/if}
    </div>
  {:else}
    <form class="be-form" onsubmit={(e) => { e.preventDefault(); uebernehmen() }} transition:klapp={{ duration: dauer(240) }}>
      {#if erkannt?.hinweise.length}
        <ul class="be-hinweise" aria-label={t('Hinweise zur Erkennung')}>
          {#each erkannt.hinweise as h}<li>{h}</li>{/each}
        </ul>
      {/if}

      <div class="be-zeile">
        <label class="be-f">{t('Art')}
          <select bind:value={f.art} onchange={() => anfassen('art')}>
            {#each ARTEN as a}<option value={a.id}>{a.emoji} {a.label}</option>{/each}
          </select>
          {#if marke('art')}<span class="be-m {marke('art')}">{MARKE[marke('art')]}</span>{/if}
        </label>
        {#if f.art === 'fahrzeug'}
          <div class="segment be-seg" role="group" aria-label={t('Fahrzeug')}>
            <button type="button" class:an={f.fahrzeug === 'camper'} aria-pressed={f.fahrzeug === 'camper'} onclick={() => (f.fahrzeug = 'camper')}>{t('🚐 Camper')}</button>
            <button type="button" class:an={f.fahrzeug === 'car'} aria-pressed={f.fahrzeug === 'car'} onclick={() => (f.fahrzeug = 'car')}>{t('🚗 Mietwagen')}</button>
          </div>
        {/if}
      </div>

      <label class="be-f">{t('Titel')}
        <input bind:value={f.titel} oninput={() => anfassen('titel')} placeholder={t('z. B. Cable Beach Club')} required />
        {#if marke('titel')}<span class="be-m {marke('titel')}">{MARKE[marke('titel')]}</span>{/if}
      </label>
      <label class="be-f">{t('Anbieter')}
        <input bind:value={f.anbieter} oninput={() => anfassen('anbieter')} placeholder={t('z. B. Booking.com')} />
      </label>

      {#if f.segmente.length > 1}
        <fieldset class="be-segmente">
          <legend>{t('{length} Flüge, je ein Termin', { length: f.segmente.length })}</legend>
          {#each f.segmente as s, i}
            <div class="be-segment">
              <label class="be-check"><input type="checkbox" bind:checked={s.an} /> <span>{t('Flug {wert}', { wert: i + 1 })}</span></label>
              <div class="be-zeile">
                <label class="be-f">{t('Strecke')}<input bind:value={s.titel} /></label>
                <label class="be-f be-schmal">{t('Flugnummer')}<input bind:value={s.flugNr} /></label>
              </div>
              <div class="be-zeile">
                <label class="be-f">{t('Datum')}<input type="date" bind:value={s.datum} /></label>
                <label class="be-f be-schmal">{t('Abflug')}<input type="time" bind:value={s.zeitVon} /></label>
                <label class="be-f be-schmal">{t('Ankunft')}<input type="time" bind:value={s.zeitBis} /></label>
              </div>
            </div>
          {/each}
        </fieldset>
      {:else}
        <div class="be-zeile">
          <label class="be-f">{f.art === 'flug' ? t('Datum') : t('Von')}
            <input type="date" bind:value={f.von} oninput={() => anfassen('von')} required />
            {#if marke('von')}<span class="be-m {marke('von')}">{MARKE[marke('von')]}</span>{/if}
          </label>
          <label class="be-f">{f.art === 'flug' ? t('Ankunft am (optional)') : t('Bis (optional)')}
            <input type="date" bind:value={f.bis} oninput={() => anfassen('bis')} min={f.von || undefined} />
            {#if f.bis && marke('bis')}<span class="be-m {marke('bis')}">{MARKE[marke('bis')]}</span>{/if}
          </label>
        </div>
        <div class="be-zeile">
          <label class="be-f">{b[0]}
            <input type="time" bind:value={f.zeitVon} oninput={() => anfassen('zeitVon')} />
            {#if f.zeitVon && marke('zeitVon')}<span class="be-m {marke('zeitVon')}">{MARKE[marke('zeitVon')]}</span>{/if}
          </label>
          <label class="be-f">{b[1]}
            <input type="time" bind:value={f.zeitBis} oninput={() => anfassen('zeitBis')} />
            {#if f.zeitBis && marke('zeitBis')}<span class="be-m {marke('zeitBis')}">{MARKE[marke('zeitBis')]}</span>{/if}
          </label>
        </div>
        {#if f.art === 'flug'}
          <label class="be-f">{t('Flugnummer')}<input bind:value={f.flugNr} oninput={() => anfassen('flugNr')} placeholder={t('z. B. QF 642')} /></label>
        {/if}
      {/if}

      <label class="be-f">{b[2]}
        <input bind:value={f.ort} oninput={() => anfassen('ort')} />
        {#if f.ort && marke('ort')}<span class="be-m {marke('ort')}">{MARKE[marke('ort')]}</span>{/if}
      </label>
      {#if f.art === 'fahrzeug'}
        <label class="be-f">{t('Rückgabeort')}<input bind:value={f.ortBis} oninput={() => anfassen('ortBis')} placeholder={t('leer = wie Übernahme')} /></label>
      {/if}

      <div class="be-zeile">
        <label class="be-f">{t('Buchungsnummer')}
          <input bind:value={f.ref} oninput={() => anfassen('ref')} autocapitalize="characters" spellcheck="false" />
          {#if f.ref && marke('ref')}<span class="be-m {marke('ref')}">{MARKE[marke('ref')]}</span>{/if}
        </label>
      </div>
      <div class="be-zeile">
        <label class="be-f">{t('Betrag')}
          <input bind:value={f.betrag} oninput={() => anfassen('betrag')} inputmode="decimal" placeholder="z. B. 412,80" />
          {#if f.betrag && marke('betrag')}<span class="be-m {marke('betrag')}">{MARKE[marke('betrag')]}</span>{/if}
        </label>
        <label class="be-f be-schmal">{t('Währung')}
          <select bind:value={f.waehrung} onchange={() => anfassen('waehrung')}>
            <option value="AUD">{t('AUD')}</option><option value="EUR">{t('EUR')}</option><option value="USD">{t('USD')}</option>
          </select>
          {#if f.betrag && marke('waehrung')}<span class="be-m {marke('waehrung')}">{MARKE[marke('waehrung')]}</span>{/if}
        </label>
      </div>
      {#if vorabMoeglich}
        <label class="be-check"><input type="checkbox" bind:checked={alsVorab} /> <span>{t('Betrag auch unter Vorab-Ausgaben eintragen')}</span></label>
      {/if}

      <p class="be-etappe" aria-live="polite">
        {#if f.art === 'flug' && f.segmente.length > 1 && segmenteAn}
          {tn(segmenteAn, '{n} Termin', '{n} Termine')}{#if etappe}&nbsp;{t('· ab Etappe „{name}“', { name: etappe.reise.name })}{/if}
        {:else if f.von && etappe}
          {t('📍 {mitWochentag} fällt in die Etappe „{name}“ ({bereich})', { mitWochentag: mitWochentag(f.von), name: etappe.reise.name, bereich: bereich(etappe.von, etappe.bis) })}
        {:else if f.von}
          {t('📍 {mitWochentag} liegt außerhalb deiner Etappen. Die Buchung erscheint trotzdem im Kalender.', { mitWochentag: mitWochentag(f.von) })}
        {:else}
          {t('Ohne Datum kann die Buchung nicht angelegt werden.')}
        {/if}
      </p>
      {#if doppelt.length}
        <p class="be-doppelt" role="status">{t('Am {mitWochentag} gibt es schon „{titel}“.', { mitWochentag: mitWochentag(doppelt[0].datum), titel: doppelt[0].titel })}</p>
      {/if}

      <div class="be-knoepfe">
        <button class="btn-primary be-los" type="submit" disabled={!formularOk(f) || (f.art === 'flug' && f.segmente.length > 1 && !segmenteAn)}>{t('Übernehmen')}</button>
        <button class="btn btn-ghost" type="button" onclick={verwerfen}>{t('Verwerfen')}</button>
      </div>
    </form>
  {/if}

  <p class="be-privat">{t('🔒 Der Mailtext wird nur hier auf dem Gerät ausgewertet und nicht gespeichert oder verschickt. Gespeichert werden nur die Angaben, die du übernimmst. Sie bleiben auf diesem Gerät und kommen nur über dein eigenes Backup woandershin.')}</p>
</section>

<style>
  .be { display: flex; flex-direction: column; gap: 10px; }
  .be:not(.kompakt) { border: 1px solid var(--line-stark); border-radius: var(--radius-m); padding: 12px 14px; background: var(--flaeche); margin-bottom: 12px; }
  .be-h { margin: 0; font-size: calc(14px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .be-unsichtbar { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .be-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); line-height: 1.5; color: var(--muted); }
  .be-f { display: flex; flex-direction: column; gap: 4px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); flex: 1 1 140px; min-width: 0; }
  .be-schmal { flex: 0 1 120px; }
  .be textarea, .be-f input, .be-f select {
    width: 100%; box-sizing: border-box; min-height: 44px; font-size: calc(15px * var(--schrift, 1)); font-weight: 400; font-family: inherit;
    padding: 8px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink);
  }
  .be textarea { resize: vertical; line-height: 1.45; font-size: calc(14px * var(--schrift, 1)); min-height: 140px; }
  .be-zeile { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .be-form { display: flex; flex-direction: column; gap: 12px; }
  .be-knoepfe { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .be-los { flex: 1 1 160px; }
  .be-seg { align-self: flex-end; }
  .be-seg button { min-height: 44px; }

  /* Prüfmarken: Farbe UND Text, damit es nicht nur an der Farbe hängt */
  .be-m { align-self: flex-start; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; border-radius: 10px; padding: 1px 8px; }
  .be-m.pruefen { background: var(--warn-flaeche); color: var(--warn-text); }
  .be-m.unsicher, .be-m.leer { background: var(--danger-flaeche); color: var(--danger-text); }

  .be-hinweise { margin: 0; padding: 8px 12px 8px 26px; border-radius: var(--radius-s); background: var(--warn-flaeche); color: var(--warn-text); font-size: calc(12.5px * var(--schrift, 1)); line-height: 1.5; display: flex; flex-direction: column; gap: 3px; }
  .be-segmente { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 8px 10px 10px; margin: 0; display: flex; flex-direction: column; gap: 10px; background: var(--card); }
  .be-segmente legend { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); padding: 0 4px; }
  .be-segment { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px solid var(--line); }
  .be-segment:first-of-type { border-top: none; padding-top: 0; }
  .be-check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 600; color: var(--ink); cursor: pointer; }
  .be-etappe { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 8px 10px; line-height: 1.45; }
  .be-doppelt { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--danger-text); }
  .be-privat { margin: 0; font-size: calc(12px * var(--schrift, 1)); line-height: 1.5; color: var(--muted); }
</style>
