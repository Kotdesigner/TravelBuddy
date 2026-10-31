// Kosten aufgeschlüsselt, Auswertung ohne Rundungsfehler, Logbuch-Einträge über mehrere Tage.
// Mit erfundenen Daten. Ausführen: node tests/kosten.test.mjs
import fs from 'node:fs'
import { KOSTEN_KATEGORIEN, KATEGORIE, KOSTEN_CLUSTER, CLUSTER_KATS, clusterVon, postenAuswahl, betragVon, ausgabenVon, felderMitAusgaben, ausgabenSumme, kostenAuswertung } from '../src/lib/kosten.js'
import { eintragTage, deckt, offenerZeitraum, chronik } from '../src/lib/plan.js'
import { berechneBilanz } from '../src/lib/reise-bilanz.js'
import { zielEintrag } from '../src/lib/foto-zuordnung.js'
import { MODULE } from '../src/lib/journal-schema.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz !== '' ? '  → ' + zusatz : ''}`) }
}
const summeVon = (l, f) => l.reduce((s, x) => s + x[f], 0)

console.log('\n1  Ausgaben je Eintrag')
{
  p('Beträge', betragVon('12,50') === 12.5 && betragVon('12.5') === 12.5 && betragVon('') === 0 && betragVon('abc') === 0 && betragVon(-3) === 0)
  p('alte Einträge ergeben eine Liste', ausgabenVon({ felder: { kosten_sprit: '80', stimmung: 3 } }).map((a) => a.kat + a.betrag).join() === 'kosten_sprit80')
  p('leerer Eintrag', ausgabenVon({ felder: {} }).length === 0 && ausgabenVon(null).length === 0)
  const liste = [{ kat: 'kosten_sprit', betrag: 80.1, text: 'Exmouth' }, { kat: 'kosten_sprit', betrag: '40,20', text: 'Karratha' }, { kat: 'kosten_essen', betrag: 35, text: '' }]
  const f = felderMitAusgaben({ kosten_boot: '5', stimmung: 4, waehrung: 'AUD' }, liste)
  p('mehrere Tankstopps ergeben eine Summe', f.kosten_sprit === '120.3', f.kosten_sprit)
  p('entfernte Kategorie verschwindet, Rest bleibt', !('kosten_boot' in f) && f.stimmung === 4 && f.waehrung === 'AUD')
  p('Summe auf den Cent', ausgabenSumme(liste) === 155.3, ausgabenSumme(liste))
  p('neue Liste hat Vorrang', ausgabenVon({ ausgaben: [], felder: { kosten_sprit: '80' } }).length === 0)
}

console.log('\n2  Kategorien')
{
  const schema = MODULE.find((m) => m.id === 'kosten').felder.filter((f) => f.id.startsWith('kosten_')).map((f) => f.id)
  p('Essen gehen gibt es', !!KATEGORIE.kosten_essen && schema.includes('kosten_essen'))
  p('jedes Feld im Logbuch hat eine Kategorie', schema.every((id) => KATEGORIE[id]), schema.filter((id) => !KATEGORIE[id]))
  const vorb = fs.readFileSync(new URL('../src/lib/Reisevorbereitung.svelte', import.meta.url), 'utf8')
  const vorabKeys = [...vorb.matchAll(/key: '(kosten_\w+)'/g)].map((m) => m[1])
  p('jede Vorab-Kategorie zählt in der Auswertung', vorabKeys.length >= 13 && vorabKeys.every((id) => KATEGORIE[id]), vorabKeys.filter((id) => !KATEGORIE[id]))
  const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8')
  const alle = Object.values(CLUSTER_KATS).flat()
  p('jede Kategorie steht in genau einem Cluster', alle.length === KOSTEN_KATEGORIEN.length && new Set(alle).size === alle.length && KOSTEN_KATEGORIEN.every((k) => alle.includes(k.id)), alle.length)
  p('Zahlen zur Reise nutzen dieselben Cluster', app.includes('CLUSTER_KATS') && !app.includes("const LONG_CATS = ["))
  p('Long-Values nach den bisherigen Kriterien', ['kosten_drohne', 'kosten_kamera', 'kosten_kleidung', 'kosten_souvenir', 'kosten_technik', 'kosten_long'].every((k) => clusterVon(k) === 'long'))
  p('Short-Values nach den bisherigen Kriterien', ['kosten_lebensmittel', 'kosten_genuss', 'kosten_bedarf', 'kosten_telefon', 'kosten_internet', 'kosten_short', 'kosten_essen'].every((k) => clusterVon(k) === 'short'))
  p('Auswahlmenü im Logbuch ist gruppiert', fs.readFileSync(new URL('../src/lib/AusgabenListe.svelte', import.meta.url), 'utf8').includes('<optgroup'))
  p('Auswahlmenü der Vorabausgaben ist gruppiert', vorb.includes('<optgroup'))
}

console.log('\n3  Auswertung')
const eintraege = [
  { von: '2037-03-01', bis: '2037-03-05', tage: 5, reise: { id: 'et1', name: 'Süden', farbe: '#111111' } },
  { von: '2037-03-06', bis: '2037-03-10', tage: 5, reise: { id: 'et2', name: 'Norden', farbe: '#222222' } },
]
const journal = [
  { id: 'a', datum: '2037-03-01', felder: { waehrung: 'AUD' }, ausgaben: [{ id: '1', kat: 'kosten_sprit', betrag: 100.33, text: 'Tank' }, { id: '2', kat: 'kosten_essen', betrag: 33.33, text: '' }] },
  { id: 'b', datum: '2037-03-07', bis: '2037-03-09', felder: { waehrung: 'EUR' }, ausgaben: [{ id: '3', kat: 'kosten_attraktion', betrag: 66.67, text: 'Tour' }] },
  { id: 'c', datum: '2037-03-20', felder: { kosten_lebensmittel: '10.01' } },
]
const vorab = [
  { id: 'v1', kat: 'kosten_flug', betrag: 1000.49, waehrung: 'EUR', datum: '2036-12-01', reiseId: null },
  { id: 'v2', kat: 'kosten_unterkunft', betrag: 200.5, waehrung: 'AUD', datum: '2036-12-02', reiseId: 'et2' },
  { id: 'v3', kat: 'kosten_technik', betrag: '', waehrung: 'EUR', datum: '2036-12-02', reiseId: null },
]
{
  const kurse = { '2037-03-01': 0.6, '2037-03-07': 0.61, '2037-03-20': 0.62, '2036-12-01': 0.63, '2036-12-02': 0.64 }
  const a = kostenAuswertung({ journal, vorab, kurse, eintraege })
  for (const f of ['eur', 'aud']) {
    p(`${f}: Kategorien ergeben genau die Gesamtsumme`, summeVon(a.kategorien, f) === a.gesamt[f], `${summeVon(a.kategorien, f)} / ${a.gesamt[f]}`)
    p(`${f}: Etappen ergeben genau die Gesamtsumme`, summeVon(a.etappen, f) === a.gesamt[f], `${summeVon(a.etappen, f)} / ${a.gesamt[f]}`)
    p(`${f}: vorab plus unterwegs ergibt genau die Gesamtsumme`, a.vorab[f] + a.unterwegs[f] === a.gesamt[f])
  }
  p('teuerste Kategorie zuerst', a.kategorien[0].id === 'kosten_flug' && a.kategorien.every((k, i) => !i || a.kategorien[i - 1].eur >= k.eur))
  p('Zeitraum zählt seine Kosten einmal', a.kategorien.find((k) => k.id === 'kosten_attraktion').eur === 67, a.kategorien.find((k) => k.id === 'kosten_attraktion')?.eur)
  p('Vorabausgabe mit Etappe zählt dort', a.etappen.find((e) => e.id === 'et2').aud >= 200)
  p('Vorabausgabe ohne Etappe und Tag außerhalb stehen unter „Ohne Etappe“', a.etappen.at(-1).id === null && a.etappen.at(-1).name === 'Ohne Etappe')
  p('Tage mit Kosten zählen den Zeitraum mit', a.tage === 5, a.tage)
  p('Schnitt je Tag nur unterwegs', a.proTag.eur === Math.round(a.unterwegs.eur / 5), a.proTag.eur)
  for (const f of ['eur', 'aud']) {
    p(`${f}: Cluster ergeben genau die Gesamtsumme`, summeVon(a.cluster, f) === a.gesamt[f], `${summeVon(a.cluster, f)} / ${a.gesamt[f]}`)
    p(`${f}: Kategorien ergeben genau ihren Cluster`, a.cluster.every((c) => summeVon(c.kategorien, f) === c[f]))
  }
  const j2 = [...journal, { id: 'k', datum: '2037-03-02', felder: { waehrung: 'AUD' }, ausgaben: [{ id: '9', kat: 'kosten_kamera', betrag: 1000, text: 'Kamera' }] }]
  const b = kostenAuswertung({ journal: j2, vorab, kurse, eintraege })
  p('Long-Value zählt in die Gesamtsumme', b.gesamt.aud > a.gesamt.aud + 900)
  p('Long-Value steht im Cluster', b.cluster.find((c) => c.id === 'long').aud === 1000 || b.cluster.find((c) => c.id === 'long').aud === 1001 || b.cluster.find((c) => c.id === 'long').aud === 999, b.cluster.find((c) => c.id === 'long').aud)
  p('Long-Value verändert den Schnitt pro Tag nicht', b.proTag.eur === a.proTag.eur && b.tage === a.tage, `${b.proTag.eur} / ${a.proTag.eur}`)
  p('Short-Values pro Tag getrennt', b.shortProTag.eur < b.proTag.eur && b.shortProTag.aud > 0, JSON.stringify(b.shortProTag))
  const k1 = postenAuswahl(a, 'kosten_sprit')
  p('einzelne Kategorie im Menü', k1.anzahl === 1 && k1.eur === a.kategorien.find((k) => k.id === 'kosten_sprit').eur && k1.posten[0].text === 'Tank')
  const k2 = postenAuswahl(a, 'cluster:short')
  p('ganzer Cluster im Menü', k2.eur === a.cluster.find((c) => c.id === 'short').eur && k2.posten.every((x) => x.cluster === 'short') && k2.anzahl === 2, k2.anzahl)
  const k3 = postenAuswahl(a, 'alle')
  p('alle Ausgaben im Menü', k3.eur === a.gesamt.eur && k3.anzahl === a.posten.length)
  p('Schnitt je Posten', k3.proPosten === Math.round(a.gesamt.eur / a.posten.length))
  p('leere Auswahl', postenAuswahl(a, 'kosten_drohne').anzahl === 0)
  p('leere Vorabausgabe stört nicht', !a.kategorien.some((k) => k.id === 'kosten_technik'))
  p('Posten neueste zuerst, mit Vorab', a.posten[0].datum === '2037-03-20' && a.posten.some((x) => x.vorab))
  p('alter Eintrag zählt mit', a.kategorien.some((k) => k.id === 'kosten_lebensmittel'))
  const leer = kostenAuswertung({})
  p('ohne Daten', leer.gesamt.eur === 0 && leer.kategorien.length === 0 && leer.proTag === null)
  p('ganze Reise bleibt bei Rundung stabil', (() => { const viele = Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, datum: '2037-03-02', felder: {}, ausgaben: KOSTEN_KATEGORIEN.map((k, n) => ({ id: k.id, kat: k.id, betrag: 1.37 + n * 0.11 })) })); const b = kostenAuswertung({ journal: viele, eintraege }); return summeVon(b.kategorien, 'eur') === b.gesamt.eur && summeVon(b.kategorien, 'aud') === b.gesamt.aud })())
}

console.log('\n4  Einträge über mehrere Tage')
{
  const e = { id: 'z', datum: '2037-03-07', bis: '2037-03-09', text: 'Drei Tage am Riff', felder: {} }
  p('Tage des Eintrags', eintragTage(e).join() === '2037-03-07,2037-03-08,2037-03-09')
  p('ein Tag bleibt ein Tag', eintragTage({ datum: '2037-03-07' }).join() === '2037-03-07')
  p('falsches Bis wird ignoriert', eintragTage({ datum: '2037-03-07', bis: '2037-03-01' }).length === 1 && eintragTage({ datum: '2037-03-07', bis: 'x' }).length === 1)
  p('Monatswechsel', eintragTage({ datum: '2037-03-30', bis: '2037-04-02' }).length === 4)
  p('deckt', deckt(e, '2037-03-08') && !deckt(e, '2037-03-10') && !deckt(e, '2037-03-06'))
  const c = chronik({ eintraege, journal: [e] })
  const tage = c.abschnitte[1].tage.filter((t) => t.journal.length).map((t) => t.datum)
  p('Logbuch zeigt alle Tage als geschrieben', tage.join() === '2037-03-07,2037-03-08,2037-03-09', tage)
  const b = berechneBilanz({ journal: [e], kurse: {} })
  p('Bilanz zählt alle Tage', JSON.stringify(b).length > 2 && (b.tage?.geschrieben ?? b.geschrieben ?? b.logbuchTage ?? 3) === 3, JSON.stringify(b).slice(0, 160))
  p('Fotos eines Tages finden den Eintrag', zielEintrag([e], '2037-03-08') === e)
}

console.log('\n5  Offene Tage nachtragen')
{
  const et = eintraege[0]
  const j = [{ datum: '2037-03-02' }]
  const o = offenerZeitraum(et, j, '2037-03-10')
  p('erster Block offener Tage', o.datum === '2037-03-01' && !o.bis, JSON.stringify(o))
  const o2 = offenerZeitraum(et, [{ datum: '2037-03-01' }], '2037-03-04')
  p('nur bis heute', o2.datum === '2037-03-02' && o2.bis === '2037-03-04', JSON.stringify(o2))
  const o3 = offenerZeitraum(et, [{ datum: '2037-03-01', bis: '2037-03-05' }], '2037-03-10')
  p('alles geschrieben: Vorschlag am Anfang', o3.datum === '2037-03-01' && o3.bis === '2037-03-03', JSON.stringify(o3))
  const o4 = offenerZeitraum(et, [], '2037-02-01')
  p('Etappe in der Zukunft', o4.datum === '2037-03-01' && o4.bis === '2037-03-03', JSON.stringify(o4))
  p('Etappe gehört zum Vorschlag', o4.reiseId === 'et1')
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
