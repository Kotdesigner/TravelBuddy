// Suche über alles außer den Orten: Logbuch-Tage, Tiere, Wanderungen, Buchungen,
// Etappen und Routen, Notizen, Packliste, Vorbereitung. Die Orte sucht weiter suche.js (eigene
// Rangfolge, Etiketten, „als Kacheln“); das Suchblatt zeigt beides untereinander.
//
// Regeln: Groß/klein, Umlaute und Akzente egal (norm aus suche.js). Mehrere Wörter müssen alle
// vorkommen, egal wo („känguru broome“). Ein Datum („3.12.“, „3. Dezember“, „Dec 3“, „2037-12-03“,
// „3/12“, „Tag 5“) sucht nach dem Tag statt nach dem Text. Reine Funktionen, alle Daten kommen
// als Argumente, damit tests/gesamtsuche.test.mjs sie prüfen kann.
import { norm } from './suche.js'
import { plusTage } from './plan.js'
import { mitWochentag, bereich } from './format.js'

const MONAT = {
  jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, mar: 3, marz: 3, march: 3, apr: 4, april: 4,
  mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, dez: 12, dec: 12, dezember: 12, december: 12,
}
const zwei = (n) => String(n).padStart(2, '0')
const gueltig = (t, m) => m >= 1 && m <= 12 && t >= 1 && t <= 31

/**
 * Ist der Begriff ein Datum? → { md: 'MM-DD', jahr: 'YYYY' | null } oder null.
 * „Tag 5“ zählt vom ersten Reisetag (start) an.
 */
export function datumAus(begriff, { start = null } = {}) {
  const s = norm(begriff).trim().replace(/\s+/g, ' ')
  let m
  const jahr = (y) => (!y ? null : y.length === 2 ? '20' + y : y)
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)) && gueltig(+m[3], +m[2])) return { md: `${m[2]}-${m[3]}`, jahr: m[1] }
  if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./]?(\d{2}|\d{4})?$/)) && gueltig(+m[1], +m[2])) return { md: `${zwei(m[2])}-${zwei(m[1])}`, jahr: jahr(m[3]) }
  if ((m = s.match(/^(\d{1,2})\.? ?([a-z]+)\.?,? ?(\d{4})?$/)) && MONAT[m[2]] && gueltig(+m[1], MONAT[m[2]])) return { md: `${zwei(MONAT[m[2]])}-${zwei(m[1])}`, jahr: m[3] || null }
  if ((m = s.match(/^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?,? ?(\d{4})?$/)) && MONAT[m[1]] && gueltig(+m[2], MONAT[m[1]])) return { md: `${zwei(MONAT[m[1]])}-${zwei(m[2])}`, jahr: m[3] || null }
  if ((m = s.match(/^(?:tag|day) (\d{1,3})$/)) && start && +m[1] >= 1) { const d = plusTage(start, +m[1] - 1); return { md: d.slice(5), jahr: d.slice(0, 4) } }
  return null
}
export const passtDatum = (datum, d) => !!datum && !!d && datum.slice(5, 10) === d.md && (!d.jahr || datum.slice(0, 4) === d.jahr)

/** Alle Texte eines Werts: Zeichenketten, Listen, Zähler (Schlüssel), verschachtelt. */
function texte(w, out = []) {
  if (w == null) return out
  if (typeof w === 'string' || typeof w === 'number') out.push(String(w))
  else if (Array.isArray(w)) w.forEach((x) => texte(x, out))
  else if (typeof w === 'object') for (const [k, v] of Object.entries(w)) { if (typeof v === 'number') out.push(k); else texte(v, out) }
  return out
}

/** Treffer-Prüfung für einen Eintrag: { rang } oder null. titel zählt mehr als der Rest. */
function bewerte(woerter, titel, rest) {
  if (!woerter.length) return null
  const t = norm(titel), alles = t + ' ' + norm(rest)
  if (!woerter.every((w) => alles.includes(w))) return null
  return { rang: t.startsWith(woerter[0]) ? 0 : woerter.every((w) => t.includes(w)) ? 1 : 2 }
}

/** Ausschnitt um das erste gefundene Wort, für die zweite Zeile. */
export function ausschnitt(text, woerter, laenge = 70) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const n = norm(s)
  const pos = Math.min(...woerter.map((w) => n.indexOf(w)).filter((i) => i >= 0), Infinity)
  if (!isFinite(pos) || s.length <= laenge) return s.length <= laenge ? s : s.slice(0, laenge - 1) + '…'
  const von = Math.max(0, pos - 20)
  return (von > 0 ? '…' : '') + s.slice(von, von + laenge).trim() + (von + laenge < s.length ? '…' : '')
}

/**
 * Suchen. Ergebnis: Gruppen in fester Reihenfolge, nur nicht-leere.
 * @param begriff  Eingabe im Suchfeld
 * @param d  { journal, wanderungen, buchungen, notizen, reisen, etappen (etappenMitDatum), start,
 *             arten (tierwelt ARTEN), artVon, packVorlage, pack (Store), vorbVorlage, vorb (Store),
 *             dokumente, notizTyp, katInfo, texte: { … Überschriften } }
 * @returns [{ id, titel, icon, treffer: [{ id, titel, unter, icon, ziel, rang, datum }] }]
 */
export function gesamtsuche(begriff, d = {}) {
  const roh = String(begriff || '').trim()
  if (roh.length < 2) return []
  const datum = datumAus(roh, { start: d.start })
  const woerter = datum ? [] : norm(roh).split(/\s+/).filter(Boolean)
  const T = d.texte || {}
  const gruppen = []
  const dazu = (id, titel, icon, liste) => {
    const treffer = liste.filter(Boolean).sort((a, b) => a.rang - b.rang || String(a.datum || '').localeCompare(String(b.datum || '')) || String(a.titel).localeCompare(String(b.titel)))
    if (treffer.length) gruppen.push({ id, titel, icon, treffer })
  }
  const pruefe = (titel, rest, datumFeld) => (datum ? (passtDatum(datumFeld, datum) ? { rang: 0 } : null) : bewerte(woerter, titel, rest))
  const art = (s) => (d.artVon ? d.artVon(s) : { name: s?.name || s?.art || '', emoji: '🐾' })

  // Logbuch-Tage: Ort, Text, alle ausgefüllten Module, Sichtungen
  dazu('tage', T.tage, '📓', (d.journal || []).filter((e) => e?.datum).map((e) => {
    const sicht = (e.sichtungen || []).map((s) => art(s).name)
    const rest = [e.text, ...texte(e.felder), ...sicht].join(' ')
    const r = pruefe(e.ort || '', rest, e.datum)
    if (!r) return null
    const quelle = [e.text, ...texte(e.felder), ...sicht].find((x) => woerter.some((w) => norm(x).includes(w))) || e.text || ''
    return { id: 'tag:' + e.id, titel: mitWochentag(e.datum) + (e.ort ? ' · ' + e.ort : ''), unter: ausschnitt(quelle, woerter), icon: '📓', ziel: 'logbuch/tag/' + e.datum, datum: e.datum, ...r }
  }))

  // Tiere: Arten aus dem Katalog und eigene Sichtungen, mit Zahl und Tagen
  if (!datum) {
    const gesehen = new Map()
    for (const e of d.journal || []) for (const s of e?.sichtungen || []) {
      const a = art(s)
      const g = gesehen.get(a.id) || { a, anzahl: 0, tage: new Set() }
      g.anzahl += Number(s.anzahl) || 1
      if (e.datum) g.tage.add(e.datum)
      gesehen.set(a.id, g)
    }
    const alle = new Map([...(d.arten || []).map((a) => [a.id, { a, anzahl: 0, tage: new Set() }]), ...gesehen])
    dazu('tiere', T.tiere, '🦘', [...alle.values()].map(({ a, anzahl, tage }) => {
      const r = bewerte(woerter, a.name, a.hinweis || '')
      if (!r) return null
      return { id: 'tier:' + a.id, titel: `${a.emoji || '🐾'} ${a.name}`, unter: anzahl ? (T.gesehen || ((n, t) => `${n}× gesehen an ${t} Tagen`))(anzahl, tage.size) : T.nochNicht || '', icon: a.emoji || '🐾', ziel: 'logbuch/tiere', ...r, rang: r.rang + (anzahl ? 0 : 0.5) }
    }))
  }

  dazu('wanderungen', T.wanderungen, '🥾', (d.wanderungen || []).map((w) => {
    const r = pruefe(w.name || '', [w.gebiet, w.beschreibung, w.notiz].join(' '), w.datum)
    if (!r) return null
    return { id: 'wand:' + w.id, titel: w.name, unter: [w.datum ? mitWochentag(w.datum) : '', w.gebiet, w.km ? w.km + ' km' : ''].filter(Boolean).join(' · '), icon: '🥾', ziel: 'plan/wanderungen/' + w.id, datum: w.datum, ...r }
  }))

  // Buchungen: Titel, Zusatz, Art, Buchungsnummer, Beleg-Namen; persönliche Dokumente dazu
  const kat = (k) => (d.katInfo ? d.katInfo(k) : { icon: '📌', label: '' })
  dazu('buchungen', T.buchungen, '🧾', [
    ...(d.buchungen?.events || []).filter((b) => b && !b.platzhalter).map((b) => {
      const r = pruefe(b.titel || '', [b.sub, kat(b.kat).label, b.ref, ...(b.docs || []).map((x) => x.label)].join(' '), b.datum)
      if (!r) return null
      return { id: 'bu:' + b.id, titel: `${b.emoji || kat(b.kat).icon} ${b.titel}`, unter: [b.datum ? mitWochentag(b.datum) : '', b.sub].filter(Boolean).join(' · '), icon: b.emoji || kat(b.kat).icon, ziel: b.datum ? 'logbuch/tag/' + b.datum : 'plan/kalender', datum: b.datum, ...r }
    }),
    ...(datum ? [] : (d.buchungen?.persoenlich || []).map((x) => {
      const r = bewerte(woerter, x.label || '', '')
      return r ? { id: 'pd:' + x.id, titel: '🪪 ' + x.label, unter: T.eigeneDokumente || '', icon: '🪪', ziel: 'mehr/vorbereitung', ...r } : null
    })),
  ])

  // Etappen und Routen: Name und Stopps; ein Datum trifft die Etappe, in die es fällt
  const zeitraum = new Map((d.etappen || []).map((e) => [e.reise.id, e]))
  dazu('reisen', T.reisen, '🧭', (d.reisen || []).map((x) => {
    const stopps = (x.stops || []).map((s) => s.name).filter(Boolean)
    const z = zeitraum.get(x.id)
    let r
    if (datum) r = z && (() => { for (let i = 0; i < z.tage; i++) if (passtDatum(plusTage(z.von, i), datum)) return { rang: 0 } })()
    else r = bewerte(woerter, x.name || '', stopps.join(' '))
    if (!r) return null
    const istEtappe = x.typ === 'etappe'
    return { id: 'reise:' + x.id, titel: x.name, unter: [z ? bereich(z.von, z.bis) : '', stopps.slice(0, 4).join(' → ')].filter(Boolean).join(' · '), icon: istEtappe ? '🧭' : '🛣️', ziel: (istEtappe ? 'plan/etappe/' : 'plan/route/') + x.id, datum: z?.von, ...r }
  }))

  dazu('notizen', T.notizen, '🗒️', (d.notizen || []).map((n) => {
    const tag = (n.tsLokal || n.ts || '').slice(0, 10)
    const r = pruefe(n.text || '', '', tag)
    if (!r) return null
    const typ = d.notizTyp?.[n.typ]
    return { id: 'notiz:' + n.id, titel: ausschnitt(n.text, woerter, 80), unter: [typ?.label, tag ? mitWochentag(tag) : '', n.erledigt ? '✓' : ''].filter(Boolean).join(' · '), icon: typ?.icon || '🗒️', ziel: 'logbuch/notizen', datum: tag, ...r }
  }))

  if (!datum) {
    const haken = (st, id) => (st?.checked?.[id] ? ' ✓' : '')
    dazu('packliste', T.packliste, '🎒', [
      ...(d.packVorlage || []).flatMap((k) => k.items.map((it) => ({ ...it, gruppe: k.titel }))),
      ...(d.pack?.custom || []).map((c) => ({ ...c, gruppe: (d.packVorlage || []).find((k) => k.id === c.kat)?.titel || '' })),
    ].map((it) => {
      const r = bewerte(woerter, it.text || '', it.gruppe || '')
      return r ? { id: 'pack:' + it.id, titel: it.text + haken(d.pack, it.id), unter: it.gruppe, icon: '🎒', ziel: 'mehr/packliste', ...r } : null
    }))
    dazu('vorbereitung', T.vorbereitung, '🧳', [
      ...[...(d.vorbVorlage || []).flatMap((g) => g.items.map((it) => ({ ...it, gruppe: g.gruppe }))), ...(d.vorb?.custom || [])].map((it) => {
        const r = bewerte(woerter, it.text || '', it.gruppe || '')
        return r ? { id: 'vorb:' + it.id, titel: it.text + haken(d.vorb, it.id), unter: it.gruppe || '', icon: '✅', ziel: 'mehr/vorbereitung', ...r } : null
      }),
      ...(d.dokumente || []).map((x) => {
        const r = bewerte(woerter, x.typ || '', [x.nummer, x.notiz].join(' '))
        return r ? { id: 'dok:' + x.id, titel: '🪪 ' + (x.typ || T.dokument || ''), unter: [x.gueltigBis ? (T.gueltigBis || '') + ' ' + mitWochentag(x.gueltigBis) : '', x.notiz].filter(Boolean).join(' · '), icon: '🪪', ziel: 'mehr/vorbereitung', ...r } : null
      }),
    ])
  }
  return gruppen
}
