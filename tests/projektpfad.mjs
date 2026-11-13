// Sucht eine private Datei (Sicherungen, Belege), die nicht im Repo liegt: im Projekt, eine
// Ebene höher und in einem Nachbarordner. Tests, die so eine Datei brauchen, überspringen
// sich, wenn sie fehlt.
import fs from 'node:fs'
export function projektDatei(rel) {
  const orte = ['../', '../../', '../../TravelBuddy_V3/'].map((p) => new URL(p + rel, import.meta.url).pathname)
  return orte.find((p) => fs.existsSync(p)) ?? orte[0]
}

/**
 * Eine Sicherung der App-Daten zum Testen. Gesucht wird erst die genannte Datei, dann die
 * neueste „WA-Reiseplan-Backup_*.json“ im Projekt oder daneben. So laufen die Tests weiter,
 * wenn eine alte Sicherung nicht mehr da ist.
 */
export function backupDatei(bevorzugt = '_Sicherung/App-Daten/WA-Reiseplan-Backup_2026-08-05-13.json') {
  const p = projektDatei(bevorzugt)
  if (fs.existsSync(p)) return p
  const ordner = ['../', '../../'].map((x) => new URL(x, import.meta.url).pathname)
  const treffer = []
  for (const o of ordner) {
    try { for (const f of fs.readdirSync(o)) if (/^WA-Reiseplan-Backup_.*\.json$/.test(f)) treffer.push(o + f) } catch {}
  }
  return treffer.sort().at(-1) || p
}
