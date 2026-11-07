// Erzeugt public/routen-strassen.json: der echte Straßenverlauf jeder Routen-Idee (OSRM, derselbe Dienst
// wie für eigene Routen), vereinfacht auf 0,004 Grad. Einmal laufen lassen, wenn sich Stopps ändern;
// die App liest die Datei offline. Aufruf im App-Ordner: node scripts/routen-strassen.mjs [id …]
// Mit ids rechnet es nur diese Routen neu, die anderen bleiben, wie sie sind.
// V29: Bei 4WD-Ideen nimmt es den Weg auf dem Pisten-Netz, wenn OSRM einen Abschnitt weit außen
// herum fährt (wie der 4WD-Schalter an der Route, allradBesser), z. B. Nord 3 Mount Augustus bis Tom Price.
import fs from 'node:fs'
import { stoppsAusRoute, brauchtAllrad } from '../src/lib/routen-ideen.js'
import { leseNetz, routeOffline } from '../src/lib/offline-router.js'
import { allradBesser } from '../src/lib/routing-offline.js'
const nur = process.argv.slice(2)
let pistenNetz = null
const pisten = () => (pistenNetz ||= leseNetz(fs.readFileSync('public/routing/wa-pisten.bin')))
const routen = JSON.parse(fs.readFileSync('public/routen.json', 'utf8'))
function dp(pts, tol) {
  if (pts.length < 3) return pts
  let m = 0, k = 0; const a = pts[0], b = pts[pts.length - 1]
  for (let i = 1; i < pts.length - 1; i++) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy
    let t = l ? ((pts[i][0] - a[0]) * dx + (pts[i][1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(pts[i][0] - a[0] - t * dx, pts[i][1] - a[1] - t * dy); if (d > m) { m = d; k = i }
  }
  if (m > tol) { const l = dp(pts.slice(0, k + 1), tol), r = dp(pts.slice(k), tol); return l.slice(0, -1).concat(r) }
  return [a, b]
}
const out = nur.length && fs.existsSync('public/routen-strassen.json') ? JSON.parse(fs.readFileSync('public/routen-strassen.json', 'utf8')) : {}
for (const r of routen) {
  if (nur.length && !nur.includes(r.id)) continue
  const st = stoppsAusRoute(r).filter((s) => s.lat != null)
  const url = `https://router.project-osrm.org/route/v1/driving/${st.map((s) => `${s.lon},${s.lat}`).join(';')}?overview=full&geometries=geojson`
  const j = await (await fetch(url)).json()
  if (!j.routes?.[0]) throw new Error('Keine Strecke für ' + r.id)
  let linie = j.routes[0].geometry.coordinates, km = Math.round(j.routes[0].distance / 1000)
  if (brauchtAllrad(r)) {
    const osrm = { legs: j.routes[0].legs.map((l) => ({ km: l.distance / 1000 })) }
    const p = routeOffline(pisten(), st, { pistenFaktor: 1 })
    if (p && allradBesser(osrm, p)) { linie = p.geometry; km = p.km; console.log(`  4WD: Pisten-Netz ${p.km} km statt OSRM ${Math.round(j.routes[0].distance / 1000)} km`) }
  }
  const g = dp(linie, 0.004).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])
  // Pisten ohne Straßendaten (z. B. die letzten 60 km nach Israelite Bay): gerade Linie bis zum Stopp
  const erst = [st[0].lon, st[0].lat], letzt = [st[st.length - 1].lon, st[st.length - 1].lat]
  const weit = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180), a[1] - b[1]) > 0.02
  if (weit(g[0], erst)) g.unshift(erst)
  if (weit(g[g.length - 1], letzt)) { g.push(letzt); console.log('  Piste bis', st[st.length - 1].name, 'als gerade Linie') }
  out[r.id] = g
  console.log(r.id, out[r.id].length, 'Punkte', km, 'km')
  await new Promise((res) => setTimeout(res, 1200))
}
fs.writeFileSync('public/routen-strassen.json', JSON.stringify(out))
console.log('geschrieben', fs.statSync('public/routen-strassen.json').size, 'Bytes')
