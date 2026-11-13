<script>
  import { t, tn } from './i18n.js'
  // Buchung aus einer Bestätigungsmail einfügen: Text einfügen, „Erkennen“, prüfen,
  // „Übernehmen“. Die Erkennung läuft hier auf dem Gerät (buchung-erkennen.js), ohne Netz.
  // Angelegt wird über buchungenEinfuegen() im Buchungs-Topf, deshalb erscheint die
  // Buchung danach überall wie die aus dem Reisekalender (Heute, Etappe, Kalender).
  import { erkenne, alsFormular, alsBuchungen, formularOk, dubletten, stufe, ARTEN, artInfo, zahlAus } from './buchung-erkennen.js'
  import { reisen, gesamtStart, buchungen, buchungenEinfuegen, ersetzeBuchung, neueVorabKosten } from './userdata.js'
  import { etappenMitDatum, planUeberblick, etappeAm, vorgabeStart, plusTage } from './plan.js'
  import { bereich, mitWochentag } from './format.js'
  import { heuteTag } from './heute.js'
  import { frage } from './dialog.js'
  import { zeigeToast } from './toast.js'
  import { haptic } from './haptik.js'
  import { klapp, dauer } from './motion.js'
  import { tick } from 'svelte'
  import { je } from './i18n.js'
  import { speichereBeleg, eigenerPfad, belegLabel } from './belege.js'
  import { belegeAnhaengen } from './userdata.js'

  /** kompakt: ohne eigene Überschrift (im Neu-Blatt). onfertig({ typ:'buchung', datum, etappeId, anzahl })
   *  start: 'mail' (erst Mailtext einfügen) oder 'formular' (gleich das Formular, die Mail ist ein Angebot
   *  oben drüber: „Aus Mail ausfüllen“, wie das automatische Ausfüllen anderer Apps). */
  /** statt: eine vorhandene Buchung (aus buchungenMitKosten). Dann wird sie ersetzt (umgebucht),
   *  statt eine zweite Buchung anzulegen — V44, „Buchung ändern → Umbuchen“. */
  let { kompakt = false, start = 'mail', statt = null, onfertig = () => {} } = $props()
  const formularZuerst = start === 'formular'
  let mailAuf = $state(false)        // Mailfeld über dem Formular aufgeklappt

  const uid = Math.random().toString(36).slice(2, 7)
  let text = $state('')
  let erkannt = $state(null)       // Ergebnis von erkenne()
  let f = $state(null)             // Formularwerte
  let geaendert = $state({})       // Felder, die der Nutzer angefasst hat (keine Prüfmarke mehr)
  // V14: Jede Buchung trägt ihre Kosten (bezahlt am …, am Reisetag oder vor Ort) und ihre Belege
  let zahlung = $state('bezahlt')
  let bezahltAm = $state('')
  let belegDateien = $state([])
  let belegFeld = $state()
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
    const neu = alsFormular(erkannt)
    // Schon von Hand Eingetragenes bleibt, wenn die Mail dazu nichts hergibt
    const eigene = {}
    if (f) for (const k of ['titel', 'anbieter', 'bis', 'zeitVon', 'zeitBis', 'ort', 'ortBis', 'ref', 'flugNr', 'betrag']) if (!neu[k] && f[k]) { neu[k] = f[k]; eigene[k] = true }
    f = neu
    mailAuf = false; text = ''
    geaendert = eigene
    zahlung = 'bezahlt'; bezahltAm = $heuteTag
    haptic()
    zeigeUeberblick()
  }
  // Nach dem Ausfüllen zum Überblick springen, damit man sofort sieht, was die App eingetragen hat
  let ueberblickEl = $state()
  async function zeigeUeberblick() {
    await tick()
    ueberblickEl?.scrollIntoView({ block: 'start', behavior: dauer(240) ? 'smooth' : 'auto' })
    ueberblickEl?.focus({ preventScroll: true })
  }
  // Ohne Mail: dasselbe Formular leer, z. B. für einen Fallschirmsprung, der vor Ort gebucht wurde
  function ohneMail() {
    erkannt = null; geaendert = {}
    f = { art: 'tour', fahrzeug: 'camper', titel: '', anbieter: '', von: $heuteTag, bis: '', zeitVon: '', zeitBis: '', ort: '', ortBis: '', ref: '', flugNr: '', betrag: '', waehrung: 'AUD', segmente: [] }
    zahlung = 'bezahlt'; bezahltAm = $heuteTag
  }
  function verwerfen() {
    erkannt = null; f = null; geaendert = {}; belegDateien = []
    if (formularZuerst) ohneMail()
    else feldText?.focus()
  }
  if (formularZuerst) ohneMail()
  const anfassen = (k) => { if (!geaendert[k]) geaendert = { ...geaendert, [k]: true } }

  // Prüfmarke je Feld: nur solange der Nutzer das Feld nicht selbst bearbeitet hat.
  const MARKE = { sicher: 'sicher', pruefen: t('bitte prüfen'), unsicher: 'unsicher', leer: t('nicht gefunden') }
  // Vier Zustände je Feld nach dem Ausfüllen: übernommen (getönt), bitte prüfen, unsicher, nicht gefunden.
  // Was der Nutzer selbst ändert, ist danach seins: keine Marke, keine Tönung.
  const ZEITFELDER = new Set(['von', 'bis', 'zeitVon', 'zeitBis'])
  const MELDEN = new Set(['titel', 'von', 'zeitVon', 'ort', 'ref', 'betrag'])   // fehlt eins davon, sagt die App es
  const leer = (k) => f?.[k] == null || f[k] === ''
  const mehrereFluege = () => (f?.segmente?.length || 0) > 1
  const marke = (k) => {
    if (!erkannt || geaendert[k]) return null
    if (mehrereFluege() && ZEITFELDER.has(k)) return null
    if (leer(k)) return MELDEN.has(k) ? 'leer' : null
    if (erkannt[k]?.wert == null || erkannt[k].wert === '') return null
    const s = stufe(erkannt[k]?.konfidenz || 0)
    return s === 'sicher' ? null : s
  }
  const ausMail = (k) => !!erkannt && !geaendert[k] && !leer(k) && erkannt[k]?.wert != null && erkannt[k].wert !== ''
  const feldId = (k) => `be-feld-${k}-${uid}`
  function zuFeld(k) {
    const el = document.getElementById(feldId(k))
    el?.scrollIntoView({ block: 'center', behavior: dauer(200) ? 'smooth' : 'auto' })
    el?.focus({ preventScroll: true })
  }

  const BESCHRIFTUNG = {
    flug: [t('Abflug'), t('Ankunft'), t('Flughafen')],
    unterkunft: [t('Check-in'), t('Check-out'), t('Adresse')],
    fahrzeug: [t('Übernahme'), t('Rückgabe'), t('Übernahmeort')],
    tour: [t('Beginn'), t('Ende'), t('Treffpunkt')],
    ticket: [t('Beginn'), t('Ende'), je('Veranstaltungsort', 'Venue')],
    faehre: [t('Abfahrt'), t('Rückfahrt'), t('Abfahrtsort')],
    sonstiges: [t('Beginn'), t('Ende'), t('Ort')],
  }
  const b = $derived(BESCHRIFTUNG[f?.art] || BESCHRIFTUNG.sonstiges)

  const ueberblick = $derived.by(() => {
    if (!erkannt || !f) return null
    void geaendert
    const felder = [['art', t('Art')], ['titel', t('Titel')], ['anbieter', t('Anbieter')],
      ...(mehrereFluege() ? [] : [['von', f.art === 'flug' ? t('Datum') : t('Von')], ['bis', je('Bis', 'To')], ['zeitVon', b[0]], ['zeitBis', b[1]]]),
      ['ort', b[2]], ['ref', t('Buchungsnummer')], ['betrag', t('Betrag')]]
    const o = { gut: [], pruefen: [], fehlt: [] }
    for (const [k, name] of felder) {
      const m = marke(k)
      if (m === 'leer') o.fehlt.push({ k, name })
      else if (m) o.pruefen.push({ k, name })
      else if (ausMail(k)) o.gut.push({ k, name })
    }
    return o
  })

  const etappe = $derived(f?.von ? etappeAm(eintraege, f.von) : null)
  const vorschau = $derived(f && formularOk(f) ? alsBuchungen($state.snapshot(f), { jetzt: '' }) : [])
  // Beim Umbuchen ist die alte Buchung natürlich „doppelt“ — die wird ja gerade ersetzt.
  const doppelt = $derived(dubletten(($buchungen?.events || []).filter((e) => !statt?.ids?.includes(e.id)), vorschau))
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
    const n = statt ? (ersetzeBuchung(statt.ids, ev) ? ev.length : 0) : buchungenEinfuegen(ev)
    if (!n) return
    if (vorabMoeglich && zahlung !== 'keine') {
      const reisetag = ev[0].datum
      neueVorabKosten({ text: f.titel.trim(), kat: artInfo(f.art).vorab, betrag: betragZahl, waehrung: f.waehrung, reiseId: etappe?.reise.id || null,
        terminId: ev[0].id, zahlung: zahlung === 'vorOrt' ? 'vorOrt' : 'bezahlt', datum: zahlung === 'bezahlt' && bezahltAm ? bezahltAm : reisetag })
    }
    if (belegDateien.length) {
      const anhaengen = [], belegt = new Set()
      try {
        for (const d of belegDateien) {
          const pfad = eigenerPfad(ev[0].id, d.name, belegt)
          belegt.add(pfad)
          await speichereBeleg(pfad, d)
          anhaengen.push({ ziel: ev[0].id, label: belegLabel(d.name), datei: pfad })
        }
        try { await navigator.storage?.persist?.() } catch {}
      } catch (err) { zeigeToast(t('Speichern fehlgeschlagen: ') + (err?.message || err), 'fehler', 4000) }
      if (anhaengen.length) belegeAnhaengen(anhaengen)
    }
    haptic.confirm()
    zeigeToast(statt ? t('Umgebucht ✓ Die alte Buchung steht grau darunter.')
      : n > 1 ? t('{n} Termine übernommen ✓', { n }) : t('Buchung übernommen ✓'), 'ok', statt ? 4200 : undefined)
    const ergebnis = { typ: 'buchung', datum: ev[0].datum, etappeId: etappe?.reise.id || null, anzahl: n, ersetzt: !!statt }
    text = ''; erkannt = null; f = null; geaendert = {}; belegDateien = []
    if (formularZuerst) ohneMail()
    onfertig(ergebnis)
  }
</script>

<section class="be" class:kompakt aria-labelledby="be-titel-{uid}">
  {#if !kompakt}
    <h4 id="be-titel-{uid}" class="be-h">{t('✉️ Buchung aus Mail einfügen')}</h4>
  {:else}
    <h3 id="be-titel-{uid}" class="be-unsichtbar">{t('Buchung aus Mail einfügen')}</h3>
  {/if}
  {#if formularZuerst}
    <div class="be-auto">
      {#if !mailAuf}
        <button type="button" class="btn be-auto-knopf" onclick={() => { mailAuf = true; setTimeout(() => feldText?.focus(), 50) }}>
          <span>{je('📋 Aus Mail ausfüllen', '📋 Fill in from email')}</span>
          <small>{je('Bestätigungsmail kopieren und einfügen, die App füllt die Felder automatisch aus.', 'Copy and paste the confirmation email, the app fills in the fields for you.')}</small>
        </button>
      {:else}
        <label class="be-f" for="be-text-{uid}">{je('Text der Bestätigungsmail', 'Confirmation email text')}</label>
        <textarea id="be-text-{uid}" bind:this={feldText} bind:value={text} rows="6"
          placeholder={je('Mail öffnen, alles markieren, kopieren und hier einfügen', 'Open the email, select all, copy and paste it here')}
          autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
        <div class="be-knoepfe">
          <button type="button" class="btn-primary be-los" onclick={erkennen} disabled={!text.trim()}>{je('Felder ausfüllen', 'Fill in fields')}</button>
          {#if kannZwischenablage}<button type="button" class="btn" onclick={ausZwischenablage}>{t('📋 Aus Zwischenablage')}</button>{/if}
          <button type="button" class="btn btn-ghost" onclick={() => { mailAuf = false; text = '' }}>{t('Abbrechen')}</button>
        </div>
      {/if}
    </div>
  {:else}
    <p class="be-k">{t('Bestätigungsmail öffnen, alles markieren, kopieren und hier einfügen. Die App liest Datum, Uhrzeit, Ort, Buchungsnummer und Preis heraus. Danach prüfst du alles und übernimmst es.')}</p>
  {/if}

  {#if !f}
    <label class="be-f" for="be-text-{uid}">{t('Mailtext hier einfügen')}</label>
    <textarea id="be-text-{uid}" bind:this={feldText} bind:value={text} rows="7"
      placeholder={t('z. B. „Your booking at … is confirmed. Check-in: Fri 4 Dec 2026 …“')}
      autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <div class="be-knoepfe">
      <button class="btn-primary be-los" onclick={erkennen} disabled={!text.trim()}>{t('Erkennen')}</button>
      {#if kannZwischenablage}<button class="btn" onclick={ausZwischenablage}>{t('📋 Aus Zwischenablage')}</button>{/if}
      <button class="btn btn-ghost" onclick={ohneMail}>{je('✍️ Ohne Mail eintragen', '✍️ Enter without mail')}</button>
    </div>
  {:else}
    <form class="be-form" onsubmit={(e) => { e.preventDefault(); uebernehmen() }} transition:klapp={{ duration: dauer(240) }}>
      {#if ueberblick}
        <div class="be-ueber" bind:this={ueberblickEl} tabindex="-1" role="status" aria-label={je('Aus der Mail erkannt', 'Found in the email')}>
          <p class="be-ueber-k">{je('✓ Aus der Mail ausgefüllt. Prüfe kurz und ändere, was nicht stimmt. Gespeichert wird erst mit „Übernehmen“.', '✓ Filled in from the email. Check it and change anything that is wrong. Nothing is saved until you tap “Add”.')}</p>
          {#each [['gut', je('Übernommen', 'Filled in')], ['pruefen', je('Bitte prüfen', 'Please check')], ['fehlt', je('Nicht gefunden', 'Not found')]] as [art, titel] (art)}
            {#if ueberblick[art].length}
              <div class="be-ueber-z">
                <span class="be-ueber-t {art}">{titel}</span>
                {#each ueberblick[art] as x (x.k)}<button type="button" class="be-chip {art}" onclick={() => zuFeld(x.k)}>{x.name}</button>{/each}
              </div>
            {/if}
          {/each}
        </div>
      {/if}
      {#if erkannt?.hinweise.length}
        <ul class="be-hinweise" aria-label={t('Hinweise zur Erkennung')}>
          {#each erkannt.hinweise as h}<li>{h}</li>{/each}
        </ul>
      {/if}

      <div class="be-zeile">
        <label class="be-f">{t('Art')}
          <select id={feldId('art')} class:be-auto-feld={ausMail('art')} bind:value={f.art} onchange={() => anfassen('art')}>
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
        <input id={feldId('titel')} class:be-auto-feld={ausMail('titel')} bind:value={f.titel} oninput={() => anfassen('titel')} placeholder={t('z. B. Cable Beach Club')} required />
        {#if marke('titel')}<span class="be-m {marke('titel')}">{MARKE[marke('titel')]}</span>{/if}
      </label>
      <label class="be-f">{t('Anbieter')}
        <input id={feldId('anbieter')} class:be-auto-feld={ausMail('anbieter')} bind:value={f.anbieter} oninput={() => anfassen('anbieter')} placeholder={t('z. B. Booking.com')} />
        {#if marke('anbieter')}<span class="be-m {marke('anbieter')}">{MARKE[marke('anbieter')]}</span>{/if}
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
            <input id={feldId('von')} class:be-auto-feld={ausMail('von')} type="date" bind:value={f.von} oninput={() => anfassen('von')} required />
            {#if marke('von')}<span class="be-m {marke('von')}">{MARKE[marke('von')]}</span>{/if}
          </label>
          <label class="be-f">{f.art === 'flug' ? t('Ankunft am (optional)') : t('Bis (optional)')}
            <input id={feldId('bis')} class:be-auto-feld={ausMail('bis')} type="date" bind:value={f.bis} oninput={() => anfassen('bis')} min={f.von || undefined} />
            {#if marke('bis')}<span class="be-m {marke('bis')}">{MARKE[marke('bis')]}</span>{/if}
          </label>
        </div>
        <div class="be-zeile">
          <label class="be-f">{b[0]}
            <input id={feldId('zeitVon')} class:be-auto-feld={ausMail('zeitVon')} type="time" bind:value={f.zeitVon} oninput={() => anfassen('zeitVon')} />
            {#if marke('zeitVon')}<span class="be-m {marke('zeitVon')}">{MARKE[marke('zeitVon')]}</span>{/if}
          </label>
          <label class="be-f">{b[1]}
            <input id={feldId('zeitBis')} class:be-auto-feld={ausMail('zeitBis')} type="time" bind:value={f.zeitBis} oninput={() => anfassen('zeitBis')} />
            {#if marke('zeitBis')}<span class="be-m {marke('zeitBis')}">{MARKE[marke('zeitBis')]}</span>{/if}
          </label>
        </div>
        {#if f.art === 'flug'}
          <label class="be-f">{t('Flugnummer')}<input bind:value={f.flugNr} oninput={() => anfassen('flugNr')} placeholder={t('z. B. QF 642')} /></label>
        {/if}
      {/if}

      <label class="be-f">{b[2]}
        <input id={feldId('ort')} class:be-auto-feld={ausMail('ort')} bind:value={f.ort} oninput={() => anfassen('ort')} />
        {#if marke('ort')}<span class="be-m {marke('ort')}">{MARKE[marke('ort')]}</span>{/if}
      </label>
      {#if f.art === 'fahrzeug'}
        <label class="be-f">{t('Rückgabeort')}<input bind:value={f.ortBis} oninput={() => anfassen('ortBis')} placeholder={t('leer = wie Übernahme')} /></label>
      {/if}

      <div class="be-zeile">
        <label class="be-f">{t('Buchungsnummer')}
          <input id={feldId('ref')} class:be-auto-feld={ausMail('ref')} bind:value={f.ref} oninput={() => anfassen('ref')} autocapitalize="characters" spellcheck="false" />
          {#if marke('ref')}<span class="be-m {marke('ref')}">{MARKE[marke('ref')]}</span>{/if}
        </label>
      </div>
      <div class="be-zeile">
        <label class="be-f">{t('Betrag')}
          <input id={feldId('betrag')} class:be-auto-feld={ausMail('betrag')} bind:value={f.betrag} oninput={() => anfassen('betrag')} inputmode="decimal" placeholder="z. B. 412,80" />
          {#if marke('betrag')}<span class="be-m {marke('betrag')}">{MARKE[marke('betrag')]}</span>{/if}
        </label>
        <label class="be-f be-schmal">{t('Währung')}
          <select id={feldId('waehrung')} class:be-auto-feld={ausMail('waehrung')} bind:value={f.waehrung} onchange={() => anfassen('waehrung')}>
            <option value="AUD">{t('AUD')}</option><option value="EUR">{t('EUR')}</option><option value="USD">{t('USD')}</option>
          </select>
          {#if f.betrag && marke('waehrung')}<span class="be-m {marke('waehrung')}">{MARKE[marke('waehrung')]}</span>{/if}
        </label>
      </div>
      {#if vorabMoeglich}
        <fieldset class="be-zahlung">
          <legend>{je('Bezahlt?', 'Paid?')}</legend>
          <label class="be-check"><input type="radio" bind:group={zahlung} value="bezahlt" /> <span>{je('Bezahlt am', 'Paid on')}</span>
            {#if zahlung === 'bezahlt'}<input class="be-am" type="date" bind:value={bezahltAm} aria-label={je('Bezahlt am', 'Paid on')} />{/if}</label>
          <label class="be-check"><input type="radio" bind:group={zahlung} value="reisetag" /> <span>{je('Am Reisetag bezahlt', 'Paid on the day')}</span></label>
          <label class="be-check"><input type="radio" bind:group={zahlung} value="vorOrt" /> <span>{je('Vor Ort zu zahlen', 'Pay on site')}</span></label>
          <label class="be-check"><input type="radio" bind:group={zahlung} value="keine" /> <span>{je('Nicht in die Kosten', 'Leave out of costs')}</span></label>
        </fieldset>
      {:else if betragZahl != null}
        <p class="be-k">{je('In die Kosten fließen nur Beträge in AUD oder EUR.', 'Only AUD or EUR amounts go into the costs.')}</p>
      {/if}

      <div class="be-belege">
        <span class="be-f">{je('Belege (Voucher, Bestätigung, Rechnung)', 'Documents (voucher, confirmation, invoice)')}</span>
        {#if belegDateien.length}
          <ul>{#each belegDateien as d, i (d.name + i)}<li>📎 {d.name} <button type="button" class="be-x" aria-label={je('Beleg entfernen', 'Remove document')} onclick={() => (belegDateien = belegDateien.filter((_, j) => j !== i))}>✕</button></li>{/each}</ul>
        {/if}
        <input bind:this={belegFeld} class="be-unsichtbar" type="file" multiple accept="application/pdf,image/*" onchange={(e) => { belegDateien = [...belegDateien, ...e.currentTarget.files]; e.currentTarget.value = '' }} />
        <button type="button" class="btn" onclick={() => belegFeld?.click()}>{je('📎 Beleg hinzufügen', '📎 Add document')}</button>
        <small>{je('Liegt danach offline auf dem Gerät und ist am Termin, am Tag und unter Buchungen abrufbar.', 'Stored offline on this device and shown with the booking, the day and under Bookings.')}</small>
      </div>

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
        <button class="btn-primary be-los" type="submit" disabled={!formularOk(f) || (f.art === 'flug' && f.segmente.length > 1 && !segmenteAn)}>{je('Übernehmen', 'Add')}</button>
        <button class="btn btn-ghost" type="button" onclick={verwerfen}>{formularZuerst ? je('Leeren', 'Clear') : t('Verwerfen')}</button>
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
  .be-form > .be-f, .be > .be-f, .be-auto > .be-f { flex: none; }
  .be-auto { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px dashed var(--line-stark); border-radius: var(--radius-m); background: var(--card); }
  .be-auto-knopf { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; min-height: 52px; width: 100%; }
  .be-auto-knopf span { font-weight: 800; font-size: calc(15px * var(--schrift, 1)); }
  .be-auto-knopf small { font-weight: 400; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.4; }
  .be-zahlung { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 8px 10px; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .be-zahlung legend { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); padding: 0 4px; }
  .be-am { min-height: 36px; font-size: max(16px, calc(14px * var(--schrift, 1))); padding: 4px 8px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); }
  .be-belege { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .be-belege ul { list-style: none; margin: 0; padding: 0; font-size: calc(13.5px * var(--schrift, 1)); }
  .be-belege small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .be-x { border: none; background: none; color: var(--muted); cursor: pointer; min-width: 32px; min-height: 32px; }
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
  .be-m.unsicher { background: var(--danger-flaeche); color: var(--danger-text); }
  .be-m.leer { background: none; color: var(--muted); border: 1px dashed var(--line-stark); }
  /* Aus der Mail übernommen: leicht getönt, wie automatisches Ausfüllen. Weg, sobald man das Feld ändert. */
  .be-f .be-auto-feld { background: var(--ok-flaeche); border-color: var(--ok-linie); }
  .be-ueber { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--ok-linie); border-radius: var(--radius-m); background: var(--card); scroll-margin-top: 12px; outline: none; }
  .be-ueber:focus-visible { box-shadow: 0 0 0 2px var(--ok-linie); }
  .be-ueber-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); line-height: 1.45; color: var(--ink); }
  .be-ueber-z { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .be-ueber-t { flex: 0 0 100%; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--muted); }
  .be-ueber-t.gut { color: var(--ok-text); }
  .be-ueber-t.pruefen { color: var(--warn-text); }
  .be-chip { min-height: 36px; padding: 4px 12px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); font: inherit; font-size: calc(13px * var(--schrift, 1)); font-weight: 600; cursor: pointer; }
  .be-chip.gut { background: var(--ok-flaeche); border-color: var(--ok-linie); }
  .be-chip.pruefen { background: var(--warn-flaeche); border-color: transparent; color: var(--warn-text); }
  .be-chip.fehlt { border-style: dashed; color: var(--muted); }

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
