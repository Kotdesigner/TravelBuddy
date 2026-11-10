// Telegram-Bot der Meldungen (V32). Telegram ruft hier an, wenn der Anbieter im Admin-Chat einen Knopf tippt
// oder jemand dem Bot schreibt. Einrichten (einmal, nachdem die Variablen bei Netlify stehen):
//   https://<seite>/api/meldungen-bot?einrichten=<TELEGRAM_GEHEIM>
// Danach schickt Telegram jede Anfrage mit dem Geheimwort im Kopf, alles andere wird abgewiesen.
// /id im Chat mit dem Bot oder in der Gruppe nennt die Chat-ID für TELEGRAM_ADMIN und TELEGRAM_GRUPPE.

import { timingSafeEqual } from 'node:crypto'
import { macheKern } from '../meldungen-kern.mjs'

const antwort = (status, daten) => new Response(JSON.stringify(daten), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
const gleich = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length > 0 && x.length === y.length && timingSafeEqual(x, y) }

async function speicher() {
  const { getStore } = await import('@netlify/blobs')
  return getStore({ name: 'meldungen', consistency: 'strong' })
}

export default async function handler(req, context = {}, { kern, env = process.env, holen = fetch } = {}) {
  const geheim = env.TELEGRAM_GEHEIM
  if (!env.TELEGRAM_BOT_TOKEN || !geheim) return antwort(503, { ok: false, grund: 'nicht-eingerichtet' })
  const k = kern || macheKern({ store: await speicher(), env, holen })

  // Einmal einrichten: Telegram die Adresse dieses Bots und das Geheimwort mitteilen
  if (req.method === 'GET') {
    const url = new URL(req.url)
    if (!gleich(url.searchParams.get('einrichten'), geheim)) return antwort(403, { ok: false })
    const r = await k.tg('setWebhook', { url: url.origin + url.pathname, secret_token: geheim, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true })
    return antwort(r ? 200 : 502, { ok: !!r, adresse: url.origin + url.pathname })
  }
  if (req.method !== 'POST') return antwort(405, { ok: false })
  if (!gleich(req.headers.get('x-telegram-bot-api-secret-token'), geheim)) return antwort(403, { ok: false })

  let u
  try { u = await req.json() } catch { return antwort(200, { ok: true }) }

  // /id oder /start: Chat-ID nennen, damit der Anbieter sie bei Netlify eintragen kann. In Gruppen nur, solange noch
  // keine Gruppe eingetragen ist, sonst könnte jeder den Bot dort immer wieder antworten lassen.
  const nachricht = u.message
  const inEinerGruppe = /group/.test(nachricht?.chat?.type || '')
  if (nachricht && /^\/(id|start)\b/.test(nachricht.text || '') && !(inEinerGruppe && env.TELEGRAM_GRUPPE)) {
    await k.tg('sendMessage', { chat_id: nachricht.chat.id, text: `Chat-ID: ${nachricht.chat.id}\nPrivat: als TELEGRAM_ADMIN eintragen. In der Gruppe: als TELEGRAM_GRUPPE.` })
    return antwort(200, { ok: true })
  }

  // Knöpfe im Admin-Chat, nur vom Anbieter
  const cq = u.callback_query
  if (cq) {
    if (String(cq.from?.id) !== String(env.TELEGRAM_ADMIN)) {
      await k.tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Nur für Admins' })
      return antwort(200, { ok: true })
    }
    const [aktion, id] = String(cq.data || '').split(':')
    if (aktion === 'fertig') { await k.tg('answerCallbackQuery', { callback_query_id: cq.id }); return antwort(200, { ok: true }) }
    const ergebnis = ['passt', 'loeschen', 'zeigen'].includes(aktion) ? await k.admin(aktion, id) : 'unbekannt'
    await k.tg('answerCallbackQuery', { callback_query_id: cq.id, text: ergebnis })
    if (cq.message) await k.tg('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [[{ text: '✓ ' + ergebnis, callback_data: 'fertig:' + id }]] } })
  }
  return antwort(200, { ok: true })
}

export const config = { path: '/api/meldungen-bot' }
