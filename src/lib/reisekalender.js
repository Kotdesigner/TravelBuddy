// Import aus der eigenen Kalender-App („reisekalender", v1).
//
// Diese Datei ist die einzige Stelle, die das fremde Format kennt. Alles dahinter
// arbeitet mit den normalisierten Feldern unten. Kommt später eine v2, ändert sich
// nur `leseReisekalender()`.
//
// Grundsatz: der Reisekalender bleibt die QUELLE für Buchungen. TravelBuddy liest,
// zeigt und leitet daraus ein Reise-Gerüst ab — schreibt aber nie zurück. Bei
// Änderungen wird die Datei einfach neu importiert; ein erneuter Import ersetzt
// genau das, was beim letzten Mal von hier kam, und lässt eigene Daten in Ruhe.
import { t, jeSprache } from './i18n.js'

export const KAT = jeSprache(() => ({
  train:   { icon: '🚆', label: t('Bahn') },
  flight:  { icon: '✈️', label: t('Flug') },
  hotel:   { icon: '🏨', label: t('Unterkunft') },
  car:     { icon: '🚗', label: t('Mietwagen') },
  camper:  { icon: '🚐', label: t('Camper') },
  boat:    { icon: '⛴️', label: t('Boot') },
  shuttle: { icon: '🚌', label: t('Transfer') },
  tour: { icon: '🎟️', label: t('Tour') },
  stay:    { icon: '🌴', label: t('Aufenthalt') },
  city:    { icon: '🏙️', label: t('Stadt') },
}))
export const katInfo = (k) => KAT[k] || { icon: '📌', label: k || t('Termin') }

/** Erkennt eine Datei aus der Kalender-App — bewusst streng, damit ein Backup nicht verwechselt wird. */
export function istReisekalender(p) {
  return !!p && p.app === 'reisekalender' && Array.isArray(p.events)
}

const BEWEGUNG = ['flight', 'train', 'boat', 'shuttle']

// ---------- Datums-Hilfen (reine Strings, keine Zeitzonen-Fallen) ----------
const tag = (s) => new Date(s + 'T12:00')
export function tageZwischen(a, b) {
  return Math.round((tag(b) - tag(a)) / 86400000)
}
export function plusTage(s, n) {
  const d = tag(s); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fremdformat → unsere Felder. Nur Lesen, nichts wird verändert. */
export function leseReisekalender(p) {
  const events = p.events
    .filter((e) => e && typeof e.date === 'string')
    .map((e) => ({
      id: 'rk-' + (e.id || Math.random().toString(36).slice(2)),
      datum: e.date,
      kat: e.cat || '',
      titel: (e.title || '').trim(),
      sub: (e.sub || '').trim(),
      ref: (e.ref || '').trim(),
      emoji: e.emoji || '',
      // „filler" sind die grauen Roadtrip-Platzhaltertage — keine echten Termine.
      platzhalter: !!e.filler,
      special: e.special || '',
      flugNr: e.live?.mode === 'flight' ? (e.live.flightNo || '') : '',
      docs: Array.isArray(e.docs)
        ? e.docs.filter((d) => d && d.file).map((d) => ({ label: d.label || t('Dokument'), datei: d.file, art: d.kind || 'doc' }))
        : [],
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum))

  return {
    stand: p.ts ? new Date(p.ts).toISOString() : null,
    von: events.length ? events[0].datum : '',
    bis: events.length ? events[events.length - 1].datum : '',
    events,
    persoenlich: Array.isArray(p.priv)
      ? p.priv.filter((d) => d && d.file).map((d) => ({ id: 'rkp-' + (d.id || d.label), label: d.label || t('Dokument'), datei: d.file }))
      : [],
  }
}

// ---------- Belege ----------
//
// Die PDFs liegen im Projekt unter `_Documente/` und werden beim Bauen nach
// `dist/dokumente/` kopiert (siehe vite.config.js). Der Kalender speichert den
// Pfad relativ zu diesem Ordner.
//
// Zwei Fallen stecken in der Adresse:
//   1. macOS legt Dateinamen in NFD ab, die Kalender-Datei verweist in NFC.
//      Der Build normalisiert auf NFC — hier muss dasselbe passieren.
//   2. Die Namen enthalten Leerzeichen, „&", Klammern und Umlaute. Jedes
//      Pfadstück muss einzeln kodiert werden; encodeURI über den ganzen Pfad
//      würde „&" und „+" stehen lassen.
export const DOK_BASIS = 'dokumente/'
export function dokumentUrl(pfad) {
  if (!pfad) return ''
  return DOK_BASIS + pfad.normalize('NFC').split('/').map(encodeURIComponent).join('/')
}

/**
 * Was hat dieser Build ausgelassen?
 *
 * Liefert NUR die Namen weggelassener Ordner, keine Dateiliste. Eine Liste stand hier
 * frueher und war ein Fehler: die Datei ist oeffentlich abrufbar und wurde damit zum
 * Inhaltsverzeichnis saemtlicher Belege. Fuer die Anzeige genuegt der Ordnername —
 * die App muss nur wissen, wofuer sie keinen Link anbieten darf.
 *
 * Fehlt die Datei (aelterer Build), gilt "alles vorhanden" — dann verhaelt sich die
 * App wie vorher und verspricht nichts, was sie nicht halten kann.
 */
export async function ladeBelegVerzeichnis() {
  try {
    const r = await fetch('belege-verzeichnis.json', { cache: 'no-cache' })
    if (!r.ok) throw new Error(String(r.status))
    const d = await r.json()
    if (!Array.isArray(d.ausgelassen)) throw new Error('Format')
    return { bekannt: true, mitPersoenlichen: !!d.mitPersoenlichen, ausgelassen: d.ausgelassen }
  } catch {
    // Sicher ausfallen: im Zweifel liefert der Build KEINE Belege mit. Andernfalls
    // boete die App Links auf Dateien an, die es nicht gibt — genau das ist passiert,
    // als eine veraltete Steuerdatei aus dem Cache gelesen wurde.
    return { bekannt: false, mitPersoenlichen: false, ausgelassen: ['*'] }
  }
}

/** Liegt dieser Beleg im Build? Geprueft wird der Ordner, nicht eine Dateiliste. */
export function belegDa(verzeichnis, pfad) {
  const weg = verzeichnis?.ausgelassen
  if (!weg?.length || !pfad) return true
  if (weg.includes('*')) return false     // Build ganz ohne Belege
  const p = pfad.normalize('NFC')
  return !weg.some((ordner) => p === ordner || p.startsWith(ordner + '/'))
}

/** Alle Belege einer Kalender-Ablage, ohne Dubletten — für „alle offline sichern". */
export function alleBelege(k, verzeichnis = null) {
  const seen = new Set()
  const out = []
  const merke = (label, datei) => {
    const url = dokumentUrl(datei)
    if (!url || seen.has(url)) return
    seen.add(url); out.push({ label, datei, url })
  }
  for (const e of k?.events || []) for (const d of e.docs) merke(d.label, d.datei)
  for (const d of k?.persoenlich || []) merke(d.label, d.datei)
  // Was nicht im Build liegt, kann auch nicht gesichert werden.
  return verzeichnis ? out.filter((b) => belegDa(verzeichnis, b.datei)) : out
}

/** Kurzfassung für die Rückfrage vor dem Import. */
export function kalenderInfo(k) {
  const echt = k.events.filter((e) => !e.platzhalter)
  return {
    von: k.von, bis: k.bis,
    gesamt: k.events.length,
    termine: echt.length,
    dokumente: k.events.reduce((n, e) => n + e.docs.length, 0),
    persoenlich: k.persoenlich.length,
    buchungsnummern: new Set(k.events.map((e) => e.ref).filter(Boolean)).size,
    tage: k.von && k.bis ? tageZwischen(k.von, k.bis) + 1 : 0,
  }
}

// ---------- Reise-Gerüst ableiten ----------
//
// Ein neuer Abschnitt beginnt bei jedem ORTSWECHSEL — Flug, Bahn, Boot oder Shuttle
// mit „→" im Titel — und bei der Übernahme eines LANGZEIT-Fahrzeugs.
//
// Warum „Langzeit": ein Mietwagen für zwei Tage mitten im Aufenthalt (Europcar in
// Melbourne) ist kein neuer Reiseabschnitt, der Camper für sechseinhalb Wochen sehr
// wohl. Gemessen wird über die Buchungsnummer, die bei Übernahme und Rückgabe
// dieselbe ist. Schwelle: 5 Tage.
const FAHRZEUG = ['car', 'camper']
const RUECKGABE = /rückgabe|ruckgabe|rueckgabe|return|abgabe/i

function fahrzeugSpannen(events) {
  const m = new Map()
  for (const e of events) {
    if (!FAHRZEUG.includes(e.kat) || !e.ref) continue
    const s = m.get(e.ref)
    if (!s) m.set(e.ref, [e.datum, e.datum])
    else { if (e.datum < s[0]) s[0] = e.datum; if (e.datum > s[1]) s[1] = e.datum }
  }
  return m
}

const zielVon = (titel) => {
  const i = titel.indexOf('→')
  return i < 0 ? titel.trim() : titel.slice(i + 1).trim()
}
const orteAusTitel = (titel) => titel.split('→').map((x) => x.trim()).filter(Boolean)

export function baueAbschnitte(events) {
  if (!events.length) return []
  const spannen = fahrzeugSpannen(events)
  const istBewegung = (e) => BEWEGUNG.includes(e.kat) && e.titel.includes('→')
  const istLangzeitFahrzeug = (e) => {
    if (!FAHRZEUG.includes(e.kat) || !e.ref || RUECKGABE.test(e.titel)) return false
    const s = spannen.get(e.ref)
    return !!s && tageZwischen(s[0], s[1]) >= 5 && e.datum === s[0]
  }

  // Grenztage einsammeln (mehrere Wechsel am selben Tag = EIN Abschnittsbeginn).
  const grenzen = []
  for (const e of events) {
    if (!istBewegung(e) && !istLangzeitFahrzeug(e)) continue
    if (!grenzen.includes(e.datum)) grenzen.push(e.datum)
  }
  if (!grenzen.length) return []
  grenzen.sort()

  const letzterTag = events[events.length - 1].datum
  const out = []
  grenzen.forEach((von, i) => {
    const bis = i + 1 < grenzen.length ? plusTage(grenzen[i + 1], -1) : letzterTag
    const drin = events.filter((e) => e.datum >= von && e.datum <= bis)
    const amTag = drin.filter((e) => e.datum === von)

    // Name: Ziel des LETZTEN Wechsels an diesem Tag; beim Fahrzeug das Fahrzeug selbst.
    const wechsel = amTag.filter(istBewegung)
    const fahrzeug = amTag.find(istLangzeitFahrzeug)
    let name = wechsel.length ? zielVon(wechsel[wechsel.length - 1].titel)
      : fahrzeug ? `Roadtrip (${fahrzeug.titel})`
      : `Abschnitt ab ${von}`

    // Durchgangsstationen umbenennen: Ist das Ziel ein Ort, von dem wir SCHON EINMAL
    // abgereist sind (Fähranleger, Flughafen), dann ist es kein Reiseziel, sondern eine
    // Zwischenstation. Dann zählt, wo an dem Tag eingecheckt wird.
    // Beispiel: „Palm Bay → Shute Harbour" heißt in Wahrheit „Airlie Beach".
    if (wechsel.length) {
      const frueherAbfahrt = events.some((e) => e.datum < von && istBewegung(e) && orteAusTitel(e.titel)[0] === name)
      const einzug = amTag.find((e) => e.kat === 'hotel' && !/check-?out/i.test(e.sub))
      if (frueherAbfahrt && einzug) name = einzug.titel
    }

    // Stopps: alle berührten Orte des Wechsels + Unterkünfte/Aufenthalte im Abschnitt.
    const stops = []
    const merke = (n) => { const t = (n || '').trim(); if (t && !stops.includes(t)) stops.push(t) }
    // Ein Langzeit-Fahrzeug wird dort übernommen, wo man gerade ist — der vorige
    // Abschnitt ist also der Startpunkt. Sonst stünde der Roadtrip ohne Anfang da.
    if (fahrzeug && !wechsel.length && out.length) merke(out[out.length - 1].name)
    for (const e of wechsel) orteAusTitel(e.titel).forEach(merke)
    for (const e of drin) {
      if (e.kat === 'hotel' && !/check-?out/i.test(e.sub)) merke(e.titel)
      if (e.kat === 'stay' || e.kat === 'city') merke(e.titel)
    }

    out.push({
      name, von, bis,
      tage: Math.max(1, tageZwischen(von, bis) + 1),
      // Ein Flugabschnitt wird auf den Karten gestrichelt gezeichnet.
      flug: wechsel.some((e) => e.kat === 'flight'),
      stops,
      buchungen: drin.filter((e) => !e.platzhalter).length,
    })
  })
  return out
}

// ---------- Stopps mit Koordinaten versorgen ----------
//
// Der Kalender kennt nur Namen. Ohne Koordinaten zeichnet die Karte nichts —
// deshalb werden die Namen gegen die eigene Ortssammlung abgeglichen.
const norm = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(hotel|resort|airport|flughafen|budget|property|magnums|adults only|cbd)\b/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

// Verkehrsknoten und Städte, die in einer Sammlung von SEHENSWÜRDIGKEITEN nichts zu
// suchen haben, in einem Reisekalender aber ständig vorkommen. Ohne diese Tabelle
// bliebe die Hälfte der importierten Abschnitte ohne Koordinaten und damit ohne
// Linie auf der Karte. Ungefähre Mittelpunkte — sie sollen eine Route zeichnen,
// nicht navigieren.
const KNOTEN = [
  ['kiel', 54.3233, 10.1228], ['frankfurt', 50.0379, 8.5622], ['hamburg', 53.5511, 9.9937],
  ['doha', 25.2854, 51.5310],
  ['melbourne', -37.8136, 144.9631], ['cairns', -16.9186, 145.7781],
  ['proserpine', -20.4000, 148.5833], ['shute harbour', -20.2833, 148.7833],
  ['airlie beach', -20.2686, 148.7183], ['palm bay', -20.3667, 148.8500],
  ['hamilton island', -20.3500, 148.9500],
  ['perth', -31.9523, 115.8613], ['fremantle', -32.0569, 115.7439],
  ['broome', -17.9614, 122.2359], ['exmouth', -21.9323, 114.1281],
  ['sydney', -33.8688, 151.2093], ['brisbane', -27.4698, 153.0251],
  ['adelaide', -34.9285, 138.6007], ['darwin', -12.4634, 130.8456],
]

export function findeOrt(name, orte) {
  const n = norm(name)
  if (!n) return null
  // Erst die eigene Sammlung — sie ist genauer und trägt Bilder.
  let t = orte.find((o) => o.lat != null && norm(o.name) === n)
  if (t) return t
  const k = KNOTEN.find(([kn]) => kn === n) || KNOTEN.find(([kn]) => n.startsWith(kn) || kn.startsWith(n))
  if (k) return { id: 'knoten-' + k[0], name, lat: k[1], lon: k[2] }
  // Enthalten-Suche nur bei aussagekräftigen Namen — „bay" darf nicht alles treffen.
  if (n.length < 4) return null
  t = orte.find((o) => o.lat != null && (norm(o.name).startsWith(n) || n.startsWith(norm(o.name))))
  if (t) return t
  return orte.find((o) => o.lat != null && norm(o.name).length >= 4 && n.includes(norm(o.name))) || null
}

/** Abschnitte → TravelBuddy-Reisen (Stopps mit Koordinaten, wo auffindbar). */
export function alsReisen(abschnitte, orte = [], farbe = () => '#7a5c8e') {
  return abschnitte.map((a) => ({
    name: a.name,
    art: a.flug ? 'flug' : 'auto',
    flug: a.flug,
    tage: a.tage,
    imGesamtplan: true,
    stops: a.stops.map((n) => {
      const o = findeOrt(n, orte)
      return { name: n, lat: o?.lat ?? null, lon: o?.lon ?? null, img: null }
    }),
    farbe: farbe(),
    // Marker: nur SO markierte Reisen werden bei einem erneuten Import ersetzt.
    quelle: 'reisekalender',
    kalenderVon: a.von,
    kalenderBis: a.bis,
  }))
}
