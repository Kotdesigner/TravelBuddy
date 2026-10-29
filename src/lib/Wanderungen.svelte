<script>
  import { t, LOCALE, tn } from './i18n.js'
  import { ZWEI } from './format.js'
  // Wanderungen-Verwaltung: Wunschliste → geplant → gemacht.
  // Pro Wanderung: Kennzahlen (km, Dauer, Höhenmeter), Schwierigkeit, Wegart,
  // Trailhead-Koordinaten (aus Orten oder manuell), Verknüpfung zu einer Reise,
  // Outback-Infos (Wasser, beste Zeit), Beschreibung, Bewertung & Fotos.
  import { wanderungen, neueWanderung, updateWanderung, loescheWanderung, tauscheWanderung,
           gesamtStart, berechneKalender, ymd } from './userdata.js'
  import { SCHWIERIGKEIT, WEGART, WANDER_STATUS, S_MAP, ART_MAP, STATUS_MAP, dauerText } from './wanderungen-daten.js'
  import { macheThumbnail } from './thumbnail.js'

  import OrtWahl from './OrtWahl.svelte'
  import { loeschFrage } from './dialog.js'
  import { dauer, klapp } from './motion.js'
  import { etappenMitDatum, etappeAm, istRoute } from './plan.js'

  let { orte = [], reisen = [], fokusId = null, onneu = null } = $props()

  // V4: aus dem Plan, dem Tag oder „+ Neu“ direkt auf eine Wanderung springen
  $effect(() => {
    if (!fokusId) return
    filter = 'alle'
    offen[fokusId] = true
    setTimeout(() => document.getElementById('wand-' + fokusId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  })
  async function loeschen(w) {
    if (await loeschFrage(t('Wanderung „{name}“', { name: w.name }))) loescheWanderung(w.id)
  }

  let filter = $state('alle') // 'alle' | status-id
  let offen = $state({})

  const orteSort = $derived([...orte].filter((o) => o.lat != null).sort((a, b) => a.name.localeCompare(b.name, LOCALE)))

  // V4: nach Datum, wie im Logbuch; ohne Datum (Wunschliste) danach in der bisherigen Reihenfolge
  const sortiert = $derived([...$wanderungen].map((w, i) => [w, i]).sort((x, y) => {
    const a = x[0].datum || '9999', b = y[0].datum || '9999'
    return a.localeCompare(b) || (x[0].zeit || '').localeCompare(y[0].zeit || '') || x[1] - y[1]
  }).map((x) => x[0]))
  const liste = $derived(filter === 'alle' ? sortiert : sortiert.filter((w) => w.status === filter))

  const stat = $derived.by(() => {
    let km = 0, hm = 0, gemacht = 0
    for (const w of $wanderungen) {
      km += Number(w.km) || 0
      hm += Number(w.hoehenmeter) || 0
      if (w.status === 'gemacht') gemacht++
    }
    return { anzahl: $wanderungen.length, km: Math.round(km * 10) / 10, hm, gemacht }
  })
  const zaehler = $derived.by(() => {
    const c = { alle: $wanderungen.length }
    for (const s of WANDER_STATUS) c[s.id] = $wanderungen.filter((w) => w.status === s.id).length
    return c
  })

  function toggle(id) { offen[id] = !offen[id] }
  function set(id, patch) { updateWanderung(id, patch) }

  // Mit dem sichtbaren Nachbarn tauschen (respektiert den aktiven Filter).
  function move(w, dir) {
    const nachbar = liste[liste.findIndex((x) => x.id === w.id) + dir]
    if (nachbar) tauscheWanderung(w.id, nachbar.id)
  }

  function neu() {
    if (onneu) { onneu(); return }
    const id = neueWanderung()
    offen[id] = true
  }

  function waehleOrt(w, ortId) {
    const o = orte.find((x) => x.id === ortId)
    if (o) set(w.id, { ortId: o.id, lat: o.lat, lon: o.lon, gebiet: w.gebiet || o.region || '' })
    else set(w.id, { ortId: null })
  }
  function reiseName(id) { return reisen.find((r) => r.id === id)?.name || '' }

  async function addFoto(w, e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    try { const t = await macheThumbnail(f); set(w.id, { fotos: [...(w.fotos || []), t] }) } catch {}
  }
  function delFoto(w, i) { set(w.id, { fotos: (w.fotos || []).filter((_, idx) => idx !== i) }) }

  // Termin-Rückmeldung: in welche Etappe des Gesamtplans fällt das Datum?
  // Nur Anzeige — gebunden bleibt die Wanderung über reiseId, nicht über das Datum.
  const plan = $derived(etappenMitDatum(reisen, $gesamtStart))
  function einordnung(w) {
    if (!w.datum) return ''
    const e = etappeAm(plan, w.datum)
    return e ? t('in der Etappe „{name}“', { name: e.reise.name }) : t('außerhalb deiner Etappen')
  }
  // Zu welcher Route gehört sie? Zur Auswahl stehen die Routen der Etappe am Datum (sonst alle).
  const routenWahl = $derived((w) => {
    const e = w.datum ? etappeAm(plan, w.datum) : null
    const alle = reisen.filter(istRoute)
    return e ? alle.filter((r) => r.etappeId === e.reise.id) : alle
  })
  function fmtTag(d, z) {
    if (!d) return ''
    try {
      const s = new Date(d + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: ZWEI, month: 'short' })
      return z ? `${s} · ${z}` : s
    } catch { return d }
  }

  // Kurz-Zeile unter dem Namen (eingeklappt).
  function kurz(w) {
    const t = []
    if (w.km) t.push(`${w.km} km`)
    const d = dauerText(w.dauerMin); if (d) t.push(d)
    if (w.hoehenmeter) t.push(`↑ ${w.hoehenmeter} hm`)
    if (w.gebiet) t.push(w.gebiet)
    return t.join(' · ')
  }
</script>

<div class="kopf">
  <p class="intro">{t('Von der Wunschliste bis „gemacht“. Mit Datum steht eine Wanderung auch im Logbuch an ihrem Tag.')}</p>
  <button class="btn neu" onclick={neu}>{t('+ Neue Wanderung')}</button>
</div>

{#if $wanderungen.length}
  <div class="bilanz">
    <span>{tn(stat.anzahl, '🥾 {n} Wanderung', '🥾 {n} Wanderungen')}</span>
    {#if stat.km}<span>{t('📏 {km} km gesamt', { km: stat.km })}</span>{/if}
    {#if stat.hm}<span>⛰️ {stat.hm} hm</span>{/if}
    {#if stat.gemacht}<span>{t('✅ {gemacht} gemacht', { gemacht: stat.gemacht })}</span>{/if}
  </div>

  <div class="filter">
    <button class="f" class:an={filter === 'alle'} onclick={() => (filter = 'alle')}>{t('Alle')} <b>{zaehler.alle}</b></button>
    {#each WANDER_STATUS as s}
      <button class="f" class:an={filter === s.id} onclick={() => (filter = s.id)}>{s.emoji} {s.label} <b>{zaehler[s.id]}</b></button>
    {/each}
  </div>
{/if}

{#if $wanderungen.length === 0}
  <p class="leer">{t('Noch keine Wanderung. Leg die erste über „+ Neue Wanderung“ an oder direkt an einem Ort mit dem Zeichen 🥾.')}</p>
{:else if liste.length === 0}
  <p class="leer">{t('Keine Wanderung in diesem Filter.')}</p>
{:else}
  <div class="cards">
    {#each liste as w (w.id)}
      {@const s = S_MAP[w.schwierigkeit]}
      {@const stx = STATUS_MAP[w.status]}
      <div class="card" class:offen={offen[w.id]} id="wand-{w.id}">
        <div class="c-kopf">
          <button class="aufklapp" class:offen={offen[w.id]} onclick={() => toggle(w.id)} title={offen[w.id] ? t('zuklappen') : t('aufklappen')} aria-expanded={!!offen[w.id]}></button>
          <div class="c-titel">
            <input class="c-name" value={w.name} oninput={(e) => set(w.id, { name: e.target.value })} placeholder={t('Name der Wanderung')} />
            <div class="c-sub">
              <span class="badge stat-{w.status}">{stx?.emoji} {stx?.label}</span>
              {#if w.datum}<span class="badge termin">📅 {fmtTag(w.datum, w.zeit)}</span>{/if}
              {#if s}<span class="badge sw">{s.emoji} {s.label}</span>{/if}
              {#if kurz(w)}<span class="c-kurz">{kurz(w)}</span>{/if}
            </div>
          </div>
          <div class="c-ord">
            <button class="c-del" onclick={() => loeschen(w)} title={t('löschen')} aria-label={t('{name} löschen', { name: w.name })}>✕</button>
          </div>
        </div>

        {#if offen[w.id]}
          <div class="c-body" transition:klapp={{ duration: dauer(220) }}>
            <!-- V4: zuerst wann und wo, dann die Zahlen -->
            <div class="block">
              <span class="b-cap">{t('📅 Wann (optional)')}</span>
              <div class="grid">
                <label class="fld">{t('Datum')}
                  <input type="date" value={w.datum || ''} onchange={(e) => set(w.id, { datum: e.target.value })} />
                </label>
                <label class="fld">{t('Uhrzeit')}
                  <input type="time" value={w.zeit || ''} onchange={(e) => set(w.id, { zeit: e.target.value })} step="300" />
                </label>
              </div>
              {#if w.datum}
                <span class="termin-ok">{t('✓ steht im Logbuch an diesem Tag')}{#if einordnung(w)}, {einordnung(w)}{/if}</span>
              {:else}
                <span class="hint">{t('Ohne Datum bleibt die Wanderung nur hier in der Liste.')}</span>
              {/if}
              <div class="segment status-wahl" role="group" aria-label={t('Status')}>
                {#each WANDER_STATUS as o}<button class:an={w.status === o.id} aria-pressed={w.status === o.id} onclick={() => set(w.id, { status: o.id })}>{o.emoji} {o.label}</button>{/each}
              </div>
            </div>

            <div class="block">
              <span class="b-cap">{t('📍 Trailhead / Startpunkt')}</span>
              {#if w.lat != null && w.lon != null}
                <div class="trail-wert">
                  <span>{orte.find((o) => o.id === w.ortId)?.name || `${Number(w.lat).toFixed(4)}, ${Number(w.lon).toFixed(4)}`}</span>
                  <a class="maps" href={`https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lon}`} target="_blank" rel="noopener">{t('Navigation in Google Maps')}</a>
                  <button class="btn" onclick={() => set(w.id, { lat: null, lon: null, ortId: null })}>{t('Ändern')}</button>
                </div>
              {:else}
                <OrtWahl {orte} {reisen} label={t('Startpunkt suchen')} platzhalter="Ort oder Parkplatz suchen …"
                  onwahl={(o) => set(w.id, { ortId: o.ortId || null, lat: o.lat, lon: o.lon, gebiet: w.gebiet || (o.quelle === 'ort' ? o.region : '') })} />
              {/if}
            </div>

            <div class="grid">
              <label class="fld">{t('📏 Länge (km)')}
                <input type="number" min="0" step="0.1" value={w.km} oninput={(e) => set(w.id, { km: e.target.value })} placeholder="km" inputmode="decimal" />
              </label>
              <label class="fld">{t('⏱️ Dauer (min)')}
                <input type="number" min="0" step="5" value={w.dauerMin} oninput={(e) => set(w.id, { dauerMin: e.target.value })} placeholder={t('Minuten')} inputmode="numeric" />
                {#if dauerText(w.dauerMin)}<span class="hint">= {dauerText(w.dauerMin)}</span>{/if}
              </label>
              <label class="fld">{t('⛰️ Höhenmeter ↑')}
                <input type="number" min="0" step="10" value={w.hoehenmeter} oninput={(e) => set(w.id, { hoehenmeter: e.target.value })} placeholder="hm" inputmode="numeric" />
              </label>
              <label class="fld">{t('🧊 Wasser (Liter)')}
                <input type="number" min="0" step="0.5" value={w.wasser} oninput={(e) => set(w.id, { wasser: e.target.value })} placeholder={t('empfohlen')} inputmode="decimal" />
              </label>
              <label class="fld">{t('🥁 Schwierigkeit')}
                <select value={w.schwierigkeit} onchange={(e) => set(w.id, { schwierigkeit: e.target.value })}>
                  {#each SCHWIERIGKEIT as o}<option value={o.id}>{o.emoji} {o.label}</option>{/each}
                </select>
              </label>
              <label class="fld">{t('🧭 Wegart')}
                <select value={w.art} onchange={(e) => set(w.id, { art: e.target.value })}>
                  {#each WEGART as o}<option value={o.id}>{o.emoji} {o.label}</option>{/each}
                </select>
              </label>
              <label class="fld">{t('🏞️ Gebiet / Nationalpark')}
                <input value={w.gebiet} oninput={(e) => set(w.id, { gebiet: e.target.value })} placeholder={t('z. B. Kalbarri NP')} />
              </label>
              <label class="fld">{t('🌅 Beste Zeit')}
                <input value={w.besteZeit} oninput={(e) => set(w.id, { besteZeit: e.target.value })} placeholder={t('z. B. früh morgens, Mai–Sep')} />
              </label>
              {#if routenWahl(w).length}
                <label class="fld">{t('🛣️ Auf welcher Route')}
                  <select value={reisen.some((r) => r.id === w.reiseId && istRoute(r)) ? w.reiseId : ''} onchange={(e) => set(w.id, { reiseId: e.target.value || null })}>
                    <option value="">{t('keine Angabe')}</option>
                    {#each routenWahl(w) as r}<option value={r.id}>{r.name}</option>{/each}
                  </select>
                </label>
              {/if}
            </div>

            <label class="fld voll">{t('📝 Beschreibung / Notizen')}
              <textarea rows="2" value={w.beschreibung} oninput={(e) => set(w.id, { beschreibung: e.target.value })} placeholder={t('Highlights, Wegzustand, Ausrüstung, Warnungen …')}></textarea>
            </label>

            <!-- Bewertung (nach der Wanderung) -->
            <div class="block">
              <span class="b-cap">{t('⭐ Bewertung')}</span>
              <div class="stars">
                {#each Array(5) as _, i}
                  <button class="star" class:an={(w.bewertung || 0) > i} onclick={() => set(w.id, { bewertung: w.bewertung === i + 1 ? 0 : i + 1 })}>★</button>
                {/each}
                {#if w.bewertung}<span class="hint">{w.bewertung}/5</span>{/if}
              </div>
            </div>

            <!-- Fotos -->
            {#if w.fotos?.length}
              <div class="fotos">
                {#each w.fotos as f, i}<div class="foto"><img src={f} alt={t('Foto')} /><button class="fx" onclick={() => delFoto(w, i)}>✕</button></div>{/each}
              </div>
            {/if}
            <label class="foto-btn">{t('📷 Foto (wird verkleinert)')}<input type="file" accept="image/*" onchange={(e) => addFoto(w, e)} /></label>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .intro { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); margin: 0; flex: 1 1 260px; }
  .btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .neu { background: #2f7a63; color: #fff; border-color: #2f7a63; }

  .bilanz { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .bilanz span { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); background: var(--flaeche); border: 1px solid var(--line); border-radius: 20px; padding: 5px 12px; }

  .filter { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .f { font-size: calc(12px * var(--schrift, 1)); font-weight: 600; padding: 6px 11px; border: 1px solid var(--line); background: var(--card); color: var(--muted); border-radius: 18px; cursor: pointer; }
  .f.an { background: var(--brand); color: #fff; border-color: var(--brand); }
  .f b { font-weight: 800; }

  .leer { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); padding: 16px; border-radius: 10px; }

  .cards { display: flex; flex-direction: column; gap: 10px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
  .card.offen { border-color: #d5c9b3; }

  .c-kopf { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; }
  .c-titel { flex: 1; min-width: 0; }
  .c-name { width: 100%; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; padding: 5px 7px; border: 1px solid var(--line-stark); border-radius: 6px; color: var(--ink); }
  .c-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; }
  .badge { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; border-radius: 20px; padding: 2px 9px; border: 1px solid var(--line); }
  .badge.sw { background: var(--flaeche); color: var(--ink); }
  .stat-wunsch { background: var(--warn-flaeche); color: var(--btn-ink); border-color: #e8cf9a; }
  .stat-geplant { background: #e7f0fa; color: #2a5a8a; border-color: #b8d0e8; }
  .stat-gemacht { background: var(--ok-flaeche); color: var(--ok-text); border-color: #b0d8c6; }
  .badge.termin { background: var(--flaeche); color: var(--brand-text); border-color: var(--line-stark); font-weight: 800; }
  .c-kurz { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .c-ord { display: flex; gap: 3px; }
  .c-ord button { width: 38px; height: 38px; border: 1px solid var(--line-stark); background: var(--card); border-radius: 9px; cursor: pointer; font-size: calc(14px * var(--schrift, 1)); color: var(--btn-ink); }
  .c-ord button:disabled { opacity: 0.3; cursor: default; }
  .c-del { color: var(--danger-text) !important; }

  .status-wahl { align-self: flex-start; flex-wrap: wrap; }
  .trail-wert { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 700; font-size: calc(15px * var(--schrift, 1)); }
  .trail-wert .btn { min-height: 44px; }
  .c-body { padding: 2px 12px 14px; display: flex; flex-direction: column; gap: 12px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; padding: 10px; background: var(--flaeche); border-radius: 8px; }
  .fld { display: flex; flex-direction: column; gap: 4px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .fld.voll { }
  .fld input, .fld select, .fld textarea {
    font-size: max(16px, calc(16px * var(--schrift, 1))); padding: 7px 10px; min-height: 44px; width: 100%; min-width: 0; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); font-family: inherit; color: var(--ink); font-weight: 400;
  }
  .fld textarea { resize: vertical; }
  .hint { font-weight: 600; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }

  .block { display: flex; flex-direction: column; gap: 6px; }
  .b-cap { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .termin-ok { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); }
  .trail { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; }
  .maps { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); text-decoration: none; }

  .stars { display: flex; align-items: center; gap: 2px; }
  .star { border: none; background: none; cursor: pointer; font-size: calc(22px * var(--schrift, 1)); color: #d9cdb6; padding: 0 1px; line-height: 1; }
  .star.an { color: #e0a72b; }

  .fotos { display: flex; gap: 6px; flex-wrap: wrap; }
  .foto { position: relative; }
  .foto img { width: 66px; height: 66px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
  .foto .fx { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; border: none; background: #c0392b; color: #fff; font-size: calc(12px * var(--schrift, 1)); cursor: pointer; }
  .foto-btn { align-self: flex-start; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); border: 1px dashed var(--line-stark); border-radius: 8px; padding: 6px 10px; cursor: pointer; }
  .foto-btn input { display: none; }

  .status-wahl button { padding: 8px 12px; font-size: calc(13.5px * var(--schrift, 1)); }
  @media (max-width: 520px) {
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .trail { grid-template-columns: 1fr; }
  }

  .f { min-height: 44px; padding: 6px 14px; font-size: calc(13px * var(--schrift, 1)); }
  .c-del { width: 44px !important; height: 44px !important; }
  .c-name { min-height: 44px; font-size: calc(16px * var(--schrift, 1)); }
</style>
