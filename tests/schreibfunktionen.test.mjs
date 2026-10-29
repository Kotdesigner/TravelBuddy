// Ruft die ECHTEN Schreibfunktionen aus userdata.js auf und prüft, dass jede Änderung
// einen Zeitstempel bzw. Grabstein hinterlässt — sonst kommt sie beim Zusammenführen
// zweier Geräte nicht zuverlässig an. (Die Regeltests in zusammenfuehren.test.mjs setzen
// Stempel von Hand; die Lücken in den Schreibfunktionen fanden sie deshalb nicht.)
// Ausführen: node tests/schreibfunktionen.test.mjs
import { get } from 'svelte/store'
import * as ud from '../src/lib/userdata.js'
import { fuehreZusammen } from '../src/lib/zusammenfuehren.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms))
const ALT = '2026-01-01T00:00:00.000Z'

console.log('\n1  Logbuch-Feld (setJournalFeld)')
{
  ud.journal.set([{ id: 'j1', datum: '2037-12-20', felder: { kosten_diesel: 84 }, geaendert: ALT }])
  ud.setJournalFeld('j1', 'kosten_diesel', 48)
  const e = get(ud.journal)[0]
  p('Wert geändert', e.felder.kosten_diesel === 48)
  p('Stempel erneuert', e.geaendert > ALT, e.geaendert)
  // Gegenprobe über das Zusammenführen: die Korrektur gewinnt gegen den alten Stand
  const anderes = { journal: [{ id: 'j1', datum: '2037-12-20', felder: { kosten_diesel: 84 }, geaendert: ALT }] }
  const r = fuehreZusammen(anderes, { journal: get(ud.journal), exportiert: new Date().toISOString() })
  p('Korrektur 48 statt 84 kommt auf dem anderen Gerät an', r.ergebnis.journal[0].felder.kosten_diesel === 48,
    JSON.stringify(r.ergebnis.journal[0].felder))
}

console.log('\n2  „+ zu Reise" (stopHinzufuegen)')
{
  ud.reisen.set([{ id: 'r1', name: 'Nord 3', stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }], geaendert: ALT }])
  ud.stopHinzufuegen('r1', { name: 'Kalbarri', lat: -27.71, lon: 114.16 })
  const r = get(ud.reisen)[0]
  p('Stopp angehängt', r.stops.length === 2 && r.stops[1].name === 'Kalbarri')
  p('Stempel erneuert', r.geaendert > ALT, r.geaendert)
}

console.log('\n3  Haken abwählen (togglePack / toggleVorb)')
{
  ud.packliste.set({ checked: { pass: true }, custom: [] })
  ud.togglePack('pass')
  const h = get(ud.packliste).checked.pass
  p('Abwählen schreibt { an: false, ts }', h && h.an === false && !!h.ts, JSON.stringify(h))
  p('istAn liest es als „aus"', ud.istAn(h) === false)
  ud.togglePack('pass')
  p('wieder anwählen → an', ud.istAn(get(ud.packliste).checked.pass) === true)
  p('istAn versteht das alte Format true', ud.istAn(true) === true && ud.istAn(undefined) === false)

  ud.vorbereitung.set({ checked: { flug: true }, custom: [] })
  ud.toggleVorb('flug')
  const aus = get(ud.vorbereitung).checked
  const anderes = { vorbereitung: { checked: { flug: { an: true, ts: ALT } }, custom: [] } }
  const r = fuehreZusammen(anderes, { vorbereitung: { checked: aus, custom: [] }, exportiert: new Date().toISOString() })
  p('abgewählter Haken überträgt sich aufs andere Gerät', r.ergebnis.vorbereitung.checked.flug.an === false,
    JSON.stringify(r.ergebnis.vorbereitung.checked.flug))

  ud.packliste.set({ checked: { a: true, b: { an: true, ts: ALT } }, custom: [] })
  ud.packZuruecksetzen()
  const z = get(ud.packliste).checked
  p('„Zurücksetzen" setzt alle ausdrücklich aus (statt zu leeren)', !ud.istAn(z.a) && !ud.istAn(z.b) && !!z.a.ts)
}

console.log('\n4  Eigene Listeneinträge löschen (Grabsteine)')
{
  ud.grabsteine.set({})
  ud.packliste.set({ checked: {}, custom: [] })
  ud.addPackItem('kleidung', 'TEST Hut')
  const it = get(ud.packliste).custom[0]
  p('neuer Eintrag hat einen Stempel', !!it.geaendert)
  ud.delPackItem(it.id)
  p('Löschen hinterlässt Grabstein', (get(ud.grabsteine).packCustom || []).some((g) => g.id === it.id))
  const anderes = { packliste: { checked: {}, custom: [it] } }
  const r = fuehreZusammen(anderes, { packliste: get(ud.packliste), grabsteine: get(ud.grabsteine), exportiert: new Date().toISOString() })
  p('gelöschter Eintrag verschwindet auch auf dem anderen Gerät', r.ergebnis.packliste.custom.length === 0,
    JSON.stringify(r.ergebnis.packliste.custom))
  const zurueck = fuehreZusammen({ packliste: get(ud.packliste), grabsteine: get(ud.grabsteine) }, { ...anderes, exportiert: new Date().toISOString() })
  p('… und kommt von dort nicht zurück', zurueck.ergebnis.packliste.custom.length === 0)

  ud.vorbereitung.set({ checked: {}, custom: [] })
  ud.addVorbItem('TEST Adapter')
  const v = get(ud.vorbereitung).custom[0]
  ud.delVorbItem(v.id)
  p('Vorbereitung: Löschen hinterlässt Grabstein', (get(ud.grabsteine).vorbCustom || []).some((g) => g.id === v.id))

  ud.checkins.set([{ id: 'c1', ts: ALT }])
  ud.loescheCheckin('c1')
  p('Check-in löschen hinterlässt Grabstein', (get(ud.grabsteine).checkins || []).some((g) => g.id === 'c1'))
}

console.log('\n5  Die übrigen Schreibfunktionen (Stichprobe)')
{
  const pruefe = async (name, store, id, fn) => {
    const vorher = get(store).find((x) => x.id === id)?.geaendert || ''
    await warte(3)
    fn()
    const nachher = get(store).find((x) => x.id === id)?.geaendert || ''
    p(name, nachher > vorher, `${vorher} → ${nachher}`)
  }
  ud.reisen.set([{ id: 'r2', name: 'X', stops: [], geaendert: ALT }])
  await pruefe('updateReise stempelt', ud.reisen, 'r2', () => ud.updateReise('r2', { name: 'Y' }))
  ud.wanderungen.set([{ id: 'w1', name: 'W', geaendert: ALT }])
  await pruefe('updateWanderung stempelt', ud.wanderungen, 'w1', () => ud.updateWanderung('w1', { datum: '2037-12-20' }))
  ud.journal.set([{ id: 'j2', felder: {}, geaendert: ALT }])
  await pruefe('updateJournalEintrag stempelt', ud.journal, 'j2', () => ud.updateJournalEintrag('j2', { text: 'x' }))
  ud.notizen.set([{ id: 'n1', text: 'a', geaendert: ALT }])
  await pruefe('updateNotiz stempelt', ud.notizen, 'n1', () => ud.updateNotiz('n1', { text: 'b' }))
  ud.eigeneOrte.set([{ id: 'o1', name: 'O', geaendert: ALT }])
  await pruefe('updateEigenenOrt stempelt', ud.eigeneOrte, 'o1', () => ud.updateEigenenOrt('o1', { name: 'P' }))
  ud.vorabKosten.set([{ id: 'k1', betrag: 1, geaendert: ALT }])
  await pruefe('updateVorabKosten stempelt', ud.vorabKosten, 'k1', () => ud.updateVorabKosten('k1', { betrag: 2 }))
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
