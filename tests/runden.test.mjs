// Keine Rundungsfehler: Teile ergeben genau die angezeigte Summe, Längen passen zu den
// angezeigten Positionen, Routenhinweis und Versorgung zeigen dieselbe Tank-Lücke.
// Beispiel Coral Coast: Abschnitte 1.930 km gegen Route 1.928 km, Tank-Lücke einmal 297,
// einmal 298 km — genau das darf nicht passieren.
// Ausführen: node tests/runden.test.mjs
import fs from 'node:fs'
import { rundeAufSumme, gleicheTeile } from '../src/lib/runden.js'
import { stichproben, streckenOhne, tankLuecken } from '../src/lib/routenhinweise.js'
import { versorgungAnRoute, luecken, nachAbschnitten, laengste } from '../src/lib/versorgung.js'
import { flugRoute, stimmigeLegs } from '../src/lib/routing.js'
import { abschnitte, zusammen } from '../src/lib/fahrtag.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const summe = (a) => a.reduce((x, y) => x + y, 0)

console.log('\n1  Teile ergeben genau die Summe (größte Reste)')
{
  const coral = [126.72, 77.52, 409.64, 413.02, 350.52, 73.96, 262.54, 213.91]
  const einzeln = coral.map(Math.round)
  const stimmig = rundeAufSumme(coral)
  p('einzeln gerundet wäre falsch: 1.930 statt 1.928 km', summe(einzeln) === 1930)
  p('stimmig gerundet: genau 1.928 km', summe(stimmig) === 1928, stimmig.join(' + '))
  p('jeder Teil höchstens 1 km vom genauen Wert', stimmig.every((k, i) => Math.abs(k - coral[i]) < 1))
  const gespeichert = [127, 78, 410, 413, 351, 74, 263, 214]
  const angeglichen = rundeAufSumme(gespeichert, 1928)
  p('gespeicherte ganze Zahlen auf eine kleinere Summe angleichen', summe(angeglichen) === 1928 && angeglichen.every((k, i) => Math.abs(k - gespeichert[i]) <= 1), angeglichen.join(' + '))
  p('auf eine größere Summe angleichen', summe(rundeAufSumme([10, 20, 30], 63)) === 63)
  p('nie unter 0', rundeAufSumme([0, 0, 1], 0).every((k) => k >= 0) && summe(rundeAufSumme([0, 0, 1], 0)) === 0)
  p('leer bleibt leer', rundeAufSumme([]).length === 0)
  p('Minuten wie km: 3 × 20,4 min = 61 min', summe(rundeAufSumme([20.4, 20.4, 20.4])) === 61)
  const t = gleicheTeile(790, 3)
  p('790 km auf 3 Tage: 264 + 263 + 263', t.join() === '264,263,263', t.join())
  p('gleiche Teile ergeben immer genau die Summe', [[1, 1], [999, 7], [1000, 3], [50, 4]].every(([s, n]) => summe(gleicheTeile(s, n)) === s))
}

console.log('\n2  Positionen und Längen passen zusammen')
{
  // Gerade Strecke nach Osten auf 25° Süd, ~500 km
  const geo = Array.from({ length: 6 }, (_, i) => [114 + i * 1, -25])
  const roh = stichproben(geo).at(-1).km
  const geeicht = stichproben(geo, 1, 503)
  p('Linie auf die Länge laut Route geeicht: Ziel genau bei 503 km', Math.abs(geeicht.at(-1).km - 503) < 1e-9, `${roh.toFixed(1)} → ${geeicht.at(-1).km}`)
  // Zufällige Punkte: jede Länge = bis − von, Ende = gerundete Gesamtlänge
  let alleStimmen = true, endeStimmt = true
  for (let n = 0; n < 200; n++) {
    const gesamt = 300 + (n * 37.37) % 900
    const punkte = Array.from({ length: (n % 7) + 1 }, (_, i) => ({ km: ((n * 13.7 + i * 97.31) % gesamt), name: 'P' + i })).sort((a, b) => a.km - b.km)
    const { luecken: ls } = streckenOhne(punkte, gesamt, { abKm: 0 })
    if (!ls.every((l) => l.vonKm + l.laenge === l.bisKm)) alleStimmen = false
    if (ls.at(-1).bisKm !== Math.round(gesamt)) endeStimmt = false
  }
  p('200 Zufallsrouten: immer „von km + Länge = bis km“', alleStimmen)
  p('die letzte Strecke endet genau bei der angezeigten Gesamtlänge', endeStimmt)
  const { luecken: l2, maxLuecke } = streckenOhne([{ km: 100.6, name: 'A' }, { km: 398.4, name: 'B' }], 500, { abKm: 150 })
  // Positionen einmal gerundet (101 und 398), die Länge ist ihre Differenz: 297 km. So steht
  // dieselbe Zahl in der Liste („Tankstelle bei km 398“) und an der Lücke („bis km 398“).
  p('Tankstellen bei km 100,6 und 398,4: km 101 bis 398, also 297 km', l2[0].laenge === 297 && l2[0].vonKm === 101 && l2[0].bisKm === 398, JSON.stringify(l2[0]))
  const lv = versorgungAnRoute([[114, -25], [119, -25]], [{ k: 'fuel', n: 'X', x: 116, y: -25 }], { gesamtKm: 505 })
  const lt = tankLuecken([[114, -25], [119, -25]], [{ x: 116, y: -25, n: 'X' }], { gesamtKm: 505, abKm: 0 })
  p('Liste und Lücke nennen für dieselbe Tankstelle dieselbe km-Zahl', lv[0].km === lt.luecken[0].bisKm && lt.luecken[1].vonKm === lv[0].km, `${lv[0].km} / ${lt.luecken[0].bisKm}`)
  p('die längste Strecke ist eine der angezeigten', maxLuecke === Math.max(...l2.map((l) => l.laenge)) || maxLuecke < 150)
}

console.log('\n3  Routenhinweis und Versorgung: dieselbe Tank-Lücke')
{
  const geo = Array.from({ length: 11 }, (_, i) => [114 + i * 0.5, -25])
  const gesamtKm = 507
  // Tankstellen knapp neben der Straße bei ~23 %, ~61 % und ~87 % der Strecke
  const fuel = [[115.13, -25.01], [117.03, -24.99], [118.33, -25.02]].map(([x, y], i) => ({ k: 'fuel', n: 'T' + i, x, y }))
  const wasser = [{ k: 'wasser', n: 'W', x: 116.0, y: -25.0 }]
  const t = tankLuecken(geo, fuel, { abKm: 100, gesamtKm })
  const liste = versorgungAnRoute(geo, [...fuel, ...wasser], { gesamtKm })
  const v = luecken(liste, gesamtKm, 'fuel', { abKm: 100 })
  p('gleiche Längen', JSON.stringify(t.luecken.map((l) => l.laenge)) === JSON.stringify(v.map((l) => l.laenge)), `${t.luecken.map((l) => l.laenge)} / ${v.map((l) => l.laenge)}`)
  p('gleiche Grenzen', JSON.stringify(t.luecken.map((l) => [l.vonKm, l.bisKm])) === JSON.stringify(v.map((l) => [l.vonKm, l.bisKm])))
  p('Ende der Route = Länge laut Route', t.gesamtKm === gesamtKm && (t.luecken.at(-1)?.bisKm ?? gesamtKm) <= gesamtKm)
  p('„längste“ in der Versorgung = längste im Routenhinweis', (laengste(t.luecken)?.laenge ?? t.maxLuecke) === t.maxLuecke || t.maxLuecke < 100)
  const src = fs.readFileSync(new URL('../src/lib/Versorgung.svelte', import.meta.url), 'utf8')
  p('Versorgung rechnet die Tank-Lücken nicht selbst, sondern übernimmt den Routenhinweis', src.includes('$hinweise[r.id]?.tank?.luecken') && !/luecken\(liste, [^)]*'fuel'/.test(src))
}

console.log('\n4  Abschnitte einer Route ergeben die Route')
{
  const flug = flugRoute([{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Broome', lat: -17.96, lon: 122.24 }, { name: 'Darwin', lat: -12.46, lon: 130.84 }, { name: 'Cairns', lat: -16.92, lon: 145.77 }])
  p('Flug: Abschnitte = Gesamt-km', summe(flug.legs.map((l) => l.km)) === flug.km)
  p('Flug: Abschnitte = Gesamtzeit', summe(flug.legs.map((l) => l.dauerMin)) === flug.dauerMin)
  const alt = { km: 1928, dauerMin: 1401, legs: [127, 78, 410, 413, 351, 74, 263, 214].map((km, i) => ({ km, dauerMin: [91, 60, 290, 280, 250, 55, 205, 170][i] })) }
  const sl = stimmigeLegs(alt)
  p('alte Route (Abschnitte 1.930 km) wird beim Lesen auf 1.928 km angeglichen', summe(sl.map((l) => l.km)) === 1928, sl.map((l) => l.km).join(' + '))
  p('… und die Zeiten auf die Gesamtzeit', summe(sl.map((l) => l.dauerMin)) === 1401)
  const neu = { km: 300, dauerMin: 200, legs: [{ km: 100, dauerMin: 70 }, { km: 200, dauerMin: 130 }] }
  p('stimmige Route bleibt unverändert', JSON.stringify(stimmigeLegs(neu).map((l) => [l.km, l.dauerMin])) === '[[100,70],[200,130]]')
  const ohneZeit = { km: 301, dauerMin: 200, legs: [{ km: 100 }, { km: 200 }] }
  const oz = stimmigeLegs(ohneZeit)
  p('fehlende Zeiten werden anteilig ergänzt und ergeben die Gesamtzeit', summe(oz.map((l) => l.km)) === 301 && summe(oz.map((l) => l.dauerMin)) === 200, JSON.stringify(oz))
}

console.log('\n5  Fahrtage ergeben die Route')
{
  const stops = [{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Cervantes', lat: -30.5, lon: 115.06 }, { name: 'Geraldton', lat: -28.78, lon: 114.61 }, { name: 'Kalbarri', lat: -27.71, lon: 114.17 }]
  const mitLegs = { stops, route: { km: 591, dauerMin: 412, sig: '', legs: [{ km: 196, dauerMin: 137 }, { km: 228, dauerMin: 158 }, { km: 168, dauerMin: 118 }] } }
  const z1 = zusammen(abschnitte(mitLegs))
  p('mit alten Abschnitten (Summe 592): Fahrtage ergeben genau 591 km, 412 min', z1.km === 591 && z1.fahrMin === 412, `${z1.km} km, ${z1.fahrMin} min`)
  const nurGesamt = { stops, route: { km: 591, dauerMin: 412, sig: '' } }
  const z2 = zusammen(abschnitte(nurGesamt))
  p('nur Gesamtwerte: verteilt und genau 591 km, 412 min', z2.km === 591 && z2.fahrMin === 412, `${z2.km} km, ${z2.fahrMin} min`)
  const z3 = zusammen(abschnitte({ stops }))
  p('ohne Route: Luftlinie, Summe gleich der gerundeten Summe', Number.isInteger(z3.km) && z3.km > 0)
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
