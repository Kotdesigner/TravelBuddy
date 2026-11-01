// Schrift- und Gesamtgröße (lib/darstellung.js) und die Regel, dass jede Schriftgröße auf dem
// Bildschirm dem eingestellten Faktor folgt. Ausführen: node tests/darstellung.test.mjs
import fs from 'node:fs'
import path from 'node:path'
import { bereinige, faktor, viewportInhalt, eineSpalte, SCHRIFT, GESAMT, VORGABE } from '../src/lib/darstellung.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const wurzel = new URL('../src/', import.meta.url).pathname

console.log('\n1  Stufen')
{
  p('vier Stufen je Einstellung, Standard = 1', SCHRIFT.length === 4 && GESAMT.length === 4 && faktor(SCHRIFT, 'standard') === 1 && faktor(GESAMT, 'standard') === 1)
  p('Schrift: klein 0,9 bis sehr groß 1,3', faktor(SCHRIFT, 'klein') === 0.9 && faktor(SCHRIFT, 'sehrgross') === 1.3)
  p('Gesamt: kompakt 0,9 bis sehr groß 1,2', faktor(GESAMT, 'kompakt') === 0.9 && faktor(GESAMT, 'sehrgross') === 1.2)
  p('Unbekanntes wird Standard', JSON.stringify(bereinige({ schrift: 'riesig', gesamt: 3 })) === JSON.stringify(VORGABE) && JSON.stringify(bereinige(null)) === JSON.stringify(VORGABE))
  p('Bekanntes bleibt', bereinige({ schrift: 'klein', gesamt: 'gross' }).schrift === 'klein' && bereinige({ schrift: 'klein', gesamt: 'gross' }).gesamt === 'gross')
}

console.log('\n2  Gesamtgröße am iPhone über den Viewport')
{
  p('Standard: der normale Viewport', viewportInhalt(1, 393) === 'width=device-width, initial-scale=1.0, viewport-fit=cover')
  const v = viewportInhalt(1.2, 393)
  p('größer: schmaler bauen, dann vergrößern', v === 'width=328, initial-scale=1.2, minimum-scale=1.2, viewport-fit=cover', v)
  p('kompakt: breiter bauen, verkleinert', viewportInhalt(0.9, 393).startsWith('width=437, initial-scale=0.9'))
  p('Heranzoomen mit zwei Fingern bleibt möglich (kein maximum-scale, kein user-scalable)', !/maximum-scale|user-scalable/.test(v))
  p('ohne Breite: normaler Viewport', viewportInhalt(1.2, 0).startsWith('width=device-width'))
}

console.log('\n2b Ortskarten: zwei Spalten, solange es passt')
{
  p('Standard am iPhone (375 px): zwei Spalten', !eineSpalte(375, 1))
  p('große Schrift allein (375 px, 1,15): zwei Spalten', !eineSpalte(375, 1.15))
  p('sehr große Schrift und sehr große Gesamtgröße (313 px, 1,3): eine Spalte', eineSpalte(313, 1.3))
  p('Mac: breit genug, zwei Spalten', !eineSpalte(1200, 1.3))
}

console.log('\n3  Jede Schriftgröße folgt dem Faktor')
{
  const dateien = []
  ;(function lauf(d) { for (const e of fs.readdirSync(d)) { const q = path.join(d, e); if (fs.statSync(q).isDirectory()) lauf(q); else if (/\.svelte$/.test(e)) dateien.push(q) } })(wurzel)
  const ohne = [], felder = []
  const pruefeCss = (css, datei) => {
    for (const r of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const sel = r[1], body = r[2]
      for (const m of body.matchAll(/font-size:\s*([^;}\n]+)/g)) {
        const v = m[1].trim()
        if (/var\(--schrift/.test(v) || /^[\d.]+(r?em|%|pt)$/.test(v) || v === 'max(16px, 1em)') {
          // Eingabefelder ab 16 px: am iPhone nie darunter
          if (/\b(input|textarea|select)\b/.test(sel) && /^calc\((1[6-9]|[2-9]\d)/.test(v)) felder.push(`${datei}: ${sel.trim().slice(0, 40)}`)
          continue
        }
        ohne.push(`${datei}: ${v}`)
      }
    }
  }
  for (const d of dateien) for (const b of fs.readFileSync(d, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) pruefeCss(b[1], path.relative(wurzel, d))
  pruefeCss(fs.readFileSync(wurzel + 'app.css', 'utf8'), 'app.css')
  p(`alle Schriftgrößen in ${dateien.length} Bausteinen und app.css mit Faktor (oder relativ)`, !ohne.length, ohne.slice(0, 5).join(' | '))
  p('Eingabefelder ab 16 px sind mit max(16px, …) abgesichert', !felder.length, felder.slice(0, 3).join(' | '))
  const css = fs.readFileSync(wurzel + 'app.css', 'utf8')
  p('Grundschrift am <html> folgt dem Faktor (für rem)', /html \{[^}]*font-size: calc\(16px \* var\(--schrift, 1\)\)/.test(css))
}

console.log('\n3b Vor dem ersten Bild (index.html) gleich gerechnet wie viewportInhalt')
{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const skript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] || ''
  p('Skript steht im Kopf vor der App', html.indexOf('<script>') < html.indexOf('</head>') && /tb-darstellung/.test(skript))
  // Skript mit nachgebauter Umgebung ausführen
  const lauf = (gespeichert, breite = 393, touch = true) => {
    const meta = { inhalt: 'width=device-width, initial-scale=1.0, viewport-fit=cover', setAttribute(k, v) { this.inhalt = v } }
    const umgebung = { localStorage: { getItem: () => JSON.stringify(gespeichert) }, matchMedia: (q) => ({ matches: q.includes('coarse') ? touch : false }),
      screen: { width: breite, height: 852 }, document: { querySelector: () => meta }, Math, JSON }
    new Function(...Object.keys(umgebung), skript)(...Object.values(umgebung))
    return meta.inhalt
  }
  for (const [id, g] of [['kompakt', 0.9], ['gross', 1.1], ['sehrgross', 1.2]]) {
    p(`${id}: wie viewportInhalt`, lauf({ gesamt: id }) === viewportInhalt(g, 393), lauf({ gesamt: id }))
  }
  p('Standard oder nichts gespeichert: unverändert', lauf({ gesamt: 'standard' }).startsWith('width=device-width') && lauf(null).startsWith('width=device-width'))
  p('Mac (keine Touch-Bedienung): unverändert, dort gilt CSS-zoom', lauf({ gesamt: 'gross' }, 1440, false).startsWith('width=device-width'))
  const st = Object.fromEntries(GESAMT.map((x) => [x.id, x.wert]))
  p('Stufen im Skript = Stufen in darstellung.js', /kompakt: 0\.9, gross: 1\.1, sehrgross: 1\.2/.test(skript) && st.kompakt === 0.9 && st.gross === 1.1 && st.sehrgross === 1.2)
}

console.log('\n4  Einbindung')
{
  const main = fs.readFileSync(wurzel + 'main.js', 'utf8')
  p('wird vor dem ersten Bild gesetzt (main.js)', main.indexOf("import './lib/darstellung.js'") >= 0 && main.indexOf("import './lib/darstellung.js'") < main.indexOf('mount('))
  const bb = fs.readFileSync(wurzel + 'lib/BottomBar.svelte', 'utf8'), sl = fs.readFileSync(wurzel + 'lib/Seitenleiste.svelte', 'utf8')
  const design = fs.readFileSync(new URL('../src/lib/Design.svelte', import.meta.url), 'utf8')
  p('einstellbar auf der Seite Design', design.includes('setzeSchrift(s.id)') && design.includes('setzeGesamt(s.id)'))
  p('nicht im Backup (je Gerät)', !/tb-darstellung|darstellung/.test(fs.readFileSync(wurzel + 'lib/userdata.js', 'utf8')))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
