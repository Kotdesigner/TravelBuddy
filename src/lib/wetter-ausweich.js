// Zweiter Wetterdienst (MET Norway, weltweit, ohne Schlüssel). Springt ein, wenn Open-Meteo
// ausfällt oder sein Tageslimit erreicht ist. Liefert dieselben Felder wie Open-Meteo.
const URL_MET = 'https://api.met.no/weatherapi/locationforecast/2.0/complete'
const FRISCH = 15 * 60 * 1000
const KMH = 3.6
let speicher = null

/** Symbolname von MET als WMO-Wettercode. */
export function wmoVon(symbol = '') {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '')
  if (s.includes('thunder')) return 95
  if (s.includes('snow') || s.includes('sleet')) return 71
  if (s.includes('heavyrain')) return 65
  if (s.includes('lightrain')) return 61
  if (s.includes('rain')) return 80
  if (s === 'fog') return 45
  if (s === 'cloudy') return 3
  if (s === 'partlycloudy') return 2
  if (s === 'fair') return 1
  return 0
}

/** Antwort von MET in die Form von Open-Meteo bringen. */
export function umformen(roh) {
  const zeilen = roh?.properties?.timeseries || []
  if (!zeilen.length) throw new Error('MET ohne Daten')
  const d = (z) => z.data.instant.details, jetzt = zeilen[0], nah = jetzt.data.next_1_hours || jetzt.data.next_6_hours
  const tag = zeilen.slice(0, 24).map((z) => d(z).air_temperature)
  return {
    current: {
      temperature_2m: d(jetzt).air_temperature, weather_code: wmoVon(nah?.summary?.symbol_code),
      wind_speed_10m: d(jetzt).wind_speed * KMH, relative_humidity_2m: d(jetzt).relative_humidity, cloud_cover: d(jetzt).cloud_area_fraction,
    },
    daily: { temperature_2m_max: [Math.max(...tag)], temperature_2m_min: [Math.min(...tag)] },
    hourly: {
      time: zeilen.map((z) => Date.parse(z.time) / 1000),
      cloud_cover: zeilen.map((z) => d(z).cloud_area_fraction ?? null),
      cloud_cover_low: zeilen.map((z) => d(z).cloud_area_fraction_low ?? null),
      cloud_cover_mid: zeilen.map((z) => d(z).cloud_area_fraction_medium ?? null),
      cloud_cover_high: zeilen.map((z) => d(z).cloud_area_fraction_high ?? null),
      wind_speed_10m: zeilen.map((z) => (d(z).wind_speed ?? 0) * KMH),
      wind_gusts_10m: zeilen.map((z) => (d(z).wind_speed_of_gust ?? d(z).wind_speed ?? 0) * KMH),
      temperature_2m: zeilen.map((z) => d(z).air_temperature ?? null),
      dew_point_2m: zeilen.map((z) => d(z).dew_point_temperature ?? null),
      precipitation_probability: zeilen.map((z) => z.data.next_1_hours?.details?.probability_of_precipitation ?? null),
    },
  }
}

// Schlimmeres Wetter von zweien: Gewitter (95) geht immer vor, sonst der höhere WMO-Code
const schlimmer = (a, b) => (a === 95 || b === 95 ? 95 : Math.max(a, b))

/**
 * MET-Vorhersage als Tageswerte wie Open-Meteo „daily“: Höchsttemperatur, Regensumme, stärkste Böe,
 * schlimmstes Wetter, je Ortstag (Zeitzone tz). Für das Wetter an der Strecke, wenn Open-Meteo ausfällt.
 * Stündliche Zeilen zählen ihren Regen der nächsten Stunde, die späteren 6-Stunden-Zeilen ihre 6 Stunden.
 */
export function metTage(roh, tz = 'Australia/Perth', tage = 3) {
  const zeilen = roh?.properties?.timeseries || []
  if (!zeilen.length) throw new Error('MET ohne Daten')
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const tageMap = new Map()
  for (const z of zeilen) {
    const tag = fmt.format(new Date(z.time))
    if (!tageMap.has(tag)) { if (tageMap.size >= tage) break; tageMap.set(tag, { max: -99, regen: 0, boe: 0, code: 0 }) }
    const x = tageMap.get(tag), det = z.data?.instant?.details || {}
    if (det.air_temperature != null) x.max = Math.max(x.max, det.air_temperature)
    x.boe = Math.max(x.boe, (det.wind_speed_of_gust ?? det.wind_speed ?? 0) * KMH)
    const naechste = z.data?.next_1_hours || z.data?.next_6_hours
    if (naechste) {
      x.regen += naechste.details?.precipitation_amount ?? 0
      x.code = schlimmer(x.code, wmoVon(naechste.summary?.symbol_code))
    }
  }
  const t = [...tageMap.keys()], w = [...tageMap.values()]
  return { daily: { time: t, temperature_2m_max: w.map((x) => x.max), precipitation_sum: w.map((x) => Math.round(x.regen * 10) / 10),
    wind_gusts_10m_max: w.map((x) => Math.round(x.boe)), weather_code: w.map((x) => x.code) } }
}

/** Tageswerte von MET für mehrere Punkte, je Punkt eine Anfrage, höchstens drei gleichzeitig */
export async function metTageFuer(punkte, zeitzone, f = fetch) {
  const out = new Array(punkte.length)
  let i = 0
  async function arbeiter() {
    while (i < punkte.length) {
      const k = i++, p = punkte[k]
      const r = await f(`${URL_MET}?lat=${Math.round(p.lat * 100) / 100}&lon=${Math.round(p.lon * 100) / 100}`)
      if (!r.ok) throw new Error('MET nicht erreichbar')
      out[k] = metTage(await r.json(), zeitzone(p.lat, p.lon))
    }
  }
  await Promise.all([arbeiter(), arbeiter(), arbeiter()])
  return out
}

/** Wetter am Ort von MET, höchstens alle 15 Minuten neu. */
export async function metWetter(lat, lon, jetzt = Date.now()) {
  const a = Math.round(lat * 100) / 100, b = Math.round(lon * 100) / 100
  if (speicher && jetzt - speicher.zeit < FRISCH && speicher.a === a && speicher.b === b) return speicher.werte
  const r = await fetch(`${URL_MET}?lat=${a}&lon=${b}`)
  if (!r.ok) throw new Error('MET nicht erreichbar')
  const werte = umformen(await r.json())
  speicher = { zeit: jetzt, a, b, werte }
  return werte
}
