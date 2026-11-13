// Logbuch automatisch ausfüllen: Was sich aus Strecke, Datum und Ort ableiten lässt, trägt die App selbst ein.
//
// Was: Tageskilometer (Straßenroute der Strecke des Tages), Temperatur & Wetter und gefühlte Hitze (Tageswerte
// von Open-Meteo, auch rückwirkend), Sternenhimmel (Mond offline, Wolken mit Netz) und Verkehrsmittel (Art der
// Etappe und Buchungen an dem Tag).
//
// Regeln:
//  - Nur leere Felder werden gefüllt. Was du selbst einträgst oder änderst, bleibt unangetastet.
//  - Ein automatisch gefüllter Wert wird in `autoFelder` vermerkt. Stimmt das Feld noch mit diesem Wert überein,
//    gilt es als automatisch (kleines ✨ am Feld) und darf aktualisiert werden, zum Beispiel wenn sich die
//    Strecke ändert. Sobald du es änderst, gehört es dir.
//  - Ohne Netz: Kilometer als Schätzung aus der Luftlinie („ca.“), die später durch die Straßenroute ersetzt wird.
//    Wetter kommt, sobald wieder Netz da ist.
//  - Wetter nur für Tage bis heute. Ein Tagebuch hält fest, was war, keine Vorhersage.

import { berechneRoute } from './routing.js'
import { sterneBewertung, sterneIcon } from './sterne.js'
import { wetterBild } from './wetter.js'
import { metWetter } from './wetter-ausweich.js'
import { zieleVon } from './plan.js'
import { je } from './i18n.js'
import { terminGilt } from './buchung.js'

export const AUTO_FELDER = ['distance_km', 'temp_celsius', 'weather_feeling', 'night_sky', 'verkehrsmittel']
export const UMWEG = 1.25                       // wie im Fahrtag-Planer: Luftlinie → Straße
const WETTER_FRISCH_MS = 3 * 3600e3            // heutiges Wetter höchstens alle drei Stunden neu
const MAX_PUNKTE = 5

// ---------------------------------------------------------------- Hilfen

const leer = (w) => w == null || w === '' || (Array.isArray(w) && w.length === 0)
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b) || (typeof a !== 'object' && typeof b !== 'object' && String(a) === String(b))

/** Ist das Feld noch so, wie die App es automatisch eingetragen hat? */
export function istAuto(eintrag, fid) {
  const a = eintrag?.autoFelder?.[fid]
  const w = eintrag?.felder?.[fid]
  return !!a && !leer(w) && gleich(w, a.w)
}
/** Automatischer Wert, aber nur geschätzt (km ohne Netz) */
export const istSchaetzung = (eintrag, fid) => istAuto(eintrag, fid) && !!eintrag.autoFelder[fid].ca

/** Darf die App das Feld setzen? Leer oder noch ihr eigener Wert. */
export const darfSetzen = (eintrag, fid) => leer(eintrag?.felder?.[fid]) || istAuto(eintrag, fid)

/** Punkte der Strecke des Tages: Ort plus Ziele, nur mit Koordinaten */
export function punkteVon(eintrag) {
  const alle = [{ name: eintrag?.ort, lat: eintrag?.lat, lon: eintrag?.lon }, ...zieleVon(eintrag)]
  return alle.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
}
export const punkteSig = (p) => p.map((x) => `${x.lat.toFixed(3)},${x.lon.toFixed(3)}`).join(';')

/** Verschiedene Orte (für das Wetter reicht jeder Ort einmal) */
export function verschiedene(p, max = MAX_PUNKTE) {
  const seen = new Set(), out = []
  for (const x of p) {
    const k = `${x.lat.toFixed(2)},${x.lon.toFixed(2)}`
    if (!seen.has(k)) { seen.add(k); out.push(x) }
  }
  return out.slice(0, max)
}

function luftKm(a, b) {
  const R = 6371, r = Math.PI / 180
  const dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
/** Geschätzte Straßenkilometer aus der Luftlinie */
export function schaetzKm(p) {
  let s = 0
  for (let i = 1; i < p.length; i++) s += luftKm(p[i - 1], p[i])
  return Math.round(s * UMWEG)
}

// ---------------------------------------------------------------- Verkehrsmittel

const ART_TAG = { auto: '🚗 Auto', flug: '✈️ Flug', boot: '🚤 Boot', bahn: '🚆 Bahn' }
const BUCHUNG_TAG = {
  flight: '✈️ Flug', flug: '✈️ Flug',
  faehre: '⛴️ Fähre', boat: '⛴️ Fähre',
  train: '🚆 Bahn', bahn: '🚆 Bahn',
  shuttle: '🚌 Bus', bus: '🚌 Bus',
  car: '🚗 Auto', camper: '🚗 Auto', fahrzeug: '🚗 Auto',
}
const REIHE = ['✈️ Flug', '🚗 Auto', '🚤 Boot', '⛴️ Fähre', '🚆 Bahn', '🚌 Bus']

/**
 * Verkehrsmittel des Tages aus der Art der Etappe, den Buchungen an dem Tag und ob eine Straßenstrecke da ist.
 * @returns Liste in der Reihenfolge der Auswahl im Logbuch, oder [] wenn nichts bekannt ist
 */
export function verkehrsmittelFuer({ art = null, buchungen = [], strasse = false } = {}) {
  const s = new Set()
  for (const b of buchungen || []) { const t = BUCHUNG_TAG[b?.kat]; if (t) s.add(t) }
  if (art && ART_TAG[art]) s.add(ART_TAG[art])
  if (strasse && !s.size) s.add('🚗 Auto')
  return REIHE.filter((x) => s.has(x))
}

/** Buchungen, die an einem der Tage liegen */
export function buchungenAm(events = [], tage = []) {
  const set = new Set(tage)
  return (events || []).filter((e) => terminGilt(e) && set.has(e.datum))
}

// ---------------------------------------------------------------- Wetter

const TAGES_WERTE = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean,cloud_cover_mean'

export function tageZwischen(von, bis) {
  const a = Date.parse(von + 'T12:00:00Z'), b = Date.parse(bis + 'T12:00:00Z')
  return Math.round((b - a) / 86400e3)
}

/** Adresse für die Tageswerte: bis 92 Tage zurück die Vorhersage-Schnittstelle, davor das Archiv */
export function wetterAdresse(punkte, von, bis, heute) {
  const lat = punkte.map((p) => p.lat.toFixed(3)).join(','), lon = punkte.map((p) => p.lon.toFixed(3)).join(',')
  const archiv = tageZwischen(von, heute) > 90
  const basis = archiv ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast'
  const werte = archiv ? TAGES_WERTE : TAGES_WERTE + ',uv_index_max'
  return `${basis}?latitude=${lat}&longitude=${lon}&daily=${werte}&timezone=auto&start_date=${von}&end_date=${bis}`
}
export const archivAdresse = (punkte, von, bis) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${punkte.map((p) => p.lat.toFixed(3)).join(',')}&longitude=${punkte.map((p) => p.lon.toFixed(3)).join(',')}&daily=${TAGES_WERTE}&timezone=auto&start_date=${von}&end_date=${bis}`

const zahlen = (xs) => (xs || []).filter((x) => Number.isFinite(x))
const groesster = (xs) => { const z = zahlen(xs); return z.length ? Math.max(...z) : null }
const kleinster = (xs) => { const z = zahlen(xs); return z.length ? Math.min(...z) : null }
const mittel = (xs) => { const z = zahlen(xs); return z.length ? z.reduce((a, b) => a + b, 0) / z.length : null }

/**
 * Antworten von Open-Meteo (ein Ort: Objekt, mehrere: Liste) zu einem Tageswert zusammenfassen.
 * Über die Strecke und alle Tage: wärmster Höchstwert, kühlster Tiefstwert, schlechtestes Wetter.
 */
export function fasseZusammen(antwort) {
  const liste = (Array.isArray(antwort) ? antwort : [antwort]).map((a) => a?.daily).filter(Boolean)
  if (!liste.length) return null
  const alle = (k) => liste.flatMap((d) => d[k] || [])
  const max = groesster(alle('temperature_2m_max')), min = kleinster(alle('temperature_2m_min'))
  if (max == null || min == null) return null
  const code = groesster(alle('weather_code'))
  return {
    code, max: Math.round(max), min: Math.round(min),
    gefuehlt: groesster(alle('apparent_temperature_max')) == null ? null : Math.round(groesster(alle('apparent_temperature_max'))),
    regen: groesster(alle('precipitation_sum')),
    wind: groesster(alle('wind_speed_10m_max')) == null ? null : Math.round(groesster(alle('wind_speed_10m_max'))),
    feuchte: mittel(alle('relative_humidity_2m_mean')) == null ? null : Math.round(mittel(alle('relative_humidity_2m_mean'))),
    wolken: mittel(alle('cloud_cover_mean')) == null ? null : Math.round(mittel(alle('cloud_cover_mean'))),
    uv: groesster(alle('uv_index_max')) == null ? null : Math.round(groesster(alle('uv_index_max'))),
  }
}

const komma = (x) => String(Math.round(x * 10) / 10).replace('.', je(',', '.'))

/** „☀️ 24 / 12 °C · Klar · 2 mm Regen · Wind bis 20 km/h“ */
export function wetterText(w) {
  if (!w) return ''
  const [icon, text] = wetterBild(w.code)
  const teile = [`${icon} ${w.max} / ${w.min} °C`, text]
  if (w.regen != null && w.regen >= 0.5) teile.push(je(`${komma(w.regen)} mm Regen`, `${komma(w.regen)} mm rain`))
  if (w.wind != null) teile.push(je(`Wind bis ${w.wind} km/h`, `wind up to ${w.wind} km/h`))
  return teile.join(' · ')
}

/** „Gefühlt bis 27 °C · UV 9 · Luftfeuchte 35 %“ */
export function gefuehltText(w) {
  if (!w || w.gefuehlt == null) return ''
  const teile = [je(`Gefühlt bis ${w.gefuehlt} °C`, `Feels like up to ${w.gefuehlt} °C`)]
  if (w.uv != null) teile.push(`UV ${w.uv}`)
  if (w.feuchte != null) teile.push(je(`Luftfeuchte ${w.feuchte} %`, `humidity ${w.feuchte} %`))
  return teile.join(' · ')
}

/** „⭐ Gut · Mond 23 % (zunehmend) · Wolken 40 %“ */
export function sterneText(p, datum, wolken = null) {
  if (!p || !datum) return ''
  const s = sterneBewertung(p.lat, p.lon, datum, wolken)
  const teile = [`${sterneIcon(s.sterne)} ${s.label}`, je(`Mond ${s.mondProzent} % (${s.phaseName})`, `moon ${s.mondProzent} % (${s.phaseName})`)]
  if (!s.astroDunkel) teile.push(je('keine astronomische Dunkelheit', 'no astronomical darkness'))
  if (wolken != null) teile.push(je(`Wolken ${wolken} %`, `clouds ${wolken} %`))
  return teile.join(' · ')
}

async function holeJson(url, f) {
  const r = await f(url)
  if (!r.ok) throw new Error('Wetter ' + r.status)
  const j = await r.json()
  if (j?.error) throw new Error(j.reason || 'Wetter')
  return j
}

/**
 * Tageswetter für die Punkte zwischen `von` und `bis` (beide ≤ heute).
 * Fällt Open-Meteo aus: für vergangene Tage das Archiv, für heute MET Norway (nur der erste Ort).
 * @returns { werte, final } final = der Tag ist vorbei, die Werte ändern sich nicht mehr
 */
export async function holeTageswetter(punkte, von, bis, heute, { f = fetch, met = metWetter } = {}) {
  const p = verschiedene(punkte)
  if (!p.length) return null
  const final = bis < heute
  try {
    return { werte: fasseZusammen(await holeJson(wetterAdresse(p, von, bis, heute), f)), final }
  } catch (e) {
    if (final && tageZwischen(bis, heute) >= 2) {
      try { return { werte: fasseZusammen(await holeJson(archivAdresse(p, von, bis), f)), final } } catch {}
    }
    if (bis === heute) {
      const d = await met(p[0].lat, p[0].lon)
      const c = d.current
      return {
        werte: {
          code: c.weather_code, max: Math.round(d.daily.temperature_2m_max[0]), min: Math.round(d.daily.temperature_2m_min[0]),
          gefuehlt: null, regen: null, wind: Math.round(c.wind_speed_10m), feuchte: Math.round(c.relative_humidity_2m ?? 0) || null,
          wolken: c.cloud_cover == null ? null : Math.round(c.cloud_cover), uv: null,
        },
        final: false,
      }
    }
    throw e
  }
}

// ---------------------------------------------------------------- Ablauf

/**
 * Werte für einen Eintrag ermitteln (mit Netz auch Route und Wetter).
 * ctx: { online, heute, art, buchungen, strecke: { km, sig } | null, jetzt, route, wetter }
 * @returns { werte: { fid: { w, ca? } }, stand } stand wird am Eintrag gemerkt (autoStand)
 */
export async function ermittle(eintrag, ctx = {}, { erzwingen = false } = {}) {
  const { online = true, heute, art = null, buchungen = [], strecke = null, jetzt = Date.now() } = ctx
  const route = ctx.route || berechneRoute
  const alt = erzwingen ? {} : (eintrag.autoStand || {})
  const stand = { ...(eintrag.autoStand || {}) }
  const werte = {}
  const p = punkteVon(eintrag)
  const sig = punkteSig(p)
  const datum = eintrag.datum
  const kmBekannt = !leer(eintrag.felder?.distance_km)

  // Kilometer
  let strasse = false
  if (p.length >= 2) {
    const schonGut = alt.kmSig === sig && istAuto(eintrag, 'distance_km') && !eintrag.autoFelder.distance_km.ca
    if (schonGut) strasse = true
    else if (darfSetzen(eintrag, 'distance_km')) {
      let km = null, ca = false
      if (online) { try { km = (await route(p)).km; strasse = true } catch {} }
      if (km == null) { km = schaetzKm(p); ca = true }
      if (km > 0) {
        werte.distance_km = ca ? { w: km, ca: true } : { w: km }
        if (!ca) stand.kmSig = sig
      }
    }
  } else if (strecke?.km != null && darfSetzen(eintrag, 'distance_km') && (!kmBekannt || alt.kmSig !== strecke.sig)) {
    werte.distance_km = { w: strecke.km }
    stand.kmSig = strecke.sig
    strasse = true
  } else if (strecke?.km != null) strasse = true

  // Wetter (nur bis heute)
  const wp = p.length ? p : []
  let wolken = null
  if (datum && heute && datum <= heute && wp.length) {
    const bis = eintrag.bis && eintrag.bis < heute ? eintrag.bis : (eintrag.bis ? heute : datum)
    // Wetter hängt nur an den verschiedenen Orten: die Rückfahrt zum Start fragt nicht neu
    const wsig = `${punkteSig(verschiedene(wp))}|${datum}|${bis}`
    const frisch = alt.wetterSig === wsig && (alt.wetterFinal || (alt.wetterAm && jetzt - alt.wetterAm < WETTER_FRISCH_MS))
    const braucht = ['temp_celsius', 'weather_feeling', 'night_sky'].some((f) => darfSetzen(eintrag, f))
    if (!frisch && braucht && online) {
      try {
        const r = await holeTageswetter(wp, datum, bis, heute, ctx.wetter ? { f: ctx.wetter, met: ctx.met || metWetter } : {})
        if (r?.werte) {
          const tx = wetterText(r.werte), gt = gefuehltText(r.werte)
          if (tx && darfSetzen(eintrag, 'temp_celsius')) werte.temp_celsius = { w: tx }
          if (gt && darfSetzen(eintrag, 'weather_feeling')) werte.weather_feeling = { w: gt }
          wolken = r.werte.wolken
          stand.wetterSig = wsig; stand.wetterAm = jetzt; stand.wetterFinal = !!r.final; stand.wolken = wolken
        }
      } catch {}
    } else if (alt.wetterSig === wsig) wolken = stand.wolken ?? null
    // Sternenhimmel: am Ort der Nacht (letzter Punkt), Mond auch ohne Netz
    if (darfSetzen(eintrag, 'night_sky')) {
      const st = sterneText(wp[wp.length - 1], bis, wolken)
      if (st) werte.night_sky = { w: st }
    }
  }

  // Verkehrsmittel
  if (darfSetzen(eintrag, 'verkehrsmittel')) {
    const vm = verkehrsmittelFuer({ art, buchungen, strasse: strasse || p.length >= 2 })
    if (vm.length) werte.verkehrsmittel = { w: vm }
  }
  return { werte, stand }
}

/**
 * Ermittelte Werte auf den aktuellen Stand des Eintrags anwenden. Prüft noch einmal, ob das Feld frei ist,
 * denn während der Abfrage kann man getippt haben.
 * @returns Patch für updateJournalEintrag oder null, wenn sich nichts ändert
 */
export function wendeAn(eintrag, { werte, stand }) {
  const felder = { ...(eintrag.felder || {}) }
  const autoFelder = { ...(eintrag.autoFelder || {}) }
  let geaendert = false
  for (const [fid, v] of Object.entries(werte || {})) {
    if (!AUTO_FELDER.includes(fid) || !darfSetzen(eintrag, fid)) continue
    if (gleich(felder[fid], v.w) && gleich(autoFelder[fid], v)) continue
    felder[fid] = v.w
    autoFelder[fid] = v
    geaendert = true
  }
  // Vermerke zu Feldern, die man inzwischen selbst geändert oder geleert hat, aufräumen
  for (const fid of Object.keys(autoFelder)) {
    if (!istAuto({ felder, autoFelder }, fid)) { delete autoFelder[fid]; geaendert = true }
  }
  const standNeu = !gleich(stand || {}, eintrag.autoStand || {})
  if (!geaendert && !standNeu) return null
  return { felder, autoFelder, autoStand: stand || eintrag.autoStand || {} }
}

/** Kurzer Bericht für die Zeile unter den Quick-Stats */
export function bericht(werte = {}) {
  const n = []
  if (werte.distance_km) n.push(werte.distance_km.ca ? je('km geschätzt', 'km estimated') : 'km')
  if (werte.temp_celsius) n.push(je('Wetter', 'weather'))
  if (werte.night_sky) n.push(je('Sternenhimmel', 'night sky'))
  if (werte.verkehrsmittel) n.push(je('Verkehrsmittel', 'transport'))
  return n.join(', ')
}
