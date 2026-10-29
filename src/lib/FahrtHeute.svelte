<script>
  import { t } from './i18n.js'
  // Cockpit „Heute“: steht heute eine Fahrt an, eine kompakte Zeile mit km, Fahrzeit,
  // spätester Abfahrt und Sonnenuntergang. Ohne heutige Fahrt erscheint nichts.
  // Welche Fahrt heute ansteht, entscheidet heutigeFahrt() in fahrtag.js (Logbuch-Strecke,
  // Stopp- oder Routendatum, eintägige Etappe, Anreise am ersten Tag).
  import { gesamtStart as gesamtStartStore, journal as journalStore } from './userdata.js'
  import { veraltet } from './routen-dienst.js'
  import { zahl } from './format.js'
  import { heutigeFahrt, dauerText, uhrzeit, ankunft, WILDWECHSEL } from './fahrtag.js'

  let { reisen = [], heute, gesamtStart = undefined, journal = undefined, geh = null } = $props()

  const fahrt = $derived(heutigeFahrt({
    reisen, heute,
    gesamtStart: gesamtStart ?? $gesamtStartStore,
    journal: journal ?? $journalStore,
    aktuell: (r) => !veraltet(r),
  }))
  const f = $derived(fahrt?.plan)

  // Uhr für „wer jetzt losfährt …“, jede Minute neu
  let jetzt = $state(Date.now())
  $effect(() => {
    const t = setInterval(() => (jetzt = Date.now()), 60000)
    return () => clearInterval(t)
  })
  const spaet = $derived(!!(f?.losSpaetestens && f.reichtLicht && jetzt > f.losSpaetestens.getTime() && jetzt < f.untergang?.getTime()))
  const ankunftJetzt = $derived(spaet ? uhrzeit(ankunft(new Date(jetzt), f.unterwegsMin), f.tz) : '')

  function oeffne() {
    if (!geh || !fahrt) return
    const r = fahrt.reise
    geh(r.typ === 'route' ? (r.etappeId ? `plan/etappe/${r.etappeId}/${r.id}` : `plan/route/${r.id}`) : `plan/etappe/${r.id}`)
  }
</script>

{#if fahrt && f}
  <section class="fh" class:warn={!f.reichtLicht || spaet} aria-labelledby="fh-titel">
    <h2 class="fh-titel" id="fh-titel"><span aria-hidden="true">🚐</span> {t('Heute {zahl} km, ca. {dauerText}', { zahl: zahl(f.km), dauerText: dauerText(f.fahrMin) })}</h2>
    <p class="fh-strecke">{fahrt.fahrt.von} → {fahrt.fahrt.nach}{#if fahrt.abschnitte.length > 1}&nbsp;{t('· {length} Abschnitte', { length: fahrt.abschnitte.length })}{/if}</p>
    <p class="fh-zeiten">
      {#if f.reichtLicht}<span>{t('losfahren bis')} <b>{f.losText}</b></span>{:else}<span class="fh-rot"><b>{t('im Hellen nicht zu schaffen')}</b></span>{/if}
      <span>{t('Sonnenuntergang')} <b>{f.untergangText}</b></span>
    </p>
    {#if !f.reichtLicht}
      <p class="fh-hinweis">{t('Mit Pausen {dauerText} unterwegs, das reicht nicht bis Sonnenuntergang. Besser auf {teile} Tage teilen: {join} km.', { dauerText: dauerText(f.unterwegsMin), teile: f.teile, join: f.kmTeile.map(zahl).join(' + ') })}</p>
    {:else if spaet}
      <p class="fh-hinweis">{t('Wer jetzt losfährt, kommt gegen {ankunftJetzt} an, also nach Sonnenuntergang. {wert}.', { ankunftJetzt, wert: WILDWECHSEL.split('. ')[0] })}</p>
    {/if}
    {#if f.geschaetzt}<p class="fh-klein">{t('Fahrzeit geschätzt, Pausen alle 2 h und 30 min Reserve eingerechnet.')}</p>{:else}<p class="fh-klein">{t('Pausen alle 2 h und 30 min Reserve eingerechnet.')}</p>{/if}
    {#if geh}<button class="btn fh-btn" onclick={oeffne}>{t('Strecke ansehen')}</button>{/if}
  </section>
{/if}

<style>
  .fh { margin-top: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--flaeche); display: flex; flex-direction: column; gap: 4px; }
  .fh.warn { border-color: var(--danger-linie); background: var(--danger-flaeche); }
  .fh-titel { margin: 0; font-size: calc(16px * var(--schrift, 1)); font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; text-wrap: balance; }
  .fh-strecke { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .fh-zeiten { margin: 2px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: calc(14px * var(--schrift, 1)); color: var(--ink); font-variant-numeric: tabular-nums; }
  .fh-zeiten b { font-weight: 800; }
  .fh-rot b { color: var(--danger-text); }
  .fh-hinweis { margin: 4px 0 0; font-size: calc(13px * var(--schrift, 1)); color: var(--ink); line-height: 1.45; }
  .fh-klein { margin: 2px 0 0; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .fh-btn { align-self: flex-start; margin-top: 6px; }
</style>
