<script>
  import { t, LOCALE, tn, je } from './i18n.js'
  import { userData, updateOrt, reisen, stopHinzufuegen, neueReise, uid, journal, neuerJournalEintrag } from './userdata.js'
  import SonneWetter from './SonneWetter.svelte'
  import { STUFE_FARBE } from './gefahren.js'
  import { schriftAuf } from './kontrast.js'
  import { macheThumbnail, heute } from './thumbnail.js'
  import { istWanderung, istPerle } from './wander-orte.js'
  import { istRoute, abstandZurRoute, ymd as ymdPlan } from './plan.js'
  import { norm } from './suche.js'
  import { geh } from './navigation.js'
  import { oeffneNeu } from './neu.js'
  import { zeigeToast } from './toast.js'
  import { loeschFrage } from './dialog.js'
  import { updateEigenenOrt } from './userdata.js'
  import { holeOrtsdaten } from './ortdaten.js'
  import { rubrikPatch } from './rubrik.js'
  import { online } from './netz.js'

  // Eigene Orte auf denselben Stand bringen wie die hinterlegten 88:
  // Koordinaten (→ Sonne/Sterne/Wetter), Region, Beschreibung und Vorschaubild.
  let holt = $state(false)
  let holMsg = $state('')
  async function datenHolen() {
    holt = true; holMsg = ''
    try {
      const d = await holeOrtsdaten(ort.name, { lat: ort.lat, lon: ort.lon })
      const patch = {}
      if (ort.lat == null && d.lat != null) { patch.lat = d.lat; patch.lon = d.lon }
      // Abschnitt + Region wie bei den 88 aus der Lage ableiten.
      Object.assign(patch, rubrikPatch(ort, patch.lat ?? ort.lat, patch.lon ?? ort.lon))
      // Eigene Notiz nie überschreiben — den Lexikon-Text daneben als „info“ sichern.
      if (d.beschreibung) {
        if (!(ort.beschreibung || '').trim()) patch.beschreibung = d.beschreibung
        else if (d.beschreibung.trim() !== (ort.beschreibung || '').trim()) patch.info = d.beschreibung
      }
      if (d.bildData) patch.bildData = d.bildData   // auf Wunsch auch ein vorhandenes Bild ersetzen
      if (Object.keys(patch).length) { ortSpeichern(ort.id, patch); holMsg = t('✓ ergänzt') }
      else holMsg = t('nichts Neues gefunden')
    } catch { holMsg = t('fehlgeschlagen') }
    holt = false
    setTimeout(() => (holMsg = ''), 3500)
  }

  let { ort, gefahr = null, warnung = null } = $props()
  let textAuf = $state(false)
  let saisonAuf = $state(false)
  // Kurze Beschreibungen brauchen keinen Aufklapper — sonst steht unter jedem
  // Zweizeiler ein sinnloses „mehr“.
  const langerText = $derived((ort.beschreibung || '').length > 190)
  const alleReisen = $derived($reisen)
  const allesJournal = $derived($journal)
  const tagebuchAnker = 'tagebuch'
  const ortSpeichern = (id, patch) => updateEigenenOrt(id, patch)

  // Eigene Orte lassen sich wie die Vorschläge kennzeichnen.
  const STANDARD_TAGS = ['MUSS-SEHEN', 'GEHEIMTIPP', 'NUR-4WD', 'EXPEDITION']
  function tagUm(t) {
    const cur = ort.tags || []
    ortSpeichern(ort.id, { tags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] })
  }

  let zeigeReiseWahl = $state(false)
  let hinzugefuegt = $state('')
  let hTimer
  function flash(m) { hinzugefuegt = m; clearTimeout(hTimer); hTimer = setTimeout(() => (hinzugefuegt = ''), 2200) }

  // Einplanen = in eine Route (die passendste zuerst), neue Route, oder als Wanderung.
  const routen = $derived(alleReisen.filter(istRoute))
  const routenNachNaehe = $derived(routen.map((r) => ({ r, km: abstandZurRoute(r, ort) })).sort((a, b) => a.km - b.km))
  // In welchen Routen steckt dieser Ort schon?
  const inRouten = $derived(routen.filter((r) => (r.stops || []).some((s) => norm(s.name) === norm(ort.name)
    || (s.lat != null && ort.lat != null && Math.abs(s.lat - ort.lat) < 0.02 && Math.abs(s.lon - ort.lon) < 0.02))))
  function zuReise(rid, rname) {
    const { nach } = stopHinzufuegen(rid, { name: ort.name, lat: ort.lat ?? null, lon: ort.lon ?? null })
    zeigeReiseWahl = false
    flash('✓ in ' + rname)
    zeigeToast(nach ? t('{name} in „{rname}“ nach {nach} eingefügt', { name: ort.name, rname, nach }) : t('{name} als Start von „{rname}“ eingefügt', { name: ort.name, rname }), 'ok')
  }
  function zuNeuerReise() {
    zeigeReiseWahl = false
    oeffneNeu('route', { stops: [{ name: ort.name, lat: ort.lat ?? null, lon: ort.lon ?? null, img: null }] })
  }
  function alsWanderung() {
    zeigeReiseWahl = false
    oeffneNeu('wanderung', { name: ort.name, ort: { name: ort.name, lat: ort.lat ?? null, lon: ort.lon ?? null, ortId: ort.id, region: ort.region || '', quelle: 'ort' } })
  }

  // Nutzerdaten dieses Ortes (reaktiv aus dem globalen Store).
  const eintrag = $derived($userData[ort.id] || { notiz: '', bericht: '', bilder: [], tagebuch: [] })
  const hatNotiz = $derived(!!(eintrag.notiz && eintrag.notiz.trim()))
  const hatBericht = $derived(!!(eintrag.bericht && eintrag.bericht.trim()))
  const tagebuch = $derived(eintrag.tagebuch || [])
  const hatInhalt = $derived(hatNotiz || hatBericht || tagebuch.length > 0 || (eintrag.bilder?.length > 0))

  let offen = $state(false)

  // Anzuzeigendes Bild: eigenes Foto > Original > Emoji-Fallback
  const bildSrc = $derived(
    (eintrag.bilder && eintrag.bilder[0]) || ort.bildData || (ort.bild ? '/' + ort.bild : null)
  )

  const mapsUrl = $derived(
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ort.mapsQuery)
  )

  function tagClass(t) {
    return 'tag-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }

  function setNotiz(e) { updateOrt(ort.id, { notiz: e.target.value }) }
  function setBericht(e) { updateOrt(ort.id, { bericht: e.target.value }) }

  async function addFoto(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      const thumb = await macheThumbnail(f)
      updateOrt(ort.id, { bilder: [...(eintrag.bilder || []), thumb] })
    } catch {}
  }

  function removeFoto(i) {
    const bilder = (eintrag.bilder || []).filter((_, idx) => idx !== i)
    updateOrt(ort.id, { bilder })
  }

  // --- Tagebuch: EIN Tagebuch — hier nur Verweis + Alt-Einträge ---
  // Neue Reisetage entstehen im großen Reisetagebuch (mit Orts-Verknüpfung);
  // alte Orts-Einträge bleiben lesbar/löschbar.
  const grossesTagebuch = $derived(allesJournal.filter((e) => e.ortId === ort.id))
  function tagAnlegen() {
    oeffneNeu('tag', { ort: { ort: ort.name, ortId: ort.id, lat: ort.lat ?? null, lon: ort.lon ?? null } })
  }
  function tagebuchDel(id) {
    updateOrt(ort.id, { tagebuch: tagebuch.filter((t) => t.id !== id) })
  }
  function tagebuchSetText(id, text) {
    updateOrt(ort.id, { tagebuch: tagebuch.map((t) => (t.id === id ? { ...t, text } : t)) })
  }
  function tagebuchSetDatum(id, datum) {
    updateOrt(ort.id, { tagebuch: tagebuch.map((t) => (t.id === id ? { ...t, datum } : t)) })
  }
  async function tagebuchFoto(id, e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      const thumb = await macheThumbnail(f)
      updateOrt(ort.id, { tagebuch: tagebuch.map((t) => (t.id === id ? { ...t, fotos: [...(t.fotos || []), thumb] } : t)) })
    } catch {}
  }
  function tagebuchFotoDel(id, i) {
    updateOrt(ort.id, { tagebuch: tagebuch.map((t) => (t.id === id ? { ...t, fotos: (t.fotos || []).filter((_, idx) => idx !== i) } : t)) })
  }
  const fmtDatum = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d } }
</script>

<article class="card" id="ort-{ort.id}" tabindex="-1">
  <div class="img">
    {#if bildSrc}
      <img src={bildSrc} alt={ort.name} loading="lazy" />
    {:else}
      <div class="fallback"><span>{ort.emoji || '📍'}</span></div>
    {/if}
    <!-- Alle Marken in EINEM Behälter. Am Schreibtisch sitzen sie wie bisher in den
         Ecken; auf dem Handy (152 px Kachelbreite) stießen sie dort zusammen, deshalb
         werden sie dort zu einer Reihe am unteren Bildrand. Reihenfolge im Markup =
         Wichtigkeit: Gefahr zuerst. `.lang` sind die Wortteile, die auf dem Handy
         wegfallen — die volle Auskunft steht weiterhin im title. -->
    <div class="marken">
      {#if warnung}
        <span class="warn" style="background:{warnung.farbe};color:{schriftAuf(warnung.farbe)}" title="{warnung.titel}{warnung.km > 1 ? ', ' + t('{km} km entfernt', { km: Math.round(warnung.km) }) : ''}">
          {warnung.icon}<span class="lang"> {warnung.level}</span>{#if warnung.km > 1}<span class="km"> {Math.round(warnung.km)} km</span>{/if}
        </span>
      {:else if gefahr && gefahr.stufe >= 2}
        {@const typen = gefahr.gefahren.filter((g) => g.stufe >= 2).map((g) => g.typ)}
        <span class="warn" style="background:{STUFE_FARBE[gefahr.stufe]};color:{schriftAuf(STUFE_FARBE[gefahr.stufe])}" title={gefahr.gefahren.map((g) => g.typ + ': ' + g.text).join(' · ')}>
          {gefahr.gefahren[0]?.icon}<span class="lang"> {typen.join(', ')}</span>{#if typen.length > 1}<span class="km"> {typen.length}</span>{/if}
        </span>
      {/if}
      {#if ort.tags?.length}
        <span class="badge" title={ort.tags.join(' · ')}>{ort.tags[0]}</span>
      {/if}
      {#if istPerle(ort.name)}
        <span class="wander perle" title={t('Wander-Perle: eine der besten Wanderungen der Route')}>🌟<span class="lang"> {je('Wander-', 'Hiking ')}</span>{t('Perle')}</span>
      {:else if istWanderung(ort.name)}
        <span class="wander" title={t('Hier lässt sich (auch) wandern')}>🥾<span class="lang"> {t('Wanderung')}</span></span>
      {/if}
    </div>
  </div>

  <div class="body">
    <div class="head">
      <span class="name">{ort.name}</span>
      <button
        class="bubble"
        class:has={hatInhalt}
        title={t('Notiz / Bericht / Tagebuch')}
        onclick={() => (offen = !offen)}
      >{tagebuch.length > 0 ? '📖' : '💬'}</button>
    </div>

    {#if inRouten.length}
      <p class="in-route">🧭 in {inRouten.map((r) => r.name).join(', ')}</p>
    {/if}
    {#if ort.tags?.length}
      <div class="tags">
        {#each ort.tags as tag}
          <span class="tagpill {tagClass(tag)}">{t(tag)}</span>
        {/each}
      </div>
    {/if}

    <!-- Die Ostküsten-Orte haben lange Beschreibungen (Ø 364 statt 157 Zeichen bei den
         alten). Ungekürzt macht das die Kacheln unübersichtlich. Also drei Zeilen
         anreißen und auf Wunsch aufklappen — der Text geht nicht verloren. -->
    <p class="desc" class:kurz={!textAuf && langerText}>{ort.beschreibung}</p>
    {#if langerText}
      <button class="mehr-btn" onclick={() => (textAuf = !textAuf)}>
        {textAuf ? t('▲ weniger') : t('▾ mehr')}
      </button>
    {/if}
    {#if ort.saison}
      {#if saisonAuf}
        <p class="saison">☀️ <b>{t('Dezember / Januar:')}</b> {ort.saison}
          <button class="mehr-btn" onclick={() => (saisonAuf = false)}>▲ zu</button></p>
      {:else}
        <button class="saison-btn" onclick={() => (saisonAuf = true)}>{t('☀️ Dez/Jan: was gilt ▾')}</button>
      {/if}
    {/if}
    {#if ort.info}<p class="info-text">{ort.info}</p>{/if}

    {#if hatBericht && !offen}
      <p class="bericht-preview">📝 {eintrag.bericht}</p>
    {/if}

    {#if offen}
      <div class="editor">
        <label>{t('Notiz')}
          <textarea rows="2" value={eintrag.notiz || ''} oninput={setNotiz}
            placeholder={t('Kurze Notiz …')}></textarea>
        </label>
        <label>{t('Bericht / Erfahrung')}
          <textarea rows="4" value={eintrag.bericht || ''} oninput={setBericht}
            placeholder={t('Wie war es hier? Was solltest du dir merken?')}></textarea>
        </label>

        {#if eintrag.bilder?.length}
          <div class="fotos">
            {#each eintrag.bilder as b, i}
              <div class="foto">
                <img src={b} alt={t('eigenes Foto')} />
                <button class="x" title={t('Entfernen')} onclick={() => removeFoto(i)}>✕</button>
              </div>
            {/each}
          </div>
        {/if}

        <label class="file-btn">{t('📷 Foto hinzufügen (wird verkleinert)')}
          <input type="file" accept="image/*" onchange={addFoto} />
        </label>

        <!-- Tagebuch: EIN Tagebuch — Verweis ins große Reisetagebuch -->
        <div class="tb">
          <div class="tb-titel">{t('📓 Logbuch')}</div>
          <div class="tb-verweis">
            {#if grossesTagebuch.length}
              <a class="tb-link" href="#/logbuch/tag/{grossesTagebuch[0].datum}" onclick={(e) => { e.preventDefault(); geh('logbuch/tag/' + grossesTagebuch[0].datum) }}>{tn(grossesTagebuch.length, '{n} Reisetag zu diesem Ort → ansehen', '{n} Reisetage zu diesem Ort → ansehen')}</a>
            {:else}
              <span class="tb-keine">{t('Noch kein Reisetag zu diesem Ort.')}</span>
            {/if}
            <button class="tb-add" onclick={tagAnlegen}>{t('＋ Reisetag anlegen')}</button>
          </div>
          {#if tagebuch.length}<div class="tb-alt">{t('Ältere Orts-Notizen (neue Tage entstehen oben im Logbuch):')}</div>{/if}
          {#each tagebuch as eintr (eintr.id)}
            <div class="tb-eintrag">
              <div class="tb-kopf">
                <input class="tb-datum" type="date" value={eintr.datum} onchange={(e) => tagebuchSetDatum(eintr.id, e.target.value)} />
                <button class="tb-del" onclick={() => tagebuchDel(eintr.id)} title={t('Eintrag löschen')}>✕</button>
              </div>
              <textarea class="tb-text" rows="2" value={eintr.text} oninput={(e) => tagebuchSetText(eintr.id, e.target.value)} placeholder={t('Was war an diesem Tag?')}></textarea>
              {#if eintr.fotos?.length}
                <div class="fotos">
                  {#each eintr.fotos as f, i}
                    <div class="foto"><img src={f} alt={t('Tagebuch-Foto')} /><button class="x" onclick={() => tagebuchFotoDel(eintr.id, i)}>✕</button></div>
                  {/each}
                </div>
              {/if}
              <label class="tb-foto">{t('📷 Foto')}<input type="file" accept="image/*" onchange={(e) => tagebuchFoto(eintr.id, e)} /></label>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if ort.lat != null}
      <SonneWetter lat={ort.lat} lon={ort.lon} />
    {/if}

    {#if ort.eigen && $online}
      <div class="eigen-tags">
        <span class="et-titel">{t('Kennzeichnung')}</span>
        {#each STANDARD_TAGS as tagName}
          <button class="e-tag {tagClass(tagName)}" class:an={(ort.tags || []).includes(tagName)}
            onclick={() => tagUm(tagName)} title={t('Kennzeichnung umschalten')}>{t(tagName)}</button>
        {/each}
      </div>
      <div class="eigen-daten">
        <button class="e-btn" onclick={datenHolen} disabled={holt}>{holt ? t('⏳ hole Daten …') : t('✨ Daten & Bild holen')}</button>
        {#if holMsg}<span class="e-msg">{holMsg}</span>{/if}
        {#if ort.lat == null}<span class="e-hinweis">{t('ohne Koordinaten: keine Sonnen-/Sternen-Zeiten und keine Rubrik. Der Knopf holt beides.')}</span>{/if}
      </div>
    {/if}

    <div class="aktionen">
      <a class="maps" href={mapsUrl} target="_blank" rel="noopener">{t('📍 Google Maps')}</a>
      <div class="reise-wrap">
        <button class="reise-btn" onclick={() => (zeigeReiseWahl = !zeigeReiseWahl)} aria-expanded={zeigeReiseWahl}>
          {#if hinzugefuegt}{hinzugefuegt}{:else}{t('➕ Einplanen')}{/if}
        </button>
        {#if zeigeReiseWahl}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="rm-hg" onclick={() => (zeigeReiseWahl = false)} aria-hidden="true"></div>
          <div class="reise-menu" role="menu" aria-label={t('{name} einplanen', { name: ort.name })}>
            <span class="rm-kopf">{ort.name}</span>
            {#if routenNachNaehe.length}<span class="rm-titel">{t('In eine Route')}</span>{/if}
            {#each routenNachNaehe as { r, km } (r.id)}
              <button role="menuitem" onclick={() => zuReise(r.id, r.name)}><span class="dot" style="background:{r.farbe}"></span><span class="rm-name">{r.name}{#if km < 60}<small>{t('{round} km von der Strecke', { round: Math.round(km) })}</small>{/if}</span></button>
            {/each}
            <button role="menuitem" class="neu" onclick={zuNeuerReise}>{t('＋ Neue Route mit diesem Ort')}</button>
            <button role="menuitem" class="neu" onclick={alsWanderung}>{t('🥾 Als Wanderung merken')}</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</article>

<style>
  .in-route { margin: 2px 0 4px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); }
  .rm-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); padding: 4px 10px 0; }
  .rm-name { display: flex; flex-direction: column; text-align: left; line-height: 1.25; }
  .rm-name small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .card {
    border: 1px solid var(--line); border-radius: 10px; overflow: hidden;
    background: var(--card); display: flex; flex-direction: column; box-shadow: var(--shadow);
  }
  .img { height: 150px; background: #efe6d6; position: relative; }
  .img img { width: 100%; height: 150px; object-fit: cover; display: block; }
  .fallback {
    width: 100%; height: 150px; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #efe6d6, #e0d3ba);
  }
  .fallback span { font-size: calc(46px * var(--schrift, 1)); opacity: 0.75; }
  .marken { display: contents; }   /* am Schreibtisch: Kinder bleiben in den Ecken */
  .badge {
    position: absolute; top: 8px; right: 8px; background: rgba(43,38,33,0.72); color: #fff;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 2px 7px; border-radius: 9px; letter-spacing: 0.3px;
  }
  .warn {
    position: absolute; top: 8px; left: 8px; color: #fff; font-size: calc(12px * var(--schrift, 1)); font-weight: 800;
    padding: 3px 8px; border-radius: 9px; box-shadow: 0 1px 4px rgba(0,0,0,0.4); max-width: 70%;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .wander {
    position: absolute; bottom: 8px; left: 8px; color: #fff; font-size: calc(12px * var(--schrift, 1)); font-weight: 800;
    padding: 3px 8px; border-radius: 9px; box-shadow: 0 1px 4px rgba(0,0,0,0.4); letter-spacing: 0.2px;
    background: #2f7a63;
  }
  .wander.perle { background: linear-gradient(135deg, #e0a72b, #c1662f); }
  .body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .name { font-weight: 700; font-size: calc(15px * var(--schrift, 1)); color: var(--ink); }
  .bubble {
    border: none; cursor: pointer; font-size: calc(14px * var(--schrift, 1)); line-height: 1; padding: 5px 9px;
    border-radius: 12px 12px 12px 3px; background: #d9d3c7; filter: grayscale(1); flex: 0 0 auto;
  }
  .bubble.has { background: var(--accent); filter: none; box-shadow: 0 1px 3px rgba(224,123,40,0.5); }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .desc { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); margin: 0; }
  .info-text {
    font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin: 0; line-height: 1.5; flex: 1;
    border-left: 2px solid var(--line-stark); padding-left: 8px; opacity: 0.9;
  }
  .bericht-preview {
    font-size: calc(12.5px * var(--schrift, 1)); color: var(--btn-ink); background: var(--btn-flaeche); border-left: 3px solid var(--brand-2);
    padding: 6px 9px; margin: 0; border-radius: 0 6px 6px 0;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .editor { display: flex; flex-direction: column; gap: 8px; }
  .editor label { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); display: flex; flex-direction: column; gap: 3px; }
  .editor textarea {
    width: 100%; font-size: calc(13px * var(--schrift, 1)); padding: 7px 8px; border: 1px solid var(--line-stark); border-radius: 6px;
    background: var(--eingabe); font-family: inherit; resize: vertical; font-weight: 400; color: var(--ink);
  }
  .fotos { display: flex; flex-wrap: wrap; gap: 6px; }
  .foto { position: relative; }
  .foto img { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
  .foto .x {
    position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%;
    border: none; background: #c0392b; color: #fff; font-size: calc(12px * var(--schrift, 1)); cursor: pointer;
  }
  .file-btn {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); border: 1px dashed var(--line-stark);
    border-radius: 8px; padding: 6px 10px; cursor: pointer; text-align: center; background: var(--card);
  }
  .file-btn input { display: none; }

  .tb { border-top: 1px dashed var(--line); padding-top: 8px; display: flex; flex-direction: column; gap: 7px; }
  .tb-titel { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; color: var(--btn-ink); }
  .tb-verweis { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .tb-link { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ok); text-decoration: none; }
  .tb-link:hover { text-decoration: underline; }
  .tb-keine { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .tb-alt { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-style: italic; }
  .tb-eintrag { background: var(--flaeche); border: 1px solid #ece0cc; border-radius: 8px; padding: 7px 8px; display: flex; flex-direction: column; gap: 5px; }
  .tb-kopf { display: flex; align-items: center; justify-content: space-between; }
  .tb-datum { font-size: calc(12px * var(--schrift, 1)); padding: 3px 6px; border: 1px solid var(--line-stark); border-radius: 5px; background: var(--card); }
  .tb-del { border: none; background: none; color: var(--danger-text); cursor: pointer; font-size: calc(13px * var(--schrift, 1)); }
  .tb-text { width: 100%; font-size: calc(12.5px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); font-family: inherit; resize: vertical; color: var(--ink); }
  .tb-foto { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); cursor: pointer; align-self: flex-start; }
  .tb-foto input { display: none; }
  .tb-neu { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
  .tb-neutext { flex: 1 1 120px; font-size: calc(12.5px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); color: var(--ink); }
  .tb-add { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 6px 10px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 6px; cursor: pointer; }
  .tb-add:disabled { opacity: 0.4; }
  .eigen-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
  .et-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-right: 2px; }
  .e-tag {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.3px; color: #fff; border: none;
    border-radius: 9px; padding: 4px 9px; min-height: 26px; cursor: pointer;
    transition: background var(--t-fast) var(--ease-out);
  }
  /* Aus: lesbar (Kontrast ≥ 3 : 1), aber deutlich als „nicht gewählt“. */
  .e-tag:not(.an) { background: var(--card); color: var(--muted); box-shadow: inset 0 0 0 1.5px var(--line-stark); }
  .eigen-daten { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .e-btn { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 8px 12px; min-height: 44px; border: 1px solid var(--ok-linie);
    background: var(--ok-flaeche); color: var(--ok-text); border-radius: 18px; cursor: pointer; }
  .e-btn:disabled { opacity: 0.6; cursor: default; }
  .e-msg { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .e-hinweis { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-style: italic; }
  .aktionen { margin-top: auto; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .maps {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--info-text); text-decoration: none;
    background: var(--info-flaeche); border: 1px solid var(--info-linie); padding: 6px 10px; border-radius: 6px;
  }
  .maps:hover { background: #d7e8f5; }
  .reise-wrap { position: relative; }
  .reise-btn {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); background: var(--ok-flaeche); border: 1px solid var(--ok-linie);
    padding: 6px 10px; border-radius: 6px; cursor: pointer;
  }
  .reise-btn:hover { background: #d7ece3; }
  .reise-menu {
    position: absolute; bottom: calc(100% + 4px); left: 0; z-index: 20; background: var(--card);
    border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.18);
    padding: 5px; min-width: 170px; max-height: 220px; overflow-y: auto;
    transform-origin: bottom left; animation: rm-auf var(--t-med) var(--ease-spring);
  }
  @keyframes rm-auf { from { opacity: 0; transform: translateY(6px) scale(0.97); } }
  @keyframes rm-hoch { from { opacity: 0.4; transform: translateY(40px); } }
  @keyframes rm-hg { from { opacity: 0; } }
  .reise-menu button {
    display: flex; align-items: center; gap: 7px; width: 100%; text-align: left; border: none;
    background: none; padding: 7px 8px; font-size: calc(12.5px * var(--schrift, 1)); cursor: pointer; border-radius: 6px; color: var(--ink);
  }
  .reise-menu button:hover { background: var(--flaeche-2); }
  .reise-menu .dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
  .reise-menu .neu { color: var(--ok-text); font-weight: 700; border-top: 1px solid var(--line); margin-top: 3px; }
  .rm-hg { position: fixed; inset: 0; z-index: 19; }
  .rm-kopf { display: none; }
  /* iPhone: als Blatt über der Leiste, nicht als Klappmenü, das am Kachelrand abgeschnitten wird */
  @media (max-width: 899px) {
    .rm-hg { background: rgba(20, 14, 8, 0.35); z-index: 129; animation: rm-hg var(--t-med) var(--ease-out); }
    .reise-menu {
      position: fixed; left: 10px; right: 10px; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); top: auto;
      max-height: 62dvh; min-width: 0; z-index: 130; border-radius: 18px; padding: 8px; box-shadow: var(--shadow-float);
      animation: rm-hoch var(--t-slow) var(--ease-spring);
    }
    .reise-menu button { min-height: 50px; font-size: calc(15.5px * var(--schrift, 1)); }
    .rm-kopf { display: block; font-size: calc(17px * var(--schrift, 1)); font-weight: 800; padding: 6px 10px 2px; color: var(--ink); }
  }
  .desc.kurz {
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .mehr-btn {
    /* 32 px hoch statt 19 — auf dem iPhone traf man „mehr“ kaum */
    display: inline-flex; align-items: center; min-height: 32px; position: relative;
    background: none; border: none; padding: 0 6px 0 0; margin: -4px 0 2px;
    color: var(--brand-text); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; cursor: pointer;
  }
  .saison-btn {
    display: inline-block; margin: 2px 0 6px; padding: 4px 10px;
    background: #fdf0e6; border: 1px solid #eab98d; border-radius: 14px;
    color: #8a5a2b; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; cursor: pointer;
  }
  :global([data-theme='dark']) .saison-btn { background: #3a2a1c; border-color: #6b4a2a; color: #e8c9a0; }
  .saison {
    background: #fdf0e6; border-left: 3px solid #eab98d; border-radius: 0 8px 8px 0;
    padding: 7px 10px; margin: 2px 0 6px; font-size: calc(12.5px * var(--schrift, 1)); line-height: 1.45;
  }
  :global([data-theme='dark']) .saison { background: #3a2a1c; border-left-color: #6b4a2a; }

  /* Zweispaltig am Handy: die Kachel ist dann nur noch ~170 px breit.
     Bild flacher, Schrift eine Spur kleiner, Etiketten dürfen umbrechen —
     sonst quillt der Inhalt aus der Spalte. */
  @media (max-width: 520px) {
    /* Bild UND Inhalt auf dieselbe Höhe. Nur .img zu verkleinern reichte nicht:
       das <img> blieb auf 150 px und quoll unten aus dem Rahmen — es sah aus wie
       ein zweites Bild und schob sich über den Text. */
    .img { height: 104px; overflow: hidden; }
    .img img, .fallback { height: 104px; }
    .fallback span { font-size: calc(34px * var(--schrift, 1)); }
    /* Das Etikett (MUSS-SEHEN, GEHEIMTIPP …) steht bereits im Rumpf als farbiger
       Chip. Auf dem Bild wäre es dasselbe ein zweites Mal. */
    .marken .badge { display: none; }
    .name { font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.25; }
    .body { padding: 8px 9px 10px; gap: 5px; }

    /* Zwei Kacheln nebeneinander = 152 px breit. In den Ecken stießen Gefahr,
       Etikett und Wanderung zusammen. Hier stehen sie in EINER Reihe am unteren
       Bildrand, über einem Verlauf, damit sie auf jedem Foto lesbar bleiben.
       Sie wachsen nach oben, wenn es mehr als eine Zeile wird. */
    .marken {
      display: flex; flex-wrap: wrap; align-items: flex-end; gap: 3px;
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 18px 5px 5px;
      background: linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0.28) 52%, transparent);
      pointer-events: none;
    }
    .marken > * {
      position: static; max-width: 100%;
      font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 2px 5px; border-radius: 7px;
      letter-spacing: 0.1px; line-height: 1.35; box-shadow: 0 1px 3px rgba(0,0,0,0.45);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    /* Die langen Wortteile fallen weg — die volle Auskunft steht im title. */
    .lang { display: none; }
    .badge { background: rgba(255,255,255,0.92); color: #2b2621; letter-spacing: 0.2px; }
    .warn { flex: 0 1 auto; }
    .km { font-weight: 700; }
  }

  /* Tippflächen nach Apple-Maß (44 pt) für die Hauptaktionen der Kachel */
  .maps, .reise-btn { min-height: 44px; display: inline-flex; align-items: center; }
  .bubble { min-height: 44px; min-width: 44px; }
  /* Größere Tippfläche ohne größere Optik (Apple: 44 pt) */
  .bubble, .mehr-btn, .saison-btn { position: relative; }
  .bubble::after { content: ''; position: absolute; inset: -3px -2px; }
  .mehr-btn::after, .saison-btn::after { content: ''; position: absolute; inset: -7px -4px; }
</style>
