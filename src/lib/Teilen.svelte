<script>
  import { t, LOCALE, tn } from './i18n.js'
  // Reisebericht teilen: eine einzelne HTML-Datei zum Verschicken. Man wählt
  // Etappen, ob Tagebuchtexte mitkommen und welche Fotos; Weltkugeln und Fotos werden
  // eingebettet. Private Daten (Buchungen, Kosten, Dokumente, Notfall, Koordinaten)
  // kommen gar nicht erst ins Modell, siehe reisebericht.js.
  import { reisen, journal, gesamtStart } from './userdata.js'
  import { etappenMitDatum } from './plan.js'
  import { bereich, tageText } from './format.js'
  import { zeichneGlobus, blick } from './globus.js'
  import { etappenGeo, blickAuf, fotosDerEtappe } from './reisefilm.js'
  import { berichtModell, baueBerichtHtml, fotosZurAuswahl, dateiName, MAX_BYTES } from './reisebericht.js'
  import { klapp } from './motion.js'
  import { haptic } from './haptik.js'
  import TagebuchFotos from './TagebuchFotos.svelte'
  import { tagebuchFotos, holeTagebuchBild, geraetBild } from './tagebuch-fotos.js'

  let { orte = [] } = $props()

  const plan = $derived(etappenMitDatum($reisen, $gesamtStart))

  // ---- Auswahl ----
  let gewaehlt = $state(null)        // Set der Etappen-IDs, null = alle
  let mitTexten = $state(false)
  let fotoWahl = $state(null)        // Set der Foto-IDs, null = Vorauswahl
  let fotosOffen = $state(true)

  const etappenWahl = $derived(gewaehlt ?? new Set(plan.map((e) => e.reise.id)))
  const aktiveEtappen = $derived(plan.filter((e) => etappenWahl.has(e.reise.id)))
  // Logbuch-Fotos und die Fotos fürs Tagebuch, die nur auf diesem Gerät liegen
  const fotos = $derived(fotosZurAuswahl($journal, aktiveEtappen, $tagebuchFotos))
  // Vorauswahl: je Etappe bis zu zwei Fotos, über den Zeitraum verteilt
  const vorauswahl = $derived(new Set(aktiveEtappen.flatMap((e) => fotosDerEtappe($journal, e, 2).map((f) => f.id))))
  const fotoIds = $derived(new Set([...(fotoWahl ?? vorauswahl)].filter((id) => fotos.some((f) => f.id === id))))

  function etappeUmschalten(id) {
    const n = new Set(etappenWahl)
    n.has(id) ? n.delete(id) : n.add(id)
    gewaehlt = n; veraltet()
  }
  function alleEtappen(an) { gewaehlt = an ? null : new Set(); veraltet() }
  function fotoUmschalten(id) {
    const n = new Set(fotoIds)
    n.has(id) ? n.delete(id) : n.add(id)
    fotoWahl = n; veraltet(); haptic(8)
  }
  function alleFotos(an) { fotoWahl = an ? new Set(fotos.map((f) => f.id)) : new Set(); veraltet() }

  // ---- Erstellen ----
  let laeuft = $state(false)
  let schritt = $state('')
  let ergebnis = $state(null)        // { html, bytes, fotosDrin, fotosWeg, name, ohneKugeln }
  let alt = $state(false)
  let meldung = $state('')
  const verkleinert = new Map()      // Foto-ID → kleine JPEG-data-URL
  let schrift = null

  function veraltet() { if (ergebnis) alt = true }

  function ladeBild(src) {
    return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src })
  }
  async function verkleinere(src, maxPx = 1280, q = 0.78) {
    const img = await ladeBild(src)
    if (!img) return null
    const s = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
    const cv = document.createElement('canvas')
    cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s)
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
    return cv.toDataURL('image/jpeg', q)
  }
  function kugel(alle, linien, punkte, px, opt = {}) {
    try {
      const cv = document.createElement('canvas')
      const b = opt.blick || blickAuf(alle)
      zeichneGlobus(cv, { breite: px, hoehe: px, dpr: 1, mitte: b.mitte, P: b.P, linien, punkte })
      return cv.toDataURL('image/png')
    } catch { return '' }
  }
  async function ladeSchrift() {
    if (schrift !== null) return schrift
    try {
      const r = await fetch(import.meta.env.BASE_URL + 'fonts/anton.woff2')
      if (!r.ok) throw new Error()
      const b = await r.blob()
      schrift = await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result).replace(/^data:[^;]*;/, 'data:font/woff2;')); f.onerror = () => ok(''); f.readAsDataURL(b) })
    } catch { schrift = '' }
    return schrift
  }
  const pause = () => new Promise((r) => setTimeout(r, 0))

  async function erstellen() {
    if (laeuft || !aktiveEtappen.length) return
    laeuft = true; meldung = ''; haptic()
    try {
      const modell = berichtModell({ reisen: $reisen, journal: $journal, gesamtStart: $gesamtStart, etappenIds: [...etappenWahl], mitTexten, fotoIds: [...fotoIds], geraetFotos: $tagebuchFotos })
      schritt = t('Fotos werden verkleinert …')
      let i = 0
      for (const e of modell.etappen) for (const f of e.fotos) {
        if (!verkleinert.has(f.id)) {
          // Fotos vom Gerät: aus der vollen Fassung verkleinern, die Blob-Adresse gleich wieder freigeben
          const blob = f.geraetId ? await holeTagebuchBild(f.geraetId, 'gross') : null
          const src = blob ? URL.createObjectURL(blob) : f.src
          const k = src ? await verkleinere(src) : null
          if (blob) URL.revokeObjectURL(src)
          if (k) verkleinert.set(f.id, k)
        }
        schritt = t('Fotos werden verkleinert … {wert}', { wert: ++i })
        await pause()
      }
      schritt = t('Weltkugeln werden gemalt …')
      await pause()
      const kugeln = {}
      const geos = aktiveEtappen.map((e) => ({ id: e.reise.id, geo: etappenGeo($reisen, e) }))
      for (const g of geos) {
        if (g.geo.alle.length) kugeln[g.id] = kugel(g.geo.alle, g.geo.linien, g.geo.punkte, 300)
        await pause()
      }
      const alle = geos.flatMap((g) => g.geo.alle)
      if (alle.length) kugeln.gesamt = kugel(alle, geos.flatMap((g) => g.geo.linien), [], 560, { blick: blick(alle, { fuellen: 0.6, minP: 1.4 }) })
      schritt = t('Datei wird zusammengesetzt …')
      await pause()
      const s = await ladeSchrift()
      const r = baueBerichtHtml(modell, { kugeln, fotoSrc: verkleinert, schrift: s || null, maxBytes: MAX_BYTES, erstellt: heute() })
      ergebnis = { ...r, name: dateiName(modell) }
      alt = false
      haptic([10, 40, 10])
    } catch (e) {
      meldung = t('Das hat nicht geklappt. ') + (e?.message || '')
    }
    laeuft = false; schritt = ''
  }
  function heute() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const datei = $derived(ergebnis ? new File([ergebnis.html], ergebnis.name, { type: 'text/html' }) : null)
  const kannTeilen = $derived(!!(datei && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [datei] })))
  async function teilen() {
    if (!datei) return
    haptic()
    try { await navigator.share({ files: [datei], title: t('Reisebericht Westaustralien') }) }
    catch (e) { if (e?.name !== 'AbortError') meldung = t('Teilen hat nicht geklappt. Lade die Datei herunter und verschicke sie von dort.') }
  }
  function herunterladen() {
    if (!datei) return
    haptic()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(datei)
    a.download = datei.name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }
  const mb = (n) => (n / 1048576).toLocaleString(LOCALE, { maximumFractionDigits: 1 })
  const kurz = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) } catch { return d } }
</script>

<div class="te">
  <p class="te-intro">{t('Eine einzelne Datei für Familie und Freunde: Etappen, Routen, Orte und die Fotos, die du auswählst. Sie öffnet sich in jedem Browser, auch ohne Internet. Buchungen, Kosten, Dokumente, Notfallkontakte und genaue Koordinaten bleiben draußen.')}</p>

  {#if !plan.length}
    <p class="te-leer">{t('Im Plan gibt es noch keine Etappen. Sobald welche da sind, kannst du hier einen Reisebericht zusammenstellen.')}</p>
  {:else}
    <section class="te-block" aria-labelledby="te-etappen">
      <div class="te-kopf">
        <h3 id="te-etappen">{t('Etappen')}</h3>
        <div class="te-mini">
          <button class="btn btn-ghost" onclick={() => alleEtappen(true)}>{t('Alle')}</button>
          <button class="btn btn-ghost" onclick={() => alleEtappen(false)}>{t('Keine')}</button>
        </div>
      </div>
      <ul class="te-liste">
        {#each plan as e (e.reise.id)}
          <li>
            <label class="te-etappe" style="--f:{e.reise.farbe || '#8a3f16'}">
              <input type="checkbox" checked={etappenWahl.has(e.reise.id)} onchange={() => etappeUmschalten(e.reise.id)} />
              <span class="te-name">{e.reise.name}</span>
              <span class="te-zeit">{bereich(e.von, e.bis)}, {tageText(e.tage)}</span>
            </label>
          </li>
        {/each}
      </ul>
    </section>

    <section class="te-block" aria-labelledby="te-texte">
      <h3 id="te-texte" class="te-vh">{t('Tagebuch')}</h3>
      <label class="te-schalter">
        <input type="checkbox" switch checked={mitTexten} onchange={(e) => { mitTexten = e.target.checked; veraltet() }} />
        <span><b>{t('Texte mitnehmen')}</b><small>{t('Deine Tagebuchtexte der gewählten Etappen. Nummern wie Buchungscodes oder Telefonnummern werden unkenntlich gemacht. Lies trotzdem in der Vorschau nach.')}</small></span>
      </label>
    </section>

    <section class="te-block" aria-labelledby="te-fotos">
      <div class="te-kopf">
        <h3 id="te-fotos">
          <button class="te-auf" onclick={() => (fotosOffen = !fotosOffen)} aria-expanded={fotosOffen} aria-controls="te-fotoraster">
            {t('Fotos')} <span class="te-zahl">{t('{size} von {length}', { size: fotoIds.size, length: fotos.length })}</span>
            <span class="aufklapp klein" class:offen={fotosOffen} aria-hidden="true"></span>
          </button>
        </h3>
        {#if fotos.length}
          <div class="te-mini">
            <button class="btn btn-ghost" onclick={() => alleFotos(true)}>{t('Alle')}</button>
            <button class="btn btn-ghost" onclick={() => alleFotos(false)}>{t('Keine')}</button>
          </div>
        {/if}
      </div>
      {#if fotosOffen}
        <div id="te-fotoraster" transition:klapp>
          <TagebuchFotos {orte} kompakt />
          {#if fotos.length}
            <ul class="te-raster">
              {#each fotos as f (f.id)}
                <li>
                  <button class="te-foto" class:an={fotoIds.has(f.id)} aria-pressed={fotoIds.has(f.id)}
                    aria-label={t('Foto {wert} {kurz}', { wert: f.ort || '', kurz: kurz(f.datum) })} onclick={() => fotoUmschalten(f.id)}>
                    {#if f.geraetId}<img use:geraetBild={f.geraetId} alt="" decoding="async" />{:else}<img src={f.src} alt="" loading="lazy" decoding="async" />{/if}
                    <span class="te-haken" aria-hidden="true">✓</span>
                    <span class="te-unter">{kurz(f.datum)}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="te-leise">{t('In den gewählten Etappen gibt es noch keine Fotos.')}</p>
          {/if}
        </div>
      {/if}
    </section>

    <button class="btn-primary te-los" onclick={erstellen} disabled={laeuft || !aktiveEtappen.length}>
      {laeuft ? t('Wird erstellt …') : ergebnis ? t('Vorschau neu erstellen') : t('Vorschau erstellen')}
    </button>
    <p class="te-status" aria-live="polite">{schritt}</p>
    {#if meldung}<p class="te-warn" role="alert">{meldung}</p>{/if}

    {#if ergebnis}
      <section class="te-block" aria-labelledby="te-vorschau">
        <h3 id="te-vorschau">{t('Vorschau')}</h3>
        {#if alt}<p class="te-warn">{t('Die Auswahl hat sich geändert. Erstelle die Vorschau neu, bevor du teilst.')}</p>{/if}
        <p class="te-leise">{tn(ergebnis.fotosDrin, '{mb} MB, {n} Foto', '{mb} MB, {n} Fotos', { mb: mb(ergebnis.bytes) })}{#if ergebnis.fotosWeg}{tn(ergebnis.fotosWeg, '. {n} Foto passte nicht mehr hinein (höchstens 8 MB).', '. {n} Fotos passten nicht mehr hinein (höchstens 8 MB).')}{/if}{#if ergebnis.ohneKugeln} {t('Die Weltkugeln wurden weggelassen, damit die Datei klein bleibt.')}{/if}</p>
        <iframe class="te-rahmen" title={t('Vorschau des Reiseberichts')} sandbox="" srcdoc={ergebnis.html}></iframe>
        <div class="te-aktionen">
          {#if kannTeilen}<button class="btn-primary" onclick={teilen} disabled={alt}>{t('Datei teilen')}</button>{/if}
          <button class={kannTeilen ? 'btn' : 'btn-primary'} onclick={herunterladen} disabled={alt}>{t('Herunterladen')}</button>
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .te { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }
  .te-intro { margin: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.55; color: var(--ink); text-wrap: pretty; max-inline-size: 65ch; }
  .te-leer, .te-leise { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); line-height: 1.5; }
  .te-block { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); box-shadow: var(--shadow); padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .te-kopf { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  h3 { margin: 0; font-size: calc(16px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .te-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .te-mini { display: inline-flex; gap: 6px; }
  .te-mini .btn { padding: 6px 12px; }
  .te-zahl { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-left: 6px; font-variant-numeric: tabular-nums; }

  .te-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .te-etappe {
    display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 12px; align-items: center;
    min-height: 52px; padding: 8px 12px; border-radius: var(--radius-s); border: 1px solid var(--line);
    border-left: 5px solid var(--f); background: var(--flaeche); cursor: pointer;
  }
  .te-etappe input { grid-row: 1 / span 2; width: 22px; height: 22px; margin: 0; }
  .te-name { font-weight: 700; font-size: calc(15px * var(--schrift, 1)); color: var(--ink); }
  .te-zeit { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }

  .te-schalter { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px; }
  .te-schalter input { margin-top: 3px; flex: none; }
  .te-schalter span { display: flex; flex-direction: column; gap: 3px; }
  .te-schalter b { font-size: calc(15px * var(--schrift, 1)); }
  .te-schalter small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }

  .te-auf { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0; border: none; background: none; color: inherit; font: inherit; cursor: pointer; text-align: left; }
  .te-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
  .te-foto { position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 2px solid transparent; border-radius: var(--radius-s); overflow: hidden; background: var(--flaeche-2); cursor: pointer; }
  .te-foto img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.55; transition: opacity var(--t-fast) var(--ease-out); }
  .te-foto.an { border-color: var(--brand); }
  .te-foto.an img { opacity: 1; }
  .te-haken {
    position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
    font-size: calc(13px * var(--schrift, 1)); font-weight: 900; color: #fff; background: var(--brand); box-shadow: 0 1px 3px rgba(0,0,0,.3);
    opacity: 0; transform: scale(0.8); transition: opacity var(--t-fast) var(--ease-out), transform var(--t-feder) var(--ease-federnd);
  }
  .te-foto.an .te-haken { opacity: 1; transform: none; }
  .te-unter { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 6px 4px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: #fff; background: linear-gradient(to top, rgba(0,0,0,.6), transparent); text-align: left; }

  .te-los { align-self: flex-start; min-width: 220px; }
  .te-status { margin: -8px 0 0; min-height: 1em; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .te-warn { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.5; color: var(--warn-text); background: var(--warn-flaeche); border: 1px solid color-mix(in srgb, var(--warn) 45%, transparent); border-radius: var(--radius-s); padding: 9px 12px; }

  .te-rahmen { width: 100%; height: min(72dvh, 720px); border: 1px solid var(--line); border-radius: var(--radius-s); background: #fbf8f3; }
  .te-aktionen { display: flex; flex-wrap: wrap; gap: 10px; }
  .te-aktionen > * { flex: 1 1 180px; }
</style>
