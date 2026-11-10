<script>
  // V34: eine wichtige Person anlegen oder ändern (Notfall, „Deinen Leuten Bescheid geben“).
  // Rolle tippen, Nummer mit Ländervorwahl, SMS oder WhatsApp. Bleibt nur auf dem Gerät und im Backup.
  // V35: am Android zusätzlich die Frage nach WhatsApp oder WhatsApp Business (einmal je Gerät).
  import { untrack } from 'svelte'
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { ROLLEN, rollenName, bereinigeKontakt, nummerProblem, MAX_PERSONEN, wegeVon, geraetArt, whatsappApp, whatsappAppName } from './bescheid.js'
  import { notfallKontakte, speichereNotfallKontakt, loescheNotfallKontakt } from './userdata.js'
  import { zeigeToast } from './toast.js'

  let { id = null, onclose = () => {} } = $props()

  const alt = untrack(() => (id ? $notfallKontakte.find((k) => k.id === id) : null))
  let rolle = $state(alt?.rolle || 'mama')
  let name = $state(alt?.name || '')
  let nameSelbst = $state(!!alt)
  let nummer = $state(alt?.nummer || '')
  // SMS, WhatsApp oder beides (dann bekommt die Person beim Senden beides, nacheinander)
  let wege = $state(alt ? wegeVon(alt) : ['sms'])
  const WAHLEN = [
    { id: 'sms', wege: ['sms'], titel: () => je('Per SMS', 'By SMS'), sub: () => je('geht auch ohne Internet, sobald etwas Handynetz da ist', 'works without internet as soon as there is some mobile signal') },
    { id: 'whatsapp', wege: ['whatsapp'], titel: () => je('Per WhatsApp', 'By WhatsApp'), sub: () => je('braucht Internet', 'needs internet') },
    { id: 'beides', wege: ['sms', 'whatsapp'], titel: () => je('Beides', 'Both'), sub: () => je('erst SMS, dann WhatsApp', 'first SMS, then WhatsApp') },
  ]
  const wahl = $derived(wege.length === 2 ? 'beides' : wege[0] || 'sms')
  // V35: am Android einmal fragen, über welches WhatsApp gesendet wird (normal oder Business). Gilt fürs ganze Gerät,
  // danach öffnet sich direkt die richtige App statt jedes Mal der Auswahl.
  const android = geraetArt() === 'android'
  let waWahl = $state(untrack(() => $whatsappApp))
  let waAendern = $state(false)
  const waFrage = $derived(android && wege.includes('whatsapp'))
  let fehler = $state('')
  const voll = $derived(!alt && $notfallKontakte.length >= MAX_PERSONEN)

  // Rolle wählen setzt den Namen mit, solange man ihn nicht selbst geschrieben hat
  function waehle(r) { rolle = r; if (!nameSelbst) name = r === 'andere' ? '' : rollenName(r) }
  $effect(() => { if (!alt && !name) untrack(() => (name = rollenName(rolle))) })

  // Android Chrome kann aus den Kontakten wählen, das iPhone lässt Web-Apps nicht daran
  const kontaktWahl = typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function'
  async function ausKontakten() {
    try {
      const [k] = await navigator.contacts.select(['name', 'tel'], { multiple: false })
      if (!k) return
      if (k.name?.[0]) { name = k.name[0]; nameSelbst = true }
      if (k.tel?.[0]) nummer = k.tel[0]
    } catch {}
  }

  const PROBLEM = {
    leer: () => je('Bitte eine Telefonnummer eintragen.', 'Please enter a phone number.'),
    vorwahl: () => je('Bitte mit Ländervorwahl, zum Beispiel +49 für Deutschland. Unterwegs in Australien weiß das Handy sonst nicht, welches Land gemeint ist.', 'Please include the country code, for example +49 for Germany. In Australia the phone would not know which country you mean.'),
    form: () => je('Diese Nummer sieht nicht richtig aus. Mit + und Ländervorwahl, nur Ziffern.', 'This number does not look right. Start with + and the country code, digits only.'),
  }
  function speichern() {
    const p = nummerProblem(nummer)
    if (p) { fehler = PROBLEM[p](); return }
    if (voll) { fehler = je(`Höchstens ${MAX_PERSONEN} Personen.`, `At most ${MAX_PERSONEN} people.`); return }
    if (waFrage && !waWahl) { fehler = je('Bitte wählen, über welches WhatsApp du sendest.', 'Please choose which WhatsApp you send from.'); return }
    if (waFrage) whatsappApp.set(waWahl)
    const k = bereinigeKontakt({ id: alt?.id, rolle, name, nummer, wege })
    if (!k) { fehler = PROBLEM.form(); return }
    speichereNotfallKontakt(k)
    zeigeToast(je(`${k.name} gespeichert`, `${k.name} saved`), 'ok')
    onclose()
  }
  function loeschen() { loescheNotfallKontakt(alt.id); zeigeToast(je(`${alt.name} entfernt`, `${alt.name} removed`), 'info'); onclose() }
</script>

<div class="pb-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="pb" role="dialog" aria-labelledby="pb-titel" use:modal={{ onclose, fokus: '.pb-nummer' }}>
  <h2 id="pb-titel">{alt ? je('Person ändern', 'Edit person') : je('Wer soll Bescheid bekommen?', 'Who should hear from you?')}</h2>
  <div class="pb-rollen" role="radiogroup" aria-label={je('Rolle', 'Role')}>
    {#each ROLLEN as [r] (r)}
      <button class="pb-rolle" class:an={rolle === r} role="radio" aria-checked={rolle === r} onclick={() => waehle(r)}>{rollenName(r)}</button>
    {/each}
  </div>
  <label class="pb-f">{je('Name', 'Name')}<input bind:value={name} oninput={() => (nameSelbst = true)} maxlength="30" autocomplete="off" placeholder={rollenName(rolle)} /></label>
  <label class="pb-f">{je('Telefonnummer mit Ländervorwahl', 'Phone number with country code')}
    <input class="pb-nummer" bind:value={nummer} oninput={() => (fehler = '')} type="tel" inputmode="tel" autocomplete="tel" placeholder="+49 170 1234567" />
  </label>
  {#if kontaktWahl}<button class="pb-leise" onclick={ausKontakten}>📇 {je('Aus Kontakten wählen', 'Choose from contacts')}</button>{/if}
  <!-- V34: eine klare Frage statt zweier Schalter -->
  <fieldset class="pb-frage">
    <legend>{je(`Wie soll ${name || rollenName(rolle)} Bescheid bekommen?`, `How should ${name || rollenName(rolle)} hear from you?`)}</legend>
    {#each WAHLEN as w (w.id)}
      <label class="pb-karte" class:an={wahl === w.id}>
        <input type="radio" name="pb-weg" value={w.id} checked={wahl === w.id} onchange={() => (wege = w.wege)} />
        <span><b>{w.titel()}</b><small>{w.sub()}</small></span>
      </label>
    {/each}
  </fieldset>
  {#if waFrage}
    {#if $whatsappApp && !waAendern}
      <p class="pb-k">{je(`Gesendet wird über ${whatsappAppName($whatsappApp)}.`, `Sent via ${whatsappAppName($whatsappApp)}.`)} <button class="pb-leise pb-inline" onclick={() => (waAendern = true)}>{je('Ändern', 'Change')}</button></p>
    {:else}
      <fieldset class="pb-frage">
        <legend>{je('Über welches WhatsApp sendest du?', 'Which WhatsApp do you send from?')}</legend>
        {#each ['whatsapp', 'business'] as a (a)}
          <label class="pb-karte" class:an={waWahl === a}>
            <input type="radio" name="pb-wa" value={a} checked={waWahl === a} onchange={() => { waWahl = a; fehler = '' }} />
            <span><b>{whatsappAppName(a)}</b><small>{a === 'business' ? je('wenn du die Business-App nutzt', 'if you use the Business app') : je('die normale App', 'the regular app')}</small></span>
          </label>
        {/each}
        <small class="pb-k">{je('Einmal wählen, gilt für alle deine Leute.', 'Choose once, applies to all your people.')}</small>
      </fieldset>
    {/if}
  {/if}
  {#if fehler}<p class="pb-fehler" role="alert">{fehler}</p>{/if}
  <p class="pb-k">{je('Bleibt nur auf diesem Gerät und im Backup.', 'Stays only on this device and in your backup.')}</p>
  <div class="pb-knoepfe">
    <button class="bedien-knopf" onclick={onclose}>{je('Abbrechen', 'Cancel')}</button>
    <button class="bedien-knopf haupt" onclick={speichern}>{je('Speichern', 'Save')}</button>
  </div>
  {#if alt}<button class="pb-weg-knopf" onclick={loeschen}>{je(`${alt.name} entfernen`, `Remove ${alt.name}`)}</button>{/if}
</div>

<style>
  .pb-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); }
  .pb { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(420px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
  h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .pb-rollen { display: flex; flex-wrap: wrap; gap: 6px; }
  .pb-rolle { min-height: 40px; padding: 4px 12px; border: 1px solid var(--line-stark); border-radius: 999px; background: none; color: var(--ink); font: inherit; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .pb-rolle.an { border: 2px solid var(--brand); background: var(--flaeche); color: var(--brand-text); }
  .pb-f { display: flex; flex-direction: column; gap: 6px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .pb-f input { min-height: 44px; font: inherit; font-size: max(16px, calc(15px * var(--schrift, 1))); font-weight: 400; padding: 8px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--bg); color: var(--ink); }
  .pb-frage { margin: 0; padding: 0; border: none; display: flex; flex-direction: column; gap: 6px; }
  .pb-frage legend { padding: 0; margin-bottom: 6px; font-size: calc(15px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .pb-karte { display: flex; align-items: flex-start; gap: 10px; min-height: 52px; padding: 10px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); cursor: pointer; }
  .pb-karte.an { border: 2px solid var(--brand); background: var(--flaeche); }
  .pb-karte input { width: 20px; height: 20px; margin: 2px 0 0; accent-color: var(--brand); flex: none; }
  .pb-karte span { display: flex; flex-direction: column; gap: 2px; }
  .pb-karte b { font-size: calc(15px * var(--schrift, 1)); }
  .pb-karte small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .pb-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .pb-fehler { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--danger-text); font-weight: 700; }
  .pb-inline { min-height: 40px; padding: 0 4px; }
  .pb-leise { align-self: flex-start; min-height: 44px; border: none; background: none; color: var(--brand-text); font: inherit; font-weight: 700; cursor: pointer; }
  .pb-knoepfe { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pb-weg-knopf { min-height: 44px; border: 1px solid var(--danger-linie); border-radius: var(--radius-m); background: none; color: var(--danger-text); font: inherit; font-weight: 700; cursor: pointer; }
</style>
