<script>
  // V18: Bild „So hängt alles zusammen“: Reise → Etappen → Routen → (Nächte, Buchungen, Ausgaben) → Logbuch → Tagebuch.
  import { je } from './i18n.js'
  const STUFEN = [
    { icon: '🧭', titel: je('Reise', 'Trip'), text: je('Start und Dauer', 'start and length') },
    { icon: '🗓️', titel: je('Etappen', 'Legs'), text: je('Zeitabschnitte mit Datum', 'periods with dates') },
    { icon: '🛣️', titel: je('Routen', 'Routes'), text: je('Strecken mit Stopps', 'ways with stops') },
  ]
  const DAZU = [
    { icon: '🌙', titel: je('Nächte', 'Nights') },
    { icon: '🎫', titel: je('Buchungen', 'Bookings') },
    { icon: '💸', titel: je('Ausgaben', 'Expenses') },
  ]
  const ENDE = [
    { icon: '📖', titel: je('Logbuch', 'Logbook'), text: je('ein Eintrag je Tag', 'one entry per day') },
    { icon: '📚', titel: je('Tagebuch, Film, Bericht', 'Journal, film, report'), text: je('entstehen von selbst', 'made for you') },
  ]
</script>

<figure class="zh" aria-label={je('So hängt alles zusammen', 'How it all fits together')}>
  {#each STUFEN as s, i (s.titel)}
    <div class="zh-box"><span class="zh-i" aria-hidden="true">{s.icon}</span><b>{s.titel}</b><small>{s.text}</small></div>
    <span class="zh-pfeil" aria-hidden="true"></span>
  {/each}
  <div class="zh-reihe">
    {#each DAZU as d (d.titel)}<div class="zh-box zh-klein"><span class="zh-i" aria-hidden="true">{d.icon}</span><b>{d.titel}</b></div>{/each}
  </div>
  <p class="zh-hinweis">{je('über das Datum von selbst zugeordnet', 'matched by date, all by themselves')}</p>
  {#each ENDE as s (s.titel)}
    <span class="zh-pfeil" aria-hidden="true"></span>
    <div class="zh-box"><span class="zh-i" aria-hidden="true">{s.icon}</span><b>{s.titel}</b><small>{s.text}</small></div>
  {/each}
</figure>

<style>
  .zh { margin: 4px 0; display: flex; flex-direction: column; align-items: stretch; gap: 0; }
  .zh-box { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--flaeche); font-size: calc(14px * var(--schrift, 1)); }
  .zh-box b { font-weight: 800; color: var(--ink); }
  .zh-box small { margin-left: auto; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); text-align: right; }
  .zh-i { font-size: calc(17px * var(--schrift, 1)); }
  .zh-pfeil { align-self: center; width: 2px; height: 14px; background: var(--line-stark); position: relative; }
  .zh-pfeil::after { content: ''; position: absolute; left: 50%; bottom: -3px; width: 7px; height: 7px; border-right: 2px solid var(--line-stark); border-bottom: 2px solid var(--line-stark); transform: translateX(-50%) rotate(45deg); }
  .zh-reihe { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .zh-klein { flex-direction: column; gap: 2px; padding: 8px 4px; text-align: center; font-size: calc(13px * var(--schrift, 1)); }
  .zh-hinweis { margin: 4px 0 0; text-align: center; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }
</style>
