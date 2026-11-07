// Routen-Dienst: alles, was eine Strecke ausrechnet — Straßenroute, Tank-Lücken,
// Sehenswertes an der Route, Wetter an der Strecke.
//
// Die Rechnung darf nicht davon abhängen, welcher Bildschirm gerade offen ist. Deshalb
// ein Modul mit Stores, angestoßen einmal von
// RoutenDienst.svelte (in App.svelte eingebunden), gelesen von jedem RouteEditor.
import { ladePois } from './versorgung.js'
import { fehlerText } from './fehlertext.js'
import { writable, get } from 'svelte/store'
import { updateReise, userData } from './userdata.js'
import { zeigeToast } from './toast.js'
import { berechneRoute, flugRoute, tankAnalyse, stopsSignatur } from './routing.js'
import { offlineRoute, gebietFuer, pistenStand, pistenLaden, allradBesser } from './routing-offline.js'
import { tankLuecken, orteAnRoute, wetterPunkte } from './routenhinweise.js'
import { holeGefahren } from './gefahren.js'
import { poiRegionFuer } from './karten-config.js'
import { kurzTag } from './format.js'
import { t, je } from './i18n.js'

export const rechnet = writable({})     // reise.id -> true, solange gerechnet wird
export const routeMsg = writable({})    // reise.id -> Fehlermeldung
export const hinweise = writable({})    // reise.id -> { key, tank, vorschlaege, ohneTankdaten }
export const wetter = writable({})      // reise.id -> { laedt, stand, treffer, punkte, fehler }

// Reichweite pro Tankfüllung, die Wahl bleibt über Neustarts erhalten (Vorgabe 500 km).
const RW_KEY = 'tb-reichweite-km'
let rwStart = 500
try { rwStart = Number(localStorage.getItem(RW_KEY)) || 500 } catch {}
export const reichweite = writable(rwStart)
reichweite.subscribe((v) => { try { localStorage.setItem(RW_KEY, String(v)) } catch {} })

const setze = (store, id, wert) => store.update((s) => ({ ...s, [id]: wert }))

export const artVon = (r) => r.art || 'auto'
/** Flug und Bahn werden als gerade Linie gezeichnet, nur das Auto braucht eine Straßenroute. */
// Flug, Bahn und Boot laufen als gerade Linie, nur das Auto bekommt eine Straßenroute
export const gerade = (r) => ['flug', 'bahn', 'boot'].includes(artVon(r))
export const artPasst = (r) => !r.route || gerade(r) === !!r.route.flug
/** Route passt zum 4WD-Schalter (Flüge, Bahn, Boot kennen ihn nicht) */
export const allradPasst = (r) => !r.route || gerade(r) || !!r.route.allrad === !!r.allrad

export const veraltet = (r) => !!(r.route && r.route.sig !== stopsSignatur(r.stops))
export const stops = (r) => r.stops || []

// ---------- Tankstellen ----------
const fuelCache = new Map()
/** Nur Regionen mit `pois-<id>.json`; sonst stünde die Tank-Warnung ohne Daten da. */
export function regionFuer(st) {
  const s = (st || []).find((x) => x.lat != null)
  if (!s) return null
  return poiRegionFuer([[s.lon, s.lat]])?.id ?? null
}
/** Alle POI-Regionen, durch die die Stopps führen (wie die Versorgung sie lädt). */
export function regionenFuer(st) {
  return [...new Set((st || []).filter((x) => x.lat != null).map((x) => poiRegionFuer([[x.lon, x.lat]])?.id).filter(Boolean))]
}
/** Tankstellen aller Regionen der Route, doppelte (gleiche Lage) nur einmal. */
export async function ladeTankstellenFuer(st) {
  const teile = await Promise.all(regionenFuer(st).map((id) => ladeTankstellen(id)))
  const gesehen = new Set()
  return teile.flat().filter((t) => { const k = t.x + ',' + t.y; if (gesehen.has(k)) return false; gesehen.add(k); return true })
}
export async function ladeTankstellen(regionId) {
  if (!regionId) return []
  if (fuelCache.has(regionId)) return fuelCache.get(regionId)
  let fuel = []
  try { fuel = (await ladePois(regionId)).filter((p) => p.k === 'fuel') } catch {}
  fuelCache.set(regionId, fuel)
  return fuel
}

// ---------- Route rechnen ----------
export async function routeRechnen(r) {
  setze(routeMsg, r.id, '')
  // Flug = Luftlinie, funktioniert auch ohne Netz und ohne Tank-Analyse.
  if (gerade(r)) {
    try { updateReise(r.id, { route: flugRoute(r.stops, artVon(r) === 'boot' ? { kmh: 30, puffer: 10 } : artVon(r) === 'bahn' ? { kmh: 130, puffer: 10 } : undefined) }) }
    catch (e) { setze(routeMsg, r.id, fehlerText(e)) }
    return
  }
  setze(rechnet, r.id, true)
  try {
    // Online OSRM. Ohne Netz oder wenn OSRM ausfällt: offline auf dem Straßennetz (V29),
    // Pisten-Netz zuerst, sonst Hauptstraßen. Findet keins einen Weg, bleibt die Schätzung.
    let route = null
    const netzDa = istOnline()
    if (netzDa) {
      try { route = await berechneRoute(r.stops) } catch (e) { route = await offlineBerechnen(r); if (!route) throw e }
      if (r.allrad && !route.offline) {
        const p = await offlineBerechnen(r)
        if (p?.quelle === 'pisten' && allradBesser(route, p)) route = { ...p, offline: false, allradWahl: true, osrmKm: route.km }
      }
    } else {
      route = await offlineBerechnen(r)
      if (!route) { setze(routeMsg, r.id, ohneNetzKeinWeg(r)); return }
    }
    await speichereRoute(r, route)
  } catch (e) {
    setze(routeMsg, r.id, fehlerText(e))
  } finally {
    setze(rechnet, r.id, false)
  }
}

/** Route mit Tank-Analyse speichern (gemeinsam für normale Routen und Umleitungen) */
export async function speichereRoute(r, route, extra = {}) {
  route.allrad = !!r.allrad
  const fuel = await ladeTankstellenFuer(r.stops)
  const rw = get(reichweite)
  route.tank = tankAnalyse(route.geometry, fuel, rw, route.km)
  route.reichweite = rw
  updateReise(r.id, { route, ...extra })
}

/** Woher die Zahlen einer Route kommen, für die Zeile unter der Route */
export function routeQuelleText(route) {
  if (!route) return ''
  if (route.flug) return t('Flugstrecke (Luftlinie, Zeit geschätzt)')
  if (route.umleitung) {
    const netz = route.quelle === 'pisten' ? je('Pisten-Netz', 'track network') : je('Hauptstraßen-Netz', 'main road network')
    const stand = route.umleitung.stand ? new Date(route.umleitung.stand).toLocaleTimeString(je('de-DE', 'en-AU'), { hour: '2-digit', minute: '2-digit' }) : ''
    return je(`Umleitung um die Sperrung, berechnet auf dem ${netz}${stand ? ` · Main Roads WA ${stand}` : ''}`, `Detour around the closure, calculated on the ${netz}${stand ? ` · Main Roads WA ${stand}` : ''}`)
  }
  if (route.allradWahl) return je(`4WD auf dem Pisten-Netz, kürzer als die Straßenroute von OSRM (${route.osrmKm} km)`, `4WD on the track network, shorter than the OSRM road route (${route.osrmKm} km)`)
  if (!route.offline) return t('Straßenroute (OSRM)')
  const netz = (route.quelle === 'pisten' ? je('offline berechnet, Pisten-Netz', 'calculated offline, track network') : je('offline berechnet, Hauptstraßen', 'calculated offline, main roads')) + (route.allrad ? ' · 4WD' : '')
  const anschluss = route.anschlussKm ? je(` · ${route.anschlussKm} km Luftlinie bis zur Straße`, ` · ${route.anschlussKm} km straight line to the road`) : ''
  return netz + anschluss + je(' · genau, sobald Netz da ist', ' · exact once you are online')
}

// Ohne Netz kein Weg zu allen Stopps: sagen, woran es liegt (die bisherige Route bleibt stehen)
function ohneNetzKeinWeg(r) {
  const g = gebietFuer(r.stops)
  const bleibt = r.route ? je(' Die bisherige Route bleibt.', ' The current route stays.') : je(' Echte km und Fahrzeit, sobald Netz da ist.', ' Real km and time once you are online.')
  if (!g) return je('Ohne Netz gibt es für diese Stopps kein Straßennetz auf dem Gerät.', 'Offline there is no road network on the device for these stops.') + bleibt
  if (!get(pistenStand)[g]) return je('Ohne Netz fand die App auf den Hauptstraßen keinen Weg zu allen Stopps, einer liegt zu weit abseits. Mit dem Pisten-Netz dieses Gebiets klappt es meist (Plan, Karte, Offline-Routen).', 'Offline, the app found no way to all stops on the main roads, one is too far off. The track network for this area usually works (Plan, Map, Offline routes).') + bleibt
  return je('Ohne Netz fand die App keinen Weg zu allen Stopps.', 'Offline, the app found no way to all stops.') + bleibt
}

const istOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

/** Offline-Route auf dem Straßennetz, in der Form von berechneRoute, oder null */
export async function offlineBerechnen(r) {
  let res = null
  try { res = await offlineRoute(r.stops, { meidePiste: !!r.nurBefestigt, allrad: !!r.allrad }) } catch { res = null }
  if (!res) return null
  return { ...res.route, quelle: res.quelle, gebiet: res.gebiet, berechnetAm: new Date().toISOString(), sig: stopsSignatur(r.stops) }
}

export const autoVersucht = new Map() // reise.id -> zuletzt automatisch versuchte Signatur|Art|Netz

/** Verkehrsmittel umstellen → Route neu bestimmen (km, Zeit und Sprit ändern sich). */
export function setArt(r, art) {
  updateReise(r.id, { art })
  autoVersucht.delete(r.id)
  if ((r.stops || []).filter((x) => x.lat != null).length >= 2) routeRechnen({ ...r, art })
}

/** 4WD an oder aus: Route neu bestimmen. Beim Einschalten mit Netz das Pisten-Netz des Gebiets laden. */
export async function setAllrad(r, an) {
  updateReise(r.id, { allrad: an })
  autoVersucht.delete(r.id)
  const neu = { ...r, allrad: an }
  const g = gebietFuer(r.stops)
  if (an && g && !get(pistenStand)[g] && istOnline()) {
    try { await pistenLaden(g); zeigeToast(je('Pisten-Netz für 4WD gespeichert, Routen stimmen jetzt auch offline auf Pisten', 'Track network saved for 4WD, routes on tracks now work offline too'), 'ok') } catch {}
  }
  if ((r.stops || []).filter((x) => x.lat != null).length >= 2) routeRechnen(neu)
}

/** Tank-Warnung bei geänderter Reichweite ohne Neu-Routing aktualisieren. */
export function tankNeu(r) {
  if (!r.route?.geometry) return
  ladeTankstellenFuer(r.stops).then((fuel) => {
    const rw = get(reichweite)
    updateReise(r.id, { route: { ...r.route, tank: tankAnalyse(r.route.geometry, fuel, rw, r.route.km), reichweite: rw } })
  })
}

/** Auto-Routing: fehlende/veraltete Routen nachrechnen, je Stand nur EIN Versuch. */
export function autoRouten(rs, online) {
  for (const r of rs) {
    const koord = (r.stops || []).filter((s) => s.lat != null)
    if (koord.length < 2) continue
    // Straßenroute ohne Netz: nur, wenn ein Offline-Straßennetz das Gebiet kennt (V29)
    if (!gerade(r) && !online && !gebietFuer(r.stops)) continue
    const sig = stopsSignatur(r.stops)
    // Fertig, außer eine Offline-Route und jetzt ist Netz da: dann genau nachrechnen
    if (r.route && r.route.sig === sig && artPasst(r) && allradPasst(r) && !(online && r.route.offline)) continue
    const versuch = sig + '|' + artVon(r) + '|' + (online ? 'on' : 'off') + '|' + (r.nurBefestigt ? '2wd' : '') + (r.allrad ? '4wd' : '')
    if (autoVersucht.get(r.id) === versuch) continue
    if (get(rechnet)[r.id]) continue
    autoVersucht.set(r.id, versuch)
    routeRechnen(r)
  }
}

// ---------- Hinweise entlang der Route ----------
// V16: Orte bis 75 km neben der Route schlägt die App vor (vorher 25 km), vorgemerkte bis 100 km und zuerst.
import { UMKREIS_VORSCHLAG, UMKREIS_VORGEMERKT, vorgemerkteIds, vorschlaegeMitMerkern } from './routenhinweise.js'
export { UMKREIS_VORSCHLAG, UMKREIS_VORGEMERKT, vorgemerkteIds, vorschlaegeMitMerkern }

// Einmal je Route und Ort melden, wenn ein vorgemerkter Ort an einer Route liegt
const GEMELDET = 'tb-vorgemerkt-gemeldet'
function meldeVorgemerkte(r, liste) {
  let schon = []
  try { schon = JSON.parse(localStorage.getItem(GEMELDET) || '[]') } catch {}
  const neu = liste.filter((v) => v.vorgemerkt && !schon.includes(`${r.id}:${v.ort.id}`))
  if (!neu.length) return
  try { localStorage.setItem(GEMELDET, JSON.stringify([...schon, ...neu.map((v) => `${r.id}:${v.ort.id}`)].slice(-500))) } catch {}
  const v = neu[0], name = r.stops?.[v.nachStopp]?.name
  const mehr = neu.length > 1 ? je(` (und ${neu.length - 1} weitere)`, ` (and ${neu.length - 1} more)`) : ''
  const nach = name ? je(`, passt nach ${name}`, `, fits after ${name}`) : ''
  zeigeToast('⭐ ' + je(`${v.ort.name} liegt an deiner Route „${r.name}“ (${v.abstand} km${nach})${mehr}. Einfügen in der Route unter den sehenswerten Orten.`,
    `${v.ort.name} is on your route “${r.name}” (${v.abstand} km${nach})${mehr}. Add it in the route under places worth seeing.`), 'ok', 7000)
}

export function hinweiseRechnen(rs, alleOrte, vorgemerkt = vorgemerkteIds(get(userData))) {
  const rw = get(reichweite)
  const h = get(hinweise)
  for (const r of rs) {
    if (!r.route?.geometry || r.route.flug || veraltet(r)) continue
    const key = [r.route.sig, r.route.km, rw, (r.nichtVorschlagen || []).join(','), alleOrte.length, vorgemerkt.join(','), UMKREIS_VORSCHLAG].join('|')
    if (h[r.id]?.key === key) continue
    ladeTankstellenFuer(r.stops).then((fuel) => {
      const tank = fuel.length ? tankLuecken(r.route.geometry, fuel, {
        reichweiteKm: rw, abKm: Math.max(150, Math.round(rw * 0.4)), gesamtKm: r.route.km,
        start: stops(r).find((s) => s.lat != null)?.name || 'Start',
        ziel: [...stops(r)].reverse().find((s) => s.lat != null)?.name || 'Ziel',
        ortsnamen: [...stops(r), ...alleOrte],
      }) : null
      const vorschlaege = vorschlaegeMitMerkern(orteAnRoute(r.route.geometry, alleOrte, r.stops, { maxKm: Math.max(UMKREIS_VORSCHLAG, UMKREIS_VORGEMERKT), ignoriert: r.nichtVorschlagen || [], gesamtKm: r.route.km }), vorgemerkt)
      if (!r.idee) meldeVorgemerkte(r, vorschlaege)
      setze(hinweise, r.id, { key, tank, vorschlaege, ohneTankdaten: !fuel.length })
      // Gespeicherte Kurzfassung korrigieren, wenn sie noch von der alten Rechnung stammt.
      if (tank && r.route.tank && r.route.tank.maxLuecke !== tank.maxLuecke) {
        updateReise(r.id, { route: { ...r.route, tank: { anzahlTank: tank.stationen, maxLuecke: tank.maxLuecke,
          von: '', bis: '', warnung: tank.maxLuecke > rw }, reichweite: rw } })
      }
    })
  }
}

// ---------- Wetter an der Strecke ----------
export const tagText = kurzTag

// „bei Carnarvon" (≤ 60 km) oder „ca. 90 km von Nanutarra" (≤ 250 km).
function naechsterName(p, namen) {
  let best = null
  for (const o of namen) {
    if (o.lat == null) continue
    const dx = (o.lon - p.lon) * Math.cos(p.lat * Math.PI / 180) * 111.32, dy = (o.lat - p.lat) * 110.57
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d <= 250 && (!best || d < best.d)) best = { d, name: o.name }
  }
  if (!best) return null
  return best.d <= 60 ? t('bei {name}', { name: best.name }) : t('ca. {km} km von {name}', { km: Math.round(best.d / 10) * 10, name: best.name })
}

export async function wetterPruefen(r, alleOrte = []) {
  if (!r.route?.geometry) return
  setze(wetter, r.id, { laedt: true })
  try {
    const pkt = wetterPunkte(r.route.geometry, 100, 60, r.route.km)
    const res = await holeGefahren(pkt.map((p, i) => ({ id: String(i), lat: p.lat, lon: p.lon })))
    const namen = [...stops(r), ...alleOrte]
    const treffer = []
    pkt.forEach((p, i) => {
      const g = res.get(String(i))
      for (const x of g?.gefahren || []) {
        const vorige = treffer.find((t) => t.typ === x.typ && p.km - t.bisKm <= 250)
        const name = naechsterName(p, namen) || t('Streckenkilometer {km}', { km: p.km })
        if (vorige) {
          vorige.bisKm = p.km
          if (x.stufe > vorige.stufe) Object.assign(vorige, { stufe: x.stufe, icon: x.icon, text: x.text, tag: x.tag, name })
        } else treffer.push({ typ: x.typ, icon: x.icon, text: x.text, stufe: x.stufe, tag: x.tag, name, vonKm: p.km, bisKm: p.km })
      }
    })
    treffer.sort((a, b) => b.stufe - a.stufe || a.vonKm - b.vonKm)
    setze(wetter, r.id, { stand: new Date().toISOString(), treffer, punkte: pkt.length })
  } catch (e) {
    setze(wetter, r.id, { fehler: 'Wetter: ' + fehlerText(e, 'Wetterdienst nicht erreichbar') })
  }
}

/** Etappe läuft gerade oder beginnt in ≤ 3 Tagen? Dann Wetter ihrer Routen einmal prüfen. */
const autoWetterVersucht = new Set()
export function autoWetter(rs, eintraege, heute, in3, alleOrte) {
  const laufend = new Set(eintraege.filter((e) => !(e.bis < heute || e.von > in3)).map((e) => e.reise.id))
  for (const r of rs) {
    const zuEtappe = laufend.has(r.id) || (r.etappeId && laufend.has(r.etappeId))
    if (!zuEtappe || !r.route?.geometry || r.route.flug || veraltet(r) || autoWetterVersucht.has(r.id)) continue
    autoWetterVersucht.add(r.id)
    wetterPruefen(r, alleOrte)
  }
}
