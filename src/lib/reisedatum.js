// Global gewähltes Datum (YYYY-MM-DD) für die Sonnenzeiten-Berechnung.
import { writable } from 'svelte/store'

function heute() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const reiseDatum = writable(heute())
