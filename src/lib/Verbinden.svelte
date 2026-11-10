<script>
  // Mehr → Unterwegs verbinden (V31). Ohne Unterpfad: eigener Kontakt-Code, Scannen, Kontakte von
  // unterwegs. Mit k/…, o/…, r/…: ein geöffneter oder gescannter Kontakt, Ort oder Route.
  // Kein Server: alles steckt im Code oder Link, gechattet wird im Messenger.
  import { untrack } from 'svelte'
  import { je } from './i18n.js'
  import { reisen, gesamtStart, eigeneOrte, eigenenOrtAnlegen, neueRoute } from './userdata.js'
  import { etappenMitDatum, etappeAm, istEtappe } from './plan.js'
  import { heuteTag } from './heute.js'
  import { tagMonat } from './format.js'
  import { zeigeToast } from './toast.js'
  import { loeschFrage } from './dialog.js'
  import { oeffneNeu } from './neu.js'
  import QrCode from './QrCode.svelte'
  import QrScanner from './QrScanner.svelte'
  import InfoKnopf from './InfoKnopf.svelte'
  import { meldungen } from './meldungen.js'
  import { meldenBlatt } from './meldungen-text.js'
  import { profil, profilSetzen, codeInhalt, hatWeg, kontaktLink, leseKontakt, kontakte, kontaktMerken, kontaktLoeschen, istGemerkt,
    leseGeteilt, pfadAusCode, teilen, telegramLink, signalLink, whatsappLink, telegramName, signalWert, whatsappNummer, gruppen } from './verbinden.js'

  let { id = '', orte = [], geh, zuort = null } = $props()

  const art = $derived(id.split('/')[0] || '')
  const payload = $derived(id.split('/').slice(1).join('/'))
  const kontakt = $derived(art === 'k' ? leseKontakt(payload) : null)
  const geteilt = $derived(art === 'o' || art === 'r' ? leseGeteilt(art, payload) : null)

  // Eigener Code
  let p = $state({ ...$profil, zeigen: { ...$profil.zeigen } })
  const inhalt = $derived(codeInhalt(p))
  const link = $derived(kontaktLink(p))
  const fehlt = $derived({
    telegram: p.telegram.trim() && !telegramName(p.telegram),
    signal: p.signal.trim() && !signalWert(p.signal),
    whatsapp: p.whatsapp.trim() && !whatsappNummer(p.whatsapp),
  })
  $effect(() => { profilSetzen(p) })
  let scannen = $state(false)

  // Heute und die laufende Etappe: Vorschlag für „wo getroffen“
  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const etappeHeute = $derived(etappeAm(eintraege, $heuteTag)?.reise || null)
  let ortGetroffen = $state('')
  let zielEtappe = $state('')
  // Vorschläge einmal je geöffnetem Kontakt oder geteilter Route. Danach entscheidet der Nutzer,
  // auch für ein leeres Feld oder „keine Etappe“.
  let vorbelegt = null
  $effect(() => {
    if (id === vorbelegt) return
    vorbelegt = id
    untrack(() => { ortGetroffen = etappeHeute?.name || ''; zielEtappe = etappeHeute?.id || '' })
  })

  function getroffen(t) {
    const pfad = pfadAusCode(t)
    scannen = false
    if (pfad) geh(pfad)
    else zeigeToast(je('Das ist kein TravelBuddy-Code.', 'That is not a TravelBuddy code.'), 'info', 4000)
  }
  async function eigenenTeilen() {
    const e = await teilen({ titel: je('Mein TravelBuddy-Kontakt', 'My TravelBuddy contact'), text: p.name ? je(`${p.name} auf TravelBuddy`, `${p.name} on TravelBuddy`) : '', url: link })
    if (e === 'kopiert') zeigeToast(je('Link kopiert', 'Link copied'), 'ok')
    else if (e === 'fehler') { eigenerLink = true; zeigeToast(je('Teilen ging nicht. Kopier den Link von Hand oder lass den Code scannen.', 'Sharing did not work. Copy the link by hand or let someone scan the code.'), 'info', 5000) }
  }
  let eigenerLink = $state(false)
  function merken() {
    if (kontaktMerken(kontakt, { ort: ortGetroffen, datum: $heuteTag })) zeigeToast(je(`${kontakt.name || 'Kontakt'} gemerkt`, `${kontakt.name || 'Contact'} saved`), 'ok')
  }
  async function loeschen(k) {
    if (await loeschFrage(k.name, je('Nur von diesem Gerät. Im Messenger bleibt alles, wie es ist.', 'Only from this device. Nothing changes in the messenger.'))) kontaktLoeschen(k.id)
  }

  // Geteilter Ort
  const appOrt = $derived(geteilt?.typ === 'ort' && geteilt.id ? orte.find((o) => o.id === geteilt.id) : null)
  const schonEigen = $derived(geteilt?.typ === 'ort' && $eigeneOrte.some((o) => o.name === geteilt.name && Math.abs((o.lat ?? 99) - (geteilt.lat ?? 0)) < 0.001))
  function ortUebernehmen() {
    const o = eigenenOrtAnlegen({ name: geteilt.name, lat: geteilt.lat, lon: geteilt.lon, beschreibung: geteilt.beschreibung })
    zeigeToast(je(`„${o.name}“ steht unter Meine Orte`, `“${o.name}” is under My places`), 'ok')
    geh('orte/meine')
  }
  function ortEinplanen() {
    oeffneNeu('route', { stops: [{ name: geteilt.name, lat: geteilt.lat, lon: geteilt.lon, img: null }] })
  }

  // Geteilte Route
  const etappen = $derived($reisen.filter(istEtappe))
  function routeUebernehmen() {
    const e = etappen.find((x) => x.id === zielEtappe)
    const rid = neueRoute({ name: geteilt.name, etappeId: e?.id || null, farbe: e?.farbe, art: geteilt.art, allrad: geteilt.allrad,
      stops: geteilt.stops.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon, naechte: s.naechte || undefined, img: null })) })
    zeigeToast(je(`Route „${geteilt.name}“ übernommen`, `Route “${geteilt.name}” added`), 'ok')
    geh(e ? `plan/etappe/${e.id}/${rid}` : 'plan/route/' + rid)
  }
  const ART = { auto: ['🚗', 'Auto', 'Car'], flug: ['✈️', 'Flug', 'Flight'], bus: ['🚌', 'Bus', 'Bus'], bahn: ['🚆', 'Bahn', 'Train'], boot: ['⛵', 'Schiff', 'Boat'] }
</script>

<div class="vb">
{#if art === 'k'}
  {#if kontakt}
    <div class="vb-karte">
      <div class="vb-wer"><span class="vb-avatar" aria-hidden="true">{(kontakt.name || '?').slice(0, 1).toUpperCase()}</span><div><b>{kontakt.name || je('Ohne Namen', 'No name')}</b><small>{je('TravelBuddy-Kontakt', 'TravelBuddy contact')}</small></div></div>
      {#if kontakt.telegram}<a class="btn vb-weg" href={telegramLink(kontakt.telegram)} target="_blank" rel="noopener">{je('In Telegram schreiben', 'Message on Telegram')} ↗</a>{/if}
      {#if kontakt.signal}
        {#if signalLink(kontakt.signal)}<a class="btn vb-weg" href={signalLink(kontakt.signal)} target="_blank" rel="noopener">{je('In Signal schreiben', 'Message on Signal')} ↗</a>
        {:else}<p class="vb-k">{je(`Signal: in Signal nach ${kontakt.signal} suchen`, `Signal: search for ${kontakt.signal} in Signal`)}</p>{/if}
      {/if}
      {#if kontakt.whatsapp}<a class="btn vb-weg" href={whatsappLink(kontakt.whatsapp)} target="_blank" rel="noopener">{je('In WhatsApp schreiben', 'Message on WhatsApp')} ↗</a>{/if}
    </div>
    <div class="vb-karte">
      {#if istGemerkt(kontakt, $kontakte)}
        <p class="vb-ok">✓ {je('Steht unter Kontakte von unterwegs', 'Saved under Contacts from the road')}</p>
      {:else}
        <label class="vb-f">{je('Wo habt ihr euch getroffen? (optional)', 'Where did you meet? (optional)')}<input bind:value={ortGetroffen} maxlength="60" placeholder={je('z. B. Karijini', 'e.g. Karijini')} /></label>
        <button class="btn-primary" onclick={merken}>{je('Unter Kontakte von unterwegs merken', 'Save under Contacts from the road')}</button>
        <p class="vb-k">{je('Bleibt nur auf diesem Gerät.', 'Stays on this device only.')}</p>
      {/if}
    </div>
  {:else}
    <p class="vb-karte">{je('Dieser Code ist unvollständig oder beschädigt. Lass ihn dir noch einmal zeigen.', 'This code is incomplete or damaged. Ask to see it again.')}</p>
  {/if}
  <button class="btn vb-zurueck" onclick={() => geh('mehr/verbinden')}>{je('Zu Unterwegs verbinden', 'To Connect on the road')}</button>

{:else if art === 'o'}
  {#if geteilt}
    <div class="vb-karte">
      <p class="vb-kopf">{je('Ein geteilter Ort', 'A shared place')}</p>
      <b class="vb-name">{geteilt.name}</b>
      {#if geteilt.region}<small class="vb-k">{geteilt.region}</small>{/if}
      {#if geteilt.beschreibung}<p class="vb-text">{geteilt.beschreibung}</p>{/if}
      {#if appOrt}
        <button class="btn-primary" onclick={() => (zuort ? zuort(appOrt) : geh('orte'))}>{je('Zum Ort in deiner App', 'To the place in your app')}</button>
      {:else if schonEigen}
        <p class="vb-ok">✓ {je('Steht schon unter Meine Orte', 'Already under My places')}</p>
      {:else}
        <button class="btn-primary" onclick={ortUebernehmen}>{je('In meine Orte übernehmen', 'Add to my places')}</button>
      {/if}
      {#if geteilt.lat != null}<button class="btn" onclick={ortEinplanen}>{je('In eine Route einplanen', 'Plan into a route')}</button>{/if}
    </div>
  {:else}
    <p class="vb-karte">{je('Dieser Link ist unvollständig oder beschädigt.', 'This link is incomplete or damaged.')}</p>
  {/if}

{:else if art === 'r'}
  {#if geteilt}
    <div class="vb-karte">
      <p class="vb-kopf">{je('Eine geteilte Route', 'A shared route')}</p>
      <b class="vb-name">{ART[geteilt.art][0]} {geteilt.name}</b>
      <small class="vb-k">{je(`${geteilt.stops.length} Stopps`, `${geteilt.stops.length} stops`)}{geteilt.allrad ? ' · 4WD' : ''}</small>
      <ol class="vb-stopps">
        {#each geteilt.stops as s, i (i)}<li>{s.name}{#if s.naechte}<small> · {je(`${s.naechte} ${s.naechte === 1 ? 'Nacht' : 'Nächte'}`, `${s.naechte} ${s.naechte === 1 ? 'night' : 'nights'}`)}</small>{/if}</li>{/each}
      </ol>
      <label class="vb-f">{je('In welche Etappe?', 'Into which leg?')}
        <select bind:value={zielEtappe}>
          <option value="">{je('keine Etappe', 'no leg')}</option>
          {#each etappen as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
        </select>
      </label>
      <button class="btn-primary" onclick={routeUebernehmen}>{je('Route übernehmen', 'Add route')}</button>
      <p class="vb-k">{je('Ohne Datum, das legst du in der Route fest. Die App rechnet Kilometer und Fahrzeit neu.', 'Without dates, you set them in the route. The app works out distance and driving time again.')}</p>
    </div>
  {:else}
    <p class="vb-karte">{je('Dieser Link ist unvollständig oder beschädigt.', 'This link is incomplete or damaged.')}</p>
  {/if}

{:else}
  <!-- V32: drei Wege an einer Stelle erklärt. TravelBuddy hat keine Konten, die App öffnet nur den richtigen Weg. -->
  <div class="vb-wege">
    <div class="vb-weg-karte">
      <b><span class="vb-nr">1</span>{je('Meldungen', 'Reports')}</b>
      <p class="vb-k">{je('Für alle TravelBuddy-Reisenden: Wege, Tiere, Tanken, Camping, Wetter. Steht an Route und Ort, gilt 3 Tage.', 'For all TravelBuddy travellers: roads, wildlife, fuel, camping, weather. Shown on routes and places, valid for 3 days.')}</p>
      <div class="vb-zeile"><button class="btn" onclick={() => meldenBlatt.set({})}>📣 {je('Etwas melden', 'Report something')}</button><button class="btn" onclick={() => geh('mehr/meldungen')}>{je('Alle ansehen', 'See all')}{$meldungen.liste.length ? ` (${$meldungen.liste.length})` : ''}</button></div>
    </div>
    {#if $gruppen.telegram}
      <div class="vb-weg-karte">
        <b><span class="vb-nr">2</span>{je('Mit allen: TravelBuddy-Gruppe', 'With everyone: TravelBuddy group')}</b>
        <p class="vb-k">{je('Auf Telegram: Gespräch, Fragen, Fotos. Die Beiträge stehen in Telegram, nicht in der App.', 'On Telegram: chat, questions, photos. Posts stay in Telegram, not in the app.')}</p>
        <a class="btn vb-weg" href={$gruppen.telegram} target="_blank" rel="noopener noreferrer">{je('Gruppe in Telegram öffnen', 'Open the group in Telegram')} ↗</a>
      </div>
    {/if}
    <div class="vb-weg-karte vb-weg-3">
      <b><span class="vb-nr">{$gruppen.telegram ? 3 : 2}</span>{je('Mit einzelnen: dein Kontakt-Code', 'With one person: your contact code')}</b>
      <p class="vb-k">{je('Jemanden getroffen? Code zeigen, der andere scannt und schreibt dir direkt im Einzelchat. Gleich darunter.', 'Met someone? Show your code, they scan it and message you directly. Right below.')}</p>
    </div>
  </div>
  <p class="vb-einl">{je('Am Campingplatz jemanden getroffen? Zeig deinen Code. Wer ihn scannt, schreibt dir direkt im Messenger seiner Wahl.', 'Met someone at the campground? Show your code. Whoever scans it can message you straight away in the messenger of their choice.')}<InfoKnopf id="verbinden" /></p>

  <div class="vb-karte vb-code">
    {#if hatWeg(inhalt)}
      <QrCode inhalt={link} groesse={210} label={je('Dein Kontakt-Code', 'Your contact code')} />
      <b class="vb-name">{p.name || je('Ohne Namen', 'No name')}</b>
      <small class="vb-k">{[inhalt.tg && 'Telegram', inhalt.sg && 'Signal', inhalt.wa && 'WhatsApp'].filter(Boolean).join(' · ')}</small>
      <div class="vb-zeile">
        <button class="btn" onclick={eigenenTeilen}>{je('Als Link schicken', 'Send as link')}</button>
        <button class="btn" onclick={() => (scannen = true)}>{je('Code scannen', 'Scan a code')}</button>
      </div>
      {#if eigenerLink}<input class="vb-link" readonly value={link} aria-label={je('Link zum Kopieren', 'Link to copy')} onfocus={(e) => e.currentTarget.select()} />{/if}
    {:else}
      <p class="vb-text">{je('Trag unten mindestens einen Weg ein, dann erscheint hier dein Code.', 'Add at least one way below and your code appears here.')}</p>
      <button class="btn" onclick={() => (scannen = true)}>{je('Code von jemandem scannen', 'Scan someone’s code')}</button>
    {/if}
  </div>

  <div class="vb-karte">
    <p class="vb-kopf">{je('Dein Name und wie man dich erreicht', 'Your name and how to reach you')}</p>
    <label class="vb-f">{je('Name', 'Name')}<input bind:value={p.name} maxlength="40" autocomplete="nickname" placeholder={je('z. B. Kim', 'e.g. Kim')} /></label>
    <div class="vb-weg-zeile">
      <label class="vb-f">Telegram<input bind:value={p.telegram} maxlength="60" autocapitalize="off" spellcheck="false" placeholder="@name" aria-invalid={!!fehlt.telegram} /></label>
      <label class="vb-an"><input type="checkbox" bind:checked={p.zeigen.telegram} />{je('im Code', 'in code')}</label>
    </div>
    {#if fehlt.telegram}<p class="vb-fehler">{je('Telegram-Namen haben 5 bis 32 Zeichen, Buchstaben, Ziffern und _.', 'Telegram names have 5 to 32 characters, letters, digits and _.')}</p>{/if}
    <div class="vb-weg-zeile">
      <label class="vb-f">Signal<input bind:value={p.signal} maxlength="400" autocapitalize="off" spellcheck="false" placeholder={je('Link aus Signal oder name.42', 'Link from Signal or name.42')} aria-invalid={!!fehlt.signal} /></label>
      <label class="vb-an"><input type="checkbox" bind:checked={p.zeigen.signal} />{je('im Code', 'in code')}</label>
    </div>
    {#if fehlt.signal}<p class="vb-fehler">{je('Am besten den Link aus Signal kopieren: Profil, Nutzername, Link teilen.', 'Best copy the link from Signal: profile, username, share link.')}</p>{/if}
    <div class="vb-weg-zeile">
      <label class="vb-f">WhatsApp<input bind:value={p.whatsapp} maxlength="24" inputmode="tel" placeholder="+49 …" aria-invalid={!!fehlt.whatsapp} /></label>
      <label class="vb-an"><input type="checkbox" bind:checked={p.zeigen.whatsapp} />{je('im Code', 'in code')}</label>
    </div>
    {#if fehlt.whatsapp}<p class="vb-fehler">{je('Nummer mit Ländervorwahl, zum Beispiel +49 170 1234567.', 'Number with country code, for example +61 412 345 678.')}</p>{/if}
    <p class="vb-k">{je('WhatsApp zeigt dem anderen deine Telefonnummer, deshalb ist es anfangs aus. Alles bleibt auf diesem Gerät und steckt nur im Code, den du zeigst.', 'WhatsApp shows the other person your phone number, so it starts switched off. Everything stays on this device and is only in the code you show.')}</p>
  </div>

  <h2 class="abschnitt">{je('Kontakte von unterwegs', 'Contacts from the road')} {#if $kontakte.length}<span class="count">{$kontakte.length}</span>{/if}</h2>
  {#if $kontakte.length}
    <ul class="vb-liste">
      {#each $kontakte as k (k.id)}
        <li>
          <span class="vb-avatar" aria-hidden="true">{(k.name || '?').slice(0, 1).toUpperCase()}</span>
          <span class="vb-wer-t"><b>{k.name}</b><small>{[k.ort, k.datum && tagMonat(k.datum)].filter(Boolean).join(' · ')}</small></span>
          {#if k.telegram}<a class="vb-mini" href={telegramLink(k.telegram)} target="_blank" rel="noopener" aria-label={je(`${k.name} in Telegram schreiben`, `Message ${k.name} on Telegram`)}>Telegram</a>{/if}
          {#if signalLink(k.signal)}<a class="vb-mini" href={signalLink(k.signal)} target="_blank" rel="noopener" aria-label={je(`${k.name} in Signal schreiben`, `Message ${k.name} on Signal`)}>Signal</a>{/if}
          {#if k.whatsapp}<a class="vb-mini" href={whatsappLink(k.whatsapp)} target="_blank" rel="noopener" aria-label={je(`${k.name} in WhatsApp schreiben`, `Message ${k.name} on WhatsApp`)}>WhatsApp</a>{/if}
          <button class="vb-weg-x" onclick={() => loeschen(k)} aria-label={je(`${k.name} entfernen`, `Remove ${k.name}`)}>✕</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="vb-k">{je('Wen du scannst und merkst, steht hier mit Ort und Datum.', 'Whoever you scan and save shows up here with place and date.')}</p>
  {/if}
{/if}
</div>

{#if scannen}<QrScanner ontreffer={getroffen} onclose={() => (scannen = false)} />{/if}

<style>
  .vb { display: flex; flex-direction: column; gap: 12px; }
  .vb-karte { margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .vb-code { align-items: center; text-align: center; }
  .vb-einl { margin: 0; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); }
  .vb-kopf { margin: 0; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .vb-name { font-size: calc(18px * var(--schrift, 1)); }
  .vb-text { margin: 0; font-size: calc(14.5px * var(--schrift, 1)); }
  .vb-k { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .vb-ok { margin: 0; font-weight: 700; color: var(--ok-text); }
  .vb-fehler { margin: -4px 0 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--warn-text, var(--brand-text)); }
  .vb-link { width: 100%; box-sizing: border-box; min-height: 44px; padding: 8px 10px; font-size: max(16px, calc(14px * var(--schrift, 1))); border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); }
  .vb-wege { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
  .vb-weg-karte { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--card); }
  .vb-weg-karte b { display: flex; align-items: center; gap: 8px; font-size: calc(15px * var(--schrift, 1)); }
  .vb-nr { width: 22px; height: 22px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: calc(12px * var(--schrift, 1)); background: var(--flaeche); color: var(--brand-text); }
  .vb-weg-karte .vb-zeile { margin-top: auto; }
  .vb-weg-3 { border-style: dashed; }
  .vb-zeile { display: flex; gap: 8px; width: 100%; }
  .vb-zeile .btn { flex: 1; }
  .vb-f { display: flex; flex-direction: column; gap: 5px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); flex: 1; min-width: 0; }
  .vb-f input, .vb-f select { min-height: 44px; font-size: max(16px, calc(16px * var(--schrift, 1))); padding: 8px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); font-weight: 400; }
  .vb-weg-zeile { display: flex; align-items: flex-end; gap: 10px; }
  .vb-an { display: flex; align-items: center; gap: 6px; min-height: 44px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); white-space: nowrap; }
  .vb-an input { width: 20px; height: 20px; accent-color: var(--brand); }
  .vb-wer { display: flex; align-items: center; gap: 12px; }
  .vb-wer div, .vb-wer-t { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .vb-wer small, .vb-wer-t small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .vb-avatar { width: 40px; height: 40px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; background: var(--flaeche); color: var(--brand-text); }
  .vb-weg { display: flex; align-items: center; justify-content: center; min-height: 46px; text-decoration: none; }
  .vb-zurueck { align-self: flex-start; }
  .vb-stopps { margin: 0; padding-left: 22px; font-size: calc(14.5px * var(--schrift, 1)); display: flex; flex-direction: column; gap: 4px; }
  .vb-stopps small { color: var(--muted); }
  .vb-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); }
  .vb-liste li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }
  .vb-liste li:first-child { border-top: none; }
  .vb-mini { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 6px 10px; min-height: 36px; display: inline-flex; align-items: center; border: 1px solid var(--line-stark); border-radius: 18px; color: var(--brand-text); text-decoration: none; }
  .vb-weg-x { width: 36px; height: 36px; border: none; background: none; color: var(--muted); font-size: calc(16px * var(--schrift, 1)); cursor: pointer; }
</style>
