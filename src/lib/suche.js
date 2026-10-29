// Suche über alle Orte — EINE Logik für das Suchblatt und die Kachel-Ansicht,
// damit beide garantiert dasselbe finden.
//
// Groß/klein, Umlaute und Akzente spielen keine Rolle („Hamelin" = „hamelin",
// „Cote" findet „Côte"); die Treffer kommen nach Güte sortiert: Name beginnt mit dem Begriff
// → Name enthält ihn → Region → Beschreibung/Abschnitt.
import { LOCALE } from './i18n.js'

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** 0 = bester Treffer … 4 = nur über Etiketten; null = passt nicht. */
export function rangFuer(o, begriff = '', etiketten = []) {
  if (etiketten.length && !etiketten.every((t) => (o.tags || []).includes(t))) return null
  const s = norm(begriff.trim())
  if (!s) return 4
  const name = norm(o.name)
  if (name.startsWith(s)) return 0
  if (name.includes(s)) return 1
  if (norm(o.region).includes(s)) return 2
  if (norm(o.beschreibung).includes(s) || norm(o.abschnitt).includes(s)) return 3
  return null
}

export const passtOrt = (o, begriff, etiketten) => rangFuer(o, begriff, etiketten) !== null

/** Treffer nach Güte, bei Gleichstand alphabetisch. */
export function sucheOrte(orte, begriff = '', etiketten = []) {
  if (!begriff.trim() && !etiketten.length) return []
  const out = []
  for (const o of orte) {
    const r = rangFuer(o, begriff, etiketten)
    if (r !== null) out.push([r, o])
  }
  return out.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, LOCALE)).map((x) => x[1])
}
