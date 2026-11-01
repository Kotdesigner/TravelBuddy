// Rechnung für die Monats- und Jahresansicht des Kalenders. Daten laufen als Text JJJJ-MM-TT,
// so verschiebt keine Zeitzone einen Tag. Die Woche beginnt am Montag.

const zwei = (n) => String(n).padStart(2, '0')
export const tagText = (j, m, t) => `${j}-${zwei(m + 1)}-${zwei(t)}`

/** Wochen eines Monats (m = 0 bis 11): Listen mit sieben Tagen, null außerhalb des Monats. */
export function monatWochen(j, m) {
  const zahl = new Date(j, m + 1, 0).getDate()
  const luecke = (new Date(j, m, 1).getDay() + 6) % 7
  const tage = [...Array(luecke).fill(null)]
  for (let t = 1; t <= zahl; t++) tage.push(tagText(j, m, t))
  while (tage.length % 7) tage.push(null)
  const wochen = []
  for (let i = 0; i < tage.length; i += 7) wochen.push(tage.slice(i, i + 7))
  return wochen
}

/** Alle Tage von `von` bis `bis`, beide eingeschlossen. */
export function tageZwischen(von, bis) {
  const [j, m, t] = von.split('-').map(Number)
  const raus = []
  for (let d = new Date(j, m - 1, t, 12); ; d.setDate(d.getDate() + 1)) {
    const s = tagText(d.getFullYear(), d.getMonth(), d.getDate())
    if (s > bis) return raus
    raus.push(s)
  }
}

/** Je Tag: { etappen, termine, logbuch }. etappen: [{ id, name, farbe, von, bis }], termine: [{ datum, … }]. */
export function tagKarte(etappen = [], termine = [], logbuchTage = []) {
  const karte = new Map()
  const tag = (d) => {
    if (!karte.has(d)) karte.set(d, { etappen: [], termine: [], logbuch: false })
    return karte.get(d)
  }
  for (const e of etappen) for (const d of tageZwischen(e.von, e.bis)) tag(d).etappen.push(e)
  for (const x of termine) tag(x.datum).termine.push(x)
  for (const d of logbuchTage) tag(d).logbuch = true
  return karte
}

/** Startmonat: heute, wenn es im Plan liegt, sonst der Reisebeginn, sonst heute. */
export function startMonat(heute, von, bis) {
  const s = von && !(heute >= von && heute <= bis) ? von : heute
  return { jahr: Number(s.slice(0, 4)), monat: Number(s.slice(5, 7)) - 1 }
}
