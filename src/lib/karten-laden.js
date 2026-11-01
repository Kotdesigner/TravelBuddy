// Kartenmaterial aufs Gerät laden, aus der Einführung oder von der Kartenseite. Das läuft im
// Hintergrund weiter, egal welche Seite offen ist. Was schon liegt, wird nicht noch einmal geholt.
import { writable, get } from 'svelte/store'
import { teileFuer } from './karten-config.js'
import { setzeGrosseKarte } from './karten-wahl.js'

export const CACHE = 'karten-pmtiles-v2'
export const dateiUrl = (r) => location.origin + '/karten/' + r.datei

/** Während des Ladens { fertig, gesamt, name }, sonst null. */
export const kartenLauf = writable(null)
/** Zählt hoch, sobald ein Teil liegt. So sieht die Kartenseite neu nach. */
export const kartenStand = writable(0)

/** Größe eines Pakets in MB, für die Knöpfe. */
export const paketMB = (gross, alle) => Math.round(teileFuer(gross, alle).reduce((n, r) => n + r.mb, 0))

export async function ladeKartenteile(teile) {
  if (get(kartenLauf)) return
  kartenLauf.set({ fertig: 0, gesamt: teile.length, name: '' })
  try {
    const c = await caches.open(CACHE)
    for (const [i, r] of teile.entries()) {
      kartenLauf.set({ fertig: i, gesamt: teile.length, name: r.name })
      const url = dateiUrl(r)
      if (await c.match(url)) continue
      const resp = await fetch(url, { mode: 'same-origin' })
      if (!resp.ok) throw new Error(`${r.datei}: ${resp.status}`)
      await c.delete(url)            // genau EIN Eintrag je Datei, siehe Karte.svelte
      await c.put(url, resp)
      kartenStand.update((n) => n + 1)
    }
  } finally {
    kartenLauf.set(null)
    kartenStand.update((n) => n + 1)
  }
}

/** Das Paket, das jemand am Anfang wählt: klein oder groß. */
export function ladePaket(gross) {
  setzeGrosseKarte(gross)
  return ladeKartenteile(teileFuer(gross))
}
