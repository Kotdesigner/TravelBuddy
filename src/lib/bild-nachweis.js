// Herkunft der Ortsfotos: Urheber, Lizenz, Quelle und Stand (belegt, neu, symbol).
// Die Liste liegt in public/bilder-nachweis.json und wird einmal geladen, offline aus dem Cache.
import { writable } from 'svelte/store'

/** { ortId: Eintrag } */
export const bildNachweis = writable({})

let geladen = false
export async function ladeBildNachweis() {
  if (geladen) return
  geladen = true
  try {
    const r = await fetch('/bilder-nachweis.json')
    if (!r.ok) throw new Error(String(r.status))
    const liste = await r.json()
    bildNachweis.set(Object.fromEntries(liste.map((x) => [x.id, x])))
  } catch { geladen = false }
}

/** Bildersuche für einen Ort. Das Foto speichert jede Person selbst für sich. */
export const bildSuche = (name) => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(`${name.replace(/\([^)]*\)/g, ' ').trim()} Australia`)
