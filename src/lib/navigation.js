// Navigation: jeder Bildschirm hat eine Adresse hinter dem #, z. B. #/plan/etappe/<id>
// oder #/logbuch/tag/2037-12-14. Damit funktionieren Zurück-Wischen und die Zurück-Taste,
// und jede Stelle der App kann direkt dorthin springen, ohne Eigenschaften durchzureichen.

export const TABS = ['heute', 'plan', 'orte', 'logbuch', 'mehr']

// Sprungmarken des Altformats (ältere Links und gespeicherte Lesezeichen) → heutige Adressen
export const ALT = {
  ueberblick: 'heute', sueden: 'orte/sueden', 'routen-sued': 'orte/routen', norden: 'orte/norden',
  'routen-nord': 'orte/routen', osten: 'orte/osten', 'meine-orte': 'orte/meine', 'eigene-route': 'plan',
  karten: 'plan/karte', wanderungen: 'plan/wanderungen', kalender: 'plan/kalender', tagebuch: 'logbuch',
  notizen: 'logbuch/notizen', vorbereitung: 'mehr/vorbereitung', gefahren: 'mehr/gefahren',
  packliste: 'mehr/packliste', praxis: 'mehr/praxis', notfall: 'mehr/notfall', quiz: 'mehr/quiz',
}

export function leseAdresse(hash = location.hash) {
  const roh = String(hash || '').replace(/^#\/?/, '')
  let h
  try { h = decodeURIComponent(roh) } catch { h = roh }
  if (ALT[h]) h = ALT[h]
  const [tab, unter = '', ...rest] = h.split('/')
  if (!TABS.includes(tab)) return { tab: 'heute', unter: '', id: '', pfad: 'heute' }
  return { tab, unter, id: rest.join('/'), pfad: h }
}

export function geh(pfad) {
  const ziel = '#/' + String(pfad).replace(/^#?\/?/, '')
  if (location.hash === ziel) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else location.hash = ziel
}

// Verlauf innerhalb der App: nur dann history.back(), wenn der vorige Schritt auch in der
// App war. Kam man per Lesezeichen direkt auf eine Etappe, führt „Zurück" eine Ebene höher.
const verlauf = []
export function merke(pfad) {
  if (verlauf.length > 1 && verlauf[verlauf.length - 2] === pfad) verlauf.pop()
  else if (verlauf[verlauf.length - 1] !== pfad) verlauf.push(pfad)
}
export function zurueck(fallback) {
  if (verlauf.length > 1) history.back()
  else geh(fallback)
}
