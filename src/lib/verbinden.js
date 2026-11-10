// Unterwegs verbinden (V31): eigener Kontakt-Code, Kontakte von unterwegs, Orte und Routen teilen,
// Links auf externe Gruppen. Kein eigener Server: Code und Links tragen die Daten selbst, gechattet
// wird in Telegram, Signal oder WhatsApp. Plan und Rechtliches: 00_Planung/UNTERWEGS-VERBINDEN-ENTWURF.md
import { writable, get } from 'svelte/store'

export const PROFIL_KEY = 'tb-kontakt-v1'
export const KONTAKTE_KEY = 'tb-kontakte-v1'
export const GRUPPEN_KEY = 'tb-gruppen-v1'
export const MAX_KONTAKTE = 300
export const MAX_STOPPS = 30
/** Längere Links passen nicht mehr gut lesbar in einen QR-Code, dann nur als Link */
export const QR_MAX = 1200

const speicher = () => { try { return globalThis.localStorage || null } catch { return null } }
function lies(k, ersatz) { try { const v = speicher()?.getItem(k); return v ? JSON.parse(v) : ersatz } catch { return ersatz } }
function schreib(k, v) { try { speicher()?.setItem(k, JSON.stringify(v)) } catch {} }

// ---------- Packen: JSON als base64url (passt in Link und QR-Code, ohne Sonderzeichen) ----------

export function packe(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function entpacke(text) {
  try {
    const s = String(text || '')
    if (!/^[A-Za-z0-9_-]{2,6000}$/.test(s)) return null
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4))
    const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null
  } catch { return null }
}

// ---------- Eingaben säubern ----------

/** Text ohne Steuerzeichen, getrimmt, gekürzt */
export const text = (s, max = 60) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/** Telegram-Nutzername: 5 bis 32 Zeichen, Buchstabe vorn. Nimmt auch @name und t.me/name. */
export function telegramName(s) {
  const n = String(s ?? '').trim().replace(/^https?:\/\/(www\.)?t(elegram)?\.me\//i, '').replace(/^@/, '').replace(/\/$/, '')
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(n) ? n : ''
}
/** Signal: der Link aus der Signal-App (signal.me) oder ein Nutzername wie name.42 */
export function signalWert(s) {
  const v = String(s ?? '').trim()
  if (/^https:\/\/signal\.me\/#[A-Za-z0-9_\-/.~%=+]{4,400}$/.test(v)) return v
  const n = v.replace(/^@/, '')
  return /^[A-Za-z0-9_]{3,32}\.\d{2,9}$/.test(n) ? n : ''
}
/** WhatsApp: Nummer mit Ländervorwahl, nur Ziffern (00 oder + vorn erlaubt) */
export function whatsappNummer(s) {
  const d = String(s ?? '').replace(/^\s*(\+|00)/, '').replace(/[\s\-()/.]/g, '')
  return /^[1-9]\d{7,14}$/.test(d) ? d : ''
}

export const telegramLink = (n) => (telegramName(n) ? 'https://t.me/' + telegramName(n) : null)
export const signalLink = (v) => (signalWert(v).startsWith('https://') ? signalWert(v) : null)
export const whatsappLink = (n) => (whatsappNummer(n) ? 'https://wa.me/' + whatsappNummer(n) : null)

// ---------- Mein Kontakt-Code ----------

const LEER = { name: '', telegram: '', signal: '', whatsapp: '', zeigen: { telegram: true, signal: true, whatsapp: false } }

export function bereinigeProfil(p) {
  const z = p?.zeigen || {}
  return {
    name: text(p?.name, 40),
    telegram: telegramName(p?.telegram) || text(p?.telegram, 40),
    signal: signalWert(p?.signal) || text(p?.signal, 400),
    whatsapp: text(p?.whatsapp, 24),
    // WhatsApp zeigt die Telefonnummer, deshalb nur, wenn es jemand ausdrücklich einschaltet
    zeigen: { telegram: z.telegram !== false, signal: z.signal !== false, whatsapp: z.whatsapp === true },
  }
}
export const profil = writable(bereinigeProfil(lies(PROFIL_KEY, LEER)))
export function profilSetzen(p) { const b = bereinigeProfil(p); profil.set(b); schreib(PROFIL_KEY, b) }

/** Was in den Code kommt: nur gültige und eingeschaltete Wege */
export function codeInhalt(p) {
  const b = bereinigeProfil(p)
  const k = { v: 1, n: b.name }
  if (b.zeigen.telegram && telegramName(b.telegram)) k.tg = telegramName(b.telegram)
  if (b.zeigen.signal && signalWert(b.signal)) k.sg = signalWert(b.signal)
  if (b.zeigen.whatsapp && whatsappNummer(b.whatsapp)) k.wa = whatsappNummer(b.whatsapp)
  return k
}
export const hatWeg = (k) => !!(k?.tg || k?.sg || k?.wa)

/** Adresse dieser App für Links (ohne # dahinter) */
export const appBasis = () => { try { return location.origin + location.pathname } catch { return '' } }
export const kontaktLink = (p, basis = appBasis()) => `${basis}#/mehr/verbinden/k/${packe(codeInhalt(p))}`

/** Einen gescannten oder geöffneten Kontakt lesen. Unbrauchbares ergibt null. */
export function leseKontakt(payload) {
  const o = entpacke(payload)
  if (!o || o.v !== 1) return null
  const k = { name: text(o.n, 40), telegram: telegramName(o.tg), signal: signalWert(o.sg), whatsapp: whatsappNummer(o.wa) }
  return k.telegram || k.signal || k.whatsapp ? k : null
}

// ---------- Kontakte von unterwegs (nur auf diesem Gerät) ----------

// Kaputter Speicherwert darf die App nicht aufhalten (Heute lädt dieses Modul): dann einfach leer
const gespeicherteKontakte = lies(KONTAKTE_KEY, [])
export const kontakte = writable(Array.isArray(gespeicherteKontakte) ? gespeicherteKontakte.filter((k) => k && typeof k === 'object' && k.id) : [])
const sichern = () => schreib(KONTAKTE_KEY, get(kontakte))

/** Gleicher Mensch = gleicher Telegram-Name, Signal oder WhatsApp */
const gleich = (a, b) => (a.telegram && a.telegram === b.telegram) || (a.signal && a.signal === b.signal) || (a.whatsapp && a.whatsapp === b.whatsapp)

export function kontaktMerken(k, { ort = '', datum = '' } = {}) {
  const neu = { id: 'k-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: text(k.name, 40) || '?', telegram: telegramName(k.telegram),
    signal: signalWert(k.signal), whatsapp: whatsappNummer(k.whatsapp), ort: text(ort, 60), datum: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : '' }
  if (!neu.telegram && !neu.signal && !neu.whatsapp) return null
  kontakte.update((ks) => {
    const alt = ks.find((x) => gleich(x, neu))
    const rest = ks.filter((x) => x !== alt)
    // Schon da: Name und Wege auffrischen, Ort und Datum des ersten Treffens bleiben
    return [alt ? { ...alt, ...neu, id: alt.id, ort: alt.ort || neu.ort, datum: alt.datum || neu.datum } : neu, ...rest].slice(0, MAX_KONTAKTE)
  })
  sichern()
  return get(kontakte)[0]
}
export function kontaktLoeschen(id) { kontakte.update((ks) => ks.filter((k) => k.id !== id)); sichern() }
export const istGemerkt = (k, ks = get(kontakte)) => ks.some((x) => gleich(x, { telegram: telegramName(k.telegram), signal: signalWert(k.signal), whatsapp: whatsappNummer(k.whatsapp) }))

// ---------- Ort und Route teilen ----------

const zahl5 = (x) => (Number.isFinite(+x) ? Math.round(+x * 1e5) / 1e5 : null)
const lat = (x) => { const v = zahl5(x); return v != null && v >= -90 && v <= 90 ? v : null }
const lon = (x) => { const v = zahl5(x); return v != null && v >= -180 && v <= 180 ? v : null }

/** Ort zum Teilen: nur Name, Lage, Gegend und kurze Beschreibung. Notizen, Bericht, Fotos bleiben daheim. */
export function ortPaket(o) {
  const p = { v: 1, t: 'o', n: text(o.name, 80), la: lat(o.lat), lo: lon(o.lon) }
  if (o.region && o.region !== 'Meine Orte') p.r = text(o.region, 60)
  // Ort aus der App: der andere hat ihn samt Beschreibung auch, also nur die id. Das hält den QR-Code grob.
  if (o.id && !String(o.id).startsWith('eigen-')) p.id = text(o.id, 60)
  else { const b = text(o.beschreibung || o.kurz || '', 200); if (b) p.b = b }
  return p
}
/** Route zum Teilen: Name, Verkehrsmittel, 4WD und die Stopps mit Nächten. Kein Datum, keine Etappe. */
export function routePaket(r) {
  const s = (r.stops || []).slice(0, MAX_STOPPS).map((x) => [text(x.name, 60), lat(x.lat), lon(x.lon), Math.max(0, Math.min(60, Math.round(+x.naechte || 0)))]).filter((x) => x[0])
  const p = { v: 1, t: 'r', n: text(r.name, 80), a: ['auto', 'flug', 'bus', 'bahn', 'boot'].includes(r.art) ? r.art : 'auto', s }
  if (r.allrad) p.w = 1
  return p
}
export const teilLink = (paket, basis = appBasis()) => `${basis}#/mehr/verbinden/${paket.t}/${packe(paket)}`

/** Geteiltes lesen und prüfen. Ergebnis { typ: 'ort' | 'route', ... } oder null */
export function leseGeteilt(art, payload) {
  const o = entpacke(payload)
  if (!o || o.v !== 1 || o.t !== art) return null
  if (art === 'o') {
    const n = text(o.n, 80)
    if (!n) return null
    return { typ: 'ort', name: n, lat: lat(o.la), lon: lon(o.lo), region: text(o.r, 60), beschreibung: text(o.b, 200), id: text(o.id, 60) }
  }
  if (art === 'r') {
    const stops = (Array.isArray(o.s) ? o.s : []).slice(0, MAX_STOPPS)
      .map((x) => Array.isArray(x) ? { name: text(x[0], 60), lat: lat(x[1]), lon: lon(x[2]), naechte: Math.max(0, Math.min(60, Math.round(+x[3] || 0))) } : null)
      .filter((x) => x && x.name)
    if (stops.length < 2) return null
    return { typ: 'route', name: text(o.n, 80) || `${stops[0].name} → ${stops.at(-1).name}`, art: ['auto', 'flug', 'bus', 'bahn', 'boot'].includes(o.a) ? o.a : 'auto', allrad: o.w === 1, stops }
  }
  return null
}

/** Pfad aus einem gescannten Text: nur TravelBuddy-Codes, egal von welcher Adresse */
export function pfadAusCode(s) {
  const m = String(s || '').match(/#\/(mehr\/verbinden\/[kor]\/[A-Za-z0-9_-]{2,6000})$/)
  return m ? m[1] : null
}

/** Teilen über das System-Menü, sonst Link in die Zwischenablage. Ergebnis 'geteilt' | 'kopiert' | 'abgebrochen' | 'fehler' */
export async function teilen({ titel, text: t, url }) {
  try {
    if (navigator.share) { await navigator.share({ title: titel, text: t, url }); return 'geteilt' }
  } catch (e) { if (e?.name === 'AbortError') return 'abgebrochen' }
  try { await navigator.clipboard.writeText(url); return 'kopiert' } catch { return 'fehler' }
}

// ---------- Externe Gruppen (Telegram, Discord) aus public/gruppen.json ----------

/**
 * Nur Einladungslinks der beiden Dienste, alles andere fällt weg. `…Eigen`: Der Anbieter betreut die Gruppe selbst
 * (Telegram „TravelBuddy“). Dann heißt sie in der App TravelBuddy-Gruppe und der Hinweis sagt,
 * wer sie betreut. Ohne das Kennzeichen gilt sie als fremde Gruppe, nicht von TravelBuddy betrieben.
 */
export function bereinigeGruppen(g) {
  const tg = String(g?.telegram || '').trim()
  const dc = String(g?.discord || '').trim()
  const telegram = /^https:\/\/t\.me\/[A-Za-z0-9_+/-]{3,100}$/.test(tg) ? tg : ''
  const discord = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,40}$/.test(dc) ? dc : ''
  return { telegram, discord, telegramEigen: !!telegram && g?.telegramEigen === true, discordEigen: !!discord && g?.discordEigen === true }
}
export const gruppen = writable(bereinigeGruppen(lies(GRUPPEN_KEY, {})))
/** Neu laden, am Netz vorbei am Service Worker (?t=), ohne Netz bleibt der letzte Stand */
export async function ladeGruppen(holen = globalThis.fetch) {
  try {
    const r = await holen('/gruppen.json?t=' + Date.now(), { cache: 'no-store' })
    if (!r.ok) return get(gruppen)
    const g = bereinigeGruppen(await r.json())
    gruppen.set(g); schreib(GRUPPEN_KEY, g)
  } catch {}
  return get(gruppen)
}
