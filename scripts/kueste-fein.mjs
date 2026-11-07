// Erzeugt src/lib/kueste-fein.js aus der Offline-Karte (Ebene earth).
// Aufruf im App-Ordner: node scripts/kueste-fein.mjs public/karten/australien.pmtiles 6 0.012 src/lib/kueste-fein.js
import { PMTiles } from '../node_modules/pmtiles/dist/esm/index.js'
import { VectorTile } from '../node_modules/@mapbox/vector-tile/index.js'
import { PbfReader as Pbf } from '../node_modules/pbf/index.js'
import fs from 'node:fs'
import zlib from 'node:zlib'
class Datei { constructor(p){this.fd=fs.openSync(p,'r');this.p=p} getKey(){return this.p} async getBytes(o,l){const b=Buffer.alloc(l);fs.readSync(this.fd,b,0,l,o);return {data:b.buffer.slice(b.byteOffset,b.byteOffset+l)}} }
const pm = new PMTiles(new Datei(process.argv[2]))
const Z = +process.argv[3] || 6, TOL = +process.argv[4] || 0.01
const lon2x = (lon) => Math.floor((lon + 180) / 360 * 2 ** Z)
const lat2y = (lat) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** Z)
const [w, s, e, n] = [112.5, -44, 154, -9]
const x0 = lon2x(w), x1 = lon2x(e), y0 = lat2y(n), y1 = lat2y(s)
function dp(pts, tol) { if (pts.length < 4) return pts; let maxD = 0, idx = 0; const [a, b] = [pts[0], pts[pts.length - 1]]
  for (let i = 1; i < pts.length - 1; i++) { const d = segD(pts[i], a, b); if (d > maxD) { maxD = d; idx = i } }
  if (maxD > tol) { const l = dp(pts.slice(0, idx + 1), tol), r = dp(pts.slice(idx), tol); return l.slice(0, -1).concat(r) } return [a, b] }
function segD(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) }
const area = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; s += x1 * y2 - x2 * y1 } return s / 2 }
const ringe = []
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
  const t = await pm.getZxy(Z, x, y); if (!t) continue
  let buf = Buffer.from(t.data); if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf)
  const vt = new VectorTile(new Pbf(buf)); const ly = vt.layers.earth; if (!ly) continue
  for (let i = 0; i < ly.length; i++) { const f = ly.feature(i); if (f.type !== 3) continue
    const gj = f.toGeoJSON(x, y, Z); const polys = gj.geometry.type === 'Polygon' ? [gj.geometry.coordinates] : gj.geometry.coordinates
    for (const poly of polys) { const r = poly[0]; const sim = dp(r, TOL); if (sim.length < 4) continue; if (Math.abs(area(sim)) < TOL * TOL * 4) continue; ringe.push(sim.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)])) } }
}
const txt = '// Landflächen Australiens aus der Offline-Karte (australien.pmtiles, Ebene earth, Zoom ' + Z + '), vereinfacht auf ' + TOL + ' Grad.\n// Erzeugt mit scripts/kueste-fein.mjs. Teile liegen an den Kachelgrenzen aneinander.\nexport const LAND_FEIN = ' + JSON.stringify(ringe) + '\n'
fs.writeFileSync(process.argv[5], txt)
console.log('Ringe', ringe.length, 'Punkte', ringe.reduce((n, r) => n + r.length, 0), 'Bytes', txt.length)
