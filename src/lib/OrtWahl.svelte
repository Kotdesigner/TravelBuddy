<script>
  import { t, LOCALE } from './i18n.js'
  // Ortswahl per Suche (V4). Ersetzt die Auswahlliste mit 51 WA-Orten und die
  // Lat/Lon-Felder: eine Suche über alle Orte der App (144 + eigene), die Städte
  // für die Routenplanung und die Stopps deiner Routen. Koordinaten von Hand nur noch
  // als Ausweg unter „Eigene Koordinaten“.
  import { norm } from './suche.js'
  import { WA_ORTE } from './wa-orte.js'

  let {
    orte = [],              // alle Orte (Vorschläge + eigene)
    reisen = [],            // für Stopps, die es schon gibt
    platzhalter = t('Ort suchen …'),
    label = t('Ort suchen'),
    freiText = false,       // „… ohne Koordinaten übernehmen“ anbieten (Logbuch)
    koordinaten = true,     // Ausweg „Eigene Koordinaten“ anbieten
    autofokus = false,
    onwahl = () => {},      // ({ name, lat, lon, ortId?, region?, quelle })
  } = $props()

  const uid = Math.random().toString(36).slice(2, 8)
  let q = $state('')
  let aktiv = $state(0)
  let offen = $state(false)
  let eingabe = $state()
  let koordAuf = $state(false)
  let kName = $state(''), kLat = $state(''), kLon = $state('')

  // Ein Bestand, nach Namen entdoppelt: Orte der App zuerst (mit Bild/Region), dann Städte, dann Stopps.
  const bestand = $derived.by(() => {
    const out = [], gesehen = new Set()
    const dazu = (o) => {
      if (!o?.name || o.lat == null || o.lon == null) return
      const k = norm(o.name)
      if (gesehen.has(k)) return
      gesehen.add(k); out.push(o)
    }
    for (const o of orte) dazu({ name: o.name, lat: o.lat, lon: o.lon, ortId: o.id, region: o.region || '', tags: o.tags || [], quelle: 'ort' })
    for (const [name, [lat, lon]] of Object.entries(WA_ORTE)) dazu({ name, lat, lon, region: 'Stadt / Ort in WA', quelle: 'stadt' })
    for (const r of reisen) for (const s of r.stops || []) dazu({ name: s.name, lat: s.lat, lon: s.lon, region: t('Stopp in „{name}“', { name: r.name }), quelle: 'stopp' })
    return out
  })

  const treffer = $derived.by(() => {
    const s = norm(q.trim())
    if (!s) return []
    const r = []
    for (const o of bestand) {
      const n = norm(o.name)
      const rang = n.startsWith(s) ? 0 : n.includes(s) ? 1 : norm(o.region).includes(s) ? 2 : null
      if (rang !== null) r.push([rang, o])
    }
    return r.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, LOCALE)).slice(0, 7).map((x) => x[1])
  })

  $effect(() => { q; aktiv = 0 })
  $effect(() => { if (autofokus && eingabe) setTimeout(() => eingabe?.focus({ preventScroll: true }), 60) })

  function waehle(o) {
    onwahl(o)
    q = ''; offen = false
  }
  function frei() {
    const name = q.trim()
    if (!name) return
    waehle({ name, lat: null, lon: null, quelle: 'frei' })
  }
  function taste(e) {
    const n = treffer.length + (freiText && q.trim() ? 1 : 0)
    if (e.key === 'ArrowDown') { e.preventDefault(); offen = true; aktiv = Math.min(n - 1, aktiv + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aktiv = Math.max(0, aktiv - 1) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (aktiv < treffer.length) treffer[aktiv] && waehle(treffer[aktiv])
      else if (freiText) frei()
    } else if (e.key === 'Escape' && offen) { e.stopPropagation(); offen = false }
  }
  const zahl = (v) => parseFloat(String(v).replace(',', '.'))
  const koordOk = $derived(!isNaN(zahl(kLat)) && !isNaN(zahl(kLon)) && Math.abs(zahl(kLat)) <= 90 && Math.abs(zahl(kLon)) <= 180)
  function koordUebernehmen() {
    if (!koordOk) return
    onwahl({ name: kName.trim() || t('Eigener Punkt'), lat: zahl(kLat), lon: zahl(kLon), quelle: 'koordinaten' })
    kName = ''; kLat = ''; kLon = ''; koordAuf = false
  }
  const symbol = (o) => (o.quelle === 'ort' ? '📍' : o.quelle === 'stadt' ? '🏘️' : '🧭')
</script>

<div class="ow">
  <div class="ow-feld">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
    <input bind:this={eingabe} bind:value={q} type="search" placeholder={platzhalter} aria-label={label}
      role="combobox" aria-autocomplete="list" aria-expanded={offen && (treffer.length > 0 || (freiText && !!q.trim()))}
      aria-controls="ow-liste-{uid}" aria-activedescendant={offen && treffer[aktiv] ? `ow-${uid}-${aktiv}` : undefined}
      autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
      oninput={() => (offen = true)} onfocus={() => (offen = true)} onkeydown={taste} />
  </div>
  {#if offen && (treffer.length || (freiText && q.trim()))}
    <ul class="ow-liste" id="ow-liste-{uid}" role="listbox" aria-label={t('Treffer')}>
      {#each treffer as o, i (o.name + i)}
        <!-- Tastatur läuft über das Suchfeld (Combobox-Muster: Pfeile + Enter) -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li id="ow-{uid}-{i}" role="option" aria-selected={i === aktiv} class:aktiv={i === aktiv}
          onpointerdown={(e) => e.preventDefault()} onclick={() => waehle(o)}>
          <span class="ow-sym" aria-hidden="true">{symbol(o)}</span>
          <span class="ow-txt"><b>{o.name}</b><small>{t(o.region)}</small></span>
        </li>
      {/each}
      {#if freiText && q.trim()}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li id="ow-{uid}-{treffer.length}" role="option" aria-selected={aktiv === treffer.length} class:aktiv={aktiv === treffer.length} class="ow-frei"
          onpointerdown={(e) => e.preventDefault()} onclick={frei}>
          <span class="ow-sym" aria-hidden="true">✏️</span>
          <span class="ow-txt"><b>„{q.trim()}“</b><small>{t('so übernehmen, ohne Kartenpunkt')}</small></span>
        </li>
      {/if}
    </ul>
  {:else if offen && q.trim().length >= 2 && !treffer.length}
    <p class="ow-nix">{t('Kein Ort mit „{trim}“.', { trim: q.trim() })} {#if koordinaten}{t('Mit Koordinaten geht es trotzdem:')}{/if}</p>
  {/if}

  {#if koordinaten}
    <button type="button" class="ow-koord-knopf" aria-expanded={koordAuf} onclick={() => (koordAuf = !koordAuf)}>
      {koordAuf ? t('Eigene Koordinaten schließen') : t('Eigene Koordinaten eingeben')}
    </button>
    {#if koordAuf}
      <div class="ow-koord">
        <input bind:value={kName} placeholder={t('Name')} aria-label={t('Name des Punkts')} />
        <input bind:value={kLat} placeholder={t('Breite, z. B. -24.88')} inputmode="decimal" aria-label={t('Breitengrad')} />
        <input bind:value={kLon} placeholder={t('Länge, z. B. 113.66')} inputmode="decimal" aria-label={t('Längengrad')} />
        <button type="button" class="btn" disabled={!koordOk} onclick={koordUebernehmen}>{t('Übernehmen')}</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .ow { position: relative; display: flex; flex-direction: column; gap: 6px; }
  .ow-feld { position: relative; display: flex; align-items: center; }
  .ow-feld svg { position: absolute; left: 12px; color: var(--muted); pointer-events: none; }
  .ow-feld input {
    width: 100%; min-height: 46px; padding: 10px 12px 10px 38px; font-size: max(16px, calc(17px * var(--schrift, 1)));
    border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink);
  }
  .ow-liste {
    list-style: none; margin: 0; padding: 4px; border: 1px solid var(--line-stark); border-radius: var(--radius-m);
    background: var(--card); box-shadow: var(--shadow-float); max-height: 340px; overflow: auto;
  }
  .ow-liste li {
    display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 10px; border-radius: 10px; cursor: pointer;
  }
  .ow-liste li.aktiv, .ow-liste li:hover { background: var(--flaeche-2); }
  .ow-sym { font-size: calc(18px * var(--schrift, 1)); width: 24px; text-align: center; flex: none; }
  .ow-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
  .ow-txt b { font-size: calc(15px * var(--schrift, 1)); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ow-txt small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ow-nix { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ow-koord-knopf {
    align-self: flex-start; background: none; border: none; padding: 6px 0; min-height: 36px;
    font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--brand-text); cursor: pointer; text-decoration: underline; text-underline-offset: 3px;
  }
  .ow-koord { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .ow-koord input { min-height: 44px; font-size: max(16px, calc(16px * var(--schrift, 1))); padding: 8px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); }
  .ow-koord input:first-child { grid-column: 1 / -1; }
  .ow-koord .btn { grid-column: 1 / -1; min-height: 44px; }
</style>
