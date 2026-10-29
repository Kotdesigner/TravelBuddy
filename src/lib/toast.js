// Einheitliches Toast-System — EIN Meldungsweg für die
// ganze App. typ: 'ok' | 'fehler' | 'info'.
import { writable } from 'svelte/store'

export const toasts = writable([])
let zaehler = 0

export function zeigeToast(text, typ = 'info', dauer = 2400) {
  const id = ++zaehler
  toasts.update((t) => [...t.slice(-2), { id, text, typ }]) // max. 3 gleichzeitig
  setTimeout(() => toasts.update((t) => t.filter((x) => x.id !== id)), dauer)
}
