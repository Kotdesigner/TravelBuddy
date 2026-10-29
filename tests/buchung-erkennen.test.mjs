// Buchung aus Bestätigungsmail erkennen: erkenne(), alsBuchungen(), dubletten().
// Ausführen: node tests/buchung-erkennen.test.mjs
// Alle Mailtexte sind ausgedacht (Namen, Nummern, Preise). Kein Netz.
import { erkenne, alsFormular, alsBuchungen, formularOk, dubletten, findeDaten, zahlAus, stufe, ARTEN } from '../src/lib/buchung-erkennen.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const KTX = { zeitraum: { von: '2037-11-29', bis: '2038-02-15' }, heute: '2037-10-11' }
const w = (r, f) => r[f]?.wert
const zeig = (r) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'segmente' && k !== 'hinweise').map(([k, v]) => [k, v?.wert])))

// ---------------------------------------------------------------------------
console.log('\n1  Qantas, Inlandsflug (EN), Mailkopf mit Sendedatum')
{
  const r = erkenne(`From: Qantas Airways <noreply@qantas.com.au>
Sent: Monday, 5 October 2037 9:14 AM
Subject: Your booking confirmation

Hi Alex,
Thanks for booking with Qantas.
Booking reference: 7XKQ2P

Flight QF 1956
Perth (PER) to Broome (BME)
Departs: Thu 3 Dec 2037 10:05
Arrives: Thu 3 Dec 2037 12:45
Economy · 1 adult · Baggage 23kg

Total paid AUD 412.80`, KTX)
  p('Art Flug', w(r, 'art') === 'flug', zeig(r))
  p('Anbieter Qantas', w(r, 'anbieter') === 'Qantas')
  p('Flugnummer QF 1956', w(r, 'flugNr') === 'QF 1956', w(r, 'flugNr'))
  p('Datum 3.12.2037 (Sendedatum ignoriert)', w(r, 'von') === '2037-12-03', w(r, 'von'))
  p('kein Enddatum (gleicher Tag)', !w(r, 'bis'), w(r, 'bis'))
  p('Abflug 10:05, Ankunft 12:45', w(r, 'zeitVon') === '10:05' && w(r, 'zeitBis') === '12:45', `${w(r, 'zeitVon')} ${w(r, 'zeitBis')}`)
  p('Titel „Perth → Broome“', w(r, 'titel') === 'Perth → Broome', w(r, 'titel'))
  p('Buchungsnummer 7XKQ2P', w(r, 'ref') === '7XKQ2P', w(r, 'ref'))
  p('Betrag 412,80 AUD', w(r, 'betrag') === 412.8 && w(r, 'waehrung') === 'AUD', `${w(r, 'betrag')} ${w(r, 'waehrung')}`)
  p('Datum sicher erkannt', r.von.konfidenz >= 0.8, r.von.konfidenz)
}

// ---------------------------------------------------------------------------
console.log('\n2  Booking.com, Hotel in Broome (EN), Etikett über dem Wert')
{
  const r = erkenne(`Booking.com
Thanks, Steve! Your booking at Cable Beach Club Resort & Spa is confirmed.
Confirmation number: 4123.567.890
PIN code: 1234

Check-in
Friday, 4 December 2037
from 15:00

Check-out
Monday, 7 December 2037
until 10:00

Address: 1 Cable Beach Road West, Cable Beach WA 6726, Australia
3 nights, 1 room
Price per night AU$ 412.00
Total price AU$ 1,236.00
Free cancellation until 1 December 2037 23:59`, KTX)
  p('Art Unterkunft', w(r, 'art') === 'unterkunft', zeig(r))
  p('Titel aus „Your booking at …“', w(r, 'titel') === 'Cable Beach Club Resort & Spa', w(r, 'titel'))
  p('Anreise 4.12., Abreise 7.12.', w(r, 'von') === '2037-12-04' && w(r, 'bis') === '2037-12-07', `${w(r, 'von')} ${w(r, 'bis')}`)
  p('Stornofrist ist kein Abreisedatum', w(r, 'bis') !== '2037-12-01')
  p('Check-in ab 15:00, Check-out bis 10:00', w(r, 'zeitVon') === '15:00' && w(r, 'zeitBis') === '10:00', `${w(r, 'zeitVon')} ${w(r, 'zeitBis')}`)
  p('Adresse', /Cable Beach WA 6726/.test(w(r, 'ort') || ''), w(r, 'ort'))
  p('Bestätigungsnummer mit Punkten', w(r, 'ref') === '4123.567.890', w(r, 'ref'))
  p('Gesamtpreis statt Preis pro Nacht', w(r, 'betrag') === 1236 && w(r, 'waehrung') === 'AUD', `${w(r, 'betrag')} ${w(r, 'waehrung')}`)
  p('3 Nächte passen zu den Daten', w(r, 'naechte') === 3 && !r.hinweise.some((h) => /Nächte/.test(h)), r.hinweise.join(' | '))
}

// ---------------------------------------------------------------------------
console.log('\n3  Airbnb (DE), Tabelle ohne Jahr, Wochentage auf Deutsch')
{
  const r = erkenne(`Buchung bestätigt! Du fährst nach Exmouth.

Unterkunft
Ningaloo Beach House

Check-in          Check-out
Fr., 18. Dez.     Mo., 21. Dez.
15:00             10:00

Bestätigungscode
HMQ4X8TZ2B

Adresse
12 Kennedy St, Exmouth WA 6707, Australien

Gesamtbetrag (AUD)
987,40 $

Airbnb Ireland UC, 8 Hanover Quay, Dublin 2`, KTX)
  p('Art Unterkunft (Airbnb)', w(r, 'art') === 'unterkunft' && w(r, 'anbieter') === 'Airbnb', zeig(r))
  p('Titel', w(r, 'titel') === 'Ningaloo Beach House', w(r, 'titel'))
  p('Jahr ergänzt: 18.12.2037 bis 21.12.2037', w(r, 'von') === '2037-12-18' && w(r, 'bis') === '2037-12-21', `${w(r, 'von')} ${w(r, 'bis')}`)
  p('Spalten richtig zugeordnet (15:00 / 10:00)', w(r, 'zeitVon') === '15:00' && w(r, 'zeitBis') === '10:00', `${w(r, 'zeitVon')} ${w(r, 'zeitBis')}`)
  p('Bestätigungscode in der nächsten Zeile', w(r, 'ref') === 'HMQ4X8TZ2B', w(r, 'ref'))
  p('Betrag 987,40 deutsch geschrieben', w(r, 'betrag') === 987.4 && w(r, 'waehrung') === 'AUD', `${w(r, 'betrag')} ${w(r, 'waehrung')}`)
  p('Adresse aus der Zeile unter „Adresse“', /Kennedy St, Exmouth WA 6707/.test(w(r, 'ort') || ''), w(r, 'ort'))
}

// ---------------------------------------------------------------------------
console.log('\n4  Britz Camper (EN), australisches Datum TT/MM/JJJJ, mehrdeutig')
{
  const r = erkenne(`Britz Campervan Rentals – Booking Confirmation
Booking reference: BZ-4471829

Vehicle: Venturer Plus 2 Berth
Pick-up: Perth Branch, 471 Great Eastern Hwy, Redcliffe WA 6104
Pick-up date: 08/12/2037 10:00
Drop-off: Broome Branch, 3 Livistona St, Broome WA 6725
Drop-off date: 02/01/2038 14:00

Total: $5,840.00 AUD
Bond: $7,500.00`, KTX)
  p('Art Camper / Mietwagen, Camper', w(r, 'art') === 'fahrzeug' && w(r, 'fahrzeug') === 'camper', zeig(r))
  p('08/12/2037 = 8. Dezember (nicht 12. August)', w(r, 'von') === '2037-12-08', w(r, 'von'))
  p('02/01/2038 = 2. Januar', w(r, 'bis') === '2038-01-02', w(r, 'bis'))
  p('Mehrdeutigkeit wird gemeldet', r.hinweise.some((h) => /Tag\/Monat/.test(h)), r.hinweise.join(' | '))
  p('Konfidenz dabei nur „prüfen“', stufe(r.von.konfidenz) === 'pruefen', r.von.konfidenz)
  p('Übernahme 10:00, Rückgabe 14:00', w(r, 'zeitVon') === '10:00' && w(r, 'zeitBis') === '14:00', `${w(r, 'zeitVon')} ${w(r, 'zeitBis')}`)
  p('Titel mit Fahrzeug', w(r, 'titel') === 'Britz Venturer Plus 2 Berth', w(r, 'titel'))
  p('Übernahmeort', /^Perth Branch/.test(w(r, 'ort') || ''), w(r, 'ort'))
  p('Rückgabeort', /^Broome Branch/.test(w(r, 'ortBis') || ''), w(r, 'ortBis'))
  p('Gesamt statt Kaution', w(r, 'betrag') === 5840 && w(r, 'waehrung') === 'AUD', `${w(r, 'betrag')} ${w(r, 'waehrung')}`)
  p('Buchungsnummer mit Bindestrich', w(r, 'ref') === 'BZ-4471829', w(r, 'ref'))
}

// ---------------------------------------------------------------------------
console.log('\n5  Rottnest Express Fähre (EN), Monat zuerst ausgeschrieben')
{
  const r = erkenne(`Rottnest Express – Your e-tickets
Booking number: RE88231457
Date of travel: Saturday, December 12, 2037

Fremantle (B Shed) → Rottnest Island
Depart 08:30  Arrive 09:00
Return: Rottnest Island → Fremantle (B Shed) departs 16:30

Fare: 1 x Adult Return incl. bike hire
Total AUD 129.00`, KTX)
  p('Art Fähre', w(r, 'art') === 'faehre', zeig(r))
  p('Datum 12.12.2037, Wochentag passt', w(r, 'von') === '2037-12-12' && r.von.konfidenz >= 0.9, `${w(r, 'von')} ${r.von.konfidenz}`)
  p('Titel mit Strecke', w(r, 'titel') === 'Fähre Fremantle (B Shed) → Rottnest Island', w(r, 'titel'))
  p('Abfahrt 08:30', w(r, 'zeitVon') === '08:30', w(r, 'zeitVon'))
  p('Buchungsnummer', w(r, 'ref') === 'RE88231457', w(r, 'ref'))
  p('Betrag 129 AUD', w(r, 'betrag') === 129 && w(r, 'waehrung') === 'AUD')
}

// ---------------------------------------------------------------------------
console.log('\n6  Walhai-Tour Ningaloo (EN), „15th December“, am/pm')
{
  const r = erkenne(`Exmouth Dive & Whalesharks Ningaloo
Booking Confirmation

Tour: Whale Shark Swim – Full Day
Tour date: Tuesday 15th December 2037
Pick-up: 7:15am from Exmouth Escape Resort, 2 Murat Rd, Exmouth WA 6707
Return approx. 4:30pm

Reference: EDW-20931
Guests: 1 Adult
Price: A$449.00 per person
Total: A$449.00`, KTX)
  p('Art Tour', w(r, 'art') === 'tour', zeig(r))
  p('Titel aus „Tour:“', w(r, 'titel') === 'Whale Shark Swim – Full Day', w(r, 'titel'))
  p('Datum 15.12.2037', w(r, 'von') === '2037-12-15', w(r, 'von'))
  p('Abholung 07:15, zurück 16:30', w(r, 'zeitVon') === '07:15' && w(r, 'zeitBis') === '16:30', `${w(r, 'zeitVon')} ${w(r, 'zeitBis')}`)
  p('Treffpunkt ohne Uhrzeit davor', /^Exmouth Escape Resort, 2 Murat Rd/.test(w(r, 'ort') || ''), w(r, 'ort'))
  p('Referenz', w(r, 'ref') === 'EDW-20931', w(r, 'ref'))
  p('A$ 449', w(r, 'betrag') === 449 && w(r, 'waehrung') === 'AUD')
}

// ---------------------------------------------------------------------------
console.log('\n7  Nationalpark-Camping Park Stay WA (EN), eindeutig TT/MM')
{
  const r = erkenne(`Park Stay WA – parks.dpaw.wa.gov.au
Booking Confirmation

Booking number: PSW-0012345
Campground: Osprey Bay, Cape Range National Park
Site: 14 (unpowered)
Arrival: 20/12/2037
Departure: 23/12/2037
Nights: 3
Camping fees: $45.00
Total paid: $45.00`, KTX)
  p('Art Unterkunft (Camping)', w(r, 'art') === 'unterkunft', zeig(r))
  p('Anbieter Parks and Wildlife WA', w(r, 'anbieter') === 'Parks and Wildlife WA', w(r, 'anbieter'))
  p('Arrival/Departure heißt hier An- und Abreise', w(r, 'von') === '2037-12-20' && w(r, 'bis') === '2037-12-23', `${w(r, 'von')} ${w(r, 'bis')}`)
  p('eindeutiges Datum: hohe Konfidenz', r.von.konfidenz >= 0.9, r.von.konfidenz)
  p('Titel = Campground', w(r, 'titel') === 'Osprey Bay, Cape Range National Park', w(r, 'titel'))
  p('„$“ als AUD mit Hinweis', w(r, 'waehrung') === 'AUD' && r.hinweise.some((h) => /australische Dollar/.test(h)))
  p('Nächte: 3', w(r, 'naechte') === 3)
}

// ---------------------------------------------------------------------------
console.log('\n8  Hotel (DE), TT.MM.JJJJ, Uhr, Euro')
{
  const r = erkenne(`Betreff: Ihre Buchungsbestätigung – Hotel Kimberley Sands
Sehr geehrter Herr Muster,
vielen Dank für Ihre Buchung im Hotel Kimberley Sands.
Buchungsnummer: 88412093
Anreise: Sa., 26.12.2037 ab 14:00 Uhr
Abreise: Mo., 28.12.2037 bis 11:00 Uhr
2 Nächte, Doppelzimmer
Adresse: 10 Millington Rd, Cable Beach WA 6726
Gesamtpreis: 389,00 €`, KTX)
  p('Art Unterkunft', w(r, 'art') === 'unterkunft', zeig(r))
  p('Titel aus „Ihre Buchung im …“', w(r, 'titel') === 'Hotel Kimberley Sands', w(r, 'titel'))
  p('26.12. bis 28.12.2037', w(r, 'von') === '2037-12-26' && w(r, 'bis') === '2037-12-28', `${w(r, 'von')} ${w(r, 'bis')}`)
  p('14:00 und 11:00', w(r, 'zeitVon') === '14:00' && w(r, 'zeitBis') === '11:00', `${w(r, 'zeitVon')} ${w(r, 'zeitBis')}`)
  p('Buchungsnummer', w(r, 'ref') === '88412093', w(r, 'ref'))
  p('389,00 €', w(r, 'betrag') === 389 && w(r, 'waehrung') === 'EUR', `${w(r, 'betrag')} ${w(r, 'waehrung')}`)
  p('Adresse', w(r, 'ort') === '10 Millington Rd, Cable Beach WA 6726', w(r, 'ort'))
}

// ---------------------------------------------------------------------------
console.log('\n9  Emirates, zwei Flüge, Datum Monat/Tag (US-Schreibweise)')
{
  const r = erkenne(`Emirates – Booking confirmation
Booking reference (PNR): KZ7QRT

Flight 1  EK 46
Frankfurt (FRA) → Dubai (DXB)
Departure 11/27/2037 15:10  Arrival 11/27/2037 23:25

Flight 2  EK 420
Dubai (DXB) → Perth (PER)
Departure 11/28/2037 02:35  Arrival 11/28/2037 17:15

Total fare EUR 1.384,20`, KTX)
  p('Art Flug, Emirates', w(r, 'art') === 'flug' && w(r, 'anbieter') === 'Emirates', zeig(r))
  p('PNR hinter Klammer', w(r, 'ref') === 'KZ7QRT', w(r, 'ref'))
  p('Zwei Segmente', r.segmente.length === 2, JSON.stringify(r.segmente))
  const [a, b] = r.segmente
  p('Segment 1: EK 46, 27.11., 15:10 bis 23:25, Frankfurt → Dubai',
    a?.flugNr === 'EK 46' && a.datum === '2037-11-27' && a.zeitVon === '15:10' && a.zeitBis === '23:25' && a.titel === 'Frankfurt → Dubai', JSON.stringify(a))
  p('Segment 2: EK 420, 28.11., 02:35, Dubai → Perth',
    b?.flugNr === 'EK 420' && b.datum === '2037-11-28' && b.zeitVon === '02:35' && b.titel === 'Dubai → Perth', JSON.stringify(b))
  p('Titel Frankfurt → Perth', w(r, 'titel') === 'Frankfurt → Perth', w(r, 'titel'))
  p('von 27.11., bis 28.11.', w(r, 'von') === '2037-11-27' && w(r, 'bis') === '2037-11-28', `${w(r, 'von')} ${w(r, 'bis')}`)
  p('EUR 1.384,20', w(r, 'betrag') === 1384.2 && w(r, 'waehrung') === 'EUR', `${w(r, 'betrag')} ${w(r, 'waehrung')}`)
  const ev = alsBuchungen(alsFormular(r), { jetzt: '2037-10-11T10:00:00Z' })
  p('Übernehmen legt je Flug einen Termin an', ev.length === 2 && ev[0].kat === 'flight' && ev[1].flugNr === 'EK 420', JSON.stringify(ev.map((e) => [e.datum, e.titel, e.flugNr])))
  p('Betrag nur am ersten Termin', ev[0].betrag === 1384.2 && ev[1].betrag === undefined)
}

// ---------------------------------------------------------------------------
console.log('\n10  Mietwagen Darwin (DE), Monatsname, „Abholung“ und „Rückgabe“')
{
  const r = erkenne(`Hertz Reservierungsbestätigung
Reservierungsnummer: K4471920DE
Fahrzeug: Toyota RAV4 oder ähnlich
Abholung: Di, 12. Januar 2038, 09:30 Uhr
Abholort: Darwin Airport, Henry Wrigley Dr, Marrara NT 0812
Rückgabe: Do, 14. Januar 2038, 18:00 Uhr
Rückgabeort: Darwin Airport
Gesamtbetrag: AUD 268,50`, KTX)
  p('Art Fahrzeug, Mietwagen (kein Camper)', w(r, 'art') === 'fahrzeug' && w(r, 'fahrzeug') === 'car', zeig(r))
  p('12. bis 14. Januar 2038', w(r, 'von') === '2038-01-12' && w(r, 'bis') === '2038-01-14', `${w(r, 'von')} ${w(r, 'bis')}`)
  p('09:30 und 18:00', w(r, 'zeitVon') === '09:30' && w(r, 'zeitBis') === '18:00', `${w(r, 'zeitVon')} ${w(r, 'zeitBis')}`)
  p('Abholort', /^Darwin Airport, Henry Wrigley/.test(w(r, 'ort') || ''), w(r, 'ort'))
  p('Rückgabeort', w(r, 'ortBis') === 'Darwin Airport', w(r, 'ortBis'))
  p('Titel Hertz + Fahrzeug', w(r, 'titel') === 'Hertz Toyota RAV4 oder ähnlich', w(r, 'titel'))
  p('AUD 268,50', w(r, 'betrag') === 268.5 && w(r, 'waehrung') === 'AUD')
  p('Reservierungsnummer', w(r, 'ref') === 'K4471920DE', w(r, 'ref'))
}

// ---------------------------------------------------------------------------
console.log('\n11  Mehrdeutige Daten: Wochentag, Zeitraum, eigene Schreibweise der Mail')
{
  const h = []
  const d1 = findeDaten('Departs Fri 12/04/2037', { ...KTX, hinweise: h })
  p('„Fri 12/04/2037“: Freitag passt nur zu 4. Dezember', d1[0]?.iso === '2037-12-04' && h.some((x) => /Wochentag/.test(x)), JSON.stringify(d1) + h.join('|'))
  const h2 = []
  const d2 = findeDaten('Tour date: 03/12/2037', { ...KTX, hinweise: h2 })
  p('„03/12/2037“ ohne weitere Hinweise: 3. Dezember, mit Prüfhinweis', d2[0]?.iso === '2037-12-03' && d2[0].konfidenz < 0.8 && h2.length === 1)
  const d3 = findeDaten('Arrival 03/12/2037. Departure 15/12/2037.', { ...KTX, hinweise: [] })
  p('Ein eindeutiges TT/MM in derselben Mail macht das andere sicherer', d3[0]?.iso === '2037-12-03' && d3[0].konfidenz >= 0.8, JSON.stringify(d3))
  const h4 = []
  const d4 = findeDaten('Check-in 01/12/2038', { zeitraum: { von: '2037-11-29', bis: '2038-02-15' }, hinweise: h4 })
  p('„01/12/2038“ außerhalb der Reise, als 12. Januar 2038 gelesen', d4[0]?.iso === '2038-01-12' && h4.some((x) => /außerhalb/.test(x)), JSON.stringify(d4))
  const d5 = findeDaten('Sat 13 Dec 2037', { ...KTX, hinweise: [] })
  p('Falscher Wochentag senkt die Konfidenz', d5[0]?.konfidenz < 0.5)
  const d6 = findeDaten('Your flight on 05DEC', { ...KTX, hinweise: [] })
  p('Airline-Kurzform 05DEC → 5.12.2037', d6[0]?.iso === '2037-12-05')
  const d7 = findeDaten('Stay: 12–14 Dec 2037', { ...KTX, hinweise: [] })
  p('Bereich „12–14 Dec 2037“', d7.length === 2 && d7[0].iso === '2037-12-12' && d7[1].iso === '2037-12-14')
  const d8 = findeDaten('Zeitraum 30. Januar bis 2. Februar', { ...KTX, hinweise: [] })
  p('Deutsche Monatsnamen ohne Jahr landen in der Reise (2038)', d8[0]?.iso === '2038-01-30' && d8[1]?.iso === '2038-02-02', JSON.stringify(d8))
}

// ---------------------------------------------------------------------------
console.log('\n12  Formular → Termine, Dubletten, Kleinkram')
{
  const r = erkenne(`Your booking at Mangrove Hotel is confirmed.
Check-in: 9 Dec 2037 from 2:00 pm
Check-out: 11 Dec 2037 until 10:00 am
Booking ID: MH55102
Total AUD 540.00`, KTX)
  const f = alsFormular(r)
  p('Formular gültig', formularOk(f), JSON.stringify(f))
  p('am/pm in 24 h', f.zeitVon === '14:00' && f.zeitBis === '10:00', `${f.zeitVon} ${f.zeitBis}`)
  let n = 0
  const ev = alsBuchungen(f, { id: () => String(++n), jetzt: '2037-10-11T10:00:00Z' })
  p('Unterkunft: zwei Termine (Check-in, Check-out)', ev.length === 2 && ev[0].datum === '2037-12-09' && ev[1].datum === '2037-12-11', JSON.stringify(ev))
  p('Format wie Reisekalender', ev.every((e) => e.kat === 'hotel' && Array.isArray(e.docs) && e.platzhalter === false && e.quelle === 'eigen' && e.id.startsWith('eb-')))
  p('Untertitel Check-in ab 14:00 · 2 Nächte', /^Check-in ab 14:00 · 2 Nächte/.test(ev[0].sub), ev[0].sub)
  p('Untertitel Check-out bis 10:00', /^Check-out bis 10:00/.test(ev[1].sub), ev[1].sub)
  p('beide Termine gehören zusammen', ev[0].gruppe && ev[0].gruppe === ev[1].gruppe)
  p('Dublette erkannt (gleicher Tag, gleiche Nummer)', dubletten([{ datum: '2037-12-09', ref: 'MH55102', titel: 'x' }], ev).length === 1)
  p('keine Dublette an anderem Tag', dubletten([{ datum: '2037-12-10', ref: 'MH55102', titel: 'x' }], ev).length === 0)
  p('ohne Datum nicht übernehmbar', !formularOk({ ...f, von: '' }) && alsBuchungen({ ...f, von: '' }).length === 0)
  p('Ende vor Beginn nicht übernehmbar', !formularOk({ ...f, bis: '2037-12-01' }))
  const tour = alsBuchungen({ ...f, art: 'tour', bis: '', titel: 'Bungle Bungle Rundflug' }, { jetzt: 'x' })
  p('Tour an einem Tag: ein Termin mit Emoji', tour.length === 1 && tour[0].emoji === '🎟️' && tour[0].kat === 'tour')
  const auto = alsBuchungen({ ...f, art: 'fahrzeug', fahrzeug: 'car', titel: 'Hertz' }, { jetzt: 'x' })
  p('Mietwagen: kat car, Übernahme und Rückgabe', auto.length === 2 && auto[0].kat === 'car' && /^Übernahme/.test(auto[0].sub) && /^Rückgabe/.test(auto[1].sub))
  p('zahlAus: 1.234,56 / 1,234.56 / 1.234 / 12,5', zahlAus('1.234,56') === 1234.56 && zahlAus('1,234.56') === 1234.56 && zahlAus('1.234') === 1234 && zahlAus('12,5') === 12.5)
  p('sechs Arten', ARTEN.map((a) => a.id).join() === 'flug,unterkunft,fahrzeug,tour,faehre,sonstiges')
}

console.log('\n13  Ohne Buchung')
{
  const r = erkenne('Hi Alex, see you at the pub tonight? Cheers, Mike', KTX)
  p('Art Sonstiges, kein Datum, Hinweis', w(r, 'art') === 'sonstiges' && !w(r, 'von') && r.hinweise.some((h) => /Kein Datum/.test(h)), zeig(r))
  p('leerer Text stürzt nicht ab', erkenne('', KTX).hinweise.length === 1)
}

console.log('\n14  Hausname in eigener Zeile')
{
  const r = erkenne('Booking confirmation\nBooking reference: KX7Q2P\nKalbarri Beach Resort\nCheck-in: Sunday, 20 December 2037 from 14:00\nCheck-out: Tuesday, 22 December 2037 by 10:00\n2 nights, Total AUD 412.00', KTX)
  p('Titel Kalbarri Beach Resort', w(r, 'titel') === 'Kalbarri Beach Resort', zeig(r))
  p('Art Unterkunft, 20. bis 22.12.', w(r, 'art') === 'unterkunft' && w(r, 'von') === '2037-12-20' && w(r, 'bis') === '2037-12-22', zeig(r))
}

console.log(`\n${ok} bestanden · ${bad} gescheitert`)
process.exit(bad ? 1 : 0)
