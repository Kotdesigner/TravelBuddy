<script>
  // V34: „Mir geht's gut“ oder „Mein Standort“ an deine wichtigen Personen. Ein Tipp öffnet die fertige Nachricht
  // in der SMS- oder WhatsApp-App, dort nur noch „Senden“. Standort aus dem GPS, Ortsname offline aus der App.
  import { get } from 'svelte/store'
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { online } from './netz.js'
  import { standort, frageStandortAn } from './standort.js'
  import { notfallKontakte, neuerCheckin } from './userdata.js'
  import { bescheidText, naechsterOrt, sendewege, personBlatt, wegeText } from './bescheid.js'

  let { art = 'ok', orte = [], onclose = () => {} } = $props()

  const FRISCH_MS = 5 * 60 * 1000
  let pos = $state(null)
  let suche = $state(false)
  let keinOrt = $state(false)
  async function ortHolen() {
    const s = get(standort)
    if (s && Date.now() - s.zeit < FRISCH_MS) { pos = s; return }
    suche = true; keinOrt = false
    const ok = await frageStandortAn({ hoheGenauigkeit: true, alterMs: 60000 })
    suche = false
    if (ok) pos = get(standort); else keinOrt = true
  }
  ortHolen()

  let abgewaehlt = $state({})
  const personen = $derived($notfallKontakte.filter((p) => !abgewaehlt[p.id]))
  const ort = $derived(pos ? naechsterOrt(pos.lat, pos.lon, orte) : null)
  const nachricht = $derived(bescheidText({ art, pos, ort }))
  const wege = $derived(sendewege(personen, nachricht))
  const gesperrt = $derived(art === 'standort' && !pos)

  // Schritte: erst die SMS an alle, dann WhatsApp je Person. Zwei Apps auf einmal öffnet kein Handy, darum
  // nacheinander: nach jedem Tipp ein Häkchen, der nächste Schritt leuchtet auf.
  const schritte = $derived([
    ...(wege.sms ? [{ key: 'sms', link: wege.sms.link, fremd: false, text: je(`💬 SMS an ${wege.sms.namen.join(', ')}`, `💬 Text ${wege.sms.namen.join(', ')}`) }] : []),
    ...wege.whatsapp.map((w) => ({ key: 'wa:' + w.id, link: w.link, fremd: true, text: je(`WhatsApp an ${w.name}`, `WhatsApp to ${w.name}`) })),
  ])
  let erledigt = $state({})
  const naechster = $derived(schritte.find((s) => !erledigt[s.key])?.key || null)
  function getippt(s) { erledigt = { ...erledigt, [s.key]: true }; gesendet() }

  // „Mir geht's gut“ zählt zugleich als Lebenszeichen (einmal je Blatt, nur mit Standort)
  let gespeichert = false
  function gesendet() {
    if (art === 'ok' && pos && !gespeichert) { neuerCheckin({ lat: pos.lat, lon: pos.lon, text: je('Bescheid gegeben', 'Let them know') }); gespeichert = true }
  }
  function personNeu() { onclose(); personBlatt.set({}) }
</script>

<div class="bb-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="bb" role="dialog" aria-labelledby="bb-titel" use:modal={{ onclose, fokus: '.bb-fertig' }}>
  <h2 id="bb-titel">{art === 'standort' ? je('📍 Mein Standort senden', '📍 Send my location') : je('✅ Mir geht\'s gut senden', '✅ Send “I\'m okay”')}</h2>

  {#if !$notfallKontakte.length}
    <p class="bb-k">{je('Noch niemand angelegt. Leg Mama, Papa oder deine Partnerin an, dann reicht ab jetzt ein Tipp.', 'Nobody added yet. Add your mum, dad or partner, then one tap is enough from now on.')}</p>
    <button class="bedien-knopf haupt" onclick={personNeu}>＋ {je('Person anlegen', 'Add a person')}</button>
  {:else}
    <div class="bb-liste" role="group" aria-label={je('An wen?', 'To whom?')}>
      {#each $notfallKontakte as p (p.id)}
        <label class="bb-person">
          <input type="checkbox" checked={!abgewaehlt[p.id]} onchange={(e) => (abgewaehlt = { ...abgewaehlt, [p.id]: !e.currentTarget.checked })} />
          <b>{p.name}</b><span>{wegeText(p)}</span>
        </label>
      {/each}
    </div>

    <p class="bb-ort" role="status">
      {#if suche}📍 {je('Standort wird bestimmt …', 'Getting your location …')}
      {:else if pos}📍 {ort || `${(+pos.lat).toFixed(4)}, ${(+pos.lon).toFixed(4)}`}{#if pos.genauigkeit}{` · ± ${pos.genauigkeit} m`}{/if}
      {:else if keinOrt}{art === 'standort' ? je('Kein Standort. Draußen mit freiem Himmel noch einmal versuchen.', 'No location. Try again outside with open sky.') : je('Ohne Standort, nur „Mir geht\'s gut“ mit Uhrzeit.', 'Without location, just “I\'m okay” with the time.')}
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
              {#if schritte.length > 1}<span class="bb-nr" aria-hidden="true">{erledigt[s.key] ? '✓' : i + 1}</span>{/if}{s.text}</a>{/if}
        {/each}
      </div>
      {#if schritte.length && !naechster}<p class="bb-alles" role="status">✓ {je('Alles geöffnet. Hast du überall auf Senden getippt?', 'All opened. Did you tap Send everywhere?')}</p>{/if}
      <p class="bb-k">{je('Danach in der SMS- oder WhatsApp-App nur noch auf Senden tippen.', 'Then just tap Send in your messages or WhatsApp app.')}{#if art === 'ok' && pos}{je(' Wird zugleich als Lebenszeichen gespeichert.', ' Also saved as a check-in.')}{/if}{#if !$online && wege.whatsapp.length}{je(' WhatsApp braucht Internet, SMS geht auch ohne.', ' WhatsApp needs internet, SMS works without.')}{/if}</p>
    {/if}
  {/if}
  <button class="bedien-knopf bb-fertig" onclick={onclose}>{je('Fertig', 'Done')}</button>
</div>

<style>
  .bb-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); }
  .bb { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(420px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
  h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .bb-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .bb-liste { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--radius-m); }
  .bb-person { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 4px 12px; border-top: 1px solid var(--line); font-size: calc(15px * var(--schrift, 1)); cursor: pointer; }
  .bb-person:first-child { border-top: none; }
  .bb-person input { width: 20px; height: 20px; accent-color: var(--brand); }
  .bb-person b { flex: 1; }
  .bb-person span { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .bb-ort { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .bb-leise { min-height: 40px; border: none; background: none; color: var(--brand-text); font: inherit; font-weight: 700; cursor: pointer; }
  .bb-vorschau { padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--bg); font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; overflow-wrap: anywhere; }
  .bb-senden { display: flex; flex-direction: column; gap: 8px; }
  .bb-a { display: flex; align-items: center; justify-content: center; min-height: 52px; text-decoration: none; text-align: center; }
  .bb-a.fertig { opacity: 0.7; }
  .bb-nr { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-right: 8px; border-radius: 50%; border: 1.5px solid currentColor; font-size: calc(13px * var(--schrift, 1)); font-weight: 800; flex: none; }
  .bb-alles { margin: 0; padding: 10px 12px; border-radius: var(--radius-m); background: var(--ok-flaeche); color: var(--ok-text); font-weight: 700; }
  .bb-fertig { min-height: 44px; }
</style>
