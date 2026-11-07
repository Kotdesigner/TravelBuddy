// „Großes Update“: einmal nach dem Update ein Fenster mit dem, was neu ist (seit 1.26).
// Nur für Nutzer, die die App schon kannten (Sprache oder Einführung gespeichert). Wer sie zum ersten
// Mal öffnet, bekommt kein Update-Fenster. Unter Mehr, „Updates“ lässt es sich jederzeit wieder öffnen.
// Je Gerät in localStorage. Für ein späteres großes Update nur UPDATE_VERSION und die Liste ändern.
export const UPDATE_VERSION = '1.28'
export const UPDATE_NAME = 'TravelBuddy Basic 1.28'
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
