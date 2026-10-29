// Reiseplan V4: Etappen und Routen.
//
// ETAPPE = ein Zeitabschnitt im Kalender mit festem Datum (von + Tage).
//          Beispiel: „Melbourne" 30.11.–3.12. Kommt meist aus dem Reisekalender.
// ROUTE  = eine Strecke mit Stopps INNERHALB einer Etappe.
//          Beispiel: „Nord 3" Perth → … → Marble Bar im Roadtrip.
//
// Bis V3 war beides eine „Reise", und der Gesamtplan reihte alles hintereinander.
// Eine Route im Plan verlängerte deshalb die Reise, statt in ihre Etappe zu fallen.
//
// Gespeichert wird weiter im Topf `reisen` — nur mit zusätzlichen Feldern:
//   typ: 'etappe' | 'route'   von: 'YYYY-MM-DD' (Etappe)   etappeId (Route)
// So kann V3 einen V4-Stand weiter lesen, und ein Backup bleibt zwischen beiden
// austauschbar. Reine Funktionen ohne Stores: jede Regel einzeln prüfbar.

// ---------- Datum als Text (keine Zeitzonen-Fallen) ----------
const tag = (s) => new Date(s + 'T12:00:00')
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function plusTage(s, n) {
  const d = tag(s); d.setDate(d.getDate() + n)
  return ymd(d)
}
export function tageZwischen(a, b) {
  return Math.round((tag(b) - tag(a)) / 86400000)
}
export const gueltigesDatum = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(tag(s))
/** Basic: Startdatum, solange noch keins gewählt ist: der Erste des nächsten Monats. */
export function vorgabeStart(heute = new Date()) { return ymd(new Date(heute.getFullYear(), heute.getMonth() + 1, 1)) }

// ---------- Was ist was ----------
/** Route = ausdrücklich so markiert, oder (Altbestand) eigene Reise außerhalb des Plans. */
export function istRoute(r) {
  if (!r) return false
  if (r.typ === 'route') return true
  if (r.typ === 'etappe') return false
  return r.quelle !== 'reisekalender' && r.imGesamtplan === false
}
export const istEtappe = (r) => !!r && !istRoute(r)
export const tageVon = (r) => Math.max(1, Math.round(Number(r?.tage) || 1))

/**
 * Etappen mit Datum, sortiert. Etappen mit `von` stehen fest; Altbestand ohne `von`
 * reiht sich wie in V3 hinter die vorige ein (Startdatum = gesamtStart).
 * @returns [{ reise, von, bis, tage }]  von/bis als 'YYYY-MM-DD'
 */
export function etappenMitDatum(reisen, gesamtStart = vorgabeStart()) {
  const plan = (reisen || []).filter((r) => istEtappe(r) && r.imGesamtplan !== false)
  let cursor = gueltigesDatum(gesamtStart) ? gesamtStart : vorgabeStart()
  const out = []
  for (const r of plan) {
    const tage = tageVon(r)
    const von = gueltigesDatum(r.von) ? r.von : (gueltigesDatum(r.kalenderVon) ? r.kalenderVon : cursor)
    const bis = plusTage(von, tage - 1)
    out.push({ reise: r, von, bis, tage })
    const naechster = plusTage(bis, 1)
    if (naechster > cursor) cursor = naechster
  }
  return out.sort((a, b) => a.von.localeCompare(b.von) || a.bis.localeCompare(b.bis))
}

/** Überblick: Start, Ende, Dauer (echte Spanne), Lücken und Überschneidungen. */
export function planUeberblick(eintraege) {
  if (!eintraege.length) return { start: null, ende: null, tage: 0, luecken: [] }
  const start = eintraege[0].von
  let ende = eintraege[0].bis
  const luecken = []
  for (let i = 1; i < eintraege.length; i++) {
    const vorher = eintraege[i - 1], e = eintraege[i]
    const abstand = tageZwischen(vorher.bis, e.von) - 1   // >0 = freie Tage, <0 = Überschneidung
    if (abstand !== 0) luecken.push({ nachId: vorher.reise.id, vorId: e.reise.id, tage: abstand })
    if (e.bis > ende) ende = e.bis
  }
  return { start, ende, tage: tageZwischen(start, ende) + 1, luecken }
}

/** Die Etappe, in die ein Datum fällt (bei Überschneidung die später beginnende). */
export function etappeAm(eintraege, datum) {
  if (!gueltigesDatum(datum)) return null
  let treffer = null
  for (const e of eintraege) if (datum >= e.von && datum <= e.bis) treffer = e
  return treffer
}

export const routenDerEtappe = (reisen, etappeId) => (reisen || []).filter((r) => istRoute(r) && r.etappeId === etappeId)

// ---------- Geografie ----------
function km(a, b) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const mitKoord = (stops) => (stops || []).filter((s) => s && s.lat != null && s.lon != null)

/**
 * An welcher Stelle passt ein neuer Stopp am besten? Kleinster Umweg — das Ende der
 * Liste zählt als Möglichkeit mit (Kosten: Strecke vom letzten Stopp). So landet ein
 * Ort, der hinter dem bisherigen Ziel liegt, am Ende; einer dazwischen dazwischen.
 * @returns Index, an dem eingefügt wird (0 … stops.length)
 */
export function besteEinfuegeStelle(stops, punkt) {
  const l = stops || []
  if (!l.length || punkt?.lat == null) return l.length
  let best = l.length, bestKosten = Infinity
  // Ende: vom letzten Stopp mit Koordinaten
  const letzter = [...l].reverse().find((s) => s.lat != null)
  if (letzter) bestKosten = km(letzter, punkt)
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i]
    if (a.lat == null || b.lat == null) continue
    const umweg = km(a, punkt) + km(punkt, b) - km(a, b)
    if (umweg < bestKosten - 0.01) { bestKosten = umweg; best = i }
  }
  return best
}

/** Wie weit liegt ein Punkt von einer Route weg? (Stopps, sonst berechnete Linie) */
export function abstandZurRoute(r, punkt) {
  if (punkt?.lat == null) return Infinity
  const geo = r?.route?.geometry
  let min = Infinity
  if (Array.isArray(geo) && geo.length > 1) {
    const schritt = Math.max(1, Math.floor(geo.length / 400))
    for (let i = 0; i < geo.length; i += schritt) {
      const d = km({ lat: geo[i][1], lon: geo[i][0] }, punkt)
      if (d < min) min = d
    }
  }
  for (const s of mitKoord(r?.stops)) { const d = km(s, punkt); if (d < min) min = d }
  return min
}

/**
 * Zu welcher Etappe gehört eine Route ohne Zuordnung? Kandidaten sind Etappen mit einem
 * Stopp ≤ 100 km vom Start oder Ziel der Route. Gefahrene Etappen vor geflogenen, dann
 * die längste. Eindeutig nur, wenn es überhaupt einen Kandidaten gibt.
 */
export function vermuteEtappe(route, etappen) {
  const st = mitKoord(route?.stops)
  if (!st.length) return null
  const enden = [st[0], st[st.length - 1]]
  const kand = []
  for (const e of etappen) {
    const r = e.reise || e
    const nah = mitKoord(r.stops).some((s) => enden.some((p) => km(s, p) <= 100))
    if (nah) kand.push(r)
  }
  if (!kand.length) return null
  kand.sort((a, b) => ((a.art === 'flug') - (b.art === 'flug')) || (tageVon(b) - tageVon(a)))
  return kand[0]
}

// ---------- Umbau des Altbestands (V3 → V4) ----------
/**
 * Ergänzt typ, von und etappeId. Ändert KEIN `geaendert`: der Umbau ist keine
 * Bearbeitung. Sonst gälte jede Reise als frisch bearbeitet und gewönne beim
 * nächsten Abgleich gegen echte Änderungen vom anderen Gerät.
 * Die Termine bleiben genau die, die V3 angezeigt hat.
 */
export function planMigrieren(reisen, gesamtStart) {
  const liste = reisen || []
  let geaendert = 0
  // Termine so, wie V3 sie gerechnet hat (Reihenfolge × Tage ab Startdatum,
  // importierte Etappen mit ihren Kalenderdaten).
  const v3 = etappenMitDatum(liste.map((r) => (r.typ ? r : { ...r })), gesamtStart)
  const vonV3 = new Map(v3.map((e) => [e.reise.id, e.von]))
  const frischTypisiert = new Set()
  const zwischen = liste.map((r) => {
    if (!r || typeof r !== 'object') return r
    const n = { ...r }
    let anders = false
    if (n.typ !== 'etappe' && n.typ !== 'route') { n.typ = istRoute(r) ? 'route' : 'etappe'; anders = true; frischTypisiert.add(n.id) }
    if (n.typ === 'etappe' && !gueltigesDatum(n.von)) {
      const v = gueltigesDatum(n.kalenderVon) ? n.kalenderVon : vonV3.get(n.id)
      if (v) { n.von = v; anders = true }
    }
    if (n.typ === 'route' && n.imGesamtplan !== false) { n.imGesamtplan = false; anders = true }
    if (anders) geaendert++
    return n
  })
  const etappen = zwischen.filter((r) => r && r.typ === 'etappe')
  const ergebnis = zwischen.map((r) => {
    // Nur beim ersten Umbau raten. Eine Route, die man selbst von ihrer Etappe
    // gelöst hat, soll nicht beim nächsten Laden wieder angeheftet werden.
    if (!r || r.typ !== 'route' || r.etappeId || !frischTypisiert.has(r.id)) return r
    const e = vermuteEtappe(r, etappen)
    if (!e) return r
    geaendert++
    return { ...r, etappeId: e.id, etappeVermutet: true }
  })
  return { reisen: ergebnis, geaendert }
}

/**
 * Nach einem erneuten Kalender-Import bekommen die importierten Etappen neue IDs.
 * Routen, Logbuchtage und Wanderungen, die auf eine alte Etappe zeigten, sollen
 * auf die neue zeigen: gleicher Name, sonst die mit der größten Überschneidung.
 * @returns Map alteId → neueId
 */
export function zuordnungNachImport(alte, neue) {
  const map = new Map()
  const nZeit = (r) => ({ von: r.von || r.kalenderVon, bis: r.kalenderBis || (r.von || r.kalenderVon ? plusTage(r.von || r.kalenderVon, tageVon(r) - 1) : null) })
  for (const a of alte) {
    let ziel = neue.find((n) => n.name === a.name)
    if (!ziel) {
      const az = nZeit(a)
      let best = 0
      for (const n of neue) {
        const nz = nZeit(n)
        if (!az.von || !nz.von) continue
        const von = az.von > nz.von ? az.von : nz.von
        const bis = az.bis < nz.bis ? az.bis : nz.bis
        const ueber = bis >= von ? tageZwischen(von, bis) + 1 : 0
        if (ueber > best) { best = ueber; ziel = n }
      }
    }
    if (ziel) map.set(a.id, ziel.id)
  }
  return map
}

// ---------- Logbuch: alles chronologisch ----------
/**
 * Das Rückgrat des Logbuchs: jede Etappe mit ihren Tagen, an jedem Tag alles,
 * was dazu gehört. Einträge außerhalb der Reise stehen in „vorher" und „nachher".
 *
 * @param o.eintraege   etappenMitDatum(...)
 * @param o.journal     Logbuchtage
 * @param o.wanderungen Wanderungen (nur mit Datum)
 * @param o.buchungen   Termine aus dem Reisekalender [{datum, …}]
 * @param o.ortTage     [{datum, ortId, ortName, text, fotos}] alte Orts-Tagebucheinträge
 * @param o.notizen     [{datum, …}] Notizen mit Datum
 * @param o.fotos       [{datum, …}] Fotos fürs Tagebuch, die nur auf dem Gerät liegen (tagebuch-fotos.js)
 * @param o.heute       'YYYY-MM-DD'
 */
export function chronik({ eintraege = [], journal = [], wanderungen = [], buchungen = [], ortTage = [], notizen = [], fotos = [], heute = null } = {}) {
  const proTag = new Map()
  const tagObj = (d) => {
    if (!proTag.has(d)) proTag.set(d, { datum: d, journal: [], wanderungen: [], buchungen: [], ortTage: [], notizen: [], fotos: [] })
    return proTag.get(d)
  }
  for (const e of journal) if (gueltigesDatum(e?.datum)) tagObj(e.datum).journal.push(e)
  for (const w of wanderungen) if (gueltigesDatum(w?.datum)) tagObj(w.datum).wanderungen.push(w)
  for (const b of buchungen) if (gueltigesDatum(b?.datum) && !b.platzhalter) tagObj(b.datum).buchungen.push(b)
  for (const t of ortTage) if (gueltigesDatum(t?.datum)) tagObj(t.datum).ortTage.push(t)
  for (const n of notizen) if (gueltigesDatum(n?.datum)) tagObj(n.datum).notizen.push(n)
  for (const f of fotos) if (gueltigesDatum(f?.datum)) tagObj(f.datum).fotos.push(f)
  for (const t of proTag.values()) t.wanderungen.sort((a, b) => (a.zeit || '12:00').localeCompare(b.zeit || '12:00'))

  const leer = (d) => ({ datum: d, journal: [], wanderungen: [], buchungen: [], ortTage: [], notizen: [], fotos: [] })
  const vergeben = new Set()
  const abschnitte = []
  eintraege.forEach((e, i) => {
    const tage = []
    for (let n = 0; n < e.tage; n++) {
      const d = plusTage(e.von, n)
      // Überschneiden sich Etappen, gehört der Tag der später beginnenden — einmal.
      const naechste = eintraege[i + 1]
      if (naechste && d >= naechste.von) break
      vergeben.add(d)
      tage.push({ ...(proTag.get(d) || leer(d)), nr: tageZwischen(eintraege[0].von, d) + 1, inEtappe: n + 1 })
    }
    abschnitte.push({ etappe: e, tage })
  })
  const rest = [...proTag.values()].filter((t) => !vergeben.has(t.datum)).sort((a, b) => a.datum.localeCompare(b.datum))
  const start = eintraege[0]?.von, ende = eintraege.length ? eintraege.reduce((m, e) => (e.bis > m ? e.bis : m), eintraege[0].bis) : null
  const vorher = rest.filter((t) => !start || t.datum < start)
  const nachher = rest.filter((t) => start && t.datum > ende)
  const ausserhalb = rest.filter((t) => start && t.datum >= start && t.datum <= ende)   // Lücken im Plan
  let aktuell = null
  if (heute) aktuell = abschnitte.find((a) => heute >= a.etappe.von && heute <= a.etappe.bis)?.etappe?.reise?.id || null
  return { abschnitte, vorher, nachher, ausserhalb, aktuell }
}

/** Hat ein Tag irgendeinen Inhalt? */
export const tagHatInhalt = (t) => !!(t && (t.journal.length || t.wanderungen.length || t.buchungen.length || t.ortTage.length || t.notizen.length))

/** Wo steht man heute? vor / während / nach der Reise, mit Tag-Nummer. */
export function reiseStatus(eintraege, heute) {
  const u = planUeberblick(eintraege)
  if (!u.start) return { phase: 'leer' }
  if (heute < u.start) return { phase: 'vorher', nochTage: tageZwischen(heute, u.start), ...u }
  if (heute > u.ende) return { phase: 'nachher', seitTagen: tageZwischen(u.ende, heute), ...u }
  const e = etappeAm(eintraege, heute)
  return { phase: 'unterwegs', tagNr: tageZwischen(u.start, heute) + 1, etappe: e, tagInEtappe: e ? tageZwischen(e.von, heute) + 1 : null, ...u }
}
