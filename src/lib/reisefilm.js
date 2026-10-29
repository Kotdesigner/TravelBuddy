// Reise-Film: reine Logik ohne Browser. Zeitplan der Szenen, Auswahl der Fotos je
// Etappe, Kameraflug über die Kugel, Ken-Burns-Bewegung, Videoformat.
//
// Ablauf des Films:
//   Titel „Western Australia“ mit Reisedaten
//   je Etappe: Flug über die Kugel → Route zeichnet sich ein (Name, Datum) → 0 bis 3 Fotos
//   Bilanz (km, Tage)
// Ziel: 30 bis 60 Sekunden. Gezeichnet wird in ReiseFilm.svelte bzw. reisefilm-zeichnen.js.

import { etappenMitDatum, routenDerEtappe, tageZwischen } from './plan.js'
import { verdichte, vektor, lonlat, blick } from './globus.js'
import { t } from './i18n.js'

export const MIN_S = 30
export const MAX_S = 60
export const FPS = 30
export const BREITE = 720
export const HOEHE = 1280

// Grunddauern in Sekunden
export const DAUER = { titel: 3.4, flug: 2.2, route: 2.6, foto: 2.3, bilanz: 4.2 }

// ---------- Easing ----------
const klemme = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x)
export const linear = (t) => klemme(t)
export const ausklang = (t) => 1 - Math.pow(1 - klemme(t), 3)                 // ease-out cubic
export const sanft = (t) => { t = klemme(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }   // ease-in-out cubic
/** Ein- und Ausblenden einer Szene: 0 → 1 in `rein` Sekunden, am Ende 1 → 0 in `raus` Sekunden. */
export function blende(sek, dauer, rein = 0.35, raus = 0.35) {
  if (dauer <= 0) return 0
  const a = rein > 0 ? klemme(sek / rein) : 1
  const b = raus > 0 ? klemme((dauer - sek) / raus) : 1
  return sanft(Math.min(a, b))
}

// ---------- Fotos je Etappe ----------
/**
 * Bis zu `max` Fotos aus dem Logbuch im Zeitraum der Etappe. Möglichst von verschiedenen
 * Tagen, gleichmäßig über den Zeitraum verteilt; je Tag zuerst das erste Foto.
 * @param journal  [{ id, datum, ort, fotos: [dataURL] }]
 * @param etappe   { von, bis }
 * @returns [{ src, datum, ort, id }]  id = `${eintragId}:${index}`
 */
export function fotosDerEtappe(journal, etappe, max = 3) {
  if (!etappe?.von || max <= 0) return []
  const bis = etappe.bis || etappe.von
  const tage = (journal || [])
    .filter((e) => e && e.datum >= etappe.von && e.datum <= bis && Array.isArray(e.fotos) && e.fotos.length)
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
  if (!tage.length) return []
  const alle = []
  // Runde 0: erstes Foto jedes Tages, Runde 1: zweites …
  const maxN = Math.max(...tage.map((e) => e.fotos.length))
  for (let r = 0; r < maxN; r++) {
    for (const e of tage) if (e.fotos[r]) alle.push({ src: e.fotos[r], datum: e.datum, ort: e.ort || '', id: `${e.id}:${r}`, runde: r })
  }
  const erste = alle.filter((f) => f.runde === 0)
  let wahl
  if (erste.length >= max) {
    // gleichmäßig über die Tage verteilen
    wahl = []
    for (let i = 0; i < max; i++) {
      const k = max === 1 ? Math.floor((erste.length - 1) / 2) : Math.round((i * (erste.length - 1)) / (max - 1))
      wahl.push(erste[k])
    }
    wahl = [...new Set(wahl)]
  } else wahl = alle.slice(0, max)
  return wahl
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
    .map(({ src, datum, ort, id }) => ({ src, datum, ort, id }))
}

// ---------- Linien und Blick einer Etappe ----------
const istFlug = (x) => (x?.art || 'auto') === 'flug' || !!x?.route?.flug
const mitKoord = (x) => (x?.stops || []).filter((s) => s && s.lat != null && s.lon != null)
function linieVon(x, farbe) {
  const st = mitKoord(x)
  const geo = x.route?.geometry?.length >= 2 ? x.route.geometry : st.map((p) => [p.lon, p.lat])
  return geo.length >= 2 ? { coords: verdichte(geo, istFlug(x)), farbe: x.farbe || farbe, flug: istFlug(x) } : null
}
/** Linien, Stopps und Namen einer Etappe (Anreise und ihre Routen). */
export function etappenGeo(reisen, etappe) {
  const r = etappe.reise
  const quellen = [r, ...routenDerEtappe(reisen, r.id)]
  const farbe = r.farbe || '#c1662f'
  const linien = quellen.map((x) => linieVon(x, farbe)).filter(Boolean)
  const punkte = []
  const namen = []
  for (const x of quellen) {
    const st = mitKoord(x)
    for (const s of st) punkte.push({ lon: s.lon, lat: s.lat, farbe: x.farbe || farbe, art: 'stopp' })
    if (st.length) namen.push({ lon: st[0].lon, lat: st[0].lat, text: st[0].name || '' })
    if (st.length > 1) namen.push({ lon: st[st.length - 1].lon, lat: st[st.length - 1].lat, text: st[st.length - 1].name || '' })
  }
  const alle = [...linien.flatMap((l) => l.coords), ...punkte.map((p) => [p.lon, p.lat])]
  return { linien, punkte, namen: namen.filter((n) => n.text).slice(0, 4), alle }
}

/** Ein Blick, der eine Etappe zeigt; ohne Koordinaten die Mitte Australiens. */
export function blickAuf(alle) {
  if (!alle?.length) return { mitte: [122, -25], P: 4.2 }
  return blick(alle, { fuellen: 0.56, minP: 1.22 })
}

// ---------- Gesamtbilanz ----------
/** km: aus dem Logbuch (Feld distance_km), sonst aus den geplanten Routen. Tage: erste bis letzte Etappe. */
export function gesamtBilanz(etappen, reisen, journal) {
  if (!etappen?.length) return { km: 0, kmArt: 'geplant', tage: 0, etappen: 0, von: null, bis: null }
  const von = etappen.reduce((m, e) => (e.von < m ? e.von : m), etappen[0].von)
  const bis = etappen.reduce((m, e) => (e.bis > m ? e.bis : m), etappen[0].bis)
  const tage = tageZwischen(von, bis) + 1
  let gefahren = 0
  for (const e of journal || []) {
    if (!e?.datum || e.datum < von || e.datum > bis) continue
    const k = Number(e.felder?.distance_km)
    if (Number.isFinite(k) && k > 0) gefahren += k
  }
  if (gefahren > 0) return { km: Math.round(gefahren), kmArt: 'gefahren', tage, etappen: etappen.length, von, bis }
  const ids = new Set(etappen.map((e) => e.reise.id))
  let geplant = 0
  for (const r of reisen || []) {
    if (ids.has(r.id) || (r.etappeId && ids.has(r.etappeId))) {
      const k = Number(r.route?.km)
      if (Number.isFinite(k) && k > 0 && !istFlug(r)) geplant += k
    }
  }
  return { km: Math.round(geplant), kmArt: 'geplant', tage, etappen: etappen.length, von, bis }
}

// ---------- Zeitplan ----------
/**
 * Szenen mit Start und Dauer (Sekunden). Passt die Länge in 30 bis 60 s ein. Zu lang:
 * erst alles etwas schneller (bis 75 %), dann weniger Fotos je Etappe (bis eines), dann
 * schneller bis 55 %, erst ganz zum Schluss ohne Fotos. Zu kurz: alles etwas ruhiger
 * (bis 180 %), danach Titel und Bilanz länger.
 * Ein kurzer Flug (Etappe gleich nebenan) dauert weniger lang: `e.flugGewicht` 0,5 bis 1.
 * @param etappen [{ id, name, fotos: [..], flugGewicht? }]
 * @returns { szenen: [{ typ, start, dauer, etappe, foto, nr }], gesamt, fotosJeEtappe }
 */
export function zeitplan(etappen, { min = MIN_S, max = MAX_S, maxFotos = 3 } = {}) {
  const liste = etappen || []
  const roh = (fj) => {
    const sz = [{ typ: 'titel', dauer: DAUER.titel, fest: true }]
    liste.forEach((e, nr) => {
      const g = Number.isFinite(e.flugGewicht) ? klemme(e.flugGewicht, 0.5, 1) : 1
      sz.push({ typ: 'flug', dauer: DAUER.flug * g, etappe: e, nr })
      sz.push({ typ: 'route', dauer: DAUER.route, etappe: e, nr })
      ;(e.fotos || []).slice(0, fj).forEach((foto, i) => sz.push({ typ: 'foto', dauer: DAUER.foto, etappe: e, nr, foto, fotoNr: i }))
    })
    sz.push({ typ: 'bilanz', dauer: DAUER.bilanz, fest: true })
    return sz
  }
  const summe = (sz) => sz.reduce((n, s) => n + s.dauer, 0)
  const faktorFuer = (sz) => {
    const fest = sz.filter((s) => s.fest).reduce((n, s) => n + s.dauer, 0)
    const variabel = summe(sz) - fest
    return variabel > 0 ? (max - fest) / variabel : 1
  }
  let fotosJe = Math.max(0, maxFotos)
  let sz = roh(fotosJe)
  let faktor = 1
  if (summe(sz) > max) {
    // 1. schneller bis 75 %, sonst ein Foto weniger je Etappe (mindestens eines)
    while (faktorFuer(sz) < 0.75 && fotosJe > 1) { fotosJe--; sz = roh(fotosJe) }
    faktor = faktorFuer(sz)
    // 2. bis 55 %, und nur wenn auch das nicht reicht: ohne Fotos
    if (faktor < 0.55 && fotosJe > 0) {
      const ohne = roh(0)
      if (faktorFuer(ohne) >= 0.55) { fotosJe = 0; sz = ohne }
    }
    faktor = Math.max(0.55, Math.min(1, faktorFuer(sz)))
  } else if (summe(sz) < min) {
    const fest = sz.filter((s) => s.fest).reduce((n, s) => n + s.dauer, 0)
    const variabel = summe(sz) - fest
    if (variabel > 0) faktor = Math.min(1.8, (min - fest) / variabel)
  }
  for (const s of sz) if (!s.fest) s.dauer *= faktor
  // Immer noch zu kurz (kaum Etappen): Titel und Bilanz strecken
  const rest = min - summe(sz)
  if (rest > 0) for (const s of sz) if (s.fest) s.dauer += rest / 2
  let t = 0
  for (const s of sz) { s.start = t; t += s.dauer; delete s.fest }
  return { szenen: sz, gesamt: t, fotosJeEtappe: fotosJe }
}

/** Welche Szene läuft zur Zeit t (Sekunden)? p = Fortschritt 0..1 in der Szene. */
export function szeneBei(plan, t) {
  const sz = plan.szenen
  if (!sz.length) return null
  if (t <= 0) return { szene: sz[0], index: 0, p: 0, sek: 0 }
  for (let i = 0; i < sz.length; i++) {
    const s = sz[i]
    if (t < s.start + s.dauer) { const sek = t - s.start; return { szene: s, index: i, p: sek / s.dauer, sek } }
  }
  const s = sz[sz.length - 1]
  return { szene: s, index: sz.length - 1, p: 1, sek: s.dauer }
}

// ---------- Kamera ----------
/** Winkel zwischen zwei Punkten in Grad. */
export function winkel(a, b) {
  const va = vektor(a), vb = vektor(b)
  return Math.acos(klemme(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1)) * 180 / Math.PI
}
/** Flug zwischen zwei Blicken: Mitte auf dem Großkreis, Abstand im Bogen hinaus und wieder herein. */
export function kameraFlug(von, nach, p) {
  const e = sanft(p)
  const va = vektor(von.mitte), vb = vektor(nach.mitte)
  const d = Math.acos(klemme(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1))
  let mitte
  if (d < 1e-6) mitte = [...nach.mitte]
  else {
    const s = Math.sin(d), k1 = Math.sin((1 - e) * d) / s, k2 = Math.sin(e * d) / s
    mitte = lonlat([va[0] * k1 + vb[0] * k2, va[1] * k1 + vb[1] * k2, va[2] * k1 + vb[2] * k2])
  }
  const lp = Math.log(Math.max(1.02, von.P)) * (1 - e) + Math.log(Math.max(1.02, nach.P)) * e
  // Je weiter der Weg, desto höher der Bogen (bis etwa Faktor 2,6)
  const hub = Math.min(1.6, (d * 180 / Math.PI) / 40)
  const P = Math.exp(lp) * (1 + hub * Math.sin(Math.PI * e))
  return { mitte, P: Math.min(40, P) }
}

/** Anteil einer Linie zeichnen (für das Einzeichnen der Route). */
export function teilLinie(coords, p) {
  if (!coords?.length) return []
  if (p >= 1) return coords.slice()
  if (p <= 0) return [coords[0]]
  const seg = []
  let ges = 0
  for (let i = 1; i < coords.length; i++) {
    const l = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
    seg.push(l); ges += l
  }
  if (ges === 0) return coords.slice()
  let ziel = ges * p
  const out = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    const l = seg[i - 1]
    if (ziel >= l) { out.push(coords[i]); ziel -= l; if (ziel <= 1e-12) break; continue }
    const k = l ? ziel / l : 0
    out.push([coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * k, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * k])
    break
  }
  return out
}
/** Mehrere Linien nacheinander einzeichnen: p über die Gesamtlänge verteilt. */
export function teilLinien(linien, p) {
  const len = linien.map((l) => {
    let n = 0
    for (let i = 1; i < l.coords.length; i++) n += Math.hypot(l.coords[i][0] - l.coords[i - 1][0], l.coords[i][1] - l.coords[i - 1][1])
    return n
  })
  const ges = len.reduce((a, b) => a + b, 0)
  if (!ges) return p > 0 ? linien : []
  let rest = ges * klemme(p)
  const out = []
  linien.forEach((l, i) => {
    if (rest <= 0) return
    const q = len[i] ? Math.min(1, rest / len[i]) : 1
    out.push({ ...l, coords: teilLinie(l.coords, q) })
    rest -= len[i]
  })
  return out
}

// ---------- Ken Burns ----------
/** Langsames Heranfahren mit leichter Drift; Richtung wechselt je Foto. */
export function kenBurns(p, nr = 0) {
  const e = sanft(p)
  const richtung = [[1, 0.6], [-1, 0.4], [0.6, -1], [-0.6, -0.8]][nr % 4]
  return { skala: 1.04 + 0.1 * e, dx: richtung[0] * 0.03 * (e - 0.5), dy: richtung[1] * 0.03 * (e - 0.5) }
}
/** Bild so skalieren, dass es den Rahmen füllt (object-fit: cover). */
export function deckend(bw, bh, rw, rh) {
  const s = Math.max(rw / bw, rh / bh)
  return { w: bw * s, h: bh * s, x: (rw - bw * s) / 2, y: (rh - bh * s) / 2 }
}

// ---------- Videoformat ----------
export const FORMATE = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
/** Erstes Format, das der Browser aufnehmen kann (Safari: MP4, sonst WebM). */
export function waehleFormat(istUnterstuetzt) {
  if (typeof istUnterstuetzt !== 'function') return null
  for (const f of FORMATE) { try { if (istUnterstuetzt(f)) return f } catch {} }
  return null
}
export const endung = (mime) => (String(mime || '').startsWith('video/mp4') ? 'mp4' : 'webm')

// ---------- Film zusammenstellen ----------
/** Alle Etappen der Reise mit Geo, Blick und Fotos, dazu Zeitplan und Bilanz. */
export function filmDaten({ reisen = [], journal = [], gesamtStart, maxFotos = 3 } = {}) {
  const plan = etappenMitDatum(reisen, gesamtStart)
  let vorher = { mitte: [128, -26] }
  const etappen = plan.map((e) => {
    const geo = etappenGeo(reisen, e)
    const b = blickAuf(geo.alle)
    // Kurzer Weg zur nächsten Etappe = kürzerer Flug
    const flugGewicht = 0.5 + 0.5 * Math.min(1, winkel(vorher.mitte, b.mitte) / 25)
    vorher = b
    return {
      id: e.reise.id, name: e.reise.name || t('Etappe'), farbe: e.reise.farbe || '#c1662f',
      von: e.von, bis: e.bis, tage: e.tage, geo, blick: b, flugGewicht,
      fotos: fotosDerEtappe(journal, e, maxFotos),
    }
  })
  const bilanz = gesamtBilanz(plan, reisen, journal)
  const zp = zeitplan(etappen, { maxFotos })
  return { etappen, bilanz, zeitplan: zp }
}
