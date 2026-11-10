<script>
  // Mehr → Meldungen (V32): alle aktiven Meldungen nach Gegend und Art, und „Meine Meldungen“ mit Stand.
  import { je } from './i18n.js'
  import { online } from './netz.js'
  import { standort, standortFrisch } from './standort.js'
  import { meldungen, meine, laden, sendeWartende, zurueckziehen, inGegend, gegendVon, OFFIZIELL } from './meldungen.js'
  import { ART, artName, gegendName, alter, meldenBlatt, grundText } from './meldungen-text.js'
  import { GEGENDEN } from './meldungen-regeln.js'
  import MeldungZeile from './MeldungZeile.svelte'
  import InfoKnopf from './InfoKnopf.svelte'
  import { zeigeToast } from './toast.js'

  let { tab = 'alle' } = $props()

  const hier = $derived(standortFrisch($standort) ? gegendVon($standort.lat, $standort.lon) : null)
  const zahlen = $derived(Object.fromEntries(GEGENDEN.map((g) => [g.id, inGegend(g.id, $meldungen.liste).length])))
  const gegenden = $derived(GEGENDEN.filter((g) => zahlen[g.id] || g.id === hier))
  let gegend = $state(null)
  let art = $state(null)
  const liste = $derived(inGegend(gegend, $meldungen.liste, { art }))
  let laedt = $state(false)

  $effect(() => { if ($online) { sendeWartende(); laden() } })
  async function neuLaden() { laedt = true; await laden(); laedt = false }
  async function weg(m) {
    if (await zurueckziehen(m.lokalId)) zeigeToast(je('Zurückgezogen', 'Withdrawn'), 'ok')
    else zeigeToast(je('Ging gerade nicht. Mit Netz noch einmal versuchen.', 'Did not work right now. Try again with signal.'), 'info', 4000)
  }
  const STATUS = {
    wartet: () => je('📴 wartet auf Netz', '📴 waiting for signal'),
    live: () => je('✓ veröffentlicht', '✓ published'),
    abgelehnt: () => je('✕ nicht angenommen', '✕ not accepted'),
    zurueck: () => je('zurückgezogen', 'withdrawn'),
    vorbei: () => je('abgelaufen', 'expired'),
  }
</script>

<div class="ms">
  {#if $meldungen.verfuegbar === false}
    <p class="ms-leer" role="status">{je(`Diese Seite hat keinen Server für Meldungen. Meldungen anderer Reisender gibt es in TravelBuddy auf ${OFFIZIELL}.`, `This site has no server for reports. Reports from other travellers are available in TravelBuddy at ${OFFIZIELL}.`)}</p>
  {/if}
  <p class="ms-einl">{je('Was andere Reisende melden: Wege, Tiere, Tanken, Camping, Wetter und Tipps. Jede Meldung gilt 3 Tage.', 'What other travellers report: roads, wildlife, fuel, camping, weather and tips. Each report is valid for 3 days.')}<InfoKnopf id="meldungen" /></p>
  <div class="ms-zeile">
    <button class="btn-primary" onclick={() => meldenBlatt.set({})}>📣 {je('Etwas melden', 'Report something')}</button>
    <button class="btn" onclick={neuLaden} disabled={!$online || laedt}>{laedt ? je('lädt …', 'loading …') : je('Neu laden', 'Refresh')}</button>
  </div>
  <div class="segment ms-tabs" role="group" aria-label={je('Ansicht', 'View')}>
    <button class:an={tab === 'alle'} aria-pressed={tab === 'alle'} onclick={() => (tab = 'alle')}>{je('Alle', 'All')} ({$meldungen.liste.length})</button>
    <button class:an={tab === 'meine'} aria-pressed={tab === 'meine'} onclick={() => (tab = 'meine')}>{je('Meine', 'Mine')} ({$meine.filter((m) => m.status !== 'zurueck').length})</button>
  </div>

  {#if tab === 'alle'}
    <div class="ms-chips" role="group" aria-label={je('Gegend', 'Area')}>
      <button class="ms-chip" class:an={!gegend} onclick={() => (gegend = null)}>{je('Alle Gegenden', 'All areas')}</button>
      {#each gegenden as g (g.id)}<button class="ms-chip" class:an={gegend === g.id} onclick={() => (gegend = g.id)}>{gegendName(g.id)}{g.id === hier ? ' 📍' : ''} <span>{zahlen[g.id]}</span></button>{/each}
    </div>
    <div class="ms-chips" role="group" aria-label={je('Art', 'Type')}>
      <button class="ms-chip" class:an={!art} onclick={() => (art = null)}>{je('Alle Arten', 'All types')}</button>
      {#each Object.keys(ART) as a (a)}<button class="ms-chip" class:an={art === a} onclick={() => (art = a)}>{ART[a].icon} {artName(a)}</button>{/each}
    </div>
    {#if liste.length}
      <div class="ms-liste">{#each liste as m (m.id)}<MeldungZeile {m} ort={true} />{/each}</div>
    {:else}
      <p class="ms-leer">{je('Gerade keine Meldungen hier. Unterwegs etwas gesehen? Mit „Etwas melden“ die erste machen.', 'No reports here right now. Seen something on the road? Make the first one with “Report something”.')}</p>
    {/if}
    <p class="ms-k">{$meldungen.stand ? je(`Stand ${alter($meldungen.stand)}`, `Updated ${alter($meldungen.stand)}`) : ''}{!$online ? je(' · ohne Netz: letzter Stand', ' · offline: last known') : ''}</p>
  {:else}
    {#if $meine.length}
      <div class="ms-liste">
        {#each $meine as m (m.lokalId)}
          <div class="ms-mein" class:aus={m.status === 'zurueck' || m.status === 'vorbei'}>
            <span class="ms-art">{ART[m.roh.art]?.icon} {artName(m.roh.art)}</span>
            <span class="ms-text">{m.roh.text}</span>
            <small>{m.roh.ort || gegendName(m.roh.gegend)} · {alter(m.erstellt)} · {STATUS[m.status]?.()}{m.status === 'abgelehnt' ? ': ' + grundText(m.grund) : ''}</small>
            {#if m.status === 'wartet' || m.status === 'live'}<button class="btn ms-weg" onclick={() => weg(m)}>{m.status === 'wartet' ? je('Nicht senden', 'Do not send') : je('Zurückziehen', 'Withdraw')}</button>{/if}
          </div>
        {/each}
      </div>
      <p class="ms-k">{$meldungen.gruppe ? je('Zurückziehen nimmt die Meldung aus der App und aus der TravelBuddy-Gruppe.', 'Withdrawing removes the report from the app and from the TravelBuddy group.') : je('Zurückziehen nimmt die Meldung aus der App.', 'Withdrawing removes the report from the app.')}</p>
    {:else}
      <p class="ms-leer">{je('Du hast noch nichts gemeldet.', 'You have not reported anything yet.')}</p>
    {/if}
  {/if}
</div>

<style>
  .ms { display: flex; flex-direction: column; gap: 12px; max-width: 760px; }
  .ms-einl { margin: 0; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); }
  .ms-zeile { display: flex; gap: 8px; flex-wrap: wrap; }
  .ms-zeile .btn-primary { flex: 1; min-height: 48px; }
  .ms-tabs { display: grid; grid-template-columns: 1fr 1fr; }
  .ms-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
  .ms-chip { flex: none; min-height: 36px; padding: 4px 12px; border: 1px solid var(--line-stark); border-radius: 999px; background: none; color: var(--ink); font: inherit; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; white-space: nowrap; }
  .ms-chip span { color: var(--muted); font-weight: 500; }
  .ms-chip.an { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .ms-chip.an span { color: var(--bg); }
  .ms-liste { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 0 14px; }
  .ms-liste > :global(.mz:first-child), .ms-mein:first-child { border-top: none; }
  .ms-leer { margin: 0; padding: 16px; border: 1px dashed var(--line-stark); border-radius: var(--radius-l); color: var(--muted); font-size: calc(14px * var(--schrift, 1)); }
  .ms-k { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .ms-mein { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-top: 1px solid var(--line); }
  .ms-mein.aus { opacity: 0.55; }
  .ms-art { align-self: flex-start; font-size: calc(11.5px * var(--schrift, 1)); font-weight: 800; padding: 2px 8px; border-radius: 999px; background: var(--flaeche); color: var(--brand-text); }
  .ms-text { font-size: calc(14.5px * var(--schrift, 1)); }
  .ms-mein small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .ms-weg { align-self: flex-start; min-height: 40px; }
</style>
