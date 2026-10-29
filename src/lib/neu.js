// Neu-Blatt von überall öffnen (Ortskachel, Etappe, Logbuch …), ohne Eigenschaften durchzureichen.
import { writable } from 'svelte/store'
export const neuAnfrage = writable(null)   // { typ, vorlage }
export const oeffneNeu = (typ = 'route', vorlage = {}) => neuAnfrage.set({ typ, vorlage })
