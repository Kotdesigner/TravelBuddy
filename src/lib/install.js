// Hinweis „Zum Home-Bildschirm“. Eine Webseite darf sich auf dem iPhone nicht selbst
// installieren, das geht nur über Teilen → „Zum Home-Bildschirm“. Die App erklärt das einmal,
// bevor jemand in Safari etwas einträgt: Safari und Home-Bildschirm haben getrennte Speicher.
// Android und Chrome am Rechner bieten einen eigenen Knopf (beforeinstallprompt).
import { writable, derived } from 'svelte/store'

export const KEY = 'tb-install-hinweis-v1'

/** iPhone oder iPad? iPadOS meldet sich wie ein Mac, hat aber Touch. */
export function istIOS({ ua = '', platform = '', touch = 0 } = {}) {
  return /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touch > 1) || (/Macintosh/.test(ua) && touch > 1)
}
/** iPad: dort sitzt Teilen oben rechts neben der Adresse, nicht unten. */
export function istIPad({ ua = '', platform = '', touch = 0 } = {}) {
  return /iPad/.test(ua) || (!/iPhone|iPod/.test(ua) && istIOS({ ua, platform, touch }))
}
export const istAndroid = ({ ua = '' } = {}) => /Android/.test(ua)

export const istFirefox = ({ ua = '' } = {}) => /Firefox\/|FxiOS/.test(ua)
/** Safari am Mac (kein iPad): dort heißt es „Zum Dock hinzufügen“ */
export const istMacSafari = ({ ua = '', touch = 0 } = {}) =>
  /Macintosh/.test(ua) && touch <= 1 && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/.test(ua)

/**
 * Welcher Hinweis passt? 'ios', 'android', 'mac' (Safari am Mac), 'firefox' (kann nicht installieren),
 * 'rechner' (Chrome, Edge & Co. an Windows, Mac und Linux) oder null.
 * Nichts zeigen, wenn die App schon installiert läuft oder der Hinweis erledigt ist.
 */
export function hinweisArt({ ua = '', platform = '', touch = 0, standalone = false, erledigt = false } = {}) {
  if (standalone || erledigt) return null
  if (istIOS({ ua, platform, touch })) return 'ios'
  if (istAndroid({ ua })) return 'android'
  if (istFirefox({ ua })) return 'firefox'
  if (istMacSafari({ ua, touch })) return 'mac'
  return 'rechner'
}

export const geraet = () => (typeof navigator === 'undefined' ? {} : { ua: navigator.userAgent, platform: navigator.platform, touch: navigator.maxTouchPoints || 0 })

export function erledigt() {
  try { return localStorage.getItem(KEY) === 'fertig' } catch { return false }
}
export function merkeErledigt() {
  try { localStorage.setItem(KEY, 'fertig') } catch {}
  eingerichtet.set(true)
}

export const laeuftAlsApp = () =>
  (typeof navigator !== 'undefined' && navigator.standalone === true) ||
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)

/** Eingerichtet? Dann verschwindet „📲 App einrichten“ aus Menü und Seitenleiste. */
export const eingerichtet = writable(erledigt())
export const einrichtenZeigen = derived(eingerichtet, (e) => !e && !laeuftAlsApp() && !!hinweisArt(geraet()))
/** Menü: hochzählen öffnet den Hinweis noch einmal, auch nach „Später“ */
export const installOeffnen = writable(0)
export const appEinrichten = () => installOeffnen.update((n) => n + 1)

/** Offen, solange der Hinweis zu sehen ist. Die Einführung wartet so lange. */
export const installOffen = writable(false)

/** Android und Chrome merken sich das Angebot zum Installieren, wir zeigen es im Hinweis. */
export const installAngebot = writable(null)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installAngebot.set(e) })
  window.addEventListener('appinstalled', () => { merkeErledigt(); installAngebot.set(null) })
}
