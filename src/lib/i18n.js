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
// Ein Wechsel läuft ohne Neuladen, mit demselben Kreis wie beim Farbschema: `sprache`, `istEn`
// und `LOCALE` ändern sich, feste Listen in den Modulen (jeSprache, beiSprache) werden neu
// gebaut, dann baut main.js die Oberfläche neu auf. Neue Listen, die Texte enthalten und beim
// Laden des Moduls entstehen, gehören deshalb in jeSprache(() => [...]).
import EN from './sprache/en.js'
import { kreisWechsel } from './theme.js'

const KEY = 'wa-sprache'

function ermitteln() {
  // Tests und Werkzeuge in Node: Deutsch, außer ausdrücklich anders verlangt
  if (typeof window === 'undefined') return globalThis.__SPRACHE === 'en' ? 'en' : 'de'
  try { const s = localStorage.getItem(KEY); if (s === 'de' || s === 'en') return s } catch {}
  const n = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'de'
  return /^de\b/i.test(n) ? 'de' : 'en'
}

export let sprache = ermitteln()
export let istEn = sprache === 'en'
/** Für toLocaleString, toLocaleDateString, Intl.* */
export let LOCALE = istEn ? 'en-AU' : 'de-DE'

// Seitentitel und Name für „Zum Home-Bildschirm“ (index.html hat die deutsche Fassung)
const TITEL_DE = typeof document !== 'undefined' ? document.title : ''
const NAME_DE = typeof document !== 'undefined' ? document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content : ''
function dokumentAnpassen() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = istEn ? 'en-AU' : 'de'
  document.title = istEn ? 'TravelBuddy · Western Australia' : TITEL_DE
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', istEn ? 'WA Trip' : NAME_DE)
}
dokumentAnpassen()

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

const neuBauen = []
/** Liste oder Objekt mit Texten, das beim Laden des Moduls entsteht. Bleibt dasselbe Objekt,
    damit alle, die es importiert haben, nach einem Sprachwechsel den neuen Inhalt sehen. */
export function jeSprache(bau) {
  const wert = bau()
  neuBauen.push(() => {
    const neu = bau()
    if (Array.isArray(wert)) wert.splice(0, wert.length, ...neu)
    else { for (const k of Object.keys(wert)) delete wert[k]; Object.assign(wert, neu) }
  })
  return wert
}
/** Für einzelne Werte: `export let X; beiSprache(() => { X = t('…') })` */
export function beiSprache(setzen) { setzen(); neuBauen.push(setzen) }

let oberflaecheNeu = () => {}
/** main.js meldet hier, wie die Oberfläche neu aufgebaut wird (gibt ein Promise zurück) */
export const beimSprachwechsel = (f) => { oberflaecheNeu = f }

/** Sprache wechseln: speichern und die Oberfläche im Kreis neu aufbauen. Geht dabei etwas
    schief, lädt die App ganz normal neu. */
export function setzeSprache(s) {
  if (s === sprache) return
  try { localStorage.setItem(KEY, s) } catch {}
  return kreisWechsel(async () => {
    try {
      sprache = s
      istEn = s === 'en'
      LOCALE = istEn ? 'en-AU' : 'de-DE'
      dokumentAnpassen()
      neuBauen.forEach((f) => f())
      await oberflaecheNeu()
    } catch (e) { console.error(e); location.reload() }
  })
}

/** Gibt es eine Übersetzung? (für Tests und Werkzeuge) */
export const hatUebersetzung = (de) => Object.prototype.hasOwnProperty.call(EN, de)
