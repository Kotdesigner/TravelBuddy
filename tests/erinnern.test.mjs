// Erinnern: Fotos einsortieren, Tierwelt-Album, Reise-Bilanz.
// Ausführen: node tests/erinnern.test.mjs
import { fotoSchluessel, fotoInfo, bereinigeMeta, naechsterOrt, planeFotos, zusammenfassung, zielEintrag, tagesPatch, quellKennung } from '../src/lib/foto-zuordnung.js'
import { ARTEN, album, neueSichtung, sichtungGueltig, mitSichtung, ohneSichtung, artVon } from '../src/lib/tierwelt.js'
import { berechneBilanz, bilanzKacheln, temperaturAus, bilanzHatDaten } from '../src/lib/reise-bilanz.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const ORTE = [
  { id: 'broome', name: 'Broome', lat: -17.96, lon: 122.24 },
  { id: 'cable', name: 'Cable Beach', lat: -17.93, lon: 122.21 },
  { id: 'kalbarri', name: 'Kalbarri NP', lat: -27.71, lon: 114.16 },
  { id: 'eigen-1', name: 'Mein Stellplatz', lat: -27.60, lon: 114.20 },
]

console.log('\n1  Fingerabdruck und Angaben am Foto')
{
  const a = 'data:image/jpeg;base64,' + 'A'.repeat(5000)
  const b = 'data:image/jpeg;base64,' + 'A'.repeat(4999) + 'B'
  p('gleich bleibt gleich', fotoSchluessel(a) === fotoSchluessel(a))
  p('ein Zeichen anders: anderer Schlüssel', fotoSchluessel(a) !== fotoSchluessel(b))
  const gross = 'data:' + 'x'.repeat(300000)
  p('großes Bild geht schnell und stabil', fotoSchluessel(gross) === fotoSchluessel(gross))
  const e = { fotos: [a, b], fotoMeta: [{ k: fotoSchluessel(b), ort: 'Broome' }] }
  p('Angaben über den Schlüssel, nicht die Stelle', fotoInfo(e, b)?.ort === 'Broome' && fotoInfo(e, a) === null)
  p('altes Foto ohne fotoMeta: null', fotoInfo({ fotos: [a] }, a) === null)
  p('bereinigen nach Löschen', bereinigeMeta([a], e.fotoMeta).length === 0 && bereinigeMeta([b], e.fotoMeta).length === 1)
}

console.log('\n2  Nächster Ort (15 km)')
{
  p('Cable Beach näher als Broome', naechsterOrt(-17.931, 122.209, ORTE)?.id === 'cable')
  p('eigener Ort zählt mit', naechsterOrt(-27.601, 114.201, ORTE)?.name === 'Mein Stellplatz')
  p('20 km weg: kein Ort', naechsterOrt(-18.14, 122.24, ORTE) === null)
  p('ohne Koordinaten: null', naechsterOrt(null, null, ORTE) === null)
  const n = naechsterOrt(-17.96, 122.30, ORTE)
  p('Entfernung auf 0,1 km', n && n.km > 5 && n.km < 7, JSON.stringify(n))
}

console.log('\n3  Fotos nach Tagen planen')
const FOTOS = [
  { id: 1, name: 'IMG_1.JPG', groesse: 100, datum: '2037-12-05', zeit: '2037-12-05T18:00:00+08:00', lat: -17.93, lon: 122.21 },
  { id: 2, name: 'IMG_2.JPG', groesse: 200, datum: '2037-12-05', zeit: '2037-12-05T08:00:00+08:00', lat: -17.96, lon: 122.24 },
  { id: 3, name: 'IMG_3.JPG', groesse: 300, datum: '2037-12-07', zeit: '2037-12-07T10:00:00', lat: null, lon: null },
  { id: 4, name: 'IMG_4.HEIC', groesse: 400, datum: null, zeit: null, lat: null, lon: null },
  { id: 5, name: 'IMG_5.JPG', groesse: 500, datum: '2037-12-09', zeit: null, lat: -25.0, lon: 120.0 },
]
const JOURNAL = [
  { id: 'j2', datum: '2037-12-07', fotos: [], text: 'zweiter' },
  { id: 'j1', datum: '2037-12-07', fotos: ['alt'], text: 'erster' },
]
{
  const plan = planeFotos(FOTOS, { orte: ORTE, journal: JOURNAL, ohneDatumTag: '2037-12-06' })
  p('5 Fotos', plan.anzahl === 5)
  p('4 Tage (ohne Datum auf gewähltem Tag)', plan.tageAnzahl === 4, plan.tage.map((t) => t.datum).join(','))
  p('3 mit Ort', plan.mitOrt === 3)
  p('Text der Vorschau', zusammenfassung(plan) === '5 Fotos · 4 Tage · 3 mit Ort', zusammenfassung(plan))
  p('Tage sortiert', plan.tage.map((t) => t.datum).join(',') === '2037-12-05,2037-12-06,2037-12-07,2037-12-09')
  const d5 = plan.tage[0]
  p('am Tag nach Uhrzeit sortiert', d5.fotos[0].id === 2 && d5.fotos[1].id === 1)
  p('Ort am Foto: Cable Beach', d5.fotos[1].ort?.name === 'Cable Beach')
  p('Outback ohne bekannten Ort: ort null', plan.tage[3].fotos[0].ort === null)
  p('7.12. hat Eintrag: kein neuer', plan.tage[2].neu === false && plan.tage[2].eintragId === 'j1')
  p('5.12. ohne Eintrag: neu', d5.neu === true)
  p('ohne Datum gemerkt', plan.ohneDatum.length === 1 && plan.ohneDatum[0].id === 4)
  const ohneTag = planeFotos(FOTOS, { orte: ORTE })
  p('ohne gewählten Tag: Foto wartet', ohneTag.tageAnzahl === 3 && ohneTag.offen === 1)
  const aus = planeFotos(FOTOS, { orte: ORTE, ohneDatumTag: '2037-12-06', ausgeschlossen: new Set([4, 5]) })
  p('abgewählte Fotos zählen nicht', aus.anzahl === 3 && aus.tageAnzahl === 2)
  const singular = zusammenfassung(planeFotos([FOTOS[0]], { orte: ORTE }))
  p('Einzahl', singular === '1 Foto · 1 Tag · 1 mit Ort', singular)
}

console.log('\n4  Speichern am Tag')
{
  p('Zieleintrag: der älteste des Tages', zielEintrag(JOURNAL, '2037-12-07').id === 'j1')
  p('kein Eintrag: null', zielEintrag(JOURNAL, '2037-12-01') === null)
  const plan = planeFotos(FOTOS, { orte: ORTE, journal: JOURNAL, ohneDatumTag: '2037-12-06' })
  const t5 = plan.tage[0]
  const bilder = t5.fotos.map((f, i) => ({ foto: f, src: 'data:bild' + f.id }))
  const neu = tagesPatch(null, bilder)
  p('neuer Tag: zwei Fotos', neu.patch.fotos.length === 2 && neu.neu === 2)
  p('fotos bleiben Zeichenketten', neu.patch.fotos.every((x) => typeof x === 'string'))
  p('fotoMeta mit Ort und Zeit', neu.patch.fotoMeta[0].ort === 'Broome' && neu.patch.fotoMeta[1].zeit === '2037-12-05T18:00:00+08:00')
  p('neuer Tag bekommt Ort', !!neu.vorlage.ort, JSON.stringify(neu.vorlage))
  const vorh = { id: 'x', fotos: ['alt1'], fotoMeta: [{ k: 'zz', quelle: 'q' }] }
  const upd = tagesPatch(vorh, bilder)
  p('vorhandene Fotos bleiben vorn', upd.patch.fotos[0] === 'alt1' && upd.patch.fotos.length === 3)
  p('vorhandene Angaben bleiben', upd.patch.fotoMeta[0].k === 'zz')
  p('vorhandener Tag: Ort bleibt unberührt', upd.vorlage === null)
  const zweimal = tagesPatch({ fotos: upd.patch.fotos, fotoMeta: upd.patch.fotoMeta }, bilder)
  p('dasselbe Bild nicht doppelt', zweimal.neu === 0 && zweimal.patch.fotos.length === 3)
  // Zweiter Import derselben Dateien wird schon in der Vorschau erkannt
  const journal2 = [{ id: 'n', datum: '2037-12-05', fotos: neu.patch.fotos, fotoMeta: neu.patch.fotoMeta }]
  const plan2 = planeFotos(FOTOS.slice(0, 2), { orte: ORTE, journal: journal2 })
  p('schon importiert: doppelt gezählt, nicht geplant', plan2.doppelt === 2 && plan2.anzahl === 0)
  p('Quellkennung aus Name, Größe, Zeit', quellKennung(FOTOS[0]) === 'IMG_1.JPG|100|2037-12-05T18:00:00+08:00')
}

console.log('\n5  Tierwelt')
{
  p('20 Arten', ARTEN.length === 20, String(ARTEN.length))
  p('kein Wombat', !ARTEN.some((a) => /wombat/i.test(a.name)))
  p('Koala mit Hinweis Ostküste', ARTEN.find((a) => a.id === 'koala')?.hinweis === 'nur Ostküste')
  p('Ids eindeutig', new Set(ARTEN.map((a) => a.id)).size === ARTEN.length)
  const s1 = neueSichtung({ art: 'emu', anzahl: '3', ort: 'Kalbarri', notiz: 'mit Jungen' })
  p('neue Sichtung', s1.art === 'emu' && s1.anzahl === 3 && s1.id && sichtungGueltig(s1))
  const frei = neueSichtung({ art: 'xyz', name: '  Schnabeltier ' })
  p('freie Art', frei.art === 'eigen' && frei.name === 'Schnabeltier' && sichtungGueltig(frei))
  p('freie Art ohne Namen ungültig', !sichtungGueltig(neueSichtung({ name: ' ' })))
  p('artVon eigene', artVon(frei).name === 'Schnabeltier' && artVon(frei).eigen)
  let liste = mitSichtung(undefined, s1)
  liste = mitSichtung(liste, frei)
  p('hinzufügen/entfernen', liste.length === 2 && ohneSichtung(liste, s1.id).length === 1)
  const j = [
    { id: 'a', datum: '2037-12-10', ort: 'Coral Bay', sichtungen: [neueSichtung({ art: 'manta', anzahl: 2 })] },
    { id: 'b', datum: '2037-12-03', ort: 'Kalbarri', sichtungen: [s1, frei, { id: 'kaputt' }], felder: { roadside_sightings: ['🦘 Känguru', '🐄 Vieh'] } },
    { id: 'c', datum: '2037-12-12', sichtungen: [neueSichtung({ art: 'emu', ort: 'Exmouth' })] },
  ]
  const alb = album(j)
  p('gesehen: Emu, Manta, Känguru (aus Straßenrand)', alb.gesehen === 3, String(alb.gesehen))
  p('Fortschritt von 20', alb.gesamt === 20)
  p('eigene Art separat', alb.eigene.length === 1 && alb.artenGesamt === 4)
  const emu = alb.arten.find((a) => a.id === 'emu')
  p('Emu: 2 Sichtungen, 4 Tiere, erste am 3.12.', emu.anzahl === 2 && emu.tiere === 4 && emu.erste.datum === '2037-12-03')
  p('Ort fällt auf Eintragsort zurück', alb.arten.find((a) => a.id === 'manta').erste.ort === 'Coral Bay')
  p('ungültige Sichtung ignoriert', alb.sichtungen === 4)
  p('nicht gesehen: ausgegraut', alb.arten.find((a) => a.id === 'koala').gesehen === false)
  p('leeres Logbuch', album([]).gesehen === 0 && album(null).gesehen === 0)
}

console.log('\n6  Reise-Bilanz')
{
  p('Temperatur aus Freitext', temperaturAus('38 °C, schwül') === 38 && temperaturAus('ca. 41,5 Grad') === 41.5)
  p('unplausible Temperatur fällt weg', temperaturAus('Sonne, 400 km Fahrt') === null && temperaturAus('heiß') === null)
  const journal = [
    { id: '1', datum: '2037-12-01', ort: 'Perth', text: 'Ankunft', fotos: ['a', 'b'], felder: { distance_km: '35', temp_celsius: '31 °C', stimmung: 5, kosten_sprit: 80, kosten_lebensmittel: '40', waehrung: 'AUD' } },
    { id: '2', datum: '2037-12-02', ort: 'Perth → Cervantes', text: 'los', felder: { distance_km: 198.4, temp_celsius: '38,5°', stimmung: 4, kosten_unterkunft: 50, waehrung: 'EUR' } },
    { id: '3', datum: '2037-12-04', ort: 'perth ', felder: { temp_celsius: 'windig', stimmung: 3 }, sichtungen: [{ id: 's', art: 'emu', anzahl: 1 }] },
    { id: '4', datum: '2037-12-05', ort: '', text: '' },  // leer
  ]
  const kurse = { '2037-12-01': 0.6 }
  const b = berechneBilanz({ journal, wanderungen: [{ status: 'gemacht', km: '7,5', fotos: ['w'] }, { status: 'wunsch', km: 3 }], reisen: [], plan: { tage: 70 }, kurse })
  p('Reisetage aus dem Plan', b.reisetage === 70)
  p('3 Tage geschrieben (leerer zählt nicht)', b.geschrieben === 3, String(b.geschrieben))
  p('km aus Tageskilometern', b.km?.wert === 233 && b.km.quelle === 'logbuch', JSON.stringify(b.km))
  p('Tanken 80 AU$ → 48 €', b.kosten?.tank?.eur === 48 && b.kosten.tank.aud === 80, JSON.stringify(b.kosten))
  // 80 + 40 AUD zum Kurs 0,6 = 72 €; 50 EUR = 50 € → 122 €
  p('Gesamtkosten mit Währung je Tag', b.kosten.gesamt.eur === 122, JSON.stringify(b.kosten.gesamt))
  p('Fotos aus Logbuch und Wanderungen', b.fotos === 3)
  p('Wanderungen gemacht mit km', b.wanderungen?.anzahl === 1 && b.wanderungen.km === 7.5)
  p('Tiere gesehen', b.tiere?.arten === 1 && b.tiere.liste === 20)
  p('heißester Tag', b.heissesterTag?.grad === 38.5 && b.heissesterTag.datum === '2037-12-02')
  p('Lieblingsort: Strecken zählen mit, Groß/klein egal', b.lieblingsort?.name === 'Perth' && b.lieblingsort.mal === 3, JSON.stringify(b.lieblingsort))
  p('Stimmung im Schnitt', b.stimmung?.schnitt === 4 && b.stimmung.tage === 3)
  const k = bilanzKacheln(b)
  p('Kacheln in fester Reihenfolge', k[0].id === 'reisetage' && k.some((x) => x.id === 'tank') && k[k.length - 1].id === 'stimmung')
  p('Kachel Kosten mit beiden Währungen', /€$/.test(k.find((x) => x.id === 'kosten').wert) && /AU\$$/.test(k.find((x) => x.id === 'kosten').zusatz))
  p('Kachel Temperatur mit Komma', k.find((x) => x.id === 'heiss').wert === '38,5 °C')
}
{
  // Nur zeigen, was Daten hat
  const leer = berechneBilanz({})
  p('ohne Daten: leer', !bilanzHatDaten(leer) && bilanzKacheln(leer).length === 0)
  const nurPlan = berechneBilanz({ reisen: [
    { id: 'e', art: 'auto', route: { km: 1200.4 } },
    { id: 'f', art: 'flug', route: { km: 3000 } },
    { id: 'g', route: { km: 500, flug: true } },
  ] })
  p('ohne Tageskilometer: Routen-km ohne Flüge', nurPlan.km?.wert === 1200 && nurPlan.km.quelle === 'plan', JSON.stringify(nurPlan))
  p('nur km, sonst nichts', Object.keys(nurPlan).join() === 'km')
  const gleichstand = berechneBilanz({ journal: [{ datum: '2037-12-01', ort: 'A' }, { datum: '2037-12-02', ort: 'B' }] })
  p('kein Lieblingsort bei Gleichstand oder Einzelnennung', !gleichstand.lieblingsort)
  p('Reisetage ohne Plan: Spanne der Tage', gleichstand.reisetage === 2)
  const nullKosten = berechneBilanz({ journal: [{ datum: '2037-12-01', text: 'x', felder: { kosten_sprit: '', kosten_flug: 0 } }] })
  p('leere Kostenfelder: keine Kosten', !nullKosten.kosten)
}

console.log(`\n${ok} bestanden · ${bad} gescheitert`)
process.exit(bad ? 1 : 0)
