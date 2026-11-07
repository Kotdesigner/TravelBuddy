// Gruppen unter „Mehr“: dieselbe Einteilung in der Mehr-Liste, im iPhone-Blatt, in der Seitenleiste am Mac
// und in der Chip-Reihe oben. Titel als [deutsch, englisch], damit der Sprachwechsel ohne Neuladen greift.
// Punkte, die es in einer Fassung nicht gibt (die Basic hat keine Statistik), fallen von selbst weg.

export const GRUPPEN = [
  { id: 'sicherheit', icon: '🛟', titel: ['Sicherheit', 'Safety'], punkte: ['notfall', 'gefahren', 'praxis'] },
  { id: 'unterwegs', icon: '🧭', titel: ['Unterwegs', 'On the road'], punkte: ['buchungen', 'fluege', 'kosten'] },
  { id: 'vorbereitung', icon: '🧳', titel: ['Vorbereitung', 'Preparation'], punkte: ['vorbereitung', 'packliste'] },
  { id: 'extras', icon: '✨', titel: ['Extras', 'Extras'], punkte: ['funfacts', 'teilen', 'musik', 'quiz'] },
  { id: 'app', icon: '⚙️', titel: ['App', 'App'], punkte: ['statistik'] },
]

/** Feste Reihenfolge aller Punkte über alle Gruppen */
export const REIHENFOLGE = GRUPPEN.flatMap((g) => g.punkte)

/** Kurzname eines Pfads oder einer id: 'mehr/kosten' → 'kosten' */
const kurz = (x) => String(x || '').replace(/^mehr\//, '')

/** Gruppe zu einem Punkt (id oder Pfad) */
export function gruppeVon(x) {
  const k = kurz(x)
  return GRUPPEN.find((g) => g.punkte.includes(k)) || null
}

/**
 * Teilt eine Liste in Gruppen auf, in fester Reihenfolge. `schluessel` holt die id aus einem Eintrag.
 * Rückgabe: [{ gruppe, eintraege }], leere Gruppen fallen weg, außer `immer` nennt sie (z. B. 'app').
 */
export function gruppiere(liste, schluessel = (e) => e, immer = []) {
  return GRUPPEN.map((g) => ({
    gruppe: g,
    eintraege: g.punkte.map((p) => liste.find((e) => kurz(schluessel(e)) === p)).filter(Boolean),
  })).filter((x) => x.eintraege.length || immer.includes(x.gruppe.id))
}

/** Beginnt mit diesem Eintrag eine neue Gruppe? (für Trenner in der Chip-Reihe) */
export function neueGruppe(liste, i, schluessel = (e) => e) {
  if (i <= 0) return false
  return gruppeVon(schluessel(liste[i]))?.id !== gruppeVon(schluessel(liste[i - 1]))?.id
}
