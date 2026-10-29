// Sicherungen, Nachträge und Belege liegen einmal in TravelBuddy_V3 (nicht doppelt kopiert).
// Diese Hilfe sucht eine Datei im eigenen Projekt, eine Ebene höher (V4/V5 liegen in V3)
// und neben V3 (V6 liegt in 00_Planung).
import fs from 'node:fs'
export function projektDatei(rel) {
  const orte = ['../', '../../', '../../TravelBuddy_V3/'].map((p) => new URL(p + rel, import.meta.url).pathname)
  return orte.find((p) => fs.existsSync(p)) ?? orte[0]
}
