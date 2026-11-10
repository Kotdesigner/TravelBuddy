// Basic 1.35: Melden mit Standort außerhalb Australiens (z. B. noch zu Hause) zeigte „Wähle, wo es ist“, obwohl schon gewählt.
// Jetzt sagt das Blatt gleich beim Antippen von „Mein Standort“, dass es nur für Orte in Australien geht.
// Ausführen: node tests/v41-melden.test.mjs
import fs from 'node:fs'
import { pruefeNeu, inAustralien } from '../src/lib/meldungen-regeln.js'
let ok = 0, bad = 0
const p = (name, bed) => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const mn = lies('src/lib/MeldungNeu.svelte'), mt = lies('src/lib/meldungen-text.js'), ml = lies('src/lib/Meldungen.svelte')

// Regel unverändert (Server und App prüfen gleich): außerhalb Australiens geht nicht
p('Regel: Punkt in Europa gilt nicht als Australien', !inAustralien(54.32, 10.14))
p('Regel: Punkt in Western Australia gilt', inAustralien(-21.93, 114.13))
p('Regel: Server lehnt Europa weiter mit „ort“ ab', pruefeNeu({ art: 'weg', text: 'Straße gesperrt', lat: 54.32, lon: 10.14 }).fehler === 'ort')

// Eigene Hinweise statt „Wähle, wo es ist“
p('Text für Standort außerhalb Australiens', /'standort-ausserhalb': je\('Du bist gerade nicht in Australien\./.test(mt))
p('Text für gewählten Ort außerhalb Australiens', /ausserhalb: je\('Dieser Ort liegt nicht in Australien\./.test(mt))
p('Kein Gedankenstrich in den neuen Texten', !/(Du bist gerade nicht in Australien|Dieser Ort liegt nicht in Australien)[^']*[–—]/.test(mt))

// Blatt
p('„Mein Standort“ außerhalb Australiens: nicht übernommen, Suche offen, Hinweis', /if \(s && !inAustralien\(s\.lat, s\.lon\)\) \{ wo = null; suche = true; woFehler = grundText\('standort-ausserhalb'\) \}/.test(mn))
p('Vorlage außerhalb Australiens (Heute, frischer Standort) wird nicht still eingetragen', /let wo = \$state\(vorlageOk \?/.test(mn) && /inAustralien\(Number\(vorlage\.lat\), Number\(vorlage\.lon\)\)/.test(mn))
p('Gewählter Ort außerhalb Australiens: Hinweis statt Übernahme', /function ortGewaehlt\(o\) \{\s*if \(!inAustralien\(Number\(o\.lat\), Number\(o\.lon\)\)\) \{ woFehler = grundText\('ausserhalb'\); return \}/.test(mn) && /onwahl=\{ortGewaehlt\}/.test(mn))
p('Beim Melden: Prüfung vor dem Senden, Hinweis unter „Wo?“', /if \(!inAustralien\(Number\(wo\.lat\), Number\(wo\.lon\)\)\) \{ woZeigen\(/.test(mn) && /\{#if woFehler\}<p class="mn-fehler mn-wo-fehler" role="alert">/.test(mn))
p('„ort“ vom Server zeigt den Australien-Hinweis, nicht „Wähle, wo es ist“', /e\.fehler === 'ort'\) \{ woZeigen\(grundText\('ausserhalb'\)\)/.test(mn) && /e\.eintrag\.grund === 'ort'\) woZeigen\(grundText\('ausserhalb'\)\)/.test(mn))
p('Meine Meldungen: abgelehnt wegen Ort zeigt den Australien-Hinweis', /grundText\(m\.grund === 'ort' \? 'ausserhalb' : m\.grund\)/.test(ml))
console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
