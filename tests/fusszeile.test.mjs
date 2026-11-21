// Die Fußzeile, nachdem sie am 21.11. aufgeräumt wurde.
//
// Vorher brachen die drei Links auf zwei Zeilen um, der Name stand noch einmal allein und der
// Stand der Fassung mitten drin: am Telefon 318 px. Jetzt steht alles in Steves Reihenfolge,
// eine Spalte, überall gleich: wer es gebaut hat, die Links, klein der Satz zur Kaffeekasse,
// der Knopf, zuletzt der Stand. Am Telefon 269 px, am Mac 185 px.
//
// Diese Prüfung hält den Aufbau fest. Was man nur sehen kann (Umbrüche, Überlappungen, Tipps),
// prüft im Browser Pruefungen/fusszeile-echt.mjs.
// Ausführen: node tests/fusszeile.test.mjs  (kein Netz)
import fs from 'node:fs'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : '→ ' + info); if (!ok) fehler++ }
const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8')
const fuss = (app.match(/<footer class="app-footer">[\s\S]*?<\/footer>/) || [''])[0]

console.log('\nReihenfolge in der Fußzeile')
{
  p('Es gibt die Fußzeile', !!fuss)
  const platz = (s) => fuss.indexOf(s)
  const folge = ['class="af-wer"', 'class="af-reihe af-links"', 'class="af-kaffee-text"', 'class="af-kaffee"', 'class="af-build"']
  const stellen = folge.map(platz)
  p('Alle fünf Teile sind da', stellen.every((x) => x > -1), JSON.stringify(folge.filter((_, i) => stellen[i] < 0)))
  p('Erst wer es gebaut hat, dann die Links, dann Satz, Knopf, Stand',
    stellen.every((x, i) => i === 0 || x > stellen[i - 1]), JSON.stringify(stellen))
  p('Name und Konto stehen zusammen in einer Zeile', /<div class="af-wer">[\s\S]*?af-name[\s\S]*?af-by[\s\S]*?<\/div>/.test(fuss))
  p('Die drei Links stehen in einer Reihe', /<div class="af-reihe af-links">[\s\S]*?af-web[\s\S]*?af-fehler[\s\S]*?af-recht[\s\S]*?<\/div>/.test(fuss))
  p('Die Linkzeile heißt nur noch „Online"', />Online<\/a>/.test(fuss) && !/TravelBuddy online/.test(fuss))
  p('Der Melden-Link trägt weiter den Käfer', /af-fehler[\s\S]*?af-bug/.test(fuss))
  p('Beide Rechtswege stehen drin', /#\/mehr\/fehler/.test(fuss) && /#\/mehr\/rechtliches/.test(fuss))
}

console.log('\nTrennpunkte und Größen')
{
  // Der Punkt kommt aus dem CSS und hängt am Wort davor. Stünde er als eigenes Zeichen im
  // Markup, könnte er beim Umbruch allein am Zeilenanfang landen.
  p('Die Trennpunkte kommen aus dem CSS', /\.af-reihe > \*:not\(:last-child\)::after \{ content: '·'/.test(app))
  p('Im Markup steht kein loser Trennpunkt', !/>\s*·\s*</.test(fuss))
  p('Der Satz steht klein über dem Knopf', /\.af-kaffee-text \{[^}]*font-size: calc\(11\.5px/.test(app))
  p('Der Stand steht klein ganz unten', /\.af-build \{[^}]*display: block[^}]*font-size: calc\(11px/.test(app))
  p('Unter 390 px wird die Linkzeile kleiner', /@media \(max-width: 390px\) \{[\s\S]{0,200}\.af-links > \* \{ font-size/.test(app))
  p('Die Trefferfläche der Namenslinks bleibt groß', /\.af-wer \.af-name::after[^}]*inset: -11px/.test(app))
}

console.log('\nNichts Altes liegengeblieben')
{
  p('Die alte Linkleiste ist weg', !/<span class="af-links">/.test(app))
  p('Der Zweispalter ist weg', !/min-width: 1200px/.test(app) && !/af-kaffee-block/.test(app))
  p('Keine Reihenfolge mehr über CSS', !/\.af-links \{ order:/.test(app))
  p('Der Kaffee-Knopf ist weiter 44 px hoch', /\.af-kaffee \{[\s\S]{0,400}min-height: 44px/.test(app))
  p('Die Fußzeile steht weiter ganz unten', /\.app-footer \{[\s\S]{0,800}margin-top: auto/.test(app))
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
