// V34: „Mir geht's gut“ und „Standort senden“ mit so wenig Tipps wie möglich (Notfall, Heute).
// Haben alle deine Leute nur SMS und ist ein frischer Standort da, öffnet ein Tipp sofort die fertige SMS an alle:
// Die SMS-App zeigt Empfänger und Text selbst noch einmal, dort bleibt nur „Senden“. Sonst kommt das Blatt mit den
// Schritten (BescheidBlatt.svelte), etwa wenn jemand WhatsApp hat oder noch kein Standort da ist.
// V35: SOS an deine Leute (SMS an alle sofort, auch mit älterem oder ohne Standort, danach WhatsApp im Blatt),
// Geräte (am Windows-PC öffnet sich keine SMS-App, dort immer das Blatt) und „Direkt senden“ per Kurzbefehl
// am iPhone und Mac (ganz ohne Tipp auf Senden, die Empfänger stehen im Kurzbefehl).
import { get } from 'svelte/store'
import { je } from './i18n.js'
import { notfallKontakte, neuerCheckin } from './userdata.js'
import { standort } from './standort.js'
import { bescheidBlatt, bescheidText, naechsterOrt, wegeVon, smsLink, geraetArt, smsGeht, kurzbefehlAn, kurzbefehlBereit, kurzbefehlLink } from './bescheid.js'
import { zeigeToast } from './toast.js'

export const FRISCH_MS = 5 * 60 * 1000
const hatPos = (pos) => !!pos && pos.lat != null && pos.lon != null
const istFrisch = (pos, jetzt) => hatPos(pos) && (pos.zeit == null || jetzt - pos.zeit < FRISCH_MS)
const einmalig = (leute) => [...new Set(leute.map((p) => p.nummer))]

/**
 * Wann reicht ein Tipp für die SMS? Rückgabe die Nummern oder null (dann das Blatt).
 * SOS: immer an alle per SMS, auch ohne frischen Standort (WhatsApp folgt im Blatt).
 */
export function direktNummern(leute, pos, art, jetzt = Date.now(), { geraet = geraetArt() } = {}) {
  if (!leute.length || !smsGeht(geraet)) return null
  if (art === 'sos') return einmalig(leute)
  if (leute.some((p) => wegeVon(p).includes('whatsapp'))) return null
  if (!istFrisch(pos, jetzt)) return null
  return einmalig(leute)
}

// Lebenszeichen zu „Mir geht's gut“ und SOS, nur mit Standort
function merke(art, pos) {
  if (!hatPos(pos) || (art !== 'ok' && art !== 'sos')) return
  neuerCheckin({ lat: pos.lat, lon: pos.lon, text: art === 'sos' ? je('SOS an deine Leute', 'SOS to your people') : je('Bescheid gegeben', 'Let them know') })
}

/**
 * art 'ok', 'standort' oder 'sos'. pos optional (die Notfall-Seite hat ihren eigenen), sonst der zuletzt bestimmte Standort.
 * Rückgabe 'kurzbefehl' (Kurzbefehl gestartet), 'sms' (SMS sofort geöffnet) oder 'blatt'.
 */
export function schnellBescheid(art, { orte = [], pos = null, oeffne = (url) => { location.href = url }, jetzt = Date.now(), geraet = geraetArt(), kurzbefehl = get(kurzbefehlAn) } = {}) {
  const leute = get(notfallKontakte)
  if (!leute.length) { bescheidBlatt.set({ art }); return 'blatt' }
  const p = pos || get(standort)
  // Welcher Standort kommt in den Text? SOS nimmt auch einen älteren (mit Alter im Text), sonst nur einen frischen
  const textPos = art === 'sos' ? (hatPos(p) ? p : null) : istFrisch(p, jetzt) ? p : null
  const bereit = art === 'sos' || !!textPos
  const text = () => bescheidText({ art, pos: textPos, ort: textPos ? naechsterOrt(textPos.lat, textPos.lon, orte) : null, zeit: new Date(jetzt) })
  const mitWhatsapp = leute.some((x) => wegeVon(x).includes('whatsapp'))

  // iPhone und Mac mit eingerichtetem Kurzbefehl: geht ganz ohne Tipp auf Senden raus.
  // Danach (zurück in TravelBuddy) das Blatt: WhatsApp-Schritte und zur Sicherheit die SMS von Hand.
  if (bereit && kurzbefehlBereit(kurzbefehl, geraet)) {
    merke(art, textPos)
    oeffne(kurzbefehlLink(text()))
    bescheidBlatt.set({ art, kurzbefehl: true })
    zeigeToast(je('An deinen Kurzbefehl übergeben. Kam nichts an, sende im Blatt von Hand.', 'Handed to your shortcut. If nothing arrived, send by hand in the sheet.'), 'ok', 6000)
    return 'kurzbefehl'
  }

  const nummern = bereit ? direktNummern(leute, p, art, jetzt, { geraet }) : null
  if (!nummern) { bescheidBlatt.set({ art }); return 'blatt' }
  merke(art, textPos)
  oeffne(smsLink(nummern, text(), { geraet }))
  // SOS: wer WhatsApp hat, bekommt es danach zusätzlich, das Blatt zeigt die übrigen Schritte
  if (art === 'sos' && mitWhatsapp) bescheidBlatt.set({ art, smsErledigt: true })
  zeigeToast(je('Die SMS ist offen: nur noch auf Senden tippen.', 'Your SMS is open: just tap Send.'), 'ok', 5000)
  return 'sms'
}
