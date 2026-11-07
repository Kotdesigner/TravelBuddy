// Offline-Routen in der App (V29): welches Netz für welche Stopps, Pisten-Netz laden und entfernen,
// und die Rechnung im Hintergrund (routing-worker.js).
//
// Reihenfolge (routen-dienst.js): online OSRM. Offline zuerst das Pisten-Netz des Gebiets, falls
// geladen (Lösung 3), sonst das Hauptstraßen-Netz (Lösung 2, immer dabei). Findet keins einen Weg
// oder liegen die Stopps in verschiedenen Gebieten, bleibt die Schätzung (Luftlinie mal Faktor).
import { writable } from 'svelte/store'
import { PISTEN_AUFSCHLAG } from './offline-router.js'
import { je } from './i18n.js'

// name je nach Sprache (beim Lesen bestimmt, damit Toasts und Listen auf Englisch englisch sind)
const gebiet = (de, en, rahmen) => ({ de, en, rahmen, get name() { return je(de, en) } })
export const GEBIETE = {
  wa: gebiet('Western Australia', 'Western Australia', [112.5, -35.6, 129.1, -13.4]),
  vic: gebiet('Melbourne und Umgebung', 'Melbourne and surrounds', [143.5, -39.25, 146.7, -37.2]),
  qld: gebiet('Cairns bis Whitsundays', 'Cairns to the Whitsundays', [144.0, -21.6, 149.6, -15.4]),
}
export const PISTEN_CACHE = 'routing-netze-v1'
export const netzUrl = (gebiet, art) => `/routing/${gebiet}-${art}.bin`

/** Gebiet, in dem alle Stopps mit Koordinaten liegen, sonst null */
export function gebietFuer(stops) {
  const p = (stops || []).filter((s) => s && s.lat != null && s.lon != null)
  if (p.length < 2) return null
  for (const [id, g] of Object.entries(GEBIETE)) {
    const [w, s, e, n] = g.rahmen
    if (p.every((x) => x.lon >= w && x.lon <= e && x.lat >= s && x.lat <= n)) return id
  }
  return null
}

/**
 * 4WD (V29): OSRM kennt keine Tracks und fährt dort weit außen herum (Mount Augustus bis Tom Price
 * 693 statt 346 km). Ist auf dem Pisten-Netz ein Abschnitt mindestens 30 km und 15 % kürzer, gilt
 * mit 4WD die Pisten-Route, auch online (routen-dienst.js, scripts/routen-strassen.mjs).
 */
export function allradBesser(osrm, piste) {
  const a = osrm?.legs || [], b = piste?.legs || []
  if (!a.length || a.length !== b.length) return false
  return a.some((l, i) => l.km - b[i].km >= 30 && l.km >= b[i].km * 1.15)
}

/** Welche Netze in welcher Reihenfolge (Pisten zuerst, wenn geladen) */
export function netzReihe(gebiet, pistenDa) {
  if (!gebiet) return []
  return [...(pistenDa ? [{ name: 'pisten', url: netzUrl(gebiet, 'pisten') }] : []), { name: 'haupt', url: netzUrl(gebiet, 'haupt') }]
}

// ---------- Pisten-Netz (Lösung 3): freiwillig je Gebiet ----------
export const pistenStand = writable({})   // gebiet → true, wenn auf dem Gerät
export const pistenLaedt = writable({})   // gebiet → true während des Ladens
let stand = {}
pistenStand.subscribe((s) => (stand = s))

export async function pistenPruefen() {
  if (typeof caches === 'undefined') return {}
  const s = {}
  try {
    const c = await caches.open(PISTEN_CACHE)
    for (const g of Object.keys(GEBIETE)) s[g] = !!(await c.match(netzUrl(g, 'pisten')))
  } catch {}
  pistenStand.set(s)
  return s
}

/** Netzgrößen und Zahlen aus public/routing/netze.json */
let manifest = null
export function netzInfo() {
  if (!manifest) manifest = fetch('/routing/netze.json').then((r) => (r.ok ? r.json() : {})).catch(() => { manifest = null; return {} })
  return manifest
}

export async function pistenLaden(gebiet) {
  pistenLaedt.update((s) => ({ ...s, [gebiet]: true }))
  try {
    const url = netzUrl(gebiet, 'pisten')
    const resp = await fetch(url, { cache: 'no-store' })
    if (!resp.ok) throw new Error('Pisten-Netz nicht erreichbar')
    const c = await caches.open(PISTEN_CACHE)
    await c.put(url, resp)
    worker?.postMessage({ vergessen: url })
    await pistenPruefen()
    return true
  } finally {
    pistenLaedt.update((s) => ({ ...s, [gebiet]: false }))
  }
}

export async function pistenEntfernen(gebiet) {
  const url = netzUrl(gebiet, 'pisten')
  try { await (await caches.open(PISTEN_CACHE)).delete(url) } catch {}
  worker?.postMessage({ vergessen: url })
  await pistenPruefen()
}

// ---------- Rechnen im Hintergrund ----------
// Für den Rechner nur, was die Zuordnung braucht (Linien, Rang, Art), nicht die ganzen Texte
const nurNoetig = (m) => ({ id: m.id, zeitMs: m.zeitMs || null, rang: m.rang, sperrung: m.sperrung || '', art: m.art || '', hinweis: m.hinweis || '', linien: m.linien || [], punkte: m.punkte || [] })
let worker = null, naechsteId = 1
const offen = new Map()
function rechner() {
  if (!worker) {
    worker = new Worker(new URL('./routing-worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => { const f = offen.get(e.data?.id); if (f) { offen.delete(e.data.id); f(e.data) } }
    worker.onerror = () => { for (const f of offen.values()) f({ route: null }); offen.clear() }
  }
  return worker
}

/**
 * Offline-Route für die Stopps: { route, quelle: 'pisten' | 'haupt', gebiet } oder null.
 * route hat die Form von berechneRoute (geometry, km, dauerMin, legs) plus offline, pisteKm, anschlussKm.
 * allrad: Pisten ohne Aufschlag (4WD-Schalter an der Route), sonst zählen sie 1,5-mal (PISTEN_AUFSCHLAG).
 */
export async function offlineRoute(stops, { meidePiste = false, allrad = false, sperrungen = null } = {}) {
  const gebiet = gebietFuer(stops)
  if (!gebiet || typeof Worker === 'undefined') return null
  if (stand[gebiet] === undefined) await pistenPruefen()
  const netze = netzReihe(gebiet, !!stand[gebiet])
  const p = (stops || []).filter((s) => s && s.lat != null && s.lon != null).map((s) => ({ lat: s.lat, lon: s.lon, name: s.name }))
  const id = naechsteId++
  const antwort = await new Promise((fertig) => { offen.set(id, fertig); rechner().postMessage({ id, stops: p, netze, meidePiste, allrad, pistenFaktor: allrad ? 1 : PISTEN_AUFSCHLAG, sperrungen: sperrungen ? sperrungen.map(nurNoetig) : null }) })
  return antwort?.route ? { route: antwort.route, quelle: antwort.quelle, gebiet } : null
}
