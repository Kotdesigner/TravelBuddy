// V16: Wo schlafe ich jede Nacht? Für jede Nacht der Reise ein Zustand:
//   gebucht   eine Unterkunft aus den Buchungen (Check-in bis Check-out)
//   geplant   ein Stopp mit Nächten in einem eingeplanten Abschnitt
//   flug      Nachtflug (Abflug am Abend oder Ankunft erst am nächsten Tag)
//   camper    im gemieteten Camper, aber noch ohne Platz
//   offen     nichts bekannt
// Dazu Feiertage in Western Australia und die Hochsaison. Reine Rechnungen, ohne Speicher.
import { plusTage, gueltigesDatum } from './plan.js'
import { buendle, uhrzeitIn } from './buchung.js'
import { abschnitteDerEtappe, bereichVon } from './abschnitte.js'
import { terminGilt } from './buchung.js'

/**
 * Gesetzliche Feiertage in Western Australia über die Jahreswende, für jedes Jahr gerechnet
 * (Regeln laut wa.gov.au): New Year's Day und Australia Day am Wochenende bekommen den Montag danach,
 * fällt Christmas Day auf Samstag oder Sonntag, kommt Montag der 27. dazu, fällt Boxing Day auf
 * Samstag oder Sonntag, der nächste freie Werktag. 2026: 25., 26. und 28.12., 1.1., 26.1.
 */
export function feiertagWA(d) {
  const [j, m, t] = d.split('-').map(Number)
  const wt = (jj, mm, tt) => new Date(Date.UTC(jj, mm - 1, tt)).getUTCDay()   // 0 = Sonntag, 6 = Samstag
  if (m === 12) {
    const c = wt(j, 12, 25), b = wt(j, 12, 26)
    if (t === 25) return 'Christmas Day'
    if (t === 26) return 'Boxing Day'
    if (t === 27 && (c === 6 || c === 0)) return 'Christmas Day (Ersatztag)'
    if (t === 28 && (b === 6 || b === 0) && !(c === 0)) return 'Boxing Day (Ersatztag)'
    return ''
  }
  if (m === 1) {
    const n = wt(j, 1, 1), a = wt(j, 1, 26)
    if (t === 1) return "New Year's Day"
    if ((n === 6 && t === 3) || (n === 0 && t === 2)) return "New Year's Day (Ersatztag)"
    if (t === 26) return 'Australia Day'
    if ((a === 6 && t === 28) || (a === 0 && t === 27)) return 'Australia Day (Ersatztag)'
  }
  return ''
}
/** Für Rückwärtsverträglichkeit: Feiertage als Nachschlagetabelle für ein Datum. */
export const FEIERTAGE = new Proxy({}, { get: (_, d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? feiertagWA(d) || undefined : undefined) })
/** Hochsaison: australische Sommerferien, etwa Mitte Dezember bis Ende Januar. */
export const hochsaison = (d) => { const md = d.slice(5); return md >= '12-15' || md <= '01-31' }

const UNTERKUNFT = new Set(['hotel', 'stay', 'city'])
const FAHRZEUG = new Set(['camper'])

/** Nächte, die eine Unterkunft deckt: Check-in bis zum Tag vor dem Check-out, sonst „(3 Nächte)“ im Text, sonst eine. */
function unterkunftsNaechte(b) {
  if (b.bis > b.von) return { von: b.von, bis: plusTage(b.bis, -1) }
  const n = Number(String(b.termine.map((e) => e.sub).join(' ')).match(/(\d+)\s*N(ä|ae)cht/)?.[1] || 1)
  return { von: b.von, bis: plusTage(b.von, n - 1) }
}

/** Nachtflug: Abflug ab 18 Uhr, oder am nächsten Tag steht eine Ankunft. */
function nachtflugAm(events, datum) {
  const morgen = plusTage(datum, 1)
  const ankunftMorgen = events.some((e) => e.datum === morgen && e.kat === 'flight' && /ankunft|arrival/i.test(e.titel || ''))
  return events.find((e) => e.datum === datum && e.kat === 'flight' && !/ankunft|arrival/i.test(e.titel || '') &&
    ((uhrzeitIn(`${e.sub} ${e.titel}`) || '00:00') >= '18:00' || ankunftMorgen)) || null
}

/** Nächte aus den Stopps eines eingeplanten Abschnitts: Stopp für Stopp ab dem ersten Tag. */
export function stoppNaechte(r) {
  const b = bereichVon(r)
  if (!b) return []
  const out = []
  let d = b.von
  for (const s of r.stops || []) {
    const n = Math.max(0, Math.round(Number(s.naechte) || 0))
    for (let i = 0; i < n; i++) { out.push({ datum: d, ort: s.name, stopp: s }); d = plusTage(d, 1) }
  }
  return out
}

/**
 * @param o.eintraege etappenMitDatum(...)
 * @param o.reisen    alle Reisen (für die Abschnitte)
 * @param o.events    buchungen.events
 * @returns { naechte: [{ datum, zustand, text, etappe, feiertag, hochsaison }], zahl: { gebucht, geplant, flug, camper, offen } }
 */
export function naechteUebersicht({ eintraege = [], reisen = [], events = [] } = {}) {
  if (!eintraege.length) return { naechte: [], zahl: { gebucht: 0, geplant: 0, flug: 0, camper: 0, offen: 0 } }
  const start = eintraege[0].von
  const ende = eintraege.reduce((m, e) => (e.bis > m ? e.bis : m), start)
  const liste = events.filter((e) => terminGilt(e) && gueltigesDatum(e.datum))
  const bus = buendle(liste)

  const belegt = new Map()   // datum -> { zustand, text }
  const setze = (d, wert, rang) => { const alt = belegt.get(d); if (!alt || alt.rang > rang) belegt.set(d, { ...wert, rang }) }
  for (const b of bus) {
    if (UNTERKUNFT.has(b.kat) && (b.ref || b.eigen || b.kosten?.length || b.docs.length)) {
      const { von, bis } = unterkunftsNaechte(b)
      for (let d = von; d <= bis; d = plusTage(d, 1)) setze(d, { zustand: 'gebucht', text: b.titel }, 0)
    }
    if (FAHRZEUG.has(b.kat) && b.bis > b.von && (b.ref || b.eigen)) {
      for (let d = b.von; d < b.bis; d = plusTage(d, 1)) setze(d, { zustand: 'camper', text: b.titel }, 3)
    }
  }
  for (const e of eintraege) {
    const ab = abschnitteDerEtappe(reisen, e.reise.id).eingeplant
    for (const r of ab) for (const n of stoppNaechte(r)) setze(n.datum, { zustand: 'geplant', text: n.ort, abschnitt: r.name }, 1)
  }
  const naechte = []
  const zahl = { gebucht: 0, geplant: 0, flug: 0, camper: 0, offen: 0 }
  for (let d = start; d < ende; d = plusTage(d, 1)) {
    let w = belegt.get(d)
    if (!w || w.rang > 2) { const f = nachtflugAm(liste, d); if (f) w = { zustand: 'flug', text: f.titel, rang: 2 } }
    w ||= { zustand: 'offen', text: '' }
    const etappe = [...eintraege].reverse().find((e) => d >= e.von && d <= e.bis) || null
    naechte.push({ datum: d, zustand: w.zustand, text: w.text, abschnitt: w.abschnitt || '', etappe: etappe?.reise || null, feiertag: FEIERTAGE[d] || FEIERTAGE[plusTage(d, 1)] && `vor ${FEIERTAGE[plusTage(d, 1)]}` || '', hochsaison: hochsaison(d) })
    zahl[w.zustand]++
  }
  return { naechte, zahl }
}

/** Aufeinanderfolgende Nächte mit gleichem Zustand und Text zusammenfassen (für die Anzeige). */
export function naechteGruppen(naechte = []) {
  const out = []
  for (const n of naechte) {
    const g = out.at(-1)
    if (g && g.zustand === n.zustand && g.text === n.text && g.etappe?.id === n.etappe?.id) { g.bis = n.datum; g.anzahl++; if (n.feiertag) g.feiertage.push(n) }
    else out.push({ ...n, von: n.datum, bis: n.datum, anzahl: 1, feiertage: n.feiertag ? [n] : [] })
  }
  return out
}

/** Die wichtigsten offenen Nächte: Feiertage und Hochsaison zuerst. */
export function dringendeNaechte(naechte = []) {
  return naechte.filter((n) => n.zustand === 'offen' || n.zustand === 'camper')
    .map((n) => ({ ...n, gewicht: (n.feiertag ? 2 : 0) + (n.hochsaison ? 1 : 0) }))
    .filter((n) => n.gewicht >= 2)
}
