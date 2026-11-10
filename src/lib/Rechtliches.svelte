<script>
  // Mehr → Datenschutz & Impressum. Liegt in der App und geht deshalb auch offline.
  // Die Liste der Dienste muss zu dem passen, was die App wirklich anspricht.
  import { je, istEn } from './i18n.js'
  import { IMPRESSUM, impressumFertig } from './impressum.js'
  import { bildNachweis } from './bild-nachweis.js'
  import { zaehlungAus, browserWillNicht } from './zaehler.js'

  // Auf Englisch die Anzeigenamen aus orte.en.json, der deutsche Name bleibt Schlüssel
  let enNamen = $state({})
  if (istEn) fetch('/orte.en.json').then((r) => r.json()).then((d) => { enNamen = Object.fromEntries(Object.entries(d).filter(([, v]) => v.anzeigeName).map(([k, v]) => [k, v.anzeigeName])) }).catch(() => {})
  const fotos = $derived(Object.values($bildNachweis).map((f) => (enNamen[f.id] ? { ...f, name: enNamen[f.id] } : f)).sort((a, b) => a.name.localeCompare(b.name)))

  const DIENSTE = [
    [je('Wetter', 'Weather'), 'Open-Meteo', je('Koordinaten deiner Orte und Tagesstrecken im Logbuch und, wenn du es erlaubst, dein Standort', 'Coordinates of your places and logbook day routes and, if you allow it, your location')],
    [je('Wetter, wenn Open-Meteo ausfällt', 'Weather when Open-Meteo is down'), 'MET Norway', je('Koordinaten deiner Orte und, wenn du es erlaubst, dein Standort', 'Coordinates of your places and, if you allow it, your location')],
    [je('Amtliche Warnungen und Straßenlage', 'Official warnings and road conditions'), 'DFES WA, VicEmergency, Queensland Fire Department, Main Roads WA', je('Nur der Abruf, keine Eingaben', 'Only the request, none of your entries')],
    [je('Straßenrouten', 'Road routes'), 'OSRM', je('Koordinaten deiner Stopps und Tagesstrecken im Logbuch', 'Coordinates of your stops and logbook day routes')],
    [je('Orte suchen und beschreiben, Fun Facts', 'Searching and describing places, fun facts'), 'Photon, Nominatim, Overpass, Wikipedia, Wikidata, Wikimedia Commons', je('Suchbegriffe, Ortsnamen, Koordinaten, für Fun Facts die Koordinaten deiner Route und deines Standorts', 'Search terms, place names, coordinates, for fun facts the coordinates of your route and location')],
    [je('Wechselkurs', 'Exchange rate'), 'Frankfurter', je('Nur der Abruf', 'Only the request')],
    [je('Gelände auf der Karte', 'Terrain on the map'), 'Amazon S3 (Mapzen/AWS)', je('Der sichtbare Kartenausschnitt', 'The visible map area')],
    [je('Flüge, nur mit deinem Schlüssel', 'Flights, only with your key'), je('AeroDataBox über RapidAPI', 'AeroDataBox via RapidAPI'), je('Flugnummer, Datum, dein Schlüssel', 'Flight number, date, your key')],
    [je('Züge, nur bei eingetragenen Zügen', 'Trains, only if you add one'), 'DBF (dbf.finalrewind.org)', je('Name des Bahnhofs', 'Station name')],
    [je('Musik, nur wenn du sie einschaltest', 'Music, only if you turn it on'), 'Spotify, MusicBrainz, Last.fm', je('Region, Spotify-Anmeldung, Playlist', 'Region, Spotify sign-in, playlist')],
    [je('Karten-Links, nur beim Antippen', 'Map links, only when tapped'), 'Google Maps, Apple Karten', je('Die Position im Link', 'The position in the link')],
  ]
</script>

<article class="re">
  <section>
    <h2>{je('Impressum', 'Legal notice')}</h2>
    {#if impressumFertig()}
      <p>{IMPRESSUM.name}<br>{IMPRESSUM.strasse}<br>{IMPRESSUM.ort}<br>{IMPRESSUM.land}</p>
      <p>{je('E-Mail', 'Email')}: <a href="mailto:{IMPRESSUM.email}">{IMPRESSUM.email}</a></p>
    {:else}
      <p>{je('Kontakt', 'Contact')}: <a href="https://github.com/Kotdesigner/TravelBuddy/issues" target="_blank" rel="noopener">GitHub</a></p>
    {/if}
    <p>{je('TravelBuddy ist ein privates, kostenloses Projekt ohne Werbung. Die Angaben in der App ersetzen keine amtlichen Warnungen. Im Notfall gilt 000.', 'TravelBuddy is a private, free project without ads. Nothing in the app replaces official warnings. In an emergency, call 000.')}</p>
  </section>

  <section>
    <h2>{je('Datenschutz', 'Privacy')}</h2>
    <p>{je('Verantwortlich ist der oben genannte Anbieter. TravelBuddy hat kein Konto, keine Werbung, keine Cookies und keinen eigenen Server für deine Daten. Gezählt wird nur, wie oft die App geöffnet wird, ohne dass du dabei erkennbar bist.', 'The provider named above is responsible. TravelBuddy has no account, no ads, no cookies and no server of its own for your data. The only thing counted is how often the app is opened, without identifying you.')}</p>

    <h3>{je('Deine Daten bleiben auf dem Gerät', 'Your data stays on your device')}</h3>
    <p>{je('Reisen, Logbuch, Fotos, Kosten, Dokumente und Einstellungen liegen nur im Speicher deines Browsers oder der App. Der Anbieter sieht davon nichts. Ein Backup entsteht nur, wenn du es selbst auslöst. Den Standort nutzt die App nur, wenn du es erlaubst.', 'Trips, logbook, photos, costs, documents and settings are kept only in the storage of your browser or the app. The provider sees none of it. A backup is only made when you start one. The app only uses your location if you allow it.')}</p>

    <h3>{je('Hosting', 'Hosting')}</h3>
    <p>{je('Die Web-App liegt bei Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, USA. Beim Abruf verarbeitet Netlify technisch nötige Daten wie IP-Adresse, Zeitpunkt, Browsertyp und abgerufene Datei. Das dient dem sicheren Betrieb der Seite, Art. 6 Abs. 1 lit. f DSGVO. Dabei können Daten in die USA gelangen.', 'The web app is hosted by Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, USA. When you open it, Netlify processes technically necessary data such as IP address, time, browser type and requested file. This serves the secure operation of the site, Art. 6(1)(f) GDPR. Data may be transferred to the USA.')}</p>

    <h3>{je('Anonyme Zählung der App-Starts', 'Anonymous count of app starts')}</h3>
    <p>{je('Damit der Anbieter weiß, wie viele Menschen TravelBuddy nutzen, meldet die Web-App beim Öffnen und alle fünf Minuten, solange sie offen ist, ein kurzes „geöffnet“ an GoatCounter (goatcounter.com, betrieben von Martin Tournoij in Irland, Server bei Hetzner in Finnland und Deutschland). Die Meldung enthält nur den Namen „app“: keine Inhalte, keine Orte, kein Cookie. GoatCounter sieht dabei technisch deine IP-Adresse und deinen Browser, speichert die IP-Adresse aber nicht und leitet daraus nur Land, Browser, System und Sprache ab, zusammengefasst und ohne Bezug zu einzelnen Personen. Der Anbieter sieht nur Zahlen, nie wer du bist. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.', 'So the provider knows how many people use TravelBuddy, the web app sends a short “opened” to GoatCounter (goatcounter.com, run by Martin Tournoij in Ireland, servers at Hetzner in Finland and Germany) when it starts and every five minutes while it is open. The message only contains the name “app”: no content, no places, no cookie. GoatCounter technically sees your IP address and browser, but does not store the IP address and only derives country, browser, system and language from them, in aggregate and without linking them to a person. The provider only sees numbers, never who you are. Legal basis is Art. 6(1)(f) GDPR.')}</p>
    <p>{je('Offline wird nichts gezählt und nichts nachgeholt. Sendet dein Browser „Do Not Track“ oder „Global Privacy Control“, zählt die App gar nicht.', 'Nothing is counted offline and nothing is sent later. If your browser sends “Do Not Track” or “Global Privacy Control”, the app does not count at all.')}</p>
    {#if browserWillNicht()}
      <p class="re-stand">{je('Dein Browser möchte nicht gezählt werden. Daran hält sich die App.', 'Your browser asks not to be counted. The app respects that.')}</p>
    {:else}
      <label class="re-schalter"><input type="checkbox" checked={!$zaehlungAus} onchange={(e) => zaehlungAus.set(!e.currentTarget.checked)}> {je('Anonyme Zählung auf diesem Gerät erlauben', 'Allow the anonymous count on this device')}</label>
      {#if $zaehlungAus}<p class="re-stand">{je('Ausgeschaltet. Dieses Gerät wird nicht mehr gezählt.', 'Turned off. This device is no longer counted.')}</p>{/if}
    {/if}

    <h3>{je('Fehler melden', 'Reporting a problem')}</h3>
    <p>{je('Nur wenn du über „Fehler melden“ ganz unten auf jeder Seite etwas abschickst, geht deine Meldung an eine Funktion bei Netlify (Netlify, Inc., Anschrift oben). Sie gibt die Meldung an den Mail-Dienst Resend (Resend, Inc., USA) weiter, der sie als E-Mail an den Anbieter schickt, in ein Postfach bei Microsoft. Dabei können Daten in die USA gelangen. Übertragen werden dein Text, deine Bildschirmfotos, freiwillig deine E-Mail-Adresse und die im Formular angezeigten Angaben: App-Version, Gerät, Browser, Sprache, Bildschirmgröße und die zuletzt offene Seite. Reisedaten, Logbuch, Orte und dein Standort gehen nicht mit. Die Meldung dient nur dazu, den Fehler zu finden und dir zu antworten (Art. 6 Abs. 1 lit. a und f DSGVO). Sie wird gelöscht, sobald sie erledigt ist, auf Wunsch auch sofort. Gegen Spam zählt die Funktion bei Netlify, wie viele Meldungen am Tag eingehen. Dafür speichert sie nicht deine IP-Adresse, sondern nur einen daraus berechneten, gekürzten Prüfwert (Hash), und löscht ihn am nächsten Tag. Achte darauf, dass auf deinen Bildschirmfotos nichts Privates zu sehen ist.', 'Only when you send something via “Report a problem” at the bottom of every page, your report goes to a function at Netlify (Netlify, Inc., address above). It passes the report to the mail service Resend (Resend, Inc., USA), which sends it as an email to the provider, into a Microsoft mailbox. Data may be transferred to the USA. It carries your text, your screenshots, your email address if you give it and the details shown in the form: app version, device, browser, language, screen size and the last page you had open. Trip data, logbook, places and your location are not sent. The report is only used to find the problem and to reply to you (Art. 6(1)(a) and (f) GDPR). It is deleted once it is dealt with, or straight away on request. To stop spam, the function at Netlify counts how many reports arrive per day. For this it does not store your IP address, only a shortened check value (hash) calculated from it, and deletes it the next day. Make sure your screenshots show nothing private.')}</p>

    <h3>{je('Quellcode und Downloads', 'Source code and downloads')}</h3>
    <p>{je('Der Quellcode und die Downloads liegen bei GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Beim Besuch der Seiten oder beim Herunterladen verarbeitet GitHub technische Daten und IP-Adressen nach eigenen Datenschutzbestimmungen.', 'The source code and downloads are hosted by GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. When you visit those pages or download a file, GitHub processes technical data and IP addresses under its own privacy terms.')}</p>

    <h3>{je('Website zur App', 'Website for the app')}</h3>
    <p>{je('Die Website kotdesigner.github.io/TravelBuddy liegt bei GitHub Pages (GitHub, Inc., USA). Beim Aufruf verarbeitet GitHub technisch nötige Daten wie IP-Adresse, Zeitpunkt und Browsertyp. Besuche zählt der Anbieter mit GoatCounter (goatcounter.com): ohne Cookies, ohne Speichern der IP-Adresse und ohne Profile. Erfasst werden nur aufgerufene Seite, Herkunftsseite, Browser, Bildschirmgröße und Land, zusammengefasst und ohne Bezug zu einzelnen Personen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.', 'The website kotdesigner.github.io/TravelBuddy is hosted on GitHub Pages (GitHub, Inc., USA). When you open it, GitHub processes technically necessary data such as IP address, time and browser type. The provider counts visits with GoatCounter (goatcounter.com): no cookies, no stored IP addresses and no profiles. It only records the page, the referring site, browser, screen size and country, in aggregate and without linking them to a person. Legal basis is Art. 6(1)(f) GDPR.')}</p>
    <p>{je('Instagram-Reels lädt die Website erst, wenn du sie antippst. Dann überträgt dein Browser Daten an Meta Platforms Ireland Ltd., und es gelten die Datenschutzbestimmungen von Meta.', 'The website loads Instagram reels only when you tap them. Your browser then sends data to Meta Platforms Ireland Ltd., and Meta’s privacy policy applies.')}</p>

    <h3>{je('Apps für Mac und Windows', 'Mac and Windows apps')}</h3>
    <p>{je('Die Apps laufen als lokale Anwendungen auf deinem Computer und senden keine Telemetrie-, Analyse- oder Nutzungsdaten an den Anbieter. Karten sind eingebaut. Für Live-Funktionen wie Wetter, Warnungen, Routen oder Flüge sprechen sie dieselben Dienste an wie die Web-App.', 'The apps run locally on your computer and send no telemetry, analytics or usage data to the provider. Maps are built in. For live features such as weather, warnings, routes or flights they contact the same services as the web app.')}</p>

    <h3>{je('Meldungen für andere Reisende', 'Reports for other travellers')}</h3>
    <p>{je('Wenn du eine Meldung abschickst, gehen Art, Text, der Name, den du angibst, und der Ort an eine Funktion bei Netlify (Netlify, Inc., Anschrift oben) und werden dort 3 Tage gespeichert, bei Bestätigungen höchstens eine Woche, danach gelöscht. Die Meldung ist für alle TravelBuddy-Nutzer sichtbar. Ist der TravelBuddy-Bot eingerichtet, wird sie zusätzlich über ihn in die TravelBuddy-Gruppe auf Telegram gestellt, dort gelten die Regeln von Telegram. Für die Spam-Grenze, die Stimmen und Hinweise auf Unpassendes speichert die Funktion keine IP-Adressen und keine Gerätekennungen, nur daraus mit einem geheimen Zufallswert berechnete, gekürzte Prüfwerte. Die Zählerstände der Spam-Grenze werden nach einer Stunde gelöscht, die Prüfwerte zu Stimmen und Hinweisen mit der Meldung. So zählt jede Stimme je Gerät und Netz nur einmal. Zurückziehen kannst du deine Meldung jederzeit unter Mehr, Meldungen, Meine. Unpassende Meldungen werden nach Hinweisen ausgeblendet und gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a und f DSGVO.', 'When you send a report, its type, text, the name you give and the location go to a function at Netlify (Netlify, Inc., address above) and are stored there for 3 days, with confirmations at most one week, then deleted. The report is visible to all TravelBuddy users. Once the TravelBuddy bot is set up, it is also posted through it to the TravelBuddy group on Telegram, where Telegram’s rules apply. For the spam limit, votes and reports of inappropriate content the function stores no IP addresses and no device IDs, only shortened check values calculated from them with a secret random value. The spam limit counters are deleted after an hour, the check values for votes and reports together with the report. This way each vote counts only once per device and network. You can withdraw your report at any time under More, Reports, Mine. Inappropriate reports are hidden and deleted after notices. Legal basis is Art. 6(1)(a) and (f) GDPR.')}</p>

    <h3>{je('Unterwegs verbinden, teilen und externe Gruppen', 'Connect on the road, sharing and external groups')}</h3>
    <p>{je('Dein Kontakt-Code, deine Kontakte von unterwegs und geteilte Orte oder Routen laufen über keinen Server des Anbieters. Die Angaben stecken nur im Code oder Link, den du selbst zeigst oder verschickst, und bleiben sonst auf deinem Gerät. Die Kamera nutzt die App nur beim Scannen, die Bilder werden nicht gespeichert. Tippst du auf Telegram, Signal, WhatsApp oder Discord, wechselst du zum jeweiligen Dienst. Dort gelten dessen Bedingungen und Datenschutzregeln, auch das Mindestalter.', 'Your contact code, your contacts from the road and shared places or routes do not pass through any server of the provider. The details are only in the code or link you show or send yourself and otherwise stay on your device. The app only uses the camera while scanning, and the images are not stored. When you tap Telegram, Signal, WhatsApp or Discord, you switch to that service. Its terms and privacy rules apply there, including the minimum age.')}</p>
    <p>{je('Die TravelBuddy-Gruppe auf Telegram betreut der oben genannte Anbieter. Die Nachrichten liegen bei Telegram, nicht beim Anbieter, und es gelten die Bedingungen und Datenschutzregeln von Telegram. Wer der Gruppe beitritt, ist für die anderen Mitglieder mit dem Telegram-Namen sichtbar, die Telefonnummer lässt sich in Telegram verbergen. Es gelten die angehefteten Gruppenregeln. Hinweise auf rechtswidrige Beiträge kannst du in der Gruppe den Admins oder über die Kontaktdaten oben melden, sie werden dann entfernt.', 'The TravelBuddy group on Telegram is run by the provider named above. The messages are stored by Telegram, not by the provider, and Telegram’s terms and privacy rules apply. When you join the group, other members can see your Telegram name, and you can hide your phone number in Telegram. The pinned group rules apply. You can report unlawful posts to the admins in the group or via the contact details above, and they will be removed.')}</p>
    <p>{je('Links zu anderen Gruppen, etwa auf Discord, führen zu externen Gruppen, die nicht vom Anbieter betrieben werden. Der Anbieter prüft deren Inhalte nicht und macht sie sich nicht zu eigen. Wird ein Link auf rechtswidrige Inhalte bekannt, wird er entfernt.', 'Links to other groups, for example on Discord, lead to external groups that are not run by the provider. The provider does not check their content and does not adopt it as their own. If a link is found to lead to unlawful content, it will be removed.')}</p>

    <h3>{je('Deinen Leuten Bescheid geben', 'Letting your people know')}</h3>
    <p>{je('Die wichtigen Personen, die du unter Notfall anlegst (Name, Rolle, Telefonnummer, SMS, WhatsApp oder beides), bleiben auf deinem Gerät und in deinem Backup. Die App überträgt sie an keinen Server. Tippst du auf „Mir geht\'s gut“ oder „Mein Standort senden“, öffnet sie deine SMS- oder WhatsApp-App mit der fertigen Nachricht. Gesendet wird erst, wenn du dort auf Senden tippst, über den jeweiligen Dienst und dessen Bedingungen. Trag nur Personen ein, die damit einverstanden sind.', 'The important people you add under Emergency (name, role, phone number, SMS, WhatsApp or both) stay on your device and in your backup. The app does not send them to any server. When you tap “I\'m okay” or “Send my location”, it opens your messages or WhatsApp app with the finished message. It is only sent when you tap Send there, through that service and under its terms. Only add people who agree to this.')}</p>
    <p>{je('SOS an deine Leute und „Direkt senden“ laufen genauso über dein Gerät: SOS öffnet die SMS- und WhatsApp-App mit dem fertigen Alarm. Hast du am iPhone oder Mac einen Kurzbefehl eingerichtet, übergibt TravelBuddy nur den Text an die App Kurzbefehle auf deinem Gerät, die ihn über Nachrichten an die Personen sendet, die du im Kurzbefehl gewählt hast. Kein Server von TravelBuddy ist beteiligt.', 'SOS to your people and “Send directly” also run on your device: SOS opens your messages and WhatsApp app with the finished alert. If you set up a shortcut on iPhone or Mac, TravelBuddy only hands the text to the Shortcuts app on your device, which sends it via Messages to the people you chose in the shortcut. No TravelBuddy server is involved.')}</p>

    <h3>{je('Dienste, die dein Gerät direkt anspricht', 'Services your device contacts directly')}</h3>
    <p>{je('Einige Funktionen holen Daten von fremden Diensten. Dabei sieht der jeweilige Dienst deine IP-Adresse und die genannten Angaben. Das ist nötig, damit die Funktion arbeitet (Art. 6 Abs. 1 lit. f DSGVO). Es gelten die Datenschutzregeln des Dienstes.', 'Some features fetch data from other services. Each one sees your IP address and the details listed. This is needed for the feature to work (Art. 6(1)(f) GDPR). The service’s own privacy rules apply.')}</p>
    <ul>
      {#each DIENSTE as [wofuer, wer, was]}
        <li><b>{wofuer}</b><span>{wer}</span><small>{was}</small></li>
      {/each}
    </ul>

    <h3>{je('Deine Rechte', 'Your rights')}</h3>
    <p>{je('Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch sowie auf Beschwerde bei einer Datenschutzbehörde. Der Anbieter speichert keine personenbezogenen Daten auf eigenen Servern, deine Nutzungsdaten liegen allein bei dir. Deine Daten in der App löschst du, indem du die App entfernst oder die Website-Daten im Browser löschst.', 'You have the right to access, rectification, erasure, restriction and objection, and to complain to a data protection authority. The provider stores no personal data on servers of its own, so your usage data stays with you. To delete your data in the app, remove the app or clear the site data in your browser.')}</p>
    <p>{je('Fremde Fotos, die du selbst zu einem Ort hinzufügst, bleiben auf deinem Gerät. Für ihre Nutzung bist du selbst verantwortlich.', 'Photos you add to a place yourself stay on your device. You are responsible for how you use them.')}</p>
    <p class="re-stand">{je('Stand: November 2026', 'As of November 2026')}</p>
  </section>

  <section id="quellen">
    <h2>{je('Quellen und Lizenzen', 'Sources and licences')}</h2>
    <p>{je('Wetterdaten als Ausweich von MET Norway (CC BY 4.0). Kartendaten © OpenStreetMap-Mitwirkende (ODbL), Kacheln Protomaps, Gelände Mapzen/AWS, Grenzen und Küsten Natural Earth. Wetter Open-Meteo. Das Titelbild ist ein eigenes Foto des Anbieters.', 'Backup weather data from MET Norway (CC BY 4.0). Map data © OpenStreetMap contributors (ODbL), tiles Protomaps, terrain Mapzen/AWS, borders and coasts Natural Earth. Weather Open-Meteo. The header picture is the provider’s own photo.')}</p>
    <p><a href="/lizenzen.txt" target="_blank" rel="noopener">{je('Lizenzen der Bibliotheken und Schriften', 'Licences of libraries and fonts')}</a></p>
    <details>
      <summary>{je('Alle {n} Ortsfotos mit Urheber und Lizenz', 'All {n} place photos with author and licence').replace('{n}', String(fotos.length))}</summary>
      <p>{je('Die Fotos sind für die App verkleinert. Symbolbilder zeigen die Region, nicht den genannten Ort.', 'The photos are resized for the app. Sample pictures show the region, not the place named.')}</p>
      <ul>
        {#each fotos as f (f.id)}
          <li><b>{f.name}</b><span><a href={f.seite} target="_blank" rel="noopener">{f.titel}</a></span><small>{f.autor}, {f.lizenz}{f.status === 'symbol' ? je(', Symbolbild', ', sample picture') : ''}</small></li>
        {/each}
      </ul>
    </details>
  </section>
</article>

<style>
  .re { display: flex; flex-direction: column; gap: 12px; }
  .re section { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 16px; box-shadow: var(--shadow); }
  .re h2 { margin: 0 0 8px; font-size: calc(19px * var(--schrift, 1)); }
  .re h3 { margin: 16px 0 4px; font-size: calc(15px * var(--schrift, 1)); }
  .re p { margin: 0 0 8px; font-size: calc(14.5px * var(--schrift, 1)); line-height: 1.5; }
  .re a { color: var(--brand-text); }
  .re ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .re li { display: flex; flex-direction: column; gap: 1px; padding-bottom: 8px; border-bottom: 1px solid var(--line); font-size: calc(14px * var(--schrift, 1)); }
  .re li small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .re-stand { color: var(--muted); }
  .re summary { min-height: 44px; display: flex; align-items: center; font-weight: 700; cursor: pointer; }
  .re li span { overflow-wrap: anywhere; }
  .re-schalter { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(14.5px * var(--schrift, 1)); font-weight: 600; cursor: pointer; }
  .re-schalter input { width: 22px; height: 22px; margin: 0; accent-color: var(--accent); flex: none; }
</style>
