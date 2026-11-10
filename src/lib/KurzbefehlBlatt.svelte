<script>
  // V35: „Direkt senden“ am iPhone, iPad und Mac. Ein Kurzbefehl in Apples App „Kurzbefehle“ schickt den Text von
  // TravelBuddy ohne Tipp auf Senden als Nachricht an die Leute, die im Kurzbefehl stehen. Einmal einrichten,
  // dann hier einschalten. Android und Windows lassen das einer Web-App nicht zu.
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { KURZBEFEHL, kurzbefehlAn, kurzbefehlLink, geraetArt } from './bescheid.js'
  import { zeigeToast } from './toast.js'

  let { onclose = () => {} } = $props()
  const mac = geraetArt() === 'mac'
  const PROBE = je('Test von TravelBuddy: Direkt senden funktioniert. Alles in Ordnung, kein Grund zur Sorge.', 'Test from TravelBuddy: sending directly works. All fine, no need to worry.')

  async function nameKopieren() {
    try { await navigator.clipboard.writeText(KURZBEFEHL); zeigeToast(je('Name kopiert', 'Name copied'), 'ok') } catch {}
  }
  function umschalten(e) {
    kurzbefehlAn.set(e.currentTarget.checked)
    zeigeToast(e.currentTarget.checked ? je('Direkt senden ist an', 'Sending directly is on') : je('Direkt senden ist aus', 'Sending directly is off'), 'ok')
  }
</script>

<div class="kb-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="kb" role="dialog" aria-labelledby="kb-titel" use:modal={{ onclose, fokus: '.kb-fertig' }}>
  <h2 id="kb-titel">⚡ {je('Direkt senden, ohne Tipp auf Senden', 'Send directly, without tapping Send')}</h2>
  <p class="kb-k">{mac
    ? je('Mit einem Kurzbefehl schickt dein Mac die Nachricht selbst ab, über Nachrichten und dein iPhone. Einmal einrichten, etwa 2 Minuten:', 'With a shortcut your Mac sends the message by itself, via Messages and your iPhone. Set it up once, about 2 minutes:')
    : je('Mit einem Kurzbefehl schickt dein iPhone die Nachricht selbst ab. Einmal einrichten, etwa 2 Minuten:', 'With a shortcut your iPhone sends the message by itself. Set it up once, about 2 minutes:')}</p>
  <ol class="kb-schritte">
    <li>{je('Öffne die App „Kurzbefehle“ und tippe auf „+“ für einen neuen Kurzbefehl.', 'Open the Shortcuts app and tap “+” for a new shortcut.')}</li>
    <li>{je('Füge die Aktion „Nachricht senden“ hinzu (Suchfeld unten).', 'Add the action “Send Message” (search field at the bottom).')}</li>
    <li>{je('Tippe auf „Nachricht“ und wähle „Kurzbefehl-Eingabe“. Tippe auf „Empfänger“ und wähle deine Leute aus den Kontakten, dieselben wie hier in TravelBuddy.', 'Tap “Message” and choose “Shortcut Input”. Tap “Recipients” and choose your people from your contacts, the same as here in TravelBuddy.')}</li>
    <li>{je('Klapp die Aktion mit dem kleinen Pfeil auf und schalte „Beim Ausführen zeigen“ aus (bei neuem iOS heißt es „Verfassen-Fenster anzeigen“).', 'Expand the action with the small arrow and turn off “Show When Run” (on newer iOS it is called “Show Compose Sheet”).')}</li>
    <li>{je('Nenne den Kurzbefehl genau so:', 'Name the shortcut exactly:')} <button class="kb-name" onclick={nameKopieren} title={je('Name kopieren', 'Copy name')}>{KURZBEFEHL} 📋</button></li>
    <li>{je('Schalte hier unten „Direkt senden“ ein und mach einmal die Probe. Fragt das Gerät, ob der Kurzbefehl Nachrichten senden darf: „Immer erlauben“.', 'Turn on “Send directly” below and run the test once. If your device asks whether the shortcut may send messages: “Always Allow”.')}</li>
  </ol>
  <label class="kb-schalter">
    <input type="checkbox" checked={$kurzbefehlAn} onchange={umschalten} />
    <span><b>{je('Direkt senden', 'Send directly')}</b><small>{je('„Mir geht\'s gut“, Standort und SOS gehen dann über den Kurzbefehl. WhatsApp bleibt ein eigener Schritt mit Tipp auf Senden.', '“I\'m okay”, location and SOS then go via the shortcut. WhatsApp stays a separate step with a tap on Send.')}</small></span>
  </label>
  {#if $kurzbefehlAn}
    <a class="bedien-knopf kb-probe" href={kurzbefehlLink(PROBE)}>{je('Probe an deine Leute senden', 'Send a test to your people')}</a>
    <p class="kb-k">{je('Die Probe sagt ausdrücklich, dass alles in Ordnung ist. Kam sie an, klappt es auch im Notfall.', 'The test says clearly that all is fine. If it arrives, it works in an emergency too.')}</p>
  {/if}
  <button class="bedien-knopf kb-fertig" onclick={onclose}>{je('Fertig', 'Done')}</button>
</div>

<style>
  .kb-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); }
  .kb { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(460px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
  h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .kb-k { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .kb-schritte { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 8px; font-size: calc(14px * var(--schrift, 1)); line-height: 1.45; }
  .kb-name { min-height: 40px; padding: 4px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--bg); color: var(--ink); font: inherit; font-weight: 800; cursor: pointer; }
  .kb-schalter { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 2px solid var(--brand); border-radius: var(--radius-m); background: var(--flaeche); cursor: pointer; }
  .kb-schalter input { width: 22px; height: 22px; margin: 2px 0 0; accent-color: var(--brand); flex: none; }
  .kb-schalter span { display: flex; flex-direction: column; gap: 3px; }
  .kb-schalter small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.4; }
  .kb-probe { display: flex; align-items: center; justify-content: center; min-height: 48px; text-decoration: none; }
  .kb-fertig { min-height: 44px; }
</style>
