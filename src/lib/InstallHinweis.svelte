<script>
  // Einmal beim ersten Öffnen im Browser: so kommt TravelBuddy auf den Home-Bildschirm.
  // Kommt vor der Einführung, damit niemand erst in Safari einträgt und es dann in der App vermisst.
  import { onMount, untrack } from 'svelte'
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { blattRaus, ausblenden } from './motion.js'
  import { hinweisArt, istIPad, erledigt, merkeErledigt, laeuftAlsApp, installOffen, installAngebot, installOeffnen, geraet } from './install.js'

  const SPAETER = 'tb-install-spaeter'
  let art = $state(null)
  let ipad = $state(false)
  let mac = $state(false)                      // „danach“: Dock statt Home-Bildschirm

  // erzwungen: aus dem Menü „📲 App einrichten“, dann auch nach „Später“ oder „Erledigt“
  function pruefe(erzwungen = false) {
    let spaeter = false
    try { spaeter = sessionStorage.getItem(SPAETER) === '1' } catch {}
    if (laeuftAlsApp()) merkeErledigt()
    const g = geraet()
    const a = spaeter && !erzwungen ? null : hinweisArt({ ...g, standalone: laeuftAlsApp(), erledigt: erzwungen ? false : erledigt() })
    ipad = istIPad(g)
    mac = a === 'mac'
    art = a
    installOffen.set(!!a)
  }
  onMount(() => pruefe())
  // Chrome meldet sein Angebot manchmal erst nach dem Start
  $effect(() => { if ($installAngebot && !art) untrack(() => pruefe()) })
  $effect(() => { if ($installOeffnen) untrack(() => pruefe(true)) })

  function zu() { art = null; installOffen.set(false) }
  function spaeter() { try { sessionStorage.setItem(SPAETER, '1') } catch {} zu() }
  function fertig() { merkeErledigt(); zu() }
  // Auf dem iPhone läuft nach „Erledigt“ noch der Safari-Tab: sagen, wo es weitergeht
  function iosErledigt() { merkeErledigt(); art = 'danach' }
  const TITEL = {
    danach: () => (mac ? je('Jetzt aus dem Dock öffnen', 'Now open it from the Dock') : je('Jetzt vom Home-Bildschirm öffnen', 'Now open it from your home screen')),
    mac: () => je('TravelBuddy ins Dock', 'Put TravelBuddy in the Dock'),
    rechner: () => je('TravelBuddy als App einrichten', 'Set up TravelBuddy as an app'),
    firefox: () => je('TravelBuddy als App', 'TravelBuddy as an app'),
  }
  async function installieren() {
    const e = $installAngebot
    if (!e) return fertig()
    e.prompt()
    try { const r = await e.userChoice; if (r?.outcome === 'accepted') return fertig() } catch {}
    installAngebot.set(null)
    zu()
  }
</script>

{#snippet teilen()}<svg class="ih-teilen" viewBox="0 0 24 24" role="img" aria-label={je('Teilen', 'Share')}><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>{/snippet}

{#if art}
  <div class="ih-hg" out:ausblenden data-dialog-hg aria-hidden="true"></div>
  <div class="ih" out:blattRaus role="dialog" aria-labelledby="ih-titel" aria-describedby="ih-text" use:modal={{ onclose: () => (art === 'danach' ? zu() : spaeter()) }}>
    <div class="ih-kopf">
      <span class="ih-icon" aria-hidden="true">{art === 'danach' ? '✅' : '📲'}</span>
      <button class="ih-zu" onclick={art === 'danach' ? zu : spaeter} aria-label={art === 'danach' ? je('Schließen', 'Close') : je('Später', 'Later')}>✕</button>
    </div>
    <h2 id="ih-titel">{TITEL[art] ? TITEL[art]() : je('TravelBuddy auf den Home-Bildschirm', 'Put TravelBuddy on your home screen')}</h2>
    {#if art === 'ios'}
      <p id="ih-text">{je('Dann startet TravelBuddy wie eine echte App, auch ohne Netz. Mach das am besten jetzt, bevor du etwas einträgst: Safari und Home-Bildschirm haben getrennte Speicher.', 'Then TravelBuddy starts like a real app, even without signal. Best do it now, before you enter anything: Safari and the home screen keep separate storage.')}</p>
      <ol class="ih-schritte">
        <li>
          <span class="ih-nr" aria-hidden="true">1</span>
          <span>{je('Tippe auf', 'Tap')} {@render teilen()} <b>{je('Teilen', 'Share')}</b>{#if ipad}{je(', oben rechts neben der Adresse. Bei neuem iPadOS steckt es hinter „•••“.', ', top right next to the address. On newer iPadOS it sits behind “•••”.')}{:else}{je(', unten in der Leiste. Bei neuem iOS steckt es hinter „•••“.', ', in the bar at the bottom. On newer iOS it sits behind “•••”.')}{/if}</span>
        </li>
        <li>
          <span class="ih-nr" aria-hidden="true">2</span>
          <span>{je('Wähle', 'Choose')} <b>{je('„Zum Home-Bildschirm“', '“Add to Home Screen”')}</b>{je('. Steht es nicht in der Liste, tippe unten rechts auf „Mehr anzeigen“ oder wische nach unten. Ist „Als Web-App öffnen“ zu sehen, bleibt der Schalter an.', '. If it is not in the list, tap “View More” at the bottom right or scroll down. If you see “Open as Web App”, leave it on.')}</span>
        </li>
        <li>
          <span class="ih-nr" aria-hidden="true">3</span>
          <span>{je('Tippe auf', 'Tap')} <b>{je('„Hinzufügen“', '“Add”')}</b> {je('und öffne TravelBuddy ab jetzt vom Home-Bildschirm.', 'and from now on open TravelBuddy from your home screen.')}</span>
        </li>
      </ol>
      <p class="ih-k">{je('Klappt nicht? Dann die Seite in Safari öffnen.', 'Not working? Open the page in Safari.')}</p>
      <div class="ih-knoepfe">
        <button class="btn-primary ih-los" onclick={iosErledigt}>{je('Erledigt', 'Done')}</button>
        <button class="ih-leise" onclick={spaeter}>{je('Später', 'Later')}</button>
      </div>
    {:else if art === 'danach'}
      {#if mac}<p id="ih-text">{je('Super. Öffne TravelBuddy jetzt über das neue Symbol im Dock, dort geht es mit der Einführung weiter. Dieses Safari-Fenster kannst du schließen.', 'Great. Now open TravelBuddy from the new icon in the Dock, the introduction continues there. You can close this Safari window.')}</p>{:else}
      <p id="ih-text">{je('Super. Öffne TravelBuddy jetzt über das neue Symbol auf dem Home-Bildschirm, dort geht es mit der Einführung weiter. Diesen Safari-Tab kannst du schließen.', 'Great. Now open TravelBuddy from the new icon on your home screen, the introduction continues there. You can close this Safari tab.')}</p>{/if}
      <div class="ih-knoepfe">
        <button class="ih-leise" onclick={zu}>{je('Trotzdem hier im Browser weiter', 'Continue here in the browser anyway')}</button>
      </div>
    {:else if art === 'android'}
      <p id="ih-text">{je('Dann startet TravelBuddy wie eine echte App, mit eigenem Symbol und auch ohne Netz. Was du schon eingetragen hast, bleibt dabei erhalten.', 'Then TravelBuddy starts like a real app, with its own icon and even without signal. Anything you have already entered stays.')}</p>
      {#if $installAngebot}
        <div class="ih-knoepfe">
          <button class="btn-primary ih-los" onclick={installieren}>{je('Installieren', 'Install')}</button>
          <button class="ih-leise" onclick={spaeter}>{je('Später', 'Later')}</button>
        </div>
      {:else}
        <ol class="ih-schritte">
          <li>
            <span class="ih-nr" aria-hidden="true">1</span>
            <span>{je('Tippe im Browser auf das Menü', 'Tap the browser menu')} <b>⋮</b> {je('oben rechts, in Samsung Internet auf', 'at the top right, in Samsung Internet on')} <b>≡</b> {je('unten.', 'at the bottom.')}</span>
          </li>
          <li>
            <span class="ih-nr" aria-hidden="true">2</span>
            <span>{je('Wähle', 'Choose')} <b>{je('„App installieren“', '“Install app”')}</b> {je('oder', 'or')} <b>{je('„Zum Startbildschirm hinzufügen“', '“Add to Home screen”')}</b>{je('. In Samsung Internet heißt es „Seite hinzufügen zu“ und dann „Startbildschirm“.', '. In Samsung Internet it is “Add page to”, then “Home screen”.')}</span>
          </li>
          <li>
            <span class="ih-nr" aria-hidden="true">3</span>
            <span>{je('Bestätige mit', 'Confirm with')} <b>{je('„Installieren“', '“Install”')}</b> {je('oder', 'or')} <b>{je('„Hinzufügen“', '“Add”')}</b>.</span>
          </li>
        </ol>
        <div class="ih-knoepfe">
          <button class="btn-primary ih-los" onclick={fertig}>{je('Erledigt', 'Done')}</button>
          <button class="ih-leise" onclick={spaeter}>{je('Später', 'Later')}</button>
        </div>
      {/if}
    {:else if art === 'mac'}
      <p id="ih-text">{je('Dann startet TravelBuddy wie eine eigene App aus dem Dock, auch ohne Netz. Mach das am besten jetzt, bevor du etwas einträgst: Safari und die App im Dock haben getrennte Speicher.', 'Then TravelBuddy starts like its own app from the Dock, even without signal. Best do it now, before you enter anything: Safari and the Dock app keep separate storage.')}</p>
      <ol class="ih-schritte">
        <li><span class="ih-nr" aria-hidden="true">1</span><span>{je('Klicke in Safari oben auf', 'In Safari click')} <b>{je('Ablage', 'File')}</b> {je('oder in der Symbolleiste auf', 'or in the toolbar on')} {@render teilen()} <b>{je('Teilen', 'Share')}</b>.</span></li>
        <li><span class="ih-nr" aria-hidden="true">2</span><span>{je('Wähle', 'Choose')} <b>{je('„Zum Dock hinzufügen“', '“Add to Dock”')}</b>.</span></li>
        <li><span class="ih-nr" aria-hidden="true">3</span><span>{je('Klicke auf', 'Click')} <b>{je('„Hinzufügen“', '“Add”')}</b> {je('und öffne TravelBuddy ab jetzt aus dem Dock.', 'and from now on open TravelBuddy from the Dock.')}</span></li>
      </ol>
      <p class="ih-k">{je('„Zum Dock hinzufügen“ gibt es ab macOS Sonoma.', '“Add to Dock” is available from macOS Sonoma.')}</p>
      <div class="ih-knoepfe">
        <button class="btn-primary ih-los" onclick={iosErledigt}>{je('Erledigt', 'Done')}</button>
        <button class="ih-leise" onclick={spaeter}>{je('Später', 'Later')}</button>
      </div>
    {:else if art === 'firefox'}
      <p id="ih-text">{je('Firefox kann TravelBuddy nicht als App einrichten. Das geht in Chrome, Edge oder am Mac in Safari. Hier im Firefox läuft trotzdem alles, auch ohne Netz.', 'Firefox cannot set up TravelBuddy as an app. Chrome, Edge or Safari on the Mac can. Here in Firefox everything still works, even without signal.')}</p>
      <div class="ih-knoepfe">
        <button class="btn-primary ih-los" onclick={fertig}>{je('Verstanden', 'Got it')}</button>
      </div>
    {:else}
      <!-- Chrome, Edge & Co. an Windows, Mac und Linux: ein Klick auf den Knopf öffnet das Installieren-Fenster -->
      <p id="ih-text">{je('Dann startet TravelBuddy wie ein eigenes Programm, mit eigenem Fenster und Symbol, auch ohne Netz. Was du schon eingetragen hast, bleibt dabei erhalten.', 'Then TravelBuddy starts like its own program, with its own window and icon, even without signal. Anything you have already entered stays.')}</p>
      {#if $installAngebot}
        <div class="ih-knoepfe">
          <button class="btn-primary ih-los" onclick={installieren}>{je('Installieren', 'Install')}</button>
          <button class="ih-leise" onclick={spaeter}>{je('Später', 'Later')}</button>
        </div>
      {:else}
        <ol class="ih-schritte">
          <li><span class="ih-nr" aria-hidden="true">1</span><span>{je('Klicke rechts in der Adressleiste auf das Symbol zum Installieren', 'Click the install icon at the right of the address bar')} <b>⊕</b>.</span></li>
          <li><span class="ih-nr" aria-hidden="true">2</span><span>{je('Oder öffne das Menü', 'Or open the menu')} <b>⋮</b> {je('in Chrome bzw.', 'in Chrome or')} <b>…</b> {je('in Edge und wähle', 'in Edge and choose')} <b>{je('„TravelBuddy installieren“', '“Install TravelBuddy”')}</b> {je('bzw.', 'or')} <b>{je('„Apps“ → „Diese Website als App installieren“', '“Apps” → “Install this site as an app”')}</b>.</span></li>
          <li><span class="ih-nr" aria-hidden="true">3</span><span>{je('Bestätige mit', 'Confirm with')} <b>{je('„Installieren“', '“Install”')}</b>.</span></li>
        </ol>
        <div class="ih-knoepfe">
          <button class="btn-primary ih-los" onclick={fertig}>{je('Erledigt', 'Done')}</button>
          <button class="ih-leise" onclick={spaeter}>{je('Später', 'Later')}</button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .ih-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.45); z-index: 130; animation: hg var(--t-med) var(--ease-out); }
  .ih {
    position: fixed; z-index: 131; left: 0; right: 0; bottom: 0; max-height: 92dvh; overflow: auto;
    background: var(--bg); color: var(--ink); border-radius: 22px 22px 0 0; box-shadow: var(--shadow-float);
    --unten: calc(16px + env(safe-area-inset-bottom, 0px)); padding: 12px 18px var(--unten); display: flex; flex-direction: column; gap: 10px;
    animation: hoch var(--t-slow) var(--ease-spring);
  }
  @media (min-width: 900px), (orientation: landscape) and (min-width: 640px) {
    .ih { --unten: 22px; left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); width: 520px; max-height: calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); border-radius: var(--radius-l); padding: 18px 24px var(--unten); animation: rein var(--t-med) var(--ease-spring); }
  }
  .ih-kopf { display: flex; align-items: center; justify-content: space-between; }
  .ih-icon { font-size: calc(30px * var(--schrift, 1)); line-height: 1; }
  .ih-zu { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--flaeche-2); color: var(--ink); font-size: calc(16px * var(--schrift, 1)); cursor: pointer; }
  h2 { margin: 0; font-size: calc(21px * var(--schrift, 1)); line-height: 1.2; }
  .ih p { margin: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.5; }
  .ih .ih-k { font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); }
  .ih-schritte { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ih-schritte li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 12px; background: var(--flaeche-2); font-size: calc(15px * var(--schrift, 1)); line-height: 1.45; }
  .ih-nr { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--brand); color: #fff; font-weight: 800; font-size: calc(13px * var(--schrift, 1)); }
  .ih-teilen { width: 20px; height: 20px; vertical-align: -4px; color: #1f6fd1; }
  /* Nebeneinander statt untereinander: in Safari liegt unten die schwebende Leiste, so passt alles ohne Wischen */
  .ih-knoepfe { display: flex; flex-direction: row-reverse; gap: 10px; margin-top: 2px; }
  /* Knöpfe bleiben unten stehen, auch wenn der Inhalt höher ist als der Bildschirm (iPhone quer) */
  .ih-knoepfe { position: sticky; bottom: calc(-1 * var(--unten)); z-index: 1; padding-top: 8px; padding-bottom: var(--unten); margin-bottom: calc(-1 * var(--unten)); background: var(--bg); }
  .ih-knoepfe > * { flex: 1; }
  .ih-knoepfe > :only-child { flex: 1 1 100%; }
  .ih-los { min-height: 50px; font-size: calc(17px * var(--schrift, 1)); }
  .ih-leise { min-height: 50px; border: 1px solid var(--line-stark); border-radius: 14px; background: none; color: var(--brand-text); font-size: calc(15px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
</style>
