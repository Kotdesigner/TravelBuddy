// Basic 1.41: Etappe an jeder Buchung, stornierte Unterkunft raus aus den Orten der Etappe,
// Buchungen am Telefon getrennt, neue Vorab-Ausgabe oben.
// Ausführen: node tests/basic141-buchungen.test.mjs   (kein Netz)
//
// Hintergrund: Die Etappe einer Buchung kam aus einem einzigen Datum. Ein Hotel, das einen Tag
// vor der Etappe eincheckt, fiel damit durch und ließ sich nirgends zuordnen. Und eine stornierte
// Unterkunft blieb als Ort in der Etappe stehen, samt Suche nach Kartenpunkten dafür.
import fs from 'node:fs'
import { buendle, buchungenMitKosten, etappeDerBuchung, verwaisteStopps, ohneVerwaisteStopps } from '../src/lib/buchung.js'
import { etappenMitDatum } from '../src/lib/plan.js'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

// Ausgedachter Plan: Anreise vom 2. bis 4., dann die Stadt
const reisen = [
  { id: 'e1', typ: 'etappe', name: 'Anreise', von: '2037-05-02', tage: 3, imGesamtplan: true, stops: [{ name: 'Hafenstadt', lat: 54.3, lon: 10.1 }, { name: 'Flughafenstadt', lat: 50.0, lon: 8.5 }, { name: 'Coral Lagoon Resort', lat: null, lon: null }] },
  { id: 'e2', typ: 'etappe', name: 'Stadt am Fluss', von: '2037-05-05', tage: 4, imGesamtplan: true, stops: [] },
]
const eintraege = etappenMitDatum(reisen, '2037-05-02')

const altesHaus = [
  { id: 'a1', kat: 'hotel', datum: '2037-05-02', titel: 'Coral Lagoon Resort', sub: 'Check-in 15:00', ref: 'C-1', docs: [], umgebucht: '2037-04-20T10:00:00.000Z', ersetztDurch: 'n1' },
  { id: 'a2', kat: 'hotel', datum: '2037-05-03', titel: 'Coral Lagoon Resort', sub: 'Check-out 11:00', ref: 'C-1', docs: [], umgebucht: '2037-04-20T10:00:00.000Z', ersetztDurch: 'n1' },
]
const neuesHaus = [
  { id: 'n1', kat: 'hotel', datum: '2037-05-01', titel: 'Palm Grove Lodge', sub: 'Check-in 15:00', ref: 'P-9', docs: [] },
  { id: 'n2', kat: 'hotel', datum: '2037-05-03', titel: 'Palm Grove Lodge', sub: 'Check-out 11:00', ref: 'P-9', docs: [] },
]
const bahn = [{ id: 'b1', kat: 'train', datum: '2037-05-02', titel: 'Hafenstadt → Flughafenstadt', sub: 'Bahn', ref: 'DB-7', docs: [] }]

console.log('\nDie Etappe einer Buchung')
{
  const buchung = buendle(neuesHaus)[0]
  p('Das Haus ist EINE Buchung mit zwei Terminen', buchung.ids.length === 2 && buchung.von === '2037-05-01' && buchung.bis === '2037-05-03')
  p('Es fängt vor der Etappe an und gehört trotzdem zur Anreise', etappeDerBuchung(eintraege, buchung)?.id === 'e1', String(etappeDerBuchung(eintraege, buchung)?.name))
  p('Was am Etappentag liegt, bleibt bei seiner Etappe', etappeDerBuchung(eintraege, buendle(bahn)[0])?.id === 'e1')
  const gewaehlt = buendle(neuesHaus.map((e) => ({ ...e, etappeId: 'e2' })))[0]
  p('Selbst gewählte Etappe schlägt das Datum', etappeDerBuchung(eintraege, gewaehlt)?.id === 'e2')
  const weit = buendle([{ id: 'x1', kat: 'tour', datum: '2040-06-01', titel: 'Irgendwann', docs: [] }])[0]
  p('Was in keine Etappe reicht, hat keine', etappeDerBuchung(eintraege, weit) === null)
  p('Ohne Buchung: keine Etappe, kein Absturz', etappeDerBuchung(eintraege, null) === null && etappeDerBuchung([], buchung) === null)
  p('Unter Buchungen steht die Etappe an der Karte', buchungenMitKosten(neuesHaus, [], eintraege)[0].etappe?.name === 'Anreise')
}

console.log('\nStornierte Unterkunft raus aus der Etappe')
{
  const alle = [...altesHaus, ...neuesHaus, ...bahn]
  const raus = verwaisteStopps(alle)
  p('Das umgebuchte Haus gilt als verwaister Stopp', raus.has('Coral Lagoon Resort') && raus.size === 1, [...raus].join(', '))
  const neu = ohneVerwaisteStopps(reisen, alle)
  p('Es steht nicht mehr in der Anreise', !(neu[0].stops || []).some((s) => s.name === 'Coral Lagoon Resort'))
  p('Die anderen Orte bleiben stehen', (neu[0].stops || []).map((s) => s.name).join(' → ') === 'Hafenstadt → Flughafenstadt')
  p('Die zweite Etappe bleibt dieselbe (keine unnötige Änderung)', neu[1] === reisen[1])
  const storniert = [...altesHaus.map((e) => ({ ...e, umgebucht: '', storniert: '2037-04-20T10:00:00.000Z' })), ...bahn]
  p('Storniert zählt genauso wie umgebucht', verwaisteStopps(storniert).has('Coral Lagoon Resort'))
  p('Gelöschte Termine stehen nicht mehr in der Liste und zählen trotzdem', verwaisteStopps(bahn, [altesHaus[0]]).has('Coral Lagoon Resort'))
  const nochDa = [{ ...altesHaus[0], umgebucht: '', storniert: '' }, altesHaus[1], ...bahn]
  p('Heißt noch ein gültiger Termin so, bleibt der Stopp', !verwaisteStopps(nochDa).has('Coral Lagoon Resort'))
  const fahrt = [{ id: 'f1', kat: 'train', datum: '2037-05-02', titel: 'Flughafenstadt', storniert: '2037-04-20T10:00:00.000Z', docs: [] }]
  p('Eine stornierte Fahrt räumt keine Stadt weg', verwaisteStopps(fahrt).size === 0 && ohneVerwaisteStopps(reisen, fahrt)[0] === reisen[0])
  p('Nichts storniert: alles bleibt, wie es ist', ohneVerwaisteStopps(reisen, [...neuesHaus, ...bahn]) === reisen)
}

console.log('\nEinbau in die Oberfläche')
{
  const bu = lies('src/lib/Buchungen.svelte')
  p('An jeder Buchung lässt sich die Etappe wählen', /class="bu-etappe-wahl"/.test(bu) && /function etappeSetzen\(b, id\) \{ aendereBuchung\(b\.ids, \{ etappeId: id \|\| '' \}\) \}/.test(bu))
  p('Ohne eigene Wahl steht da, was die App aus dem Datum rechnet', /nach Datum: \$\{autoEt\.name\}/.test(bu) && /const autoEtappe = \(b\) => etappeDerBuchung\(eintraege, \{ von: b\.von, bis: b\.bis, termine: \[\] \}\)/.test(bu))

  const ed = lies('src/lib/EtappeDetail.svelte')
  p('Die Etappe zeigt auch Buchungen, die ihr von Hand zugeordnet wurden', /b\.etappeId \? b\.etappeId === etappeId : imZeitraum\(b\.datum\) \|\| vonBuchung\.has\(b\.id\)/.test(ed))
  p('Zwischen zwei Buchungen liegt eine Linie', /\.ed-buch li \+ li \{ border-top: 1px solid var\(--line\)/.test(ed))
  p('Am Telefon steht das Datum über der Buchung', /@media \(max-width: 560px\)[\s\S]{0,260}\.ed-b-tag \{ grid-column: 1 \/ -1/.test(ed))

  const rv = lies('src/lib/Reisevorbereitung.svelte')
  p('Vorab-Ausgaben stehen nach Datum', /const vkListe = \$derived\.by/.test(rv) && /String\(a\.datum \|\| ''\)\.localeCompare\(String\(b\.datum \|\| ''\)\)/.test(rv))
  p('Eine frisch angelegte Ausgabe steht oben und bekommt den Schreibzeiger', /return frisch \? \[frisch, \.\.\.nach\.filter/.test(rv) && /\.vk-neu \.vk-text/.test(rv) && /f\?\.focus\(\)/.test(rv))
  p('Der Knopf „+ Ausgabe“ ruft genau das auf', /<button class="neu" onclick=\{vorabAusgabeNeu\}>/.test(rv))

  const ud = lies('src/lib/userdata.js')
  p('Stornieren, Umbuchen und Löschen ziehen die Stopps nach', (ud.match(/stoppsNachziehen\(/g) || []).length >= 4)
  p('Beim Start wird einmal aufgeräumt', /try \{ stoppsNachziehen\(\) \} catch/.test(ud))
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
