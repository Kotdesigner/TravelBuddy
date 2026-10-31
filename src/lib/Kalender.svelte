<script>
  import { t, LOCALE, tn } from './i18n.js'
  import { ZWEI } from './format.js'
  import { eintragTage } from './plan.js'
  import { reisen, gesamtStart, berechneKalender, verschiebeReise, wanderungen, journal, buchungen, ymd } from './userdata.js'
  import { dauerText } from './wanderungen-daten.js'
  import { katInfo } from './reisekalender.js'
  import BelegKnoepfe from './BelegKnoepfe.svelte'
  import { baueEintraege, alsPdf, alsXlsx } from './kalenderexport.js'

  let { kalender = [], box = '' } = $props()

  const plan = $derived(berechneKalender($reisen, $gesamtStart))

  const fmt = (d) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
  const fmtTag = (s) => {
    try { return new Date(s + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: ZWEI, month: 'short' }) }
    catch { return s }
  }

  // ---- Datierte Einträge in die Etappen einhängen ----
  //
  // Verglichen wird über den Datums-STRING (YYYY-MM-DD), nicht über Date-Objekte:
  // `bis` liegt auf 00:00 des letzten Tages, ein mit T12:00 gebautes Prüfdatum
  // fiele sonst am letzten Tag jeder Etappe durch.
  // TERMINE sind vorausgeplante Punkte — die gehören in einen Plan.
  const termine = $derived(
    $wanderungen.filter((w) => w.datum).map((w) => ({
      id: 'w-' + w.id, datum: w.datum, zeit: w.zeit || '', typ: 'wanderung', icon: '🥾',
      titel: w.name,
      rand: [w.km ? `${w.km} km` : '', dauerText(w.dauerMin), w.hoehenmeter ? `↑ ${w.hoehenmeter} hm` : '', w.gebiet]
        .filter(Boolean).join(' · '),
    })).sort((a, b) => (a.datum + a.zeit).localeCompare(b.datum + b.zeit))
  )

  // LOGBUCHTAGE sind ein Rückblick, kein Plan. Jeder Tag als eigene Zeile machte
  // aus dem Kalender eine zweite Zeitleiste. Hier steht deshalb nur, WIE VIEL einer
  // Etappe schon geschrieben ist — das zeigt die Lücken, ohne den Plan zuzuschütten.
  const logbuchTage = $derived($journal.flatMap(eintragTage))

  // GEBUCHTES aus dem Reisekalender — feste Punkte, die der Plan einhalten muss.
  const gebucht = $derived(
    ($buchungen?.events || []).filter((e) => !e.platzhalter)
      .map((e) => ({ id: e.id, datum: e.datum, kat: e.kat, titel: e.titel, sub: e.sub, ref: e.ref, docs: e.docs || [] }))
      .sort((a, b) => a.datum.localeCompare(b.datum))
  )

  const inEtappe = (e) => {
    const von = ymd(e.von), bis = ymd(e.bis)
    return termine.filter((d) => d.datum >= von && d.datum <= bis)
  }
  const gebuchtIn = (e) => {
    const von = ymd(e.von), bis = ymd(e.bis)
    return gebucht.filter((d) => d.datum >= von && d.datum <= bis)
  }
  const dokuTage = (e) => {
    const von = ymd(e.von), bis = ymd(e.bis)
    return new Set(logbuchTage.filter((d) => d >= von && d <= bis)).size
  }

  // Was in keine Etappe fällt — sonst verschwände es lautlos.
  const ausserhalb = $derived.by(() => {
    if (!plan.eintraege.length) return termine
    const von = ymd(plan.start), bis = ymd(plan.ende)
    return termine.filter((d) => d.datum < von || d.datum > bis)
  })
  const logbuchAusserhalb = $derived.by(() => {
    if (!plan.eintraege.length) return logbuchTage.length
    const von = ymd(plan.start), bis = ymd(plan.ende)
    return new Set(logbuchTage.filter((d) => d < von || d > bis)).size
  })

  // ---- Export ----
  // Beide Ausgaben aus derselben Quelle. alsPdf() ruft window.open als ERSTES auf,
  // deshalb muss der Klick direkt hier landen — ein await davor, und iOS blockt.
  const exportDaten = () => baueEintraege({
    plan, buchungen: $buchungen, wanderungen: $wanderungen, journal: $journal,
  })
  let exportMeldung = $state('')
  function pdfExport() {
    const d = exportDaten()
    if (!d.eintraege.length) { exportMeldung = t('Noch nichts zu drucken.'); return }
    const zeitraum = plan.eintraege.length ? t('{fmt} – {fmt2} · {gesamtTage} Tage', { fmt: fmt(plan.start), fmt2: fmt(plan.ende), gesamtTage: plan.gesamtTage }) : ''
    if (!alsPdf({ ...d, zeitraum })) exportMeldung = t('Bitte Pop-ups für diese Seite erlauben.')
    else exportMeldung = ''
  }
  function xlsxExport() {
    const d = exportDaten()
    if (!d.eintraege.length) { exportMeldung = t('Noch nichts zu exportieren.'); return }
    try {
      const n = alsXlsx(d, `Reisekalender_${($buchungen?.von) || ymd(plan.start)}.xlsx`)
      exportMeldung = t('✓ {n} Zeilen als Excel-Datei gespeichert', { n })
      setTimeout(() => (exportMeldung = ''), 5000)
    } catch (e) { exportMeldung = t('Export fehlgeschlagen: ') + (e?.message || e) }
  }

  function openMaps(r) {
    const use = (r.stops || []).slice(0, 11)
    if (use.length < 2) return
    const c = (s) => encodeURIComponent(s.lat != null ? s.lat + ',' + s.lon : s.name + ', Australia')
    let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + c(use[0]) + '&destination=' + c(use[use.length - 1])
    if (use.length > 2) url += '&waypoints=' + use.slice(1, -1).map(c).join('%7C')
    window.open(url, '_blank')
  }
</script>

<!-- Dynamischer Plan aus meinen Reisen -->
<div class="plan">
  <div class="plan-kopf">
    <div class="titel">{t('🧭 Mein Gesamtplan')}</div>
    <div class="kopf-akt">
      <button class="exp" onclick={pdfExport} title={t('Druckfassung A4 \\u2014 nach Abschnitten und Tagen')}>{t('📄 PDF')}</button>
      <button class="exp" onclick={xlsxExport} title={t('Eine Zeile je Termin, mit Filter und Spaltenbreiten')}>{t('📊 Excel')}</button>
    </div>
  </div>

  {#if exportMeldung}<div class="exp-meldung">{exportMeldung}</div>{/if}

  {#if plan.eintraege.length === 0}
    <p class="hint">{t('Noch keine Etappen. Im Plan eine Etappe mit Datum anlegen oder den Reisekalender laden, dann steht sie hier.')}</p>
  {:else}
    <div class="zeit">
      {#each plan.eintraege as e, i (e.reise.id)}
        {@const eTermine = inEtappe(e)}
        {@const doku = dokuTage(e)}
        {@const gb = gebuchtIn(e)}
        <div class="gruppe">
          <div class="etappe" style="border-left:5px solid {e.reise.farbe}">
            <div class="datum">{fmt(e.von)}{#if e.tage > 1}&nbsp;– {fmt(e.bis)}{/if}<span class="tage">{tn(e.tage, '{n} Tag', '{n} Tage')}</span></div>
            <div class="inhalt">
              <b>{e.reise.name}</b>
              <span class="stops">{t('{length} Stopp(s)', { length: (e.reise.stops || []).length })}{#if e.reise.stops?.length}: {e.reise.stops.map((s) => s.name).join(' → ')}{/if}</span>
            </div>
            <div class="etappe-akt">
              {#if (e.reise.stops || []).length >= 2}<button class="mp" onclick={() => openMaps(e.reise)} title={t('in Google Maps')}>📍</button>{/if}
            </div>
          </div>
          {#if eTermine.length || doku || gb.length}
            <div class="termine" style="--f:{e.reise.farbe}">
              {#each gb as b (b.id)}
                <div class="termin gebucht">
                  <span class="t-datum">{fmtTag(b.datum)}</span>
                  <span class="t-titel">{katInfo(b.kat).icon} {b.titel}</span>
                  {#if b.sub}<span class="t-rand">{b.sub}</span>{/if}
                  {#if b.ref}<span class="t-ref">{b.ref}</span>{/if}
                  <BelegKnoepfe docs={b.docs} klein />
                </div>
              {/each}
              {#each eTermine as t (t.id)}
                <div class="termin {t.typ}">
                  <span class="t-datum">{fmtTag(t.datum)}{#if t.zeit}&nbsp;· {t.zeit}{/if}</span>
                  <span class="t-titel">{t.icon} {t.titel}</span>
                  {#if t.rand}<span class="t-rand">{t.rand}</span>{/if}
                </div>
              {/each}
              {#if doku}
                <a class="doku" href="#/logbuch/etappe/{e.reise.id}" class:voll={doku >= e.tage}>
                  {tn(e.tage, '📖 {doku} von {n} Tag im Logbuch', '📖 {doku} von {n} Tagen im Logbuch', { doku })}
                  {#if doku < e.tage}<span class="d-luecke">{t('· {wert} offen', { wert: e.tage - doku })}</span>{/if}
                </a>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="summe">{t('Gesamt: {gesamtTage} Tage · {fmt} – {fmt2}', { gesamtTage: plan.gesamtTage, fmt: fmt(plan.start), fmt2: fmt(plan.ende) })}</div>

    {#if ausserhalb.length || logbuchAusserhalb}
      <div class="ausserhalb">
        <div class="a-titel">
          {t('📅 außerhalb des Plans:')}
          {#if ausserhalb.length}{tn(ausserhalb.length, '{n} Termin', '{n} Termine')}{/if}
          {#if ausserhalb.length && logbuchAusserhalb}&nbsp;· {/if}
          {#if logbuchAusserhalb}{tn(logbuchAusserhalb, '{n} Logbuchtag', '{n} Logbuchtage')}{/if}
        </div>
        <!-- Gedeckelt: liegt der Plan-Start noch auf einem Platzhalter, fällt sonst
             JEDER Logbuchtag hier hinein und der Kasten wird länger als der Plan. -->
        {#each ausserhalb.slice(0, 5) as t (t.id)}
          <div class="termin {t.typ}">
            <span class="t-datum">{fmtTag(t.datum)}{#if t.zeit}&nbsp;· {t.zeit}{/if}</span>
            <span class="t-titel">{t.icon} {t.titel}</span>
          </div>
        {/each}
        {#if ausserhalb.length > 5}
          <span class="a-hint">{t('… und {wert} weitere', { wert: ausserhalb.length - 5 })}</span>
        {/if}
        <span class="a-hint">{t('Liegen vor {fmt} oder nach {fmt2} . Passe im Plan das Datum der Etappe an, dann rutschen sie hinein.', { fmt: fmt(plan.start), fmt2: fmt(plan.ende) })}</span>
      </div>
    {/if}
  {/if}
</div>

<!-- Ursprünglicher Referenz-Kalender -->
<details class="ref">
  <summary>{t('Referenz-Kalender (ursprünglicher Vorschlag)')}</summary>
  <div class="cal">
    {#each kalender as k}
      <div class="row">
        <div class="date">{k.datum}<span class="days">{k.tage}</span></div>
        <div class="content"><b>{k.titel}</b><p>{k.text}</p></div>
      </div>
    {/each}
  </div>
  {#if box}<div class="cbox">{@html box}</div>{/if}
</details>

<style>
  .plan { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 18px; }
  .plan-kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
  .titel { font-size: calc(17px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .start { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .kopf-akt { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .exp { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 6px 11px; border: 1px solid var(--line-stark);
    background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .exp:active { background: var(--flaeche-2); }
  .exp-meldung { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); margin-bottom: 8px; }
  .hint { color: var(--muted); font-size: calc(13px * var(--schrift, 1)); background: var(--flaeche); padding: 12px; border-radius: 8px; margin: 0; }
  .zeit { display: flex; flex-direction: column; gap: 8px; }
  .etappe { display: flex; gap: 12px; align-items: center; background: var(--eingabe); border: 1px solid #ece3d4; border-radius: 8px; padding: 9px 12px; }
  .datum { flex: 0 0 130px; font-weight: 700; color: var(--brand-text); font-size: calc(13.5px * var(--schrift, 1)); }
  .datum .tage { display: block; font-weight: 400; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }
  .inhalt { flex: 1; min-width: 0; }
  .inhalt b { font-size: calc(14px * var(--schrift, 1)); }
  .inhalt .stops { display: block; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }
  .etappe-akt { display: inline-flex; gap: 3px; flex: 0 0 auto; }
  .etappe-akt button { border: 1px solid var(--line-stark); background: var(--card); border-radius: 8px; cursor: pointer; font-size: calc(14px * var(--schrift, 1)); min-width: 34px; min-height: 34px; padding: 0 8px; }
  .etappe-akt button:disabled { opacity: 0.3; }
  .etappe-akt .mp { border-color: #cfe0ec; background: var(--info-flaeche); }
  .summe { margin-top: 10px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); }

  /* Datierte Wanderungen & Logbuchtage, eingerückt unter ihrer Etappe */
  .gruppe { display: flex; flex-direction: column; gap: 4px; }
  .termine { display: flex; flex-direction: column; gap: 3px; margin: 0 0 2px 18px; padding-left: 10px; border-left: 2px dashed color-mix(in srgb, var(--f, #999) 55%, transparent); }
  .termin {
    display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
    font-size: calc(12.5px * var(--schrift, 1)); padding: 4px 9px; border-radius: 6px; background: var(--flaeche);
  }
  .doku {
    display: inline-flex; align-items: baseline; gap: 6px; align-self: flex-start;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; text-decoration: none;
    color: var(--muted); background: var(--flaeche); padding: 4px 9px; border-radius: 6px;
  }
  .doku.voll { color: var(--ok-text); background: var(--ok-flaeche); }
  .d-luecke { font-weight: 600; color: var(--muted); }
  .t-datum { flex: 0 0 auto; font-weight: 800; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); min-width: 92px; }
  .t-titel { font-weight: 700; color: var(--ink); }
  .termin.gebucht { background: var(--info-flaeche, #eaf2f8); }
  .t-ref { font-size: calc(12px * var(--schrift, 1)); font-family: ui-monospace, monospace; color: var(--muted); }
  .t-rand { color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }

  .ausserhalb { margin-top: 12px; padding: 10px 12px; background: var(--flaeche); border: 1px dashed var(--line-stark); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
  .a-titel { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .a-hint { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }

  .ref { margin-top: 6px; }
  .ref summary { cursor: pointer; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); padding: 8px 0; }
  .cal { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--card); margin-top: 8px; }
  .row { display: flex; gap: 14px; padding: 12px 16px; border-top: 1px solid #f0e9db; }
  .row:first-child { border-top: none; }
  .date { flex: 0 0 130px; font-weight: 700; color: var(--brand-text); font-size: calc(13.5px * var(--schrift, 1)); }
  .days { display: block; font-weight: 400; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); margin-top: 2px; }
  .content b { font-size: calc(14px * var(--schrift, 1)); }
  .content p { margin: 4px 0 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .cbox { margin-top: 12px; background: var(--ok-flaeche); border-left: 3px solid #2f7a63; padding: 12px 16px; border-radius: 0 6px 6px 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .cbox :global(b) { color: var(--ink); }
  .cbox :global(ul) { margin: 8px 0 0; padding-left: 20px; }
  .cbox :global(li) { margin-bottom: 6px; }
  @media (max-width: 520px) { .etappe { flex-wrap: wrap; } .datum { flex: 1 1 100%; } .row { flex-direction: column; gap: 4px; } .date { flex: none; } }
</style>
