// Sperrungen in der Wegwahl (V29): Was sperrt (4WD-Regel, Flächen nie), Zuordnung der Main-Roads-Linien
// zu den Straßen aus OpenStreetMap über Abstand und Richtung, Erkennen an der Route, Umleitung,
// Einbau mit Frage-Fenster. Echte Linien: tests/daten/mainroads-beispiel.json (öffentliche Meldungen
// von Main Roads WA, ohne Datumsangaben), hier zum Prüfen als „gesperrt“ behandelt.
import fs from 'node:fs'
import { baueNetz, netzAlsDatei } from '../scripts/strassennetz-kern.mjs'
import { leseNetz, routeOffline, punkt } from '../src/lib/offline-router.js'
import { sperrtFuer, nurAllrad, kantenFuerMeldung, sperrKanten, sperrungenAnRoute, proben, SPERR_ABSTAND_M } from '../src/lib/sperrungen.js'
import { liesStrassen } from '../src/lib/strassenlage.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\nWas sperrt')
const L = [[[116, -31], [116.01, -31]]]
p('„Gesperrt“ sperrt immer, auch mit 4WD', sperrtFuer({ rang: 3, linien: L }) && sperrtFuer({ rang: 3, linien: L }, { allrad: true }))
p('„Nur mit Allrad“ sperrt nur ohne 4WD', sperrtFuer({ rang: 2, sperrung: '4WD only', linien: L }) && !sperrtFuer({ rang: 2, sperrung: '4WD only', linien: L }, { allrad: true }) && nurAllrad({ hinweis: 'Four wheel drive only' }))
p('Teilsperrung einer Spur, „mit Vorsicht“ und Hinweise sperren nicht', !sperrtFuer({ rang: 2, sperrung: 'One lane closed', linien: L }) && !sperrtFuer({ rang: 1, linien: L }) && !sperrtFuer({ rang: 0, linien: L }))
p('Flächenwarnungen (Feuer, Flut, Zyklon) sperren nie, auch bei höchster Stufe', !sperrtFuer({ rang: 3, linien: L, ringe: [[[116, -31], [116.1, -31], [116.1, -31.1], [116, -31]]] }) && !sperrtFuer({ rang: 3 }))

// Testnetz bei Perth: Hauptstraße A (Ost–West), Querstraße B (Nord–Süd) kreuzt sie, Parallelstraße C
// 200 m nördlich von A, verbunden über D im Westen und E im Osten. Dazu eine getrennte Straße F/G
// (zwei Einbahnen 20 m auseinander) und eine Ortsstraße H 20 m neben F, in beide Richtungen offen.
const W = (tags, refs, coords) => ({ tags, refs, coords })
const y0 = -31.9, dyC = 200 / 110574, x = (km) => 115.8 + km / 94.5
const WEGE = [
  W({ highway: 'primary' }, [1, 2, 3], [[x(0), y0], [x(5), y0], [x(10), y0]]),            // A mit Kreuzung bei 5 km
  W({ highway: 'secondary' }, [10, 2, 11], [[x(5), y0 - 0.02], [x(5), y0], [x(5), y0 + 0.02]]), // B quer
  W({ highway: 'secondary' }, [20, 21], [[x(0), y0 + dyC], [x(10), y0 + dyC]]),             // C parallel
  W({ highway: 'secondary' }, [1, 20], [[x(0), y0], [x(0), y0 + dyC]]),                     // D
  W({ highway: 'secondary' }, [3, 21], [[x(10), y0], [x(10), y0 + dyC]]),                   // E
]
const net = leseNetz(netzAlsDatei(baueNetz((f) => WEGE.forEach(f), { minKomponenteKm: 0 })))
const kantenBei = (lon, lat) => { const out = []; for (let i = 0; i < net.M; i++) { const n = net.eGeoS[i + 1] - net.eGeoS[i]; for (let k = 0; k <= n; k++) { const a = punkt(net, i, k), b = punkt(net, i, k + 1); if (Math.min(a[0], b[0]) - 1e-6 <= lon && lon <= Math.max(a[0], b[0]) + 1e-6 && Math.min(a[1], b[1]) - 1e-6 <= lat && lat <= Math.max(a[1], b[1]) + 1e-6) out.push(i) } } return [...new Set(out)] }
const kA = kantenBei(x(2), y0)[0], kC = kantenBei(x(2), y0 + dyC)[0], kB = kantenBei(x(5), y0 - 0.01)[0]
console.log('\nZuordnung über Abstand und Richtung (Testnetz)')
const versetzt = 15 / 110574
const aufA = { rang: 3, linien: [[[x(1), y0 + versetzt], [x(3), y0 + versetzt]]] }
const rA = kantenFuerMeldung(net, aufA)
p('Sperrung 15 m neben Straße A: genau A gesperrt, nicht die Parallelstraße 200 m daneben', rA.kanten.includes(kA) && !rA.kanten.includes(kC) && rA.gedeckt === 1, JSON.stringify(rA))
const ueberKreuzung = { rang: 3, linien: [[[x(4.5), y0], [x(5.5), y0]]] }
const rK = kantenFuerMeldung(net, ueberKreuzung)
p('Sperrung über die Kreuzung: die Querstraße B bleibt offen (Richtung passt nicht)', !rK.kanten.includes(kB) && rK.kanten.length === 2, JSON.stringify(rK.kanten))
const aufB = { rang: 3, linien: [[[x(5), y0 - 0.01], [x(5), y0 + 0.01]]] }
p('Sperrung auf der Querstraße: nur B, nicht A', (() => { const r = kantenFuerMeldung(net, aufB); return r.kanten.every((e) => kantenBei(x(5), y0 - 0.005).includes(e) || kantenBei(x(5), y0 + 0.005).includes(e)) && !r.kanten.includes(kA) })())
p('Zu weit weg (60 m): keine Zuordnung', kantenFuerMeldung(net, { rang: 3, linien: [[[x(1), y0 + 60 / 110574], [x(3), y0 + 60 / 110574]]] }).kanten.length === 0 && SPERR_ABSTAND_M === 40)
p('Punkt-Meldung: nächste Straße bis 100 m', kantenFuerMeldung(net, { rang: 3, punkte: [[x(2), y0 + 30 / 110574]] }).kanten[0] === kA)
p('Proben alle 50 m entlang der Linie, mit Richtung', (() => { const s = proben([[x(0), y0], [x(1), y0]]); return s.length === 20 && Math.abs(s[0].ux - 1) < 1e-6 })())

// Getrennte Fahrbahnen: zwei Einbahnen 20 m auseinander, daneben eine offene Ortsstraße
const yF = -31.95, d20 = 20 / 110574
const DUO = [
  W({ highway: 'primary', oneway: 'yes' }, [1, 2], [[x(0), yF], [x(4), yF]]),
  W({ highway: 'primary', oneway: 'yes' }, [3, 4], [[x(4), yF + d20], [x(0), yF + d20]]),
  W({ highway: 'primary' }, [2, 3], [[x(4), yF], [x(4), yF + d20]]), W({ highway: 'primary' }, [4, 1], [[x(0), yF + d20], [x(0), yF]]),
  W({ highway: 'residential' }, [5, 6], [[x(0), yF - d20], [x(4), yF - d20]]), W({ highway: 'residential' }, [1, 5], [[x(0), yF], [x(0), yF - d20]]), W({ highway: 'residential' }, [2, 6], [[x(4), yF], [x(4), yF - d20]]),
]
const dnet = leseNetz(netzAlsDatei(baueNetz((f) => DUO.forEach(f), { minKomponenteKm: 0 })))
const mitte = { rang: 3, linien: [[[x(1), yF + d20 / 2], [x(3), yF + d20 / 2]]] }
const rD = kantenFuerMeldung(dnet, mitte)
const flagsD = rD.kanten.map((e) => dnet.eFlag[e] & 32)
p('Getrennte Fahrbahnen: Sperrung als Mittellinie sperrt beide Einbahnen, die offene Ortsstraße daneben bleibt frei', rD.kanten.length === 2 && flagsD.every(Boolean), JSON.stringify(rD.kanten.map((e) => [e, dnet.eFlag[e]])))

console.log('\nRoute durch Sperrung und Umleitung (Testnetz)')
const route = routeOffline(net, [{ lon: x(0.5), lat: y0 }, { lon: x(9.5), lat: y0 }])
p('Erkannt: Route auf A führt durch die Sperrung bei km 1 bis 3', sperrungenAnRoute(route.geometry, [aufA]).length === 1 && Math.abs(sperrungenAnRoute(route.geometry, [aufA])[0].km - 1) <= 1)
p('Nicht erkannt: Route auf der Parallelstraße, Route quer über die gesperrte Straße', sperrungenAnRoute([[x(0), y0 + dyC], [x(10), y0 + dyC]], [aufA]).length === 0 && sperrungenAnRoute([[x(2), y0 - 0.01], [x(2), y0 + 0.01]], [aufA]).length === 0)
const { gesperrt } = sperrKanten(net, [aufA])
const um = routeOffline(net, [{ lon: x(0.5), lat: y0 }, { lon: x(9.5), lat: y0 }], { gesperrt })
p('Umleitung: über die Parallelstraße C, länger, ohne Sperrung', um && um.km >= route.km && sperrungenAnRoute(um.geometry, [aufA]).length === 0 && um.geometry.some(([, lat]) => Math.abs(lat - (y0 + dyC)) < 1e-4))
const nurEine = leseNetz(netzAlsDatei(baueNetz((f) => f(WEGE[0]), { minKomponenteKm: 0 })))
p('Keine Umleitung, wenn es nur diese Straße gibt', routeOffline(nurEine, [{ lon: x(0.5), lat: y0 }, { lon: x(9.5), lat: y0 }], { gesperrt: sperrKanten(nurEine, [aufA]).gesperrt }) === null)
p('Linie der Route mit den Kreuzungen (sonst schneidet sie Ecken ab)', route.geometry.some(([lon, lat]) => Math.abs(lon - x(5)) < 1e-5 && Math.abs(lat - y0) < 1e-5))

console.log('\nEchte Meldungen von Main Roads WA (5 Linien) auf den echten Netzen')
const meld = liesStrassen(JSON.parse(lies('tests/daten/mainroads-beispiel.json'))).map((m) => ({ ...m, rang: 3 }))
p('Beispieldaten: 5 Meldungen, ohne Datum', meld.length === 5 && !/20(26|27)/.test(JSON.stringify(JSON.parse(lies('tests/daten/mainroads-beispiel.json')).features.map((f) => f.properties))))
const RAD = Math.PI / 180
const dSeg = (pt, a, b) => { const kx = Math.cos(pt[1] * RAD) * 111320, ky = 110574; const ax = (a[0] - pt[0]) * kx, ay = (a[1] - pt[1]) * ky, bx = (b[0] - pt[0]) * kx, by = (b[1] - pt[1]) * ky; const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(ax + t * dx, ay + t * dy) }
const zuLinie = (pt, linien) => Math.min(...linien.map((l) => { let m = Infinity; for (let i = 1; i < l.length; i++) m = Math.min(m, dSeg(pt, l[i - 1], l[i])); return m }))
const kantenLinie = (n, e) => { const k = n.eGeoS[e + 1] - n.eGeoS[e]; const o = []; for (let j = 0; j <= k + 1; j++) o.push(punkt(n, e, j)); return o }
for (const art of ['haupt', 'pisten']) {
  const n = leseNetz(fs.readFileSync(new URL(`../public/routing/wa-${art}.bin`, import.meta.url)))
  const t0 = Date.now()
  const erg = meld.map((m) => ({ m, ...kantenFuerMeldung(n, m) }))
  const ms = Date.now() - t0
  p(`${art}: jede Sperrung findet ihre Straße (mindestens 90 % der Linie zugeordnet)`, erg.every((e) => e.kanten.length && e.gedeckt >= 0.9), erg.map((e) => `${e.m.strasse} ${Math.round(e.gedeckt * 100)} %`).join(' · '))
  // Präzision: jede gesperrte Kante liegt zur Hälfte auf der Sperrlinie oder trägt sie ganz (kurze Sperrung auf langer Kante)
  const falsch = []
  for (const e of erg) for (const k of e.kanten) {
    const ps = proben(kantenLinie(n, k), 25), nah = ps.filter((s) => zuLinie([s.lon, s.lat], e.m.linien) <= SPERR_ABSTAND_M).length
    const aufM = nah * n.eLen[k] / ps.length
    if (!(nah / ps.length >= 0.5 || aufM >= Math.min(150, e.laengeM * 0.5))) falsch.push(`${e.m.strasse}: Kante ${n.eLen[k]} m, ${Math.round(aufM)} m auf der Linie`)
  }
  p(`${art}: keine falsche Straße gesperrt (jede gesperrte Kante liegt auf der Sperrlinie)`, !falsch.length, falsch.join(' · '))
  p(`${art}: Zuordnung aller 5 Meldungen unter 200 ms`, ms < 200, `${ms} ms`)
}
const wh = leseNetz(fs.readFileSync(new URL('../public/routing/wa-haupt.bin', import.meta.url)))
const wp = leseNetz(fs.readFileSync(new URL('../public/routing/wa-pisten.bin', import.meta.url)))
const S = (lat, lon) => ({ lat, lon })
const FAELLE = [['Perth → Kalgoorlie', [S(-31.95, 115.86), S(-30.75, 121.47)], 'Great Eastern Hwy'], ['Geraldton → Mount Magnet', [S(-28.78, 114.61), S(-28.06, 117.85)], 'Geraldton Mt Magnet Rd'],
  ['Broome → Kununurra', [S(-17.96, 122.24), S(-15.77, 128.74)], 'Victoria Hwy'], ['Perth → Port Hedland über Newman', [S(-31.95, 115.86), S(-23.36, 119.73), S(-20.31, 118.61)], 'Great Northern Hwy'], ['Perth → Albany', [S(-31.95, 115.86), S(-35.02, 117.88)], null]]
for (const [name, st, erwartet] of FAELLE) {
  const r = routeOffline(wh, st), durch = sperrungenAnRoute(r.geometry, meld)
  p(`${name}: ${erwartet ? 'führt durch ' + erwartet : 'keine Sperrung'}`, erwartet ? durch.length === 1 && durch[0].meldung.strasse === erwartet : durch.length === 0, durch.map((d) => d.meldung.strasse + ' km ' + d.km).join(', '))
  if (!erwartet) continue
  for (const [art, n] of [['Hauptstraßen', wh], ['Pisten-Netz', wp]]) {
    const u = routeOffline(n, st, { gesperrt: sperrKanten(n, meld).gesperrt })
    p(`  Umleitung auf dem ${art}: gefunden, ohne Sperrung`, u && sperrungenAnRoute(u.geometry, meld).length === 0, u ? `${u.km} km` : 'keine')
  }
}
const gm = routeOffline(wh, FAELLE[1][1]), gmU = routeOffline(wh, FAELLE[1][1], { gesperrt: sperrKanten(wh, meld).gesperrt })
p('Geraldton → Mount Magnet gesperrt: Umleitung rund 160 km länger', gmU.km - gm.km > 120 && gmU.km - gm.km < 220, `${gm.km} → ${gmU.km} km`)
// OSRM-Linie (fein gezeichnet) erkennt die Sperrung genauso: dieselbe Route als fein abgetastete Linie
const fein = []; for (let i = 1; i < gm.geometry.length; i++) { const [a, b] = [gm.geometry[i - 1], gm.geometry[i]]; for (let k = 0; k < 5; k++) fein.push([a[0] + (b[0] - a[0]) * k / 5, a[1] + (b[1] - a[1]) * k / 5]) }
p('Auch eine fein gezeichnete Linie (wie von OSRM) wird erkannt', sperrungenAnRoute(fein, meld).length === 1)
p('Mit „befahrbar mit Vorsicht“ (so wie die echten Meldungen heute) kein Fenster', sperrungenAnRoute(gm.geometry, liesStrassen(JSON.parse(lies('tests/daten/mainroads-beispiel.json')))).length === 0)

console.log('\nEchte Sperrung nur einer Fahrbahn (Mitchell Fwy nach Süden, Perth)')
{
  const mf = liesStrassen(JSON.parse(lies('tests/daten/mainroads-mitchell-sued.json')))[0]
  p('Meldung: gesperrt, nur Richtung Süden', mf.rang === 3 && /southbound/i.test(mf.ort))
  const { kanten } = kantenFuerMeldung(wh, mf)
  const richtung = kanten.map((e) => { const n = wh.eGeoS[e + 1] - wh.eGeoS[e]; return punkt(wh, e, n + 1)[1] < punkt(wh, e, 0)[1] ? 'S' : 'N' })
  p('Getrennte Fahrbahnen: nur die Einbahn-Abschnitte nach Süden gesperrt, die Gegenfahrbahn bleibt frei', kanten.length > 0 && richtung.every((r) => r === 'S') && kanten.every((e) => wh.eFlag[e] & 32), richtung.join(''))
  const st = [{ lat: -31.79, lon: 115.77 }, { lat: -31.95, lon: 115.86 }], nord = [{ lat: -31.95, lon: 115.86 }, { lat: -31.79, lon: 115.77 }]
  const a = routeOffline(wh, st), u = routeOffline(wh, st, { gesperrt: sperrKanten(wh, [mf]).gesperrt })
  p('Joondalup → Perth (nach Süden) führt durch, die Umleitung nicht mehr', sperrungenAnRoute(a.geometry, [mf]).length === 1 && u && sperrungenAnRoute(u.geometry, [mf]).length === 0)
  p('Perth → Joondalup (nach Norden) ist nicht betroffen', sperrungenAnRoute(routeOffline(wh, nord).geometry, [mf]).length === 0)
}

console.log('\nEinbau in die App')
const sd = lies('src/lib/sperr-dienst.js'), re = lies('src/lib/RouteEditor.svelte'), rd = lies('src/lib/routen-dienst.js'), wk = lies('src/lib/routing-worker.js'), sp = lies('src/lib/sperrungen.js')
p('Route wird normal berechnet, die Prüfung läuft danach im Hintergrund (Routen und Straßenlage)', /pruefeSperrungen\(rs, lage\)/.test(lies('src/lib/RoutenDienst.svelte')) && !/sperr/i.test(rd.match(/export async function routeRechnen[\s\S]*?\n\}/)[0]))
p('Fenster fragt nach der Umleitung: „Umleitung berechnen“ oder „Route so lassen“', /titel: je\('⛔ Sperrung auf deiner Route'/.test(sd) && /ja: je\('Umleitung berechnen'/.test(sd) && /nein: je\('Route so lassen'/.test(sd) && /if \(ja\) await umleitungRechnen\(f\.r\)/.test(sd))
p('Je Route und Sperrung nur einmal gefragt, nie über ein anderes Fenster', /merkeGefragt\(f\.keys\)/.test(sd) && /if \(get\(dialogAnfrage\)\) return/.test(sd) && /keys\.every\(\(k\) => schon\.includes\(k\)\)/.test(sd))
p('Umleitung auf dem eigenen Netz, auch mit Netz (OSRM kennt keine Sperrungen); bleibt dann stehen', /offlineRoute\(r\.stops, \{ meidePiste: !!r\.nurBefestigt, allrad: !!r\.allrad, sperrungen: sperr \}\)/.test(sd) && /offline: false,[\s\S]{0,200}umleitung: \{/.test(sd))
p('Einmal „Umleitung“ gesagt: bei neuen Stopps wieder von selbst umgeleitet', /\(r\.umgehen \|\| \[\]\)\.includes\(b\.meldung\.id\)\)+ \{ umleitungRechnen\(r, \{ still: true \}\)/.test(sd))
p('Sperrung aufgehoben (frischer Stand): wieder der normale Weg', /if \(!aktiv && frisch\) \{[\s\S]{0,300}routeRechnen\(/.test(sd))
p('An der Route: Sperrung mit Knopf „Umleitung berechnen“, Umleitung mit Mehr-km', /class="r-sperr"/.test(re) && /onclick=\{\(\) => umleitungRechnen\(r\)\}/.test(re) && /umleitungText\(r\.route\.umleitung\)/.test(re) && /if \(route\.umleitung\)/.test(rd))
p('4WD-Regel gilt überall (Fenster, Anzeige, Rechner)', /sperrtFuer\(m, \{ allrad: !!r\.allrad \}\)/.test(sd) && /sperrendeFuer\(r, \$strassenlage\.meldungen\)/.test(re) && /sperrKanten\(net, sperrungen, \{ allrad \}\)/.test(wk))
p('Flächenwarnungen bleiben Hinweise: die Sperr-Logik kennt die amtlichen Warnungen nicht', !/warnungen\.js|holeWarnungen/.test(sp + sd) && /if \(!m \|\| m\.ringe\?\.length\) return false/.test(sp))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
