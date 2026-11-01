// Kamerafahrt der Reise: Verkehrsmittel, Entfernung und wie weit die Kamera herauszoomt.
// Reine Rechnungen, gemalt wird in ReiseKarte.svelte und reisefilm-zeichnen.js.
const RAD = Math.PI / 180

/** flug, bahn, boot oder auto. Alte Autorouten mit Fähre im Namen gelten ebenfalls als Boot. */
export function artDerTour(r) {
  const art = r?.art || 'auto'
  if (art === 'bahn' || art === 'boot') return art
  if (art === 'flug' || r?.route?.flug) return 'flug'
  return /boot|boat|fähre|faehre|ferry|schiff|kreuzfahrt|cruise/i.test(r?.name || '') ? 'boot' : 'auto'
}

/** Verkehrsmittel eines Logbuch-Tages aus „Verkehrsmittel heute“. */
export function artDesTages(e) {
  const v = (e?.felder?.verkehrsmittel || []).join(' ')
  if (/Boot|Fähre/.test(v)) return 'boot'
  if (/Flug/.test(v)) return 'flug'
  if (/Bahn/.test(v)) return 'bahn'
  return 'auto'
}

/** Kann dieser Tag in den Film? Ort und alle Ziele brauchen einen Kartenpunkt. */
export function tagesPunkte(e) {
  const ziele = Array.isArray(e?.ziele) ? e.ziele : e?.ziel ? [e.ziel] : []
  const alle = [e?.lat != null ? { lat: e.lat, lon: e.lon } : null, ...ziele]
  return { punkte: alle.filter((p) => p?.lat != null).map((p) => [p.lon, p.lat]), ziele: ziele.length, vollstaendig: alle.every((p) => p?.lat != null) }
}

/** Ausgewählte Logbuch-Strecken als Touren, nach Datum. */
export function logbuchTouren(journal = [], farbe = '#2a6fb5') {
  return (journal || []).filter((e) => e?.imFilm && tagesPunkte(e).punkte.length >= 2)
    .map((e) => {
      const coords = tagesPunkte(e).punkte, ziele = (Array.isArray(e.ziele) ? e.ziele : [e.ziel]).filter(Boolean)
      return { id: 'log-' + e.id, name: [e.ort, ...ziele.map((z) => z.name)].filter(Boolean).join(' → '), farbe, datum: e.datum, art: artDesTages(e), geo: coords, stops: coords.map(([lon, lat]) => ({ lon, lat })) }
    }).sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
}

const strecke = (a, b) => {
  const f1 = a[1] * RAD, f2 = b[1] * RAD, dl = (b[0] - a[0]) * RAD
  const h = Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Linie mit aufsummierten Kilometern. */
export function verlauf(coords = []) {
  const km = [0]
  for (let i = 1; i < coords.length; i++) km.push(km[i - 1] + strecke(coords[i - 1], coords[i]))
  return { coords, km, gesamt: km[km.length - 1] || 0 }
}

/** Punkt bei Anteil p der Strecke, dazu die Richtung in Grad (0 = Norden). */
export function punktBei(v, p) {
  const c = v.coords
  if (c.length < 2) return { lon: c[0]?.[0] ?? 0, lat: c[0]?.[1] ?? 0, richtung: 0 }
  const ziel = v.gesamt * Math.min(1, Math.max(0, p))
  let i = 1
  while (i < c.length - 1 && v.km[i] < ziel) i++
  const l = v.km[i] - v.km[i - 1], k = l ? (ziel - v.km[i - 1]) / l : 0
  const a = c[i - 1], b = c[i]
  const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD)
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD)
  return { lon: a[0] + (b[0] - a[0]) * k, lat: a[1] + (b[1] - a[1]) * k, richtung: (Math.atan2(y, x) / RAD + 360) % 360 }
}

export const NAH_ZOOM = 11.5
// Mit Auto und Bahn bleibt die Kamera weiter weg, die Strecke zählt, nicht jede Straße der Stadt
export const nahZoom = (art) => (art === 'auto' || art === 'bahn' ? 10 : NAH_ZOOM)

/** Gleichmäßige, leicht geglättete Linie für Fahrzeug und Kamera: kein Abbiegen an jeder Ecke. */
export function glaette(v, stuecke = 300) {
  if (v.coords.length < 3 || !v.gesamt) return v
  const dicht = Array.from({ length: stuecke + 1 }, (_, i) => { const o = punktBei(v, i / stuecke); return [o.lon, o.lat] })
  const r = Math.round(Math.min(1.5, v.gesamt * 0.02) / (v.gesamt / stuecke))
  return verlauf(dicht.map((c, i) => {
    const w = Math.min(r, i, stuecke - i), teil = dicht.slice(i - w, i + w + 1)
    return [teil.reduce((s, x) => s + x[0], 0) / teil.length, teil.reduce((s, x) => s + x[1], 0) / teil.length]
  }))
}
/** Zoom, bei dem `km` rund 60 % der Bildbreite füllen. Kleine Strecken bleiben also nah. */
export function spitzenZoom(km, breitePx = 400, lat = -25) {
  const z = Math.log2((78271 * Math.cos(lat * RAD) * breitePx * 0.6) / Math.max(1, km * 1000))
  return Math.min(NAH_ZOOM, Math.max(1.6, z))
}

/** Anzoomen: erst langsam, dann immer schneller. */
export const anzoom = (p) => Math.max(0, Math.min(1, p)) ** 3
/** Anteil der Fahrt, nach dem die Kamera ganz draußen ist. Lange Flüge zoomen früh heraus. */
export function auszoomAnteil(art, km) {
  if (art === 'flug' && km >= 300) return 0.12
  return km >= 300 ? 0.3 : 0.5
}
/** Während der Fahrt: bis Anteil `aus` heraus, draußen bleiben, zum Ziel wieder herein. */
export function zoomBei(p, nah, spitze, aus = 0.5) {
  const q = Math.max(0, Math.min(1, p)), k = Math.min(1, Math.min(q, 1 - q) / aus)
  return nah + (spitze - nah) * k * k * (3 - 2 * k)
}
/** Sekunden je Fahrt: längere Strecken dauern länger, aber nie endlos. */
export const dauerFuer = (km) => Math.min(8, 3 + 1.2 * Math.log10(km + 1))

export const kmText = (km, zahl = String) => (km < 10 ? `${zahl(Math.round(km * 10) / 10)} km` : `${zahl(Math.round(km))} km`)

// Fahrzeuge von oben, Spitze nach Norden, Ansicht 24 × 24
export const FAHRZEUG = {
  flug: 'M12 2c1 0 1.6 1.6 1.6 3.6v4.1l8 4.7v2.2l-8-2.5v4.4l2.4 1.8V21L12 20l-4 1v-1.7l2.4-1.8v-4.4l-8 2.5v-2.2l8-4.7V5.6C10.4 3.6 11 2 12 2z',
  auto: 'M10 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm-.5 6v3h5V9a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1z',
  boot: 'M12 2c3 3 5 7 5 11v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7c0-4 2-8 5-11z',
  bahn: 'M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v4h6V5H9z',
}
