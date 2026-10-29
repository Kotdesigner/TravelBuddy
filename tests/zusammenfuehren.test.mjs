import { fuehreZusammen, fuehreListe, vereinigeMedien, fuehreHaken, wendeGrabsteineAn, URZEIT }
  from '../src/lib/zusammenfuehren.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const T = (n) => new Date(Date.now() - n * 60000).toISOString()   // n Minuten her
const leerStand = () => ({ journal: [], wanderungen: [], eigeneOrte: [], notizen: [], dokumente: [],
  vorabKosten: [], reisen: [], checkins: [], daten: {}, packliste: { checked: {}, custom: [] },
  vorbereitung: { checked: {}, custom: [] }, grabsteine: {}, exportiert: T(0) })

console.log('\n1  Leeres Zielgerät, volle Datei')
{
  const datei = { ...leerStand(), journal: [{ id: 'a', text: 'Tag 1', geaendert: T(10) }, { id: 'b', text: 'Tag 2', geaendert: T(9) }] }
  const r = fuehreZusammen(leerStand(), datei)
  p('alles neu, nichts ergänzt', r.summe.neu === 2 && r.summe.ergaenzt === 0, JSON.stringify(r.summe))
  p('Einträge sind da', r.ergebnis.journal.length === 2)
}

console.log('\n2/3  Dieselbe Datei mehrfach importiert')
{
  const eintrag = { id: 'a', text: 'Tag', fotos: ['data:x1', 'data:x2', 'data:x3'], geaendert: T(10) }
  const datei = { ...leerStand(), journal: [eintrag] }
  let stand = leerStand()
  for (let i = 0; i < 3; i++) stand = { ...stand, ...fuehreZusammen(stand, datei).ergebnis, exportiert: T(0) }
  p('nach 3 Importen genau 1 Eintrag', stand.journal.length === 1)
  p('nach 3 Importen genau 3 Fotos, nicht 9', stand.journal[0].fotos.length === 3, String(stand.journal[0].fotos.length))
  const zweiter = fuehreZusammen(stand, datei)
  p('zweiter Lauf meldet 0 neu, 0 ergänzt', zweiter.summe.neu === 0 && zweiter.summe.ergaenzt === 0, JSON.stringify(zweiter.summe))
}

console.log('\n4  Derselbe Tag auf beiden Geräten unterschiedlich bearbeitet')
{
  const hier = { ...leerStand(), journal: [{ id: 'a', datum: '2037-12-14', text: 'Abends im Camper',
    fotos: ['data:f1', 'data:f2', 'data:f3'], felder: { stimmung: 5 }, geaendert: T(60) }] }
  const datei = { ...leerStand(), journal: [{ id: 'a', datum: '2037-12-14', text: '',
    fotos: [], felder: { kosten_sprit: 48, roadkill_counts: { 'Känguru': 2 } }, geaendert: T(10) }] }
  const r = fuehreZusammen(hier, datei)
  const e = r.ergebnis.journal[0]
  p('Text vom iPhone überlebt', e.text === 'Abends im Camper', e.text)
  p('Fotos vom iPhone überleben', e.fotos.length === 3, String(e.fotos.length))
  p('Stimmung überlebt', e.felder.stimmung === 5)
  p('Kosten vom Mac kommen dazu', e.felder.kosten_sprit === 48)
  p('Roadkill vom Mac kommt dazu', e.felder.roadkill_counts?.['Känguru'] === 2)
}

console.log('\n5  Zwei unterschiedliche, nicht-leere Texte')
{
  const hier = { ...leerStand(), journal: [{ id: 'a', text: 'Version iPhone', geaendert: T(60) }] }
  const datei = { ...leerStand(), journal: [{ id: 'a', text: 'Version Mac', geaendert: T(10) }] }
  const r = fuehreZusammen(hier, datei, { quelle: 'Mac' })
  const t = r.ergebnis.journal[0].text
  p('beide Fassungen bleiben stehen', t.includes('Version iPhone') && t.includes('Version Mac'), t)
  p('Hinweis erscheint', r.hinweise.some((h) => /nicht entscheiden/.test(h)))
  // Zurück-mergen darf nicht erneut anhängen
  const zurueck = fuehreZusammen({ ...leerStand(), journal: r.ergebnis.journal, exportiert: T(0) },
    { ...leerStand(), journal: [{ id: 'a', text: 'Version Mac', geaendert: T(10) }] })
  p('dritter Durchlauf hängt nichts erneut an',
    zurueck.ergebnis.journal[0].text === t, zurueck.ergebnis.journal[0].text)
}

console.log('\n6  Leeres Feld mit JÜNGEREM Stempel gegen gefülltes')
{
  const hier = { ...leerStand(), wanderungen: [{ id: 'w', name: 'Bluff Knoll', beschreibung: 'Steil, früh los', geaendert: T(60) }] }
  const datei = { ...leerStand(), wanderungen: [{ id: 'w', name: 'Bluff Knoll', beschreibung: '', geaendert: T(1) }] }
  const r = fuehreZusammen(hier, datei)
  p('leer schlägt nie voll', r.ergebnis.wanderungen[0].beschreibung === 'Steil, früh los')
}

console.log('\n7  Altbestand ohne Stempel')
{
  const hier = { ...leerStand(), notizen: [{ id: 'n', text: 'alter Wert', geaendert: URZEIT, herkunft: 'vor-merge' }] }
  const leerNeu = { ...leerStand(), notizen: [{ id: 'n', text: '', geaendert: T(1) }] }
  p('Altwert überlebt gegen leeren neuen Stempel',
    fuehreZusammen(hier, leerNeu).ergebnis.notizen[0].text === 'alter Wert')
  const vollNeu = { ...leerStand(), notizen: [{ id: 'n', text: 'neuer Wert', geaendert: T(1) }] }
  p('gefüllter neuer Wert gewinnt gegen Altbestand',
    fuehreZusammen(hier, vollNeu).ergebnis.notizen[0].text === 'neuer Wert')
}

console.log('\n8/9  Löschen')
{
  const hier = { ...leerStand(), journal: [], grabsteine: { journal: [{ id: 'x', ts: T(30) }] } }
  const alt = { ...leerStand(), journal: [{ id: 'x', text: 'Doppelter Tag', geaendert: T(90) }], exportiert: T(60) }
  const r = fuehreZusammen(hier, alt)
  p('gelöschter Tag kommt NICHT zurück', r.ergebnis.journal.length === 0, JSON.stringify(r.ergebnis.journal))
  p('Bericht weist die Löschung aus', r.bericht.some((b) => b.geloescht > 0))

  const spaeter = { ...leerStand(), journal: [{ id: 'x', text: 'doch weiterbearbeitet', geaendert: T(5) }] }
  p('Wiederbelebung: nach dem Löschen bearbeitet → kommt zurück',
    fuehreZusammen(hier, spaeter).ergebnis.journal.length === 1)

  const dortGeloescht = { ...leerStand(), grabsteine: { journal: [{ id: 'y', ts: T(5) }] } }
  const hierNoch = { ...leerStand(), journal: [{ id: 'y', text: 'hier noch da', geaendert: T(60) }] }
  p('Löschung vom anderen Gerät greift hier',
    fuehreZusammen(hierNoch, dortGeloescht).ergebnis.journal.length === 0)
}

console.log('\n10  Ping-Pong über drei Runden')
{
  let iphone = { ...leerStand(), journal: [{ id: 'a', text: 'A', geaendert: T(100) }] }
  let mac = { ...leerStand(), journal: [{ id: 'b', text: 'B', geaendert: T(99) }] }
  mac = { ...mac, ...fuehreZusammen(mac, iphone).ergebnis, exportiert: T(0) }         // iPhone → Mac
  mac.journal = mac.journal.filter((e) => e.id !== 'a')                                // am Mac gelöscht
  mac.grabsteine = { journal: [{ id: 'a', ts: T(50) }] }
  iphone = { ...iphone, ...fuehreZusammen(iphone, mac).ergebnis, exportiert: T(0) }   // Mac → iPhone
  p('Löschung ist angekommen', !iphone.journal.some((e) => e.id === 'a'), JSON.stringify(iphone.journal.map(e=>e.id)))
  mac = { ...mac, ...fuehreZusammen(mac, iphone).ergebnis }                            // iPhone → Mac
  p('nach 3 Runden beide gleich',
    JSON.stringify(mac.journal.map((e) => e.id).sort()) === JSON.stringify(iphone.journal.map((e) => e.id).sort()))
  p('kein Wiedergänger', !mac.journal.some((e) => e.id === 'a'))
}

console.log('\n11/12  Zeitzonen und Uhrenversatz')
{
  const hier = { ...leerStand(), journal: [{ id: 'a', datum: '2037-12-14', text: 'Perth', geaendert: T(30) }] }
  const datei = { ...leerStand(), journal: [{ id: 'b', datum: '2037-12-13', text: 'Berlin', geaendert: T(29) }] }
  const r = fuehreZusammen(hier, datei)
  p('zwei Einträge mit verschiedenem Datum bleiben getrennt', r.ergebnis.journal.length === 2)

  const zukunft = { ...leerStand(), exportiert: new Date(Date.now() + 3 * 3600000).toISOString(),
    journal: [{ id: 'a', text: 'überschreibt?', geaendert: new Date(Date.now() + 3 * 3600000).toISOString() }] }
  const r2 = fuehreZusammen(hier, zukunft)
  p('Uhrenversatz erkannt', r2.hinweise.some((h) => /Uhr/.test(h)))
  p('bei Versatz wird nichts überschrieben', r2.ergebnis.journal[0].text === 'Perth', r2.ergebnis.journal[0].text)
}

console.log('\n13/14  Haken-Karten')
{
  const hier = { ...leerStand(), packliste: { checked: { a: { an: false, ts: T(5) }, b: { an: true, ts: T(5) } }, custom: [] } }
  const alt = { ...leerStand(), packliste: { checked: { a: true, b: true, c: true }, custom: [] } }
  const r = fuehreZusammen(hier, alt)
  p('bewusst entfernter Haken bleibt entfernt', r.ergebnis.packliste.checked.a.an === false)
  p('neuer Haken vom anderen Gerät kommt dazu', r.ergebnis.packliste.checked.c?.an === true)
  const m = fuehreHaken({ x: true }, {})
  p('Migration Altformat → { an, ts }', m.karte.x.an === true && m.karte.x.ts === URZEIT)
}

console.log('\n17  Quiz wird nicht übertragen')
{
  const hier = { ...leerStand(), quizAntworten: {} }
  const datei = { ...leerStand(), quizAntworten: { f1: 2 } }
  p('Quiz bleibt unangetastet', Object.keys(fuehreZusammen(hier, datei).ergebnis.quizAntworten).length === 0)
}

console.log('\n+  Medien-Vereinigung')
{
  const a = ['data:aaa' + 'x'.repeat(300), 'data:bbb']
  p('identische Medien werden entdoppelt', vereinigeMedien(a, a).length === 2)
  p('neue kommen dazu', vereinigeMedien(a, ['data:ccc']).length === 3)
}

console.log('\n+  Startdatum und Budget (Fehler vom 18.09.: kamen NIE aus dem Backup an)')
{
  const G = { gesamtStart: '2037-12-13', reiseBudget: 0 }
  const frisch = { ...leerStand(), gesamtStart: '2037-12-13', reiseBudget: 0, exportiert: T(0) }
  const datei = { ...leerStand(), gesamtStart: '2037-11-29', reiseBudget: 20000, exportiert: T(60 * 24 * 44) }  // 44 Tage alt, ohne Stempel
  const r = fuehreZusammen(frisch, datei, { grundwerte: G })
  p('frisches Gerät übernimmt das Startdatum der Datei', r.ergebnis.gesamtStart === '2037-11-29', r.ergebnis.gesamtStart)
  p('frisches Gerät übernimmt das Budget der Datei', r.ergebnis.reiseBudget === 20000, String(r.ergebnis.reiseBudget))
  p('   und sagt es im Bericht', r.hinweise.includes('Startdatum aus der Datei übernommen: 29.11.2037')
    && r.hinweise.includes('Budget aus der Datei übernommen: 20.000 €'), r.hinweise.join(' | '))

  const hier = { ...leerStand(), gesamtStart: '2037-11-29', reiseBudget: 18000, skalarStand: { gesamtStart: T(60), reiseBudget: T(60) } }
  const juenger = { ...leerStand(), gesamtStart: '2037-11-30', reiseBudget: 21000, skalarStand: { gesamtStart: T(5), reiseBudget: T(5) } }
  const r2 = fuehreZusammen(hier, juenger, { grundwerte: G })
  p('in der Datei später geändert → Datei gewinnt (beide Werte)', r2.ergebnis.gesamtStart === '2037-11-30' && r2.ergebnis.reiseBudget === 21000)
  p('   der Stempel wandert mit', r2.ergebnis.skalarStand.gesamtStart === juenger.skalarStand.gesamtStart)
  const r3 = fuehreZusammen(juenger, hier, { grundwerte: G })
  p('hier später geändert → hier bleibt', r3.ergebnis.gesamtStart === '2037-11-30' && r3.ergebnis.reiseBudget === 21000)
  p('   mit Hinweis auf den anderen Wert (deutsch geschrieben)', r3.hinweise.some((h) => h.includes('29.11.2037')), r3.hinweise.join(' | '))

  const ohneBudget = { ...leerStand(), gesamtStart: '2037-11-29', reiseBudget: 0, skalarStand: { reiseBudget: T(1) } }
  p('Budget 0 in der Datei (= nicht gesetzt) schlägt nie ein echtes Budget',
    fuehreZusammen(hier, ohneBudget, { grundwerte: G }).ergebnis.reiseBudget === 18000)
  const altHier = { ...leerStand(), gesamtStart: '2037-11-28' }, altDort = { ...leerStand(), gesamtStart: '2037-11-29' }
  const r4 = fuehreZusammen(altHier, altDort, { grundwerte: G })
  p('beide ohne Stempel, beide gesetzt → hier bleibt, Hinweis nennt beide', r4.ergebnis.gesamtStart === '2037-11-28'
    && r4.hinweise.some((h) => h.includes('28.11.2037') && h.includes('29.11.2037')))

  const zukunft = { ...juenger, exportiert: new Date(Date.now() + 5 * 3600000).toISOString(), skalarStand: { gesamtStart: new Date(Date.now() + 5 * 3600000).toISOString() } }
  p('Uhr verstellt: gesetzter Wert hier bleibt', fuehreZusammen(hier, zukunft, { grundwerte: G }).ergebnis.gesamtStart === '2037-11-29')
  p('Uhr verstellt: leerer Wert hier wird trotzdem ergänzt', fuehreZusammen(frisch, zukunft, { grundwerte: G }).ergebnis.gesamtStart === '2037-11-30')
}

console.log('\nV5  Tierwelt, Foto-Orte und Buchungen aus Mails')
const G = { gesamtStart: null, reiseBudget: 0 }
{
  const tag = (sicht, meta, z) => ({ id: 'j20', datum: '2037-12-20', text: 'x', geaendert: T(z), sichtungen: sicht, fotoMeta: meta })
  const hier = { ...leerStand(), journal: [tag([{ id: 's1', art: 'emu' }], [{ k: 'f1', lat: 1 }], 30)] }
  const dort = { ...leerStand(), journal: [tag([{ id: 's2', art: 'kaenguru' }], [{ k: 'f2', lat: 2 }], 10)] }
  const r = fuehreZusammen(hier, dort, { grundwerte: G })
  const j = r.ergebnis.journal.find((x) => x.id === 'j20')
  p('Sichtungen von beiden Geräten bleiben', j.sichtungen.map((x) => x.id).sort().join() === 's1,s2', JSON.stringify(j.sichtungen))
  p('Foto-Orte von beiden Geräten bleiben', j.fotoMeta.map((x) => x.k).sort().join() === 'f1,f2')
  const hierGel = { ...leerStand(), journal: [tag([], [], 30)], grabsteine: { sichtungen: [{ id: 's2', ts: T(5) }] } }
  const r2 = fuehreZusammen(hierGel, dort, { grundwerte: G })
  p('hier gelöschte Sichtung kommt nicht zurück', !r2.ergebnis.journal.find((x) => x.id === 'j20').sichtungen.some((x) => x.id === 's2'))

  const ev = (id, quelle, datum = '2037-12-20') => ({ id, datum, titel: id, quelle })
  const bh = { stand: T(50), events: [ev('k1'), ev('eigenMac', 'eigen')] }
  const bd = { stand: T(5), events: [ev('k1'), ev('k2'), ev('eigenIphone', 'eigen')] }
  const r3 = fuehreZusammen({ ...leerStand(), buchungen: bh }, { ...leerStand(), buchungen: bd }, { grundwerte: G })
  const ids = r3.ergebnis.buchungen.events.map((e) => e.id).sort().join()
  p('neuerer Kalender aus der Datei und eigene Buchungen beider Geräte', ids === 'eigenIphone,eigenMac,k1,k2', ids)
  const r4 = fuehreZusammen({ ...leerStand(), buchungen: { stand: T(50), events: [ev('k1')] }, grabsteine: { buchungenEigen: [{ id: 'eigenIphone', ts: T(20) }] } },
    { ...leerStand(), buchungen: bd }, { grundwerte: G })
  p('gelöschte eigene Buchung bleibt weg', !r4.ergebnis.buchungen.events.some((e) => e.id === 'eigenIphone'))
}

console.log('\nMusik-Einstellungen (vom Mac aufs iPhone, 29.10.2037)')
{
  const { einstellungenFuerAbgleich, einstellungenAusAbgleich } = await import('../src/lib/musik/speicher.js')
  const { VORGABEN } = await import('../src/lib/musik/ablauf.js')
  const mac = { werte: { ...einstellungenFuerAbgleich(VORGABEN), titelJeOrt: 15, stile: ['techno'] }, stand: T(30) }
  const iphoneNie = { werte: einstellungenFuerAbgleich(VORGABEN), stand: null }

  const r1 = fuehreZusammen({ ...leerStand(), musikEinstellungen: iphoneNie }, { ...leerStand(), musikEinstellungen: mac })
  p('iPhone nie geändert → Einstellungen vom Mac kommen', r1.ergebnis.musikEinstellungen?.werte.titelJeOrt === 15 && r1.ergebnis.musikEinstellungen.stand === mac.stand)
  p('Vorschau zeigt eine Zeile „Musik-Einstellungen“', r1.bericht.some((b) => b.topf === 'Musik-Einstellungen' && b.ergaenzt === 1) && r1.summe.ergaenzt === 1)

  const iphoneJuenger = { werte: { ...mac.werte, titelJeOrt: 5 }, stand: T(5) }
  const r2 = fuehreZusammen({ ...leerStand(), musikEinstellungen: iphoneJuenger }, { ...leerStand(), musikEinstellungen: mac })
  p('am iPhone später geändert → iPhone bleibt', r2.ergebnis.musikEinstellungen.werte.titelJeOrt === 5 && !r2.bericht.some((b) => b.topf === 'Musik-Einstellungen'))

  const r3 = fuehreZusammen({ ...leerStand(), musikEinstellungen: mac }, { ...leerStand(), musikEinstellungen: { ...mac } })
  p('gleiche Einstellungen → keine Änderung gemeldet', r3.summe.ergaenzt === 0 && r3.ergebnis.musikEinstellungen.werte.titelJeOrt === 15)

  const r4 = fuehreZusammen({ ...leerStand(), musikEinstellungen: mac }, leerStand())
  p('ältere Datei ohne Feld → eigene bleiben', r4.ergebnis.musikEinstellungen === mac)
  const r5 = fuehreZusammen(leerStand(), { ...leerStand(), musikEinstellungen: mac })
  p('Gerät ohne Feld → die aus der Datei', r5.ergebnis.musikEinstellungen === mac)

  const zukunft = { ...leerStand(), exportiert: new Date(Date.now() + 5 * 3600e3).toISOString(), musikEinstellungen: { werte: { ...mac.werte, titelJeOrt: 30 }, stand: new Date(Date.now() + 5 * 3600e3).toISOString() } }
  p('Uhr des anderen Geräts verstellt → nichts überschrieben', fuehreZusammen({ ...leerStand(), musikEinstellungen: mac }, zukunft).ergebnis.musikEinstellungen.werte.titelJeOrt === 15)

  p('„eingeschaltet“ geht nicht ins Backup', !('aktiv' in einstellungenFuerAbgleich({ ...VORGABEN, aktiv: true })))
  const alt = { ...VORGABEN, aktiv: true }
  const neu = einstellungenAusAbgleich(alt, { aktiv: false, titelJeOrt: 12, umkreisKm: 'viel', stile: ['trance', 3], quellen: { lastfm: false, fremd: 'x' }, unbekannt: 1 })
  p('Übernahme: eigenes „eingeschaltet“ bleibt', neu.aktiv === true)
  p('Übernahme: passende Werte kommen', neu.titelJeOrt === 12 && neu.quellen.lastfm === false && neu.quellen.musicbrainz === true)
  p('Übernahme: falscher Typ und Unbekanntes bleiben draußen', neu.umkreisKm === VORGABEN.umkreisKm && !('unbekannt' in neu) && !('fremd' in neu.quellen))
  p('Übernahme: Stile nur als Text', JSON.stringify(neu.stile) === '["trance"]')
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
