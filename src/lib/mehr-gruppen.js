// Gruppen unter „Mehr“ (V31, aufgeräumt): dieselbe Einteilung in der Mehr-Seite, im iPhone-Blatt, in der
// Seitenleiste am Mac und in der Chip-Reihe oben. Titel als [deutsch, englisch], damit der Sprachwechsel ohne
// Neuladen greift. Punkte, die es in einer Fassung nicht gibt (die Basic hat keine Statistik), fallen von selbst weg.

export const GRUPPEN = [
  { id: 'sicherheit', icon: '🛟', titel: ['Sicherheit', 'Safety'], punkte: ['notfall', 'gefahren'] },
  { id: 'unterwegs', icon: '🧭', titel: ['Unterwegs', 'On the road'], punkte: ['buchungen', 'fluege', 'kosten'] },
  { id: 'vorbereitung', icon: '🧳', titel: ['Vor der Reise', 'Before the trip'], punkte: ['vorbereitung', 'packliste', 'praxis'] },
  { id: 'teilen', icon: '🤝', titel: ['Teilen und verbinden', 'Share and connect'], punkte: ['meldungen', 'verbinden', 'teilen'] },
  // Eine Zeile mit kleinen Knöpfen statt drei Zeilen
  { id: 'extras', icon: '✨', titel: ['Unterhaltung', 'Entertainment'], punkte: ['funfacts', 'musik', 'quiz'], zeile: true },
  { id: 'app', icon: '⚙️', titel: ['App und Einstellungen', 'App and settings'], punkte: ['statistik'] },
]

/** Oben als große Kacheln: was man unterwegs am häufigsten braucht */
export const SCHNELL = ['notfall', 'gefahren', 'buchungen', 'kosten']
/** In der Übersicht nicht als eigene Zeile, aber eine Ebene tiefer über die Chips der Gruppe (Flüge bei Buchungen, Packliste bei Reisevorbereitung) */
export const NUR_CHIP = ['fluege', 'packliste']

/** Feste Reihenfolge aller Punkte über alle Gruppen */
export const REIHENFOLGE = GRUPPEN.flatMap((g) => g.punkte)

/** Kurzname eines Pfads oder einer id: 'mehr/kosten' → 'kosten' */
const kurz = (x) => String(x || '').replace(/^mehr\//, '').split('/')[0]

/** Gruppe zu einem Punkt (id oder Pfad) */
export function gruppeVon(x) {
  const k = kurz(x)
  return GRUPPEN.find((g) => g.punkte.includes(k)) || null
}

/** Die Punkte derselben Gruppe, in Reihenfolge (für die Chips einer Unterseite) */
export function geschwister(liste, x, schluessel = (e) => e) {
  const g = gruppeVon(x)
  return g ? liste.filter((e) => gruppeVon(schluessel(e))?.id === g.id) : []
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

/** Für die Übersicht: Kacheln oben, darunter die Gruppen ohne Kachel-Punkte und ohne NUR_CHIP. App immer. */
export function uebersicht(liste, schluessel = (e) => e) {
  const kacheln = SCHNELL.map((p) => liste.find((e) => kurz(schluessel(e)) === p)).filter(Boolean)
  const gruppen = gruppiere(liste, schluessel, ['app'])
    .map((x) => ({ ...x, eintraege: x.eintraege.filter((e) => !SCHNELL.includes(kurz(schluessel(e))) && !NUR_CHIP.includes(kurz(schluessel(e)))) }))
    .filter((x) => x.eintraege.length || x.gruppe.id === 'app')
  return { kacheln, gruppen }
}

/** Beginnt mit diesem Eintrag eine neue Gruppe? (für Trenner in der Seitenleiste) */
export function neueGruppe(liste, i, schluessel = (e) => e) {
  if (i <= 0) return false
  return gruppeVon(schluessel(liste[i]))?.id !== gruppeVon(schluessel(liste[i - 1]))?.id
}
