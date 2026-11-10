<script>
  import { t, tn } from './i18n.js'
  import { heuteTag } from './heute.js'
  // Heute: was jetzt wichtig ist. Vor der Reise: wie lange noch, was ansteht, was
  // noch zu erledigen ist. Unterwegs: welcher Tag, welche Etappe, was heute und morgen
  // gebucht ist, und der Knopf, um den Tag ins Logbuch zu schreiben.
  import { reisen, gesamtStart, buchungen, wanderungen, journal, vorbereitung, istAn, neuerJournalEintrag } from './userdata.js'
  import { etappenMitDatum, reiseStatus, plusTage, ymd, routenDerEtappe, tageZwischen, eintragTage, deckt } from './plan.js'
  import { mitWochentag, tagMonatJahr, tageText, bereich, zahl } from './format.js'
  import { katInfo } from './reisekalender.js'
  import { STATUS_MAP } from './wanderungen-daten.js'
  import { zaehlHoch, klapp, dauer } from './motion.js'
  import { VORBEREITUNG } from './vorbereitung-daten.js'

  import FahrtHeute from './FahrtHeute.svelte'
  import FlugKarte from './FlugKarte.svelte'
  import WarnLage from './WarnLage.svelte'
  import FotoLage from './FotoLage.svelte'
  import FunFactKarte from './FunFactKarte.svelte'
  import { fluege, flugspeicher, uhr } from './flug-dienst.js'
  import { flugImFokus, umstiege, dringendeMeldungen } from './flug.js'
  import { je } from './i18n.js'
  import BuchungZusatz from './BuchungZusatz.svelte'
  import SchnellAusgabe from './SchnellAusgabe.svelte'
  import ErsteSchritte from './ErsteSchritte.svelte'
  import { etappeJetzt, wechselZeit, uhrzeitIn } from './buchung.js'
  import { ausgabenVon } from './kosten.js'
  import { stelleAm } from './abschnitte.js'
  import { gruppen } from './verbinden.js'
  import { meldungen, inGegend, gegendVon, aufDemWeg, vonSelbstOffen, zugeklappt, merkeZugeklappt, zuklappenMit } from './meldungen.js'
  import { meldenBlatt, gegendName } from './meldungen-text.js'
  import MeldungZeile from './MeldungZeile.svelte'
  import { standort, standortFrisch } from './standort.js'
  import { heutigeFahrt } from './fahrtag.js'
  import { notfallKontakte } from './userdata.js'
  import { schnellBescheid } from './bescheid-aktion.js'
  let { orte = [], warnAnzahl = 0, sperrAnzahl = 0, sperrRoute = 0, onneu = () => {}, ontag = () => {}, geh = () => {} } = $props()

  const heute = $derived($heuteTag)
  const morgen = $derived(plusTage(heute, 1))
  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const s = $derived(reiseStatus(eintraege, heute))
  const termine = $derived(($buchungen?.events || []).filter((b) => !b.platzhalter))
  const am = (d) => termine.filter((b) => b.datum === d)
  const naechste = $derived(termine.filter((b) => b.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 3))
  // Ohne Standort gilt der erste Stopp der laufenden oder nächsten Etappe
  const fotoOrt = $derived.by(() => {
    const st = (s.etappe?.reise || eintraege.find((e) => e.bis >= heute)?.reise)?.stops?.find((x) => x.lat != null)
    return st ? { lat: st.lat, lon: st.lon, name: st.name } : null
  })
  // Fun Facts ohne Standort: erster Stopp mit Koordinaten in den Routen der heutigen Etappe, sonst wie das Foto
  const faktOrt = $derived.by(() => {
    for (const r of routenJetzt) { const st = (r.stops || []).find((x) => x?.lat != null); if (st) return { lat: st.lat, lon: st.lon, name: st.name } }
    return fotoOrt
  })
  // V32: Meldungen auf Heute: auf der heutigen Fahrt, sonst in der Gegend (Standort in Australien, sonst Ort der Etappe)
  const fahrtHeute = $derived(heutigeFahrt({ reisen: $reisen, gesamtStart: $gesamtStart, heute, journal: $journal }))
  // V34: am Tagesziel angekommen (bis 3 km, frischer Standort) und jemand angelegt: kurz Bescheid geben anbieten
  const ANKUNFT_KEY = 'tb-bescheid-ankunft'
  let ankunftErledigt = $state((() => { try { return localStorage.getItem(ANKUNFT_KEY) } catch { return null } })())
  const ankunft = $derived.by(() => {
    const z = fahrtHeute?.fahrt?.ziel
    if (!z || !$notfallKontakte.length || ankunftErledigt === heute || !standortFrisch($standort)) return null
    const r = Math.PI / 180, a = Math.sin(((z.lat - $standort.lat) * r) / 2) ** 2 + Math.cos($standort.lat * r) * Math.cos(z.lat * r) * Math.sin(((z.lon - $standort.lon) * r) / 2) ** 2
    return 12742 * Math.asin(Math.sqrt(a)) <= 3 ? { nach: fahrtHeute.fahrt.nach || '' } : null
  })
  function ankunftWeg(senden) {
    ankunftErledigt = heute
    try { localStorage.setItem(ANKUNFT_KEY, heute) } catch {}
    if (senden) schnellBescheid('ok', { orte })
  }
  // Der Abschnitt ist eine Zeile und öffnet sich von selbst, wenn wirklich etwas auf dem Weg liegt.
  // Wer ihn zuklappt, dem bleibt er zu, bis eine neue Meldung auf dem Weg dazukommt.
  const weg = $derived(aufDemWeg({ reise: fahrtHeute?.reise || null, standort: !fahrtHeute?.reise && standortFrisch($standort) ? $standort : null, alle: $meldungen.liste }))
  let zuIds = $state(zugeklappt())
  let mitAuf = $state(null)   // null: von selbst; true: selbst aufgemacht
  const mitOffen = $derived(mitAuf ?? vonSelbstOffen(weg.liste, zuIds))
  function mitUmschalten() {
    if (mitOffen) { zuIds = zuklappenMit(zuIds, weg.liste.map((m) => m.id)); merkeZugeklappt(zuIds); mitAuf = null }
    else mitAuf = true
  }
  const nWeg = $derived(weg.liste.length)
  const nAlle = $derived($meldungen.liste.length)
  const mKontext = $derived.by(() => {
    const alle = $meldungen.liste
    if (fahrtHeute?.reise) return { titel: je('Auf deiner Fahrt heute', 'On your drive today'), leer: je('Keine Meldungen auf deiner Fahrt heute.', 'No reports on your drive today.'), liste: weg.mitBlassen }
    // Ohne Fahrt: was bis 25 km um dich liegt, sonst die ganze Gegend
    if (weg.liste.length) return { titel: je('In deiner Nähe', 'Near you'), leer: '', liste: weg.liste }
    const hier = standortFrisch($standort) && gegendVon($standort.lat, $standort.lon) !== 'australien' ? $standort : faktOrt
    const g = hier?.lat != null ? gegendVon(hier.lat, hier.lon) : 'australien'
    if (g === 'australien') return { titel: '', leer: '', liste: [] }
    return { titel: je(`In der Gegend: ${gegendName(g)}`, `In the area: ${gegendName(g)}`), leer: je(`Gerade keine Meldungen in der Gegend ${gegendName(g)}.`, `No reports in ${gegendName(g)} right now.`), liste: inGegend(g, alle) }
  })
  const fremd = $derived(($gruppen.telegram && !$gruppen.telegramEigen) || ($gruppen.discord && !$gruppen.discordEigen))
  const eigen = $derived(($gruppen.telegram && $gruppen.telegramEigen) || ($gruppen.discord && $gruppen.discordEigen))
  const wandAm = (d) => $wanderungen.filter((w) => w.datum === d)
  const heuteGeschrieben = $derived($journal.some((j) => deckt(j, heute)))
  const vorbItems = $derived([...VORBEREITUNG.flatMap((g) => g.items), ...($vorbereitung.custom || [])])
  const vorbFertig = $derived(vorbItems.filter((i) => istAn($vorbereitung.checked[i.id])).length)
  const geschriebenGesamt = $derived(new Set($journal.flatMap(eintragTage).filter((d) => s.start && d >= s.start && d <= s.ende)).size)
  const routenJetzt = $derived(s.etappe ? routenDerEtappe($reisen, s.etappe.reise.id) : [])
  const flugJetzt = $derived(flugImFokus($fluege.alle, $flugspeicher.staende, $uhr))
  const dringend = $derived(dringendeMeldungen($fluege.alle, $flugspeicher.staende, $uhr))
  // V14: Am Wechseltag gilt bis zur Wechselzeit (Abflug, Abfahrt oder selbst gesetzt) noch die alte Etappe
  const uhrJetzt = $derived.by(() => { const d = new Date($uhr); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })
  const etappeNun = $derived(s.phase === 'unterwegs' ? (etappeJetzt(eintraege, heute, uhrJetzt, termine) || s.etappe) : s.etappe)
  // V16: der Abschnitt, in dem du heute bist (Etappe › Abschnitt · Tag x von y)
  const stelleNun = $derived(etappeNun ? stelleAm($reisen, etappeNun.reise.id, heute) : null)
  const tagInEtappeNun = $derived(etappeNun ? tageZwischen(etappeNun.von, heute) + 1 : 0)
  const wechselHeute = $derived.by(() => {
    const neu = eintraege.find((e) => e.von === heute && eintraege.some((x) => x !== e && x.bis === heute))
    if (!neu) return null
    const w = wechselZeit(neu.reise, heute, termine)
    return { etappe: neu, zeit: w?.zeit || '', quelle: w?.quelle || '' }
  })
  const zeitVon = (x) => x.zeit || uhrzeitIn(x.sub)
  const amSortiert = (d) => am(d).sort((a, b) => (zeitVon(a) || '99').localeCompare(zeitVon(b) || '99'))
  // Abendfrage: ab 18 Uhr, wenn heute noch nichts ausgegeben wurde. „Nichts“ gilt für den Tag.
  const ABEND_KEY = 'tb-abendfrage'
  let abendWeg = $state((() => { try { return localStorage.getItem(ABEND_KEY) || '' } catch { return '' } })())
  const heuteAusgaben = $derived($journal.filter((j) => deckt(j, heute)).flatMap((j) => ausgabenVon(j)).length)
  const abendfrage = $derived(s.phase === 'unterwegs' && new Date($uhr).getHours() >= 18 && !heuteAusgaben && abendWeg !== heute)
  function nichtsAusgegeben() { abendWeg = heute; try { localStorage.setItem(ABEND_KEY, heute) } catch {} }
  let betragFeld = $state()
  const umstiegJetzt = $derived(flugJetzt ? umstiege($fluege.fluege, $flugspeicher.staende).find((u) => u.nachFlug === flugJetzt.id) : null)
</script>

<section class="ht" aria-label={t('Heute')}>
  {#each dringend as m (m.flug.id)}
    <a class="ht-warn ht-dringend" class:stark={m.stark} href="#/mehr/fluege">
      <span aria-hidden="true">{m.flug.art === 'bahn' ? '🚆' : '✈️'}</span><span><b>{m.flug.art === 'bahn' ? je('Zug', 'Train') : je('Flug', 'Flight')} {m.flug.nr}</b> {m.text}</span>
    </a>
  {/each}
  <ErsteSchritte {geh} />
  <WarnLage {geh} />
  {#if flugJetzt}
    <a class="ht-flug" href="#/mehr/fluege">
      <FlugKarte flug={flugJetzt} stand={$flugspeicher.staende[flugJetzt.id]} staende={$flugspeicher.staende} jetzt={$uhr} umstieg={umstiegJetzt} kurz />
    </a>
  {/if}
  {#if s.phase === 'leer'}
    <div class="ht-karte">
      <p class="ht-gross">{t('Willkommen.')}</p>
      <p>{je('Leg im Plan die erste Etappe deiner Reise an oder lade deinen Reisekalender (Mehr → Backup & Import). Danach steht hier jeden Tag, was ansteht.', 'Add the first leg of your trip in Plan or load your travel calendar (More → Backup & import). After that, this page shows what’s on each day.')}</p>
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
      {#if etappeNun}
        <button class="ht-etappe" style="--farbe:{etappeNun.reise.farbe || 'var(--brand)'}" onclick={() => geh('plan/etappe/' + etappeNun.reise.id)}>
          <span class="ht-band" aria-hidden="true"></span>
          <span><b>{etappeNun.reise.name}</b><small>{t('Tag {tagInEtappe} von {tage} · {bereich}', { tagInEtappe: tagInEtappeNun, tage: etappeNun.tage, bereich: bereich(etappeNun.von, etappeNun.bis) })}{#if stelleNun}{' · '}{stelleNun.abschnitt.name}, {je(`Tag ${stelleNun.tag} von ${stelleNun.tage}`, `day ${stelleNun.tag} of ${stelleNun.tage}`)}{:else if routenJetzt.length && etappeNun === s.etappe}&nbsp;· {routenJetzt.map((r) => r.name).join(', ')}{/if}</small></span>
          <span class="ht-pfeil" aria-hidden="true">›</span>
        </button>
      {/if}
      {#if wechselHeute}
        <p class="ht-wechsel">🔀 {wechselHeute.zeit
          ? je(`Heute Wechsel um ${wechselHeute.zeit} nach „${wechselHeute.etappe.reise.name}“`, `Change today at ${wechselHeute.zeit} to “${wechselHeute.etappe.reise.name}”`)
          : je(`Heute Wechsel nach „${wechselHeute.etappe.reise.name}“`, `Change today to “${wechselHeute.etappe.reise.name}”`)}{#if wechselHeute.quelle}<small> · {wechselHeute.quelle}</small>{/if}</p>
      {/if}
      <FahrtHeute reisen={$reisen} {heute} {geh} />
      {#if ankunft}
        <div class="ht-ankunft">
          <button class="ht-ankunft-knopf" onclick={() => ankunftWeg(true)}>🏁 {ankunft.nach ? je(`Angekommen in ${ankunft.nach}? Kurz Bescheid geben`, `Arrived in ${ankunft.nach}? Let them know`) : je('Angekommen? Kurz Bescheid geben', 'Arrived? Let them know')}</button>
          <button class="ht-ankunft-weg" onclick={() => ankunftWeg(false)} aria-label={je('Heute nicht mehr zeigen', 'Do not show again today')}>✕</button>
        </div>
      {/if}
      <button class="btn-primary ht-schreiben" onclick={() => { if (!heuteGeschrieben) neuerJournalEintrag({ datum: heute }); ontag(heute) }}>{heuteGeschrieben ? t('Heutigen Logbuch-Eintrag öffnen') : t('Heute ins Logbuch schreiben')}</button>
      {#each [[heute, t('Heute')], [morgen, t('Morgen')]] as [d, titel]}
        {@const b = amSortiert(d)}
        {@const w = wandAm(d)}
        {#if b.length || w.length}
          <h2 class="ht-h">{titel}</h2>
          <ul class="ht-liste">
            {#each b as x (x.id)}<li class="ht-buchung"><span class="ht-i" aria-hidden="true">{x.emoji || katInfo(x.kat).icon}</span><span class="ht-t">{#if zeitVon(x)}<span class="ht-zeit">{zeitVon(x)}</span>{/if}<b>{x.titel}</b>{#if x.sub}<small>{x.sub}</small>{/if}<BuchungZusatz termin={x} /></span></li>{/each}
            {#each w as x (x.id)}<li><span class="ht-i" aria-hidden="true">{STATUS_MAP[x.status]?.emoji || '🥾'}</span><span class="ht-t">{x.name}{#if x.zeit}<small>{t('{zeit} Uhr', { zeit: x.zeit })}</small>{/if}</span></li>{/each}
          </ul>
        {/if}
      {/each}
    </div>
    {#if abendfrage}
      <div class="ht-karte ht-abend" role="status">
        <p><b>{je('Heute schon etwas ausgegeben?', 'Spent anything today?')}</b></p>
        <div class="ht-abend-k">
          <button class="btn-primary" onclick={() => betragFeld?.focus()}>{je('Ja, eintragen', 'Yes, add it')}</button>
          <button class="btn btn-ghost" onclick={nichtsAusgegeben}>{je('Nein, nichts', 'No, nothing')}</button>
        </div>
      </div>
    {/if}
    <SchnellAusgabe datum={heute} etappeId={etappeNun?.reise.id || null} {ontag} bind:betragFeld />
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
  <!-- V32: Mit anderen Reisenden als Klapp-Zeile. Offen von selbst nur, wenn etwas auf dem Weg liegt. Innen oben
       Meldungen auf der heutigen Route oder in der Gegend, dann Melden, darunter die TravelBuddy-Gruppe.
       Inhalte aus Telegram erscheinen nie hier, nur der Weg dorthin. -->
  <section class="ht-mit" aria-labelledby="ht-mit-t">
    <button class="ht-mit-kopf" aria-expanded={mitOffen} aria-controls="ht-mit-inhalt" onclick={mitUmschalten}>
      <span class="ht-i" aria-hidden="true">👥</span>
      <span class="ht-t ht-mit-txt">
        <b class="ht-mit-t" id="ht-mit-t">{je('Mit anderen Reisenden', 'With other travellers')}</b>
        {#if !mitOffen && nWeg}
          <small class="ht-mit-weg">{weg.art === 'strecke' ? je(`${nWeg} ${nWeg === 1 ? 'Meldung' : 'Meldungen'} auf deiner Strecke`, `${nWeg} ${nWeg === 1 ? 'report' : 'reports'} on your route`) : je(`${nWeg} ${nWeg === 1 ? 'Meldung' : 'Meldungen'} in deiner Nähe`, `${nWeg} ${nWeg === 1 ? 'report' : 'reports'} near you`)}</small>
        {:else if !mitOffen}
          <small>{nAlle ? (nAlle === 1 ? je('1 Meldung, nichts auf deinem Weg', '1 report, nothing on your way') : je(`${nAlle} Meldungen, nichts auf deinem Weg`, `${nAlle} reports, nothing on your way`)) : je('Melden, Meldungen, Gruppe', 'Report, reports, group')}</small>
        {/if}
      </span>
      <span class="aufklapp klein" class:offen={mitOffen} aria-hidden="true"></span>
    </button>
    {#if mitOffen}
    <div class="ht-mit-inhalt" id="ht-mit-inhalt" transition:klapp={{ duration: dauer(200) }}>
    {#if mKontext.liste.length}
      <div class="ht-meld">
        <p class="ht-meld-t">{mKontext.titel}</p>
        {#each mKontext.liste.slice(0, 3) as m (m.id)}<MeldungZeile {m} km={m.km ?? null} ort={m.km == null} />{/each}
      </div>
    {:else if mKontext.titel}
      <p class="ht-extern-h">{mKontext.leer}</p>
    {/if}
    <div class="ht-mit-knoepfe">
      <button class="btn" onclick={() => meldenBlatt.set(standortFrisch($standort) ? { lat: $standort.lat, lon: $standort.lon } : {})}>📣 {je('Hier etwas melden', 'Report something here')}</button>
      <button class="btn" onclick={() => geh('mehr/meldungen')}>{je('Alle Meldungen', 'All reports')}{$meldungen.liste.length ? ` (${$meldungen.liste.length})` : ''}</button>
    </div>
    {#if $gruppen.telegram}<a class="ht-ext" href={$gruppen.telegram} target="_blank" rel="noopener noreferrer"><span class="ht-i" aria-hidden="true">👥</span><span class="ht-t"><b>{$gruppen.telegramEigen ? je('TravelBuddy-Gruppe auf Telegram', 'TravelBuddy group on Telegram') : je('Gruppe auf Telegram', 'Group on Telegram')}</b><small>{je('Gespräch, Fragen, Fotos', 'Chat, questions, photos')}</small></span><span class="ht-pfeil" aria-hidden="true">↗</span></a>{/if}
    {#if $gruppen.discord}<a class="ht-ext" href={$gruppen.discord} target="_blank" rel="noopener noreferrer"><span class="ht-i" aria-hidden="true">👥</span><span class="ht-t"><b>{$gruppen.discordEigen ? je('TravelBuddy-Server auf Discord', 'TravelBuddy server on Discord') : je('Server auf Discord', 'Server on Discord')}</b><small>{je('Kanäle je Gegend, auch im Browser', 'channels per area, also in the browser')}</small></span><span class="ht-pfeil" aria-hidden="true">↗</span></a>{/if}
    {#if $gruppen.telegram || $gruppen.discord}
      <p class="ht-extern-h">
        {#if eigen}{je('Öffnet Telegram. Betreut von TravelBuddy, Beiträge sind Meinungen von Reisenden, keine amtlichen Informationen.', 'Opens Telegram. Run by TravelBuddy, posts are opinions of travellers, not official information.')}{/if}
        {#if fremd}{je('Externe Gruppen sind nicht von TravelBuddy betrieben, ihre Inhalte prüfen wir nicht.', 'External groups are not run by TravelBuddy, we do not check their content.')}{/if}
      </p>
    {/if}
    </div>
    {/if}
  </section>
  <FotoLage ersatz={fotoOrt} />
  <FunFactKarte ersatz={faktOrt} {orte} {geh} />
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
  .ht-wechsel { font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .ht-wechsel small { font-weight: 400; color: var(--muted); }
  .ht-zeit { font-size: calc(13px * var(--schrift, 1)); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--muted); }
  .ht-abend { flex-direction: column; gap: 8px; border-color: var(--brand); }
  .ht-abend-k { display: flex; gap: 8px; flex-wrap: wrap; }
  .ht-dringend { color: inherit; text-decoration: none; }
  .ht-dringend:not(.stark) { background: var(--warn-flaeche); border-color: var(--warn-linie, var(--line)); }
  .ht-warn { background: var(--danger-flaeche); border-color: var(--danger-linie); }
  .ht-ankunft { display: flex; align-items: stretch; gap: 6px; }
  .ht-ankunft-knopf { flex: 1; min-height: 48px; padding: 8px 12px; border: 1px solid var(--ok-linie, var(--line-stark)); border-radius: var(--radius-m); background: var(--ok-flaeche); color: var(--ok-text); font: inherit; font-weight: 800; text-align: left; cursor: pointer; }
  .ht-ankunft-weg { width: 48px; min-height: 48px; border: 1px solid var(--line); border-radius: var(--radius-m); background: none; color: var(--muted); font: inherit; cursor: pointer; }
  .ht-mit { display: flex; flex-direction: column; margin-top: 4px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--card); overflow: hidden; }
  .ht-mit-kopf { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 8px 12px; border: none; background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
  .ht-mit-txt { flex: 1; }
  .ht-mit-t { font-size: calc(15px * var(--schrift, 1)); font-weight: 700; }
  .ht-mit-txt .ht-mit-weg { color: var(--warn-text); font-weight: 700; }
  .ht-mit-inhalt { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; }
  .ht-meld { border-top: 1px solid var(--line); padding: 2px 0 0; }
  .ht-meld-t { margin: 6px 0 2px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ht-mit-knoepfe { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .ht-mit-knoepfe .btn { min-height: 48px; }
  .ht-ext { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 12px; border: 1.5px dashed var(--line-stark); border-radius: var(--radius-m); color: var(--ink); text-decoration: none; }
  .ht-extern-h { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .ht-flug { display: block; color: inherit; text-decoration: none; animation: rein-unten var(--t-slow) var(--ease-out) backwards; }
</style>
