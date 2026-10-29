// Tierwelt-Album: Sichtungen australischer Tiere (reine Logik, ohne DOM).
//
// Gespeichert am Logbuch-Eintrag des Tages:
//   eintrag.sichtungen = [{ id, art, name, anzahl, ort, lat, lon, notiz, foto, zeit }]
//   art   = id aus ARTEN oder 'eigen' (dann steht der Name in `name`)
//   foto  = verkleinertes Bild (data:-URL) oder fehlt
// Das Datum ist das des Eintrags. Weil das Feld am Eintrag hängt, laufen Backup,
// Import und Zusammenführen ohne Zusatzarbeit mit.
import { LOCALE, t } from './i18n.js'

export const ARTEN = [
  { id: 'kaenguru', name: t('Känguru'), emoji: '🦘' },
  { id: 'wallaby', name: t('Wallaby'), emoji: '🦘' },
  { id: 'quokka', name: t('Quokka'), emoji: '🐹', hinweis: t('Rottnest Island') },
  { id: 'emu', name: t('Emu'), emoji: '🦤' },
  { id: 'dingo', name: t('Dingo'), emoji: '🐕' },
  { id: 'echidna', name: t('Echidna'), emoji: '🦔' },
  { id: 'koala', name: t('Koala'), emoji: '🐨', hinweis: t('nur Ostküste') },
  { id: 'dornteufel', name: t('Dornteufel'), emoji: '🦎', hinweis: t('Wüste, Outback') },
  { id: 'goanna', name: t('Waran (Goanna)'), emoji: '🦎' },
  { id: 'krokodil', name: t('Krokodil'), emoji: '🐊', hinweis: t('Norden') },
  { id: 'kakadu', name: t('Kakadu'), emoji: '🦜' },
  { id: 'galah', name: t('Galah'), emoji: '🦜' },
  { id: 'pelikan', name: t('Pelikan'), emoji: '🐦' },
  { id: 'delfin', name: t('Delfin'), emoji: '🐬' },
  { id: 'dugong', name: t('Dugong'), emoji: '🌊', hinweis: t('Shark Bay') },
  { id: 'walhai', name: t('Walhai'), emoji: '🦈', hinweis: t('Ningaloo') },
  { id: 'buckelwal', name: t('Buckelwal'), emoji: '🐋' },
  { id: 'manta', name: t('Mantarochen'), emoji: '🐟', hinweis: t('Coral Bay') },
  { id: 'schildkroete', name: t('Meeresschildkröte'), emoji: '🐢' },
  { id: 'seeloewe', name: t('Seelöwe'), emoji: '🦭' },
]
export const ART = Object.fromEntries(ARTEN.map((a) => [a.id, a]))

// Schlagworte aus „Lebend gesehen“ (Modul Straßenrand), die zu einer Art im Album passen.
export const AUS_STRASSENRAND = {
  '🦘 Känguru': 'kaenguru', '🦤 Emu': 'emu', '🐊 Krokodil': 'krokodil',
  '🦎 Goanna': 'goanna', '🦜 Kakadu': 'kakadu', '🐕 Dingo': 'dingo',
}

const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ')

/** Name und Emoji einer Sichtung, auch für eigene Arten. */
export function artVon(s) {
  if (s && ART[s.art]) return ART[s.art]
  const name = normName(s?.name) || t('Unbekanntes Tier')
  return { id: 'eigen:' + name.toLowerCase(), name, emoji: '🐾', eigen: true }
}

let zaehler = 0
export function neueSichtung(vorlage = {}) {
  const art = ART[vorlage.art] ? vorlage.art : 'eigen'
  const s = {
    id: vorlage.id || 's' + Date.now().toString(36) + (zaehler++).toString(36) + Math.random().toString(36).slice(2, 5),
    art,
    anzahl: Math.max(1, Math.round(Number(vorlage.anzahl) || 1)),
  }
  if (art === 'eigen') s.name = normName(vorlage.name)
  for (const k of ['ort', 'notiz', 'foto', 'zeit']) if (vorlage[k]) s[k] = vorlage[k]
  if (vorlage.lat != null && vorlage.lon != null && isFinite(vorlage.lat) && isFinite(vorlage.lon)) { s.lat = Number(vorlage.lat); s.lon = Number(vorlage.lon) }
  if (vorlage.ortId) s.ortId = vorlage.ortId
  return s
}

/** Eine Sichtung gilt nur mit Art (eigene Art braucht einen Namen). */
export const sichtungGueltig = (s) => !!s && (!!ART[s.art] || (s.art === 'eigen' && !!normName(s.name)))

export const mitSichtung = (liste, s) => [...(Array.isArray(liste) ? liste : []), s]
export const ohneSichtung = (liste, id) => (Array.isArray(liste) ? liste : []).filter((s) => s && s.id !== id)

/**
 * Das Album aus allen Logbuch-Einträgen.
 * @returns { arten:[{ …art, gesehen, sichtungen:[…], erste, tiere }], eigene:[…], gesehen, gesamt, sichtungen }
 */
export function album(journal = []) {
  const je = new Map()
  const eigene = new Map()
  let anzahlSichtungen = 0
  const dazu = (karte, schluessel, basis, eintrag) => {
    if (!karte.has(schluessel)) karte.set(schluessel, { ...basis, sichtungen: [] })
    karte.get(schluessel).sichtungen.push(eintrag)
  }
  for (const e of journal || []) {
    if (!e) continue
    for (const s of Array.isArray(e.sichtungen) ? e.sichtungen : []) {
      if (!sichtungGueltig(s)) continue
      anzahlSichtungen++
      const eintrag = { ...s, datum: e.datum || null, eintragId: e.id, ort: s.ort || e.ort || '' }
      if (ART[s.art]) dazu(je, s.art, ART[s.art], eintrag)
      else { const a = artVon(s); dazu(eigene, a.id, a, eintrag) }
    }
    // „Lebend gesehen“ zählt auch, nur ohne eigene Angaben
    for (const t of e.felder?.roadside_sightings || []) {
      const id = AUS_STRASSENRAND[t]
      if (id) dazu(je, id, ART[id], { id: 'r-' + e.id + '-' + id, art: id, anzahl: 1, datum: e.datum || null, eintragId: e.id, ort: e.ort || '', strassenrand: true })
    }
  }
  const sortiere = (l) => l.sort((a, b) => (a.datum || '9').localeCompare(b.datum || '9'))
  const ausbauen = (x) => {
    const s = sortiere(x.sichtungen)
    const echte = s.filter((y) => !y.strassenrand)
    return { ...x, gesehen: true, sichtungen: s, erste: s[0], tiere: echte.reduce((n, y) => n + (y.anzahl || 1), 0), anzahl: s.length }
  }
  const arten = ARTEN.map((a) => (je.has(a.id) ? ausbauen(je.get(a.id)) : { ...a, gesehen: false, sichtungen: [], erste: null, tiere: 0, anzahl: 0 }))
  const eig = [...eigene.values()].map(ausbauen).sort((a, b) => a.name.localeCompare(b.name, LOCALE))
  return {
    arten, eigene: eig,
    gesehen: arten.filter((a) => a.gesehen).length,
    gesamt: ARTEN.length,
    artenGesamt: arten.filter((a) => a.gesehen).length + eig.length,
    sichtungen: anzahlSichtungen,
  }
}
