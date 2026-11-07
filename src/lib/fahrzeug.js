// Fahrzeug (1.27): 2WD oder 4WD als Vorgabe für neue Routen, gewählt in der Einführung.
// An jeder Route bleibt der 4WD-Schalter einzeln änderbar. Je Gerät in localStorage.
import { writable } from 'svelte/store'

export const ALLRAD_KEY = 'tb-allrad-vorgabe'
const lies = () => { try { return localStorage.getItem(ALLRAD_KEY) === '1' } catch { return false } }
export const allradVorgabe = writable(lies())
allradVorgabe.subscribe((an) => { try { localStorage.setItem(ALLRAD_KEY, an ? '1' : '0') } catch {} })

/** Bekommt eine neue Route den 4WD-Schalter? Eine Vorlage (z. B. 4WD-Routen-Idee) geht vor, sonst die Vorgabe. */
export const neueRouteAllrad = (vorlage = {}, vorgabe = lies()) => (vorlage.art || 'auto') === 'auto' && (vorlage.allrad === true || (vorlage.allrad !== false && vorgabe))
