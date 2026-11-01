// Große Karte: ob dieses Gerät die vier Stufe-14-Teile von Western Australia benutzt. Den Schalter gibt
// es nur im Build mit großer Karte. In den Apps für Mac und Windows liegen die Teile schon auf der
// Platte und sind von selbst an, im Netz lädt sie nur, wer es einschaltet. Je Gerät, nicht im Backup.
import { writable } from 'svelte/store'
import { GROSSE_KARTE } from './karten-config.js'

const KEY = 'tb-grosse-karte'

/** Startwert: Die gespeicherte Wahl gewinnt, sonst an, wenn die App vom eigenen Rechner kommt. */
export function grossStart(hatTeile, gespeichert, host) {
  if (!hatTeile) return false
  if (gespeichert === 'an' || gespeichert === 'aus') return gespeichert === 'an'
  return host === '127.0.0.1' || host === 'localhost'
}

function lies() { try { return localStorage.getItem(KEY) } catch { return null } }

export const grosseKarteAn = writable(grossStart(GROSSE_KARTE, lies(), typeof location === 'undefined' ? '' : location.hostname))

export function setzeGrosseKarte(an) {
  try { localStorage.setItem(KEY, an ? 'an' : 'aus') } catch {}
  grosseKarteAn.set(an)
}
