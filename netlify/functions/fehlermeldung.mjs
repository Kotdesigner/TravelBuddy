// Fehler melden: nimmt die Meldung aus der App an und schickt sie über Resend als Mail an die
// Adresse aus der Netlify-Variable FEHLER_AN. Ersetzt Netlify Forms, weil dessen Spamfilter (Akismet) echte
// Meldungen aussortiert und für Spam keine Mail verschickt.
//
// Schlüssel (RESEND_API_KEY) und Empfänger (FEHLER_AN) stehen nur in Netlify, nie im Code.
// Ohne eigene Domain darf Resend nur an die Adresse schicken, mit der das Konto angelegt ist,
// FEHLER_AN muss also diese Adresse sein.
//
// Eigene einfache Sperren statt fremdem Spamfilter: Honigtopf-Feld, Größen- und Längengrenzen,
// nur Bilder als Anhang, wenige Meldungen pro Minute je Adresse.

export const ABSENDER = 'TravelBuddy <onboarding@resend.dev>'
export const MAX_TEXT = 8000
export const MAX_BILDER = 3
export const MAX_BILD_BYTES = 1.5 * 1024 * 1024
export const MAX_ANFRAGE_BYTES = 5 * 1024 * 1024
const PRO_MINUTE = 5
const BILDTYPEN = ['image/jpeg', 'image/png', 'image/webp']

const antwort = (status, daten) => new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

// Kurzes Gedächtnis je laufender Instanz. Reicht gegen versehentliches Mehrfachsenden und einfache Flut.
const zuletzt = new Map()
export function zuViele(schluessel, jetzt = Date.now()) {
  const liste = (zuletzt.get(schluessel) || []).filter((t) => jetzt - t < 60e3)
  liste.push(jetzt)
  zuletzt.set(schluessel, liste)
  if (zuletzt.size > 500) for (const k of [...zuletzt.keys()].slice(0, 250)) zuletzt.delete(k)
  return liste.length > PRO_MINUTE
}

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
// Formulare schicken Zeilenumbrüche als \r\n, in der Mail reicht \n
const kurz = (s, n) => String(s || '').replace(/\r\n?/g, '\n').trim().slice(0, n)

function base64(buf) {
  return Buffer.from(buf).toString('base64')
}

/** Aus den Formulardaten die Mail für Resend bauen. Rückgabe: { mail } oder { fehler, status } */
export async function baueMail(fd, empfaenger) {
  if (String(fd.get('bot-field') || '').trim()) return { stumm: true }
  const text = kurz(fd.get('beschreibung'), MAX_TEXT)
  if (text.length < 3) return { fehler: 'leer', status: 400 }
  const email = kurz(fd.get('email'), 200)
  const technik = kurz(fd.get('technik'), 2000)
  const anhaenge = []
  for (let i = 1; i <= MAX_BILDER; i++) {
    const f = fd.get('screenshot' + i)
    if (!f || typeof f === 'string' || !f.size) continue
    if (!BILDTYPEN.includes(f.type)) return { fehler: 'bildtyp', status: 415 }
    if (f.size > MAX_BILD_BYTES) return { fehler: 'bild-zu-gross', status: 413 }
    const name = String(f.name || `bildschirmfoto-${i}.jpg`).replace(/[^\w.\-]+/g, '_').slice(0, 80)
    anhaenge.push({ filename: name, content: base64(await f.arrayBuffer()) })
  }
  const erste = text.split('\n')[0].slice(0, 70)
  const mail = {
    from: ABSENDER,
    to: [empfaenger],
    subject: `TravelBuddy Fehlermeldung: ${erste}`,
    text: [text, '', '---', technik, email ? `Antwort an: ${email}` : 'Ohne E-Mail für Rückfragen', anhaenge.length ? `${anhaenge.length} Bildschirmfoto(s) im Anhang` : 'Ohne Bildschirmfoto'].join('\n'),
  }
  if (email && emailOk(email)) mail.reply_to = email
  if (anhaenge.length) mail.attachments = anhaenge
  return { mail }
}

/** An Resend schicken. `f` lässt sich in Tests ersetzen. */
export async function schicke(mail, schluessel, f = fetch) {
  const r = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${schluessel}`, 'content-type': 'application/json' },
    body: JSON.stringify(mail),
  })
  return r.ok
}

export default async function handler(req, context = {}, { f = fetch, env = process.env } = {}) {
  if (req.method !== 'POST') return antwort(405, { ok: false, grund: 'methode' })
  const laenge = Number(req.headers.get('content-length') || 0)
  if (laenge > MAX_ANFRAGE_BYTES) return antwort(413, { ok: false, grund: 'zu-gross' })
  const schluessel = env.RESEND_API_KEY
  const empfaenger = String(env.FEHLER_AN || '').trim()
  if (!schluessel || !emailOk(empfaenger)) return antwort(503, { ok: false, grund: 'nicht-eingerichtet' })
  const wer = context.ip || req.headers.get('x-nf-client-connection-ip') || 'unbekannt'
  if (zuViele(wer)) return antwort(429, { ok: false, grund: 'zu-viele' })
  let fd
  try { fd = await req.formData() } catch { return antwort(400, { ok: false, grund: 'formular' }) }
  const erg = await baueMail(fd, empfaenger)
  // Honigtopf gefüllt: so tun, als wäre alles gut, damit Bots nichts lernen
  if (erg.stumm) return antwort(200, { ok: true })
  if (erg.fehler) return antwort(erg.status, { ok: false, grund: erg.fehler })
  try {
    if (!(await schicke(erg.mail, schluessel, f))) return antwort(502, { ok: false, grund: 'mail' })
  } catch {
    return antwort(502, { ok: false, grund: 'mail' })
  }
  return antwort(200, { ok: true })
}

export const config = { path: '/api/fehlermeldung' }
