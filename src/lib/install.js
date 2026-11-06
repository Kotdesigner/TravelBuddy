// Hinweis „Zum Home-Bildschirm“. Eine Webseite darf sich auf dem iPhone nicht selbst
// installieren, das geht nur über Teilen → „Zum Home-Bildschirm“. Die App erklärt das einmal,
// bevor jemand in Safari etwas einträgt: Safari und Home-Bildschirm haben getrennte Speicher.
// Android und Chrome am Rechner bieten einen eigenen Knopf (beforeinstallprompt).
import { writable } from 'svelte/store'

export const KEY = 'tb-install-hinweis-v1'

/** iPhone oder iPad? iPadOS meldet sich wie ein Mac, hat aber Touch. */
export function istIOS({ ua = '', platform = '', touch = 0 } = {}) {
  return /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touch > 1) || (/Macintosh/.test(ua) && touch > 1)
}

/**
 * Welcher Hinweis passt? 'ios', 'knopf' (Browser bietet Installieren an) oder null.
 * Nichts zeigen, wenn die App schon vom Home-Bildschirm läuft oder der Hinweis erledigt ist.
 */
export function hinweisArt({ ua = '', platform = '', touch = 0, standalone = false, erledigt = false, knopf = false } = {}) {
  if (standalone || erledigt) return null
  if (istIOS({ ua, platform, touch })) return 'ios'
  // Den Knopf nur auf Handy und Tablet anbieten, am Rechner wäre er eher lästig
  return knopf && touch > 0 ? 'knopf' : null
}

export function erledigt() {
  try { return localStorage.getItem(KEY) === 'fertig' } catch { return false }
}
export function merkeErledigt() {
  try { localStorage.setItem(KEY, 'fertig') } catch {}
}

export const laeuftAlsApp = () =>
  (typeof navigator !== 'undefined' && navigator.standalone === true) ||
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)

/** Offen, solange der Hinweis zu sehen ist. Die Einführung wartet so lange. */
export const installOffen = writable(false)

/** Android und Chrome merken sich das Angebot zum Installieren, wir zeigen es im Hinweis. */
export const installAngebot = writable(null)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installAngebot.set(e) })
  window.addEventListener('appinstalled', () => { merkeErledigt(); installAngebot.set(null) })
}
