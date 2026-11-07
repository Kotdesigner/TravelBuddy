<script>
  // Routen-Ideen: oben die Karte, darauf alle Ideen auf ihren echten Straßen, nebeneinander versetzt,
  // damit sich gleiche Straßen nicht verdecken, jede mit ihrem Namen an der Linie. Darunter je Route
  // eine Zeile mit kleiner Karte. Ein Tipp klappt die Route mit Tagesplan auf, ein zweiter zu.
  // Die offene Route ist kräftig, die anderen grau. Dann zeigt die Karte ihre Stopps mit Nummer
  // (wie im Tagesplan, in der Farbe der Route) und die Orte der App bis 25 km an der Strecke (orange).
  // Antippen öffnet unter der Karte die Kurzinfo wie bei Orte; Stopps in Städten zeigen die Versorgung.
  import { tick, onMount } from 'svelte'
  import { je } from './i18n.js'
  import UebersichtsKarte from './UebersichtsKarte.svelte'
  import UeberblickKarte from './UeberblickKarte.svelte'
  import OrtInfo from './OrtInfo.svelte'
  import EtappeInfo from './EtappeInfo.svelte'
  import Routen from './Routen.svelte'
  import { stoppsAusRoute } from './routen-ideen.js'
  import { STOPP } from './routen-verweise.js'
  import { ladeStrassen, ladeEtappenorte, kurzName, tagVonStopp, vonHierAus } from './routen-daten.js'
  import { abstandZur } from './wander-zuordnung.js'
  import { abfahrtPunkt } from './inseln.js'
  import { ueberblick, ladeUeberblick } from './ueberblick-gl.js'
  import { kartenDunkel } from './karten-thema.js'
  import { dauer, klapp } from './motion.js'

  let { routen = [], gruppe = $bindable('alle'), orte = [], reisen = [], ziel = '', onzumort = null } = $props()

  const GRUPPEN = [['alle', () => je('Alle', 'All')], ['sued', () => je('Süden', 'South')], ['nord', () => je('Norden', 'North')]]
  const anzahl = (g) => (g === 'alle' ? routen.length : routen.filter((r) => r.gruppe === g).length)
  let offen = $state(null)
  let auswahl = $state(null)   // { art: 'ort', o } oder { art: 'stopp', nr, s, r }

  let strassen = $state({})
  let etappen = $state([])
  onMount(() => {
    ladeUeberblick()
    ladeStrassen().then((s) => (strassen = s))
    ladeEtappenorte().then((e) => (etappen = e))
  })

  const stoppsVon = $derived(Object.fromEntries(routen.map((r) => [r.id, stoppsAusRoute(r).filter((s) => s.lat != null)])))
  // Echte Straße, solange sie noch lädt die Luftlinie zwischen den Stopps
  const linieVon = $derived(Object.fromEntries(routen.map((r) => [r.id, strassen[r.id] || stoppsVon[r.id].map((s) => [s.lon, s.lat])])))
  const sichtbar = $derived(routen.filter((r) => gruppe === 'alle' || r.gruppe === gruppe))
  const farbe = (r) => ($kartenDunkel ? r.farbeDunkel || r.farbe : r.farbe)
  // Abstand der Linien nebeneinander in Pixeln, je Gruppe gezählt (Süden und Norden liegen getrennt)
  const ABSTAND = 4.5
  const linien = $derived(sichtbar.map((r) => {
    const gleich = routen.filter((x) => x.gruppe === r.gruppe)
    const i = gleich.indexOf(r)
    return {
      id: r.id, farbe: r.farbe, farbeDunkel: r.farbeDunkel, punkte: linieVon[r.id], label: r.titel, kurz: kurzName(r.titel),
      an: !offen || offen === r.id, offen: offen === r.id,
      versatz: (i - (gleich.length - 1) / 2) * ABSTAND,
    }
  }))
  const kurzTitel = (t) => t.replace(/^Route\s+/, '')

  const orteNachId = $derived(new Map(orte.map((o) => [o.id, o])))
  const etappeNachId = $derived(new Map(etappen.map((e) => [e.id, e])))
  const offeneRoute = $derived(routen.find((r) => r.id === offen) || null)
  // Stopps der offenen Route, nummeriert wie im Tagesplan
  const stoppPunkte = $derived(offeneRoute ? stoppsVon[offeneRoute.id].map((s, i) => ({ id: 'stopp-' + i, nr: i + 1, lat: s.lat, lon: s.lon, farbe: offeneRoute.farbe, farbeDunkel: offeneRoute.farbeDunkel })) : [])
  // Orte der App bis 25 km an der Strecke (ohne die, die schon Stopp sind)
  const orteAnRoute = $derived.by(() => {
    if (!offeneRoute) return []
    const geo = { route: { geometry: linieVon[offeneRoute.id] } }
    const stoppOrte = new Set(stoppsVon[offeneRoute.id].map((s) => STOPP[s.name]?.ort).filter(Boolean))
    const abschnitt = offeneRoute.gruppe === 'sued' ? 'Süden' : 'Norden'
    return orte.filter((o) => o.lat != null && o.abschnitt?.startsWith(abschnitt) && !stoppOrte.has(o.id))
      .filter((o) => (abstandZur(abfahrtPunkt(o), geo)?.km ?? 999) <= 25)
  })
  // Weitere Etappenorte bis 25 km an der Strecke, die kein Stopp sind (Häuschen auf der Karte)
  const etappenAnRoute = $derived.by(() => {
    if (!offeneRoute) return []
    const geo = { route: { geometry: linieVon[offeneRoute.id] } }
    const stoppEtappen = new Set(stoppsVon[offeneRoute.id].map((s) => STOPP[s.name]?.etappe).filter(Boolean))
    return etappen.filter((e) => !stoppEtappen.has(e.id) && (abstandZur(e, geo)?.km ?? 999) <= 25)
  })
  const rahmenPunkte = $derived(offeneRoute ? linieVon[offeneRoute.id] : sichtbar.flatMap((r) => linieVon[r.id]))
  const gl = $derived($ueberblick === 'bereit')

  async function umschalten(id, vonKarte = false) {
    const r = routen.find((x) => x.id === id)
    if (r && gruppe !== 'alle' && gruppe !== r.gruppe) gruppe = r.gruppe
    offen = offen === id && !vonKarte ? null : id
    auswahl = null
    if (vonKarte) { await tick(); document.getElementById('ru-z-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }
  }
  // Sprung aus der Suche (Adresse orte/routen/<id>): diese Route öffnen
  $effect(() => { const z = ziel; if (z && routen.some((r) => r.id === z)) { const r = routen.find((x) => x.id === z); if (gruppe !== 'alle' && gruppe !== r.gruppe) gruppe = r.gruppe; offen = z } })

  function stoppWahl(id) {
    const nr = Number(String(id).replace('stopp-', '')) + 1
    if (auswahl?.art === 'stopp' && auswahl.nr === nr) { auswahl = null; return }
    const s = stoppsVon[offeneRoute.id][nr - 1]
    const v = STOPP[s.name] || {}
    auswahl = { art: 'stopp', nr, s, r: offeneRoute, ort: v.ort ? orteNachId.get(v.ort) : null, etappe: v.etappe ? etappeNachId.get(v.etappe) : null, tag: tagVonStopp(offeneRoute, s.name) }
  }
  function etappeWahl(id) { const e = etappeNachId.get(id); auswahl = e && auswahl?.e?.id !== id ? { art: 'etappe', e } : null }
  function ortWahl(id) { const o = orteNachId.get(id); auswahl = o && auswahl?.o?.id !== id ? { art: 'ort', o } : null }
  async function zumTag(r, i) {
    auswahl = null
    await tick()
    const el = document.getElementById(`ri-${r.id}-tag-${i}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.classList.add('ort-hl'); setTimeout(() => el?.classList.remove('ort-hl'), 2000)
  }
</script>

<div class="ru">
  {#if gl}
    <UeberblickKarte art="nummern" {linien} punkte={stoppPunkte} orte={orteAnRoute} gewaehlt={auswahl?.art === 'stopp' ? 'stopp-' + (auswahl.nr - 1) : null}
      etappen={etappenAnRoute} etappeGewaehlt={auswahl?.art === 'etappe' ? auswahl.e.id : null} onetappe={etappeWahl}
      onlinie={(id) => umschalten(id, true)} onpunkt={stoppWahl} onort={ortWahl} onleer={() => (auswahl = null)}
      {rahmenPunkte} fitMax={9} hoehe={340} label={je('Karte mit allen Routen-Ideen', 'Map of all route ideas')} />
  {:else}
    <UebersichtsKarte linien={linien.map((l) => ({ ...l, farbe: $kartenDunkel ? l.farbeDunkel || l.farbe : l.farbe }))} gewaehlt={offen} onlinie={(id) => umschalten(id, true)} label={je('Karte mit allen Routen-Ideen', 'Map of all route ideas')} hoehe={300} rahmen="alle" />
  {/if}
  <div class="ru-legende">
    {#if offeneRoute && gl}
      <span><i class="ru-l" style="background:{farbe(offeneRoute)}">1</i>{je('Stopp der Route', 'Stop on the route')}</span>
      <span><i class="ru-l ort"></i>{je(`${orteAnRoute.length} Orte an der Strecke`, `${orteAnRoute.length} places along the way`)}</span>
    {:else if offeneRoute}
      {je('Die offene Route ist hervorgehoben, die anderen grau.', 'The open route is highlighted, the others are grey.')}
    {:else}
      {je('Routen auf derselben Straße liegen nebeneinander. Tippe eine Linie oder Zeile an.', 'Routes on the same road run side by side. Tap a line or a row.')}
    {/if}
  </div>

  {#if auswahl?.art === 'ort'}
    <OrtInfo o={auswahl.o} {reisen} unter={je(`an der Route ${kurzName(offeneRoute?.titel)}`, `along route ${kurzName(offeneRoute?.titel)}`)}
      onzu={() => (auswahl = null)} onkachel={(id, einplanen) => onzumort?.(auswahl.o, einplanen)} kachelText={je('Zum Ort ↗', 'To the place ↗')} />
  {:else if auswahl?.art === 'stopp' && auswahl.ort}
    <OrtInfo o={auswahl.ort} {reisen} nummer={auswahl.nr} nummerFarbe={farbe(auswahl.r)} unter={auswahl.tag ? `${auswahl.tag.tag}: ${auswahl.tag.titel}` : ''}
      onzu={() => (auswahl = null)} onkachel={(id, einplanen) => onzumort?.(auswahl.ort, einplanen)} kachelText={je('Zum Ort ↗', 'To the place ↗')} />
  {:else if auswahl?.art === 'stopp' && auswahl.etappe}
    <EtappeInfo e={auswahl.etappe} nummer={auswahl.nr} nummerFarbe={farbe(auswahl.r)} unter={auswahl.tag ? `${auswahl.tag.tag}: ${auswahl.tag.titel}` : ''}
      nah={vonHierAus(auswahl.etappe, orteAnRoute)} onzu={() => (auswahl = null)}
      tagText={je('Zum Tag ↓', 'To the day ↓')} ontag={auswahl.tag ? () => zumTag(auswahl.r, auswahl.tag.i) : null} />
  {:else if auswahl?.art === 'etappe'}
    <EtappeInfo e={auswahl.e} unter={je(`an der Route ${kurzName(offeneRoute?.titel)}`, `along route ${kurzName(offeneRoute?.titel)}`)} nah={vonHierAus(auswahl.e, orteAnRoute)} onzu={() => (auswahl = null)} />
  {/if}

  <div class="bedien-raster ru-chips" role="group" aria-label={je('Gegend', 'Area')}>
    {#each GRUPPEN as [id, name] (id)}
      <button class="bedien-wahl ru-chip" class:an={gruppe === id} aria-pressed={gruppe === id} onclick={() => { gruppe = id; if (offen && !sichtbar.some((r) => r.id === offen)) { offen = null; auswahl = null } }}>{name()}<span class="bedien-zahl">{anzahl(id)}</span></button>
    {/each}
  </div>
  <ul class="ru-liste">
    {#each sichtbar as r (r.id)}
      <li>
        <button class="ru-zeile" id="ru-z-{r.id}" class:aktiv={offen === r.id} aria-expanded={offen === r.id} onclick={() => umschalten(r.id)}>
          <span class="ru-mini" aria-hidden="true"><UebersichtsKarte linien={[{ id: r.id, farbe: farbe(r), punkte: linieVon[r.id] }]} breite={64} hoehe={54} bedienbar={false} /></span>
          <span class="ru-text"><b>{kurzTitel(r.titel)}</b><small>{(r.meta || []).join(' · ')}</small></span>
          <span class="ru-pfeil" class:auf={offen === r.id} aria-hidden="true">›</span>
        </button>
        {#if offen === r.id}
          <div class="ru-inhalt" transition:klapp={{ duration: dauer(240) }}><Routen routen={[r]} eingebettet {orteNachId} onort={(o) => onzumort?.(o)} /></div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .ru { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 16px; }
  .ru-legende { display: flex; flex-wrap: wrap; gap: 4px 14px; justify-content: center; text-align: center; font-size: calc(11.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .ru-l { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); color: #fff; font-size: calc(9px * var(--schrift, 1)); font-style: normal; font-weight: 800; vertical-align: -4px; margin-right: 4px; }
  .ru-l.ort { width: 12px; height: 12px; background: var(--karte-punkt); vertical-align: -2px; }
  .ru-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .ru-zeile { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; background: none; border: none; border-top: 1px solid var(--line); padding: 10px 4px; min-height: 64px; cursor: pointer; color: var(--ink); font: inherit; }
  .ru-zeile.aktiv { background: var(--flaeche); border-radius: 8px; }
  .ru-mini { flex: none; width: 64px; pointer-events: none; }
  .ru-mini :global(.uk) { border-radius: 6px; }
  .ru-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ru-text b { font-size: calc(14.5px * var(--schrift, 1)); }
  .ru-text small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .ru-pfeil { color: var(--muted); font-size: calc(20px * var(--schrift, 1)); transition: transform 0.2s; }
  .ru-pfeil.auf { transform: rotate(90deg); }
</style>
