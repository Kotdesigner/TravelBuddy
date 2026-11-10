<script>
  // Eine Meldung ansehen (V32): „Stimmt noch“, „Nicht mehr“, „Unpassend melden“; eigene: zurückziehen.
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { online } from './netz.js'
  import { meldungen, meine, stimmen, stimme, unpassend, zurueckziehen } from './meldungen.js'
  import { ART, artName, alter, giltNoch, gegendName } from './meldungen-text.js'
  import { blass, AUSBLENDEN_AB } from './meldungen-regeln.js'
  import { zeigeToast } from './toast.js'

  let { id, onclose = () => {} } = $props()

  const m = $derived($meldungen.liste.find((x) => x.id === id))
  const eigene = $derived($meine.find((x) => x.id === id && x.status === 'live'))
  const meine_stimme = $derived($stimmen[id])
  const gemeldet = $derived(!!$stimmen['u:' + id])

  async function weg() {
    if (await zurueckziehen(eigene.lokalId)) { zeigeToast($meldungen.gruppe ? je('Zurückgezogen, auch aus der Telegram-Gruppe', 'Withdrawn, also from the Telegram group') : je('Zurückgezogen', 'Withdrawn'), 'ok'); onclose() }
    else zeigeToast(je('Ging gerade nicht. Mit Netz noch einmal versuchen.', 'Did not work right now. Try again with signal.'), 'info', 4000)
  }
</script>

<div class="mb-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="mb" role="dialog" aria-label={je('Meldung', 'Report')} use:modal={{ onclose, fokus: '.mb-zu' }}>
  {#if m}
    <span class="mb-art mb-{m.art}">{ART[m.art]?.icon} {artName(m.art)}</span>
    <p class="mb-text" class:blass={blass(m)}>{m.text}</p>
    <p class="mb-k">📍 {m.ort || gegendName(m.gegend)} · {m.name || je('Reisende/r', 'Traveller')} · {alter(m.erstellt)} · {giltNoch(m.ablauf)}</p>
    <p class="mb-stand" class:warn={blass(m)}>{blass(m) ? je('Wohl nicht mehr aktuell', 'Probably no longer current') : m.ja ? je(`${m.ja}× bestätigt`, `Confirmed ${m.ja}×`) : je('Noch nicht bestätigt', 'Not confirmed yet')}{m.nein ? je(` · ${m.nein}× nicht mehr`, ` · ${m.nein}× no longer`) : ''}</p>
    {#if eigene}
      <p class="mb-k">{je('Das ist deine Meldung.', 'This is your report.')}</p>
      <button class="btn" onclick={weg}>{je('Zurückziehen', 'Withdraw')}</button>
    {:else}
      <div class="mb-zeile">
        <button class="btn" class:an={meine_stimme === 'ja'} aria-pressed={meine_stimme === 'ja'} disabled={!$online} onclick={() => stimme(id, 'ja')}>✓ {je('Stimmt noch', 'Still true')}</button>
        <button class="btn" class:an={meine_stimme === 'nein'} aria-pressed={meine_stimme === 'nein'} disabled={!$online} onclick={() => stimme(id, 'nein')}>✕ {je('Nicht mehr', 'No longer')}</button>
      </div>
      {#if gemeldet}<p class="mb-k">🚩 {je(`Danke. Ab ${AUSBLENDEN_AB} Meldungen wird sie ausgeblendet und TravelBuddy prüft sie.`, `Thanks. After ${AUSBLENDEN_AB} reports it is hidden and TravelBuddy checks it.`)}</p>
      {:else}<button class="mb-leise" disabled={!$online} onclick={() => unpassend(id)}>🚩 {je('Unpassend melden', 'Report as inappropriate')}</button>{/if}
      <p class="mb-k">{je('„Stimmt noch“ verlängert sie um einen Tag. Wird sie mehrfach als „nicht mehr“ bestätigt, fällt sie aus Heute raus.', '“Still true” extends it by a day. If several people say “no longer”, it drops off Today.')}{#if !$online}{je(' Abstimmen und melden geht nur mit Netz.', ' Voting and reporting need signal.')}{/if}</p>
    {/if}
  {:else}
    <p class="mb-text">{je('Diese Meldung gibt es nicht mehr.', 'This report no longer exists.')}</p>
  {/if}
  <button class="bedien-knopf mb-zu" onclick={onclose}>{je('Schließen', 'Close')}</button>
</div>

<style>
  .mb-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); }
  .mb { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(400px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
  .mb-art { align-self: flex-start; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 3px 10px; border-radius: 999px; background: var(--flaeche); color: var(--brand-text); }
  .mb-weg { background: var(--danger-flaeche); color: var(--danger-text); }
  .mb-tanken, .mb-wetter { background: var(--warn-flaeche); color: var(--ink); }
  .mb-camping { background: var(--ok-flaeche); color: var(--ok-text); }
  .mb-text { margin: 0; font-size: calc(17px * var(--schrift, 1)); line-height: 1.45; }
  .mb-text.blass { opacity: 0.55; }
  .mb-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .mb-stand { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); }
  .mb-stand.warn { color: var(--danger-text); }
  .mb-zeile { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mb-zeile .an { border-color: var(--brand); background: var(--flaeche); color: var(--brand-text); }
  .mb-leise { align-self: flex-start; min-height: 44px; border: none; background: none; color: var(--muted); font: inherit; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
</style>
