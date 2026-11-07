<script>
  import Zusammenhang from './Zusammenhang.svelte'
  let zhAuf = $state(false)
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
  import { GEBIETE, pistenStand, pistenLaedt, pistenLaden, pistenPruefen, netzInfo } from './routing-offline.js'
  import InfoKnopf from './InfoKnopf.svelte'
  import { theme, setzeTheme } from './theme.js'
  import { kartenThema, grossThema } from './karten-thema.js'
  import { darstellung, setzeSchrift, SCHRIFT } from './darstellung.js'
  import { reichweite } from './routen-dienst.js'
  import { allradVorgabe } from './fahrzeug.js'
  import { vorabKosten } from './userdata.js'
  import { istRoute } from './plan.js'
  import { appEinrichten } from './install.js'

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
  // 1.27: Route, Vorabausgaben, Verkehrsmittel, Begriffe zum Aufklappen, Check „Bereit für unterwegs?“
  const routen = $derived($reisen.filter((r) => istRoute(r) && (r.stops || []).length >= 2 && !['flug', 'bahn', 'boot'].includes(r.art)).length)
  const verkehr = $derived($reisen.filter((r) => istRoute(r) && ['flug', 'bahn'].includes(r.art)).length)
  const vorab = $derived(($vorabKosten || []).length)
  const SCHRIFT_NAME = { klein: t('Klein'), standard: t('Standard'), gross: t('Groß'), sehrgross: t('Sehr groß') }
  let begriffeAuf = $state(false)
  let geschuetzt = $state(null), kartenDa = $state(false)
  $effect(() => {
    if (id !== 'bereit') return
    try { navigator.storage?.persisted?.().then((x) => (geschuetzt = x)).catch(() => {}) } catch {}
    try { caches.open('karten-pmtiles-v2').then((c) => c.keys()).then((k) => (kartenDa = k.length > 0)).catch(() => {}) } catch {}
    pistenPruefen()
  })
  async function schuetzen() {
    try { geschuetzt = !!(await navigator.storage?.persist?.()) } catch { geschuetzt = false }
    if (!geschuetzt) zeigeToast(je('Der Browser hat den Schutz noch nicht erteilt. Auf dem Home-Bildschirm klappt es meist von selbst.', 'The browser did not grant protection yet. From the home screen it usually works by itself.'), 'info', 6000)
  }
  const kartenThemaWahl = $derived($kartenThema === $grossThema ? $kartenThema : 'auto')
  function setzeKarten(m) { kartenThema.set(m); grossThema.set(m) }

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

  // Offline-Routen (1.27): Pisten-Netz je Gebiet gleich hier laden, Größen aus netze.json
  let netze = $state({})
  $effect(() => { if (id === 'routen') { pistenPruefen(); netzInfo().then((m) => (netze = m)) } })
  const mbVon = (g) => { const b = netze[g]?.pisten?.bytes; return b ? (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', je(',', '.')) : '…' }
  async function pisten(g) {
    try { await pistenLaden(g); zeigeToast(je(`Pisten-Netz ${GEBIETE[g].name} gespeichert`, `Track network ${GEBIETE[g].name} saved`), 'ok') }
    catch { zeigeToast(je('Laden ging nicht. Unter Plan, Karte, Offline-Routen kannst du es noch einmal versuchen.', 'Could not load. You can try again under Plan, Map, Offline routes.'), 'fehler', 6000) }
  }

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
      <p class="ef-leit">{je('Einmal eintragen, überall nutzen: Ein Flug steht danach im Plan, im Kalender und in den Kosten, eine Route liefert Kilometer, Tankstopps und Wetter, und aus deinem Logbuch wird der Reisebericht.', 'Enter it once, use it everywhere: a flight then shows in the plan, the calendar and the costs, a route brings kilometres, fuel stops and weather, and your logbook becomes the travel report.')}<InfoKnopf id="aufbau" /></p>
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

    {:else if id === 'design'}
      <p class="ef-icon" aria-hidden="true">🎨</p>
      <h2 id="ef-titel">{je('So sieht es für dich gut aus', 'Make it look right for you')}</h2>
      <p id="ef-text">{je('Hell, dunkel oder wie das Gerät, die Karten passend dazu und die Schrift so groß, wie du sie gut lesen kannst. Alles lässt sich später unter Mehr, Design ändern.', 'Light, dark or like your device, the maps to match and text as large as you read it well. You can change it all later under More, Design.')}</p>
      <div class="ef-wahl">
        <span class="ef-f">{je('Erscheinungsbild', 'Appearance')}</span>
        <div class="segment" role="group" aria-label={je('Erscheinungsbild', 'Appearance')}>
          {#each [['auto', t('Auto')], ['hell', t('Hell')], ['dunkel', t('Dunkel')]] as [m, l]}<button class:an={$theme === m} aria-pressed={$theme === m} onclick={() => setzeTheme(m)}>{l}</button>{/each}
        </div>
        <span class="ef-f">{je('Karten', 'Maps')}</span>
        <div class="segment" role="group" aria-label={je('Karten', 'Maps')}>
          {#each [['auto', je('Wie die App', 'Like the app')], ['hell', t('Hell')], ['dunkel', t('Dunkel')]] as [m, l]}<button class:an={kartenThemaWahl === m} aria-pressed={kartenThemaWahl === m} onclick={() => setzeKarten(m)}>{l}</button>{/each}
        </div>
        <span class="ef-f">{t('Schrift')}</span>
        <div class="segment" role="group" aria-label={t('Schriftgröße')}>
          {#each SCHRIFT as s (s.id)}<button class:an={$darstellung.schrift === s.id} aria-pressed={$darstellung.schrift === s.id} onclick={() => setzeSchrift(s.id)}>{SCHRIFT_NAME[s.id]}</button>{/each}
        </div>
      </div>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>
        <button class="ef-leise" onclick={zurueck}>{t('Zurück')}</button>
      </div>

    {:else if id === 'fahrzeug'}
      <p class="ef-icon" aria-hidden="true">🚙</p>
      <h2 id="ef-titel">{je('Dein Fahrzeug', 'Your vehicle')}<InfoKnopf id="aufbau-route" /></h2>
      <p id="ef-text">{je('Damit weiß die App später, wo du tanken musst und welche Wege für dich gehen.', 'This tells the app where you need to refuel and which roads work for you.')}</p>
      <div class="ef-wahl">
        <span class="ef-f">{je('Reichweite mit einer Tankfüllung', 'Range on one tank')}</span>
        <Stepper value={$reichweite} min={50} max={2000} step={50} einheit="km" label={je('Reichweite in km', 'Range in km')} onchange={(v) => reichweite.set(v)} />
        <span class="ef-f">{je('Antrieb', 'Drive')}</span>
        <div class="segment" role="group" aria-label={je('Antrieb', 'Drive')}>
          <button class:an={!$allradVorgabe} aria-pressed={!$allradVorgabe} onclick={() => allradVorgabe.set(false)}>🚗 2WD</button>
          <button class:an={$allradVorgabe} aria-pressed={$allradVorgabe} onclick={() => allradVorgabe.set(true)}>🚙 4WD</button>
        </div>
        <p class="ef-k">{$allradVorgabe ? je('4WD: Die App nimmt Pisten und Tracks wie geplant, auch statt der Straßenroute, wenn sie kürzer sind.', '4WD: the app takes tracks as planned, also instead of the road route when shorter.') : je('2WD: Fernstrecken bleiben auf Asphalt, Pisten nur, wo es nicht anders geht.', '2WD: long drives stay on sealed roads, tracks only where there is no other way.')} {je('Gilt für jede neue Route und lässt sich an jeder Route einzeln umstellen.', 'Applies to every new route and can be switched on each route.')}</p>
      </div>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>
        <button class="ef-leise" onclick={zurueck}>{t('Zurück')}</button>
      </div>

    {:else if id === 'routen'}
      <p class="ef-icon" aria-hidden="true">🛣️</p>
      <h2 id="ef-titel">{je('Routen auch ohne Netz', 'Routes without internet too')}</h2>
      <p id="ef-text">{je('Ohne Netz rechnet TravelBuddy deine Routen selbst, auf echten Straßen und fast so genau wie online. Die Hauptstraßen sind schon dabei. Für Nationalparks, Pisten und 4WD-Tracks lädst du das Pisten-Netz deines Gebiets dazu.', 'Without internet, TravelBuddy calculates your routes itself, on real roads and almost as accurately as online. The main roads are already included. For national parks, unsealed roads and 4WD tracks, add the track network for your area.')}</p>
      <p class="ef-k">{je('Meldet Main Roads WA eine gesperrte Straße, etwa nach einem Unwetter oder bei überflutetem Floodway, bietet die App eine Umleitung an.', 'When Main Roads WA reports a closed road, for example after a storm or a flooded floodway, the app offers a detour.')}</p>
      <div class="ef-karten">
        <p class="ef-k">🪨 {je('Pisten-Netz laden, am besten im WLAN:', 'Load the track network, ideally on Wi-Fi:')}</p>
        <div class="ef-karten-knoepfe">
          {#each Object.entries(GEBIETE) as [g, geb] (g)}
            {#if $pistenStand[g]}<p class="ef-ok" role="status">✓ {geb.name}</p>
            {:else}<button class="btn" disabled={!$online || $pistenLaedt[g]} onclick={() => pisten(g)}>{$pistenLaedt[g] ? je('lädt …', 'loading …') : `${geb.name} · ${mbVon(g)} MB`}</button>{/if}
          {/each}
        </div>
        {#if !$online}<p class="ef-k">{je('Braucht Netz. Später geht es unter Plan, Karte, Offline-Routen.', 'Needs internet. Later you can do it under Plan, Map, Offline routes.')}</p>{/if}
      </div>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>
        <button class="ef-leise" onclick={zurueck}>{t('Zurück')}</button>
      </div>

    {:else if id === 'start'}
      <p class="ef-icon" aria-hidden="true">📅</p>
      <h2 id="ef-titel">{t('Wann geht es los, und wie lange?')}<InfoKnopf id="aufbau-datum" /></h2>
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
      <h2 id="ef-titel">{t('Deine erste Etappe')}<InfoKnopf id="aufbau-etappe" /></h2>
      <p id="ef-text">{t('Eine Etappe ist ein Abschnitt deiner Reise mit Datum, zum Beispiel „Ankommen in Perth“ für drei Tage oder der Roadtrip mit dem Camper. Daran hängen später Routen, Orte und Buchungen.')}</p>
      <button type="button" class="ef-leise ef-zh-knopf" aria-expanded={begriffeAuf} onclick={() => (begriffeAuf = !begriffeAuf)}>{begriffeAuf ? je('Drei Begriffe vorab ▴', 'Three terms first ▴') : je('Drei Begriffe vorab ▾', 'Three terms first ▾')}</button>
      {#if begriffeAuf}
      <p class="ef-k">{je('Die Etappe gliedert die Reise, der Kalender zeigt sie nach Datum, das Logbuch hält fest, was wirklich passiert ist.', 'A leg structures the trip, the calendar shows it by date, the logbook records what really happened.')}</p>
      <dl class="ef-begriffe">
        <div><svg class="ef-bild" viewBox="0 0 64 48" aria-hidden="true"><path d="M5 34h18" stroke="#c1662f" stroke-width="5" stroke-linecap="round"/><path d="M26 34h16" stroke="#2f7a63" stroke-width="5" stroke-linecap="round"/><path d="M45 34h14" stroke="#2a6fb5" stroke-width="5" stroke-linecap="round"/><circle cx="5" cy="34" r="4" fill="#c1662f"/><circle cx="59" cy="34" r="4" fill="#2a6fb5"/><path d="M34 26c-5-6-7-9-7-12a7 7 0 0 1 14 0c0 3-2 6-7 12Z" fill="#2f7a63"/><circle cx="34" cy="14" r="2.5" fill="#fff"/></svg><span><dt>{je('Etappe', 'Leg')}</dt><dd>{je('Ein Reiseabschnitt mit festem Datum. Daran hängen Routen, Wanderungen, Buchungen und Logbuchtage.', 'A part of the trip with fixed dates. Routes, hikes, bookings and logbook days belong to it.')}</dd><dd class="ef-wo">{je('Plan → Etappen', 'Plan → Legs')}</dd></span></div>
        <div><svg class="ef-bild" viewBox="0 0 64 48" aria-hidden="true"><rect x="3" y="4" width="58" height="42" rx="6" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/><path d="M3 13h58" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/><rect x="6" y="17" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/><rect x="14" y="17" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/><rect x="22" y="17" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/><rect x="30" y="17" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/><rect x="38" y="17" width="6" height="6" rx="1.5" fill="#c1662f"/><rect x="46" y="17" width="6" height="6" rx="1.5" fill="#c1662f"/><rect x="54" y="17" width="6" height="6" rx="1.5" fill="#c1662f"/><rect x="6" y="25" width="6" height="6" rx="1.5" fill="#c1662f"/><rect x="14" y="25" width="6" height="6" rx="1.5" fill="#c1662f"/><rect x="22" y="25" width="6" height="6" rx="1.5" fill="#c1662f"/><rect x="30" y="25" width="6" height="6" rx="1.5" fill="#c1662f"/><rect x="38" y="25" width="6" height="6" rx="1.5" fill="#2f7a63"/><rect x="46" y="25" width="6" height="6" rx="1.5" fill="#2f7a63"/><rect x="54" y="25" width="6" height="6" rx="1.5" fill="#2f7a63"/><rect x="6" y="33" width="6" height="6" rx="1.5" fill="#2f7a63"/><rect x="14" y="33" width="6" height="6" rx="1.5" fill="#2f7a63"/><rect x="22" y="33" width="6" height="6" rx="1.5" fill="#2f7a63"/><rect x="30" y="33" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/><rect x="38" y="33" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/><rect x="46" y="33" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/><rect x="54" y="33" width="6" height="6" rx="1.5" fill="currentColor" opacity=".22"/></svg><span><dt>{je('Kalender', 'Calendar')}</dt><dd>{je('Dein Blick auf die Reise nach Datum, als Liste, Monat oder Jahr. Hier trägst du nichts ein.', 'Your view of the trip by date, as list, month or year. You do not enter anything here.')}</dd><dd class="ef-wo">{je('Plan → Kalender', 'Plan → Calendar')}</dd></span></div>
        <div><svg class="ef-bild" viewBox="0 0 64 48" aria-hidden="true"><path d="M32 9C25 5 15 5 6 7v35c9-2 19-2 26 2 7-4 17-4 26-2V7c-9-2-19-2-26 2Z" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="2"/><path d="M32 9v35" stroke="currentColor" stroke-opacity=".6" stroke-width="2"/><rect x="11" y="12" width="16" height="11" rx="2" fill="#c1662f"/><circle cx="16" cy="16" r="2" fill="#fff"/><path d="M11 29h16M11 34h12M37 14h16M37 19h16M37 24h11M37 29h16M37 34h9" stroke="currentColor" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/></svg><span><dt>{je('Logbuch', 'Logbook')}</dt><dd>{je('Dein Reisetagebuch Tag für Tag: Text, Fotos, Kilometer, Tiere und Notizen.', 'Your travel journal day by day: text, photos, kilometres, animals and notes.')}</dd><dd class="ef-wo">{je('Logbuch', 'Logbook')}</dd></span></div>
      </dl>
      <!-- 1.13: das ganze Bild, auf Wunsch aufgeklappt -->
      <button type="button" class="ef-leise ef-zh-knopf" aria-expanded={zhAuf} onclick={() => (zhAuf = !zhAuf)}>{zhAuf ? je('So hängt alles zusammen ▴', 'How it all fits together ▴') : je('So hängt alles zusammen ▾', 'How it all fits together ▾')}</button>
      {#if zhAuf}<Zusammenhang />{/if}
      {/if}
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

    {:else if id === 'route'}
      <p class="ef-icon" aria-hidden="true">🛣️</p>
      <h2 id="ef-titel">{je('Deine erste Route', 'Your first route')}<InfoKnopf id="aufbau-route" /></h2>
      <p id="ef-text">{je('Mit einer Route rechnet die App Kilometer, Fahrzeit, Tank-Lücken und das Wetter an der Strecke. Nimm eine fertige Routen-Idee oder leg eine eigene an.', 'With a route the app works out kilometres, driving time, fuel gaps and the weather along the way. Take a ready-made route idea or create your own.')}</p>
      {#if routen}<p class="ef-ok">✓ {je(`${routen} ${routen === 1 ? 'Route' : 'Routen'} angelegt`, `${routen} ${routen === 1 ? 'route' : 'routes'} created`)}</p>{/if}
      <div class="ef-knoepfe">
        {#if routen}<button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>{/if}
        <button class={routen ? 'btn' : 'btn-primary ef-los'} onclick={() => seite('orte/routen')}>{je('Routen-Ideen ansehen', 'See route ideas')}</button>
        <button class="btn" onclick={() => blatt('route')}>{je('Eigene Route anlegen', 'Create your own route')}</button>
        {#if !routen}<button class="ef-leise" onclick={weiter}>{t('Überspringen')}</button>{/if}
      </div>

    {:else if id === 'ausgaben'}
      <p class="ef-icon" aria-hidden="true">💶</p>
      <h2 id="ef-titel">{je('Was schon bezahlt ist', 'What you have already paid')}<InfoKnopf id="aufbau-ausgaben" /></h2>
      <p id="ef-text">{je('Flug, Camper, Versicherung, Visum: trag ein, was du vor der Reise bezahlt hast. Flüge und Fahrzeuge kommen als Verkehrsmittel in den Plan, alle anderen Kosten bündelt die App von selbst unter Kosten.', 'Flight, camper, insurance, visa: enter what you paid before the trip. Flights and vehicles go into the plan as transport, all other costs are grouped by the app under Costs.')}</p>
      {#if vorab || verkehr || termine}<p class="ef-ok">✓ {[vorab && je(`${vorab} Ausgaben vorab`, `${vorab} expenses before the trip`), verkehr && je(`${verkehr} Flug oder Zug`, `${verkehr} flight or train`), termine && tn(termine, '{n} Buchung gespeichert', '{n} Buchungen gespeichert')].filter(Boolean).join(' · ')}</p>{/if}
      <div class="ef-knoepfe">
        {#if vorab || verkehr || termine}<button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>{/if}
        <button class={vorab || verkehr || termine ? 'btn' : 'btn-primary ef-los'} onclick={() => blatt('ausgabe')}>{je('💶 Ausgabe vorab eintragen', '💶 Add an expense before the trip')}</button>
        <button class="btn" onclick={() => blatt('route', { art: 'flug' })}>{je('✈️ Flug oder Zug mit Nummer', '✈️ Flight or train with number')}</button>
        <button class="btn" onclick={() => blatt('buchung')}>{je('📧 Buchungsmail einfügen', '📧 Paste a booking email')}</button>
        {#if !(vorab || verkehr || termine)}<button class="ef-leise" onclick={weiter}>{t('Überspringen')}</button>{/if}
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
      <h2 id="ef-titel">{t('Orte entdecken')}<InfoKnopf id="aufbau-orte" /></h2>
      <p id="ef-text">{anzahlOrte ? t('Unter Orte warten {n} Orte mit Bildern, Sonnenzeiten und Tipps.', { n: anzahlOrte }) : t('Unter Orte warten viele Orte mit Bildern, Sonnenzeiten und Tipps.')} {t('Mit „Einplanen“ kommt ein Ort in deine Etappe, eigene Orte legst du mit „+ Ort hinzufügen“ an.')}</p>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={() => seite('orte')}>{t('Orte ansehen')}</button>
        <button class="ef-leise" onclick={weiter}>{t('Überspringen')}</button>
      </div>

    {:else if id === 'logbuch'}
      <p class="ef-icon" aria-hidden="true">📖</p>
      <h2 id="ef-titel">{t('Unterwegs entsteht dein Tagebuch')}<InfoKnopf id="aufbau-logbuch" /></h2>
      <p id="ef-text">{t('Jeden Abend ein paar Zeilen, Fotos, Kilometer und die Tiere des Tages ins Logbuch. Daraus baut TravelBuddy von selbst dein Reisetagebuch, fertig zum Drucken und zum Teilen mit der Familie. Unter Heute steht derweil, was ansteht.')}</p>
      <div class="ef-knoepfe">
        <button class="btn-primary ef-los" onclick={weiter}>{je('Weiter', 'Next')}</button>
        <button class="ef-leise" onclick={zurueck}>{t('Zurück')}</button>
      </div>

    {:else if id === 'bereit'}
      <p class="ef-icon" aria-hidden="true">🧳</p>
      <h2 id="ef-titel">{t('Bereit für unterwegs?')}<InfoKnopf id="aufbau-bereit" /></h2>
      <p id="ef-text">{je('Zum Schluss das, was unterwegs zählt. Am besten zu Hause im WLAN, denn Karten, Pisten-Netz und Fun Facts laden nur mit Netz vorab.', 'Finally, what counts on the road. Best done at home on Wi-Fi, because maps, the track network and fun facts only load ahead with internet.')}</p>
      <ul class="ef-check">
        <li class:ok={geschuetzt}><span>{geschuetzt ? '✓' : '💾'}</span><span><b>{je('Daten schützen', 'Protect your data')}</b><small>{geschuetzt ? je('Der Browser löscht nichts von selbst.', 'The browser will not delete anything by itself.') : je('Sonst darf der Browser bei Platzmangel alles löschen.', 'Otherwise the browser may delete everything when space runs low.')}</small></span>{#if !geschuetzt}<button class="btn" onclick={schuetzen}>{je('Schützen', 'Protect')}</button>{/if}</li>
        <li><span>📲</span><span><b>{je('Auf den Home-Bildschirm', 'Add to home screen')}</b><small>{je('Startet wie eine App und läuft offline.', 'Starts like an app and works offline.')}</small></span><button class="btn" onclick={appEinrichten}>{je('Zeigen', 'Show me')}</button></li>
        <li><span>🔁</span><span><b>{je('Tägliches Backup', 'Daily backup')}</b><small>{je('Läuft von selbst, am Computer auch in einen Ordner deiner Wahl.', 'Runs by itself, on a computer also into a folder you choose.')}</small></span><button class="btn" onclick={() => seite('mehr/backup')}>{je('Ansehen', 'View')}</button></li>
        <li><span>🆘</span><span><b>{je('Notfall', 'Emergency')}</b><small>{je('Notrufnummern, nächste Hilfe und dein Standort zum Durchsagen.', 'Emergency numbers, nearest help and your location to read out.')}</small></span><button class="btn" onclick={() => seite('mehr/notfall')}>{je('Ansehen', 'View')}</button></li>
        <li class:ok={kartenDa}><span>{kartenDa ? '✓' : '🗺️'}</span><span><b>{je('Kartenmaterial', 'Maps')}</b><small>{kartenDa ? je('liegt auf dem Gerät', 'on the device') : je('noch nicht geladen, beim Willkommen oder unter Plan, Karte', 'not loaded yet, in the welcome step or under Plan, Map')}</small></span></li>
        <li class:ok={Object.values($pistenStand).some(Boolean)}><span>{Object.values($pistenStand).some(Boolean) ? '✓' : '🪨'}</span><span><b>{je('Pisten-Netz', 'Track network')}</b><small>{Object.values($pistenStand).some(Boolean) ? Object.entries(GEBIETE).filter(([g]) => $pistenStand[g]).map(([, x]) => x.name).join(', ') : je('noch keins, Hauptstraßen sind dabei', 'none yet, main roads are included')}</small></span></li>
        <li class:ok={routen > 0}><span>{routen ? '✓' : '🛣️'}</span><span><b>{je('Routen', 'Routes')}</b><small>{routen ? je(`${routen} angelegt, die App rechnet sie aus`, `${routen} created, the app works them out`) : je('noch keine Route', 'no route yet')}</small></span></li>
      </ul>
      <p class="ef-k">{t('Das Handbuch und diese Einführung findest du jederzeit unter Mehr.')}</p>
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
  .ef-begriffe { display: flex; flex-direction: column; gap: 8px; margin: 0; }
  .ef-begriffe div { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--flaeche-2); }
  .ef-begriffe span { display: block; min-width: 0; }
  .ef-bild { flex: none; width: 64px; height: 48px; color: var(--ink); }
  .ef-begriffe dt { font-size: calc(15px * var(--schrift, 1)); font-weight: 700; }
  .ef-begriffe dd { margin: 2px 0 0; font-size: calc(13.5px * var(--schrift, 1)); }
  .ef-begriffe .ef-wo { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; }
  .ef-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.45); z-index: 130; animation: hg var(--t-med) var(--ease-out); }
  .ef {
    position: fixed; z-index: 131; left: 0; right: 0; bottom: 0; max-height: 92dvh; overflow: auto;
    background: var(--bg); color: var(--ink); border-radius: 22px 22px 0 0; box-shadow: var(--shadow-float);
    --unten: calc(20px + env(safe-area-inset-bottom, 0px)); padding: 14px 20px var(--unten); display: flex; flex-direction: column; gap: 12px;
    animation: hoch var(--t-slow) var(--ease-spring);
  }
  @media (min-width: 900px), (orientation: landscape) and (min-width: 640px) {
    .ef { --unten: 22px; left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); width: 520px; max-height: calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); border-radius: var(--radius-l); padding: 18px 24px var(--unten); animation: rein var(--t-med) var(--ease-spring); }
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
  .ef-leit { margin: 0; font-size: calc(14px * var(--schrift, 1)); line-height: 1.45; font-weight: 600; }
  .ef-wahl { display: flex; flex-direction: column; gap: 8px; }
  .ef-check { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .ef-check li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
  .ef-check li > span:first-child { flex: none; width: 24px; text-align: center; }
  .ef-check li > span:nth-child(2) { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: calc(14px * var(--schrift, 1)); }
  .ef-check small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .ef-check li.ok > span:first-child { color: var(--ok); font-weight: 800; }
  .ef-check .btn { flex: none; }
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
  @media (min-width: 900px), (orientation: landscape) and (min-width: 640px) { .ef-weiter { bottom: 24px; } }
  .ef-weiter button { border: none; background: none; color: inherit; cursor: pointer; }
  .ef-weiter-los { min-height: 44px; padding: 0 14px; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; white-space: nowrap; }
  .ef-weiter-los small { opacity: 0.8; font-weight: 600; margin-left: 4px; font-size: calc(13px * var(--schrift, 1)); }
  .ef-weiter-x { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.18) !important; font-size: calc(14px * var(--schrift, 1)); }
  @keyframes hg { from { opacity: 0; } }
  @keyframes hoch { from { transform: translateY(40px); opacity: 0.4; } }
  @keyframes rein { from { opacity: 0; } }
  @keyframes hochMitte { from { transform: translate(-50%, 40px); opacity: 0.4; } }
  .ef-zh-knopf { align-self: flex-start; min-height: 44px; }
</style>
