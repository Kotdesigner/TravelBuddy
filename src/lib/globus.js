// Weltkugel (V4): Geometrie und ein kleiner Renderer für gemalte 3D-Globen.
//
// Zwei Nutzer:
//  - die Reise-Karte (MapLibre im Globus-Modus) braucht Großkreise für Flüge und ein
//    Gradnetz,
//  - das Tagebuch zeichnet je Etappe eine Weltkugel als Bild (Canvas, ohne WebGL), damit
//    sie auch im Druck und im PDF steht und nicht ein Dutzend WebGL-Karten offen sind.
//
// Der Renderer schaut wie eine Kamera aus der Höhe auf die Kugel (Zentralperspektive).
// Liegt die Etappe eng beisammen, rückt die Kamera näher heran: die Gegend wird groß,
// der Rand der Kugel bleibt trotzdem sichtbar. Licht von links oben, Glanz auf dem
// Meer, ein Hauch Atmosphäre am Rand.

import { WORLD_RINGS } from './geo-world.js'

const RAD = Math.PI / 180
const klemme = (x, a, b) => (x < a ? a : x > b ? b : x)

export function vektor([lon, lat]) {
  const l = lon * RAD, p = lat * RAD, c = Math.cos(p)
  return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)]
}
export function lonlat([x, y, z]) {
  return [Math.atan2(y, x) / RAD, Math.asin(klemme(z, -1, 1)) / RAD]
}
const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }

/** Längen ohne Sprung über die Datumsgrenze (MapLibre zeichnet sonst einmal um die Welt). */
export function entwirren(pkt) {
  const out = []
  let vor = null
  for (const [lon, lat] of pkt) {
    let l = lon
    if (vor != null) { while (l - vor > 180) l -= 360; while (vor - l > 180) l += 360 }
    out.push([l, lat]); vor = l
  }
  return out
}

/** Großkreis von a nach b, etwa alle `schritt` Grad ein Punkt. */
export function grosskreis(a, b, schritt = 2) {
  const va = vektor(a), vb = vektor(b)
  const d = Math.acos(klemme(punkt(va, vb), -1, 1))
  if (d < 1e-6) return [a, b]
  const n = Math.max(1, Math.ceil(d / RAD / schritt)), s = Math.sin(d)
  const out = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s
    out.push(lonlat([va[0] * k1 + vb[0] * k2, va[1] * k1 + vb[1] * k2, va[2] * k1 + vb[2] * k2]))
  }
  return out
}

/** Flugstrecken als Bögen über die Kugel, Straßen bleiben wie sie sind. */
export function verdichte(geo, flug) {
  if (!geo || geo.length < 2) return geo || []
  if (!flug) return entwirren(geo)
  const out = []
  for (let i = 1; i < geo.length; i++) {
    const teil = grosskreis(geo[i - 1], geo[i])
    out.push(...(i > 1 ? teil.slice(1) : teil))
  }
  return entwirren(out)
}

/** Gradnetz alle 30° als Linien (für die Reise-Karte). */
export function gradnetz(abstand = 30) {
  const f = []
  for (let lon = -180; lon < 180; lon += abstand) {
    const c = []; for (let lat = -80; lat <= 80; lat += 2) c.push([lon, lat])
    f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })
  }
  for (let lat = -60; lat <= 60; lat += abstand) {
    const c = []; for (let lon = -180; lon <= 180; lon += 2) c.push([lon, lat])
    f.push({ type: 'Feature', properties: { aequator: lat === 0 ? 1 : 0 }, geometry: { type: 'LineString', coordinates: c } })
  }
  return { type: 'FeatureCollection', features: f }
}

/** Welt-Landmassen als GeoJSON (Natural Earth 110 m), Ringe ohne Datumsgrenzen-Streifen. */
export function weltGeojson() {
  return {
    type: 'FeatureCollection',
    features: WORLD_RINGS.map((r) => ({
      type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [schliesse(ringOhneSprung(r))] },
    })),
  }
}
// Ringe, die über die Datumsgrenze laufen (Fidschi, Tschukotka, Antarktis), zogen in
// MapLibre einen Streifen einmal um die Welt (Prüfung 10.10.). Längen fortlaufend
// schreiben; die Antarktis über den Südpol schließen.
function ringOhneSprung(ring) {
  const p = entwirren(ring)
  const spanne = p[p.length - 1][0] - p[0][0]
  if (Math.abs(spanne) > 300) {
    const pol = p[0][1] < 0 ? -90 : 90
    p.push([p[p.length - 1][0], pol], [p[0][0], pol])
  }
  return p
}
function schliesse(ring) {
  const a = ring[0], z = ring[ring.length - 1]
  return a[0] === z[0] && a[1] === z[1] ? ring : [...ring, a]
}

/** Mittelpunkt und Kameraabstand so, dass alle Punkte gut ins Bild passen.
    P = Abstand der Kamera vom Kugelmittelpunkt in Erdradien (groß = Orthografie). */
export function blick(punkte, { fuellen = 0.62, minP = 1.25, maxP = 40, mitte = null } = {}) {
  const v = punkte.map(vektor)
  let m = mitte ? vektor(mitte) : v.reduce((s, x) => [s[0] + x[0], s[1] + x[1], s[2] + x[2]], [0, 0, 0])
  if (!v.length && !mitte) return { mitte: [134, -25], P: 6 }
  if (Math.hypot(m[0], m[1], m[2]) < 1e-6) m = v[0]
  m = norm(m)
  let alpha = 0
  for (const x of v) alpha = Math.max(alpha, Math.acos(klemme(punkt(m, x), -1, 1)))
  alpha = alpha * 1.12 + 1.2 * RAD
  const r = (P) => (Math.sqrt(P * P - 1) * Math.sin(alpha)) / (P - Math.cos(alpha))
  let P
  if (Math.sin(alpha) >= fuellen || alpha >= 80 * RAD) P = maxP
  else {
    let lo = Math.max(minP, 1.0005 / Math.cos(alpha)), hi = maxP
    if (r(lo) <= fuellen) P = lo
    else {
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (r(mid) > fuellen) lo = mid; else hi = mid }
      P = (lo + hi) / 2
    }
  }
  return { mitte: lonlat(m), P }
}

// ---------- Landmaske: einmal die Weltkarte in ein Raster malen ----------
let maske = null
function landMaske() {
  if (maske) return maske
  const w = 1440, h = 720
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000'
  for (const ring of WORLD_RINGS) {
    const p = ringOhneSprung(ring)
    for (const off of [-360, 0, 360]) {
      ctx.beginPath()
      p.forEach(([lon, lat], i) => {
        const x = ((lon + off + 180) / 360) * w, y = ((90 - lat) / 180) * h
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      })
      ctx.closePath(); ctx.fill()
    }
  }
  const d = ctx.getImageData(0, 0, w, h).data
  const a = new Uint8Array(w * h)
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]
  maske = { w, h, a }
  return maske
}
function landAnteil(m, lon, lat) {
  const x = ((lon + 180) / 360) * m.w - 0.5, y = ((90 - lat) / 180) * m.h - 0.5
  const x0 = Math.floor(x), y0 = klemme(Math.floor(y), 0, m.h - 2)
  const fx = x - x0, fy = klemme(y - y0, 0, 1)
  const xa = ((x0 % m.w) + m.w) % m.w, xb = (xa + 1) % m.w
  const r0 = y0 * m.w, r1 = r0 + m.w
  const o = m.a[r0 + xa] * (1 - fx) + m.a[r0 + xb] * fx
  const u = m.a[r1 + xa] * (1 - fx) + m.a[r1 + xb] * fx
  return (o * (1 - fy) + u * fy) / 255
}

// Farben (sRGB 0–255)
const MEER = [24, 82, 122], MEER_TIEF = [10, 34, 58]
const LAND = [214, 176, 118], OUTBACK = [201, 128, 78], EIS = [236, 241, 246]
const RAND = [150, 205, 255]

/**
 * Malt eine Weltkugel auf ein Canvas.
 * @param cv          Canvas-Element
 * @param opt.breite / opt.hoehe  CSS-Pixel
 * @param opt.mitte   [lon, lat] Blickpunkt
 * @param opt.P       Kameraabstand in Erdradien (aus blick())
 * @param opt.linien  [{ coords: [[lon,lat]…], farbe, flug }]
 * @param opt.punkte  [{ lon, lat, farbe, art: 'stopp'|'wanderung'|'ort', gross }]
 * @param opt.namen   [{ lon, lat, text }] (höchstens ein paar)
 * @param opt.dpr     Pixelverhältnis
 * @param opt.drehung zusätzliche Drehung in Grad (für die Einblend-Animation)
 */
export function zeichneGlobus(cv, opt) {
  const { breite = 220, hoehe = breite, P: P0 = 6, linien = [], punkte = [], namen = [], dpr = 1, drehung = 0, schrift = 'system-ui, -apple-system, sans-serif' } = opt
  const mitte = [opt.mitte[0] - drehung, opt.mitte[1]]
  const P = Math.max(1.02, P0)
  const W = Math.max(8, Math.round(breite * dpr)), H = Math.max(8, Math.round(hoehe * dpr))
  if (cv.width !== W) cv.width = W
  if (cv.height !== H) cv.height = H
  const ctx = cv.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  const R = Math.min(W, H) * 0.43
  const cx = W / 2, cy = H / 2
  const f = R * Math.sqrt(P * P - 1)

  // Achsen der Ansicht: Osten, Norden, zum Betrachter
  const l0 = mitte[0] * RAD, p0 = mitte[1] * RAD
  const Z = [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)]
  const E = [-Math.sin(l0), Math.cos(l0), 0]
  const N = [-Math.sin(p0) * Math.cos(l0), -Math.sin(p0) * Math.sin(l0), Math.cos(p0)]
  const L = norm([-0.5, 0.55, 0.68])
  const Hh = norm([L[0], L[1], L[2] + 1])
  const m = landMaske()

  // Gradnetz: Breite der Linie in Grad, passend zur Pixelgröße in der Bildmitte
  const pxProGrad = (f / (P - 1)) * RAD
  const netzBreite = 0.7 * dpr / Math.max(pxProGrad, 0.01)

  const img = ctx.createImageData(W, H)
  const d = img.data
  const y0 = Math.max(0, Math.floor(cy - R - 2)), y1 = Math.min(H, Math.ceil(cy + R + 2))
  const x0 = Math.max(0, Math.floor(cx - R - 2)), x1 = Math.min(W, Math.ceil(cx + R + 2))
  const PP = P * P - 1
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const sx = px + 0.5 - cx, sy = cy - (py + 0.5)
      const rr = Math.hypot(sx, sy)
      const deck = klemme(R + 0.5 - rr, 0, 1)
      if (deck <= 0) continue
      // Strahl von der Kamera (0,0,P) durch das Pixel, Schnitt mit der Einheitskugel
      const u = sx / f, v = sy / f
      const dl = Math.hypot(u, v, 1)
      const dx = u / dl, dy = v / dl, dz = -1 / dl
      const b = P * dz
      let disc = b * b - PP
      if (disc < 0) disc = 0
      const t = -b - Math.sqrt(disc)
      const nx = t * dx, ny = t * dy, nz = P + t * dz
      const wx = nx * E[0] + ny * N[0] + nz * Z[0]
      const wy = nx * E[1] + ny * N[1] + nz * Z[1]
      const wz = nx * E[2] + ny * N[2] + nz * Z[2]
      const lon = Math.atan2(wy, wx) / RAD, lat = Math.asin(klemme(wz, -1, 1)) / RAD
      const land = landAnteil(m, lon, lat)
      const al = Math.abs(lat)
      const eis = klemme((al - 58) / 10, 0, 1)
      const outback = lon > 112 && lon < 154 && lat < -11 && lat > -40 ? 1 : 0
      const lb = outback ? OUTBACK : LAND
      const tiefe = klemme(1 - nz, 0, 1)
      // Grundfarbe
      let r, g, bl
      const mr = MEER[0] * (1 - tiefe) + MEER_TIEF[0] * tiefe, mg = MEER[1] * (1 - tiefe) + MEER_TIEF[1] * tiefe, mb = MEER[2] * (1 - tiefe) + MEER_TIEF[2] * tiefe
      const lr = lb[0] * (1 - eis) + EIS[0] * eis, lg = lb[1] * (1 - eis) + EIS[1] * eis, lbb = lb[2] * (1 - eis) + EIS[2] * eis
      r = mr * (1 - land) + lr * land; g = mg * (1 - land) + lg * land; bl = mb * (1 - land) + lbb * land
      // Licht
      const ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
      const hell = 0.32 + 0.82 * ndl
      r *= hell; g *= hell; bl *= hell
      // Glanz nur auf dem Wasser
      const sp = Math.pow(Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]), 70) * 0.55 * (1 - land)
      r += 255 * sp; g += 255 * sp; bl += 255 * sp
      // Gradnetz (leicht aufgehellt)
      const dLon = Math.abs((((lon + 15) % 30) + 30) % 30 - 15) * Math.cos(lat * RAD)
      const dLat = Math.abs((((lat + 15) % 30) + 30) % 30 - 15)
      const netz = (al < 82 ? klemme(1 - dLon / netzBreite, 0, 1) : 0) + (al < 75 ? klemme(1 - dLat / netzBreite, 0, 1) : 0)
      if (netz > 0) { const k = Math.min(1, netz) * 0.13; r += (255 - r) * k; g += (255 - g) * k; bl += (255 - bl) * k }
      // Atmosphäre am Rand
      const fr = Math.pow(tiefe, 2.6) * 0.55
      r += (RAND[0] - r) * fr; g += (RAND[1] - g) * fr; bl += (RAND[2] - bl) * fr
      const i = (py * W + px) * 4
      d[i] = klemme(r, 0, 255); d[i + 1] = klemme(g, 0, 255); d[i + 2] = klemme(bl, 0, 255); d[i + 3] = 255 * deck
    }
  }
  // Leuchten um die Kugel, dann die Kugel darüber
  const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.16)
  glow.addColorStop(0, 'rgba(150,205,255,0.55)')
  glow.addColorStop(0.35, 'rgba(120,180,240,0.22)')
  glow.addColorStop(1, 'rgba(120,180,240,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2); ctx.fill()
  const zw = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H })
  zw.getContext('2d').putImageData(img, 0, 0)
  ctx.drawImage(zw, 0, 0)

  // ---- Linien, Punkte, Namen ----
  const sichtbarAb = 1 / P + 0.002
  const proj = ([lon, lat]) => {
    const w = vektor([lon, lat])
    const x = punkt(w, E), y = punkt(w, N), z = punkt(w, Z)
    if (z < sichtbarAb) return null
    const s = f / (P - z)
    return [cx + x * s, cy - y * s]
  }
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip()
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const lw = Math.max(1.4 * dpr, R / 85)
  for (const zug of [0, 1]) {
    for (const li of linien) {
      const teile = []
      let akt = []
      for (const c of li.coords || []) {
        const p = proj(c)
        if (p) akt.push(p)
        else if (akt.length) { teile.push(akt); akt = [] }
      }
      if (akt.length) teile.push(akt)
      ctx.setLineDash(zug && li.flug ? [lw * 2.4, lw * 1.8] : [])
      ctx.strokeStyle = zug ? li.farbe || '#c1662f' : 'rgba(255,255,255,0.92)'
      ctx.lineWidth = zug ? lw : lw + 2.6 * dpr
      for (const t of teile) {
        if (t.length < 2) continue
        ctx.beginPath(); t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
      }
    }
  }
  ctx.setLineDash([])
  for (const pk of punkte) {
    const p = proj([pk.lon, pk.lat])
    if (!p) continue
    const rad = (pk.gross ? 1.5 : 1) * Math.max(2.3 * dpr, R / 62)
    ctx.beginPath()
    if (pk.art === 'wanderung') {
      ctx.moveTo(p[0], p[1] - rad * 1.25); ctx.lineTo(p[0] + rad * 1.1, p[1] + rad * 0.75); ctx.lineTo(p[0] - rad * 1.1, p[1] + rad * 0.75); ctx.closePath()
    } else ctx.arc(p[0], p[1], pk.art === 'ort' ? rad * 0.8 : rad, 0, Math.PI * 2)
    ctx.fillStyle = pk.farbe || (pk.art === 'wanderung' ? '#2f7a63' : '#c1662f')
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3 * dpr
    ctx.fill(); ctx.stroke()
  }
  ctx.restore()
  // Namen: klein, mit hellem Rand, ohne sich zu überdecken
  const belegt = []
  ctx.font = `700 ${Math.round(Math.max(10.5 * dpr, R / 15))}px ${schrift}`
  ctx.textBaseline = 'middle'
  for (const n of namen) {
    const p = proj([n.lon, n.lat])
    if (!p) continue
    // Liegt der Punkt fast auf einem schon beschrifteten, keinen zweiten Namen daneben
    if (belegt.some((b) => Math.hypot(b.px - p[0], b.py - p[1]) < 16 * dpr)) continue
    const tw = ctx.measureText(n.text).width
    const links = p[0] + tw + 10 * dpr > cx + R * 0.98
    const x = links ? p[0] - 7 * dpr - tw : p[0] + 7 * dpr
    const box = [x - 3, p[1] - 8 * dpr, x + tw + 3, p[1] + 8 * dpr]
    if (belegt.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue
    box.px = p[0]; box.py = p[1]
    belegt.push(box)
    ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(n.text, x, p[1])
    ctx.fillStyle = '#2b2621'; ctx.fillText(n.text, x, p[1])
  }
}

// ---------- Ergänzung (Reise-Film, 11.10.): Projektion ohne Malen ----------
/**
 * Dieselbe Kamera wie in zeichneGlobus, aber nur die Umrechnung [lon, lat] → Pixel.
 * Damit kann man eine einmal gemalte Kugel zwischenspeichern und Linien oder Punkte
 * Bild für Bild darüber zeichnen (Reise-Film), ohne die Kugel jedes Mal neu zu rechnen.
 * @returns { proj([lon,lat]) → [x,y] | null (Rückseite), cx, cy, R, W, H }
 */
export function globusProjektion(opt) {
  const { breite = 220, hoehe = breite, P: P0 = 6, dpr = 1, drehung = 0 } = opt
  const mitte = [opt.mitte[0] - drehung, opt.mitte[1]]
  const P = Math.max(1.02, P0)
  const W = Math.max(8, Math.round(breite * dpr)), H = Math.max(8, Math.round(hoehe * dpr))
  const R = Math.min(W, H) * 0.43
  const cx = W / 2, cy = H / 2
  const f = R * Math.sqrt(P * P - 1)
  const l0 = mitte[0] * RAD, p0 = mitte[1] * RAD
  const Z = [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)]
  const E = [-Math.sin(l0), Math.cos(l0), 0]
  const N = [-Math.sin(p0) * Math.cos(l0), -Math.sin(p0) * Math.sin(l0), Math.cos(p0)]
  const sichtbarAb = 1 / P + 0.002
  const proj = ([lon, lat]) => {
    const w = vektor([lon, lat])
    const x = punkt(w, E), y = punkt(w, N), z = punkt(w, Z)
    if (z < sichtbarAb) return null
    const s = f / (P - z)
    return [cx + x * s, cy - y * s]
  }
  return { proj, cx, cy, R, W, H }
}

/**
 * Linien und Punkte im Stil von zeichneGlobus auf ein vorhandenes 2D-Bild malen
 * (weißer Saum, Farbe, Flüge gestrichelt). `versatz` und `skala` bilden die
 * Kugel-Pixel auf das Zielbild ab, wenn die Kugel verkleinert gerechnet wurde.
 */
export function zeichneUeberlagerung(ctx, projektion, { linien = [], punkte = [], dpr = 1, skala = 1, versatz = [0, 0], deckkraft = 1 } = {}) {
  const { proj, cx, cy, R } = projektion
  const abb = (p) => (p ? [versatz[0] + p[0] * skala, versatz[1] + p[1] * skala] : null)
  ctx.save()
  ctx.globalAlpha = deckkraft
  ctx.beginPath(); ctx.arc(versatz[0] + cx * skala, versatz[1] + cy * skala, R * skala, 0, Math.PI * 2); ctx.clip()
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const lw = Math.max(1.4 * dpr, (R * skala) / 85)
  for (const zug of [0, 1]) {
    for (const li of linien) {
      const teile = []
      let akt = []
      for (const c of li.coords || []) {
        const p = abb(proj(c))
        if (p) akt.push(p)
        else if (akt.length) { teile.push(akt); akt = [] }
      }
      if (akt.length) teile.push(akt)
      ctx.setLineDash(zug && li.flug ? [lw * 2.4, lw * 1.8] : [])
      ctx.strokeStyle = zug ? li.farbe || '#c1662f' : 'rgba(255,255,255,0.92)'
      ctx.lineWidth = zug ? lw : lw + 2.6 * dpr
      for (const t of teile) {
        if (t.length < 2) continue
        ctx.beginPath(); t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
      }
    }
  }
  ctx.setLineDash([])
  for (const pk of punkte) {
    const p = abb(proj([pk.lon, pk.lat]))
    if (!p) continue
    const rad = (pk.gross ? 1.5 : 1) * Math.max(2.3 * dpr, (R * skala) / 62)
    ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, Math.PI * 2)
    ctx.fillStyle = pk.farbe || '#c1662f'
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3 * dpr
    ctx.fill(); ctx.stroke()
  }
  ctx.restore()
}

/**
 * Schnellere Fassung von zeichneGlobus für Bildfolgen (Reise-Film): gleiche Kamera,
 * gleiche Farben, aber ohne Math.hypot/Math.pow in der Pixelschleife und mit
 * wiederverwendeten Puffern. Malt nur Kugel, Leuchten, Linien und Punkte (keine Namen).
 * Ergänzung 11.10.; zeichneGlobus selbst bleibt unverändert.
 */
const schnellPuffer = { W: 0, H: 0, img: null, zw: null }
export function zeichneGlobusSchnell(cv, opt) {
  const { breite = 220, hoehe = breite, P: P0 = 6, linien = [], punkte = [], dpr = 1, drehung = 0 } = opt
  const mitte = [opt.mitte[0] - drehung, opt.mitte[1]]
  const P = Math.max(1.02, P0)
  const W = Math.max(8, Math.round(breite * dpr)), H = Math.max(8, Math.round(hoehe * dpr))
  if (cv.width !== W) cv.width = W
  if (cv.height !== H) cv.height = H
  const ctx = cv.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  const R = Math.min(W, H) * 0.43
  const cx = W / 2, cy = H / 2
  const f = R * Math.sqrt(P * P - 1)
  const l0 = mitte[0] * RAD, p0 = mitte[1] * RAD
  const Z0 = Math.cos(p0) * Math.cos(l0), Z1 = Math.cos(p0) * Math.sin(l0), Z2 = Math.sin(p0)
  const E0 = -Math.sin(l0), E1 = Math.cos(l0)
  const N0 = -Math.sin(p0) * Math.cos(l0), N1 = -Math.sin(p0) * Math.sin(l0), N2 = Math.cos(p0)
  const L = norm([-0.5, 0.55, 0.68])
  const Hh = norm([L[0], L[1], L[2] + 1])
  const m = landMaske()
  const mw = m.w, mh = m.h, ma = m.a
  const pxProGrad = (f / (P - 1)) * RAD
  const netzBreite = 0.7 * dpr / Math.max(pxProGrad, 0.01)
  const inv = 1 / RAD

  if (schnellPuffer.W !== W || schnellPuffer.H !== H) {
    schnellPuffer.W = W; schnellPuffer.H = H
    schnellPuffer.img = ctx.createImageData(W, H)
    schnellPuffer.zw = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H })
  }
  const img = schnellPuffer.img
  const d = img.data
  d.fill(0)
  const y0 = Math.max(0, Math.floor(cy - R - 2)), y1 = Math.min(H, Math.ceil(cy + R + 2))
  const x0 = Math.max(0, Math.floor(cx - R - 2)), x1 = Math.min(W, Math.ceil(cx + R + 2))
  const PP = P * P - 1
  const R2 = (R + 0.5) * (R + 0.5)
  for (let py = y0; py < y1; py++) {
    const sy = cy - (py + 0.5)
    for (let px = x0; px < x1; px++) {
      const sx = px + 0.5 - cx
      const rq = sx * sx + sy * sy
      if (rq >= R2) continue
      const rr = Math.sqrt(rq)
      let deck = R + 0.5 - rr
      if (deck > 1) deck = 1
      const u = sx / f, v = sy / f
      const dl = Math.sqrt(u * u + v * v + 1)
      const dx = u / dl, dy = v / dl, dz = -1 / dl
      const b = P * dz
      let disc = b * b - PP
      if (disc < 0) disc = 0
      const t = -b - Math.sqrt(disc)
      const nx = t * dx, ny = t * dy, nz = P + t * dz
      const wx = nx * E0 + ny * N0 + nz * Z0
      const wy = nx * E1 + ny * N1 + nz * Z1
      const wz = ny * N2 + nz * Z2
      const lon = Math.atan2(wy, wx) * inv
      const lat = Math.asin(wz > 1 ? 1 : wz < -1 ? -1 : wz) * inv
      // Land (bilinear aus der Maske)
      const mx = ((lon + 180) / 360) * mw - 0.5, my = ((90 - lat) / 180) * mh - 0.5
      const mx0 = Math.floor(mx)
      let my0 = Math.floor(my); if (my0 < 0) my0 = 0; else if (my0 > mh - 2) my0 = mh - 2
      const fx = mx - mx0
      let fy = my - my0; if (fy < 0) fy = 0; else if (fy > 1) fy = 1
      const xa = ((mx0 % mw) + mw) % mw, xb = (xa + 1) % mw
      const r0 = my0 * mw, r1 = r0 + mw
      const land = ((ma[r0 + xa] * (1 - fx) + ma[r0 + xb] * fx) * (1 - fy) + (ma[r1 + xa] * (1 - fx) + ma[r1 + xb] * fx) * fy) / 255
      const al = lat < 0 ? -lat : lat
      let eis = (al - 58) / 10; if (eis < 0) eis = 0; else if (eis > 1) eis = 1
      const lb = lon > 112 && lon < 154 && lat < -11 && lat > -40 ? OUTBACK : LAND
      let tiefe = 1 - nz; if (tiefe < 0) tiefe = 0; else if (tiefe > 1) tiefe = 1
      const mr = MEER[0] + (MEER_TIEF[0] - MEER[0]) * tiefe, mg = MEER[1] + (MEER_TIEF[1] - MEER[1]) * tiefe, mb = MEER[2] + (MEER_TIEF[2] - MEER[2]) * tiefe
      const lr = lb[0] + (EIS[0] - lb[0]) * eis, lg = lb[1] + (EIS[1] - lb[1]) * eis, lbb = lb[2] + (EIS[2] - lb[2]) * eis
      let r = mr + (lr - mr) * land, g = mg + (lg - mg) * land, bl = mb + (lbb - mb) * land
      let ndl = nx * L[0] + ny * L[1] + nz * L[2]; if (ndl < 0) ndl = 0
      const hell = 0.32 + 0.82 * ndl
      r *= hell; g *= hell; bl *= hell
      let s = nx * Hh[0] + ny * Hh[1] + nz * Hh[2]
      if (s > 0.9 && land < 1) {
        s *= s; s *= s; s *= s; s *= s; s *= s; s *= s   // s^64
        const sp = s * 0.55 * (1 - land) * 255
        r += sp; g += sp; bl += sp
      }
      let ml = (lon + 195) % 30; if (ml < 0) ml += 30
      let mt = (lat + 105) % 30; if (mt < 0) mt += 30
      const dLon = (ml > 15 ? ml - 15 : 15 - ml) * Math.sqrt(wx * wx + wy * wy)
      const dLat = mt > 15 ? mt - 15 : 15 - mt
      let netz = 0
      if (al < 82) { const k = 1 - dLon / netzBreite; if (k > 0) netz += k }
      if (al < 75) { const k = 1 - dLat / netzBreite; if (k > 0) netz += k }
      if (netz > 0) { const k = (netz > 1 ? 1 : netz) * 0.13; r += (255 - r) * k; g += (255 - g) * k; bl += (255 - bl) * k }
      const fr = tiefe * tiefe * Math.sqrt(tiefe) * 0.55
      r += (RAND[0] - r) * fr; g += (RAND[1] - g) * fr; bl += (RAND[2] - bl) * fr
      const i = (py * W + px) * 4
      d[i] = r > 255 ? 255 : r; d[i + 1] = g > 255 ? 255 : g; d[i + 2] = bl > 255 ? 255 : bl; d[i + 3] = 255 * deck
    }
  }
  const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.16)
  glow.addColorStop(0, 'rgba(150,205,255,0.55)')
  glow.addColorStop(0.35, 'rgba(120,180,240,0.22)')
  glow.addColorStop(1, 'rgba(120,180,240,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2); ctx.fill()
  const zw = schnellPuffer.zw
  zw.getContext('2d').putImageData(img, 0, 0)
  ctx.drawImage(zw, 0, 0)
  if (linien.length || punkte.length) {
    zeichneUeberlagerung(ctx, globusProjektion({ breite, hoehe, P, dpr, mitte: opt.mitte, drehung }), { linien, punkte, dpr })
  }
}
