<script>
  // Wander-Ideen in Western Australia: Karte mit Punkten, Gegend wählen, kurze Zeilen.
  // Ein Tipp auf Punkt oder Zeile öffnet ein Fenster mit allem Wichtigen: vormerken,
  // gleich einer Etappe oder Route zuordnen, auf der großen Karte zeigen.
  import { je } from './i18n.js'
  import { wanderungen, neueWanderung, updateWanderung, gesamtStart } from './userdata.js'
  import { WANDER_VORSCHLAEGE, GEGENDEN, alsWanderung, schonDa, sommerText } from './wander-vorschlaege.js'
  import { naechsteReise, punkteVon, zuordenbar } from './wander-zuordnung.js'
  import { S_MAP, STATUS_MAP, dauerText } from './wanderungen-daten.js'
  import { etappenMitDatum, istRoute } from './plan.js'
  import { mitWochentag } from './format.js'
  import UebersichtsKarte from './UebersichtsKarte.svelte'
  import { zeigeToast } from './toast.js'

  let { reisen = [], onkarte = null, onoeffne = null } = $props()

  let gegend = $state('alle')
  let auswahl = $state(null) // id des offenen Vorschlags
  let titelEl = $state(null)

  const sichtbar = $derived(gegend === 'alle' ? WANDER_VORSCHLAEGE : WANDER_VORSCHLAEGE.filter((v) => v.gegend === gegend))
  const anzahl = (id) => (id === 'alle' ? WANDER_VORSCHLAEGE.length : WANDER_VORSCHLAEGE.filter((v) => v.gegend === id).length)
  const offen = $derived(auswahl ? WANDER_VORSCHLAEGE.find((v) => v.id === auswahl) : null)
  const inListe = (v) => $wanderungen.find((w) => schonDa(v, [w])) || null
  const reiseName = (id) => reisen.find((r) => r.id === id)?.name || ''
  const nah = $derived.by(() => {
    const m = {}
    for (const v of WANDER_VORSCHLAEGE) m[v.id] = naechsteReise(v, reisen)
    return m
  })
  function nahText(n) {
    if (!n) return ''
    const wo = n.stopp && n.stoppKm <= 60 ? je(`${n.km} km neben dem Stopp ${n.stopp}`, `${n.km} km from the stop ${n.stopp}`) : je(`${n.km} km neben der Strecke`, `${n.km} km from the route`)
    return `${wo} · ${n.reise.name}`
  }

  // Zum Zuordnen: Etappen mit Datum, dann Routen
  const plan = $derived(etappenMitDatum(reisen, $gesamtStart))
  const etappen = $derived(plan.filter((e) => !e.reise.idee))
  const routen = $derived(reisen.filter((r) => istRoute(r) && !r.idee))
  const kurzDatum = (d) => { try { return mitWochentag(d) } catch { return d } }

  // ---------- Karte ----------
  // Alle Ideen als Punkte, die der Gegend hervorgehoben. Liegen sie aufeinander, zoomt die Karte heran.
  const punkte = $derived(WANDER_VORSCHLAEGE.map((v) => ({ id: v.id, lat: v.lat, lon: v.lon, label: v.name,
    an: gegend === 'alle' || v.gegend === gegend, rot: v.sommer === 'zu', ring: !!inListe(v) })))
  const linien = $derived(reisen.filter(zuordenbar).map((r) => ({ id: r.id, farbe: r.farbe || '#7a6fd6', punkte: punkteVon(r), label: r.name })))

  function zeige(id) {
    auswahl = id
    setTimeout(() => titelEl?.focus(), 30)
  }
  function zu() { const war = auswahl; auswahl = null; setTimeout(() => document.getElementById('wi-z-' + war)?.focus(), 30) }
  function taste(e) { if (e.key === 'Escape' && auswahl) zu() }
  // Tipp irgendwo daneben schließt das Fenster. Punkte und Zeilen öffnen ja selbst ein anderes.
  function daneben(e) {
    if (!auswahl) return
    if (e.target?.closest?.('.wi-pop, .uk-punkt, .wi-zeile')) return
    auswahl = null
  }

  function vormerken(v) {
    neueWanderung(alsWanderung(v))
    zeigeToast(je(`„${v.name}“ steht auf deiner Wunschliste`, `“${v.name}” is on your wish list`), 'ok')
  }
  function zuordnen(v, reiseId) {
    if (!reiseId) return
    const w = inListe(v)
    if (w) updateWanderung(w.id, { reiseId, reiseAuto: false, status: w.status === 'gemacht' ? 'gemacht' : 'geplant' })
    else neueWanderung({ ...alsWanderung(v), reiseId, reiseAuto: false, status: 'geplant' })
    zeigeToast(je(`„${v.name}“ ist in „${reiseName(reiseId)}“ eingeplant`, `“${v.name}” is planned in “${reiseName(reiseId)}”`), 'ok')
  }
  function standText(w) {
    if (!w) return ''
    const s = STATUS_MAP[w.status]
    const r = w.reiseId ? reiseName(w.reiseId) : ''
    return [s ? `${s.emoji} ${s.label}` : '', r ? (w.reiseAuto ? je(`passt zu „${r}“`, `fits “${r}”`) : je(`in „${r}“`, `in “${r}”`)) : ''].filter(Boolean).join(', ')
  }
</script>

<svelte:window onkeydown={taste} onclick={daneben} />

<div class="wi">
  <p class="wi-hinweis">{je('Beliebte Wanderungen in Western Australia. Tippe einen Punkt oder eine Zeile an. Zahlen gerundet, vor Ort gelten die Schilder der Parkverwaltung.', 'Popular hikes in Western Australia. Tap a dot or a row. Figures are rounded, on site the park signs apply.')}</p>

  <div class="wi-karte-rahmen">
    <UebersichtsKarte {punkte} {linien} gewaehlt={auswahl} onpunkt={zeige} label={je('Karte mit den Wander-Ideen', 'Map of the hike ideas')} hoehe={340} rahmen="alle-punkte" zoomBeiEnge />
    <div class="wi-legende">
      <span><i class="wi-l gruen"></i>{je('offen', 'open')}</span>
      <span><i class="wi-l rot"></i>{je('im Sommer gesperrt', 'closed in summer')}</span>
      <span><i class="wi-l ring"></i>{je('in deiner Liste', 'in your list')}</span>
      {#if linien.length}<span><i class="wi-l strich"></i>{je('deine Routen', 'your routes')}</span>{/if}
    </div>

    {#if offen}
      {@const w = inListe(offen)}
      {@const s = S_MAP[offen.schwierigkeit]}
      <div class="karten-schleier" aria-hidden="true"></div>
      <div class="wi-pop karten-pop" role="dialog" aria-labelledby="wi-pop-titel">
        <div class="wi-pop-kopf">
          <h3 id="wi-pop-titel" tabindex="-1" bind:this={titelEl}>{offen.name}</h3>
          <button class="wi-zu" onclick={zu} aria-label={je('Schließen', 'Close')}>✕</button>
        </div>
        <div class="wi-sub">
          {#if s}<span class="badge">{s.emoji} {s.label}</span>{/if}
          {#if sommerText(offen.sommer)}<span class="badge sommer" class:rot={offen.sommer !== 'frueh'}>☀️ {sommerText(offen.sommer)}</span>{/if}
        </div>
        <p class="wi-zahlen">📍 {offen.gebiet}<br>{[offen.km ? `${String(offen.km).replace('.', je(',', '.'))} km` : '', dauerText(offen.dauerMin), offen.hoehenmeter ? `↑ ${offen.hoehenmeter} hm` : '', offen.wasser ? je(`${offen.wasser} l Wasser`, `${offen.wasser} l water`).replace('.', je(',', '.')) : ''].filter(Boolean).join(' · ')}</p>
        {#if nah[offen.id]}<p class="wi-nah">🛣️ {nahText(nah[offen.id])}</p>{/if}
        <p class="wi-text">{offen.beschreibung}</p>
        <p class="wi-zeit">🌅 {offen.besteZeit}</p>

        {#if w}<p class="wi-stand">✓ {je('In deiner Liste', 'In your list')}: {standText(w)}</p>{/if}
        <div class="wi-knoepfe">
          {#if !w}<button class="btn haupt" onclick={() => vormerken(offen)}>⭐ {je('Auf die Wunschliste', 'Add to wish list')}</button>{/if}
          {#if etappen.length || routen.length}
            <label class="wi-wahl">{w ? je('Einplanen in', 'Plan into') : je('Oder gleich einplanen in', 'Or plan straight into')}
              <select value="" onchange={(e) => { zuordnen(offen, e.target.value); e.target.value = '' }}>
                <option value="">{je('Etappe oder Route wählen …', 'Choose a leg or route …')}</option>
                {#if etappen.length}<optgroup label={je('Etappen', 'Legs')}>{#each etappen as e (e.reise.id)}<option value={e.reise.id}>{e.reise.name} ({kurzDatum(e.von)} – {kurzDatum(e.bis)})</option>{/each}</optgroup>{/if}
                {#if routen.length}<optgroup label={je('Routen', 'Routes')}>{#each routen as r (r.id)}<option value={r.id}>{r.name}</option>{/each}</optgroup>{/if}
              </select>
            </label>
          {/if}
          {#if w && onoeffne}<button class="btn" onclick={() => { const id = w.id; auswahl = null; onoeffne(id) }}>{je('In meiner Liste öffnen', 'Open in my list')}</button>{/if}
          {#if onkarte}<button class="btn" onclick={() => onkarte(offen)}>🗺️ {je('Auf der großen Karte zeigen', 'Show on the big map')}</button>{/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="bedien-raster wi-chips" role="group" aria-label={je('Gegend', 'Area')}>
    <button class="bedien-wahl wi-chip" class:an={gegend === 'alle'} aria-pressed={gegend === 'alle'} onclick={() => { gegend = 'alle'; auswahl = null }}>{je('Alle', 'All')}<span class="bedien-zahl">{anzahl('alle')}</span></button>
    {#each GEGENDEN as g (g.id)}
      <button class="bedien-wahl wi-chip" class:an={gegend === g.id} aria-pressed={gegend === g.id} title={g.unter} onclick={() => { gegend = g.id; auswahl = null }}><span>{g.titel}</span><span class="bedien-zahl">{anzahl(g.id)}</span></button>
    {/each}
  </div>

  <ul class="wi-liste">
    {#each sichtbar as v (v.id)}
      {@const w = inListe(v)}
      <li>
        <button class="wi-zeile" id="wi-z-{v.id}" class:aktiv={auswahl === v.id} onclick={() => zeige(v.id)}>
          <b>{v.name}</b>
          <span class="wi-zeile-sub">
            <span>📍 {v.gebiet}</span>
            <span>{[v.km ? `${String(v.km).replace('.', je(',', '.'))} km` : '', dauerText(v.dauerMin)].filter(Boolean).join(' · ')}</span>
            {#if S_MAP[v.schwierigkeit]}<span>{S_MAP[v.schwierigkeit].label}</span>{/if}
            {#if sommerText(v.sommer)}<span class="badge sommer" class:rot={v.sommer !== 'frueh'}>☀️ {sommerText(v.sommer)}</span>{/if}
            {#if w}<span class="badge ok">{standText(w)}</span>{:else if nah[v.id]}<span class="badge nah">🛣️ {nah[v.id].km} km · {nah[v.id].reise.name}</span>{/if}
          </span>
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .wi { display: flex; flex-direction: column; gap: 10px; }
  .wi-hinweis { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .wi-karte-rahmen { position: relative; }
  .wi-legende { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: center; margin-top: 6px; font-size: calc(11.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .wi-legende span { display: inline-flex; align-items: center; gap: 5px; }
  .wi-l { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
  .wi-l.gruen { background: var(--karte-punkt); }
  .wi-l.rot { background: #c0392b; }
  .wi-l.ring { border: 2.5px solid var(--ink); width: 7px; height: 7px; }
  .wi-l.strich { width: 16px; height: 0; border-radius: 0; border-top: 2.5px solid #7a6fd6; }

  .wi-pop { position: absolute; left: 6px; right: 6px; top: 6px; max-width: 480px; margin: 0 auto; background: var(--card); border: 1px solid var(--line-stark); border-radius: 12px; box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; z-index: 3; }
  .wi-pop-kopf { display: flex; align-items: flex-start; gap: 8px; }
  .wi-pop-kopf h3 { flex: 1; margin: 0; font-size: calc(16px * var(--schrift, 1)); color: var(--ink); outline: none; }
  .wi-zu { width: 44px; height: 44px; flex: none; border: 1px solid var(--line-stark); border-radius: 9px; background: var(--card); color: var(--btn-ink); cursor: pointer; font-size: calc(14px * var(--schrift, 1)); }
  .wi-sub, .wi-zeile-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
  .wi-pop p { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; color: var(--ink); }
  .wi-pop .wi-zahlen, .wi-pop .wi-zeit { color: var(--muted); font-weight: 600; font-size: calc(12.5px * var(--schrift, 1)); }
  .wi-pop .wi-nah { color: var(--brand-text); font-weight: 700; font-size: calc(12.5px * var(--schrift, 1)); }
  .wi-pop .wi-stand { color: var(--ok-text); font-weight: 700; font-size: calc(12.5px * var(--schrift, 1)); }
  .wi-knoepfe { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .wi-knoepfe .btn { min-height: 44px; text-align: left; }
  .btn { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .btn.haupt { background: var(--brand); color: #fff; border-color: var(--brand); }
  .wi-wahl { display: flex; flex-direction: column; gap: 4px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .wi-wahl select { font-size: max(16px, calc(16px * var(--schrift, 1))); min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); }

  .badge { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; border-radius: 20px; padding: 2px 9px; border: 1px solid var(--line); background: var(--flaeche); color: var(--ink); }
  .badge.sommer { background: var(--warn-flaeche); color: var(--btn-ink); border-color: #e8cf9a; }
  .badge.sommer.rot { background: var(--danger-flaeche); color: var(--danger-text); border-color: var(--danger-linie); }
  .badge.ok { background: var(--ok-flaeche); color: var(--ok-text); border-color: #b0d8c6; }
  .badge.nah { background: var(--info-flaeche); color: var(--info-text); border-color: var(--info-linie); }

  .wi-chip { padding-top: 6px; padding-bottom: 6px; line-height: 1.25; }

  .wi-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .wi-zeile { width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--line); padding: 10px 4px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; color: var(--ink); font: inherit; min-height: 44px; }
  .wi-zeile b { font-size: calc(14.5px * var(--schrift, 1)); }
  .wi-zeile-sub { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .wi-zeile.aktiv { background: var(--flaeche); border-radius: 8px; }
</style>
