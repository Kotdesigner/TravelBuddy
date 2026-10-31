// Testreise: läuft an jedem Tag, zu jeder Uhrzeit, nur mit gültigen Daten und ohne echte Angaben.
// Ausführen: node tests/testreise.test.mjs
import fs from 'node:fs'
import { baueTestreise, flugStaende, TEST_FOTOS, TEST_STANDORT, TEST_PRAEFIX } from '../src/lib/testreise.js'
import { plusTage, eintragTage, etappenMitDatum, etappeAm } from '../src/lib/plan.js'
import { kostenAuswertung, KATEGORIE, ausgabenSumme } from '../src/lib/kosten.js'
import { fluegeAusTerminen, flugImFokus, offeneVorab } from '../src/lib/flug.js'
import { ART } from '../src/lib/tierwelt.js'
import { NOTIZ_TYP } from '../src/lib/notizen-typen.js'
import { STATUS_MAP, S_MAP } from '../src/lib/wanderungen-daten.js'
import { DOKUMENT_TYPEN, VORBEREITUNG } from '../src/lib/vorbereitung-daten.js'
import { PACK_VORLAGE } from '../src/lib/packliste-daten.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const lokal = (j, m, t, h = 12, min = 0) => new Date(j, m, t, h, min).getTime()
const tagVon = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

console.log('\n1  Die Reise läuft immer gerade')
{
  const jetzt = lokal(2038, 2, 14)
  const s = baueTestreise(jetzt), heute = tagVon(jetzt)
  p('Reise begann vor neun Tagen', s.gesamtStart === plusTage(heute, -9))
  p('21 Reisetage', s.reiseTage === 21)
  const etappen = s.reisen.filter((r) => r.typ === 'etappe')
  p('Etappen füllen die Reise lückenlos', etappen.reduce((n, e) => n + e.tage, 0) === 21)
  p('heute liegt in einer Etappe', etappeAm(etappenMitDatum(s.reisen, s.gesamtStart), heute)?.reise.id === 'test-et-coral')
  p('das Logbuch endet gestern, heute ist noch frei', s.journal.every((e) => (e.bis || e.datum) < heute) && s.journal.some((e) => e.datum === plusTage(heute, -1)))
  const tage = new Set(s.journal.flatMap((e) => eintragTage(e)))
  p('jeder vergangene Reisetag hat einen Eintrag', Array.from({ length: 9 }, (_, i) => plusTage(heute, -9 + i)).every((d) => tage.has(d)))
  p('ein Eintrag über mehrere Tage', s.journal.some((e) => e.bis > e.datum))
  p('andere Tage ergeben andere Daten', baueTestreise(lokal(2038, 5, 1)).gesamtStart !== s.gesamtStart)
}

console.log('\n2  Der Flug ist zu jeder Uhrzeit weniger als 24 Stunden entfernt')
{
  for (const [h, min] of [[0, 10], [3, 59], [4, 0], [4, 5], [12, 0], [23, 55]]) {
    const jetzt = lokal(2038, 2, 31, h, min), s = baueTestreise(jetzt)
    const { alle } = fluegeAusTerminen(s.buchungen.events)
    const staende = flugStaende(s.buchungen.events, jetzt)
    const fokus = flugImFokus(alle, staende, jetzt, {})
    p(`um ${h}:${String(min).padStart(2, '0')} Uhr ist er der nächste`, fokus?.nr === 'ZZ471', JSON.stringify(fokus))
  }
}

console.log('\n3  Flüge und Züge')
{
  const jetzt = lokal(2038, 2, 14), s = baueTestreise(jetzt)
  const v = fluegeAusTerminen(s.buchungen.events), staende = flugStaende(s.buchungen.events, jetzt)
  p('vier Flüge und ein Zug', v.fluege.length === 4 && v.zuege.length === 1, v.fluege.map((f) => f.id).join())
  p('kein Termin ohne Nummer', !v.ohneNummer.length)
  p('Rückflug mit Anschluss', v.fluege.some((f) => f.anschlussVon))
  const offen = v.alle.filter((f) => f.terminDatum >= tagVon(jetzt)).filter((f) => !staende[f.id])
  p('jede kommende Fahrt hat einen erfundenen Stand', !offen.length, offen.map((f) => f.id).join())
  p('der nächste Flug hat 35 Minuten Verspätung', staende['test-fl-karratha#ZZ471'].daten.ab.neuMs - staende['test-fl-karratha#ZZ471'].daten.ab.planMs === 35 * 60e3)
  p('alle Fahrten sind als Test erkennbar', v.alle.every((f) => f.id.startsWith(TEST_PRAEFIX)))
  p('jeder Vorab-Flug gehört zu einem Termin', !offeneVorab(s.vorabKosten, v.alle).length)
  p('Flugnummern nur ZZ', v.fluege.every((f) => f.nr.startsWith('ZZ')))
}

console.log('\n4  Kosten')
{
  const s = baueTestreise(lokal(2038, 2, 14))
  const a = kostenAuswertung({ journal: s.journal, vorab: s.vorabKosten, kurse: {}, eintraege: etappenMitDatum(s.reisen, s.gesamtStart) })
  p('alle vier Cluster haben Posten', a.cluster.every((c) => c.kategorien.length), a.cluster.map((c) => c.id + c.kategorien.length).join())
  p('Cluster ergeben die Gesamtsumme', a.cluster.reduce((n, c) => n + c.eur, 0) === a.gesamt.eur)
  p('Etappen und „Ohne Etappe“ ergeben die Gesamtsumme', a.etappen.reduce((n, e) => n + e.eur, 0) === a.gesamt.eur)
  p('alle Kategorien gültig', s.journal.every((e) => e.ausgaben.every((x) => KATEGORIE[x.kat])) && s.vorabKosten.every((k) => KATEGORIE[k.kat]))
  p('Felder passen zur Ausgabenliste', s.journal.every((e) => Math.abs(e.ausgaben.reduce((n, x) => n + x.betrag, 0) - ausgabenSumme(e.ausgaben)) < 0.001))
  p('das Budget reicht und ist nicht leer', s.reiseBudget > a.gesamt.eur)
}

console.log('\n5  Nur gültige Werte')
{
  const s = baueTestreise(lokal(2038, 2, 14))
  const orte = new Set(JSON.parse(fs.readFileSync('public/orte.json', 'utf8')).map((o) => o.id))
  const ortIds = [...s.reisen.flatMap((r) => r.stops), ...s.wanderungen, ...s.journal].map((x) => x.ortId).filter(Boolean)
  p('alle Orte gibt es in der App', ortIds.every((id) => orte.has(id)), ortIds.filter((id) => !orte.has(id)).join())
  p('Ortsnotizen gehören zu echten Orten', Object.keys(s.daten).every((id) => orte.has(id)))
  p('jede Route hat ihre Etappe', s.reisen.filter((r) => r.typ === 'route').every((r) => s.reisen.some((e) => e.id === r.etappeId)))
  p('der Testort liegt an der Route', s.reisen.find((r) => r.id === 'test-rt-coral').stops.some((x) => x.lat === TEST_STANDORT.lat))
  p('Tiere aus der Tierwelt', s.journal.every((e) => e.sichtungen.every((x) => ART[x.art])))
  p('Notizen mit gültigem Typ', s.notizen.every((n) => NOTIZ_TYP[n.typ]))
  p('Wanderungen mit gültigem Stand', s.wanderungen.every((w) => STATUS_MAP[w.status] && S_MAP[w.schwierigkeit]))
  p('Dokumente mit gültiger Art', s.dokumente.every((d) => DOKUMENT_TYPEN.includes(d.typ)))
  const vorb = new Set(VORBEREITUNG.flatMap((g) => g.items.map((i) => i.id)))
  p('Haken der Vorbereitung gibt es', Object.keys(s.vorbereitung.checked).every((id) => vorb.has(id)))
  const pack = new Set(PACK_VORLAGE.flatMap((g) => g.items.map((i) => i.id)))
  p('Haken der Packliste gibt es', Object.keys(s.packliste.checked).every((id) => pack.has(id)))
  const bilder = Object.values(TEST_FOTOS).flat()
  p('alle Fotos liegen in der App', bilder.every((b) => fs.existsSync('public/' + b)), bilder.join())
  p('Fotos gehören zu Einträgen', Object.keys(TEST_FOTOS).every((id) => s.journal.some((e) => e.id === id)))
  const ids = [...s.reisen, ...s.journal, ...s.wanderungen, ...s.notizen, ...s.dokumente, ...s.vorabKosten, ...s.checkins, ...s.buchungen.events].map((x) => x.id)
  p('alle IDs sind eindeutig und als Test erkennbar', new Set(ids).size === ids.length && ids.every((id) => id.startsWith(TEST_PRAEFIX)))
}

console.log('\n6  Nichts Echtes')
{
  const text = JSON.stringify(baueTestreise(lokal(2038, 2, 14))) + fs.readFileSync('src/lib/testreise.js', 'utf8')
  p('keine Namen', !/Steve|Steven|Brandenburg|Nomek/.test(text))
  p('keine echten Flüge oder Züge', !/QR ?\d|VN ?\d|ICE ?771|Kiel/.test(text))
  p('keine festen Kalenderdaten im Code', !/\b20\d\d-\d\d-\d\d\b/.test(fs.readFileSync('src/lib/testreise.js', 'utf8')))
  p('keine Ausweisnummern', baueTestreise(lokal(2038, 2, 14)).dokumente.every((d) => d.nummer === ''))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
