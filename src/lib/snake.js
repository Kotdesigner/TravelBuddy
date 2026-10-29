// Spiellogik für das Snake-Easter-Egg („snake" in die Suche, Wunsch Steve 06.10.2026).
// Bewusst ohne Oberfläche: reine Funktionen, damit tests/snake.test.mjs sie prüfen kann.
//
// Regeln: feste Bande — wer gegen den Rand fährt, verliert (KEIN Durchtauchen auf die
// andere Seite). Wer sich selbst beißt, verliert. Jede Maus lässt die Schlange um ein
// Feld wachsen und das Spiel ein wenig schneller werden.

export const RICHTUNG = {
  hoch: { x: 0, y: -1 }, runter: { x: 0, y: 1 }, links: { x: -1, y: 0 }, rechts: { x: 1, y: 0 },
}
const GEGENTEIL = { hoch: 'runter', runter: 'hoch', links: 'rechts', rechts: 'links' }

/** Freies Feld für das Futter. `zufall` liefert [0,1) — im Test festgelegt. */
export function freiesFeld(spalten, zeilen, schlange, zufall = Math.random) {
  const belegt = new Set(schlange.map((t) => t.x + ',' + t.y))
  const frei = spalten * zeilen - belegt.size
  if (frei <= 0) return null
  // n-tes freies Feld wählen — gleichmäßig verteilt, ohne endloses Würfeln bei voller Fläche
  let n = Math.floor(zufall() * frei)
  for (let y = 0; y < zeilen; y++) {
    for (let x = 0; x < spalten; x++) {
      if (belegt.has(x + ',' + y)) continue
      if (n-- === 0) return { x, y }
    }
  }
  return null
}

/** Neues Spiel: Schlange (3 Glieder) mittig, Kopf nach rechts. */
export function neuesSpiel(spalten, zeilen, zufall = Math.random) {
  const y = Math.floor(zeilen / 2), x = Math.max(2, Math.floor(spalten / 3))
  const schlange = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }]
  return {
    spalten, zeilen, schlange,
    richtung: 'rechts', warteschlange: [],
    futter: freiesFeld(spalten, zeilen, schlange, zufall),
    punkte: 0, vorbei: null,   // null | 'bande' | 'selbst' | 'gewonnen'
  }
}

/**
 * Richtungswunsch merken. Bis zu zwei Wünsche je Takt werden gepuffert — so gelingt auch
 * eine schnelle Kehre (rechts → runter → links), ohne dass die zweite Eingabe verloren geht.
 * Eine direkte Umkehr ist nicht erlaubt (die Schlange würde sich sofort selbst beißen).
 */
export function lenke(z, wunsch) {
  if (!RICHTUNG[wunsch] || z.vorbei) return z
  const letzte = z.warteschlange.length ? z.warteschlange[z.warteschlange.length - 1] : z.richtung
  if (wunsch === letzte || wunsch === GEGENTEIL[letzte] || z.warteschlange.length >= 2) return z
  return { ...z, warteschlange: [...z.warteschlange, wunsch] }
}

/** Ein Takt. Liefert einen NEUEN Zustand. */
export function schritt(z, zufall = Math.random) {
  if (z.vorbei) return z
  const [naechste, ...rest] = z.warteschlange
  const richtung = naechste || z.richtung
  const d = RICHTUNG[richtung]
  const kopf = { x: z.schlange[0].x + d.x, y: z.schlange[0].y + d.y }

  // Bande: kein Durchtauchen
  if (kopf.x < 0 || kopf.y < 0 || kopf.x >= z.spalten || kopf.y >= z.zeilen) {
    return { ...z, richtung, warteschlange: rest, vorbei: 'bande' }
  }
  const frisst = !!z.futter && kopf.x === z.futter.x && kopf.y === z.futter.y
  // Das Schwanzende rückt in diesem Takt weiter — dorthin darf der Kopf, außer beim Wachsen
  const koerper = frisst ? z.schlange : z.schlange.slice(0, -1)
  if (koerper.some((t) => t.x === kopf.x && t.y === kopf.y)) {
    return { ...z, richtung, warteschlange: rest, vorbei: 'selbst' }
  }
  const schlange = [kopf, ...koerper]
  if (!frisst) return { ...z, schlange, richtung, warteschlange: rest }
  const futter = freiesFeld(z.spalten, z.zeilen, schlange, zufall)
  return { ...z, schlange, richtung, warteschlange: rest, futter, punkte: z.punkte + 1, vorbei: futter ? null : 'gewonnen' }
}

/** Takt in Millisekunden: anfangs gemütlich, mit jeder Maus etwas schneller, nie hektisch. */
export const takt = (punkte) => Math.max(75, 160 - punkte * 4)

/** Feldgröße so wählen, dass die kurze Seite rund 22 Felder hat (iPhone ~16 px, Mac ~30 px). */
export function raster(breite, hoehe) {
  const zelle = Math.max(14, Math.min(36, Math.floor(Math.min(breite, hoehe) / 22)))
  return { zelle, spalten: Math.max(8, Math.floor(breite / zelle)), zeilen: Math.max(8, Math.floor(hoehe / zelle)) }
}
