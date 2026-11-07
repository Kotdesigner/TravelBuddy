// Automatische Sicherung: täglich bis 22 Uhr, sonst beim nächsten Start, still im Hintergrund
import fs from 'node:fs'
import { sichere, letzterSchluss, faellig, neueListe, dateiname, istLeer, groesse, BEHALTEN, SCHLUSS_STUNDE } from '../src/lib/autosicherung.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const um = (tag, h, m = 0) => new Date(2037, 10, tag, h, m).getTime()   // November 2037, lokale Zeit

console.log('\n1  Wann gesichert wird')
p('Schluss ist 22 Uhr', SCHLUSS_STUNDE === 22)
p('Letzter Schluss am Morgen: gestern 22 Uhr', letzterSchluss(um(8, 9)) === um(7, 22))
p('Letzter Schluss um 22:00: heute 22 Uhr', letzterSchluss(um(8, 22, 0)) === um(8, 22))
p('Noch nie gesichert: sofort', faellig(null, um(8, 9)))
p('Start am Morgen, gestern um 22:05 gesichert: nicht nötig', !faellig(um(7, 22, 5), um(8, 9)))
p('Start am Morgen, zuletzt vor zwei Tagen: sofort', faellig(um(6, 22, 5), um(8, 9)))
p('Morgens gesichert, App um 22 Uhr offen: wieder sichern', faellig(um(8, 9), um(8, 22, 0)))
p('Um 21:59 nach Sicherung von gestern 22:01: noch nicht', !faellig(um(7, 22, 1), um(8, 21, 59)))
p('Gestern 21:50 gesichert, heute Morgen geöffnet: sofort (der Tag um 22 Uhr fehlte)', faellig(um(7, 21, 50), um(8, 8)))
p('Höchstens einmal je Abschnitt: kurz nach 22 Uhr gesichert, um 23 Uhr nicht noch einmal', !faellig(um(8, 22, 1), um(8, 23)))

console.log('\n2  Was aufbewahrt wird')
const l1 = neueListe([], { zeit: um(6, 22), text: 'a' })
const l2 = neueListe(l1, { zeit: um(7, 22), text: 'b' })
const l3 = neueListe(l2, { zeit: um(8, 9), text: 'c' })
const l4 = neueListe(l3, { zeit: um(8, 22), text: 'd' })
const l5 = neueListe(l4, { zeit: um(9, 22), text: 'e' })
p('Eine Sicherung je Tag, die neuere ersetzt die ältere', l4.length === 3 && l4[0].text === 'd' && !l4.some((x) => x.text === 'c'))
p(`Höchstens ${BEHALTEN} Tage`, l5.length === 3 && l5.map((x) => x.text).join() === 'e,d,b')
p('Bei wenig Platz nur die neueste', neueListe(l4, { zeit: um(9, 22), text: 'e' }, 1).length === 1)
p('Leerer Stand wird nicht gesichert', istLeer({ reisen: [], journal: [], buchungen: { events: [] } }) && !istLeer({ reisen: [{ id: 'a' }] }) && !istLeer({ journal: [{}] }) && /if \(istLeer\(payload\)\) return false/.test(lies('lib/autosicherung.js')))
p('Größe lesbar', groesse(22363) === '22 KB' && groesse(5 * 1048576) === '5,0 MB')
p('Dateiname mit Datum', dateiname(um(8, 22)) === 'WA-Reiseplan-Auto-Backup_2037-11-08.json')

p('Nichts zu sichern (Testreise): kein Eintrag', (await sichere(() => null, { erzwingen: true })) === false)

console.log('\n3  Still und sicher eingebaut')
const as = lies('lib/autosicherung.js'), app = lies('App.svelte'), bi = lies('lib/BackupImport.svelte'), ud = lies('lib/userdata.js')
p('Kein Download und kein Teilen-Menü ohne Fingertipp', !/\.click\(\)|navigator\.share|download\s*=/.test(as))
p('Startet erst, wenn die Daten geladen sind', /\$effect\(\(\) => \{ if \(laden\) return; return starteWaechter\(autoPayload\) \}\)/.test(app))
p('Prüft beim Start, jede Minute und beim Zurückkommen', /setTimeout\(pruefe/.test(as) && /setInterval\(pruefe, 60e3\)/.test(as) && /visibilitychange/.test(as))
p('Gleicher Inhalt wie „Backup sichern“', /export function baueBackupPayload/.test(ud) && /payloadBauen\(\)/.test(as))
p('Eigener Speicher, nicht der App-Speicher', /const DB = 'tb-autosicherung'/.test(as))
p('Füllt den Speicher nicht: prüft freien Platz', /estimate/.test(as) && /behalten = 1/.test(as))
p('Ordner nur mit gültiger Freigabe beschreiben', /queryPermission\(\{ mode: 'readwrite' \}\)\) !== 'granted'/.test(as))
p('Seite zeigt Sicherungen, Zurückholen über die normale Vorschau', /Automatische Sicherung/.test(bi) && /onImportDatei\(f\)/.test(bi) && /onImportDatei=\{\(f\) => onImport\(\{ target: \{ files: \[f\], value: '' \} \}\)\}/.test(app))
p('Während der Testreise nicht gesichert', /const autoPayload = \(\) => \(get\(testreiseAn\) \? null : baueBackupPayload\(\)\)/.test(app) && /starteWaechter\(autoPayload\)/.test(app) && /baueBackup=\{autoPayload\} autoPause=\{\$testreiseAn\}/.test(app))
p('Abschaltbar', /setzeAn\(e\.currentTarget\.checked\)/.test(bi))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
