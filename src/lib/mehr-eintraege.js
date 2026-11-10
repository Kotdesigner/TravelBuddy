// Die Seiten unter „Mehr“ mit Zeichen, Namen und Kurztext, gemeinsam für die Mehr-Seite und das
// iPhone-Blatt (MehrUebersicht.svelte). Reihenfolge wie REIHENFOLGE in mehr-gruppen.js.
// Jeder Punkt aus UNTER.mehr in App.svelte muss hier stehen (tests/mehr-blatt.test.mjs), sonst fehlt er
// am iPhone im Hochformat: dort gibt es keine Seitenleiste.
import { t, je } from './i18n.js'

export function mehrEintraege() {
  return [
    { id: 'notfall', icon: '🆘', label: t('Notfall'), info: je('Notrufe, dein Standort', 'Emergency calls, your location'), rot: true },
    { id: 'gefahren', icon: '⚠️', label: t('Gefahrenlage'), info: je('Warnungen, Sperrungen', 'Warnings, closures') },
    { id: 'buchungen', icon: '🎫', label: je('Buchungen', 'Bookings'), info: je('mit Flügen und Belegen', 'with flights and documents') },
    { id: 'fluege', icon: '✈️', label: t('Flüge & Bahn'), info: t('Status, Gate, Gleis und Verspätung') },
    { id: 'kosten', icon: '💰', label: t('Kosten'), info: je('je Etappe und Tag', 'per leg and day') },
    { id: 'vorbereitung', icon: '🧳', label: t('Reisevorbereitung'), info: je('Checkliste, Dokumente, Packliste', 'Checklist, documents, packing list') },
    { id: 'packliste', icon: '🎒', label: t('Packliste'), info: t('Zum Abhaken, fürs Outback') },
    { id: 'praxis', icon: '🛠️', label: t('Praxis & Sicherheit'), info: je('Permits, Tanken, Reifen, Buschfeuer', 'Permits, fuel, tyres, bushfires') },
    { id: 'meldungen', icon: '📣', label: je('Meldungen', 'Reports'), info: je('Wege, Tiere, Tanken: was andere unterwegs melden', 'Roads, wildlife, fuel: what others report on the road') },
    { id: 'verbinden', icon: '🤝', label: je('Unterwegs verbinden', 'Connect on the road'), info: je('Kontakt-Code, Kontakte von unterwegs', 'Contact code, contacts from the road') },
    { id: 'teilen', icon: '📤', label: t('Reisebericht teilen'), info: je('für Familie und Freunde, als Datei', 'for family and friends, as a file') },
    { id: 'funfacts', icon: '💡', label: je('Fun Facts', 'Fun facts'), info: je('Wissenswertes da, wo du bist', 'Facts about where you are') },
    { id: 'musik', icon: '🎵', label: t('Musik unterwegs'), info: t('Sounds of the Road, Musik aus der Gegend') },
    { id: 'quiz', icon: '🇦🇺', label: t('Australien-Quiz'), info: t('Fragen mit Stufen vom Touri zum Local') },
  ]
}

/** Unter „App und Einstellungen“ zusätzlich: Seiten ohne Chip und das Update-Fenster. Gleich auf Mehr-Seite und iPhone-Blatt. */
export function appEintraege() {
  return [
    { id: 'backup', icon: '💾', label: je('Backup & Import', 'Backup & import'), info: je('Alles als Datei sichern und auf ein anderes Gerät bringen', 'Save everything as a file and move it to another device') },
    { id: 'design', icon: '🎨', label: t('Design'), info: je('Hell und Dunkel, Sprache, Schrift, Effekte', 'Light and dark, language, text, effects') },
    { id: 'handbuch', icon: '📖', label: t('Handbuch'), info: je('Alles zur App zum Nachlesen, auch als PDF', 'Everything about the app to read, also as PDF') },
    { id: 'updates', icon: '📋', label: je('Updates', 'Updates'), info: je('Was in der letzten Version neu ist', 'What’s new in the latest version') },
  ]
}

/**
 * Basic: Aktionen unter „App und Einstellungen“ (wie früher unten im iPhone-Blatt und in der Seitenleiste).
 * „App einrichten“ und „Testreise“ nur, wenn sie gerade passen (install.js, testreise-dienst.js).
 */
export function basicAktionen({ einrichten = false, testreise = false, testreiseAn = false } = {}) {
  return [
    { id: 'einfuehrung', icon: '🧭', label: t('Einführung noch einmal'), info: je('Die Schritte vom ersten Öffnen', 'The steps from the first start') },
    ...(einrichten ? [{ id: 'einrichten', icon: '📲', label: je('App einrichten', 'Set up the app'), info: je('Auf den Home-Bildschirm oder als App am Computer', 'On the home screen or as an app on the computer') }] : []),
    ...(testreise ? [{ id: 'testreise', icon: '🧪', label: testreiseAn ? t('Testreise beenden') : t('Testreise ausprobieren'), info: testreiseAn ? je('Zurück zu deinen eigenen Daten', 'Back to your own data') : je('Eine ausgedachte Reise zum Ausprobieren', 'A made-up trip to try things out') }] : []),
  ]
}
