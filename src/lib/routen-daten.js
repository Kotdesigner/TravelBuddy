// Zusatzdaten der Routen-Ideen, einmal je App geladen: Straßenverlauf je Route (scripts/routen-strassen.mjs)
// und die Etappenorte mit Versorgung (scripts/etappenorte.mjs). Beide liegen offline im App-Speicher.
import { writable } from 'svelte/store'
let strassen = null, etappen = null
// Sprung aus der Suche zu einem Etappenort: die Karte seiner Gegend wählt ihn aus und zeigt ihn
export const etappeFokus = writable(null)
const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(url))))

export function ladeStrassen() {
  if (!strassen) { strassen = json('/routen-strassen.json').catch(() => { strassen = null; return {} }) }
  return strassen
}
export function ladeEtappenorte() {
  if (!etappen) { etappen = json('/etappenorte.json').catch(() => { etappen = null; return [] }) }
  return etappen
}

/** Kurzname einer Route für die Beschriftung an der Linie: „Süd 1“, „Nord 2“, „Rückweg“ */
export function kurzName(titel = '') {
  const t = titel.replace(/^Route\s+/, '').split(/\s+[—–-]\s+/)[0].trim()
  return t.replace(/-Option$|-option$/, '').replace(/^Return option$/i, 'Return')
}

/** Tag, an dem die Route einen Stopp erreicht (erster Tag, dessen Titel ihn nennt) */
export function tagVonStopp(r, name) {
  const kern = String(name || '').split(',')[0].trim().toLowerCase()
  const i = (r?.steps || []).findIndex((s) => String(s.titel || '').toLowerCase().includes(kern))
  return i < 0 ? null : { i, tag: r.steps[i].tag, titel: r.steps[i].titel }
}

const kmZwischen = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)) }
/** Die nächsten Sehenswürdigkeiten von einem Etappenort aus, mit Nummer und Entfernung in km */
export function vonHierAus(e, orte, nummer = {}, anzahl = 3) {
  return orte.filter((o) => o.lat != null).map((o) => ({ nr: nummer[o.id] || null, name: o.anzeigeName || o.name, km: Math.round(kmZwischen(e, o)) }))
    .sort((a, b) => a.km - b.km).slice(0, anzahl)
}

export const VERSORGUNG = [
  ['fuel', '⛽'], ['wasser', '💧'], ['laden', '🛒'], ['klinik', '🏥'], ['werkstatt', '🔧'], ['camp', '🏕️'], ['wc', '🚻'],
]
