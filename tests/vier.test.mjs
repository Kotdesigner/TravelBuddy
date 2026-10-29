// Vier in einer Reihe (Easter-Egg „4444“): Regeln, Computer und Stufen (lib/vier.js).
// Ausführen: node tests/vier.test.mjs
import fs from 'node:fs'
import {
  SPALTEN, REIHEN, DU, COMPUTER, idx, LINIEN, neuesBrett, kannSetzen, setze, gewinnLinie, ergebnis,
  berechneZug, waehle, neuerStil, naechsterStand, STUFEN, STILE, MAX_STUFE, START_STUFE, MAX_BONUS, LEERER_STAND,
} from '../src/lib/vier.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
// Zufall mit Startwert, damit Fehlschläge sich wiederholen lassen
const zufallAus = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let z = Math.imul(a ^ (a >>> 15), 1 | a)
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}
// Brett aus Spalten von unten nach oben: { 0: [2, 1], 3: [1] }
const brettAus = (spalten) => {
  const felder = Array(SPALTEN * REIHEN).fill(0), hoehe = Array(SPALTEN).fill(0)
  for (const [s, steine] of Object.entries(spalten)) steine.forEach((v, r) => { felder[idx(+s, r)] = v; hoehe[+s] = r + 1 })
  return { felder, hoehe, letzte: -1 }
}
const schnell = { zeitMs: 0 }

console.log('\n1  Brett und Regeln')
{
  p('69 Viererlinien', LINIEN.length === 69)
  let b = neuesBrett()
  for (let i = 0; i < 6; i++) b = setze(b, 2, i % 2 ? COMPUTER : DU)
  p('Steine fallen nach unten, Spalte voll nach sechs', b.hoehe[2] === 6 && b.felder[idx(2, 0)] === DU && b.felder[idx(2, 5)] === COMPUTER && !kannSetzen(b, 2) && setze(b, 2, DU) === null)
  p('Spalte außerhalb geht nicht', !kannSetzen(b, -1) && !kannSetzen(b, 7))
  const waag = brettAus({ 1: [DU], 2: [DU], 3: [DU], 4: [DU] })
  p('waagerecht', ergebnis(waag)?.sieger === DU && gewinnLinie(waag).join() === [idx(1, 0), idx(2, 0), idx(3, 0), idx(4, 0)].join())
  p('senkrecht', ergebnis(brettAus({ 5: [COMPUTER, COMPUTER, COMPUTER, COMPUTER] }))?.sieger === COMPUTER)
  p('schräg nach oben', ergebnis(brettAus({ 0: [DU], 1: [COMPUTER, DU], 2: [COMPUTER, COMPUTER, DU], 3: [COMPUTER, COMPUTER, COMPUTER, DU] }))?.sieger === DU)
  p('schräg nach unten', ergebnis(brettAus({ 3: [DU], 2: [COMPUTER, DU], 1: [COMPUTER, COMPUTER, DU], 0: [COMPUTER, COMPUTER, COMPUTER, DU] }))?.sieger === DU)
  p('drei reichen nicht', ergebnis(brettAus({ 0: [DU], 1: [DU], 2: [DU] })) === null)
  // Ein volles Brett ohne Vierer (oberste Reihe zuerst)
  const reihen = ['1121121', '2112112', '2221121', '1122212', '2211212', '2122211']
  const remis = brettAus(Object.fromEntries([...Array(SPALTEN).keys()].map((s) => [s, [...reihen].reverse().map((z) => Number(z[s]))])))
  p('volles Brett ohne Vierer: Remis', ergebnis(remis)?.sieger === 0)
  const letzter = setze(brettAus({ 0: [DU], 1: [DU], 2: [DU] }), 3, DU)
  p('nach einem Zug wird nur um den letzten Stein gesucht', letzter.letzte === idx(3, 0) && ergebnis(letzter)?.sieger === DU)
}

console.log('\n2  Der Computer sieht das Nötige, auf jeder Stufe')
{
  // Computer hat unten drei nebeneinander, Spalte 3 gewinnt
  const sieg = brettAus({ 0: [COMPUTER], 1: [COMPUTER], 2: [COMPUTER], 5: [DU], 6: [DU, DU] })
  const alle = [1, 2, 3, 4, 5, 6, 7].map((st) => berechneZug(sieg.felder, { stufe: st, zufall: () => 0, ...schnell }).spalte)
  p('nimmt den Sofortsieg, auch wenn er gerade „blind“ ist', alle.every((s) => s === 3), alle.join())
  // Du hast unten drei nebeneinander, Spalte 3 muss zu
  const block = brettAus({ 0: [DU], 1: [DU], 2: [DU], 5: [COMPUTER], 6: [COMPUTER] })
  const geblockt = [4, 5, 6, 7].map((st) => berechneZug(block.felder, { stufe: st, ...schnell }).spalte)
  p('blockt ab Stufe 4 immer', geblockt.every((s) => s === 3), geblockt.join())
  // Deine Drohung liegt in Reihe 2 über Spalte 3: wer unten in Spalte 3 setzt, verliert sofort
  const falle = brettAus({ 0: [COMPUTER, DU], 1: [COMPUTER, DU], 2: [DU, DU], 5: [COMPUTER], 6: [COMPUTER] })
  p('Stellung ist gültig: du hast eine Drohung über Spalte 3', ergebnis(setze(setze(falle, 3, COMPUTER), 3, DU))?.sieger === DU)
  const vermieden = [4, 5, 6, 7].map((st) => berechneZug(falle.felder, { stufe: st, zeitMs: 300 }).spalte)
  p('setzt nicht unter deine Drohung', vermieden.every((s) => s !== 3), vermieden.join())
  // _ 2 2 _ _ in der untersten Reihe: Spalte 1 oder 4 macht eine Doppeldrohung
  const doppel = brettAus({ 2: [COMPUTER], 3: [COMPUTER], 6: [DU, DU] })
  const r = berechneZug(doppel.felder, { stufe: 5, ...schnell })
  p('findet den erzwungenen Sieg über eine Doppeldrohung', [1, 4].includes(r.spalte) && r.wert > 999000, `${r.spalte} ${r.wert}`)
  // _ 1 1 1 _ unten: zwei Drohungen auf einmal, eine kann er nur zumachen
  const verloren = brettAus({ 1: [DU], 2: [DU], 3: [DU], 5: [COMPUTER], 6: [COMPUTER] })
  const rv = berechneZug(verloren.felder, { stufe: 6, ...schnell, tiefe: 4 })
  p('zwei Drohungen von dir auf einmal: er weiß, dass es verloren ist, und blockt trotzdem', rv.wert < -999000 && [0, 4].includes(rv.spalte), `${rv.spalte} ${rv.wert}`)
}

console.log('\n3  Endspiele: genauso gut wie vollständiges Durchrechnen')
{
  // Unabhängiger, langsamer Löser zum Vergleich: Wert (+1, 0, -1) für den, der dran ist
  function loese(b, dran) {
    let best = -2
    for (let s = 0; s < SPALTEN; s++) {
      const n = setze(b, s, dran)
      if (!n) continue
      const e = ergebnis(n)
      const w = e ? (e.sieger === dran ? 1 : 0) : -loese(n, 3 - dran)
      if (w > best) best = w
      if (best === 1) break
    }
    return best === -2 ? 0 : best
  }
  const zufall = zufallAus(4711)
  let geprueft = 0, gleich = 0, fehler = []
  for (let versuch = 0; versuch < 400 && geprueft < 12; versuch++) {
    // Zufällige Partie bis 9 freie Felder, ohne dass schon jemand gewonnen hat; dann ist der Computer dran
    let b = neuesBrett(), dran = DU, kaputt = false
    while (42 - b.hoehe.reduce((a, h) => a + h, 0) > 9) {
      const frei = [...Array(SPALTEN).keys()].filter((s) => kannSetzen(b, s))
      b = setze(b, frei[Math.floor(zufall() * frei.length)], dran)
      if (ergebnis(b)) { kaputt = true; break }
      dran = 3 - dran
    }
    if (kaputt || dran !== COMPUTER) continue
    const zug = berechneZug(b.felder, { stufe: 7, zeitMs: 0, tiefe: 42 })
    const optimal = loese(b, COMPUTER)
    const nach = setze(b, zug.spalte, COMPUTER)
    const e = ergebnis(nach)
    const erreicht = e ? (e.sieger === COMPUTER ? 1 : 0) : -loese(nach, DU)
    geprueft++
    if (erreicht === optimal) gleich++
    else fehler.push(`Versuch ${versuch}: Zug ${zug.spalte} erreicht ${erreicht}, möglich ${optimal}`)
  }
  p(`Stufe 7 spielt in ${geprueft} zufälligen Endspielen den bestmöglichen Zug`, geprueft >= 8 && gleich === geprueft, fehler.join('; '))
}

console.log('\n4  Abwechslung')
{
  const nachMitte = setze(neuesBrett(), 3, DU)
  const antworten = new Set()
  for (let i = 0; i < 30; i++) {
    const st = neuerStil(zufallAus(100 + i))
    antworten.add(berechneZug(nachMitte.felder, { stufe: 4, stil: st.id, vorliebe: st.vorliebe, zufall: zufallAus(900 + i), ...schnell }).spalte)
  }
  p('Stufe 4 antwortet auf denselben Eröffnungszug nicht immer gleich', antworten.size >= 2, [...antworten].join())
  const stile = new Set([...Array(40).keys()].map((i) => neuerStil(zufallAus(i + 1)).id))
  p('jede Partie ein anderer Stil (alle fünf kommen vor)', stile.size === Object.keys(STILE).length, [...stile].join())
  const v1 = neuerStil(zufallAus(1)).vorliebe, v2 = neuerStil(zufallAus(2)).vorliebe
  p('Lieblingsspalten mit Zufall, Mitte bleibt vorn', v1.join() !== v2.join() && v1[3] > v1[0] && v2[3] > v2[6])
  p('gleich gute Züge: das Los entscheidet', waehle([5, 9, 9, null, 1, 9, 0], 0, () => 0) === 1 && waehle([5, 9, 9, null, 1, 9, 0], 0, () => 0.99) === 5)
  const mitVerlust = [-999990, 3, 2, -999995, 1, null, 0]
  const gewaehlt = new Set([...Array(200).keys()].map((i) => waehle(mitVerlust, 20, zufallAus(i + 7))))
  p('auch mit viel Fehlerlaune nie ein verlorener Zug, wenn es einen anderen gibt', !gewaehlt.has(0) && !gewaehlt.has(3) && gewaehlt.size >= 3, [...gewaehlt].join())
  p('an einem sicheren Sieg geht er nie vorbei', waehle([999997, 50, 60, 0, 0, 0, 0], 50, () => 0.999) === 0)
}

console.log('\n5  Stufen')
{
  p('sieben Stufen, Start auf Stufe 4', Object.keys(STUFEN).length === MAX_STUFE && START_STUFE === 4)
  const oberflaeche = fs.readFileSync(new URL('../src/lib/VierSpiel.svelte', import.meta.url), 'utf8')
  p('jede Stufe und jeder Stil hat einen Namen in der Oberfläche', [1, 2, 3, 4, 5, 6, 7].every((s) => new RegExp(`\\b${s}: t\\('`).test(oberflaeche))
    && Object.keys(STILE).every((id) => new RegExp(`\\b${id}: t\\('`).test(oberflaeche)))
  const worker = fs.readFileSync(new URL('../src/lib/vier.js', import.meta.url), 'utf8')
  p('die Spiellogik zieht kein Wörterbuch in den Worker', !/from '\.\/i18n\.js'/.test(worker))
  p('höhere Stufe rechnet tiefer und macht weniger Fehler', [1, 2, 3, 4, 5, 6].every((s) => STUFEN[s + 1].tiefe > STUFEN[s].tiefe && STUFEN[s + 1].temperatur <= STUFEN[s].temperatur))
  p('ab Stufe 4 übersieht er nichts mehr', [4, 5, 6, 7].every((s) => STUFEN[s].blind === 0))
  const t0 = Date.now()
  const z = berechneZug(setze(neuesBrett(), 3, DU).felder, { stufe: 7, zeitMs: 250 })
  const dauer = Date.now() - t0
  p('Bedenkzeit wird eingehalten und genutzt', dauer < 700 && z.tiefe >= 8, `${dauer} ms, Tiefe ${z.tiefe}`)
  // Zwei Partien Stufe 5 gegen Stufe 2, jede Seite beginnt einmal
  const spiegel = (f) => f.map((v) => (v === DU ? COMPUTER : v === COMPUTER ? DU : 0))
  let siegeStark = 0
  for (const starkBeginnt of [true, false]) {
    let b = neuesBrett(), stark = starkBeginnt, e = null
    const sa = neuerStil(zufallAus(starkBeginnt ? 5 : 6)), sb = neuerStil(zufallAus(starkBeginnt ? 8 : 9))
    while (!(e = ergebnis(b))) {
      if (stark) b = setze(b, berechneZug(b.felder, { stufe: 5, stil: sa.id, vorliebe: sa.vorliebe, zufall: zufallAus(b.hoehe.join('') * 1), ...schnell }).spalte, COMPUTER)
      else b = setze(b, berechneZug(spiegel(b.felder), { stufe: 2, stil: sb.id, vorliebe: sb.vorliebe, zufall: zufallAus(b.hoehe.join('') * 3 + 1), ...schnell }).spalte, DU)
      stark = !stark
    }
    if (e.sieger === COMPUTER) siegeStark++
  }
  p('Stufe 5 schlägt Stufe 2, egal wer beginnt', siegeStark === 2, String(siegeStark))
}

console.log('\n6  Gewinnst du, wird er stärker')
{
  let s = { ...LEERER_STAND }
  p('Start: Stufe 4, du beginnst', s.stufe === 4 && s.duBeginnst)
  s = naechsterStand(s, 'sieg')
  p('Sieg: eine Stufe höher, jetzt beginnt der Computer', s.stufe === 5 && s.siege === 1 && !s.duBeginnst)
  s = naechsterStand(s, 'niederlage')
  p('eine Niederlage: Stufe bleibt', s.stufe === 5 && s.serie === 1 && s.niederlagen === 1 && s.duBeginnst)
  s = naechsterStand(s, 'remis')
  p('Remis: Stufe bleibt, Niederlagen-Serie vorbei', s.stufe === 5 && s.serie === 0 && s.remis === 1)
  s = naechsterStand(naechsterStand(s, 'niederlage'), 'niederlage')
  p('zwei Niederlagen hintereinander: eine Stufe zurück', s.stufe === 4 && s.serie === 0)
  for (let i = 0; i < 3; i++) s = naechsterStand(s, 'sieg')
  p('bis zur höchsten Stufe', s.stufe === MAX_STUFE && s.bonus === 0)
  for (let i = 0; i < 6; i++) s = naechsterStand(s, 'sieg')
  p('danach mehr Bedenkzeit, gedeckelt', s.stufe === MAX_STUFE && s.bonus === MAX_BONUS)
  s = naechsterStand(naechsterStand(s, 'niederlage'), 'niederlage')
  p('zwei Niederlagen ganz oben: erst Bedenkzeit zurück, Stufe bleibt', s.stufe === MAX_STUFE && s.bonus === MAX_BONUS - 1)
  let unten = { ...LEERER_STAND, stufe: 1 }
  for (let i = 0; i < 4; i++) unten = naechsterStand(unten, 'niederlage')
  p('nie unter Stufe 1', unten.stufe === 1)
  p('alter Stand ohne neue Felder wird ergänzt', naechsterStand({ stufe: 3 }, 'sieg').stufe === 4 && naechsterStand({ stufe: 3 }, 'sieg').siege === 1)
}

console.log('\n7  Suche')
{
  const such = fs.readFileSync(new URL('../src/lib/Suchblatt.svelte', import.meta.url), 'utf8')
  p('„4444“ öffnet Vier in einer Reihe', /wort === '4444'\) \{ q = ''; onvier\(\) \}/.test(such))
  p('„sn4ke“ öffnet Snake', /wort === 'sn4ke'\) \{ q = ''; onsnake\(\) \}/.test(such))
  p('„snake“ sucht wieder ganz normal', !/wort === 'snake'/.test(such))
  const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8')
  p('App hängt das Spiel ein', app.includes('onvier={() => { sucheOffen = false; vierOffen = true }}') && app.includes('<VierSpiel onClose='))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
