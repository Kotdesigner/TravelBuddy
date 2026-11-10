// Meldungen für andere Reisende (V32), Seite der App: laden, zwischenspeichern für offline, melden mit
// Warteschlange im Funkloch, abstimmen, unpassend melden, zurückziehen, und die Auswahl je Route, Ort
// und Gegend. Regeln: meldungen-regeln.js (gleich im Server). Server: netlify/functions/meldungen.mjs
import { writable, get } from 'svelte/store'
import { pruefeNeu, sortiere, aktiv, gegendVon, blass } from './meldungen-regeln.js'
import { stichproben, baueGitter, aufRoute } from './routenhinweise.js'

/** Meldungen gehen immer an dieselbe Seite. Ohne Netlify-Funktionen (selbst veröffentlicht als reiner Ordner) gibt es keine. */
export const API = '/api/meldungen'
/** Die Seite, auf der es die Meldungen gibt (für den Hinweis, wenn eine eigene Kopie keinen Server hat) */
export const OFFIZIELL = 'travelbuddy-v1-wa.netlify.app'
const K = { cache: 'tb-meldungen-cache', meine: 'tb-meldungen-meine', stimmen: 'tb-meldungen-stimmen', geraet: 'tb-geraet-id', regeln: 'tb-meldungen-regeln-ok', zu: 'tb-heute-mit-zu' }
/** Meldungen bis so weit neben einer Route gehören zu ihr, an einem Ort so weit drumherum */
export const ROUTE_KM = 25
export const ORT_KM = 15

const speicher = () => { try { return globalThis.localStorage || null } catch { return null } }
function lies(k, ersatz) { try { const v = speicher()?.getItem(k); return v ? JSON.parse(v) : ersatz } catch { return ersatz } }
function schreib(k, v) { try { speicher()?.setItem(k, JSON.stringify(v)) } catch {} }
const liste = (x) => (Array.isArray(x) ? x : [])

/** Zufällige Kennung dieses Geräts, nur für Stimmen und die Spam-Grenze. Der Server speichert davon nur einen Prüfwert. */
export function geraetId() {
  let id = lies(K.geraet, '')
  if (!/^[a-f0-9]{32}$/.test(id)) {
    const b = new Uint8Array(16)
    globalThis.crypto.getRandomValues(b)
    id = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
    schreib(K.geraet, id)
  }
  return id
}

const cache = lies(K.cache, {})
/**
 * { liste, stand, gruppe, verfuegbar }: zuletzt geladener Stand, auch ohne Netz. gruppe: Meldungen gehen auch in die
 * Telegram-Gruppe. verfuegbar: false, wenn diese Seite keinen Meldungs-Server hat (404 oder eine Seite statt Daten).
 */
export const meldungen = writable({ liste: liste(cache.liste).filter((m) => m && m.id), stand: cache.stand || 0, gruppe: cache.gruppe === true, verfuegbar: cache.verfuegbar !== false })
// Jede Änderung (eigene Meldung, Stimme, Zurückziehen) auch in den Zwischenspeicher, sonst fehlt sie nach einem Neustart ohne Netz
meldungen.subscribe((s) => schreib(K.cache, s))
/** Eigene Meldungen: { lokalId, roh, status: wartet | live | abgelehnt | zurueck, id?, schluessel?, grund?, erstellt } */
export const meine = writable(liste(lies(K.meine, [])).filter((m) => m && m.lokalId))
/** Eigene Stimmen je Meldung: ja | nein, und unpassend als eigener Merker */
export const stimmen = writable(lies(K.stimmen, {}) || {})
const sichern = () => { schreib(K.meine, get(meine)); schreib(K.stimmen, get(stimmen)) }

export const regelnGelesen = () => lies(K.regeln, false) === true
export const regelnOk = () => schreib(K.regeln, true)

/** Aktive Meldungen vom Server holen. Ohne Netz bleibt der letzte Stand. */
export async function laden(holen = globalThis.fetch) {
  try {
    const r = await holen(API, { cache: 'no-store' })
    const keinServer = () => { const s = { ...get(meldungen), verfuegbar: false }; meldungen.set(s); schreib(K.cache, s); return false }
    if (r.status === 404) return keinServer()
    if (!r.ok) return false
    // Statische Seiten liefern für jede Adresse die App selbst aus: dann gibt es hier keinen Server
    if (!/json/i.test(r.headers?.get?.('content-type') || 'application/json')) return keinServer()
    const j = await r.json()
    if (!j?.ok || !Array.isArray(j.meldungen)) return false
    const neu = { liste: j.meldungen, stand: j.stand || Date.now(), gruppe: j.gruppe === true, verfuegbar: true }
    meldungen.set(neu); schreib(K.cache, neu)
    // Eigene, die es auf dem Server nicht mehr gibt (abgelaufen, gelöscht), als vorbei kennzeichnen
    const ids = new Set(j.meldungen.map((m) => m.id))
    meine.update((ms) => ms.map((m) => (m.status === 'live' && !ids.has(m.id) ? { ...m, status: 'vorbei' } : m)))
    sichern()
    return true
  } catch { return false }
}

async function post(daten, holen) {
  const r = await holen(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, ...j }
}

// Was gerade unterwegs ist. Ohne diese Sperre könnten Melden, Netz-zurück und der Takt dieselbe Meldung doppelt senden.
const unterwegs = new Set()

/** Eine eigene Meldung senden. Netzfehler: bleibt in der Warteschlange. Abgelehnt: bleibt mit Grund stehen. */
async function senden(eintrag, holen) {
  if (unterwegs.has(eintrag.lokalId)) return eintrag
  unterwegs.add(eintrag.lokalId)
  try {
    const e = await post({ aktion: 'neu', geraet: geraetId(), meldung: eintrag.roh }, holen)
    if (e.ok && e.meldung) {
      // Während des Sendens „Nicht senden“ getippt: gleich wieder zurückziehen, statt sie stehen zu lassen
      const zurueckGetippt = get(meine).find((m) => m.lokalId === eintrag.lokalId)?.status === 'zurueck'
      meine.update((ms) => ms.map((m) => (m.lokalId !== eintrag.lokalId ? m
        : zurueckGetippt ? { ...m, id: e.meldung.id, schluessel: e.schluessel } : { ...m, status: 'live', id: e.meldung.id, schluessel: e.schluessel })))
      if (zurueckGetippt) await post({ aktion: 'zurueck', id: e.meldung.id, schluessel: e.schluessel }, holen).catch(() => {})
      else meldungen.update((s) => ({ ...s, liste: [e.meldung, ...s.liste.filter((x) => x.id !== e.meldung.id)] }))
    } else if (e.status === 429 || e.status >= 500) {
      // später noch einmal
    } else {
      meine.update((ms) => ms.map((m) => (m.lokalId === eintrag.lokalId && m.status !== 'zurueck' ? { ...m, status: 'abgelehnt', grund: e.grund || 'fehler' } : m)))
    }
  } catch {} finally { unterwegs.delete(eintrag.lokalId) }
  sichern()
  return get(meine).find((m) => m.lokalId === eintrag.lokalId)
}

/**
 * Melden. Prüft wie der Server, speichert sofort auf dem Gerät und sendet, wenn Netz da ist.
 * Rückgabe { eintrag } oder { fehler } (Grund wie textProblem: kurz, lang, nummer, mail, link, ort, art)
 */
export async function melden(roh, { online = true, holen = globalThis.fetch, jetzt = Date.now() } = {}) {
  const { meldung, fehler } = pruefeNeu(roh)
  if (fehler) return { fehler }
  const eintrag = { lokalId: 'l' + jetzt.toString(36) + Math.random().toString(36).slice(2, 6), roh: meldung, status: 'wartet', erstellt: jetzt }
  meine.update((ms) => [eintrag, ...ms].slice(0, 100))
  sichern()
  return { eintrag: online ? await senden(eintrag, holen) : eintrag }
}

/** Alles aus der Warteschlange senden (beim Start und wenn das Netz wiederkommt) */
export async function sendeWartende(holen = globalThis.fetch) {
  if (get(meldungen).verfuegbar === false) return
  for (const m of get(meine).filter((x) => x.status === 'wartet')) await senden(m, holen)
}

/** So alt darf der geladene Stand werden, bevor die App ihn beim Nachsehen neu holt */
export const FRISCH_MS = 10 * 60 * 1000

/**
 * Nachsehen, auch wenn sich am Netz nichts ändert: Im Funkloch meldet das iPhone oft weiter „online“,
 * und im Hintergrund vergeht viel Zeit. Wartende senden, dann neu laden, wenn etwas raus ist oder der Stand alt ist.
 */
export async function nachsehen({ holen = globalThis.fetch, jetzt = Date.now() } = {}) {
  const warteten = get(meine).filter((m) => m.status === 'wartet').length
  if (warteten) await sendeWartende(holen)
  const raus = warteten > get(meine).filter((m) => m.status === 'wartet').length
  if (raus || jetzt - (get(meldungen).stand || 0) > FRISCH_MS) await laden(holen)
}

/** „Stimmt noch“ oder „Nicht mehr“. Sofort sichtbar, der Server zählt nach. */
export async function stimme(id, wert, holen = globalThis.fetch) {
  const vorher = get(stimmen)[id]
  if (vorher === wert) return
  stimmen.update((s) => ({ ...s, [id]: wert }))
  meldungen.update((s) => ({ ...s, liste: s.liste.map((m) => (m.id !== id ? m : {
    ...m, ja: m.ja + (wert === 'ja' ? 1 : 0) - (vorher === 'ja' ? 1 : 0), nein: m.nein + (wert === 'nein' ? 1 : 0) - (vorher === 'nein' ? 1 : 0) })) }))
  sichern()
  try { const e = await post({ aktion: 'stimme', id, wert, geraet: geraetId() }, holen); if (e.meldung) meldungen.update((s) => ({ ...s, liste: s.liste.map((m) => (m.id === id ? e.meldung : m)) })) } catch {}
}

export async function unpassend(id, holen = globalThis.fetch) {
  stimmen.update((s) => ({ ...s, ['u:' + id]: true }))
  sichern()
  try { await post({ aktion: 'unpassend', id, geraet: geraetId() }, holen) } catch {}
}

/** Eigene Meldung zurückziehen. Wartende werden einfach nicht gesendet. */
export async function zurueckziehen(lokalId, holen = globalThis.fetch) {
  const m = get(meine).find((x) => x.lokalId === lokalId)
  if (!m) return false
  if (m.status === 'live' && m.id) {
    try { const e = await post({ aktion: 'zurueck', id: m.id, schluessel: m.schluessel }, holen); if (!e.ok) return false } catch { return false }
    meldungen.update((s) => ({ ...s, liste: s.liste.filter((x) => x.id !== m.id) }))
  }
  meine.update((ms) => ms.map((x) => (x.lokalId === lokalId ? { ...x, status: 'zurueck' } : x)))
  sichern()
  return true
}

// ---------- Auswahl ----------

const kmZwischen = (la1, lo1, la2, lo2) => {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}
const jetztAktiv = (l, jetzt) => l.filter((m) => aktiv(m, jetzt))

/** Meldungen an einer Route, nach Kilometer: [{ ...meldung, km }] */
export function anRoute(r, alle, { maxKm = ROUTE_KM, jetzt = Date.now() } = {}) {
  const geo = r?.route?.geometry?.length > 1 ? r.route.geometry : (r?.stops || []).filter((s) => s.lat != null && s.lon != null).map((s) => [s.lon, s.lat])
  if (!geo || geo.length < 2) return []
  const gitter = baueGitter(stichproben(geo, 1, r?.route?.km || null))
  return jetztAktiv(alle, jetzt).map((m) => { const c = aufRoute(gitter, m.lon, m.lat, maxKm); return c ? { ...m, km: Math.round(c.km) } : null })
    .filter(Boolean).sort((a, b) => a.km - b.km)
}
/** Meldungen um einen Punkt (Ortskachel), wichtigste zuerst */
export const nahe = (lat, lon, alle, { maxKm = ORT_KM, jetzt = Date.now() } = {}) =>
  lat == null || lon == null ? [] : sortiere(jetztAktiv(alle, jetzt).filter((m) => kmZwischen(lat, lon, m.lat, m.lon) <= maxKm))
/** Meldungen einer Gegend, wichtigste zuerst; Art optional */
export const inGegend = (gegend, alle, { art = null, jetzt = Date.now() } = {}) =>
  sortiere(jetztAktiv(alle, jetzt).filter((m) => (!gegend || m.gegend === gegend) && (!art || m.art === art)))
export { gegendVon, blass, sortiere }

/**
 * Heute: was wirklich auf dem Weg liegt. Mit Fahrt heute alles bis ROUTE_KM neben der Route (nach km),
 * ohne Fahrt alles bis ROUTE_KM um den Standort. Blasse („Nicht mehr“) zählen nicht. Alle Arten.
 */
export function aufDemWeg({ reise = null, standort = null, alle = [], jetzt = Date.now() } = {}) {
  const l = reise ? anRoute(reise, alle, { jetzt }) : standort?.lat != null ? nahe(standort.lat, standort.lon, alle, { maxKm: ROUTE_KM, jetzt }) : []
  return { art: reise ? 'strecke' : 'naehe', liste: l.filter((m) => !blass(m)), mitBlassen: l }
}
/** Von selbst offen, wenn etwas auf dem Weg liegt, das beim letzten Zuklappen noch nicht da war */
export const vonSelbstOffen = (liste, zuIds = []) => liste.some((m) => !zuIds.includes(m.id))
/** Was auf dem Weg lag, als der Abschnitt zugeklappt wurde */
export const zugeklappt = () => liste(lies(K.zu, [])).filter((x) => typeof x === 'string')
export const merkeZugeklappt = (ids) => schreib(K.zu, liste(ids).slice(0, 50))
/** Beim Zuklappen dazunehmen statt ersetzen: Was schon weggeklappt war, bleibt es, auch wenn es gerade nicht zu sehen ist */
export const zuklappenMit = (zuIds, ids) => [...new Set([...liste(ids), ...liste(zuIds)])].slice(0, 50)

/** Neu seit dem letzten Blick, höchstens drei Tage zurück */
export const neuSeit = (alle, seit, jetzt = Date.now()) => alle.filter((m) => m.erstellt > Math.max(seit || 0, jetzt - 3 * 864e5)).length
