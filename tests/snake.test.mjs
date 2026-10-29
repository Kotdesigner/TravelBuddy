import fs from 'node:fs'
// Snake-Easter-Egg: Spiellogik (lib/snake.js). Ausführen: node tests/snake.test.mjs
import { neuesSpiel, schritt, lenke, freiesFeld, takt, raster } from '../src/lib/snake.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const nullZufall = () => 0
// Hilfsspiel: Schlange und Futter frei gesetzt
const spiel = (schlange, richtung = 'rechts', futter = { x: 0, y: 0 }, spalten = 10, zeilen = 10) =>
  ({ spalten, zeilen, schlange, richtung, warteschlange: [], futter, punkte: 0, vorbei: null })
const laufe = (z, n) => { for (let i = 0; i < n; i++) z = schritt(z, nullZufall); return z }

console.log('\n1  Start')
{
  const z = neuesSpiel(22, 39, nullZufall)
  p('drei Glieder, Kopf nach rechts, mitten im Feld', z.schlange.length === 3 && z.richtung === 'rechts' && z.schlange[0].y === 19)
  p('Futter liegt nicht auf der Schlange', !z.schlange.some((t) => t.x === z.futter.x && t.y === z.futter.y))
}

console.log('\n2  Bande: kein Durchtauchen')
for (const [richtung, schlange] of [
  ['rechts', [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }]],
  ['links', [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]],
  ['hoch', [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }]],
  ['runter', [{ x: 5, y: 9 }, { x: 5, y: 8 }, { x: 5, y: 7 }]],
]) {
  const z = schritt(spiel(schlange, richtung, { x: 3, y: 3 }), nullZufall)
  p(`gegen die Bande (${richtung}) → Spiel vorbei, Schlange erscheint NICHT auf der anderen Seite`,
    z.vorbei === 'bande' && z.schlange[0].x === schlange[0].x && z.schlange[0].y === schlange[0].y, JSON.stringify(z.schlange[0]))
}
{
  const z = laufe(neuesSpiel(10, 10, () => 0.999), 20)
  p('geradeaus laufen endet an der Bande, nicht im Kreis', z.vorbei === 'bande')
}

console.log('\n3  Fressen und Wachsen')
{
  const z0 = spiel([{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], 'rechts', { x: 5, y: 4 })
  const z1 = schritt(z0, nullZufall)
  p('Maus gefressen → ein Glied länger, 1 Punkt', z1.schlange.length === 4 && z1.punkte === 1)
  p('neue Maus liegt auf einem freien Feld', z1.futter && !z1.schlange.some((t) => t.x === z1.futter.x && t.y === z1.futter.y))
  const z2 = schritt(z1, nullZufall)
  p('ohne Maus bleibt die Länge gleich', z2.schlange.length === 4)
}

console.log('\n4  Selbstbiss')
{
  // Schlange in U-Form; Kopf läuft in den eigenen Körper
  const u = [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }]
  const z = schritt(spiel(u, 'rechts', { x: 0, y: 0 }), nullZufall)
  p('in den eigenen Körper → Spiel vorbei', z.vorbei === 'selbst')
  // Kopf folgt dem Schwanz, der gerade weiterrückt — das ist erlaubt
  const ring = [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 }]
  const r = schritt(spiel(ring, 'rechts', { x: 0, y: 0 }), nullZufall)
  p('auf das Feld, das das Schwanzende gerade räumt → erlaubt', r.vorbei === null && r.schlange[0].x === 5 && r.schlange[0].y === 4)
}

console.log('\n5  Lenken')
{
  const z = spiel([{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], 'rechts', { x: 0, y: 0 })
  p('direkte Umkehr (rechts → links) wird ignoriert', lenke(z, 'links').warteschlange.length === 0)
  const k = lenke(lenke(z, 'runter'), 'links')
  p('schnelle Kehre: zwei Wünsche gepuffert (runter, links)', k.warteschlange.join() === 'runter,links')
  const k2 = laufe(k, 2)
  p('   → nach zwei Takten fährt sie nach links, ohne sich zu beißen', k2.richtung === 'links' && k2.vorbei === null && k2.schlange[0].x === 3 && k2.schlange[0].y === 5)
  p('mehr als zwei Wünsche je Takt werden verworfen', lenke(lenke(lenke(z, 'runter'), 'links'), 'hoch').warteschlange.length === 2)
  p('nach dem Ende keine Eingaben mehr', lenke({ ...z, vorbei: 'bande' }, 'hoch').warteschlange.length === 0)
}

console.log('\n6  Rand-Fälle')
{
  p('volles Feld → kein Futterplatz mehr', freiesFeld(2, 1, [{ x: 0, y: 0 }, { x: 1, y: 0 }]) === null)
  const g = schritt(spiel([{ x: 0, y: 0 }], 'rechts', { x: 1, y: 0 }, 2, 1), nullZufall)
  p('letztes freies Feld gefressen → gewonnen', g.vorbei === 'gewonnen' && g.punkte === 1, String(g.vorbei))
  p('Tempo: 160 ms am Anfang, nie schneller als 75 ms', takt(0) === 160 && takt(100) === 75 && takt(10) < takt(5))
  const ip = raster(358, 633), mac = raster(1080, 620)
  p(`Raster iPhone ${ip.spalten}×${ip.zeilen} à ${ip.zelle}px, Mac ${mac.spalten}×${mac.zeilen} à ${mac.zelle}px — Felder gut sichtbar`,
    ip.zelle >= 14 && ip.spalten >= 20 && mac.zelle >= 24 && mac.zeilen >= 20)
}

console.log('\n7  Fenster am iPhone (Statusleiste, Dynamic Island)')
{
  // Das ✕ darf am iPhone nicht unter Statusleiste oder Dynamic Island liegen.
  const src = fs.readFileSync(new URL('../src/lib/SnakeSpiel.svelte', import.meta.url), 'utf8')
  const css = src.slice(src.indexOf('<style>'))
  const regel = (sel) => (css.match(new RegExp('\\n  ' + sel.replace('.', '\\.') + ' \\{[\\s\\S]*?\\n  \\}')) || [''])[0]
  p('Hintergrund hält oben die Statusleiste frei', /safe-area-inset-top/.test(regel('.sn-back')) && /padding: var\(--sicher-oben\)/.test(regel('.sn-back')))
  p('Karte passt unter die Statusleiste (max-height zieht sie ab)', /max-height: calc\(100dvh - 8px - var\(--sicher-oben\)\)/.test(regel('.sn-karte')))
  p('Spielfeld lässt Platz für ✕ und Steuerkreuz', /min\(75dvh, calc\(100dvh - var\(--sicher-oben\) - var\(--sicher-unten\)/.test(regel('.sn-feld')))
  const markup = src.slice(0, src.indexOf('<style>'))
  const tafel = (name) => (markup.split(`if phase === '${name}'}`)[1] || '').split('{:else')[0]
  p('Starttafel hat „Schließen"', /onclick=\{onClose\}>(\{t\('Schließen'\)\}|Schließen)/.test(tafel('bereit')))
  p('Pausentafel hat „Schließen"', /onclick=\{onClose\}>(\{t\('Schließen'\)\}|Schließen)/.test(tafel('pause')))
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
