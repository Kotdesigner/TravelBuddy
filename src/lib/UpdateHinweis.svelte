<script>
  // Fenster „Großes Update“, erscheint einmal nach dem Update (siehe update-hinweis.js).
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { UPDATE_VERSION, updateGesehen } from './update-hinweis.js'

  let { onfertig = () => {}, onhandbuch = null } = $props()

  const NEU = [
    ['🗺️', je('Orte mit Gesamtkarte.', 'Places with an overview map.'), je('Jede Gegend ist ein Ring, ein Tipp klappt sie auf.', 'Every area is a ring, one tap opens it.')],
    ['🔢', je('Karte je Gegend.', 'A map for every area.'), je('Nummern auf der Karte wie auf den Kacheln, Kurzinfo darunter.', 'Numbers on the map match the tiles, with a short card below.')],
    ['🔍', je('Selbst zoomen.', 'Zoom yourself.'), je('Mit + und −, zwei Fingern oder Strg und Mausrad.', 'With + and −, two fingers or Ctrl and the mouse wheel.')],
    ['⛴️', je('Inseln mit Anreise.', 'Islands with how to get there.'), je('Etwa die Fähre nach Rottnest, dazu der Abstand zu deiner Route.', 'For example the ferry to Rottnest, plus the distance to your route.')],
    ['🥾', je('Gut 20 Wander-Ideen.', 'Over 20 hike ideas.'), je('Mit Sommersperren, für die Wunschliste oder gleich in die Route.', 'With summer closures, for your wish list or straight into a route.')],
    ['🛣️', je('Routen-Ideen neu.', 'Route ideas, new look.'), je('Nebeneinander auf der Karte, jede zum Aufklappen.', 'Side by side on the map, each one folds open.')],
    ['🌍', je('Weltkugel aufgeräumt.', 'A tidier globe.'), je('Abspielen, Film und Einstellungen in einem Menü.', 'Play, film and settings in one menu.')],
    ['⚡', je('Schneller.', 'Faster.'), je('Die Ortskacheln bauen sich bis zu sechsmal so schnell auf.', 'Place tiles build up to six times as fast.')],
  ]

  function zu() { updateGesehen(); onfertig() }
  function handbuch() { updateGesehen(); onfertig(); onhandbuch?.() }
</script>

<div class="uh-hg" data-dialog-hg aria-hidden="true" onclick={zu}></div>
<div class="uh" role="dialog" aria-labelledby="uh-titel" use:modal={{ onclose: zu, fokus: '.uh-los' }}>
  <div class="uh-griff" aria-hidden="true"></div>
  <div class="uh-kopf">
    <span class="uh-symbol" aria-hidden="true">✨</span>
    <div>
      <h2 id="uh-titel">{je('Großes Update', 'Big update')}</h2>
      <p class="uh-ver">TravelBuddy Basic {UPDATE_VERSION}</p>
    </div>
  </div>
  <p class="uh-einl">{je('TravelBuddy hat viele neue Seiten und ist schneller geworden. Deine Reise, dein Logbuch und deine Orte sind alle noch da.', 'TravelBuddy has lots of new pages and got faster. Your trip, your logbook and your places are all still there.')}</p>
  <ul class="uh-liste">
    {#each NEU as [zeichen, titel, text]}
      <li><span class="uh-z" aria-hidden="true">{zeichen}</span><span><b>{titel}</b> <span class="uh-t">{text}</span></span></li>
    {/each}
  </ul>
  <div class="uh-knoepfe">
    {#if onhandbuch}<button class="bedien-knopf" onclick={handbuch}>{je('Mehr im Handbuch', 'More in the manual')}</button>{/if}
    <button class="bedien-knopf haupt uh-los" onclick={zu}>{je('Los geht’s', 'Let’s go')}</button>
  </div>
</div>

<style>
  .uh-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); animation: uh-blende 0.2s ease-out; }
  .uh { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(380px, calc(100% - 28px)); max-height: calc(100dvh - 40px); overflow-y: auto; padding: 18px 18px 16px;
    border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); box-shadow: 0 22px 50px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.25); animation: uh-auf 0.24s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .uh-griff { width: 36px; height: 4px; border-radius: 2px; background: var(--line-stark); margin: -6px auto 12px; }
  .uh-kopf { display: flex; align-items: center; gap: 12px; }
  .uh-symbol { width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--brand); display: flex; align-items: center; justify-content: center; font-size: calc(22px * var(--schrift, 1)); }
  .uh h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .uh-ver { margin: 2px 0 0; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; }
  .uh-einl { margin: 12px 0; color: var(--muted); font-size: calc(14px * var(--schrift, 1)); line-height: 1.5; }
  .uh-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .uh-liste li { display: flex; gap: 10px; align-items: flex-start; font-size: calc(14px * var(--schrift, 1)); line-height: 1.45; }
  .uh-z { flex: none; width: 24px; text-align: center; }
  .uh-t { color: var(--muted); }
  .uh-knoepfe { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
  @keyframes uh-auf { from { opacity: 0; transform: translate(-50%, -46%) scale(0.97); } to { opacity: 1; transform: translate(-50%, -50%); } }
  @keyframes uh-blende { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .uh, .uh-hg { animation: none; } }
</style>
