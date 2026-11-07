<script>
  // Mehr → Fehler melden: kurze Beschreibung, freiwillige E-Mail, bis zu drei Bildschirmfotos.
  // Geht über die eigene Netlify-Funktion und Resend als Mail an den Anbieter (siehe fehlermeldung.js).
  import { onDestroy } from 'svelte'
  import { je, istEn } from './i18n.js'
  import { online } from './netz.js'
  import { zeigeToast } from './toast.js'
  import {
    HILFE, MAX_BILDER, MAX_BYTES, zuletztOffen, technikZeilen, technikText, sendefertig, emailOk, bildBytes,
    baueFormular, sende, verkleinere, liesEntwurf, merkeEntwurf, istNetlify, issueLink,
  } from './fehlermeldung.js'

  let { version = '', build = '' } = $props()

  const entwurf = liesEntwurf()
  let text = $state(entwurf.text)
  let email = $state(entwurf.email)
  let bilder = $state([]) // [{ datei: File, url }]
  let laedtBild = $state(false)
  let sendet = $state(false)
  let waehler

  $effect(() => merkeEntwurf({ text, email }))
  onDestroy(() => bilder.forEach((b) => URL.revokeObjectURL(b.url)))

  // Absenden über Netlify nur auf der veröffentlichten Seite, sonst als Meldung auf GitHub
  const direkt = typeof location !== 'undefined' && istNetlify(location.hostname)
  const istApp = typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)
  const technik = technikZeilen({
    version, build,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    touch: typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
    sprache: istEn ? 'en' : 'de',
    breite: typeof screen !== 'undefined' ? screen.width : 0,
    hoehe: typeof screen !== 'undefined' ? screen.height : 0,
    seite: zuletztOffen(),
    alsApp: istApp,
  })

  const bereit = $derived(sendefertig(text) && emailOk(email) && !sendet && !laedtBild && (!direkt || $online))
  const groesse = $derived(bildBytes(bilder.map((b) => b.datei)))

  async function bilderDazu(e) {
    const neu = [...(e.currentTarget.files || [])]
    e.currentTarget.value = ''
    if (!neu.length) return
    const platz = MAX_BILDER - bilder.length
    if (neu.length > platz) zeigeToast(je(`Höchstens ${MAX_BILDER} Bildschirmfotos`, `At most ${MAX_BILDER} screenshots`), 'info', 3000)
    laedtBild = true
    try {
      for (const f of neu.slice(0, platz)) {
        try {
          const datei = await verkleinere(f)
          if (bildBytes([...bilder.map((b) => b.datei), datei]) > MAX_BYTES) { zeigeToast(je('Die Bilder sind zusammen zu groß', 'The pictures are too large together'), 'fehler', 3500); break }
          bilder = [...bilder, { datei, url: URL.createObjectURL(datei) }]
        } catch {
          zeigeToast(je('Dieses Bild konnte nicht gelesen werden', 'This picture could not be read'), 'fehler', 3500)
        }
      }
    } finally { laedtBild = false }
  }

  function bildWeg(i) {
    URL.revokeObjectURL(bilder[i].url)
    bilder = bilder.filter((_, j) => j !== i)
  }

  function perGithub() {
    window.open(issueLink({ text, technik: technikText(technik) }), '_blank', 'noopener')
    zeigeToast(je('GitHub öffnet sich mit deiner Meldung. Bildschirmfotos dort bitte selbst anhängen.', 'GitHub opens with your report. Please attach screenshots there yourself.'), 'info', 5000)
  }

  async function absenden() {
    if (!bereit) return
    if (!direkt) return perGithub()
    sendet = true
    const fd = baueFormular({ text, email, technik: technikText(technik), bilder: bilder.map((b) => b.datei) })
    const erg = await sende(fd, { groesse })
    sendet = false
    if (erg.ok) {
      bilder.forEach((b) => URL.revokeObjectURL(b.url))
      bilder = []
      text = ''
      email = ''
      zeigeToast(je('Danke für die Rückmeldung! Ich werde mich dem schnellstmöglich widmen.', 'Thanks for your feedback! I will look into it as soon as I can.'), 'ok', 5000)
    } else {
      zeigeToast(erg.grund === 'netz'
        ? je('Gerade kein Netz. Dein Text bleibt hier, schick ihn später ab.', 'No connection right now. Your text stays here, send it later.')
        : je('Senden hat nicht geklappt. Dein Text bleibt hier, versuch es gleich noch einmal.', 'Sending did not work. Your text stays here, try again in a moment.'), 'fehler', 5000)
    }
  }
</script>

<div class="fm">
  <p class="fm-intro">{je('Etwas geht nicht oder sieht falsch aus? Schreib kurz, was passiert ist. Ein Bildschirmfoto hilft sehr. Danke, dass du hilfst, TravelBuddy besser zu machen.', 'Something is not working or looks wrong? Write briefly what happened. A screenshot helps a lot. Thanks for helping to make TravelBuddy better.')}</p>

  <section class="fm-karte">
    <label class="fm-label" for="fm-text">{je('Was ist passiert?', 'What happened?')}</label>
    <textarea id="fm-text" class="fm-text" rows="7" bind:value={text} placeholder={istEn ? HILFE.en : HILFE.de}></textarea>

    <label class="fm-label" for="fm-mail">{je('Deine E-Mail für Rückfragen', 'Your email for questions')} <small>{je('freiwillig', 'optional')}</small></label>
    <input id="fm-mail" class="fm-feld" type="email" autocomplete="email" inputmode="email" bind:value={email} placeholder={je('name@beispiel.de', 'name@example.com')} aria-invalid={!emailOk(email)} />
    {#if !emailOk(email)}<p class="fm-warn" role="alert">{je('Die E-Mail sieht nicht vollständig aus.', 'The email does not look complete.')}</p>{/if}

    <div class="fm-bilder">
      {#each bilder as b, i (b.url)}
        <figure class="fm-bild">
          <img src={b.url} alt={je(`Bildschirmfoto ${i + 1}`, `Screenshot ${i + 1}`)} />
          <button type="button" class="fm-weg" onclick={() => bildWeg(i)} aria-label={je(`Bildschirmfoto ${i + 1} entfernen`, `Remove screenshot ${i + 1}`)}>✕</button>
        </figure>
      {/each}
    </div>
    <input bind:this={waehler} class="fm-datei" type="file" accept="image/*" multiple onchange={bilderDazu} tabindex="-1" aria-hidden="true" />
    {#if bilder.length < MAX_BILDER}
      <button type="button" class="btn fm-anfuegen" onclick={() => waehler.click()} disabled={laedtBild}>
        📎 {laedtBild ? je('Bild wird vorbereitet …', 'Preparing picture …') : bilder.length ? je('Weiteres Bildschirmfoto', 'Another screenshot') : je('Bildschirmfoto anfügen', 'Add a screenshot')}
      </button>
    {/if}

    <button type="button" class="btn-primary fm-senden" onclick={absenden} disabled={!bereit}>
      {sendet ? je('Wird gesendet …', 'Sending …') : direkt ? je('Absenden', 'Send') : je('🐙 Auf GitHub melden', '🐙 Report on GitHub')}
    </button>
    {#if !direkt}<p class="fm-klein">{je('Diese Fassung läuft nicht auf der TravelBuddy-Seite, deshalb geht die Meldung über GitHub. Text und Angaben sind schon drin, dafür brauchst du ein GitHub-Konto. Bildschirmfotos hängst du dort selbst an.', 'This copy does not run on the TravelBuddy site, so the report goes through GitHub. Text and details are filled in, you need a GitHub account. Please attach screenshots there yourself.')}</p>{/if}
    {#if direkt && !$online}<p class="fm-klein" role="status">{je('Zum Absenden braucht die App Netz. Dein Text bleibt so lange hier.', 'Sending needs a connection. Your text stays here until then.')}</p>{/if}
  </section>

  <details class="fm-technik">
    <summary>{je('Das wird automatisch mitgeschickt', 'This is sent along automatically')}</summary>
    <dl>
      {#each technik as [k, w]}<dt>{k}</dt><dd>{w}</dd>{/each}
    </dl>
    <p class="fm-klein">{je('Dazu nur dein Text, die Bilder und, wenn du sie angibst, deine E-Mail. Reisedaten, Logbuch, Orte und dein Standort gehen nicht mit. Die Meldung läuft über Netlify und den Mail-Dienst Resend und kommt als Mail beim Anbieter der App an.', 'Plus only your text, the pictures and your email if you give it. Trip data, logbook, places and your location are not sent. The report goes through Netlify and the mail service Resend and arrives as an email with the app’s provider.')}</p>
  </details>
</div>

<style>
  .fm { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
  .fm-intro { margin: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.5; color: var(--ink); }
  .fm-karte { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 16px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .fm-label { font-weight: 700; font-size: calc(15px * var(--schrift, 1)); color: var(--ink); }
  .fm-label small { font-weight: 400; color: var(--muted); margin-left: 4px; }
  .fm-text, .fm-feld { width: 100%; box-sizing: border-box; font: inherit; font-size: max(16px, calc(15px * var(--schrift, 1))); color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 12px; }
  .fm-text { min-height: 168px; resize: vertical; line-height: 1.45; }
  .fm-feld { min-height: 48px; }
  .fm-text::placeholder, .fm-feld::placeholder { color: var(--muted); opacity: 1; }
  .fm-text:focus-visible, .fm-feld:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
  .fm-warn { margin: -4px 0 0; color: var(--danger-text); font-size: calc(13.5px * var(--schrift, 1)); }
  .fm-bilder { display: flex; flex-wrap: wrap; gap: 10px; }
  .fm-bilder:empty { display: none; }
  .fm-bild { position: relative; margin: 0; width: 96px; height: 128px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); background: var(--bg); }
  .fm-bild img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fm-weg { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; border-radius: 50%; border: 0; background: rgba(0, 0, 0, 0.6); color: #fff; font-size: calc(15px * var(--schrift, 1)); cursor: pointer; }
  .fm-weg::after { content: ''; position: absolute; inset: -6px; }
  .fm-datei { display: none; }
  .fm-anfuegen { align-self: flex-start; min-height: 48px; }
  .fm-senden { min-height: 52px; font-size: calc(16px * var(--schrift, 1)); }
  .fm-senden:disabled { opacity: 0.5; cursor: not-allowed; }
  .fm-klein { margin: 0; color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; }
  .fm-technik { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 12px 16px; }
  .fm-technik summary { cursor: pointer; font-weight: 600; color: var(--ink); min-height: 32px; display: flex; align-items: center; }
  .fm-technik dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 10px 0; font-size: calc(13.5px * var(--schrift, 1)); }
  .fm-technik dt { color: var(--muted); }
  .fm-technik dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }
</style>
