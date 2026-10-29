// Sonnenzeiten aus Koordinaten + Datum — rein rechnerisch, funktioniert OFFLINE.
import * as SunCalc from 'suncalc'
import { LOCALE } from './i18n.js'
import { ZWEI } from './format.js'

/** Australische Zeitzone aus den Koordinaten — grob nach Bundesstaatsgrenzen.
 *  Wichtig für die Ostküste: Melbourne liegt 2 h vor Perth, und im Dezember/Januar
 *  gilt dort zusätzlich Sommerzeit. Die IANA-Zonen rechnen das selbst mit. */
export function zeitzoneFuer(lat, lon) {
  if (lat == null || lon == null) return 'Australia/Perth'
  if (lon < 129) return 'Australia/Perth'                       // WA — UTC+8, keine Sommerzeit
  if (lon < 141) return lat > -26 ? 'Australia/Darwin'          // NT — UTC+9:30, keine Sommerzeit
                                  : 'Australia/Adelaide'        // SA — UTC+9:30 mit Sommerzeit
  if (lat < -40) return 'Australia/Hobart'                      // Tasmanien
  if (lat > -29) return 'Australia/Brisbane'                    // QLD — UTC+10, keine Sommerzeit
  return 'Australia/Sydney'                                     // NSW/VIC — UTC+10 mit Sommerzeit
}

export function sonnenZeiten(lat, lon, datum, tz = null) {
  tz = tz || zeitzoneFuer(lat, lon)
  const d = new Date(datum + 'T12:00:00Z')
  const t = SunCalc.getTimes(d, lat, lon)
  const fmt = (date) =>
    date && !isNaN(date.getTime())
      ? date.toLocaleTimeString(LOCALE, { timeZone: tz, hour: ZWEI, minute: '2-digit' })
      : '—'
  return {
    aufgang: fmt(t.sunrise),
    untergang: fmt(t.sunset),
    mittag: fmt(t.solarNoon),
    // Blaue Stunde morgens: Dämmerung -> Sonnenaufgang
    blauMorgen: [fmt(t.dawn), fmt(t.sunrise)],
    // Goldene Stunde morgens: Aufgang -> Ende der goldenen Stunde
    goldenMorgen: [fmt(t.sunrise), fmt(t.goldenHourEnd)],
    // Goldene Stunde abends: Beginn -> Untergang
    goldenAbend: [fmt(t.goldenHour), fmt(t.sunset)],
    // Blaue Stunde abends: Untergang -> Dämmerung
    blauAbend: [fmt(t.sunset), fmt(t.dusk)],
  }
}
