// Wetter-abgeleitete Gefahren-Einschätzung über Open-Meteo (online, ohne Server).
// KEINE amtlichen Warnungen — nur Risiko-Indikatoren aus der Vorhersage.
import { t, je, jeSprache } from './i18n.js'

export const STUFEN = jeSprache(() => ({ 0: 'keine', 1: t('erhöht'), 2: 'hoch', 3: 'extrem' }))
export const STUFE_FARBE = { 1: '#c9a227', 2: '#d97a2b', 3: '#c0392b' }

// `typ` bleibt deutsch, auch im Zwischenspeicher, weil er die Gefahren zusammenfasst. Angezeigt wird typName.
export function typName(typ) {
  const namen = { Hitze: je('Hitze', 'Heat'), Überflutung: je('Überflutung', 'Flooding'), Starkregen: je('Starkregen', 'Heavy rain'), Regen: je('Regen', 'Rain'), Sturm: je('Sturm', 'Storm'), Wind: je('Wind', 'Wind'), Gewitter: je('Gewitter', 'Thunderstorm') }
  return namen[typ] || typ
}

// Schwellen (australischer Sommer-Kontext), max über die nächsten Tage.
function bewerteTag(temp, regen, boe, code) {
  const g = []
  // Hitze
  if (temp >= 44) g.push({ typ: 'Hitze', icon: '🔥', stufe: 3, text: t('{round}°C — extreme Hitze', { round: Math.round(temp) }) })
  else if (temp >= 40) g.push({ typ: 'Hitze', icon: '🌡️', stufe: 2, text: t('{round}°C — sehr heiß', { round: Math.round(temp) }) })
  else if (temp >= 36) g.push({ typ: 'Hitze', icon: '🌡️', stufe: 1, text: t('{round}°C — heiß', { round: Math.round(temp) }) })
  // Starkregen / Überflutung
  if (regen >= 80) g.push({ typ: 'Überflutung', icon: '🌊', stufe: 3, text: t('{round} mm — Überflutungsgefahr', { round: Math.round(regen) }) })
  else if (regen >= 40) g.push({ typ: 'Starkregen', icon: '🌧️', stufe: 2, text: t('{round} mm Regen', { round: Math.round(regen) }) })
  else if (regen >= 15) g.push({ typ: 'Regen', icon: '🌧️', stufe: 1, text: t('{round} mm Regen', { round: Math.round(regen) }) })
  // Sturm (Böen)
  if (boe >= 90) g.push({ typ: 'Sturm', icon: '🌪️', stufe: 3, text: t('Böen {round} km/h', { round: Math.round(boe) }) })
  else if (boe >= 65) g.push({ typ: 'Sturm', icon: '💨', stufe: 2, text: t('Böen {round} km/h', { round: Math.round(boe) }) })
  else if (boe >= 45) g.push({ typ: 'Wind', icon: '💨', stufe: 1, text: t('Böen {round} km/h', { round: Math.round(boe) }) })
  // Gewitter (WMO 95/96/99)
  if ([96, 99].includes(code)) g.push({ typ: 'Gewitter', icon: '⛈️', stufe: 2, text: t('Schweres Gewitter') })
  else if (code === 95) g.push({ typ: 'Gewitter', icon: '⛈️', stufe: 1, text: t('Gewitter') })
  return g
}

/** Aus einem Open-Meteo-Ergebnis die schlimmste Gefahr je Typ über die Tage ableiten. */
export function bewerte(res) {
  const d = res?.daily
  if (!d?.time) return { stufe: 0, gefahren: [] }
  const proTyp = new Map()
  for (let i = 0; i < d.time.length; i++) {
    const tag = bewerteTag(d.temperature_2m_max?.[i] ?? -99, d.precipitation_sum?.[i] ?? 0, d.wind_gusts_10m_max?.[i] ?? 0, d.weather_code?.[i] ?? 0)
    for (const g of tag) {
      const e = { ...g, tag: d.time[i], wannIdx: i }
      const vorh = proTyp.get(g.typ)
      if (!vorh || g.stufe > vorh.stufe) proTyp.set(g.typ, e)
    }
  }
  const gefahren = [...proTyp.values()].sort((a, b) => b.stufe - a.stufe)
  const stufe = gefahren.reduce((m, g) => Math.max(m, g.stufe), 0)
  return { stufe, gefahren }
}

const URL = 'https://api.open-meteo.com/v1/forecast'
const FELDER = 'temperature_2m_max,precipitation_sum,wind_gusts_10m_max,weather_code'

async function fetchBatch(punkte) {
  const lat = punkte.map((p) => p.lat).join(',')
  const lon = punkte.map((p) => p.lon).join(',')
  const u = `${URL}?latitude=${lat}&longitude=${lon}&daily=${FELDER}&forecast_days=3&timezone=auto`
  const r = await fetch(u)
  if (!r.ok) throw new Error(t('Wetterdienst nicht erreichbar'))
  const data = await r.json()
  return Array.isArray(data) ? data : [data]
}

/** Gefahren für viele Punkte (chunked). Gibt Array gleicher Länge zurück. */
export async function holeGefahren(punkte) {
  const gueltig = punkte.filter((p) => p.lat != null && p.lon != null)
  const out = new Map()
  const CHUNK = 100
  for (let i = 0; i < gueltig.length; i += CHUNK) {
    const teil = gueltig.slice(i, i + CHUNK)
    const res = await fetchBatch(teil)
    teil.forEach((p, k) => out.set(p.id, bewerte(res[k])))
  }
  return out
}

/** Einzelnen Standort auswerten (aktuelle Position + grob Umkreis). */
export async function holeStandortGefahr(lat, lon, umkreisKm = 100) {
  // Im eingestellten Umkreis: 5 Punkte, Zentrum und je einer nach N, O, S, W.
  const d = Math.max(25, umkreisKm) / 111
  const punkte = [
    { id: 'c', lat, lon }, { id: 'n', lat: lat + d, lon }, { id: 's', lat: lat - d, lon },
    { id: 'o', lat, lon: lon + d }, { id: 'w', lat, lon: lon - d },
  ]
  const res = await fetchBatch(punkte)
  const bewertungen = res.map(bewerte)
  // schlimmste je Typ über alle Umkreis-Punkte
  const proTyp = new Map()
  bewertungen.forEach((b) => b.gefahren.forEach((g) => {
    const v = proTyp.get(g.typ)
    if (!v || g.stufe > v.stufe) proTyp.set(g.typ, g)
  }))
  const gefahren = [...proTyp.values()].sort((a, b) => b.stufe - a.stufe)
  return { stufe: gefahren.reduce((m, g) => Math.max(m, g.stufe), 0), gefahren, zentrum: bewertungen[0] }
}
