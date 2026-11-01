// Welche Notiz steht wo im Tagebuch: am Tag, bei ihrer Etappe oder am Ende.
// Notizen sind von selbst dabei und lassen sich einzeln abwählen (imLogbuch: false).

/** Erfasstes lokales Datum einer Notiz, stabil gegen spätere Zeitzonenwechsel. */
export function notizDatum(n) {
  if (n.tsLokal) return n.tsLokal.slice(0, 10)
  try {
    const d = new Date(n.ts), p = (x) => String(x).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  } catch { return '' }
}

/** kapitel: [{ id, tage: [{ datum, journal }] }]. Ergebnis: { tag: Map, etappe: Map, rest: [] } */
export function verteileNotizen(notizen = [], kapitel = []) {
  const tag = new Map(), etappe = new Map(), rest = []
  const dazu = (m, k, n) => { if (!m.has(k)) m.set(k, []); m.get(k).push(n) }
  const tageVon = (k) => k.tage.filter((t) => t.journal.length).map((t) => t.datum)
  const alleTage = new Set(kapitel.flatMap(tageVon))
  for (const n of notizen) {
    if (n.imLogbuch === false) continue
    const d = notizDatum(n), k = n.etappeId ? kapitel.find((x) => x.id === n.etappeId) : null
    if (k) { if (tageVon(k).includes(d)) dazu(tag, d, n); else dazu(etappe, k.id, n) }
    else if (alleTage.has(d)) dazu(tag, d, n)
    else rest.push(n)
  }
  return { tag, etappe, rest }
}
