// Mehr → Backup & Import: eine Seite statt zwei Knöpfen, mit Erklärung und beiden Funktionen
import fs from 'node:fs'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const app = lies('App.svelte'), bi = lies('lib/BackupImport.svelte'), bar = lies('lib/BottomBar.svelte'), sl = lies('lib/Seitenleiste.svelte')

console.log('\nBackup & Import')
p('Seite eingebunden unter mehr/backup', /ansicht\.unter === 'backup'\}\s*<BackupImport onBackup=\{onExport\} onImport=\{\(\) => importInput\.click\(\)\} onRueckgaengig=\{importZurueck\} \/>/.test(app))
p('Titel „Backup & Import“', /ansicht\.unter === 'backup' \? je\('Backup & Import'/.test(app))
p('Keine Chip-Reihe auf der Seite (wie Handbuch, Design)', /'design', 'backup'\]\.includes\(ansicht\.unter\)/.test(app))
p('iPhone-Blatt: ein Knopf statt Backup und Import', /sheetLink\('backup'\)/.test(bar) && !/sheetAktion\(onBackup\)|sheetAktion\(onImport\)/.test(bar))
p('Mac-Seitenleiste: ein Knopf statt zwei', /onclick=\{onBackupImport\}/.test(sl) && !/onclick=\{onBackup\}|onclick=\{onImport\}/.test(sl) && /onBackupImport=\{\(\) => geh\('mehr\/backup'\)\}/.test(app))
p('Erklärt Sichern, Importieren, Abgleichen, Wann', ['Backup sichern', 'Backup importieren', 'Zwischen Geräten abgleichen', 'Wann sichern?'].every((x) => bi.includes(x)))
p('Sagt, was nicht in der Datei ist', /Nicht in der Datei: Tickets und Ausweise, Fotos fürs Tagebuch/.test(bi))
p('Zusammenführen löscht nichts, Ersetzen übernimmt ganz', /„Zusammenführen“ ergänzt nur und löscht nichts/.test(bi) && /„Ersetzen“ übernimmt die Datei ganz/.test(bi))
p('Knöpfe: sichern, importieren, rückgängig', /onclick=\{onBackup\}/.test(bi) && /onclick=\{onImport\}/.test(bi) && /onRueckgaengig && \$schnappschuss/.test(bi))
p('Zeigt letztes Backup und warnt nach 7 Tagen', /\$syncZeiten\.gesichert/.test(bi) && /alt >= 7/.test(bi))
p('Abgleich allgemein, nicht nur Apple', /iPhone, Android, Mac, Windows oder Linux/.test(bi) && /Quick Share/.test(bi) && !/Mac und iPhone/.test(bi) && !/Update von iOS/.test(bi))
p('Speicherstand auf der Seite', /<SpeicherStand \/>/.test(bi))
p('Datei-Auswahl für den Import bleibt in der App', /<input bind:this=\{importInput\} type="file"/.test(app))
if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
