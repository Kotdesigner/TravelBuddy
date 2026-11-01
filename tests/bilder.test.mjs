// Ortsfotos: Jede Datei braucht einen vollständigen Nachweis mit freier Lizenz.
// Ausführen: node tests/bilder.test.mjs
import fs from 'node:fs'
let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}  → ${zusatz}`) } }
const n = JSON.parse(fs.readFileSync('public/bilder-nachweis.json', 'utf8'))
const dateien = fs.readdirSync('public/bilder'), hat = new Set(n.map((x) => x.datei))
p('jede Bilddatei hat einen Nachweis', dateien.every((d) => hat.has(d)), dateien.filter((d) => !hat.has(d)).join())
p('jeder Nachweis hat seine Datei', n.every((x) => dateien.includes(x.datei)), n.filter((x) => !dateien.includes(x.datei)).map((x) => x.datei).join())
p('jeder Ort genau einmal', new Set(n.map((x) => x.id)).size === n.length)
p('Autor, Lizenz und Quelle vollständig', n.every((x) => x.autor && x.lizenz && /^https:/.test(x.seite)), n.filter((x) => !(x.autor && x.lizenz && /^https:/.test(x.seite))).map((x) => x.id).join())
p('nur freie Lizenzen, kein NC und ND', n.every((x) => /^(cc|public domain|pd|attribution)/i.test(x.lizenz) && !/\b(nc|nd)\b/i.test(x.lizenz)), n.filter((x) => /\b(nc|nd)\b/i.test(x.lizenz)).map((x) => x.id).join())
p('nichts aus Google oder ohne Herkunft', !n.some((x) => /google|privat:/i.test(x.seite + x.titel)))
p('nur bekannte Stände', n.every((x) => ['belegt', 'neu', 'symbol'].includes(x.status)))
console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
