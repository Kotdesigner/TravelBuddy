// Sprache der App: Deutsch oder Englisch (australisch/britisch).
//
// Die deutschen Texte stehen weiter im Code und sind zugleich der Schlüssel:
//   t('Tage bis zur Abreise')            → „days until departure“
//   t('{n} km bis {ziel}', { n, ziel })  → Platzhalter in geschweiften Klammern
//   tn(n, '{n} Tag', '{n} Tage')         → Einzahl/Mehrzahl
// Die englischen Texte liegen in ./sprache/en.js. Fehlt ein Eintrag, bleibt der deutsche
// Text stehen (nie eine Lücke). Eigene Einträge der Nutzer (Notizen, Orte, Packliste) laufen
// durch t() unverändert durch, weil sie nicht im Wörterbuch stehen.
//
// Die Sprache gilt für die ganze Sitzung. Ein Wechsel speichert die Wahl und lädt die App
// neu: so stimmen auch Texte, die außerhalb von Komponenten berechnet werden (Warnungen,
// Fahrtage, Datumsangaben), ohne dass jede Stelle auf Änderungen hören muss.
import EN from './sprache/en.js'

const KEY = 'wa-sprache'

function ermitteln() {
  // Tests und Werkzeuge in Node: Deutsch, außer ausdrücklich anders verlangt
  if (typeof window === 'undefined') return globalThis.__SPRACHE === 'en' ? 'en' : 'de'
  try { const s = localStorage.getItem(KEY); if (s === 'de' || s === 'en') return s } catch {}
  const n = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'de'
  return /^de\b/i.test(n) ? 'de' : 'en'
}

export const sprache = ermitteln()
export const istEn = sprache === 'en'
/** Für toLocaleString, toLocaleDateString, Intl.* */
export const LOCALE = istEn ? 'en-AU' : 'de-DE'

if (typeof document !== 'undefined') {
  document.documentElement.lang = istEn ? 'en-AU' : 'de'
  // Seitentitel und Name für „Zum Home-Bildschirm“ (index.html hat die deutsche Fassung)
  if (istEn) {
    document.title = 'TravelBuddy · Western Australia'
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'WA Trip')
  }
}

const fuellen = (s, werte) => (werte ? s.replace(/\{(\w+)\}/g, (m, k) => (k in werte && werte[k] != null ? String(werte[k]) : m)) : s)

// Ein englischer Eintrag kann { one, other } sein, wenn das Deutsche für Einzahl und
// Mehrzahl gleich lautet („{n} Titel“ → „{n} track“ / „{n} tracks“).
function nachschlagen(de, n) {
  if (!istEn) return de
  const v = EN[de]
  if (v == null) return de
  if (typeof v === 'object') return Number(n) === 1 ? (v.one ?? v.other) : (v.other ?? v.one)
  return v
}

/** Text in der aktuellen Sprache. `de` ist der deutsche Text (= Schlüssel). */
export function t(de, werte) {
  if (de == null) return ''
  return fuellen(nachschlagen(de, werte?.n), werte)
}

/** Einzahl/Mehrzahl: tn(3, '{n} Tag', '{n} Tage') */
export function tn(n, eins, mehr, werte) {
  const z = Number(n)
  return fuellen(nachschlagen(z === 1 ? eins : mehr, z), { n, ...werte })
}

/** Wählt zwischen zwei fertigen Fassungen, wenn ein Text nicht übersetzt, sondern anders gebaut wird */
export const je = (de, en) => (istEn ? en : de)

/** Sprache wechseln: speichern und neu laden */
export function setzeSprache(s) {
  if (s === sprache) return
  try { localStorage.setItem(KEY, s) } catch {}
  location.reload()
}

/** Gibt es eine Übersetzung? (für Tests und Werkzeuge) */
export const hatUebersetzung = (de) => Object.prototype.hasOwnProperty.call(EN, de)
