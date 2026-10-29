<script>
  import { t, tn } from './i18n.js'
  import { heuteTag } from './heute.js'
  // Heute (V4): was jetzt wichtig ist. Vor der Reise: wie lange noch, was ansteht, was
  // noch zu erledigen ist. Unterwegs: welcher Tag, welche Etappe, was heute und morgen
  // gebucht ist, und der Knopf, um den Tag ins Logbuch zu schreiben.
  import { reisen, gesamtStart, buchungen, wanderungen, journal, vorbereitung, istAn, neuerJournalEintrag } from './userdata.js'
  import { etappenMitDatum, reiseStatus, plusTage, ymd, routenDerEtappe, tageZwischen } from './plan.js'
  import { mitWochentag, tagMonatJahr, tageText, bereich, zahl } from './format.js'
  import { katInfo } from './reisekalender.js'
  import { STATUS_MAP } from './wanderungen-daten.js'
  import { zaehlHoch } from './motion.js'
  import { VORBEREITUNG } from './vorbereitung-daten.js'

  import FahrtHeute from './FahrtHeute.svelte'
  let { warnAnzahl = 0, sperrAnzahl = 0, sperrRoute = 0, onneu = () => {}, ontag = () => {}, geh = () => {} } = $props()

  const heute = $derived($heuteTag)
  const morgen = $derived(plusTage(heute, 1))
  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const s = $derived(reiseStatus(eintraege, heute))
  const termine = $derived(($buchungen?.events || []).filter((b) => !b.platzhalter))
  const am = (d) => termine.filter((b) => b.datum === d)
  const naechste = $derived(termine.filter((b) => b.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 3))
  const wandAm = (d) => $wanderungen.filter((w) => w.datum === d)
  const heuteGeschrieben = $derived($journal.some((j) => j.datum === heute))
  const vorbItems = $derived([...VORBEREITUNG.flatMap((g) => g.items), ...($vorbereitung.custom || [])])
  const vorbFertig = $derived(vorbItems.filter((i) => istAn($vorbereitung.checked[i.id])).length)
  const geschriebenGesamt = $derived(new Set($journal.filter((j) => s.start && j.datum >= s.start && j.datum <= s.ende).map((j) => j.datum)).size)
  const routenJetzt = $derived(s.etappe ? routenDerEtappe($reisen, s.etappe.reise.id) : [])
</script>

<section class="ht" aria-label={t('Heute')}>
  {#if s.phase === 'leer'}
    <div class="ht-karte">
      <p class="ht-gross">{t('Willkommen.')}</p>
      <p>{t('Leg im Plan die erste Etappe deiner Reise an oder lade deinen Reisekalender (Mehr → Import). Danach steht hier jeden Tag, was ansteht.')}</p>
      <button class="btn-primary" onclick={() => geh('plan')}>{t('Zum Plan')}</button>
    </div>
  {:else if s.phase === 'vorher'}
    <div class="ht-karte ht-vorher">
      <p class="ht-zahl"><b use:zaehlHoch={{ wert: s.nochTage, dauer: 700 }}></b> {tn(s.nochTage, 'Tag bis zur Abreise', 'Tage bis zur Abreise')}</p>
      <p class="ht-k">{tn(eintraege.length, '{von} bis {bis}, {tage} in {n} Etappe', '{von} bis {bis}, {tage} in {n} Etappen', { von: tagMonatJahr(s.start), bis: tagMonatJahr(s.ende), tage: tageText(s.tage) })}</p>
      {#if naechste.length}
        <h2 class="ht-h">{t('Als Nächstes')}</h2>
        <ul class="ht-liste">
          {#each naechste as b (b.id)}
            <li><span class="ht-tag">{mitWochentag(b.datum)}</span><span class="ht-i" aria-hidden="true">{b.emoji || katInfo(b.kat).icon}</span><span class="ht-t">{b.titel}</span></li>
          {/each}
        </ul>
      {/if}
      <button class="ht-vorb" onclick={() => geh('mehr/vorbereitung')}>
        <span class="ht-vorb-txt"><b>{t('Reisevorbereitung')}</b><small>{t('{vorbFertig} von {length} erledigt', { vorbFertig, length: vorbItems.length })}</small></span>
        <span class="ht-balken" aria-hidden="true"><span style="--anteil:{vorbItems.length ? vorbFertig / vorbItems.length : 0}"></span></span>
        <span class="ht-pfeil" aria-hidden="true">›</span>
      </button>
    </div>
  {:else if s.phase === 'unterwegs'}
    <div class="ht-karte ht-unterwegs" style="--farbe:{s.etappe?.reise.farbe || 'var(--brand)'}">
      <p class="ht-zahl"><b>{t('Tag {tagNr}', { tagNr: s.tagNr })}</b> {t('von {tage}', { tage: s.tage })}</p>
      {#if s.etappe}
        <button class="ht-etappe" onclick={() => geh('plan/etappe/' + s.etappe.reise.id)}>
          <span class="ht-band" aria-hidden="true"></span>
          <span><b>{s.etappe.reise.name}</b><small>{t('Tag {tagInEtappe} von {tage} · {bereich}', { tagInEtappe: s.tagInEtappe, tage: s.etappe.tage, bereich: bereich(s.etappe.von, s.etappe.bis) })}{#if routenJetzt.length}&nbsp;· {routenJetzt.map((r) => r.name).join(', ')}{/if}</small></span>
          <span class="ht-pfeil" aria-hidden="true">›</span>
        </button>
      {/if}
      <FahrtHeute reisen={$reisen} {heute} {geh} />
      <button class="btn-primary ht-schreiben" onclick={() => { if (!heuteGeschrieben) neuerJournalEintrag({ datum: heute }); ontag(heute) }}>{heuteGeschrieben ? t('Heutigen Logbuch-Eintrag öffnen') : t('Heute ins Logbuch schreiben')}</button>
      {#each [[heute, t('Heute')], [morgen, t('Morgen')]] as [d, titel]}
        {@const b = am(d)}
        {@const w = wandAm(d)}
        {#if b.length || w.length}
          <h2 class="ht-h">{titel}</h2>
          <ul class="ht-liste">
            {#each b as x (x.id)}<li><span class="ht-i" aria-hidden="true">{x.emoji || katInfo(x.kat).icon}</span><span class="ht-t">{x.titel}{#if x.sub}<small>{x.sub}</small>{/if}</span></li>{/each}
            {#each w as x (x.id)}<li><span class="ht-i" aria-hidden="true">{STATUS_MAP[x.status]?.emoji || '🥾'}</span><span class="ht-t">{x.name}{#if x.zeit}<small>{t('{zeit} Uhr', { zeit: x.zeit })}</small>{/if}</span></li>{/each}
          </ul>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="ht-karte">
      <p class="ht-zahl"><b>{t('Wieder da.')}</b></p>
      <p class="ht-k">{t('{tageText} unterwegs, {geschriebenGesamt} davon im Logbuch.', { tageText: tageText(s.tage), geschriebenGesamt })}</p>
      <button class="btn-primary" onclick={() => geh('logbuch/lesen')}>{t('Tagebuch ansehen und exportieren')}</button>
    </div>
  {/if}

  {#if warnAnzahl}
    <button class="ht-warn" onclick={() => geh('mehr/gefahren')}>
      <span aria-hidden="true">⚠️</span><span><b>{tn(warnAnzahl, '{n} amtliche Warnung', '{n} amtliche Warnungen')}</b> {t('in der Nähe deiner Orte')}</span><span class="ht-pfeil" aria-hidden="true">›</span>
    </button>
  {/if}
  {#if sperrAnzahl}
    <button class="ht-warn" onclick={() => geh('mehr/gefahren')}>
      <span aria-hidden="true">⛔</span><span><b>{tn(sperrAnzahl, '{n} Straßensperrung', '{n} Straßensperrungen')}</b> {sperrRoute ? t('auf deinen Routen oder in der Nähe') : t('in der Nähe deiner Orte')}</span><span class="ht-pfeil" aria-hidden="true">›</span>
    </button>
  {/if}
</section>

<style>
  .ht { display: flex; flex-direction: column; gap: 12px; }
  .ht-karte { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 18px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .ht-karte p { margin: 0; }
  .ht-gross { font-size: calc(22px * var(--schrift, 1)); font-weight: 800; }
  .ht-zahl { font-size: calc(18px * var(--schrift, 1)); color: var(--muted); }
  .ht-zahl b { font-family: 'Anton', Impact, sans-serif; font-weight: 400; font-size: calc(44px * var(--schrift, 1)); line-height: 1; color: var(--ink); margin-right: 6px; letter-spacing: 0.5px; }
  .ht-k { font-size: calc(14.5px * var(--schrift, 1)); color: var(--muted); }
  .ht-h { margin: 6px 0 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); font-weight: 700; }
  .ht-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ht-liste li { display: flex; align-items: flex-start; gap: 10px; font-size: calc(15px * var(--schrift, 1)); }
  .ht-tag { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); width: 84px; flex: none; font-variant-numeric: tabular-nums; padding-top: 1px; }
  .ht-i { width: 22px; text-align: center; flex: none; }
  .ht-t { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
  .ht-t small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ht-vorb, .ht-etappe, .ht-warn {
    display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer; color: var(--ink);
    background: var(--flaeche); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 10px 12px; min-height: 56px;
  }
  .ht-vorb-txt { display: flex; flex-direction: column; flex: 0 0 auto; }
  .ht-vorb-txt small, .ht-etappe small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ht-balken { flex: 1; height: 8px; border-radius: 4px; background: var(--flaeche-2); overflow: hidden; }
  .ht-balken span { display: block; height: 100%; background: var(--ok); transform-origin: left; transform: scaleX(var(--anteil)); animation: balken-ein 800ms var(--ease-out) 200ms backwards; transition: transform var(--t-slow) var(--ease-spring); }
  @keyframes balken-ein { from { transform: scaleX(0); } }
  .ht-karte { animation: rein-unten var(--t-slow) var(--ease-out) backwards; }
  .ht-warn { animation: rein-unten var(--t-slow) var(--ease-out) 120ms backwards; }
  .ht-pfeil { margin-left: auto; font-size: calc(22px * var(--schrift, 1)); color: var(--muted); }
  .ht-etappe > span:nth-child(2) { display: flex; flex-direction: column; min-width: 0; }
  .ht-band { width: 6px; align-self: stretch; border-radius: 3px; background: var(--farbe); flex: none; }
  .ht-schreiben { width: 100%; }
  .ht-warn { background: var(--danger-flaeche); border-color: var(--danger-linie); }
</style>
