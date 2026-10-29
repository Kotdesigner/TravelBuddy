// Schriftgröße und Gesamtgröße einstellen (V7, 29.10.2026). Je Gerät in localStorage, nicht im Backup:
// Mac und iPhone haben verschiedene Bildschirme, jedes stellt man für sich ein.
//
// Schrift: nur die Texte. Alle Schriftgrößen der Bildschirm-Stile rechnen „Größe × --schrift“
// (tests/darstellung.test.mjs wacht darüber). Eingabefelder bleiben am iPhone mindestens 16 px,
// sonst zoomt Safari beim Antippen hinein.
//
// Gesamt: alles, auch Knöpfe, Abstände und Bilder.
//   iPhone/iPad: über den Viewport. Die Seite wird für eine schmalere Breite gebaut und vom Browser
//     vergrößert, wie „Anzeigezoom“ in den iOS-Einstellungen. Tippen und Karte bleiben genau.
//     Den Zoom übernehmen Browser nur beim Laden: index.html setzt ihn vor dem ersten Bild, und eine
//     Änderung lädt die App einmal neu (wie der Sprachwechsel). Daten bleiben, sie liegen im Speicher.
//   Mac: über CSS `zoom` am <html>.
import { writable } from 'svelte/store'

export const SCHRIFT = [
  { id: 'klein', wert: 0.9 }, { id: 'standard', wert: 1 }, { id: 'gross', wert: 1.15 }, { id: 'sehrgross', wert: 1.3 },
]
export const GESAMT = [
  { id: 'kompakt', wert: 0.9 }, { id: 'standard', wert: 1 }, { id: 'gross', wert: 1.1 }, { id: 'sehrgross', wert: 1.2 },
]
const KEY = 'tb-darstellung'
export const VORGABE = Object.freeze({ schrift: 'standard', gesamt: 'standard' })

/** Gespeicherten Wert prüfen: nur bekannte Stufen, sonst Standard. */
export function bereinige(roh) {
  const d = roh && typeof roh === 'object' ? roh : {}
  return {
    schrift: SCHRIFT.some((s) => s.id === d.schrift) ? d.schrift : VORGABE.schrift,
    gesamt: GESAMT.some((s) => s.id === d.gesamt) ? d.gesamt : VORGABE.gesamt,
  }
}
export const faktor = (liste, id) => liste.find((s) => s.id === id)?.wert ?? 1

/**
 * Passen zwei Ortskarten nebeneinander? Am Handy stehen sie zweispaltig; mit großer Schrift
 * und großer Gesamtgröße würden Etiketten und Knöpfe abgeschnitten. Dann eine Spalte.
 * @param breite  Breite der Seite in CSS-Pixeln (nach dem Viewport), s = Schriftfaktor
 */
export const eineSpalte = (breite, s) => !!breite && breite / 2 / (s || 1) < 150

/**
 * Inhalt für <meta name="viewport"> am Touch-Gerät. Bei Faktor 1 der normale Wert.
 * @param breite  CSS-Breite des Bildschirms in der aktuellen Lage (Hochformat: schmale Seite)
 */
export function viewportInhalt(g, breite) {
  if (!g || g === 1 || !breite) return 'width=device-width, initial-scale=1.0, viewport-fit=cover'
  const w = Math.round(breite / g)
  const s = Math.round(g * 1000) / 1000
  return `width=${w}, initial-scale=${s}, minimum-scale=${s}, viewport-fit=cover`
}

const lies = () => { try { return bereinige(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return { ...VORGABE } } }
export const darstellung = writable(lies())

const istTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
function bildschirmBreite() {
  // iOS meldet screen.width immer im Hochformat; im Querformat zählt die lange Seite
  const quer = typeof matchMedia !== 'undefined' && matchMedia('(orientation: landscape)').matches
  const a = screen.width, b = screen.height
  return quer ? Math.max(a, b) : Math.min(a, b)
}

function anwenden(d) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--schrift', String(faktor(SCHRIFT, d.schrift)))
  const g = faktor(GESAMT, d.gesamt)
  if (istTouch()) {
    root.style.zoom = ''
    const meta = document.querySelector('meta[name="viewport"]')
    if (meta) meta.setAttribute('content', viewportInhalt(g, bildschirmBreite()))
  } else {
    root.style.zoom = g === 1 ? '' : String(g)
  }
  // Nach dem Umbau des Viewports ist die neue Breite erst einen Augenblick später da
  setTimeout(spalten, 60)
}
function spalten() {
  if (typeof document === 'undefined') return
  const d = aktuell
  if (eineSpalte(window.innerWidth, faktor(SCHRIFT, d.schrift))) document.documentElement.setAttribute('data-eine-spalte', '')
  else document.documentElement.removeAttribute('data-eine-spalte')
}

let aktuell = { ...VORGABE }
darstellung.subscribe((d) => {
  aktuell = d
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
  anwenden(d)
})
if (typeof window !== 'undefined') {
  // Drehen: die Breite für den Viewport neu berechnen
  window.addEventListener('orientationchange', () => setTimeout(() => darstellung.update((d) => ({ ...d })), 250))
  window.addEventListener('resize', () => spalten())
}

export const setzeSchrift = (id) => darstellung.update((d) => bereinige({ ...d, schrift: id }))
export function setzeGesamt(id) {
  const vorher = aktuell.gesamt
  darstellung.update((d) => bereinige({ ...d, gesamt: id }))
  if (istTouch() && aktuell.gesamt !== vorher) setTimeout(() => location.reload(), 120)
}
