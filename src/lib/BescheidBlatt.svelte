<script>
  // V34: „Mir geht's gut“ oder „Mein Standort“ an deine wichtigen Personen. Ein Tipp öffnet die fertige Nachricht
  // in der SMS- oder WhatsApp-App, dort nur noch „Senden“. Standort aus dem GPS, Ortsname offline aus der App.
  // V35: SOS (SMS an alle, auch mit älterem Standort), Kurzbefehl am iPhone und Mac statt SMS von Hand,
  // WhatsApp oder WhatsApp Business am Android, einzeln senden, Text kopieren, Hinweis am Windows-PC.
  import { get } from 'svelte/store'
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { online } from './netz.js'
  import { standort, frageStandortAn } from './standort.js'
  import { notfallKontakte, neuerCheckin } from './userdata.js'
  import { bescheidText, naechsterOrt, sendewege, personBlatt, wegeText, geraetArt, smsGeht, whatsappApp, kurzbefehlAn, kurzbefehlBereit, kurzbefehlLink } from './bescheid.js'
  import { zeigeToast } from './toast.js'

  let { art = 'ok', orte = [], smsErledigt = false, kurzbefehl = false, onclose = () => {} } = $props()

  const FRISCH_MS = 5 * 60 * 1000
  const geraet = geraetArt()
  const sos = art === 'sos'
  // SOS nimmt sofort den letzten Standort (auch älter) und holt im Hintergrund einen neuen
  let pos = $state(sos ? get(standort) : null)
  let suche = $state(false)
  let keinOrt = $state(false)
  async function ortHolen() {
    const s = get(standort)
    if (s && Date.now() - s.zeit < FRISCH_MS) { pos = s; return }
    suche = true; keinOrt = false
    const ok = await frageStandortAn({ hoheGenauigkeit: true, alterMs: 60000 })
    suche = false
    if (ok) pos = get(standort); else if (!pos) keinOrt = true
  }
  ortHolen()

  let abgewaehlt = $state({})
  const personen = $derived($notfallKontakte.filter((p) => !abgewaehlt[p.id]))
  const ort = $derived(pos ? naechsterOrt(pos.lat, pos.lon, orte) : null)
  const nachricht = $derived(bescheidText({ art, pos, ort }))
  const wege = $derived(sendewege(personen, nachricht, { geraet, app: $whatsappApp, alleSms: sos }))
  const gesperrt = $derived(art === 'standort' && !pos)
  const mitKurzbefehl = $derived(kurzbefehlBereit($kurzbefehlAn, geraet))
  const altMin = $derived(pos?.zeit ? Math.round((Date.now() - pos.zeit) / 60000) : 0)

  // Schritte: erst die SMS an alle (oder der Kurzbefehl), dann WhatsApp je Person. Zwei Apps auf einmal öffnet
  // kein Handy, darum nacheinander: nach jedem Tipp ein Häkchen, der nächste Schritt leuchtet auf.
  // Am Windows-PC öffnet sich eine SMS meist nicht: dort WhatsApp zuerst, die SMS ans Ende
  const smsSchritt = $derived(wege.sms ? [mitKurzbefehl
    ? { key: 'sms', link: kurzbefehlLink(nachricht), fremd: false, text: je('⚡ Direkt senden (Kurzbefehl)', '⚡ Send directly (shortcut)') }
    : { key: 'sms', link: wege.sms.link, fremd: false, text: je(`💬 SMS an ${wege.sms.namen.join(', ')}`, `💬 Text ${wege.sms.namen.join(', ')}`) }] : [])
  const waSchritte = $derived(wege.whatsapp.map((w) => ({ key: 'wa:' + w.id, link: w.link, fremd: !/^intent:/.test(w.link), text: je(`WhatsApp an ${w.name}`, `WhatsApp to ${w.name}`) })))
  const schritte = $derived(smsGeht(geraet) ? [...smsSchritt, ...waSchritte] : [...waSchritte, ...smsSchritt])
  // Schon unterwegs (SMS direkt geöffnet oder Kurzbefehl gelaufen): SMS-Schritt ist erledigt
  let erledigt = $state(smsErledigt || kurzbefehl ? { sms: true } : {})
  const naechster = $derived(schritte.find((s) => !erledigt[s.key])?.key || null)
  // „Alles geöffnet“ erst, wenn hier im Blatt getippt wurde (nach Kurzbefehl oder direkter SMS steht oben schon die Meldung)
  let hierGetippt = $state(false)
  function getippt(s) { erledigt = { ...erledigt, [s.key]: true }; hierGetippt = true; gesendet() }

  // „Mir geht's gut“ und SOS zählen zugleich als Lebenszeichen (einmal je Blatt, nur mit Standort; schon gespeichert,
  // wenn die SMS oder der Kurzbefehl vorher direkt lief)
  let gespeichert = smsErledigt || kurzbefehl
  function gesendet() {
    if ((art === 'ok' || sos) && pos && !gespeichert) {
      neuerCheckin({ lat: pos.lat, lon: pos.lon, text: sos ? je('SOS an deine Leute', 'SOS to your people') : je('Bescheid gegeben', 'Let them know') })
      gespeichert = true
    }
  }
  function personNeu() { onclose(); personBlatt.set({}) }
  async function kopieren() {
    try { await navigator.clipboard.writeText(nachricht); zeigeToast(je('Text kopiert. In jede App einfügen.', 'Text copied. Paste it into any app.'), 'ok') }
    catch { zeigeToast(je('Kopieren geht hier nicht. Text bitte markieren.', 'Copying is not possible here. Please select the text.'), 'info') }
  }
  const titel = $derived(sos ? je('🆘 SOS an deine Leute', '🆘 SOS to your people') : art === 'standort' ? je('📍 Mein Standort senden', '📍 Send my location') : je('✅ Mir geht\'s gut senden', '✅ Send “I\'m okay”'))
</script>

<div class="bb-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="bb" class:sos role="dialog" aria-labelledby="bb-titel" use:modal={{ onclose, fokus: '.bb-fertig' }}>
  <h2 id="bb-titel">{titel}</h2>

  {#if !$notfallKontakte.length}
    <p class="bb-k">{je('Noch niemand angelegt. Leg Mama, Papa oder deine Partnerin an, dann reicht ab jetzt ein Tipp.', 'Nobody added yet. Add your mum, dad or partner, then one tap is enough from now on.')}</p>
    <button class="bedien-knopf haupt" onclick={personNeu}>＋ {je('Person anlegen', 'Add a person')}</button>
    {#if sos}<a class="bedien-knopf bb-000" href="tel:000">📞 {je('000 anrufen', 'Call 000')}</a>{/if}
  {:else}
    {#if kurzbefehl}<p class="bb-alles" role="status">⚡ {je('Über deinen Kurzbefehl gesendet. Kam nichts an, sende unten von Hand.', 'Sent via your shortcut. If nothing arrived, send by hand below.')}</p>
    {:else if smsErledigt}<p class="bb-alles" role="status">💬 {je('Die SMS an alle ist offen. Danach hier weiter mit WhatsApp.', 'The text to everyone is open. Then continue here with WhatsApp.')}</p>{/if}

    <div class="bb-liste" role="group" aria-label={je('An wen?', 'To whom?')}>
      {#each $notfallKontakte as p (p.id)}
        <label class="bb-person">
          <input type="checkbox" checked={!abgewaehlt[p.id]} onchange={(e) => (abgewaehlt = { ...abgewaehlt, [p.id]: !e.currentTarget.checked })} />
          <b>{p.name}</b><span>{sos && !wegeText(p).includes('SMS') ? `SMS + ${wegeText(p)}` : wegeText(p)}</span>
        </label>
      {/each}
    </div>

    <p class="bb-ort" role="status">
      {#if pos}📍 {ort || `${(+pos.lat).toFixed(4)}, ${(+pos.lon).toFixed(4)}`}{#if pos.genauigkeit}{` · ± ${pos.genauigkeit} m`}{/if}{#if altMin > 5}{je(` · vor ${altMin} min`, ` · ${altMin} min ago`)}{/if}
        {#if suche}<span class="bb-leise-t">{je('wird erneuert …', 'updating …')}</span>{/if}
      {:else if suche}📍 {je('Standort wird bestimmt …', 'Getting your location …')}
      {:else if keinOrt}{art === 'standort' ? je('Kein Standort. Draußen mit freiem Himmel noch einmal versuchen.', 'No location. Try again outside with open sky.') : sos ? je('Ohne Standort. Das SOS geht trotzdem raus.', 'Without location. The SOS goes out anyway.') : je('Ohne Standort, nur „Mir geht\'s gut“ mit Uhrzeit.', 'Without location, just “I\'m okay” with the time.')}
        <button class="bb-leise" onclick={ortHolen}>{je('Noch einmal', 'Try again')}</button>{/if}
    </p>

    <div class="bb-vorschau">{nachricht}</div>

    {#if !personen.length}
      <p class="bb-k">{je('Niemand ausgewählt.', 'Nobody selected.')}</p>
    {:else}
      {#if schritte.length > 1}<p class="bb-k">{je(`Nacheinander, ${schritte.length} Schritte: nach jedem Senden zurück in TravelBuddy, dann der nächste.`, `One after another, ${schritte.length} steps: after each send come back to TravelBuddy, then the next one.`)}</p>{/if}
      <div class="bb-senden">
        {#each schritte as s, i (s.key)}
          {#if gesperrt}<button class="bedien-knopf" disabled>{s.text}</button>
          {:else}<a class="bedien-knopf bb-a" class:haupt={s.key === naechster} class:fertig={erledigt[s.key]} href={s.link}
              target={s.fremd ? '_blank' : undefined} rel={s.fremd ? 'noopener noreferrer' : undefined} onclick={() => getippt(s)}>
              {#if schritte.length > 1 || erledigt[s.key]}<span class="bb-nr" aria-hidden="true">{erledigt[s.key] ? '✓' : i + 1}</span>{/if}{s.text}</a>{/if}
        {/each}
      </div>
      {#if schritte.length && !naechster && hierGetippt}<p class="bb-alles" role="status">✓ {je('Alles geöffnet. Hast du überall auf Senden getippt?', 'All opened. Did you tap Send everywhere?')}</p>{/if}
      <p class="bb-k">{mitKurzbefehl ? je('Der Kurzbefehl sendet ohne weiteren Tipp an die Leute, die du in ihm gewählt hast.', 'The shortcut sends without another tap to the people you picked in it.') : je('Danach in der SMS- oder WhatsApp-App nur noch auf Senden tippen.', 'Then just tap Send in your messages or WhatsApp app.')}{#if (art === 'ok' || sos) && pos}{je(' Wird zugleich als Lebenszeichen gespeichert.', ' Also saved as a check-in.')}{/if}{#if !$online && wege.whatsapp.length}{je(' WhatsApp braucht Internet, SMS geht auch ohne.', ' WhatsApp needs internet, SMS works without.')}{/if}</p>
      {#if wege.sms && !smsGeht(geraet)}<p class="bb-hinweis">{je('Am Windows-PC öffnet sich eine SMS nur mit der App Smartphone-Link und deinem Handy. WhatsApp und Text kopieren gehen immer.', 'On a Windows PC a text message only opens with the Phone Link app and your phone. WhatsApp and copying the text always work.')}</p>{/if}
      <!-- Rückfall: nicht jede SMS-App versteht mehrere Empfänger, und der Kurzbefehl kann fehlen -->
      {#if wege.sms && !gesperrt && (wege.sms.einzeln.length > 1 || mitKurzbefehl)}
        <details class="bb-einzeln">
          <summary>{mitKurzbefehl ? je('Ohne Kurzbefehl: SMS von Hand', 'Without the shortcut: text by hand') : je('Klappt es mit mehreren nicht? Einzeln senden', 'Trouble with several people? Send one by one')}</summary>
          {#if mitKurzbefehl && wege.sms.einzeln.length > 1}<a class="bedien-knopf" href={wege.sms.link} onclick={() => gesendet()}>💬 {je(`SMS an ${wege.sms.namen.join(', ')}`, `Text ${wege.sms.namen.join(', ')}`)}</a>{/if}
          {#each wege.sms.einzeln as e (e.id)}<a class="bedien-knopf" href={e.link} onclick={() => gesendet()}>💬 {je(`SMS an ${e.name}`, `Text ${e.name}`)}</a>{/each}
        </details>
      {/if}
      <button class="bb-leise bb-kopie" onclick={kopieren}>📋 {je('Text kopieren', 'Copy text')}</button>
      {#if sos}<a class="bedien-knopf bb-000" href="tel:000">📞 {je('000 anrufen', 'Call 000')}</a>{/if}
    {/if}
  {/if}
  <button class="bedien-knopf bb-fertig" onclick={onclose}>{je('Fertig', 'Done')}</button>
</div>

<style>
  .bb-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); }
  .bb { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(420px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
  .bb.sos { border: 2px solid #c0392b; }
  h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .bb-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .bb-hinweis { margin: 0; padding: 8px 10px; border-radius: var(--radius-m); background: var(--warn-flaeche); color: var(--warn-text); font-size: calc(13px * var(--schrift, 1)); line-height: 1.45; }
  .bb-liste { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--radius-m); }
  .bb-person { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 4px 12px; border-top: 1px solid var(--line); font-size: calc(15px * var(--schrift, 1)); cursor: pointer; }
  .bb-person:first-child { border-top: none; }
  .bb-person input { width: 20px; height: 20px; accent-color: var(--brand); }
  .bb-person b { flex: 1; }
  .bb-person span { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .bb-ort { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .bb-leise-t { font-weight: 400; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .bb-leise { min-height: 40px; border: none; background: none; color: var(--brand-text); font: inherit; font-weight: 700; cursor: pointer; }
  .bb-kopie { align-self: flex-start; min-height: 44px; }
  .bb-vorschau { padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--bg); font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; overflow-wrap: anywhere; }
  .bb-senden { display: flex; flex-direction: column; gap: 8px; }
  .bb-a { display: flex; align-items: center; justify-content: center; min-height: 52px; text-decoration: none; text-align: center; }
  .bb-a.fertig { opacity: 0.7; }
  .bb-nr { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-right: 8px; border-radius: 50%; border: 1.5px solid currentColor; font-size: calc(13px * var(--schrift, 1)); font-weight: 800; flex: none; }
  .bb-alles { margin: 0; padding: 10px 12px; border-radius: var(--radius-m); background: var(--ok-flaeche); color: var(--ok-text); font-weight: 700; }
  .bb-einzeln { display: flex; flex-direction: column; gap: 8px; }
  .bb-einzeln summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--brand-text); font-weight: 700; font-size: calc(14px * var(--schrift, 1)); }
  .bb-einzeln .bedien-knopf { display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: 8px; text-decoration: none; }
  .bb-000 { display: flex; align-items: center; justify-content: center; min-height: 52px; text-decoration: none; background: #c0392b; border-color: #c0392b; color: #fff; font-weight: 800; }
  .bb-fertig { min-height: 44px; }
</style>
