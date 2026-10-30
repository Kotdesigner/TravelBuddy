// Buchung aus einer Bestätigungsmail erkennen.
//
// Reine Logik, kein Netz, kein Speicher: `erkenne(text)` liest den eingefügten Mailtext
// und liefert VORSCHLÄGE mit einer Konfidenz je Feld (0 bis 1). Entschieden wird in der
// Oberfläche; dort ist jedes Feld änderbar. `alsBuchungen(formular)` macht aus dem
// bestätigten Formular Einträge im Format des Reisekalenders (siehe reisekalender.js),
// damit sie überall erscheinen wie die importierten Buchungen.
//
// Australische Mails schreiben das Datum Tag/Monat (03/12/2037 = 3. Dezember). Nur wenn
// die Mail selbst zeigt, dass sie Monat/Tag schreibt (ein zweiter Teil über 12), oder
// der Wochentag nur zur anderen Lesart passt, wird umgedreht.

// ---------- Arten ----------
import { dezimal } from './format.js'
import { t, tn, LOCALE, jeSprache } from './i18n.js'
export const ARTEN = jeSprache(() => ([
  { id: 'flug', label: t('Flug'), kat: 'flight', emoji: '✈️', vorab: 'kosten_flug' },
  { id: 'unterkunft', label: t('Unterkunft'), kat: 'hotel', emoji: '🏨', vorab: 'kosten_unterkunft' },
  { id: 'fahrzeug', label: t('Camper / Mietwagen'), kat: 'camper', emoji: '🚐', vorab: 'kosten_mietfahrzeug' },
  { id: 'tour', label: t('Tour'), kat: 'tour', emoji: '🎟️', vorab: 'kosten_attraktion' },
  { id: 'faehre', label: t('Fähre'), kat: 'boat', emoji: '⛴️', vorab: 'kosten_boot' },
  { id: 'sonstiges', label: t('Sonstiges'), kat: '', emoji: '📌', vorab: 'kosten_sonstiges' },
]))
export const artInfo = (id) => ARTEN.find((a) => a.id === id) || ARTEN[ARTEN.length - 1]

// ---------- Datum ----------
const MONATE = {
  jan: 1, january: 1, januar: 1, 'jän': 1, 'jänner': 1,
  feb: 2, february: 2, februar: 2,
  mar: 3, march: 3, 'mär': 3, 'märz': 3, maerz: 3, mrz: 3,
  apr: 4, april: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, dez: 12, dezember: 12,
}
const MON_RE = Object.keys(MONATE).sort((a, b) => b.length - a.length).join('|')
const WOCHENTAGE = [
  [/^(sun(day)?|so(nntag)?)$/i, 0], [/^(mon(day)?|mo(ntag)?)$/i, 1], [/^(tue(s(day)?)?|di(enstag)?)$/i, 2],
  [/^(wed(nesday)?|mi(ttwoch)?)$/i, 3], [/^(thu(r(s(day)?)?)?|do(nnerstag)?)$/i, 4],
  [/^(fri(day)?|fr(eitag)?)$/i, 5], [/^(sat(urday)?|sa(mstag)?)$/i, 6],
]
const WT_RE = /(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat|so|mo|di|mi|do|fr|sa)\.?,?\s*$/i

const pad = (n) => String(n).padStart(2, '0')
export const isoDatum = (j, m, t) => `${j}-${pad(m)}-${pad(t)}`
function gueltig(j, m, t) {
  if (!(m >= 1 && m <= 12 && t >= 1 && t <= 31 && j >= 2000 && j <= 2099)) return false
  const d = new Date(Date.UTC(j, m - 1, t))
  return d.getUTCMonth() === m - 1 && d.getUTCDate() === t
}
const wochentagVon = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay()
export function plusTage(iso, n) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const tageZwischen = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000)
const jahr4 = (s) => { if (!s) return null; const n = Number(String(s).replace("'", '')); return n < 100 ? 2000 + n : n }
const monat = (s) => MONATE[String(s).toLowerCase().replace(/\.$/, '')] || null

function wochentagDavor(text, start) {
  const m = text.slice(Math.max(0, start - 14), start).match(WT_RE)
  if (!m) return null
  // „so“, „do“, „mi“ … sind auch gewöhnliche Wörter. Kurzformen nur mit Satzzeichen
  // oder direkt am Zeilenanfang gelten lassen.
  const wort = m[1]
  if (wort.length <= 2 && !/[.,]/.test(m[0])) {
    const vor = text.slice(Math.max(0, start - 14), start)
    if (!new RegExp('(^|\\n)\\s*' + wort + '\\s*$', 'i').test(vor)) return null
  }
  for (const [re, n] of WOCHENTAGE) if (re.test(wort)) return n
  return null
}

function imZeitraum(iso, z, puffer = 45) {
  if (!z?.von || !z?.bis) return true
  return iso >= plusTage(z.von, -puffer) && iso <= plusTage(z.bis, puffer)
}

/** Jahr ergänzen, wenn die Mail keins nennt („Sat, 12 Dec“). */
function mitJahr(m, t, kontext) {
  const { zeitraum, heute } = kontext
  const basis = Number((zeitraum?.von || heute || String(new Date().getFullYear())).slice(0, 4))
  for (const j of [basis, basis + 1, basis - 1]) {
    if (!gueltig(j, m, t)) continue
    const iso = isoDatum(j, m, t)
    if (zeitraum?.von && imZeitraum(iso, zeitraum, 20)) return iso
  }
  for (const j of [basis, basis + 1]) {
    if (!gueltig(j, m, t)) continue
    const iso = isoDatum(j, m, t)
    if (!heute || iso >= plusTage(heute, -30)) return iso
  }
  return gueltig(basis, m, t) ? isoDatum(basis, m, t) : null
}

/**
 * Alle Datumsangaben im Text, mit Position und Konfidenz.
 * Bereiche („12–14 Dec 2026“) liefern zwei Treffer mit `bereich: 'von' | 'bis'`.
 */
export function findeDaten(text, kontext = {}) {
  const out = []
  const belegt = []
  const frei = (a, b) => !belegt.some(([x, y]) => a < y && b > x)
  const nimm = (a, b) => belegt.push([a, b])
  const hinweise = kontext.hinweise || []

  // Schreibweise der ganzen Mail: zählt Zahlen-Daten, die nur eine Lesart zulassen.
  let dm = 0, md = 0
  for (const m of text.matchAll(/(?<![\d.\/])(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?![\d\/])/g)) {
    const a = +m[1], b = +m[2]
    if (a > 12 && b <= 12) dm++
    else if (b > 12 && a <= 12) md++
  }
  const formatMD = md > dm

  const push = (o) => { out.push(o) }

  // 1  Bereiche mit Monatsnamen: „12–14 Dec 2026“, „12. bis 14. Dezember 2026“
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s*(?:-|–|—|to|bis|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(${MON_RE})\\.?,?(?:\\s+(\\d{4}))?\\b`, 'gi'))) {
    const a = m.index, b = a + m[0].length
    const mo = monat(m[3]); if (!mo || !frei(a, b)) continue
    const t1 = +m[1], t2 = +m[2]
    const j = jahr4(m[4])
    const iso1 = j ? (gueltig(j, mo, t1) ? isoDatum(j, mo, t1) : null) : mitJahr(mo, t1, kontext)
    const iso2 = j ? (gueltig(j, mo, t2) ? isoDatum(j, mo, t2) : null) : mitJahr(mo, t2, kontext)
    if (!iso1 || !iso2 || iso2 < iso1) continue
    nimm(a, b)
    const k = j ? 0.95 : 0.75
    push({ iso: iso1, start: a, ende: b, konfidenz: k, bereich: 'von', ohneJahr: !j })
    push({ iso: iso2, start: a + 1, ende: b, konfidenz: k, bereich: 'bis', ohneJahr: !j })
  }
  // „Dec 12–14, 2026“
  for (const m of text.matchAll(new RegExp(`\\b(${MON_RE})\\.?\\s+(\\d{1,2})\\s*(?:-|–|—|to)\\s*(\\d{1,2}),?(?:\\s+(\\d{4}))?\\b`, 'gi'))) {
    const a = m.index, b = a + m[0].length
    const mo = monat(m[1]); if (!mo || !frei(a, b)) continue
    const j = jahr4(m[4])
    const iso1 = j ? (gueltig(j, mo, +m[2]) ? isoDatum(j, mo, +m[2]) : null) : mitJahr(mo, +m[2], kontext)
    const iso2 = j ? (gueltig(j, mo, +m[3]) ? isoDatum(j, mo, +m[3]) : null) : mitJahr(mo, +m[3], kontext)
    if (!iso1 || !iso2 || iso2 < iso1) continue
    nimm(a, b)
    const k = j ? 0.95 : 0.75
    push({ iso: iso1, start: a, ende: b, konfidenz: k, bereich: 'von', ohneJahr: !j })
    push({ iso: iso2, start: a + 1, ende: b, konfidenz: k, bereich: 'bis', ohneJahr: !j })
  }

  // 2  Tag Monat Jahr: „12 Dec 2026“, „12th December 2026“, „12. Dezember 2026“, „12 Dec“
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s*(?:of\\s+)?(${MON_RE})(?![a-zäöü])\\.?,?(?:\\s*('?\\d{4}|'\\d{2}))?`, 'gi'))) {
    const a = m.index, b = a + m[0].length
    const mo = monat(m[2]); if (!mo || !frei(a, b)) continue
    // „12 mar“ in einem Satz wäre selten, „2 may“ im Englischen dagegen häufig.
    if (/^may$/i.test(m[2]) && !m[3] && !/^\d{1,2}\s+May/.test(m[0])) continue
    const t = +m[1], j = jahr4(m[3])
    const iso = j ? (gueltig(j, mo, t) ? isoDatum(j, mo, t) : null) : mitJahr(mo, t, kontext)
    if (!iso) continue
    nimm(a, b)
    push({ iso, start: a, ende: b, konfidenz: j ? 0.95 : 0.75, ohneJahr: !j, wt: wochentagDavor(text, a) })
  }
  // 3  Monat Tag Jahr: „December 12, 2026“, „Dec 12 2026“
  for (const m of text.matchAll(new RegExp(`\\b(${MON_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d|:)(?:,?\\s+(\\d{4}))?`, 'gi'))) {
    const a = m.index, b = a + m[0].length
    const mo = monat(m[1]); if (!mo || !frei(a, b)) continue
    if (/^(may|mai|so|mo)$/i.test(m[1]) && !m[3]) continue
    const t = +m[2], j = jahr4(m[3])
    const iso = j ? (gueltig(j, mo, t) ? isoDatum(j, mo, t) : null) : mitJahr(mo, t, kontext)
    if (!iso) continue
    nimm(a, b)
    push({ iso, start: a, ende: b, konfidenz: j ? 0.9 : 0.7, ohneJahr: !j, wt: wochentagDavor(text, a) })
  }
  // 4  ISO: 2037-12-12
  for (const m of text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})(?!\d)/g)) {
    const a = m.index, b = a + m[0].length
    if (!frei(a, b) || !gueltig(+m[1], +m[2], +m[3])) continue
    nimm(a, b)
    push({ iso: isoDatum(+m[1], +m[2], +m[3]), start: a, ende: b, konfidenz: 0.97, wt: wochentagDavor(text, a) })
  }
  // 5  Zahlen: 12/12/2037, 03.12.2037, 3-12-26
  for (const m of text.matchAll(/(?<![\d.\/:-])(\d{1,2})([\/.\-])(\d{1,2})\2(\d{4}|\d{2})(?![\d\/.]\d)/g)) {
    const a = m.index, b = a + m[0].length
    if (!frei(a, b)) continue
    const x = +m[1], y = +m[3], j = jahr4(m[4])
    const wt = wochentagDavor(text, a)
    const dmOk = gueltig(j, y, x), mdOk = gueltig(j, x, y)
    let iso = null, k = 0.95, umgedreht = false
    if (dmOk && !mdOk) iso = isoDatum(j, y, x)
    else if (mdOk && !dmOk) { iso = isoDatum(j, x, y); umgedreht = true; k = 0.85 }
    else if (dmOk && mdOk) {
      const isoDM = isoDatum(j, y, x), isoMD = isoDatum(j, x, y)
      if (isoDM === isoMD) iso = isoDM
      else if (m[2] === '.') { iso = isoDM; k = 0.9 }   // Punkte schreibt nur, wer Tag.Monat meint
      else if (wt != null && wochentagVon(isoDM) === wt) { iso = isoDM; k = 0.9 }
      else if (wt != null && wochentagVon(isoMD) === wt) {
        iso = isoMD; k = 0.85; umgedreht = true
        hinweise.push(t('{text}: Der Wochentag passt nur zu Monat/Tag, gelesen als {datum}.', { text: m[0], datum: deutsch(isoMD) }))
      } else if (formatMD) {
        iso = isoMD; k = 0.75; umgedreht = true
        hinweise.push(t('{text}: Die Mail schreibt Monat/Tag, gelesen als {datum}.', { text: m[0], datum: deutsch(isoMD) }))
      } else if (kontext.zeitraum?.von && !imZeitraum(isoDM, kontext.zeitraum) && imZeitraum(isoMD, kontext.zeitraum)) {
        iso = isoMD; k = 0.55; umgedreht = true
        hinweise.push(t('{text}: Als Tag/Monat läge das Datum außerhalb der Reise, deshalb als {datum} gelesen. Bitte prüfen.', { text: m[0], datum: deutsch(isoMD) }))
      } else {
        iso = isoDM; k = dm > 0 ? 0.85 : 0.65
        if (!dm) hinweise.push(t('{text}: gelesen als {datum} (Tag/Monat, wie in Australien üblich). Bitte prüfen.', { text: m[0], datum: deutsch(isoDM) }))
      }
    }
    if (!iso) continue
    nimm(a, b)
    push({ iso, start: a, ende: b, konfidenz: k, wt, umgedreht })
  }
  // 6  Kurzform der Airlines: 12DEC26, 12DEC
  for (const m of text.matchAll(/\b(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})?\b/g)) {
    const a = m.index, b = a + m[0].length
    if (!frei(a, b)) continue
    const mo = monat(m[2]), t = +m[1], j = jahr4(m[3])
    const iso = j ? (gueltig(j, mo, t) ? isoDatum(j, mo, t) : null) : mitJahr(mo, t, kontext)
    if (!iso) continue
    nimm(a, b)
    push({ iso, start: a, ende: b, konfidenz: j ? 0.9 : 0.7, ohneJahr: !j })
  }
  // 7  Deutsch ohne Jahr: „Sa., 12.12.“
  for (const m of text.matchAll(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(?![\d])/g)) {
    const a = m.index, b = a + m[0].length
    if (!frei(a, b)) continue
    const t = +m[1], mo = +m[2]
    if (mo < 1 || mo > 12) continue
    const iso = mitJahr(mo, t, kontext)
    if (!iso) continue
    nimm(a, b)
    push({ iso, start: a, ende: b, konfidenz: 0.6, ohneJahr: true, wt: wochentagDavor(text, a) })
  }

  // Wochentag passt nicht: Konfidenz runter, Hinweis.
  for (const d of out) {
    if (d.wt == null) continue
    if (wochentagVon(d.iso) === d.wt) d.konfidenz = Math.min(0.98, d.konfidenz + 0.03)
    else {
      d.konfidenz = Math.min(d.konfidenz, 0.45)
      hinweise.push(t('{datum}: Der Wochentag in der Mail passt nicht zu diesem Datum. Bitte prüfen.', { datum: deutsch(d.iso) }))
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

// ---------- Uhrzeit ----------
export function findeZeiten(text) {
  const out = []
  const belegt = []
  const frei = (a, b) => !belegt.some(([x, y]) => a < y && b > x)
  const add = (a, b, h, min, k) => {
    if (!frei(a, b) || h > 23 || min > 59) return
    belegt.push([a, b]); out.push({ zeit: `${pad(h)}:${pad(min)}`, start: a, ende: b, konfidenz: k })
  }
  const ampm = (h, s) => {
    if (!s) return h
    const p = s[0].toLowerCase() === 'p'
    if (h === 12) return p ? 12 : 0
    return p ? h + 12 : h
  }
  for (const m of text.matchAll(/(?<![\d:.\/-])([01]?\d|2[0-3]):([0-5]\d)(?!\d)(?:\s*([ap])\.?\s?m\b\.?)?(?:\s*(?:uhr|hrs|h)\b)?/gi)) {
    const h = +m[1]
    if (m[3] && (h < 1 || h > 12)) continue
    add(m.index, m.index + m[0].length, ampm(h, m[3]), +m[2], 0.9)
  }
  for (const m of text.matchAll(/(?<![\d:.])([01]?\d|2[0-3])\.([0-5]\d)\s*uhr\b/gi)) add(m.index, m.index + m[0].length, +m[1], +m[2], 0.9)
  for (const m of text.matchAll(/(?<![\d:.])(1[0-2]|0?[1-9])\s*([ap])\.?\s?m\b\.?/gi)) add(m.index, m.index + m[0].length, ampm(+m[1], m[2]), 0, 0.85)
  for (const m of text.matchAll(/(?<![\d:.])([01]\d|2[0-3])([0-5]\d)\s*(?:hrs|h)\b/gi)) add(m.index, m.index + m[0].length, +m[1], +m[2], 0.8)
  for (const m of text.matchAll(/(?<![\d:.])([01]?\d|2[0-3])\s*uhr\b/gi)) add(m.index, m.index + m[0].length, +m[1], 0, 0.8)
  return out.sort((a, b) => a.start - b.start)
}

// ---------- Rollen: wofür steht ein Datum, eine Uhrzeit? ----------
// Das nächste Stichwort VOR dem Treffer entscheidet (in derselben Zeile, sonst in den
// Zeilen darüber). „Arrival/Departure“ heißt im Hotel An- und Abreise, beim Flug
// Ankunft und Abflug; das löst `rolleFuerArt` auf.
const STICHWORTE = [
  ['ignorieren', /booked on|booking date|date booked|date of booking|buchungsdatum|gebucht am|issued|issue date|date of issue|ausgestellt|ausstellungsdatum|payment|paid on|bezahlt am|zahlung|zahlungsdatum|cancel|cancellation|storn|kostenlos stornierbar|refund|erstattung|date of birth|born|geburt|\bdob\b|expir|gültig bis|valid until|deadline|due date|fällig|\bsent\b|gesendet|received|empfangen|printed|gedruckt|order date|bestelldatum/gi],
  ['boarding', /boarding|gate closes|gate schließt|check-?in closes|check-?in schließt/gi],
  ['start', /check[\s-]?in|anreise|pick[\s-]?up|pickup|collection|abholung|übernahme|uebernahme|starts?\b|start date|begins?|beginn|\bfrom\b|\bab\b|tour date|travel date|date of travel|reisedatum|activity date|meeting time|treffzeit|report(?:ing)? time|\bvon\b|\bam\b/gi],
  ['ende', /check[\s-]?out|checkout|abreise|drop[\s-]?off|dropoff|\breturn\b|rückgabe|rueckgabe|abgabe|\buntil\b|\btill\b|\bbis\b|\bends?\b|end date|\bende\b|finish/gi],
  ['abfahrt', /depart(?:s|ure|ing)?\b|abflug|abfahrt|\bdep\b|\bleaves?\b|sailing time/gi],
  ['ankunft', /arriv(?:e|es|al|ing)\b|ankunft|\barr\b|landing|landung/gi],
]

function alleStichworte(text) {
  const out = []
  for (const [rolle, re] of STICHWORTE) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) out.push({ rolle, start: m.index, ende: m.index + m[0].length })
  }
  // „Check-in“ steckt in „check-in closes“: das längere Stichwort gewinnt.
  out.sort((a, b) => a.start - b.start || (b.ende - b.start) - (a.ende - a.start))
  const sauber = []
  for (const s of out) if (!sauber.some((x) => s.start < x.ende && s.ende > x.start)) sauber.push(s)
  return sauber
}

/** Ordnet jedem Treffer (Datum oder Zeit) eine Rolle zu. */
function rollenZuordnen(text, treffer, stichworte, fremde = []) {
  const zeilen = []
  let p = 0
  for (const z of text.split('\n')) { zeilen.push({ a: p, b: p + z.length }); p += z.length + 1 }
  const zeileVon = (i) => { let lo = 0, hi = zeilen.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (zeilen[m].a <= i) lo = m; else hi = m - 1 } return lo }
  const swIn = (a, b) => stichworte.filter((s) => s.start >= a && s.ende <= b)
  // Andere Treffer (Daten, Zeiten) markieren Grenzen: ein Stichwort gilt nur bis zum
  // nächsten Wert. Sonst erbte „Mon, 14 Dec“ das „Check-in“ von zwei Zeilen höher.
  const alle = [...treffer, ...fremde].sort((a, b) => a.start - b.start)

  for (const t of treffer) {
    const zi = zeileVon(t.start)
    const z = zeilen[zi]
    // 1  in derselben Zeile, zwischen dem vorigen Wert und diesem
    const vorher = alle.filter((x) => x !== t && x.start >= z.a && x.ende <= t.start)
    const ab = vorher.length ? vorher[vorher.length - 1].ende : z.a
    let sw = swIn(ab, t.start)
    if (sw.length) { t.rolle = sw[sw.length - 1].rolle; continue }
    if (vorher.length) {
      // Wert direkt nach einem anderen Wert ohne eigenes Stichwort („12 Dec 2026 10:05“):
      // gleiche Rolle wie der Nachbar.
      const nb = vorher[vorher.length - 1]
      if (nb.rolle && t.start - nb.ende < 6) { t.rolle = nb.rolle; continue }
    }
    // 2  Tabellenkopf in einer Zeile darüber: n-ter Wert unter n-tem Stichwort
    let rolle = null
    for (let k = zi - 1; k >= Math.max(0, zi - 3) && !rolle; k--) {
      const zz = zeilen[k]
      const sws = swIn(zz.a, zz.b)
      if (!sws.length) continue
      const gleicheZeile = treffer.filter((x) => x.typ === t.typ && x.start >= z.a && x.start < z.b)
      const nr = gleicheZeile.indexOf(t)
      const werteDort = alle.filter((x) => x.start >= zz.a && x.ende <= zz.b)
      if (werteDort.length) {
        // Zeile mit eigenen Werten: nur ihr letztes Stichwort nach dem letzten Wert zählt
        const rest = sws.filter((s) => s.start >= werteDort[werteDort.length - 1].ende)
        if (rest.length) rolle = rest[rest.length - 1].rolle
        continue
      }
      rolle = sws.length > 1 && nr >= 0 ? sws[Math.min(nr, sws.length - 1)].rolle : sws[sws.length - 1].rolle
    }
    t.rolle = rolle || 'neutral'
  }
}

function rolleFuerArt(rolle, art) {
  if (rolle === 'abfahrt') return art === 'unterkunft' ? 'ende' : 'start'
  if (rolle === 'ankunft') return art === 'unterkunft' ? 'start' : 'ende'
  return rolle
}

// ---------- Art und Anbieter ----------
const ANBIETER = [
  [/qantas/i, 'Qantas', 'flug'], [/virgin australia/i, 'Virgin Australia', 'flug'], [/jetstar/i, 'Jetstar', 'flug'],
  [/emirates/i, 'Emirates', 'flug'], [/qatar airways/i, 'Qatar Airways', 'flug'], [/singapore airlines/i, 'Singapore Airlines', 'flug'],
  [/regional express|\brex airlines/i, 'Rex', 'flug'], [/airnorth/i, 'Airnorth', 'flug'], [/lufthansa/i, 'Lufthansa', 'flug'],
  [/booking\.com/i, 'Booking.com', 'unterkunft'], [/airbnb/i, 'Airbnb', 'unterkunft'], [/hotels\.com/i, 'Hotels.com', 'unterkunft'],
  [/agoda/i, 'Agoda', 'unterkunft'], [/discovery parks/i, 'Discovery Parks', 'unterkunft'], [/\bbig ?4\b/i, 'BIG4', 'unterkunft'],
  [/rac (?:parks|resorts)/i, 'RAC Parks & Resorts', 'unterkunft'],
  [/parks\.dpaw\.wa\.gov\.au|park ?stay wa|parks and wildlife service|\bdbca\b/i, 'Parks and Wildlife WA', 'unterkunft'],
  [/\bbritz\b/i, 'Britz', 'fahrzeug'], [/\bmaui\b/i, 'maui', 'fahrzeug'], [/apollo (?:motorhome|camper|rv)|apollocamper|\bapollo\b/i, 'Apollo', 'fahrzeug'],
  [/\bjucy\b/i, 'Jucy', 'fahrzeug'], [/mighty campers/i, 'Mighty', 'fahrzeug'], [/travellers autobarn/i, 'Travellers Autobarn', 'fahrzeug'],
  [/\bhertz\b/i, 'Hertz', 'fahrzeug'], [/\bavis\b/i, 'Avis', 'fahrzeug'], [/europcar/i, 'Europcar', 'fahrzeug'], [/\bthrifty\b/i, 'Thrifty', 'fahrzeug'],
  [/rottnest express/i, 'Rottnest Express', 'faehre'], [/rottnest fast ferries/i, 'Rottnest Fast Ferries', 'faehre'], [/sealink/i, 'SeaLink', 'faehre'],
  [/exmouth dive/i, 'Exmouth Dive & Whalesharks Ningaloo', 'tour'], [/three islands/i, 'Three Islands', 'tour'], [/kings ningaloo/i, 'Kings Ningaloo Reef Tours', 'tour'],
  [/live ningaloo/i, 'Live Ningaloo', 'tour'], [/ningaloo (?:discovery|whaleshark|blue)/i, 'Ningaloo Discovery', 'tour'],
  [/getyourguide/i, 'GetYourGuide', 'tour'], [/viator/i, 'Viator', 'tour'], [/klook/i, 'Klook', 'tour'],
  [/expedia/i, 'Expedia', null],
]
const CAMPER = /campervan|camper|motorhome|wohnmobil|\brv\b|berth|britz|maui|apollo|jucy|mighty/i
const ART_WOERTER = {
  flug: [/\bflight\b|\bflug\b|flüge|boarding|e-?ticket|\bpnr\b|baggage|gepäck|\bseat\b|sitzplatz|airport|flughafen|terminal|\bfare\b|economy|business class/gi],
  unterkunft: [/hotel|motel|resort|\blodge|apartment|\broom\b|zimmer|check[\s-]?in|check[\s-]?out|\bnights?\b|nächte|übernachtung|\bguests?\b|\bgäste\b|\bhost\b|unterkunft|accommodation|campsite|camp site|campground|caravan park|stellplatz|powered site|\bsite\b|zeltplatz/gi],
  fahrzeug: [/campervan|camper|motorhome|wohnmobil|\bvehicle\b|fahrzeug|rental|mietwagen|car hire|\bpick[\s-]?up\b|drop[\s-]?off|\bbranch\b|\bdepot\b|\bdriver\b|fahrer|excess|unlimited km|kilometres|\bberth\b/gi],
  tour: [/\btour\b|excursion|ausflug|cruise|snorkel|whale ?shark|walhai|\bdive\b|tauch|experience|activity|aktivität|voucher|meeting point|treffpunkt|\bguide\b|safari|eco/gi],
  faehre: [/ferry|fähre|faehre|\bjetty\b|anleger|crossing|überfahrt|sailing|return trip|b shed|barrack street/gi],
}

export function erkenneArt(text) {
  const punkte = { flug: 0, unterkunft: 0, fahrzeug: 0, tour: 0, faehre: 0 }
  let anbieter = null
  for (const [re, name, art] of ANBIETER) {
    if (re.test(text)) {
      if (!anbieter) anbieter = { name, art }
      if (art) punkte[art] += 4
    }
  }
  for (const [art, res] of Object.entries(ART_WOERTER)) {
    for (const re of res) { re.lastIndex = 0; const n = new Set((text.match(re) || []).map((s) => s.toLowerCase())).size; punkte[art] += n }
  }
  if (FLUGNR_RE().test(text)) punkte.flug += 3
  const sortiert = Object.entries(punkte).sort((a, b) => b[1] - a[1])
  const [beste, p1] = sortiert[0], p2 = sortiert[1][1]
  if (p1 < 2) return { art: { wert: 'sonstiges', konfidenz: 0.4 }, anbieter, punkte }
  const k = Math.min(0.95, 0.45 + 0.1 * (p1 - p2) + (anbieter?.art === beste ? 0.2 : 0))
  return { art: { wert: beste, konfidenz: Math.round(k * 100) / 100 }, anbieter, punkte }
}

// ---------- Flugnummer, Strecke ----------
const AIRLINES = 'QF|VA|JQ|EK|QR|SQ|NZ|TT|ZL|TL|MH|CX|EY|LH|GA|TR|NH|JL|KE|CI|BR|TG|VN|UL|AI|FJ|NF|PX|3K|QQ|OD|D7|FD|AK|TK|BA|AF|KL|LX|OS|UA|DL|AA'
const FLUGNR_RE = () => new RegExp(`\\b(${AIRLINES})\\s?-?(\\d{1,4})\\b(?![.,:]?\\d)`, 'g')

const IATA = {
  PER: 'Perth', BME: 'Broome', KTA: 'Karratha', LEA: 'Learmonth (Exmouth)', PHE: 'Port Hedland', KNX: 'Kununurra',
  DRW: 'Darwin', ASP: 'Alice Springs', ALH: 'Albany', EPR: 'Esperance', GET: 'Geraldton', KGI: 'Kalgoorlie',
  CVQ: 'Carnarvon', MJK: 'Monkey Mia', NRA: 'Newman', PBO: 'Paraburdoo', DRB: 'Derby', AYQ: 'Uluru',
  MEL: 'Melbourne', SYD: 'Sydney', BNE: 'Brisbane', ADL: 'Adelaide', CNS: 'Cairns', OOL: 'Gold Coast', HBA: 'Hobart',
  CBR: 'Canberra', PPP: 'Proserpine', HTI: 'Hamilton Island', TSV: 'Townsville',
  DXB: 'Dubai', DOH: 'Doha', SIN: 'Singapur', KUL: 'Kuala Lumpur', HKG: 'Hongkong', DPS: 'Bali', AKL: 'Auckland',
  FRA: 'Frankfurt', MUC: 'München', HAM: 'Hamburg', BER: 'Berlin', DUS: 'Düsseldorf', ZRH: 'Zürich', VIE: 'Wien', LHR: 'London',
}
const IATA_RE = new RegExp(`\\b(${Object.keys(IATA).join('|')})\\b`, 'g')

function flugnummern(text) {
  const out = []
  for (const m of text.matchAll(FLUGNR_RE())) {
    const nr = `${m[1]} ${Number(m[2])}`
    out.push({ wert: nr, start: m.index, ende: m.index + m[0].length })
  }
  // Ohne bekannte Airline: nur hinter „Flight“/„Flug“.
  if (!out.length) {
    for (const m of text.matchAll(/(?:flight(?:\s*(?:number|no\.?))?|flug(?:nummer|nr\.?)?)\s*:?\s*([A-Z0-9]{2})\s?(\d{1,4})\b/gi)) {
      if (!/[A-Z]/i.test(m[1])) continue
      out.push({ wert: `${m[1].toUpperCase()} ${Number(m[2])}`, start: m.index, ende: m.index + m[0].length, unsicher: true })
    }
  }
  return out
}
function iataFolge(text) {
  const out = []
  for (const m of text.matchAll(IATA_RE)) if (out[out.length - 1] !== m[1]) out.push(m[1])
  return out
}
const stadt = (code) => IATA[code] || code

/** Strecke aus Namen: „From: Fremantle To: Rottnest Island“, „Perth → Broome“, Etiketten je Zeile. */
function streckeAusText(t) {
  const NAME = `[A-ZÄÖÜ][A-Za-zäöüß.'()]*(?: [A-ZÄÖÜ(][A-Za-zäöüß.'()]*){0,4}`
  const m = t.match(new RegExp(`\\b(?:[Ff]rom|[Vv]on|FROM)\\s*:?\\s*(${NAME})\\s+(?:[Tt]o|[Nn]ach|TO|→|->)\\s*:?\\s*(${NAME})`))
    || t.match(new RegExp(`(${NAME})\\s*(?:→|->|⇄|↔)\\s*(${NAME})`))
  if (m) {
    const a = ohneDatumZeit(m[1]), b = ohneDatumZeit(m[2])
    if (a && b && a !== b) return `${a} → ${b}`
  }
  const a = etikettWert(t, 'departing from|departing|departure point|departs from|from|von|abfahrt ab|abfahrtshafen')
  const b = etikettWert(t, 'destination|arriving at|arriving|to|ziel|nach|zielhafen')
  if (a && b && a.length < 50 && b.length < 50 && /[a-z]{3}/i.test(a + b)) return `${a} → ${b}`
  return null
}

// ---------- Kleine Helfer für Zeilen mit Etikett ----------
const zeilenListe = (text) => text.split('\n').map((z) => z.trim())
function ohneDatumZeit(s) {
  return s
    .replace(/\b(?:mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday|mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b\.?,?\s*(?=\d)/gi, '')
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\.?\\s*(?:${MON_RE})\\.?,?\\s*(?:\\d{4})?`, 'gi'), '')
    .replace(/\b\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, '')
    .replace(/\b\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?|uhr|hrs)?/gi, '')
    .replace(/\b(?:at|um|ab|from|by|until|bis)\s*$/i, '')
    .replace(/[\s,;·|–—-]+$/g, '').replace(/^[\s,;·|:–—-]+/g, '').trim()
}
/** Wert hinter einem Etikett: „Etikett: Wert“ oder Etikett allein in der Zeile, Wert darunter. */
function etikettWert(text, etiketten, { saeubern = true } = {}) {
  const zeilen = zeilenListe(text)
  const re = new RegExp(`^(?:${etiketten})\\s*(?:[:#\\-–]|\\s{2,}|\\t)\\s*(.*)$`, 'i')
  const allein = new RegExp(`^(?:${etiketten})\\s*:?\\s*$`, 'i')
  for (let i = 0; i < zeilen.length; i++) {
    let w = null
    const m = zeilen[i].match(re)
    if (m && m[1].trim()) w = m[1]
    else if (allein.test(zeilen[i])) w = zeilen.slice(i + 1).find((z) => z) || null
    if (w == null) continue
    const s = saeubern ? ohneDatumZeit(w) : w.trim()
    if (s && s.length >= 2) return s
  }
  return null
}

// ---------- Buchungsnummer ----------
const REF_ETIKETTEN = [
  'booking reference(?: number)?', 'booking ref\\.?(?:erence)?(?: no\\.?)?', 'airline booking reference', 'booking (?:number|no\\.?|id|code|#)',
  'confirmation (?:number|no\\.?|code|#)', 'confirmation', 'reservation (?:number|no\\.?|code|id|#)', 'reservation',
  'record locator', 'pnr', 'itinerary (?:number|no\\.?)', 'order (?:number|no\\.?|id)', 'reference(?: number| no\\.?)?', 'ref\\.?(?: no\\.?)?',
  'buchungs(?:nummer|code|referenz|nr\\.?)', 'best[äa]tigungs(?:nummer|code|nr\\.?)', 'reservierungs(?:nummer|code|nr\\.?)', 'vorgangsnummer', 'auftragsnummer',
]
function istRef(s) {
  if (!s) return false
  const roh = s.replace(/[.\-\/]/g, '')
  if (roh.length < 5 || roh.length > 20) return false
  if (/^\d+$/.test(roh)) return roh.length >= 6
  if (/\d/.test(roh)) return /^[A-Z0-9]+$/i.test(roh)
  return /^[A-Z]{6}$/.test(roh)      // PNR: sechs Großbuchstaben
}
export function findeRef(text) {
  for (const et of REF_ETIKETTEN) {
    const re = new RegExp(`(?:^|[^a-z])(?:${et})\\s*(?:\\([^)\\n]{0,20}\\))?\\s*(?:is|lautet|ist)?\\s*[:#]?\\s*\\n?\\s*([A-Z0-9][A-Z0-9.\\-\\/]{3,24}[A-Z0-9])`, 'gi')
    for (const m of text.matchAll(re)) if (istRef(m[1])) return { wert: m[1].replace(/[.]$/, ''), konfidenz: 0.9 }
  }
  const hm = text.match(/\bHM[A-Z0-9]{8}\b/)
  if (hm) return { wert: hm[0], konfidenz: 0.8 }
  return { wert: null, konfidenz: 0 }
}

// ---------- Betrag ----------
export function zahlAus(s) {
  let t = String(s).replace(/['\s]/g, '')
  const k = t.lastIndexOf(','), p = t.lastIndexOf('.')
  if (k >= 0 && p >= 0) t = k > p ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (k >= 0) t = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (p >= 0 && /\.\d{3}$/.test(t) && (t.match(/\./g) || []).length >= 1 && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return isNaN(n) ? null : n
}
const ZAHL = `\\d{1,3}(?:[.,']\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?`
function waehrungVon(s) {
  if (!s) return null
  if (/aud|au\$|a\$/i.test(s)) return 'AUD'
  if (/eur|€|euro/i.test(s)) return 'EUR'
  if (/usd|us\$/i.test(s)) return 'USD'
  if (s.includes('$')) return '$'
  return null
}
export function findeBetrag(text) {
  const kand = []
  const re1 = new RegExp(`(?<![A-Za-z])(AUD|AU\\$|A\\$|EUR|€|US\\$|USD|\\$)\\s?(${ZAHL})(?:\\s*(AUD|EUR|USD))?`, 'gi')
  const re2 = new RegExp(`(?<![\\d.,])(${ZAHL})\\s?(AUD|EUR|USD|€|Euro|AU\\$|A\\$|\\$)`, 'gi')
  for (const m of text.matchAll(re1)) kand.push({ start: m.index, betrag: zahlAus(m[2]), w: waehrungVon(m[3] || m[1]) })
  for (const m of text.matchAll(re2)) if (!kand.some((k) => Math.abs(k.start - m.index) < 6)) kand.push({ start: m.index, betrag: zahlAus(m[1]), w: waehrungVon(m[2]) })
  if (!kand.length) return { betrag: { wert: null, konfidenz: 0 }, waehrung: { wert: null, konfidenz: 0 } }
  for (const k of kand) {
    const zs = text.lastIndexOf('\n', k.start - 1) + 1
    const davor = text.slice(Math.max(zs, k.start - 60), k.start).toLowerCase()
    const zeilenRest = text.slice(zs, text.indexOf('\n', k.start) < 0 ? undefined : text.indexOf('\n', k.start)).toLowerCase()
    let s = 0
    if (/total|gesamt|summe|grand total|amount paid|total paid|total charged|charged|bezahlt|paid|zu zahlen|endpreis|rechnungsbetrag/.test(davor)) s += 3
    else if (/price|preis|betrag|amount|cost|kosten/.test(davor)) s += 1
    if (/per night|pro nacht|\/night|per person|pro person|tax|gst|steuer|fee|gebühr|discount|rabatt|bond|kaution|excess|selbstbeteiligung|deposit|anzahlung|balance due|restbetrag/.test(zeilenRest)) s -= 2
    k.punkte = s
  }
  kand.sort((a, b) => b.punkte - a.punkte || (b.betrag || 0) - (a.betrag || 0))
  const best = kand[0]
  let w = best.w, wk = 0.9
  if (w === '$') {
    // Ein nacktes „$“ ist bei australischen Anbietern AUD. Steht irgendwo „AUD“, erst recht.
    const usd = /\bUSD\b|US\$|US dollars/i.test(text)
    w = usd ? 'USD' : 'AUD'; wk = /\bAUD\b|AU\$|A\$|australian dollars?/i.test(text) ? 0.85 : 0.6
  }
  return {
    betrag: { wert: best.betrag, konfidenz: best.punkte >= 3 ? 0.9 : best.punkte >= 1 ? 0.75 : kand.length === 1 ? 0.65 : 0.5 },
    waehrung: { wert: w, konfidenz: wk },
  }
}

// ---------- Ort ----------
const ORT_ETIKETTEN = 'property address|hotel address|address|adresse|anschrift|location|meeting point|treffpunkt|pick[\\s-]?up (?:location|branch|address|depot|point)|pickup location|abholort|übernahmeort|übernahmestation|departure point|departs from|abfahrtsort|abfahrt ab|venue|campground|campsite|park|standort'
const ORT_BIS_ETIKETTEN = 'drop[\\s-]?off (?:location|branch|address|depot)|dropoff location|return (?:location|branch|depot)|rückgabeort|rückgabestation|abgabeort'
/** „Pick-up: 7:15am from Exmouth Escape Resort, …“ → „Exmouth Escape Resort, …“ */
function saeubereOrt(z) {
  let s = String(z).trim().replace(/^[A-Za-zÄÖÜäöüß \-]{2,28}:\s*/, '')
  s = ohneDatumZeit(s).replace(/^(?:from|ab|at|um|bei|von)\s+/i, '').replace(/^[\s,;·|–—-]+/, '').trim()
  return s
}
const AU_ADRESSE = /^.*\b(?:WA|NT|SA|QLD|NSW|VIC|TAS|ACT|Western Australia)\s+\d{4}\b.*$/m

// ---------- Titel ----------
function findeTitel(text, art, anbieter, extra) {
  const nimm = (s) => s && s.replace(/\s+/g, ' ').replace(/["“”„]/g, '').replace(/[.!,:;]+$/, '').trim()
  const sätze = [
    /your (?:booking|reservation|stay) (?:at|in|with) (.+?)(?: is| has|!|\.|,|\n| for |$)/i,
    /(?:booking|reservation) (?:confirmed|confirmation)\s*(?:at|for|:|–|-)\s*(.+?)(?:!|\n|$)/i,
    /(?:thanks|thank you) for (?:booking|choosing|staying)(?: with| at)? (.+?)(?:!|\.|,|\n|$)/i,
    /ihre (?:buchung|reservierung) (?:im|in der|in|bei|für|fuer)\s+(.+?)(?: ist| wurde|!|\.|,|\n|$)/i,
    /you'?re (?:going|off) to (.+?)(?:!|\.|\n|$)/i,
  ]
  const etiketten = {
    unterkunft: 'hotel|hotel name|property|property name|accommodation|unterkunft|campground|campsite|camp ground|park name|listing',
    fahrzeug: 'vehicle|vehicle type|fahrzeug|fahrzeugtyp|vehicle model|camper',
    tour: 'tour|tour name|activity|product|experience|aktivität|ausflug|trip|excursion',
    faehre: 'route|ticket|product|service|fahrt',
    sonstiges: 'product|event|veranstaltung|ticket',
  }
  if (art === 'flug') {
    const f = extra.strecke
    if (f) return { wert: f, konfidenz: 0.85 }
    return { wert: extra.flugNr ? t('Flug {nr}', { nr: extra.flugNr }) : t('Flug'), konfidenz: 0.4 }
  }
  if (art === 'faehre' && extra.strecke) return { wert: t('Fähre {strecke}', { strecke: extra.strecke }), konfidenz: 0.8 }
  const et = etiketten[art]
  if (et) {
    const w = etikettWert(text, et)
    if (w && w.length < 80) {
      if (art === 'fahrzeug' && anbieter && !w.toLowerCase().includes(anbieter.toLowerCase())) return { wert: `${anbieter} ${w}`, konfidenz: 0.8 }
      return { wert: nimm(w), konfidenz: 0.8 }
    }
  }
  if (art !== 'fahrzeug') {
    for (const re of sätze) {
      const m = text.match(re)
      if (m && m[1] && m[1].length < 70 && !/^(?:the )?(?:booking|reservation)$/i.test(m[1].trim())) return { wert: nimm(m[1]), konfidenz: 0.75 }
    }
  }
  if (art === 'unterkunft' || art === 'sonstiges') {
    // Eine eigene Zeile, die wie ein Hausname aussieht: „Kalbarri Beach Resort“
    const HAUS = /\b(?:resort|hotel|motel|lodge|inn|hostel|backpackers|caravan park|holiday park|tourist park|apartments?|retreat|cabins?|station stay|homestead|guesthouse|b&b|campground|camp)\b/i
    for (const zeile of text.split('\n').map((z) => z.trim()).filter(Boolean)) {
      if (zeile.length > 60 || /:|@|https?:|\d{3,}/.test(zeile) || !HAUS.test(zeile)) continue
      if (/^(?:booking|reservation|confirmation|your|dear|thank|check)/i.test(zeile)) continue
      return { wert: nimm(zeile), konfidenz: 0.65 }
    }
  }
  const betreff = etikettWert(text, 'subject|betreff', { saeubern: false })
  if (betreff) {
    const b = nimm(betreff.replace(/^(?:re|aw|fwd?|wg):\s*/i, '').replace(/\b(?:booking|reservation)?\s*(?:confirmation|confirmed|bestätigung|buchungsbestätigung)\b\s*[-–:|]?\s*/gi, ''))
    if (b && b.length >= 3 && b.length < 80) return { wert: b, konfidenz: 0.55 }
  }
  const nameArt = { unterkunft: t('Unterkunft'), fahrzeug: extra.camper ? t('Camper') : t('Mietwagen'), tour: t('Tour'), faehre: t('Fähre'), sonstiges: t('Buchung') }[art] || t('Buchung')
  if (anbieter) return { wert: art === 'fahrzeug' ? `${anbieter} ${nameArt}` : `${nameArt} ${anbieter}`, konfidenz: 0.45 }
  return { wert: nameArt, konfidenz: 0.2 }
}

// ---------- Hauptfunktion ----------
const feld = (wert = null, konfidenz = 0) => ({ wert: wert === undefined ? null : wert, konfidenz: wert == null || wert === '' ? 0 : Math.round(konfidenz * 100) / 100 })

/**
 * @param {string} text      eingefügter Mailtext
 * @param {object} [o]
 * @param {{von:string,bis:string}} [o.zeitraum]  Reisezeitraum, hilft bei Jahr und Mehrdeutigkeit
 * @param {string} [o.heute]  YYYY-MM-DD
 */
export function erkenne(text, { zeitraum = null, heute = null } = {}) {
  const txt = String(text || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n')
  const hinweise = []
  const leer = {
    art: feld('sonstiges', 0.2), fahrzeug: feld(null), titel: feld(null), anbieter: feld(null),
    von: feld(null), bis: feld(null), zeitVon: feld(null), zeitBis: feld(null), ort: feld(null), ortBis: feld(null),
    ref: feld(null), flugNr: feld(null), betrag: feld(null), waehrung: feld(null), naechte: feld(null),
    segmente: [], hinweise,
  }
  if (txt.trim().length < 15) { hinweise.push(t('Zu wenig Text. Am besten die ganze Mail einfügen.')); return leer }

  const kontext = { zeitraum, heute, hinweise }
  const { art: artF, anbieter } = erkenneArt(txt)
  const art = artF.wert
  const daten = findeDaten(txt, kontext).map((d) => ({ ...d, typ: 'datum' }))
  const zeiten = findeZeiten(txt).map((z) => ({ ...z, typ: 'zeit' }))
  const werte = [...daten, ...zeiten]
  // Stichworte, die selbst in einem Wert stecken („9 am“), zählen nicht.
  const sw = alleStichworte(txt).filter((s) => !werte.some((w) => s.start < w.ende && s.ende > w.start))
  rollenZuordnen(txt, daten, sw, zeiten)
  rollenZuordnen(txt, zeiten, sw, daten)
  for (const x of [...daten, ...zeiten]) x.rolleArt = rolleFuerArt(x.rolle, art)

  const nutzbar = daten.filter((d) => d.rolleArt !== 'ignorieren')
  // Daten weit außerhalb der Reise (Buchungstag, Mailkopf) nur nehmen, wenn sonst nichts da ist.
  const imZr = nutzbar.filter((d) => imZeitraum(d.iso, zeitraum, 30))
  const pool = imZr.length ? imZr : nutzbar

  let von = null, bis = null
  const startD = pool.find((d) => d.rolleArt === 'start' || d.bereich === 'von')
  if (startD) von = feld(startD.iso, startD.konfidenz * (startD.rolleArt === 'start' || startD.bereich ? 1 : 0.8))
  const endeD = pool.find((d) => (d.rolleArt === 'ende' || d.bereich === 'bis') && (!von?.wert || d.iso >= von.wert))
  if (endeD) bis = feld(endeD.iso, endeD.konfidenz)
  if (!von) {
    const neutral = pool.filter((d) => d.rolleArt !== 'ende')
    const erst = [...neutral].sort((a, b) => a.iso.localeCompare(b.iso))[0]
    if (erst) von = feld(erst.iso, erst.konfidenz * (neutral.length === 1 ? 0.8 : 0.6))
  }
  if (!bis && von?.wert && ['unterkunft', 'fahrzeug'].includes(art)) {
    const spaeter = pool.filter((d) => d.iso > von.wert && d.rolleArt !== 'start').sort((a, b) => b.iso.localeCompare(a.iso))[0]
    if (spaeter) bis = feld(spaeter.iso, spaeter.konfidenz * 0.6)
  }

  // Nächte: „2 nights“, „3 Nächte“ (prüft und ergänzt das Abreisedatum)
  let naechte = feld(null)
  const nm = txt.match(/\b(\d{1,2})\s*(?:nights?|nächte|naechte|übernachtungen)\b/i)
    || txt.match(/\b(?:nights?|nächte|naechte|übernachtungen)\s*:\s*(\d{1,2})\b/i)
  if (nm) {
    const n = +nm[1]
    naechte = feld(n, 0.85)
    if (von?.wert && art === 'unterkunft') {
      const soll = plusTage(von.wert, n)
      if (!bis) bis = feld(soll, Math.min(von.konfidenz, 0.75))
      else if (bis.wert !== soll) hinweise.push(t('Die Mail nennt {naechte}, die Daten ergeben {anzahl}. Bitte prüfen.', { naechte: tn(n, '{n} Nacht', '{n} Nächte'), anzahl: tageZwischen(von.wert, bis.wert) }))
      else bis.konfidenz = Math.min(0.98, bis.konfidenz + 0.05)
    }
  }
  if (bis?.wert && von?.wert && bis.wert === von.wert && art !== 'unterkunft') bis = null

  // Uhrzeiten
  const zStart = zeiten.find((z) => z.rolleArt === 'start')
  const zEnde = zeiten.find((z) => z.rolleArt === 'ende')
  let zeitVon = zStart ? feld(zStart.zeit, zStart.konfidenz * 0.95) : null
  const zeitBis = zEnde ? feld(zEnde.zeit, zEnde.konfidenz * 0.95) : feld(null)
  if (!zeitVon) {
    const n = zeiten.filter((z) => z.rolleArt === 'neutral')
    if (n.length) zeitVon = feld(n[0].zeit, n.length === 1 ? 0.6 : 0.45)
  }

  // Flug: Nummern, Strecken, Segmente
  const nummern = flugnummern(txt)
  const eindeutig = [...new Map(nummern.map((n) => [n.wert, n])).values()]
  let segmente = []
  if (art === 'flug' || eindeutig.length) {
    const zeilenStart = (i) => txt.lastIndexOf('\n', i - 1) + 1
    segmente = eindeutig.map((n, i) => {
      const a = zeilenStart(n.start)
      const b = i + 1 < eindeutig.length ? zeilenStart(eindeutig[i + 1].start) : txt.length
      const ds = daten.filter((d) => d.start >= a && d.start < b && d.rolleArt !== 'ignorieren')
      const zs = zeiten.filter((z) => z.start >= a && z.start < b && z.rolle !== 'boarding')
      const dStart = ds.find((d) => d.rolleArt === 'start') || ds[0]
        || [...daten].filter((d) => d.start < a && d.rolleArt !== 'ignorieren').pop()
      const dEnde = ds.find((d) => d.rolleArt === 'ende' && dStart && d.iso > dStart.iso)
      const zAb = zs.find((z) => z.rolleArt === 'start') || zs.find((z) => z.rolleArt === 'neutral')
      const zAn = zs.find((z) => z.rolleArt === 'ende') || (zAb ? zs.find((z) => z !== zAb && z.start > zAb.start && z.rolleArt === 'neutral') : null)
      const codes = iataFolge(txt.slice(a, b))
      return {
        flugNr: n.wert,
        datum: dStart?.iso || null,
        datumAn: dEnde?.iso || null,
        zeitVon: zAb?.zeit || null,
        zeitBis: zAn?.zeit || null,
        von: codes[0] || null, nach: codes[1] || null,
        titel: codes.length >= 2 ? `${stadt(codes[0])} → ${stadt(codes[1])}` : t('Flug {nr}', { nr: n.wert }),
        konfidenz: Math.round(((dStart?.konfidenz || 0.3) * (n.unsicher ? 0.7 : 1)) * 100) / 100,
      }
    })
  }
  let strecke = null
  if (art === 'flug') {
    const codes = segmente.length ? segmente.flatMap((s) => [s.von, s.nach]).filter(Boolean) : iataFolge(txt)
    const kette = codes.filter((c, i) => c !== codes[i - 1])
    if (kette.length >= 2) {
      const ziel = kette[kette.length - 1]
      strecke = ziel === kette[0] && kette.length >= 3
        ? t('{a} → {b} und zurück', { a: stadt(kette[0]), b: stadt(kette[1]) })
        : `${stadt(kette[0])} → ${stadt(ziel)}`
    }
    if (segmente[0]?.datum && (!von?.wert || von.konfidenz < 0.8)) von = feld(segmente[0].datum, segmente[0].konfidenz)
    if (segmente.length > 1) {
      const letzte = segmente[segmente.length - 1]
      const end = letzte.datumAn || letzte.datum
      if (end && von?.wert && end > von.wert) bis = feld(end, letzte.konfidenz * 0.9)
      hinweise.push(t('{n} Flüge erkannt. Jeder wird als eigener Termin angelegt.', { n: segmente.length }))
    } else if (segmente.length === 1) {
      const s = segmente[0]
      if (s.zeitVon) zeitVon = feld(s.zeitVon, 0.85)
      if (s.zeitBis) zeitBis.wert = s.zeitBis, zeitBis.konfidenz = 0.8
      bis = s.datumAn && s.datumAn !== von?.wert ? feld(s.datumAn, 0.8) : null
    }
  }
  if (!strecke && (art === 'faehre' || art === 'flug')) strecke = streckeAusText(txt)

  // Ort
  let ort = feld(null)
  if (art === 'fahrzeug') {
    const w = etikettWert(txt, 'pick[\\s-]?up|pickup|übernahme|abholung|collection')
    if (w && w.length < 120 && /[a-z]{3}/i.test(w)) ort = feld(saeubereOrt(w), 0.75)
  }
  const ortW = ort.wert ? null : etikettWert(txt, ORT_ETIKETTEN)
  if (ortW && ortW.length < 120) ort = feld(saeubereOrt(ortW), 0.8)
  else if (!ort.wert) {
    const ad = txt.match(AU_ADRESSE)
    if (ad && ad[0].trim().length < 160) ort = feld(saeubereOrt(ad[0]), 0.7)
  }
  if (!ort.wert && art === 'flug' && segmente[0]?.von) ort = feld(`${stadt(segmente[0].von)} (${segmente[0].von})`, 0.75)
  let ortBis = feld(null)
  const ob = etikettWert(txt, ORT_BIS_ETIKETTEN) || (art === 'fahrzeug' ? etikettWert(txt, 'drop[\\s-]?off|dropoff|return|rückgabe|abgabe') : null)
  if (ob && ob.length < 120 && /[a-z]{3}/i.test(ob)) ortBis = feld(ob, 0.75)

  const ref = findeRef(txt)
  const geld = findeBetrag(txt)
  if (geld.waehrung.wert === 'AUD' && geld.waehrung.konfidenz < 0.7) hinweise.push(t('„$“ als australische Dollar gelesen.'))
  const flugNr = segmente[0]?.flugNr || null
  const camper = art === 'fahrzeug' ? CAMPER.test(txt) : false
  const titel = findeTitel(txt, art, anbieter?.name, { strecke, flugNr, camper })

  if (!von?.wert) hinweise.push(t('Kein Datum gefunden. Bitte von Hand eintragen.'))

  return {
    art: feld(art, artF.konfidenz),
    fahrzeug: art === 'fahrzeug' ? feld(camper ? 'camper' : 'car', camper ? 0.85 : 0.6) : feld(null),
    titel: feld(titel.wert, titel.konfidenz),
    anbieter: feld(anbieter?.name || null, 0.9),
    von: von || feld(null), bis: bis || feld(null),
    zeitVon: zeitVon || feld(null), zeitBis,
    ort, ortBis,
    ref: feld(ref.wert, ref.konfidenz),
    flugNr: feld(flugNr, nummern[0]?.unsicher ? 0.6 : 0.9),
    betrag: feld(geld.betrag.wert, geld.betrag.konfidenz),
    waehrung: feld(geld.waehrung.wert, geld.waehrung.konfidenz),
    naechte,
    segmente: segmente.length > 1 ? segmente : [],
    hinweise: [...new Set(hinweise)],
  }
}

// ---------- Formular ----------

/** Erkanntes → flache Formularwerte (alles Strings, damit jedes Feld frei änderbar bleibt). */
export function alsFormular(e) {
  const w = (f) => (f?.wert == null ? '' : String(f.wert))
  return {
    art: e.art.wert || 'sonstiges', fahrzeug: e.fahrzeug.wert || 'camper',
    titel: w(e.titel), anbieter: w(e.anbieter),
    von: w(e.von), bis: w(e.bis), zeitVon: w(e.zeitVon), zeitBis: w(e.zeitBis),
    ort: w(e.ort), ortBis: w(e.ortBis), ref: w(e.ref), flugNr: w(e.flugNr),
    betrag: e.betrag.wert == null ? '' : dezimal(e.betrag.wert), waehrung: e.waehrung.wert || 'AUD',
    segmente: (e.segmente || []).map((s) => ({ an: true, datum: s.datum || '', zeitVon: s.zeitVon || '', zeitBis: s.zeitBis || '', flugNr: s.flugNr || '', titel: s.titel || '' })),
  }
}

const gueltigesIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && gueltig(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10))
export const formularOk = (f) => !!(f && gueltigesIso(f.von) && (f.titel || '').trim()) &&
  (!f.bis || gueltigesIso(f.bis)) && (!f.bis || f.bis >= f.von)

/**
 * Formular → Termine im Format des Reisekalenders. Mehrtägiges (Unterkunft, Fahrzeug,
 * mehrtägige Tour) wird wie im Kalender zu Beginn und Ende als zwei Termine angelegt.
 * Zusatzfelder (`quelle: 'eigen'`, zeit, ort, anbieter, betrag …) stören die übrigen
 * Ansichten nicht; sie lesen nur datum, kat, titel, sub, ref, emoji, docs.
 */
export function alsBuchungen(f, { id = () => Math.random().toString(36).slice(2, 10), jetzt = new Date().toISOString() } = {}) {
  if (!formularOk(f)) return []
  const a = artInfo(f.art)
  const kat = f.art === 'fahrzeug' ? (f.fahrzeug === 'car' ? 'car' : 'camper') : a.kat
  const emoji = f.art === 'fahrzeug' ? (kat === 'car' ? '🚗' : '🚐') : a.emoji
  const s = (x) => String(x ?? '').trim()
  const betrag = s(f.betrag) ? zahlAus(s(f.betrag)) : null
  const titel = s(f.titel)
  const basis = {
    kat, emoji, ref: s(f.ref), platzhalter: false, special: '', docs: [], quelle: 'eigen',
    anbieter: s(f.anbieter), angelegt: jetzt, flugNr: '',
  }
  const teile = (...xs) => xs.map(s).filter(Boolean).join(' · ')
  const mitBetrag = (e, i) => (i === 0 && betrag != null ? { ...e, betrag, waehrung: s(f.waehrung) || 'AUD' } : e)
  const gruppe = 'eg-' + id()
  const out = []

  if (f.art === 'flug') {
    const segs = (f.segmente || []).filter((x) => x.an && gueltigesIso(x.datum))
    const liste = segs.length ? segs : [{ datum: f.von, zeitVon: f.zeitVon, zeitBis: f.zeitBis, flugNr: f.flugNr, titel }]
    liste.forEach((g) => {
      out.push({ ...basis, id: 'eb-' + id(), gruppe, datum: g.datum, titel: s(g.titel) || titel, flugNr: s(g.flugNr),
        zeit: s(g.zeitVon), ort: segs.length ? '' : s(f.ort),
        sub: teile(g.zeitVon && t('Abflug {zeit}', { zeit: s(g.zeitVon) }), g.zeitBis && t('Ankunft {zeit}', { zeit: s(g.zeitBis) }), g.flugNr, f.anbieter) })
    })
    return out.map(mitBetrag)
  }

  const mehrtaegig = f.bis && f.bis > f.von
  const [anfang, schluss] = {
    unterkunft: [t('Check-in'), t('Check-out')],
    fahrzeug: [t('Übernahme'), t('Rückgabe')],
  }[f.art] || ['', t('Ende')]
  const n = mehrtaegig && f.art === 'unterkunft' ? tageZwischen(f.von, f.bis) : 0
  out.push({ ...basis, id: 'eb-' + id(), gruppe, datum: f.von, titel, zeit: s(f.zeitVon), ort: s(f.ort),
    sub: teile(
      anfang ? `${anfang}${f.zeitVon ? (f.art === 'unterkunft' ? ' ' + t('ab') + ' ' : ' ') + s(f.zeitVon) : ''}` : (f.zeitVon && (f.zeitBis && !mehrtaegig ? t('{von} bis {bis}', { von: s(f.zeitVon), bis: s(f.zeitBis) }) : s(f.zeitVon))),
      n ? tn(n, '{n} Nacht', '{n} Nächte') : '',
      f.ort, f.art !== 'unterkunft' || !/booking\.com|airbnb/i.test(s(f.anbieter)) ? '' : f.anbieter) })
  if (mehrtaegig) {
    out.push({ ...basis, id: 'eb-' + id(), gruppe, datum: f.bis, titel, zeit: s(f.zeitBis), ort: s(f.ortBis) || s(f.ort),
      sub: teile(`${schluss}${f.zeitBis ? (f.art === 'unterkunft' ? ' ' + t('bis') + ' ' : ' ') + s(f.zeitBis) : ''}`, f.ortBis) })
  }
  return out.map(mitBetrag)
}

/** Gibt es diese Buchung schon? Gleicher Tag und gleiche Buchungsnummer oder gleicher Titel. */
export function dubletten(vorhanden, neue) {
  const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return (neue || []).filter((n) => (vorhanden || []).some((v) => !v.platzhalter && v.datum === n.datum &&
    ((n.ref && norm(v.ref) === norm(n.ref)) || norm(v.titel) === norm(n.titel))))
}

/** Konfidenz → Stufe für die Anzeige. */
export const stufe = (k) => (k >= 0.8 ? 'sicher' : k >= 0.5 ? 'pruefen' : k > 0 ? 'unsicher' : 'leer')

// Datum ausgeschrieben in der Sprache der App („5. März 2027“ / „5 March 2027“)
function deutsch(iso) {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}
