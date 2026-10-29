<script>
  import { t, tn } from './i18n.js'
  import { heuteTag } from './heute.js'
  // Logbuch: die ganze Reise chronologisch, Etappe für Etappe, Tag für Tag.
  // Am Tag steht alles, was dazu gehört: dein Eintrag, Gebuchtes, Wanderungen,
  // Orts-Notizen, Notizen. Das Band links trägt die Farbe der Etappe; ein voller Punkt
  // heißt „geschrieben“, ein Ring „noch offen“, ein kleiner Punkt „kommt noch“.
  import { untrack } from 'svelte'
  import { dauer, klapp } from './motion.js'
  import { reisen, gesamtStart, journal, wanderungen, buchungen, userData, notizen } from './userdata.js'
  import { etappenMitDatum, chronik, ymd, tagHatInhalt, planUeberblick, tageZwischen } from './plan.js'
  import { bereich, tageText, wochentag, tagMonat, mitWochentag } from './format.js'
  import { katInfo } from './reisekalender.js'
  import { STATUS_MAP } from './wanderungen-daten.js'
  import { NOTIZ_TYP } from './notizen-typen.js'
  import { album } from './tierwelt.js'
  import { geh } from './navigation.js'
  import FotoImport from './FotoImport.svelte'

  let { orte = [], fokusEtappe = null, ontag = () => {}, onneu = () => {} } = $props()

  const heute = $derived($heuteTag)
  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const ortName = $derived(new Map(orte.map((o) => [o.id, o.name])))
  const notizDatum = (n) => n.tsLokal ? n.tsLokal.slice(0, 10) : (n.ts ? ymd(new Date(n.ts)) : '')
  const daten = $derived(chronik({
    eintraege,
    journal: $journal,
    wanderungen: $wanderungen,
    buchungen: $buchungen?.events || [],
    ortTage: Object.entries($userData).flatMap(([ortId, ud]) => (ud?.tagebuch || []).map((t) => ({ ...t, ortId, ortName: ortName.get(ortId) || ortId }))),
    notizen: $notizen.map((n) => ({ ...n, datum: notizDatum(n) })),
    heute,
  }))
  const ueber = $derived(planUeberblick(eintraege))
  const vorDerReise = $derived(ueber.start && heute < ueber.start)

  // Aufgeklappt: die laufende Etappe; vor der Reise alle (es sind ohnehin nur Termine drin).
  let zu = $state({})
  const istZu = (id) => zu[id] ?? false
  $effect(() => {
    const id = fokusEtappe
    if (!id) return
    untrack(() => { zu[id] = false })
    const t = setTimeout(() => document.getElementById('etappe-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => clearTimeout(t)
  })
  // Einmal je Aufruf zu heute springen, aber nicht, wenn die App eine gemerkte Position wiederherstellt
  let gesprungen = false
  $effect(() => {
    if (gesprungen || fokusEtappe || !daten.aktuell) return
    gesprungen = true
    if (window.scrollY > 0) return
    const t = setTimeout(() => { if (window.scrollY < 40) document.getElementById('tag-' + heute)?.scrollIntoView({ block: 'center' }) }, 120)
    return () => clearTimeout(t)
  })

  function zustand(t) {
    if (t.journal.length) return 'voll'
    if (t.datum > heute) return 'kommt'
    return 'offen'
  }
  function auszug(t) {
    const j = t.journal[0]
    if (!j) return ''
    const txt = (j.text || '').trim().replace(/\s+/g, ' ')
    return txt.length > 110 ? txt.slice(0, 108) + '…' : txt
  }
  const fotoZahl = (t) => t.journal.reduce((n, j) => n + (j.fotos || []).length, 0) + t.wanderungen.reduce((n, w) => n + (w.fotos || []).length, 0)
  const geschrieben = (a) => a.tage.filter((t) => t.journal.length).length
  const bisHeute = (a) => a.tage.filter((t) => t.datum <= heute).length
  const tiere = $derived(album($journal))
</script>

<div class="lb">
  <div class="lb-werkzeug">
    <FotoImport {orte}>
      {#snippet neben()}
        <button class="btn lb-tiere" onclick={() => geh('logbuch/tiere')}>
          <span aria-hidden="true">🦘</span> {t('Tierwelt')} <span class="lb-tiere-zahl">{t('{gesehen} von {gesamt}', { gesehen: tiere.gesehen, gesamt: tiere.gesamt })}</span>
        </button>
      {/snippet}
    </FotoImport>
  </div>
  {#if vorDerReise}
    {@const n = tageZwischen(heute, ueber.start)}
    <p class="lb-k">{tn(n, 'Deine Reise beginnt in {n} Tag. Gebuchtes und Wanderungen mit Datum stehen schon an ihrem Tag. Unterwegs schreibst du hier jeden Tag dazu.', 'Deine Reise beginnt in {n} Tagen. Gebuchtes und Wanderungen mit Datum stehen schon an ihrem Tag. Unterwegs schreibst du hier jeden Tag dazu.')}</p>
  {/if}

  {#if daten.vorher.length}
    {@render sonder(t('Vor der Reise'), 'vorher', daten.vorher)}
  {/if}

  {#if !daten.abschnitte.length && !daten.vorher.length && !daten.nachher.length}
    <div class="lb-leer">
      <p><b>{t('Das Logbuch ist noch leer.')}</b> {t('Lege im Plan deine Etappen an, dann erscheinen hier alle Reisetage, oder schreib gleich den ersten Tag.')}</p>
      <button class="btn-primary" onclick={() => onneu('tag')}>{t('Tag schreiben')}</button>
    </div>
  {/if}

  {#each daten.abschnitte as a, i (a.etappe.reise.id)}
    {@const r = a.etappe.reise}
    {@const offen = !istZu(r.id)}
    <section class="lb-etappe rein" id="etappe-{r.id}" style="--farbe:{r.farbe || 'var(--brand)'}; --i:{i}">
      <button class="lb-e-kopf" aria-expanded={offen} onclick={() => (zu = { ...zu, [r.id]: offen })}>
        <span class="lb-e-band" aria-hidden="true"></span>
        <span class="lb-e-txt">
          <span class="lb-e-name">{r.name}</span>
          <span class="lb-e-meta">{bereich(a.etappe.von, a.etappe.bis)} · {tageText(a.etappe.tage)}{#if bisHeute(a)}&nbsp;{t('· {geschrieben} von {bisHeute} geschrieben', { geschrieben: geschrieben(a), bisHeute: bisHeute(a) })}{/if}</span>
        </span>
        <span class="aufklapp klein" class:offen aria-hidden="true"></span>
      </button>
      {#if offen}
        <ol class="lb-tage" transition:klapp={{ duration: dauer(a.tage.length > 20 ? 300 : 220) }}>
          {#each a.tage as tg (tg.datum)}
            {@render tag(tg)}
          {/each}
        </ol>
      {/if}
    </section>
  {/each}

  {#if daten.ausserhalb.length}
    {@render sonder(t('Zwischen den Etappen'), 'ausserhalb', daten.ausserhalb)}
  {/if}
  {#if daten.nachher.length}
    {@render sonder(t('Nach der Reise'), 'nachher', daten.nachher)}
  {/if}
</div>

{#snippet sonder(titel, id, tage)}
  {@const offen = !(zu[id] ?? id === 'vorher')}
  <section class="lb-etappe lb-sonder" style="--farbe: var(--line-stark)">
    <button class="lb-e-kopf" aria-expanded={offen} onclick={() => (zu = { ...zu, [id]: offen })}>
      <span class="lb-e-band" aria-hidden="true"></span>
      <span class="lb-e-txt"><span class="lb-e-name">{titel}</span><span class="lb-e-meta">{t('{tageText} mit Einträgen', { tageText: tageText(tage.length) })}</span></span>
      <span class="aufklapp klein" class:offen aria-hidden="true"></span>
    </button>
    {#if offen}<ol class="lb-tage" transition:klapp={{ duration: dauer(220) }}>{#each tage as tg (tg.datum)}{@render tag(tg)}{/each}</ol>{/if}
  </section>
{/snippet}

{#snippet tag(tg)}
  {@const z = zustand(tg)}
  {@const ist = tg.datum === heute}
  <li class="lb-tag {z}" class:heute={ist} class:leer={!tagHatInhalt(tg)} id="tag-{tg.datum}">
    <button class="lb-t-knopf" onclick={() => ontag(tg.datum)} aria-label={t('{mitWochentag}{wert} öffnen', { mitWochentag: mitWochentag(tg.datum), wert: tg.journal.length ? t(', geschrieben') : '' })}>
      <span class="lb-punkt" aria-hidden="true"></span>
      <span class="lb-t-datum">
        <b>{tagMonat(tg.datum)}</b>
        <small>{wochentag(tg.datum)}{#if tg.nr}&nbsp;{t('· Tag {nr}', { nr: tg.nr })}{/if}</small>
      </span>
      <span class="lb-t-inhalt">
        {#if ist}<span class="lb-heute">{t('heute')}</span>{/if}
        {#each tg.journal as j (j.id)}
          {#if j.ort}<span class="lb-t-ort">{j.ort}</span>{/if}
        {/each}
        {#if auszug(tg)}<span class="lb-t-text">{auszug(tg)}</span>{/if}
        {#if tg.buchungen.length || tg.wanderungen.length || tg.ortTage.length || tg.notizen.length || fotoZahl(tg)}
          <span class="lb-chips">
            {#each tg.buchungen.slice(0, 3) as b}<span class="lb-chip">{b.emoji || katInfo(b.kat).icon} {b.titel}</span>{/each}
            {#if tg.buchungen.length > 3}<span class="lb-chip">+{tg.buchungen.length - 3}</span>{/if}
            {#each tg.wanderungen as w}<span class="lb-chip wand">🥾 {w.name}{#if w.status === 'gemacht'} ✓{/if}</span>{/each}
            {#each tg.ortTage as o}<span class="lb-chip">📍 {o.ortName}</span>{/each}
            {#if tg.notizen.length}<span class="lb-chip">🗒️ {tg.notizen.length}</span>{/if}
            {#if fotoZahl(tg)}<span class="lb-chip">📷 {fotoZahl(tg)}</span>{/if}
          </span>
        {:else if z === 'offen' && !tg.journal.length}
          <span class="lb-t-leer">{t('noch nichts geschrieben')}</span>
        {/if}
      </span>
      <span class="lb-pfeil" aria-hidden="true">›</span>
    </button>
  </li>
{/snippet}

<style>
  .lb { display: flex; flex-direction: column; gap: 12px; }
  .lb-werkzeug > :global(.fi) { width: 100%; }
  .lb-tiere { display: inline-flex; align-items: center; gap: 6px; }
  .lb-tiere-zahl { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
  .lb-k { margin: 0; font-size: calc(14.5px * var(--schrift, 1)); color: var(--muted); background: var(--flaeche); border-radius: var(--radius-m); padding: 12px 14px; }
  .lb-leer { background: var(--flaeche); border-radius: var(--radius-m); padding: 18px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  .lb-leer p { margin: 0; font-size: calc(15px * var(--schrift, 1)); }

  .lb-etappe { position: relative; }
  .lb-e-kopf {
    display: flex; align-items: center; gap: 12px; width: 100%; background: var(--card); border: 1px solid var(--line);
    border-radius: var(--radius-m); padding: 12px 12px 12px 0; cursor: pointer; text-align: left; color: var(--ink); min-height: 60px;
    box-shadow: var(--shadow); overflow: hidden;
  }
  .lb-e-kopf:active { transform: none; }
  .lb-e-band { width: 8px; align-self: stretch; margin: -12px 0; background: var(--farbe); flex: none; }
  .lb-e-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .lb-e-name { font-size: calc(17px * var(--schrift, 1)); font-weight: 800; }
  .lb-e-meta { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .lb-sonder .lb-e-name { font-weight: 700; color: var(--muted); }

  /* Das Band: eine durchgehende Linie in der Etappenfarbe, die Tage hängen daran */
  .lb-tage { list-style: none; margin: 0; padding: 4px 0 4px 0; position: relative; }
  .lb-tage::before { content: ''; position: absolute; left: 19px; top: 0; bottom: 0; width: 3px; background: var(--farbe); border-radius: 2px; opacity: 0.85; }
  .lb-tag { position: relative; }
  .lb-t-knopf {
    display: grid; grid-template-columns: 40px 84px 1fr 16px; align-items: center; gap: 6px; width: 100%;
    background: none; border: none; padding: 6px 4px 6px 0; min-height: 52px; cursor: pointer; text-align: left; color: var(--ink);
    border-radius: 12px;
  }
  .lb-t-knopf:hover { background: var(--flaeche); }
  .lb-t-knopf:active { transform: none; background: var(--flaeche-2); }
  .lb-punkt { justify-self: center; width: 14px; height: 14px; border-radius: 50%; background: var(--bg); border: 3px solid var(--farbe); position: relative; z-index: 1; }
  .lb-tag.voll .lb-punkt { background: var(--farbe); }
  .lb-tag.kommt .lb-punkt { width: 9px; height: 9px; border-width: 2px; }
  .lb-tag.heute .lb-punkt { width: 20px; height: 20px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--farbe) 25%, transparent); animation: heute-puls 1.6s var(--ease-out) 400ms 3; }
  /* Der heutige Tag pulsiert beim Öffnen dreimal sanft: hier bist du */
  @keyframes heute-puls { 50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--farbe) 0%, transparent); } }
  .lb-t-datum { display: flex; flex-direction: column; line-height: 1.25; font-variant-numeric: tabular-nums; }
  .lb-t-datum b { font-size: calc(14px * var(--schrift, 1)); }
  .lb-t-datum small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .lb-tag.kommt .lb-t-datum b { font-weight: 600; color: var(--muted); }
  .lb-t-inhalt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .lb-heute { align-self: flex-start; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: #fff; background: var(--ok); padding: 1px 8px; border-radius: 9px; }
  .lb-t-ort { font-size: calc(15px * var(--schrift, 1)); font-weight: 700; line-height: 1.3; }
  .lb-t-text { font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .lb-t-leer { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); font-style: italic; }
  .lb-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .lb-chip { font-size: calc(12px * var(--schrift, 1)); background: var(--flaeche-2); color: var(--ink); padding: 2px 8px; border-radius: 9px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lb-chip.wand { background: var(--ok-flaeche); color: var(--ok-text); }
  .lb-pfeil { font-size: calc(20px * var(--schrift, 1)); color: var(--muted); }
  .lb-tag.leer.kommt .lb-t-knopf { min-height: 40px; }
  @media (max-width: 400px) { .lb-t-knopf { grid-template-columns: 38px 78px 1fr 12px; } }
  /* Dunkles Design: dunkle Etappenfarben (Braun, Schwarzbraun) aufhellen, sonst verschwindet das Band */
  :global([data-theme='dark']) .lb-etappe { --band: color-mix(in srgb, var(--farbe) 55%, #f0e7da); }
  .lb-etappe { --band: var(--farbe); }
  .lb-tage::before { background: var(--band); }
  .lb-punkt { border-color: var(--band); }
  .lb-tag.voll .lb-punkt { background: var(--band); }
  .lb-e-band { background: var(--band); }
</style>
