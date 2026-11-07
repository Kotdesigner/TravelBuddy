// „Großes Update“: einmal nach dem Update ein Fenster mit dem, was neu ist.
// Nur für Nutzer, die schon eine ältere Version hatten (Sprache oder Einführung gespeichert).
// Wer die App zum ersten Mal öffnet, bekommt die Einführung, kein Update-Fenster.
// Je Gerät in localStorage. Für ein späteres großes Update nur UPDATE_VERSION und die Liste ändern.
export const UPDATE_VERSION = '1.26'
export const UPDATE_KEY = 'tb-update-gesehen'
const SPUREN = ['wa-sprache', 'tb-einfuehrung-v1']

const speicher = () => { try { return globalThis.localStorage || null } catch { return null } }
const lies = (ls, k) => { try { return ls?.getItem(k) ?? null } catch { return null } }
const schreib = (ls, k, v) => { try { ls?.setItem(k, v) } catch {} }

/** Beim Start aufrufen, BEVOR die Sprachfrage etwas speichert. */
export function updateZeigen(ls = speicher()) {
  if (!ls) return false
  if (lies(ls, UPDATE_KEY) === UPDATE_VERSION) return false
  const bisher = SPUREN.some((k) => lies(ls, k) != null)
  if (!bisher) { schreib(ls, UPDATE_KEY, UPDATE_VERSION); return false }
  return true
}

export function updateGesehen(ls = speicher()) { schreib(ls, UPDATE_KEY, UPDATE_VERSION) }
