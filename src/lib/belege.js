// Reisebelege, die NUR auf diesem Gerät liegen.
//
// Warum es das gibt: Tickets, Hotelbestätigungen und Vouchers tragen Klarnamen,
// Buchungsnummern, eine Wohnanschrift und im Camper-Vertrag das Geburtsdatum einer
// zweiten Person. Auf einer im Netz erreichbaren Adresse haben sie nichts verloren.
// Also liegen sie hier: in einer eigenen Datenbank im Browser, auf dem Gerät, das
// die App benutzt. Der ausgelieferte Build bleibt leer.
//
// Eine Webseite kann NIE von sich aus in einen Ordner des Telefons schauen — das
// verbietet jeder Browser, und das ist gut so. Der Nutzer übergibt die Dateien
// einmal über die Dateiauswahl; danach gehören sie der App.
//
// Eigene Datenbank (nicht der `wa-plan`-Topf der Nutzerdaten): so braucht es keine
// Versionsanhebung an einer Stelle, an der Logbuch und Notizen liegen.
//
// Optional verschlüsselt (tresor.js): ist der Tresor eingerichtet, steht statt
// `blob` ein `verschluesselt`-Paket im Eintrag, dazu `typ`. Lesen geht dann nur entsperrt.
import { writable } from 'svelte/store'
import { zumAnzeigen } from './pdf-portfolio.js'
import { t } from './i18n.js'
import { tresorAktiv, istGesperrt, oeffentlicherSchluessel, privaterSchluessel, verschluessele, entschluessele, entsperreDann, ladeTresor } from './tresor.js'

const DB_NAME = 'wa-belege'
const STORE = 'dateien'

function openDB() {
  return new Promise((fertig, fehler) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => fertig(req.result)
    req.onerror = () => fehler(req.error)
  })
}

function tx(modus, fn) {
  return openDB().then((db) => new Promise((fertig, fehler) => {
    const t = db.transaction(STORE, modus)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => fertig(req?.result)
    t.onerror = () => fehler(t.error)
    t.onabort = () => fehler(t.error)
  }))
}

const norm = (p) => (p || '').normalize('NFC')
export const dateiName = (p) => norm(p).split('/').pop()

/**
 * Kleiner, stabiler Hash über den Pfad (djb2).
 * Wird im Build und im Browser identisch berechnet und dient nur als Schlüssel für
 * die Größentabelle — bewusst KEIN lesbarer Pfad, denn die Dateinamen selbst tragen
 * bereits Namen und Buchungsnummern und dürfen nicht mit ausgeliefert werden.
 */
export function pfadHash(pfad) {
  const s = norm(pfad)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/** Pfade der Belege, die auf DIESEM Gerät liegen. */
export const lokaleBelege = writable(new Set())
/** Belegter Speicher in Bytes. */
export const lokaleGroesse = writable(0)

export async function ladeBelegListe() {
  try {
    const db = await openDB()
    const [pfade, groessen] = await new Promise((fertig, fehler) => {
      const t = db.transaction(STORE, 'readonly')
      const os = t.objectStore(STORE)
      const k = os.getAllKeys(), v = os.getAll()
      t.oncomplete = () => fertig([k.result, v.result])
      t.onerror = () => fehler(t.error)
    })
    lokaleBelege.set(new Set(pfade))
    lokaleGroesse.set(groessen.reduce((n, e) => n + (e?.groesse || 0), 0))
    return pfade.length
  } catch { lokaleBelege.set(new Set()); return 0 }
}

/** Was in der Datenbank steht: offen oder, mit Tresor, verschlüsselt (braucht dafür kein Entsperren). */
async function eintragFuer(p, blob, zeit = Date.now()) {
  await ladeTresor()
  const e = { name: dateiName(p), groesse: blob.size, zeit }
  if (!tresorAktiv()) return { ...e, blob }
  return { ...e, typ: blob.type || '', verschluesselt: await verschluessele(oeffentlicherSchluessel(), new Uint8Array(await blob.arrayBuffer())) }
}

export async function speichereBeleg(pfad, blob) {
  const p = norm(pfad)
  const eintrag = await eintragFuer(p, blob)
  await tx('readwrite', (os) => os.put(eintrag, p))
  lokaleBelege.update((s) => new Set([...s, p]))
  lokaleGroesse.update((n) => n + blob.size)
}

/** Der Beleg als Blob, oder null (fehlt, oder gesperrt). */
export async function holeBeleg(pfad) {
  try {
    const e = await tx('readonly', (os) => os.get(norm(pfad)))
    if (!e) return null
    if (!e.verschluesselt) return e.blob || null
    const k = privaterSchluessel()
    if (!k) return null
    return new Blob([await entschluessele(k, e.verschluesselt)], { type: e.typ || '' })
  } catch { return null }
}

/**
 * Alle offenen Belege verschlüsseln (nach dem Einrichten des Tresors, und falls das einmal
 * abgebrochen wurde). Braucht nur den öffentlichen Schlüssel. Jeder Beleg einzeln: bricht es
 * ab, ist nichts halb, der Rest kommt beim nächsten Mal dran.
 * @returns { verschluesselt, offen } danach
 */
export async function verschluesseleAlleBelege(fortschritt = () => {}) {
  await ladeTresor()
  if (!tresorAktiv()) return { verschluesselt: 0, offen: 0 }
  const pfade = await tx('readonly', (os) => os.getAllKeys())
  let n = 0, schon = 0
  for (const p of pfade) {
    const e = await tx('readonly', (os) => os.get(p))
    if (!e || e.verschluesselt) { schon++; continue }
    if (e.blob) {
      const neu = await eintragFuer(p, e.blob, e.zeit)
      await tx('readwrite', (os) => os.put(neu, p))
    }
    fortschritt(++n, pfade.length - schon)
  }
  return { verschluesselt: n + schon, offen: 0 }
}

/** Alle Belege wieder offen ablegen (vor dem Aufheben der Sperre). Nur entsperrt. */
export async function entschluesseleAlleBelege(fortschritt = () => {}) {
  const k = privaterSchluessel()
  if (!k) throw new Error('gesperrt')
  const pfade = await tx('readonly', (os) => os.getAllKeys())
  let n = 0
  for (const p of pfade) {
    const e = await tx('readonly', (os) => os.get(p))
    if (!e?.verschluesselt) continue
    const blob = new Blob([await entschluessele(privaterSchluessel(), e.verschluesselt)], { type: e.typ || '' })
    const { verschluesselt, typ, ...rest } = e
    await tx('readwrite', (os) => os.put({ ...rest, blob }, p))
    fortschritt(++n)
  }
  return n
}

/** Wie viele Belege verschlüsselt und wie viele offen auf dem Gerät liegen. */
export async function belegSchutz() {
  try {
    const alle = await tx('readonly', (os) => os.getAll())
    const verschluesselt = alle.filter((e) => e?.verschluesselt).length
    return { verschluesselt, offen: alle.length - verschluesselt }
  } catch { return { verschluesselt: 0, offen: 0 } }
}

export async function loescheAlleBelege() {
  await tx('readwrite', (os) => os.clear())
  lokaleBelege.set(new Set())
  lokaleGroesse.set(0)
}

/** Einen einzelnen Beleg vom Gerät löschen (für selbst zugeordnete, die falsch hängen). */
export async function loescheBeleg(pfad) {
  const p = norm(pfad)
  let groesse = 0
  try { groesse = (await tx('readonly', (os) => os.get(p)))?.groesse || 0 } catch {}
  await tx('readwrite', (os) => os.delete(p))
  lokaleBelege.update((s) => { const n = new Set(s); n.delete(p); return n })
  lokaleGroesse.update((n) => Math.max(0, n - groesse))
}

// ---------- Selbst zugeordnete Belege ----------
//
// Nicht jede Datei passt zu einem Beleg, den der Reisekalender kennt: umbenannte
// Dateien ohne Größentabelle, Belege zu Buchungen aus einer Mail, ein Foto vom
// Ticket. Solche Dateien ordnet man in der Maske unter „Belege auf diesem Gerät“
// selbst einem Termin zu. Sie bekommen einen eigenen Pfad unter `eigen/` und hängen
// mit `eigen: true` an den `docs` des Termins (bzw. an `persoenlich`).

/** Freier Speicherpfad für eine selbst zugeordnete Datei: eigen/<Ziel>/<Name>, bei Gleichstand „Name (2).pdf“. */
export function eigenerPfad(ziel, name, belegt = new Set()) {
  const sauber = norm(name).replace(/[\/\\]/g, '-').trim() || 'Beleg'
  const punkt = sauber.lastIndexOf('.')
  const stamm = punkt > 0 ? sauber.slice(0, punkt) : sauber
  const endung = punkt > 0 ? sauber.slice(punkt) : ''
  const basis = 'eigen/' + norm(String(ziel)).replace(/[\/\\]/g, '-') + '/'
  let p = basis + sauber
  for (let i = 2; belegt.has(p); i++) p = `${basis}${stamm} (${i})${endung}`
  return p
}

/** Ein Foto oder Bildschirmfoto (Ticket abfotografiert), kein PDF. */
export const istBildDatei = (f) => /^image\//i.test(f?.type || '') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f?.name || '')

/**
 * Dateiname, wie ihn Kamera, Fotoauswahl oder Bildschirmfoto vergeben („IMG_1234.jpeg“,
 * „Bildschirmfoto 2037-12-05 um 10.15.32.png“): sagt nichts über den Beleg.
 * „Foto Qantas Ticket.jpg“ dagegen schon, der bleibt.
 */
export function kameraName(name) {
  const n = norm(name).split('/').pop() || ''
  const stamm = n.lastIndexOf('.') > 0 ? n.slice(0, n.lastIndexOf('.')) : n
  const m = stamm.match(/^(bildschirmfoto|screenshot|img|pxl|dsc[nf]?|photo|foto|image|bild)(.*)$/i)
  return !!m && /^[\s_\-\d.,()]*((at|um)[\s\d.,]*)?$/i.test(m[2])
}

/** Anzeigename aus dem Dateinamen: ohne Endung, Unterstriche als Leerzeichen. */
export function belegLabel(name) {
  const n = norm(name).split('/').pop()
  const punkt = n.lastIndexOf('.')
  return ((punkt > 0 ? n.slice(0, punkt) : n).replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || 'Beleg').slice(0, 60)
}

// Wörter, die in fast jedem Belegnamen stehen und deshalb nichts unterscheiden.
const FUELLWOERTER = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'com', 'www', 'the', 'and', 'und', 'der', 'die', 'das',
  'von', 'nach', 'for', 'your', 'ihre', 'buchung', 'buchungsbestaetigung', 'bestaetigung', 'booking', 'confirmation',
  'reservation', 'reservierung', 'ticket', 'tickets', 'eticket', 'voucher', 'rechnung', 'invoice', 'receipt', 'beleg',
  'dokument', 'document', 'scan', 'kopie', 'copy', 'check', 'mit'])
const woerter = (s) => norm(s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !FUELLWOERTER.has(w) && !/^\d{1,4}$/.test(w))
const flach = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]/g, '')

// Hinweise im Dateinamen auf die Art der Buchung (Kategorien wie in reisekalender.js → KAT).
const ART_WOERTER = {
  flight: ['flug', 'flight', 'boarding', 'boardingpass', 'airline', 'airways', 'qantas', 'emirates', 'lufthansa', 'virgin', 'jetstar'],
  train: ['zug', 'bahn', 'train', 'rail', 'ice', 'railway'],
  hotel: ['hotel', 'motel', 'resort', 'unterkunft', 'airbnb', 'hostel', 'lodge', 'apartment', 'apartments', 'bookingcom'],
  car: ['mietwagen', 'europcar', 'hertz', 'avis', 'sixt', 'budget', 'thrifty', 'rental'],
  camper: ['camper', 'wohnmobil', 'apollo', 'britz', 'maui', 'jucy', 'motorhome'],
  boat: ['faehre', 'ferry', 'boot', 'boat', 'cruise', 'schiff'],
  shuttle: ['shuttle', 'transfer', 'bus'],
  tour: ['tour', 'eintritt', 'admission'],
}

/**
 * Welcher Termin passt zu diesem Dateinamen? Gibt die Termin-ID zurück oder ''.
 *
 * Starkes Zeichen ist die Buchungsnummer im Namen, dann gemeinsame Wörter mit Titel
 * und Zusatzzeile, schwach die Art („Flug“, „Hotel“). Nur bei klarem Vorsprung gibt es
 * einen Vorschlag; Check-in und Check-out derselben Buchung zählen als einer (der frühere).
 */
export function schlageZielVor(name, events = []) {
  const n = norm(name)
  const w = new Set(woerter(n))
  const nFlach = flach(n)
  const kandidaten = []
  for (const e of events) {
    if (!e || e.platzhalter) continue
    let punkte = 0
    const ref = flach(e.ref || '')
    if (ref.length >= 4 && nFlach.includes(ref)) punkte += 10
    const text = new Set(woerter(`${e.titel || ''} ${e.sub || ''}`))
    for (const x of w) if (text.has(x)) punkte += 2
    if ((ART_WOERTER[e.kat] || []).some((x) => w.has(x))) punkte += 1
    if (punkte >= 2) kandidaten.push({ e, punkte })
  }
  if (!kandidaten.length) return ''
  kandidaten.sort((a, b) => b.punkte - a.punkte || (a.e.datum || '').localeCompare(b.e.datum || ''))
  const spitze = kandidaten.filter((k) => k.punkte === kandidaten[0].punkte)
  const erste = spitze[0].e
  const dieselbe = (e) => (erste.ref && e.ref === erste.ref) || (erste.gruppe && e.gruppe === erste.gruppe) || e.titel === erste.titel
  return spitze.every((k) => dieselbe(k.e)) ? erste.id : ''
}

/**
 * Hängt selbst zugeordnete Belege an. Rein: gibt den neuen Buchungs-Topf zurück.
 * @param topf   der Wert aus dem Store `buchungen` (darf null sein)
 * @param liste  [{ ziel: Termin-ID | 'persoenlich', label, datei }]
 * @param id     Erzeuger für IDs eigener Dokumente
 */
export function haengeBelegeAn(topf, liste, id = () => Math.random().toString(36).slice(2, 10)) {
  const basis = topf && Array.isArray(topf.events) ? topf : { stand: null, von: '', bis: '', events: [], persoenlich: [] }
  const proZiel = new Map()
  for (const x of liste || []) {
    if (!x?.datei || !x.ziel) continue
    if (!proZiel.has(x.ziel)) proZiel.set(x.ziel, [])
    proZiel.get(x.ziel).push({ label: x.label || 'Beleg', datei: norm(x.datei), art: 'doc', eigen: true })
  }
  if (!proZiel.size) return basis
  const events = basis.events.map((e) => (proZiel.has(e.id) ? { ...e, docs: [...(e.docs || []), ...proZiel.get(e.id)] } : e))
  const persoenlich = [...(basis.persoenlich || []), ...(proZiel.get('persoenlich') || []).map((d) => ({ id: 'ep-' + id(), label: d.label, datei: d.datei, eigen: true }))]
  return { ...basis, events, persoenlich, stand: new Date().toISOString() }
}

/** Nimmt einen selbst zugeordneten Beleg wieder ab (Kalender-Belege bleiben unangetastet). */
export function nimmBelegAb(topf, datei) {
  if (!topf?.events) return topf
  const p = norm(datei)
  const weg = (d) => d?.eigen && norm(d.datei) === p
  return {
    ...topf,
    events: topf.events.map((e) => ((e.docs || []).some(weg) ? { ...e, docs: e.docs.filter((d) => !weg(d)) } : e)),
    persoenlich: (topf.persoenlich || []).filter((d) => !weg(d)),
    stand: new Date().toISOString(),
  }
}

/**
 * Beim Neu-Import des Reisekalenders bleiben selbst zugeordnete Belege am Termin mit
 * derselben ID (die Kalender-App vergibt feste IDs). Rein: gibt die neuen Termine zurück.
 */
export function eigeneBelegeUebernehmen(alteEvents = [], neueEvents = []) {
  const eigene = new Map()
  for (const e of alteEvents || []) {
    const d = (e.docs || []).filter((x) => x?.eigen)
    if (d.length) eigene.set(e.id, d)
  }
  if (!eigene.size) return neueEvents
  return neueEvents.map((e) => {
    const d = eigene.get(e.id)
    if (!d) return e
    const da = new Set((e.docs || []).map((x) => norm(x.datei)))
    return { ...e, docs: [...(e.docs || []), ...d.filter((x) => !da.has(norm(x.datei)))] }
  })
}

/**
 * Ordnet ausgewählte Dateien den bekannten Belegpfaden zu.
 *
 * Der Dateiname allein genügt nicht: „Buchungsbestätigung.pdf" kommt in dieser Ablage
 * siebenmal vor, „Booking.com_ Confirmation.pdf" viermal. Innerhalb jeder Namensgruppe
 * sind die Dateigrößen aber eindeutig — deshalb entscheidet die Größe.
 *
 * Wählt man am Mac einen ganzen Ordner, liefert der Browser mit `webkitRelativePath`
 * sogar den vollen Pfad; dann braucht es die Größe gar nicht.
 *
 * Stufe 4: Passt der Name zu gar keinem Beleg — etwa in einem Sammelordner, in dem die
 * Dateien umbenannt sind, weil mehrere gleichnamige Bestätigungen nicht in einen Ordner passen —, entscheidet
 * die Größe allein. Das gilt nur, wenn GENAU EIN noch freier Beleg diese Größe hat; alle
 * 45 Belege sind verschieden groß. Grund: Die Dateiauswahl am iPhone kann nur einen Ordner
 * auf einmal markieren, die Belege lagen in 18 Unterordnern.
 *
 * @param dateien   File[] aus der Dateiauswahl
 * @param pfade     bekannte Belegpfade (aus dem importierten Reisekalender)
 * @param groessen  { pfadHash: bytes } aus dokumente/groessen.json (optional)
 */
export function ordneZu(dateien, pfade, groessen = null) {
  const bekannt = pfade.map(norm)
  const proName = new Map()
  for (const p of bekannt) {
    const n = dateiName(p)
    if (!proName.has(n)) proName.set(n, [])
    proName.get(n).push(p)
  }
  const erwarteteGroesse = (p) => (groessen ? groessen[pfadHash(p)] : undefined)

  const zugeordnet = [], unklar = [], unbekannt = []
  const schonVergeben = new Set()

  // Ordnerauswahl am Mac: der Browser liefert den vollen Pfad und stellt den
  // gewählten Ordnernamen voran. Stück für Stück abschneiden, bis ein bekannter
  // Pfad übrig bleibt.
  const ausRelativpfad = (f) => {
    const rel = norm(f.webkitRelativePath || '')
    if (!rel) return null
    const teile = rel.split('/')
    for (let i = 0; i < teile.length; i++) {
      const kand = teile.slice(i).join('/')
      if (bekannt.includes(kand) && !schonVergeben.has(kand)) return kand
    }
    return null
  }

  for (const f of dateien) {
    // 1. Voller Pfad aus der Ordnerauswahl — eindeutig, keine Größe nötig.
    const ausPfad = ausRelativpfad(f)
    if (ausPfad) {
      zugeordnet.push({ pfad: ausPfad, datei: f }); schonVergeben.add(ausPfad)
      continue
    }

    // 2. Über den Dateinamen.
    const kandidaten = (proName.get(norm(f.name)) || []).filter((p) => !schonVergeben.has(p))
    if (kandidaten.length === 0) {
      // 4. Unbekannter Name (umbenannt, Sammelordner) → nur die Größe, und nur wenn eindeutig.
      const nachGroesse = groessen
        ? bekannt.filter((p) => !schonVergeben.has(p) && erwarteteGroesse(p) === f.size)
        : []
      if (nachGroesse.length === 1) {
        zugeordnet.push({ pfad: nachGroesse[0], datei: f }); schonVergeben.add(nachGroesse[0])
      } else unbekannt.push(f)
      continue
    }
    if (kandidaten.length === 1) {
      zugeordnet.push({ pfad: kandidaten[0], datei: f }); schonVergeben.add(kandidaten[0]); continue
    }
    // 3. Mehrere gleiche Namen → die Größe entscheidet.
    const passend = kandidaten.filter((p) => erwarteteGroesse(p) === f.size)
    if (passend.length === 1) {
      zugeordnet.push({ pfad: passend[0], datei: f }); schonVergeben.add(passend[0])
    } else {
      unklar.push({ datei: f, kandidaten })
    }
  }

  const fehlend = bekannt.filter((p) => !schonVergeben.has(p))
  return { zugeordnet, unklar, unbekannt, fehlend }
}

/** Größentabelle aus dem Build holen. Fehlt sie, ist die Zuordnung nur nach Namen möglich. */
export async function ladeGroessen() {
  try {
    const r = await fetch('belege-groessen.json', { cache: 'no-cache' })
    if (!r.ok) return null
    const d = await r.json()
    return d && typeof d === 'object' ? d : null
  } catch { return null }
}

/**
 * Beleg zum Ansehen öffnen.
 *
 * ABSICHTLICH NICHT `async`. iOS Safari erlaubt `window.open` nur unmittelbar im
 * Fingertipp — liegt dazwischen ein `await` (hier das Lesen aus der Datenbank),
 * gilt es als ungefragtes Pop-up und wird blockiert. Deshalb wird das Fenster
 * SOFORT leer geöffnet und erst danach befüllt.
 *
 * Verweigert der Browser das Fenster trotzdem, öffnet der Beleg im selben Tab.
 * Zurück kommt man mit der Zurück-Taste; die Daten liegen ohnehin auf dem Gerät.
 *
 * Die Blob-Adresse wird nach einer Minute freigegeben, sonst hält der Browser
 * die ganze Datei im Speicher fest.
 */
export function oeffneBeleg(pfad) {
  // Gesperrt: erst Face ID, Touch ID oder Notfall-Code (TresorDialog), dann ein Knopf, der hierher zurückkommt
  if (istGesperrt()) { entsperreDann(() => oeffneBeleg(pfad)); return Promise.resolve(true) }
  const fenster = window.open('', '_blank')   // synchron, im Gesten-Kontext
  return holeBeleg(pfad).then(async (blob) => {
    if (!blob) { try { fenster?.close() } catch {} return false }
    // Ohne Typ ist es ein PDF aus der Kalender-Ablage; ein Foto vom Ticket behält seinen Typ.
    const datei = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: 'application/pdf' })
    zeigeImFenster(fenster, await zumAnzeigen(datei), dateiName(pfad))
    return true
  }).catch(() => { try { fenster?.close() } catch {} return false })
}

/**
 * Inhalt in das schon geöffnete Fenster bringen. Ein PDF-Portfolio (Mail aus Outlook mit Adobe
 * PDFMaker) zeigt sonst nur „bitte in Acrobat öffnen“; pdf-portfolio.js holt das eigentliche PDF
 * heraus. Stecken mehrere darin, kommt eine kleine Auswahl.
 */
export function zeigeImFenster(fenster, anzeige, titel = '') {
  const offen = fenster && !fenster.closed
  if (anzeige.art === 'datei') {
    // Nur PDF und Fotos direkt öffnen: HTML oder SVG liefe sonst als Teil der App
    const sicher = /^(application\/pdf|image\/(?!svg))/i.test(anzeige.blob.type)
    const url = URL.createObjectURL(sicher ? anzeige.blob : new Blob([anzeige.blob], { type: 'application/octet-stream' }))
    if (offen) { fenster.location = url; setTimeout(() => URL.revokeObjectURL(url), 60000) }
    else window.location.href = url          // Kein Fenster erlaubt → im selben Tab, die Seite wird verlassen
    return
  }
  const urls = anzeige.dateien.map((b) => URL.createObjectURL(b))
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titel)}</title>
    <body style="font:17px -apple-system,system-ui,sans-serif;padding:24px;max-width:560px;margin:auto;color:#2b2621;background:#fbf6ec">
    <h1 style="font-size:20px">${esc(titel)}</h1><p style="color:#5a5248">${esc(t('In diesem Beleg stecken {n} Dokumente:', { n: urls.length }))}</p>
    ${urls.map((u, i) => `<p><a href="${u}" style="display:block;padding:14px 16px;border-radius:12px;background:#8a3f16;color:#fff;text-decoration:none;font-weight:700">📄 ${esc(t('Dokument {n}', { n: i + 1 }))}</a></p>`).join('')}</body>`
  if (offen) { fenster.document.open(); fenster.document.write(html); fenster.document.close() }
  else { const u = URL.createObjectURL(new Blob([html], { type: 'text/html' })); window.location.href = u }
  setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 10 * 60000)
}
