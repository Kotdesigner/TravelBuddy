// Sternenfotografie-Eignung: Mondphase + astronomische Dunkelheit (OFFLINE via SunCalc),
// optional verfeinert mit Wolken (online).
import * as SunCalc from 'suncalc'
import { t } from './i18n.js'

/**
 * @param {number} lat @param {number} lon @param {string} datum YYYY-MM-DD
 * @param {number|null} wolken Wolken 0..100 (online), sonst null
 */
export function sterneBewertung(lat, lon, datum, wolken = null) {
  // Nachtzeitpunkt (ca. 01:00 lokal → in WA UTC+8 ≈ 17:00 UTC des Vortags; grob 15:00Z reicht für Mond)
  const d = new Date(datum + 'T15:00:00Z')
  const mi = SunCalc.getMoonIllumination(d)
  const mondHell = mi.fraction // 0 = Neumond, 1 = Vollmond
  const mondProzent = Math.round(mondHell * 100)

  // Astronomische Dunkelheit vorhanden? (Sonne < -18°)
  const zeiten = SunCalc.getTimes(d, lat, lon)
  const astroDunkel = zeiten.night instanceof Date && !isNaN(zeiten.night.getTime())

  // Score 0..1 (höher = besser): Neumond gut, Vollmond schlecht.
  let score = 1 - mondHell
  if (!astroDunkel) score *= 0.6 // keine echte Dunkelheit → schlechter
  if (wolken != null) score *= 1 - Math.min(1, wolken / 100) * 0.9 // Wolken drücken stark

  let sterne, label
  if (score >= 0.72) { sterne = 3; label = t('Exzellent') }
  else if (score >= 0.5) { sterne = 2; label = t('Gut') }
  else if (score >= 0.3) { sterne = 1; label = t('Mäßig') }
  else { sterne = 0; label = wolken != null && wolken > 60 ? t('Bewölkt') : t('Mond zu hell') }

  const phaseName = mondHell < 0.1 ? t('Neumond') : mondHell > 0.9 ? t('Vollmond')
    : mi.phase < 0.5 ? t('zunehmend') : t('abnehmend')

  return { score, sterne, label, mondProzent, phaseName, astroDunkel, wolken }
}

export function sterneIcon(sterne) {
  return sterne >= 3 ? '🌟' : sterne >= 2 ? '⭐' : sterne >= 1 ? '✨' : '🌙'
}
