<script>
  import { t } from './i18n.js'
  // Ort hinzufügen (15.10.2026): erst fragen, welcher Ort gemeint ist (Vorschläge aus
  // OpenStreetMap), dann prüfen und anpassen. Der neue Ort bekommt dasselbe wie die
  // hinterlegten: Koordinaten (daraus Sonne, Sterne, Wetter, Gefahrenlage), Bild und
  // Beschreibung aus Wikipedia/Commons und die passende Gruppe (Süden, Norden, Ostküste
  // mit Region). Ohne Netz lässt er sich von Hand anlegen; Bild und Beschreibung holt
  // „Orte vervollständigen“ später nach.
  import { blattRaus, ausblenden } from './motion.js'
  import { modal } from './modal.js'
  import { haptic } from './haptik.js'
  import { online } from './netz.js'
  import { ortVorschlaege, holeOrtsdaten } from './ortdaten.js'
  import { rubrikFuer, alleRubriken } from './rubrik.js'
  import { eigenenOrtAnlegen, updateEigenenOrt } from './userdata.js'

  let { orte = [], onclose = () => {}, onfertig = () => {}, onzeigen = () => {} } = $props()

  const KENNZEICHEN = ['MUSS-SEHEN', 'GEHEIMTIPP', 'NUR-4WD']
  let schritt = $state('suche')
  let q = $state('')
  let vorschlaege = $state([])
  let sucht = $state(false)
  let suchFehler = $state('')

  // Prüfen & anpassen
  let wahl = $state(null)
  let name = $state('')
  let emoji = $state('📍')
  let beschreibung = $state('')
  let lat = $state('')
  let lon = $state('')
  let gruppe = $state('')
  let tags = $state([])
  let bild = $state('')
  let holt = $state(false)
  let holHinweis = $state('')

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  const zahl = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null }

  // Gibt es den Ort schon in der App? Dann lieber dorthin als doppelt anlegen.
  const schonDa = $derived.by(() => {
    const s = norm(q)
    if (s.length < 3) return []
    return orte.filter((o) => norm(o.name).includes(s) || s.includes(norm(o.name))).slice(0, 3)
  })

  let uhr = null, abbruch = null
  $effect(() => {
    const s = q.trim()
    clearTimeout(uhr); abbruch?.abort()
    if (schritt !== 'suche' || s.length < 3 || !$online) { vorschlaege = []; sucht = false; return }
    sucht = true
    uhr = setTimeout(async () => {
      abbruch = new AbortController()
      try { vorschlaege = await ortVorschlaege(s, { signal: abbruch.signal }); suchFehler = '' }
      catch (e) { if (e?.name === 'AbortError') return; vorschlaege = []; suchFehler = t('Vorschläge sind gerade nicht erreichbar. Du kannst den Ort von Hand anlegen.') }
      sucht = false
    }, 550)
    return () => clearTimeout(uhr)
  })

  // Gruppen zur Auswahl: alle Abschnitte mit Regionen, dazu eine neue Region aus der Suche
  const rubriken = $derived(alleRubriken(orte))
  let neueRegion = $state(null)
  const gruppen = $derived.by(() => {
    const g = rubriken.map((r) => ({ abschnitt: r.abschnitt, regionen: [...r.regionen] }))
    if (neueRegion) {
      const ziel = g.find((x) => x.abschnitt === neueRegion.abschnitt)
      if (ziel && !ziel.regionen.includes(neueRegion.region)) ziel.regionen.push(neueRegion.region)
    }
    return g
  })
  // „Süden · Margaret River & Augusta“: vom Abschnitt nur der Teil vor dem Doppelpunkt
  const gruppeText = $derived(gruppe ? gruppe.split('||').map((x, i) => (i === 0 ? t(x).split(':')[0] : t(x))).join(' · ') : t('Meine Orte (ohne Gruppe)'))

  function setzeGruppe(la, lo, gebiet) {
    const r = la != null && lo != null ? rubrikFuer(la, lo, { gebiet }) : {}
    if (!r.abschnitt) { gruppe = ''; neueRegion = null; return }
    neueRegion = rubriken.some((x) => x.abschnitt === r.abschnitt && x.regionen.includes(r.region)) ? null : { abschnitt: r.abschnitt, region: r.region }
    gruppe = r.abschnitt + '||' + r.region
  }

  function waehle(v) {
    wahl = v
    name = v.name; emoji = v.emoji || '📍'; beschreibung = ''; bild = ''; tags = []
    lat = v.lat ?? ''; lon = v.lon ?? ''
    setzeGruppe(v.lat, v.lon, v.gebiet)
    schritt = 'pruefen'
    holHinweis = ''
    if (v.lat != null && $online) holeDaten()
  }
  const vonHand = () => waehle({ name: q.trim(), lat: null, lon: null, hand: true })

  // Bild und Beschreibung holen. Läuft das noch, wenn schon angelegt wird, kommt das
  // Ergebnis nachträglich an den gespeicherten Ort.
  let lauf = 0
  let gespeichertId = null
  async function holeDaten() {
    const n = name.trim()
    if (!n || !$online) return
    const meins = ++lauf
    holt = true; holHinweis = ''
    try {
      const la = zahl(lat), lo = zahl(lon)
      const d = await holeOrtsdaten(n, { lat: la, lon: lo, kontext: wahl?.gebiet })
      if (meins !== lauf) return
      const patch = {}
      if (la == null && d.lat != null) {
        lat = d.lat; lon = d.lon; patch.lat = d.lat; patch.lon = d.lon
        setzeGruppe(d.lat, d.lon, wahl?.gebiet)
      }
      if (d.beschreibung && !beschreibung.trim()) { beschreibung = d.beschreibung; patch.beschreibung = d.beschreibung }
      if (d.bildData) { bild = d.bildData; patch.bildData = d.bildData }
      if (!d.beschreibung && !d.bildData) holHinweis = t('Kein Bild und keine Beschreibung gefunden. Du kannst selbst etwas schreiben.')
      if (gespeichertId && Object.keys(patch).length) updateEigenenOrt(gespeichertId, patch)
    } catch { if (meins === lauf) holHinweis = t('Daten gerade nicht erreichbar.') }
    finally { if (meins === lauf) holt = false }
  }

  const kannAnlegen = $derived(!!name.trim())
  function anlegen() {
    if (!kannAnlegen) return
    const n = name.trim()
    const [abschnitt, region] = gruppe ? gruppe.split('||') : ['', '']
    const neu = eigenenOrtAnlegen({
      name: n, lat: zahl(lat), lon: zahl(lon), beschreibung: beschreibung.trim(), emoji: emoji.trim() || '📍',
      mapsQuery: n + ', ' + (wahl?.gebiet || 'Australia'), abschnitt, region, tags: ['MEIN ORT', ...tags], bildData: bild || null,
    })
    if (holt) gespeichertId = neu.id
    haptic.confirm?.()
    onfertig(neu)
  }
</script>

<div class="on-hg" out:ausblenden data-dialog-hg onclick={onclose} aria-hidden="true"></div>
<div class="on" out:blattRaus role="dialog" aria-labelledby="on-titel" use:modal={{ onclose }}>
  <div class="on-griff" aria-hidden="true"></div>
  <div class="on-kopf">
    <h2 id="on-titel">{schritt === 'suche' ? t('Ort hinzufügen') : t('Ort prüfen')}</h2>
    <button class="on-zu" onclick={onclose} aria-label={t('Schließen')}>✕</button>
  </div>

  {#if schritt === 'suche'}
    <label class="on-f">{t('Welcher Ort?')}
      <!-- svelte-ignore a11y_autofocus -->
      <input type="search" bind:value={q} placeholder={t('z. B. Margaret River')} autocomplete="off" autofocus enterkeyhint="search" />
    </label>

    {#if schonDa.length}
      <div class="on-block">
        <p class="on-titel2">{t('Schon in der App')}</p>
        <ul class="on-liste">
          {#each schonDa as o (o.id)}
            <li><button class="on-treffer" onclick={() => onzeigen(o)}>
              <span class="on-emoji" aria-hidden="true">{o.emoji || '📍'}</span>
              <span class="on-txt"><b>{o.name}</b><small>{t(o.region)}</small></span>
              <span class="on-pfeil" aria-hidden="true">›</span>
            </button></li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if !$online}
      <p class="on-k">{t('Ohne Netz gibt es keine Vorschläge. Leg den Ort von Hand an, Bild und Beschreibung holt die App, sobald wieder Netz da ist.')}</p>
    {:else if q.trim().length >= 3}
      <div class="on-block" aria-live="polite">
        <p class="on-titel2">{t('Vorschläge aus dem Internet')}{#if sucht}&nbsp;<span class="on-laeuft">{t('sucht …')}</span>{/if}</p>
        {#if vorschlaege.length}
          <ul class="on-liste">
            {#each vorschlaege as v (v.name + v.lat + v.lon)}
              <li><button class="on-treffer" onclick={() => waehle(v)}>
                <span class="on-emoji" aria-hidden="true">{v.emoji}</span>
                <span class="on-txt"><b>{v.name}</b><small>{v.zusatz}</small></span>
                <span class="on-pfeil" aria-hidden="true">›</span>
              </button></li>
            {/each}
          </ul>
        {:else if !sucht}
          <p class="on-k">{suchFehler || t('Nichts gefunden. Anders schreiben oder von Hand anlegen.')}</p>
        {/if}
      </div>
    {:else}
      <p class="on-k">{t('Tipp einen Namen ein. Die App zeigt passende Orte in Australien mit Typ und Bundesstaat, damit du den richtigen wählst.')}</p>
    {/if}

    {#if q.trim()}
      <button class="btn on-hand" onclick={vonHand}>{t('„{name}“ von Hand anlegen', { name: q.trim() })}</button>
    {/if}

  {:else}
    <form class="on-form" onsubmit={(e) => { e.preventDefault(); anlegen() }}>
      <div class="on-vorschau">
        {#if bild}<img src={bild} alt={t('Vorschaubild für {name}', { name })} />{:else}<span class="on-platz" aria-hidden="true">{holt ? '⏳' : emoji}</span>{/if}
        {#if bild}<button type="button" class="on-bildweg" onclick={() => (bild = '')} aria-label={t('Bild entfernen')}>✕</button>{/if}
      </div>
      {#if holt}<p class="on-k" aria-live="polite">{t('Hole Bild und Beschreibung …')}</p>{:else if holHinweis}<p class="on-k">{holHinweis}</p>{/if}

      <div class="on-zeile">
        <label class="on-f on-emojifeld">{t('Symbol')}<input bind:value={emoji} maxlength="4" /></label>
        <label class="on-f">{t('Name')}<input bind:value={name} required /></label>
      </div>

      <label class="on-f">{t('Gruppe')}
        <select bind:value={gruppe}>
          {#each gruppen as g (g.abschnitt)}
            <optgroup label={t(g.abschnitt)}>
              {#each g.regionen as r (r)}<option value={g.abschnitt + '||' + r}>{t(r)}</option>{/each}
            </optgroup>
          {/each}
          <option value="">{t('Meine Orte (ohne Gruppe)')}</option>
        </select>
      </label>
      <p class="on-k">{#if gruppe}{t('Erscheint unter {gruppe} und unter „Meine Orte“.', { gruppe: gruppeText })}{:else}{t('Erscheint nur unter „Meine Orte“.')}{/if}</p>

      <label class="on-f">{t('Beschreibung')}<textarea rows="4" bind:value={beschreibung} placeholder={t('Was ist dort besonders?')}></textarea></label>

      <div class="on-zeile">
        <label class="on-f">{t('Breite')}<input bind:value={lat} inputmode="decimal" placeholder="-33.95" onchange={() => setzeGruppe(zahl(lat), zahl(lon), wahl?.gebiet)} /></label>
        <label class="on-f">{t('Länge')}<input bind:value={lon} inputmode="decimal" placeholder="115.07" onchange={() => setzeGruppe(zahl(lat), zahl(lon), wahl?.gebiet)} /></label>
      </div>
      {#if zahl(lat) != null && zahl(lon) != null}
        <p class="on-k">{t('Aus den Koordinaten rechnet die App Sonnenauf- und -untergang, Sterne, Wetter und die Gefahrenlage für diesen Ort.')}</p>
      {:else}
        <p class="on-k">{t('Ohne Koordinaten sucht die App den Ort über seinen Namen.')}</p>
      {/if}
      {#if $online && !holt}
        <button type="button" class="btn" onclick={holeDaten}>{bild || beschreibung ? t('↻ Bild und Beschreibung neu holen') : t('✨ Bild und Beschreibung holen')}</button>
      {/if}

      <div class="on-tags" role="group" aria-label={t('Kennzeichnung')}>
        {#each KENNZEICHEN as k (k)}
          <button type="button" class="on-tag" class:an={tags.includes(k)} aria-pressed={tags.includes(k)}
            onclick={() => (tags = tags.includes(k) ? tags.filter((x) => x !== k) : [...tags, k])}>{t(k)}</button>
        {/each}
      </div>

      <div class="on-aktion">
        <button type="button" class="btn" onclick={() => (schritt = 'suche')}>{t('‹ Andere Suche')}</button>
        <button class="btn-primary" type="submit" disabled={!kannAnlegen}>{t('Ort anlegen')}</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .on-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.4); z-index: 120; animation: hg var(--t-med) var(--ease-out); }
  .on {
    position: fixed; z-index: 121; left: 0; right: 0; bottom: 0; max-height: 92dvh; overflow: auto; overscroll-behavior: contain;
    background: var(--bg); color: var(--ink); border-radius: 22px 22px 0 0; box-shadow: var(--shadow-float);
    padding: 8px 18px calc(18px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 12px;
    animation: hoch var(--t-slow) var(--ease-spring);
  }
  @media (min-width: 900px) {
    .on { left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); width: 560px; border-radius: var(--radius-l); padding: 18px 22px 20px; animation: rein var(--t-med) var(--ease-spring); }
    .on-griff { display: none; }
  }
  .on-griff { width: 40px; height: 5px; border-radius: 3px; background: var(--line-stark); align-self: center; margin-bottom: 4px; }
  .on-kopf { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: calc(20px * var(--schrift, 1)); }
  .on-zu { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--flaeche-2); color: var(--ink); font-size: calc(16px * var(--schrift, 1)); cursor: pointer; }
  .on-f { display: flex; flex-direction: column; gap: 5px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); flex: 1 1 0; min-width: 0; }
  .on-f input, .on-f select, .on-f textarea { min-height: 46px; font-size: max(16px, calc(17px * var(--schrift, 1))); padding: 8px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); font-weight: 400; font-family: inherit; }
  .on-f textarea { min-height: 96px; resize: vertical; line-height: 1.4; }
  .on-emojifeld { flex: 0 0 76px; }
  .on-emojifeld input { text-align: center; font-size: max(16px, calc(22px * var(--schrift, 1))); }
  .on-zeile { display: flex; gap: 10px; align-items: flex-end; }
  .on-k { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); line-height: 1.4; }
  .on-block { display: flex; flex-direction: column; gap: 6px; }
  .on-titel2 { margin: 0; font-size: calc(13px * var(--schrift, 1)); font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .on-laeuft { font-weight: 600; text-transform: none; letter-spacing: 0; }
  .on-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .on-treffer { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; padding: 10px 12px; min-height: 56px;
    border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--card); color: var(--ink); cursor: pointer; font: inherit; }
  .on-treffer:hover { border-color: var(--line-stark); }
  .on-emoji { font-size: calc(24px * var(--schrift, 1)); flex: none; width: 30px; text-align: center; }
  .on-txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .on-txt b { font-size: calc(16px * var(--schrift, 1)); overflow: hidden; text-overflow: ellipsis; }
  .on-txt small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .on-pfeil { color: var(--muted); font-size: calc(22px * var(--schrift, 1)); }
  .on-hand { min-height: 48px; }
  .on-form { display: flex; flex-direction: column; gap: 12px; }
  .on-vorschau { position: relative; border-radius: var(--radius-m); overflow: hidden; background: var(--flaeche-2); aspect-ratio: 16 / 9; display: grid; place-items: center; }
  .on-vorschau img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .on-platz { font-size: calc(48px * var(--schrift, 1)); }
  .on-bildweg { position: absolute; top: 8px; right: 8px; width: 40px; height: 40px; border-radius: 50%; border: none; background: rgba(0, 0, 0, 0.55); color: #fff; cursor: pointer; }
  .on-tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .on-tag { min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .on-tag.an { background: var(--brand); border-color: transparent; color: #fff; }
  .on-aktion { display: flex; gap: 10px; justify-content: space-between; flex-wrap: wrap; }
  .on-aktion .btn-primary { flex: 1; min-height: 52px; font-size: calc(17px * var(--schrift, 1)); }
  @keyframes hg { from { opacity: 0; } }
  @keyframes hoch { from { transform: translateY(40px); opacity: 0.4; } }
  @keyframes rein { from { opacity: 0; transform: translate(-50%, -47%); } }
</style>
