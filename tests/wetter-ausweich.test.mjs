// Zweiter Wetterdienst: Umrechnung auf die Felder von Open-Meteo.
import assert from 'node:assert/strict'
import { umformen, wmoVon } from '../src/lib/wetter-ausweich.js'
assert.equal(wmoVon('clearsky_day'), 0)
assert.equal(wmoVon('cloudy'), 3)
assert.equal(wmoVon('fog'), 45)
assert.equal(wmoVon('lightrainshowers_night'), 61)
assert.equal(wmoVon('heavyrainandthunder'), 95)
const z = (t, temp, sym) => ({ time: t, data: { instant: { details: { air_temperature: temp, wind_speed: 10, relative_humidity: 80, cloud_area_fraction: 50, cloud_area_fraction_low: 10, dew_point_temperature: 2 } }, next_1_hours: { summary: { symbol_code: sym }, details: { probability_of_precipitation: 20 } } } })
const w = umformen({ properties: { timeseries: [z('2030-01-01T12:00:00Z', 9.8, 'cloudy'), z('2030-01-01T13:00:00Z', 12, 'rain')] } })
assert.equal(w.current.temperature_2m, 9.8)
assert.equal(w.current.weather_code, 3)
assert.equal(w.current.wind_speed_10m, 36)
assert.equal(w.daily.temperature_2m_max[0], 12)
assert.equal(w.hourly.time[0], Date.parse('2030-01-01T12:00:00Z') / 1000)
assert.equal(w.hourly.precipitation_probability[1], 20)
assert.throws(() => umformen({}))
console.log('✓ Wetter-Ausweich')
