// Meldungen für andere Reisende (V32): die App liest und schreibt hier.
//   GET  /api/meldungen                     aktive Meldungen, öffentlich; gruppe: ob sie auch in die Telegram-Gruppe gehen
//   POST /api/meldungen { aktion, … }       neu, stimme, unpassend, zurueck
// Speicher: Netlify Blobs „meldungen“. Kern und Telegram: netlify/meldungen-kern.mjs.
// Gespeichert werden keine Adressen und keine Gerätekennungen, nur gekürzte Prüfwerte.

import { macheKern } from '../meldungen-kern.mjs'

const MAX_ANFRAGE = 4096
/** Fremde Seiten, die hier lesen und schreiben dürfen: nur die Mac-App (eigener kleiner Server auf diesem Port) */
export const ERLAUBT = ['http://127.0.0.1:8991']
const cors = (origin) => (ERLAUBT.includes(origin)
  ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' }
  : {})
const antwort = (status, daten) => new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function speicher() {
  const { getStore } = await import('@netlify/blobs')
  return getStore({ name: 'meldungen', consistency: 'strong' })
}

export default async function handler(req, context = {}, deps = {}) {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') return new Response(null, { status: ERLAUBT.includes(origin) ? 204 : 403, headers: cors(origin) })
  const r = await bearbeite(req, context, deps)
  for (const [k, v] of Object.entries(cors(origin))) r.headers.set(k, v)
  return r
}

async function bearbeite(req, context, { kern, env = process.env, holen = fetch } = {}) {
  let k = kern
  if (!k) {
    try { k = macheKern({ store: await speicher(), env, holen }) } catch { return antwort(503, { ok: false, grund: 'speicher' }) }
  }
  try {
    if (req.method === 'GET') return antwort(200, { ok: true, stand: Date.now(), gruppe: !!k.inGruppe?.(), meldungen: await k.liste() })
    if (req.method !== 'POST') return antwort(405, { ok: false, grund: 'methode' })
    if (Number(req.headers.get('content-length') || 0) > MAX_ANFRAGE) return antwort(413, { ok: false, grund: 'zu-gross' })
    let b
    try { b = JSON.parse((await req.text()).slice(0, MAX_ANFRAGE)) } catch { return antwort(400, { ok: false, grund: 'json' }) }
    const wer = context.ip || req.headers.get('x-nf-client-connection-ip') || 'unbekannt'
    let e
    if (b.aktion === 'neu') e = await k.neu(b.meldung || {}, { geraet: b.geraet, wer })
    else if (b.aktion === 'stimme') e = await k.stimme(b.id, b.wert, b.geraet, wer)
    else if (b.aktion === 'unpassend') e = await k.unpassend(b.id, b.geraet, wer)
    else if (b.aktion === 'zurueck') e = await k.zurueck(b.id, b.schluessel)
    else return antwort(400, { ok: false, grund: 'aktion' })
    return antwort(e.status, e.daten)
  } catch (e) {
    // Nur Art und Text des Fehlers ins Netlify-Protokoll, keine Anfragedaten
    console.error('meldungen:', e?.name, e?.message)
    return antwort(500, { ok: false, grund: 'fehler' })
  }
}

export const config = { path: '/api/meldungen' }
