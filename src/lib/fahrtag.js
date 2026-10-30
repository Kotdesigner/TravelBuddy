// Fahrtag-Planer „Ankunft vor der Dämmerung“: reine Rechnungen, offline, ohne Stores.
//
// Für eine Route oder jeden Abschnitt zwischen zwei Stopps:
//   Fahrzeit   aus den Abschnitten der Straßenroute (OSRM), sonst anteilig nach km aus der
//              Gesamtzeit, sonst Schätzung mit 80 km/h
//   Pausen     alle 2 h Fahrt 15 min
//   Puffer     30 min vor Sonnenuntergang am Ziel
//   Ergebnis   „spätestens losfahren um …“ in der Zeitzone des Ziels
// Reicht das Tageslicht nicht (Losfahren läge vor Sonnenaufgang), Vorschlag: Strecke teilen.
import * as SunCalc from 'suncalc'
import { zeitzoneFuer } from './sonne.js'
import { etappenMitDatum, etappeAm, routenDerEtappe, gueltigesDatum } from './plan.js'
import { rundeAufSumme, gleicheTeile } from './runden.js'
import { stimmigeLegs } from './routing.js'
import { LOCALE, t, beiSprache } from './i18n.js'
import { ZWEI } from './format.js'


export const SCHAETZ_KMH = 80
export const PAUSE_ALLE_MIN = 120
export const PAUSE_DAUER_MIN = 15
export const PUFFER_MIN = 30
/** Luftlinie → Straße: im Outback fahren die Highways selten gerade auf das Ziel zu. */
export const UMWEG_FAKTOR = 1.25

const RAD = Math.PI / 180
function luftKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}
const mitKoord = (s) => s && s.lat != null && s.lon != null

/** Fahrminuten bei gegebener Strecke ohne bekannte Zeit. */
export const schaetzMinuten = (km) => Math.round((Math.max(0, Number(km) || 0) / SCHAETZ_KMH) * 60)

/** Pausen: nach jeweils vollen 2 h Fahrt eine Pause, aber keine mehr direkt vor der Ankunft. */
export function pausenMinuten(fahrMin) {
  const m = Math.max(0, Number(fahrMin) || 0)
  if (m <= PAUSE_ALLE_MIN) return 0
  return (Math.ceil(m / PAUSE_ALLE_MIN) - 1) * PAUSE_DAUER_MIN
}

/**
 * Die Abschnitte einer Route zwischen Stopps mit Kartenpunkt.
 * @param r  Reise/Route mit stops [{name,lat,lon,datum?}] und optional route {km, dauerMin, legs, sig}
 * @param o.aktuell  false, wenn die gespeicherte Route nicht mehr zu den Stopps passt
 * @returns [{ i, vonIdx, nachIdx, von, nach, ziel:{lat,lon}, start:{lat,lon}, km, fahrMin, geschaetzt, datum }]
 *   `i` zählt die Abschnitte (wie route.legs), vonIdx/nachIdx sind Indizes in r.stops.
 */
export function abschnitte(r, { aktuell = true } = {}) {
  const stops = r?.stops || []
  const p = []
  stops.forEach((s, idx) => { if (mitKoord(s)) p.push({ ...s, idx }) })
  if (p.length < 2) return []
  const rt = aktuell ? r.route : null
  // Abschnitte so, dass sie zusammen genau die km und Minuten der Route ergeben (runden.js)
  const roh = rt?.legs && rt.legs.length === p.length - 1 ? stimmigeLegs(rt) : null
  const legs = roh && roh.every((l) => Number.isFinite(l.km)) ? roh : null
  const luft = []
  for (let k = 1; k < p.length; k++) luft.push(luftKm(p[k - 1], p[k]) * UMWEG_FAKTOR)
  const luftSumme = luft.reduce((a, b) => a + b, 0) || 1
  // Nur Gesamtwerte da: km nach Luftlinienanteil verteilen, Zeit anteilig nach km, beides
  // so gerundet, dass die Summe genau die Gesamtwerte trifft
  const verteiltKm = !legs && rt?.km && !rt.flug ? rundeAufSumme(luft.map((l) => rt.km * l / luftSumme), rt.km) : null
  const verteiltMin = verteiltKm && rt.dauerMin ? rundeAufSumme(verteiltKm.map((k) => rt.dauerMin * k / rt.km), rt.dauerMin) : null
  const luftGerundet = rundeAufSumme(luft)
  const out = []
  for (let k = 1; k < p.length; k++) {
    const a = p[k - 1], b = p[k]
    let km, fahrMin, geschaetzt = false
    if (legs) {
      km = legs[k - 1].km
      fahrMin = Number.isFinite(legs[k - 1].dauerMin) ? legs[k - 1].dauerMin : schaetzMinuten(km)
      geschaetzt = !Number.isFinite(legs[k - 1].dauerMin)
    } else if (verteiltKm) {
      km = verteiltKm[k - 1]
      fahrMin = verteiltMin ? verteiltMin[k - 1] : schaetzMinuten(km)
      geschaetzt = !verteiltMin
    } else {
      km = luftGerundet[k - 1]
      fahrMin = schaetzMinuten(km)
      geschaetzt = true
    }
    out.push({
      i: k - 1, vonIdx: a.idx, nachIdx: b.idx, von: a.name, nach: b.name,
      start: { lat: a.lat, lon: a.lon }, ziel: { lat: b.lat, lon: b.lon },
      km, fahrMin, geschaetzt, datum: gueltigesDatum(b.datum) ? b.datum : gueltigesDatum(a.datum) ? a.datum : null,
    })
  }
  return out
}

/** Mehrere Abschnitte zu einer Fahrt zusammenfassen (z. B. die ganze Route an einem Tag). */
export function zusammen(teile) {
  if (!teile.length) return null
  return {
    von: teile[0].von, nach: teile[teile.length - 1].nach,
    start: teile[0].start, ziel: teile[teile.length - 1].ziel,
    km: teile.reduce((n, t) => n + t.km, 0),
    fahrMin: teile.reduce((n, t) => n + t.fahrMin, 0),
    geschaetzt: teile.some((t) => t.geschaetzt),
    datum: teile.find((t) => t.datum)?.datum || null,
    teile: teile.length,
  }
}

/** Sonnenzeiten als Date für einen Tag an einem Ort (Mittag Ortszeit grob nach Länge). */
export function sonneAm(lat, lon, datum) {
  const [y, m, d] = datum.split('-').map(Number)
  const mittag = new Date(Date.UTC(y, m - 1, d, 12) - (lon / 15) * 3600e3)
  const t = SunCalc.getTimes(mittag, lat, lon)
  const ok = (x) => (x && !isNaN(x.getTime()) ? x : null)
  return { aufgang: ok(t.sunrise), untergang: ok(t.sunset), daemmerungEnde: ok(t.dusk), daemmerungBeginn: ok(t.dawn) }
}

/** Uhrzeit HH:MM in einer Zeitzone. */
export function uhrzeit(date, tz) {
  if (!date || isNaN(date.getTime())) return '–'
  return date.toLocaleTimeString(LOCALE, { timeZone: tz, hour: ZWEI, minute: '2-digit' })
}

/** „4 h 05 min“ bzw. „45 min“. */
export function dauerText(min) {
  const m = Math.max(0, Math.round(min || 0))
  const h = Math.floor(m / 60), r = m % 60
  return h ? `${h} h ${String(r).padStart(2, '0')} min` : `${r} min`
}

/**
 * Kern: wann spätestens los, damit man vor Sonnenuntergang (mit Puffer) ankommt?
 * @param o.fahrMin           reine Fahrzeit
 * @param o.untergang         Date Sonnenuntergang am Ziel
 * @param o.aufgang           Date Sonnenaufgang (am Start; Grenze für „im Hellen“)
 * @param o.pufferMin         Reserve vor Sonnenuntergang
 * @returns { fahrMin, pausenMin, unterwegsMin, losSpaetestens: Date, hellMin, reichtLicht, teile }
 *   `teile` = in wie viele Tagesfahrten die Strecke mindestens zu teilen ist (1 = passt).
 */
export function losfahrPlan({ fahrMin, untergang, aufgang = null, pufferMin = PUFFER_MIN }) {
  const pausenMin = pausenMinuten(fahrMin)
  const unterwegsMin = fahrMin + pausenMin
  if (!untergang) return { fahrMin, pausenMin, unterwegsMin, losSpaetestens: null, hellMin: null, reichtLicht: true, teile: 1 }
  const losSpaetestens = new Date(untergang.getTime() - (unterwegsMin + pufferMin) * 60000)
  const hellMin = aufgang ? Math.round((untergang - aufgang) / 60000) - pufferMin : null
  const reichtLicht = !aufgang || losSpaetestens >= aufgang
  let teile = 1
  if (!reichtLicht && hellMin > 0) {
    // Je Tag passt so viel reine Fahrzeit, dass Fahrt plus Pausen ins Tageslicht passt
    let proTag = hellMin
    while (proTag > 0 && proTag + pausenMinuten(proTag) > hellMin) proTag -= 5
    teile = Math.max(2, Math.ceil(fahrMin / Math.max(proTag, 60)))
  }
  return { fahrMin, pausenMin, unterwegsMin, losSpaetestens, hellMin, reichtLicht, teile }
}

/**
 * Alles für die Anzeige einer Fahrt (Abschnitt oder zusammengefasst).
 * @param f      { start, ziel, km, fahrMin, geschaetzt }
 * @param datum  'YYYY-MM-DD' Tag der Fahrt
 */
export function fahrtag(f, datum) {
  if (!f || !f.ziel || !gueltigesDatum(datum)) return null
  const tz = zeitzoneFuer(f.ziel.lat, f.ziel.lon)
  const amZiel = sonneAm(f.ziel.lat, f.ziel.lon, datum)
  const amStart = f.start ? sonneAm(f.start.lat, f.start.lon, datum) : amZiel
  const plan = losfahrPlan({ fahrMin: f.fahrMin, untergang: amZiel.untergang, aufgang: amStart.aufgang })
  return {
    ...plan, datum, tz, km: f.km, geschaetzt: !!f.geschaetzt,
    untergang: amZiel.untergang, daemmerungEnde: amZiel.daemmerungEnde,
    losText: uhrzeit(plan.losSpaetestens, tz),
    untergangText: uhrzeit(amZiel.untergang, tz),
    daemmerungText: uhrzeit(amZiel.daemmerungEnde, tz),
    aufgangText: uhrzeit(amStart.aufgang, zeitzoneFuer(f.start?.lat ?? f.ziel.lat, f.start?.lon ?? f.ziel.lon)),
    // Aufteilen: genaue Teile, die zusammen die Tagesstrecke ergeben (790 km → 264 + 263 + 263)
    kmTeile: plan.teile > 1 ? gleicheTeile(f.km, plan.teile) : [f.km],
    kmJeTeil: plan.teile > 1 ? Math.max(...gleicheTeile(f.km, plan.teile)) : f.km,
  }
}

/** Ankunft, wenn man zu `los` (Date) startet. */
export const ankunft = (los, unterwegsMin) => new Date(los.getTime() + unterwegsMin * 60000)

/**
 * An welchem Tag wird eine Route gefahren? Stopp-Datum vor Routendatum; sonst: läuft die
 * Etappe gerade, heute; liegt sie in der Zukunft, ihr erster Tag; sonst heute.
 */
export function fahrDatum(r, reisen, gesamtStart, heute) {
  if (gueltigesDatum(r?.datum)) return r.datum
  const eintraege = etappenMitDatum(reisen, gesamtStart)
  const e = eintraege.find((x) => x.reise.id === (r?.typ === 'route' ? r.etappeId : r?.id))
  if (e) {
    if (heute >= e.von && heute <= e.bis) return heute
    if (heute < e.von) return e.von
  }
  return heute
}

const istAuto = (r) => (r?.art || 'auto') !== 'flug' && !r?.route?.flug

/**
 * Die heutige Fahrt, falls eine ansteht. Reihenfolge der Hinweise:
 *  1. heutiger Logbuch-Eintrag mit gewählter Strecke (reiseId, legIdx)
 *  2. Stopps mit Datum = heute (Abschnitte, die heute ankommen)
 *  3. Route mit Datum = heute
 *  4. eintägige Etappe mit genau einer Auto-Route
 *  5. Anreise der Etappe (eigene Stopps, Auto) an ihrem ersten Tag
 * @returns null oder { reise, quelle, fahrt (zusammen), plan (fahrtag), abschnitte }
 */
export function heutigeFahrt({ reisen = [], gesamtStart, heute, journal = [], aktuell = () => true } = {}) {
  if (!gueltigesDatum(heute)) return null
  const eintraege = etappenMitDatum(reisen, gesamtStart)
  const e = etappeAm(eintraege, heute)
  if (!e) return null
  const routen = routenDerEtappe(reisen, e.reise.id).filter(istAuto)
  const kandidaten = [...routen]
  if ((e.reise.stops || []).filter(mitKoord).length >= 2 && istAuto(e.reise)) kandidaten.push(e.reise)
  if (!kandidaten.length) return null

  const ergebnis = (reise, teile, quelle) => {
    const fahrt = zusammen(teile)
    if (!fahrt) return null
    return { reise, quelle, fahrt, abschnitte: teile, plan: fahrtag(fahrt, heute) }
  }
  const abs = (r) => abschnitte(r, { aktuell: aktuell(r) })

  // 1. Logbuch
  for (const j of journal) {
    if (j?.datum !== heute || !j.reiseId) continue
    const r = kandidaten.find((x) => x.id === j.reiseId) || reisen.find((x) => x.id === j.reiseId && istAuto(x))
    if (!r) continue
    const a = abs(r)
    if (j.legIdx == null) return ergebnis(r, a, 'logbuch')
    const t = a.find((x) => x.vonIdx === j.legIdx) || a[j.legIdx]
    if (t) return ergebnis(r, [t], 'logbuch')
  }
  // 2. Stopps mit Datum
  for (const r of kandidaten) {
    const a = abs(r).filter((t) => (r.stops[t.nachIdx]?.datum === heute))
    if (a.length) return ergebnis(r, a, 'stoppdatum')
  }
  // 3. Route mit Datum
  const mitDatum = kandidaten.find((r) => r.datum === heute)
  if (mitDatum) return ergebnis(mitDatum, abs(mitDatum), 'routendatum')
  // 4. eintägige Etappe mit genau einer Route
  if (e.tage === 1 && routen.length === 1) return ergebnis(routen[0], abs(routen[0]), 'etappe')
  // 5. Anreise am ersten Tag
  if (heute === e.von && kandidaten.includes(e.reise)) return ergebnis(e.reise, abs(e.reise), 'anreise')
  return null
}

export let WILDWECHSEL
beiSprache(() => { WILDWECHSEL = t('In der Dämmerung und nachts sind Kängurus, Emus und Vieh oft auf oder neben der Straße, auf offenem Weideland auch Rinder. Prüf deinen Mietvertrag: Manche Vermieter zahlen bei Tierschäden nach Sonnenuntergang nicht.') })
