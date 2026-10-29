// Quiz-Auswertung: Level nach Anzahl richtiger Antworten.
export function auswerten(antworten, fragen, levels) {
  let beantwortet = 0, richtig = 0
  for (const f of fragen) {
    const a = antworten[f.id]
    if (a != null) { beantwortet++; if (a === f.richtig) richtig++ }
  }
  const gesamt = fragen.length || 50
  const prozent = gesamt ? Math.round((richtig / gesamt) * 100) : 0
  const level = levels.find((l) => richtig >= l.min && richtig <= l.max) || levels[0] || null
  return { beantwortet, richtig, gesamt, prozent, level }
}
