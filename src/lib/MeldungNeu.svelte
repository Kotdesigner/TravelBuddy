<script>
  // Neue Meldung (V32): beim ersten Mal kurz die Regeln und der Name, dann Art, Ort, ein Satz. Gilt 3 Tage.
  // Ohne Netz bleibt sie in der Warteschlange (meldungen.js) und geht raus, sobald Netz da ist.
  import { get } from 'svelte/store'
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { online } from './netz.js'
  import { profil, profilSetzen, gruppen } from './verbinden.js'
  import { standort, frageStandortAn } from './standort.js'
  import OrtWahl from './OrtWahl.svelte'
  import { melden, regelnGelesen, regelnOk, meldungen } from './meldungen.js'
  import { ART, artName, BEISPIEL, grundText } from './meldungen-text.js'
  import { textProblem, MAX_TEXT, TAGE } from './meldungen-regeln.js'

  let { vorlage = {}, orte = [], reisen = [], onclose = () => {}, onmeine = () => {} } = $props()

  let schritt = $state(regelnGelesen() ? 'form' : 'regeln')
  let name = $state(get(profil).name || '')
  let art = $state(vorlage.art || '')
  let text = $state('')
  let wo = $state(vorlage.lat != null && vorlage.lon != null ? { lat: vorlage.lat, lon: vorlage.lon, name: vorlage.ort || '' } : null)
  let suche = $state(false)
  let holt = $state(false)
  let fehler = $state('')
  let sendet = $state(false)
  let ergebnis = $state(null)

  function regelnFertig() {
    profilSetzen({ ...get(profil), name: name.trim() })
    regelnOk()
    schritt = 'form'
  }
  async function standortNehmen() {
    holt = true; fehler = ''
    await frageStandortAn({ hoheGenauigkeit: true, alterMs: 60000 })
    holt = false
    const s = get(standort)
    if (s) { wo = { lat: s.lat, lon: s.lon, name: '' }; suche = false }
    else fehler = je('Standort nicht verfügbar. Such den Ort stattdessen.', 'Location not available. Search for the place instead.')
  }
  async function senden() {
    fehler = ''
    if (!art) { fehler = grundText('art'); return }
    if (!wo) { fehler = grundText('ort'); return }
    const p = textProblem(text)
    if (p) { fehler = grundText(p); return }
    sendet = true
    const e = await melden({ art, text, name: get(profil).name, lat: wo.lat, lon: wo.lon, ort: wo.name }, { online: get(online) })
    sendet = false
    if (e.fehler) { fehler = grundText(e.fehler); return }
    if (e.eintrag?.status === 'abgelehnt') { fehler = grundText(e.eintrag.grund); return }
    ergebnis = e.eintrag
    schritt = 'fertig'
  }
</script>

<div class="mn-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="mn" role="dialog" aria-labelledby="mn-titel" use:modal={{ onclose, fokus: '.mn-fokus' }}>
  {#if schritt === 'regeln'}
    <h2 id="mn-titel">{je('Kurz vorab', 'Before you start')}</h2>
    <p class="mn-k">{$meldungen.gruppe
      ? je('Deine Meldung sehen alle TravelBuddy-Reisenden in der Gegend, an Route und Ort, und die TravelBuddy-Gruppe auf Telegram. Sie gilt 3 Tage.', 'Your report is seen by all TravelBuddy travellers in the area, on routes and places, and in the TravelBuddy group on Telegram. It is valid for 3 days.')
      : je('Deine Meldung sehen alle TravelBuddy-Reisenden in der Gegend, an Route und Ort. Sie gilt 3 Tage.', 'Your report is seen by all TravelBuddy travellers in the area, on routes and places. It is valid for 3 days.')}</p>
    <ul class="mn-regeln">
      <li>✓ {je('Was andere unterwegs wissen sollten: Wege, Tiere, Tanken, Camping, Wetter, Tipps', 'What others should know on the road: roads, wildlife, fuel, camping, weather, tips')}</li>
      <li>✕ {je('Keine Telefonnummern, keine Namen anderer, keine Werbung', 'No phone numbers, no names of others, no advertising')}</li>
      <li>✕ {je('Nichts Beleidigendes. Unpassendes wird entfernt.', 'Nothing offensive. Inappropriate posts are removed.')}</li>
    </ul>
    <label class="mn-f">{je('Dein Name bei Meldungen', 'Your name on reports')}<input class="mn-fokus" bind:value={name} maxlength="30" placeholder={je('z. B. Kim, oder leer lassen', 'e.g. Kim, or leave empty')} /></label>
    <p class="mn-k">{je('Ohne Namen steht „Reisende/r“ da. Derselbe Name gilt für deinen Kontakt-Code.', 'Without a name it shows “Traveller”. The same name is used for your contact code.')}</p>
    <div class="mn-knoepfe"><button class="bedien-knopf" onclick={onclose}>{je('Abbrechen', 'Cancel')}</button><button class="bedien-knopf haupt" onclick={regelnFertig}>{je('Verstanden', 'Got it')}</button></div>

  {:else if schritt === 'form'}
    <h2 id="mn-titel">{je('Neue Meldung', 'New report')}</h2>
    <p class="mn-k">{je(`Für andere Reisende, gilt ${TAGE} Tage.`, `For other travellers, valid for ${TAGE} days.`)} {#if $profil.name}{je(`Als ${$profil.name}.`, `As ${$profil.name}.`)}{/if}</p>
    <div class="mn-f">{je('Was gibt es?', 'What is it about?')}</div>
    <div class="mn-arten" role="radiogroup" aria-label={je('Art der Meldung', 'Type of report')}>
      {#each Object.keys(ART) as a (a)}
        <button class="mn-art" class:an={art === a} role="radio" aria-checked={art === a} onclick={() => { art = a; fehler = '' }}><span aria-hidden="true">{ART[a].icon}</span>{artName(a)}</button>
      {/each}
    </div>
    <div class="mn-f">{je('Wo?', 'Where?')}</div>
    {#if wo && !suche}
      <div class="mn-wo"><span>📍 {wo.name || je('Mein Standort', 'My location')}</span><button class="mn-leise" onclick={() => (suche = true)}>{je('ändern', 'change')}</button></div>
    {:else}
      <div class="mn-wo-wahl">
        <button class="btn" onclick={standortNehmen} disabled={holt}>{holt ? je('sucht …', 'locating …') : je('📍 Mein Standort', '📍 My location')}</button>
        <OrtWahl {orte} {reisen} label={je('Ort suchen', 'Search place')} onwahl={(o) => { wo = { lat: o.lat, lon: o.lon, name: o.name }; suche = false; fehler = '' }} />
      </div>
    {/if}
    <label class="mn-f">{je('Was genau?', 'What exactly?')}
      <textarea class={schritt === 'form' && wo ? 'mn-fokus' : ''} bind:value={text} rows="3" maxlength={MAX_TEXT} placeholder={art ? BEISPIEL[art]() : je('Ein Satz reicht', 'One sentence is enough')} oninput={() => (fehler = '')}></textarea>
    </label>
    <div class="mn-zeile"><span class="mn-k">{text.length}/{MAX_TEXT}</span>{#if $gruppen.telegram}<a class="mn-k mn-link" href={$gruppen.telegram} target="_blank" rel="noopener noreferrer">{je('Foto dazu? In der TravelBuddy-Gruppe teilen ↗', 'Photo? Share it in the TravelBuddy group ↗')}</a>{/if}</div>
    {#if fehler}<p class="mn-fehler" role="alert">{fehler}</p>{/if}
    <div class="mn-knoepfe"><button class="bedien-knopf" onclick={onclose}>{je('Abbrechen', 'Cancel')}</button><button class="bedien-knopf haupt" onclick={senden} disabled={sendet}>{sendet ? je('sendet …', 'sending …') : je('Melden', 'Report')}</button></div>
    <p class="mn-k">{$online ? je('Geht sofort raus.', 'Goes out right away.') : je('Kein Netz: wird gespeichert und geht raus, sobald du wieder Netz hast.', 'No signal: saved and sent as soon as you have signal again.')}</p>

  {:else}
    <h2 id="mn-titel">{je('Danke!', 'Thank you!')}</h2>
    {#if ergebnis?.status === 'live'}
      <p class="mn-ok">✓ {$meldungen.gruppe
        ? je('Veröffentlicht. Andere sehen sie jetzt an Route und Ort und in der TravelBuddy-Gruppe.', 'Published. Others now see it on routes and places and in the TravelBuddy group.')
        : je('Veröffentlicht. Andere sehen sie jetzt an Route und Ort.', 'Published. Others now see it on routes and places.')}</p>
    {:else}
      <p class="mn-warte">📴 {je('Gespeichert. Geht raus, sobald du wieder Netz hast.', 'Saved. Goes out as soon as you have signal again.')}</p>
    {/if}
    <div class="mn-vorschau"><b>{ART[art].icon} {artName(art)}</b> {text}<small>{wo?.name || je('Mein Standort', 'My location')}</small></div>
    <div class="mn-knoepfe"><button class="bedien-knopf" onclick={onmeine}>{je('Meine Meldungen', 'My reports')}</button><button class="bedien-knopf haupt mn-fokus" onclick={onclose}>{je('Fertig', 'Done')}</button></div>
  {/if}
</div>

<style>
  .mn-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); }
  .mn { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(420px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
  h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .mn-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .mn-f { display: flex; flex-direction: column; gap: 6px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .mn-f input, textarea { min-height: 44px; font: inherit; font-size: max(16px, calc(15px * var(--schrift, 1))); font-weight: 400; padding: 8px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); resize: vertical; }
  .mn-regeln { margin: 0; padding: 10px 12px; list-style: none; border: 1px solid var(--line); border-radius: var(--radius-m); display: flex; flex-direction: column; gap: 6px; font-size: calc(14px * var(--schrift, 1)); }
  .mn-arten { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .mn-art { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 56px; padding: 6px 4px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: none; color: var(--ink); font: inherit; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .mn-art span { font-size: calc(20px * var(--schrift, 1)); }
  .mn-art.an { border: 2px solid var(--brand); background: var(--flaeche); color: var(--brand-text); }
  .mn-wo { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 12px; border: 1px solid var(--line); border-radius: var(--radius-m); font-size: calc(14px * var(--schrift, 1)); }
  .mn-wo span { flex: 1; }
  .mn-wo-wahl { display: flex; flex-direction: column; gap: 8px; }
  .mn-leise { border: none; background: none; color: var(--brand-text); font: inherit; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; min-height: 44px; }
  .mn-zeile { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .mn-link { color: var(--brand-text); text-decoration: none; font-weight: 700; }
  .mn-fehler { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--danger-text); font-weight: 700; }
  .mn-ok { margin: 0; padding: 10px 12px; border-radius: var(--radius-m); background: var(--ok-flaeche); color: var(--ok-text); font-weight: 700; }
  .mn-warte { margin: 0; padding: 10px 12px; border-radius: var(--radius-m); background: var(--warn-flaeche); color: var(--ink); font-weight: 700; }
  .mn-vorschau { padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-m); font-size: calc(14px * var(--schrift, 1)); display: flex; flex-direction: column; gap: 2px; }
  .mn-vorschau small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .mn-knoepfe { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
