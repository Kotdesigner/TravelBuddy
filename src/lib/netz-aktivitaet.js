// Merkt, wann TravelBuddy gerade nach außen spricht: Daten aus dem Netz, GPS, Spotify.
// Der Rahmen um die App zeigt das an. Nur laufende Anfragen zählen, nie ihr Inhalt.
// Die Dauerbeobachtung für die Musik zählt nicht mit, sonst liefe der Rahmen ununterbrochen.
import { writable } from 'svelte/store'

export const netzAktiv = writable({ daten: 0, gps: 0, spotify: 0 })

const zaehle = (art, d) => netzAktiv.update((n) => ({ ...n, [art]: Math.max(0, n[art] + d) }))

/** Nach außen? Eigene Dateien der App zählen nicht. */
export function artVon(url, eigenerHost) {
  try {
    const u = new URL(url, 'http://' + eigenerHost)
    if (!/^https?:$/.test(u.protocol) || u.host === eigenerHost) return null
    return /(^|\.)spotify\.com$/.test(u.hostname) ? 'spotify' : 'daten'
  } catch { return null }
}

export function beobachteNetz() {
  if (typeof window === 'undefined' || window.__netzBeobachtet) return
  window.__netzBeobachtet = true
  const original = window.fetch
  window.fetch = function (eingabe, ...rest) {
    const art = artVon(typeof eingabe === 'string' ? eingabe : eingabe?.url || String(eingabe), location.host)
    if (!art) return original.call(this, eingabe, ...rest)
    zaehle(art, 1)
    return original.call(this, eingabe, ...rest).finally(() => zaehle(art, -1))
  }
  const geo = navigator.geolocation
  if (!geo) return
  const position = geo.getCurrentPosition.bind(geo)
  try {
    Object.defineProperty(geo, 'getCurrentPosition', {
      configurable: true,
      value(ok, fehler, optionen) {
        zaehle('gps', 1)
        let offen = true
        const fertig = () => { if (offen) { offen = false; zaehle('gps', -1) } }
        position((p) => { fertig(); ok?.(p) }, (e) => { fertig(); fehler?.(e) }, optionen)
      },
    })
  } catch {}
}
