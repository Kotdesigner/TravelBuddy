<script>
  import { t } from './i18n.js'
  // Ein Reisetag: oben, was an dem Tag ohnehin feststeht (Gebuchtes, Wanderungen,
  // Notizen), darunter dein Logbuch-Eintrag mit allen Themen. Gibt es noch keinen,
  // legt ein Tipp ihn an, mit Datum und Etappe schon richtig gesetzt.
  import { reisen, gesamtStart, journal, wanderungen, buchungen, userData, notizen, neuerJournalEintrag } from './userdata.js'
  import { etappenMitDatum, etappeAm, plusTage, tageZwischen, planUeberblick, ymd, deckt } from './plan.js'
  import { wochentagLang, tagMonatJahr, bereich } from './format.js'
  import { katInfo } from './reisekalender.js'
  import { STATUS_MAP, S_MAP, dauerText } from './wanderungen-daten.js'
  import { NOTIZ_TYP } from './notizen-typen.js'
  import { haptic } from './haptik.js'
  import JournalEintrag from './JournalEintrag.svelte'
  import BelegKnoepfe from './BelegKnoepfe.svelte'

  let { datum, orte = [], warnungen = [], umkreisKm = 150, onzurueck = () => {}, ontag = () => {}, onwanderung = () => {} } = $props()

  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const etappe = $derived(etappeAm(eintraege, datum))
  const ueber = $derived(planUeberblick(eintraege))
  const nr = $derived(ueber.start && datum >= ueber.start && datum <= ueber.ende ? tageZwischen(ueber.start, datum) + 1 : null)
  const eintraegeTag = $derived($journal.filter((j) => deckt(j, datum)))
  const gebucht = $derived(($buchungen?.events || []).filter((b) => !b.platzhalter && b.datum === datum))
  const wand = $derived($wanderungen.filter((w) => w.datum === datum).sort((a, b) => (a.zeit || '12:00').localeCompare(b.zeit || '12:00')))
  const ortName = $derived(new Map(orte.map((o) => [o.id, o.name])))
  const ortTage = $derived(Object.entries($userData).flatMap(([id, ud]) => (ud?.tagebuch || []).filter((t) => t.datum === datum).map((t) => ({ ...t, ortName: ortName.get(id) || id }))))
  const notizDatum = (n) => n.tsLokal ? n.tsLokal.slice(0, 10) : (n.ts ? ymd(new Date(n.ts)) : '')
  const tagNotizen = $derived($notizen.filter((n) => notizDatum(n) === datum))

  function schreiben() {
    haptic.confirm()
    neuerJournalEintrag({ datum })
  }
  const zukunft = $derived(datum > ymd(new Date()))
</script>

<div class="tb">
  <div class="tb-nav">
    <button class="tb-zurueck" onclick={onzurueck}><span aria-hidden="true">‹</span> {t('Logbuch')}</button>
    <span class="tb-blaettern">
      <button onclick={() => ontag(plusTage(datum, -1))} aria-label={t('Vorheriger Tag')}>‹</button>
      <button onclick={() => ontag(plusTage(datum, 1))} aria-label={t('Nächster Tag')}>›</button>
    </span>
  </div>

  <header class="tb-kopf" style="--farbe:{etappe?.reise.farbe || 'var(--line-stark)'}">
    <h2>{wochentagLang(datum)}, {tagMonatJahr(datum)}</h2>
    <p>
      {#if nr}{t('Reisetag {nr}', { nr })}{/if}{#if etappe}{t('{wert}Etappe', { wert: nr ? ' · ' : '' })} <b>{etappe.reise.name}</b>{t(', Tag {wert} von {tage} ({bereich})', { wert: tageZwischen(etappe.von, datum) + 1, tage: etappe.tage, bereich: bereich(etappe.von, etappe.bis) })}{:else if !nr}{t('außerhalb deiner Reise')}{/if}
    </p>
  </header>

  {#if gebucht.length}
    <section class="tb-block">
      <h3>{t('Gebucht')}</h3>
      <ul class="tb-liste">
        {#each gebucht as b (b.id)}
          <li><span class="tb-i" aria-hidden="true">{b.emoji || katInfo(b.kat).icon}</span><span class="tb-txt"><b>{b.titel}</b>{#if b.sub}<small>{b.sub}{#if b.ref}&nbsp;· {b.ref}{/if}</small>{/if}<BelegKnoepfe docs={b.docs} /></span></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if wand.length}
    <section class="tb-block">
      <h3>{t('Wanderungen')}</h3>
      <ul class="tb-liste">
        {#each wand as w (w.id)}
          <li><button class="tb-w" onclick={() => onwanderung(w.id)}>
            <span class="tb-i" aria-hidden="true">{STATUS_MAP[w.status]?.emoji || '🥾'}</span>
            <span class="tb-txt"><b>{w.name}</b><small>{[w.zeit, w.km ? w.km + ' km' : '', dauerText(w.dauerMin), S_MAP[w.schwierigkeit]?.label].filter(Boolean).join(' · ')}</small></span>
            <span class="tb-pfeil" aria-hidden="true">›</span>
          </button></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if ortTage.length || tagNotizen.length}
    <section class="tb-block">
      <h3>{t('Notizen von diesem Tag')}</h3>
      <ul class="tb-liste">
        {#each ortTage as o (o.id)}<li><span class="tb-i" aria-hidden="true">📍</span><span class="tb-txt"><b>{o.ortName}</b><small>{o.text}</small></span></li>{/each}
        {#each tagNotizen as n (n.id)}<li><span class="tb-i" aria-hidden="true">{NOTIZ_TYP[n.typ]?.icon || '🗒️'}</span><span class="tb-txt" class:erl={n.erledigt}>{n.text}</span></li>{/each}
      </ul>
    </section>
  {/if}

  {#if eintraegeTag.length}
    {#each eintraegeTag as e (e.id)}
      <JournalEintrag eintrag={e} {orte} reisen={$reisen} {warnungen} {umkreisKm} immerOffen {eintraege} />
    {/each}
    <button class="btn tb-noch" onclick={schreiben}>{t('+ Weiteren Eintrag für diesen Tag')}</button>
  {:else}
    <div class="tb-leer">
      <p>{zukunft ? t('Dieser Tag kommt noch. Du kannst trotzdem schon etwas notieren.') : t('Für diesen Tag gibt es noch keinen Eintrag.')}</p>
      <button class="btn-primary" onclick={schreiben}>{t('Tag schreiben')}</button>
    </div>
  {/if}
</div>

<style>
  .tb { display: flex; flex-direction: column; gap: 14px; }
  .tb-nav { display: flex; align-items: center; justify-content: space-between; }
  .tb-zurueck { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 12px 0 4px; border: none; background: none; color: var(--brand-text); font-size: calc(16px * var(--schrift, 1)); font-weight: 600; cursor: pointer; }
  .tb-zurueck span { font-size: calc(28px * var(--schrift, 1)); line-height: 1; margin-top: -3px; }
  .tb-blaettern { display: flex; gap: 8px; }
  .tb-blaettern button { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--ink); font-size: calc(22px * var(--schrift, 1)); cursor: pointer; line-height: 1; }
  .tb-kopf { border-left: 6px solid var(--farbe); padding-left: 12px; }
  .tb-kopf h2 { margin: 0; font-size: calc(23px * var(--schrift, 1)); line-height: 1.25; }
  .tb-kopf p { margin: 4px 0 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .tb-block { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 12px 14px; box-shadow: var(--shadow); }
  .tb-block h3 { margin: 0 0 8px; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); }
  .tb-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .tb-liste li { display: flex; align-items: flex-start; gap: 10px; }
  .tb-i { font-size: calc(18px * var(--schrift, 1)); width: 24px; text-align: center; flex: none; line-height: 1.4; }
  .tb-txt { display: flex; flex-direction: column; min-width: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.35; flex: 1; }
  .tb-txt small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); white-space: pre-line; }
  .tb-txt.erl { text-decoration: line-through; color: var(--muted); }
  .tb-w { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; padding: 0; min-height: 44px; cursor: pointer; text-align: left; color: var(--ink); }
  .tb-pfeil { font-size: calc(20px * var(--schrift, 1)); color: var(--muted); }
  .tb-leer { background: var(--flaeche); border-radius: var(--radius-m); padding: 18px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  .tb-leer p { margin: 0; font-size: calc(15px * var(--schrift, 1)); }
  .tb-noch { align-self: flex-start; min-height: 44px; }
</style>
