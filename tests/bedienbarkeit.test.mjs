// Regeln der Bedienbarkeit (WCAG 2.2 AA, iOS Human Interface Guidelines):
//   · Suche: dieselbe Logik fürs Suchblatt und die Kachel-Ansicht (lib/suche.js)
//   · Kontrast: lesbare Schrift auf JEDER Laufzeit-Farbe der App (lib/kontrast.js)
//   · Suchfeld am iPhone unten (Suchblatt.svelte, BottomBar.svelte, modal.js)
// Ausführen: node tests/bedienbarkeit.test.mjs
import { sucheOrte, passtOrt, rangFuer } from '../src/lib/suche.js'
import { schriftAuf, kontrast } from '../src/lib/kontrast.js'
import { STUFE_FARBE } from '../src/lib/gefahren.js'
import fs from 'node:fs'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

const orte = JSON.parse(fs.readFileSync(new URL('../public/orte.json', import.meta.url), 'utf8'))
const liste = Array.isArray(orte) ? orte : orte.orte

console.log('\n1  Suche')
{
  const t = sucheOrte(liste, 'kalb')
  p('„kalb" → Kalbarri zuerst (Name beginnt mit dem Begriff)', /^Kalbarri/.test(t[0]?.name), t[0]?.name)
  p('Groß/klein egal', sucheOrte(liste, 'KALB')[0]?.name === t[0]?.name)
  const test = [{ id: 'a', name: 'Côte Sauvage', region: '', tags: [] }, { id: 'b', name: 'Mündung', region: '', tags: [] }]
  p('Akzente egal: „cote" findet „Côte"', sucheOrte(test, 'cote').length === 1)
  p('Umlaute egal: „mundung" findet „Mündung"', sucheOrte(test, 'mundung').length === 1)
  const nurTag = sucheOrte(liste, '', ['GEHEIMTIPP'])
  p('nur Etikett: alle GEHEIMTIPPs', nurTag.length > 0 && nurTag.every((o) => o.tags.includes('GEHEIMTIPP')), String(nurTag.length))
  const beides = sucheOrte(liste, 'bay', ['GEHEIMTIPP'])
  p('Begriff UND Etikett', beides.length > 0 && beides.length < nurTag.length && beides.every((o) => o.tags.includes('GEHEIMTIPP')))
  p('ohne Begriff und Etikett: keine Liste (statt aller 142)', sucheOrte(liste, '').length === 0)
  p('Rangfolge: Name vor Region vor Beschreibung',
    rangFuer({ name: 'Bay X', region: '', beschreibung: '' }, 'bay') < rangFuer({ name: 'X', region: 'Bay', beschreibung: '' }, 'bay')
    && rangFuer({ name: 'X', region: 'Bay', beschreibung: '' }, 'bay') < rangFuer({ name: 'X', region: '', beschreibung: 'Bay' }, 'bay'))
  p('Kachel-Filter und Suchblatt finden dasselbe', liste.filter((o) => passtOrt(o, 'bay', [])).length === sucheOrte(liste, 'bay').length)
}

console.log('\n2  Lesbare Schrift auf jeder Laufzeit-Farbe (WCAG 1.4.3: ≥ 4,5 : 1)')
{
  const src = (f) => fs.readFileSync(new URL('../src/lib/' + f, import.meta.url), 'utf8')
  const reiseFarben = [...src('userdata.js').matchAll(/'#[0-9a-f]{6}'/gi)].map((m) => m[0].slice(1, -1))
    .filter((c, i, a) => a.indexOf(c) === i)
  const warn = [...src('warnungen.js').matchAll(/farbe: '(#[0-9a-f]{6})'/gi)].map((m) => m[1])
  const poi = [...src('Karte.svelte').matchAll(/farbe: '(#[0-9a-f]{6})'/gi)].map((m) => m[1])
  const alle = [...new Set([...reiseFarben, ...warn, ...poi, ...Object.values(STUFE_FARBE)])]
  const schlecht = alle.filter((c) => kontrast(schriftAuf(c), c) < 4.5)
  p(`${alle.length} Farben geprüft (Reisen, Warnstufen, POI-Kategorien, Gefahrenstufen)`, alle.length >= 20, String(alle.length))
  p('jede erreicht mit schriftAuf() mindestens 4,5 : 1', schlecht.length === 0,
    schlecht.map((c) => `${c}: ${kontrast(schriftAuf(c), c).toFixed(2)}`).join(', '))
  p('Gelb (Advice) bekommt dunkle Schrift', schriftAuf('#e0a800') !== '#ffffff')
  p('Rot (Emergency) bekommt weiße Schrift', schriftAuf('#c0392b') === '#ffffff')
  p('Mittelton Reise-Orange #c1662f: Schwarz, weil weder Weiß noch Braun reicht', schriftAuf('#c1662f') === '#000000')
}

console.log('\n3  Suchfeld unten am iPhone (iOS 26), oben am Mac')
{
  const src = (f) => fs.readFileSync(new URL('../src/lib/' + f, import.meta.url), 'utf8')
  const blatt = src('Suchblatt.svelte')
  const block = (kopf) => { const i = blatt.indexOf(kopf); let tiefe = 0, j = blatt.indexOf('{', i); const start = j
    for (; j < blatt.length; j++) { if (blatt[j] === '{') tiefe++; else if (blatt[j] === '}' && --tiefe === 0) break }
    return blatt.slice(start, j) }
  const handy = block('@media (max-width: 639px), (max-width: 899px) and (orientation: portrait)'), mac = block('@media (min-width: 900px), (orientation: landscape) and (min-width: 640px)')
  const reihe = Object.fromEntries([...handy.matchAll(/\.(s-[a-z]+) \{ order: (\d+)/g)].map((m) => [m[1], +m[2]]))
  p('iPhone: Suchfeld steht ganz unten (höchste Reihenfolge)', reihe['s-kopf'] === Math.max(...Object.values(reihe)), JSON.stringify(reihe))
  p('iPhone: Treffer über den Etiketten, Etiketten über dem Feld', reihe['s-liste'] < reihe['s-tags'] && reihe['s-tags'] < reihe['s-kopf'])
  p('Mac: keine Umsortierung — Feld oben wie Spotlight', !/order:/.test(mac))
  // Mit einstellbarer Schrift: „max(16px, calc(17px * var(--schrift)))“ hält die 16 px auch bei kleiner Schrift
  const suchSchrift = /\.s-kopf input \{[^}]*font-size: (?:max\(16px, calc\()?(\d+)px/.exec(blatt)
  p('Suchfeld ≥ 16 px (sonst zoomt Safari beim Antippen)', +suchSchrift?.[1] >= 16 && (/max\(16px/.test(suchSchrift?.[0] || '') || !/var\(--schrift/.test(suchSchrift?.[0] || '')))
  p('Blatt folgt dem sichtbaren Bereich (Tastatur) über visualViewport', /visualViewport/.test(blatt) && /--vv-hoehe/.test(blatt))
  const leiste = src('BottomBar.svelte'), modal = src('modal.js')
  p('Such-Knopf öffnet die Tastatur noch im Tipp (Hilfsfeld, 16 px, nicht gesperrt)',
    /data-hilfsfeld/.test(leiste) && /data-dialog-hg/.test(leiste) && /font-size:16px/.test(leiste))
  p('Dialog räumt das Hilfsfeld nach der Fokus-Übergabe weg und springt nie dorthin zurück',
    /querySelectorAll\('\[data-hilfsfeld\]'\)/.test(modal) && /hasAttribute\?\.\('data-hilfsfeld'\)/.test(modal))
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
