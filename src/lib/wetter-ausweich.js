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
