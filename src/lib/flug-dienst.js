// Flug- und Bahnabfrage: Stand, Speicher und Abruf. Flüge kommen von AeroDataBox über RapidAPI,
// Züge von der Abfahrtstafel auf dbf.finalrewind.org (ohne Schlüssel, nur Deutschland, etwa 3 Stunden voraus).
//
// Eigener Schlüssel `flugstatus-v1` im IndexedDB-Topf 'wa-plan'/'kv' (wie strassenlage-v1).
// Nicht im Backup: der Tarif erlaubt nur 7 Tage Speicherzeit, danach fliegen die Daten raus und
// kommen bei Bedarf neu. Der RapidAPI-Schlüssel gehört dem Nutzer und bleibt in localStorage auf
// diesem Gerät, nie im Code, nie im Backup.
//
// Die App läuft nur, solange sie offen ist: Abfragen passieren beim Öffnen, alle 5 Minuten im
// offenen Zustand, sobald sich die Termine ändern und auf Knopfdruck. Echte Mitteilungen bei
// geschlossener App bräuchten einen eigenen Server.
import { writable, readable, derived, get } from 'svelte/store'
import { buchungen } from './userdata.js'
import { t } from './i18n.js'
import { zeigeToast } from './toast.js'
import { frage, dialogAnfrage } from './dialog.js'
import { geh } from './navigation.js'
import { fluegeAusTerminen, faellig, zugFaellig, leseZug, darfAbfragen, genutzt, monatVon, abfrageDatum, leseAntwort, aenderungen, naechsteGruppe, flugImFokus, abflugMs, stundenBis, statusText } from './flug.js'

const DB = 'wa-plan', TOPF = 'kv', SCHLUESSEL = 'flugstatus-v1'
const KEY_API = 'tb-flug-schluessel'
const HOST = 'aerodatabox.p.rapidapi.com'
const BAHN = 'dbf.finalrewind.org'
const HALTBAR = 7 * 24 * 3600e3
const TAKT = 5 * 60e3
const PAUSE = 1200          // höchstens eine Abfrage je Sekunde
const SPERRE = 6 * 3600e3   // nach „Kontingent aufgebraucht“ nicht weiter versuchen

/** { staende: {flugId: {geholt, leer, daten, verlauf}}, zaehler: {monat, anzahl}, popup: {flugId: true}, gesperrtBis } */
export const flugspeicher = writable({ staende: {}, zaehler: null, popup: {}, gesperrtBis: 0 })
/** Während einer Abfrage: { laden: bool, fehler: 'schluessel'|'limit'|'netz'|'dienst'|'bahn'|null, zeit: ms|null } */
export const fluglauf = writable({ laden: false, fehler: null, zeit: null })

export const fluege = derived(buchungen, ($b) => fluegeAusTerminen($b?.events || []))
export const uhr = readable(Date.now(), (set) => {
  const i = setInterval(() => set(Date.now()), 60000)
  return () => clearInterval(i)
})

export const hatSchluessel = writable(false)
export function leseSchluessel() { try { return localStorage.getItem(KEY_API) || '' } catch { return '' } }
export function setzeSchluessel(wert) {
  const k = String(wert || '').trim()
  try { if (k) localStorage.setItem(KEY_API, k); else localStorage.removeItem(KEY_API) } catch {}
  hatSchluessel.set(!!k)
  flugspeicher.update((s) => ({ ...s, gesperrtBis: 0 }))
  fluglauf.update((l) => ({ ...l, fehler: null }))
  if (k) aktualisiereFluege()
}

export const FEHLER = {
  schluessel: () => t('RapidAPI lehnt die Abfrage ab. Prüfe den Schlüssel und ob AeroDataBox abonniert ist.'),
  limit: () => t('Das Kontingent ist aufgebraucht. Im nächsten Monat geht es weiter.'),
  netz: () => t('Keine Verbindung. Es bleibt der letzte Stand.'),
  dienst: () => t('Der Flugdienst antwortet gerade nicht. Es bleibt der letzte Stand.'),
  bahn: () => t('Die Abfahrtstafel antwortet nicht. Prüfe den Bahnhof, zum Beispiel „Mainz Hbf“.'),
}

function db() {
  return new Promise((ok, nein) => {
    if (typeof indexedDB === 'undefined') return nein(new Error('kein IndexedDB'))
    const r = indexedDB.open(DB)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TOPF)) r.result.createObjectStore(TOPF) }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => nein(r.error)
  })
}
async function lies() {
  const d = await db()
  return new Promise((ok) => {
    try { const q = d.transaction(TOPF).objectStore(TOPF).get(SCHLUESSEL); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null) } catch { ok(null) }
  })
}
async function schreib(wert) {
  const d = await db()
  return new Promise((ok) => {
    try { const x = d.transaction(TOPF, 'readwrite'); x.objectStore(TOPF).put(JSON.parse(JSON.stringify(wert)), SCHLUESSEL); x.oncomplete = ok; x.onerror = ok } catch { ok() }
  })
}

function ohneAltes(staende, jetzt) {
  return Object.fromEntries(Object.entries(staende).filter(([, s]) => jetzt - (s.geholt || 0) <= HALTBAR))
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms))

async function hole(flug, schluessel, staende) {
  const datum = abfrageDatum(flug, staende)
  const adresse = `https://${HOST}/flights/number/${encodeURIComponent(flug.nr)}/${datum}?dateLocalRole=Departure&withAircraftImage=false&withLocation=false`
  const r = await fetch(adresse, { headers: { 'x-rapidapi-key': schluessel, 'x-rapidapi-host': HOST } })
  if (r.status === 204) return { leer: true }
  if (r.status === 401 || r.status === 403) return { fehler: 'schluessel' }
  if (r.status === 429) return { fehler: 'limit' }
  if (!r.ok) return { fehler: 'dienst' }
  const daten = leseAntwort(await r.json(), datum)
  return daten ? { daten } : { leer: true }
}

async function holeZug(zug) {
  const r = await fetch(`https://${BAHN}/${encodeURIComponent(zug.bahnhof)}.json?version=3`)
  if (!r.ok) return { fehler: 'bahn' }
  const j = await r.json()
  if (j.error) return { fehler: 'bahn' }
  const daten = leseZug(j, zug)
  return daten ? { daten } : { leer: true }
}

function melde(flug, liste) {
  const wichtig = liste.filter((a) => a.wichtig)
  if (!wichtig.length) return
  const text = wichtig.map((a) => a.text).join(' · ')
  zeigeToast(t('{nr}: {text}', { nr: flug.nr, text }), 'fehler', 7000)
}

async function lauf({ liste = null, vonHand = false } = {}) {
  const schluessel = leseSchluessel()
  const stand = get(flugspeicher)
  const jetzt = Date.now()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (vonHand) fluglauf.update((l) => ({ ...l, fehler: 'netz' }))
    return
  }
  const { fluege: fl, zuege } = get(fluege)
  const fluegeFrei = schluessel && (vonHand || stand.gesperrtBis <= jetzt)
  const zuHolen = (liste || [
    ...fl.filter((f) => faellig(f, stand.staende[f.id], jetzt, stand.staende)),
    ...zuege.filter((z) => zugFaellig(z, stand.staende[z.id], jetzt)),
  ]).filter((f) => f.art === 'bahn' || fluegeFrei)
  if (!zuHolen.length) return

  fluglauf.set({ ...get(fluglauf), laden: true, fehler: null })
  let { staende, zaehler, gesperrtBis } = stand
  staende = { ...staende }
  let fehler = null
  for (const [i, flug] of zuHolen.entries()) {
    const bahn = flug.art === 'bahn'
    if (!bahn && !darfAbfragen(zaehler, Date.now(), { vonHand })) { fehler = 'limit'; continue }
    if (i) await warte(PAUSE)
    let antwort
    try { antwort = bahn ? await holeZug(flug) : await hole(flug, schluessel, staende) } catch { fehler = 'netz'; break }
    const nun = Date.now()
    if (!bahn) zaehler = { monat: monatVon(nun), anzahl: genutzt(zaehler, nun) + 1 }
    if (antwort.fehler) {
      fehler = antwort.fehler
      if (fehler === 'limit') gesperrtBis = nun + SPERRE
      if (bahn) continue
      break
    }
    const alt = staende[flug.id]
    const neu = aenderungen(alt?.daten, antwort.daten)
    staende[flug.id] = {
      geholt: nun, leer: !!antwort.leer, daten: antwort.daten || alt?.daten || null,
      verlauf: [...neu.map((a) => ({ zeit: nun, text: a.text })), ...(alt?.verlauf || [])].slice(0, 12),
    }
    melde(flug, neu)
    flugspeicher.update((s) => ({ ...s, staende: { ...staende }, zaehler, gesperrtBis }))
  }
  flugspeicher.update((s) => ({ ...s, staende, zaehler, gesperrtBis }))
  fluglauf.set({ laden: false, fehler, zeit: Date.now() })
  await schreib(get(flugspeicher)).catch(() => {})
}

let laeuft = null
/** Fällige Flüge holen. Mit `vonHand` auch dann, wenn gerade keiner fällig ist. */
export function aktualisiereFluege({ liste = null, vonHand = false } = {}) {
  if (laeuft) return laeuft
  laeuft = lauf({ liste, vonHand }).catch(() => {}).finally(() => { laeuft = null; zeigeVorAbflug() })
  return laeuft
}

export function jetztAbfragen(flug = null) {
  const s = get(flugspeicher)
  const { fluege: fl, zuege } = get(fluege), jetzt = Date.now()
  const baldZug = zuege.filter((z) => Math.abs(abflugMs(z, s.staende[z.id]) - jetzt) <= 3 * 3600e3)
  const liste = flug ? [flug] : [...baldZug, ...naechsteGruppe(fl, s.staende, jetzt)]
  return aktualisiereFluege({ liste, vonHand: true })
}

// Einmal je Flug, sobald er in die letzten 24 Stunden kommt und die App offen ist
async function zeigeVorAbflug() {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible' || get(dialogAnfrage)) return
  const s = get(flugspeicher), jetzt = Date.now()
  const flug = flugImFokus(get(fluege).alle, s.staende, jetzt, s.popup)
  if (!flug) return
  flugspeicher.update((x) => ({ ...x, popup: { ...x.popup, [flug.id]: true } }))
  schreib(get(flugspeicher)).catch(() => {})
  const stand = s.staende[flug.id], d = stand?.daten
  const stunden = Math.max(0, stundenBis(abflugMs(flug, stand, s.staende), jetzt))
  const teile = []
  if (d) teile.push(`${d.ab.ort || d.ab.iata} → ${d.an.ort || d.an.iata}`, statusText(d, jetzt))
  if (d?.ab.terminal) teile.push(t('Terminal {wert}', { wert: d.ab.terminal }))
  if (d?.ab.gate) teile.push(t('Gate {wert}', { wert: d.ab.gate }))
  if (d?.ab.schalter) teile.push(t('Check-in {wert}', { wert: d.ab.schalter }))
  if (d?.ab.gleis) teile.push(t('Gleis {wert}', { wert: d.ab.gleis }))
  if (flug.sitz) teile.push(t('Sitzplatz {wert}', { wert: flug.sitz }))
  const bahn = flug.art === 'bahn'
  const zum = await frage({
    titel: bahn ? t('Zug {nr} in {stunden} Stunden', { nr: flug.nr, stunden }) : t('Flug {nr} in {stunden} Stunden', { nr: flug.nr, stunden }),
    text: teile.join(' · ') || (bahn ? t('Live-Daten kommen etwa 3 Stunden vor der Abfahrt.') : t('Gleich gibt es hier die aktuellen Daten.')),
    ja: t('Ansehen'), nein: t('Später'),
  })
  if (zum) geh('mehr/fluege')
  else zeigeVorAbflug()
}

let gestartet = false
/** Einmal je App-Start: letzten Stand laden, dann bei jedem Anlass prüfen, ob etwas fällig ist. */
export async function starteFluege() {
  if (gestartet || typeof window === 'undefined') return
  gestartet = true
  hatSchluessel.set(!!leseSchluessel())
  try {
    const c = await lies()
    if (c?.staende) {
      const staende = ohneAltes(c.staende, Date.now())
      flugspeicher.set({ staende, zaehler: c.zaehler || null, popup: c.popup || {}, gesperrtBis: c.gesperrtBis || 0 })
      if (Object.keys(staende).length !== Object.keys(c.staende).length) schreib(get(flugspeicher)).catch(() => {})
    }
  } catch {}
  let warten = null
  buchungen.subscribe(() => { clearTimeout(warten); warten = setTimeout(() => aktualisiereFluege(), 1500) })
  setInterval(() => { if (document.visibilityState === 'visible') aktualisiereFluege() }, TAKT)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') aktualisiereFluege() })
}
