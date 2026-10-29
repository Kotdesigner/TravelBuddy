// Reiseplan: Etappen, Routen, Umbau des Altformats, Logbuch-Chronik.
// Ausführen: node tests/plan.test.mjs
import {
  istRoute, istEtappe, etappenMitDatum, planUeberblick, etappeAm, planMigrieren, besteEinfuegeStelle,
  vermuteEtappe, zuordnungNachImport, chronik, reiseStatus, plusTage, tageZwischen, abstandZurRoute,
} from '../src/lib/plan.js'
import { fuehreZusammen } from '../src/lib/zusammenfuehren.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

console.log('\n1  Datum als Text')
p('plusTage über Monatsgrenze', plusTage('2037-11-29', 3) === '2037-12-02')
p('plusTage über Jahresgrenze', plusTage('2037-12-31', 1) === '2038-01-01')
p('tageZwischen', tageZwischen('2037-11-29', '2038-01-29') === 61)

console.log('\n2  Was ist Etappe, was Route')
p('importierte Reise = Etappe', istEtappe({ quelle: 'reisekalender', imGesamtplan: true }))
p('eigene Reise im Plan = Etappe (Altbestand)', istEtappe({ imGesamtplan: true }))
p('eigene Reise außerhalb des Plans = Route (Altbestand)', istRoute({ imGesamtplan: false }))
p('typ schlägt Altbestand-Regel', istEtappe({ typ: 'etappe', imGesamtplan: false }) && istRoute({ typ: 'route', imGesamtplan: true }))

console.log('\n3  Etappen mit festem Datum')
{
  const rs = [
    { id: 'b', typ: 'etappe', von: '2037-12-04', tage: 4 },
    { id: 'a', typ: 'etappe', von: '2037-11-30', tage: 4 },
    { id: 'r', typ: 'route', tage: 23, etappeId: 'b' },
  ]
  const e = etappenMitDatum(rs)
  p('nach Datum sortiert, nicht nach Liste', e.map((x) => x.reise.id).join() === 'a,b')
  p('Route verlängert die Reise NICHT', planUeberblick(e).tage === 8, String(planUeberblick(e).tage))
  p('bis = von + Tage − 1', e[1].bis === '2037-12-07')
  p('etappeAm findet die Etappe', etappeAm(e, '2037-12-05')?.reise.id === 'b' && etappeAm(e, '2037-12-08') === null)
  const l = planUeberblick(etappenMitDatum([{ id: 'x', typ: 'etappe', von: '2037-12-01', tage: 2 }, { id: 'y', typ: 'etappe', von: '2037-12-05', tage: 1 }, { id: 'z', typ: 'etappe', von: '2037-12-05', tage: 1 }]))
  p('Lücke erkannt (2 freie Tage)', l.luecken.some((x) => x.nachId === 'x' && x.tage === 2), JSON.stringify(l.luecken))
  p('Überschneidung erkannt (−1)', l.luecken.some((x) => x.vorId === 'z' && x.tage === -1))
}

console.log('\n5  Wo passt ein neuer Stopp hin?')
{
  const perth = { name: 'Perth', lat: -31.95, lon: 115.86 }
  const kalbarri = { name: 'Kalbarri', lat: -27.71, lon: 114.16 }
  const carnarvon = { name: 'Carnarvon', lat: -24.88, lon: 113.66 }
  const geraldton = { name: 'Geraldton', lat: -28.77, lon: 114.61 }
  const exmouth = { name: 'Exmouth', lat: -21.93, lon: 114.13 }
  p('leere Liste → an Position 0', besteEinfuegeStelle([], perth) === 0)
  p('Geraldton zwischen Perth und Kalbarri', besteEinfuegeStelle([perth, kalbarri, carnarvon], geraldton) === 1)
  p('Exmouth hinter Carnarvon ans Ende', besteEinfuegeStelle([perth, kalbarri, carnarvon], exmouth) === 3)
  p('ohne Koordinaten → ans Ende', besteEinfuegeStelle([perth, kalbarri], { name: 'X' }) === 2)
  p('Abstand zur Route über Stopps', Math.round(abstandZurRoute({ stops: [perth, kalbarri] }, geraldton)) < 140)
}

console.log('\n6  Route einer Etappe zuordnen')
{
  const etappen = [
    { id: 'perth', name: 'Perth', art: 'flug', tage: 2, stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }] },
    { id: 'rt', name: 'Roadtrip', art: 'auto', tage: 46, stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }] },
    { id: 'mel', name: 'Melbourne', art: 'flug', tage: 4, stops: [{ name: 'Melbourne', lat: -37.81, lon: 144.96 }] },
  ]
  p('gefahrene, längste Etappe gewinnt', vermuteEtappe({ stops: [{ lat: -31.95, lon: 115.86 }, { lat: -21.17, lon: 119.74 }] }, etappen)?.id === 'rt')
  p('kein Kandidat → keine Zuordnung', vermuteEtappe({ stops: [{ lat: -12.46, lon: 130.84 }] }, etappen) === null)
}

console.log('\n7  Neu-Import: alte Etappen-IDs auf neue abbilden')
{
  const alt = [{ id: 'a1', name: 'Melbourne', kalenderVon: '2037-11-30', tage: 4 }, { id: 'a2', name: 'Roadtrip (Camper)', kalenderVon: '2037-12-13', kalenderBis: '2038-01-27', tage: 46 }]
  const neu = [{ id: 'n1', name: 'Melbourne', kalenderVon: '2037-11-30', tage: 4 }, { id: 'n2', name: 'Roadtrip (Mietcamper)', kalenderVon: '2037-12-14', kalenderBis: '2038-01-27', tage: 45 }]
  const m = zuordnungNachImport(alt, neu)
  p('gleicher Name', m.get('a1') === 'n1')
  p('umbenannt → größte Überschneidung', m.get('a2') === 'n2')
}

console.log('\n8  Logbuch-Chronik')
{
  const rs = [{ id: 'm', typ: 'etappe', von: '2037-11-30', tage: 4 }, { id: 'c', typ: 'etappe', von: '2037-12-04', tage: 2 }]
  const e = etappenMitDatum(rs)
  const c = chronik({
    eintraege: e,
    journal: [{ id: 'j1', datum: '2037-12-01' }, { id: 'j0', datum: '2037-07-25' }, { id: 'j9', datum: '2038-03-01' }],
    wanderungen: [{ id: 'w1', datum: '2037-12-04', zeit: '15:00' }, { id: 'w2', datum: '2037-12-04', zeit: '07:00' }, { id: 'w3' }],
    buchungen: [{ datum: '2037-11-30', titel: 'Flug' }, { datum: '2037-12-02', titel: 'x', platzhalter: true }],
    heute: '2037-12-05',
  })
  p('zwei Etappen-Abschnitte', c.abschnitte.length === 2)
  p('jede Etappe hat alle ihre Tage', c.abschnitte[0].tage.length === 4 && c.abschnitte[1].tage.length === 2)
  p('Logbuchtag am richtigen Tag', c.abschnitte[0].tage[1].journal[0]?.id === 'j1')
  p('Buchung am Anreisetag, Platzhalter nicht', c.abschnitte[0].tage[0].buchungen.length === 1 && c.abschnitte[0].tage[2].buchungen.length === 0)
  p('Wanderungen nach Uhrzeit', c.abschnitte[1].tage[0].wanderungen.map((w) => w.id).join() === 'w2,w1')
  p('Wanderung ohne Datum steht nicht in der Chronik', !JSON.stringify(c).includes('"w3"'))
  p('Tag-Nummern laufen über die Etappen', c.abschnitte[1].tage[0].nr === 5)
  p('Test-Einträge vom Juli stehen unter „vorher"', c.vorher.length === 1 && c.vorher[0].datum === '2037-07-25')
  p('nach der Reise unter „nachher"', c.nachher.length === 1)
  p('aktuelle Etappe erkannt', c.aktuell === 'c')
  p('ohne Gerätefotos hat jeder Tag eine leere Fotoliste', [...c.abschnitte.flatMap((a) => a.tage), ...c.vorher].every((t) => Array.isArray(t.fotos) && !t.fotos.length))
  const mitFotos = chronik({ eintraege: e, fotos: [{ id: 'f1', datum: '2037-12-02' }, { id: 'f2', datum: '2037-12-02' }, { id: 'f3', datum: '2037-11-10' }, { id: 'f4' }] })
  p('Gerätefotos am richtigen Tag, in ihrer Reihenfolge', mitFotos.abschnitte[0].tage[2].fotos.map((f) => f.id).join() === 'f1,f2')
  p('Gerätefoto vor der Reise macht einen Tag unter „vorher“', mitFotos.vorher.length === 1 && mitFotos.vorher[0].fotos[0].id === 'f3')
  p('Gerätefoto ohne Datum steht nicht in der Chronik', !JSON.stringify(mitFotos).includes('"f4"'))
}

console.log('\n9  Wo steht man?')
{
  const e = etappenMitDatum([{ id: 'a', typ: 'etappe', von: '2037-11-29', tage: 62 }])
  const v = reiseStatus(e, '2037-10-09')
  p('vor der Reise: 51 Tage', v.phase === 'vorher' && v.nochTage === 51, JSON.stringify(v.nochTage))
  const u = reiseStatus(e, '2037-12-01')
  p('unterwegs: Tag 3', u.phase === 'unterwegs' && u.tagNr === 3 && u.tagInEtappe === 3)
  p('danach', reiseStatus(e, '2038-02-10').phase === 'nachher')
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
