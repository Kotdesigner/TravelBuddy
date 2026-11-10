// V37: Figuren fürs Runterziehen, jedes Mal eine andere. Wechsel, Zeichnen in allen Phasen, ruhige Haltung.
// Ausführen: node tests/runterziehen-figuren.test.mjs  (kein Netz, ohne Browser: kleine Ersatz-Elemente)
import fs from 'node:fs'
import * as F from '../src/lib/runterziehen-figuren.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => { if (bed) { ok++; console.log(`  ✓ ${name}`) } else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) } }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

// Ersatz für document.createElementNS: merkt Attribute und Kinder
class E { constructor(tag) { this.tag = tag; this.attr = {}; this.kinder = [] } setAttribute(k, v) { this.attr[k] = String(v) } appendChild(c) { this.kinder.push(c); return c } removeChild(c) { this.kinder = this.kinder.filter((x) => x !== c) } get firstChild() { return this.kinder[0] || null } }
globalThis.document = { createElementNS: (ns, tag) => new E(tag) }
const speicher = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }

console.log('\n1  Im Wechsel')
{
  p('sechs Figuren, das Känguru zuerst', F.FIGUREN.length === 6 && F.FIGUREN[0] === 'kaenguru' && ['koala', 'bumerang', 'camper', 'uluru', 'schlange'].every((f) => F.FIGUREN.includes(f)))
  const ls = speicher()
  const folge = Array.from({ length: 8 }, () => F.naechsteFigur(ls))
  p('jedes Mal die nächste, nach der sechsten wieder von vorn', folge.join() === [...F.FIGUREN, 'kaenguru', 'koala'].join(), folge.join())
  p('nie zweimal hintereinander dieselbe', folge.every((f, i) => !i || f !== folge[i - 1]))
  const kaputt = speicher(); kaputt.setItem('tb-runterziehen-figur', 'xyz')
  p('kaputter Speicher: wieder beim Känguru', F.naechsteFigur(kaputt) === 'kaenguru')
  p('ohne Speicher (privates Fenster): trotzdem eine Figur', F.naechsteFigur(null) === 'kaenguru')
}

console.log('\n2  Zeichnen')
for (const fig of F.FIGUREN) {
  const g = new E('g')
  const teile = F.baue(g, fig)
  let fehler = null
  try {
    for (const s of [{ ph: 'ziehen', pull: 0.3, t: 100 }, { ph: 'bereit', pull: 1, t: 900 }, { ph: 'laden', pull: 1, t: 1500, l: 800 }, { ph: 'laden', pull: 1, t: 9000, l: 7400 }]) F.zeichne(fig, teile, s)
    F.zeichne(fig, teile, { ph: 'laden', pull: 1, t: 500, l: 400 }, true)
  } catch (e) { fehler = e.message }
  const zahlen = JSON.stringify(g).match(/NaN|Infinity/)
  p(`${fig}: gebaut, alle Phasen gezeichnet, keine kaputten Zahlen`, g.kinder.length > 0 && !fehler && !zahlen, fehler || (zahlen && zahlen[0]))
}
{
  const g = new E('g'); const t = F.baue(g, 'kaenguru')
  F.zeichne('kaenguru', t, { ph: 'ziehen', pull: 1 })
  const hocke = t.k.attr.transform
  F.zeichne('kaenguru', t, { ph: 'laden', pull: 1, l: 325 })
  const sprung = t.k.attr.transform
  F.zeichne('kaenguru', t, { ph: 'laden', pull: 1, l: 325 }, true)
  p('Känguru: geht in die Hocke, springt beim Laden, steht bei „Bewegung reduzieren“ still', /scale\(0\.864 0\.624\)/.test(hocke) && /translate\(\S+ 31\.0\)/.test(sprung) && /translate\(100\.0 44\.0\) scale\(0\.800 0\.800\)/.test(t.k.attr.transform), [hocke, sprung, t.k.attr.transform].join(' | '))
  const b = new E('g'); const tb = F.baue(b, 'bumerang')
  F.zeichne('bumerang', tb, { ph: 'ziehen', pull: 0.5 }); const ohne = tb.spur.attr.opacity
  F.zeichne('bumerang', tb, { ph: 'laden', pull: 1, l: 400 }); const mit = tb.spur.attr.opacity
  p('Bumerang: dreht sich beim Ziehen mit, Flugspur nur beim Laden', /rotate\(180\.0\)/.test(tb.k.attr.transform) === false && ohne === '0' && mit === '0.6')
  const u = new E('g'); const tu = F.baue(u, 'uluru')
  F.zeichne('uluru', tu, { ph: 'ziehen', pull: 0 }); const unten = Number(tu.sonne.attr.cy)
  F.zeichne('uluru', tu, { ph: 'bereit', pull: 1 }); const oben = Number(tu.sonne.attr.cy)
  p('Uluru: die Sonne geht beim Ziehen auf', unten > oben && unten === 68 && oben === 28, `${unten} → ${oben}`)
}

console.log('\n3  Einbindung')
{
  const rz = lies('src/lib/Runterziehen.svelte')
  p('Bühne mit Figur im Wechsel, gewählt beim Beginn der Geste', /import \{ naechsteFigur, baue, zeichne \} from '\.\/runterziehen-figuren\.js'/.test(rz) && /zieht = true\s*\n\s*zeigen\(\)/.test(rz) && /figur = naechsteFigur\(\)/.test(rz))
  p('Bewegung nur solange sichtbar, „Bewegung reduzieren“ beachtet', /uhr = sichtbar \? requestAnimationFrame\(malen\) : 0/.test(rz) && /prefers-reduced-motion: reduce/.test(rz))
  p('keine Emoji in den Figuren, keine Gedankenstriche', !/\p{Extended_Pictographic}/u.test(lies('src/lib/runterziehen-figuren.js')) && ![rz, lies('src/lib/runterziehen-figuren.js')].some((t) => / [–—] /.test(t.replace(/\/\/.*$/gm, ''))))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
