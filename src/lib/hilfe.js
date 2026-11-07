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
  // V29: hinter dem ⓘ in der Box Offline-Routen (Plan, Karte)
  sperrungen: {
    titel: je('Straßensperrungen umfahren', 'Getting around road closures'),
    text: [
      je('Meldet Main Roads WA eine gesperrte Straße, etwa nach einem Unwetter, bei einem überfluteten Floodway oder einer ausgespülten Fahrbahn, sagt die App Bescheid und fragt, ob sie eine Umleitung rechnen soll. Das geht auch ohne Netz, mit dem zuletzt geladenen Stand.', 'When Main Roads WA reports a closed road, for example after a storm, a flooded floodway or a washed out road, the app tells you and asks whether it should calculate a detour. That also works offline, with the last loaded status.'),
      je('Mit dem Pisten-Netz findet sie mehr Wege drumherum. Beispiel Kununurra → Wyndham bei gesperrtem Victoria Highway: 7 km Umweg statt 766 km auf den Hauptstraßen.', 'With the track network it finds more ways around. Example Kununurra → Wyndham with the Victoria Highway closed: a 7 km detour instead of 766 km on the main roads.'),
      je('„Nur mit Allrad“ gilt mit dem 4WD-Schalter an der Route als frei. Sperrdaten gibt es für WA. Warnungen zu Feuer, Flut und Zyklon bleiben Hinweise an der Route.', '“4WD only” counts as open with the 4WD switch on the route. Closure data is available for WA. Warnings about fire, flood and cyclones stay as notes on the route.'),
    ],
  },
}))
