// Wetter von Open-Meteo (kostenlos, kein Key) — nur ONLINE nutzbar.
import { t, jeSprache } from './i18n.js'
const WMO = jeSprache(() => ({
  0: ['☀️', t('Klar')], 1: ['🌤️', t('Überwiegend klar')], 2: ['⛅', t('Teils bewölkt')], 3: ['☁️', t('Bewölkt')],
  45: ['🌫️', t('Nebel')], 48: ['🌫️', t('Reifnebel')],
  51: ['🌦️', t('Leichter Niesel')], 53: ['🌦️', t('Niesel')], 55: ['🌦️', t('Starker Niesel')],
  61: ['🌧️', t('Leichter Regen')], 63: ['🌧️', t('Regen')], 65: ['🌧️', t('Starker Regen')],
  66: ['🌧️', t('Gefrierender Regen')], 67: ['🌧️', t('Starker gefr. Regen')],
  71: ['🌨️', t('Leichter Schnee')], 73: ['🌨️', t('Schnee')], 75: ['🌨️', t('Starker Schnee')],
  80: ['🌦️', t('Schauer')], 81: ['🌧️', t('Kräftige Schauer')], 82: ['⛈️', t('Heftige Schauer')],
  95: ['⛈️', t('Gewitter')], 96: ['⛈️', t('Gewitter mit Hagel')], 99: ['⛈️', t('Starkes Gewitter')],
}))

export async function holeWetter(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,cloud_cover`
    + `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`
  const r = await fetch(url)
  if (!r.ok) throw new Error(t('Wetter nicht erreichbar'))
  const d = await r.json()
  const c = d.current
  const [icon, text] = WMO[c.weather_code] || ['🌡️', '—']
  return {
    icon, text,
    temp: Math.round(c.temperature_2m),
    wind: Math.round(c.wind_speed_10m),
    feuchte: c.relative_humidity_2m,
    wolken: c.cloud_cover,
    max: Math.round(d.daily.temperature_2m_max[0]),
    min: Math.round(d.daily.temperature_2m_min[0]),
    einheit: d.current_units.temperature_2m || '°C',
  }
}
