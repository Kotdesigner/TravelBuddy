// Fun Facts unterwegs: kurze, belegte Fakten zu dem Ort, an dem man ist, oder entlang der geplanten Route.
//
// Woher:
//  1. Vorab für Route und Etappen: Solange Netz da ist, holt die App für jeden geplanten Stopp die
//     Wikipedia-Artikel in der Nähe und speichert daraus kurze Fakten auf dem Gerät. Unterwegs ohne Netz
//     sind sie damit schon da.
//  2. Mit Netz zusätzlich live: Am aktuellen Standort kommen frische Fakten aus der Nähe dazu.
//  3. Immer: die Beschreibungen der Orte, die in der App stecken.
// Jeder Fakt trägt seine Quelle. Erfunden wird nichts: Der Text ist ein Satz aus dem Artikel.
//
// Wikipedia sieht dabei nur die Koordinaten der Abfrage (steht unter Datenschutz).

import { writable, get } from 'svelte/store'

export const RADIUS_SUCHE_M = 10000      // Umkreis je Abfrage bei Wikipedia
export const PAUSE_MS = 400              // freundlicher Abstand zwischen Abfragen
export const MAX_PUNKTE = 60             // höchstens so viele Routenpunkte je Vorab-Laden
export const MAX_FAKTEN = 800            // so viele Fakten bleiben höchstens auf dem Gerät
export const LIVE_ALLE_MS = 10 * 60e3    // live höchstens alle 10 Minuten …
export const LIVE_AB_KM = 5              // … und erst nach 5 km Weg

// ---------------------------------------------------------------- reine Hilfen

const rad = (g) => (g * Math.PI) / 180
/** Entfernung in km zwischen zwei Punkten { lat, lon } */
export function abstandKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

const plusTage = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

/**
 * Alle Punkte der geplanten Reise, für die sich Vorab-Fakten lohnen: Stopps von Routen und Etappen,
 * die heute oder später sind (oder kein Datum haben). Nahe beieinander liegende Punkte zählen einmal.
 */
export function routenPunkte(reisen = [], heute = new Date().toISOString().slice(0, 10), { max = MAX_PUNKTE, zusammenKm = 8 } = {}) {
  const kandidaten = []
  for (const r of reisen || []) {
    if (!r || !Array.isArray(r.stops)) continue
    const bis = r.von && r.tage ? plusTage(r.von, Math.max(0, Number(r.tage) - 1)) : null
    if (bis && bis < heute) continue
    for (const s of r.stops) if (s && typeof s.lat === 'number' && typeof s.lon === 'number') kandidaten.push({ lat: s.lat, lon: s.lon, name: s.name || '', von: r.von || '9999' })
  }
  kandidaten.sort((a, b) => a.von.localeCompare(b.von))
  const punkte = []
  for (const k of kandidaten) {
    if (punkte.some((p) => abstandKm(p, k) < zusammenKm)) continue
    punkte.push({ lat: k.lat, lon: k.lon, name: k.name })
    if (punkte.length >= max) break
  }
  return punkte
}

const SUPERLATIV = /\b(größte|grösste|größten|älteste|ältesten|erste|ersten|einzige|einzigen|längste|längsten|höchste|höchsten|westlichste|westlichsten|nördlichste|südlichste|östlichste|tiefste|seltene|seltensten|weltweit|largest|oldest|first|only|longest|highest|westernmost|northernmost|southernmost|easternmost|deepest|rarest|world's|unique)\b/i
const BENANNT = /\b(benannt|named after|named for|bedeutet|means|ursprünglich|originally|entdeckt|discovered)\b/i
const NUR_LAGE = /\b(\d[\d.,]*\s?(km|kilometres|kilometers|kilometer|mi))\b[^.]{0,40}\b(nördlich|südlich|östlich|westlich|north|south|east|west|nordöstlich|südwestlich|north[- ]?east|south[- ]?west)\b/i
const ADRESSE = /\b(located at|situated at|befindet sich (in|an) der|\d+[–-]?\d*\s+[A-Z][a-z]+\s+(Street|Road|Terrace|Avenue|Highway|Parade|Place|Straße))\b/
const LANGWEILIG = /^[^.]{0,80}\b(ist|war) (eine?|der|die|das) (kleine |kleiner |ehemalige )?(Stadt|Ortschaft|Ort|Gemeinde|Kleinstadt|Siedlung|Vorort|Verwaltungsgebiet|Local Government Area)\b|^[^.]{0,80}\bis an? (small |former )?(town|suburb|locality|local government area|shire)\b/i

/** Wikipedia-Auszug säubern: Vorlagenreste, Lautschrift in Klammern, doppelte Leerzeichen */
export function saeubere(text = '') {
  return String(text)
    .replace(/^(i\d)+\s*/, '')                       // Reste aus Koordinaten-Vorlagen, z. B. „i2i3i6“
    .replace(/\s*\((?:[^()]*\b(?:englisch|english|IPA|pronounced|ausgesprochen)\b[^()]*)\)/gi, '')
    .replace(/\s*\((?:englisch|english|engl\.)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')                    // Lautschrift wie [pɜːθ]
    .replace(/\s+/g, ' ')
    .trim()
}

/** In Sätze teilen, ohne bei Abkürzungen wie „ca.“ oder Zahlen wie „3.200“ zu trennen */
export function saetze(text = '') {
  const t = saeubere(text)
  return t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(0-9])/).map((s) => s.trim()).filter((s) => s.length > 0)
}

/** Wie spannend ist ein Satz? Zahlen, Superlative und Namensherkunft zählen, Standardsätze nicht. */
export function bewerte(satz = '') {
  let p = 0
  if (/\d/.test(satz)) p += 2
  if (SUPERLATIV.test(satz)) p += 3
  if (BENANNT.test(satz)) p += 2
  if (satz.length < 40 || satz.length > 240) p -= 2
  if (LANGWEILIG.test(satz)) p -= 3
  if (NUR_LAGE.test(satz) && !SUPERLATIV.test(satz)) p -= 4
  if (ADRESSE.test(satz) && !SUPERLATIV.test(satz)) p -= 4
  if (/\b(Unternehmen|Konzern|Aktiengesellschaft|company|corporation|Limited|Ltd|Pty|anchor and largest tenant|shopping centre|Einkaufszentrum)\b/i.test(satz)) p -= 4
  if ((satz.match(/\(/g) || []).length !== (satz.match(/\)/g) || []).length) p -= 6   // Klammerreste
  if (/^[a-zäöü)]/.test(satz)) p -= 6                                                      // Satzbruchstück
  if (/^(Dort|Hier|Sie|Er|Es|Diese[rs]?|It|They|There|This|These|Its)\b/.test(satz)) p -= 1.5                 // braucht den Satz davor
  return p
}

/** Aus einem Wikipedia-Artikel einen Fakt machen (oder null, wenn nichts Brauchbares drinsteht) */
export function faktAusArtikel(seite, sprache = 'de') {
  if (!seite?.extract || !seite.coordinates?.[0]) return null
  const liste = saetze(seite.extract)
  if (!liste.length) return null
  const best = liste.map((s, i) => ({ s, p: bewerte(s) - i * 0.25 })).sort((a, b) => b.p - a.p)[0]
  if (best.p < 1) return null
  return {
    id: `wp-${sprache}-${seite.pageid}`,
    titel: seite.title,
    text: best.s,
    lat: seite.coordinates[0].lat,
    lon: seite.coordinates[0].lon,
    quelle: sichereQuelle(seite.fullurl) || `https://${sprache}.wikipedia.org/?curid=${Number(seite.pageid) || 0}`,
    quelleName: 'Wikipedia',
    sprache,
    wert: Math.round(best.p * 10) / 10,
  }
}

/** Fakten aus den Ortsbeschreibungen der App (immer offline da) */
export function faktenAusOrten(orte = []) {
  return (orte || []).filter((o) => o?.beschreibung && typeof o.lat === 'number').map((o) => {
    const s = saetze(o.beschreibung)
    const text = s.length ? s.map((x) => ({ x, p: bewerte(x) })).sort((a, b) => b.p - a.p)[0].x : ''
    return text ? { id: `ort-${o.id}`, titel: o.anzeigeName || o.name, text, lat: o.lat, lon: o.lon, quelle: '', quelleName: 'TravelBuddy', sprache: '' } : null
  }).filter(Boolean)
}

/**
 * Den passenden Fakt für einen Punkt wählen: im Umkreis, noch nicht gezeigt, möglichst nah.
 * Sind alle schon gezeigt, fängt die Runde von vorne an.
 */
export function waehle(fakten = [], punkt, { umkreisKm = 20, gesehen = new Set(), ausser = null } = {}) {
  if (!punkt) return null
  // Spannende Fakten zuerst: jeder Punkt Spannung wiegt 3 km Weg auf
  const nah = fakten.map((f) => ({ f, km: abstandKm(punkt, f) })).filter((x) => x.km <= umkreisKm && x.f.id !== ausser).sort((a, b) => (a.km - 3 * (a.f.wert || 0)) - (b.km - 3 * (b.f.wert || 0)))
  if (!nah.length) return null
  const neu = nah.find((x) => !gesehen.has(x.f.id))
  return { ...(neu || nah[0]).f, km: Math.round((neu || nah[0]).km) }
}

/** Adresse für Wikipedia: Artikel im Umkreis samt Einleitung und Koordinaten */
export function wikiAdresse(punkt, sprache = 'de', radius = RADIUS_SUCHE_M) {
  const p = new URLSearchParams({
    action: 'query', generator: 'geosearch', ggscoord: `${punkt.lat.toFixed(5)}|${punkt.lon.toFixed(5)}`, ggsradius: String(radius), ggslimit: '10',
    prop: 'extracts|coordinates|info', inprop: 'url', exintro: '1', explaintext: '1', exsentences: '4', exlimit: '10', format: 'json', origin: '*',
  })
  return `https://${sprache}.wikipedia.org/w/api.php?${p}`
}

// ---------------------------------------------------------------- Einstellungen und Speicher

const KEY_CFG = 'tb-funfacts-cfg'
const KEY_GESEHEN = 'tb-funfacts-gesehen'
export const STANDARD = { an: true, fahren: true, umkreisKm: 20, vorlesen: false }

function liesJson(key, fallback) { try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { return { ...fallback } } }
export const funfactsCfg = writable(typeof localStorage === 'undefined' ? { ...STANDARD } : liesJson(KEY_CFG, STANDARD))
funfactsCfg.subscribe((c) => { try { localStorage.setItem(KEY_CFG, JSON.stringify(c)) } catch {} })

let gesehenListe = []
try { gesehenListe = JSON.parse(localStorage.getItem(KEY_GESEHEN) || '[]') } catch {}
export const gesehen = writable(new Set(gesehenListe))
export function alsGesehen(id) {
  gesehen.update((s) => { const n = new Set(s); n.add(id); try { localStorage.setItem(KEY_GESEHEN, JSON.stringify([...n].slice(-2000))) } catch {} return n })
}

/** Alle gespeicherten Fakten (Vorab und live), id → Fakt. Liegt in IndexedDB, nicht im Backup. */
export const fakten = writable({})
/** Stand des Vorab-Ladens: { laeuft, fertig, gesamt, zeit, fehler } */
export const vorabStand = writable({ laeuft: false, fertig: 0, gesamt: 0, zeit: null, fehler: '' })

const DB = 'tb-funfacts', TOPF = 'kv'
function idb(modus, fn) {
  return new Promise((ok, nein) => {
    if (typeof indexedDB === 'undefined') return ok(null)
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(TOPF)
    r.onerror = () => nein(r.error)
    r.onsuccess = () => {
      const db = r.result
      const tx = db.transaction(TOPF, modus)
      const erg = fn(tx.objectStore(TOPF))
      tx.oncomplete = () => { db.close(); ok(erg?.result ?? null) }
      tx.onerror = () => { db.close(); nein(tx.error) }
      tx.onabort = () => { db.close(); nein(tx.error || new Error('abgebrochen')) }
    }
  })
}
let geladen = false
export async function ladeGespeicherte() {
  if (geladen) return
  geladen = true
  try {
    const d = await idb('readonly', (s) => s.get('fakten'))
    if (d && typeof d === 'object') fakten.set(d.liste || {})
    if (d?.stand) vorabStand.update((v) => ({ ...v, zeit: d.stand.zeit, gesamt: d.stand.gesamt || 0, fertig: d.stand.gesamt || 0 }))
  } catch {}
}
async function speichere(stand) {
  const alle = get(fakten)
  let liste = alle
  const ids = Object.keys(alle)
  if (ids.length > MAX_FAKTEN) liste = Object.fromEntries(ids.slice(-MAX_FAKTEN).map((k) => [k, alle[k]]))
  try { await idb('readwrite', (s) => s.put({ liste, stand }, 'fakten')) } catch {}
}

// ---------------------------------------------------------------- Abrufen

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

/** Fakten für einen Punkt bei Wikipedia holen. Ohne deutschen Artikel gibt es den englischen. */
export async function holePunkt(punkt, sprache = 'de', { laden = globalThis.fetch } = {}) {
  const versuche = sprache === 'de' ? ['de', 'en'] : ['en']
  for (const lang of versuche) {
    const r = await laden(wikiAdresse(punkt, lang), { credentials: 'omit' })
    if (!r.ok) throw new Error(r.status === 429 ? 'limit' : 'dienst')
    const j = await r.json()
    const liste = Object.values(j?.query?.pages || {}).map((s) => faktAusArtikel(s, lang)).filter(Boolean)
    if (liste.length) return liste
  }
  return []
}

function nimmAuf(liste) {
  if (!liste.length) return
  fakten.update((alt) => { const neu = { ...alt }; for (const f of liste) neu[f.id] = f; return neu })
}

/** Vorab für die ganze geplante Route laden (mit Netz). Läuft nacheinander mit Pausen. */
export async function ladeFuerRoute(reisen, { sprache = 'de', laden = globalThis.fetch, warte = pause, heute } = {}) {
  const st = get(vorabStand)
  if (st.laeuft) return
  const punkte = routenPunkte(reisen, heute)
  vorabStand.set({ laeuft: true, fertig: 0, gesamt: punkte.length, zeit: st.zeit, fehler: '' })
  let fehler = ''
  for (let i = 0; i < punkte.length; i++) {
    try { nimmAuf(await holePunkt(punkte[i], sprache, { laden })) }
    catch (e) { fehler = e.message === 'limit' ? 'limit' : 'netz'; if (fehler === 'limit') await warte(3000) }
    vorabStand.update((v) => ({ ...v, fertig: i + 1 }))
    if (i < punkte.length - 1) await warte(PAUSE_MS)
  }
  const stand = { zeit: Date.now(), gesamt: punkte.length }
  vorabStand.set({ laeuft: false, fertig: punkte.length, gesamt: punkte.length, zeit: stand.zeit, fehler })
  await speichere(stand)
}

let letzteLive = null
/** Mit Netz: frische Fakten am aktuellen Standort (höchstens alle 10 Minuten und nach 5 km) */
export async function ladeInDerNaehe(pos, { sprache = 'de', laden = globalThis.fetch, jetzt = Date.now() } = {}) {
  if (!pos) return false
  if (letzteLive && jetzt - letzteLive.zeit < LIVE_ALLE_MS && abstandKm(letzteLive, pos) < LIVE_AB_KM) return false
  letzteLive = { lat: pos.lat, lon: pos.lon, zeit: jetzt }
  try { nimmAuf(await holePunkt(pos, sprache, { laden })); await speichere(get(vorabStand).zeit ? { zeit: get(vorabStand).zeit, gesamt: get(vorabStand).gesamt } : null); return true } catch { return false }
}
export function _liveZuruecksetzen() { letzteLive = null }

/** Vorlesen mit der Stimme des Geräts (wenn vorhanden) */
export function vorlesen(text, sprache = 'de') {
  try {
    if (!('speechSynthesis' in globalThis)) return false
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = sprache === 'en' ? 'en-AU' : 'de-DE'
    speechSynthesis.speak(u)
    return true
  } catch { return false }
}

/** Kennung der geplanten Route: ändert sie sich, lohnt neues Vorab-Laden */
export function routenKennung(reisen, heute) {
  return routenPunkte(reisen, heute).map((p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`).join(';')
}
const KEY_ROUTE = 'tb-funfacts-route'
/** Vorab-Laden, wenn die Route neu ist oder der letzte Lauf über einen Tag her ist (nur mit Netz) */
export async function vorabWennNoetig(reisen, { sprache = 'de', jetzt = Date.now() } = {}) {
  if (!get(funfactsCfg).an) return false
  await ladeGespeicherte()
  const kennung = routenKennung(reisen)
  if (!kennung) return false
  let alt = ''
  try { alt = localStorage.getItem(KEY_ROUTE) || '' } catch {}
  const zeit = get(vorabStand).zeit
  if (alt === kennung && zeit && jetzt - zeit < 24 * 3600e3) return false
  await ladeFuerRoute(reisen, { sprache })
  try { localStorage.setItem(KEY_ROUTE, kennung) } catch {}
  return true
}

/**
 * Nur echte Quellen als Link: https und Wikipedia. Alles andere (etwa „javascript:“ aus einer
 * präparierten Backup-Datei) wird verworfen, sonst führte ein Tipp auf „Quelle“ fremden Code aus.
 */
export function sichereQuelle(url) {
  try {
    const u = new URL(String(url || ''))
    return u.protocol === 'https:' && /(^|\.)wikipedia\.org$/.test(u.hostname) ? u.href : ''
  } catch { return '' }
}

/** Gemerkte Fakten eines Tages säubern: nur Einträge mit Text, keine doppelten, sichere Quelle */
export function saubereGelernt(liste) {
  if (!Array.isArray(liste)) return []
  const ids = new Set()
  const raus = []
  for (const g of liste) {
    if (!g || typeof g !== 'object' || typeof g.text !== 'string' || !g.text.trim()) continue
    const id = typeof g.id === 'string' && g.id ? g.id : 'ff-' + g.text.slice(0, 40)
    if (ids.has(id)) continue
    ids.add(id)
    raus.push({ id, titel: typeof g.titel === 'string' ? g.titel : '', text: g.text, quelle: sichereQuelle(g.quelle), quelleName: typeof g.quelleName === 'string' ? g.quelleName : '', ts: typeof g.ts === 'string' ? g.ts : '' })
  }
  return raus
}
