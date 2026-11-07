// Offline-Routen auf echten Straßen (V29). Liest ein Straßennetz (Format TBRN 2 aus
// scripts/strassennetz-kern.mjs) und sucht den schnellsten Weg mit A*. Reines JS ohne DOM:
// läuft im Hintergrund (routing-worker.js) und in den Tests unter Node.
//
// Ein Stopp wird auf den nächsten Punkt einer Straße gesetzt, nicht nur auf die nächste Kreuzung
// (im Outback liegen Kreuzungen 50 km auseinander). Liegt er abseits, zählt das Stück bis zur Straße
// als Anschluss (Luftlinie mal 1,3, mit 40 km/h). Über MAX_ANSCHLUSS_M gibt es keine Offline-Route.

export const MAX_ANSCHLUSS_M = 30000
const VMAX = 115 / 3.6           // schnellste Kante im Netz (m/s), für die Schätzung in A*
const ANSCHLUSS_FAKTOR = 1.3, ANSCHLUSS_MS = 40 / 3.6
// Fahrzeit auf befestigten Straßen wie online: OSRM fährt mit etwa 80 % der erlaubten Geschwindigkeit,
// dazu Ampeln und Abbiegen. Gemessen an 9 Strecken in WA lag die reine Netzzeit 16 bis 18 % darunter.
// Nur für die Anzeige; die Wegwahl (A*) bleibt bei der Netzzeit. Pisten bleiben, wie sie sind.
const ZEIT_FAKTOR_STRASSE = 1.2
// Pisten zählen bei der Wegwahl 1,5-mal so lang wie ihre Fahrzeit: Fernstrecken bleiben auf Asphalt
// (Perth bis Kununurra sonst 259 km Piste über Marble Bar), Wege in Nationalparks und geplante
// Pisten-Etappen bleiben (Mount Augustus bis Tom Price). Gemessen 7.11.: ab 3 brechen Parkwege weg.
// Mit 4WD (Schalter an der Route) gilt 1. Nur für die Wegwahl, die angezeigte Zeit bleibt die echte.
export const PISTEN_AUFSCHLAG = 1.5
export const ZELLE = 0.05        // Raster für die Suche nach der nächsten Straße (Grad)
const RAD = Math.PI / 180

export function meter(lon1, lat1, lon2, lat2) {
  const dl = (lat2 - lat1) * RAD, dn = (lon2 - lon1) * RAD
  const h = Math.sin(dl / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dn / 2) ** 2
  return 12742017.6 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Netz aus der Binärdatei lesen und für die Suche vorbereiten (Nachbarn, Linien, Raster). */
export function leseNetz(buf) {
  const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const dv = new DataView(ab)
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'TBRN' || dv.getUint32(4, true) !== 2) throw new Error('Kein Straßennetz (TBRN 2)')
  const N = dv.getUint32(8, true), M = dv.getUint32(12, true), G = dv.getUint32(16, true)
  const rahmen = [dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true), dv.getFloat32(32, true)]
  const pad4 = (x) => (x + 3) & ~3
  let o = 48
  const feld = (Art, len, bytes) => { const a = new Art(ab, o, len); o += pad4(len * bytes); return a }
  const nLon = feld(Int32Array, N, 4), nLat = feld(Int32Array, N, 4)
  const eA = feld(Uint32Array, M, 4), eB = feld(Uint32Array, M, 4), eLen = feld(Uint32Array, M, 4)
  const eZeit = feld(Uint16Array, M, 2), eGeoN = feld(Uint16Array, M, 2), eFlag = feld(Uint8Array, M, 1)
  const roh = feld(Int16Array, G, 2)

  // Linienpunkte entpacken (Hunderttausendstel Grad), je Kante Anfang im Feld
  let P = 0
  for (let i = 0; i < M; i++) P += eGeoN[i]
  const pLon = new Int32Array(P), pLat = new Int32Array(P), eGeoS = new Uint32Array(M + 1)
  let g = 0, p = 0
  for (let i = 0; i < M; i++) {
    eGeoS[i] = p
    let x = Math.round(nLon[eA[i]] / 10), y = Math.round(nLat[eA[i]] / 10)
    for (let k = 0; k < eGeoN[i]; k++) {
      if (roh[g] === -32768 && roh[g + 1] === -32768) {
        x = (roh[g + 2] & 0xffff) | (roh[g + 3] << 16); y = (roh[g + 4] & 0xffff) | (roh[g + 5] << 16); g += 6
      } else { x += roh[g]; y += roh[g + 1]; g += 2 }
      pLon[p] = x; pLat[p] = y; p++
    }
  }
  eGeoS[M] = p

  // Nachbarn: von jedem Knoten die befahrbaren Kanten (Einbahn nur vorwärts)
  const grad = new Uint32Array(N + 1)
  for (let i = 0; i < M; i++) { grad[eA[i]]++; if (!(eFlag[i] & 32)) grad[eB[i]]++ }
  const adjS = new Uint32Array(N + 1)
  for (let i = 0; i < N; i++) adjS[i + 1] = adjS[i] + grad[i]
  const adj = new Int32Array(adjS[N]), fuell = adjS.slice(0, N)
  for (let i = 0; i < M; i++) { adj[fuell[eA[i]]++] = i + 1; if (!(eFlag[i] & 32)) adj[fuell[eB[i]]++] = -(i + 1) }

  // Raster mit allen Linienstücken für die Suche nach der nächsten Straße. Der Rahmen kommt aus den
  // Punkten selbst (Knoten und Linienpunkte), denn Linien können über die Knoten hinausragen
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (let i = 0; i < N; i++) { const x = nLon[i] / 1e6, y = nLat[i] / 1e6; if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y }
  for (let i = 0; i < P; i++) { const x = pLon[i] / 1e5, y = pLat[i] / 1e5; if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y }
  if (!N) { w = rahmen[0]; s = rahmen[1]; e = rahmen[2]; n = rahmen[3] }
  rahmen[0] = w; rahmen[1] = s; rahmen[2] = e; rahmen[3] = n
  const gw = Math.max(1, Math.ceil((e - w) / ZELLE) + 1), gh = Math.max(1, Math.ceil((n - s) / ZELLE) + 1)
  const netz = { N, M, rahmen, nLon, nLat, eA, eB, eLen, eZeit, eFlag, eGeoS, pLon, pLat, adjS, adj, gw, gh }
  // Zelle eines Punkts, ins Raster gezogen: der Rahmen steht als float32 in der Datei, Punkte genau
  // am Süd- oder Westrand liegen dadurch rechnerisch knapp außerhalb und dürfen nicht wegfallen
  const zx = (lon) => Math.min(gw - 1, Math.max(0, Math.floor((lon - w) / ZELLE)))
  const zy = (lat) => Math.min(gh - 1, Math.max(0, Math.floor((lat - s) / ZELLE)))
  const zellen = (fn) => {
    for (let i = 0; i < M; i++) {
      const m = eGeoS[i + 1] - eGeoS[i] + 1
      for (let k = 0; k < m; k++) {
        const a = punkt(netz, i, k), b = punkt(netz, i, k + 1)
        const x1 = zx(Math.max(a[0], b[0])), y1 = zy(Math.max(a[1], b[1]))
        for (let x = zx(Math.min(a[0], b[0])); x <= x1; x++) for (let y = zy(Math.min(a[1], b[1])); y <= y1; y++) fn(y * gw + x, i, k)
      }
    }
  }
  const zahl = new Uint32Array(gw * gh + 1)
  zellen((c) => { zahl[c + 1]++ })
  for (let c = 0; c < gw * gh; c++) zahl[c + 1] += zahl[c]
  const zKante = new Uint32Array(zahl[gw * gh]), zStueck = new Uint16Array(zahl[gw * gh]), zf = zahl.slice(0, gw * gh)
  zellen((c, i, k) => { const j = zf[c]++; zKante[j] = i; zStueck[j] = k })
  netz.zStart = zahl; netz.zKante = zKante; netz.zStueck = zStueck
  return netz
}

/** k-ter Punkt der Kante i von a (k = 0) bis b (k = Zahl der Linienpunkte + 1), als [lon, lat] */
export function punkt(net, i, k) {
  const m = net.eGeoS[i + 1] - net.eGeoS[i]
  if (k === 0) return [net.nLon[net.eA[i]] / 1e6, net.nLat[net.eA[i]] / 1e6]
  if (k === m + 1) return [net.nLon[net.eB[i]] / 1e6, net.nLat[net.eB[i]] / 1e6]
  const p = net.eGeoS[i] + k - 1
  return [net.pLon[p] / 1e5, net.pLat[p] / 1e5]
}
const kantenPunkte = (net, i) => { const m = net.eGeoS[i + 1] - net.eGeoS[i]; const out = []; for (let k = 0; k <= m + 1; k++) out.push(punkt(net, i, k)); return out }

/** Nächster Punkt einer Straße zu [lon, lat]: Kante, Anteil entlang der Kante (0 bis 1), Abstand in m */
export function naechsteStrasse(net, lon, lat, { meidePiste = false, maxM = MAX_ANSCHLUSS_M, gesperrt = null } = {}) {
  const [w, s] = net.rahmen
  const cx = Math.floor((lon - w) / ZELLE), cy = Math.floor((lat - s) / ZELLE)
  const kx = Math.cos(lat * RAD) * 111320, ky = 110574
  let best = null
  const ringe = Math.ceil(maxM / (ZELLE * Math.min(kx, ky))) + 1
  for (let r = 0; r <= ringe; r++) {
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || x < 0 || y < 0 || x >= net.gw || y >= net.gh) continue
      const c = y * net.gw + x
      for (let j = net.zStart[c]; j < net.zStart[c + 1]; j++) {
        const i = net.zKante[j], k = net.zStueck[j]
        if (meidePiste && net.eFlag[i] & 16) continue
        if (gesperrt && gesperrt.has(i)) continue
        const a = punkt(net, i, k), b = punkt(net, i, k + 1)
        const ax = (a[0] - lon) * kx, ay = (a[1] - lat) * ky, bx = (b[0] - lon) * kx, by = (b[1] - lat) * ky
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
        let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t
        const d = Math.hypot(ax + t * dx, ay + t * dy)
        if (!best || d < best.d) best = { e: i, k, t, d, lon: a[0] + t * (b[0] - a[0]), lat: a[1] + t * (b[1] - a[1]) }
      }
    }
    // Ein Ring weiter kann nichts Näheres mehr bringen
    if (best && best.d < (r * ZELLE) * Math.min(kx, ky)) break
  }
  if (!best || best.d > maxM) return null
  // Anteil entlang der Kante über die Länge der Linie
  const pts = kantenPunkte(net, best.e)
  let bis = 0, ges = 0
  for (let k = 1; k < pts.length; k++) {
    const l = meter(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1])
    if (k - 1 < best.k) bis += l
    else if (k - 1 === best.k) bis += l * best.t
    ges += l
  }
  best.anteil = ges > 0 ? bis / ges : 0
  return best
}

// Kleiner Binärheap über Knoten mit Priorität
class Heap {
  constructor() { this.k = []; this.p = [] }
  get leer() { return !this.k.length }
  rein(k, p) { const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p); while (i > 0) { const j = (i - 1) >> 1; if (P[j] <= p) break; K[i] = K[j]; P[i] = P[j]; i = j } K[i] = k; P[i] = p }
  raus() {
    const K = this.k, P = this.p, k0 = K[0], last = K.pop(), lp = P.pop()
    if (K.length) {
      let i = 0; const n = K.length
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && P[c + 1] < P[c]) c++; if (P[c] >= lp) break; K[i] = K[c]; P[i] = P[c]; i = c }
      K[i] = last; P[i] = lp
    }
    return k0
  }
  minP() { return this.p[0] }
}

/** Schnellster Weg zwischen zwei Stopps. Ergebnis mit Linie, m, s, Piste-m, Anschluss-m oder null */
// gesperrt: Set der Kanten, die wegen einer Sperrung nicht befahren werden (sperrungen.js)
export function wegZwischen(net, von, nach, { meidePiste = false, pistenFaktor = PISTEN_AUFSCHLAG, gesperrt = null } = {}) {
  const S = naechsteStrasse(net, von.lon, von.lat, { meidePiste, gesperrt }), T = naechsteStrasse(net, nach.lon, nach.lat, { meidePiste, gesperrt })
  if (!S || !T) return null
  const { eA, eB, eZeit, eFlag, eLen, adjS, adj, nLon, nLat } = net
  const tLon = T.lon, tLat = T.lat
  const h = (u) => meter(nLon[u] / 1e6, nLat[u] / 1e6, tLon, tLat) / VMAX
  const dist = new Map(), vor = new Map()
  const heap = new Heap()
  const setze = (u, d, kante) => { if (d < (dist.get(u) ?? Infinity)) { dist.set(u, d); vor.set(u, kante); heap.rein(u, d + h(u)) } }
  const einbahn = (i) => eFlag[i] & 32
  const kost = (i) => (eFlag[i] & 16 ? eZeit[i] * pistenFaktor : eZeit[i])   // Wegwahl, siehe PISTEN_AUFSCHLAG
  // Vom Stopp zu den beiden Enden seiner Kante (rückwärts nur ohne Einbahn)
  setze(eB[S.e], (1 - S.anteil) * kost(S.e), 0)
  if (!einbahn(S.e)) setze(eA[S.e], S.anteil * kost(S.e), 0)
  // Zum Ziel: über a vorwärts oder über b rückwärts
  const zielUeberA = eA[T.e], zielUeberB = einbahn(T.e) ? -1 : eB[T.e]
  let besteZeit = Infinity, besterKnoten = -1, besteSeite = 0
  // Gleiche Kante, direkt
  if (S.e === T.e && (T.anteil >= S.anteil || !einbahn(S.e))) { besteZeit = Math.abs(T.anteil - S.anteil) * kost(S.e); besteSeite = 2 }
  while (!heap.leer) {
    if (heap.minP() >= besteZeit) break
    const u = heap.raus(), du = dist.get(u)
    if (u === zielUeberA) { const z = du + T.anteil * kost(T.e); if (z < besteZeit) { besteZeit = z; besterKnoten = u; besteSeite = 0 } }
    if (u === zielUeberB) { const z = du + (1 - T.anteil) * kost(T.e); if (z < besteZeit) { besteZeit = z; besterKnoten = u; besteSeite = 1 } }
    for (let j = adjS[u]; j < adjS[u + 1]; j++) {
      const sk = adj[j], i = Math.abs(sk) - 1
      if (meidePiste && eFlag[i] & 16) continue
      if (gesperrt && gesperrt.has(i)) continue
      const v = sk > 0 ? eB[i] : eA[i]
      setze(v, du + kost(i), sk)
    }
  }
  if (besteZeit === Infinity) return null

  // Weg zusammensetzen: Kanten rückwärts vom Zielknoten bis zum Start
  const teile = []   // [kante, richtung (+1 vorwärts, -1 rückwärts), von Anteil, bis Anteil]
  if (besteSeite === 2) teile.push([S.e, T.anteil >= S.anteil ? 1 : -1, S.anteil, T.anteil])
  else {
    teile.push([T.e, besteSeite === 0 ? 1 : -1, besteSeite === 0 ? 0 : 1, T.anteil])
    let u = besterKnoten
    for (;;) {
      const sk = vor.get(u)
      if (!sk) break
      const i = Math.abs(sk) - 1
      teile.push([i, sk > 0 ? 1 : -1, sk > 0 ? 0 : 1, sk > 0 ? 1 : 0])
      u = sk > 0 ? eA[i] : eB[i]
    }
    // erstes Stück: vom Stopp bis zum Knoten u
    teile.push([S.e, u === eB[S.e] ? 1 : -1, S.anteil, u === eB[S.e] ? 1 : 0])
    teile.reverse()
  }
  let m = 0, sek = 0, piste = 0
  const linie = [[von.lon, von.lat], [S.lon, S.lat]]
  for (const [i, , a, b] of teile) {
    const f = Math.abs(b - a)
    m += f * eLen[i]
    if (eFlag[i] & 16) { piste += f * eLen[i]; sek += f * eZeit[i] } else sek += f * eZeit[i] * ZEIT_FAKTOR_STRASSE
    linie.push(...stueck(net, i, a, b))
  }
  linie.push([T.lon, T.lat], [nach.lon, nach.lat])
  const anschluss = (S.d + T.d) * ANSCHLUSS_FAKTOR
  return { m: m + anschluss, sek: sek + anschluss / ANSCHLUSS_MS, pisteM: piste, anschlussM: anschluss, linie: entdoppeln(linie) }
}

// Punkte einer Kante zwischen zwei Anteilen (0 = a, 1 = b), in Fahrtrichtung
function stueck(net, i, a, b) {
  const pts = kantenPunkte(net, i)
  if (pts.length < 2) return pts
  const len = [0]
  for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + meter(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]))
  const ges = len[len.length - 1] || 1
  const lo = Math.min(a, b) * ges, hi = Math.max(a, b) * ges
  // Mit den Endpunkten der Kante (Kreuzungen), sonst schneidet die Linie dort die Ecke ab
  // (bis 56 m bei Meckering); doppelte Punkte am Übergang entfernt entdoppeln()
  const out = pts.filter((_, k) => len[k] >= lo - 0.5 && len[k] <= hi + 0.5)
  return a <= b ? out : out.reverse()
}
const entdoppeln = (l) => l.filter((p, k) => !k || p[0] !== l[k - 1][0] || p[1] !== l[k - 1][1])

/**
 * Route über alle Stopps. Liefert die Form von berechneRoute (routing.js) plus offline-Angaben:
 * { geometry, km, dauerMin, legs, offline: true, pisteKm, anschlussKm } oder null, wenn ein Abschnitt fehlt.
 */
export function routeOffline(net, stops, { meidePiste = false, pistenFaktor = PISTEN_AUFSCHLAG, gesperrt = null } = {}) {
  const p = (stops || []).filter((s) => s && s.lat != null && s.lon != null)
  if (p.length < 2) return null
  const legs = [], geometry = []
  let piste = 0, anschluss = 0
  for (let i = 1; i < p.length; i++) {
    const w = wegZwischen(net, p[i - 1], p[i], { meidePiste, pistenFaktor, gesperrt })
    if (!w) return null
    legs.push({ km: w.m / 1000, dauerMin: w.sek / 60 })
    piste += w.pisteM; anschluss += w.anschlussM
    geometry.push(...(geometry.length ? w.linie.slice(1) : w.linie))
  }
  const km = rundeAufSumme(legs.map((l) => l.km)), min = rundeAufSumme(legs.map((l) => l.dauerMin))
  return {
    geometry, km: km.reduce((a, b) => a + b, 0), dauerMin: min.reduce((a, b) => a + b, 0),
    legs: km.map((k, i) => ({ km: k, dauerMin: min[i] })),
    offline: true, pisteKm: Math.round(piste / 1000), anschlussKm: Math.round(anschluss / 1000),
  }
}

// Ganze Zahlen, die zusammen die gerundete Summe ergeben (größte Reste zuerst)
function rundeAufSumme(werte) {
  const ziel = Math.round(werte.reduce((a, b) => a + b, 0))
  const unten = werte.map(Math.floor)
  let rest = ziel - unten.reduce((a, b) => a + b, 0)
  const reihe = werte.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0])
  for (const [, i] of reihe) { if (rest <= 0) break; unten[i]++; rest-- }
  return unten
}
