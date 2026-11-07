// Sperrungen an den eigenen Routen (V29): erkennen, fragen, umleiten, wieder zurück.
//
// Ablauf: Die Route wird ganz normal berechnet, auch durch eine Sperrung.
// Führt sie durch eine Sperrung von Main Roads WA, kommt ein Fenster mit der Frage, ob die App eine
// Umleitung berechnen soll. Ja: Umleitung auf dem eigenen Straßennetz (Pisten-Netz, sonst
// Hauptstraßen), auch wenn Netz da ist, denn OSRM kennt die Sperrungen nicht. Nein: Route bleibt.
// Je Route und Sperrung fragt die App nur einmal; an der Route bleibt ein Knopf für später.
// Wer einmal „Umleitung“ gesagt hat, bekommt sie bei geänderten Stopps von selbst wieder.
// Ist die Sperrung aufgehoben (frischer Stand von Main Roads), nimmt die App wieder den normalen Weg.
// Flächenwarnungen (Feuer, Flut, Zyklon) sperren nie (sperrungen.js).
import { get } from 'svelte/store'
import { strassenlage } from './strassenlage-dienst.js'
import { sperrtFuer, sperrungenAnRoute } from './sperrungen.js'
import { offlineRoute } from './routing-offline.js'
import { routeRechnen, speichereRoute, gerade, rechnet, veraltet } from './routen-dienst.js'
import { stopsSignatur } from './routing.js'
import { updateReise } from './userdata.js'
import { frage, dialogAnfrage } from './dialog.js'
import { zeigeToast } from './toast.js'
import { je } from './i18n.js'
import { zahl } from './format.js'
import { ymd, plusTage } from './plan.js'

const GEFRAGT = 'tb-sperr-gefragt'
const laeuft = new Set()
const ohneUmleitung = new Set()   // Route|Stopps|Sperrungen, für die es keine Umleitung gab (nicht jedes Mal neu)

function gefragt() { try { return JSON.parse(localStorage.getItem(GEFRAGT) || '[]') } catch { return [] } }
function merkeGefragt(keys) {
  try { localStorage.setItem(GEFRAGT, JSON.stringify([...new Set([...gefragt(), ...keys])].slice(-400))) } catch {}
}

/** Meldungen, die für diese Route sperren (4WD-Regel) */
export const sperrendeFuer = (r, meldungen) => (meldungen || []).filter((m) => sperrtFuer(m, { allrad: !!r.allrad }))

/** Routen, um die sich die Prüfung kümmert: mit Linie, auf der Straße, nicht vorbei, keine Idee */
function relevant(r, heute) {
  if (!r?.route?.geometry?.length || r.route.flug || gerade(r) || r.idee || veraltet(r)) return false
  if (r.von && plusTage(r.von, Math.max(1, r.tage || 1)) < heute) return false
  return true
}

const zeile = (b) => je(`${b.meldung.strasse} (${b.meldung.sperrungDe || b.meldung.level}${b.meldung.artDe ? ', ' + b.meldung.artDe : ''}) bei km ${zahl(b.km)}`,
  `${b.meldung.strasse} (${b.meldung.sperrung || b.meldung.level}${b.meldung.art ? ', ' + b.meldung.art : ''}) at km ${zahl(b.km)}`)

/**
 * Umleitung um die Sperrungen auf der Route berechnen. still: ohne Meldung, wenn es keine gibt.
 * Liefert true, wenn die Route jetzt die Umleitung ist.
 */
export async function umleitungRechnen(r, { still = false } = {}) {
  if (laeuft.has(r.id)) return false
  const lage = get(strassenlage)
  const sperr = sperrendeFuer(r, lage.meldungen)
  const vorher = r.route
  const betroffen = sperrungenAnRoute(vorher?.geometry, sperr, { allrad: !!r.allrad })
  if (!betroffen.length) return false
  const schluessel = [r.id, stopsSignatur(r.stops), betroffen.map((b) => b.meldung.id).join(',')].join('|')
  if (still && ohneUmleitung.has(schluessel)) return false
  laeuft.add(r.id)
  rechnet.update((s) => ({ ...s, [r.id]: true }))
  try {
    const res = await offlineRoute(r.stops, { meidePiste: !!r.nurBefestigt, allrad: !!r.allrad, sperrungen: sperr })
    const noch = res ? sperrungenAnRoute(res.route.geometry, sperr, { allrad: !!r.allrad }) : []
    if (!res || noch.length) {
      ohneUmleitung.add(schluessel)
      if (!still) zeigeToast(je('Keine Umleitung gefunden: Die Sperrung lässt sich auf den bekannten Straßen nicht umfahren. Die Route bleibt.', 'No detour found: the closure cannot be bypassed on the known roads. The route stays.'), 'fehler', 6000)
      return false
    }
    const route = {
      ...res.route, quelle: res.quelle, gebiet: res.gebiet, offline: false,
      berechnetAm: new Date().toISOString(), sig: stopsSignatur(r.stops),
      umleitung: {
        sperrungen: betroffen.map((b) => ({ id: b.meldung.id, strasse: b.meldung.strasse, was: [b.meldung.sperrungDe || b.meldung.level, b.meldung.artDe].filter(Boolean).join(', '), wasEn: [b.meldung.sperrung || b.meldung.level, b.meldung.art].filter(Boolean).join(', '), km: b.km })),
        mehrKm: res.route.km - (vorher?.km || 0), mehrMin: res.route.dauerMin - (vorher?.dauerMin || 0), vorherKm: vorher?.km || null, stand: lage.zeit || null,
      },
    }
    const umgehen = [...new Set([...(r.umgehen || []), ...betroffen.map((b) => b.meldung.id)])]
    await speichereRoute(r, route, { umgehen })
    zeigeToast('⛔ ' + je(`Umleitung für „${r.name}“: ${umleitungText(route.umleitung)}`, `Detour for “${r.name}”: ${umleitungText(route.umleitung)}`), 'ok', 6000)
    return true
  } finally {
    laeuft.delete(r.id)
    rechnet.update((s) => ({ ...s, [r.id]: false }))
  }
}

/** „85 km mehr, 1 h 10 min länger“ bzw. „8 km kürzer, 29 min länger“ */
export function umleitungText(u) {
  if (!u) return ''
  const km = u.mehrKm > 0 ? je(`${zahl(u.mehrKm)} km mehr`, `${zahl(u.mehrKm)} km more`) : u.mehrKm < 0 ? je(`${zahl(-u.mehrKm)} km kürzer`, `${zahl(-u.mehrKm)} km shorter`) : je('gleich weit', 'same distance')
  const m = Math.abs(u.mehrMin || 0), dauer = m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
  const zeit = u.mehrMin > 0 ? je(`${dauer} länger`, `${dauer} longer`) : u.mehrMin < 0 ? je(`${dauer} kürzer`, `${dauer} shorter`) : ''
  return [km, zeit].filter(Boolean).join(', ')
}

/**
 * Alle Routen prüfen. Läuft im Hintergrund (RoutenDienst.svelte), wenn sich Routen oder die
 * Straßenlage ändern.
 */
export async function pruefeSperrungen(reisen, lage = get(strassenlage)) {
  if (!lage?.zeit) return
  const heute = ymd(new Date())
  const frisch = !lage.ausCache && !lage.fehler
  const fragen = []
  for (const r of reisen || []) {
    if (!relevant(r, heute) || laeuft.has(r.id) || get(rechnet)[r.id]) continue
    const sperr = sperrendeFuer(r, lage.meldungen)
    // 1. Umleitung, deren Sperrungen alle aufgehoben sind: wieder der normale Weg
    if (r.route.umleitung) {
      const aktiv = r.route.umleitung.sperrungen.some((s) => sperr.some((m) => m.id === s.id))
      if (!aktiv && frisch) {
        updateReise(r.id, { umgehen: [] })
        zeigeToast('✅ ' + je(`Sperrung aufgehoben: „${r.name}“ fährt wieder den normalen Weg.`, `Closure lifted: “${r.name}” takes the normal way again.`), 'ok', 6000)
        routeRechnen({ ...r, umgehen: [] })
      }
      continue
    }
    const betroffen = sperrungenAnRoute(r.route.geometry, sperr, { allrad: !!r.allrad })
    if (!betroffen.length) continue
    // 2. Schon einmal „Umleitung“ gesagt (z. B. vor geänderten Stopps): ohne Frage wieder umleiten
    if (betroffen.some((b) => (r.umgehen || []).includes(b.meldung.id))) { umleitungRechnen(r, { still: true }); continue }
    // 3. Neu: einmal fragen
    const keys = betroffen.map((b) => `${r.id}|${b.meldung.id}`)
    const schon = gefragt()
    if (keys.every((k) => schon.includes(k))) continue
    fragen.push({ r, betroffen, keys })
  }
  // Ein Fenster nach dem anderen, nie über ein anderes offenes Fenster
  for (const f of fragen) {
    if (get(dialogAnfrage)) return
    merkeGefragt(f.keys)
    const stand = lage.zeit ? new Date(lage.zeit).toLocaleTimeString(je('de-DE', 'en-AU'), { hour: '2-digit', minute: '2-digit' }) : ''
    const ja = await frage({
      titel: je('⛔ Sperrung auf deiner Route', '⛔ Closure on your route'),
      text: je(`„${f.r.name}“ führt durch: ${f.betroffen.map(zeile).join('; ')}. Laut Main Roads WA${stand ? `, Stand ${stand}` : ''}. Soll die App eine Umleitung berechnen? Sonst bleibt die Route, wie sie ist.`,
        `“${f.r.name}” goes through: ${f.betroffen.map(zeile).join('; ')}. According to Main Roads WA${stand ? `, as of ${stand}` : ''}. Should the app calculate a detour? Otherwise the route stays as it is.`),
      ja: je('Umleitung berechnen', 'Calculate detour'), nein: je('Route so lassen', 'Keep route'),
    })
    if (ja) await umleitungRechnen(f.r)
  }
}
