// App zurücksetzen und Testreise-Knopf
import fs from 'node:fs'
import { zuLoeschen, DATENBANKEN } from '../src/lib/zuruecksetzen.js'
import { hatEigeneEtappe } from '../src/lib/plan.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
console.log('\n1  App zurücksetzen')
p('Alle Datenbanken der App', ['wa-plan', 'wa-belege', 'wa-tagebuch-fotos', 'wa-tresor'].every((d) => DATENBANKEN.includes(d)))
const c = zuLoeschen(['workbox-precache-v2-https://x/', 'karten-pmtiles-v2', 'reisedokumente-v1'])
p('Offline-Karten und Dokumente werden gelöscht', c.includes('karten-pmtiles-v2') && c.includes('reisedokumente-v1'))
p('Die App selbst bleibt offline startfähig', !c.some((n) => n.startsWith('workbox-precache')))
const z = fs.readFileSync(new URL('../src/lib/zuruecksetzen.js', import.meta.url), 'utf8')
p('Zwei Rückfragen, erst mit Backup-Angebot', /Erst Backup sichern/.test(z) && /Wirklich alles löschen/.test(z) && /gefahr: true/.test(z))
const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8')
p('Menü und Seitenleiste haben den Knopf', (app.match(/onZuruecksetzen=\{\(\) => appZuruecksetzen\(onExport\)\}/g) || []).length === 2)
console.log('\n2  Testreise im Menü')
p('Leere App: Testreise anbieten', !hatEigeneEtappe([]))
p('Nur eine Idee: weiter anbieten', !hatEigeneEtappe([{ id: 'i', idee: true, art: 'auto' }]))
p('Eigene Etappe: nicht mehr anbieten', hatEigeneEtappe([{ id: 'e', name: 'Perth', von: '2030-01-10', tage: 3 }]))
const td = fs.readFileSync(new URL('../src/lib/testreise-dienst.js', import.meta.url), 'utf8')
p('Läuft die Testreise, bleibt „beenden“', /\(\[an, r\]\) => an \|\| !hatEigeneEtappe\(r\)/.test(td))
if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
