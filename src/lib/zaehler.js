// Anonyme Zählung der App-Starts mit Umami Cloud.
//
// Bewusst OHNE das Umami-Skript: Fremder Code hätte im Browser Zugriff auf Logbuch, Fotos und
// Dokumente. Stattdessen schickt die App selbst eine winzige Meldung, und zwar nur das hier:
// Kennung der Website, Hostname und „/“. Kein Cookie, keine Bildschirmgröße, keine Sprache,
// kein Referrer, keine Inhalte. IP-Adresse und Browsertyp sieht Umami technisch trotzdem,
// daraus bildet Umami einen Besucher-Schlüssel, der sich jeden Monat ändert.
//
// Gezählt wird:
//  - einmal beim Start (Seitenaufruf, ergibt „Besucher“)
//  - alle 5 Minuten, solange die App sichtbar ist, und beim Zurückkommen in die App
//    (Ereignis „aktiv“, ergibt „gerade aktiv“). Offline wird nichts gezählt und nichts nachgeholt.
//
// Nicht gezählt wird:
//  - solange UMAMI_ID leer ist
//  - auf jeder anderen Adresse als der veröffentlichten (localhost, Vorschau, Forks, Tests)
//  - wenn der Browser „Do Not Track“ oder „Global Privacy Control“ sendet
//  - wenn man unter Mehr → Datenschutz & Impressum die Zählung ausschaltet

import { writable } from 'svelte/store'

/** Website-Kennung aus Umami Cloud (öffentlich, kein Geheimnis). Leer = Zählung aus. */
export const UMAMI_ID = 'f60fc04e-e4f7-4641-a650-b058ade26956'
export const ZAEHL_HOST = 'travelbuddy-v1-wa.netlify.app'
export const ZAEHL_ZIEL = 'https://cloud.umami.is/api/send'
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
export function zaehlenErlaubt({ id = UMAMI_ID, host = globalThis.location?.hostname, nav = globalThis.navigator, aus = liesAus() } = {}) {
  return !!id && host === ZAEHL_HOST && !aus && !browserWillNicht(nav)
}

/** Die Meldung, genau so wie sie an Umami geht */
export function meldung(id, host, name) {
  const payload = { website: id, hostname: host, url: '/' }
  if (name) payload.name = name
  return { type: 'event', payload }
}

let letzte = 0
async function sende(name, { senden = globalThis.fetch } = {}) {
  if (!zaehlenErlaubt() || !navigator.onLine) return
  letzte = Date.now()
  try {
    await senden(ZAEHL_ZIEL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meldung(UMAMI_ID, location.hostname, name)),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    })
  } catch {}
}

let gestartet = false
/** Einmal beim Start aufrufen */
export function starteZaehler() {
  if (gestartet || typeof window === 'undefined' || !zaehlenErlaubt()) return
  gestartet = true
  sende()
  const weiter = () => { if (document.visibilityState === 'visible' && Date.now() - letzte >= TAKT_MS - 5000) sende('aktiv') }
  setInterval(weiter, TAKT_MS)
  document.addEventListener('visibilitychange', weiter)
}
