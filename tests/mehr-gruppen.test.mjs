// Gruppen unter „Mehr“ (V31 aufgeräumt): Kacheln oben, kurze Gruppen, App und Einstellungen eingeklappt.
// Gleich in Mehr-Seite, iPhone-Blatt (MehrUebersicht.svelte), Mac-Seitenleiste und Chip-Reihe.
import fs from 'node:fs'
import { GRUPPEN, REIHENFOLGE, SCHNELL, NUR_CHIP, gruppeVon, gruppiere, geschwister, uebersicht, neueGruppe } from '../src/lib/mehr-gruppen.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const app = lies('App.svelte'), bar = lies('lib/BottomBar.svelte'), sl = lies('lib/Seitenleiste.svelte'), mu = lies('lib/MehrUebersicht.svelte')

console.log('\n1  Einteilung')
p('Sechs Gruppen in fester Reihenfolge', GRUPPEN.map((g) => g.id).join() === 'sicherheit,unterwegs,vorbereitung,teilen,extras,app')
p('Notfall steht ganz vorn', REIHENFOLGE[0] === 'notfall' && gruppeVon('mehr/notfall').id === 'sicherheit')
p('Jede Gruppe hat Titel auf Deutsch und Englisch', GRUPPEN.every((g) => Array.isArray(g.titel) && g.titel.length === 2 && g.titel.every(Boolean)))
p('Kein Punkt doppelt', new Set(REIHENFOLGE).size === REIHENFOLGE.length)
const zeile = app.match(/^\s*mehr: \[(.*)\],?\s*$/m)?.[1] || ''
const seiten = [...zeile.matchAll(/\['mehr\/([a-z]+)'/g)].map((m) => m[1])
p('Jeder Punkt unter Mehr gehört zu einer Gruppe', seiten.length > 0 && seiten.every((s) => gruppeVon(s)), seiten.filter((s) => !gruppeVon(s)).join(', '))
p('UNTER.mehr steht in Gruppen-Reihenfolge', JSON.stringify(seiten) === JSON.stringify(REIHENFOLGE.filter((r) => seiten.includes(r))), seiten.join(','))
p('Kacheln: Notfall, Gefahrenlage, Buchungen, Kosten', SCHNELL.join() === 'notfall,gefahren,buchungen,kosten')

console.log('\n2  Keine Seite fällt weg')
const alle = seiten.map((s) => ({ id: s }))
const { kacheln, gruppen } = uebersicht(alle, (e) => e.id)
const sichtbar = new Set([...kacheln, ...gruppen.flatMap((g) => g.eintraege)].map((e) => e.id))
p('Jede Seite ist Kachel, Zeile oder Chip in ihrer Gruppe', seiten.every((s) => sichtbar.has(s) || (NUR_CHIP.includes(s) && geschwister(alle, s, (e) => e.id).some((x) => sichtbar.has(x.id)))))
p('Flüge über die Chips bei Buchungen, Packliste über Reisevorbereitung', geschwister(alle, 'buchungen', (e) => e.id).map((e) => e.id).join() === 'buchungen,fluege,kosten' && geschwister(alle, 'mehr/vorbereitung', (e) => e.id).map((e) => e.id).join() === 'vorbereitung,packliste,praxis')
p('Gruppe Sicherheit fällt in der Liste weg (beide oben als Kachel), App bleibt immer', !gruppen.some((g) => g.gruppe.id === 'sicherheit') && gruppen.at(-1).gruppe.id === 'app')
p('Unterhaltung als eine Zeile', GRUPPEN.find((g) => g.id === 'extras').zeile === true)
p('Unterseite mit Pfad: Gruppe aus dem ersten Teil', gruppeVon('mehr/verbinden/k/abc')?.id === 'teilen')

console.log('\n3  Hilfsfunktionen')
const liste = [['mehr/notfall'], ['mehr/gefahren'], ['mehr/buchungen'], ['mehr/quiz']]
const g = gruppiere(liste, (e) => e[0], ['app'])
p('Gruppiert und lässt leere weg, „App“ bleibt', g.map((x) => x.gruppe.id).join() === 'sicherheit,unterwegs,extras,app' && g[0].eintraege.length === 2 && g[3].eintraege.length === 0)
p('Trenner nur beim Gruppenwechsel', !neueGruppe(liste, 0, (e) => e[0]) && !neueGruppe(liste, 1, (e) => e[0]) && neueGruppe(liste, 2, (e) => e[0]) && neueGruppe(liste, 3, (e) => e[0]))

console.log('\n4  Überall eingebaut')
p('Mehr-Seite und iPhone-Blatt nutzen dieselbe Übersicht', /<MehrUebersicht eintraege=/.test(app) && /<MehrUebersicht eintraege=\{MEHR_EINTRAEGE\}/.test(bar))
p('Mehr-Seite: App und Einstellungen aus appEintraege und den Basic-Aktionen, Updates öffnet das Fenster, App zurücksetzen wie am iPhone, ganz unten', /app=\{\[\.\.\.appEintraege\(\), \.\.\.basicAktionen\(/.test(app) && /updates: \(\) => \(updateOffen = true\), einfuehrung: einfuehrungStarten, einrichten: appEinrichten, testreise: testreiseKnopf/.test(app) && /gefahr=\{\{ label: je\('App zurücksetzen', 'Reset the app'\), onclick: \(\) => appZuruecksetzen\(onExport\) \}\}>/.test(app))
p('iPhone-Blatt: dieselben App-Einträge, Backup, Design, Handbuch, Updates, Einführung, Einrichten, Testreise, App zurücksetzen', /app=\{\[\.\.\.appEintraege\(\), \.\.\.basicAktionen\(/.test(bar) && /sheetLink\('backup'\)/.test(bar) && /design: onDesign, handbuch: onHandbuch, updates: onUpdates, einfuehrung: onEinfuehrung, einrichten: onEinrichten, testreise: onTestreise/.test(bar) && /gefahr=\{\{ label: je\('App zurücksetzen', 'Reset the app'\), onclick: \(\) => sheetAktion\(onZuruecksetzen\) \}\}>/.test(bar) && /onUpdates=\{\(\) => \(updateOffen = true\)\}/.test(app))
p('App und Einstellungen eingeklappt, merkt sich den Zustand', /aria-expanded=\{appOffen\}/.test(mu) && /tb-mehr-app-offen/.test(mu) && /localStorage\.getItem\(KEY\) === '1'/.test(mu))
p('Notfall-Kachel rot', /class:rot=\{e\.rot\}/.test(mu) && /\.mu-kachel\.rot \{ background: var\(--danger-flaeche\)/.test(mu))
p('Mac-Seitenleiste: Gruppen-Zeilen unter Mehr', /class="sl-gruppe"/.test(sl) && /neueGruppe\(unterpunkte\.mehr/.test(sl) && /sl-gruppe" aria-hidden="true"/.test(sl))
p('Chip-Reihe unter Mehr: nur die eigene Gruppe, keine Reihe mit nur einem Chip', /const mehrChips = \$derived\(ansicht\.tab === 'mehr' \? geschwister\(UNTER\.mehr, ansicht\.unter, \(e\) => e\[0\]\) : \[\]\)/.test(app) && /ansicht\.tab === 'mehr' \? mehrChips : UNTER\[ansicht\.tab\]/.test(app) && /mehrChips\.length < 2/.test(app))
p('Alte Liste und tote Stile weg', !/mehr-liste|ml-txt|MEHR_INFO|seg-trenner/.test(app) && !/MEHR_SEKTIONEN|\.s-zeile|\.s-aktion/.test(bar))

console.log('\n5  Gleiche Namen überall')
const { mehrEintraege, appEintraege } = await import('../src/lib/mehr-eintraege.js')
const ohneZeichen = (x) => x.replace(/^[^\p{L}]+/u, '').trim()
const chipName = {}
for (const m of zeile.matchAll(/\['mehr\/([a-z]+)', (?:t|je)\('([^']+)'/g)) chipName[m[1]] = ohneZeichen(m[2])
const abweichend = mehrEintraege().filter((e) => chipName[e.id] && chipName[e.id] !== e.label).map((e) => `${e.id}: „${e.label}“ statt „${chipName[e.id]}“`)
p('Übersicht und Chips, Seitenleiste und Seitentitel: dieselben Namen', Object.keys(chipName).length >= 12 && abweichend.length === 0, abweichend.join(', '))
p('Übersicht und Chips: dieselben Zeichen', mehrEintraege().every((e) => !zeile.includes(`'mehr/${e.id}'`) || new RegExp(`'mehr/${e.id}', (?:t|je)\\('${e.icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `, 'u').test(zeile)))
p('App-Einträge heißen wie die Knöpfe in der Seitenleiste', ['Backup & Import', 'Handbuch', 'Design'].every((n) => appEintraege().some((a) => a.label === n) && sl.includes(n)))
const quelltexte = fs.readdirSync(new URL('../src/lib/', import.meta.url)).filter((f) => /\.(svelte|js)$/.test(f)).map((f) => lies('lib/' + f)).join('\n') + app
const tote = ['Mehr → Import', 'More → Import', 'unter Mehr, Updates', 'Mehr → Musik „'].filter((x) => quelltexte.includes(x))
p('Keine Verweise auf alte Wege im Menü', tote.length === 0, tote.join(', '))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
{
  // V34: Werkseinstellungen klein und grau ganz am Ende, unter Spenden, Speicher und Online-Stand
  const ende = mu.slice(mu.lastIndexOf('{#if unten}'))
  p('Werkseinstellungen ganz unten in der Übersicht, nicht mehr bei App und Einstellungen', /\{#if unten\}\{@render unten\(\)\}\{\/if\}[\s\S]*\{#if gefahr\}<button class="mu-gefahr"/.test(ende) && !/mu-app-liste[\s\S]*mu-gefahr[\s\S]*\{\/if\}\s*<\/div>\s*\{\/if\}\s*<\/div>/.test(mu.slice(0, mu.lastIndexOf('{#if unten}'))))
  p('klein, grau, unterstrichen, ohne roten Rahmen', /\.mu-gefahr \{[^}]*color: var\(--muted\)[^}]*text-decoration: underline/.test(mu) && !/\.mu-gefahr \{[^}]*danger-linie/.test(mu))
  p('Mehr-Seite: Speicherstand davor, Werkseinstellungen als letztes', /\{#snippet unten\(\)\}<SpeicherStand \/>\{\/snippet\}/.test(app))
  p('iPhone-Blatt: Online- und Backup-Stand davor, Werkseinstellungen als letztes', /\{#snippet unten\(\)\}[\s\S]*s-status s-backup[\s\S]*\{\/snippet\}/.test(bar))
}

console.log('\nAlles grün')
