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
  /** Basic 1.38: was seit dem letzten Fenster (1.36) dazugekommen ist, steht oben */
  const JETZT = [
    ['🔁', je('Buchungen ändern, umbuchen, stornieren.', 'Change, rebook or cancel bookings.'), je('Fliegst du anders zurück oder sagt die Tour ab? An jeder Buchung steht jetzt „Ändern“: Strecke, Airline, Flugnummern, Datum und Zeiten berichtigen, mit einer neuen Mail umbuchen, stornieren oder ganz löschen. Heute, Kalender, Etappe, Flüge und Kosten ziehen mit.', 'Flying home differently, or the tour is off? Every booking now has “Change”: correct the route, airline, flight numbers, dates and times, rebook from a new email, cancel it or delete it. Today, calendar, leg, flights and costs follow along.')],
    ['✈️', je('Keine alte Flugnummer mehr.', 'No more old flight numbers.'), je('Änderst du die Flugnummer, verschwindet die alte wirklich. Vorher blieb sie als Geister-Anschlussflug stehen und wurde weiter abgefragt.', 'When you change a flight number, the old one really goes away. Before it stayed on as a ghost connecting flight and was still being checked.')],
    ['🚫', je('Storniert heißt nicht gelöscht.', 'Cancelled is not deleted.'), je('Eine stornierte Buchung bleibt grau stehen, damit du siehst, was gebucht war. Aus Heute, Kalender und der Flugabfrage ist sie raus. Bei den Kosten trägst du ein, was du zurückbekommst. Voll erstattet zählt nicht mehr mit.', 'A cancelled booking stays, greyed out, so you can see what was booked. It is out of Today, the calendar and the flight lookup. Under costs you note what you get back. Fully refunded no longer counts.')],
    ['🗑', je('Auch Buchungen aus dem Reiseplan löschen.', 'Delete bookings from the trip plan too.'), je('Früher ließen sich nur selbst eingefügte Buchungen löschen. Jetzt jede, und sie kommt auch nach einem neuen Import nicht zurück.', 'Previously you could only delete bookings you added yourself. Now any of them, and they stay gone even after a new import.')],
    ['🧹', je('Ruhiger geworden.', 'Calmer now.'), je('Der Spenden-Knopf unten auf der Seite und unter Mehr ist weg. TravelBuddy bleibt kostenlos und ohne Werbung.', 'The donate button at the bottom of the page and under More is gone. TravelBuddy stays free and without ads.')],
  ]
  const NEU = [
    ['🔄', je('Runterziehen zum Aktualisieren.', 'Pull down to update.'), je('Wie in anderen Apps: ganz oben auf einer Seite nach unten ziehen und loslassen. TravelBuddy holt die neueste Fassung und lädt neu. Jedes Mal schaut eine andere Figur vorbei: Känguru, Koala, Bumerang, Camper, Sonne über dem Uluru oder Schlange. Hast du gerade etwas nicht gespeichert, fragt die App vorher.', 'Like in other apps: pull down at the very top of a page and let go. TravelBuddy fetches the newest version and reloads. Each time a different figure drops by: kangaroo, koala, boomerang, camper, sun over Uluru or snake. If you have unsaved changes, the app asks first.')],
    ['🆘', je('SOS an deine Leute.', 'SOS to your people.'), je('Auf Heute oben SOS tippen oder unter Notfall „SOS an meine Leute“, dann „SOS jetzt senden“: Alarm mit Standort als SMS an alle, auch ohne Internet, danach WhatsApp. Am iPhone und Mac auf Wunsch ganz ohne Tipp auf Senden, über einen Kurzbefehl. Am Android wählst du einmal WhatsApp oder WhatsApp Business. Und: 7× schnell irgendwo auf eine freie Fläche tippen ruft 000.', 'Tap SOS at the top of Today or “SOS to my people” under Emergency, then “Send SOS now”: an alert with your location as a text to everyone, even without internet, then WhatsApp. On iPhone and Mac optionally without tapping Send at all, via a shortcut. On Android you choose WhatsApp or WhatsApp Business once. And: tapping 7 times quickly on any empty area calls 000.')],
    ['👨‍👩‍👧', je('Deinen Leuten Bescheid geben.', 'Let your people know.'), je('Unter Notfall Mama, Papa oder deine Partnerin anlegen. Dann öffnet ein Tipp „Mir geht\'s gut“ oder deinen Standort als fertige SMS, WhatsApp oder beides, per SMS auch ohne Internet. Am Tagesziel fragt Heute: angekommen?', 'Under Emergency add your mum, dad or partner. Then one tap opens “I\'m okay” or your location as a finished SMS, WhatsApp or both, by SMS even without internet. At your destination Today asks: arrived?')],
    ['📣', je('Meldungen für andere Reisende.', 'Reports for other travellers.'), je('Weg nicht passierbar, viele Delfine, Diesel leer: melden mit einem Satz, auch im Funkloch. Andere sehen es an ihrer Route, an der Ortskachel und auf Heute. Liegt etwas auf deinem Weg, klappt der Abschnitt dort von selbst auf. Gilt 3 Tage, „Stimmt noch“ verlängert.', 'Road not passable, lots of dolphins, no diesel: report it in one sentence, even without signal. Others see it on their route, on the place card and on Today. If something is on your way, the section there opens by itself. Valid for 3 days, “Still true” extends it.')],
    ['🤝', je('Unterwegs verbinden.', 'Connect on the road.'), je('Unter Mehr: dein Kontakt-Code zum Scannen. Wer ihn scannt, schreibt dir direkt in Telegram, Signal oder WhatsApp. Kontakte von unterwegs merkt sich die App mit Ort und Datum. Kein Server, nichts verlässt dein Gerät ungefragt.', 'Under More: your contact code to scan. Whoever scans it can message you straight away on Telegram, Signal or WhatsApp. The app remembers contacts from the road with place and date. No server, nothing leaves your device unasked.')],
    ['📤', je('Orte und Routen teilen.', 'Share places and routes.'), je('Als Link oder Code. Der andere übernimmt sie mit einem Tipp in seine App. Logbuch, Kosten und Buchungen bleiben bei dir.', 'As a link or code. The other person adds them to their app with one tap. Logbook, costs and bookings stay with you.')],
    ['👥', je('TravelBuddy-Gruppe auf Telegram.', 'TravelBuddy group on Telegram.'), je('Auf Heute unter Mit anderen Reisenden: Gespräch, Fragen und Fotos mit anderen unterwegs. Betreut von TravelBuddy, ohne Telefonnummer möglich.', 'On Today under With other travellers: chat, questions and photos with others on the road. Run by TravelBuddy, works without showing your phone number.')],
    ['🛣️', je('Routen ohne Netz, auf echten Straßen.', 'Routes without internet, on real roads.'), je('Die App rechnet selbst, Fahrzeit auf Asphalt im Mittel 0,9 % neben online. Mit Netz übernimmt sie die Online-Werte von selbst.', 'The app calculates by itself, driving time on sealed roads 0.9 % off online on average. Online, it takes over the online values by itself.')],
    ['🪨', je('Pisten-Netz je Gebiet.', 'Track network per area.'), je('Auch Schotter, Pisten und 4WD-Tracks, bis Steep Point oder Israelite Bay. Laden unter Plan, Karte, Offline-Routen.', 'Gravel, unsealed roads and 4WD tracks too, out to Steep Point or Israelite Bay. Load it under Plan, Map, Offline routes.')],
    ['🚙', je('2WD oder 4WD.', '2WD or 4WD.'), je('Bei der Einrichtung einmal wählen, an jeder Route umstellbar. Mit 4WD nimmt die App Pisten wie geplant: Mount Augustus bis Tom Price 346 statt 687 km. Ohne bleiben Fernstrecken auf Asphalt.', 'Choose once during setup, switch on any route. With 4WD the app takes tracks as planned: Mount Augustus to Tom Price 346 instead of 687 km. Without, long drives stay on sealed roads.')],
    ['⛔', je('Sperrungen umfahren.', 'Around road closures.'), je('Meldet Main Roads WA eine gesperrte Straße, etwa nach Unwetter oder bei überflutetem Floodway, fragt die App nach einer Umleitung. Auch ohne Netz.', 'When Main Roads WA reports a closed road, for example after a storm or a flooded floodway, the app offers a detour. Offline too.')],
    ['🧭', je('Neue Einrichtung in 12 Schritten.', 'New setup in 12 steps.'), je('Design, Fahrzeug, erste Route, Vorabausgaben statt Buchungen und zum Schluss „Bereit für unterwegs?“. Hinter jedem i steht, was worauf aufbaut. Unter Mehr, Einführung noch einmal.', 'Design, vehicle, first route, expenses before the trip instead of bookings, and finally “Ready for the road?”. Behind every i: what builds on what. Under More, Show the introduction again.')],
    ['📋', je('Updates nachlesen.', 'Read the updates.'), je('Was neu ist, steht jetzt immer unter Mehr, App und Einstellungen, Updates.', 'What’s new is now always under More, App and settings, Updates.')],
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
      <h2 id="uh-titel">{je('Das ist neu', 'What’s new')}</h2>
      <p class="uh-ver">{UPDATE_NAME}</p>
    </div>
  </div>
  <ul class="uh-liste uh-jetzt">
    {#each JETZT as [zeichen, titel, text]}
      <li><span class="uh-z" aria-hidden="true">{zeichen}</span><span><b>{titel}</b> <span class="uh-t">{text}</span></span></li>
    {/each}
  </ul>
  <h3 class="uh-zwischen">{je('Schon länger dabei', 'Already there for a while')}</h3>
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
  .uh-liste.uh-jetzt { margin: 14px 0 4px; padding: 12px 12px 12px 8px; border-radius: 12px; background: var(--flaeche); border: 1px solid var(--line); }
  .uh-zwischen { margin: 14px 0 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .uh-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .uh-liste li { display: flex; gap: 10px; align-items: flex-start; font-size: calc(14px * var(--schrift, 1)); line-height: 1.45; }
  .uh-z { flex: none; width: 24px; text-align: center; }
  .uh-t { color: var(--muted); }
  .uh-knoepfe { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
  @keyframes uh-auf { from { opacity: 0; transform: translate(-50%, -46%) scale(0.97); } to { opacity: 1; transform: translate(-50%, -50%); } }
  @keyframes uh-blende { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .uh, .uh-hg { animation: none; } }
</style>
