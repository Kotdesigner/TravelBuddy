// Kuratierte Packliste für eine Solo-Outback-Autoreise (WA/Australien).
// Umfangreich, aber bewusst nicht überladen. krit:true = überlebenswichtig im Outback.
import { t, jeSprache } from './i18n.js'
export const PACK_VORLAGE = jeSprache(() => ([
  {
    id: 'fahrzeug', titel: t('Fahrzeug & Recovery'), icon: '🚙',
    items: [
      { id: 'reserverad', text: t('2 Reserveräder (Outback!)'), krit: true },
      { id: 'wagenheber', text: t('Wagenheber + stabiles Brett als Unterlage') },
      { id: 'maxtrax', text: t('Bergehilfen / MaxTrax (Sandbleche)'), krit: true },
      { id: 'bergegurt', text: t('Bergegurt + Schäkel') },
      { id: 'kompressor', text: t('12V-Kompressor + Reifendruckmesser'), krit: true },
      { id: 'reifenreparatur', text: t('Reifen-Reparaturset (Plugs)') },
      { id: 'starthilfe', text: t('Starthilfekabel oder Jump-Starter') },
      { id: 'fluessigkeiten', text: t('Motoröl, Kühlmittel, Bremsflüssigkeit') },
      { id: 'ersatzteile', text: t('Keilriemen, Schläuche, Sicherungen, Glühbirnen') },
      { id: 'sprit', text: t('Reserve-Treibstoff (Jerrycans) — Reichweite 600+ km'), krit: true },
    ],
  },
  {
    id: 'wasser', titel: t('Wasser & Verpflegung'), icon: '💧',
    items: [
      { id: 'wasser_haupt', text: t('Wasser: mind. 10 L / Person / Tag + Reserve'), krit: true },
      { id: 'wassertank', text: t('Zusatz-Wassertank / Kanister') },
      { id: 'wasserfilter', text: t('Wasserfilter / Entkeimungstabletten') },
      { id: 'trinkflasche', text: t('Trinkflasche / Trinkblase') },
      { id: 'kuehlbox', text: t('Kühlbox / 12V-Kompressorkühlschrank') },
      { id: 'vorraete', text: t('Trockenvorräte & Konserven (mehrtägig)') },
      { id: 'notration', text: t('Eiserne Notration'), krit: true },
      { id: 'elektrolyte', text: t('Elektrolyte / Rehydrationssalze') },
    ],
  },
  {
    id: 'navi', titel: t('Navigation & Kommunikation'), icon: '🧭',
    items: [
      { id: 'plb', text: t('Satelliten-Kommunikator / PLB (Garmin inReach)'), krit: true },
      { id: 'offline_karten', text: t('Offline-Karten / GPS (+ diese App)') },
      { id: 'papierkarte', text: t('Papierkarte (Hema Outback) als Backup'), krit: true },
      { id: 'uhf', text: t('UHF-Funk (Truck-Kommunikation)') },
      { id: 'handy', text: t('Handy + KFZ-Halterung + Ladekabel') },
      { id: 'kompass', text: t('Kompass') },
      { id: 'reiseplan', text: t('Reiseplan bei Freund/Ranger hinterlegt'), krit: true },
    ],
  },
  {
    id: 'strom', titel: t('Strom & Elektronik'), icon: '⚡',
    items: [
      { id: 'zweitbatterie', text: t('Zweitbatterie / Dual-Battery-System') },
      { id: 'solar', text: t('Solarpanel + Laderegler') },
      { id: 'powerbank', text: t('Große Powerbank') },
      { id: 'stirnlampe', text: t('Stirnlampe + Ersatzbatterien'), krit: true },
      { id: 'taschenlampe', text: t('Taschenlampe / Campinglaterne') },
      { id: 'kabel', text: t('12V-Ladeadapter, Kabel, Mehrfach-USB') },
    ],
  },
  {
    id: 'gesundheit', titel: t('Gesundheit & Erste Hilfe'), icon: '🩹',
    items: [
      { id: 'erstehilfe', text: t('Umfangreiches Erste-Hilfe-Set'), krit: true },
      { id: 'schlangenbiss', text: t('Druckverband gegen Schlangenbiss'), krit: true },
      { id: 'medikamente', text: t('Persönliche Medikamente + Schmerzmittel') },
      { id: 'sonnencreme', text: t('Sonnencreme LSF 50+'), krit: true },
      { id: 'insektenschutz', text: t('Insektenschutz (DEET)') },
      { id: 'fliegennetz', text: t('Fliegennetz fürs Gesicht (Outback-Fliegen!)'), krit: true },
      { id: 'rettungsdecke', text: t('Rettungsdecke') },
      { id: 'blasenpflaster', text: t('Blasenpflaster, Desinfektion') },
    ],
  },
  {
    id: 'werkzeug', titel: t('Werkzeug & Reparatur'), icon: '🧰',
    items: [
      { id: 'multitool', text: t('Multitool / Klappmesser') },
      { id: 'panzertape', text: t('Panzertape / Gaffa'), krit: true },
      { id: 'kabelbinder', text: t('Kabelbinder (versch. Größen)') },
      { id: 'draht', text: t('Draht + WD-40') },
      { id: 'werkzeugset', text: t('Grund-Werkzeugset (Schlüssel, Zange, Schrauber)') },
      { id: 'spaten', text: t('Klappspaten'), krit: true },
      { id: 'feuerloescher', text: t('Feuerlöscher'), krit: true },
      { id: 'handschuhe', text: t('Arbeitshandschuhe') },
    ],
  },
  {
    id: 'camp', titel: t('Schlafen & Camp'), icon: '🏕️',
    items: [
      { id: 'zelt', text: t('Dachzelt / Zelt / Swag') },
      { id: 'schlafsack', text: t('Schlafsack (Wüstennächte kühl!)') },
      { id: 'matte', text: t('Iso-/Luftmatte + Kissen') },
      { id: 'moskitonetz', text: t('Moskitonetz') },
      { id: 'kocher', text: t('Gaskocher + Kartuschen'), krit: true },
      { id: 'geschirr', text: t('Topf, Pfanne, Besteck, Geschirr') },
      { id: 'stuhl', text: t('Campingstuhl + Klapptisch') },
      { id: 'feuerzeug', text: t('Feuerzeug + Streichhölzer (wasserdicht)') },
    ],
  },
  {
    id: 'kleidung', titel: t('Kleidung'), icon: '👕',
    items: [
      { id: 'hut', text: t('Sonnenhut (breite Krempe)'), krit: true },
      { id: 'sonnenbrille', text: t('Sonnenbrille') },
      { id: 'lang', text: t('Leichte lange Kleidung (Sonnen-/Fliegenschutz)') },
      { id: 'warm', text: t('Fleece / Warmes für die Nacht') },
      { id: 'regen', text: t('Regenjacke') },
      { id: 'schuhe', text: t('Feste Schuhe + Sandalen') },
      { id: 'badesachen', text: t('Badesachen & Schnelltrocken-Handtuch') },
    ],
  },
  {
    id: 'hygiene', titel: t('Hygiene & Umwelt'), icon: '🧴',
    items: [
      { id: 'klopapier', text: t('Toilettenpapier + Klappspaten (Leave No Trace)') },
      { id: 'seife', text: t('Bio-Seife, Zahnbürste, Zahnpasta') },
      { id: 'handdesinfektion', text: t('Handdesinfektion / Feuchttücher') },
      { id: 'muellbeutel', text: t('Müllbeutel (alles wieder mitnehmen)'), krit: true },
      { id: 'handtuch', text: t('Mikrofaser-Handtuch') },
    ],
  },
  {
    id: 'dokumente', titel: t('Dokumente & Geld'), icon: '📄',
    items: [
      { id: 'pass', text: t('Reisepass + Visum'), krit: true },
      { id: 'fuehrerschein', text: t('Führerschein + internationaler FS') },
      { id: 'fahrzeugpapiere', text: t('Fahrzeugpapiere & Versicherung') },
      { id: 'permits', text: t('Park-Pass / Permits (DBCA, Rio-Tinto-Road)'), krit: true },
      { id: 'bargeld', text: t('Bargeld (AUD) + Kreditkarte') },
      { id: 'kopien', text: t('Kopien/Scans aller Dokumente (offline + Cloud)') },
    ],
  },
]))
