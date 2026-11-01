// Optische Effekte, je Gerät an- und abschaltbar. Nicht im Backup, wie Schrift und Größe.
import { writable } from 'svelte/store'

const KEY = 'tb-effekte'
export const VORGABE = Object.freeze({ verblassen: true, kopf: true, rahmen: true, stimmung: true, hitze: true, sonne: true, temperatur: true })

function lies() {
  try { return { ...VORGABE, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...VORGABE } }
}

export const effekte = writable(lies())

function anwenden(e) {
  if (typeof document === 'undefined') return
  document.documentElement.toggleAttribute('data-ohne-verblassen', !e.verblassen)
  document.documentElement.toggleAttribute('data-ohne-kopf', !e.kopf)
}
effekte.subscribe(anwenden)

export function setzeEffekt(id, an) {
  effekte.update((e) => {
    const neu = { ...e, [id]: !!an }
    try { localStorage.setItem(KEY, JSON.stringify(neu)) } catch {}
    return neu
  })
}
export function setzeAlleEffekte(an) {
  for (const id of Object.keys(VORGABE)) setzeEffekt(id, an)
}
