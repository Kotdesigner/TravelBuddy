// Straßenlage WA: Zustand, Offline-Speicher und Abruf.
//
// Eigener Schlüssel `strassenlage-v1` im IndexedDB-Topf 'wa-plan'/'kv' (wie musik-v1).
// Nicht im Backup: die Daten sind nach Stunden veraltet und kommen jederzeit neu.
// Kaputte Quelle: der letzte Stand bleibt stehen und wird als „letzter bekannter Stand“
// markiert. Nichts wird erfunden.

import { writable, get } from 'svelte/store'
import { holeStrassenlage } from './strassenlage.js'

const DB = 'wa-plan', TOPF = 'kv', SCHLUESSEL = 'strassenlage-v1'
export const ABSTAND_MS = 15 * 60 * 1000

/** { meldungen: [], zeit: ms|null, fehler: string|null, ausCache: bool, laden: bool } */
export const strassenlage = writable({ meldungen: [], zeit: null, fehler: null, ausCache: false, laden: false })

function db() {
  return new Promise((ok, nein) => {
    if (typeof indexedDB === 'undefined') return nein(new Error('kein IndexedDB'))
    const r = indexedDB.open(DB)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TOPF)) r.result.createObjectStore(TOPF) }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => nein(r.error)
  })
}
async function lies() {
  const d = await db()
  return new Promise((ok) => {
    try { const q = d.transaction(TOPF).objectStore(TOPF).get(SCHLUESSEL); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null) } catch { ok(null) }
  })
}
async function schreib(wert) {
  const d = await db()
  return new Promise((ok) => {
    try { const t = d.transaction(TOPF, 'readwrite'); t.objectStore(TOPF).put(JSON.parse(JSON.stringify(wert)), SCHLUESSEL); t.oncomplete = ok; t.onerror = ok } catch { ok() }
  })
}

let gestartet = null
/** Letzten Stand aus dem Speicher holen (einmal je App-Start). */
export function starteStrassenlage() {
  if (gestartet) return gestartet
  gestartet = (async () => {
    try {
      const c = await lies()
      if (c && Array.isArray(c.meldungen) && !get(strassenlage).zeit) {
        strassenlage.update((s) => ({ ...s, meldungen: c.meldungen, zeit: c.zeit || null, ausCache: true }))
      }
    } catch {}
  })()
  return gestartet
}

let laeuft = null
/**
 * Neu abrufen. Ohne `erzwingen` höchstens alle 15 Minuten.
 * `fetchFn` und `speichern` sind für Tests ersetzbar.
 */
export async function aktualisiereStrassenlage({ erzwingen = false, fetchFn, speichern = schreib } = {}) {
  if (laeuft) return laeuft
  const s = get(strassenlage)
  if (!erzwingen && s.zeit && !s.ausCache && Date.now() - s.zeit < ABSTAND_MS) return s
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    strassenlage.update((x) => ({ ...x, ausCache: !!x.zeit }))
    return get(strassenlage)
  }
  laeuft = (async () => {
    await starteStrassenlage()
    strassenlage.update((x) => ({ ...x, laden: true }))
    const { meldungen, fehler } = await holeStrassenlage(fetchFn || globalThis.fetch)
    if (meldungen) {
      const zeit = Date.now()
      strassenlage.set({ meldungen, zeit, fehler: null, ausCache: false, laden: false })
      try { await speichern({ meldungen, zeit }) } catch {}
    } else {
      strassenlage.update((x) => ({ ...x, fehler, ausCache: !!x.zeit, laden: false }))
    }
    return get(strassenlage)
  })()
  try { return await laeuft } finally { laeuft = null }
}

/** Nur für Tests: Zustand zurücksetzen. */
export function _zuruecksetzen() {
  gestartet = null; laeuft = null
  strassenlage.set({ meldungen: [], zeit: null, fehler: null, ausCache: false, laden: false })
}
