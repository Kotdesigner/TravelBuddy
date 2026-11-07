// Kern zum Bauen der Offline-Straßennetze (V29): aus OpenStreetMap-Wegen ein Netz mit Kreuzungen als
// Knoten und Straßenstücken als Kanten (Länge, Fahrzeit, Piste, Einbahn, vereinfachte Linie), dann als
// kompakte Binärdatei, die src/lib/offline-router.js liest. Wird vom Bau-Skript und von den Tests benutzt.

// Straßenarten: Klasse (0 am größten), Tempo in km/h auf Asphalt
export const ARTEN = {
  motorway: [0, 100], motorway_link: [0, 60], trunk: [1, 100], trunk_link: [1, 50],
  primary: [2, 90], primary_link: [2, 50], secondary: [3, 80], secondary_link: [3, 50],
  tertiary: [4, 70], tertiary_link: [4, 40], unclassified: [5, 60], road: [5, 50],
  residential: [6, 40], living_street: [6, 15], service: [7, 20], track: [8, 30],
}
// Hauptstraßen-Netz (Lösung 2): Klassen 0 bis 4. Pisten-Netz (Lösung 3): alle
export const HAUPT_MAX_KLASSE = 4
const PISTE = new Set(['unpaved', 'gravel', 'fine_gravel', 'compacted', 'dirt', 'earth', 'ground', 'sand', 'mud', 'grass', 'pebblestone', 'rock', 'salt', 'woodchips'])
const BEFESTIGT = new Set(['paved', 'asphalt', 'concrete', 'concrete:plates', 'chipseal', 'sealed', 'paving_stones', 'bitumen'])

/** Straßenart, Tempo, Piste und Einbahn aus den OSM-Tags. null = nicht befahrbar oder nicht gewollt */
export function bewerteWeg(tags, maxKlasse = 8) {
  const a = ARTEN[tags.highway]
  if (!a || a[0] > maxKlasse) return null
  if (['private', 'no'].includes(tags.access) || ['private', 'no'].includes(tags.motor_vehicle) || ['private', 'no'].includes(tags.motorcar)) return null
  if (tags.area === 'yes' || tags.highway === 'service' && tags.service && tags.service !== 'alley') return null   // Einfahrten, Parkplätze
  let [klasse, kmh] = a
  const surface = tags.surface || ''
  const piste = PISTE.has(surface) || (tags.highway === 'track' && !BEFESTIGT.has(surface)) || tags['4wd_only'] === 'yes'
  if (piste) kmh = tags.highway === 'track' || tags['4wd_only'] === 'yes' ? Math.min(kmh, surface === 'sand' ? 20 : 30) : Math.min(kmh, 70)
  const ms = parseInt(tags.maxspeed, 10)
  if (ms > 0 && ms <= 130) kmh = Math.min(ms * (piste ? 0.8 : 0.95), piste ? kmh * 1.6 : ms)   // Tempolimit ist selten das echte Tempo
  let einbahn = 0
  if (['yes', 'true', '1'].includes(tags.oneway) || tags.junction === 'roundabout' || tags.highway === 'motorway') einbahn = 1
  if (tags.oneway === '-1' || tags.oneway === 'reverse') einbahn = -1
  if (tags.oneway === 'no') einbahn = 0
  return { klasse, kmh: Math.max(5, kmh), piste, einbahn }
}

const R = 6371008.8, RAD = Math.PI / 180
export function meter(lon1, lat1, lon2, lat2) {
  const dl = (lat2 - lat1) * RAD, dn = (lon2 - lon1) * RAD
  const h = Math.sin(dl / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dn / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Douglas-Peucker auf Punkten [lon, lat] mit Toleranz in Grad (Breite), Länge mit cos korrigiert
function vereinfache(pts, tol) {
  if (pts.length < 3) return pts
  const behalte = new Uint8Array(pts.length); behalte[0] = behalte[pts.length - 1] = 1
  const kx = Math.cos(pts[0][1] * RAD)
  const stapel = [[0, pts.length - 1]]
  while (stapel.length) {
    const [i, j] = stapel.pop()
    const ax = pts[i][0] * kx, ay = pts[i][1], bx = pts[j][0] * kx, by = pts[j][1]
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
    let mx = 0, mi = -1
    for (let k = i + 1; k < j; k++) {
      const px = pts[k][0] * kx, py = pts[k][1]
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy)
      if (d > mx) { mx = d; mi = k }
    }
    if (mx > tol && mi > 0) { behalte[mi] = 1; stapel.push([i, mi], [mi, j]) }
  }
  return pts.filter((_, k) => behalte[k])
}

/**
 * Netz bauen. Zwei Durchgänge über dieselben Wege: erst zählen, welche Knoten Kreuzungen sind
 * (von mehreren Wegen benutzt oder Wegende), dann Kanten von Kreuzung zu Kreuzung legen.
 * wege: Funktion, die für jeden Weg rueckruf({ tags, refs: [id], coords: [[lon,lat]] }) aufruft.
 */
export function baueNetz(wege, { maxKlasse = 8, toleranzGrad = 0.00015, minKomponenteKm = 3 } = {}) {
  const nutzung = new Map()
  wege((w) => {
    if (!bewerteWeg(w.tags, maxKlasse)) return
    const n = w.refs.length
    for (let i = 0; i < n; i++) {
      const id = w.refs[i]
      const ende = i === 0 || i === n - 1 ? 2 : 1
      nutzung.set(id, (nutzung.get(id) || 0) + ende)
    }
  })
  const knotenIndex = new Map(), knotenLon = [], knotenLat = []
  const knoten = (id, c) => {
    let k = knotenIndex.get(id)
    if (k === undefined) { k = knotenLon.length; knotenIndex.set(id, k); knotenLon.push(c[0]); knotenLat.push(c[1]) }
    return k
  }
  const kanten = []   // { a, b, len, zeit, flags, geo: [[lon,lat]] ohne Endpunkte }
  wege((w) => {
    const b = bewerteWeg(w.tags, maxKlasse)
    if (!b) return
    let start = 0
    for (let i = 1; i < w.refs.length; i++) {
      if (i < w.refs.length - 1 && (nutzung.get(w.refs[i]) || 0) < 2) continue
      let teil = w.coords.slice(start, i + 1), ka = w.refs[start], kb = w.refs[i]
      if (b.einbahn === -1) { teil = teil.slice().reverse(); [ka, kb] = [kb, ka] }
      let len = 0
      for (let k = 1; k < teil.length; k++) len += meter(teil[k - 1][0], teil[k - 1][1], teil[k][0], teil[k][1])
      start = i
      if (len < 0.5 || ka === kb) continue
      const flags = b.klasse | (b.piste ? 16 : 0) | (b.einbahn ? 32 : 0)
      const einfach = vereinfache(teil, toleranzGrad)
      kanten.push({ a: knoten(ka, teil[0]), b: knoten(kb, teil[teil.length - 1]), len, zeit: len / (b.kmh / 3.6), flags, geo: einfach.slice(1, -1) })
    }
  })
  zusammenfassen(kanten, knotenLon, knotenLat, toleranzGrad)
  // Abgehängte kleine Netzteile weglassen (Parkplatzwege, Datenfehler): sonst landet ein Stopp darauf und es gibt keinen Weg
  const N = knotenLon.length, eltern = new Int32Array(N).map((_, i) => i)
  const finde = (x) => { while (eltern[x] !== x) { eltern[x] = eltern[eltern[x]]; x = eltern[x] } return x }
  for (const k of kanten) { const ra = finde(k.a), rb = finde(k.b); if (ra !== rb) eltern[ra] = rb }
  const kmJe = new Map()
  for (const k of kanten) { const r = finde(k.a); kmJe.set(r, (kmJe.get(r) || 0) + k.len / 1000) }
  const behalte = kanten.filter((k) => kmJe.get(finde(k.a)) >= minKomponenteKm)
  // Knoten neu nummerieren
  const neu = new Int32Array(N).fill(-1), lon = [], lat = []
  const nimm = (i) => { if (neu[i] < 0) { neu[i] = lon.length; lon.push(knotenLon[i]); lat.push(knotenLat[i]) } return neu[i] }
  for (const k of behalte) { k.a = nimm(k.a); k.b = nimm(k.b) }
  return { lon, lat, kanten: behalte, komponenten: kmJe.size, entfernt: kanten.length - behalte.length }
}

/**
 * Schein-Kreuzungen auflösen: OSM teilt eine Straße oft in viele Wege. Ein Knoten mit genau zwei
 * Kanten gleicher Art (Klasse, Piste, Einbahn in derselben Richtung) ist keine Kreuzung. Die beiden
 * Kanten werden zu einer, der Knoten wird ein Punkt ihrer Linie. Ändert die Kanten-Liste an Ort und Stelle.
 */
export function zusammenfassen(kanten, lon, lat, toleranzGrad = 0.00015) {
  const N = lon.length
  const an = Array.from({ length: N }, () => [])
  kanten.forEach((k, i) => { an[k.a].push(i); an[k.b].push(i) })
  const weg = new Uint8Array(kanten.length), geaendert = new Set()
  const umdrehen = (k) => { [k.a, k.b] = [k.b, k.a]; k.geo = k.geo.slice().reverse() }
  for (let n = 0; n < N; n++) {
    const l = an[n].filter((i) => !weg[i])
    if (l.length !== 2) continue
    let [i, j] = l
    if (i === j || kanten[i].flags !== kanten[j].flags) continue
    if (kanten[i].flags & 32) {
      // Einbahn: i muss in n enden und j in n beginnen
      if (kanten[i].b === n && kanten[j].a === n) { /* passt */ } else if (kanten[j].b === n && kanten[i].a === n) { [i, j] = [j, i] } else continue
    } else {
      if (kanten[i].b !== n) umdrehen(kanten[i])
      if (kanten[j].a !== n) umdrehen(kanten[j])
    }
    const A = kanten[i], B = kanten[j]
    if (A.a === B.b) continue   // Ring: lieber lassen
    A.geo = [...A.geo, [lon[n], lat[n]], ...B.geo]
    A.b = B.b; A.len += B.len; A.zeit += B.zeit
    weg[j] = 1; geaendert.add(i)
    an[B.b] = an[B.b].map((x) => (x === j ? i : x))
  }
  // Zusammengesetzte Linien noch einmal vereinfachen
  for (const i of geaendert) {
    const k = kanten[i]
    if (weg[i]) continue
    k.geo = vereinfache([[lon[k.a], lat[k.a]], ...k.geo, [lon[k.b], lat[k.b]]], toleranzGrad).slice(1, -1)
  }
  let z = 0
  for (let i = 0; i < kanten.length; i++) if (!weg[i]) kanten[z++] = kanten[i]
  kanten.length = z
}

/**
 * Netz als Binärdatei, Format „TBRN“ Version 2, little endian (siehe leseNetz in src/lib/offline-router.js):
 * Kopf 48 Byte · Knoten lon/lat Int32 (Millionstel Grad) · Kanten a, b, Länge (m) Uint32, Fahrzeit (s) und
 * Zahl der Linienpunkte Uint16, Merkmale Uint8 · Linienpunkte als Int16-Schritte in Hunderttausendstel Grad
 * ab dem Startknoten; ein Schritt über 32767 steht als Marke -32768, -32768 und zwei Int32.
 */
export function netzAlsDatei(netz) {
  const N = netz.lon.length, M = netz.kanten.length
  const G = []
  let w = 180, s = 90, e = -180, n = -90
  for (let i = 0; i < N; i++) { w = Math.min(w, netz.lon[i]); e = Math.max(e, netz.lon[i]); s = Math.min(s, netz.lat[i]); n = Math.max(n, netz.lat[i]) }
  const geoN = new Uint16Array(M)
  netz.kanten.forEach((k, i) => {
    const pkt = k.geo.length > 65535 ? k.geo.slice(0, 65535) : k.geo
    geoN[i] = pkt.length
    let px = Math.round(netz.lon[k.a] * 1e5), py = Math.round(netz.lat[k.a] * 1e5)
    for (const c of pkt) {
      const x = Math.round(c[0] * 1e5), y = Math.round(c[1] * 1e5), dx = x - px, dy = y - py
      if (dx > 32767 || dx < -32767 || dy > 32767 || dy < -32767) G.push(-32768, -32768, x & 0xffff, x >> 16, y & 0xffff, y >> 16)
      else G.push(dx, dy)
      px = x; py = y
    }
  })
  const pad4 = (x) => (x + 3) & ~3
  const kopf = 48
  const groesse = kopf + N * 8 + M * 12 + 2 * pad4(M * 2) + pad4(M) + pad4(G.length * 2)
  const buf = new ArrayBuffer(groesse), dv = new DataView(buf)
  ;[84, 66, 82, 78].forEach((c, i) => dv.setUint8(i, c))   // „TBRN“
  dv.setUint32(4, 2, true); dv.setUint32(8, N, true); dv.setUint32(12, M, true); dv.setUint32(16, G.length, true)
  dv.setFloat32(20, w, true); dv.setFloat32(24, s, true); dv.setFloat32(28, e, true); dv.setFloat32(32, n, true)
  let o = kopf
  const feld = (Art, len, bytes) => { const a = new Art(buf, o, len); o += pad4(len * bytes); return a }
  const nLon = feld(Int32Array, N, 4), nLat = feld(Int32Array, N, 4)
  for (let i = 0; i < N; i++) { nLon[i] = Math.round(netz.lon[i] * 1e6); nLat[i] = Math.round(netz.lat[i] * 1e6) }
  const eA = feld(Uint32Array, M, 4), eB = feld(Uint32Array, M, 4), eLen = feld(Uint32Array, M, 4)
  const eZeit = feld(Uint16Array, M, 2), eGeoN = feld(Uint16Array, M, 2), eFlag = feld(Uint8Array, M, 1)
  netz.kanten.forEach((k, i) => {
    eA[i] = k.a; eB[i] = k.b; eLen[i] = Math.round(k.len); eZeit[i] = Math.min(65535, Math.max(1, Math.round(k.zeit))); eGeoN[i] = geoN[i]; eFlag[i] = k.flags
  })
  feld(Int16Array, G.length, 2).set(G)
  return new Uint8Array(buf)
}
