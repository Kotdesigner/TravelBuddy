<script>
  // Fenster „Großes Update“: einmal nach dem Update (siehe update-hinweis.js) und jederzeit über
  // Mehr, „Updates“. Oben die Zahlen zur Offline-Berechnung (gemessen 7.11., tests/offline-routing),
  // darunter was neu ist. Dieselbe Datei in der eigenen App und in der Basic.
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { UPDATE_NAME, updateGesehen } from './update-hinweis.js'

  let { onfertig = () => {}, onhandbuch = null } = $props()

  const ZAHLEN = [
    [je('0,4 %', '0.4 %'), je('Kilometer auf Asphalt, neben online', 'km on sealed roads, off online')],
    [je('22 von 22', '22 of 22'), je('Teststrecken gefunden, auch Pisten und Tracks', 'test routes found, tracks too')],
    [je('0,06 s', '0.06 s'), je('für 4.200 km mit 10 Stopps', 'for 4,200 km with 10 stops')],
  ]
  const NEU = [
    ['🛣️', je('Routen ohne Netz, auf echten Straßen.', 'Routes without internet, on real roads.'), je('Die App rechnet selbst, Fahrzeit auf Asphalt im Mittel 0,9 % neben online. Mit Netz übernimmt sie die Online-Werte von selbst.', 'The app calculates by itself, driving time on sealed roads 0.9 % off online on average. Online, it takes over the online values by itself.')],
    ['🪨', je('Pisten-Netz je Gebiet.', 'Track network per area.'), je('Auch Schotter, Pisten und 4WD-Tracks, bis Steep Point oder Israelite Bay. Laden unter Plan, Karte, Offline-Routen.', 'Gravel, unsealed roads and 4WD tracks too, out to Steep Point or Israelite Bay. Load it under Plan, Map, Offline routes.')],
    ['🚙', je('2WD oder 4WD.', '2WD or 4WD.'), je('Bei der Einrichtung einmal wählen, an jeder Route umstellbar. Mit 4WD nimmt die App Pisten wie geplant: Mount Augustus bis Tom Price 346 statt 687 km. Ohne bleiben Fernstrecken auf Asphalt.', 'Choose once during setup, switch on any route. With 4WD the app takes tracks as planned: Mount Augustus to Tom Price 346 instead of 687 km. Without, long drives stay on sealed roads.')],
    ['⛔', je('Sperrungen umfahren.', 'Around road closures.'), je('Meldet Main Roads WA eine gesperrte Straße, etwa nach Unwetter oder bei überflutetem Floodway, fragt die App nach einer Umleitung. Auch ohne Netz.', 'When Main Roads WA reports a closed road, for example after a storm or a flooded floodway, the app offers a detour. Offline too.')],
    ['🧭', je('Neue Einrichtung in 12 Schritten.', 'New setup in 12 steps.'), je('Design, Fahrzeug, erste Route, Vorabausgaben statt Buchungen und zum Schluss „Bereit für unterwegs?“. Hinter jedem i steht, was worauf aufbaut. Unter Mehr, Einführung noch einmal.', 'Design, vehicle, first route, expenses before the trip instead of bookings, and finally “Ready for the road?”. Behind every i: what builds on what. Under More, Show the introduction again.')],
    ['📋', je('Updates nachlesen.', 'Read the updates.'), je('Was neu ist, steht jetzt immer unter Mehr, Updates.', 'What’s new is now always under More, Updates.')],
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
      <h2 id="uh-titel">{je('Das größte Update', 'The biggest update')}</h2>
      <p class="uh-ver">{UPDATE_NAME}</p>
    </div>
  </div>
  <p class="uh-einl">{je('TravelBuddy rechnet deine Routen jetzt auch ohne Netz, auf echten Straßen und fast so genau wie online. Deine Reise, dein Logbuch und deine Orte sind alle noch da.', 'TravelBuddy now calculates your routes without internet too, on real roads and almost as accurately as online. Your trip, your logbook and your places are all still there.')}</p>
  <div class="uh-zahlen">
    {#each ZAHLEN as [zahl, was]}<div class="uh-zahl"><b>{zahl}</b><span>{was}</span></div>{/each}
  </div>
  <p class="uh-quelle">{je('Gemessen an 22 Strecken mit 19.289 km in WA, um Melbourne und in Queensland.', 'Measured on 22 routes with 19,289 km in WA, around Melbourne and in Queensland.')}</p>
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
  .uh { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(400px, calc(100% - 28px)); max-height: calc(100dvh - 40px); overflow-y: auto; padding: 18px 18px 16px;
    border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); box-shadow: 0 22px 50px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.25); animation: uh-auf 0.24s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .uh-griff { width: 36px; height: 4px; border-radius: 2px; background: var(--line-stark); margin: -6px auto 12px; }
  .uh-kopf { display: flex; align-items: center; gap: 12px; }
  .uh-symbol { width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--brand); display: flex; align-items: center; justify-content: center; font-size: calc(22px * var(--schrift, 1)); }
  .uh h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .uh-ver { margin: 2px 0 0; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; }
  .uh-einl { margin: 12px 0 10px; color: var(--muted); font-size: calc(14px * var(--schrift, 1)); line-height: 1.5; }
  .uh-zahlen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .uh-zahl { display: flex; flex-direction: column; gap: 3px; padding: 10px 8px; border-radius: 12px; background: var(--flaeche); border: 1px solid var(--line); }
  .uh-zahl b { font-size: calc(16.5px * var(--schrift, 1)); color: var(--brand-text); line-height: 1.1; white-space: nowrap; }
  .uh-zahl span { font-size: calc(11.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.3; }
  .uh-quelle { margin: 6px 0 12px; color: var(--muted); font-size: calc(11.5px * var(--schrift, 1)); line-height: 1.4; }
  .uh-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .uh-liste li { display: flex; gap: 10px; align-items: flex-start; font-size: calc(14px * var(--schrift, 1)); line-height: 1.45; }
  .uh-z { flex: none; width: 24px; text-align: center; }
  .uh-t { color: var(--muted); }
  .uh-knoepfe { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
  @keyframes uh-auf { from { opacity: 0; transform: translate(-50%, -46%) scale(0.97); } to { opacity: 1; transform: translate(-50%, -50%); } }
  @keyframes uh-blende { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .uh, .uh-hg { animation: none; } }
</style>
