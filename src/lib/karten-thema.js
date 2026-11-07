// Kartendesign hell oder dunkel, unabhängig vom Rest der App (Mehr → Design → Karten), in zwei
// getrennten Schaltern: Übersichtskarten (Orte, Gegenden, Wander- und Routen-Ideen) und die große
// Karte unter Plan (dort auch über den Knopf ◐ auf der Karte). 'auto' folgt dem Erscheinungsbild der App.
// Die Übersichtskarten setzen data-karte="hell|dunkel" am <html>, daran hängen die Kartenfarben in app.css.
import { writable, readable, derived } from 'svelte/store'
import { theme } from './theme.js'

export const KARTEN_KEY = 'tb-karten-thema'
export const GROSS_KEY = 'tb-karte-gross-thema'
export const KARTEN_THEMEN = ['auto', 'hell', 'dunkel']

const gespeichert = (key) => {
  try { const v = localStorage.getItem(key); return KARTEN_THEMEN.includes(v) ? v : 'auto' } catch { return 'auto' }
}

export const kartenThema = writable(gespeichert(KARTEN_KEY))
kartenThema.subscribe((m) => { try { localStorage.setItem(KARTEN_KEY, m) } catch {} })
export const grossThema = writable(gespeichert(GROSS_KEY))
grossThema.subscribe((m) => { try { localStorage.setItem(GROSS_KEY, m) } catch {} })

const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
const systemDunkel = readable(!!media?.matches, (set) => {
  const neu = () => set(!!media?.matches)
  media?.addEventListener?.('change', neu)
  return () => media?.removeEventListener?.('change', neu)
})

/** Ist die Karte dunkel? karte: Wahl unter Design → Karten, app: Erscheinungsbild der App, system: dunkles System */
export function istKarteDunkel(karte, app, system) {
  if (karte === 'dunkel') return true
  if (karte === 'hell') return false
  if (app === 'dunkel') return true
  if (app === 'hell') return false
  return !!system
}

export const kartenDunkel = derived([kartenThema, theme, systemDunkel], ([k, a, s]) => istKarteDunkel(k, a, s))
export const grossDunkel = derived([grossThema, theme, systemDunkel], ([k, a, s]) => istKarteDunkel(k, a, s))

/** Knopf ◐ auf der großen Karte: wechselt zwischen hell und dunkel (aus „Wie die App“ wird die Gegenseite) */
export const grossUmschalten = (jetztDunkel) => grossThema.set(jetztDunkel ? 'hell' : 'dunkel')

if (typeof document !== 'undefined') {
  kartenDunkel.subscribe((d) => document.documentElement.setAttribute('data-karte', d ? 'dunkel' : 'hell'))
}
