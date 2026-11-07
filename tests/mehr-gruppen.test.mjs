// Gruppen unter „Mehr“: Sicherheit, Unterwegs, Vorbereitung, Extras, App. Gleich in Mehr-Liste, iPhone-Blatt,
// Mac-Seitenleiste und Chip-Reihe.
import fs from 'node:fs'
import { GRUPPEN, REIHENFOLGE, gruppeVon, gruppiere, neueGruppe } from '../src/lib/mehr-gruppen.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const app = lies('App.svelte'), bar = lies('lib/BottomBar.svelte'), sl = lies('lib/Seitenleiste.svelte')

console.log('\n1  Einteilung')
p('Fünf Gruppen in fester Reihenfolge', GRUPPEN.map((g) => g.id).join() === 'sicherheit,unterwegs,vorbereitung,extras,app')
p('Notfall steht ganz vorn', REIHENFOLGE[0] === 'notfall' && gruppeVon('mehr/notfall').id === 'sicherheit')
p('Jede Gruppe hat Titel auf Deutsch und Englisch', GRUPPEN.every((g) => Array.isArray(g.titel) && g.titel.length === 2 && g.titel.every(Boolean)))
p('Kein Punkt doppelt', new Set(REIHENFOLGE).size === REIHENFOLGE.length)
const zeile = app.match(/^\s*mehr: \[(.*)\],?\s*$/m)?.[1] || ''
const seiten = [...zeile.matchAll(/\['mehr\/([a-z]+)'/g)].map((m) => m[1])
p('Jeder Punkt unter Mehr gehört zu einer Gruppe', seiten.length > 0 && seiten.every((s) => gruppeVon(s)), seiten.filter((s) => !gruppeVon(s)).join(', '))
p('UNTER.mehr steht in Gruppen-Reihenfolge', JSON.stringify(seiten) === JSON.stringify(REIHENFOLGE.filter((r) => seiten.includes(r))), seiten.join(','))

console.log('\n2  Hilfsfunktionen')
const liste = [['mehr/notfall'], ['mehr/gefahren'], ['mehr/buchungen'], ['mehr/quiz']]
const g = gruppiere(liste, (e) => e[0], ['app'])
p('Gruppiert und lässt leere weg, „App“ bleibt', g.map((x) => x.gruppe.id).join() === 'sicherheit,unterwegs,extras,app' && g[0].eintraege.length === 2 && g[3].eintraege.length === 0)
p('Trenner nur beim Gruppenwechsel', !neueGruppe(liste, 0, (e) => e[0]) && !neueGruppe(liste, 1, (e) => e[0]) && neueGruppe(liste, 2, (e) => e[0]) && neueGruppe(liste, 3, (e) => e[0]))

console.log('\n3  Überall eingebaut')
p('Mehr-Seite: Überschrift je Gruppe', /gruppiere\(UNTER\.mehr, \(e\) => e\[0\], \['app'\]\)/.test(app) && /class="ml-gruppe"/.test(app))
p('Mehr-Seite: Gruppe App mit Backup & Import, Design, Handbuch', /APP_ZUSATZ_VORN = \[\['mehr\/backup'/.test(app) && /\['mehr\/design'/.test(app) && /\['mehr\/handbuch'/.test(app))
p('iPhone-Blatt: Überschrift je Gruppe', /gruppiere\(MEHR_SEKTIONEN, \(s\) => s\.id, \['app'\]\)/.test(bar) && /class="s-gruppe"/.test(bar))
p('Mac-Seitenleiste: Gruppen-Zeilen unter Mehr', /class="sl-gruppe"/.test(sl) && /neueGruppe\(unterpunkte\.mehr/.test(sl))
p('Chip-Reihe: Trenner zwischen Gruppen', /class="seg-trenner"/.test(app) && /neueGruppe\(UNTER\.mehr, i/.test(app))
p('Überschriften nicht vorgelesen doppelt (Trenner aria-hidden)', /seg-trenner" aria-hidden="true"/.test(app) && /sl-gruppe" aria-hidden="true"/.test(sl))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
