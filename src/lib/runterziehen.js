// V36: Runterziehen zum Aktualisieren, wie in anderen Apps. Ganz oben auf einer Seite nach unten ziehen und
// loslassen: TravelBuddy sucht eine neue Fassung und lädt neu. Die App schaltet das Runterziehen des Browsers ab
// (app.css: overscroll-behavior: none, damit nichts wackelt), deshalb eine eigene Geste, im Browser wie als
// installierte App gleich (Runterziehen.svelte).
// Sicher: ungespeicherte Änderungen fragen vorher nach (fragWaechter), Blätter, Karten, Felder und innere
// Listen, die nicht oben stehen, starten nichts.
import { fragWaechter } from './navigation.js'

export const SCHWELLE = 72      // so weit (gedämpft) ziehen, dann loslassen
export const MAX = 120          // weiter wandert die Anzeige nicht
export const DAEMPFUNG = 0.5    // Finger 144 px = Anzeige 72 px
export const zugWeite = (dy) => (dy > 0 ? Math.min(MAX, dy * DAEMPFUNG) : 0)
export const bereit = (dy) => zugWeite(dy) >= SCHWELLE
/** Eher senkrecht als waagerecht? Sonst ist es ein Wischen zur Seite */
export const senkrecht = (dx, dy) => dy > 0 && dy > Math.abs(dx) * 1.4

const SPERRE = '.maplibregl-map, canvas, video, iframe, input, textarea, select, [contenteditable=""], [contenteditable="true"], [aria-modal="true"], [data-kein-runterziehen]'
/** Darf hier eine Geste beginnen? Nur ganz oben, ohne offenes Blatt, nicht auf Karte oder Feld */
export function darfStarten(ziel, { scrollY = globalThis.scrollY || 0, doc = globalThis.document } = {}) {
  if (scrollY > 0) return false
  if (!ziel || typeof ziel.closest !== 'function') return false
  if (ziel.closest(SPERRE)) return false
  if (doc?.querySelector?.('[aria-modal="true"], .nt')) return false
  const aktiv = doc?.activeElement
  if (aktiv && /^(INPUT|TEXTAREA|SELECT)$/.test(aktiv.tagName)) return false
  // Innere Listen mit eigenem Scrollen: nur, wenn auch sie ganz oben stehen
  for (let e = ziel; e && e !== doc?.body && e !== doc?.documentElement; e = e.parentElement) {
    if (e.scrollTop > 0) return false
  }
  return true
}

const schlafe = (ms) => new Promise((r) => setTimeout(r, ms))
/**
 * Aktualisieren: erst ungespeicherte Änderungen klären, dann nach einer neuen Fassung sehen (der Service-Worker
 * übernimmt sie und main.js lädt dann selbst neu), sonst einfach neu laden. Offline lädt die App aus dem Vorrat.
 */
export async function aktualisiereApp({ frage = fragWaechter, sw = globalThis.navigator?.serviceWorker, neuLaden = () => location.reload(), warte = schlafe } = {}) {
  if (!(await frage())) return 'abgebrochen'
  try {
    const reg = await sw?.getRegistration?.()
    if (reg) {
      await Promise.race([reg.update(), warte(4000)])
      if (reg.installing || reg.waiting) await warte(3000)
    }
  } catch {}
  await warte(400)   // letzte Änderungen landen in der Datenbank (Speichern wartet 300 ms)
  neuLaden()
  return 'neu'
}
