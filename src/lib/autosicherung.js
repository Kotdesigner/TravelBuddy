// Automatische Sicherung: jeden Tag ein vollständiges Backup, ohne dass man etwas tun muss.
//
// Wann: Der Tag „schließt“ um 22 Uhr. Ist die App um 22 Uhr offen, sichert sie dann. War sie nicht offen,
// sichert sie beim nächsten Start sofort im Hintergrund. Fällig ist also immer, wenn es seit dem letzten
// 22-Uhr-Zeitpunkt noch keine Sicherung gab. So entsteht höchstens alle 24 Stunden eine.
//
// Wohin: Eine Web-App darf ohne Fingertipp keine Datei herunterladen und kein Teilen-Menü öffnen. Deshalb:
//  1. Immer: in einen eigenen Speicher auf diesem Gerät (IndexedDB „tb-autosicherung“), die letzten drei Tage.
//     Schützt vor kaputten Daten und versehentlichem Löschen, nicht vor dem Verlust des Geräts.
//  2. Zusätzlich, wo der Browser es kann (Chrome und Edge am Computer): als Datei in einen Ordner, den man
//     einmal auswählt. Die Freigabe muss der Browser ab und zu neu bestätigen lassen.
// Eine Kopie außerhalb des Geräts (AirDrop, Mail, Cloud) bleibt „Backup sichern“ von Hand.

import { writable, get } from 'svelte/store'

export const SCHLUSS_STUNDE = 22
export const BEHALTEN = 3
const KEY_CFG = 'tb-autosicherung-an'
const DB = 'tb-autosicherung', TOPF = 'kv'

/** Letzter 22-Uhr-Zeitpunkt vor oder gleich `jetzt` (lokale Zeit) */
export function letzterSchluss(jetzt = Date.now(), stunde = SCHLUSS_STUNDE) {
  const d = new Date(jetzt)
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), stunde, 0, 0, 0)
  if (s.getTime() > jetzt) s.setDate(s.getDate() - 1)
  return s.getTime()
}

/** Ist eine Sicherung fällig? Ja, wenn es seit dem letzten 22-Uhr-Zeitpunkt keine gab. */
export function faellig(letzte, jetzt = Date.now()) {
  if (!letzte) return true
  return letzte < letzterSchluss(jetzt)
}

/** Dateiname einer automatischen Sicherung */
export function dateiname(zeit = Date.now()) {
  const d = new Date(zeit)
  const z = (n) => String(n).padStart(2, '0')
  return `WA-Reiseplan-Auto-Backup_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.json`
}

/** Ein Stand ohne eigene Einträge (neues Gerät, vor dem ersten Import) wird nicht gesichert */
export function istLeer(p) {
  const n = (x) => (Array.isArray(x) ? x.length : 0)
  return !p || (n(p.reisen) + n(p.journal) + n(p.eigeneOrte) + n(p.notizen) + n(p.wanderungen) + n(p.buchungen?.events) + n(p.vorabKosten)) === 0
}

/** Größe lesbar: kleine Sicherungen in KB */
export function groesse(bytes = 0) {
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`
}

/** Liste aktualisieren: neue Sicherung vorn, höchstens `behalten`, eine je Kalendertag */
export function neueListe(alt = [], eintrag, behalten = BEHALTEN) {
  const tag = (z) => new Date(z).toDateString()
  return [eintrag, ...(alt || []).filter((x) => x && tag(x.zeit) !== tag(eintrag.zeit))].slice(0, behalten)
}

// ---------------------------------------------------------------- Speicher

function idb(modus, fn) {
  return new Promise((ok, nein) => {
    if (typeof indexedDB === 'undefined') return ok(null)
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(TOPF)
    r.onerror = () => nein(r.error)
    r.onsuccess = () => {
      const db = r.result
      const tx = db.transaction(TOPF, modus)
      const erg = fn(tx.objectStore(TOPF))
      tx.oncomplete = () => { db.close(); ok(erg?.result ?? null) }
      tx.onerror = () => { db.close(); nein(tx.error) }
      tx.onabort = () => { db.close(); nein(tx.error || new Error('abgebrochen')) }
    }
  })
}
const lies = (key) => idb('readonly', (s) => s.get(key))
const schreib = (key, wert) => idb('readwrite', (s) => s.put(wert, key))

/** Stand für die Anzeige: { an, liste: [{ zeit, groesse }], ordner: Name|'' , fehler } */
export const autoStand = writable({ an: true, liste: [], ordner: '', ordnerNeu: false, fehler: '', laeuft: false })

function liesAn() { try { return localStorage.getItem(KEY_CFG) !== '0' } catch { return true } }
export function setzeAn(an) {
  try { localStorage.setItem(KEY_CFG, an ? '1' : '0') } catch {}
  autoStand.update((s) => ({ ...s, an }))
}

export async function ladeStand() {
  try {
    const liste = (await lies('liste')) || []
    const ordner = await lies('ordner')
    autoStand.update((s) => ({ ...s, an: liesAn(), liste: liste.map(({ zeit, groesse }) => ({ zeit, groesse })), ordner: ordner?.name || '' }))
  } catch { autoStand.update((s) => ({ ...s, an: liesAn() })) }
}

/** Kann dieser Browser in einen gewählten Ordner schreiben? (Chrome und Edge am Computer) */
export const ordnerMoeglich = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'

/** Ordner wählen (nur nach einem Fingertipp möglich) */
export async function waehleOrdner() {
  const h = await window.showDirectoryPicker({ id: 'travelbuddy-backup', mode: 'readwrite' })
  await schreib('ordner', h)
  autoStand.update((s) => ({ ...s, ordner: h.name, ordnerNeu: false }))
  return h.name
}
export async function vergissOrdner() {
  await schreib('ordner', null)
  autoStand.update((s) => ({ ...s, ordner: '', ordnerNeu: false }))
}

async function inOrdner(text, zeit) {
  const h = await lies('ordner')
  if (!h || typeof h.queryPermission !== 'function') return 'kein'
  // Ohne Fingertipp darf nur geschrieben werden, wenn die Freigabe noch gilt
  if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    autoStand.update((s) => ({ ...s, ordnerNeu: true }))
    return 'freigabe'
  }
  const datei = await h.getFileHandle(dateiname(zeit), { create: true })
  const w = await datei.createWritable()
  await w.write(text)
  await w.close()
  autoStand.update((s) => ({ ...s, ordnerNeu: false }))
  return 'ok'
}

/** Freigabe für den Ordner nach einem Fingertipp erneuern und gleich nachsichern */
export async function ordnerFreigeben(payloadBauen) {
  const h = await lies('ordner')
  if (!h) return false
  const ok = (await h.requestPermission({ mode: 'readwrite' })) === 'granted'
  if (ok) await sichere(payloadBauen, { erzwingen: true })
  return ok
}

// ---------------------------------------------------------------- Sichern

let laeuft = false
/**
 * Jetzt sichern, wenn fällig (oder `erzwingen`). Still im Hintergrund, ohne Meldung.
 * `payloadBauen` liefert das Backup wie „Backup sichern“ (alles außer Belegen, Tagebuch-Fotos und Schlüsseln).
 */
export async function sichere(payloadBauen, { erzwingen = false, jetzt = Date.now() } = {}) {
  if (laeuft || !liesAn()) return false
  const liste = (await lies('liste').catch(() => null)) || []
  if (!erzwingen && !faellig(liste[0]?.zeit, jetzt)) return false
  laeuft = true
  autoStand.update((s) => ({ ...s, laeuft: true }))
  try {
    // payloadBauen() liefert null, solange nicht gesichert werden soll (Testreise läuft)
    const roh = payloadBauen()
    if (!roh) return false
    const payload = { ...roh, automatisch: true }
    if (istLeer(payload)) return false
    const text = JSON.stringify(payload)
    // Nicht den Speicher füllen: Ist wenig Platz, nur noch die neueste Sicherung behalten
    let behalten = BEHALTEN
    try {
      const e = await navigator.storage?.estimate?.()
      if (e?.quota && e.quota - e.usage < text.length * 4) behalten = 1
    } catch {}
    const eintrag = { zeit: jetzt, groesse: text.length, text }
    const neu = neueListe(liste, eintrag, behalten)
    await schreib('liste', neu)
    let ordner = 'kein'
    try { ordner = await inOrdner(text, jetzt) } catch { ordner = 'fehler' }
    autoStand.update((s) => ({ ...s, liste: neu.map(({ zeit, groesse }) => ({ zeit, groesse })), fehler: ordner === 'fehler' ? 'ordner' : '' }))
    return true
  } catch {
    autoStand.update((s) => ({ ...s, fehler: 'speicher' }))
    return false
  } finally {
    laeuft = false
    autoStand.update((s) => ({ ...s, laeuft: false }))
  }
}

/** Eine gespeicherte Sicherung als Datei zurückholen (für den normalen Import mit Vorschau) */
export async function alsDatei(zeit) {
  const liste = (await lies('liste')) || []
  const e = liste.find((x) => x.zeit === zeit)
  if (!e) return null
  return new File([e.text], dateiname(e.zeit), { type: 'application/json' })
}

/**
 * Wächter starten: beim Start nach kurzer Pause, dann jede Minute (für 22 Uhr) und beim Zurückkommen in
 * die App. Rückgabe: Funktion zum Beenden.
 */
export function starteWaechter(payloadBauen, { verzoegerungMs = 5000 } = {}) {
  ladeStand()
  const pruefe = () => { if (document.visibilityState === 'visible') sichere(payloadBauen).catch(() => {}) }
  const erst = setTimeout(pruefe, verzoegerungMs)
  const uhr = setInterval(pruefe, 60e3)
  document.addEventListener('visibilitychange', pruefe)
  return () => { clearTimeout(erst); clearInterval(uhr); document.removeEventListener('visibilitychange', pruefe) }
}
