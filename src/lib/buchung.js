// Eine Buchung = Termine (z. B. Check-in und Check-out) + Kosten + Belege + Buchungsnummer.
// Termine liegen weiter in `buchungen.events`, Kosten in `vorabKosten`. Verbunden sind sie über
// `terminId` an der Ausgabe. Hier wird daraus eine Ansicht, und vorhandene Ausgaben werden ihren
// Terminen zugeordnet.
import { etappeAm } from './plan.js'

/** Kostenart passend zur Art des Termins. */
export const KOSTEN_FUER = {
  hotel: 'kosten_unterkunft', stay: 'kosten_unterkunft', flight: 'kosten_flug', train: 'kosten_bahn',
  shuttle: 'kosten_bus', boat: 'kosten_boot', car: 'kosten_mietfahrzeug', camper: 'kosten_mietfahrzeug', tour: 'kosten_attraktion',
}
export const PASST = { kosten_unterkunft: ['hotel', 'stay', 'city'], kosten_flug: ['flight'], kosten_bahn: ['train'], kosten_bus: ['shuttle', 'boat'], kosten_boot: ['boat', 'shuttle'], kosten_mietfahrzeug: ['car', 'camper'], kosten_attraktion: ['tour'] }

const ALLGEMEIN = new Set(['hotel', 'flug', 'nach', 'airport', 'flughafen', 'resort', 'the', 'and', 'von', 'mit', 'fuer', 'booking', 'buchung', 'abreise', 'anreise', 'check', 'out', 'rueckgabe', 'abholung', 'ankunft', 'abflug', 'ruecktransfer', 'aufenthalt', 'transfer'])
const ohneUmlaut = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
export const woerter = (s) => ohneUmlaut(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !ALLGEMEIN.has(w))

/** Titel ohne Zusätze wie „Rückgabe“ oder „Check-out“, damit Anfang und Ende einer Buchung zusammenfinden. */
export const grundTitel = (t) => ohneUmlaut(t).replace(/\b(rueckgabe|abholung|uebernahme|pick-?up|drop-?off|check-?in|check-?out|ankunft|abreise|anreise|ruecktransfer)\b/g, ' ').replace(/[^a-z0-9→]+/g, ' ').trim()

// Mehrere Strecken einer Buchung als eine: „Perth → Doha“ und „Doha → Hamburg“ ergibt „Perth → Doha → Hamburg“
function strecke(teil) {
  const st = [...new Set(teil.map((e) => e.titel))].map((x) => String(x).split('→').map((y) => y.trim()))
  if (st.length < 2 || st.some((x) => x.length !== 2 || !x[0] || !x[1])) return ''
  for (let i = 1; i < st.length; i++) if (st[i][0] !== st[i - 1][1]) return ''
  return [st[0][0], ...st.map((x) => x[1])].join(' → ')
}

/** Termine zu Buchungen bündeln: gleiche Gruppe, gleiche Buchungsnummer oder gleiche Art mit gleichem Grundtitel
 *  (Check-out ohne Nummer findet so seinen Check-in). Zwei verschiedene Nummern bleiben zwei Buchungen. */
export function buendle(events = []) {
  const liste = events.filter((x) => x && !x.platzhalter).sort((a, b) => a.datum.localeCompare(b.datum))
  const chef = liste.map((_, i) => i)
  const wurzel = (i) => (chef[i] === i ? i : (chef[i] = wurzel(chef[i])))
  const refs = new Map()
  const verbinde = (a, b) => {
    const x = wurzel(a), y = wurzel(b)
    if (x === y) return
    const rx = refs.get(x) || new Set(), ry = refs.get(y) || new Set()
    if (rx.size && ry.size && ![...rx].some((r) => ry.has(r))) return
    chef[y] = x; refs.set(x, new Set([...rx, ...ry]))
  }
  const norm = (r) => String(r || '').toLowerCase().replace(/\s+/g, '')
  liste.forEach((e, i) => { if (norm(e.ref)) refs.set(i, new Set([norm(e.ref)])) })
  const schluessel = new Map()
  const merke = (k, i) => { if (schluessel.has(k)) verbinde(schluessel.get(k), i); else schluessel.set(k, i) }
  liste.forEach((e, i) => { if (e.gruppe) merke('g:' + e.gruppe, i) })
  liste.forEach((e, i) => { if (norm(e.ref)) merke('r:' + norm(e.ref), i) })
  liste.forEach((e, i) => { const g = grundTitel(e.titel); if (g) merke(`t:${e.kat}|${g}`, i) })
  const gruppen = new Map()
  liste.forEach((e, i) => { const w = wurzel(i); if (!gruppen.has(w)) gruppen.set(w, []); gruppen.get(w).push(e) })
  return [...gruppen.values()].map((teil) => {
    const erst = teil.find((e) => e.ref) || teil[0]
    return {
      id: teil[0].id, ids: teil.map((e) => e.id), kat: teil[0].kat, titel: strecke(teil) || erst.titel, termine: teil,
      von: teil[0].datum, bis: teil.at(-1).datum, ref: erst.ref || '',
      docs: teil.flatMap((e) => e.docs || []), eigen: teil.some((e) => e.quelle === 'eigen'),
    }
  })
}

/** Welche Buchung passt zu einer Ausgabe? Liefert { buchung, sicher } oder null. */
export function passendeBuchung(k, buchungen) {
  if (k.terminId) { const b = buchungen.find((x) => x.ids.includes(k.terminId)); if (b) return { buchung: b, sicher: true } }
  const w = new Set(woerter(k.text)), arten = PASST[k.kat]
  if (!w.size) return null
  let best = 0, treffer = []
  for (const b of buchungen) {
    if (arten && !arten.includes(b.kat)) continue
    const n = new Set(woerter(b.termine.map((e) => `${e.titel} ${e.sub || ''}`).join(' ')).filter((x) => w.has(x))).size
    if (!n) continue
    if (n > best) { best = n; treffer = [b] } else if (n === best) treffer.push(b)
  }
  if (!treffer.length) return null
  // Gleichstand bei Strecken: „Flug nach Cairns“ meint die Buchung, die in Cairns ankommt
  if (treffer.length > 1) {
    const ziel = woerter(ohneUmlaut(k.text).match(/\bnach\s+(.+)$/)?.[1] || '')[0]
    const an = ziel ? treffer.filter((b) => woerter(String(b.titel).split('→').slice(1).join(' ')).includes(ziel)) : []
    if (an.length === 1) return { buchung: an[0], sicher: true }
  }
  return { buchung: treffer[0], sicher: treffer.length === 1 }
}

/** Vorschläge für alle Ausgaben ohne Buchung: sichere zum Übernehmen, unsichere zum Bestätigen. */
export function verbindungsVorschlaege(vorab = [], buchungen = [], eintraege = []) {
  // Eine Termin-ID, die es nicht mehr gibt (Kalender neu geladen), gilt als nicht verbunden
  const alle = new Set(buchungen.flatMap((b) => b.ids))
  const vergeben = new Set(vorab.filter((k) => alle.has(k.terminId)).map((k) => k.terminId))
  const out = []
  for (const k of vorab) {
    if (alle.has(k.terminId) || k.ohneBuchung) continue
    const p = passendeBuchung(k, buchungen)
    if (!p) continue
    const etappe = etappeAm(eintraege, p.buchung.von)?.reise.id || null
    out.push({ kostenId: k.id, terminId: p.buchung.id, titel: p.buchung.titel, von: p.buchung.von, sicher: p.sicher && !vergeben.has(p.buchung.id), etappe })
  }
  return out
}

/** Passt eine Ausgabe dieser Kostenart zu einer Buchung dieser Art? Ohne Vorgabe passt alles. */
export const kostenPasst = (kat, buchungKat) => !PASST[kat] || PASST[kat].includes(buchungKat)
/** Kalendermarken (Aufenthalt, „Weihnachten“) sind keine Buchung, solange keine Nummer, kein Beleg und keine Kosten daran hängen. */
export const istEchteBuchung = (b) => b.eigen || !!(b.ref || b.docs.length || b.kosten?.length)

/** Buchungen mit ihren Kosten. Kosten zählen zu der Buchung, deren Termin sie tragen. */
export function buchungenMitKosten(events = [], vorab = [], eintraege = []) {
  return buendle(events).map((b) => {
    const kosten = vorab.filter((k) => k.terminId && b.ids.includes(k.terminId))
    return { ...b, kosten, offen: kosten.filter((k) => k.zahlung === 'vorOrt'), etappe: etappeAm(eintraege, b.von)?.reise || null }
  })
}

/** Erste Uhrzeit in einem Text, z. B. „Abflug 08:35“. */
export const uhrzeitIn = (s) => String(s || '').match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)?.slice(1).map((x) => x.padStart(2, '0')).join(':') || ''
const BEWEGUNG = ['flight', 'train', 'shuttle', 'boat']
/** Wechselzeit an einem Etappentag: gesetzt, sonst die erste Abfahrt an dem Tag. */
export function wechselZeit(etappe, von, events = []) {
  if (etappe?.wechselUm) return { zeit: etappe.wechselUm, quelle: null }
  const e = events.filter((x) => x.datum === von && BEWEGUNG.includes(x.kat) && uhrzeitIn(`${x.sub} ${x.titel}`)).sort((a, b) => uhrzeitIn(`${a.sub} ${a.titel}`).localeCompare(uhrzeitIn(`${b.sub} ${b.titel}`)))[0]
  return e ? { zeit: uhrzeitIn(`${e.sub} ${e.titel}`), quelle: e.titel } : null
}
/** Die Etappe jetzt: Am Wechseltag gilt bis zur Wechselzeit noch die vorige. */
export function etappeJetzt(eintraege, datum, uhr, events = []) {
  const e = etappeAm(eintraege, datum)
  if (!e || e.von !== datum) return e
  const vorher = [...eintraege].reverse().find((x) => x !== e && x.von <= datum && x.bis >= datum)
  const w = wechselZeit(e.reise, e.von, events)
  return vorher && w && uhr < w.zeit ? vorher : e
}
