// V35: Notruf durch 7 schnelle Tipps irgendwo in der App. Gezählt werden nur Tipps auf freie Flächen, nie auf
// Knöpfe, Links, Felder oder Karten: so wird dabei nichts verstellt. Ab dem dritten Tipp liegt eine rote Fläche
// über allem (NotrufTippen.svelte), die weiterzählt und alle Tipps abfängt. Der siebte öffnet den Anruf an 000:
// Das Handy fragt dann selbst noch einmal „Anrufen?“ (iPhone) oder zeigt die Nummer im Telefon (Android).
// Abschalten unter Notfall (localStorage tb-notruf-tippen = 'aus').
import { writable } from 'svelte/store'

export const NOTRUF_NR = '000'
export const ANZAHL = 7
export const ABSTAND_MS = 700   // längste Pause zwischen zwei Tipps
export const ZEIGEN_AB = 3      // ab hier die rote Fläche

const KEY = 'tb-notruf-tippen'
const lies = () => { try { return globalThis.localStorage?.getItem(KEY) } catch { return null } }
export const notrufTippenAn = writable(lies() !== 'aus')
notrufTippenAn.subscribe((an) => { try { if (an) globalThis.localStorage?.removeItem(KEY); else globalThis.localStorage?.setItem(KEY, 'aus') } catch {} })

/** Zählt schnelle Tipps. tipp(zeit) gibt die Anzahl in Folge zurück oder 'los' beim siebten. */
export function neuerZaehler({ anzahl = ANZAHL, abstand = ABSTAND_MS } = {}) {
  let n = 0, zuletzt = -Infinity
  return {
    tipp(zeit) {
      n = zeit - zuletzt <= abstand ? n + 1 : 1
      zuletzt = zeit
      if (n >= anzahl) { n = 0; zuletzt = -Infinity; return 'los' }
      return n
    },
    stand: () => n,
    zurueck() { n = 0; zuletzt = -Infinity },
  }
}

/** Tipps auf Bedienelemente zählen nicht (sonst würde beim Zählen etwas umgeschaltet oder geöffnet) */
const BEDIENT = 'a, button, input, select, textarea, label, summary, option, [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="slider"], [role="tab"], [role="link"], [contenteditable=""], [contenteditable="true"], canvas, video, audio, iframe, .maplibregl-map, [data-kein-notruf-tippen]'
export const zaehltNicht = (el) => !el || typeof el.closest !== 'function' || !!el.closest(BEDIENT)
