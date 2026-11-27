// Hinweis „Zum Home-Bildschirm“: wann er kommt und wann nicht
import { hinweisArt, istIOS, istIPad, istMacSafari, istFirefox } from '../src/lib/install.js'
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
p('Android mit Mac-Kennung bleibt Android', !istIOS({ ua: ANDROID, platform: 'MacIntel', touch: 5 }) && hinweisArt({ ua: ANDROID, platform: 'MacIntel', touch: 5 }) === 'android')
p('iPad wird als iPad erkannt', istIPad({ ua: IPAD, platform: 'MacIntel', touch: 5 }))
p('iPhone ist kein iPad', !istIPad({ ua: IPHONE, platform: 'iPhone', touch: 5 }))

console.log('\n2  Wann der Hinweis kommt')
p('iPhone in Safari: Anleitung', hinweisArt({ ua: IPHONE, touch: 5 }) === 'ios')
p('iPhone vom Home-Bildschirm: nichts', hinweisArt({ ua: IPHONE, touch: 5, standalone: true }) === null)
p('iPhone, schon erledigt: nichts', hinweisArt({ ua: IPHONE, touch: 5, erledigt: true }) === null)
p('Android: Android-Hinweis', hinweisArt({ ua: ANDROID, touch: 5 }) === 'android')
p('Android als App: nichts', hinweisArt({ ua: ANDROID, touch: 5, standalone: true }) === null)
const WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const WIN_EDGE = WIN_CHROME + ' Edg/130.0'
const WIN_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
p('Safari am Mac: Dock', hinweisArt({ ua: MAC, platform: 'MacIntel', touch: 0 }) === 'mac' && istMacSafari({ ua: MAC, touch: 0 }))
p('Chrome am Mac: Installieren wie am PC', hinweisArt({ ua: MAC_CHROME, platform: 'MacIntel', touch: 0 }) === 'rechner')
p('Chrome unter Windows: Installieren', hinweisArt({ ua: WIN_CHROME, platform: 'Win32' }) === 'rechner')
p('Edge unter Windows: Installieren', hinweisArt({ ua: WIN_EDGE, platform: 'Win32' }) === 'rechner')
p('Firefox: kurzer Hinweis', hinweisArt({ ua: WIN_FIREFOX, platform: 'Win32' }) === 'firefox' && istFirefox({ ua: WIN_FIREFOX }))

const ih = fs.readFileSync(new URL('../src/lib/InstallHinweis.svelte', import.meta.url), 'utf8')
p('iPhone-Text nennt „Mehr anzeigen“', ih.includes('„Mehr anzeigen“') && ih.includes('“View More”'))
p('iPad-Text nennt oben rechts', ih.includes('oben rechts neben der Adresse'))

const bb = fs.readFileSync(new URL('../src/lib/BottomBar.svelte', import.meta.url), 'utf8')
const sl = fs.readFileSync(new URL('../src/lib/Seitenleiste.svelte', import.meta.url), 'utf8')
p('Menü und Seitenleiste: „App einrichten“, solange nicht erledigt', /\$einrichtenZeigen/.test(bb) && /\$einrichtenZeigen/.test(sl))
p('Hinweis öffnet sich aus dem Menü auch nach „Später“', /installOeffnen\) untrack\(\(\) => pruefe\(true\)\)/.test(ih))
p('Windows und Android: Knopf löst das Installieren direkt aus', /e\.prompt\(\)/.test(ih) && /art === 'mac'/.test(ih) && /art === 'firefox'/.test(ih))

console.log('\n3  Reihenfolge in der App')
const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8')
p('Einführung wartet auf den Hinweis', app.includes('{#if !sprachFrage && !$installOffen}<Einfuehrung'))
p('Hinweis steht vor der Einführung', app.indexOf('<InstallHinweis') < app.indexOf('<Einfuehrung {geh}'))

console.log('\n4  Video zum Einrichten')
// Die Videos liegen bei der App selbst. Fremde Einbettungen von TikTok oder Instagram würden
// Skripte und Cookies in die App holen, das verträgt sich nicht mit dem, was in Rechtliches steht.
const hd = fs.readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
const nt = fs.readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
for (const [art, name, sek, mb] of [['iPhone', 'install-iphone', 35, 3], ['Android', 'install-android', 30, 3]]) {
  const mp4 = new URL(`../public/video/${name}.mp4`, import.meta.url)
  const jpg = new URL(`../public/video/${name}.jpg`, import.meta.url)
  const da = fs.existsSync(mp4) && fs.existsSync(jpg)
  p(`${art}: Video und Standbild liegen bei der App`, da)
  if (!da) continue
  const echt = fs.statSync(mp4).size / 1048576
  p(`${art}: Video bleibt klein (${echt.toFixed(1)} MB)`, echt < 8)
  p(`${art}: Größe am Knopf stimmt noch (${mb} MB angesagt)`, Math.abs(echt - mb) < 1.5)
  p(`${art}: Standbild unter 150 KB`, fs.statSync(jpg).size < 150 * 1024)
  // moov vorne heißt: der Browser kann sofort anfangen und muss nicht erst alles laden
  p(`${art}: läuft gleich los, nicht erst nach dem vollen Laden`, fs.readFileSync(mp4).subarray(0, 2048).toString('latin1').includes('moov'))
  p(`${art}: Hinweis zeigt genau dieses Video`, ih.includes(`/video/${name}.mp4`) && ih.includes(`/video/${name}.jpg`))
  p(`${art}: Länge am Knopf stimmt`, ih.includes(`sek: ${sek}`))
}
p('Knopf nennt Länge und Größe', /Sekunden, rund \$\{video\.mb\} MB/.test(ih) && /seconds, about \$\{video\.mb\} MB/.test(ih))
p('Video lädt erst nach dem Tippen', ih.indexOf('{#if videoAuf}') > 0 && ih.indexOf('<video') > ih.indexOf('{#if videoAuf}'))
p('Läuft im Blatt, nicht im Vollbild', /playsinline/.test(ih))
p('Lässt sich wieder ausblenden', /videoAuf = false\)\}>\{je\('Video ausblenden'/.test(ih))
p('Video steckt im iPhone- und im Android-Hinweis', (ih.match(/\{@render videoHilfe\(\)\}/g) || []).length === 2)
p('Kein fremder Rahmen, kein fremdes Skript', !/<iframe/.test(ih) && !/embed/.test(ih) && !/script src/.test(ih))
p('Instagram und TikTok nur als Verweis nach draußen', /instagram\.com\/travelbuddy\.oz/.test(ih) && /tiktok\.com\/@/.test(ih) && (ih.match(/rel="noopener noreferrer"/g) || []).length >= 2)
p('Service Worker lädt die Videos nicht mit in den Speicher', !/mp4/.test(vite))
p('Netlify speichert die Videos lange zwischen', /\/video\/\*/.test(hd) && /\/video\/\*/.test(nt))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
