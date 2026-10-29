// Hinweise entlang der Route (lib/routenhinweise.js): Tank-Lücken, Sehenswertes, Wetterpunkte.
// Ausführen: node tests/routenhinweise.test.mjs
import fs from 'node:fs'
import { projektDatei } from './projektpfad.mjs'
import { tankLuecken, orteAnRoute, wetterPunkte, stoppEinfuegen, stichproben } from '../src/lib/routenhinweise.js'
import { tankAnalyse } from '../src/lib/routing.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

// Kunst-Route: gerade nach Osten auf 25° Süd, 0,01° ≈ 1,009 km. Stützpunkte absichtlich
// nur alle 20 km — wie auf Outback-Highways.
const LAT = -25
const lonBeiKm = (k) => 115 + k / (111.32 * Math.cos(LAT * Math.PI / 180))
const gerade = (bisKm, schritt = 20) => { const g = []; for (let k = 0; k <= bisKm; k += schritt) g.push([lonBeiKm(k), LAT]); return g }

console.log('\n1  Abtasten')
{
  const pr = stichproben(gerade(400))
  p('400 km Strecke wird etwa alle 1 km abgetastet (je Abschnitt aufgerundet)', pr.length >= 395 && pr.length <= 425, String(pr.length))
  p('Gesamtlänge stimmt auf 1 %', Math.abs(pr[pr.length - 1].km - 400) < 4, pr[pr.length - 1].km.toFixed(1))
}

console.log('\n2  Tank-Lücken')
{
  const geo = gerade(600)
  const t = (km, n, versatzKm = 0) => ({ x: lonBeiKm(km), y: LAT - versatzKm / 110.57, n })
  const r = tankLuecken(geo, [t(100, 'A'), t(150, 'B', 3), t(480, 'C')], { reichweiteKm: 300, abKm: 150, start: 'Perth', ziel: 'Ziel' })
  p('Tankstelle 3 km neben der Straße zählt, obwohl der nächste Stützpunkt 10 km weg ist', r.stationen === 3, String(r.stationen))
  p('längste Lücke = B → C (330 km)', Math.abs(r.maxLuecke - 330) <= 2, String(r.maxLuecke))
  p('Lücken ab 150 km in Fahrtrichtung', r.luecken.map((l) => l.von + '→' + l.bis).join(',') === 'B→C', r.luecken.map((l) => l.von + '→' + l.bis).join(','))
  p('über der Reichweite rot markiert', r.luecken[0].ueberReichweite === true)
  const weit = tankLuecken(geo, [t(300, 'X', 12)], { reichweiteKm: 500 })
  p('Tankstelle 12 km abseits zählt nicht (Korridor 5 km)', weit.stationen === 0)

  // Hin und zurück: dieselbe Tankstelle zweimal passiert
  const hinZurueck = [...gerade(500), ...gerade(500).reverse().slice(1)]
  const hz = tankLuecken(hinZurueck, [t(250, 'Mitte')], { reichweiteKm: 600, abKm: 0 })
  p('Hin und zurück: Tankstelle zählt bei BEIDEN Durchgängen', hz.stationen === 2, String(hz.stationen))
  p('   → längste Lücke 500 km, nicht 750 km', Math.abs(hz.maxLuecke - 500) <= 3, String(hz.maxLuecke))

  const namen = tankLuecken(geo, [t(100, ''), t(200, 'Ampol')], { reichweiteKm: 500, abKm: 0, ortsnamen: [{ name: 'Tom Price', lat: LAT, lon: lonBeiKm(95) }, { name: 'Paraburdoo', lat: LAT, lon: lonBeiKm(205) }] })
  p('namenlose Tankstelle heißt nach dem nächsten Ort', namen.luecken.some((l) => l.von === 'Tankstelle bei Tom Price' || l.bis === 'Tankstelle bei Tom Price'))
  p('reiner Markenname bekommt den Ort dazu', namen.luecken.some((l) => l.von === 'Ampol bei Paraburdoo' || l.bis === 'Ampol bei Paraburdoo'))
}

console.log('\n3  Sehenswertes nahe der Route')
{
  const geo = gerade(600)
  const stops = [{ name: 'Start', lat: LAT, lon: lonBeiKm(0) }, { name: 'Mitte', lat: LAT, lon: lonBeiKm(300) }, { name: 'Ende', lat: LAT, lon: lonBeiKm(600) }]
  const ort = (id, name, km, abseitsKm, tags = []) => ({ id, name, tags, lat: LAT - abseitsKm / 110.57, lon: lonBeiKm(km) })
  const orte = [ort('a', 'Schlucht A', 120, 10, ['MUSS-SEHEN']), ort('b', 'Strand B', 450, 20), ort('c', 'Weit weg', 200, 60), ort('d', 'Mitte Nationalpark', 305, 2)]
  const v = orteAnRoute(geo, orte, stops, { maxKm: 25 })
  p('findet Orte bis 25 km neben der Route', v.map((x) => x.ort.id).join(',') === 'a,b', v.map((x) => x.ort.id).join(','))
  p('   in Fahrtrichtung sortiert, mit Abstand', v[0].abstand === 10 && v[1].abstand === 20)
  p('   Einfügestelle: A nach „Start", B nach „Mitte"', v[0].nachStopp === 0 && v[1].nachStopp === 1, v.map((x) => x.nachStopp).join(','))
  p('Ort ≤ 5 km neben einem Stopp gilt als eingeplant', !v.some((x) => x.ort.id === 'd'))
  p('ausgeblendete Orte erscheinen nicht', orteAnRoute(geo, orte, stops, { ignoriert: ['a'] }).every((x) => x.ort.id !== 'a'))
  const gleichesWort = orteAnRoute(geo, [ort('k', 'Karijini NP', 400, 15)], [...stops, { name: 'Karijini National Park', lat: LAT - 0.5, lon: lonBeiKm(420) }])
  p('„Karijini NP" = Stopp „Karijini National Park" (gemeinsames Kennwort)', gleichesWort.length === 0)
  const eingefuegt = stoppEinfuegen(stops, v[1].nachStopp, v[1].ort)
  p('+ Stopp fügt an der richtigen Stelle ein', eingefuegt.map((s) => s.name).join(' → ') === 'Start → Mitte → Strand B → Ende', eingefuegt.map((s) => s.name).join(' → '))

  // Zweimal durch dieselbe Gegend: der zweite Stopp gleichen Namens darf nicht auf den ersten fallen
  const hinZurueck = [...gerade(500), ...gerade(500).reverse().slice(1)]
  const st2 = [{ name: 'West', lat: LAT, lon: lonBeiKm(0) }, { name: 'Ost', lat: LAT, lon: lonBeiKm(500) }, { name: 'West', lat: LAT, lon: lonBeiKm(0) }]
  const zurueck = orteAnRoute(hinZurueck, [ort('z', 'Zwischenhalt', 250, 8)], st2, { maxKm: 25 })
  p('Stopps werden in Reihenfolge verortet (zweiter Besuch ≠ erster)', zurueck.length === 1 && zurueck[0].nachStopp === 0, JSON.stringify(zurueck.map((x) => x.nachStopp)))
}

console.log('\n4  Wetterpunkte')
{
  const w = wetterPunkte(gerade(1000))
  p('etwa alle 100 km, Start und Ziel dabei', w.length >= 10 && w.length <= 12 && w[0].km === 0 && w[w.length - 1].km >= 980, `${w.length} Punkte, letzter km ${w[w.length - 1].km}`)
  p('lange Strecke: höchstens 60 Punkte (eine Anfrage)', wetterPunkte(gerade(9000)).length <= 61)
}

console.log('\n5  Echte Route „Nord 3" (Backup 05.08.)')
const sicherung = projektDatei('_Sicherung/App-Daten/WA-Reiseplan-Backup_2026-08-05-13.json')
if (!fs.existsSync(sicherung)) console.log('  · übersprungen: private Sicherung fehlt auf diesem Rechner')
else {
  const b = JSON.parse(fs.readFileSync(sicherung, 'utf8'))
  const r = b.reisen.find((x) => x.name.startsWith('Nord 3'))
  const fuel = JSON.parse(fs.readFileSync(new URL('../public/pois-wa.json', import.meta.url), 'utf8')).filter((x) => x.k === 'fuel')
  const orte = JSON.parse(fs.readFileSync(new URL('../public/orte.json', import.meta.url), 'utf8'))
  const t0 = Date.now()
  const alt = r.route.tank
  const neu = tankAnalyse(r.route.geometry, fuel, 500)
  const ms = Date.now() - t0
  p(`gespeicherte alte Rechnung: max ${alt.maxLuecke} km (Schein-Lücke) → neu ${neu.maxLuecke} km`, alt.maxLuecke > 900 && neu.maxLuecke < 500)
  p(`schnell genug fürs iPhone (${ms} ms für 23.298 Stützpunkte und 899 Tankstellen)`, ms < 400, `${ms} ms`)
  const v = orteAnRoute(r.route.geometry, orte, r.stops, { maxKm: 25 })
  p('Vorschläge enthalten Monkey Mia und Turquoise Bay', ['Monkey Mia', 'Turquoise Bay'].every((n) => v.some((x) => x.ort.name.startsWith(n))), v.map((x) => x.ort.name).join(' | '))
  p('… aber nicht Karijini, Kalbarri, Millstream (schon Stopps)', !v.some((x) => /Karijini|Kalbarri|Millstream/.test(x.ort.name)))
  p('Orte bei Exmouth passen vor den Stopp Exmouth', v.filter((x) => /Turquoise|Charles Knife/.test(x.ort.name)).every((x) => r.stops[x.nachStopp + 1]?.name === 'Exmouth'),
    v.filter((x) => /Turquoise|Charles Knife/.test(x.ort.name)).map((x) => r.stops[x.nachStopp].name + '→' + r.stops[x.nachStopp + 1]?.name).join(' | '))
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
