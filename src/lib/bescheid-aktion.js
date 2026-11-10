// V34: „Mir geht's gut“ und „Standort senden“ mit so wenig Tipps wie möglich (Notfall, Heute).
// Haben alle deine Leute nur SMS und ist ein frischer Standort da, öffnet ein Tipp sofort die fertige SMS an alle:
// Die SMS-App zeigt Empfänger und Text selbst noch einmal, dort bleibt nur „Senden“. Sonst kommt das Blatt mit den
// Schritten (BescheidBlatt.svelte), etwa wenn jemand WhatsApp hat oder noch kein Standort da ist.
import { get } from 'svelte/store'
import { je } from './i18n.js'
import { notfallKontakte, neuerCheckin } from './userdata.js'
import { standort } from './standort.js'
import { bescheidBlatt, bescheidText, naechsterOrt, wegeVon, smsLink } from './bescheid.js'
import { zeigeToast } from './toast.js'

export const FRISCH_MS = 5 * 60 * 1000

/** Wann reicht ein Tipp? Rückgabe die Nummern für die SMS oder null (dann das Blatt) */
export function direktNummern(leute, pos, art, jetzt = Date.now()) {
  if (!leute.length || leute.some((p) => wegeVon(p).includes('whatsapp'))) return null
  const frisch = pos && pos.lat != null && (pos.zeit == null || jetzt - pos.zeit < FRISCH_MS)
  if (!frisch) return null
  return [...new Set(leute.map((p) => p.nummer))]
}

/**
 * art 'ok' oder 'standort'. pos optional (die Notfall-Seite hat ihren eigenen), sonst der zuletzt bestimmte Standort.
 * Rückgabe 'sms' (SMS sofort geöffnet) oder 'blatt'.
 */
export function schnellBescheid(art, { orte = [], pos = null, oeffne = (url) => { location.href = url }, jetzt = Date.now() } = {}) {
  const leute = get(notfallKontakte)
  const p = pos || get(standort)
  const nummern = direktNummern(leute, p, art, jetzt)
  if (!nummern) { bescheidBlatt.set({ art }); return 'blatt' }
  const text = bescheidText({ art, pos: p, ort: naechsterOrt(p.lat, p.lon, orte), zeit: new Date(jetzt) })
  if (art === 'ok') neuerCheckin({ lat: p.lat, lon: p.lon, text: je('Bescheid gegeben', 'Let them know') })
  oeffne(smsLink(nummern, text))
  zeigeToast(je('Die SMS ist offen: nur noch auf Senden tippen.', 'Your SMS is open: just tap Send.'), 'ok', 5000)
  return 'sms'
}
