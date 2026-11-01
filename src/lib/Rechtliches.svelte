<script>
  // Mehr → Datenschutz & Impressum. Liegt in der App und geht deshalb auch offline.
  // Die Liste der Dienste muss zu dem passen, was die App wirklich anspricht.
  import { je } from './i18n.js'
  import { IMPRESSUM, impressumFertig } from './impressum.js'
  import { bildNachweis } from './bild-nachweis.js'

  const fotos = $derived(Object.values($bildNachweis).sort((a, b) => a.name.localeCompare(b.name)))

  const DIENSTE = [
    [je('Wetter', 'Weather'), 'Open-Meteo', je('Koordinaten deiner Orte und, wenn du es erlaubst, dein Standort', 'Coordinates of your places and, if you allow it, your location')],
    [je('Amtliche Warnungen und Straßenlage', 'Official warnings and road conditions'), 'DFES WA, VicEmergency, Queensland Fire Department, Main Roads WA', je('Nur der Abruf, keine Eingaben', 'Only the request, none of your entries')],
    [je('Straßenrouten', 'Road routes'), 'OSRM', je('Koordinaten deiner Stopps', 'Coordinates of your stops')],
    [je('Orte suchen und beschreiben', 'Searching and describing places'), 'Nominatim, Overpass, Wikipedia, Wikidata, Wikimedia Commons', je('Suchbegriffe, Ortsnamen, Koordinaten', 'Search terms, place names, coordinates')],
    [je('Wechselkurs', 'Exchange rate'), 'Frankfurter', je('Nur der Abruf', 'Only the request')],
    [je('Gelände auf der Karte', 'Terrain on the map'), 'Amazon S3 (Mapzen/AWS)', je('Der sichtbare Kartenausschnitt', 'The visible map area')],
    [je('Flüge, nur mit deinem Schlüssel', 'Flights, only with your key'), 'AeroDataBox über RapidAPI', je('Flugnummer, Datum, dein Schlüssel', 'Flight number, date, your key')],
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
    <p>{je('Verantwortlich ist der oben genannte Anbieter. TravelBuddy hat kein Konto, keine Werbung, kein Tracking und keinen eigenen Server für deine Daten.', 'The provider named above is responsible. TravelBuddy has no account, no ads, no tracking and no server of its own for your data.')}</p>

    <h3>{je('Deine Daten bleiben auf dem Gerät', 'Your data stays on your device')}</h3>
    <p>{je('Reisen, Logbuch, Fotos, Kosten, Dokumente und Einstellungen liegen nur im Speicher deines Browsers oder der App. Der Anbieter sieht davon nichts. Ein Backup entsteht nur, wenn du es selbst auslöst. Den Standort nutzt die App nur, wenn du es erlaubst.', 'Trips, logbook, photos, costs, documents and settings are kept only in the storage of your browser or the app. The provider sees none of it. A backup is only made when you start one. The app only uses your location if you allow it.')}</p>

    <h3>{je('Hosting', 'Hosting')}</h3>
    <p>{je('Die Web-App liegt bei Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, USA. Beim Abruf verarbeitet Netlify technisch nötige Daten wie IP-Adresse, Zeitpunkt, Browsertyp und abgerufene Datei. Das dient dem sicheren Betrieb der Seite, Art. 6 Abs. 1 lit. f DSGVO. Dabei können Daten in die USA gelangen.', 'The web app is hosted by Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, USA. When you open it, Netlify processes technically necessary data such as IP address, time, browser type and requested file. This serves the secure operation of the site, Art. 6(1)(f) GDPR. Data may be transferred to the USA.')}</p>

    <h3>{je('Quellcode und Downloads', 'Source code and downloads')}</h3>
    <p>{je('Der Quellcode und die Downloads liegen bei GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Beim Besuch der Seiten oder beim Herunterladen verarbeitet GitHub technische Daten und IP-Adressen nach eigenen Datenschutzbestimmungen.', 'The source code and downloads are hosted by GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. When you visit those pages or download a file, GitHub processes technical data and IP addresses under its own privacy terms.')}</p>

    <h3>{je('Apps für Mac und Windows', 'Mac and Windows apps')}</h3>
    <p>{je('Die Apps laufen als lokale Anwendungen auf deinem Computer und senden keine Telemetrie-, Analyse- oder Nutzungsdaten an den Anbieter. Karten sind eingebaut. Für Live-Funktionen wie Wetter, Warnungen, Routen oder Flüge sprechen sie dieselben Dienste an wie die Web-App.', 'The apps run locally on your computer and send no telemetry, analytics or usage data to the provider. Maps are built in. For live features such as weather, warnings, routes or flights they contact the same services as the web app.')}</p>

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
    <p>{je('Kartendaten © OpenStreetMap-Mitwirkende (ODbL), Kacheln Protomaps, Gelände Mapzen/AWS, Grenzen und Küsten Natural Earth. Wetter Open-Meteo. Das Titelbild ist ein eigenes Foto des Anbieters.', 'Map data © OpenStreetMap contributors (ODbL), tiles Protomaps, terrain Mapzen/AWS, borders and coasts Natural Earth. Weather Open-Meteo. The header picture is the provider’s own photo.')}</p>
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
</style>
