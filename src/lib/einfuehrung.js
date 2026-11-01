// Einführung beim ersten Öffnen. Hier nur der Stand und die Regeln,
// die Oberfläche steht in Einfuehrung.svelte. Je Gerät in localStorage, nicht im Backup.
import { writable } from 'svelte/store'

export const KEY = 'tb-einfuehrung-v1'
export const SCHRITTE = ['willkommen', 'start', 'begriffe', 'etappe', 'buchung', 'dokumente', 'orte', 'logbuch', 'sichern']

/** Gespeicherten Stand prüfen: { schritt, fertig } oder null (noch nie gestartet). */
export function bereinige(roh) {
  if (!roh || typeof roh !== 'object') return null
  const s = Number.isInteger(roh.schritt) ? Math.min(Math.max(roh.schritt, 0), SCHRITTE.length - 1) : 0
  return { schritt: s, fertig: !!roh.fertig }
}

/**
 * Soll die Einführung beim Start erscheinen?
 * Noch nie gestartet: nur, wenn die App leer ist (wer ein Backup mitbringt, kennt sie schon).
 * Angefangen und nicht fertig (z. B. nach dem Sprachwechsel, der neu lädt): weitermachen.
 */
export function sollZeigen(stand, leer) {
  if (stand) return !stand.fertig
  return !!leer
}

/** Ist die App leer? Zahlen aus datenStand() und die Zahl der Buchungen. */
export const istLeer = (stand = {}, buchungen = 0) =>
  !buchungen && !Object.values(stand).some((n) => typeof n === 'number' && n > 0)

export function lies() {
  try { return bereinige(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return null }
}
export function merke(stand) {
  try { localStorage.setItem(KEY, JSON.stringify(stand)) } catch {}
}

/** Offen: { schritt, pause }. pause: null, 'blatt' (ein Neu-Blatt ist offen) oder 'seite' (Nutzer schaut sich um). */
export const einfuehrung = writable(null)

/** Mehr → „Einführung noch einmal“ */
export function einfuehrungStarten() {
  merke({ schritt: 0, fertig: false })
  einfuehrung.set({ schritt: 0, pause: null })
}
