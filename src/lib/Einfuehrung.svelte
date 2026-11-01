<script>
  import { t, tn, je, sprache, setzeSprache } from './i18n.js'
  // Einführung beim ersten Öffnen: führt einmal durch die App. Jeder Schritt
  // erklärt kurz und lässt das Wichtigste gleich wirklich tun: Startdatum, erste Etappe, eine
  // Buchung, Dokumente aufs Gerät. Für die echten Blätter und Seiten tritt die Einführung zur
  // Seite; ist das Blatt zu oder tippt man unten auf „Weiter“, geht es mit dem nächsten Schritt
  // weiter. Mehr → „Einführung noch einmal“ startet sie neu (einfuehrung.js).
  import { ready, gesamtStart, reiseTage, reisen, buchungen, datenStand } from './userdata.js'
  import { neuAnfrage, oeffneNeu } from './neu.js'
  import { gueltigesDatum, istEtappe, plusTage } from './plan.js'
  import { tagMonatJahr } from './format.js'
  import Stepper from './Stepper.svelte'
  import { modal } from './modal.js'
  import { blattRaus, ausblenden } from './motion.js'
  import { SCHRITTE, einfuehrung, lies, merke, sollZeigen, istLeer } from './einfuehrung.js'
  import { testreiseKnopf } from './testreise-dienst.js'
  import { GROSSE_KARTE } from './karten-config.js'
  import { kartenLauf, ladePaket, paketMB } from './karten-laden.js'
  import { online } from './netz.js'
  import { zeigeToast } from './toast.js'

  let { geh = () => {}, anzahlOrte = 0 } = $props()

  // Einmal nach dem Laden der Daten entscheiden, ob sie erscheint
  let entschieden = false
  $effect(() => {
    if (!$ready || entschieden) return
    entschieden = true
    const stand = lies()
    const leer = istLeer(datenStand(), ($buchungen?.events || []).length)
    if (sollZeigen(stand, leer)) einfuehrung.set({ schritt: stand?.schritt ?? 0, pause: null })
  })

  const offen = $derived($einfuehrung)
  const id = $derived(offen ? SCHRITTE[offen.schritt] : null)
  const nr = $derived(offen ? offen.schritt + 1 : 0)
  const etappen = $derived($reisen.filter(istEtappe).length)
  const termine = $derived(($buchungen?.events || []).filter((b) => !b.platzhalter).length)

  // Startdatum: das Feld zeigt den gespeicherten Wert (Vorgabe: Erster des nächsten Monats)
  let start = $state('')
  let dauer = $state(0)
  $effect(() => { if (id === 'start' && !start) { start = $gesamtStart; dauer = $reiseTage || 21 } })

  function setze(schritt, pause = null) {
    einfuehrung.set({ schritt, pause })
    merke({ schritt, fertig: false })
  }
  function weiter() {
    if (!offen) return
    if (id === 'start' && gueltigesDatum(start)) { gesamtStart.set(start); reiseTage.set(dauer) }
    if (offen.schritt >= SCHRITTE.length - 1) return beenden()
    setze(offen.schritt + 1)
  }
  function zurueck() { if (offen?.schritt > 0) setze(offen.schritt - 1) }
  function testreise() { beenden(); testreiseKnopf() }

  // Läuft im Hintergrund weiter, die Einführung kann derweil weitergehen
  let kartenFertig = $state(false)
  async function karten(gross) {
    try { await ladePaket(gross); kartenFertig = true }
    catch { zeigeToast(t('Das Kartenmaterial ließ sich nicht laden. Auf der Kartenseite kannst du es noch einmal versuchen.'), 'fehler', 6000) }
  }
  function beenden() {
    einfuehrung.set(null)
    merke({ schritt: 0, fertig: true })
  }

  // Ein echtes Neu-Blatt öffnen: erst das Blatt, dann die Pause (sonst ginge es sofort weiter)
  function blatt(typ, vorlage = {}) {
    oeffneNeu(typ, vorlage)
    einfuehrung.update((e) => e && { ...e, pause: 'blatt' })
  }
  // Ist das Blatt zu (angelegt oder abgebrochen), kommt derselbe Schritt zurück: dort steht
  // dann, was angelegt ist, und man kann weiter oder noch etwas anlegen.
  $effect(() => {
    if (offen?.pause === 'blatt' && !$neuAnfrage) einfuehrung.update((e) => e && { ...e, pause: null })
  })

  // Zu einer Seite gehen und sich dort umsehen; unten führt ein Knopf weiter
  function seite(pfad, ziel = '') {
    geh(pfad)
    einfuehrung.update((e) => e && { ...e, pause: 'seite' })
    // Nach dem Seitenwechsel (Bildübergang, Scroll-Stand) den Abschnitt aufklappen und hinscrollen.
    // Die Seite steht je nach Gerät erst nach einem Moment, deshalb bis zu 3 s lang nachsehen.
    if (ziel) {
      let versuche = 0
      const suche = () => {
        const el = document.querySelector(ziel)
        if (!el) { if (++versuche < 20) setTimeout(suche, 150); return }
        el.closest('[aria-expanded="false"]')?.click()
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
      }
      setTimeout(suche, 500)
    }
  }
  function zurueckAusSeite() { if (offen) setze(Math.min(offen.schritt + 1, SCHRITTE.length - 1)) }
</script>

{#if offen && !offen.pause}
  <div class="ef-hg" out:ausblenden data-dialog-hg aria-hidden="true"></div>
  <div class="ef" out:blattRaus role="dialog" aria-labelledby="ef-titel" aria-describedby="ef-text" use:modal={{ onclose: beenden }}>
    <div class="ef-kopf">
      <span class="ef-nr">{t('Schritt {nr} von {n}', { nr, n: SCHRITTE.length })}</span>
      <button class="ef-zu" onclick={beenden} aria-label={t('Einführung beenden')}>✕</button>
    </div>
    <div class="ef-punkte" aria-hidden="true">{#each SCHRITTE as s, i (s)}<span class:an={i <= offen.schritt}></span>{/each}</div>

    {#if id === 'willkommen'}
      <p class="ef-icon" aria-hidden="true">🦘</p>
      <h2 id="ef-titel">{t('Willkommen bei TravelBuddy')}</h2>
      <p id="ef-text">{t('Deine Reise-App für Western Australia: Orte, Routen, Plan, Buchungen und Notfall. Und ganz nebenbei entsteht dein Reisetagebuch. Alles bleibt auf deinem Gerät, ohne Konto und ohne Anmeldung, und vieles geht auch offline.')}</p>
      <p class="ef-k">{t('In ein paar Schritten richtest du alles ein. Jeden Schritt kannst du überspringen.')}</p>
      <div class="segment ef-sprache" role="group" aria-label={t('Sprache')}>
        {#each [['de', 'Deutsch'], ['en', 'English']] as [s, l]}
          <button class:an={sprache === s} aria-pressed={sprache === s} lang={s} onclick={() => setzeSprache(s)}>{l}</button>
        {/each}
      </div>
      <div class="ef-karten">
        {#if $kartenLauf}<p class="ef-k" role="status">📥 {t('{name} wird geladen, {fertig} von {gesamt}', $kartenLauf)}</p>
        {:else if kartenFertig}<p class="ef-ok" role="status">✓ {t('Kartenmaterial liegt auf dem Gerät')}</p>
        {:else}
          <p class="ef-k">🗺️ {t('Kartenmaterial für unterwegs laden, am besten im WLAN:')}</p>
          <div class="ef-karten-knoepfe">
            <button class="btn" disabled={!$online} onclick={() => karten(false)}>{t('Klein · {mb} MB', { mb: paketMB(false) })}</button>
            {#if GROSSE_KARTE}<button class="btn" disabled={!$online} onclick={() => karten(true)}>{t('Groß · {mb} MB', { mb: paketMB(true) })}</button>{/if}
          </div>
        {/if}
      </div>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={weiter}>{t('Los geht’s')}</button>
        <button class="btn ef-test" onclick={testreise}>🧪 {t('Erst mit einer Testreise spielen')}</button>
        <button class="ef-leise" onclick={beenden}>{t('Später')}</button>
      </div>

    {:else if id === 'start'}
      <p class="ef-icon" aria-hidden="true">📅</p>
      <h2 id="ef-titel">{t('Wann geht es los, und wie lange?')}</h2>
      <p id="ef-text">{t('Reisebeginn und Dauer deiner Reise. Der Zeitraum steht dann oben im Titelbild, und die App rechnet daraus den Countdown und die Tage deiner Etappen. Beides lässt sich später im Plan ändern.')}</p>
      <div class="ef-zeile">
        <label class="ef-f">{t('Reisebeginn')}<input type="date" bind:value={start} /></label>
        <span class="ef-f">{t('Reisedauer in Tagen')}<Stepper value={dauer} min={1} max={365} label={t('Reisedauer in Tagen')} onchange={(v) => (dauer = v)} /></span>
      </div>
      {#if gueltigesDatum(start)}<p class="ef-k">{t('{von} bis {bis}, erscheint oben im Titelbild', { von: tagMonatJahr(start), bis: tagMonatJahr(plusTage(start, dauer - 1)) })}</p>{/if}
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={weiter} disabled={!gueltigesDatum(start)}>{je('Weiter', 'Next')}</button>
        <button class="ef-leise" onclick={zurueck}>{t('Zurück')}</button>
      </div>

    {:else if id === 'etappe'}
      <p class="ef-icon" aria-hidden="true">🗺️</p>
      <h2 id="ef-titel">{t('Deine erste Etappe')}</h2>
      <p id="ef-text">{t('Eine Etappe ist ein Abschnitt deiner Reise mit Datum, zum Beispiel „Ankommen in Perth“ für drei Tage oder der Roadtrip mit dem Camper. Daran hängen später Routen, Orte und Buchungen.')}</p>
      {#if etappen}<p class="ef-ok">✓ {tn(etappen, '{n} Etappe angelegt', '{n} Etappen angelegt')}</p>{/if}
      <div class="ef-knoepfe">
        {#if etappen}
          <button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>
          <button class="ef-leise" onclick={() => blatt('etappe')}>{t('Noch eine Etappe anlegen')}</button>
        {:else}
          <button class="btn-primary ef-los" onclick={() => blatt('etappe', { von: $gesamtStart })}>{t('Etappe anlegen')}</button>
          <button class="ef-leise" onclick={weiter}>{t('Überspringen')}</button>
        {/if}
      </div>

    {:else if id === 'buchung'}
      <p class="ef-icon" aria-hidden="true">🎟️</p>
      <h2 id="ef-titel">{t('Buchungen einfügen')}</h2>
      <p id="ef-text">{t('Kopiere den Text einer Buchungsbestätigung, etwa aus der Mail von Airline, Hotel, Camper oder Tour, und füge ihn ein. Die App liest Datum, Uhrzeit, Ort, Buchungsnummer und Preis heraus und hängt die Buchung an die passende Etappe.')}</p>
      {#if termine}<p class="ef-ok">✓ {tn(termine, '{n} Buchung gespeichert', '{n} Buchungen gespeichert')}</p>{/if}
      <div class="ef-knoepfe">
        {#if termine}
          <button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>
          <button class="ef-leise" onclick={() => blatt('buchung')}>{t('Noch eine Buchung einfügen')}</button>
        {:else}
          <button class="btn-primary ef-los" onclick={() => blatt('buchung')}>{t('Buchung einfügen')}</button>
          <button class="ef-leise" onclick={weiter}>{t('Überspringen')}</button>
        {/if}
      </div>

    {:else if id === 'dokumente'}
      <p class="ef-icon" aria-hidden="true">📎</p>
      <h2 id="ef-titel">{t('Tickets und Dokumente aufs Gerät')}</h2>
      <p id="ef-text">{t('PDFs und Fotos von Tickets, Bestätigungen und Ausweisen lädst du unter Buchungen auf dein Gerät. Die App ordnet sie den Terminen zu, und du hast sie auch ohne Netz dabei.')}</p>
      <p class="ef-k">{t('Sie bleiben nur auf diesem Gerät und kommen nicht ins Backup. Wer mag, schützt sie dort mit Face ID oder Touch ID.')}</p>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={() => seite('mehr/vorbereitung', '#bu-titel')}>{t('Zu den Buchungen')}</button>
        <button class="ef-leise" onclick={weiter}>{t('Überspringen')}</button>
      </div>

    {:else if id === 'orte'}
      <p class="ef-icon" aria-hidden="true">📍</p>
      <h2 id="ef-titel">{t('Orte entdecken')}</h2>
      <p id="ef-text">{anzahlOrte ? t('Unter Orte warten {n} Orte mit Bildern, Sonnenzeiten und Tipps.', { n: anzahlOrte }) : t('Unter Orte warten viele Orte mit Bildern, Sonnenzeiten und Tipps.')} {t('Mit „Einplanen“ kommt ein Ort in deine Etappe, eigene Orte legst du mit „+ Ort hinzufügen“ an.')}</p>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={() => seite('orte')}>{t('Orte ansehen')}</button>
        <button class="ef-leise" onclick={weiter}>{t('Überspringen')}</button>
      </div>

    {:else if id === 'logbuch'}
      <p class="ef-icon" aria-hidden="true">📖</p>
      <h2 id="ef-titel">{t('Unterwegs entsteht dein Tagebuch')}</h2>
      <p id="ef-text">{t('Jeden Abend ein paar Zeilen, Fotos, Kilometer und die Tiere des Tages ins Logbuch. Daraus baut TravelBuddy von selbst dein Reisetagebuch, fertig zum Drucken und zum Teilen mit der Familie. Unter Heute steht derweil, was ansteht.')}</p>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>
        <button class="ef-leise" onclick={zurueck}>{t('Zurück')}</button>
      </div>

    {:else if id === 'sichern'}
      <p class="ef-icon" aria-hidden="true">📲</p>
      <h2 id="ef-titel">{t('Zum Schluss')}</h2>
      <ul class="ef-liste" id="ef-text">
        <li><b>{t('Auf den Home-Bildschirm:')}</b> {t('In Safari auf Teilen tippen und „Zum Home-Bildschirm“ wählen. Dann startet TravelBuddy wie eine App und läuft offline.')}</li>
        <li><b>{t('Backup:')}</b> {t('Deine Daten liegen nur auf diesem Gerät. Sichere sie ab und zu unter Mehr → Backup.')}</li>
        <li><b>{t('Hilfe:')}</b> {t('Das Handbuch und diese Einführung findest du jederzeit unter Mehr.')}</li>
      </ul>
      {#if gueltigesDatum($gesamtStart) && etappen}<p class="ef-ok">✓ {t('Reisebeginn {datum}', { datum: tagMonatJahr($gesamtStart) })}</p>{/if}
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={beenden}>{t('Fertig')}</button>
        <button class="ef-leise" onclick={zurueck}>{t('Zurück')}</button>
      </div>
    {/if}
  </div>
{:else if offen?.pause === 'seite'}
  <div class="ef-weiter" role="region" aria-label={t('Einführung')}>
    <button class="ef-weiter-los" onclick={zurueckAusSeite}>🧭 {t('Weiter mit der Einführung')} <small>{nr}/{SCHRITTE.length}</small></button>
    <button class="ef-weiter-x" onclick={beenden} aria-label={t('Einführung beenden')}>✕</button>
  </div>
{/if}

<style>
  .ef-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.45); z-index: 130; animation: hg var(--t-med) var(--ease-out); }
  .ef {
    position: fixed; z-index: 131; left: 0; right: 0; bottom: 0; max-height: 92dvh; overflow: auto;
    background: var(--bg); color: var(--ink); border-radius: 22px 22px 0 0; box-shadow: var(--shadow-float);
    padding: 14px 20px calc(20px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 12px;
    animation: hoch var(--t-slow) var(--ease-spring);
  }
  @media (min-width: 900px) {
    .ef { left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); width: 520px; border-radius: var(--radius-l); padding: 18px 24px 22px; animation: rein var(--t-med) var(--ease-spring); }
  }
  .ef-kopf { display: flex; align-items: center; justify-content: space-between; }
  .ef-nr { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ef-zu { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--flaeche-2); color: var(--ink); font-size: calc(16px * var(--schrift, 1)); cursor: pointer; }
  .ef-punkte { display: grid; grid-auto-flow: column; gap: 5px; }
  .ef-punkte span { height: 4px; border-radius: 2px; background: var(--line); }
  .ef-punkte span.an { background: var(--brand); }
  .ef .ef-icon { margin: 6px 0 0; font-size: calc(40px * var(--schrift, 1)); line-height: 1; }
  h2 { margin: 0; font-size: calc(22px * var(--schrift, 1)); line-height: 1.2; }
  .ef p { margin: 0; font-size: calc(16px * var(--schrift, 1)); line-height: 1.45; }
  .ef .ef-k { font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .ef .ef-ok { font-size: calc(15px * var(--schrift, 1)); font-weight: 700; color: var(--ok); }
  .ef-liste { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: calc(15px * var(--schrift, 1)); line-height: 1.45; }
  .ef-zeile { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
  .ef-zeile .ef-f { flex: 1 1 140px; min-width: 0; }
  .ef-f { display: flex; flex-direction: column; gap: 5px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ef-f input { min-height: 46px; font-size: max(16px, calc(17px * var(--schrift, 1))); padding: 8px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); font-weight: 400; }
  .ef-sprache { display: grid; grid-template-columns: 1fr 1fr; }
  .ef-sprache button { min-height: 44px; }
  .ef-karten { display: flex; flex-direction: column; gap: 6px; }
  .ef-karten-knoepfe { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
  .ef-karten-knoepfe .btn { min-height: 44px; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .ef-knoepfe { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .ef-los { min-height: 52px; font-size: calc(17px * var(--schrift, 1)); }
  .ef-los:disabled { opacity: 0.5; }
  .ef-test { min-height: 48px; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; }
  .ef-leise { min-height: 44px; border: none; background: none; color: var(--brand-text); font-size: calc(15px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }

  /* Beim Umsehen: ein Knopf über der unteren Leiste führt weiter */
  .ef-weiter {
    position: fixed; z-index: 95; left: 50%; transform: translateX(-50%);
    bottom: calc(env(safe-area-inset-bottom, 0px) + 96px);
    display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px;
    background: var(--brand); color: #fff; box-shadow: var(--shadow-float); max-width: calc(100vw - 32px);
    animation: hochMitte var(--t-slow) var(--ease-spring);
  }
  @media (min-width: 900px) { .ef-weiter { bottom: 24px; } }
  .ef-weiter button { border: none; background: none; color: inherit; cursor: pointer; }
  .ef-weiter-los { min-height: 44px; padding: 0 14px; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; white-space: nowrap; }
  .ef-weiter-los small { opacity: 0.8; font-weight: 600; margin-left: 4px; font-size: calc(13px * var(--schrift, 1)); }
  .ef-weiter-x { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.18) !important; font-size: calc(14px * var(--schrift, 1)); }
  @keyframes hg { from { opacity: 0; } }
  @keyframes hoch { from { transform: translateY(40px); opacity: 0.4; } }
  @keyframes rein { from { opacity: 0; } }
  @keyframes hochMitte { from { transform: translate(-50%, 40px); opacity: 0.4; } }
</style>
