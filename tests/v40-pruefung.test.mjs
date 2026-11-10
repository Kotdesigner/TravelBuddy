// V40: Befunde der Code-Prüfung vom V35 bis V39 behoben. Wacht darüber, dass sie behoben bleiben.
// Ausführen: node tests/v40-pruefung.test.mjs
import fs from 'node:fs'
let ok = 0, bad = 0
const p = (name, bed) => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const nf = lies('src/lib/Notfall.svelte'), nt = lies('src/lib/NotrufTippen.svelte'), rz = lies('src/lib/Runterziehen.svelte'), ort = lies('src/lib/Ort.svelte'), ab = lies('src/lib/abschnitte.js'), ak = lies('src/lib/bescheid-aktion.js')
p('Von Hand eingetragene Koordinaten gelten auch für SOS und Bescheid (globaler Standort)', /function manuellUebernehmen\(\)[\s\S]*?standort\.set\(\{ lat: la, lon: lo, genauigkeit: null, zeit: Date\.now\(\), manuell: true \}\)/.test(nf))
p('7 Tipps: Finger über pointerup (auch am iPhone), Maus über click, nie doppelt', /document\.addEventListener\('pointerup', tipp, true\)/.test(nt) && /if \(e\.pointerType === 'mouse'\) return/.test(nt) && /- letzterFinger < 700/.test(nt))
p('Runterziehen bremst das Scrollen nur ganz oben (touchmove nur dann angemeldet)', /window\.addEventListener\('scroll', pruefe, \{ passive: true \}\)/.test(rz) && /if \(oben && !dran\) \{ document\.addEventListener\('touchmove', bewegt, o\)/.test(rz))
p('Etappensuche nur bei offenem Menü (nicht für jede Kachel)', /const etappenWahl = \$derived\(zeigeReiseWahl \? etappenZumEinplanen\(/.test(ort))
p('Eine Regel für Hin- und Heimreise', /if \(istReiseImPlan\(r, eintraege, reisen\)\) continue/.test(ab) && !/randIds/.test(ab))
p('Kurzbefehl meldet ehrlich „übergeben“, nicht „gesendet“', /An deinen Kurzbefehl übergeben/.test(ak) && !/Gesendet über deinen Kurzbefehl/.test(ak))
console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
