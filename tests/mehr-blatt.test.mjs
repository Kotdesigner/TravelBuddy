// Mehr am iPhone: Das Blatt hat eine eigene Liste. Jede Seite aus UNTER.mehr (Seitenleiste am Mac,
// Chips oben) muss auch dort stehen, sonst ist sie im Hochformat nicht zu finden.
import fs from 'node:fs'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const app = lies('App.svelte'), bar = lies('lib/BottomBar.svelte')
const zeile = app.match(/^\s*mehr: \[(.*)\],?\s*$/m)?.[1] || ''
const seiten = [...zeile.matchAll(/\['mehr\/([a-z]+)'/g)].map((m) => m[1])
const blatt = [...bar.matchAll(/\{ id: '([a-z]+)', icon:/g)].map((m) => m[1])
console.log('\nMehr-Blatt am iPhone')
p(`UNTER.mehr gefunden (${seiten.length} Seiten)`, seiten.length >= 11, zeile.slice(0, 80))
for (const s of seiten) p('im Blatt: ' + s, blatt.includes(s))
p('keine toten Einträge im Blatt', blatt.every((b) => seiten.includes(b)), blatt.filter((b) => !seiten.includes(b)).join(', '))
p('gleiche Reihenfolge', JSON.stringify(blatt) === JSON.stringify(seiten), blatt.join(','))
p('Blatt scrollt, wenn es nicht passt', /\.sheet \{[\s\S]*?max-height: calc\(100dvh[\s\S]*?overflow-y: auto/.test(bar))
if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
