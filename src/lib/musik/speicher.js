// Musik unterwegs: Speicher und Laufzeit.
//
// Zustand im selben IndexedDB-Topf wie die App (Schlüssel `musik-v1`), Einstellungen in
// localStorage. Der Zustand bleibt auf dem Gerät. Die Einstellungen wandern
// mit dem Backup aufs andere Gerät (außer „eingeschaltet“), damit man sie am iPhone nicht
// noch einmal eintippen muss. Spotify-Anmeldung und Token bleiben immer je Gerät.

import { writable, derived, get } from 'svelte/store'
import { LEER, neueAnzahl } from './zustand.js'
import { VORGABEN } from './ablauf.js'

const DB = 'wa-plan', TOPF = 'kv', SCHLUESSEL = 'musik-v1', CFG = 'tb-musik-cfg', CFG_STAND = 'tb-musik-cfg-stand'

function db() {
  return new Promise((ok, nein) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TOPF)) r.result.createObjectStore(TOPF) }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => nein(r.error)
  })
}
async function lies() {
  const d = await db()
  return new Promise((ok) => { const q = d.transaction(TOPF).objectStore(TOPF).get(SCHLUESSEL); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null) })
}
async function schreib(wert) {
  const d = await db()
  return new Promise((ok) => { const t = d.transaction(TOPF, 'readwrite'); t.objectStore(TOPF).put(JSON.parse(JSON.stringify(wert)), SCHLUESSEL); t.oncomplete = ok; t.onerror = ok })
}

export const musik = writable({ ...LEER })
export const musikCfg = writable((() => {
  try {
    const alt = JSON.parse(localStorage.getItem(CFG) || '{}')
    const c = { ...VORGABEN, ...alt, quellen: { ...VORGABEN.quellen, ...(alt.quellen || {}) } }
    // leere Felder aus älteren Ständen nicht über die festen Vorgaben legen
    // leer oder die ID der ersten, ersetzten Spotify-App: auf die aktuelle setzen
    if (!c.spotifyClientId || c.spotifyClientId === '2b6309bd536b4b67bb7cee9a45065c4d') c.spotifyClientId = VORGABEN.spotifyClientId
    if (!c.playlistId) c.playlistId = VORGABEN.playlistId
    if (!c.lastfmKey) c.lastfmKey = VORGABEN.lastfmKey
    return c
  } catch { return { ...VORGABEN } }
})())
export const musikNeu = derived(musik, (z) => neueAnzahl(z))

// ---------- Einstellungen im Backup ----------
//
// Was mitwandert: jede Einstellung aus VORGABEN außer `aktiv` (Musik unterwegs eingeschaltet).
// Das gilt je Gerät, sonst fragte das iPhone nach dem Import ungefragt nach dem Standort.
// Dazu ein Stempel der letzten Änderung auf DIESEM Gerät; beim Zusammenführen gewinnt die
// jüngere Fassung. Nie geändert = kein Stempel, dann gewinnt die Fassung mit Stempel.
const NUR_GERAET = new Set(['aktiv'])

/** Die Einstellungen, die ins Backup gehen (rein). */
export function einstellungenFuerAbgleich(c) {
  const raus = {}
  for (const k of Object.keys(VORGABEN)) if (!NUR_GERAET.has(k) && c?.[k] !== undefined) raus[k] = c[k]
  return JSON.parse(JSON.stringify(raus))
}

/** Einstellungen aus einem Backup auf die eigenen legen (rein). Nur bekannte Felder mit
    passendem Typ; `aktiv` bleibt, wie es auf diesem Gerät ist. */
export function einstellungenAusAbgleich(alt, werte) {
  if (!werte || typeof werte !== 'object') return alt
  const neu = { ...alt }
  for (const [k, vorgabe] of Object.entries(VORGABEN)) {
    if (NUR_GERAET.has(k) || !(k in werte)) continue
    const v = werte[k]
    if (Array.isArray(vorgabe)) { if (Array.isArray(v)) neu[k] = v.filter((x) => typeof x === 'string') }
    else if (vorgabe && typeof vorgabe === 'object') {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const q = { ...(alt[k] || vorgabe) }
        for (const [qk, qv] of Object.entries(v)) if (typeof qv === typeof vorgabe[qk]) q[qk] = qv
        neu[k] = q
      }
    } else if (typeof v === typeof vorgabe && (typeof v !== 'number' || Number.isFinite(v))) neu[k] = v
  }
  return neu
}

let cfgStand = (() => { try { return localStorage.getItem(CFG_STAND) || null } catch { return null } })()
let cfgUebernahme = false
let letzterAbgleich = JSON.stringify(einstellungenFuerAbgleich(get(musikCfg)))
musikCfg.subscribe((c) => {
  const j = JSON.stringify(einstellungenFuerAbgleich(c))
  if (j === letzterAbgleich) return
  letzterAbgleich = j
  if (cfgUebernahme) return
  cfgStand = new Date().toISOString()
  try { localStorage.setItem(CFG_STAND, cfgStand) } catch {}
})

/** Für baueBackupPayload: Werte und Stempel. */
export function musikFuerBackup() {
  return { werte: einstellungenFuerAbgleich(get(musikCfg)), stand: cfgStand }
}

/** Aus einem Backup übernehmen. Der Stempel kommt aus der Datei, nicht „jetzt“ — sonst
    gewänne ein bloß kopierter Wert später jeden Vergleich (wie bei Startdatum und Budget). */
export function musikAusBackup(m) {
  if (!m?.werte || typeof m.werte !== 'object') return
  cfgUebernahme = true
  try { musikCfg.update((c) => einstellungenAusAbgleich(c, m.werte)) } finally { cfgUebernahme = false }
  cfgStand = typeof m.stand === 'string' ? m.stand : null
  try {
    if (cfgStand) localStorage.setItem(CFG_STAND, cfgStand); else localStorage.removeItem(CFG_STAND)
    localStorage.setItem(CFG, JSON.stringify(get(musikCfg)))
  } catch {}
}
export const musikGeladen = writable(false)

let geladen = false, timer = 0
export async function musikLaden() {
  if (geladen) return
  geladen = true
  try { const w = await lies(); if (w) musik.set({ ...LEER, ...w }) } catch {}
  musikGeladen.set(true)
  musik.subscribe((z) => { clearTimeout(timer); timer = setTimeout(() => schreib(z).catch(() => {}), 400) })
  musikCfg.subscribe((c) => { try { localStorage.setItem(CFG, JSON.stringify(c)) } catch {} })
}

/** Zustand ändern (Funktion bekommt den alten, liefert den neuen) */
export const aendere = (fn) => musik.set(fn(get(musik)))
