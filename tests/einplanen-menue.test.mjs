// Einplanen-Menü der Ortskachel (Fehler seit Basic 1.25, behoben in 1.33): Am Handy ist das Menü ein Blatt mit
// position: fixed. Die Kacheln haben content-visibility: auto (schneller), das macht die Kachel aber zum Rahmen
// für „fixed“ und schneidet ab: Das Menü steckte in der Kachel, kein Punkt ließ sich tippen. Solange es offen ist,
// zeichnet die Kachel deshalb normal. Dieser Test wacht darüber und über neue Stellen mit content-visibility.
// Ausführen: node tests/einplanen-menue.test.mjs
import fs from 'node:fs'
import path from 'node:path'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const wurzel = new URL('../', import.meta.url).pathname
const lies = (f) => fs.readFileSync(path.join(wurzel, f), 'utf8')
const css = lies('src/app.css'), ort = lies('src/lib/Ort.svelte')

p('Kacheln dürfen schnell zeichnen (content-visibility: auto)', /\.or-grid > article\.card \{ content-visibility: auto;/.test(css))
p('…aber mit offenem Menü normal (sonst sperrt es das Menü ein)', /\.or-grid > article\.card\.menu-offen \{ content-visibility: visible; \}/.test(css))
p('Die Kachel bekommt die Klasse, solange das Menü offen ist', /<article class="card" class:menu-offen=\{zeigeReiseWahl\}/.test(ort))
p('Am Handy ist das Menü ein Blatt über allem (position: fixed)', /\.reise-menu \{\s*position: fixed;/.test(ort))
p('Alle Punkte da: Vormerken, Neue Route, Wanderung, Teilen, Melden, Fahrten', ['onclick={vormerken}', 'onclick={zuNeuerReise}', 'onclick={alsWanderung}', 'teilenOffen = true', 'meldenBlatt.set(', 'zuReise(r.id, r.name)', 'zuWeiterReise(r, km)'].every((s) => ort.includes(s)))

// Neue Stellen mit content-visibility, contain oder will-change: transform sperren „fixed“-Blätter ebenso ein.
// Kommt eine dazu, muss sie hier bewusst eingetragen werden.
const ERLAUBT = ['src/app.css']
const treffer = []
const geh = (d) => { for (const e of fs.readdirSync(path.join(wurzel, d), { withFileTypes: true })) { const r = path.join(d, e.name); if (e.isDirectory()) geh(r); else if (/\.(svelte|css)$/.test(e.name) && /content-visibility\s*:\s*auto|(^|[^-])contain\s*:\s*(paint|layout|strict|content)/.test(lies(r))) treffer.push(r) } }
geh('src')
p('content-visibility oder contain nur an bekannten, geprüften Stellen', treffer.every((t) => ERLAUBT.includes(t)), treffer.join(', '))

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
