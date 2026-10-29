// Straßenlage WA: Sperrungen und Hinweise von Main Roads WA (reine Logik, ohne Speicher).
//
// Quelle: „WebEOC Road Closures“, ein öffentlicher ArcGIS FeatureServer von Main Roads WA.
// CORS erlaubt, kein Schlüssel (am 11.10.2026 in Safari und Chromium geprüft).
// Die Meldungen sind Linien (Straßenabschnitte), manchmal Punkte. Deshalb rechnet der
// Abstand hier Punkt zu Strecke und nicht Punkt zu Punkt.
//
// Die Meldungen landen bewusst NICHT im Topf der amtlichen Warnungen (DFES, VIC, QLD):
// „Open with caution“ wegen eines Schlaglochs ist keine Feuerwarnung und würde die Zahl
// auf Heute aufblähen. Für Abstand und Umkreis gilt aber dieselbe Rechnung
// (abstandKm aus warnungen.js versteht Linien).

import { abstandKm, warnungenFuer } from './warnungen.js'
import { stichproben } from './routenhinweise.js'
import { LOCALE, t, tn, istEn } from './i18n.js'
import { ZWEI } from './format.js'

export const MAINROADS_URL =
  'https://services2.arcgis.com/cHGEnmsJ165IBJRM/arcgis/rest/services/WebEoc_RoadClosures/FeatureServer/4/query?where=1%3D1&outFields=*&f=geojson'
export const KARTE_URL = 'https://travelmap.mainroads.wa.gov.au/'
export const QUELLE_NAME = 'Main Roads WA'

// ---------- Einstufung ----------
// 3 gesperrt · 2 teilweise gesperrt oder eingeschränkt · 1 befahrbar mit Vorsicht · 0 Hinweis
export const STRASSEN_STUFE = {
  3: { label: t('gesperrt'), farbe: '#c0392b', icon: '⛔' },
  2: { label: t('teilweise gesperrt'), farbe: '#e8730c', icon: '🚧' },
  1: { label: t('befahrbar mit Vorsicht'), farbe: '#e0a800', icon: '⚠️' },
  0: { label: t('Hinweis'), farbe: '#8a7565', icon: 'ℹ️' },
}

/** Rang aus ClosureTyp (und zur Not IncidentTy). Unbekannte Werte landen bei 1. */
export function stufeAus(closureTyp, incidentTy = '') {
  const s = String(closureTyp || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (!s) {
    // Ohne Angabe zur Sperrung: nur bei eindeutigem Ereignis höher, sonst Vorsicht.
    return /closed|closure/i.test(incidentTy || '') ? 2 : 1
  }
  if (/\b(partial|partially|lane|one lane|single lane|shoulder|restricted|restriction|heavy vehicles?|detour|diversion|4wd|four wheel)\b/.test(s)) return 2
  if (/\bclosed\b|\bclosure\b/.test(s)) return 3
  if (/caution|care|delays?|reduced|speed/.test(s)) return 1
  if (/\b(re-?opened|open|clear(ed)?)\b/.test(s)) return 0
  return 1
}

// ---------- Kurzübersetzung ----------
// Reihenfolge zählt: längere Wendungen zuerst, ein Treffer verbraucht seinen Text.
const GLOSSAR = [
  [/road closed to heavy vehicles|closed to heavy vehicles|heavy vehicles? (only )?restrict\w*/, t('für Lkw und Gespanne gesperrt')],
  [/road open with caution|open with caution/, t('befahrbar mit Vorsicht')],
  [/partial(ly)? clos\w*|partially closed/, t('teilweise gesperrt')],
  [/lanes? clos\w*/, t('Fahrspur gesperrt')],
  [/(one|single) lane( open)?/, t('nur eine Spur frei')],
  [/road closed|closed to all traffic|closure|closed/, t('gesperrt')],
  [/re-?opened|road open|now open/, t('wieder frei')],
  [/restricted access|access restricted|restrictions?/, t('eingeschränkt befahrbar')],
  [/4wd only|four wheel drive only|4wd|four wheel drive/, t('nur mit Allrad')],
  [/water over (the )?road|water across (the )?road|water on (the )?road/, t('Wasser auf der Fahrbahn')],
  [/flood(ing|ed|s)?|inundat\w*/, t('überflutet')],
  [/wash(ed)? ?outs?/, t('Fahrbahn ausgespült')],
  [/pavement damage|road surface damage|surface damage/, t('Fahrbahnschäden')],
  [/pot ?holes?/, t('Schlaglöcher')],
  [/bush ?fires?|grass ?fires?|wild ?fires?|\bfire\b/, t('Buschfeuer')],
  [/smoke/, t('Rauch, schlechte Sicht')],
  [/dust|reduced visibility|poor visibility/, t('schlechte Sicht')],
  [/(vehicle )?crash|accident|vehicle incident|collision/, t('Unfall')],
  [/road ?works?|maintenance works?|construction/, t('Baustelle')],
  [/detour|diversion|alternative route/, t('Umleitung')],
  [/traffic control|traffic management|stop\/slow|traffic controllers?/, t('Verkehrsregelung vor Ort')],
  [/reduced speed|speed restrictions?|speed limit reduced/, t('Tempo reduziert')],
  [/exercise extreme caution|extreme caution/, t('äußerste Vorsicht')],
  [/exercise caution|proceed with caution|caution|drive with care/, t('vorsichtig fahren')],
  [/expect delays|delays/, t('mit Wartezeit rechnen')],
  [/avoid (the )?(area|travel)|avoid/, t('Gebiet meiden')],
  [/emergency services( on site| in attendance)?/, t('Einsatzkräfte vor Ort')],
  [/trees? down|fallen trees?/, t('umgestürzte Bäume')],
  [/debris( on road)?/, t('Hindernisse auf der Fahrbahn')],
  [/storm damage|storms?/, t('Sturmschäden')],
  [/cyclone/, t('Zyklon')],
  [/heavy rain|\brain(fall)?\b/, t('Starkregen')],
  [/livestock|stock on road|animals?/, t('Tiere auf der Fahrbahn')],
  [/unsealed|gravel/, t('unbefestigte Straße')],
  [/bridge/, t('Brücke betroffen')],
  [/\bevent\b/, t('Veranstaltung')],
  [/isolated|in places/, 'stellenweise'],
]

/** Gängige englische Begriffe als kurze deutsche Stichworte (ohne Dubletten). */
export function uebersetze(...texte) {
  let rest = ' ' + texte.filter(Boolean).join(' . ').toLowerCase().replace(/\s+/g, ' ') + ' '
  const raus = []
  for (const [re, de] of GLOSSAR) {
    const g = new RegExp(re.source, 'g')
    if (g.test(rest)) {
      if (!raus.includes(de)) raus.push(de)
      rest = rest.replace(new RegExp(re.source, 'g'), ' ')
    }
  }
  // „stellenweise“ allein sagt nichts, nur als Zusatz zu etwas anderem.
  if (raus.length === 1 && raus[0] === 'stellenweise') return []
  return raus
}

/** Ein einzelner Begriff (Art oder Sperrung) auf Deutsch, sonst das Original. */
export function begriffDeutsch(text) {
  const t = String(text || '').trim()
  if (!t) return ''
  const d = uebersetze(t).filter((x) => x !== 'stellenweise')
  return d.length ? d.join(', ') : t
}

// ---------- Datum ----------
// Main Roads liefert „11/10/2026 12:24:18“: Tag/Monat/Jahr, Ortszeit Perth (UTC+8, keine
// Sommerzeit in WA). Manche ArcGIS-Dienste liefern stattdessen Millisekunden.
const PERTH_OFFSET_H = 8

/** Zeitpunkt in ms (UTC) oder null. */
export function datumPerth(wert) {
  if (wert == null || wert === '') return null
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null
  const s = String(wert).trim()
  if (/^\d{11,}$/.test(s)) return Number(s)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i)
  if (m) {
    let [, d, mo, y, h = '0', mi = '0', se = '0', ap] = m
    let std = Number(h)
    if (ap) { const pm = ap.toLowerCase() === 'pm'; if (std === 12) std = pm ? 12 : 0; else if (pm) std += 12 }
    const tag = Number(d), monat = Number(mo)
    if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null
    return Date.UTC(Number(y), monat - 1, tag, std - PERTH_OFFSET_H, Number(mi), Number(se))
  }
  const iso = Date.parse(s)
  return Number.isNaN(iso) ? null : iso
}

/** „11.10.2026, 12:24 Uhr“ in Perther Zeit. */
export function formatPerth(ms) {
  if (ms == null || !Number.isFinite(ms)) return ''
  try {
    const s = new Intl.DateTimeFormat(LOCALE, {
      timeZone: 'Australia/Perth', day: '2-digit', month: '2-digit', year: 'numeric', hour: ZWEI, minute: '2-digit',
    }).format(new Date(ms))
    return istEn ? s : s + ' Uhr'
  } catch {
    const d = new Date(ms + PERTH_OFFSET_H * 3600e3)
    const z = (n) => String(n).padStart(2, '0')
    return `${z(d.getUTCDate())}.${z(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}, ${z(d.getUTCHours())}:${z(d.getUTCMinutes())} Uhr`
  }
}

/** „vor 3 Std.“ und Ähnliches, für den Kopf einer Meldung. */
export function alterText(ms, jetzt = Date.now()) {
  if (ms == null) return ''
  const min = Math.round((jetzt - ms) / 60000)
  if (min < 2) return t('gerade eben')
  if (min < 60) return t('vor {n} Min.', { n: min })
  const h = Math.round(min / 60)
  if (h < 36) return t('vor {n} Std.', { n: h })
  const tage = Math.round(h / 24)
  return tn(tage, 'vor {n} Tag', 'vor {n} Tagen')
}

// ---------- Geometrie ----------
function linienAus(g) {
  const linien = [], punkte = []
  const eins = (x) => {
    if (!x || !x.coordinates && x.type !== 'GeometryCollection') return
    if (x.type === 'LineString') linien.push(x.coordinates)
    else if (x.type === 'MultiLineString') linien.push(...x.coordinates)
    else if (x.type === 'Point') punkte.push(x.coordinates)
    else if (x.type === 'MultiPoint') punkte.push(...x.coordinates)
    else if (x.type === 'Polygon') linien.push(...x.coordinates)
    else if (x.type === 'MultiPolygon') x.coordinates.forEach((p) => linien.push(...p))
    else if (x.type === 'GeometryCollection') (x.geometries || []).forEach(eins)
  }
  eins(g)
  const gut = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
  return {
    linien: linien.map((l) => (l || []).filter(gut)).filter((l) => l.length),
    punkte: punkte.filter(gut),
  }
}

const sauber = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

// ---------- Parser ----------
/** GeoJSON von Main Roads → Meldungen im selben Grundformat wie Warnungen. */
export function liesStrassen(d) {
  const feats = Array.isArray(d?.features) ? d.features : []
  const raus = []
  for (const f of feats) {
    const p = f?.properties || {}
    if (p.publishExt && !/^(yes|y|true|1)$/i.test(String(p.publishExt).trim())) continue
    const { linien, punkte } = linienAus(f.geometry)
    if (!linien.length && !punkte.length) continue
    const ort = sauber(p.Location)
    const strasse = sauber(p.Road) || sauber(p.LocalRoadName) || sauber(ort.split(' - ')[0]) || t('Straße')
    const rang = stufeAus(p.ClosureTyp, p.IncidentTy)
    const st = STRASSEN_STUFE[rang]
    const ms = datumPerth(p.UpdateDate) ?? datumPerth(p.EntryDate)
    const hinweis = sauber(p.TrafficImp)
    const link = /^https:\/\//i.test(sauber(p.SeeMoreUrl)) ? sauber(p.SeeMoreUrl) : ''
    raus.push({
      id: 'mrwa:' + (p.Id ?? p.FID ?? raus.length),
      quelle: 'mainroads', staat: 'WA', rang,
      level: st.label, farbe: st.farbe, icon: st.icon,
      strasse,
      ortsname: sauber(p.LocalRoadName) && sauber(p.LocalRoadName) !== strasse ? sauber(p.LocalRoadName) : '',
      ort,
      art: sauber(p.IncidentTy),
      artDe: begriffDeutsch(p.IncidentTy),
      sperrung: sauber(p.ClosureTyp),
      sperrungDe: sauber(p.ClosureTyp) ? begriffDeutsch(p.ClosureTyp) : st.label,
      hinweis,
      hinweisDe: uebersetze(hinweis, ort.split(' - ').slice(1).join(' ')),
      region: sauber(p.Region),
      gemeinde: sauber(p.Suburb),
      zeit: ms != null ? new Date(ms).toISOString() : null,
      zeitMs: ms,
      link,
      linien, punkte, ringe: [],
    })
  }
  raus.sort((a, b) => b.rang - a.rang || (b.zeitMs || 0) - (a.zeitMs || 0))
  return raus
}

// ---------- Abruf ----------
/**
 * Holt die Meldungen. Wirft nicht: liefert { meldungen, fehler }.
 * `fetchFn` lässt sich in Tests ersetzen.
 */
export async function holeStrassenlage(fetchFn = globalThis.fetch, { timeoutMs = 15000 } = {}) {
  let timer
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
    if (ctl) timer = setTimeout(() => ctl.abort(), timeoutMs)
    const r = await fetchFn(MAINROADS_URL, ctl ? { signal: ctl.signal } : undefined)
    if (!r || !r.ok) throw new Error(`HTTP ${r?.status ?? '?'}`)
    const d = await r.json()
    if (d?.error) throw new Error(d.error.message || t('Dienstfehler'))
    if (!Array.isArray(d?.features)) throw new Error(t('unerwartete Antwort'))
    return { meldungen: liesStrassen(d), fehler: null }
  } catch (e) {
    const grund = e?.name === 'AbortError' ? t('Zeitüberschreitung') : (e?.message || t('nicht erreichbar'))
    return { meldungen: null, fehler: `${QUELLE_NAME}: ${grund}` }
  } finally { clearTimeout(timer) }
}

// ---------- Bezug zu Orten und Position ----------
/** Meldungen im Umkreis von Orten und/oder Position, jeweils mit `km` und `naheBei`. */
export function strassenInDerNaehe(meldungen, { orte = [], position = null, umkreisKm = 150 } = {}) {
  const raus = []
  for (const m of meldungen || []) {
    let km = Infinity, naheBei = ''
    if (position?.lat != null) {
      const d = abstandKm(m, position.lat, position.lon)
      if (d < km) { km = d; naheBei = t('deinem Standort') }
    }
    for (const o of orte) {
      if (o?.lat == null) continue
      const d = abstandKm(m, o.lat, o.lon)
      if (d < km) { km = d; naheBei = o.name || t('einem Ort') }
      if (km === 0) break
    }
    if (km <= umkreisKm) raus.push({ ...m, km, naheBei })
  }
  return raus.sort((a, b) => b.rang - a.rang || a.km - b.km)
}

/** Meldungen um einen Punkt (gleiche Rechnung wie bei den Warnungen). */
export const strassenFuer = (meldungen, lat, lon, umkreisKm = 0) => warnungenFuer(meldungen, lat, lon, umkreisKm)

// ---------- Bezug zu geplanten Routen ----------
function bbox(m, randKm) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const add = (p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }
  m.linien.forEach((l) => l.forEach(add)); m.punkte.forEach(add)
  const dy = randKm / 110.57
  const cos = Math.max(0.2, Math.cos((((y0 + y1) / 2) * Math.PI) / 180))
  const dx = randKm / (111.32 * cos)
  return [x0 - dx, y0 - dy, x1 + dx, y1 + dy]
}

/** Gefahrene (nicht geflogene) Reisen mit berechneter Linie. */
export function routenMitLinie(reisen) {
  return (reisen || []).filter((r) => {
    const g = r?.route?.geometry
    return Array.isArray(g) && g.length >= 2 && !r.route.flug && r.art !== 'flug'
  })
}

/**
 * Welche Meldungen liegen höchstens `maxKm` neben einer geplanten Route?
 * Liefert je Treffer { meldung, reiseId, reiseName, kmVon, kmBis, km, abstand, text }.
 * kmVon/kmBis: Streckenkilometer ab Routenstart, wo die Meldung beginnt und endet;
 * km: Streckenkilometer der dichtesten Stelle.
 */
export function strassenAnRouten(meldungen, reisen, { maxKm = 2, schrittKm = 0.5 } = {}) {
  const treffer = []
  const liste = (meldungen || []).filter((m) => (m.linien?.length || m.punkte?.length))
  if (!liste.length) return treffer
  for (const r of routenMitLinie(reisen)) {
    const proben = stichproben(r.route.geometry, schrittKm)
    for (const m of liste) {
      const [x0, y0, x1, y1] = m._bbox || (m._bbox = bbox(m, maxKm + schrittKm))
      let kmVon = Infinity, kmBis = -Infinity, abstand = Infinity, kmNaechst = 0
      for (const s of proben) {
        if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue
        const d = abstandKm(m, s.y, s.x)
        if (d <= maxKm) {
          if (s.km < kmVon) kmVon = s.km
          if (s.km > kmBis) kmBis = s.km
          if (d < abstand) { abstand = d; kmNaechst = s.km }
        }
      }
      if (kmVon === Infinity) continue
      const name = r.name || t('deine Route')
      const a = Math.round(kmVon), b = Math.round(kmBis)
      const text = b - a >= 5
        ? `Betrifft deine Route ${name} zwischen km ${a} und ${b}`
        : `Betrifft deine Route ${name} bei km ${Math.round(kmNaechst)}`
      treffer.push({ meldung: m, reiseId: r.id, reiseName: name, kmVon, kmBis, km: kmNaechst, abstand, text })
    }
  }
  for (const m of liste) delete m._bbox
  return treffer.sort((x, y) => y.meldung.rang - x.meldung.rang || x.reiseName.localeCompare(y.reiseName) || x.kmVon - y.kmVon)
}

/**
 * Zahlen für Kopfzeilen und Heute. Getrennt von den amtlichen Warnungen:
 * `sperrungen` zählt nur echte Sperrungen (Rang 3), die nah an Orten/Position oder auf
 * einer Route liegen. `gesamt` alle relevanten Straßenmeldungen.
 */
export function zaehleStrassen(meldungen, { orte = [], position = null, umkreisKm = 150, reisen = [] } = {}) {
  const nah = strassenInDerNaehe(meldungen, { orte, position, umkreisKm })
  const route = strassenAnRouten(meldungen, reisen)
  const ids = new Set([...nah.map((m) => m.id), ...route.map((t) => t.meldung.id)])
  const alle = (meldungen || []).filter((m) => ids.has(m.id))
  return {
    gesamt: alle.length,
    sperrungen: alle.filter((m) => m.rang >= 3).length,
    teilweise: alle.filter((m) => m.rang === 2).length,
    aufRoute: new Set(route.map((t) => t.meldung.id)).size,
    sperrungenAufRoute: new Set(route.filter((t) => t.meldung.rang >= 3).map((t) => t.meldung.id)).size,
  }
}
