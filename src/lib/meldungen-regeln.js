// Meldungen für andere Reisende (V32): Regeln, die App und Server gleich prüfen. Kein Browser, kein Svelte,
// damit die Netlify-Funktion (netlify/functions/meldungen.mjs) diese Datei mitnehmen kann.
// Plan: 00_Planung/MELDUNGEN-PLAN-V32.md

export const ARTEN = ['weg', 'tiere', 'tanken', 'camping', 'wetter', 'tipp']
/** Gültigkeit jeder Meldung (3 Tage für alle, ohne Auswahl) */
export const TAGE = 3
export const TAG_MS = 24 * 60 * 60 * 1000
/** „Stimmt noch“ verlängert um einen Tag, eine Meldung lebt aber nie länger als eine Woche */
export const MAX_LEBEN_TAGE = 7
export const MIN_TEXT = 5
export const MAX_TEXT = 300
export const MAX_NAME = 30
/** Ab so vielen „unpassend“ sofort ausgeblendet, ab so vielen „nicht mehr“ blass */
export const AUSBLENDEN_AB = 3
export const BLASS_AB = 2
/** Neue Meldungen je Gerät und Stunde */
export const PRO_STUNDE = 5

/** Grob die Gegend eines Punkts, für Filter und Überschriften. Reihenfolge zählt. */
export const GEGENDEN = [
  { id: 'kimberley', de: 'Kimberley', en: 'Kimberley', in: (la, lo) => la > -19.5 && lo > 121 && lo < 129.5 },
  { id: 'pilbara', de: 'Pilbara', en: 'Pilbara', in: (la, lo) => la > -24 && lo > 115.5 && lo < 129.5 },
  { id: 'coral', de: 'Coral Coast', en: 'Coral Coast', in: (la, lo) => la > -27.8 && lo < 115.8 },
  { id: 'mitte', de: 'Perth und Mittlerer Westen', en: 'Perth and Mid West', in: (la, lo) => la > -32.6 && lo < 118 },
  { id: 'sueden', de: 'Süden', en: 'South', in: (la, lo) => lo < 124.5 && la < -32.6 },
  { id: 'outback', de: 'Outback WA', en: 'Outback WA', in: (la, lo) => lo < 129.5 },
  { id: 'victoria', de: 'Victoria', en: 'Victoria', in: (la, lo) => lo > 140.9 && la < -33.9 },
  { id: 'queensland', de: 'Queensland', en: 'Queensland', in: (la, lo) => lo > 137.9 && la > -29.2 },
]
export function gegendVon(lat, lon) {
  if (!inAustralien(lat, lon)) return 'australien'
  return GEGENDEN.find((g) => g.in(lat, lon))?.id || 'australien'
}
export const inAustralien = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat > -45 && lat < -9 && lon > 110 && lon < 155

/** Text ohne Steuerzeichen, getrimmt, gekürzt */
export const glatt = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/** Gründe, warum ein Text nicht geht, oder null. Gleiche Prüfung in App und Server. */
export function textProblem(text) {
  const t = glatt(text, MAX_TEXT + 1)
  if (t.length < MIN_TEXT) return 'kurz'
  if (t.length > MAX_TEXT) return 'lang'
  return kontaktProblem(t)
}
/** Telefonnummer, Mailadresse oder Link im Text? Gilt für Text, Ort und Name. */
export function kontaktProblem(t) {
  const ohne = String(t || '').replace(/[\s\-–()/.]/g, '')
  if (/\d{7,}/.test(ohne) || /\+\d{6,}/.test(ohne)) return 'nummer'
  if (/@/.test(t)) return 'mail'
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|de|au|io|ly|me|gg|info|biz)\b/i.test(t)) return 'link'
  return null
}
export function nameSauber(name) {
  const n = glatt(name, MAX_NAME).replace(/[@<>]/g, '')
  return n && !/\d{6,}/.test(n.replace(/\s/g, '')) && !kontaktProblem(n) ? n : ''
}
/** Ortsname: Nummern, Adressen und Links fallen weg, dann zeigt die App die Gegend */
export const ortSauber = (ort) => { const o = glatt(ort, 60); return kontaktProblem(o) ? '' : o }

/** Eine eingehende Meldung prüfen und säubern. Rückgabe { meldung } oder { fehler } */
export function pruefeNeu(roh = {}) {
  const art = ARTEN.includes(roh.art) ? roh.art : null
  if (!art) return { fehler: 'art' }
  const lat = Math.round(Number(roh.lat) * 1e4) / 1e4, lon = Math.round(Number(roh.lon) * 1e4) / 1e4
  if (!inAustralien(lat, lon)) return { fehler: 'ort' }
  const p = textProblem(roh.text)
  if (p) return { fehler: p }
  return { meldung: { art, text: glatt(roh.text, MAX_TEXT), name: nameSauber(roh.name), lat, lon, ort: ortSauber(roh.ort), gegend: gegendVon(lat, lon) } }
}

const anzahl = (x) => (Array.isArray(x) ? x.length : Number(x) || 0)
/** Was öffentlich zu sehen ist: ohne Gerätekennungen und Schlüssel (auch aus dem Verzeichnis, dort stehen nur Zahlen) */
export function oeffentlich(m) {
  return { id: m.id, art: m.art, text: m.text, name: m.name, lat: m.lat, lon: m.lon, ort: m.ort, gegend: m.gegend,
    erstellt: m.erstellt, ablauf: m.ablauf, ja: anzahl(m.ja), nein: anzahl(m.nein) }
}
export const aktiv = (m, jetzt = Date.now()) => !!m && !m.versteckt && m.ablauf > jetzt

/** Neues Ablaufdatum nach einem neuen „Stimmt noch“: einen Tag mehr, höchstens eine Woche nach dem Anlegen */
export const verlaengert = (m) => Math.max(m.ablauf, Math.min(m.ablauf + TAG_MS, m.erstellt + MAX_LEBEN_TAGE * TAG_MS))

/** Vorrang in Listen: Weg und Tanken vor dem Rest, blasse ans Ende, sonst die neueste zuerst */
const RANG = { weg: 0, tanken: 1, wetter: 2, camping: 3, tiere: 4, tipp: 5 }
export const blass = (m) => (m.nein || 0) >= BLASS_AB && (m.nein || 0) > (m.ja || 0)
export function sortiere(liste) {
  return [...liste].sort((a, b) => (blass(a) - blass(b)) || (RANG[a.art] - RANG[b.art]) || (b.erstellt - a.erstellt))
}
