<script>
  import { t } from './i18n.js'
  // Versorgung unterwegs: Tankstellen, Wasser, Toiletten, Camps, Rastplätze, Läden, Werkstätten
  // und Kliniken im Korridor neben der Route, nach Streckenkilometer und Abschnitt.
  // Offline aus den mitgelieferten OpenStreetMap-Punkten (public/pois-<region>.json).
  import { poiRegionFuer } from './karten-config.js'
  import { reichweite, veraltet, hinweise } from './routen-dienst.js'
  import { stimmigeLegs } from './routing.js'
  import { zahl } from './format.js'
  import { KATEGORIEN, KAT, KORRIDOR, versorgungAnRoute, luecken, laengste, nachAbschnitten, ladePois,
    abstandText, googleLink, appleLink } from './versorgung.js'
  import { dauer, klapp } from './motion.js'
  import { haptic } from './haptik.js'

  let { r, orte = [] } = $props()

  const nutzbar = $derived(!!(r?.route?.geometry?.length > 1) && !r.route.flug && !veraltet(r))
  let offen = $state(false)
  let liste = $state(null)        // null = lädt noch
  let fehlt = $state(false)       // für diese Gegend gibt es keine Punkte
  let gerechnetFuer = ''

  // Gewählte Kategorien, Vorgabe wie auf der Offline-Karte
  let an = $state({ fuel: true, wasser: true, camp: true, rast: true, wc: false, laden: false, werkstatt: false, klinik: false })
  let mehr = $state({})

  const ortsnamen = $derived([...(r?.stops || []), ...orte])
  $effect(() => {
    if (!nutzbar) return
    const key = r.route.sig + '|' + r.route.km + '|' + r.route.geometry.length + '|' + orte.length
    if (key === gerechnetFuer) return
    gerechnetFuer = key
    const geo = r.route.geometry, stops = r.stops || [], namen = ortsnamen, laenge = r.route.km
    const regionen = [...new Set(stops.filter((s) => s.lat != null).map((s) => poiRegionFuer([[s.lon, s.lat]])?.id).filter(Boolean))]
    liste = null
    Promise.all(regionen.map((id) => ladePois(id))).then((teile) => {
      if (gerechnetFuer !== key) return     // inzwischen neu berechnet
      const pois = teile.flat()
      fehlt = !pois.length
      liste = pois.length ? versorgungAnRoute(geo, pois, { ortsnamen: namen, gesamtKm: laenge }) : []
    })
  })

  // Länge laut Route: dieselbe Zahl wie im Kopf der Route, darauf sind alle km geeicht
  const gesamtKm = $derived(nutzbar ? r.route.km : 0)
  const startName = $derived((r?.stops || []).find((s) => s.lat != null)?.name || t('Start'))
  const zielName = $derived([...(r?.stops || [])].reverse().find((s) => s.lat != null)?.name || t('Ziel'))
  // Tank-Lücken NICHT hier neu rechnen: genau das Ergebnis des Routenhinweises übernehmen
  // (routen-dienst.js), damit beide Stellen immer dieselbe Zahl zeigen (sonst Abweichungen um 1 km).
  const lueckenFuel = $derived(liste && !fehlt ? ($hinweise[r.id]?.tank?.luecken || []).map((l) => ({ k: 'fuel', ...l })) : [])
  const lueckenWasser = $derived(liste && !fehlt ? luecken(liste, gesamtKm, 'wasser', { start: startName, ziel: zielName }) : [])
  const zaehler = $derived(Object.fromEntries(KATEGORIEN.map((k) => [k.k, (liste || []).filter((x) => x.k === k.k).length])))
  const gefiltert = $derived((liste || []).filter((x) => an[x.k]))
  const gruppen = $derived(nutzbar && liste ? nachAbschnitten(r.route.geometry, r.stops, gefiltert, { gesamtKm: r.route.km, legs: stimmigeLegs(r.route) }) : [])
  const alleAn = $derived(KATEGORIEN.every((k) => an[k.k]))
  const ZEIGE = 12

  function umschalten(k) { an[k] = !an[k]; haptic() }
  function alle() { const ziel = !alleAn; for (const k of KATEGORIEN) an[k.k] = ziel; haptic() }

  const kurzLuecke = (l) => `${zahl(l.laenge)} km ${l.k === 'fuel' ? t('ohne Tankstelle') : t('ohne Wasser')}`
</script>

{#if nutzbar}
  <section class="vs" aria-labelledby="vs-h-{r.id}">
    <button class="vs-kopf" aria-expanded={offen} onclick={() => { offen = !offen; haptic() }}>
      <span class="vs-icon" aria-hidden="true">⛽</span>
      <span class="vs-kopf-txt">
        <b id="vs-h-{r.id}">{t('Versorgung unterwegs')}</b>
        <small>
          {#if liste === null}{t('wird gesucht …')}
          {:else if fehlt}{t('für diese Gegend keine Daten')}
          {:else if lueckenFuel.length || lueckenWasser.length}
            <span class="vs-rot">{t('längste: {join}', { join: [laengste(lueckenFuel), laengste(lueckenWasser)].filter(Boolean).map(kurzLuecke).join(', ') })}</span>
          {:else}{t('{fuel} Tankstellen, {wasser} Wasserstellen, {camp} Camps an der Strecke', { fuel: zaehler.fuel, wasser: zaehler.wasser, camp: zaehler.camp })}{/if}
        </small>
      </span>
      <span class="aufklapp klein" class:offen aria-hidden="true"></span>
    </button>

    {#if offen}
      <div class="vs-innen" transition:klapp={{ duration: dauer(240) }}>
        {#if liste === null}
          <p class="vs-k">{t('Punkte entlang der Strecke werden gesucht …')}</p>
        {:else if fehlt}
          <p class="vs-k">{t('Für diese Gegend sind keine Punkte gespeichert. Offline gibt es sie für ganz WA, den Raum Melbourne, Cairns und die Whitsundays.')}</p>
        {:else}
          {#if lueckenFuel.length || lueckenWasser.length}
            <div class="vs-luecken" role="note">
              <b>{t('Lange Strecken ohne Versorgung')}</b>
              <ul>
                {#each [...lueckenFuel, ...lueckenWasser].sort((a, b) => a.vonKm - b.vonKm) as l}
                  <li class:rot={l.k === 'fuel' && l.laenge > $reichweite}>
                    <span aria-hidden="true">{KAT[l.k].emoji}</span>
                    <span><b>{kurzLuecke(l)}</b> {t('von km {zahl} bis {zahl2}', { zahl: zahl(l.vonKm), zahl2: zahl(l.bisKm) })}<small>{l.von} → {l.bis}</small></span>
                  </li>
                {/each}
              </ul>
              <p class="vs-k">{#if lueckenFuel.some((l) => l.laenge > $reichweite)}{t('Mindestens eine Strecke ist länger als deine Reichweite ({zahl} km).', { zahl: zahl($reichweite) })} {/if}{t('Davor volltanken und genug Wasser laden, im Outback etwa 5 Liter je Person und Tag plus Reserve.')}</p>
            </div>
          {/if}

          <div class="vs-chips" role="group" aria-label={t('Was zeigen')}>
            <button class="vs-chip" class:an={alleAn} aria-pressed={alleAn} onclick={alle}>{t('Alle')}</button>
            {#each KATEGORIEN as k (k.k)}
              <button class="vs-chip" class:an={an[k.k]} aria-pressed={!!an[k.k]} onclick={() => umschalten(k.k)} disabled={!zaehler[k.k]}>
                <span aria-hidden="true">{k.emoji}</span> {k.mehrzahl}<span class="vs-b">{zaehler[k.k]}</span>
              </button>
            {/each}
          </div>

          {#if !gefiltert.length}
            <p class="vs-k">{t('Nichts gewählt oder in dieser Auswahl nichts an der Strecke.')}</p>
          {/if}
          {#each gruppen as g, gi (gi)}
            {#if g.punkte.length}
              <h3 class="vs-abschnitt">{g.von} → {g.nach}<small>{t('km {zahl} bis {zahl2}', { zahl: zahl(g.vonKm), zahl2: zahl(g.bisKm) })}</small></h3>
              <ul class="vs-liste">
                {#each g.punkte.slice(0, mehr[gi] ? undefined : ZEIGE) as x (x.k + x.km + x.name)}
                  <li>
                    <span class="vs-emoji" aria-hidden="true">{KAT[x.k].emoji}</span>
                    <span class="vs-txt"><b>{x.name}</b><small>{t('{label} · bei km {zahl} · {abstandText}', { label: KAT[x.k].label, zahl: zahl(x.km), abstandText: abstandText(x.abstand) })}</small></span>
                    <a class="vs-link" href={appleLink(x)} target="_blank" rel="noopener" aria-label={t('{name} in Apple Karten öffnen', { name: x.name })}>{t('Apple')}</a>
                    <a class="vs-link" href={googleLink(x)} target="_blank" rel="noopener" aria-label={t('{name} in Google Maps öffnen', { name: x.name })}>{t('Google')}</a>
                  </li>
                {/each}
              </ul>
              {#if g.punkte.length > ZEIGE && !mehr[gi]}
                <button class="vs-mehr" onclick={() => (mehr[gi] = true)}>{t('{wert} weitere zeigen', { wert: g.punkte.length - ZEIGE })}</button>
              {/if}
            {/if}
          {/each}
          <p class="vs-fuss">{t('Aus OpenStreetMap, offline gespeichert. Tankstellen bis {fuel} km, alles andere bis {standard} km neben der Strecke. Öffnungszeiten und ob Wasser trinkbar ist, vor Ort prüfen.', { fuel: KORRIDOR.fuel, standard: KORRIDOR.standard })}</p>
        {/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .vs { border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche); overflow: hidden; margin-top: 12px; }
  .vs-kopf { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 8px 10px 8px 12px; border: none; background: none; cursor: pointer; text-align: left; color: var(--ink); }
  .vs-kopf:active { transform: none; background: var(--flaeche-2); }
  .vs-icon { font-size: calc(18px * var(--schrift, 1)); }
  .vs-kopf-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .vs-kopf-txt b { font-size: calc(14px * var(--schrift, 1)); }
  .vs-kopf-txt small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .vs-rot { color: var(--danger-text); font-weight: 600; }
  .vs-innen { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 10px; }
  .vs-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .vs-luecken { background: var(--danger-flaeche); border: 1px solid var(--danger-linie); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .vs-luecken > b { font-size: calc(13.5px * var(--schrift, 1)); }
  .vs-luecken ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .vs-luecken li { display: flex; gap: 8px; font-size: calc(13px * var(--schrift, 1)); line-height: 1.35; color: var(--ink); }
  .vs-luecken li span:last-child { display: flex; flex-direction: column; }
  .vs-luecken li small { color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }
  .vs-luecken li.rot b { color: var(--danger-text); }
  .vs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .vs-chip {
    min-height: 44px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 22px;
    border: 1px solid var(--line-stark); background: var(--card); color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 650; cursor: pointer;
  }
  .vs-chip.an { background: var(--brand); border-color: var(--brand); color: #fff; }
  .vs-chip:disabled { opacity: 0.45; cursor: default; }
  .vs-b { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; background: rgba(0, 0, 0, 0.1); padding: 1px 6px; border-radius: 9px; font-variant-numeric: tabular-nums; }
  .vs-chip.an .vs-b { background: rgba(255, 255, 255, 0.28); }
  .vs-abschnitt { margin: 6px 0 0; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 750; color: var(--ink); display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
  .vs-abschnitt small { font-size: calc(12px * var(--schrift, 1)); font-weight: 500; color: var(--muted); font-variant-numeric: tabular-nums; }
  .vs-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .vs-liste li { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-top: 1px solid color-mix(in srgb, var(--line) 60%, transparent); }
  .vs-emoji { flex: none; width: 24px; text-align: center; font-size: calc(16px * var(--schrift, 1)); }
  .vs-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .vs-txt b { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vs-txt small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .vs-link {
    flex: none; min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0 6px;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--brand-text); text-decoration: none; border-radius: 10px;
  }
  .vs-link:active { background: var(--flaeche-2); }
  .vs-mehr { align-self: flex-start; min-height: 44px; background: none; border: none; padding: 0; color: var(--brand-text); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
  .vs-fuss { margin: 0; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  @media (max-width: 420px) {
    .vs-link { min-width: 44px; padding: 0 4px; font-size: calc(12px * var(--schrift, 1)); }
  }
</style>
