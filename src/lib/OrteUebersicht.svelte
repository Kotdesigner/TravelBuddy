<script>
  // Über den Ortskacheln: Karte mit allen Orten des Reiters und deinen Routen, darunter die Gegenden.
  // Eine Gegend wählen zeigt nur deren Kacheln, alle Infos bleiben in den Kacheln sichtbar.
  // Ein Tipp auf einen Punkt öffnet ein Fenster mit dem Wichtigsten. „Mehr Infos zum Ort“ springt zur Kachel,
  // „Einplanen“ springt hin und öffnet dort die Auswahl. Tipp daneben, ✕ oder Esc schließen das Fenster.
  import { tick } from 'svelte'
  import { t, je } from './i18n.js'
  import UebersichtsKarte from './UebersichtsKarte.svelte'
  import { punkteVon, zuordenbar, abstandZur, NAH_KM } from './wander-zuordnung.js'
  import { istInsel, INSELN, ANREISE_ZEICHEN, abfahrtPunkt } from './inseln.js'
  import { userData } from './userdata.js'
  import { reiseDatum } from './reisedatum.js'
  import { sonnenZeiten } from './sonne.js'

  let { regionen = [], reisen = [], gegend = $bindable('alle') } = $props()

  const kurz = (titel) => t(titel).split(/ [—–] /)[0]
  const alle = $derived(regionen.reduce((n, r) => n + r.orte.length, 0))
  const inselGegend = (r) => r.orte.length > 0 && r.orte.every((o) => istInsel(o))
  let gewaehlt = $state(null)
  // Nach einem Sprachwechsel heißen die Gegenden anders: dann wieder alle zeigen
  $effect(() => { if (gegend !== 'alle' && !regionen.some((r) => r.titel === gegend)) gegend = 'alle' })

  const punkte = $derived(regionen.flatMap((r) => r.orte.filter((o) => o.lat != null).map((o) => ({
    id: o.id, lat: o.lat, lon: o.lon, label: o.anzeigeName || o.name, an: gegend === 'alle' || r.titel === gegend,
  }))))
  const linien = $derived(reisen.filter(zuordenbar).map((r) => ({ id: r.id, farbe: r.farbe || '#7a6fd6', punkte: punkteVon(r), an: true, label: r.name })))

  function waehle(titel) {
    gegend = titel
    gewaehlt = null
  }
  // ---------- Fenster am Punkt ----------
  const alleOrte = $derived(regionen.flatMap((r) => r.orte))
  const offenOrt = $derived(gewaehlt ? alleOrte.find((o) => o.id === gewaehlt) : null)
  let titelEl = $state(null)
  const bildVon = (o) => $userData[o.id]?.bilder?.[0] || o.bildData || (o.bild ? '/' + o.bild : null)
  const sonne = $derived(offenOrt?.lat != null ? sonnenZeiten(offenOrt.lat, offenOrt.lon, $reiseDatum) : null)
  const nah = $derived.by(() => {
    if (!offenOrt) return null
    const p = abfahrtPunkt(offenOrt)
    let b = null
    for (const r of reisen) {
      if (!zuordenbar(r)) continue
      const a = abstandZur(p, r)
      if (a && a.km <= NAH_KM && (!b || a.km < b.km)) b = { name: r.name, km: a.km }
    }
    return b
  })
  const mapsUrl = (o) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.mapsQuery || `${o.lat},${o.lon}`)
  function zeige(id) {
    gewaehlt = id
    setTimeout(() => titelEl?.focus(), 30)
  }
  function zu() { gewaehlt = null }
  function taste(e) { if (e.key === 'Escape' && gewaehlt) zu() }
  function daneben(e) {
    if (!gewaehlt) return
    if (e.target?.closest?.('.ou-pop, .uk-punkt')) return
    gewaehlt = null
  }
  async function einplanen(id) {
    await zuOrt(id)
    setTimeout(() => document.querySelector(`#ort-${CSS.escape(id)} .reise-btn`)?.click(), 450)
  }

  async function zuOrt(id) {
    const r = regionen.find((x) => x.orte.some((o) => o.id === id))
    if (r && gegend !== 'alle' && gegend !== r.titel) gegend = r.titel
    gewaehlt = null
    await tick()
    const el = document.getElementById('ort-' + id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    el.classList.add('ort-hl')
    setTimeout(() => el.classList.remove('ort-hl'), 2400)
  }
</script>

<svelte:window onkeydown={taste} onclick={daneben} />

<div class="ou">
  <div class="ou-karte">
  <UebersichtsKarte {punkte} {linien} {gewaehlt} onpunkt={zeige} label={je('Karte mit allen Orten dieses Reiters', 'Map of all places on this tab')} hoehe={260} rahmen="alle-punkte" zoomBeiEnge />
  {#if offenOrt}
    {@const o = offenOrt}
    {@const insel = INSELN[o.id]}
    {@const bild = bildVon(o)}
    <div class="karten-schleier" aria-hidden="true"></div>
    <div class="ou-pop karten-pop" role="dialog" aria-labelledby="ou-pop-titel">
      <div class="ou-pop-kopf">
        {#if bild}<img class="ou-bild" src={bild} alt="" />{:else}<span class="ou-bild leer" aria-hidden="true">{o.emoji || '📍'}</span>{/if}
        <div class="ou-pop-titel">
          <h3 id="ou-pop-titel" tabindex="-1" bind:this={titelEl}>{o.anzeigeName || o.name}</h3>
          {#if o.tags?.length}<span class="ou-tags">{#each o.tags as tag}<span class="ou-tag" class:geheim={tag === 'GEHEIMTIPP'} class:wd={tag === 'NUR-4WD' || tag === 'EXPEDITION'}>{t(tag)}</span>{/each}</span>{/if}
        </div>
        <button class="ou-zu" onclick={zu} aria-label={je('Schließen', 'Close')}>✕</button>
      </div>
      {#if o.region}<p class="ou-klein">📍 {t(o.region)}</p>{/if}
      {#if o.beschreibung}<p class="ou-text">{o.beschreibung}</p>{/if}
      <p class="ou-zeilen">
        {#if sonne}<span>🌅 {sonne.aufgang}</span><span>🌇 {sonne.untergang}</span>{/if}
        {#if insel}<span class="ou-anreise">{ANREISE_ZEICHEN[insel.art]} {insel.text}</span>{/if}
        {#if nah}<span class="ou-nah">🛣️ {nah.km < 1 ? je(`direkt an ${nah.name}`, `right on ${nah.name}`) : je(`${nah.km} km neben ${nah.name}`, `${nah.km} km from ${nah.name}`)}</span>{/if}
      </p>
      <div class="ou-knoepfe">
        <a class="btn" href={mapsUrl(o)} target="_blank" rel="noopener">Google Maps</a>
        <button class="btn" onclick={() => einplanen(o.id)}>{je('Einplanen', 'Add to trip')}</button>
        <button class="btn haupt" onclick={() => zuOrt(o.id)}>{je('Mehr Infos zum Ort ↓', 'More about this place ↓')}</button>
      </div>
    </div>
  {/if}
  </div>
  <div class="ou-legende">
    <span><i class="ou-l an"></i>{gegend === 'alle' ? je('Orte', 'Places') : je('Orte der Gegend', 'Places in this area')}</span>
    {#if gegend !== 'alle'}<span><i class="ou-l aus"></i>{je('andere', 'others')}</span>{/if}
    {#if linien.length}<span><i class="ou-l strich"></i>{je('deine Routen', 'your routes')}</span>{/if}
  </div>
  <div class="ou-chips" role="group" aria-label={je('Gegend', 'Area')}>
    <button class="ou-chip" class:an={gegend === 'alle'} aria-pressed={gegend === 'alle'} onclick={() => waehle('alle')}>{je('Alle', 'All')} <span>{alle}</span></button>
    {#each regionen as r (r.titel)}
      <button class="ou-chip" class:an={gegend === r.titel} aria-pressed={gegend === r.titel} title={t(r.titel)} onclick={() => waehle(r.titel)}>{#if inselGegend(r)}⛴️&nbsp;{/if}{kurz(r.titel)} <span>{r.orte.length}</span></button>
    {/each}
  </div>
</div>

<style>
  .ou-karte { position: relative; }
  .ou-pop { position: absolute; left: 6px; right: 6px; top: 6px; max-width: 480px; margin: 0 auto; background: var(--card); border: 1px solid var(--line-stark); border-radius: 12px; box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; z-index: 3; }
  .ou-pop-kopf { display: flex; gap: 10px; align-items: flex-start; }
  .ou-bild { width: 64px; height: 64px; flex: none; border-radius: 8px; object-fit: cover; background: var(--flaeche); }
  .ou-bild.leer { display: flex; align-items: center; justify-content: center; font-size: calc(28px * var(--schrift, 1)); }
  .ou-pop-titel { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .ou-pop-titel h3 { margin: 0; font-size: calc(16px * var(--schrift, 1)); color: var(--ink); outline: none; }
  .ou-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .ou-tag { font-size: calc(11px * var(--schrift, 1)); font-weight: 800; padding: 2px 8px; border-radius: 20px; background: var(--ok-flaeche); color: var(--ok-text); }
  .ou-tag.geheim { background: var(--info-flaeche); color: var(--info-text); }
  .ou-tag.wd { background: var(--warn-flaeche); color: var(--btn-ink); }
  .ou-zu { width: 44px; height: 44px; flex: none; border: 1px solid var(--line-stark); border-radius: 9px; background: var(--card); color: var(--btn-ink); cursor: pointer; }
  .ou-pop p { margin: 0; }
  .ou-klein { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .ou-text { font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .ou-zeilen { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ou-anreise { color: var(--info-text); }
  .ou-nah { color: var(--brand-text); }
  .ou-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .ou-knoepfe .btn { min-height: 44px; display: inline-flex; align-items: center; text-decoration: none; }
  .ou-knoepfe .btn.haupt { background: var(--brand); border-color: var(--brand); color: #fff; }
  .ou { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 14px; }
  .ou-legende { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: center; font-size: calc(11.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .ou-legende span { display: inline-flex; align-items: center; gap: 5px; }
  .ou-l { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
  .ou-l.an { background: #c1662f; }
  .ou-l.aus { background: var(--aus-ink); opacity: 0.6; }
  .ou-l.strich { width: 16px; height: 0; border-radius: 0; border-top: 2.5px solid #7a6fd6; }
  .ou-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .ou-chip { min-height: 40px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
  .ou-chip span { color: var(--muted); font-weight: 600; margin-left: 2px; }
  .ou-chip.an { background: var(--brand); border-color: var(--brand); color: #fff; }
  .ou-chip.an span { color: #fff; opacity: 0.85; }
</style>
