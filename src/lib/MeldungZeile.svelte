<script>
  // Eine Meldung als Zeile (Heute, Route, Ortskachel, Liste). Tippen öffnet sie (meldungAuf).
  import { je } from './i18n.js'
  import { ART, artName, alter } from './meldungen-text.js'
  import { blass } from './meldungen-regeln.js'
  import { meldungAuf } from './meldungen-text.js'

  let { m, km = null, ort = false } = $props()
</script>

<button class="mz" class:blass={blass(m)} onclick={() => meldungAuf.set({ id: m.id })}>
  {#if km != null}<span class="mz-km">km {km}</span>{/if}
  <span class="mz-t">
    <span class="mz-art mz-{m.art}">{ART[m.art]?.icon} {artName(m.art)}</span>
    <span class="mz-text">{m.text}</span>
    <small>{[ort && m.ort, m.name || je('Reisende/r', 'Traveller'), alter(m.erstellt), m.ja ? je(`${m.ja}× bestätigt`, `confirmed ${m.ja}×`) : '', blass(m) ? je('wohl nicht mehr aktuell', 'probably outdated') : ''].filter(Boolean).join(' · ')}</small>
  </span>
  <span class="mz-pfeil" aria-hidden="true">›</span>
</button>

<style>
  .mz { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 0; border: none; border-top: 1px solid var(--line); background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
  .mz.blass { opacity: 0.55; }
  .mz-km { flex: none; width: 52px; text-align: right; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; color: var(--muted); padding-top: 2px; }
  .mz-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .mz-art { align-self: flex-start; font-size: calc(11.5px * var(--schrift, 1)); font-weight: 800; padding: 2px 8px; border-radius: 999px; background: var(--flaeche); color: var(--brand-text); }
  .mz-weg { background: var(--danger-flaeche); color: var(--danger-text); }
  .mz-tanken, .mz-wetter { background: var(--warn-flaeche); color: var(--ink); }
  .mz-camping { background: var(--ok-flaeche); color: var(--ok-text); }
  .mz-text { font-size: calc(14.5px * var(--schrift, 1)); line-height: 1.45; }
  .mz-t small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .mz-pfeil { color: var(--muted); font-size: calc(20px * var(--schrift, 1)); }
</style>
