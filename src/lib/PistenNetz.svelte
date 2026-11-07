<script>
  // Offline-Routen (V29): Hauptstraßen sind immer dabei. Das Pisten-Netz (alle Straßen samt Pisten
  // und 4WD-Tracks) lädt man je Gebiet auf Wunsch, dann rechnet die App auch abseits genau.
  // Oben der Vergleich beider Netze, das ⓘ erklärt das Umfahren von Sperrungen (hilfe.js, „sperrungen“),
  // Größe und Genauigkeit zum Aufklappen. Genauigkeit gemessen am 7.11. (tests/offline-routing.test.mjs).
  import { onMount } from 'svelte'
  import { je } from './i18n.js'
  import { online } from './netz.js'
  import { zeigeToast } from './toast.js'
  import InfoKnopf from './InfoKnopf.svelte'
  import { dauer, klapp } from './motion.js'
  import { GEBIETE, pistenStand, pistenLaedt, pistenLaden, pistenEntfernen, pistenPruefen, netzInfo } from './routing-offline.js'

  let info = $state({})
  // Zu- und aufklappen wie die anderen Boxen; der Stand gilt je Gerät (nur Bequemlichkeit)
  const OFFEN_KEY = 'tb-offline-routen-offen'
  let offen = $state((() => { try { return localStorage.getItem(OFFEN_KEY) === '1' } catch { return false } })())
  function umschalten() { offen = !offen; try { localStorage.setItem(OFFEN_KEY, offen ? '1' : '0') } catch {} }
  const geladeneNamen = $derived(Object.entries(GEBIETE).filter(([g]) => $pistenStand[g]).map(([, x]) => x.name))
  let box
  onMount(() => {
    pistenPruefen(); netzInfo().then((m) => (info = m))
    // Kommt man über „Erste Schritte“ her, gleich zur Box scrollen
    let zeigen = false
    try { zeigen = sessionStorage.getItem('tb-offline-routen-zeigen') === '1'; sessionStorage.removeItem('tb-offline-routen-zeigen') } catch {}
    if (zeigen) setTimeout(() => box?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300)
  })
  const mb = (b) => (b ? (b / 1048576).toFixed(b < 1048576 * 10 ? 1 : 0).replace('.', je(',', '.')) : '…')
  const kmText = (n) => (n ? n.toLocaleString(je('de-DE', 'en-AU')) : '…')
  const hauptZusammen = $derived(Object.values(info).reduce((n, x) => n + (x?.haupt?.bytes || 0), 0))

  const VERGLEICH = $derived([
    [je('Was drin ist', 'What’s in it'), je('Highways bis Nebenstraßen', 'Highways down to minor roads'), je('alle Straßen, auch Schotter, Pisten, 4WD-Tracks', 'all roads, also gravel, unsealed roads, 4WD tracks')],
    [je('Auf dem Gerät', 'On the device'), je('immer, schon gespeichert', 'always, already saved'), je('auf Wunsch je Gebiet', 'on request, per area')],
    [je('Gut für', 'Good for'), je('Fernstrecken auf Asphalt', 'long sealed drives'), je('Nationalparks, Abstecher, 4WD', 'national parks, side trips, 4WD')],
    [je('Stopp abseits', 'Stop off the road'), je('letztes Stück Luftlinie', 'last bit as a straight line'), je('bis ans Ziel, etwa Steep Point', 'right to the end, e.g. Steep Point')],
    [je('Sperrungen umfahren', 'Around closures'), je('ja, über große Straßen', 'yes, via the main roads'), je('ja, viel mehr Ausweichwege', 'yes, with many more ways round')],
  ])
  const GENAU = $derived([
    [je('Strecken gefunden', 'Routes found'), je('20 von 22', '20 of 22'), je('22 von 22', '22 of 22')],
    [je('km auf Asphalt', 'km on sealed roads'), je('0,3 % daneben', '0.3 % off'), je('0,4 % daneben', '0.4 % off')],
    [je('Fahrzeit Asphalt', 'Time on sealed roads'), je('1,1 % daneben', '1.1 % off'), je('0,9 % daneben', '0.9 % off')],
    [je('Viel Piste', 'Lots of tracks'), je('meist Schätzung', 'mostly an estimate'), je('km ±5 %, Zeit ±14 %', 'km ±5 %, time ±14 %')],
  ])

  async function laden(g) {
    try { await pistenLaden(g); zeigeToast(je(`Pisten-Netz ${GEBIETE[g].name} gespeichert`, `Track network ${GEBIETE[g].name} saved`), 'ok') }
    catch { zeigeToast(je('Laden ging nicht, bitte mit Netz noch einmal', 'Could not load, please try again online'), 'fehler') }
  }
  async function entfernen(g) {
    await pistenEntfernen(g)
    zeigeToast(je(`Pisten-Netz ${GEBIETE[g].name} entfernt, Hauptstraßen bleiben`, `Track network ${GEBIETE[g].name} removed, main roads stay`), 'ok')
  }
</script>

<div class="pn" bind:this={box}>
  <div class="pn-kopf">
    <button class="pn-auf" aria-expanded={offen} onclick={umschalten}>
      <span class="aufklapp klein" class:offen aria-hidden="true"></span>
      <span class="pn-auf-txt"><b>🛣️ {je('Offline-Routen', 'Offline routes')}</b>
        <small>{je('Hauptstraßen immer dabei', 'Main roads always included')} · {geladeneNamen.length ? je(`Pisten-Netz: ${geladeneNamen.join(', ')}`, `Track network: ${geladeneNamen.join(', ')}`) : je('kein Pisten-Netz geladen', 'no track network loaded')}</small></span>
    </button>
    <InfoKnopf id="sperrungen" />
  </div>
  {#if offen}<div class="pn-innen" transition:klapp={{ duration: dauer(220) }}>
  <p class="pn-text">{je('Ohne Netz rechnet die App deine Routen selbst. Dafür hat sie zwei Straßennetze:', 'Offline, the app calculates your routes itself. It has two road networks for that:')}</p>
  <table class="pn-tab pn-vergleich">
    <thead><tr><th></th><th>{je('Hauptstraßen', 'Main roads')}</th><th>{je('Pisten-Netz', 'Track network')}</th></tr></thead>
    <tbody>{#each VERGLEICH as [was, haupt, pisten]}<tr><td>{was}</td><td>{haupt}</td><td>{pisten}</td></tr>{/each}</tbody>
  </table>

  <details class="pn-mehr">
    <summary>{je('Größe', 'Size')}</summary>
    <table class="pn-tab pn-groesse">
      <thead><tr><th></th><th>{je('Haupt', 'Main')}</th><th>{je('Pisten', 'Tracks')}</th></tr></thead>
      <tbody>{#each Object.entries(GEBIETE) as [g, geb] (g)}<tr><td>{geb.name}</td><td>{mb(info[g]?.haupt?.bytes)} MB</td><td>{mb(info[g]?.pisten?.bytes)} MB</td></tr>{/each}</tbody>
    </table>
    <p class="pn-fuss">{je(`Hauptstraßen zusammen ${mb(hauptZusammen)} MB, schon in der App.`, `Main roads together ${mb(hauptZusammen)} MB, already in the app.`)}</p>
  </details>

  <details class="pn-mehr">
    <summary>{je('Wie genau?', 'How accurate?')}</summary>
    <table class="pn-tab pn-genau">
      <thead><tr><th></th><th>{je('Haupt', 'Main')}</th><th>{je('Pisten', 'Tracks')}</th></tr></thead>
      <tbody>{#each GENAU as [was, haupt, pisten]}<tr><td>{was}</td><td>{haupt}</td><td>{pisten}</td></tr>{/each}</tbody>
    </table>
    <p class="pn-fuss">{je('22 Strecken mit 19.289 km in WA, um Melbourne und in Queensland, gegen die Online-Berechnung. Mit Netz rechnet die App online und ersetzt die Offline-Werte von selbst.', '22 routes with 19,289 km in WA, around Melbourne and in Queensland, against the online calculation. Online, the app calculates online and replaces the offline values by itself.')}</p>
  </details>

  <ul class="pn-liste">
    {#each Object.entries(GEBIETE) as [g, geb] (g)}
      {@const da = $pistenStand[g]}
      <li>
        <span class="pn-geb"><b>{da ? '✅' : '🪨'} {geb.name}</b>
          <small>{je(`Pisten-Netz ${mb(info[g]?.pisten?.bytes)} MB · ${kmText(info[g]?.pisten?.km)} km Straße, davon ${kmText(info[g]?.pisten?.pisteKm)} km Piste`, `Track network ${mb(info[g]?.pisten?.bytes)} MB · ${kmText(info[g]?.pisten?.km)} km of road, ${kmText(info[g]?.pisten?.pisteKm)} km unsealed`)}</small>
        </span>
        {#if da}
          <button class="bedien-knopf" onclick={() => entfernen(g)}>{je('Entfernen', 'Remove')}</button>
        {:else}
          <button class="bedien-knopf haupt" onclick={() => laden(g)} disabled={!$online || $pistenLaedt[g]}>{$pistenLaedt[g] ? je('lädt …', 'loading …') : $online ? je('Laden', 'Load') : je('braucht Netz', 'needs internet')}</button>
        {/if}
      </li>
    {/each}
  </ul>
  </div>{/if}
</div>

<style>
  .pn { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .pn-kopf { display: flex; align-items: center; gap: 6px; }
  .pn-auf { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 0; cursor: pointer; text-align: left; color: var(--ink); min-height: 44px; }
  .pn-auf:active { transform: none; }
  .pn-auf-txt { display: flex; flex-direction: column; min-width: 0; }
  .pn-auf-txt b { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; }
  .pn-auf-txt small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .pn-innen { display: flex; flex-direction: column; gap: 8px; }
  .pn-text { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .pn-tab { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: calc(12.5px * var(--schrift, 1)); line-height: 1.35; }
  .pn-tab th, .pn-tab td { padding: 6px 5px; border-top: 1px solid var(--line); vertical-align: top; text-align: left; overflow-wrap: anywhere; }
  .pn-tab th { font-weight: 800; color: var(--brand-text); }
  .pn-tab td:first-child { color: var(--muted); font-weight: 600; }
  .pn-vergleich th:first-child, .pn-vergleich td:first-child { width: 30%; }
  .pn-genau th:first-child, .pn-genau td:first-child { width: 34%; }
  .pn-groesse th:first-child, .pn-groesse td:first-child { width: 46%; }
  .pn-mehr { border-top: 1px solid var(--line); padding-top: 8px; }
  .pn-mehr summary { cursor: pointer; font-weight: 800; font-size: calc(13.5px * var(--schrift, 1)); min-height: 32px; display: flex; align-items: center; }
  .pn-mehr summary::-webkit-details-marker { display: none; }
  .pn-mehr summary::after { content: '›'; margin-left: auto; padding: 0 4px; color: var(--muted); font-size: calc(18px * var(--schrift, 1)); transform: rotate(90deg); transition: transform 0.2s; }
  .pn-mehr[open] summary::after { transform: rotate(-90deg); }
  .pn-mehr[open] summary { margin-bottom: 4px; }
  .pn-fuss { margin: 6px 0 0; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); line-height: 1.4; }
  .pn-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .pn-liste li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
  .pn-geb { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: calc(14px * var(--schrift, 1)); }
  .pn-geb small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .pn-liste .bedien-knopf { flex: none; min-width: 96px; }
</style>
