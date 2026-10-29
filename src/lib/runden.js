// Runden ohne Rundungsfehler.
//
// Werden Teile einzeln gerundet, passt ihre Summe oft nicht zur gerundeten Gesamtzahl.
// Beispiel: acht Abschnitte, einzeln gerundet 127 + 78 + 410 + 413 + 351 + 74 + 263 + 214
// = 1.930 km, die Route selbst 1.928 km. Dieselbe Größe darf an zwei Stellen nicht
// unterschiedlich erscheinen (etwa 297 und 298 km).
//
// Regeln für alle Zahlen, die die App nebeneinander zeigt:
//   1. Teile werden so gerundet, dass ihre Summe genau die gerundete Gesamtzahl ist
//      (Verfahren der größten Reste): `rundeAufSumme`.
//   2. Positionen werden einmal gerundet, Längen sind Differenzen dieser ganzen Zahlen.
//      So ergibt „von km + Länge" immer „bis km".

/**
 * Ganze Zahlen, deren Summe genau `summe` ist und die so nah wie möglich an `werte` liegen.
 * Jede Zahl wird ab- oder aufgerundet; die größten Reste bekommen den Aufschlag. Stimmt die
 * Vorgabe `summe` nicht mit der Summe der Werte überein (z. B. gespeicherte, schon gerundete
 * Abschnitte gegen die gespeicherte Gesamtlänge), wird der Unterschied auf die größten Teile
 * verteilt. Nie unter 0.
 * @param {number[]} werte
 * @param {number} [summe]  Vorgabe; ohne Angabe die gerundete Summe der Werte
 * @returns {number[]}
 */
export function rundeAufSumme(werte, summe) {
  const w = (werte || []).map((x) => (Number.isFinite(x) && x > 0 ? x : 0))
  const n = w.length
  if (!n) return []
  const ziel = Math.max(0, Math.round(summe ?? w.reduce((a, b) => a + b, 0)))
  const out = w.map((x) => Math.floor(x))
  let rest = ziel - out.reduce((a, b) => a + b, 0)
  const anteil = (i) => w[i] - out[i]
  if (rest > 0) {
    // größter Rest zuerst, bei Gleichstand der größere Teil, dann die Reihenfolge
    const reihe = w.map((_, i) => i).sort((a, b) => anteil(b) - anteil(a) || w[b] - w[a] || a - b)
    for (let k = 0; rest > 0; k = (k + 1) % n) { out[reihe[k]]++; rest-- }
  } else if (rest < 0) {
    // kleinster Rest zuerst, bei Gleichstand der größere Teil
    const reihe = w.map((_, i) => i).sort((a, b) => anteil(a) - anteil(b) || w[b] - w[a] || a - b)
    let ohneWirkung = 0
    for (let k = 0; rest < 0 && ohneWirkung < n; k = (k + 1) % n) {
      if (out[reihe[k]] > 0) { out[reihe[k]]--; rest++; ohneWirkung = 0 } else ohneWirkung++
    }
  }
  return out
}

/** `n` gleich große ganze Teile, die zusammen genau `summe` ergeben (z. B. 790 km auf 3 Tage). */
export const gleicheTeile = (summe, n) => rundeAufSumme(Array.from({ length: Math.max(1, n) }, () => summe / Math.max(1, n)), summe)
