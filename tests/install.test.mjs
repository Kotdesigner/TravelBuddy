// Hinweis „Zum Home-Bildschirm“: wann er kommt und wann nicht
import { hinweisArt, istIOS } from '../src/lib/install.js'
import fs from 'node:fs'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const MAC = IPAD
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

console.log('\n1  Erkennen')
p('iPhone ist iOS', istIOS({ ua: IPHONE, touch: 5 }))
p('iPad mit Mac-Kennung und Touch ist iOS', istIOS({ ua: IPAD, platform: 'MacIntel', touch: 5 }))
p('Mac ohne Touch ist kein iOS', !istIOS({ ua: MAC, platform: 'MacIntel', touch: 0 }))
p('Android ist kein iOS', !istIOS({ ua: ANDROID, touch: 5 }))

console.log('\n2  Wann der Hinweis kommt')
p('iPhone in Safari: Anleitung', hinweisArt({ ua: IPHONE, touch: 5 }) === 'ios')
p('iPhone vom Home-Bildschirm: nichts', hinweisArt({ ua: IPHONE, touch: 5, standalone: true }) === null)
p('iPhone, schon erledigt: nichts', hinweisArt({ ua: IPHONE, touch: 5, erledigt: true }) === null)
p('Android mit Angebot: Knopf', hinweisArt({ ua: ANDROID, touch: 5, knopf: true }) === 'knopf')
p('Android ohne Angebot: nichts', hinweisArt({ ua: ANDROID, touch: 5 }) === null)
p('Mac mit Angebot: nichts, am Rechner nicht lästig', hinweisArt({ ua: MAC, platform: 'MacIntel', touch: 0, knopf: true }) === null)

console.log('\n3  Reihenfolge in der App')
const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8')
p('Einführung wartet auf den Hinweis', app.includes('{#if !sprachFrage && !$installOffen}<Einfuehrung'))
p('Hinweis steht vor der Einführung', app.indexOf('<InstallHinweis') < app.indexOf('<Einfuehrung {geh}'))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
