// Basic 1.36: Das von Netlify eingeblendete Schild („Powered by Netlify“) darf nie über der App liegen.
// Ausführen: node tests/v42-netlify-schild.test.mjs
import fs from 'node:fs'
let ok = 0, bad = 0
const p = (name, bed) => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}`) } }
const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8')
p('Netlify-Schild und Netlify-Leiste sind ausgeblendet', /#nl-badge-frame, #nl-hud-frame \{ display: none !important; \}/.test(css))
console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
