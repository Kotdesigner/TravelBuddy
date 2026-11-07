<script>
  // Die Gegenden eines Reiters als Liste zum Aufklappen. Alle Balken stehen nebeneinander in EINER
  // Liste: beim Scrollen bleibt der Balken der offenen Gegend oben stehen, und der nächste legt sich
  // darüber, statt den alten nach oben hinter die Notch zu schieben.
  // Im Balken: Name und Anzahl zum Auf- und Zuklappen. Offen: zuerst die Karte der Gegend mit
  // nummerierten Punkten (dieselbe Nummer auf der Kachel), darunter die Kacheln.
  import { t, je } from './i18n.js'
  import { dauer, klapp } from './motion.js'
  import Ort from './Ort.svelte'
  import RegionKarte from './RegionKarte.svelte'

  let { regionen = [], offen = $bindable({}), gefahren = {}, warnungen = {}, alleOffen = false, reisen = [], mitKarte = true } = $props()

  const istOffen = (titel) => alleOffen || !!offen[titel]
  function umschalten(titel) { offen = { ...offen, [titel]: !offen[titel] } }
  const nummern = (r) => Object.fromEntries(r.orte.map((o, i) => [o.id, i + 1]))
  const kennung = (titel) => 'reg-' + titel.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
</script>

<div class="or-liste">
  {#each regionen as r (r.titel)}
    {@const auf = istOffen(r.titel)}
    {@const id = kennung(r.titel)}
    <div class="or-balken" class:auf id="{id}-kopf" data-region={r.titel}>
      <button class="or-kopf" aria-expanded={auf} aria-controls="{id}-inhalt" onclick={() => umschalten(r.titel)} disabled={alleOffen}>
        {#if !alleOffen}<span class="or-pfeil" class:auf aria-hidden="true">›</span>{/if}
        <span class="or-name">{t(r.titel)}</span>
        <span class="or-anz">{r.orte.length}</span>
      </button>
    </div>
    {#if auf}
      {@const nr = nummern(r)}
      <div class="or-inhalt" id="{id}-inhalt" transition:klapp={{ duration: dauer(220) }}>
        {#if mitKarte}<RegionKarte orte={r.orte} {reisen} nummer={nr} titel={t(r.titel)} />{/if}
        <div class="or-grid">{#each r.orte as o (o.id)}<Ort ort={o} gefahr={gefahren[o.id]} warnung={warnungen[o.id]} nummer={mitKarte ? nr[o.id] : null} />{/each}</div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .or-liste { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 20px; }
  /* Alle Balken kleben an derselben Stelle. Der spätere liegt im Code weiter unten und damit obenauf. */
  .or-balken { position: sticky; top: var(--kopf-h, 98px); scroll-margin-top: var(--kopf-h, 98px); z-index: 31; display: flex; align-items: stretch; min-height: 48px;
    border: 1px solid var(--line); border-radius: 10px; background: var(--card); box-shadow: 0 3px 10px rgba(0, 0, 0, .16); overflow: hidden; }
  .or-balken::before { content: ''; position: absolute; left: 8px; top: 12px; bottom: 12px; width: 3px; border-radius: 2px; background: var(--brand); }
  .or-kopf { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 18px; border: none; background: none; color: var(--ink); font: inherit; font-size: calc(15px * var(--schrift, 1)); font-weight: 800; text-align: left; cursor: pointer; }
  .or-kopf:disabled { cursor: default; opacity: 1; }
  .or-pfeil { flex: none; display: inline-block; width: 16px; color: var(--muted); font-size: calc(18px * var(--schrift, 1)); transition: transform 0.2s; }
  .or-pfeil.auf { transform: rotate(90deg); }
  .or-name { flex: 1; min-width: 0; }
  .or-anz { flex: none; color: var(--muted); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; font-variant-numeric: tabular-nums; }
  .or-inhalt { padding: 4px 0 14px; }
  .or-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  @media (max-width: 520px) {
    .or-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    /* Mit großer Schrift passen zwei Kacheln nicht nebeneinander (darstellung.js entscheidet) */
    :global(html[data-eine-spalte]) .or-grid { grid-template-columns: minmax(0, 1fr); }
  }
</style>
