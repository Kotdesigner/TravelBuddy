// Die Testreise: eine ausgedachte Reise durch Western Australia zum Ausprobieren.
// Sie läuft immer gerade: Alle Daten rechnen sich vom heutigen Tag aus. Neun Tage liegen hinter dir,
// heute geht es nach Exmouth, in 20 Stunden fliegst du nach Karratha, elf Tage kommen noch. So zeigt jede
// Seite etwas, vom Countdown über die Flugkarte bis zur Kostenauswertung.
//
// Alle IDs beginnen mit `test-`, die Flugnummern mit ZZ (keine echte Fluggesellschaft). Flug- und
// Bahndaten sind erfunden, flug-dienst.js fragt für diese Termine nichts ab.
import { je } from './i18n.js'
import { plusTage } from './plan.js'
import { felderMitAusgaben } from './kosten.js'

export const TEST_PRAEFIX = 'test-'
const TAGE_VORBEI = 9, REISE_TAGE = 21

const stellen = (n) => String(n).padStart(2, '0')
const tagVon = (d) => `${d.getFullYear()}-${stellen(d.getMonth() + 1)}-${stellen(d.getDate())}`
const uhrVon = (d) => `${stellen(d.getHours())}:${stellen(d.getMinutes())}`

// Der Flug liegt immer 20 Stunden voraus, damit der Hinweis vor dem Abflug kommt.
// Wer nachts vor vier Uhr startet, fliegt also noch am selben Abend.
function naechsterFlug(jetzt) {
  const ziel = new Date(jetzt + 20 * 3600e3)
  ziel.setMinutes(Math.floor(ziel.getMinutes() / 5) * 5, 0, 0)
  return ziel
}

const stop = (name, lat, lon, ortId = null) => ({ name, lat, lon, img: null, ...(ortId ? { ortId } : {}) })
const PERTH = stop('Perth', -31.9523, 115.8613)
const ROTTNEST = stop('Rottnest Island (Wadjemup)', -32.00727, 115.50415, 'rottnest_island_wadjemup')
const PINNACLES = stop('The Pinnacles (Nambung NP)', -30.58819, 115.15579, 'the_pinnacles_nambung_np')
const KALBARRI = stop('Kalbarri NP', -27.55302, 114.44606, 'natures_window_the_loop')
const MONKEY_MIA = stop('Monkey Mia', -25.79427, 113.71891, 'monkey_mia_herald_bight')
const QUOBBA = stop('Quobba Blowholes', -24.48161, 113.40739, 'quobba_blowholes')
const CORAL_BAY = stop('Coral Bay', -23.14368, 113.77017, 'coral_bay')
const EXMOUTH = stop('Exmouth', -21.9314, 114.1222)
const LEARMONTH = stop('Exmouth (Learmonth)', -22.2356, 114.0889)
const KARRATHA = stop('Karratha', -20.7123, 116.7733)
const MILLSTREAM = stop('Millstream Chichester NP', -21.45492, 117.48029, 'millstream_chichester_np')
const KARIJINI = stop('Karijini NP', -22.40684, 118.47567, 'karijini_np')
const MARBLE_BAR = stop('Marble Bar', -21.17149, 119.74562, 'marble_bar_carawine_gorge')
const HEDLAND = stop('Port Hedland', -20.3106, 118.6014)

/** Die Bilder der Orte dienen als Urlaubsfotos: Logbuch-Eintrag → Bilddateien. */
export const TEST_FOTOS = {
  'test-tag-rottnest': ['bilder/rottnest_island_wadjemup.jpg'],
  'test-tag-pinnacles': ['bilder/the_pinnacles_nambung_np.jpg', 'bilder/lancelin_sand_dunes.jpg'],
  'test-tag-kalbarri': ['bilder/natures_window_the_loop.jpg'],
  'test-tag-monkey': ['bilder/monkey_mia_herald_bight.jpg'],
  'test-tag-quobba': ['bilder/quobba_blowholes.jpg', 'bilder/red_bluff_quobba_station.jpg'],
  'test-tag-coral': ['bilder/coral_bay.jpg', 'bilder/turquoise_bay_jurabi_turtle_centre.jpg'],
}

const LOGBUCH = () => [
  { id: 'test-tag-perth', tag: -9, ort: PERTH, reiseId: 'test-et-perth',
    text: je('Gelandet, Camper abgeholt, erster Großeinkauf. Abends im Kings Park: Die Stadt glitzert unter uns, und wir können kaum noch die Augen offen halten.',
      'Landed, picked up the camper, first big shop. Kings Park at dusk: the city glitters below and we can barely keep our eyes open.'),
    felder: { distance_km: 28, temp_celsius: je('24 °C, klar', '24 °C, clear'), fly_factor: 1, stimmung: 5, connectivity: '4G/5G', verkehrsmittel: ['🚗 Auto'], soundtrack: 'Waltzing Matilda' },
    ausgaben: [['kosten_lebensmittel', 112.4, je('Erster Großeinkauf', 'First big shop')], ['kosten_essen', 38, 'Fish & Chips'], ['kosten_telefon', 35, je('SIM-Karte', 'SIM card')], ['kosten_unterkunft', 48, je('Stellplatz Perth', 'Campsite Perth')]],
    tiere: [['galah', 8], ['pelikan', 2]] },
  { id: 'test-tag-rottnest', tag: -8, ort: ROTTNEST, reiseId: 'test-et-perth',
    text: je('Mit der Fähre nach Rottnest und einmal mit dem Rad um die Insel. Die Quokkas sind genauso frech wie auf den Fotos.',
      'Ferry to Rottnest and a bike lap around the island. The quokkas are just as cheeky as in the photos.'),
    felder: { distance_km: 42, temp_celsius: je('26 °C, windig', '26 °C, windy'), fly_factor: 2, stimmung: 5, connectivity: '1 Balken', verkehrsmittel: ['⛴️ Fähre'], highlight: je('Das Selfie mit dem Quokka', 'The quokka selfie'), sound_of_the_day: je('Fahrradklingeln und Möwen', 'Bike bells and gulls') },
    ausgaben: [['kosten_boot', 79, je('Fähre hin und zurück', 'Return ferry')], ['kosten_attraktion', 34, je('Fahrrad-Miete', 'Bike hire')], ['kosten_essen', 27.5, je('Mittagessen am Hafen', 'Lunch at the harbour')], ['kosten_unterkunft', 48, je('Stellplatz Perth', 'Campsite Perth')]],
    tiere: [['quokka', 11], ['seeloewe', 1]] },
  { id: 'test-tag-fremantle', tag: -7, ort: stop('Fremantle', -32.0569, 115.7439), reiseId: 'test-et-perth',
    text: je('Markt in Fremantle, Camper ausgerüstet, Sonnenhut gekauft. Morgen geht es endlich nach Norden.',
      'Fremantle markets, kitted out the camper, bought a sun hat. Tomorrow we finally head north.'),
    felder: { distance_km: 36, temp_celsius: je('25 °C, sonnig', '25 °C, sunny'), fly_factor: 1, stimmung: 4, connectivity: '4G/5G', essen: 'Flat White', essen_rating: 5 },
    ausgaben: [['kosten_kleidung', 65, je('Sonnenhut mit Nackenschutz', 'Sun hat with neck flap')], ['kosten_bedarf', 41.9, je('Sonnencreme, Fliegennetz', 'Sunscreen, fly net')], ['kosten_essen', 31, 'Flat White & Brunch'], ['kosten_sprit', 62, je('Volltanken', 'Full tank')]],
    tiere: [['pelikan', 3]] },
  { id: 'test-tag-pinnacles', tag: -6, ort: PINNACLES, reiseId: 'test-rt-coral',
    text: je('Kalksteinsäulen im Abendlicht, danach der klarste Sternenhimmel bisher. Niemand spricht, alle starren nach oben.',
      'Limestone pillars in the evening light, then the clearest night sky so far. Nobody talks, everyone just stares upwards.'),
    felder: { distance_km: 196, temp_celsius: je('27 °C, sonnig', '27 °C, sunny'), fly_factor: 3, stimmung: 5, connectivity: 'Kein Netz', verkehrsmittel: ['🚗 Auto'], roadkill_density: 'Niedrig', roadtrain_count: '4', night_sky: je('Die Milchstraße wirft fast Schatten.', 'The Milky Way almost casts a shadow.'), campfire_status: 'Erlaubt' },
    ausgaben: [['kosten_sprit', 96, je('Tanken in Cervantes', 'Fuel in Cervantes')], ['kosten_attraktion', 15, je('Eintritt Nationalpark', 'National park entry')], ['kosten_unterkunft', 41, je('Campingplatz Cervantes', 'Campsite Cervantes')]],
    tiere: [['kaenguru', 6], ['emu', 2]] },
  { id: 'test-tag-kalbarri', tag: -5, ort: KALBARRI, reiseId: 'test-rt-coral',
    text: je('Früh los zum Nature’s Window, bevor die Hitze kommt. Der Murchison River liegt tief unten in roter Schlucht.',
      'Early start for Nature’s Window before the heat sets in. The Murchison River lies far below in a red gorge.'),
    felder: { distance_km: 412, temp_celsius: je('33 °C, trocken', '33 °C, dry'), fly_factor: 4, stimmung: 4, connectivity: '1 Balken', verkehrsmittel: ['🚗 Auto'], roadkill_density: 'Mittel', roadtrain_count: '11', camp_kitchen_dish: je('Nudeln mit allem, was noch da ist', 'Pasta with whatever is left') },
    ausgaben: [['kosten_sprit', 88, je('Tanken in Geraldton', 'Fuel in Geraldton')], ['kosten_unterkunft', 44, je('Campingplatz Kalbarri', 'Campsite Kalbarri')], ['kosten_genuss', 19, je('Kaltes Bier am Fluss', 'Cold beer by the river')], ['kosten_lebensmittel', 58.3, je('Einkauf Geraldton', 'Groceries Geraldton')]],
    tiere: [['kaenguru', 9], ['goanna', 1]] },
  // Ein Eintrag für zwei Tage: Die Ausgaben zählen einmal
  { id: 'test-tag-monkey', tag: -4, bis: -3, ort: MONKEY_MIA, reiseId: 'test-rt-coral',
    text: je('Zwei Tage Shark Bay auf einmal nachgetragen, weil hier nichts drängt. Die Delfine kommen morgens bis ans Ufer, am Shell Beach knirscht es unter den Füßen.',
      'Two days of Shark Bay written up at once, because nothing is urgent here. The dolphins come right up to the shore in the morning, and Shell Beach crunches underfoot.'),
    felder: { distance_km: 438, temp_celsius: je('29 °C, Seewind', '29 °C, sea breeze'), fly_factor: 3, stimmung: 5, connectivity: '1 Balken', verkehrsmittel: ['🚗 Auto'], roadtrain_count: '6', expectation_vs_reality: je('Gedacht: Touristen. Gefunden: fünf Delfine und zwölf Menschen.', 'Expected tourists. Found five dolphins and twelve people.') },
    ausgaben: [['kosten_sprit', 102, je('Tanken in Overlander', 'Fuel at Overlander')], ['kosten_unterkunft', 96, je('Zwei Nächte Monkey Mia', 'Two nights Monkey Mia')], ['kosten_attraktion', 15, je('Eintritt Delfinbucht', 'Dolphin bay entry')], ['kosten_essen', 52, je('Abendessen mit Meerblick', 'Dinner with a sea view')], ['kosten_souvenir', 34, je('Muscheln aus Glas', 'Glass shells')]],
    tiere: [['delfin', 5], ['dugong', 1], ['schildkroete', 1], ['pelikan', 6]] },
  { id: 'test-tag-quobba', tag: -2, ort: QUOBBA, reiseId: 'test-rt-coral',
    text: je('Kein Netz, kein Empfang, nur Wind und die Blowholes, die das Meer meterhoch in die Luft schießen. Camp direkt an der Klippe.',
      'No signal, no reception, just wind and the blowholes firing the sea metres into the air. Camp right on the cliff.'),
    felder: { distance_km: 356, temp_celsius: je('31 °C, stürmisch', '31 °C, stormy'), fly_factor: 5, stimmung: 4, connectivity: 'Kein Netz', verkehrsmittel: ['🚗 Auto'], roadkill_density: 'Hoch', roadtrain_count: '17', shower_reality: je('Eine Flasche Wasser hinter dem Camper', 'One bottle of water behind the camper'), mcgyver_moment: je('Kühlschranktür mit Spanngurt gesichert.', 'Fridge door secured with a ratchet strap.') },
    ausgaben: [['kosten_sprit', 91, je('Tanken in Carnarvon', 'Fuel in Carnarvon')], ['kosten_unterkunft', 25, je('Buschcamp Quobba', 'Bush camp Quobba')], ['kosten_lebensmittel', 58, je('Wasser und Vorräte', 'Water and supplies')]],
    tiere: [['kaenguru', 4], ['dornteufel', 1], ['emu', 3]] },
  { id: 'test-tag-coral', tag: -1, ort: CORAL_BAY, reiseId: 'test-rt-coral',
    text: je('Mit dem Boot raus zum Ningaloo Reef und neben einem Walhai geschwommen. Fünf Meter ruhiger Riese, und wir strampeln hinterher. Tag der Reise.',
      'Out to Ningaloo Reef by boat and swam next to a whale shark. Five metres of calm giant with us paddling behind. Day of the trip.'),
    felder: { distance_km: 241, temp_celsius: je('30 °C, klar', '30 °C, clear'), fly_factor: 2, stimmung: 5, connectivity: '1 Balken', verkehrsmittel: ['🚤 Boot', '🚗 Auto'], color_palette: '#1a7a8a', highlight: je('Der Walhai', 'The whale shark'), thought_of_the_day: je('Heute reicht für lange.', 'Today will last a long time.') },
    ausgaben: [['kosten_attraktion', 420, je('Walhai-Tour Ningaloo', 'Ningaloo whale shark tour')], ['kosten_sprit', 76, je('Tanken in Minilya', 'Fuel at Minilya')], ['kosten_unterkunft', 44, je('Campingplatz Coral Bay', 'Campsite Coral Bay')], ['kosten_kamera', 129, je('Unterwassergehäuse', 'Underwater housing')]],
    tiere: [['walhai', 1], ['manta', 2], ['schildkroete', 3]] },
]

function logbuch(heute, stempel) {
  return LOGBUCH().map(({ id, tag, bis, ort, reiseId, text, felder, ausgaben, tiere }) => {
    const datum = plusTage(heute, tag)
    const liste = ausgaben.map(([kat, betrag, was], i) => ({ id: `${id}-a${i}`, kat, betrag, text: was }))
    return {
      id, datum, ...(bis != null ? { bis: plusTage(heute, bis) } : {}),
      ort: ort.name, lat: ort.lat, lon: ort.lon, ortId: ort.ortId || null, reiseId, legIdx: null, text, fotos: [], audios: [],
      felder: felderMitAusgaben({ waehrung: 'AUD', ...felder }, liste), ausgaben: liste, geaendert: stempel,
      sichtungen: tiere.map(([art, anzahl]) => ({ id: `${id}-${art}`, art, anzahl, ort: ort.name, lat: ort.lat, lon: ort.lon, zeit: `${datum}T09:00:00.000Z` })),
    }
  })
}

const fluglinie = () => je('Beispiel Air', 'Sample Air')

function termine(heute, abflug) {
  const zeit = uhrVon(abflug), linie = fluglinie()
  const nr = je('Beispielbuchung', 'Sample booking')
  return [
    { id: 'test-fl-hin', datum: plusTage(heute, -10), kat: 'flight', emoji: '✈️', titel: 'Frankfurt → Perth', sub: `${linie} ZZ901 · 21:15`, flugNr: 'ZZ901', zeit: '21:15', ref: 'ZZTEST', sitz: '34C', docs: [] },
    { id: 'test-camper', datum: plusTage(heute, -9), kat: 'camper', emoji: '🚐', titel: je('Camper-Übernahme', 'Camper pick-up'), sub: `Perth · ${nr}`, ref: 'CAMP-01', docs: [] },
    { id: 'test-hotel-perth', datum: plusTage(heute, -9), kat: 'hotel', emoji: '🏨', titel: je('Erste Nacht in Perth', 'First night in Perth'), sub: nr, ref: 'HOTEL-01', docs: [] },
    { id: 'test-tour-walhai', datum: plusTage(heute, -1), kat: 'tour', emoji: '🦈', titel: je('Walhai-Tour Ningaloo', 'Ningaloo whale shark tour'), sub: `Coral Bay · ${nr}`, ref: 'TOUR-01', docs: [] },
    { id: 'test-fl-karratha', datum: tagVon(abflug), kat: 'flight', emoji: '✈️', titel: 'Exmouth → Karratha', sub: `${linie} ZZ471 · ${zeit} · 7C`, flugNr: 'ZZ471', zeit, ref: 'ZZTEST', sitz: '7C', docs: [] },
    { id: 'test-mietwagen', datum: plusTage(heute, 1), kat: 'camper', emoji: '🚙', titel: je('Geländewagen in Karratha', '4WD in Karratha'), sub: nr, ref: 'CAR-02', docs: [] },
    { id: 'test-hotel-karijini', datum: plusTage(heute, 5), kat: 'hotel', emoji: '⛺', titel: je('Safarizelt in Karijini', 'Safari tent in Karijini'), sub: nr, ref: 'TENT-03', docs: [] },
    { id: 'test-fl-heim', datum: plusTage(heute, 10), kat: 'flight', emoji: '✈️', titel: 'Port Hedland → Perth → Frankfurt', sub: `${linie} ZZ318 / ZZ902 · 09:20`, flugNr: 'ZZ318', zeit: '09:20', ref: 'ZZTEST', sitz: '23A', docs: [] },
    { id: 'test-zug-heim', datum: plusTage(heute, 11), kat: 'train', emoji: '🚆', titel: je('Frankfurt Flughafen → Mainz', 'Frankfurt Airport → Mainz'), sub: 'ICE 100 · 17:05', zugNr: 'ICE100', bahnhof: 'Frankfurt(M) Flughafen Fernbf', zeit: '17:05', ref: 'BAHN-01', sitz: je('Wagen 7, Platz 21', 'Coach 7, seat 21'), docs: [] },
  ]
}

const zeitAm = (tag, uhr) => Date.parse(`${tag}T${uhr}:00`)

/** Erfundene Live-Daten: der nächste Flug 35 Minuten später mit Gate und Band, die Rückreise nach Plan. */
export function flugStaende(events, jetzt) {
  const termin = (id) => events.find((e) => e.id === id)
  const flug = termin('test-fl-karratha'), heim = termin('test-fl-heim'), zug = termin('test-zug-heim')
  const planAb = zeitAm(flug.datum, flug.zeit), neuAb = planAb + 35 * 60e3
  const planAn = planAb + 95 * 60e3, neuAn = planAn + 35 * 60e3
  const uhr = (ms) => uhrVon(new Date(ms))
  const staende = {
    'test-fl-karratha#ZZ471': { geholt: jetzt, leer: false, verlauf: [{ zeit: jetzt - 40 * 60e3, text: je('Gate 2 statt Gate 1', 'Gate 2 instead of gate 1') }, { zeit: jetzt - 40 * 60e3, text: je('35 Minuten später', '35 minutes later') }],
      daten: { status: 'Delayed', airline: fluglinie(), flugzeug: 'Dash 8-400',
        ab: { iata: 'LEA', ort: 'Exmouth', planDatum: flug.datum, planZeit: flug.zeit, planMs: planAb, neuZeit: uhr(neuAb), neuMs: neuAb, terminal: '1', gate: '2', schalter: '3', band: '', live: true },
        an: { iata: 'KTA', ort: 'Karratha', planDatum: flug.datum, planZeit: uhr(planAn), planMs: planAn, neuZeit: uhr(neuAn), neuMs: neuAn, terminal: '', gate: '', schalter: '', band: '2', live: true } } },
  }
  const leg = (nr, ab, an, tag, von, nach, airline = fluglinie()) => ({ geholt: jetzt, leer: false, verlauf: [], daten: { status: 'Expected', airline, flugzeug: 'A321',
    ab: { iata: ab, ort: von, planDatum: tag, planZeit: nr[0], planMs: zeitAm(tag, nr[0]), neuZeit: '', neuMs: null, terminal: '', gate: '', schalter: '', band: '', live: false },
    an: { iata: an, ort: nach, planDatum: tag, planZeit: nr[1], planMs: zeitAm(tag, nr[1]), neuZeit: '', neuMs: null, terminal: '', gate: '', schalter: '', band: '', live: false } } })
  staende['test-fl-heim#ZZ318'] = leg(['09:20', '11:50'], 'PHE', 'PER', heim.datum, 'Port Hedland', 'Perth')
  staende['test-fl-heim#ZZ902'] = leg(['13:40', '22:30'], 'PER', 'FRA', heim.datum, 'Perth', 'Frankfurt')
  staende['test-zug-heim#ICE100'] = { geholt: jetzt, leer: false, verlauf: [], daten: { status: 'OnTime', airline: '', flugzeug: 'ICE 100', hinweise: [],
    ab: { iata: '', ort: zug.bahnhof, planDatum: zug.datum, planZeit: zug.zeit, planMs: zeitAm(zug.datum, zug.zeit), neuZeit: '', neuMs: null, gleis: '7', gleisAlt: '', terminal: '', gate: '', schalter: '', band: '', live: false },
    an: { iata: '', ort: 'Mainz Hbf', planDatum: '', planZeit: '', planMs: null, neuZeit: '', neuMs: null, terminal: '', gate: '', schalter: '', band: '', live: false } } }
  return staende
}

/** Fester Standort für die Warnungen: heute morgen noch in Coral Bay, eine Probe-Warnung voraus. */
export const TEST_STANDORT = { aktiv: true, lat: CORAL_BAY.lat, lon: CORAL_BAY.lon, name: CORAL_BAY.name, probe: 'route' }

/** Die ganze Testreise als Backup-Stand. `jetzt` entscheidet über alle Daten. */
export function baueTestreise(jetzt = Date.now()) {
  const heute = tagVon(new Date(jetzt)), stempel = new Date(jetzt).toISOString()
  const tag = (n) => plusTage(heute, n)
  const abflug = naechsterFlug(jetzt)
  const etappe = (id, name, von, tage, farbe, stops = []) => ({ id, typ: 'etappe', name, von: tag(von), tage, art: 'auto', flug: false, farbe, imGesamtplan: true, stops, geaendert: stempel })
  const route = (id, etappeId, name, tage, farbe, stops, extra = {}) => ({ id, typ: 'route', etappeId, name, art: 'auto', farbe, tage, imGesamtplan: false, stops, geaendert: stempel, ...extra })
  const events = termine(heute, abflug)
  const wanderung = (id, name, datum, extra) => ({ id, name, datum, zeit: '', gebiet: '', km: '', dauerMin: '', hoehenmeter: '', schwierigkeit: 'mittel', art: 'rundweg', lat: null, lon: null, ortId: null, reiseId: null, beschreibung: '', wasser: '', besteZeit: '', status: 'geplant', bewertung: 0, fotos: [], geaendert: stempel, ...extra })
  const notiz = (id, typ, text, erledigt = false) => ({ id, typ, text, erledigt, ts: stempel, tsLokal: `${heute}T08:00`, geaendert: stempel })
  const haken = (ids) => Object.fromEntries(ids.map((id) => [id, { an: true, ts: stempel }]))
  const vorab = (id, text, kat, betrag, waehrung, tage, extra = {}) => ({ id, text, kat, betrag, waehrung, datum: tag(-TAGE_VORBEI - tage), geaendert: stempel, ...extra })
  const dokument = (id, typ, gueltigBis, notizText, erledigt = true) => ({ id, typ, nummer: '', gueltigBis, notiz: notizText, erledigt, geaendert: stempel })

  return {
    typ: 'wa-reiseplan-backup', version: 7, exportiert: stempel, testreise: true,
    gesamtStart: tag(-TAGE_VORBEI), reiseTage: REISE_TAGE, reiseBudget: 9000,
    daten: {
      coral_bay: { notiz: je('Früh zum Strand, ab 9 Uhr wird es voll.', 'Get to the beach early, it fills up from 9.'), geaendert: stempel },
      karijini_np: { notiz: je('Handtuch einpacken, im Fern Pool kann man baden.', 'Pack a towel, you can swim in Fern Pool.'), geaendert: stempel },
    },
    reisen: [
      etappe('test-et-perth', je('Ankommen in Perth', 'Arriving in Perth'), -9, 3, '#1a7a8a', [PERTH, ROTTNEST]),
      etappe('test-et-coral', 'Coral Coast', -6, 7, '#c1662f'),
      etappe('test-et-pilbara', je('Pilbara & Karijini', 'Pilbara & Karijini'), 1, 9, '#7a5c8e'),
      etappe('test-et-heim', je('Heimreise', 'Heading home'), 10, 2, '#5b7a3a', [HEDLAND]),
      route('test-rt-coral', 'test-et-coral', 'Coral Coast: Perth → Exmouth', 7, '#c1662f', [PERTH, PINNACLES, KALBARRI, MONKEY_MIA, QUOBBA, CORAL_BAY, EXMOUTH]),
      route('test-rt-flug', 'test-et-pilbara', 'Exmouth → Karratha', 1, '#2a6fb5', [LEARMONTH, KARRATHA], { art: 'flug', terminId: 'test-fl-karratha' }),
      route('test-rt-pilbara', 'test-et-pilbara', 'Karratha → Karijini → Port Hedland', 8, '#7a5c8e', [KARRATHA, MILLSTREAM, KARIJINI, MARBLE_BAR, HEDLAND]),
    ],
    eigeneOrte: [{ id: 'eigen-test-riff', name: je('Stellplatz am Riff (Beispiel)', 'Reef campsite (sample)'), lat: -23.205, lon: 113.757, abschnitt: 'Meine Orte', region: 'Meine Orte', tags: [], beschreibung: je('Von anderen Reisenden empfohlen. Nur mit Allrad.', 'Recommended by other travellers. 4WD only.'), emoji: '🏕️', mapsQuery: 'Coral Bay, Western Australia', bild: null, bildData: null, eigen: true, geaendert: stempel }],
    journal: logbuch(heute, stempel),
    quizAntworten: {},
    packliste: { checked: haken(['reserverad', 'wagenheber', 'maxtrax', 'kompressor', 'starthilfe']), custom: [] },
    notizen: [
      notiz('test-n1', 'einkaufen', je('20 Liter Wasser, Obst, Fliegennetz', '20 litres of water, fruit, fly net')),
      notiz('test-n2', 'routentips', je('Vor Minilya volltanken, danach kommt lange nichts.', 'Fill up before Minilya, nothing for a long way after that.')),
      notiz('test-n3', 'orga', je('Camper am letzten Tag bis 10 Uhr zurückgeben.', 'Return the camper by 10 am on the last day.')),
      notiz('test-n4', 'notiz', je('Sonnenbrille im Camp vergessen? Nein, auf dem Kopf.', 'Left the sunglasses at camp? No, on my head.'), true),
    ],
    wanderungen: [
      wanderung('test-wa-window', 'Nature’s Window Loop', tag(-5), { gebiet: 'Kalbarri NP', km: 1, dauerMin: 60, hoehenmeter: 40, schwierigkeit: 'leicht', lat: KALBARRI.lat, lon: KALBARRI.lon, ortId: KALBARRI.ortId, reiseId: 'test-rt-coral', status: 'gemacht', bewertung: 5, beschreibung: je('Kurz, heiß, jede Minute wert. Vor 8 Uhr starten.', 'Short, hot and worth every minute. Start before 8.') }),
      wanderung('test-wa-charles', 'Charles Knife Canyon', tag(0), { zeit: '16:30', gebiet: 'Cape Range NP', km: 4, dauerMin: 120, hoehenmeter: 120, art: 'hin-zurueck', lat: -22.06, lon: 114.02, ortId: 'charles_knife_canyon_shothole_canyon', reiseId: 'test-rt-coral', wasser: 2, beschreibung: je('Am Abend, wenn die Felsen rot leuchten.', 'In the evening when the rocks glow red.') }),
      wanderung('test-wa-dales', 'Dales Gorge', tag(5), { zeit: '07:30', gebiet: 'Karijini NP', km: 2, dauerMin: 150, hoehenmeter: 100, lat: KARIJINI.lat, lon: KARIJINI.lon, ortId: KARIJINI.ortId, reiseId: 'test-rt-pilbara', wasser: 2, beschreibung: je('Fortescue Falls und Fern Pool, früh starten.', 'Fortescue Falls and Fern Pool, start early.') }),
      wanderung('test-wa-bluff', 'Bluff Knoll', '', { gebiet: 'Stirling Range', km: 6, dauerMin: 180, hoehenmeter: 650, schwierigkeit: 'schwer', art: 'hin-zurueck', lat: -34.37461, lon: 118.2561, ortId: 'bluff_knoll', status: 'wunsch', beschreibung: je('Für die nächste Reise in den Süden.', 'For the next trip down south.') }),
    ],
    checkins: [{ id: 'test-ok1', ts: `${tag(-2)}T10:30:00.000Z`, tsLokal: `${tag(-2)}T18:30`, lat: QUOBBA.lat, lon: QUOBBA.lon, text: je('Alles gut, kein Netz bis morgen.', 'All good, no signal until tomorrow.') }],
    vorbereitung: { checked: haken(['flug', 'eta', 'versicherung', 'impfung', 'pass', 'fuehrerschein', 'kreditkarte', 'sim']), custom: [] },
    dokumente: [
      dokument('test-d1', 'Reisepass', tag(150), je('Beispiel: läuft bald ab', 'Sample: expires soon')),
      dokument('test-d2', 'eTA / Visum', tag(320), je('Beispiel', 'Sample')),
      dokument('test-d3', 'Auslandskrankenversicherung', tag(30), je('Beispiel', 'Sample')),
    ],
    vorabKosten: [
      vorab('test-v1', je('Flüge Frankfurt ⇄ Perth', 'Flights Frankfurt ⇄ Perth'), 'kosten_flug', 1460, 'EUR', 120, { terminId: 'test-fl-hin' }),
      vorab('test-v2', 'Exmouth → Karratha', 'kosten_flug', 289, 'AUD', 60, { terminId: 'test-fl-karratha' }),
      vorab('test-v3', je('Camper-Miete', 'Camper hire'), 'kosten_mietfahrzeug', 2140, 'EUR', 110),
      vorab('test-v4', je('Zug zum Flughafen und zurück', 'Train to the airport and back'), 'kosten_bahn', 58, 'EUR', 40, { terminId: 'test-zug-heim' }),
      vorab('test-v5', 'eTA', 'kosten_behoerde', 20, 'AUD', 90),
      vorab('test-v6', je('Drohne', 'Drone'), 'kosten_drohne', 799, 'EUR', 70),
    ],
    buchungen: { stand: stempel, von: tag(-TAGE_VORBEI), bis: tag(REISE_TAGE - TAGE_VORBEI - 1), persoenlich: [], events },
    grabsteine: {},
    skalarStand: {},
  }
}
