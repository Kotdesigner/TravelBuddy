// V34: „Deinen Leuten Bescheid geben“ (Notfall). Wichtige Personen (Mama, Papa, Partner/in …) einmal anlegen,
// dann öffnet ein Tipp die fertige Nachricht „Mir geht's gut“ oder „Mein Standort“ an alle.
// Gesendet wird über die SMS- oder WhatsApp-App des Geräts: eine Web-App darf nichts im Hintergrund verschicken,
// der letzte Tipp auf „Senden“ bleibt dort. SMS geht auch ohne Internet, sobald etwas Handynetz da ist.
// Die Personen liegen nur auf dem Gerät und im Backup (userdata.js, notfallKontakte), nie auf einem Server.
import { writable } from 'svelte/store'
import { je } from './i18n.js'
import { WA_ORTE } from './wa-orte.js'

export const MAX_PERSONEN = 5
/** Rollen zum schnellen Anlegen: [id, deutsch, englisch] */
export const ROLLEN = [
  ['mama', 'Mama', 'Mum'], ['papa', 'Papa', 'Dad'], ['partner', 'Partner/in', 'Partner'],
  ['bruder', 'Bruder', 'Brother'], ['schwester', 'Schwester', 'Sister'], ['freund', 'Freund/in', 'Friend'], ['andere', 'Andere', 'Other'],
]
export const rollenName = (id) => { const r = ROLLEN.find((x) => x[0] === id) || ROLLEN.at(-1); return je(r[1], r[2]) }

/** Offene Blätter: { art: 'ok' | 'standort' } zum Senden, { id? } zum Anlegen oder Ändern einer Person */
export const bescheidBlatt = writable(null)
export const personBlatt = writable(null)

const text = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * Telefonnummer mit Ländervorwahl: „+49 170 1234567“, „0049 …“ oder „+61 4…“. Ergebnis „+491701234567“ oder ''.
 * Ohne Ländervorwahl („0170 …“) geht es nicht: unterwegs in Australien wüsste das Handy nicht, welches Land gemeint ist.
 */
export function nummerSauber(s) {
  const roh = String(s ?? '').trim()
  if (!/^(\+|00)/.test(roh)) return ''
  const d = roh.replace(/^(\+|00)/, '').replace(/[\s\-()/.]/g, '')
  return /^[1-9]\d{6,14}$/.test(d) ? '+' + d : ''
}
/** Warum eine Nummer nicht geht, oder null */
export function nummerProblem(s) {
  const roh = String(s ?? '').trim()
  if (!roh) return 'leer'
  if (/^0[1-9]/.test(roh)) return 'vorwahl'
  return nummerSauber(roh) ? null : 'form'
}

/** Wege zu einer Person: SMS, WhatsApp oder beides. Ältere Einträge hatten nur `weg`. */
export const WEGE = ['sms', 'whatsapp']
export function wegeVon(k = {}) {
  const roh = Array.isArray(k.wege) ? k.wege : k.weg ? [k.weg] : []
  const w = WEGE.filter((x) => roh.includes(x))
  return w.length ? w : ['sms']
}
export const wegeText = (k) => wegeVon(k).map((w) => (w === 'sms' ? 'SMS' : 'WhatsApp')).join(' + ')

/** Eine Person aus Eingabe oder Speicher, gesäubert. Ohne gültige Nummer: null */
export function bereinigeKontakt(k = {}) {
  const nummer = nummerSauber(k.nummer)
  if (!nummer) return null
  const rolle = ROLLEN.some((r) => r[0] === k.rolle) ? k.rolle : 'andere'
  const aus = { rolle, name: text(k.name, 30) || rollenName(rolle), nummer, wege: wegeVon(k) }
  if (k.id) aus.id = String(k.id)
  return aus
}

/** iPhone oder iPad (auch iPadOS, das sich als Mac meldet) */
export const istIOS = ({ ua = globalThis.navigator?.userAgent || '', touch = globalThis.navigator?.maxTouchPoints || 0 } = {}) =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)

/**
 * SMS an eine oder mehrere Nummern mit fertigem Text. Das iPhone versteht mehrere Empfänger nur über
 * sms://open?addresses=…, Android über sms:a,b?body=….
 */
export function smsLink(nummern, nachricht, { ios = istIOS() } = {}) {
  const liste = nummern.filter(Boolean)
  if (!liste.length) return null
  const body = encodeURIComponent(nachricht)
  if (ios) return liste.length > 1 ? `sms://open?addresses=${liste.join(',')}&body=${body}` : `sms:${liste[0]}&body=${body}`
  return `sms:${liste.join(',')}?body=${body}`
}
/** WhatsApp an eine Person (WhatsApp nimmt im Link nur einen Empfänger) */
export const whatsappLink = (nummer, nachricht) => (nummer ? `https://wa.me/${nummer.replace(/^\+/, '')}?text=${encodeURIComponent(nachricht)}` : null)

const kmZwischen = (la1, lo1, la2, lo2) => {
  const r = Math.PI / 180, a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}
/**
 * Nächster bekannter Ort, offline aus den Orten der App und den Städten in WA: „bei Coral Bay“ (bis 5 km)
 * oder „etwa 23 km von Exmouth“ (bis 80 km). Weiter weg: null, dann stehen nur Koordinaten und Karte drin.
 */
export function naechsterOrt(lat, lon, orte = []) {
  if (lat == null || lon == null) return null
  let best = null
  const pruefe = (name, la, lo) => {
    if (!name || la == null || lo == null) return
    const km = kmZwischen(lat, lon, la, lo)
    if (!best || km < best.km) best = { name, km }
  }
  for (const o of orte) pruefe(o.name, o.lat, o.lon)
  for (const [name, [la, lo]] of Object.entries(WA_ORTE)) pruefe(name, la, lo)
  if (!best || best.km > 80) return null
  return best.km <= 5 ? je(`bei ${best.name}`, `at ${best.name}`) : je(`etwa ${Math.round(best.km)} km von ${best.name}`, `about ${Math.round(best.km)} km from ${best.name}`)
}

const zweistellig = (x) => String(x).padStart(2, '0')
export const zeitText = (d = new Date()) => `${zweistellig(d.getDate())}.${zweistellig(d.getMonth() + 1)}. ${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`
export const kartenLink = (lat, lon) => `https://maps.google.com/?q=${(+lat).toFixed(5)},${(+lon).toFixed(5)}`

/**
 * Die Nachricht. art 'ok': „Mir geht's gut …“, art 'standort': „Mein Standort …“.
 * pos { lat, lon, genauigkeit } darf fehlen (dann ohne Ort), ort ist der Text von naechsterOrt.
 */
export function bescheidText({ art = 'ok', pos = null, ort = null, zeit = new Date() } = {}) {
  // Ortszeit dazu: Wer zu Hause liest, lebt oft in einer anderen Zeitzone
  const wann = `${zeitText(zeit)} ${je('Ortszeit', 'local time')}`
  const fuss = je('gesendet mit TravelBuddy', 'sent with TravelBuddy')
  const mitPos = pos && pos.lat != null && pos.lon != null
  if (art === 'standort' && mitPos) {
    const koord = `${(+pos.lat).toFixed(5)}, ${(+pos.lon).toFixed(5)}`
    const gen = pos.genauigkeit ? ` (± ${Math.round(pos.genauigkeit)} m)` : ''
    return je(`Mein Standort: ${koord}${gen}${ort ? ', ' + ort : ''}. Karte: ${kartenLink(pos.lat, pos.lon)} · ${wann} · ${fuss}`,
      `My location: ${koord}${gen}${ort ? ', ' + ort : ''}. Map: ${kartenLink(pos.lat, pos.lon)} · ${wann} · ${fuss}`)
  }
  if (mitPos) {
    return je(`Mir geht's gut. Bin gerade ${ort || 'hier'}, ${wann}. Karte: ${kartenLink(pos.lat, pos.lon)} · ${fuss}`,
      `I'm okay. I'm ${ort || 'here'} right now, ${wann}. Map: ${kartenLink(pos.lat, pos.lon)} · ${fuss}`)
  }
  return je(`Mir geht's gut. ${wann} · ${fuss}`, `I'm okay. ${wann} · ${fuss}`)
}

/**
 * Aus den gewählten Personen: ein SMS-Link für alle SMS-Leute, je ein WhatsApp-Link pro WhatsApp-Person.
 * Wer beides hat, steht in beiden. Zwei Apps auf einmal öffnet kein Handy, darum nacheinander (BescheidBlatt).
 */
export function sendewege(personen, nachricht, opt) {
  // Dieselbe Nummer zweimal angelegt: nur einmal anschreiben
  const einmal = (liste) => liste.filter((p, i) => liste.findIndex((q) => q.nummer === p.nummer) === i)
  const sms = einmal(personen.filter((p) => wegeVon(p).includes('sms')))
  const wa = einmal(personen.filter((p) => wegeVon(p).includes('whatsapp')))
  return {
    sms: sms.length ? { namen: sms.map((p) => p.name), link: smsLink(sms.map((p) => p.nummer), nachricht, opt) } : null,
    whatsapp: wa.map((p) => ({ id: p.id, name: p.name, link: whatsappLink(p.nummer, nachricht) })),
  }
}
