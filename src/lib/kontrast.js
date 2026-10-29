// Lesbare Schrift auf einer beliebigen Hintergrundfarbe.
//
// Viele Plaketten bekommen ihre Farbe erst zur Laufzeit (Warnstufe, Reisefarbe,
// POI-Kategorie). Weiß darauf war auf Gelb/Orange kaum lesbar (Prüfung 19.09.: 1,9–3,0 : 1,
// WCAG verlangt 4,5 : 1). Das offizielle australische Warnsystem setzt auf Gelb und
// Orange deshalb selbst dunkle Schrift.

const DUNKEL = '#1f1408'

function leuchtdichte(hex) {
  let h = String(hex || '').trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}/i.test(h)) return null
  const k = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]
}

/** Kontrastverhältnis zweier Hex-Farben (1 … 21). */
export function kontrast(a, b) {
  const x = leuchtdichte(a), y = leuchtdichte(b)
  if (x == null || y == null) return 21
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/**
 * Weiß, wenn es auf `hintergrund` mindestens 4,5 : 1 erreicht — sonst Dunkelbraun.
 * Bei Mitteltönen (Reise-Orange #c1662f, Karten-Blau #1c7ed6) schafft keins von beiden
 * die 4,5 : 1 (gemessen 4,1–4,48) — dann reines Schwarz, das kommt auf ≥ 4,8 : 1.
 */
export function schriftAuf(hintergrund) {
  if (kontrast('#ffffff', hintergrund) >= 4.5) return '#ffffff'
  if (kontrast(DUNKEL, hintergrund) >= 4.5) return DUNKEL
  return '#000000'
}
