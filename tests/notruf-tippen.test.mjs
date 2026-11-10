// V35: Notruf durch 7 schnelle Tipps, SOS oben rot oder ausgegraut, Musik-Symbol grün wenn Spotify eingerichtet.
// Ausführen: node tests/notruf-tippen.test.mjs  (kein Netz, keine echten Dienste)
import fs from 'node:fs'
import * as N from '../src/lib/notruf-tippen.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\n1  Zähler')
{
  const z = N.neuerZaehler()
  const r = [0, 300, 600, 900, 1200, 1500, 1800].map((t) => z.tipp(t))
  p('7 Tipps mit kurzen Pausen: 1 bis 6, beim siebten „los“', r.join() === '1,2,3,4,5,6,los', r.join())
  p('danach fängt es von vorn an', z.tipp(2000) === 1)
  const z2 = N.neuerZaehler()
  const r2 = [0, 300, 600, 1500, 1800].map((t) => z2.tipp(t))
  p('Pause länger als 0,7 s: neu zählen', r2.join() === '1,2,3,1,2', r2.join())
  const z3 = N.neuerZaehler(); z3.tipp(0); z3.tipp(200); z3.zurueck()
  p('zurück setzt auf 0', z3.stand() === 0 && z3.tipp(300) === 1)
  p('Werte: 000, 7 Tipps, Fläche ab dem dritten, 0,7 s', N.NOTRUF_NR === '000' && N.ANZAHL === 7 && N.ZEIGEN_AB === 3 && N.ABSTAND_MS === 700)
}

console.log('\n2  Nur freie Flächen zählen')
{
  // kleine Ersatz-Elemente: closest() findet das Element selbst, wenn sein Tag oder seine Rolle im Selektor steht
  const el = (tag, attr = '') => ({ closest: (sel) => sel.split(',').map((s) => s.trim()).some((s) => s === tag || (attr && s === attr)) ? {} : null })
  p('Knöpfe, Links, Felder, Karten zählen nicht', ['button', 'a', 'input', 'select', 'textarea', 'label', 'summary', 'canvas', '.maplibregl-map'].every((t) => N.zaehltNicht(el(t))))
  p('Rollen wie Schalter oder Reiter zählen nicht', N.zaehltNicht(el('div', '[role="switch"]')) && N.zaehltNicht(el('div', '[role="tab"]')) && N.zaehltNicht(el('span', '[data-kein-notruf-tippen]')))
  p('Text, Karten-Kacheln, leere Fläche zählen', !N.zaehltNicht(el('div')) && !N.zaehltNicht(el('p')) && !N.zaehltNicht(el('main')))
  p('ohne Element: zählt nicht', N.zaehltNicht(null) && N.zaehltNicht({}))
}

console.log('\n3  Einbindung')
{
  const nt = lies('src/lib/NotrufTippen.svelte'), app = lies('src/App.svelte'), nf = lies('src/lib/Notfall.svelte'), ms = lies('src/lib/musik/MusikSymbol.svelte')
  p('lauscht auf jeden Tipp (Erfassungsphase), überall in der App', /document\.addEventListener\('click', tipp, true\)/.test(nt) && /<NotrufTippen \/>/.test(app))
  p('ab dem dritten Tipp: Tipp abgefangen, rote Fläche mit Zähler', /if \(r >= ZEIGEN_AB\) \{ stand = r; e\.preventDefault\(\); e\.stopPropagation\(\) \}/.test(nt) && /\{ANZAHL - stand\}/.test(nt))
  p('siebter Tipp: Anruf direkt aus dem Tipp, danach 000 und SOS an meine Leute', /anrufen\(NOTRUF_NR\)/.test(nt) && /location\.href = `tel:\$\{nr\}`/.test(nt) && /href=\{`tel:\$\{NOTRUF_NR\}`\}/.test(nt) && /sosBlatt\.set\(true\)/.test(nt))
  p('Tipp auf Bedienelement mitten im Zählen bricht vorher ab, nichts wird ausgelöst', /if \(zaehltNicht\(e\.target\)\) \{ if \(!stand\) z\.zurueck\(\); return \}/.test(nt))
  p('abschaltbar unter Notfall, Vorgabe an', /notrufTippenAn\.set\(e\.currentTarget\.checked\)/.test(nf) && /lies\(\) !== 'aus'/.test(lies('src/lib/notruf-tippen.js')))
  p('Heute: SOS rot mit Personen, sonst ausgegraut (öffnet trotzdem)', /class:leer=\{!\$notfallKontakte\.length\}/.test(app) && /\.hero > \.hero-sos\.leer \{[^}]*rgba\(255, 255, 255, 0\.16\)/.test(app) && /sosBlatt\.set\(true\)/.test(app))
  p('Musik-Symbol: grün, wenn verbunden, Playlist verknüpft und Sammeln an; sonst neutral', /const eingerichtet = \$derived\(!!\$musik\.playlist\?\.id && !!\$musikCfg\.aktiv && istVerbunden\(\)\)/.test(ms) && /class:fertig=\{eingerichtet\}/.test(ms) && /\.ms\.fertig, \.ms\.hell\.fertig \{ background: #1db954/.test(ms) && /background: var\(--card\); color: var\(--muted\);/.test(ms))
  p('keine Gedankenstriche in den neuen Texten', ![nt, lies('src/lib/notruf-tippen.js')].some((t) => / [–—] /.test(t.replace(/\/\/.*$/gm, ''))))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
