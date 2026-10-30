// Die Offline-Kartenteile. Auf dem Bildschirm gibt es EINE Karte — welcher Teil gerade
// dahintersteckt, entscheidet `kartenteilFuer()` nach dem sichtbaren Ausschnitt.
//
// Zwei Sorten:
//   grob (maxzoom 8-10) — deckt große Flächen ab, damit KEINE Route mehr ins Leere zeigt
//   fein (maxzoom 13)   — nur dort, wo wir uns wirklich aufhalten: Straßennamen, Wege, Gebäude
//   groß (maxzoom 14)   — nur im Build mit großer Karte (`npm run build:gross`): ganz Western
//                         Australia mit allen Straßen und Pisten, in vier Teilen (siehe WA_GROSS)
//
// Jede Stufe vervierfacht die Kachelzahl, deshalb ist fein nur örtlich bezahlbar.
// Ausgeschnitten aus dem Protomaps-Planet-Build (Basemap v4.15.1), Stand August 2026.
// `mb` = Dateigröße in public/karten/ (für die Anzeige „noch x MB laden").
import { t, jeSprache } from './i18n.js'
const GRUNDKARTEN = () => ([
  {
    id: 'wa', name: t('Westküste'), datei: 'wa.pmtiles', mb: 10.2,
    center: [122.0, -26.0], zoom: 4.2, maxzoom: 10,
    bounds: [112.5, -35.5, 129.2, -13.5],
  },
  {
    id: 'ostkueste', name: t('Ostküste'), datei: 'ostkueste.pmtiles', mb: 23.9,
    center: [149.4, -27.2], zoom: 4.3, maxzoom: 10,
    bounds: [144.0, -39.0, 154.0, -15.5],
  },
  {
    id: 'melbourne', name: t('Melbourne & Kinglake'), datei: 'melbourne.pmtiles', mb: 23.7,
    center: [145.1, -37.7], zoom: 8.0, maxzoom: 13,
    bounds: [144.0, -38.6, 146.0, -37.0],
  },
  {
    id: 'cairns', name: t('Cairns & Tablelands'), datei: 'cairns.pmtiles', mb: 5.7,
    center: [145.65, -17.0], zoom: 8.0, maxzoom: 13,
    bounds: [145.0, -18.1, 146.4, -16.0],
  },
  {
    id: 'whitsundays', name: t('Whitsundays & Palm Bay'), datei: 'whitsundays.pmtiles', mb: 2.1,
    center: [148.75, -20.3], zoom: 9.3, maxzoom: 13,
    bounds: [148.2, -20.8, 149.3, -19.8],
  },
  {
    id: 'australien', name: t('Australien-Überblick'), datei: 'australien.pmtiles', mb: 10.2,
    center: [134.0, -26.0], zoom: 3.1, maxzoom: 8,
    bounds: [112.9, -43.7, 153.7, -9.1],
  },
])

// Große Karte: Western Australia auf Stufe 14 in vier Teilen (je unter 100 MB, 0,5° Überlappung),
// damit das iPhone nur den Teil lädt, in dem man gerade ist. Die Dateien liegen nicht im Repo,
// sondern in `karten-gross/` (holen: `sh karten-gross/holen.sh`) und kommen nur mit
// `npm run build:gross` in den Build. Quelle: Protomaps Basemap v4.15.2 (Build 20261029).
export const WA_GROSS = jeSprache(() => ([
  {
    id: 'wa-sued', name: t('Südwesten & Perth'), datei: 'wa-sued.pmtiles', mb: 75.5,
    center: [117.5, -33.2], zoom: 6.0, maxzoom: 14,
    bounds: [112.5, -35.5, 129.2, -31.0],
  },
  {
    id: 'wa-mitte', name: t('Mittlere Westküste'), datei: 'wa-mitte.pmtiles', mb: 35.5,
    center: [116.0, -28.7], zoom: 6.0, maxzoom: 14,
    bounds: [112.5, -31.5, 129.2, -26.0],
  },
  {
    id: 'wa-nordwest', name: t('Pilbara & Coral Coast'), datei: 'wa-nordwest.pmtiles', mb: 61.0,
    center: [117.0, -23.2], zoom: 6.0, maxzoom: 14,
    bounds: [112.5, -26.5, 129.2, -20.0],
  },
  {
    id: 'wa-kimberley', name: t('Kimberley & Broome'), datei: 'wa-kimberley.pmtiles', mb: 32.7,
    center: [124.0, -17.0], zoom: 6.0, maxzoom: 14,
    bounds: [112.5, -20.5, 129.2, -13.5],
  },
]))
// Vite setzt VITE_KARTE beim Bauen ein; in Node (Tests) gibt es import.meta.env nicht.
export const GROSSE_KARTE = import.meta.env?.VITE_KARTE === 'gross'
export const REGIONEN = jeSprache(() => {
  const liste = GRUNDKARTEN()
  if (GROSSE_KARTE) liste.splice(1, 0, ...WA_GROSS)
  return liste
})

// Alles, wofür es überhaupt Kartendaten gibt. Außerhalb ist die Karte leer (nur Wasserfarbe).
export const KARTENGEBIET = [
  Math.min(...REGIONEN.map((r) => r.bounds[0])),
  Math.min(...REGIONEN.map((r) => r.bounds[1])),
  Math.max(...REGIONEN.map((r) => r.bounds[2])),
  Math.max(...REGIONEN.map((r) => r.bounds[3])),
]

export function imGebiet([lon, lat], [w, s, e, n] = KARTENGEBIET) {
  return lon >= w && lon <= e && lat >= s && lat <= n
}

export function deckt(region, punkte) {
  return punkte.every((p) => imGebiet(p, region.bounds))
}

// Für die Anzeige „Details hier: …".
export function detailStufe(region) {
  if (!region) return ''
  if (region.maxzoom >= 13) return 'hoch'
  if (region.maxzoom >= 10) return 'mittel'
  return 'grob'
}

// Welcher Kartenteil passt zum sichtbaren Ausschnitt [W, S, O, N] bei diesem Zoom?
//
//  1. Beim aktuellen bleiben, solange er den Ausschnitt deckt und genug Details hat.
//     Jeder Wechsel liest eine Datei (bis 25 MB) in den Speicher — nicht ohne Not.
//  2. Sonst der gröbste Teil, der den Ausschnitt ganz deckt und für diesen Zoom genügt; genügt
//     keiner, der feinste. So lädt die App die großen Stufe-14-Teile erst beim Hineinzoomen.
//  3. Deckt keiner ganz (weit herausgezoomt, Südspitze Tasmaniens …): der Teil mit der
//     größten Überdeckung, damit möglichst wenig leer bleibt.
//
// `verfuegbar` schränkt ein, was geladen werden kann (offline nur Gespeichertes).
// Ein Teil mit maxzoom 10 zeichnet bis Zoom 10,99 mit echten Kacheln, danach vergrößert
// er nur noch — deshalb „feiner nötig" erst ab ganzzahligem Zoom über maxzoom.
export function kartenteilFuer(ausschnitt, zoom, aktuell, verfuegbar = REGIONEN) {
  if (!verfuegbar.length) return null
  const [w, s, e, n] = ausschnitt
  // 4 % Luft an jedem Rand: die Kacheln reichen ohnehin etwas über die Teilgrenze hinaus,
  // und ohne Luft würde an der Grenze bei jedem kleinen Verschieben hin- und hergewechselt.
  const dx = (e - w) * 0.04, dy = (n - s) * 0.04
  const innen = [w + dx, s + dy, e - dx, n - dy]
  const enthaelt = (r) => innen[0] >= r.bounds[0] && innen[1] >= r.bounds[1]
    && innen[2] <= r.bounds[2] && innen[3] <= r.bounds[3]
  const flaeche = (r) => (r.bounds[2] - r.bounds[0]) * (r.bounds[3] - r.bounds[1])

  const kandidaten = verfuegbar.filter(enthaelt)
  const aktuellDa = aktuell && kandidaten.some((r) => r.id === aktuell.id)
  if (aktuellDa && Math.floor(zoom) <= aktuell.maxzoom) return aktuell
  if (kandidaten.length) {
    const genuegt = kandidaten.filter((r) => Math.floor(zoom) <= r.maxzoom)
    if (genuegt.length) return [...genuegt].sort((a, b) => a.maxzoom - b.maxzoom || flaeche(a) - flaeche(b))[0]
    return [...kandidaten].sort((a, b) => b.maxzoom - a.maxzoom || flaeche(a) - flaeche(b))[0]
  }
  const ueberdeckung = (r) => {
    const bx = Math.min(e, r.bounds[2]) - Math.max(w, r.bounds[0])
    const by = Math.min(n, r.bounds[3]) - Math.max(s, r.bounds[1])
    return bx > 0 && by > 0 ? bx * by : 0
  }
  const beste = [...verfuegbar].sort((a, b) => ueberdeckung(b) - ueberdeckung(a) || b.maxzoom - a.maxzoom)[0]
  // Auch hier nicht wegen ein paar Zehntelgrad Rand wechseln: WA-Route eingepasst, Ausschnitt
  // ragt knapp westlich über beide Teile — „Westküste" deckt 0,4° mehr als „grob", zeigt bei
  // Zoom 4 aber dasselbe. Dafür 10 MB zu laden lohnt nicht.
  const aktuellV = aktuell && verfuegbar.find((r) => r.id === aktuell.id)
  if (aktuellV && Math.floor(zoom) <= aktuellV.maxzoom
    && ueberdeckung(aktuellV) >= 0.9 * ueberdeckung(beste)) return aktuellV
  return beste
}

// Linie auf ein Rechteck zuschneiden (Liang-Barsky je Teilstück).
// Ergebnis: Liste von Linienstücken — eine Route, die das Gebiet verlässt und wieder
// betritt, zerfällt in mehrere. Ein Flug Doha → Melbourne beginnt damit am Kartenrand
// über dem Indischen Ozean, statt ins Leere nach Katar zu zeigen.
export function schneideZu(punkte, [w, s, e, n] = KARTENGEBIET) {
  const teile = []
  let offen = null
  for (let i = 1; i < punkte.length; i++) {
    const [x0, y0] = punkte[i - 1], [x1, y1] = punkte[i]
    const dx = x1 - x0, dy = y1 - y0
    let t0 = 0, t1 = 1, drin = true
    for (const [p, q] of [[-dx, x0 - w], [dx, e - x0], [-dy, y0 - s], [dy, n - y0]]) {
      if (p === 0) { if (q < 0) { drin = false; break } continue }
      const r = q / p
      if (p < 0) { if (r > t1) { drin = false; break } if (r > t0) t0 = r }
      else { if (r < t0) { drin = false; break } if (r < t1) t1 = r }
    }
    if (!drin) { offen = null; continue }
    const b = [x0 + t1 * dx, y0 + t1 * dy]
    if (offen && t0 === 0) offen.push(b)
    else { offen = [[x0 + t0 * dx, y0 + t0 * dy], b]; teile.push(offen) }
    if (t1 < 1) offen = null
  }
  return teile
}

// Für Tankstellen, Wasser, Rastplätze: es gibt `pois-<id>.json` NUR für diese vier.
// Ohne diese Einschränkung gewänne „Ostküste" jeden Ostküsten-Punkt und die
// Notfall-Liste bliebe leer, weil `pois-ostkueste.json` nicht existiert.
export const POI_REGIONEN = jeSprache(() => REGIONEN.filter((r) => ['wa', 'melbourne', 'cairns', 'whitsundays'].includes(r.id)))
export function poiRegionFuer(punkte) {
  if (!punkte || !punkte.length) return null
  const flaeche = (r) => (r.bounds[2] - r.bounds[0]) * (r.bounds[3] - r.bounds[1])
  return POI_REGIONEN.filter((r) => deckt(r, punkte))
    .sort((a, b) => flaeche(a) - flaeche(b))[0] || null
}
