<script>
  import { oeffneNeu } from './neu.js'
  import InfoKnopf from './InfoKnopf.svelte'
  import { t, tn, je } from './i18n.js'
  // Eine Etappe: Name und Datum, Buchungen, Routen mit Stopps, Wanderungen, Logbuch.
  // Ist keine Etappe gewählt (Route ohne Etappe), zeigt sie nur diese Route.
  import { reisen, gesamtStart, buchungen, wanderungen, journal, updateReise, loescheReise, neueRoute, wandleReiseUm, vorabKosten } from './userdata.js'
  import { etappenMitDatum, routenDerEtappe, reiseweg, VERKEHR, tageZwischen, gueltigesDatum, ymd, offenerZeitraum, eintragTage, plusTage } from './plan.js'
  import { lage } from './warnlage-dienst.js'
  import WarnKnoepfe from './WarnKnoepfe.svelte'
  import { bereich, tageText, mitWochentag, zahl, eur, aud } from './format.js'
  import { katInfo } from './reisekalender.js'
  import { STATUS_MAP, S_MAP } from './wanderungen-daten.js'
  import { frage, loeschFrage } from './dialog.js'
  import { etappenSummen } from './kosten.js'
  import { fxKurse } from './fx.js'
  import AenderungsLeiste from './AenderungsLeiste.svelte'
  import { setzeWaechter } from './navigation.js'
  import GeoVorschlaege from './GeoVorschlaege.svelte'
  import { zeigeToast } from './toast.js'
  import { haptic } from './haptik.js'
  import Stepper from './Stepper.svelte'
  import RouteEditor from './RouteEditor.svelte'
  import Versorgung from './Versorgung.svelte'
  import BuchungZusatz from './BuchungZusatz.svelte'
  import { wechselZeit } from './buchung.js'
  import AbschnittPlan from './AbschnittPlan.svelte'
  import { abschnitteDerEtappe, bereichVon } from './abschnitte.js'
  import { naechteUebersicht } from './naechte.js'
  import { hinweise } from './routen-dienst.js'
  import { dauer, klapp, istMorph, morphName } from './motion.js'

  let { etappeId = null, routeId = null, orte = [], warnungen = [], umkreisKm = 150,
    onzurueck = () => {}, onneu = () => {}, onlogbuch = () => {}, onwanderung = () => {} } = $props()

  // V14: Beginnt die Etappe an dem Tag, an dem die vorige endet, ist das ein Wechseltag mit Uhrzeit
  const wechsel = $derived.by(() => {
    if (!eintrag) return null
    const alle = etappenMitDatum($reisen, $gesamtStart)
    const vorher = alle.find((x) => x.reise.id !== eintrag.reise.id && x.bis === eintrag.von && x.von < eintrag.von)
    if (!vorher) return null
    const w = wechselZeit({}, eintrag.von, $buchungen?.events || [])
    return { vorher, auto: w?.zeit || '', quelle: w?.quelle || '' }
  })
  const eintrag = $derived(etappenMitDatum($reisen, $gesamtStart).find((e) => e.reise.id === etappeId) || null)
  const etappe = $derived(eintrag?.reise || $reisen.find((r) => r.id === etappeId) || null)
  const einzelRoute = $derived(!etappeId && routeId ? $reisen.find((r) => r.id === routeId) : null)
  // V16: Routen in der Reihenfolge eingeplant (nach Datum), ohne Datum, Ideen
  const gruppen = $derived(etappe ? abschnitteDerEtappe($reisen, etappe.id) : { eingeplant: [], offen: einzelRoute ? [einzelRoute] : [], ideen: [] })
  const routen = $derived([...gruppen.eingeplant, ...gruppen.offen, ...gruppen.ideen])
  const kopfVor = (i) => (etappe && i === gruppen.eingeplant.length && gruppen.offen.length ? je('Ohne Datum', 'Without a date')
    : etappe && i === gruppen.eingeplant.length + gruppen.offen.length && gruppen.ideen.length ? je('Ideen, zählen nicht mit', 'Ideas, not counted') : '')
  const zeitText = (r) => { const b = bereichVon(r); return b ? (b.von === b.bis ? mitWochentag(b.von) : `${mitWochentag(b.von)} ${je('bis', 'to')} ${mitWochentag(b.bis)}`) + (r.zeit ? ` · ${r.zeit}` : '') : '' }
  const alleEtappen = $derived(etappenMitDatum($reisen, $gesamtStart))
  const kostenEtappe = $derived(etappe ? etappenSummen({ journal: $journal, vorab: $vorabKosten, kurse: $fxKurse, eintraege: alleEtappen, reisen: $reisen }).get(etappe.id) : null)

  // V16: Nächte dieser Etappe auf einen Blick
  const naechteHier = $derived.by(() => {
    if (!eintrag) return null
    const n = naechteUebersicht({ eintraege: alleEtappen, reisen: $reisen, events: $buchungen?.events || [] }).naechte.filter((x) => x.etappe?.id === eintrag.reise.id)
    const z = { gebucht: 0, geplant: 0, flug: 0, camper: 0, offen: 0 }
    for (const x of n) z[x.zustand]++
    return n.length ? z : null
  })
  // V16: vorgemerkte Orte, die an Routen dieser Etappe liegen
  const vorgemerktHier = $derived(routen.flatMap((r) => ($hinweise[r.id]?.vorschlaege || []).filter((v) => v.vorgemerkt).map((v) => ({ ...v, r }))))
  let offen = $state({})
  $effect(() => { if (routeId) offen[routeId] = true })
  // Kommt man über eine Route hierher (Link, Karte, Ort einplanen), steht sie gleich im Bild
  $effect(() => {
    if (!routeId || !etappeId) return
    const t = setTimeout(() => document.getElementById('route-' + routeId)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 260)
    return () => clearTimeout(t)
  })
  let farbeOffen = $state(false)
  let anreiseOffen = $state(false)

  const von = $derived(eintrag?.von), bis = $derived(eintrag?.bis)
  const imZeitraum = (d) => d && von && d >= von && d <= bis
  const gebucht = $derived(($buchungen?.events || []).filter((b) => !b.platzhalter && imZeitraum(b.datum)).sort((a, b) => a.datum.localeCompare(b.datum)))
  const ids = $derived(new Set([etappe?.id, ...routen.map((r) => r.id)].filter(Boolean)))
  const wand = $derived($wanderungen.filter((w) => (w.datum ? imZeitraum(w.datum) : ids.has(w.reiseId))))
  const geschrieben = $derived(new Set($journal.flatMap(eintragTage).filter(imZeitraum)).size)
  const vergangen = $derived(von && eintrag ? Math.max(0, Math.min(eintrag.tage, tageZwischen(von, ymd(new Date())) + 1)) : 0)

  function setVon(v) { if (gueltigesDatum(v)) updateReise(etappe.id, { von: v }) }
  function setTage(t) { updateReise(etappe.id, { tage: t }) }
  function setBis(v) {
    if (!gueltigesDatum(v) || !von) return
    const t = tageZwischen(von, v) + 1
    if (t >= 1) updateReise(etappe.id, { tage: t })
  }

  // Ungespeicherte Änderungen: Beim Verlassen fragen, auf jedem Weg. Tippen daneben bleibt hier.
  let aenderung = $state(null)
  $effect(() => {
    setzeWaechter(async () => {
      if (!aenderung?.geaendert) return true
      const a = await frage({ titel: je('Änderungen verwerfen?', 'Discard changes?'), text: je('Deine Änderungen sind noch nicht gespeichert.', 'Your changes are not saved yet.'), ja: je('Speichern', 'Save'), nein: je('Nicht speichern', "Don't save"), abbruch: null })
      if (a === null) return false
      if (a) aenderung.speichern(); else aenderung.verwerfen()
      return true
    })
    const schliessen = (e) => { if (aenderung?.geaendert) e.preventDefault() }
    addEventListener('beforeunload', schliessen)
    return () => { setzeWaechter(null); removeEventListener('beforeunload', schliessen) }
  })
  // Löschen und Umwandeln sind schon bestätigt, danach gibt es diese Seite nicht mehr
  function ohneFrage() { setzeWaechter(null); onzurueck() }

  // Nächster Abschnitt: beginnt dort, wo der letzte aufhört, mit eigenem Verkehrsmittel
  const weg = $derived(reiseweg(routen))
  const letzterOrt = $derived([...routen].reverse().find((r) => r.stops?.length)?.stops.at(-1))
  const WEITER = [['flug', '✈️', 'Flug', 'Flight'], ['bus', '🚌', 'Bus', 'Bus'], ['auto', '🚗', 'Auto', 'Car'], ['bahn', '🚆', 'Bahn', 'Train'], ['boot', '⛵', 'Schiff', 'Boat']]
  // Eine neue Route beginnt nach der letzten eingeplanten: Flug, Bus, Bahn und Schiff am selben Tag, sonst am Tag danach
  function naechsterTag() {
    const letzter = gruppen.eingeplant.at(-1)
    if (!letzter) return eintrag?.von || null
    const b = bereichVon(letzter)
    const tag = ['flug', 'bus', 'bahn', 'boot'].includes(letzter.art) ? b.bis : plusTage(b.bis, 1)
    return eintrag && tag > eintrag.bis ? eintrag.bis : tag
  }
  function abschnittDazu(art) {
    const s = letzterOrt
    const start = s ? { ...s, id: undefined } : null
    const id = neueRoute({ etappeId: etappe.id, name: s ? je(`Ab ${s.name}`, `From ${s.name}`) : t('Route {n}', { n: routen.length + 1 }), art, farbe: etappe.farbe, stops: start ? [start] : [], tage: 1, von: naechsterTag() })
    offen[id] = true
    haptic()
    setTimeout(() => document.getElementById('route-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  async function routeLoeschen(r) {
    if (await loeschFrage(t('Route „{name}“', { name: r.name }), t('{length} Stopps. Das lässt sich nicht rückgängig machen.', { length: (r.stops || []).length }))) {
      loescheReise(r.id); zeigeToast(t('Route „{name}“ gelöscht', { name: r.name }), 'info')
      if (einzelRoute) ohneFrage()
    }
  }
  async function etappeLoeschen() {
    const n = routen.length
    const zusatz = n ? tn(n, 'Die Route darin bleibt erhalten und steht danach unter „Routen ohne Etappe“.', 'Die {n} Routen darin bleiben erhalten und stehen danach unter „Routen ohne Etappe“.') : t('Das lässt sich nicht rückgängig machen.')
    // Nach dem Löschen ist `etappe` null, deshalb Name und ID vorher festhalten
    const { id, name } = etappe
    if (await loeschFrage(t('Etappe „{name}“', { name }), zusatz)) {
      loescheReise(id); zeigeToast(t('Etappe „{name}“ gelöscht', { name }), 'info'); ohneFrage()
    }
  }
  function zurRoute() {
    const { id, name } = etappe
    wandleReiseUm(id, 'route', null)
    zeigeToast(t('„{name}“ ist jetzt eine Route ohne Etappe', { name }), 'ok')
    ohneFrage()
  }
  const farben = ['#2f6b4f', '#1a7a8a', '#a8842b', '#7a3b1e', '#7a5c8e', '#c1662f', '#4a4038', '#a83c6e']
</script>

<div class="ed">
  <button class="ed-zurueck" onclick={onzurueck}><span aria-hidden="true">‹</span> {t('Plan')}</button>

  {#if etappe}
    <header class="ed-kopf" data-morph style:view-transition-name={istMorph(etappe.id) ? morphName : null} style="--farbe:{etappe.farbe || 'var(--brand)'}">
      <label class="ed-name-feld">
        <span class="sr">{t('Name der Etappe')}</span>
        <input class="ed-name" value={etappe.name} oninput={(e) => updateReise(etappe.id, { name: e.target.value })} />
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
      </label>
      <button class="ed-farbknopf" aria-expanded={farbeOffen} onclick={() => (farbeOffen = !farbeOffen)}>
        <span class="ed-farbpunkt" aria-hidden="true"></span>{t('Farbe')}
      </button>
    </header>
    {#if farbeOffen}
      <div class="ed-farben" role="radiogroup" aria-label={t('Farbe der Etappe')} transition:klapp={{ duration: dauer(180) }}>
        {#each farben as f}
          <button class="ed-farbe" class:an={etappe.farbe === f} style="background:{f}" role="radio" aria-checked={etappe.farbe === f} aria-label={t('Farbe {f}', { f })} onclick={() => { updateReise(etappe.id, { farbe: f }); farbeOffen = false }}></button>
        {/each}
      </div>
    {/if}

    {#each ($lage.proEtappe[etappe.id] || []) as w (w.id)}
      <section class="ed-block ed-warn">
        <p>{w.icon} <b>{w.level}</b>: {w.titel}</p>
        <p class="ed-k">{w.km === 0 ? t('Liegt im Warngebiet') : t('{km} km daneben', { km: Math.round(w.km) })}</p>
        <WarnKnoepfe {w} />
      </section>
    {/each}

    <GeoVorschlaege liste={[etappe, ...routen]} />
    <section class="ed-block ed-zeit">
      <div class="ed-felder">
        <label class="ed-f">{t('Von')}<input type="date" value={von} onchange={(e) => setVon(e.target.value)} /></label>
        <span class="ed-f">{t('Tage')}<Stepper value={eintrag?.tage ?? etappe.tage} min={1} max={120} label={t('Dauer in Tagen')} onchange={setTage} /></span>
        <label class="ed-f">{t('Bis')}<input type="date" value={bis} min={von} onchange={(e) => setBis(e.target.value)} /></label>
      </div>
      <p class="ed-k">{t('{mitWochentag} bis {mitWochentag2}, {tageText}', { mitWochentag: mitWochentag(von), mitWochentag2: mitWochentag(bis), tageText: tageText(eintrag?.tage ?? etappe.tage) })}{#if vergangen > 0 && vergangen < (eintrag?.tage ?? 0)}&nbsp;{t('· heute Tag {vergangen}', { vergangen })}{/if}</p>
      {#if wechsel}
        <div class="ed-wechsel">
          <label class="ed-f">{je(`Wechsel am ${mitWochentag(von)} um`, `Change on ${mitWochentag(von)} at`)}
            <input type="time" value={etappe.wechselUm || ''} placeholder={wechsel.auto || ''} onchange={(e) => updateReise(etappe.id, { wechselUm: e.target.value || null })} />
          </label>
          <p class="ed-k">{etappe.wechselUm
            ? je(`Bis ${etappe.wechselUm} gilt an diesem Tag noch „${wechsel.vorher.reise.name}“.`, `Until ${etappe.wechselUm} the day still counts as “${wechsel.vorher.reise.name}”.`)
            : wechsel.auto
              ? je(`Aus der Buchung: ${wechsel.auto} (${wechsel.quelle}). Bis dahin gilt noch „${wechsel.vorher.reise.name}“.`, `From the booking: ${wechsel.auto} (${wechsel.quelle}). Until then “${wechsel.vorher.reise.name}” applies.`)
              : je(`An diesem Tag endet „${wechsel.vorher.reise.name}“. Mit einer Uhrzeit weiß die App, ab wann die neue Etappe gilt.`, `“${wechsel.vorher.reise.name}” ends on this day. With a time the app knows when the new leg starts.`)}</p>
        </div>
      {/if}
      {#if vorgemerktHier.length}
        <button class="ed-naechte" onclick={() => { const v = vorgemerktHier[0]; offen[v.r.id] = true; setTimeout(() => document.getElementById('route-' + v.r.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }}>⭐ {vorgemerktHier.length === 1 ? je(`${vorgemerktHier[0].ort.name} liegt an „${vorgemerktHier[0].r.name}“`, `${vorgemerktHier[0].ort.name} is on “${vorgemerktHier[0].r.name}”`) : je(`${vorgemerktHier.length} vorgemerkte Orte liegen an deinen Routen`, `${vorgemerktHier.length} saved places are on your routes`)} ›</button>
      {/if}
      {#if naechteHier}
        <button class="ed-naechte" onclick={() => (location.hash = '#/plan/naechte')}>🌙 {je('Nächte', 'Nights')}: {[naechteHier.gebucht && je(`${naechteHier.gebucht} gebucht`, `${naechteHier.gebucht} booked`), naechteHier.geplant && je(`${naechteHier.geplant} geplant`, `${naechteHier.geplant} planned`), naechteHier.flug && je(`${naechteHier.flug} im Flug`, `${naechteHier.flug} on a flight`), naechteHier.camper && je(`${naechteHier.camper} im Camper ohne Platz`, `${naechteHier.camper} in the camper without a site`), naechteHier.offen && je(`${naechteHier.offen} offen`, `${naechteHier.offen} open`)].filter(Boolean).join(' · ')} ›</button>
      {/if}
      {#if kostenEtappe?.eur}<p class="ed-kosten">{je('Kosten bisher', 'Costs so far')} <b>{eur(kostenEtappe.eur)}</b> · {aud(kostenEtappe.aud)}</p>{/if}
      {#if etappe.quelle === 'reisekalender'}
        <p class="ed-k ed-quelle">{t('Kommt aus deinem Reisekalender. Ein neuer Import setzt Name und Datum wieder auf den Kalender. Deine Routen, Wanderungen und Logbuchtage bleiben dabei an der Etappe.')}</p>
      {/if}
    </section>

    {#if gebucht.length}
      <section class="ed-block">
        <h2 class="ed-h">{t('Gebucht')} <span class="ed-zahl">{gebucht.length}</span><InfoKnopf id="buchung" /></h2>
        <ul class="ed-buch">
          {#each gebucht as b (b.id)}
            <li><span class="ed-b-tag">{mitWochentag(b.datum)}</span><span class="ed-b-icon" aria-hidden="true">{b.emoji || katInfo(b.kat).icon}</span><span class="ed-b-txt"><b>{b.titel}</b>{#if b.sub}<small>{b.sub}</small>{/if}<BuchungZusatz termin={b} /></span></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if (etappe.stops || []).length}
      <section class="ed-block">
        <button class="ed-auf" aria-expanded={anreiseOffen} onclick={() => (anreiseOffen = !anreiseOffen)}>
          <span class="aufklapp klein" class:offen={anreiseOffen} aria-hidden="true"></span>
          <span class="ed-auf-txt"><b>{t('Anreise und Orte der Etappe')}</b><small>{(etappe.stops || []).map((s) => s.name).join(' → ')}{#if etappe.route?.km}&nbsp;· {etappe.route.flug ? '✈️' : '🛣️'} {zahl(etappe.route.km)} km{/if}</small></span>
        </button>
        {#if anreiseOffen}<div class="ed-innen" transition:klapp={{ duration: dauer(220) }}><RouteEditor r={etappe} {orte} reisen={$reisen} {warnungen} {umkreisKm} /><Versorgung r={etappe} {orte} /></div>{/if}
      </section>
    {/if}
  {/if}

  <section class="ed-block">
    {#if etappe}<h2 class="ed-h">{t('Routen')} <span class="ed-zahl">{routen.length}</span><InfoKnopf id="route" /></h2>{/if}
    {#if etappe && !routen.length}
      <p class="ed-k">{je('Eine Route ist ein Teil dieser Etappe mit eigenem Zeitraum: eine Fahrt mit Stopps oder ein Flug, Bus, Zug oder Schiff. Aus den Stopps und ihren Nächten rechnet die App km, Fahrtage, Tankstopps und die Fahrt des Tages.', 'A route is part of this leg with its own dates: a drive with stops, or a flight, bus, train or boat. From the stops and their nights the app works out km, driving days, fuel stops and the day’s drive.')}</p>
      <div class="ed-leer-knoepfe">
        <button class="btn" onclick={() => oeffneNeu('route', { etappeId: etappe.id })}>{je('+ Route anlegen', '+ Add route')}</button>
        <a class="btn btn-ghost" href="#/orte">{je('Orte einplanen', 'Plan in places')}</a>
      </div>
    {/if}
    {#if weg.length > 1}
      <p class="ed-weg-kette">{#each weg as w, i}{#if i}<span class="ed-weg-art" aria-label={w.art}> {VERKEHR[w.art] || '→'} </span>{/if}<span>{w.name}</span>{/each}</p>
    {/if}
    {#each routen as r, i (r.id)}
      {#if kopfVor(i)}<h3 class="ed-h3">{kopfVor(i)}</h3>{/if}
      <article class="ed-route" class:idee={r.idee} id="route-{r.id}" style="--farbe:{r.farbe || 'var(--brand)'}">
        <div class="ed-r-kopf">
          <button class="aufklapp" class:offen={offen[r.id]} aria-expanded={!!offen[r.id]} aria-label={t(offen[r.id] ? '{name} zuklappen' : '{name} aufklappen', { name: r.name })} onclick={() => (offen[r.id] = !offen[r.id])}></button>
          <input class="ed-r-name" value={r.name} aria-label={t('Name der Route')} oninput={(e) => updateReise(r.id, { name: e.target.value })} />
        </div>
        {#if zeitText(r)}<p class="ed-r-zeit">{VERKEHR[r.art] || '🚗'} {zeitText(r)}</p>{/if}
        <p class="ed-r-meta">{t('{length} Stopps', { length: (r.stops || []).length })}{#if r.route?.km}&nbsp;· {r.route.flug ? '✈️' : '🛣️'} {zahl(r.route.km)} km{/if}{#if (r.stops || []).length >= 2}&nbsp;· {r.stops[0].name} → {r.stops[r.stops.length - 1].name}{/if}</p>
        {#if offen[r.id]}
          <div class="ed-innen" transition:klapp={{ duration: dauer(240) }}>
            <AbschnittPlan {r} etappe={eintrag} {orte} />
            <RouteEditor {r} {orte} reisen={$reisen} {warnungen} {umkreisKm} />
            <Versorgung {r} {orte} />
            <div class="ed-r-fuss">
              <label class="ed-f ed-f-breit">{t('Gehört zur Etappe')}
                <select value={r.etappeId || ''} onchange={(e) => { updateReise(r.id, { etappeId: e.target.value || null, etappeVermutet: false }); if (einzelRoute && e.target.value) onzurueck() }}>
                  <option value="">{t('keine Etappe')}</option>
                  {#each alleEtappen as x (x.reise.id)}<option value={x.reise.id}>{x.reise.name} ({bereich(x.von, x.bis)})</option>{/each}
                </select>
              </label>
              {#if r.etappeVermutet}<p class="ed-k">{t('Diese Zuordnung hat die App beim Umstellen auf V4 geraten. Stimmt sie nicht, hier ändern.')}</p>{/if}
              <button class="btn ed-weg" onclick={() => routeLoeschen(r)}>{t('Route löschen')}</button>
            </div>
          </div>
        {/if}
      </article>
    {/each}
    {#if etappe}
      <div class="bedien-block ed-weiter">
        <span class="bedien-titel">{letzterOrt ? je(`Nächste Route ab ${letzterOrt.name}`, `Next route from ${letzterOrt.name}`) : je('Erste Route', 'First route')}</span>
        <div class="bedien-raster">
          {#each WEITER as [art, zeichen, de, en] (art)}
            <button class="bedien-knopf" onclick={() => abschnittDazu(art)}><span aria-hidden="true">{zeichen}</span> {je(de, en)}</button>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  {#if etappe}
    <section class="ed-block">
      <h2 class="ed-h">{t('Wanderungen')} <span class="ed-zahl">{wand.length}</span></h2>
      {#if wand.length}
        <ul class="ed-wand">
          {#each wand as w (w.id)}
            <li><button class="ed-w" onclick={() => onwanderung(w.id)}>
              <span aria-hidden="true">{STATUS_MAP[w.status]?.emoji || '🥾'}</span>
              <span class="ed-w-txt"><b>{w.name}</b><small>{w.datum ? mitWochentag(w.datum) + (w.zeit ? ', ' + w.zeit : '') : t('ohne Datum')}{#if w.km}&nbsp;· {w.km} km{/if}{#if S_MAP[w.schwierigkeit]}&nbsp;· {S_MAP[w.schwierigkeit].label}{/if}</small></span>
              <span class="ed-w-pfeil" aria-hidden="true">›</span>
            </button></li>
          {/each}
        </ul>
      {/if}
      <button class="btn ed-dazu" onclick={() => onneu('wanderung', { datum: von, reiseId: etappe.id })}>{t('+ Wanderung')}</button>
    </section>

    <section class="ed-block">
      <h2 class="ed-h">{t('Logbuch')}<InfoKnopf id="logbuch" /></h2>
      <p class="ed-k">{geschrieben ? t('{geschrieben} von {wert} Tagen geschrieben.', { geschrieben, wert: eintrag?.tage ?? etappe.tage }) : t('Noch kein Tag geschrieben.')}</p>
      <button class="btn ed-dazu" onclick={() => onlogbuch(etappe.id)}>{t('Im Logbuch ansehen')}</button>
      {#if eintrag}<button class="btn ed-dazu" onclick={() => onneu('tag', offenerZeitraum(eintrag, $journal, ymd(new Date())))}>{t('Mehrere Tage nachtragen')}</button>{/if}
    </section>

    <section class="ed-block ed-ende">
      <button class="btn" onclick={zurRoute}>{t('In Route umwandeln')}</button>
      <button class="btn ed-weg" onclick={etappeLoeschen}>{t('Etappe löschen')}</button>
    </section>
  {:else if !einzelRoute}
    <p class="ed-k">{t('Diese Etappe gibt es nicht mehr.')}</p>
  {/if}
</div>
{#key etappeId || routeId}<AenderungsLeiste etappeId={etappeId} routeId={etappeId ? null : routeId} bind:api={aenderung} />{/key}


<style>
  .ed { display: flex; flex-direction: column; gap: 16px; }
  .ed-weg-kette { margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); font-size: calc(14px * var(--schrift, 1)); font-weight: 700; line-height: 1.5; }
  .ed-weg-art { margin: 0 6px; font-weight: 400; }
  .ed-weiter { margin-top: 12px; }
  .ed-naechte { display: block; margin: 6px 0 0; padding: 0; border: none; background: none; color: var(--ink); font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; text-align: left; cursor: pointer; min-height: 36px; }
  .ed-wechsel { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  .ed-wechsel input { max-width: 160px; }
  .ed-kosten { margin: 6px 0 0; color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); }
  .ed-kosten b { color: var(--ink); }
  .ed-zurueck {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 12px 0 4px;
    border: none; background: none; color: var(--brand-text); font-size: calc(16px * var(--schrift, 1)); font-weight: 600; cursor: pointer;
  }
  .ed-zurueck span { font-size: calc(28px * var(--schrift, 1)); line-height: 1; margin-top: -3px; }
  .ed-kopf { display: flex; align-items: center; gap: 10px; border-left: 6px solid var(--farbe); padding-left: 12px; transition: border-color var(--t-med) var(--ease-out); }
  .ed-name-feld { position: relative; display: flex; align-items: center; flex: 1; min-width: 0; }
  /* Farbe ist Nebensache: ein kleiner Knopf statt acht großer Kreise über dem Datum */
  .ed-farbknopf { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px 0 8px; border: 1px solid var(--line); border-radius: 22px; background: var(--card); color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .ed-farbpunkt { width: 18px; height: 18px; border-radius: 50%; background: var(--farbe); box-shadow: 0 0 0 2px var(--card), 0 0 0 3px var(--line-stark); }
  .ed-name {
    width: 100%; font-size: calc(24px * var(--schrift, 1)); font-weight: 800; color: var(--ink); line-height: 1.2;
    border: 1px solid transparent; border-bottom: 1px dashed var(--line-stark); border-radius: 8px 8px 0 0; padding: 6px 30px 6px 4px; background: transparent;
  }
  .ed-name:focus { border-color: var(--line-stark); background: var(--eingabe); border-radius: 8px; outline: none; }
  .ed-name-feld svg { position: absolute; right: 6px; color: var(--muted); pointer-events: none; }
  .ed-farben { display: flex; gap: 10px; flex-wrap: wrap; padding: 2px 0 2px 18px; margin-top: -6px; }
  .ed-farbe { width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--card); box-shadow: 0 0 0 1px var(--line-stark); cursor: pointer; padding: 0; }
  .ed-farbe.an { box-shadow: 0 0 0 3px var(--ink); }
  .ed-block { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow); }
  .ed-block.ed-warn { background: var(--warn-flaeche); border-color: var(--danger-linie); }
  .ed-warn p { margin: 0; }
  .ed-block .ed-h { margin: 0; font-size: calc(17px * var(--schrift, 1)); display: flex; align-items: center; gap: 8px; }
  .ed-zahl { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; background: var(--flaeche-2); color: var(--muted); padding: 1px 8px; border-radius: 10px; }
  .ed-felder { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: end; }
  @media (max-width: 480px) { .ed-felder { grid-template-columns: 1fr 1fr; } .ed-felder > :nth-child(2) { grid-column: 1 / -1; order: 3; } }
  .ed-f { display: flex; flex-direction: column; gap: 4px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ed-f select { width: 100%; max-width: 100%; }
  .ed-f input, .ed-f select { min-height: 44px; font-size: max(16px, calc(16px * var(--schrift, 1))); padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); }
  .ed-f-breit { flex: 1 1 220px; min-width: 0; max-width: 100%; }

  .ed-k { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); }
  .ed-quelle { background: var(--info-flaeche); color: var(--info-text); padding: 8px 10px; border-radius: 10px; }
  .ed-buch { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ed-buch li { display: grid; grid-template-columns: 82px 26px 1fr; gap: 8px; align-items: center; font-size: calc(14px * var(--schrift, 1)); min-height: 40px; }
  .ed-b-tag { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ed-b-icon { font-size: calc(17px * var(--schrift, 1)); text-align: center; }
  .ed-b-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
  .ed-b-txt small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .ed-auf { display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 0; cursor: pointer; text-align: left; color: var(--ink); min-height: 44px; }
  .ed-auf:active { transform: none; }
  .ed-auf-txt { display: flex; flex-direction: column; min-width: 0; }
  .ed-auf-txt b { font-size: calc(15px * var(--schrift, 1)); }
  .ed-auf-txt small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ed-innen { padding-top: 6px; }
  .ed-route { border: 1px solid var(--line); border-left: 5px solid var(--farbe); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; background: var(--card); }
  .ed-r-kopf { display: flex; align-items: center; gap: 8px; }
  .ed-r-name { flex: 1; min-width: 0; font-size: calc(16.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); border: 1px solid transparent; border-radius: 8px; padding: 6px 6px; background: transparent; min-height: 44px; }
  .ed-r-name:hover, .ed-r-name:focus { border-color: var(--line-stark); background: var(--eingabe); }
  .ed-r-zeit { margin: 0 0 0 48px; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); }
  .ed-h3 { margin: 14px 0 4px; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); font-weight: 800; }
  .ed-route.idee { opacity: 0.75; border-style: dashed; }
  .ed-r-meta { margin: 0 0 0 48px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ed-r-fuss { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
  .ed-dazu { align-self: flex-start; min-height: 44px; }
  .ed-weg { color: var(--danger-text); min-height: 44px; }
  .ed-ende { flex-direction: row; flex-wrap: wrap; justify-content: space-between; background: none; border: none; box-shadow: none; padding: 0; }
  .ed-ende .btn { min-height: 44px; }
  .ed-wand { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ed-w { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche); cursor: pointer; text-align: left; color: var(--ink); }
  .ed-w-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .ed-w-txt small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .ed-w-pfeil { font-size: calc(22px * var(--schrift, 1)); color: var(--muted); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (max-width: 600px) {
    /* Auf dem iPhone keine Karte in der Karte in der Karte: die Route liegt flach im Block */
    .ed-block { padding: 12px; }
    .ed-route { border: none; border-left: 4px solid var(--farbe); border-radius: 0; padding: 4px 0 8px 10px; }
    .ed-r-meta, .ed-r-zeit { margin-left: 0; }
  }
  .ed-leer-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
</style>
