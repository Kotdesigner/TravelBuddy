// Fotos fürs Tagebuch, nur auf dem Gerät: Zuordnung zu Tag und Etappe und das Speichern
// in der eigenen Datenbank (lib/tagebuch-fotos.js).
// Ausführen: node tests/tagebuch-fotos.test.mjs
//
// Alle Fotos hier sind ausgedacht (Name, Zeit, Ort, Größe), Bilddaten sind kurze Blobs.
// IndexedDB gibt es in Node nicht; unten steht ein kleiner Nachbau, der Transaktionen wie
// der Browser erst am Ende übernimmt und bei vollem Speicher alles verwirft.
import {
  planeTagebuchFotos, nachEtappeUndTag, etappeIndex, tagebuchAngaben, groesseText, speicherBedarf, nachAufnahme,
  ladeTagebuchFotos, speichereTagebuchFoto, holeTagebuchBild, loescheTagebuchFoto, loescheAlleTagebuchFotos,
  tagebuchFotos, tagebuchFotosGroesse, DB_NAME,
} from '../src/lib/tagebuch-fotos.js'
import { zusammenfassung } from '../src/lib/foto-zuordnung.js'
import { etappenMitDatum, chronik, plusTage } from '../src/lib/plan.js'
import { get } from 'svelte/store'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

// ---------------------------------------------------------------------------
// Ausgedachte Reise: zwei Etappen, die sich einen Tag überschneiden, eine Lücke, eine dritte
// ---------------------------------------------------------------------------
const REISEN = [
  { id: 'E1', typ: 'etappe', name: 'Perth und Küste', von: '2037-11-30', tage: 4, farbe: '#aa3300' },   // 30.11. bis 3.12.
  { id: 'E2', typ: 'etappe', name: 'Pinnacles', von: '2037-12-03', tage: 3 },                         // 3.12. bis 5.12.
  { id: 'E3', typ: 'etappe', name: 'Broome', von: '2037-12-10', tage: 2 },                            // 10.12. bis 11.12.
]
const ETAPPEN = etappenMitDatum(REISEN, '2037-11-30')
const ORTE = [{ id: 'fre', name: 'Fremantle', lat: -32.0569, lon: 115.7439 }, { id: 'cab', name: 'Cable Beach', lat: -17.9333, lon: 122.2083 }]

let n = 0
const foto = (name, datum, uhr = '12:00:00', mehr = {}) => ({
  id: ++n, name, groesse: 1000 + n, lastModified: 1767000000000 + n,
  datum, zeit: datum ? `${datum}T${uhr}+08:00` : null, lat: null, lon: null, ...mehr,
})

console.log('\n1  Tag und Etappe wie im Tagebuch')
{
  const fotos = [
    foto('IMG_0001.HEIC', '2037-11-20', '09:00:00'),                                    // vorher
    foto('IMG_0003.HEIC', '2037-12-01', '17:45:10', { lat: -32.05, lon: 115.75 }),     // E1, bei Fremantle
    foto('IMG_0002.HEIC', '2037-12-01', '08:10:00'),                                    // E1, früher am Tag
    foto('IMG_0004.HEIC', '2037-12-03', '10:00:00'),                                    // Überschneidung → E2
    foto('IMG_0005.HEIC', '2037-12-07', '10:00:00'),                                    // Lücke → zwischen
    foto('IMG_0006.HEIC', '2037-12-10', '18:30:00', { lat: -17.95, lon: 122.21 }),     // E3, Cable Beach
    foto('IMG_0007.HEIC', '2037-12-20', '11:00:00'),                                    // nachher
  ]
  const plan = planeTagebuchFotos(fotos, { etappen: ETAPPEN, orte: ORTE })
  const reihe = plan.gruppen.map((g) => g.id).join()
  p('Gruppen in Reihenfolge des ersten Tages', reihe === 'vorher,E1,E2,zwischen,E3,nachher', reihe)
  p('Arten wie die Kapitel', plan.gruppen.map((g) => g.art).join() === 'vorher,etappe,etappe,zwischen,etappe,nachher')
  p('Etappe hängt an der Gruppe', plan.gruppen[1].etappe?.reise?.name === 'Perth und Küste')
  const e1 = plan.gruppen.find((g) => g.id === 'E1')
  p('am selben Tag nach Uhrzeit sortiert', e1.tage[0].fotos.map((f) => f.name).join() === 'IMG_0002.HEIC,IMG_0003.HEIC')
  p('Überschneidung: Tag gehört der später beginnenden Etappe', plan.gruppen.find((g) => g.id === 'E2').tage[0].datum === '2037-12-03')
  p('nächster bekannter Ort', e1.tage[0].fotos[1].ort?.name === 'Fremantle' && plan.gruppen.find((g) => g.id === 'E3').tage[0].fotos[0].ort?.name === 'Cable Beach')
  p('ohne Koordinaten kein Ort', e1.tage[0].fotos[0].ort === null)
  p('Zahlen stimmen', plan.anzahl === 7 && plan.tageAnzahl === 6 && plan.mitOrt === 2 && plan.zumSpeichern === 7, JSON.stringify({ a: plan.anzahl, t: plan.tageAnzahl, o: plan.mitOrt }))
  p('Zusammenfassung wie beim Einsortieren', zusammenfassung(plan) === '7 Fotos · 6 Tage · 2 mit Ort', zusammenfassung(plan))
  p('Quellkennung hängt an jedem Foto', plan.gruppen.every((g) => g.tage.every((t) => t.fotos.every((f) => f.quelle && f.quelle.includes('|')))))
}

console.log('\n2  Dieselbe Regel wie chronik() für jeden Tag')
{
  const c = chronik({ eintraege: ETAPPEN })
  const proTag = new Map(c.abschnitte.flatMap((a) => a.tage.map((t) => [t.datum, a.etappe.reise.id])))
  let gleich = true, d = '2037-11-25'
  while (d <= '2037-12-15') {
    const i = etappeIndex(ETAPPEN, d)
    if ((i >= 0 ? ETAPPEN[i].reise.id : undefined) !== proTag.get(d)) { gleich = false; console.log('    abweichend:', d) }
    d = plusTage(d, 1)
  }
  p('etappeIndex = Kapitel der Chronik (25.11. bis 15.12.)', gleich)
  p('ohne Datum keine Etappe', etappeIndex(ETAPPEN, null) === -1)
  const ohne = nachEtappeUndTag([{ id: 'a', datum: '2037-12-01' }], [])
  p('ohne Etappen steht alles unter „vorher“ (wie chronik)', ohne.length === 1 && ohne[0].art === 'vorher')
}

console.log('\n3  Nichts doppelt')
{
  const a = foto('IMG_0100.HEIC', '2037-12-01', '07:00:00')
  const b = foto('IMG_0101.HEIC', '2037-12-01', '07:05:00')
  const c = foto('IMG_0102.HEIC', '2037-12-02', '09:30:15')
  const d = foto('IMG_0103.HEIC', '2037-12-02', '09:31:00')
  const vorhandene = [
    tagebuchAngaben({ ...a, tag: a.datum, quelle: `${a.name}|${a.groesse}|${a.lastModified}` }, { id: 'v1' }),
    // dasselbe Foto wie b, am Mac später noch einmal exportiert: andere Änderungszeit
    tagebuchAngaben({ ...b, tag: b.datum, lastModified: b.lastModified - 999, quelle: `${b.name}|${b.groesse}|${b.lastModified - 999}` }, { id: 'v2' }),
  ]
  // c kam unterwegs ins Logbuch: das iPhone liefert einen anderen Namen, die Aufnahmezeit ist gleich
  const journal = [{ id: 'j1', datum: '2037-12-02', fotos: ['data:image/jpeg;base64,AAAA'], fotoMeta: [{ k: 'x', quelle: 'IMG_7777.jpeg|5|6', zeit: c.zeit }] }]
  const plan = planeTagebuchFotos([a, b, c, d, { ...d, id: 99 }], { etappen: ETAPPEN, vorhandene, journal })
  p('schon im Tagebuch: gleiche Quelle und gleiche Zeit mit gleichem Namen', plan.schonDa === 3, String(plan.schonDa))
  p('schon im Logbuch: gleiche Aufnahmezeit', plan.imLogbuch === 1, String(plan.imLogbuch))
  p('übrig bleibt nur das neue Foto, einmal', plan.zumSpeichern === 1 && plan.gruppen[0].tage[0].fotos[0].name === 'IMG_0103.HEIC')
  const plan2 = planeTagebuchFotos([a, b, c, d], { etappen: ETAPPEN, ausgeschlossen: new Set([d.id, a.id]) })
  p('weggelassene Fotos fehlen', plan2.zumSpeichern === 2 && plan2.anzahl === 2)
}

console.log('\n4  Fotos ohne Aufnahmedatum')
{
  const ohne = foto('Screenshot.png', null)
  const mit = foto('IMG_0200.HEIC', '2037-12-04')
  const offen = planeTagebuchFotos([ohne, mit], { etappen: ETAPPEN })
  p('ohne gewählten Tag bleiben sie draußen', offen.offen === 1 && offen.zumSpeichern === 1 && offen.ohneDatum.length === 1)
  const gewaehlt = planeTagebuchFotos([ohne, mit], { etappen: ETAPPEN, ohneDatumTag: '2037-12-01' })
  const e1 = gewaehlt.gruppen.find((g) => g.id === 'E1')
  p('mit gewähltem Tag am richtigen Tag und in der Etappe', gewaehlt.offen === 0 && gewaehlt.zumSpeichern === 2 && e1?.tage[0].fotos[0].name === 'Screenshot.png')
  const angaben = tagebuchAngaben(e1.tage[0].fotos[0], { id: 'x1', breite: 3000, hoehe: 2000, jetzt: '2038-01-15T10:00:00.000Z' })
  p('gespeichert wird der gewählte Tag, als „ohne Datum“ markiert', angaben.datum === '2037-12-01' && angaben.ohneDatum === true && angaben.zeit === null)
}

console.log('\n5  Was zu einem Foto gespeichert wird')
{
  const f = planeTagebuchFotos([foto('IMG_0300.HEIC', '2037-12-10', '18:00:00', { lat: -17.95, lon: 122.21, file: { name: 'IMG_0300.HEIC' }, url: 'blob:x' })], { etappen: ETAPPEN, orte: ORTE }).gruppen[0].tage[0].fotos[0]
  const a = tagebuchAngaben(f, { id: 't1', breite: 3000, hoehe: 2250, jetzt: '2038-01-15T10:00:00.000Z' })
  p('Tag, Zeit, Ort, Maße und Quelle', a.datum === '2037-12-10' && a.zeit === '2037-12-10T18:00:00+08:00' && a.ort === 'Cable Beach' && a.ortId === 'cab' && a.breite === 3000 && a.quelle === f.quelle)
  p('keine Datei, keine Blob-Adresse, keine Bilddaten in den Angaben', !('file' in a) && !('url' in a) && !JSON.stringify(a).includes('blob:'))
  p('neue IDs sind verschieden', tagebuchAngaben(f).id !== tagebuchAngaben(f).id)
  p('Speichertext', groesseText(0) === '0,0 MB' && groesseText(450 * 1024) === '0,4 MB' && groesseText(212 * 1048576) === '212 MB' && groesseText(1.3 * 1024 * 1048576) === '1,3 GB',
    [groesseText(0), groesseText(450 * 1024), groesseText(212 * 1048576), groesseText(1.3 * 1024 * 1048576)].join(' | '))
  p('Speicherbedarf zählt alle Fotos', speicherBedarf([{ groesse: 10 }, { groesse: 5 }, {}, null]) === 15)
  const liste = [{ datum: '2037-12-02', zeit: '2037-12-02T08:00:00+08:00' }, { datum: '2037-12-01', zeit: null, name: 'b' }, { datum: '2037-12-01', zeit: null, name: 'a' }]
  p('Aufnahmereihenfolge', [...liste].sort(nachAufnahme).map((x) => x.name || x.datum).join() === 'a,b,2037-12-02')
}

// ---------------------------------------------------------------------------
// Nachbau von IndexedDB: genug für tagebuch-fotos.js
// ---------------------------------------------------------------------------
function baueIndexedDB() {
  const dbs = new Map()             // Name → { version, toepfe: Map(Topf → Map) }
  const geoeffnet = []
  const spaeter = (fn) => setTimeout(fn, 0)
  const nachbau = { geoeffnet, dbs, maxBytes: Infinity }
  const bytes = (toepfe) => { let s = 0; for (const m of toepfe.values()) for (const v of m.values()) s += (v?.gross?.size || 0) + (v?.klein?.size || 0); return s }
  nachbau.open = (name, version = 1) => {
    geoeffnet.push(name)
    const req = {}
    spaeter(() => {
      let d = dbs.get(name)
      const upgrade = !d || d.version < version
      if (!d) { d = { version, toepfe: new Map() }; dbs.set(name, d) }
      const db = {
        objectStoreNames: { contains: (x) => d.toepfe.has(x) },
        createObjectStore: (x) => { d.toepfe.set(x, new Map()) },
        close() {},
        transaction(namen, modus = 'readonly') {
          const liste = Array.isArray(namen) ? namen : [namen]
          for (const x of liste) if (!d.toepfe.has(x)) throw Object.assign(new Error('Topf fehlt: ' + x), { name: 'NotFoundError' })
          const arbeit = new Map(liste.map((x) => [x, new Map(d.toepfe.get(x))]))
          const offen = []
          const tx = { error: null }
          const anfrage = (fn) => { const r = {}; offen.push(() => { r.result = fn() }); return r }
          const schreibt = () => { if (modus !== 'readwrite') throw Object.assign(new Error('nur lesen'), { name: 'ReadOnlyError' }) }
          tx.objectStore = (x) => {
            if (!arbeit.has(x)) throw Object.assign(new Error('nicht in der Transaktion: ' + x), { name: 'NotFoundError' })
            const m = arbeit.get(x)
            return {
              put: (v, k) => { schreibt(); return anfrage(() => { m.set(k, v); return k }) },
              get: (k) => anfrage(() => m.get(k)),
              getAll: () => anfrage(() => [...m.values()]),
              delete: (k) => { schreibt(); return anfrage(() => { m.delete(k) }) },
              clear: () => { schreibt(); return anfrage(() => { m.clear() }) },
            }
          }
          spaeter(() => {
            for (const a of offen) a()
            if (modus === 'readwrite') {
              const probe = new Map(d.toepfe); for (const [x, m] of arbeit) probe.set(x, m)
              if (bytes(probe) > nachbau.maxBytes) {
                tx.error = Object.assign(new Error('Speicher voll'), { name: 'QuotaExceededError' })
                tx.onabort?.()
                return
              }
              for (const [x, m] of arbeit) d.toepfe.set(x, m)
            }
            tx.oncomplete?.()
          })
          return tx
        },
      }
      req.result = db
      if (upgrade) { d.version = version; req.onupgradeneeded?.() }
      req.onsuccess?.()
    })
    return req
  }
  return nachbau
}

const idb = baueIndexedDB()
globalThis.indexedDB = idb
const blob = (zeichen, laenge) => new Blob([zeichen.repeat(laenge)], { type: 'image/jpeg' })

console.log('\n6  Speichern in der eigenen Datenbank')
{
  p('leer am Anfang', (await ladeTagebuchFotos()).length === 0 && get(tagebuchFotos).length === 0)
  const plan = planeTagebuchFotos([
    foto('IMG_0402.HEIC', '2037-12-04', '16:00:00'),
    foto('IMG_0401.HEIC', '2037-12-01', '09:00:00', { lat: -32.05, lon: 115.75 }),
    foto('IMG_0403.HEIC', '2037-12-04', '07:30:00'),
  ], { etappen: ETAPPEN, orte: ORTE })
  const zuSpeichern = plan.gruppen.flatMap((g) => g.tage.flatMap((t) => t.fotos))
  const ids = []
  for (const [i, f] of zuSpeichern.entries()) {
    const a = await speichereTagebuchFoto(tagebuchAngaben(f, { breite: 3000, hoehe: 2000 }), { gross: blob('G', 3000 + i), klein: blob('k', 200) })
    ids.push(a.id)
  }
  p('drei Fotos im Store, in Aufnahmereihenfolge', get(tagebuchFotos).map((f) => f.name).join() === 'IMG_0401.HEIC,IMG_0403.HEIC,IMG_0402.HEIC', get(tagebuchFotos).map((f) => f.name).join())
  p('Größe = volle Fassung + Vorschau', get(tagebuchFotos)[0].groesse === 3200 && get(tagebuchFotosGroesse) === 3000 + 3001 + 3002 + 600, String(get(tagebuchFotosGroesse)))
  tagebuchFotos.set([])
  const neu = await ladeTagebuchFotos()
  p('nach dem Neuladen aus der Datenbank dieselben drei', neu.length === 3 && neu[0].ort === 'Fremantle' && neu.every((f) => f.breite === 3000))
  p('Angaben ohne Bilddaten (Liste lädt schnell)', neu.every((f) => !('gross' in f) && !('klein' in f) && !('blob' in f)))
  const g = await holeTagebuchBild(ids[0], 'gross'), k = await holeTagebuchBild(ids[0], 'klein')
  p('volle Fassung und Vorschau getrennt abrufbar', g?.size === 3000 && k?.size === 200 && (await g.text()).startsWith('GGG'))
  p('unbekanntes Foto: null statt Fehler', (await holeTagebuchBild('gibts-nicht')) === null)
  p('dasselbe Foto erneut gespeichert ersetzt statt verdoppelt', await (async () => {
    const a = neu[0]
    await speichereTagebuchFoto({ ...a }, { gross: blob('H', 10), klein: blob('h', 5) })
    return get(tagebuchFotos).length === 3 && (await holeTagebuchBild(a.id))?.size === 10
  })())
  p('beim Import still: Store erst nach ladeTagebuchFotos', await (async () => {
    const a = tagebuchAngaben(zuSpeichern[0], { id: 'still-1' })
    await speichereTagebuchFoto(a, { gross: blob('S', 50), klein: blob('s', 5) }, { melden: false })
    const vorher = get(tagebuchFotos).some((f) => f.id === 'still-1')
    const nachher = (await ladeTagebuchFotos()).some((f) => f.id === 'still-1')
    await loescheTagebuchFoto('still-1')
    return !vorher && nachher && get(tagebuchFotos).length === 3
  })())
  const nachDemTest = idb.dbs.get(DB_NAME).toepfe
  p('Angaben und Bilder liegen in getrennten Töpfen', nachDemTest.get('fotos').size === 3 && nachDemTest.get('bilder').size === 3)

  console.log('\n7  Entfernen')
  await loescheTagebuchFoto(ids[1])
  p('einzeln entfernt: aus Store und beiden Töpfen', get(tagebuchFotos).length === 2 && !get(tagebuchFotos).some((f) => f.id === ids[1])
    && !idb.dbs.get(DB_NAME).toepfe.get('bilder').has(ids[1]) && !idb.dbs.get(DB_NAME).toepfe.get('fotos').has(ids[1]))
  p('Bild des entfernten Fotos ist weg', (await holeTagebuchBild(ids[1])) === null)
  await loescheAlleTagebuchFotos()
  p('alle gelöscht', get(tagebuchFotos).length === 0 && get(tagebuchFotosGroesse) === 0 && (await ladeTagebuchFotos()).length === 0
    && idb.dbs.get(DB_NAME).toepfe.get('bilder').size === 0)

  console.log('\n8  Speicher voll')
  idb.maxBytes = 5000
  const f = plan.gruppen[0].tage[0].fotos[0]
  await speichereTagebuchFoto(tagebuchAngaben(f), { gross: blob('A', 3000), klein: blob('a', 100) })
  let fehler = null
  try { await speichereTagebuchFoto(tagebuchAngaben(f), { gross: blob('B', 3000), klein: blob('b', 100) }) } catch (e) { fehler = e }
  p('zu groß: Fehler QuotaExceededError', fehler?.name === 'QuotaExceededError', String(fehler?.name))
  const t = idb.dbs.get(DB_NAME).toepfe
  p('nichts halb gespeichert: keine Angaben ohne Bild', t.get('fotos').size === 1 && t.get('bilder').size === 1 && get(tagebuchFotos).length === 1)
  idb.maxBytes = Infinity
  await loescheAlleTagebuchFotos()
  p('ohne Vollbild wird nichts gespeichert', await speichereTagebuchFoto(tagebuchAngaben(f), {}).then(() => false, () => true))

  console.log('\n9  Nicht im Backup')
  p(`nur die eigene Datenbank „${DB_NAME}“ geöffnet`, idb.geoeffnet.length > 0 && idb.geoeffnet.every((x) => x === DB_NAME), [...new Set(idb.geoeffnet)].join())
  p('der Topf der Nutzerdaten (wa-plan) bleibt unberührt', !idb.dbs.has('wa-plan'))
  const fs = await import('node:fs')
  const ud = fs.readFileSync(new URL('../src/lib/userdata.js', import.meta.url), 'utf8')
  const backup = ud.slice(ud.indexOf('function baueBackupPayload'), ud.indexOf('// Aktueller Datenumfang'))
  p('baueBackupPayload kennt die Tagebuch-Fotos nicht', backup.length > 100 && !/tagebuch-?fotos|tagebuchFotos/i.test(backup) && !/tagebuch-fotos/.test(ud))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
