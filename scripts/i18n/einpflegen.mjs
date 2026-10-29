// Übersetzungen ins Wörterbuch src/lib/sprache/en.js einpflegen.
//   node scripts/i18n/einpflegen.mjs <schluessel.json> <paket.txt …>
// schluessel.json: Liste der deutschen Texte (Index = Nummer - 1), Pakete: „Nummer<TAB>Englisch“.
// „Einzahl||Mehrzahl“ wird zu { one, other } (für Texte, die im Deutschen gleich lauten).
// Prüft, dass alle Platzhalter {…} erhalten bleiben; Abweichungen werden gemeldet, nicht übernommen.
import fs from 'node:fs'
import { ladeEn } from './fehlend.mjs'

//   node scripts/i18n/einpflegen.mjs --paare <datei.json>   → { "Deutsch": "English" | { one, other } } direkt
const argv = process.argv.slice(2)
const en = ladeEn()
//   node scripts/i18n/einpflegen.mjs --aufraeumen   → Einträge entfernen, die im Code nicht mehr vorkommen
if (argv[0] === '--aufraeumen') {
  const { sammleSchluessel } = await import('./fehlend.mjs')
  const im = sammleSchluessel()
  for (const k of Object.keys(en)) if (!im.has(k)) { delete en[k]; console.log('entfernt:', k) }
  argv.length = 0
}
if (argv[0] === '--paare') {
  const paare = JSON.parse(fs.readFileSync(argv[1], 'utf8'))
  for (const [de, wert] of Object.entries(paare)) en[de] = wert
  argv.length = 0
}
const [liste, ...pakete] = argv
const schluessel = liste ? JSON.parse(fs.readFileSync(liste, 'utf8')) : []
const platzhalter = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
let neu = 0, fehler = 0
for (const p of pakete) {
  for (const zeile of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!zeile.trim()) continue
    const tab = zeile.indexOf('\t')
    const nr = Number(zeile.slice(0, tab)), text = zeile.slice(tab + 1).replace(/\\n/g, '\n')
    const de = schluessel[nr - 1]
    if (de == null) { console.log('unbekannte Nummer', nr, p); fehler++; continue }
    const wert = text.includes('||') ? { one: text.split('||')[0], other: text.split('||')[1] } : text
    const teile = typeof wert === 'object' ? [wert.one, wert.other] : [wert]
    const soll = platzhalter(de)
    // {n} darf in Mehrzahl-Texten zusätzlich auftauchen (tn liefert n immer mit)
    const ok = teile.every((x) => platzhalter(x) === soll || platzhalter(x.replace(/\{n\}/g, '')) === platzhalter(de.replace(/\{n\}/g, '')))
    if (!ok) { console.log(`Platzhalter passen nicht (#${nr}):`, JSON.stringify(de), '→', JSON.stringify(text)); fehler++; continue }
    if (!(de in en)) neu++
    en[de] = wert
  }
}
const sortiert = Object.fromEntries(Object.entries(en).sort(([a], [b]) => a.localeCompare(b, 'de')))
fs.writeFileSync('src/lib/sprache/en.js', '// Englische Texte (australisch/britisch). Schlüssel = deutscher Text aus dem Code.\n// Gepflegt mit scripts/i18n/fehlend.mjs (fehlende Einträge) und scripts/i18n/einpflegen.mjs.\nexport default ' + JSON.stringify(sortiert, null, 1) + '\n')
console.log(`${neu} neu eingepflegt, ${Object.keys(en).length} Einträge im Wörterbuch, ${fehler} Fehler`)
