// Sucht eine private Datei (Sicherungen, Belege), die nicht im Repo liegt: im Projekt, eine
// Ebene höher und in einem Nachbarordner. Tests, die so eine Datei brauchen, überspringen
// sich, wenn sie fehlt.
import fs from 'node:fs'
export function projektDatei(rel) {
  const orte = ['../', '../../', '../../TravelBuddy_V3/'].map((p) => new URL(p + rel, import.meta.url).pathname)
  return orte.find((p) => fs.existsSync(p)) ?? orte[0]
}
