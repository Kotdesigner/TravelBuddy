<script>
  // Bild eines Orts ändern: Datei wählen, Bildersuche öffnen, Ausschnitt aus der Zwischenablage einfügen.
  // Das eigene Bild bleibt auf dem Gerät. Bei ersetzten Fotos und Symbolbildern lädt der Knopf deutlicher ein.
  import { je } from './i18n.js'
  import { macheThumbnail } from './thumbnail.js'
  import { bildSuche } from './bild-nachweis.js'
  import { zeigeToast } from './toast.js'
  import { modal } from './modal.js'

  let { name, status = '', eigenes = false, onbild = () => {}, onzurueck = () => {} } = $props()
  let auf = $state(false)
  const kannEinfuegen = typeof navigator !== 'undefined' && !!navigator.clipboard?.read
  const nav = typeof navigator !== 'undefined' ? navigator : { platform: '', userAgent: '' }
  const handy = /iPhone|iPad|iPod|Android/.test(nav.userAgent) || (/Mac/.test(nav.platform) && 'ontouchend' in document)
  const iphone = handy && !/Android/.test(nav.userAgent)
  const mac = /Mac/.test(nav.platform) && !handy
  const einladen = $derived((status === 'neu' || status === 'symbol') && !eigenes)
  const knopfText = $derived(einladen ? je('Besseres Bild', 'Better picture') : je('Bild ändern', 'Change picture'))

  async function uebernimm(datei) {
    try {
      onbild(await macheThumbnail(datei))
      auf = false
      zeigeToast(je('Bild gespeichert', 'Picture saved'), 'ok')
    } catch { zeigeToast(je('Das Bild ließ sich nicht lesen.', 'The picture could not be read.'), 'fehler') }
  }
  function datei(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) uebernimm(f)
  }
  async function einfuegen() {
    try {
      for (const stueck of await navigator.clipboard.read()) {
        const typ = stueck.types.find((x) => x.startsWith('image/'))
        if (typ) return uebernimm(new File([await stueck.getType(typ)], 'ausschnitt.png', { type: typ }))
      }
      zeigeToast(je('In der Zwischenablage ist kein Bild.', 'There is no picture on the clipboard.'), 'fehler')
    } catch { zeigeToast(je('Einfügen ging nicht. Drück Strg oder Cmd und V.', 'Pasting failed. Press Ctrl or Cmd and V.'), 'fehler') }
  }
  // Ein Ausschnitt lässt sich auch direkt mit der Tastatur einfügen, solange das Fenster offen ist
  function tastatur(e) {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'))
    if (f) { e.preventDefault(); uebernimm(f) }
  }
</script>

<svelte:window onpaste={auf ? tastatur : null} />

<button class="ba-knopf" class:einladen onclick={(e) => { e.stopPropagation(); auf = true }} title={knopfText} aria-label="{knopfText}: {name}">{einladen ? '✨' : '📷'}</button>

{#if auf}
  <div class="ba-hg" data-dialog-hg aria-hidden="true" onclick={() => (auf = false)}></div>
  <div class="ba" role="dialog" aria-labelledby="ba-titel" use:modal={{ onclose: () => (auf = false) }}>
    <h2 id="ba-titel">{einladen ? je('Besseres Bild hinzufügen', 'Add a better picture') : je('Bild ändern', 'Change picture')}</h2>
    <p class="ba-name">{name}</p>
    {#if status === 'symbol' && !eigenes}<p>{je('Das aktuelle Bild ist ein Symbolbild aus der Region, nicht dieser Ort.', 'The current picture is a sample from the region, not this place.')}</p>{/if}
    {#if status === 'neu' && !eigenes}<p>{je('Du hast ein schöneres Bild von hier? Füg es hinzu.', 'Got a nicer picture of this place? Add it.')}</p>{/if}

    <a class="btn ba-zeile" href={bildSuche(name)} target="_blank" rel="noopener">🔍 {je('Google-Bildersuche öffnen', 'Open Google image search')}</a>
    <label class="btn-primary ba-zeile">📁 {je('Bild vom Gerät wählen', 'Choose picture from device')}<input type="file" accept="image/*" onchange={datei} /></label>
    {#if kannEinfuegen && !handy}<button class="btn ba-zeile" onclick={einfuegen}>📋 {je('Ausschnitt aus der Zwischenablage einfügen', 'Paste snippet from clipboard')}</button>{/if}

    <p class="ba-tipp">
      {#if iphone}{je('Am iPhone: Bild in der Google-Suche gedrückt halten und „Zu Fotos hinzufügen“ tippen. Klappt das nicht, weil es das Bild nur online gibt, mach einen Screenshot (Seitentaste und Lauter zugleich) und schneide ihn zu. Dann oben „Bild vom Gerät wählen“.', 'On iPhone: press and hold the picture in the Google search and tap “Add to Photos”. If that does not work because the picture is only online, take a screenshot (side button and volume up together) and crop it. Then tap “Choose picture from device” above.')}
      {:else if handy}{je('Am Handy: Bild gedrückt halten und speichern. Klappt das nicht, mach einen Screenshot und schneide ihn zu. Dann oben „Bild vom Gerät wählen“.', 'On your phone: press and hold the picture and save it. If that does not work, take a screenshot and crop it. Then tap “Choose picture from device” above.')}
      {:else if mac}{je('Ausschnitt am Mac: ⌘ ⌃ ⇧ 4 drücken, Bereich aufziehen, dann hier einfügen.', 'Snippet on the Mac: press ⌘ ⌃ ⇧ 4, drag an area, then paste here.')}
      {:else}{je('Ausschnitt unter Windows: Windows-Taste, Umschalt und S drücken, dann hier einfügen.', 'Snippet on Windows: press Windows, Shift and S, then paste here.')}{/if}
    </p>
    <p class="ba-tipp">{je('Dein Bild bleibt nur auf diesem Gerät und in deinem Backup. Es ist für dich privat, fremde Fotos bitte nicht öffentlich weitergeben.', 'Your picture stays on this device and in your backup. It is for your private use, please do not share other people’s photos publicly.')}</p>

    {#if eigenes}<button class="btn ba-zeile" onclick={() => { onzurueck(); auf = false }}>↩️ {je('Eigenes Bild entfernen', 'Remove own picture')}</button>{/if}
    <button class="ba-zu" onclick={() => (auf = false)}>{je('Schließen', 'Close')}</button>
  </div>
{/if}

<style>
  /* Klein in der Ecke, damit das Foto frei bleibt. ::after hält die Tippfläche bei 44 px. */
  .ba-knopf { position: absolute; right: 6px; bottom: 6px; z-index: 2; display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 1px solid rgba(255,255,255,.35); border-radius: 50%; background: rgba(20,12,8,.72); color: #fff; font-size: calc(14px * var(--schrift, 1)); line-height: 1; cursor: pointer; }
  .ba-knopf::after { content: ''; position: absolute; inset: -7px; }
  .ba-knopf.einladen { background: var(--brand); border-color: var(--brand); }
  .ba-hg { position: fixed; inset: 0; z-index: 900; background: rgba(0,0,0,.55); }
  .ba { position: fixed; left: 50%; top: 50%; z-index: 901; transform: translate(-50%, -50%); width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; display: flex; flex-direction: column; gap: 8px; padding: 18px; border-radius: var(--radius-l); background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
  .ba h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .ba p { margin: 0; font-size: calc(14px * var(--schrift, 1)); }
  .ba-name { color: var(--muted); font-weight: 700; }
  .ba-zeile { display: flex; align-items: center; justify-content: center; min-height: 46px; text-align: center; text-decoration: none; cursor: pointer; }
  .ba-zeile input { display: none; }
  .ba .ba-tipp { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ba-zu { min-height: 44px; border: none; background: none; color: var(--brand-text); font-weight: 700; cursor: pointer; }
</style>
