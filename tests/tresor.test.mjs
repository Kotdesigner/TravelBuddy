// Tresor für die Belege: Notfall-Code, Schlüssel, Verschlüsseln, Entsperren (lib/tresor.js) und
// das Zusammenspiel mit dem Belege-Speicher (lib/belege.js).
// Ausführen: node tests/tresor.test.mjs
//
// Face ID und Touch ID selbst lassen sich hier nicht prüfen; der Passkey liefert dem Tresor nur
// 32 Bytes (PRF), die hier ausgedacht sind. Alle Belege sind ausgedachte Bytes.
import fs from 'node:fs'
import { get } from 'svelte/store'

// ---------------------------------------------------------------------------
// Nachbau von IndexedDB (genug für belege.js und tresor.js)
// ---------------------------------------------------------------------------
const dbs = new Map(), geoeffnet = []
const spaeter = (fn) => setTimeout(fn, 0)
globalThis.indexedDB = {
  open(name, version = 1) {
    geoeffnet.push(name)
    const req = {}
    spaeter(() => {
      let d = dbs.get(name)
      const upgrade = !d || d.version < version
      if (!d) { d = { version, toepfe: new Map() }; dbs.set(name, d) }
      req.result = {
        objectStoreNames: { contains: (x) => d.toepfe.has(x) },
        createObjectStore: (x) => d.toepfe.set(x, new Map()),
        close() {},
        transaction(namen, modus = 'readonly') {
          const liste = Array.isArray(namen) ? namen : [namen]
          const arbeit = new Map(liste.map((x) => [x, new Map(d.toepfe.get(x))]))
          const offen = [], tx = {}
          const anfrage = (fn) => { const r = {}; offen.push(() => { r.result = fn(); r.onsuccess?.() }); return r }
          const schreibt = () => { if (modus !== 'readwrite') throw Object.assign(new Error('nur lesen'), { name: 'ReadOnlyError' }) }
          tx.objectStore = (x) => {
            const m = arbeit.get(x)
            return {
              put: (v, k) => { schreibt(); return anfrage(() => { m.set(k, v); return k }) },
              get: (k) => anfrage(() => m.get(k)),
              getAll: () => anfrage(() => [...m.values()]),
              getAllKeys: () => anfrage(() => [...m.keys()]),
              delete: (k) => { schreibt(); return anfrage(() => { m.delete(k) }) },
              clear: () => { schreibt(); return anfrage(() => { m.clear() }) },
            }
          }
          spaeter(() => {
            for (const a of offen) a()
            if (modus === 'readwrite') for (const [x, m] of arbeit) d.toepfe.set(x, m)
            tx.oncomplete?.()
          })
          return tx
        },
      }
      if (upgrade) { d.version = version; req.onupgradeneeded?.() }
      req.onsuccess?.()
    })
    return req
  },
}

const T = await import('../src/lib/tresor.js')
const B = await import('../src/lib/belege.js')

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const wirft = async (fn) => { try { await fn(); return null } catch (e) { return e } }
const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const bytesVon = async (blob) => new Uint8Array(await blob.arrayBuffer())
const SCHNELL = 1000   // PBKDF2-Runden in den Tests (echt: 600 000, einmal unten geprüft)

console.log('\n1  Notfall-Code')
{
  const codes = Array.from({ length: 50 }, () => T.erzeugeCode())
  p('Form XXXX-XXXX-XXXX-XXXX', codes.every((c) => /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(c)), codes[0])
  p('nichts zum Verwechseln (I, O, 0, 1)', codes.every((c) => !/[IO01]/.test(c)))
  p('jedes Mal ein anderer', new Set(codes).size === 50)
  p('Eingabe: klein, mit Leerzeichen oder ohne Striche zählt gleich', T.normCode(' k7qm 2xpa-ab cd-efgh ') === 'K7QM2XPAABCDEFGH')
  p('vollständig erst mit 16 gültigen Zeichen', T.codeVollstaendig(codes[0]) && !T.codeVollstaendig('ABCD-EFGH') && !T.codeVollstaendig('ABCD-EFGH-IJKL-MNO1'))
}

console.log('\n2  Schlüssel')
const CODE = T.erzeugeCode()
const PRF = crypto.getRandomValues(new Uint8Array(32))
{
  const t0 = Date.now()
  const { datensatz: echt } = await T.neuerTresor({ code: CODE })
  const k = await T.oeffneMitCode(echt, CODE.toLowerCase())
  p(`echte Rundenzahl ${T.ITERATIONEN}, öffnet mit dem Code (${Date.now() - t0} ms)`, echt.iterationen === T.ITERATIONEN && k?.type === 'private')
  const { datensatz: d } = await T.neuerTresor({ code: CODE, prf: PRF, credId: new Uint8Array([1, 2, 3]), prfSalz: new Uint8Array(32), iterationen: SCHNELL })
  p('mit Passkey: öffnet auch mit dem Passkey-Geheimnis', (await T.oeffneMitPrf(d, PRF))?.type === 'private')
  const falsch = await wirft(() => T.oeffneMitCode(d, T.erzeugeCode()))
  p('falscher Code: klare Meldung', falsch?.name === 'FalscherSchluessel' && /Code stimmt nicht/.test(falsch.message))
  p('falsches Passkey-Geheimnis öffnet nicht', !!(await wirft(() => T.oeffneMitPrf(d, crypto.getRandomValues(new Uint8Array(32))))))
  const { datensatz: nurCode } = await T.neuerTresor({ code: CODE, iterationen: SCHNELL })
  p('ohne Passkey: nur der Code', nurCode.privPrf === null && !!(await wirft(() => T.oeffneMitPrf(nurCode, PRF))))
  p('unvollständiger Code wird abgelehnt', !!(await wirft(() => T.neuerTresor({ code: 'ABCD' }))))
  p('der private Schlüssel ist nicht exportierbar', k.extractable === false)
  p('im Datensatz liegt der private Schlüssel nur verschlüsselt', Object.keys(d).sort().join() === 'angelegt,codeSalz,credId,iterationen,prfSalz,privCode,privPrf,pub,version')
}

console.log('\n3  Ein Beleg')
{
  const { datensatz: d, privat } = await T.neuerTresor({ code: CODE, iterationen: SCHNELL })
  const original = new Uint8Array(300000)
  for (let i = 0; i < original.length; i += 65536) crypto.getRandomValues(original.subarray(i, i + 65536))
  const a = await T.verschluessele(d.pub, original), b2 = await T.verschluessele(d.pub, original)
  p('verschlüsselt und wieder lesbar', gleich(await T.entschluessele(privat, a), original))
  p('jedes Mal anders verschlüsselt (eigener Schlüssel je Beleg)', !gleich(a.daten, b2.daten) && !gleich(a.epk, b2.epk))
  const kaputt = { ...a, daten: Uint8Array.from(a.daten) }; kaputt.daten[100] ^= 1
  p('ein verändertes Byte fällt auf', !!(await wirft(() => T.entschluessele(privat, kaputt))))
  const { privat: fremd } = await T.neuerTresor({ code: T.erzeugeCode(), iterationen: SCHNELL })
  p('ein anderer Tresor kann es nicht lesen', !!(await wirft(() => T.entschluessele(fremd, a))))
  const roh = Buffer.from(a.daten)
  p('kein Klartext im verschlüsselten Paket', roh.indexOf(Buffer.from(original.subarray(5000, 5032))) < 0)
}

console.log('\n4  Belege auf dem Gerät verschlüsseln')
const blob = (text, typ = 'application/pdf') => new Blob([text], { type: typ })
{
  await B.speichereBeleg('Flug/Ticket.pdf', blob('%PDF Ticket Perth'))
  await B.speichereBeleg('eigen/x/IMG_1.jpeg', blob('JPEG Foto', 'image/jpeg'))
  p('ohne Tresor: offen gespeichert', (await B.belegSchutz()).offen === 2 && (await (await B.holeBeleg('Flug/Ticket.pdf')).text()) === '%PDF Ticket Perth')
  p('kein Tresor, nichts gesperrt', !T.tresorAktiv() && !T.istGesperrt())

  await T.richteEin({ code: CODE, iterationen: SCHNELL })
  p('eingerichtet und gleich entsperrt', T.tresorAktiv() && !T.istGesperrt() && get(T.tresor).aktiv && get(T.tresor).entsperrt && !get(T.tresor).passkey)
  let schritte = 0
  const r = await B.verschluesseleAlleBelege(() => schritte++)
  const roh = dbs.get('wa-belege').toepfe.get('dateien')
  const e = roh.get('Flug/Ticket.pdf')
  p('alle vorhandenen Belege verschlüsselt', r.verschluesselt === 2 && schritte === 2 && (await B.belegSchutz()).offen === 0)
  p('in der Datenbank kein Blob und kein Klartext mehr', !e.blob && !!e.verschluesselt && !Buffer.from(e.verschluesselt.daten).includes('Ticket Perth') && e.typ === 'application/pdf')
  p('Name und Größe bleiben für die Anzeige', e.name === 'Ticket.pdf' && e.groesse === 17)
  p('zweiter Lauf ändert nichts', (await B.verschluesseleAlleBelege()).verschluesselt === 2)

  T.sperre()
  p('gesperrt: kein Beleg lesbar', T.istGesperrt() && (await B.holeBeleg('Flug/Ticket.pdf')) === null && !get(T.tresor).entsperrt)
  await B.speichereBeleg('Hotel/Neu.pdf', blob('%PDF Hotel'))
  p('neue Belege gehen auch gesperrt hinein, gleich verschlüsselt', !!roh && !!dbs.get('wa-belege').toepfe.get('dateien').get('Hotel/Neu.pdf').verschluesselt)

  // Entsperren mit dem Code über den Dialog-Ablauf
  let geoeffnet = 0
  T.entsperreDann(() => geoeffnet++)
  p('gesperrt: Dialog fragt nach dem Code (kein Passkey eingerichtet)', get(T.tresorAnfrage)?.zustand === 'code' && geoeffnet === 0)
  p('falscher Code: Meldung, bleibt zu', !(await T.codeEingeben(T.erzeugeCode())) && /stimmt nicht/.test(get(T.tresorAnfrage).fehler) && T.istGesperrt())
  p('richtiger Code: entsperrt, Knopf „Beleg öffnen“', (await T.codeEingeben(CODE)) && get(T.tresorAnfrage).zustand === 'bereit' && get(T.tresorAnfrage).knopf === 'Beleg öffnen' && geoeffnet === 0)
  T.weiter()
  p('der Knopf öffnet (neuer Fingertipp)', geoeffnet === 1 && get(T.tresorAnfrage) === null)
  p('entsperrt: alle Belege wieder lesbar, mit Typ', (await (await B.holeBeleg('Flug/Ticket.pdf')).text()) === '%PDF Ticket Perth'
    && (await B.holeBeleg('eigen/x/IMG_1.jpeg')).type === 'image/jpeg' && (await (await B.holeBeleg('Hotel/Neu.pdf')).text()) === '%PDF Hotel')
  T.entsperreDann(() => geoeffnet++)
  p('entsperrt: kein Dialog, sofort', geoeffnet === 2 && get(T.tresorAnfrage) === null)
  T.sperre()
  T.entsperreDann(() => geoeffnet++, { sofort: true })
  await T.codeEingeben(CODE)
  p('„sofort“: nach dem Code ohne zweiten Knopf weiter', geoeffnet === 3 && get(T.tresorAnfrage) === null)
  T.sperre()
  T.entsperreDann(() => geoeffnet++)
  T.abbrechen()
  p('abbrechen: nichts geöffnet, bleibt zu', geoeffnet === 3 && T.istGesperrt())

  console.log('\n5  Schutz aufheben')
  p('gesperrt lässt sich nichts entschlüsseln', !!(await wirft(() => B.entschluesseleAlleBelege())))
  await T.entsperreMitCode(CODE)
  const n = await B.entschluesseleAlleBelege()
  await T.entferneTresor()
  p('alle Belege wieder offen, Tresor weg', n === 3 && (await B.belegSchutz()).verschluesselt === 0 && !T.tresorAktiv() && !dbs.get('wa-tresor').toepfe.get('kv').size)
  p('Inhalt unverändert', (await (await B.holeBeleg('Hotel/Neu.pdf')).text()) === '%PDF Hotel' && (await B.holeBeleg('eigen/x/IMG_1.jpeg')).type === 'image/jpeg')
}

console.log('\n6  Mit Passkey')
{
  await T.richteEin({ code: CODE, prf: PRF, passkey: { credId: new Uint8Array([9, 9]), prfSalz: new Uint8Array(32) }, iterationen: SCHNELL })
  await B.verschluesseleAlleBelege()
  T.sperre()
  p('Zustand: Passkey eingerichtet', get(T.tresor).passkey && T.istGesperrt())
  // Im Browser holt passkeyPrf das Geheimnis per Face ID; hier steht navigator.credentials still
  globalThis.navigator ??= {}
  let gefragt = null
  Object.defineProperty(globalThis.navigator, 'credentials', { configurable: true, value: { get: (o) => { gefragt = o; return Promise.resolve({ getClientExtensionResults: () => ({ prf: { results: { first: PRF.buffer } } }) }) } } })
  let auf = 0
  T.entsperreDann(() => auf++)
  p('beim Antippen startet Face ID sofort, im selben Fingertipp', get(T.tresorAnfrage)?.zustand === 'passkey' && !!gefragt)
  p('Face ID wird verlangt, nur dieser Passkey, mit PRF', gefragt.publicKey.userVerification === 'required' && gefragt.publicKey.allowCredentials[0].id.join() === '9,9' && !!gefragt.publicKey.extensions.prf.eval.first)
  await new Promise((r) => setTimeout(r, 30))
  p('nach Face ID: entsperrt, Knopf zum Öffnen', get(T.tresorAnfrage)?.zustand === 'bereit' && !T.istGesperrt())
  T.weiter()
  p('öffnet nach dem Knopf', auf === 1)
  T.sperre()
  Object.defineProperty(globalThis.navigator, 'credentials', { configurable: true, value: { get: () => Promise.reject(Object.assign(new Error('abgebrochen'), { name: 'NotAllowedError' })) } })
  T.entsperreDann(() => auf++)
  await new Promise((r) => setTimeout(r, 30))
  p('Face ID abgebrochen: Wahl zwischen nochmal und Notfall-Code, ohne Fehlertext', get(T.tresorAnfrage)?.zustand === 'wahl' && get(T.tresorAnfrage).fehler === '' && auf === 1)
  T.tresorAnfrage.update((a) => ({ ...a, zustand: 'code' }))
  await T.codeEingeben(CODE)
  T.weiter()
  p('Notfall-Code geht immer, auch mit Passkey', auf === 2)
}

console.log('\n7  Nicht im Backup, nichts nach außen')
{
  p('nur die Datenbanken wa-belege und wa-tresor', [...new Set(geoeffnet)].sort().join() === 'wa-belege,wa-tresor', [...new Set(geoeffnet)].join())
  const ud = fs.readFileSync(new URL('../src/lib/userdata.js', import.meta.url), 'utf8')
  p('das Backup kennt den Tresor nicht', !/tresor/i.test(ud))
  const quelle = fs.readFileSync(new URL('../src/lib/tresor.js', import.meta.url), 'utf8')
  p('kein Netz: kein fetch, kein XMLHttpRequest im Tresor', !/fetch\(|XMLHttpRequest|sendBeacon/.test(quelle))
  p('Code und Schlüssel nie in localStorage', !/localStorage/.test(quelle))
}

console.log(`\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
