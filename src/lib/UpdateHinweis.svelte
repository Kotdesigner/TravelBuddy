<script>
  // Fenster „Großes Update“, erscheint einmal nach dem Update (siehe update-hinweis.js).
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { UPDATE_VERSION, updateGesehen } from './update-hinweis.js'

  let { onfertig = () => {}, onhandbuch = null } = $props()

  const NEU = [
    ['🗺️', je('Echte Karten überall.', 'Real maps everywhere.'), je('Orte, Routen-Ideen und Wanderungen auf der Offline-Karte mit Grenzen, Highways und Parks. Mit zwei Fingern zoomen, heraus bis ganz Australien.', 'Places, route ideas and hikes on the offline map with borders, highways and parks. Zoom with two fingers, out to all of Australia.')],
    ['🔢', je('Karte je Gegend.', 'A map for every area.'), je('Nummern wie auf den Kacheln, ein kleines Australien zeigt, wo du gerade bist.', 'Numbers match the tiles, a small Australia shows where you are.')],
    ['🛣️', je('Routen-Ideen auf echten Straßen.', 'Route ideas on real roads.'), je('Kräftige Farben, Stopps mit Nummer, Orte an der Strecke zum Antippen.', 'Strong colours, numbered stops, places along the way to tap.')],
    ['🏠', je('Etappenorte.', 'Stopover towns.'), je('Städte zum Tanken, Einkaufen und Übernachten, mit Versorgung, auch an der Ostküste.', 'Towns for fuel, shopping and the night, with supplies, on the East Coast too.')],
    ['🥾', je('Gut 20 Wander-Ideen.', 'Over 20 hike ideas.'), je('Mit Karte und Sommersperren, für die Wunschliste oder gleich in die Route.', 'With a map and summer closures, for your wish list or straight into a route.')],
    ['🌗', je('Karten hell oder dunkel.', 'Light or dark maps.'), je('Unter Design, die große Karte auch direkt mit ◐.', 'Under Design, the big map also right on the map with ◐.')],
    ['📍', je('149 Orte.', '149 places.'), je('Neu sind Hutt Lagoon, der Super Pit und das Space Museum in Carnarvon. Inseln zeigen die Anreise.', 'New: Hutt Lagoon, the Super Pit and the space museum in Carnarvon. Islands show how to get there.')],
    ['⚡', je('Schneller und genauer.', 'Faster and more accurate.'), je('Ortskacheln bis zu sechsmal so schnell, Kilometer nicht mehr doppelt gezählt, Wetter an der Strecke mit zweitem Dienst.', 'Place tiles up to six times as fast, kilometres no longer counted twice, route weather with a second service.')],
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
  <p class="uh-einl">{je('TravelBuddy hat echte Karten, mehr Orte und ist schneller geworden. Deine Reise, dein Logbuch und deine Orte sind alle noch da.', 'TravelBuddy has real maps, more places and got faster. Your trip, your logbook and your places are all still there.')}</p>
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
