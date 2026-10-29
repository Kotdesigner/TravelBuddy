<script>
  import { t } from './i18n.js'
  import { dezimal, zahl } from './format.js'
  // Notfall-Karte — funktioniert komplett OFFLINE.
  // Zeigt GPS-Standort (kopierbar), nächste Hilfe aus den Offline-POIs (Tank/Wasser/
  // Klinik/Werkstatt/Laden mit Entfernung & Richtung), Notrufnummern, Standort-Teilen
  // und ein „Ich bin OK"-Lebenszeichen-Log (exportierbar, im Backup).
  import { haversine } from './routing.js'
  import { REGIONEN, poiRegionFuer } from './karten-config.js'
  import { checkins, neuerCheckin, loescheCheckin } from './userdata.js'

  let pos = $state(null) // { lat, lon, acc, manuell }
  let posFehler = $state(null)
  let laedt = $state(false)
  let pois = $state([])
  let poiRegion = $state(null)
  let poiLaedt = $state(false)
  let meldung = $state('')
  let manLat = $state('')
  let manLon = $state('')

  const NOT_KAT = [
    { k: 'fuel', label: t('Tankstelle / Roadhouse'), emoji: '⛽' },
    { k: 'wasser', label: t('Trinkwasser'), emoji: '💧' },
    { k: 'klinik', label: t('Klinik / Arzt'), emoji: '🏥' },
    { k: 'werkstatt', label: t('Werkstatt'), emoji: '🔧' },
    { k: 'laden', label: t('Laden / Vorräte'), emoji: '🛒' },
  ]

  const NOTRUF = [
    { nr: '000', tel: '000', label: t('Notruf'), sub: t('Polizei · Feuer · Ambulanz'), haupt: true },
    { nr: '112', tel: '112', label: t('Mobil-Notruf'), sub: t('nutzt JEDES verfügbare Netz') },
    { nr: '106', tel: '106', label: t('SMS-Notruf'), sub: t('gehörlos / sprachlos (Text)') },
    { nr: '1800 625 800', tel: '1800625800', label: t('RFDS (WA, 24 h)'), sub: t('Flying Doctors, vor der Reise prüfen') },
  ]

  const DIRS = [['N', '⬆️'], ['NO', '↗️'], ['O', '➡️'], ['SO', '↘️'], ['S', '⬇️'], ['SW', '↙️'], ['W', '⬅️'], ['NW', '↖️']]
  function bearing(la1, lo1, la2, lo2) {
    const rad = Math.PI / 180
    const dLon = (lo2 - lo1) * rad
    const y = Math.sin(dLon) * Math.cos(la2 * rad)
    const x = Math.cos(la1 * rad) * Math.sin(la2 * rad) - Math.sin(la1 * rad) * Math.cos(la2 * rad) * Math.cos(dLon)
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  }
  const richtung = (b) => DIRS[Math.round(b / 45) % 8]

  // Nächster POI je Notfall-Kategorie in EINEM Durchlauf.
  const hilfen = $derived.by(() => {
    if (!pos || !pois.length) return []
    const best = {}
    for (const p of pois) {
      if (!NOT_KAT.some((c) => c.k === p.k)) continue
      const km = haversine(pos.lat, pos.lon, p.y, p.x)
      if (!best[p.k] || km < best[p.k].km) best[p.k] = { name: p.n || '', km, lat: p.y, lon: p.x }
    }
    return NOT_KAT.map((c) => {
      const b = best[c.k]
      if (b) { const [lbl, pfeil] = richtung(bearing(pos.lat, pos.lon, b.lat, b.lon)); b.richtung = lbl; b.pfeil = pfeil }
      return { ...c, nah: b }
    })
  })

  function zeigMeldung(t) { meldung = t; setTimeout(() => (meldung = ''), 1600) }

  function fehlerText(e) {
    if (e?.code === 1) return t('Standort-Freigabe verweigert. In den Browser-Einstellungen erlauben oder Koordinaten unten manuell eingeben.')
    if (e?.code === 2) return t('Kein GPS-Signal. Draußen erneut versuchen oder manuell eingeben.')
    if (e?.code === 3) return t('GPS-Abfrage zu langsam. Erneut versuchen.')
    return t('Standort nicht verfügbar. Manuell eingeben.')
  }

  function ortBestimmen() {
    posFehler = null; laedt = true
    if (!navigator.geolocation) { posFehler = t('GPS auf diesem Gerät nicht verfügbar.'); laedt = false; return }
    navigator.geolocation.getCurrentPosition(
      (p) => { pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), manuell: false }; laedt = false; ladePois(pos.lat, pos.lon) },
      (e) => { posFehler = fehlerText(e); laedt = false },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  }

  function manuellUebernehmen() {
    const leer = (v) => v == null || String(v).trim() === ''
    if (leer(manLat) || leer(manLon)) { zeigMeldung(t('⚠️ Bitte Breite und Länge eintragen')); return }
    const la = Number(String(manLat).replace(',', '.')), lo = Number(String(manLon).replace(',', '.'))
    if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) { zeigMeldung(t('⚠️ Ungültige Koordinaten')); return }
    pos = { lat: la, lon: lo, acc: null, manuell: true }; posFehler = null
    ladePois(la, lo)
  }

  async function ladePois(lat, lon) {
    // Nur Regionen, für die es `pois-<id>.json` gibt — die kleinste gewinnt, weil sie
    // die feinsten Daten für den Standort hat. Ohne diese Einschränkung träfe ein
    // Ostküsten-Punkt zuerst „Ostküste", und dafür gibt es keine POI-Datei.
    const reg = poiRegionFuer([[lon, lat]])
    if (!reg) { pois = []; poiRegion = null; return }
    if (poiRegion === reg.id && pois.length) return
    poiLaedt = true
    try {
      const res = await fetch(`/pois-${reg.id}.json`)
      pois = res.ok ? await res.json() : []
      poiRegion = res.ok ? reg.id : null
    } catch { pois = []; poiRegion = null }
    poiLaedt = false
  }

  const koordStr = () => (pos ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : '')
  const mapsUrl = (la, lo) => `https://www.google.com/maps?q=${la},${lo}`

  async function kopiere(txt) {
    try { await navigator.clipboard.writeText(txt); zeigMeldung(t('📋 kopiert')) }
    catch { zeigMeldung(t('Kopieren nicht möglich')) }
  }

  function standortText() {
    const d = new Date(), p = (x) => String(x).padStart(2, '0')
    const zeit = `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`
    return t('Mein Standort: {koordStr}\nKarte: {mapsUrl}\nZeit: {zeit}', { koordStr: koordStr(), mapsUrl: mapsUrl(pos.lat, pos.lon), zeit })
  }
  async function teileStandort() {
    if (!pos) return
    const text = standortText()
    try { if (navigator.share) { await navigator.share({ title: t('Mein Standort'), text }); return } }
    catch (e) { if (e?.name === 'AbortError') return }
    kopiere(text)
  }

  function checkin() {
    if (!pos) { ortBestimmen(); zeigMeldung(t('Erst Standort bestimmen')); return }
    neuerCheckin({ lat: pos.lat, lon: pos.lon })
    zeigMeldung(t('✅ Check-in gespeichert'))
  }

  function exportLog() {
    const zeilen = $checkins.map((c) => `${(c.tsLokal || c.ts || '').replace('T', ' ')} — ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}${c.text ? ' — ' + c.text : ''}`).join('\n')
    const blob = new Blob([t('Lebenszeichen-Log\n\n{zeilen}\n', { zeilen })], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Lebenszeichen-Log.txt'
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500)
  }

  function ciZeit(c) { return (c.tsLokal || '').replace('T', ' · ').slice(5) || (c.ts || '').slice(0, 16).replace('T', ' · ') }
</script>

<div class="notfall">
  <p class="hinweis">{t('🔌 Funktioniert komplett offline.')} <b>{t('Echter Notfall zuerst: 000.')}</b> {t('Ohne Handynetz brauchst du ein Satelliten-Gerät/EPIRB. Anrufe kann die App nicht ersetzen.')}</p>

  <!-- 1) Standort -->
  <section class="karte standort">
    <h3>{t('📍 Mein Standort')}</h3>
    {#if pos}
      <button class="koord-gross" onclick={() => kopiere(koordStr())} title={t('Koordinaten kopieren')}>
        <span class="kg-zahl">{koordStr()}</span>
        <span class="kg-sub">
          {t('{wert} · 📋 tippen zum Kopieren', { wert: pos.manuell ? t('✍️ manuell') : (pos.acc != null ? `±${pos.acc} m` : '') })}
        </span>
      </button>
      <div class="zeile">
        <button class="btn" onclick={ortBestimmen}>{laedt ? '⏳ …' : t('🔄 Aktualisieren')}</button>
        <a class="btn" href={mapsUrl(pos.lat, pos.lon)} target="_blank" rel="noopener">{t('🗺️ Auf Karte')}</a>
      </div>
    {:else}
      <button class="btn gross" onclick={ortBestimmen} disabled={laedt}>{laedt ? t('⏳ Bestimme Standort …') : t('📍 Standort bestimmen')}</button>
    {/if}
    {#if posFehler}<p class="fehler">{posFehler}</p>{/if}

    <details class="manuell">
      <summary>{t('Koordinaten manuell eingeben')}</summary>
      <div class="man-zeile">
        <input type="number" step="0.0001" bind:value={manLat} placeholder={t('Lat (z.B. -25.90)')} />
        <input type="number" step="0.0001" bind:value={manLon} placeholder={t('Lon (z.B. 113.53)')} />
        <button class="btn" onclick={manuellUebernehmen}>{t('Übernehmen')}</button>
      </div>
    </details>
  </section>

  <!-- 2) Notruf -->
  <section class="karte">
    <h3>{t('🆘 Notruf')}</h3>
    <div class="notruf-grid">
      {#each NOTRUF as n}
        <a class="notruf" class:haupt={n.haupt} href={`tel:${n.tel}`}>
          <span class="n-nr">{n.nr}</span>
          <span class="n-label">{n.label}</span>
          <span class="n-sub">{n.sub}</span>
        </a>
      {/each}
    </div>
  </section>

  <!-- 3) Nächste Hilfe -->
  <section class="karte">
    <h3>{t('🧭 Nächste Hilfe')} {#if poiRegion}<span class="reg">· {REGIONEN.find((r) => r.id === poiRegion)?.name}</span>{/if}</h3>
    {#if !pos}
      <p class="leer">{t('Erst')} <b>{t('Standort bestimmen')}</b>{t('. Dann zeigt die App die nächste Tankstelle, Wasser, Klinik, Werkstatt & Läden mit Entfernung und Richtung.')}</p>
    {:else if poiLaedt}
      <p class="leer">{t('⏳ Lade Offline-Punkte …')}</p>
    {:else if !pois.length}
      <p class="leer">{t('Keine Offline-Punkte für diese Region geladen.')}</p>
    {:else}
      <div class="hilfe-liste">
        {#each hilfen as h}
          <div class="hilfe" class:leer2={!h.nah}>
            <span class="h-emoji">{h.emoji}</span>
            <div class="h-txt">
              <span class="h-label">{h.label}</span>
              {#if h.nah}
                <span class="h-name">{h.nah.name || t('unbenannt')}</span>
              {:else}
                <span class="h-name none">{t('nichts in Reichweite')}</span>
              {/if}
            </div>
            {#if h.nah}
              <div class="h-dist">
                <span class="h-km">{h.nah.pfeil} {h.nah.km < 10 ? dezimal(h.nah.km, 1) : zahl(h.nah.km)} km</span>
                <span class="h-ri">{h.nah.richtung}</span>
              </div>
              <a class="h-go" href={mapsUrl(h.nah.lat, h.nah.lon)} target="_blank" rel="noopener" title={t('Route')}>→</a>
            {/if}
          </div>
        {/each}
      </div>
      <p class="mini">{t('Luftlinie & Richtung ab deinem Standort. Route (→) öffnet Google Maps, sobald du wieder Netz hast.')}</p>
    {/if}
  </section>

  <!-- 4) Teilen & Check-in -->
  <section class="karte">
    <h3>{t('📤 Standort teilen & Check-in')}</h3>
    <div class="zeile">
      <button class="btn breit" onclick={teileStandort} disabled={!pos}>{t('📍 Standort teilen')}</button>
      <button class="btn breit ok" onclick={checkin}>{t('✅ Ich bin OK')}</button>
    </div>
    <p class="mini">{t('„Ich bin OK" speichert Zeit + Ort als Lebenszeichen (unten). Alles liegt im Backup.')}</p>

    {#if $checkins.length}
      <div class="log-kopf">
        <span class="log-titel">{t('🫡 Lebenszeichen ({length})', { length: $checkins.length })}</span>
        <button class="mini-btn" onclick={exportLog}>{t('⬇️ Export .txt')}</button>
      </div>
      <ul class="log">
        {#each $checkins as c (c.id)}
          <li>
            <span class="l-zeit">{ciZeit(c)}</span>
            <button class="l-koord" onclick={() => kopiere(`${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`)} title={t('kopieren')}>{c.lat.toFixed(4)}, {c.lon.toFixed(4)}</button>
            <a class="l-go" href={mapsUrl(c.lat, c.lon)} target="_blank" rel="noopener">🗺️</a>
            <button class="l-del" onclick={() => loescheCheckin(c.id)} title={t('löschen')}>✕</button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#if meldung}<div class="toast">{meldung}</div>{/if}
</div>

<style>
  .notfall { display: flex; flex-direction: column; gap: 12px; max-width: 620px; }
  .hinweis { font-size: calc(12.5px * var(--schrift, 1)); color: var(--warn-text); background: var(--warn-flaeche); border: 1px solid #f0cba6; border-radius: 10px; padding: 10px 13px; margin: 0; line-height: 1.5; }

  .karte { background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 13px 15px; }
  .karte h3 { margin: 0 0 10px; font-size: calc(14px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .karte h3 .reg { font-weight: 600; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }

  .standort { border-top: 4px solid #c0392b; }
  .koord-gross { width: 100%; display: flex; flex-direction: column; gap: 3px; align-items: center; background: var(--flaeche); border: 1px solid var(--line); border-radius: 10px; padding: 14px; cursor: pointer; }
  .kg-zahl { font-size: calc(clamp(22px, 6vw, 30px) * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.02em; color: var(--ink); font-variant-numeric: tabular-nums; }
  .kg-sub { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }

  .zeile { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 9px 14px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.gross { width: 100%; justify-content: center; font-size: calc(15px * var(--schrift, 1)); padding: 14px; background: #c0392b; color: #fff; border-color: #c0392b; }
  .btn.breit { flex: 1; justify-content: center; }
  .btn.ok { background: #2f7a63; color: #fff; border-color: #2f7a63; }
  .fehler { font-size: calc(12px * var(--schrift, 1)); color: var(--danger-text); margin: 9px 0 0; line-height: 1.45; }

  .manuell { margin-top: 10px; }
  .manuell summary { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); cursor: pointer; font-weight: 600; }
  .man-zeile { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .man-zeile input { flex: 1 1 110px; font-size: calc(13px * var(--schrift, 1)); padding: 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); color: var(--ink); }

  .notruf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .notruf { display: flex; flex-direction: column; gap: 1px; text-decoration: none; background: var(--flaeche); border: 1px solid var(--line); border-radius: 10px; padding: 10px 13px; color: var(--ink); }
  .notruf.haupt { background: var(--danger-flaeche); border-color: #e3b7b0; grid-column: 1 / -1; }
  .n-nr { font-size: calc(22px * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.02em; color: var(--danger-text); }
  .notruf:not(.haupt) .n-nr { font-size: calc(18px * var(--schrift, 1)); color: var(--ink); }
  .n-label { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; }
  .n-sub { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }

  .leer { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); background: var(--flaeche); border-radius: 8px; padding: 12px; margin: 0; line-height: 1.5; }
  .hilfe-liste { display: flex; flex-direction: column; gap: 6px; }
  .hilfe { display: flex; align-items: center; gap: 10px; padding: 9px 11px; background: var(--flaeche); border: 1px solid var(--line); border-radius: 9px; }
  .hilfe.leer2 { opacity: 0.6; }
  .h-emoji { font-size: calc(20px * var(--schrift, 1)); }
  .h-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .h-label { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  .h-name { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .h-name.none { font-weight: 500; color: var(--muted); }
  .h-dist { text-align: right; display: flex; flex-direction: column; }
  .h-km { font-size: calc(14px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); white-space: nowrap; }
  .h-ri { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 700; }
  .h-go { text-decoration: none; font-size: calc(18px * var(--schrift, 1)); font-weight: 800; color: #2f7a63; padding: 0 4px; }
  .mini { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin: 9px 0 0; }

  .log-kopf { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
  .log-titel { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .mini-btn { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 5px 10px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 16px; cursor: pointer; }
  .log { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .log li { display: flex; align-items: center; gap: 8px; font-size: calc(12.5px * var(--schrift, 1)); padding: 5px 8px; background: var(--flaeche); border-radius: 7px; }
  .l-zeit { font-weight: 700; color: var(--ink); white-space: nowrap; }
  .l-koord { flex: 1; text-align: left; border: none; background: none; cursor: pointer; color: var(--brand-text); font-weight: 600; font-size: calc(12.5px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .l-go { text-decoration: none; }
  .l-del { border: none; background: none; color: var(--danger-text); cursor: pointer; font-size: calc(12px * var(--schrift, 1)); }

  .toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: #2b2621; color: #fff; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 10px 18px; border-radius: 22px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); z-index: 60; }

  @media (max-width: 520px) { .notruf-grid { grid-template-columns: 1fr; } }
</style>
