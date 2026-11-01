// Was wirklich in deiner Nähe los war: Warnungen im Umkreis deines echten GPS-Standorts, je Tag
// gemerkt. Ins Tagebuch kommt davon nur, was du im Logbuch einzeln auswählst.
import { derived, writable, get } from 'svelte/store'
import { warnungenFuer } from './warnungen.js'

const KEY = 'tb-erlebt'
export const NAH_KM = 30
const HOECHSTENS = 300

function lies() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
export const erlebt = writable(lies())

const tagVon = (ms) => { const d = new Date(ms), p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

/** Neue Liste: je Warnung und Tag ein Eintrag, der kleinste Abstand gewinnt. */
export function merkeNahe(liste, warnungen, pos, jetzt = Date.now(), nahKm = NAH_KM) {
  if (!pos) return liste
  const datum = tagVon(jetzt)
  const neu = [...liste]
  for (const w of warnungenFuer(warnungen, pos.lat, pos.lon, nahKm)) {
    const id = `${w.id}|${datum}`, km = Math.round(w.km)
    const i = neu.findIndex((x) => x.id === id)
    if (i < 0) neu.unshift({ id, datum, zeit: jetzt, icon: w.icon, level: w.level, titel: w.titel, staat: w.staat, farbe: w.farbe, km })
    else if (km < neu[i].km) neu[i] = { ...neu[i], km }
  }
  return neu.length === liste.length && neu.every((x, i) => x === liste[i]) ? liste : neu.slice(0, HOECHSTENS)
}

/** Läuft einmal je Start mit. Testmodus und Probe-Warnungen zählen nie. */
export function starteErlebt(warnListe, position, testmodus) {
  derived([warnListe, position], (x) => x).subscribe(([w, p]) => {
    if (!w?.length || !p || get(testmodus).aktiv) return
    const alt = get(erlebt), neu = merkeNahe(alt, w, p)
    if (neu === alt) return
    erlebt.set(neu)
    try { localStorage.setItem(KEY, JSON.stringify(neu)) } catch {}
  })
}
