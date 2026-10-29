// Datengetriebenes Schema fürs Roadtrip-Tagebuch.
// Feld-Typen: text | textlang | zahl | rating | dropdown | tags | toggle | farbe
// Widgets werden im Editor je nach Typ gerendert.
import { t } from './i18n.js'

export const MODULE = [
  {
    id: 'meta', titel: t('Quick-Stats'), icon: '📍', immer: true,
    felder: [
      { id: 'distance_km', label: t('Tageskilometer'), typ: 'zahl', icon: '🛣️', einheit: 'km' },
      { id: 'temp_celsius', label: t('Temperatur & Wetter'), typ: 'text', icon: '🌡️' },
      { id: 'fly_factor', label: t('Fliegen-Faktor'), typ: 'rating', icon: '🪰', max: 5, symbol: '🪰' },
      { id: 'connectivity', label: t('Empfang'), typ: 'toggle', icon: '📶',
        optionen: ['Kein Netz', '1 Balken', '4G/5G', 'Starlink'] },
      { id: 'soundtrack', label: t('Song / Playlist des Tages'), typ: 'text', icon: '🎵' },
      { id: 'stimmung', label: t('Stimmung'), typ: 'rating', icon: '😊', max: 5, symbol: '😊' },
      { id: 'roadkill_density', label: t('Roadkill-Dichte'), typ: 'dropdown', icon: '💀',
        optionen: ['Keine', 'Niedrig', 'Mittel', 'Hoch'] },
      { id: 'roadtrain_count', label: t('Road-Trains'), typ: 'text', icon: '🚛' },
    ],
  },
  {
    id: 'kosten', titel: t('Kosten & Verkehr'), icon: '💰',
    felder: [
      { id: 'waehrung', label: t('Währung der Beträge'), typ: 'dropdown', icon: '💱', optionen: ['AUD', 'EUR'] },
      { id: 'verkehrsmittel', label: t('Verkehrsmittel heute'), typ: 'tags', icon: '🚦',
        optionen: ['✈️ Flug', '🚗 Auto', '🚤 Boot', '⛴️ Fähre', '🚆 Bahn', '🚌 Bus'] },
      { id: 'kosten_flug', label: t('Flug'), typ: 'zahl', icon: '✈️', einheit: '€' },
      { id: 'kosten_unterkunft', label: t('Unterkunft'), typ: 'zahl', icon: '🏨', einheit: '€' },
      { id: 'kosten_sprit', label: t('Sprit / Tanken'), typ: 'zahl', icon: '⛽', einheit: '€' },
      { id: 'kosten_boot', label: t('Boot / Fähre'), typ: 'zahl', icon: '🚤', einheit: '€' },
      { id: 'kosten_bahn', label: t('Bahn / Bus'), typ: 'zahl', icon: '🚆', einheit: '€' },
      { id: 'kosten_attraktion', label: t('Attraktionen / Touren'), typ: 'zahl', icon: '🎟️', einheit: '€' },
      { id: 'kosten_sonstiges', label: t('Sonstiges'), typ: 'zahl', icon: '🛒', einheit: '€' },
      // Short-Values (laufender Konsum)
      { id: 'kosten_lebensmittel', label: t('Lebensmittel'), typ: 'zahl', icon: '🍎', einheit: '€' },
      { id: 'kosten_genuss', label: t('Genussmittel'), typ: 'zahl', icon: '🍺', einheit: '€' },
      { id: 'kosten_bedarf', label: t('Täglicher Bedarf'), typ: 'zahl', icon: '🧴', einheit: '€' },
      { id: 'kosten_telefon', label: t('Telefon'), typ: 'zahl', icon: '📱', einheit: '€' },
      { id: 'kosten_internet', label: t('Internet'), typ: 'zahl', icon: '🌐', einheit: '€' },
      // Long-Values (Anschaffungen)
      { id: 'kosten_drohne', label: t('Drohne'), typ: 'zahl', icon: '🚁', einheit: '€' },
      { id: 'kosten_kamera', label: t('Kamera'), typ: 'zahl', icon: '📷', einheit: '€' },
      { id: 'kosten_kleidung', label: t('Kleidung'), typ: 'zahl', icon: '👕', einheit: '€' },
      { id: 'kosten_souvenir', label: t('Souvenirs'), typ: 'zahl', icon: '🎁', einheit: '€' },
    ],
  },
  {
    id: 'sinne', titel: t('Sinneseindrücke & Atmosphäre'), icon: '👃',
    felder: [
      { id: 'sound_of_the_day', label: t('Der Sound heute war …'), typ: 'textlang', icon: '🔊' },
      { id: 'scent_of_the_day', label: t('Ich rieche sofort wieder …'), typ: 'textlang', icon: '👃' },
      { id: 'color_palette', label: t('Dominierende Farbe'), typ: 'farbe', icon: '🎨' },
      { id: 'weather_feeling', label: t('Gefühlte Hitze / Luft / Wind'), typ: 'textlang', icon: '💨' },
    ],
  },
  {
    id: 'strasse', titel: t('Straßenrand & Wildlife'), icon: '🦘',
    felder: [
      { id: 'roadside_sightings', label: t('Lebend gesehen'), typ: 'tags', icon: '👀',
        optionen: ['🦘 Känguru', '🦤 Emu', '🦅 Greifvogel', '🐊 Krokodil', '🐍 Schlange', '🦎 Goanna', '🐄 Vieh', '🦜 Kakadu', '🐫 Kamel', '🐕 Dingo'] },
      { id: 'roadkill_counts', label: t('Roadkill zählen (je Tier)'), typ: 'counter', icon: '💀',
        optionen: [
          { label: 'Känguru', emoji: '🦘' }, { label: 'Wombat', emoji: '🦫' }, { label: 'Dingo', emoji: '🐕' },
          { label: 'Esel', emoji: '🫏' }, { label: 'Schlange', emoji: '🐍' }, { label: 'Kamel', emoji: '🐫' },
          { label: 'Emu', emoji: '🦤' }, { label: 'Echse', emoji: '🦎' }, { label: 'Vieh', emoji: '🐄' },
          { label: 'Fuchs', emoji: '🦊' }, { label: 'Vogel', emoji: '🐦' }, { label: 'Sonstiges', emoji: '🐾' },
        ] },
      { id: 'roadkill_memorial', label: t('Trauriges / Auffälliges (Text)'), typ: 'textlang', icon: '🥀' },
      { id: 'roadside_junk', label: t('Kuriositäten am Straßenrand zählen'), typ: 'counter', icon: '🗿',
        optionen: [
          { label: 'Big Thing', emoji: '🗿' }, { label: 'Skurriler Briefkasten', emoji: '📮' }, { label: 'Schuh-Zaun', emoji: '👟' },
          { label: 'Rostlaube', emoji: '🚗' }, { label: 'Statue', emoji: '🗽' }, { label: 'Kuriose Warnung', emoji: '🪧' },
          { label: 'Sonstiges', emoji: '❓' },
        ] },
      { id: 'roadside_humor', label: t('Kurioses (Text)'), typ: 'textlang', icon: '😄' },
      { id: 'infrastructure_isolation', label: t('Abgeschiedenheit / nächster Stopp'), typ: 'textlang', icon: '⛽' },
    ],
  },
  {
    id: 'vanlife', titel: t('Vanlife-Alltag'), icon: '🚐',
    felder: [
      { id: 'daily_challenge', label: t('Was die Fotos nicht zeigen'), typ: 'textlang', icon: '😤' },
      { id: 'camp_kitchen_dish', label: t('Auf dem Gaskocher gekocht'), typ: 'text', icon: '🍳' },
      { id: 'food_rating', label: t('Geschmack'), typ: 'rating', icon: '😋', max: 10, symbol: '⭐' },
      { id: 'camp_highlight', label: t('Warum der Stellplatz besonders war'), typ: 'textlang', icon: '🏕️' },
    ],
  },
  {
    id: 'netz', titel: t('Netz, Wasser & Notfall'), icon: '📡',
    felder: [
      { id: 'offgrid_experience', label: t('Ohne Handy gemacht'), typ: 'textlang', icon: '📴' },
      { id: 'shower_reality', label: t('Wie/wo geduscht'), typ: 'text', icon: '🚿' },
      { id: 'water_source', label: t('Trinkwasser aufgefüllt bei'), typ: 'text', icon: '💧' },
    ],
  },
  {
    id: 'pannen', titel: t('Pannen & Outback-Härte'), icon: '🔧',
    felder: [
      { id: 'mcgyver_moment', label: t('Improvisiert (Tape, Kabelbinder, WD-40)'), typ: 'textlang', icon: '🛠️' },
      { id: 'dust_invasion', label: t('Wo der rote Staub gelandet ist'), typ: 'textlang', icon: '🟥' },
    ],
  },
  {
    id: 'himmel', titel: t('Himmel & Nachtleben'), icon: '🌌',
    felder: [
      { id: 'night_sky', label: t('Kreuz des Südens / Milchstraße?'), typ: 'textlang', icon: '✨' },
      { id: 'night_sounds', label: t('Geräusche der Nacht'), typ: 'textlang', icon: '🌙' },
      { id: 'campfire_status', label: t('Lagerfeuer'), typ: 'dropdown', icon: '🔥',
        optionen: ['Lagerfeuer gemacht', 'Feuerverbot (Ban)', 'kein Feuer'] },
    ],
  },
  {
    id: 'warnung', titel: t('Warnschilder & Gefahren'), icon: '⚠️',
    felder: [
      { id: 'warning_sign_of_the_day', label: t('Kuriosestes/gruseligstes Schild'), typ: 'textlang', icon: '🪧' },
      { id: 'hazards_faced', label: t('Gefahren begegnet'), typ: 'tags', icon: '☠️',
        optionen: ['🌊 Strömung (Rip)', '🌊 Gezeiten', '🐍 Schlangen', '🐊 Krokodile', '🕷️ Spinnen', '🔥 Hitze', '🌪️ Staubsturm'] },
      // Wird vom Knopf „Amtliche Lage übernehmen" im Kopf des Reisetages befüllt:
      // wortwörtlich das, was DFES/VicEmergency/QFD an dem Tag gemeldet haben,
      // mit Zeitstempel. Frei überschreibbar — es ist dein Logbuch.
      { id: 'amtliche_lage', label: t('Amtliche Lage (Behörden)'), typ: 'textlang', icon: '🏛️' },
    ],
  },
  {
    id: 'begegnung', titel: t('Begegnungen & Aussie-Kultur'), icon: '🤝',
    felder: [
      { id: 'aussie_slang', label: t('Gelerntes Aussie-Wort'), typ: 'text', icon: '🗣️' },
      { id: 'encounter_story', label: t('Nette / skurrile Begegnung'), typ: 'textlang', icon: '👋' },
      { id: 'local_tip', label: t('Geheimtipp von Locals'), typ: 'textlang', icon: '💡' },
    ],
  },
  {
    id: 'reflexion', titel: t('Reflexion & Fazit'), icon: '💭',
    zitat: true, // im Ansichtsmodus als Zitat-Block
    felder: [
      { id: 'expectation_vs_reality', label: t('Dachte X, war aber Y'), typ: 'textlang', icon: '🔄' },
      { id: 'favorite_detail', label: t('Highlight abseits der Touristen'), typ: 'textlang', icon: '💎' },
      { id: 'thought_of_the_day', label: t('Gedanke des Tages'), typ: 'textlang', icon: '🧘' },
      { id: 'dankbar', label: t('Wofür ich heute dankbar bin'), typ: 'textlang', icon: '🙏' },
    ],
  },

  // ---- Aus dem früheren Ostküsten-Logbuch übernommen ----
  // Stehen jetzt an jedem Reisetag zur Verfügung, egal ob Outback oder Küste.
  {
    id: 'menschen', titel: t('Menschen & Wiedersehen'), icon: '👥',
    felder: [
      { id: 'wen_getroffen', label: t('Wen getroffen'), typ: 'textlang', icon: '🤝' },
      { id: 'neue_leute', label: t('Neue Leute kennengelernt'), typ: 'textlang', icon: '👋' },
      { id: 'schoenste_begegnung', label: t('Schönster Moment mit jemandem'), typ: 'textlang', icon: '💛' },
    ],
  },
  {
    id: 'erinnerung', titel: t('Erinnerungen — früher ↔ heute'), icon: '💭',
    felder: [
      { id: 'frueher_heute', label: t('Was sich verändert hat'), typ: 'textlang', icon: '🔄' },
      { id: 'damals', label: t('Daran erinnere ich mich von damals'), typ: 'textlang', icon: '📼' },
    ],
  },
  {
    id: 'erlebnis', titel: t('Erlebnisse & Highlights'), icon: '✨',
    felder: [
      { id: 'highlight', label: t('Highlight des Tages'), typ: 'textlang', icon: '🌟' },
      { id: 'anlass', label: t('Besonderer Anlass'), typ: 'text', icon: '🎉' },
      { id: 'aktivitaet', label: t('Aktivität / Unternehmung'), typ: 'text', icon: '🎯' },
    ],
  },
  {
    id: 'insel', titel: t('Insel, Strand & Natur'), icon: '🏝️',
    felder: [
      { id: 'insel_tag', label: 'Insel-/Strandtag', typ: 'textlang', icon: '🏖️' },
      { id: 'wasser', label: t('Im Wasser gesehen (Schnorcheln/Tauchen)'), typ: 'textlang', icon: '🐠' },
      { id: 'sonnenuntergang', label: t('Sonnenuntergang / Nachthimmel'), typ: 'textlang', icon: '🌅' },
    ],
  },
  {
    id: 'genuss', titel: t('Essen & Genuss'), icon: '🍽️',
    felder: [
      { id: 'essen', label: t('Bestes Essen / Restaurant'), typ: 'text', icon: '😋' },
      { id: 'essen_rating', label: t('Geschmack'), typ: 'rating', icon: '⭐', max: 5, symbol: '⭐' },
      { id: 'drink', label: t('Drink des Tages'), typ: 'text', icon: '🍹' },
    ],
  },
]

// Schnellzugriff auf ein Feld per id (für Ansicht/Zeitleiste).
export const FELD = {}
for (const m of MODULE) for (const f of m.felder) FELD[f.id] = { ...f, modul: m.id }

// Felder für die Header-Quick-Stats-Leiste.
export const QUICKSTATS = ['distance_km', 'temp_celsius', 'fly_factor', 'connectivity', 'soundtrack']

// Felder am Eintrag selbst (nicht in `felder`), alle optional und rückwärtskompatibel:
//   fotos      ['data:…']                       wie bisher, nur Bilddaten
//   fotoMeta   [{ k, quelle, zeit, lat, lon, ort, ortId, km }]   Aufnahmeort und -zeit je Foto,
//              über den Fingerabdruck `k` mit dem Foto verbunden (foto-zuordnung.js)
//   sichtungen [{ id, art, name, anzahl, ort, lat, lon, notiz, foto }]   Tierwelt (tierwelt.js)
export const EINTRAG_ZUSATZFELDER = ['fotoMeta', 'sichtungen']
