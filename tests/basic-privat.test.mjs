// Öffentliche Fassung: keine persönlichen Daten aus der privaten Reiseplanung.
// Prüft Inhalte, Vorgaben und Build-Einstellungen; nach `npm run build` auch dist/.
// Ausführen: node tests/basic-privat.test.mjs
import fs from 'node:fs'
import path from 'node:path'
import { CLIENT_ID, PLAYLIST_ID, LASTFM_KEY } from '../src/lib/musik/spotify-ids.js'
import { IMPRESSUM } from '../src/lib/impressum.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const wurzel = new URL('../', import.meta.url).pathname
const lies = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')
const dateien = (ordner, muster) => {
  const out = []
  ;(function lauf(d) { for (const e of fs.readdirSync(d)) { const q = path.join(d, e); if (fs.statSync(q).isDirectory()) lauf(q); else if (muster.test(e)) out.push(q) } })(path.join(wurzel, ordner))
  return out
}
// Code ohne Kommentare (Kommentare kommen nicht in den Build)
const ohneKommentare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const NAMEN = /Steve|Steven|Brandenburg|steve_nomek|AustralienKalender|TravelBuddy-Belege/
const ALTE_IDS = /bafcdeb6afae4a31b1351d6e5397eb14|3mTgFblL5NRrghGk7KqyTb|5e780b61a5126cac66280c16b82ac0eb/
const REISEDATEN = /2026-11-29|2026-12-13|2026-11-25|29\. ?November 2026|29\.11\.2026/
const ADRESSEN = /v2-wa-tb|trvlbdd|travelbuddyv2/

console.log('\n1  Inhalte (Orte, Routen, Bilder, Praxis, Quiz)')
{
  const json = dateien('public', /\.json$/).filter((f) => !/pois-/.test(f))
  const mitName = json.filter((f) => NAMEN.test(fs.readFileSync(f, 'utf8')))
  p(`kein Name in ${json.length} Inhaltsdateien`, !mitName.length, mitName.map((f) => path.basename(f)).join(', '))
  p('keine Startdaten mitgeliefert', !fs.existsSync(path.join(wurzel, 'public/startdaten.json')))
  p('Seitentitel ohne Namen', !NAMEN.test(lies('index.html')))
  for (const f of ['public/inhalt.json', 'public/inhalt.en.json']) {
    const k = JSON.parse(lies(f)).kalender || []
    p(`Referenz-Kalender in ${path.basename(f)} nur mit relativen Tagen`, k.length && k.every((x) => /^(Tag|Day) \d/.test(x.datum)), k.map((x) => x.datum).join(', '))
  }
  const plan = lies('public/inhalt.json') + lies('public/inhalt.en.json') + lies('public/routen.json') + lies('public/routen.en.json')
  p('Routen und Legende ohne Kalenderdaten (nur Tag 1, Tag 2 …)', !/\(\d{1,2}\.?[–-]\d{1,2}\.? ?(Dez|Jan|Dec)/.test(plan), (plan.match(/.{20}\(\d{1,2}\.?[–-]\d{1,2}\.? ?(Dez|Jan|Dec)[^)]*\)/g) || []).join(' | '))
  p('kein Rückflugdatum, kein Silvester im Plan', !/Rückflug \d|flight home \d|Silvester|New Year &|New Year reset|30\.\/31\. Dez|30\/31 Dec/.test(lies('public/inhalt.json') + lies('public/inhalt.en.json')))
}

console.log('\n1b Ganzes Repo (öffentlich): Tests, Werkzeuge, Notizen')
{
  // Konkrete Kalenderdaten 2026/2027 verraten Reisepläne. Erlaubt sind nur die Beispielreise
  // (Mai 2027) und die Testdaten (2037/2038).
  const ZEITRAUM = /\b2026-\d\d-\d\d\b|\b2027-(?!05)\d\d-\d\d\b|\b\d\d?\.\d\d?\.2026\b|\b\d\d?\.(?!0?5\.)\d\d?\.2027\b/
  const PRIVATE_DATEIEN = /Reisekalender-Stand|TravelBuddy-Nachtrag|00_Docs\/|IMMI|Palm Bay Resort/
  const alle = ['tests', 'scripts', 'docs', 'src'].flatMap((o) => dateien(o, /\.(js|mjs|svelte|html|md|json)$/))
    .concat(['README.md', 'HOCHLADEN.md', 'vite.config.js', 'index.html'].map((f) => path.join(wurzel, f)).filter((f) => fs.existsSync(f)))
    .filter((f) => !/basic-privat\.test|sprache\/|geo-/.test(f))
  const imZeitraum = alle.filter((f) => ZEITRAUM.test(fs.readFileSync(f, 'utf8')))
  p(`keine konkreten Daten aus 2026/2027 in ${alle.length} Dateien`, !imZeitraum.length, imZeitraum.map((f) => path.relative(wurzel, f)).join(', '))
  const privat = alle.filter((f) => PRIVATE_DATEIEN.test(fs.readFileSync(f, 'utf8')))
  p('keine Verweise auf private Dateien (Kalender, Nachträge, Ausweise)', !privat.length, privat.map((f) => path.relative(wurzel, f)).join(', '))
  const adressen = alle.filter((f) => ADRESSEN.test(fs.readFileSync(f, 'utf8')))
  p('keine Adressen der privaten Fassung, auch nicht in Notizen', !adressen.length, adressen.map((f) => path.relative(wurzel, f)).join(', '))
}

console.log('\n2  Code: keine festen Zugänge und Reisedaten')
{
  p('Spotify-Client-ID, Playlist und Last.fm-Schlüssel leer', CLIENT_ID === '' && PLAYLIST_ID === '' && LASTFM_KEY === '')
  const code = dateien('src', /\.(js|svelte)$/).filter((f) => !/sprache\//.test(f))
  const mitDatum = code.filter((f) => REISEDATEN.test(ohneKommentare(fs.readFileSync(f, 'utf8'))))
  p(`keine Reisedaten als Vorgabe in ${code.length} Dateien`, !mitDatum.length, mitDatum.map((f) => path.relative(wurzel, f)).join(', '))
  const mitId = code.filter((f) => ALTE_IDS.test(fs.readFileSync(f, 'utf8')))
  p('keine alten Konto-Kennungen', !mitId.length, mitId.join(', '))
  // Einzige Ausnahme: das Impressum, dort steht der Anbieter mit Absicht
  const mitName = code.filter((f) => !f.endsWith('impressum.js') && NAMEN.test(ohneKommentare(fs.readFileSync(f, 'utf8'))))
  p('kein Name in Texten der Oberfläche', !mitName.length, mitName.map((f) => path.relative(wurzel, f)).join(', '))
  const mitAdresse = code.filter((f) => ADRESSEN.test(fs.readFileSync(f, 'utf8')))
  p('keine Adressen der privaten Fassung', !mitAdresse.length, mitAdresse.join(', '))
}

console.log('\n3  Build-Einstellungen')
{
  const vc = lies('vite.config.js')
  p('Belege nie im Build', /const MIT_BELEGEN = false/.test(vc))
  p('sucht Belege nur im eigenen Ordner, nie nebenan', /const DOK_QUELLE = '_Documente'/.test(vc) && !/TravelBuddy_V3/.test(ohneKommentare(vc)))
  p('kein privater Build mehr', !/build:privat/.test(lies('package.json')))
  p('Handbuch ohne private Adresse und Reisedaten', !ADRESSEN.test(lies('docs/handbuch/handbuch.html')) && !REISEDATEN.test(lies('docs/handbuch/handbuch.html')) && !ADRESSEN.test(lies('docs/handbuch/handbook-en.html')))
}

console.log('\n4  Gebaute App (dist/)')
if (!fs.existsSync(path.join(wurzel, 'dist/index.html'))) console.log('  · übersprungen: erst npm run build')
else {
  const texte = dateien('dist', /\.(js|html|json|webmanifest|css)$/).filter((f) => !/pois-|geo-/.test(f))
  const treffer = texte.filter((f) => { const s = fs.readFileSync(f, 'utf8').replaceAll(IMPRESSUM.name, '').replaceAll(IMPRESSUM.email, ''); return NAMEN.test(s) || ALTE_IDS.test(s) || REISEDATEN.test(s) || ADRESSEN.test(s) })
  p(`${texte.length} Dateien ohne Namen, Kennungen, Reisedaten, Adressen`, !treffer.length, treffer.map((f) => path.relative(wurzel, f)).join(', '))
  p('keine Größentabelle fremder Belege', !fs.existsSync(path.join(wurzel, 'dist/belege-groessen.json')))
  p('keine Belege', !fs.existsSync(path.join(wurzel, 'dist/dokumente')) || !fs.readdirSync(path.join(wurzel, 'dist/dokumente')).length)
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
