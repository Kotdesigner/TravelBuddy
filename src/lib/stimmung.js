// Die App färbt sich leicht wie das Wetter draußen. Nur Grundtöne ändern sich, Warnfarben nie.
import * as SunCalc from 'suncalc'
import { get, writable } from 'svelte/store'
import { effekte } from './effekte.js'
import { je } from './i18n.js'
import { zeigeToast } from './toast.js'

const KEY = 'tb-stimmung'
const FRISCH = 30 * 60 * 1000

/** code: WMO-Wettercode. Ergebnis: heiss, regen, bewoelkt, nacht oder '' für das normale Design. */
export function stimmungVon({ temp, code, nacht = false } = {}) {
  if (nacht) return 'nacht'
  if (code >= 51) return 'regen'
  if (temp >= 33) return 'heiss'
  if ([2, 3, 45, 48].includes(code)) return 'bewoelkt'
  return ''
}

export function istNacht(lat, lon, jetzt = new Date()) {
  const s = SunCalc.getTimes(jetzt, lat, lon)
  if (isNaN(s.sunrise) || isNaN(s.sunset)) return false
  return jetzt < s.sunrise || jetzt > s.sunset
}

const zeige = (s) => {
  if (typeof document === 'undefined') return
  if (s) document.documentElement.dataset.stimmung = s
  else delete document.documentElement.dataset.stimmung
}
function gemerkt() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } }

// Beim Start gleich die letzte Stimmung, auch offline
if (typeof localStorage !== 'undefined') effekte.subscribe((e) => zeige(e.stimmung ? gemerkt()?.s || '' : ''))

// Einmal je Start kurz flimmern, dann steht der Schriftzug wieder ruhig
let hitzeGezeigt = false
function hitzeLogo(temp) {
  if (hitzeGezeigt || !(temp >= 38) || !get(effekte).hitze || typeof document === 'undefined') return
  hitzeGezeigt = true
  document.documentElement.setAttribute('data-hitze', '')
  setTimeout(() => document.documentElement.removeAttribute('data-hitze'), 3000)
}
if (typeof localStorage !== 'undefined') hitzeLogo(gemerkt()?.temp)

/** Liegt der Moment bis zu 30 Minuten vor Sonnenuntergang? */
export function kurzVorUntergang(lat, lon, jetzt = new Date()) {
  const u = SunCalc.getTimes(jetzt, lat, lon).sunset
  if (isNaN(u)) return false
  const rest = u - jetzt
  return rest > 0 && rest <= 30 * 60 * 1000
}

export const goldRahmen = writable(false)
/** Einmal am Tag: Rahmen leuchtet golden, dazu ein kurzer Hinweis. */
export function pruefeSonnenuntergang(pos, jetzt = new Date()) {
  if (!pos || !get(effekte).sonne || !kurzVorUntergang(pos.lat, pos.lon, jetzt)) return
  const tag = jetzt.toDateString()
  try { if (localStorage.getItem('tb-sonne-tag') === tag) return; localStorage.setItem('tb-sonne-tag', tag) } catch { return }
  goldRahmen.set(true)
  setTimeout(() => goldRahmen.set(false), 7000)
  zeigeToast(je('🌅 Noch rund 30 Minuten Licht', '🌅 About 30 minutes of light left'), 'ok')
}

/** Position der Zahl am Rand in Prozent der Höhe: 45 Grad oben, minus 5 Grad unten. */
export const tempHoehe = (t) => 14 + (45 - Math.max(-5, Math.min(45, t))) * 1.4
const SILBER = [201, 206, 214], ROT = [235, 52, 44], BLAU = [52, 128, 240]
/** Bei 20 Grad silbern, nach oben immer röter, nach unten immer blauer. */
export function tempFarbe(t) {
  const warm = t >= 20, ziel = warm ? ROT : BLAU
  const k = Math.min(1, Math.abs(t - 20) / (warm ? 20 : 25))
  return `rgb(${SILBER.map((w, i) => Math.round(w + (ziel[i] - w) * k)).join(', ')})`
}

/** Aktuelle Temperatur am Ort, nur mit Netz. Ein höchstens 30 Minuten alter Wert reicht. */
export async function temperaturJetzt(pos, jetzt = Date.now()) {
  if (!pos || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null
  const alt = gemerkt()
  if (alt?.temp != null && jetzt - alt.zeit < FRISCH && Math.abs(alt.lat - pos.lat) + Math.abs(alt.lon - pos.lon) < 0.5) return alt.temp
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=temperature_2m`)
    return r.ok ? (await r.json()).current.temperature_2m : null
  } catch { return null }
}

/** Holt das Wetter am Ort, höchstens alle 30 Minuten. pos: { lat, lon } oder null. */
export async function aktualisiereStimmung(pos, jetzt = Date.now()) {
  if (!pos || !get(effekte).stimmung) return
  const alt = gemerkt()
  if (alt && jetzt - alt.zeit < FRISCH && Math.abs(alt.lat - pos.lat) + Math.abs(alt.lon - pos.lon) < 0.5) return
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=temperature_2m,weather_code`
    const r = await fetch(url)
    if (!r.ok) return
    const { current: c } = await r.json()
    const s = stimmungVon({ temp: c.temperature_2m, code: c.weather_code, nacht: istNacht(pos.lat, pos.lon) })
    localStorage.setItem(KEY, JSON.stringify({ s, temp: c.temperature_2m, zeit: jetzt, lat: pos.lat, lon: pos.lon }))
    zeige(s)
    hitzeLogo(c.temperature_2m)
  } catch {}
}
