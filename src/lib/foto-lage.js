// Fotolage am Ort: Licht, Mond, Milchstraße und Himmel. Sonne, Mond und Sterne sind reine
// Rechnung und gehen offline, Wolken und Sicht kommen dazu, wenn Netz da ist.
import * as SunCalc from 'suncalc'
import { je } from './i18n.js'

const RAD = Math.PI / 180
const MIN = 60000
const STUNDE = 3600000
// Mitte der Milchstraße (J2000), Grenzen für brauchbare Aufnahmen
const GZ_RA = 266.417, GZ_DEC = -29.008
export const MW_HOEHE = 10
const MOND_HELL = 0.15

const gueltig = (d) => d instanceof Date && !isNaN(d)


export function richtung(grad) {
  const de = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'], en = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return je(de, en)[Math.round(((grad % 360) + 360) % 360 / 45) % 8]
}

/** Höhe und Kompassrichtung der Milchstraßen-Mitte. */
export function milchstrasse(zeit, lat, lon) {
  const tage = zeit.getTime() / 86400000 + 2440587.5 - 2451545
  const lst = (280.46061837 + 360.98564736629 * tage + lon) * RAD
  const h = lst - GZ_RA * RAD, f = lat * RAD, d = GZ_DEC * RAD
  const hoch = Math.asin(Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(h))
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(f) - Math.tan(d) * Math.cos(f))
  return { hoehe: hoch / RAD, richtung: ((az / RAD + 180) % 360 + 360) % 360 }
}

/** Sonnenzeiten des Ortstags: Mittag am Ort als Anker, damit es zur Zeitzone des Geräts nicht kippt. */
const tagesZeiten = (basis, lat, lon, tage = 0) => {
  const mittag = new Date(Date.UTC(basis.getUTCFullYear(), basis.getUTCMonth(), basis.getUTCDate() + tage, 12) - (lon / 15) * STUNDE)
  return SunCalc.getTimes(mittag, lat, lon)
}
const ortsTag = (jetzt, lon) => new Date(jetzt.getTime() + (lon / 15) * STUNDE)

/** Die laufende oder kommende Nacht: von Sonnenuntergang bis Sonnenaufgang. */
export function nachtVon(jetzt, lat, lon) {
  const tag = ortsTag(jetzt, lon)
  const heute = tagesZeiten(tag, lat, lon)
  const nachMitternacht = gueltig(heute.sunrise) && jetzt < heute.sunrise
  const abend = nachMitternacht ? tagesZeiten(tag, lat, lon, -1) : heute
  const morgen = nachMitternacht ? heute : tagesZeiten(tag, lat, lon, 1)
  return { von: abend.sunset, bis: morgen.sunrise, abend, morgen }
}

const fenster = (punkte) => {
  // Längster zusammenhängender Abschnitt
  let best = null, lauf = null
  for (const p of punkte) {
    if (p.ok) { lauf = lauf ? { ...lauf, bis: p.zeit, spitze: p.mw?.hoehe > lauf.spitze.hoehe ? p.mw : lauf.spitze } : { von: p.zeit, bis: p.zeit, spitze: p.mw || { hoehe: -90 } } }
    else lauf = null
    if (lauf && (!best || lauf.bis - lauf.von > best.bis - best.von)) best = lauf
  }
  return best && best.bis > best.von ? best : null
}

/** Wann ist es wirklich dunkel, wann stört der Mond nicht, wann steht die Milchstraße hoch genug? */
export function nachtFenster(lat, lon, jetzt, schritt = 10) {
  const n = nachtVon(jetzt, lat, lon)
  if (!gueltig(n.von) || !gueltig(n.bis)) return { nacht: n, dunkel: null, frei: null, mw: null, mondZiel: null }
  const punkte = []
  for (let z = n.von.getTime(); z <= n.bis.getTime(); z += schritt * MIN) {
    const zeit = new Date(z)
    const sonne = SunCalc.getPosition(zeit, lat, lon).altitude
    const mond = SunCalc.getMoonPosition(zeit, lat, lon).altitude
    const hell = SunCalc.getMoonIllumination(zeit).fraction
    const mw = milchstrasse(zeit, lat, lon)
    const dunkel = sonne < -18, frei = dunkel && (mond < 0 || hell < MOND_HELL)
    punkte.push({ zeit, dunkel, frei, mw })
  }
  const dunkel = fenster(punkte.map((p) => ({ zeit: p.zeit, ok: p.dunkel })))
  const frei = fenster(punkte.map((p) => ({ zeit: p.zeit, ok: p.frei })))
  const mw = fenster(punkte.map((p) => ({ zeit: p.zeit, ok: p.frei && p.mw.hoehe >= MW_HOEHE, mw: p.mw })))
  return { nacht: n, dunkel, frei, mw }
}

/** Mond heute: Helligkeit, Phase, Auf- und Untergang mit Richtung. */
export function mondLage(lat, lon, jetzt) {
  const i = SunCalc.getMoonIllumination(jetzt)
  // Die nächsten Durchgänge durch den Horizont, unabhängig von der Zeitzone des Geräts
  let auf = null, unter = null, aufRichtung = null, unterRichtung = null
  let vorher = SunCalc.getMoonPosition(jetzt, lat, lon).altitude
  for (let z = jetzt.getTime() + 5 * MIN; z <= jetzt.getTime() + 30 * STUNDE && !(auf && unter); z += 5 * MIN) {
    const zeit = new Date(z), p = SunCalc.getMoonPosition(zeit, lat, lon)
    if (vorher < 0 && p.altitude >= 0 && !auf) { auf = zeit; aufRichtung = p.azimuth }
    if (vorher >= 0 && p.altitude < 0 && !unter) { unter = zeit; unterRichtung = p.azimuth }
    vorher = p.altitude
  }
  const phase = i.fraction < 0.03 ? je('Neumond', 'New moon') : i.fraction > 0.97 ? je('Vollmond', 'Full moon') : i.phase < 0.5 ? je('zunehmend', 'waxing') : je('abnehmend', 'waning')
  return { prozent: Math.round(i.fraction * 100), phase, auf, unter, aufRichtung, unterRichtung }
}

/** Licht des Tages: nächste goldene und blaue Stunde, Sonnenrichtung. */
export function lichtLage(lat, lon, jetzt) {
  const tag = ortsTag(jetzt, lon)
  const h = tagesZeiten(tag, lat, lon), m = tagesZeiten(tag, lat, lon, 1)
  const richtungBei = (t) => (gueltig(t) ? SunCalc.getPosition(t, lat, lon).azimuth : null)
  const sonne = SunCalc.getPosition(jetzt, lat, lon)
  const heuteAbendVorbei = gueltig(h.dusk) && jetzt > h.dusk
  const morgens = gueltig(h.goldenHourEnd) && jetzt < h.goldenHourEnd ? h : m
  const abends = heuteAbendVorbei ? m : h
  return {
    morgen: { blauVon: morgens.dawn, goldVon: morgens.sunrise, goldBis: morgens.goldenHourEnd, richtung: richtungBei(morgens.sunrise) },
    abend: { goldVon: abends.goldenHour, goldBis: abends.sunset, blauBis: abends.dusk, richtung: richtungBei(abends.sunset) },
    jetzt: { hoehe: sonne.altitude, richtung: sonne.azimuth },
  }
}

// Größere Städte, grob nach Lichtglocke: Radius bis „stark“ und bis „spürbar“ in Kilometern
const STAEDTE = [
  ['Perth', -31.95, 115.86, 45, 110], ['Sydney', -33.87, 151.21, 55, 130], ['Melbourne', -37.81, 144.96, 55, 130], ['Brisbane', -27.47, 153.03, 50, 120],
  ['Adelaide', -34.93, 138.6, 35, 90], ['Gold Coast', -28.02, 153.4, 30, 70], ['Canberra', -35.28, 149.13, 20, 60], ['Newcastle', -32.93, 151.78, 20, 60],
  ['Hobart', -42.88, 147.33, 15, 45], ['Darwin', -12.46, 130.84, 15, 45], ['Cairns', -16.92, 145.77, 12, 35], ['Townsville', -19.26, 146.82, 12, 35],
  ['Geelong', -38.15, 144.36, 15, 45], ['Bunbury', -33.33, 115.64, 10, 30], ['Mandurah', -32.53, 115.72, 12, 35], ['Geraldton', -28.77, 114.61, 8, 25],
  ['Kalgoorlie', -30.75, 121.47, 8, 25], ['Albany', -35.02, 117.88, 6, 20], ['Broome', -17.96, 122.24, 5, 15], ['Karratha', -20.74, 116.85, 6, 18], ['Port Hedland', -20.31, 118.6, 6, 18], ['Alice Springs', -23.7, 133.88, 6, 20],
]
const km = (a, b, c, d) => {
  const h = Math.sin(((c - a) * RAD) / 2) ** 2 + Math.cos(a * RAD) * Math.cos(c * RAD) * Math.sin(((d - b) * RAD) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
/** Schätzung des Stadtlichts in Australien. Außerhalb: null, das wissen wir dort nicht. */
export function stadtLicht(lat, lon) {
  if (lat > -9 || lat < -44 || lon < 112 || lon > 155) return null
  let stufe = 0, stadt = null, abstand = 0
  for (const [name, a, b, stark, spuerbar] of STAEDTE) {
    const d = km(lat, lon, a, b), s = d <= stark ? 2 : d <= spuerbar ? 1 : 0
    if (s > stufe || (s === stufe && s && d < abstand)) { stufe = s; stadt = name; abstand = d }
  }
  return { stufe, stadt, km: Math.round(abstand) }
}

const SCHAUER = [
  ['Quadrantiden', 'Quadrantids', 1, 3], ['Lyriden', 'Lyrids', 4, 22], ['Eta-Aquariiden', 'Eta Aquariids', 5, 6], ['Südliche Delta-Aquariiden', 'Southern Delta Aquariids', 7, 30],
  ['Perseiden', 'Perseids', 8, 12], ['Orioniden', 'Orionids', 10, 21], ['Leoniden', 'Leonids', 11, 17], ['Geminiden', 'Geminids', 12, 14],
]
/** Sternschnuppen-Schauer, wenn sein Höhepunkt höchstens zwei Tage entfernt ist. */
export function schauerBei(jetzt) {
  for (const [de, en, m, t] of SCHAUER) {
    for (const j of [jetzt.getFullYear() - 1, jetzt.getFullYear(), jetzt.getFullYear() + 1]) {
      if (Math.abs(new Date(j, m - 1, t).getTime() - jetzt.getTime()) <= 2.5 * 86400000) return { name: je(de, en), tag: new Date(j, m - 1, t) }
    }
  }
  return null
}

/** Nächste Nacht mit mindestens einer freien Stunde Milchstraße, höchstens 45 Tage voraus. */
export function naechsteMilchstrasse(lat, lon, jetzt) {
  for (let t = 1; t <= 45; t++) {
    const f = nachtFenster(lat, lon, new Date(jetzt.getTime() + t * 86400000), 20).mw
    if (f && f.bis - f.von >= STUNDE) return f
  }
  return null
}

/** Mittelwerte des Himmels zwischen zwei Zeiten aus den Stundenwerten von Open-Meteo. */
export function himmelIn(wetter, von, bis) {
  if (!wetter?.time?.length) return null
  const idx = wetter.time.map((_, i) => i).filter((i) => wetter.time[i] * 1000 >= von.getTime() - STUNDE / 2 && wetter.time[i] * 1000 <= bis.getTime() + STUNDE / 2)
  if (!idx.length) return null
  const mw = (k) => { const w = idx.map((i) => wetter[k]?.[i]).filter((x) => x != null); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null }
  const maxi = (k) => { const w = idx.map((i) => wetter[k]?.[i]).filter((x) => x != null); return w.length ? Math.max(...w) : null }
  return { wolken: mw('cloud_cover'), tief: mw('cloud_cover_low'), mittel: mw('cloud_cover_mid'), hoch: mw('cloud_cover_high'), sicht: mw('visibility'), wind: mw('wind_speed_10m'), boeen: maxi('wind_gusts_10m'), temp: mw('temperature_2m'), taupunkt: mw('dew_point_2m'), regen: maxi('precipitation_probability') }
}

const STUFEN = [[0.7, 'top'], [0.45, 'gut'], [0.2, 'maessig'], [-1, 'schlecht']]
export const stufeVon = (wert) => STUFEN.find(([g]) => wert >= g)[1]

/** Wert der Nacht 0 bis 1: freie Stunden, Wolken und Stadtlicht. */
export function nachtWert(f, himmel, licht) {
  const ziel = f.mw || f.frei
  if (!ziel) return 0
  const stunden = (ziel.bis - ziel.von) / STUNDE
  const w = himmel?.wolken
  const stadt = !licht ? 0.85 : [1, 0.65, 0.3][licht.stufe]
  return Math.min(1, stunden / (f.mw ? 3 : 5)) * (f.mw ? 1 : 0.75) * stadt * (w == null ? 0.8 : (1 - w / 100) ** 1.5)
}
/** Wert des Sonnenlichts: tiefe Wolken verdecken die Sonne, hohe und mittlere färben sich. */
export function lichtWert(himmel) {
  if (!himmel) return 0.5
  if (himmel.tief > 70 || himmel.regen > 60) return 0.15
  const oben = (himmel.mittel || 0) + (himmel.hoch || 0)
  return oben >= 20 && oben <= 110 ? 0.9 : oben < 20 ? 0.6 : 0.4
}

/** Alles für die Fotolage. jetzt: Date, wetter: Stundenwerte oder null. */
export function fotoLage(lat, lon, jetzt, wetter = null) {
  const f = nachtFenster(lat, lon, jetzt)
  const licht = lichtLage(lat, lon, jetzt)
  const mond = mondLage(lat, lon, jetzt)
  const stadt = stadtLicht(lat, lon)
  const ziel = f.mw || f.frei || f.dunkel
  const himmelNacht = ziel ? himmelIn(wetter, ziel.von, ziel.bis) : null
  const naechstesLicht = gueltig(licht.abend.goldVon) && jetzt < licht.abend.goldBis && (jetzt > licht.morgen.goldBis || licht.morgen.goldBis > licht.abend.goldBis) ? 'abend' : licht.morgen.goldBis < licht.abend.goldBis ? 'morgen' : 'abend'
  const lichtZiel = licht[naechstesLicht]
  const himmelLicht = gueltig(lichtZiel.goldVon) ? himmelIn(wetter, lichtZiel.goldVon, lichtZiel.goldBis) : null
  const wertNacht = nachtWert(f, himmelNacht, stadt), wertLicht = lichtWert(himmelLicht)
  const nacht = wertNacht >= 0.45 || wertNacht >= wertLicht
  return {
    f, licht, mond, stadt, himmelNacht, himmelLicht, naechstesLicht, schauer: schauerBei(jetzt),
    wert: Math.max(wertNacht, wertLicht), stufe: stufeVon(Math.max(wertNacht, wertLicht)),
    fokus: nacht ? (f.mw ? 'milchstrasse' : f.frei ? 'sterne' : 'mond') : naechstesLicht,
    wertNacht, wertLicht, pol: { richtung: lat < 0 ? 180 : 0, hoehe: Math.abs(lat) },
    tau: himmelNacht?.taupunkt != null && himmelNacht.temp - himmelNacht.taupunkt <= 2.5,
  }
}

const FRISCH = 60 * MIN
let speicher = null
/** Stundenwerte des Himmels, höchstens stündlich neu. Ohne Netz null. */
export async function holeHimmel(lat, lon, jetzt = Date.now()) {
  if (speicher && jetzt - speicher.zeit < FRISCH && Math.abs(speicher.lat - lat) + Math.abs(speicher.lon - lon) < 0.2) return speicher.werte
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
  try {
    const felder = 'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_gusts_10m,temperature_2m,dew_point_2m,precipitation_probability'
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${felder}&forecast_days=3&timeformat=unixtime`)
    if (!r.ok) return null
    const { hourly } = await r.json()
    speicher = { zeit: jetzt, lat, lon, werte: hourly }
    return hourly
  } catch { return null }
}
