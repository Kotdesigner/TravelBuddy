<script>
  // Datei erstellen und danach weitergeben. Bleibt in der App und hat immer einen Weg zurück,
  // denn ein zweites Fenster lässt sich am iPhone in der installierten App nicht mehr verlassen.
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { zeigeToast } from './toast.js'
  import { zipBlob } from './kalenderexport.js'
  import { druckeBilder } from './ausgabe.js'

  let { titel, formate = [], erstelle, quer = false, schliessen = () => {} } = $props()

  let format = $state(formate[0]?.id)
  let lauf = $state(null)       // { seite, von } während des Erstellens
  let ergebnis = $state(null)   // { dateien, seiten, bilder }
  let vorschau = $state('')
  let fehler = $state('')
  let abgebrochen = false

  const handy = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (/Mac/.test(navigator.platform) && 'ontouchend' in document))
  const macApp = typeof location !== 'undefined' && location.port === '8990' && /Mac/.test(navigator.platform)
  const kannTeilen = (d) => !!navigator.canShare?.({ files: d })
  const groesse = $derived(ergebnis ? ergebnis.dateien.reduce((n, d) => n + d.size, 0) : 0)
  const mb = (n) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`)

  async function los() {
    fehler = ''
    abgebrochen = false
    lauf = { seite: 0, von: 0 }
    try {
      const r = await erstelle(format, (seite, von) => (lauf = { seite, von }), () => abgebrochen)
      if (abgebrochen || !r) return
      ergebnis = r
      if (r.bilder[0]) vorschau = URL.createObjectURL(r.bilder[0])
    } catch (e) {
      console.error(e)
      fehler = je('Das Erstellen hat nicht geklappt. Wähle weniger Inhalte oder versuche es noch einmal.', 'Creating the file failed. Choose less content or try again.')
    } finally { lauf = null }
  }
  function nochmal() {
    if (vorschau) URL.revokeObjectURL(vorschau)
    vorschau = ''
    ergebnis = null
  }
  function zurueck() {
    abgebrochen = true
    if (vorschau) URL.revokeObjectURL(vorschau)
    schliessen()
  }

  function ladeHerunter() {
    const d = ergebnis.dateien
    const eine = d.length === 1
    const blob = eine ? d[0] : null
    const name = eine ? d[0].name : `${d[0].name.replace(/-\d+\.jpg$/, '')}.zip`
    const fertig = (b) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b); a.download = name
      document.body.append(a); a.click()
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 4000)
      return name
    }
    if (blob) return fertig(blob)
    return Promise.all(d.map(async (x) => ({ name: x.name, inhalt: new Uint8Array(await x.arrayBuffer()) }))).then((t) => fertig(zipBlob(t, 'application/zip')))
  }
  async function teile() {
    try {
      await navigator.share({ files: ergebnis.dateien, title: titel })
      return true
    } catch (e) {
      if (e?.name !== 'AbortError') zeigeToast(je('Teilen ging nicht. Sichere die Datei stattdessen.', 'Sharing failed. Save the file instead.'), 'fehler')
      return false
    }
  }
  async function sichern() {
    if (handy && kannTeilen(ergebnis.dateien)) {
      zeigeToast(je('Wähle „In Dateien sichern“ oder „Bilder sichern“.', 'Choose “Save to Files” or “Save Images”.'), 'ok')
      return teile()
    }
    const n = await ladeHerunter()
    zeigeToast(je(`${n} liegt in deinen Downloads`, `${n} is in your Downloads`), 'ok')
  }
  async function exportieren() {
    if (kannTeilen(ergebnis.dateien)) return teile()
    return sichern()
  }
  async function mail() {
    if (kannTeilen(ergebnis.dateien)) {
      zeigeToast(je('Wähle im nächsten Fenster „Mail“.', 'Choose “Mail” in the next window.'), 'ok')
      return teile()
    }
    await sichern()
    zeigeToast(je('Hänge die Datei aus den Downloads an die Mail an.', 'Attach the file from your Downloads to the mail.'), 'ok')
    location.href = `mailto:?subject=${encodeURIComponent(titel)}`
  }
  function drucken() {
    if (macApp) {
      zeigeToast(je('Die Datei kommt in deine Downloads. Öffne sie dort und drücke ⌘ P.', 'The file goes to your Downloads. Open it there and press ⌘ P.'), 'ok')
      return ladeHerunter()
    }
    druckeBilder(ergebnis.bilder, quer)
  }
</script>

<div class="ag" role="dialog" aria-labelledby="ag-titel" use:modal={{ onclose: zurueck }}>
  <div class="ag-kopf">
    <button class="ag-zurueck" onclick={zurueck}>‹ {je('Zurück', 'Back')}</button>
    <h2 id="ag-titel">{titel}</h2>
  </div>

  <div class="ag-inhalt">
    {#if lauf}
      <div class="ag-lauf" role="status">
        <p><b>{je('Wird erstellt …', 'Creating …')}</b></p>
        <p>{lauf.von ? je(`Seite ${lauf.seite} von ${lauf.von}`, `Page ${lauf.seite} of ${lauf.von}`) : je('Seiten werden gesetzt', 'Laying out pages')}</p>
        <progress max={lauf.von || 1} value={lauf.seite}></progress>
        <button class="btn ag-zeile" onclick={() => { abgebrochen = true; lauf = null }}>{je('Abbrechen', 'Cancel')}</button>
      </div>
    {:else if ergebnis}
      {#if vorschau}<img class="ag-bild" class:quer src={vorschau} alt={je('Vorschau der ersten Seite', 'Preview of the first page')} />{/if}
      <p class="ag-fertig" role="status"><b>✓ {je('Fertig', 'Done')}</b> · {ergebnis.dateien.length === 1 ? ergebnis.dateien[0].name : je(`${ergebnis.dateien.length} Bilder`, `${ergebnis.dateien.length} pictures`)} · {je(`${ergebnis.seiten} Seiten`, `${ergebnis.seiten} pages`)} · {mb(groesse)}</p>
      <div class="ag-wege">
        {#if ergebnis.bilder.length}<button class="btn ag-zeile" onclick={drucken}>🖨️ {je('Drucken', 'Print')}</button>{/if}
        <button class="btn ag-zeile" onclick={sichern}>💾 {je('Datei sichern', 'Save file')}</button>
        <button class="btn ag-zeile" onclick={exportieren}>📤 {je('Teilen oder exportieren', 'Share or export')}</button>
        <button class="btn ag-zeile" onclick={mail}>✉️ {je('Per Mail senden', 'Send by mail')}</button>
      </div>
      {#if groesse > 20971520}<p class="ag-tipp">{je('Die Datei ist groß. Viele Mail-Dienste nehmen nur bis 20 MB an, nutze dann AirDrop oder eine Cloud.', 'The file is large. Many mail services stop at 20 MB, use AirDrop or a cloud service instead.')}</p>{/if}
      <button class="ag-leise" onclick={nochmal}>{je('Anderes Format wählen', 'Choose another format')}</button>
    {:else}
      <p>{je('Erstelle zuerst die Datei. Danach kannst du sie drucken, sichern, teilen oder per Mail senden.', 'Create the file first. After that you can print, save, share or mail it.')}</p>
      <div class="ag-formate" role="radiogroup" aria-label={je('Format', 'Format')}>
        {#each formate as f (f.id)}
          <label class:an={format === f.id}><input type="radio" name="ag-format" value={f.id} bind:group={format} /><b>{f.name}</b><span>{f.text}</span></label>
        {/each}
      </div>
      {#if fehler}<p class="ag-fehler" role="alert">{fehler}</p>{/if}
      <button class="btn-primary ag-zeile" onclick={los}>{je('Erstellen', 'Create')}</button>
    {/if}
  </div>
</div>

<style>
  .ag { position: fixed; inset: 0; z-index: calc(var(--z-overlay) + 20); display: flex; flex-direction: column; background: var(--bg, #14100c); color: var(--ink); padding: calc(8px + env(safe-area-inset-top, 0px)) 14px calc(14px + env(safe-area-inset-bottom, 0px)); overflow: auto; }
  .ag-kopf { display: flex; align-items: center; gap: 10px; width: min(560px, 100%); margin: 0 auto 10px; }
  .ag-kopf h2 { flex: 1; min-width: 0; margin: 0; font-size: calc(17px * var(--schrift, 1)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ag-zurueck { flex: none; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche-2); color: var(--ink); font-size: calc(15px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .ag-inhalt { display: flex; flex-direction: column; gap: 10px; width: min(560px, 100%); margin: 0 auto; }
  .ag-inhalt p { margin: 0; font-size: calc(15px * var(--schrift, 1)); }
  .ag-zeile { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 50px; font-size: calc(16px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .ag-formate { display: flex; flex-direction: column; gap: 8px; }
  .ag-formate label { display: grid; grid-template-columns: auto 1fr; gap: 0 10px; align-items: center; min-height: 56px; padding: 8px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--card); cursor: pointer; }
  .ag-formate label.an { border-color: var(--brand-text); }
  .ag-formate input { grid-row: span 2; width: 20px; height: 20px; accent-color: var(--brand); }
  .ag-formate b { font-size: calc(15px * var(--schrift, 1)); }
  .ag-formate span { color: var(--muted); font-size: calc(13px * var(--schrift, 1)); }
  .ag-bild { display: block; max-width: 100%; max-height: 38dvh; margin: 0 auto; border-radius: 6px; background: #fff; box-shadow: var(--shadow); }
  .ag-fertig { text-align: center; }
  .ag-wege { display: flex; flex-direction: column; gap: 8px; }
  .ag-lauf { display: flex; flex-direction: column; gap: 10px; padding: 30px 0; text-align: center; }
  .ag-lauf progress { width: 100%; height: 10px; accent-color: var(--brand); }
  .ag-tipp { color: var(--muted); font-size: calc(13px * var(--schrift, 1)) !important; }
  .ag-fehler { color: var(--gefahr, #e25c4a); font-weight: 700; }
  .ag-leise { min-height: 44px; border: none; background: none; color: var(--brand-text); font-size: calc(14px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
</style>
