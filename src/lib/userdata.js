// Nutzerdaten-Schicht: offline-first in IndexedDB.
import { writable, get } from 'svelte/store'
import { baueAbschnitte, alsReisen } from './reisekalender.js'
import { fuehreZusammen, URZEIT as URZEIT_M } from './zusammenfuehren.js'
import { planMigrieren, etappenMitDatum, planUeberblick, istRoute, istEtappe, besteEinfuegeStelle, zuordnungNachImport, plusTage, vorgabeStart } from './plan.js'
import { t } from './i18n.js'
import { haengeBelegeAn, nimmBelegAb, eigeneBelegeUebernehmen } from './belege.js'
import { musikFuerBackup, musikAusBackup } from './musik/speicher.js'

const DB_NAME = 'wa-plan'
const STORE = 'kv'
const KEY = 'userdata-v1'
const KEY_REISEN = 'reisen-v1'
const KEY_ORTE = 'eigene-orte-v1'
const KEY_START = 'gesamt-start-v1'
const KEY_GEFAHR = 'gefahren-cache-v1'
const KEY_JOURNAL = 'journal-v1'
const KEY_QUIZ = 'quiz-v1'
const KEY_PACK = 'packliste-v1'
const KEY_NOTIZEN = 'notizen-v1'
const KEY_WANDER = 'wanderungen-v1'
const KEY_CHECKINS = 'checkins-v1'
// „Mein Urlaub" (Ostküste) — komplett getrennte Datentöpfe.
const KEY_U_REISEN = 'urlaub-reisen-v1'
const KEY_U_ORTE = 'urlaub-orte-v1'
const KEY_U_JOURNAL = 'urlaub-journal-v1'
const KEY_U_START = 'urlaub-start-v1'
const U_START_DEFAULT = vorgabeStart()
const KEY_BUDGET = 'reise-budget-v1'
const KEY_VORB = 'vorbereitung-v1'
const KEY_DOKU = 'dokumente-v1'
const KEY_VORAB = 'vorab-kosten-v1'
const KEY_BUCHUNGEN = 'buchungen-v1'
const KEY_GRAB = 'grabsteine-v1'
const KEY_DAUER = 'reise-tage-v1'      // Basic: Reisedauer in Tagen (Einführung, Plan), 0 = offen
const KEY_SKALAR = 'skalar-stand-v1' // wann Startdatum / Budget zuletzt von Hand geändert wurden
const KEY_ROUTE_ALT = 'eigene-route-v1' // alte Einzel-Route (Migration)
const KEY_ZUSAMMEN = 'vacation-zusammengefuehrt-v1' // Merker: Ost-Töpfe sind übernommen

const START_DEFAULT = vorgabeStart()

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.abs(Date.now() + Math.floor(performance.now() * 1000)).toString(36)
}

/** Notizen/Berichte/Fotos pro Ort. */
export const userData = writable({})
/** Gespeicherte Reisen: [{ id, name, farbe, tage, imGesamtplan, stops: [{name,lat,lon,img}] }] */
export const reisen = writable([])
// Einträge im Altformat ohne `typ` (aus einem alten Backup oder dem Notspeicher) werden
// sofort zu Etappe/Route umgebaut — egal auf welchem Weg sie hereinkommen.
let planUmbauAktiv = false
function planNachziehen() {
  const cur = get(reisen)
  if (!Array.isArray(cur) || !cur.some((r) => r && typeof r === 'object' && !r.typ)) return
  reisen.set(sortiereReisen(planMigrieren(cur, get(gesamtStart)).reisen))
}
reisen.subscribe((rs) => {
  if (planUmbauAktiv && Array.isArray(rs) && rs.some((r) => r && typeof r === 'object' && !r.typ)) queueMicrotask(planNachziehen)
})
/** Selbst angelegte Orte (wie die 88 Vorschläge, aber vom Nutzer). */
export const eigeneOrte = writable([])
/** Startdatum der Gesamtreise (YYYY-MM-DD). */
export const gesamtStart = writable(START_DEFAULT)
/** Zuletzt geladene Gefahrenlage (für Offline-Anzeige): { ortGefahren, warnungen, standort, stand, zeit }. */
export const gefahrenCache = writable(null)
/** Roadtrip-Tagebuch: [{ id, datum, ort, lat, lon, ortId, fotos:[], felder:{} }] */
export const journal = writable([])
/** Quiz-Antworten: { [fragenId]: gewählterIndex } */
export const quizAntworten = writable({})
/** Packliste: { checked: { itemId: { an, ts } } (alt: true), custom: [{id, kat, text}] } — lesen mit istAn() */
export const packliste = writable({ checked: {}, custom: [] })
/** Freie Notizen/Listen: [{ id, typ, text, erledigt, ts }] — typ: notiz|einkaufen|routentips|orga|kontakte */
export const notizen = writable([])
/** Wanderungen: [{ id, name, datum, zeit, gebiet, km, dauerMin, hoehenmeter, schwierigkeit, art, lat, lon, ortId, reiseId, beschreibung, wasser, besteZeit, status, bewertung, fotos:[] }] */
export const wanderungen = writable([])
/** Lebenszeichen-Check-ins der Notfall-Karte: [{ id, ts, tsLokal, lat, lon, text }] */
export const checkins = writable([])
/**
 * Gebuchtes aus der eigenen Kalender-App — Flüge, Hotels, Transfers, Fahrzeuge.
 * NUR GELESEN: die Kalender-App bleibt die Quelle, hier wird nichts bearbeitet.
 * { stand, von, bis, events: [...], persoenlich: [...] } oder null.
 */
export const buchungen = writable(null)

// ---------- „Mein Urlaub" (Ostküste) — eigene Stores ----------
/** Urlaub-Reisen (Ostküste). */
export const urlaubReisen = writable([])
/** Urlaub-Orte (Ostküste). */
export const urlaubOrte = writable([])
/** Alt-Topf Ostküsten-Tagebuch. Wird beim Start einmalig ins Logbuch überführt
 *  (siehe fuehreOstDatenZusammen) und bleibt danach leer. */
export const urlaubJournal = writable([])
/** Startdatum des Ostküsten-Urlaubs (vor dem West-Roadtrip). */
export const urlaubStart = writable(U_START_DEFAULT)
/** Gesamt-Reisebudget in EUR (0 = nicht gesetzt). */
export const reiseBudget = writable(0)
/** Reisedauer in Tagen ab dem Reisebeginn (0 = noch offen). Zeigt den Zeitraum schon vor der ersten Etappe. */
export const reiseTage = writable(0)
/** Änderungsstempel der Einzelwerte: { gesamtStart: iso, reiseBudget: iso } — fürs Zusammenführen. */
export const skalarStand = writable({})
/** Nach dem Start aus dem Notspeicher Gerettetes (für einen Hinweis in der App) oder null. */
export const rettung = writable(null)
/** Vor-Abfahrt-Checkliste: { checked: { itemId: { an, ts } } (alt: true), custom: [{id,text}] } — lesen mit istAn() */
export const vorbereitung = writable({ checked: {}, custom: [] })
/** Reise-Dokumente: [{ id, typ, nummer, gueltigBis, notiz, erledigt }] */
export const dokumente = writable([])
/** Vorab-Ausgaben (vor dem Trip): [{ id, text, kat, betrag, waehrung, datum }] */
export const vorabKosten = writable([])

export const ready = writable(false)

// ---------- Zeitstempel und Grabsteine (Grundlage fürs Zusammenführen) ----------
//
// Ohne Änderungs-Zeitstempel kann ein zusammenführender Import nicht entscheiden,
// welche Fassung eines Eintrags die jüngere ist — er könnte nur ergänzen, nie
// korrigieren. Deshalb trägt ab jetzt JEDER Schreibvorgang `geaendert` (UTC) ein.
//
// Immer toISOString(): die beiden Geräte stehen auf verschiedenen Zeitzonen
// (iPhone Perth, Mac Berlin). Ortszeit wäre als Vergleichsgröße wertlos.
const jetzt = () => new Date().toISOString()

/** Datensatz mit Änderungszeit versehen. */
export const stempeln = (o) => ({ ...o, geaendert: jetzt() })

// Altbestand aus der Zeit vor dieser Änderung bekommt einen definierten Urwert,
// NICHT „jetzt". Sonst gälte jeder alte Eintrag als frisch bearbeitet und
// gewänne beim ersten Abgleich gegen echte Änderungen des anderen Geräts.
export const URZEIT = '2000-01-01T00:00:00.000Z'
const nachruesten = (liste) => Array.isArray(liste)
  ? liste.map((e) => (e && typeof e === 'object' && !e.geaendert
      ? { ...e, geaendert: URZEIT, herkunft: 'vor-merge' } : e))
  : liste

/**
 * Grabsteine: [{ id, ts }] je Topf.
 *
 * Ein reines Entfernen aus der Liste macht Löschen beim Abgleich unmöglich —
 * die Gegenseite kann „gelöscht" nicht von „kenne ich noch nicht" unterscheiden
 * und spielt den Eintrag zurück. Das pendelt dann für immer zwischen den Geräten.
 */
export const grabsteine = writable({})
function grabstein(topf, id) {
  if (!id) return
  grabsteine.update((g) => {
    const alt = (g[topf] || []).filter((x) => x.id !== id)
    return { ...g, [topf]: [...alt, { id, ts: jetzt() }] }
  })
}
/** Grabsteine älter als ein Jahr wegräumen — deutlich länger als die Reise. */
/** Grabstein für Teil-Einträge (z. B. eine Tier-Sichtung), damit das Zusammenführen sie nicht zurückholt. */
export function merkeGeloescht(topf, id) { grabstein(topf, id) }

function grabsteineAufraeumen() {
  const grenze = new Date(Date.now() - 365 * 86400000).toISOString()
  grabsteine.update((g) => Object.fromEntries(
    Object.entries(g).map(([k, v]) => [k, (v || []).filter((x) => x.ts > grenze)]).filter(([, v]) => v.length)))
}

const FARBEN = ['#2f6b4f', '#1a7a8a', '#a8842b', '#7a3b1e', '#7a5c8e', '#c1662f', '#4a4038', '#a83c6e']
let farbZaehler = 0
export function naechsteFarbe() { return FARBEN[farbZaehler++ % FARBEN.length] }

let loaded = false
const timers = {}

export async function initUserData() {
  try {
    const data = await idbGet(KEY)
    if (data && typeof data === 'object') userData.set(data)
    const rs = await idbGet(KEY_REISEN)
    if (Array.isArray(rs)) reisen.set(nachruesten(rs))
    else {
      // Migration: alte Einzel-Route → eine Reise
      const alt = await idbGet(KEY_ROUTE_ALT)
      if (Array.isArray(alt) && alt.length) {
        reisen.set([{ id: uid(), name: t('Meine Route'), farbe: naechsteFarbe(), tage: alt.length, imGesamtplan: true, stops: alt }])
      }
    }
    const eo = await idbGet(KEY_ORTE)
    if (Array.isArray(eo)) eigeneOrte.set(nachruesten(eo))
    const st = await idbGet(KEY_START)
    if (typeof st === 'string' && st) gesamtStart.set(st)
    const gc = await idbGet(KEY_GEFAHR)
    if (gc && typeof gc === 'object') gefahrenCache.set(gc)
    const jn = await idbGet(KEY_JOURNAL)
    if (Array.isArray(jn)) journal.set(nachruesten(jn))
    const qz = await idbGet(KEY_QUIZ)
    if (qz && typeof qz === 'object') quizAntworten.set(qz)
    const pk = await idbGet(KEY_PACK)
    if (pk && typeof pk === 'object') packliste.set({ checked: pk.checked || {}, custom: pk.custom || [] })
    const nt = await idbGet(KEY_NOTIZEN)
    if (Array.isArray(nt)) notizen.set(nachruesten(nt))
    const wd = await idbGet(KEY_WANDER)
    if (Array.isArray(wd)) wanderungen.set(nachruesten(wd))
    const ci = await idbGet(KEY_CHECKINS)
    if (Array.isArray(ci)) checkins.set(ci)
    // Ostküste: getrennte Töpfe des Altformats einmalig in die Haupttöpfe überführen.
    const schonZusammen = await idbGet(KEY_ZUSAMMEN)
    const ur = await idbGet(KEY_U_REISEN)
    const uo = await idbGet(KEY_U_ORTE)
    const uj = await idbGet(KEY_U_JOURNAL)
    if (!schonZusammen) {
      fuehreOstDatenZusammen(
        Array.isArray(uo) ? uo : [],
        Array.isArray(ur) ? ur : [],
        Array.isArray(uj) ? uj : [],
      )
      await idbSet(KEY_ZUSAMMEN, true)
      await idbSet(KEY_U_REISEN, []); await idbSet(KEY_U_ORTE, []); await idbSet(KEY_U_JOURNAL, [])
    }
    const bg = await idbGet(KEY_BUDGET)
    if (typeof bg === 'number') reiseBudget.set(bg)
    const rt = await idbGet(KEY_DAUER)
    if (typeof rt === 'number') reiseTage.set(rt)
    const vb = await idbGet(KEY_VORB)
    if (vb && typeof vb === 'object') vorbereitung.set({ checked: vb.checked || {}, custom: vb.custom || [] })
    const dk = await idbGet(KEY_DOKU)
    if (Array.isArray(dk)) dokumente.set(nachruesten(dk))
    const vk = await idbGet(KEY_VORAB)
    if (Array.isArray(vk)) vorabKosten.set(nachruesten(vk))
    const bu = await idbGet(KEY_BUCHUNGEN)
    if (bu && Array.isArray(bu.events)) buchungen.set(bu)
    const gr = await idbGet(KEY_GRAB)
    if (gr && typeof gr === 'object') grabsteine.set(gr)
    const sn = await idbGet(KEY_SCHNAPP)
    if (sn?.stand) schnappschuss.set({ zeit: sn.zeit, quelle: sn.quelle, umfang: sn.umfang })
    const ss = await idbGet(KEY_SKALAR)
    if (ss && typeof ss === 'object') skalarStand.set(ss)
  } catch (e) {
    console.warn('IndexedDB nicht verfügbar', e)
  }
  try { rettenAusNotspeicher() } catch (e) { console.warn('Notspeicher nicht lesbar', e) }
  try { planNachziehen() } catch (e) { console.warn('Plan-Umbau fehlgeschlagen', e) }
  planUmbauAktiv = true
  loaded = true
  ready.set(true)
  autoSave(userData, KEY)
  autoSave(reisen, KEY_REISEN)
  autoSave(eigeneOrte, KEY_ORTE)
  autoSave(gesamtStart, KEY_START)
  autoSave(gefahrenCache, KEY_GEFAHR)
  autoSave(journal, KEY_JOURNAL)
  autoSave(quizAntworten, KEY_QUIZ)
  autoSave(packliste, KEY_PACK)
  autoSave(notizen, KEY_NOTIZEN)
  autoSave(wanderungen, KEY_WANDER)
  autoSave(checkins, KEY_CHECKINS)
  autoSave(reiseBudget, KEY_BUDGET)
  autoSave(reiseTage, KEY_DAUER)
  autoSave(vorbereitung, KEY_VORB)
  autoSave(dokumente, KEY_DOKU)
  autoSave(vorabKosten, KEY_VORAB)
  autoSave(buchungen, KEY_BUCHUNGEN)
  autoSave(grabsteine, KEY_GRAB)
  autoSave(skalarStand, KEY_SKALAR)
  beobachteSkalar(gesamtStart, 'gesamtStart')
  beobachteSkalar(reiseBudget, 'reiseBudget')
  beobachteSkalar(reiseTage, 'reiseTage')
  grabsteineAufraeumen()
}

// Jede Änderung von Startdatum oder Budget bekommt einen Stempel — außer sie kommt
// gerade aus einem Import (dann gilt der Stempel aus der Datei, siehe wendeBackupAn).
let uebernahmeLaeuft = false
function beobachteSkalar(store, feld) {
  let letzter = get(store)
  store.subscribe((v) => {
    if (v === letzter) return
    letzter = v
    if (!loaded || uebernahmeLaeuft) return
    skalarStand.update((s) => ({ ...s, [feld]: new Date().toISOString() }))
  })
}

// ---------- Notspeicher ----------
// Scheitert das Speichern in IndexedDB (z. B. weil ein Svelte-Proxy nicht strukturiert klonbar
// ist), schreibt persist() den Wert in den localStorage. Beim Start wird er von dort
// zurückgeholt und mit dem Stand der Datenbank ZUSAMMENGEFÜHRT — nichts wird überschrieben.
const NOTSPEICHER = {
  [KEY]: 'daten', [KEY_REISEN]: 'reisen', [KEY_ORTE]: 'eigeneOrte', [KEY_JOURNAL]: 'journal',
  [KEY_PACK]: 'packliste', [KEY_NOTIZEN]: 'notizen', [KEY_WANDER]: 'wanderungen',
  [KEY_CHECKINS]: 'checkins', [KEY_VORB]: 'vorbereitung', [KEY_DOKU]: 'dokumente',
  [KEY_VORAB]: 'vorabKosten', [KEY_BUCHUNGEN]: 'buchungen', [KEY_GRAB]: 'grabsteine',
}
function rettenAusNotspeicher() {
  const datei = {}
  let n = 0
  for (const [key, feld] of Object.entries(NOTSPEICHER)) {
    let v = null
    try { const t = localStorage.getItem(key); if (t) v = JSON.parse(t) } catch {}
    if (v == null) continue
    datei[feld] = Array.isArray(v) ? nachruesten(v) : v
    n++
  }
  if (!n) return
  const r = fuehreZusammen(baueBackupPayload(), { ...datei, exportiert: URZEIT_M }, { quelle: 'Notspeicher', grundwerte: GRUNDWERTE })
  if (r.summe.neu || r.summe.ergaenzt) {
    uebernehme({ ...baueBackupPayload(), ...r.ergebnis })
    rettung.set({ zeit: new Date().toISOString(), summe: r.summe, bericht: r.bericht })
    console.warn('Aus dem Notspeicher zurückgeholt:', r.summe)
  }
  // Der Notspeicher wird erst geleert, wenn der Wert wirklich in der Datenbank steht (persist).
}

function behalteErgaenztes(alte = [], neue = []) {
  const vorher = new Map(alte.filter((e) => e.ergaenzt).map((e) => [e.id, e]))
  return neue.map((e) => {
    const a = vorher.get(e.id)
    return a ? { ...e, ...Object.fromEntries(a.ergaenzt.map((k) => [k, a[k]])), ergaenzt: a.ergaenzt } : e
  })
}

export function neueVorabKosten(vorlage = {}) {
  const heute = new Date()
  const datum = vorlage.datum || `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
  const k = { id: uid(), text: vorlage.text || '', kat: vorlage.kat || 'kosten_sonstiges', betrag: vorlage.betrag ?? '', waehrung: vorlage.waehrung || 'EUR', datum, reiseId: vorlage.reiseId || null }
  if (vorlage.keinTermin) k.keinTermin = true
  vorabKosten.update((ks) => [...ks, stempeln(k)])
  return k.id
}
export function updateVorabKosten(id, patch) { vorabKosten.update((ks) => ks.map((k) => (k.id === id ? stempeln({ ...k, ...patch }) : k))) }
export function loescheVorabKosten(id) { vorabKosten.update((ks) => ks.filter((k) => k.id !== id)); grabstein('vorabKosten', id) }

// ---------- Haken (Packliste, Vorbereitung) ----------
// Format { an, ts } — so überträgt sich auch das ABWÄHLEN beim Zusammenführen.
// Ein bloßes `true` bzw. ein gelöschter Schlüssel ließe sich beim Zusammenführen nicht von
// „nie gesetzt“ unterscheiden: ein abgewählter Haken käme beim nächsten Import zurück.
// Deshalb prüfen die Listen immer `istAn()` statt „steht da etwas?“.
/** Ist ein Haken gesetzt? Versteht altes (`true`) und neues Format ({ an, ts }). */
export const istAn = (v) => v === true || !!(v && typeof v === 'object' && v.an)
const haken = (an) => ({ an, ts: jetzt() })

// ---------- Reisevorbereitung ----------
export function toggleVorb(id) {
  vorbereitung.update((v) => ({ ...v, checked: { ...v.checked, [id]: haken(!istAn(v.checked[id])) } }))
}
export function addVorbItem(text) {
  const t = (text || '').trim(); if (!t) return
  vorbereitung.update((v) => ({ ...v, custom: [...v.custom, stempeln({ id: 'vb-' + uid(), text: t })] }))
}
export function delVorbItem(id) {
  vorbereitung.update((v) => ({
    checked: { ...v.checked, [id]: haken(false) },
    custom: v.custom.filter((c) => c.id !== id),
  }))
  grabstein('vorbCustom', id)
}
export function neuesDokument(vorlage = {}) {
  const d = { id: uid(), typ: vorlage.typ || '', nummer: '', gueltigBis: '', notiz: '', erledigt: false }
  dokumente.update((ds) => [...ds, stempeln(d)])
  return d.id
}
export function updateDokument(id, patch) { dokumente.update((ds) => ds.map((d) => (d.id === id ? stempeln({ ...d, ...patch }) : d))) }
export function loescheDokument(id) { dokumente.update((ds) => ds.filter((d) => d.id !== id)); grabstein('dokumente', id) }

// ---------- „Mein Urlaub" (Ostküste) – CRUD (eigene Töpfe) ----------

// Reisen
export function neueUrlaubReise(vorlage = {}) {
  const r = {
    id: uid(), name: vorlage.name || t('Neue Reise'), farbe: vorlage.farbe || naechsteFarbe(),
    tage: vorlage.tage ?? 3, imGesamtplan: vorlage.imGesamtplan ?? true, stops: vorlage.stops || [],
    // Ostküste: überwiegend geflogen — deshalb Flug als Vorgabe.
    art: vorlage.art || 'flug',
  }
  urlaubReisen.update((rs) => [...rs, r])
  return r.id
}
export function updateUrlaubReise(id, patch) { urlaubReisen.update((rs) => rs.map((r) => (r.id === id ? stempeln({ ...r, ...patch }) : r))) }
export function loescheUrlaubReise(id) { urlaubReisen.update((rs) => rs.filter((r) => r.id !== id)) }
export function verschiebeUrlaubReise(id, richtung) {
  urlaubReisen.update((rs) => {
    const i = rs.findIndex((r) => r.id === id), j = i + richtung
    if (i < 0 || j < 0 || j >= rs.length) return rs
    const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c
  })
}

// Orte
export function urlaubOrtAnlegen(ort) {
  const o = {
    id: 'u-' + uid(), name: ort.name, lat: ort.lat ?? null, lon: ort.lon ?? null,
    region: ort.region || 'Ostküste', beschreibung: ort.beschreibung || '', emoji: ort.emoji || '📍',
    mapsQuery: ort.mapsQuery || ort.name, eigen: true,
    tags: ort.tags || ['MEIN ORT'],
    bild: null,
    bildData: ort.bildData || null,   // selbst geholtes Vorschaubild (Data-URL, offline)
  }
  urlaubOrte.update((os) => [...os, o])
  return o
}
/** Gegenstück zu stopHinzufuegen für die Ostküsten-Reisen. */
export function urlaubStopHinzufuegen(reiseId, stop) {
  urlaubReisen.update((rs) => rs.map((r) => (r.id === reiseId
    ? { ...r, stops: [...(r.stops || []), { name: stop.name, lat: stop.lat ?? null, lon: stop.lon ?? null, img: stop.img || null }] }
    : r)))
}
export function updateUrlaubOrt(id, patch) { urlaubOrte.update((os) => os.map((o) => (o.id === id ? stempeln({ ...o, ...patch }) : o))) }
export function loescheUrlaubOrt(id) { urlaubOrte.update((os) => os.filter((o) => o.id !== id)) }

// Tagebuch
export function neuerUrlaubEintrag(vorlage = {}) {
  const heute = new Date()
  const datum = vorlage.datum || `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
  const e = {
    id: uid(), datum, ort: vorlage.ort || '', lat: vorlage.lat ?? null, lon: vorlage.lon ?? null,
    ortId: vorlage.ortId || null, reiseId: vorlage.reiseId || null,
    text: vorlage.text || '', fotos: vorlage.fotos || [], audios: vorlage.audios || [], felder: vorlage.felder || {},
  }
  urlaubJournal.update((js) => [e, ...js])
  return e.id
}
export function updateUrlaubEintrag(id, patch) { urlaubJournal.update((js) => js.map((e) => (e.id === id ? stempeln({ ...e, ...patch }) : e))) }
export function setUrlaubFeld(id, feldId, wert) {
  urlaubJournal.update((js) => js.map((e) => {
    if (e.id !== id) return e
    const felder = { ...e.felder }
    if (wert === '' || wert == null || (Array.isArray(wert) && wert.length === 0)) delete felder[feldId]
    else felder[feldId] = wert
    return { ...e, felder }
  }))
}
export function loescheUrlaubEintrag(id) { urlaubJournal.update((js) => js.filter((e) => e.id !== id)) }

// ---------- Notfall: Lebenszeichen-Check-ins ----------
export function neuerCheckin({ lat, lon, text = '' } = {}) {
  if (lat == null || lon == null) return
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  // tsLokal = lokale Wanduhr am Ort/Zeitpunkt (bleibt bei Zeitzonenwechsel unverändert).
  const tsLokal = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  checkins.update((cs) => [{ id: uid(), ts: d.toISOString(), tsLokal, lat, lon, text: (text || '').trim() }, ...cs])
}
export function loescheCheckin(id) {
  checkins.update((cs) => cs.filter((c) => c.id !== id))
  grabstein('checkins', id)
}

// ---------- Notizen ----------
export function neueNotiz(typ, text, etappeId = null) {
  const t = (text || '').trim()
  if (!t) return
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  // tsLokal = lokale Wanduhr AM ORT/ZEITPUNKT der Erfassung (ohne Zeitzone -> ändert sich
  // NICHT, wenn das Gerät später in eine andere Zeitzone wechselt). ts = absoluter Moment (UTC).
  const tsLokal = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  notizen.update((n) => [stempeln({ id: uid(), typ, text: t, erledigt: false, ts: d.toISOString(), tsLokal, etappeId }), ...n])
}
export function toggleNotiz(id) {
  notizen.update((n) => n.map((e) => (e.id === id ? stempeln({ ...e, erledigt: !e.erledigt }) : e)))
}
export function updateNotiz(id, patch) {
  notizen.update((n) => n.map((e) => (e.id === id ? stempeln({ ...e, ...patch }) : e)))
}
export function loescheNotiz(id) {
  notizen.update((n) => n.filter((e) => e.id !== id))
  grabstein('notizen', id)
}

export function setQuizAntwort(fragenId, index) {
  quizAntworten.update((q) => ({ ...q, [fragenId]: index }))
}
export function quizZuruecksetzen() { quizAntworten.set({}) }

// ---------- Packliste ----------
export function togglePack(itemId) {
  packliste.update((p) => ({ ...p, checked: { ...p.checked, [itemId]: haken(!istAn(p.checked[itemId])) } }))
}
export function addPackItem(kat, text) {
  const t = (text || '').trim()
  if (!t) return
  packliste.update((p) => ({ ...p, custom: [...p.custom, stempeln({ id: 'pk-' + uid(), kat, text: t })] }))
}
export function delPackItem(id) {
  packliste.update((p) => ({
    checked: { ...p.checked, [id]: haken(false) },
    custom: p.custom.filter((c) => c.id !== id),
  }))
  grabstein('packCustom', id)
}
// Zurücksetzen = alle Haken ausdrücklich AUS (mit Stempel), nicht bloß leeren —
// sonst setzte das andere Gerät sie beim nächsten Abgleich wieder.
export function packZuruecksetzen() {
  packliste.update((p) => ({ ...p, checked: Object.fromEntries(Object.keys(p.checked).map((k) => [k, haken(false)])) }))
}

function autoSave(store, key) {
  store.subscribe((val) => {
    if (!loaded) return
    clearTimeout(timers[key])
    timers[key] = setTimeout(() => persist(key, val), 300)
  })
}

async function persist(key, val) {
  try { await idbSet(key, val) }
  catch (e) {
    // Meist ein Svelte-Proxy ($state) im Wert: IndexedDB kann ihn nicht klonen
    // (DataCloneError). Als reine Daten geht es.
    try { await idbSet(key, JSON.parse(JSON.stringify(val))) }
    catch (e2) {
      console.error(`Speichern von „${key}" fehlgeschlagen — Notspeicher`, e2)
      try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
      return
    }
  }
  if (NOTSPEICHER[key]) { try { localStorage.removeItem(key) } catch {} }
}

/** Einzelnes Feld eines Ortes setzen. */
export function updateOrt(ortId, patch) {
  userData.update((d) => {
    const cur = d[ortId] || { notiz: '', bericht: '', bilder: [], tagebuch: [] }
    const next = stempeln({ ...cur, ...patch })
    const isEmpty = !next.notiz && !next.bericht
      && (!next.bilder || next.bilder.length === 0)
      && (!next.tagebuch || next.tagebuch.length === 0)
    const copy = { ...d }
    if (isEmpty) delete copy[ortId]
    else copy[ortId] = next
    return copy
  })
}

// ---------- Reisen ----------

/** Ostküsten-Daten in die Haupttöpfe überführen (einmalig).
 *
 *  Bis dahin liefen Orte, Reisen und Logbuch der Ostküste in eigenen Töpfen. Das hat
 *  jede Verbesserung doppelt nötig gemacht und Verknüpfungen verhindert. Jetzt eine
 *  gemeinsame Welt: Ost-Orte werden zu eigenen Orten im Abschnitt „Ostküste",
 *  Ost-Reisen zu normalen Reisen mit art:'flug', Ost-Logbuchtage zu normalen Tagen.
 *  IDs bleiben erhalten — so überleben Notizen (userData) und Verknüpfungen.
 */
function fuehreOstDatenZusammen(uOrte, uReisen, uJournal) {
  // Feld-Ids, die im Ost-Logbuch anders hießen.
  const FELD_ALT = { wetter: 'temp_celsius', song: 'soundtrack' }

  if (uOrte?.length) {
    eigeneOrte.update((os) => {
      const da = new Set(os.map((o) => o.id))
      const neu = uOrte.filter((o) => !da.has(o.id)).map((o) => ({
        ...o,
        abschnitt: o.abschnitt && o.abschnitt !== 'Meine Orte' ? o.abschnitt : 'Ostküste',
        region: o.region || 'Ostküste',
        tags: o.tags?.length ? o.tags : ['MEIN ORT'],
        mapsQuery: o.mapsQuery || o.name,
        eigen: true,
      }))
      return [...os, ...neu]
    })
  }
  if (uReisen?.length) {
    reisen.update((rs) => {
      const da = new Set(rs.map((r) => r.id))
      // Die Ostküste kommt zuerst (Anflug nach Melbourne) → vorne einsortieren.
      const neu = uReisen.filter((r) => !da.has(r.id)).map((r) => ({ ...r, art: r.art || 'flug' }))
      return [...neu, ...rs]
    })
  }
  if (uJournal?.length) {
    journal.update((js) => {
      const da = new Set(js.map((e) => e.id))
      const neu = uJournal.filter((e) => !da.has(e.id)).map((e) => {
        const felder = { ...(e.felder || {}) }
        for (const [alt, neuId] of Object.entries(FELD_ALT)) {
          if (felder[alt] !== undefined && felder[neuId] === undefined) felder[neuId] = felder[alt]
          delete felder[alt]
        }
        return { ...e, reiseId: e.reiseId || null, felder }
      })
      return [...neu, ...js]
    })
  }
  // Alte Töpfe leeren, damit nichts doppelt gezählt wird.
  urlaubOrte.set([]); urlaubReisen.set([]); urlaubJournal.set([])
}

export function neueReise(vorlage = {}) {
  const typ = vorlage.typ === 'route' ? 'route' : 'etappe'
  const r = {
    art: vorlage.art || 'auto',   // Westküste wird gefahren
    id: uid(),
    typ,
    name: vorlage.name || (typ === 'route' ? t('Neue Route') : t('Neue Etappe')),
    farbe: vorlage.farbe || naechsteFarbe(),
    tage: vorlage.tage ?? 3,
    // Für das Altformat: Etappen stehen im Gesamtplan, Routen nie.
    imGesamtplan: typ === 'etappe',
    stops: vorlage.stops || [],
  }
  if (typ === 'etappe' && vorlage.von) r.von = vorlage.von
  if (typ === 'route' && vorlage.etappeId) r.etappeId = vorlage.etappeId
  reisen.update((rs) => sortiereReisen([...rs, stempeln(r)]))
  return r.id
}
export const neueEtappe = (vorlage = {}) => neueReise({ ...vorlage, typ: 'etappe' })
export const neueRoute = (vorlage = {}) => neueReise({ ...vorlage, typ: 'route' })

export function updateReise(id, patch) {
  reisen.update((rs) => {
    const neu = rs.map((r) => (r.id === id ? stempeln({ ...r, ...patch }) : r))
    return ('von' in patch || 'tage' in patch || 'typ' in patch || 'etappeId' in patch) ? sortiereReisen(neu) : neu
  })
}

/**
 * Reihenfolge der Liste = Reihenfolge im Plan: Etappen nach Datum, jede Route direkt
 * hinter ihrer Etappe, Routen ohne Etappe am Ende. Das Altformat stapelt die Etappen in dieser
 * Reihenfolge — so stimmen die Termine auch dort.
 */
export function sortiereReisen(rs) {
  const etappen = rs.filter((r) => r && r.typ === 'etappe')
  const vonVon = new Map(etappenMitDatum(etappen, get(gesamtStart)).map((e) => [e.reise.id, e.von]))
  const schluessel = (r, i) => {
    if (!r || typeof r !== 'object') return 'zzzz|' + String(i).padStart(5, '0')
    if (r.typ === 'etappe') return (vonVon.get(r.id) || 'zzzy') + '|0|' + String(i).padStart(5, '0')
    const ev = r.etappeId && vonVon.get(r.etappeId)
    return (ev || 'zzzz') + '|1|' + String(i).padStart(5, '0')
  }
  return rs.map((r, i) => [schluessel(r, i), r]).sort((a, b) => a[0].localeCompare(b[0])).map((x) => x[1])
}

/** Etappe zur Route machen oder umgekehrt (z. B. ein alter Entwurf, der nach dem Rückflug hängt). */
export function wandleReiseUm(id, typ, etappeId = null) {
  const patch = typ === 'route' ? { typ, imGesamtplan: false, etappeId } : { typ, imGesamtplan: true }
  updateReise(id, patch)
}

export function loescheReise(id) {
  reisen.update((rs) => rs.filter((r) => r.id !== id))
  grabstein('reisen', id)
}

export function verschiebeReise(id, richtung) {
  reisen.update((rs) => {
    const i = rs.findIndex((r) => r.id === id)
    const j = i + richtung
    if (i < 0 || j < 0 || j >= rs.length) return rs
    const c = [...rs]
    ;[c[i], c[j]] = [c[j], c[i]]
    return c
  })
}

/**
 * Stopp zu einer Route hinzufügen — an der Stelle mit dem kleinsten Umweg
 * (Ende zählt mit), statt ihn immer ans Ende zu hängen.
 * @returns { index, nach } wo er gelandet ist (nach = Name des vorigen Stopps)
 */
export function stopHinzufuegen(reiseId, stop, { ans = 'passend' } = {}) {
  let ergebnis = { index: -1, nach: null }
  reisen.update((rs) => rs.map((r) => {
    if (r.id !== reiseId) return r
    const neu = { name: stop.name, lat: stop.lat ?? null, lon: stop.lon ?? null, img: stop.img || null }
    const liste = [...(r.stops || [])]
    const i = ans === 'ende' ? liste.length : besteEinfuegeStelle(liste, neu)
    liste.splice(i, 0, neu)
    ergebnis = { index: i, nach: i > 0 ? liste[i - 1].name : null }
    return stempeln({ ...r, stops: liste })
  }))
  return ergebnis
}

// ---------- Wanderungen ----------

export function neueWanderung(vorlage = {}) {
  const w = {
    id: uid(),
    name: vorlage.name || t('Neue Wanderung'),
    // Datum optional. Ist es gesetzt, erscheint die Wanderung von selbst in der
    // Zeitleiste und im Gesamtplan an der Stelle, an die sie datumsmäßig gehört.
    // Uhrzeit ist reine Kür — sie entscheidet nur die Reihenfolge innerhalb eines Tages.
    datum: vorlage.datum || '',
    zeit: vorlage.zeit || '',
    gebiet: vorlage.gebiet || '',
    km: vorlage.km ?? '',
    dauerMin: vorlage.dauerMin ?? '',
    hoehenmeter: vorlage.hoehenmeter ?? '',
    schwierigkeit: vorlage.schwierigkeit || 'mittel',
    art: vorlage.art || 'rundweg',
    lat: vorlage.lat ?? null,
    lon: vorlage.lon ?? null,
    ortId: vorlage.ortId || null,
    reiseId: vorlage.reiseId || null,
    beschreibung: vorlage.beschreibung || '',
    wasser: vorlage.wasser ?? '',
    besteZeit: vorlage.besteZeit || '',
    status: vorlage.status || 'wunsch',
    bewertung: vorlage.bewertung ?? 0,
    fotos: vorlage.fotos || [],
  }
  wanderungen.update((ws) => [...ws, stempeln(w)])
  return w.id
}

export function updateWanderung(id, patch) {
  wanderungen.update((ws) => ws.map((w) => (w.id === id ? stempeln({ ...w, ...patch }) : w)))
}

export function loescheWanderung(id) {
  wanderungen.update((ws) => ws.filter((w) => w.id !== id))
  grabstein('wanderungen', id)
}

// Zwei Wanderungen tauschen (per ID) — funktioniert auch, wenn die Liste gerade
// gefiltert ist (getauscht wird mit dem SICHTBAREN Nachbarn, nicht global).
export function tauscheWanderung(idA, idB) {
  wanderungen.update((ws) => {
    const i = ws.findIndex((w) => w.id === idA)
    const j = ws.findIndex((w) => w.id === idB)
    if (i < 0 || j < 0) return ws
    const c = [...ws]
    ;[c[i], c[j]] = [c[j], c[i]]
    return c
  })
}

// ---------- Eigene Orte ----------

export function eigenenOrtAnlegen(ort) {
  const o = {
    id: 'eigen-' + uid(),
    name: ort.name,
    lat: ort.lat ?? null,
    lon: ort.lon ?? null,
    abschnitt: ort.abschnitt || 'Meine Orte',
    region: ort.region || 'Meine Orte',
    tags: ort.tags || [],
    beschreibung: ort.beschreibung || '',
    emoji: ort.emoji || '📍',
    mapsQuery: ort.mapsQuery || ort.name,
    bild: null,
    bildData: ort.bildData || null,   // selbst geholtes Vorschaubild (Data-URL, offline)
    eigen: true,
  }
  eigeneOrte.update((os) => [...os, stempeln(o)])
  return o
}

export function updateEigenenOrt(id, patch) {
  eigeneOrte.update((os) => os.map((o) => (o.id === id ? stempeln({ ...o, ...patch }) : o)))
}

export function loescheEigenenOrt(id) {
  eigeneOrte.update((os) => os.filter((o) => o.id !== id))
  grabstein('eigeneOrte', id)
}

// ---------- Roadtrip-Tagebuch ----------

export function neuerJournalEintrag(vorlage = {}) {
  const heute = new Date()
  const datum = vorlage.datum || `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
  const e = {
    id: uid(), datum,
    ...(vorlage.bis > datum ? { bis: vorlage.bis } : {}),
    ort: vorlage.ort || '', lat: vorlage.lat ?? null, lon: vorlage.lon ?? null, ortId: vorlage.ortId || null,
    // Reise-Bezug von Anfang an im Objekt — sonst entsteht er erst beim ersten
    // Auswählen und fehlt in Backups älterer Einträge stillschweigend.
    reiseId: vorlage.reiseId || null, legIdx: vorlage.legIdx ?? null,
    text: vorlage.text || '', fotos: vorlage.fotos || [], audios: vorlage.audios || [],
    felder: vorlage.felder || {},
  }
  journal.update((js) => [stempeln(e), ...js])
  return e.id
}

export function updateJournalEintrag(id, patch) {
  journal.update((js) => js.map((e) => (e.id === id ? stempeln({ ...e, ...patch }) : e)))
}

export function setJournalFeld(id, feldId, wert) {
  journal.update((js) => js.map((e) => {
    if (e.id !== id) return e
    const felder = { ...e.felder }
    if (wert === '' || wert == null || (Array.isArray(wert) && wert.length === 0)) delete felder[feldId]
    else felder[feldId] = wert
    // Stempel: sonst käme eine Korrektur („48 € statt 84 €") beim Zusammenführen nicht an.
    return stempeln({ ...e, felder })
  }))
}

export function loescheJournalEintrag(id) {
  journal.update((js) => js.filter((e) => e.id !== id))
  grabstein('journal', id)
}

// ---------- Reisekalender-Import ----------

/**
 * Übernimmt eine Datei aus der eigenen Kalender-App.
 *
 * Zwei Regeln, an denen sich alles entscheidet:
 *   1. NICHTS Eigenes wird überschrieben. Ersetzt wird nur, was beim letzten Import
 *      von hier kam — erkennbar an `quelle === 'reisekalender'`.
 *   2. Der Kalender bleibt die Quelle. Bei Änderungen einfach neu importieren.
 *
 * `orte` dient nur dazu, den Stopp-Namen Koordinaten zu geben — ohne sie zeichnet
 * die Karte keine Linie.
 */
export function importiereReisekalender(kalender, { orte = [], reisenAnlegen = true } = {}) {
  const vorher = get(buchungen)
  buchungen.set({
    stand: kalender.stand, von: kalender.von, bis: kalender.bis,
    // Eigene, aus Mails eingefügte Buchungen bleiben beim Neu-Import des Kalenders erhalten,
    // ebenso selbst zugeordnete Belege (am Termin mit derselben ID bzw. bei den eigenen Dokumenten)
    events: [...behalteErgaenztes(vorher?.events, eigeneBelegeUebernehmen(vorher?.events, kalender.events)), ...((vorher?.events || []).filter((e) => e.quelle === 'eigen'))],
    persoenlich: [...kalender.persoenlich, ...((vorher?.persoenlich || []).filter((d) => d.eigen))],
    // Damit „entfernen" wirklich zurücknimmt, was der Import angerichtet hat.
    startVorher: get(gesamtStart),
  })

  let angelegt = 0, ersetzt = 0, eigene = 0
  if (reisenAnlegen) {
    const abschnitte = baueAbschnitte(kalender.events)
    const neue = alsReisen(abschnitte, orte, naechsteFarbe)
      .map((r) => ({ ...r, id: uid(), typ: 'etappe', von: r.kalenderVon, imGesamtplan: true }))
    let umzug = new Map()
    reisen.update((rs) => {
      const alte = rs.filter((r) => r.quelle === 'reisekalender')
      const behalten = rs.filter((r) => r.quelle !== 'reisekalender')
      ersetzt = alte.length
      eigene = behalten.length
      // Routen hängen an Etappen. Ein Neu-Import vergibt neue IDs — die Routen
      // ziehen mit (gleicher Name, sonst größte Überschneidung), statt zu verwaisen.
      umzug = zuordnungNachImport(alte, neue)
      const umgehaengt = behalten.map((r) => (r.etappeId && umzug.has(r.etappeId)
        ? stempeln({ ...r, etappeId: umzug.get(r.etappeId) }) : r))
      return sortiereReisen([...neue, ...umgehaengt])
    })
    // Logbuchtage und Wanderungen, die auf eine alte Etappe zeigten, ebenso.
    if (umzug.size) {
      journal.update((js) => js.map((e) => (e.reiseId && umzug.has(e.reiseId) ? stempeln({ ...e, reiseId: umzug.get(e.reiseId) }) : e)))
      wanderungen.update((ws) => ws.map((w) => (w.reiseId && umzug.has(w.reiseId) ? stempeln({ ...w, reiseId: umzug.get(w.reiseId) }) : w)))
    }
    angelegt = neue.length
    if (kalender.von) gesamtStart.set(kalender.von)
  }

  setSync({ kalenderImport: new Date().toISOString() })
  return { angelegt, ersetzt, eigene, buchungen: kalender.events.filter((e) => !e.platzhalter).length }
}

/** Buchungen und die daraus abgeleiteten Reisen wieder entfernen. Eigene Reisen bleiben. */
export function entferneReisekalender() {
  const alt = get(buchungen)?.startVorher
  if (typeof alt === 'string' && alt) gesamtStart.set(alt)
  buchungen.set(null)
  let weg = 0
  reisen.update((rs) => {
    const behalten = rs.filter((r) => r.quelle !== 'reisekalender')
    weg = rs.length - behalten.length
    return behalten
  })
  return weg
}

// ---------- Eigene Buchungen (aus einer Bestätigungsmail eingefügt) ----------
//
// Landen im selben Topf wie die Kalender-Buchungen, damit Heute, Etappe, Kalender,
// Logbuch und Export sie ohne Umbau zeigen. Erkennbar an `quelle: 'eigen'`.
// `von`/`bis` des Topfs bleiben unangetastet: sie beschreiben den importierten
// Reisekalender (Plan-Hinweis „Etappen nach dem Rückflug“ hängt daran).
// `stand` rückt vor, damit das Zusammenführen diese Fassung als die neuere erkennt.

/** Angaben an einem Termin ergänzen (Flugnummer, Sitzplatz …). `ergaenzt` schützt sie vor dem nächsten Kalender-Import. */
export function aendereTermin(id, patch) {
  buchungen.update((b) => b && ({ ...b, stand: new Date().toISOString(), events: b.events.map((e) => (e.id === id ? { ...e, ...patch, ergaenzt: Object.keys(patch) } : e)) }))
}

/** Fügt fertige Termine (siehe buchung-erkennen.js → alsBuchungen) hinzu. Gibt die Anzahl zurück. */
export function buchungenEinfuegen(neue) {
  if (!Array.isArray(neue) || !neue.length) return 0
  const jetzt = new Date().toISOString()
  // JSON-Kopie: Svelte-Proxys lassen sich nicht in IndexedDB ablegen.
  const saubere = JSON.parse(JSON.stringify(neue))
    .filter((e) => e && typeof e.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.datum))
    .map((e) => ({
      sub: '', ref: '', emoji: '', special: '', flugNr: '', docs: [], ...e,
      id: e.id || 'eb-' + uid(), platzhalter: false, quelle: 'eigen', angelegt: e.angelegt || jetzt,
    }))
  if (!saubere.length) return 0
  buchungen.update((b) => {
    const basis = b && Array.isArray(b.events) ? b : { stand: null, von: '', bis: '', events: [], persoenlich: [] }
    const events = [...basis.events, ...saubere].sort((x, y) => x.datum.localeCompare(y.datum))
    return { ...basis, events, stand: jetzt }
  })
  return saubere.length
}

/**
 * Selbst zugeordnete Belege an Termine hängen (Maske unter „Belege auf diesem Gerät“).
 * liste: [{ ziel: Termin-ID | 'persoenlich', label, datei }]. Die Datei selbst liegt in belege.js.
 */
export function belegeAnhaengen(liste) {
  buchungen.update((b) => haengeBelegeAn(b, JSON.parse(JSON.stringify(liste || [])), uid))
}

/** Selbst zugeordneten Beleg wieder vom Termin nehmen. */
export function belegAbnehmen(datei) {
  buchungen.update((b) => nimmBelegAb(b, datei))
}

/** Löscht eine selbst eingefügte Buchung samt den Terminen derselben Gruppe (Check-in und Check-out). */
export function loescheEigeneBuchung(id) {
  let weg = 0
  buchungen.update((b) => {
    if (!b?.events) return b
    const ziel = b.events.find((e) => e.id === id && e.quelle === 'eigen')
    if (!ziel) return b
    const events = b.events.filter((e) => !(e.quelle === 'eigen' && (e.id === id || (ziel.gruppe && e.gruppe === ziel.gruppe))))
    for (const e of b.events) if (!events.includes(e)) grabstein('buchungenEigen', e.id)
    weg = b.events.length - events.length
    return { ...b, events, stand: new Date().toISOString() }
  })
  return weg
}

// ---------- Kalender-Berechnung ----------

/**
 * Gesamtplan aus den Etappen (festes Datum je Etappe, Routen zählen nicht mit).
 * von/bis als Date um 00:00 Ortszeit; Kalender, Export und Karte arbeiten mit dieser Form.
 */
export function berechneKalender(alleReisen, startDatum) {
  const e = etappenMitDatum(alleReisen || [], startDatum || START_DEFAULT)
  const alsDate = (s) => new Date(s + 'T00:00:00')
  const u = planUeberblick(e)
  const eintraege = e.map((x) => ({ reise: x.reise, von: alsDate(x.von), bis: alsDate(x.bis), tage: x.tage }))
  const start = u.start ? alsDate(u.start) : alsDate(startDatum || START_DEFAULT)
  const ende = u.ende ? alsDate(u.ende) : new Date(start.getTime() - 86400000)
  return { eintraege, start, ende, gesamtTage: u.tage, luecken: u.luecken }
}

/**
 * Date → "YYYY-MM-DD" in ORTSZEIT.
 * Bewusst nicht toISOString(): das rechnet nach UTC um und schiebt jedes Datum
 * östlich von Greenwich einen Tag zurück — der letzte Tag einer Etappe fiele
 * dann aus ihrem eigenen Zeitraum heraus.
 */
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Zeitstempel zum Sortieren eines datierten Eintrags.
 * Ohne Uhrzeit gilt 12:00 — dieselbe Konvention wie im Tagebuch (Zeitleiste),
 * damit ein Tagebuchtag und eine Wanderung desselben Tages nicht zufällig
 * die Reihenfolge tauschen. Mit Uhrzeit steht die Wanderung korrekt davor/danach.
 */
export function zeitstempel(datum, zeit) {
  if (!datum) return NaN
  const t = new Date(`${datum}T${/^\d{2}:\d{2}/.test(zeit || '') ? zeit : '12:00'}`)
  return isNaN(t.getTime()) ? new Date(datum + 'T12:00').getTime() : t.getTime()
}

// ---------- Backup / Geräte-Transfer ----------

// Zeitpunkte der letzten Sicherung/Import (für „Welcher Stand ist aktuell?"), einfach in localStorage.
const _syncInit = (() => { try { return JSON.parse(localStorage.getItem('wa-sync') || '{}') } catch { return {} } })()
export const syncZeiten = writable(_syncInit)
function setSync(patch) {
  syncZeiten.update((s) => {
    const n = stempeln({ ...s, ...patch })
    try { localStorage.setItem('wa-sync', JSON.stringify(n)) } catch {}
    return n
  })
}

export function baueBackupPayload() {
  return {
    typ: 'wa-reiseplan-backup',
    version: 7,   // 5: Ostküste zusammengeführt · 6: Buchungen · 7: Zeitstempel + Grabsteine (Zusammenführen)
    exportiert: new Date().toISOString(),
    daten: get(userData),
    reisen: get(reisen),
    eigeneOrte: get(eigeneOrte),
    gesamtStart: get(gesamtStart),
    journal: get(journal),
    quizAntworten: get(quizAntworten),
    packliste: get(packliste),
    notizen: get(notizen),
    wanderungen: get(wanderungen),
    checkins: get(checkins),
    reiseBudget: get(reiseBudget),
    reiseTage: get(reiseTage),
    vorbereitung: get(vorbereitung),
    dokumente: get(dokumente),
    vorabKosten: get(vorabKosten),
    buchungen: get(buchungen),
    grabsteine: get(grabsteine),
    skalarStand: get(skalarStand),
    // Musik-Einstellungen ohne „eingeschaltet“ (Feld fehlt in älteren Dateien)
    musikEinstellungen: musikFuerBackup(),
  }
}

// Aktueller Datenumfang auf DIESEM Gerät — für die Vergleichs-Anzeige beim Import.
export function datenStand() {
  const ud = get(userData)
  const pk = get(packliste)
  return {
    tagebuch: get(journal).length,
    reisen: get(reisen).length,
    wanderungen: get(wanderungen).length,
    eigeneOrte: get(eigeneOrte).length,
    packHaken: Object.values(pk?.checked || {}).filter(istAn).length,
    quiz: Object.keys(get(quizAntworten) || {}).length,
    ortNotizen: Object.values(ud).filter((e) => (e.notiz || e.bericht || '').trim() || (e.bilder || []).length || (e.tagebuch || []).length).length,
  }
}

// Umfang eines geladenen Backup-Payloads (ohne es anzuwenden).
export function backupInfo(p) {
  return {
    exportiert: p?.exportiert || null,
    tagebuch: Array.isArray(p?.journal) ? p.journal.length : 0,
    reisen: Array.isArray(p?.reisen) ? p.reisen.length : 0,
    wanderungen: Array.isArray(p?.wanderungen) ? p.wanderungen.length : 0,
    eigeneOrte: Array.isArray(p?.eigeneOrte) ? p.eigeneOrte.length : 0,
    packHaken: p?.packliste?.checked ? Object.values(p.packliste.checked).filter(istAn).length : 0,
  }
}

// Export: ERST die Backup-Datei speichern (garantierte Sicherung), DANN — falls das Gerät
// es kann — das native Teilen-Menü (AirDrop/Mail …) öffnen. Läuft auf iPhone und Mac.
export async function exportBackup() {
  const payload = baueBackupPayload()
  const json = JSON.stringify(payload, null, 2)
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const name = `WA-Reiseplan-Backup_${stamp}.json`
  const blob = new Blob([json], { type: 'application/json' })

  // 1) ZUERST als Datei speichern (Download) — so existiert immer eine Sicherung,
  //    egal ob danach geteilt oder das Teilen abgebrochen wird.
  try {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500)
  } catch {}
  setSync({ gesichert: new Date().toISOString() })

  // 2) DANN teilen (Teilen-Menü mit AirDrop/Mail …), falls verfügbar.
  try {
    const file = new File([blob], name, { type: 'application/json' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: t('WA-Reiseplan Backup'), text: t('Mein Reisedaten-Backup') })
      return { methode: 'gespeichert+geteilt', name }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return { methode: 'gespeichert', name } // Teilen abgebrochen — Datei ist trotzdem gesichert
  }
  return { methode: 'gespeichert', name }
}

// Datei nur einlesen & parsen (noch NICHT anwenden) — damit die UI vorher vergleichen/fragen kann.
export function leseBackup(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = (e) => {
      try {
        const p = JSON.parse(e.target.result)
        if (!p || typeof p !== 'object') throw new Error('leer')
        resolve(p)
      } catch (err) { reject(err) }
    }
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

// Fremde oder beschädigte Dateien: nur Felder der erwarteten Art kommen in die App, sonst
// stürzt sie bei jedem Start über einzelne Einträge. Ohne ein einziges bekanntes Feld: null.
const BACKUP_LISTEN = ['reisen', 'eigeneOrte', 'journal', 'notizen', 'wanderungen', 'checkins', 'dokumente', 'vorabKosten']
const BACKUP_OBJEKTE = ['daten', 'quizAntworten', 'packliste', 'vorbereitung', 'buchungen', 'grabsteine']
export function saeubereBackup(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  if (![...BACKUP_LISTEN, ...BACKUP_OBJEKTE].some((k) => k in p)) return null
  const sauber = { ...p }
  for (const k of BACKUP_LISTEN) {
    if (!(k in sauber)) continue
    if (Array.isArray(sauber[k])) sauber[k] = sauber[k].filter((x) => x && typeof x === 'object')
    else delete sauber[k]
  }
  for (const k of BACKUP_OBJEKTE) if (k in sauber && (!sauber[k] || typeof sauber[k] !== 'object')) delete sauber[k]
  return sauber
}

// Ein eingelesenes Backup wirklich übernehmen (ersetzt die lokalen Daten).
/**
 * Trockenlauf: was WÜRDE ein Zusammenführen tun? Ruft dieselbe Funktion auf wie der
 * echte Lauf — die Vorschau kann deshalb nicht andere Zahlen zeigen als das Ergebnis.
 */
// Was „noch nie eingestellt" bedeutet — beim Zusammenführen schlägt das nie einen echten Wert.
const GRUNDWERTE = { gesamtStart: START_DEFAULT, reiseBudget: 0, reiseTage: 0 }

// Eingelesene Dateien können aus der Oberfläche als Svelte-Proxy kommen. Die lassen sich
// nicht in IndexedDB speichern — also vor jeder Verarbeitung in reine Daten verwandeln.
const reineDaten = (p) => JSON.parse(JSON.stringify(p))

export function vorschauZusammenfuehren(p, quelle) {
  return fuehreZusammen(baueBackupPayload(), reineDaten(p), { quelle, grundwerte: GRUNDWERTE })
}

// Ein Schnappschuss vor dem Schreiben. Genau einer: er überschreibt den vorigen.
// Speicher ist auf dem iPhone die enge Stelle, und mehr als „einmal zurück" braucht
// niemand — wer zweimal daneben importiert, macht ohnehin etwas anderes falsch.
const KEY_SCHNAPP = 'schnappschuss-v1'
export const schnappschuss = writable(null)

export async function importRueckgaengig() {
  const alt = await idbGet(KEY_SCHNAPP)
  if (!alt?.stand) return false
  wendeBackupAn(alt.stand, { schnappschuss: false })
  await idbSet(KEY_SCHNAPP, null)
  schnappschuss.set(null)
  // Gibt zurück, WAS wiederhergestellt wurde — damit die Anzeige nicht behaupten
  // muss, was sie nicht weiß, und ein Test es nachrechnen kann.
  return { zeit: alt.zeit, quelle: alt.quelle, umfang: alt.umfang || { tagebuch: (alt.stand.journal || []).length } }
}

/** Zusammenführen und anwenden. Gibt den Bericht zurück. */
export async function fuehreBackupZusammen(p, { quelle = t('anderes Gerät') } = {}) {
  const vorher = baueBackupPayload()
  const r = fuehreZusammen(vorher, reineDaten(p), { quelle, grundwerte: GRUNDWERTE })

  // Nur sichern, wenn sich tatsächlich etwas ändert. Sonst überschriebe ein
  // wirkungsloser zweiter Import den Schnappschuss des ersten — und „rückgängig"
  // führte auf einen Stand zurück, den der Nutzer nie gemeint hat.
  const aendertSich = r.summe.neu || r.summe.ergaenzt || r.summe.geloescht
  if (aendertSich) {
    try {
      const marke = {
        zeit: new Date().toISOString(), quelle,
        umfang: { tagebuch: (vorher.journal || []).length, reisen: (vorher.reisen || []).length,
                  wanderungen: (vorher.wanderungen || []).length },
      }
      await idbSet(KEY_SCHNAPP, { stand: vorher, ...marke })
      schnappschuss.set(marke)
    } catch (e) {
      console.warn('Schnappschuss fehlgeschlagen', e)
      schnappschuss.set(null)
    }
  }
  wendeBackupAn({ ...vorher, ...r.ergebnis, typ: 'wa-reiseplan-backup' }, { schnappschuss: false })
  setSync({ zusammengefuehrt: new Date().toISOString() })
  return r
}

export function wendeBackupAn(p, { schnappschuss: _s = true } = {}) {
  uebernehme(reineDaten(p))
  setSync({ importiert: new Date().toISOString() })
}

// Stände in die Stores schreiben. Startdatum/Budget tragen dabei den Stempel aus der
// Datei (nicht „jetzt") — sonst gewänne ein bloß kopierter Wert später jeden Vergleich.
function uebernehme(p) {
  uebernahmeLaeuft = true
  try { uebernehmeRoh(p) } finally { uebernahmeLaeuft = false }
}
function uebernehmeRoh(p) {
  userData.set(p.daten ?? p)
  if (Array.isArray(p.reisen)) reisen.set(p.reisen)
  else if (Array.isArray(p.route)) reisen.set([{ id: uid(), name: t('Meine Route'), farbe: naechsteFarbe(), tage: p.route.length, imGesamtplan: true, stops: p.route }])
  if (Array.isArray(p.eigeneOrte)) eigeneOrte.set(p.eigeneOrte)
  if (typeof p.gesamtStart === 'string') gesamtStart.set(p.gesamtStart)
  if (Array.isArray(p.journal)) journal.set(p.journal)
  if (p.quizAntworten && typeof p.quizAntworten === 'object') quizAntworten.set(p.quizAntworten)
  if (p.packliste && typeof p.packliste === 'object') packliste.set({ checked: p.packliste.checked || {}, custom: p.packliste.custom || [] })
  if (Array.isArray(p.notizen)) notizen.set(p.notizen)
  if (Array.isArray(p.wanderungen)) wanderungen.set(p.wanderungen)
  if (Array.isArray(p.checkins)) checkins.set(p.checkins)
  // Sicherungen bis Version 4 hatten eigene Ostküsten-Töpfe — direkt mit übernehmen.
  if (p.urlaubOrte?.length || p.urlaubReisen?.length || p.urlaubJournal?.length) {
    fuehreOstDatenZusammen(p.urlaubOrte || [], p.urlaubReisen || [], p.urlaubJournal || [])
  }
  if (typeof p.reiseBudget === 'number') reiseBudget.set(p.reiseBudget)
  if (typeof p.reiseTage === 'number') reiseTage.set(p.reiseTage)
  if (p.vorbereitung && typeof p.vorbereitung === 'object') vorbereitung.set({ checked: p.vorbereitung.checked || {}, custom: p.vorbereitung.custom || [] })
  if (Array.isArray(p.dokumente)) dokumente.set(p.dokumente)
  if (Array.isArray(p.vorabKosten)) vorabKosten.set(p.vorabKosten)
  if (p.buchungen && Array.isArray(p.buchungen.events)) buchungen.set(p.buchungen)
  if (p.grabsteine && typeof p.grabsteine === 'object') grabsteine.set(p.grabsteine)
  skalarStand.set(p.skalarStand && typeof p.skalarStand === 'object' ? p.skalarStand : {})
  if (p.musikEinstellungen?.werte) musikAusBackup(p.musikEinstellungen)
}

// Bequemer Direkt-Import (einlesen + anwenden) — Kompatibilität.
export function importBackup(file) {
  return leseBackup(file).then((p) => wendeBackupAn(p))
}
