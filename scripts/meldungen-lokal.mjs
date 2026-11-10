// Test-Server für die Meldungen (V32), nur lokal: echter Server-Code (netlify/meldungen-kern.mjs und
// netlify/functions/meldungen.mjs), Speicher im Arbeitsspeicher, ohne Telegram. Mit drei Beispiel-Meldungen.
// Start: node scripts/meldungen-lokal.mjs   Vorschau dazu: MELDUNGEN_LOKAL=1 npx vite preview
import http from 'node:http'
import { macheKern } from '../netlify/meldungen-kern.mjs'
import funktion from '../netlify/functions/meldungen.mjs'

const m = new Map()
const store = { async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null }, async setJSON(k, v) { m.set(k, JSON.stringify(v)) }, async delete(k) { m.delete(k) }, async list({ prefix = '' } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) } } }
const kern = macheKern({ store, env: {} })
const beispiel = [
  { art: 'tanken', text: 'Diesel in El Questro wieder da, 2,89 $ pro Liter.', name: 'Jonas', lat: -16.0, lon: 127.98, ort: 'El Questro' },
  { art: 'tiere', text: 'Heute früh viele Delfine am Strand, ab 7:30 Uhr.', name: 'Lea', lat: -25.79, lon: 113.72, ort: 'Monkey Mia' },
  { art: 'camping', text: 'Bell Gorge Campground voll, Silent Grove hatte noch Plätze.', name: 'Tom', lat: -17.24, lon: 125.23, ort: 'Bell Gorge' },
]
for (const [i, b] of beispiel.entries()) await kern.neu(b, { geraet: String(i + 1).repeat(32), wer: 'beispiel' })

http.createServer(async (req, res) => {
  const teile = []
  for await (const t of req) teile.push(t)
  const body = teile.length ? Buffer.concat(teile) : undefined
  const r = await funktion(new Request('http://127.0.0.1:9107' + req.url, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : body }), { ip: '127.0.0.1' }, { kern })
  res.writeHead(r.status, Object.fromEntries(r.headers))
  res.end(Buffer.from(await r.arrayBuffer()))
}).listen(9107, '127.0.0.1', () => console.log('Meldungen-Test-Server auf http://127.0.0.1:9107'))
