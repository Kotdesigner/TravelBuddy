// Flüge und Züge der Reise: welche es gibt, wann sie abgefragt werden und was eine Antwort bedeutet.
//
// Quelle sind die Termine in `buchungen`. Jeder Termin mit Flugnummer ist ein Flug, jeder Termin
// der Art Bahn mit Zugnummer ein Zug, also auch jeder neu eingefügte. Ein Termin mit „XY12 / XY345“
// sind zwei Flüge: der zweite heißt hier Anschluss und bekommt sein Datum aus der Ankunft des ersten.
// Route, Etappe und Vorabausgaben legen über verkehr.js ebenfalls solche Termine an.
// Reine Rechnungen ohne Netz und Speicher, die übernimmt flug-dienst.js.
import { t, jeSprache } from './i18n.js'

const STUNDE = 3600e3

// Zwei Buchstaben plus Zahl. Ziffern im Code nur bei bekannten Airlines, sonst wäre „A320“ ein Flug.
const NUMMER = /(?<![A-Za-z0-9])([A-Z]{2}|3K|D7|9W|5J|6E|U2)[ -]?0*(\d{1,4})(?![\d:.,]\d)/g

/** „XY 36“, „xy036“, „XY-36“ → „XY36“. Leerer Text, wenn es keine Flugnummer ist. */
export function normalNummer(s) {
  const m = String(s || '').toUpperCase().trim().match(/^([A-Z0-9]{2})[ -]?0*(\d{1,4})$/)
  return m && /[A-Z]/.test(m[1]) ? m[1] + m[2] : ''
}

export function nummernImText(text) {
  return [...String(text || '').matchAll(NUMMER)].map((m) => m[1] + m[2])
}

// „Abflug 13:55“ oder „08:35 → 11:05“. „Ankunft 13:00“ ist keine Abflugzeit.
export function abflugzeitImText(text) {
  const s = String(text || '')
  const m = s.match(/Abflug\D{0,3}(\d{1,2}:\d{2})/i) || s.match(/(\d{1,2}:\d{2})\s*(?:→|->|-|–)\s*\d{1,2}:\d{2}/)
  return m ? m[1].padStart(5, '0') : ''
}

const istFlug = (e) => e.kat === 'flight' || !!e.flugNr

/** „ice 100“ → „ICE100“, „S 9“ → „S9“. Leerer Text, wenn es keine Zugnummer ist. */
export function normalZug(s) {
  const m = String(s || '').toUpperCase().trim().match(/^(ICE|IC|ECE|EC|RJX|RJ|NJ|EN|FLX|TGV|IRE|RE|RB|MEX|S|U)[ -]?(\d{1,5})$/)
  return m ? m[1] + m[2] : ''
}
export const zugnummernImText = (text) => [...String(text || '').matchAll(/(?<![A-Za-z0-9])(ICE|IC|ECE|EC|RJX|RJ|NJ|EN|FLX|TGV|IRE|RE|RB|MEX) ?(\d{1,5})(?![\d:.,]\d)/g)].map((m) => m[1] + m[2])

// „Mainz → Bonn“ → „Mainz Hbf“
export function bahnhofAusTitel(titel) {
  const start = String(titel || '').split(/→|->| - /)[0].trim()
  return start && !start.includes(' ') ? `${start} Hbf` : start
}

function zugAusTermin(e, ohneNummer, zuege) {
  const nr = normalZug(e.zugNr) || zugnummernImText(`${e.sub || ''} ${e.titel || ''}`)[0] || ''
  if (!nr) { ohneNummer.push(e); return }
  zuege.push({
    art: 'bahn', id: `${e.id}#${nr}`, nr, terminId: e.id, ref: e.ref || '', titel: e.titel || '', sitz: e.sitz || '', docs: e.docs || [],
    datum: e.datum, terminDatum: e.datum, zeit: e.zeit || e.zeitVon || abflugzeitImText(e.sub), bahnhof: e.bahnhof || bahnhofAusTitel(e.titel), anschlussVon: null,
  })
}

/** Termine → Flüge und Züge in Reihenfolge. Termine ohne erkennbare Nummer stehen in `ohneNummer`. */
export function fluegeAusTerminen(events = []) {
  const fluege = [], zuege = [], ohneNummer = []
  for (const e of events) {
    if (!e || e.platzhalter) continue
    if (e.kat === 'train') { zugAusTermin(e, ohneNummer, zuege); continue }
    if (!istFlug(e)) continue
    const nummern = [...new Set([normalNummer(e.flugNr), ...nummernImText(e.sub), ...nummernImText(e.titel)].filter(Boolean))]
    if (!nummern.length) {
      // „Ankunft Melbourne“ steht nur im Kalender und ist kein eigener Flug
      if (!/^ankunft/i.test(e.titel || '')) ohneNummer.push(e)
      continue
    }
    nummern.forEach((nr, i) => fluege.push({
      art: 'flug', id: `${e.id}#${nr}`, nr, terminId: e.id, ref: e.ref || '', titel: e.titel || '', sitz: e.sitz || '', docs: e.docs || [],
      datum: i === 0 ? e.datum : null, terminDatum: e.datum,
      zeit: i === 0 ? (e.zeit || e.zeitVon || abflugzeitImText(e.sub)) : '',
      anschlussVon: i > 0 ? `${e.id}#${nummern[i - 1]}` : null,
    }))
  }
  const reihe = (a, b) => a.terminDatum.localeCompare(b.terminDatum) || (a.zeit || '').localeCompare(b.zeit || '')
  fluege.sort((a, b) => a.terminDatum.localeCompare(b.terminDatum) || a.terminId.localeCompare(b.terminId))
  return { fluege, zuege, alle: [...fluege, ...zuege].sort(reihe), ohneNummer }
}

// Für die Stelle in Mehr → Flüge & Bahn: bezahlt, aber noch keinem Termin zugeordnet
const VORAB_ART = { kosten_flug: 'flug', kosten_bahn: 'bahn' }
export function offeneVorab(vorab = [], alle = []) {
  const bekannt = new Set(alle.map((f) => f.nr))
  return vorab
    .filter((k) => VORAB_ART[k.kat] && !k.terminId && !k.keinTermin)
    .filter((k) => ![...nummernImText(k.text), ...zugnummernImText(k.text)].some((n) => bekannt.has(n)))
    .map((k) => ({ ...k, art: VORAB_ART[k.kat] }))
}
export const vorabArt = (kat) => VORAB_ART[kat] || ''

/** Reicht das für einen Termin? Nummer und Datum, beim Zug auch der Bahnhof. */
export function verkehrOk(art, f = {}) {
  const nr = art === 'flug' ? normalNummer(f.nr) : normalZug(f.nr)
  return !!nr && /^\d{4}-\d{2}-\d{2}$/.test(f.datum || '') && (art === 'flug' || !!String(f.bahnhof || '').trim())
}

/** Datum für die Abfrage. Beim Anschluss der Ankunftstag des Vorgängers (Nachtflüge!). */
export function abfrageDatum(flug, staende = {}) {
  if (flug.datum) return flug.datum
  return staende[flug.anschlussVon]?.daten?.an?.planDatum || flug.terminDatum
}

/** Abflug in ms: aus der Antwort, sonst aus Datum und Uhrzeit, sonst Tagesmitte. */
export function abflugMs(flug, stand, staende = {}) {
  const d = stand?.daten?.ab
  if (d?.neuMs || d?.planMs) return d.neuMs || d.planMs
  const tag = abfrageDatum(flug, staende)
  return Date.parse(`${tag}T${flug.zeit || '12:00'}:00`)
}
export function landungMs(stand) {
  const a = stand?.daten?.an
  return a?.neuMs || a?.planMs || null
}

// ---------- Takt ----------
//
// Mindestabstand in Stunden je nach Zeit bis zum Abflug. Pro Flug rund 31 Abfragen ab einer Woche
// vorher, das passt bei drei bis vier Flügen im Monat in das Kontingent von 200. Live-Daten kommen
// ohnehin erst etwa einen Tag vorher, davor findet die Abfrage nur Änderungen im Flugplan.
export function abstandStunden(stundenBisAbflug) {
  const h = stundenBisAbflug
  if (h > 168) return 156
  if (h > 72) return 24
  if (h > 24) return 8
  if (h > 4) return 2
  return 0.5
}

const LANGE_VORHER = 340 * 24   // Gratis-Tarif: Flugplan bis 365 Tage voraus

/** Ist dieser Flug jetzt an der Reihe? Ein neuer Flug wird sofort einmal abgefragt. */
export function faellig(flug, stand, jetzt, staende = {}) {
  const abflug = abflugMs(flug, stand, staende)
  if (Number.isNaN(abflug)) return false
  const h = (abflug - jetzt) / STUNDE
  if (h > LANGE_VORHER) return false
  const letzte = stand?.geholt || 0
  if (h > 0) {
    if (!letzte) return true
    // Nichts gefunden kostet genauso viel: seltener nachsehen
    const a = stand?.leer ? Math.max(abstandStunden(h), 24) : abstandStunden(h)
    return jetzt - letzte >= a * STUNDE
  }
  // Nach dem Abflug: kurz nach dem Start, vor und nach der Landung
  const landung = landungMs(stand) ?? abflug + 2 * STUNDE
  if (jetzt > landung + 3 * STUNDE) return false
  const ziele = [abflug + 0.25 * STUNDE, landung - 0.5 * STUNDE, landung + 0.25 * STUNDE]
  const zuletzt = Math.max(...ziele.filter((z) => z <= jetzt), 0)
  return !!zuletzt && letzte < zuletzt
}

/** Was die Taste „Jetzt abfragen“ holt: der nächste Flug samt Anschlüssen desselben Termins. */
export function naechsteGruppe(fluege, staende, jetzt) {
  const erster = fluege.find((f) => {
    const s = staende[f.id]
    return (landungMs(s) ?? abflugMs(f, s, staende) + 2 * STUNDE) > jetzt
  })
  return erster ? fluege.filter((f) => f.terminId === erster.terminId) : []
}

// Die Abfahrtstafel reicht nur etwa drei Stunden voraus, kostet aber nichts: alle 20 Minuten nachsehen
export function zugFaellig(zug, stand, jetzt) {
  const h = (abflugMs(zug, stand) - jetzt) / STUNDE
  if (Number.isNaN(h) || h > 3 || h < -1) return false
  return !stand?.geholt || jetzt - stand.geholt >= 20 * 60e3
}

// ---------- Kontingent ----------

export const KONTINGENT = 200
export const RESERVE = 20   // bleibt für die Taste

export function monatVon(ms) { return new Date(ms).toISOString().slice(0, 7) }
export function genutzt(zaehler, jetzt) { return zaehler?.monat === monatVon(jetzt) ? zaehler.anzahl : 0 }
export function darfAbfragen(zaehler, jetzt, { vonHand = false } = {}) {
  return genutzt(zaehler, jetzt) < (vonHand ? KONTINGENT : KONTINGENT - RESERVE)
}

// ---------- Antwort ----------

const ms = (s) => { if (!s) return null; const v = Date.parse(String(s).replace(' ', 'T')); return Number.isNaN(v) ? null : v }
const zeitVon = (zeit) => String(zeit?.local || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/) || []

function punkt(m = {}) {
  const [, planDatum = '', planZeit = ''] = zeitVon(m.scheduledTime)
  const neu = m.revisedTime || m.predictedTime || null
  const [, , neuZeit = ''] = zeitVon(neu)
  return {
    iata: m.airport?.iata || '', ort: m.airport?.municipalityName || m.airport?.shortName || m.airport?.name || '',
    planDatum, planZeit, planMs: ms(m.scheduledTime?.utc), neuZeit, neuMs: ms(neu?.utc),
    terminal: m.terminal || '', gate: m.gate || '', schalter: m.checkInDesk || '', band: m.baggageBelt || '',
    live: Array.isArray(m.quality) && m.quality.includes('Live'),
  }
}

/** Ein Treffer der Schnittstelle → unsere Felder. Bei mehreren zählt der Abflug am gesuchten Tag. */
export function leseAntwort(liste, datum) {
  if (!Array.isArray(liste) || !liste.length) return null
  const f = liste.find((x) => String(x.departure?.scheduledTime?.local || '').startsWith(datum)) || liste[0]
  return {
    status: f.status || 'Unknown', airline: f.airline?.name || '', flugzeug: f.aircraft?.model || '',
    ab: punkt(f.departure), an: punkt(f.arrival),
  }
}

const passtZug = (z, nr) => {
  const name = String(z.train || '').replace(/\s+/g, '').toUpperCase()
  const nummer = nr.replace(/\D/g, '')
  return name === nr || name.endsWith(nr) || (nummer.length >= 3 && z.trainNumber === nummer)
}

/** Abfahrtstafel → unsere Felder für einen Zug. null, wenn er noch nicht darauf steht. */
export function leseZug(antwort, zug) {
  const z = (antwort?.departures || []).find((x) => x.scheduledDeparture && passtZug(x, zug.nr))
  if (!z) return null
  const planMs = Date.parse(`${zug.datum}T${z.scheduledDeparture}:00`)
  const spaeter = Number(z.delayDeparture) || 0
  const neuMs = spaeter ? planMs + spaeter * 60000 : null
  const neu = neuMs ? new Date(neuMs) : null
  const neuZeit = neu ? `${String(neu.getHours()).padStart(2, '0')}:${String(neu.getMinutes()).padStart(2, '0')}` : ''
  const status = z.isCancelled ? 'Canceled' : spaeter >= 5 ? 'Delayed' : z.missingRealtime ? 'Expected' : 'OnTime'
  const gleis = z.platform || z.scheduledPlatform || ''
  return {
    status, airline: '', flugzeug: z.train || '',
    hinweise: [...(z.messages?.delay || []), ...(z.messages?.qos || [])].map((m) => m.text).filter(Boolean).slice(0, 3),
    ab: { iata: '', ort: zug.bahnhof, planDatum: zug.datum, planZeit: z.scheduledDeparture, planMs, neuZeit, neuMs, gleis, gleisAlt: z.scheduledPlatform && z.scheduledPlatform !== gleis ? z.scheduledPlatform : '', terminal: '', gate: '', schalter: '', band: '', live: !z.missingRealtime },
    an: { iata: '', ort: z.destination || '', planDatum: '', planZeit: '', planMs: null, neuZeit: '', neuMs: null, terminal: '', gate: '', schalter: '', band: '', live: false },
  }
}

/** Minuten später als geplant, null wenn keine neue Zeit bekannt ist. */
export function verspaetung(p) {
  if (!p?.neuMs || !p?.planMs) return null
  return Math.round((p.neuMs - p.planMs) / 60000)
}

export const STATUS_TEXT = jeSprache(() => ({
  Unknown: t('Status unbekannt'), Expected: t('Geplant'), OnTime: t('Pünktlich'), CheckIn: t('Check-in offen'), Boarding: t('Boarding'),
  GateClosed: t('Gate geschlossen'), Departed: t('Abgeflogen'), EnRoute: t('In der Luft'), Delayed: t('Verspätet'),
  Approaching: t('Im Landeanflug'), Arrived: t('Gelandet'), Canceled: t('Annulliert'),
  CanceledUncertain: t('Vielleicht annulliert'), Diverted: t('Umgeleitet'),
}))

const SCHLECHT = ['Canceled', 'CanceledUncertain', 'Diverted']
export const istSchlecht = (d) => SCHLECHT.includes(d?.status) || (verspaetung(d?.ab) ?? 0) >= 15 || (verspaetung(d?.an) ?? 0) >= 15

/** Ohne Live-Daten am Ziel bleibt der Status auf „Abgeflogen“ stehen. */
export function statusText(d, jetzt) {
  if (!d) return ''
  const landung = d.an?.neuMs || d.an?.planMs
  if (['Departed', 'EnRoute'].includes(d.status) && landung && jetzt > landung) return t('Wohl gelandet')
  return STATUS_TEXT[d.status] || STATUS_TEXT.Unknown
}

// ---------- Änderungen ----------

const FELDER = [
  ['ab', 'gleis', () => t('Gleis')], ['ab', 'terminal', () => t('Terminal Abflug')], ['ab', 'gate', () => t('Gate')], ['ab', 'schalter', () => t('Check-in-Schalter')],
  ['an', 'gate', () => t('Gate Ankunft')], ['an', 'band', () => t('Gepäckband')],
]

/** Was sich zwischen zwei Antworten geändert hat, als fertige Texte. Die erste Antwort ist keine Änderung. */
export function aenderungen(alt, neu) {
  if (!alt || !neu) return []
  const out = []
  if (alt.status !== neu.status && SCHLECHT.includes(neu.status)) out.push({ text: STATUS_TEXT[neu.status], wichtig: true })
  for (const [seite, feld, name] of FELDER) {
    const a = alt[seite]?.[feld], b = neu[seite]?.[feld]
    if (a === b || !b) continue
    out.push({ text: a ? t('{name}: {a} → {b}', { name: name(), a, b }) : t('{name}: {b}', { name: name(), b }), wichtig: !!a })
  }
  const av = verspaetung(alt.ab) ?? 0, nv = verspaetung(neu.ab) ?? 0
  if (Math.abs(nv - av) >= 5) out.push({ text: t('Abflug jetzt {zeit}', { zeit: neu.ab.neuZeit || neu.ab.planZeit }), wichtig: true })
  return out
}

// ---------- Umstiege ----------

/** Aufeinanderfolgende Flüge mit weniger als 24 Stunden dazwischen. */
export function umstiege(fluege, staende) {
  const out = []
  for (let i = 1; i < fluege.length; i++) {
    const vor = staende[fluege[i - 1].id]?.daten, nach = staende[fluege[i].id]?.daten
    if (!vor || !nach) continue
    const an = vor.an.neuMs || vor.an.planMs, ab = nach.ab.neuMs || nach.ab.planMs
    if (!an || !ab) continue
    const minuten = Math.round((ab - an) / 60000)
    if (minuten > 24 * 60) continue
    const geplant = vor.an.planMs && nach.ab.planMs ? Math.round((nach.ab.planMs - vor.an.planMs) / 60000) : minuten
    out.push({ nachFlug: fluege[i].id, ort: nach.ab.ort || nach.ab.iata, minuten, geplant, knapp: minuten < 60, verpasst: minuten < 0 })
  }
  return out
}

export function dauerText(minuten) {
  const m = Math.abs(minuten), h = Math.floor(m / 60)
  return h ? t('{h} Std. {m} Min.', { h, m: m % 60 }) : t('{m} Min.', { m })
}

// ---------- Hinweis vor dem Abflug ----------

/** Die Fahrt, die gerade dran ist: von 24 Stunden vor dem Start bis eine Stunde nach der Ankunft. */
export function flugImFokus(fluege, staende, jetzt, schonGezeigt = {}) {
  for (const f of fluege) {
    if (schonGezeigt[f.id]) continue
    const s = staende[f.id], ab = abflugMs(f, s, staende)
    const ende = (landungMs(s) ?? ab + 3 * STUNDE) + STUNDE
    if (jetzt >= ab - 24 * STUNDE && jetzt <= ende) return f
  }
  return null
}

export const stundenBis = (zeit, jetzt) => Math.round((zeit - jetzt) / STUNDE)
