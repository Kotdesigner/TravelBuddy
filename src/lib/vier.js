// Spiellogik für „Vier in einer Reihe“ (Easter-Egg „4444“ in der Suche,).
// Reine Funktionen ohne Oberfläche, damit tests/vier.test.mjs sie prüfen kann. Gerechnet wird
// im Web Worker (vier-rechner.js), damit die Seite beim Nachdenken nicht stockt.
//
// Brett: 7 Spalten, 6 Reihen, Index = spalte * 6 + reihe (Reihe 0 ist unten). 1 = du, 2 = Computer.
//
// Der Computer rechnet mit Negamax und Alpha-Beta, merkt sich Stellungen (Zobrist-Tabelle),
// probiert die Mitte zuerst, nimmt jeden Sofortsieg und blockt jede Sofortdrohung. Bewertet
// werden offene Viererlinien, die Mitte und auf den oberen Stufen die Lage der Drohungen:
// Wer anfängt, braucht Drohungen in ungeraden Reihen, der andere in geraden. Das entscheidet
// viele Endspiele, lange bevor sie auf dem Brett zu sehen sind.
//
// Abwechslung: Jede Partie hat einen anderen Stil (andere Gewichte), dazu Lieblingsspalten mit
// etwas Zufall, und unter gleich guten Zügen entscheidet der Zufall. Die unteren Stufen machen
// absichtlich Fehler. Gewinnst du, wird der Computer stärker (naechsterStand).
// Die Namen der Stufen und Stile stehen in VierSpiel.svelte: so zieht der Worker kein Wörterbuch mit.

export const SPALTEN = 7, REIHEN = 6, FELDER = 42
export const DU = 1, COMPUTER = 2
export const idx = (s, r) => s * REIHEN + r
const SIEG = 1000000
const ENTSCHIEDEN = SIEG - 100
const UNENDLICH = 2 * SIEG

/** Alle 69 Viererlinien als Listen von Feldern. */
export const LINIEN = (() => {
  const l = []
  const dazu = (s, r, ds, dr) => {
    const z = []
    for (let k = 0; k < 4; k++) {
      const ss = s + ds * k, rr = r + dr * k
      if (ss < 0 || ss >= SPALTEN || rr < 0 || rr >= REIHEN) return
      z.push(idx(ss, rr))
    }
    l.push(z)
  }
  for (let s = 0; s < SPALTEN; s++) for (let r = 0; r < REIHEN; r++) { dazu(s, r, 1, 0); dazu(s, r, 0, 1); dazu(s, r, 1, 1); dazu(s, r, 1, -1) }
  return l
})()
const ZU_LINIEN = Array.from({ length: FELDER }, () => [])
LINIEN.forEach((l, i) => l.forEach((f) => ZU_LINIEN[f].push(i)))
const ANZ_LINIEN = LINIEN.length

// ---------- Brett für die Oberfläche (unveränderlich) ----------

export const neuesBrett = () => ({ felder: Array(FELDER).fill(0), hoehe: Array(SPALTEN).fill(0), letzte: -1 })
export const kannSetzen = (b, s) => s >= 0 && s < SPALTEN && b.hoehe[s] < REIHEN
export const steineAuf = (b) => b.hoehe.reduce((n, h) => n + h, 0)
export const istVoll = (b) => steineAuf(b) === FELDER

/** Stein in Spalte s fallen lassen. Gibt ein neues Brett zurück, bei voller Spalte null. */
export function setze(b, s, stein) {
  if (!kannSetzen(b, s)) return null
  const felder = [...b.felder], hoehe = [...b.hoehe]
  const f = idx(s, hoehe[s]++)
  felder[f] = stein
  return { felder, hoehe, letzte: f }
}

/** Die erste vollständige Viererlinie auf dem Brett (Felder) oder null. */
export function gewinnLinie(b) {
  const pruefe = b.letzte >= 0 ? ZU_LINIEN[b.letzte].map((i) => LINIEN[i]) : LINIEN
  for (const l of pruefe) {
    const v = b.felder[l[0]]
    if (v && b.felder[l[1]] === v && b.felder[l[2]] === v && b.felder[l[3]] === v) return l
  }
  return null
}

/** { sieger: 1|2, linie } oder { sieger: 0 } bei Remis oder null, solange das Spiel läuft. */
export function ergebnis(b) {
  const linie = gewinnLinie(b)
  if (linie) return { sieger: b.felder[linie[0]], linie }
  return istVoll(b) ? { sieger: 0, linie: null } : null
}

// ---------- Stufen und Stile ----------

/**
 * tiefe: Halbzüge, die der Computer vorausrechnet (die Endphase immer bis zum Schluss, wenn sie
 * in die Tiefe passt). zeitMs: Bedenkzeit, solange rechnet er immer tiefer. temperatur: wie gern
 * er einen schlechteren Zug nimmt (0 = nie, nur unter gleich guten wird gelost). blind: so oft
 * übersieht er, was du vorhast. paritaet: Gewicht der Drohungs-Lage.
 */
export const STUFEN = {
  1: { tiefe: 2, zeitMs: 0, temperatur: 12, blind: 0.3, paritaet: 0 },
  2: { tiefe: 3, zeitMs: 0, temperatur: 7, blind: 0.12, paritaet: 0 },
  3: { tiefe: 5, zeitMs: 0, temperatur: 4, blind: 0.04, paritaet: 0 },
  4: { tiefe: 7, zeitMs: 0, temperatur: 2, blind: 0, paritaet: 0.5 },
  5: { tiefe: 10, zeitMs: 600, temperatur: 0.6, blind: 0, paritaet: 1 },
  6: { tiefe: 18, zeitMs: 1200, temperatur: 0, blind: 0, paritaet: 1 },
  7: { tiefe: 42, zeitMs: 2500, temperatur: 0, blind: 0, paritaet: 1.4 },
}
export const MAX_STUFE = 7
export const START_STUFE = 4
/** Auf der höchsten Stufe bekommt der Computer je weiteren Sieg von dir mehr Bedenkzeit. */
export const BONUS_MS = 1000, MAX_BONUS = 4

/** eigen/gegner: Gewicht offener Linien mit 1, 2, 3 Steinen; mitte: Zug zur Mitte; rauschen: Laune bei den Spalten. */
export const STILE = {
  angriff: { eigen: [0, 1, 5, 22], gegner: [0, 1, 4, 15], mitte: 2, rauschen: 1, fallen: 1 },
  abwehr: { eigen: [0, 1, 4, 15], gegner: [0, 1.2, 5, 24], mitte: 2, rauschen: 1, fallen: 1 },
  mitte: { eigen: [0, 1, 4, 16], gegner: [0, 1, 4, 17], mitte: 5, rauschen: 0.5, fallen: 1 },
  fallen: { eigen: [0, 1, 4, 18], gegner: [0, 1, 4, 17], mitte: 2, rauschen: 1, fallen: 2.2 },
  wild: { eigen: [0, 1.3, 4, 16], gegner: [0, 1, 4, 16], mitte: 1, rauschen: 3, fallen: 1 },
}

/** Stil und Lieblingsspalten für eine neue Partie. */
export function neuerStil(zufall = Math.random) {
  const namen = Object.keys(STILE)
  const id = namen[Math.floor(zufall() * namen.length) % namen.length]
  const st = STILE[id]
  const vorliebe = [0, 1, 2, 3, 2, 1, 0].map((m) => m * st.mitte + (zufall() * 2 - 1) * st.rauschen)
  return { id, vorliebe }
}

// ---------- Fortschritt über mehrere Partien ----------

export const LEERER_STAND = Object.freeze({ stufe: START_STUFE, bonus: 0, siege: 0, niederlagen: 0, remis: 0, serie: 0, duBeginnst: true })

/**
 * Nach einer Partie: Gewinnst du, steigt die Stufe (auf der höchsten wächst die Bedenkzeit).
 * Verlierst du zweimal hintereinander, geht sie eine zurück. Remis ändert nichts.
 * Wer beginnt, wechselt jede Partie.
 * @param ausgang 'sieg' | 'niederlage' | 'remis' aus deiner Sicht
 */
export function naechsterStand(stand, ausgang) {
  const s = { ...LEERER_STAND, ...stand }
  const neu = { ...s, duBeginnst: !s.duBeginnst }
  if (ausgang === 'sieg') {
    neu.siege++
    neu.serie = 0
    if (s.stufe < MAX_STUFE) neu.stufe = s.stufe + 1
    else neu.bonus = Math.min(MAX_BONUS, s.bonus + 1)
  } else if (ausgang === 'niederlage') {
    neu.niederlagen++
    neu.serie = s.serie + 1
    if (neu.serie >= 2) {
      neu.serie = 0
      if (s.bonus > 0) neu.bonus = s.bonus - 1
      else neu.stufe = Math.max(1, s.stufe - 1)
    }
  } else {
    neu.remis++
    neu.serie = 0
  }
  return neu
}

// ---------- Der Computer ----------

// Zobrist-Schlüssel: zwei 32-Bit-Zahlen je Feld und Stein, fest erzeugt (gleiche Stellung, gleicher Schlüssel)
const ZOB_HI = new Int32Array(FELDER * 3), ZOB_LO = new Int32Array(FELDER * 3)
{
  let x = 0x9e3779b9
  const zahl = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x | 0 }
  for (let i = 0; i < FELDER * 3; i++) { ZOB_HI[i] = zahl(); ZOB_LO[i] = zahl() }
}
const TT_BITS = 19, TT_GROESSE = 1 << TT_BITS, TT_MASKE = TT_GROESSE - 1
let tt = null
function tabelle() {
  if (!tt) tt = { hi: new Int32Array(TT_GROESSE), wert: new Int32Array(TT_GROESSE), tiefe: new Int8Array(TT_GROESSE), art: new Int8Array(TT_GROESSE), zug: new Int8Array(TT_GROESSE) }
  tt.art.fill(0)
  return tt
}
const GENAU = 1, UNTEN = 2, OBEN = 3     // Wert genau, mindestens, höchstens
const REIHENFOLGE = [3, 2, 4, 1, 5, 0, 6]
const ABBRUCH = { abbruch: true }

/**
 * Den Zug des Computers berechnen.
 * @param felder  42 Felder (0 leer, 1 du, 2 Computer), Spalten mit Schwerkraft gefüllt
 * @param opt     { stufe, bonus, stil (id), vorliebe (7 Zahlen), zufall, jetzt, zeitMs, tiefe }
 * @returns { spalte, wert, tiefe, knoten, werte: [7] }
 */
export function berechneZug(eingabe, opt = {}) {
  const stufe = STUFEN[opt.stufe] || STUFEN[START_STUFE]
  const stil = STILE[opt.stil] || STILE.mitte
  const zufall = opt.zufall || Math.random
  const jetzt = opt.jetzt || (() => Date.now())
  const vorliebe = opt.vorliebe || [0, 1, 2, 3, 2, 1, 0].map((m) => m * stil.mitte)
  const zeitMs = opt.zeitMs ?? (stufe.zeitMs + (opt.stufe === MAX_STUFE ? (opt.bonus || 0) * BONUS_MS : 0))
  const paritaet = (opt.paritaet ?? stufe.paritaet) * stil.fallen

  const felder = Int8Array.from(eingabe)
  const hoehe = new Int8Array(SPALTEN)
  const zaehl = new Int8Array(ANZ_LINIEN * 3)
  const spalte = new Int8Array(SPALTEN * 3)
  let steine = 0, hi = 0, lo = 0
  for (let s = 0; s < SPALTEN; s++) {
    for (let r = 0; r < REIHEN; r++) {
      const f = idx(s, r), v = felder[f]
      if (!v) break
      hoehe[s] = r + 1
      steine++
      for (const l of ZU_LINIEN[f]) zaehl[l * 3 + v]++
      spalte[s * 3 + v]++
      hi ^= ZOB_HI[f * 3 + v]; lo ^= ZOB_LO[f * 3 + v]
    }
  }
  const frei = []
  for (let s = 0; s < SPALTEN; s++) if (hoehe[s] < REIHEN) frei.push(s)
  if (!frei.length) return { spalte: -1, wert: 0, tiefe: 0, knoten: 0, werte: [] }
  // Wer ist dran, wer hat angefangen? Steine von beiden gleich viele: der Computer hat angefangen.
  const n1 = eingabe.filter((v) => v === DU).length, n2 = eingabe.filter((v) => v === COMPUTER).length
  const anziehend = n1 === n2 ? COMPUTER : DU
  // Gute Reihen für Drohungen (0-basiert): der Anziehende will ungerade Reihen (1, 3, 5 = Index 0, 2, 4)
  const gutFuer = (p, r) => (p === anziehend ? r % 2 === 0 : r % 2 === 1)

  const gewinnt = (s, p) => {
    const f = idx(s, hoehe[s])
    for (const l of ZU_LINIEN[f]) if (zaehl[l * 3 + p] === 3) return true
    return false
  }
  const setz = (s, p) => {
    const f = idx(s, hoehe[s]++)
    felder[f] = p
    for (const l of ZU_LINIEN[f]) zaehl[l * 3 + p]++
    spalte[s * 3 + p]++
    hi ^= ZOB_HI[f * 3 + p]; lo ^= ZOB_LO[f * 3 + p]
    steine++
  }
  const nimm = (s, p) => {
    const f = idx(s, --hoehe[s])
    felder[f] = 0
    for (const l of ZU_LINIEN[f]) zaehl[l * 3 + p]--
    spalte[s * 3 + p]--
    hi ^= ZOB_HI[f * 3 + p]; lo ^= ZOB_LO[f * 3 + p]
    steine--
  }

  // Bewertung immer aus Sicht des Computers, so wirken die Stil-Gewichte wie gemeint
  function bewerteComputer() {
    let w = 0
    for (let l = 0; l < ANZ_LINIEN; l++) {
      const c = zaehl[l * 3 + COMPUTER], d = zaehl[l * 3 + DU]
      if (c && !d) {
        w += stil.eigen[c]
        if (c === 3 && paritaet) w += drohung(l, COMPUTER)
      } else if (d && !c) {
        w -= stil.gegner[d]
        if (d === 3 && paritaet) w -= drohung(l, DU)
      }
    }
    for (let s = 0; s < SPALTEN; s++) w += vorliebe[s] * (spalte[s * 3 + COMPUTER] - spalte[s * 3 + DU]) * 0.5
    return w
  }
  // Eine Drohung (drei Steine, ein Feld frei): in der richtigen Reihe viel wert, sonst wenig
  function drohung(l, p) {
    const z = LINIEN[l]
    for (let k = 0; k < 4; k++) {
      const f = z[k]
      if (felder[f]) continue
      const r = f % REIHEN
      return (gutFuer(p, r) ? 9 : 2) * paritaet
    }
    return 0
  }
  const bewerte = (p) => (p === COMPUTER ? bewerteComputer() : -bewerteComputer())

  const T = tabelle()
  let knoten = 0, frist = Infinity

  function negamax(tiefe, alpha, beta, p, ply) {
    knoten++
    if ((knoten & 2047) === 0 && jetzt() > frist) throw ABBRUCH
    const q = 3 - p
    for (let s = 0; s < SPALTEN; s++) if (hoehe[s] < REIHEN && gewinnt(s, p)) return SIEG - ply - 1
    if (steine >= FELDER - 1) return 0      // letzter Stein gewinnt nicht: Remis
    let pflicht = -1, drohungen = 0
    for (let s = 0; s < SPALTEN; s++) if (hoehe[s] < REIHEN && gewinnt(s, q)) { drohungen++; pflicht = s }
    if (drohungen > 1) return -(SIEG - ply - 2)
    // Schranken: schneller als im nächsten eigenen Zug geht kein Sieg mehr
    const bestMoeglich = SIEG - ply - 3
    if (beta > bestMoeglich) { beta = bestMoeglich; if (alpha >= beta) return beta }
    if (tiefe <= 0 && pflicht < 0) return bewerte(p)

    const ti = lo & TT_MASKE
    let ttZug = -1
    if (T.art[ti] && T.hi[ti] === hi) {
      ttZug = T.zug[ti]
      if (T.tiefe[ti] >= tiefe) {
        let w = T.wert[ti]
        if (w > ENTSCHIEDEN) w -= ply; else if (w < -ENTSCHIEDEN) w += ply
        const a = T.art[ti]
        if (a === GENAU) return w
        if (a === UNTEN && w >= beta) return w
        if (a === OBEN && w <= alpha) return w
      }
    }

    const alphaVorher = alpha
    let best = -UNENDLICH, bestZug = -1
    const zuege = pflicht >= 0 ? [pflicht] : ordne(ttZug, q)
    // Ein erzwungener Zug kostet keine Tiefe: so sieht der Computer Zugzwang-Ketten zu Ende
    const naechste = pflicht >= 0 ? tiefe : tiefe - 1
    for (const s of zuege) {
      setz(s, p)
      const w = -negamax(naechste, -beta, -alpha, q, ply + 1)
      nimm(s, p)
      if (w > best) { best = w; bestZug = s }
      if (w > alpha) alpha = w
      if (alpha >= beta) break
    }
    let gespeichert = best
    if (gespeichert > ENTSCHIEDEN) gespeichert += ply; else if (gespeichert < -ENTSCHIEDEN) gespeichert -= ply
    T.hi[ti] = hi; T.wert[ti] = gespeichert; T.tiefe[ti] = Math.max(-1, Math.min(120, tiefe)); T.zug[ti] = bestZug
    T.art[ti] = best <= alphaVorher ? OBEN : best >= beta ? UNTEN : GENAU
    return best
  }

  // Zugreihenfolge: gemerkter Zug, dann von der Mitte nach außen; Züge, die dem Gegner das Feld
  // darüber zum Sieg freimachen, ganz nach hinten
  function ordne(ttZug, q) {
    const vorn = [], hinten = []
    if (ttZug >= 0 && hoehe[ttZug] < REIHEN) vorn.push(ttZug)
    for (const s of REIHENFOLGE) {
      if (s === ttZug || hoehe[s] >= REIHEN) continue
      if (hoehe[s] + 1 < REIHEN && unterDrohung(s, q)) hinten.push(s)
      else vorn.push(s)
    }
    return hinten.length ? vorn.concat(hinten) : vorn
  }
  // Würde ein Stein in Spalte s dem Gegner q das Feld darüber zum Sieg öffnen?
  function unterDrohung(s, q) {
    const f = idx(s, hoehe[s] + 1)
    for (const l of ZU_LINIEN[f]) if (zaehl[l * 3 + q] === 3) return true
    return false
  }

  const ich = COMPUTER, du = DU
  // Sofortsieg immer, Pflichtblock immer (außer der Computer ist gerade „blind“)
  for (const s of frei) if (gewinnt(s, ich)) return { spalte: s, wert: SIEG - 1, tiefe: 1, knoten: 1, werte: [] }
  const istBlind = stufe.blind > 0 && zufall() < stufe.blind
  if (istBlind) {
    // Schaut nur auf die eigene Stellung nach dem Zug, übersieht dabei deine Drohungen
    let best = null
    for (const s of frei) {
      setz(s, ich)
      const w = bewerteComputer() + zufall() * 6
      nimm(s, ich)
      if (!best || w > best.w) best = { s, w }
    }
    return { spalte: best.s, wert: Math.round(best.w), tiefe: 0, knoten: frei.length, werte: [] }
  }
  // Eine Drohung: zumachen. Zwei auf einmal: verloren, aber er macht eine zu, du sollst die andere finden.
  const blocks = frei.filter((s) => gewinnt(s, du))
  if (blocks.length) {
    const s = blocks[Math.floor(zufall() * blocks.length) % blocks.length]
    return { spalte: s, wert: blocks.length > 1 ? -(SIEG - 2) : 0, tiefe: 1, knoten: 1, werte: [] }
  }

  // Wurzel: iterativ tiefer. Mit Temperatur werden alle Züge genau bewertet (für den Fehler-Zufall),
  // sonst nur so genau, dass man gleich gute vom besten unterscheiden kann.
  const genau = stufe.temperatur > 0
  const maxTiefe = Math.min(opt.tiefe ?? stufe.tiefe, FELDER - steine)
  frist = zeitMs > 0 ? jetzt() + zeitMs : Infinity
  let ergebnisWerte = null, erreicht = 0
  let reihenfolge = REIHENFOLGE.filter((s) => hoehe[s] < REIHEN)
  const start = zeitMs > 0 ? 1 : maxTiefe
  for (let t = start; t <= maxTiefe; t++) {
    const werte = Array(SPALTEN).fill(null)
    let best = -UNENDLICH
    try {
      for (const s of reihenfolge) {
        setz(s, ich)
        let w
        if (genau || best === -UNENDLICH) w = -negamax(t - 1, -UNENDLICH, UNENDLICH, du, 1)
        else w = -negamax(t - 1, -UNENDLICH, -(best - 1), du, 1)
        nimm(s, ich)
        werte[s] = w
        if (w > best) best = w
      }
    } catch (e) {
      // Zeit um: das Brett bleibt halb belegt liegen, gebraucht wird es nicht mehr.
      // Es gilt die letzte vollständig gerechnete Runde.
      if (e !== ABBRUCH) throw e
      break
    }
    ergebnisWerte = werte
    erreicht = t
    // Beste Züge der letzten Runde zuerst: die nächste Runde schneidet dann früher ab
    reihenfolge = [...reihenfolge].sort((a, b) => werte[b] - werte[a])
    if (Math.abs(best) > ENTSCHIEDEN) break
  }
  const werte = ergebnisWerte || Array.from({ length: SPALTEN }, (_, s) => (frei.includes(s) ? 0 : null))
  return { spalte: waehle(werte, stufe.temperatur, zufall), wert: Math.max(...frei.map((s) => werte[s] ?? 0)), tiefe: erreicht, knoten, werte }
}

/**
 * Zug aus den Bewertungen wählen. Ohne Temperatur: zufällig unter den besten. Mit Temperatur:
 * schlechtere Züge mit abnehmender Wahrscheinlichkeit, aber nie ein verlorener, wenn es einen
 * anderen gibt, und nie an einem sicheren Sieg vorbei.
 */
export function waehle(werte, temperatur = 0, zufall = Math.random) {
  const kand = werte.map((w, s) => (w == null ? null : { s, w })).filter(Boolean)
  const best = Math.max(...kand.map((k) => k.w))
  if (temperatur <= 0 || best > ENTSCHIEDEN) {
    const top = kand.filter((k) => k.w === best)
    return top[Math.floor(zufall() * top.length) % top.length].s
  }
  const nichtVerloren = kand.filter((k) => k.w > -ENTSCHIEDEN)
  const pool = nichtVerloren.length ? nichtVerloren : kand
  const gewichte = pool.map((k) => Math.exp((Math.max(-60, k.w - best)) / temperatur))
  let r = zufall() * gewichte.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) { r -= gewichte[i]; if (r <= 0) return pool[i].s }
  return pool[pool.length - 1].s
}
