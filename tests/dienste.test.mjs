// Adressen fremder Dienste: Umzüge bemerken, bevor sie im Browser still scheitern
import fs from 'node:fs'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const fx = fs.readFileSync(new URL('../src/lib/fx.js', import.meta.url), 'utf8')
console.log('\nFremde Dienste')
p('Wechselkurs über api.frankfurter.dev/v1', /fetch\(`https:\/\/api\.frankfurter\.dev\/v1\/\$\{datum\}\?from=AUD&to=EUR`\)/.test(fx))
p('Keine alte Adresse api.frankfurter.app (leitet ohne CORS um)', !/fetch\([^)]*api\.frankfurter\.app/.test(fx))
if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
