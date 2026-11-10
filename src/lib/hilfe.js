// V18: Kurze Erklärungen hinter den ⓘ-Knöpfen. Je Stelle: was das ist, wofür, und womit es zusammenhängt.
// `teil` ist der Teil im Handbuch, zu dem „Im Handbuch nachlesen“ springt. Texte ohne Gedankenstriche.
import { writable } from 'svelte/store'
import { je, jeSprache } from './i18n.js'

/** Teil des Handbuchs, zu dem die Handbuch-Seite nach dem Laden scrollt (dann wieder null). */
export const handbuchTeil = writable(null)

export const HILFE = jeSprache(() => ({
  zusammenhang: {
    titel: je('So hängt alles zusammen', 'How it all fits together'),
    text: [
      je('Deine Reise besteht aus Etappen: Zeitabschnitten mit festem Datum. In jeder Etappe liegen Routen mit ihren Stopps.', 'Your trip is made of legs: periods with fixed dates. Each leg holds routes with their stops.'),
      je('Buchungen, Nächte und Ausgaben ordnet die App über das Datum von selbst der richtigen Etappe zu. Jeder Reisetag hat seinen Logbuch-Eintrag, daraus entstehen Tagebuch, Film und Reisebericht.', 'Bookings, nights and expenses are matched to the right leg by date, all by themselves. Every travel day has its logbook entry, which becomes your journal, film and travel report.'),
    ],
    bild: true, teil: 2,
  },
  etappe: {
    titel: je('Etappe', 'Leg'),
    text: [
      je('Eine Etappe ist ein Zeitabschnitt deiner Reise mit festem Datum, zum Beispiel „Coral Coast, 27.10. bis 2.11.“.', 'A leg is a period of your trip with fixed dates, for example “Coral Coast, 27 Oct to 2 Nov”.'),
      je('Sie ist das Rückgrat: Routen, Buchungen, Nächte, Ausgaben und Logbuch-Tage hängen sich über das Datum von selbst an die richtige Etappe.', 'It is the backbone: routes, bookings, nights, expenses and logbook days attach themselves to the right leg by date.'),
    ],
    teil: 4,
  },
  route: {
    titel: je('Route', 'Route'),
    text: [
      je('Eine Route ist eine Strecke mit Stopps in einer Etappe, mit eigenem Zeitraum und den Nächten an jedem Stopp.', 'A route is a way with stops inside a leg, with its own dates and the nights at each stop.'),
      je('Daraus rechnet die App km, Fahrzeit, die längste Strecke ohne Tankstelle, Versorgung und die späteste Abfahrt. Ohne Datum ist sie „noch nicht eingeplant“, eine Idee zählt nirgends mit.', 'From that the app works out km, driving time, the longest stretch without fuel, supplies and the latest departure. Without dates it is “not planned in yet”, an idea never counts.'),
    ],
    teil: 4,
  },
  naechte: {
    titel: je('Nächte', 'Nights'),
    text: [
      je('Hier steht für jede Nacht der Reise, wo du schläfst. Gebucht kommt aus deinen Buchungen, geplant aus den Nächten an den Stopps deiner Routen.', 'This shows where you sleep each night of the trip. Booked comes from your bookings, planned from the nights at the stops of your routes.'),
      je('Offen heißt: noch kein Platz. An Feiertagen sind Campingplätze schnell voll, diese Nächte stehen deshalb oben.', 'Open means: no place yet. On public holidays campsites fill up fast, so those nights come first.'),
    ],
    teil: 4,
  },
  buchung: {
    titel: je('Buchung', 'Booking'),
    text: [
      je('Eine Buchung bündelt Termin, Buchungsnummer, Kosten und Belege.', 'A booking keeps date, booking number, cost and vouchers together.'),
      je('Am schnellsten über „+ Neu“ → Buchung: Bestätigungsmail einfügen, die App füllt die Felder aus. Danach steht sie am Tag, in der Etappe, im Kalender und in den Kosten.', 'Quickest via “+ New” → Booking: paste the confirmation email, the app fills in the fields. After that it shows on the day, in the leg, in the calendar and in the costs.'),
    ],
    teil: 10,
  },
  ausgabe: {
    titel: je('Ausgaben', 'Expenses'),
    text: [
      je('Ausgaben trägst du auf Heute, über „+ Neu“ → Ausgabe oder im Logbuch am Tag ein. Die Kategorie entscheidet, wo sie in den Kosten zählt.', 'Add expenses on Today, via “+ New” → Expense or in the logbook on the day. The category decides where it counts in the costs.'),
      je('Für einen Einkauf über mehrere Tage wähle „Zeitraum“: Der Betrag wird centgenau auf die Tage verteilt.', 'For shopping that lasts several days choose “Period”: the amount is spread over the days to the cent.'),
    ],
    teil: 10,
  },
  kosten: {
    titel: je('Kosten', 'Costs'),
    text: [
      je('Short-Values sind laufende Kosten wie Essen und Sprit, Long-Values Anschaffungen wie Kamera oder Kleidung. Long-Values zählen in die Summe, aber nicht in den Schnitt pro Tag.', 'Short-values are ongoing costs such as food and fuel, long-values are purchases such as a camera or clothes. Long-values count in the total but not in the daily average.'),
      je('„Vor der Reise“ heißt: vor dem ersten Reisetag bezahlt. Alles steht in Euro und AU$ zum Tageskurs.', '“Before the trip” means paid before the first travel day. Everything shows in euros and AU$ at the daily rate.'),
    ],
    teil: 9,
  },
  logbuch: {
    titel: je('Logbuch', 'Logbook'),
    text: [
      je('Jeder Reisetag ist ein Punkt am Band seiner Etappe: voll heißt geschrieben, ein Ring heißt noch offen.', 'Every travel day is a dot on its leg’s band: filled means written, a ring means still open.'),
      je('Schreib Text, Fotos, Kurzwerte und Ausgaben. Gebuchtes und Wanderungen mit Datum stehen schon am Tag. Aus den Tagen entstehen Tagebuch, Film und Reisebericht.', 'Write text, photos, quick values and expenses. Bookings and hikes with a date are already on the day. The days become your journal, film and travel report.'),
    ],
    teil: 8,
  },
  orte: {
    titel: je('Orte einplanen', 'Planning places'),
    text: [
      je('Mit „Einplanen“ legst du einen Ort in eine Route in der Nähe oder beginnst eine neue.', 'With “Add to trip” you put a place into a nearby route or start a new one.'),
      je('Ist er weit weg, merk ihn vor: Sobald eine Route bis 100 km an ihm vorbeiführt, schlägt die App ihn dort zuerst vor. Mit 💬 hältst du Notizen und Fotos zum Ort fest.', 'If it is far away, save it for later: as soon as a route passes within 100 km, the app suggests it there first. With 💬 you keep notes and photos for the place.'),
    ],
    teil: 7,
  },
  dokumente: {
    titel: je('Dokumente', 'Documents'),
    text: [
      je('Pass, Visum, Versicherung: Nummer, Ablaufdatum und mit „📎 Datei oder Foto“ die Datei dazu. Die Datei liegt offline auf dem Gerät.', 'Passport, visa, insurance: number, expiry date and with “📎 File or photo” the file itself. It is stored offline on the device.'),
      je('Mit „Dokumente sperren“ öffnen sie sich nur nach Face ID, Touch ID, PIN oder Passwort.', 'With “Lock documents” they only open after Face ID, Touch ID, PIN or password.'),
    ],
    teil: 9,
  },
  // V34: Notfall, Deinen Leuten Bescheid geben
  bescheid: {
    titel: je('Deinen Leuten Bescheid geben', 'Let your people know'),
    text: [
      je('Leg bis zu fünf wichtige Personen an, etwa Mama, Papa oder deine Partnerin: Rolle tippen, Nummer mit Ländervorwahl, SMS, WhatsApp oder beides. Sie bleiben nur auf diesem Gerät und im Backup.', 'Add up to five important people, such as your mum, dad or partner: tap a role, enter the number with country code, SMS, WhatsApp or both. They stay only on this device and in your backup.'),
      je('„Mir geht\'s gut“ und „Mein Standort senden“ öffnen die fertige Nachricht mit Ort, Uhrzeit und Kartenlink. In der SMS- oder WhatsApp-App tippst du nur noch auf Senden. Eine Web-App darf nichts von selbst verschicken.', '“I\'m okay” and “Send my location” open the finished message with place, time and a map link. In your messages or WhatsApp app you just tap Send. A web app is not allowed to send anything by itself.'),
      je('SMS geht auch ohne Internet, sobald etwas Handynetz da ist, und an mehrere auf einmal. WhatsApp braucht Internet und geht an eine Person je Nachricht. Bei beidem kommen die Knöpfe nacheinander: erst SMS, dann WhatsApp, zwei Apps auf einmal öffnet kein Handy. Im echten Notfall zuerst 000 anrufen.', 'SMS works without internet as soon as there is some mobile signal, and to several people at once. WhatsApp needs internet and goes to one person per message. With both, the buttons come one after another: first SMS, then WhatsApp, no phone opens two apps at once. In a real emergency call 000 first.'),
    ],
  },
  // V29: hinter dem ⓘ in der Box Offline-Routen (Plan, Karte)
  meldungen: {
    titel: je('Meldungen für andere Reisende', 'Reports for other travellers'),
    text: [
      je('Mit einer Meldung sagst du anderen TravelBuddy-Reisenden, was unterwegs los ist: ein Fluss nicht passierbar, viele Delfine am Strand, kein Diesel, Campground voll, Unwetter oder ein Tipp. Ein Satz reicht. Jede Meldung gilt 3 Tage.', 'With a report you tell other TravelBuddy travellers what is going on: a river not passable, lots of dolphins on the beach, no diesel, campground full, a storm or a tip. One sentence is enough. Each report is valid for 3 days.'),
      je('Andere sehen sie an ihrer Route nach Kilometer, an der Ortskachel und auf Heute. Mit „Stimmt noch“ verlängert sie sich um einen Tag, sagen mehrere „Nicht mehr“, fällt sie aus Heute raus. Ohne Netz bleibt sie auf dem Gerät und geht raus, sobald Netz da ist.', 'Others see it on their route by kilometre, on the place card and on Today. “Still true” extends it by a day, if several people say “No longer”, it drops off Today. Without signal it stays on the device and goes out once there is signal.'),
      je('Fotos teilst du in der TravelBuddy-Gruppe auf Telegram, die App nimmt keine. Keine Telefonnummern, keine Namen anderer, keine Werbung. Unpassendes kannst du melden, es wird entfernt.', 'Share photos in the TravelBuddy group on Telegram, the app does not take any. No phone numbers, no names of others, no advertising. You can report anything inappropriate, it will be removed.'),
    ],
  },
  verbinden: {
    titel: je('Unterwegs verbinden', 'Connect on the road'),
    text: [
      je('Dein Kontakt-Code enthält deinen Namen und die Wege, die du einschaltest: Telegram, Signal oder WhatsApp. Wer ihn scannt, schreibt dir direkt im Messenger. TravelBuddy hat dafür keinen Server, gechattet wird nur im Messenger.', 'Your contact code holds your name and the ways you switch on: Telegram, Signal or WhatsApp. Whoever scans it can message you straight away in the messenger. TravelBuddy has no server for this, chats only happen in the messenger.'),
      je('Scannen geht hier mit „Code scannen“ oder mit der Kamera-App. Am iPhone öffnet die Kamera-App den Code in Safari, nicht in der App vom Home-Bildschirm. Zum Merken lieber hier scannen.', 'Scan here with “Scan a code” or with the camera app. On iPhone the camera app opens the code in Safari, not in the home screen app. To save a contact, better scan here.'),
      je('Orte und Routen teilst du über „Einplanen“ an der Ortskachel und „Route teilen“ an der Route. Mit geht nur Name, Lage und Stopps, nie Logbuch, Kosten oder Buchungen.', 'Share places with “Add to trip” on the place card and routes with “Share route” on the route. Only name, location and stops are sent, never logbook, costs or bookings.'),
    ],
  },
  sperrungen: {
    titel: je('Straßensperrungen umfahren', 'Getting around road closures'),
    text: [
      je('Meldet Main Roads WA eine gesperrte Straße, etwa nach einem Unwetter, bei einem überfluteten Floodway oder einer ausgespülten Fahrbahn, sagt die App Bescheid und fragt, ob sie eine Umleitung rechnen soll. Das geht auch ohne Netz, mit dem zuletzt geladenen Stand.', 'When Main Roads WA reports a closed road, for example after a storm, a flooded floodway or a washed out road, the app tells you and asks whether it should calculate a detour. That also works offline, with the last loaded status.'),
      je('Mit dem Pisten-Netz findet sie mehr Wege drumherum. Beispiel Kununurra → Wyndham bei gesperrtem Victoria Highway: 7 km Umweg statt 766 km auf den Hauptstraßen.', 'With the track network it finds more ways around. Example Kununurra → Wyndham with the Victoria Highway closed: a 7 km detour instead of 766 km on the main roads.'),
      je('„Nur mit Allrad“ gilt mit dem 4WD-Schalter an der Route als frei. Sperrdaten gibt es für WA. Warnungen zu Feuer, Flut und Zyklon bleiben Hinweise an der Route.', '“4WD only” counts as open with the 4WD switch on the route. Closure data is available for WA. Warnings about fire, flood and cyclones stay as notes on the route.'),
    ],
  },
  // 1.27: „Was baut worauf auf“ hinter den ⓘ der Einführung, je Schritt das Passende, beim Willkommen alles
  aufbau: {
    titel: je('Was baut worauf auf', 'What builds on what'),
    text: [
      je('Einmal eintragen, überall nutzen. Die Einrichtung folgt dieser Kette: erst das Datum, dann die Etappe, dann Route und Fahrzeug, dann das Geld, zuletzt das Tagebuch. Jeder Schritt hat damit schon, was er braucht.', 'Enter it once, use it everywhere. The setup follows this chain: first the dates, then the leg, then route and vehicle, then the money, finally the journal. Each step already has what it needs.'),
      [je('Reisebeginn und Dauer', 'Trip start and length'), je('Countdown, Kalender, Wetter und Sonnenzeiten am richtigen Tag, Etappen ohne Lücken.', 'Countdown, calendar, weather and sun times on the right day, legs without gaps.')],
      [je('Etappe mit Datum', 'Leg with dates'), je('Buchungen, Nächte, Ausgaben und Logbuch-Tage hängen sich über das Datum von selbst an. Heute zeigt, was ansteht, die Kosten gibt es je Etappe und pro Tag.', 'Bookings, nights, expenses and logbook days attach themselves by date. Today shows what is coming up, costs come per leg and per day.')],
      [je('Route und Fahrzeug', 'Route and vehicle'), je('Kilometer, Fahrzeit, Tank-Lücken, Versorgung, Sperrungen mit Umleitung, Wetter und Warnungen an der Strecke, Losfahrzeit vor Sonnenuntergang, Sehenswertes und Fun Facts unterwegs. Das Logbuch trägt die km selbst ein.', 'Kilometres, driving time, fuel gaps, supplies, closures with detours, weather and warnings along the way, when to leave before sunset, sights and fun facts on the road. The logbook fills in the km by itself.')],
      [je('Verkehrsmittel mit Flug- oder Zugnummer', 'Transport with a flight or train number'), je('Status, Gate, Gleis, Verspätung, Hinweis 24 Stunden vorher, Flugstrecke im Plan und in den Kilometern.', 'Status, gate, platform, delays, a note 24 hours ahead, the flight route in the plan and in the kilometres.')],
      [je('Vorabausgaben', 'Expenses before the trip'), je('Kosten nach Gruppen (Verkehr, Unterkunft und Erlebnisse, Short- und Long-Values), Schnitt pro Tag, Bilanz am Ende.', 'Costs by group (transport, stays and experiences, short and long values), average per day, a summary at the end.')],
      [je('Buchungsmail und Belege', 'Booking email and documents'), je('Termin, Kosten und Beleg offline am richtigen Tag.', 'The date, the cost and the document offline on the right day.')],
      [je('Vorgemerkte Orte', 'Saved places'), je('Vorschläge an jeder Route bis 100 km daneben, Wander-Ideen an der Strecke.', 'Suggestions on every route up to 100 km away, hike ideas along the way.')],
      [je('Standort', 'Location'), je('Gefahren im Umkreis, Notfall, Fun Facts vor Ort.', 'Hazards nearby, emergency, fun facts on the spot.')],
      [je('Logbuch und Fotos jeden Abend', 'Logbook and photos every evening'), je('Tagebuch, Reisebericht, Reisefilm, Tierwelt und Bilanz. Fotos sortieren sich nach Aufnahmezeit und Ort selbst ein.', 'Journal, travel report, travel film, wildlife and summary. Photos sort themselves by time and place.')],
    ],
  },
  'aufbau-datum': {
    titel: je('Wofür das Datum zählt', 'What the dates are for'),
    text: [
      je('Aus Reisebeginn und Dauer rechnet die App den Countdown und den Kalender. Wetter und Sonnenzeiten zeigt sie für den richtigen Tag, und neue Etappen schließen ohne Lücke an.', 'From the trip start and length the app works out the countdown and the calendar. It shows weather and sun times for the right day, and new legs follow on without gaps.'),
    ],
  },
  'aufbau-etappe': {
    titel: je('Was an der Etappe hängt', 'What hangs on a leg'),
    text: [
      je('Buchungen, Nächte, Ausgaben und Logbuch-Tage hängen sich über das Datum von selbst an die richtige Etappe.', 'Bookings, nights, expenses and logbook days attach themselves to the right leg by date.'),
      je('Heute zeigt dann, was ansteht, und die Kosten gibt es je Etappe und pro Tag.', 'Today then shows what is coming up, and costs come per leg and per day.'),
    ],
  },
  'aufbau-route': {
    titel: je('Was die App aus Route und Fahrzeug macht', 'What the app makes of route and vehicle'),
    text: [
      je('Kilometer, Fahrzeit, Tank-Lücken nach deiner Reichweite und Versorgung an der Strecke. Sperrungen meldet sie mit Umleitung, dazu Wetter und Warnungen entlang der Route.', 'Kilometres, driving time, fuel gaps based on your range and supplies along the way. It reports closures with a detour, plus weather and warnings along the route.'),
      je('Sie sagt, wann du losfahren musst, um vor Sonnenuntergang anzukommen, schlägt Sehenswertes vor und zeigt Fun Facts unterwegs. Das Logbuch trägt die Kilometer des Tages selbst ein.', 'It tells you when to leave to arrive before sunset, suggests sights and shows fun facts on the road. The logbook fills in the day’s kilometres by itself.'),
      je('Mit 4WD nimmt sie Pisten und Tracks wie geplant, mit 2WD bleiben Fernstrecken auf Asphalt.', 'With 4WD it takes tracks as planned, with 2WD long drives stay on sealed roads.'),
    ],
  },
  'aufbau-ausgaben': {
    titel: je('Ein Eintrag, viele Stellen', 'One entry, many places'),
    text: [
      je('Wer einen Flug mit Nummer einträgt, hat ihn gleich im Plan, im Kalender, in den Kosten und in der Flugabfrage: Status, Gate, Gleis, Verspätung und ein Hinweis 24 Stunden vorher. Die Flugstrecke zählt in den Kilometern mit.', 'Enter a flight with its number and it is right there in the plan, the calendar, the costs and the flight check: status, gate, platform, delays and a note 24 hours ahead. The flight route counts in the kilometres.'),
      je('Vorabausgaben bündelt die App von selbst nach Gruppen: Verkehr, Unterkunft und Erlebnisse, Short- und Long-Values. Daraus rechnet sie den Schnitt pro Tag und am Ende die Bilanz.', 'The app groups expenses before the trip by itself: transport, stays and experiences, short and long values. From this it works out the average per day and the summary at the end.'),
      je('Eine eingefügte Buchungsmail wird zum Termin mit Kosten, der Beleg liegt offline am richtigen Tag.', 'A pasted booking email becomes a date with costs, and the document waits offline on the right day.'),
    ],
  },
  'aufbau-orte': {
    titel: je('Wofür vorgemerkte Orte gut sind', 'What saved places are for'),
    text: [
      je('Führt eine Route bis 100 km an einem vorgemerkten Ort vorbei, schlägt die App ihn dort zuerst vor. Wander-Ideen an der Strecke kommen von selbst dazu.', 'When a route passes within 100 km of a saved place, the app suggests it there first. Hike ideas along the way are added by themselves.'),
    ],
  },
  'aufbau-logbuch': {
    titel: je('Was aus dem Logbuch wird', 'What the logbook becomes'),
    text: [
      je('Aus ein paar Zeilen und Fotos jeden Abend entstehen Tagebuch, Reisebericht, Reisefilm, Tierwelt und Bilanz. Fotos sortieren sich nach Aufnahmezeit und Ort selbst ein.', 'A few lines and photos every evening turn into your journal, travel report, travel film, wildlife list and summary. Photos sort themselves by time and place.'),
    ],
  },
  'aufbau-bereit': {
    titel: je('Am besten zu Hause im WLAN', 'Best done at home on Wi-Fi'),
    text: [
      je('Kartenmaterial, Pisten-Netz, Fun Facts für die geplanten Etappen sowie Wetter und Warnungen lädt die App nur mit Netz vorab. Danach geht vieles auch im Funkloch.', 'Maps, the track network, fun facts for your planned legs and weather and warnings only load ahead with internet. After that, much of it works without signal too.'),
      je('Mit dem Standort zeigt die App Gefahren im Umkreis, hilft im Notfall und bringt Fun Facts vor Ort.', 'With your location the app shows hazards nearby, helps in an emergency and brings fun facts on the spot.'),
    ],
  },
}))
