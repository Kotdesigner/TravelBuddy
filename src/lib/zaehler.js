// Anonyme Zählung der App-Starts mit GoatCounter (dieselbe Seite wie die Website, travelbuddy-oz).
//
// Bewusst OHNE das GoatCounter-Skript: Fremder Code hätte im Browser Zugriff auf Logbuch, Fotos und
// Dokumente. Stattdessen schickt die App selbst eine winzige Meldung an den öffentlichen Zähler, und
// zwar nur einen Seitennamen („app“ oder „app-aktiv“) und einen Titel. Kein Cookie, keine
// Bildschirmgröße, keine Inhalte. GoatCounter sieht technisch IP-Adresse und Browser, speichert die
// IP-Adresse aber nicht und leitet daraus nur Land, Browser, System und Sprache ab.
//
// Gezählt wird:
//  - einmal beim Start („app“, ergibt Besucher)
//  - alle 5 Minuten, solange die App sichtbar ist, und beim Zurückkommen in die App
//    (Ereignis „app-aktiv“, ergibt „gerade aktiv“). Offline wird nichts gezählt und nichts nachgeholt.
//
// Nicht gezählt wird:
//  - auf jeder anderen Adresse als der veröffentlichten (localhost, Vorschau, Forks, Tests)
//  - wenn der Browser „Do Not Track“ oder „Global Privacy Control“ sendet
//  - wenn man unter Mehr → Datenschutz & Impressum die Zählung ausschaltet

import { writable } from 'svelte/store'

export const ZAEHL_ZIEL = 'https://travelbuddy-oz.goatcounter.com/count'
export const ZAEHL_HOST = 'travelbuddy-v1-wa.netlify.app'
export const PFAD_START = 'app'
export const PFAD_AKTIV = 'app-aktiv'
export const TAKT_MS = 5 * 60 * 1000
const KEY_AUS = 'tb-zaehlung-aus'

function liesAus() {
  try { return localStorage.getItem(KEY_AUS) === '1' } catch { return false }
}

/** true, wenn die Zählung auf diesem Gerät ausgeschaltet ist */
export const zaehlungAus = writable(liesAus())
zaehlungAus.subscribe((aus) => {
  try { aus ? localStorage.setItem(KEY_AUS, '1') : localStorage.removeItem(KEY_AUS) } catch {}
})

/** Will der Browser nicht verfolgt werden? */
export function browserWillNicht(nav = globalThis.navigator) {
  return nav?.doNotTrack === '1' || nav?.globalPrivacyControl === true
}

/** Darf hier überhaupt gezählt werden? */
export function zaehlenErlaubt({ host = globalThis.location?.hostname, nav = globalThis.navigator, aus = liesAus() } = {}) {
  return host === ZAEHL_HOST && !aus && !browserWillNicht(nav)
}

/** Die Adresse, genau so wie sie an GoatCounter geht */
export function zaehlAdresse(aktiv = false, rnd = Math.random().toString(36).slice(2, 7)) {
  const q = new URLSearchParams({ p: aktiv ? PFAD_AKTIV : PFAD_START, t: aktiv ? 'TravelBuddy App aktiv' : 'TravelBuddy App' })
  if (aktiv) q.set('e', 'true')
  q.set('b', '0')
  q.set('rnd', rnd)
  return `${ZAEHL_ZIEL}?${q}`
}

let letzte = 0
function sende(aktiv = false) {
  if (!zaehlenErlaubt() || !navigator.onLine) return
  letzte = Date.now()
  try { fetch(zaehlAdresse(aktiv), { method: 'GET', mode: 'no-cors', credentials: 'omit', cache: 'no-store', keepalive: true }).catch(() => {}) } catch {}
}

let gestartet = false
/** Einmal beim Start aufrufen */
export function starteZaehler() {
  if (gestartet || typeof window === 'undefined' || !zaehlenErlaubt()) return
  gestartet = true
  sende()
  const weiter = () => { if (document.visibilityState === 'visible' && Date.now() - letzte >= TAKT_MS - 5000) sende(true) }
  setInterval(weiter, TAKT_MS)
  document.addEventListener('visibilitychange', weiter)
}
