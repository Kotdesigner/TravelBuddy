// Reise-Film: malt ein einzelnes Bild zur Zeit t auf ein 2D-Canvas (Hochformat).
// Die Kugel kommt aus globus.js (eigener Renderer, kein MapLibre). Sie wird kleiner
// gerechnet und hochskaliert, damit die Aufnahme auch am iPhone in Echtzeit läuft.
// Stehende Kugeln (Route, Bilanz) werden einmal gerechnet und zwischengespeichert.

import { zeichneGlobus, zeichneGlobusSchnell, globusProjektion, zeichneUeberlagerung, blick } from './globus.js'
import { szeneBei, kameraFlug, teilLinien, kenBurns, deckend, blende, sanft, ausklang } from './reisefilm.js'
import { bereich, tagMonatJahr, zahl, tageText } from './format.js'
import { t, tn } from './i18n.js'
import { FAHRZEUG, verlauf, punktBei, kmText } from './reisefahrt.js'

const TITEL_SCHRIFT = "'Anton', Impact, 'Arial Narrow', sans-serif"
const TEXT_SCHRIFT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Liberation Sans', Arial, sans-serif"
const AKZENT = '#f0b453'
const CREME = '#f4ece0'

const neuesCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })

/** Bild aus einer data-URL laden (null, wenn es nicht geht). */
export function ladeBild(src) {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = src
  })
}

/**
 * @param daten   Ergebnis von filmDaten()
 * @param canvas  Ziel (wird auf breite × hoehe gesetzt)
 * @returns { vorbereiten(onFortschritt), zeichne(t), gesamt }
 */
export function baueFilm(daten, canvas, { breite = 720, hoehe = 1280, kugelPx = 720, bewegtPx = 480 } = {}) {
  canvas.width = breite; canvas.height = hoehe
  const ctx = canvas.getContext('2d')
  const W = breite, H = hoehe
  const plan = daten.zeitplan
  const etappen = daten.etappen
  const bilder = new Map()           // src → Image
  const kugelCache = new Map()       // Schlüssel → Canvas
  const kugelCv = neuesCanvas(bewegtPx, bewegtPx)   // bewegte Kugel (Titel, Flug), kleiner gerechnet
  const kugelZiel = W * 1.02          // angezeigte Kantenlänge der Kugel
  const kugelMitteY = H * 0.43
  let hintergrund = null

  const startBlick = { mitte: [128, -26], P: 5.2 }
  const alleCoords = etappen.flatMap((e) => e.geo.alle)
  const gesamtBlick = alleCoords.length ? blick(alleCoords, { fuellen: 0.6, minP: 1.4 }) : startBlick
  const linienBis = (nr) => etappen.slice(0, nr).flatMap((e) => e.geo.linien)
  const punkteBis = (nr) => etappen.slice(0, nr).flatMap((e) => e.geo.punkte)

  // ---------- Hintergrund: Weltraum mit Sternen (einmal) ----------
  function baueHintergrund() {
    const cv = neuesCanvas(W, H), c = cv.getContext('2d')
    const g = c.createRadialGradient(W / 2, kugelMitteY, W * 0.1, W / 2, kugelMitteY, H * 0.75)
    g.addColorStop(0, '#15305a'); g.addColorStop(0.45, '#0b1a33'); g.addColorStop(1, '#050b17')
    c.fillStyle = g; c.fillRect(0, 0, W, H)
    let s = 7
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let i = 0; i < 260; i++) {
      const r = rnd() < 0.9 ? 0.7 + rnd() * 0.6 : 1.3 + rnd() * 0.7
      c.globalAlpha = 0.35 + rnd() * 0.6
      c.fillStyle = rnd() < 0.2 ? '#cfe0ff' : '#ffffff'
      c.beginPath(); c.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2); c.fill()
    }
    c.globalAlpha = 1
    return cv
  }

  // ---------- Kugel ----------
  const dpr = kugelPx / 560
  // Stehende Kugeln: volle Qualität, einmal gerechnet
  function maleKugel(ziel, b, { linien = [], punkte = [], drehung = 0, namen = [] } = {}) {
    zeichneGlobus(ziel, { breite: kugelPx, hoehe: kugelPx, dpr: 1, mitte: b.mitte, P: b.P, linien, punkte, namen, drehung, schrift: TEXT_SCHRIFT })
  }
  // Bewegte Kugel: schneller Renderer. Ist das Gerät zu langsam für jedes Bild, wird die
  // Kugel seltener neu gerechnet (Text und Blenden laufen trotzdem flüssig weiter).
  let letzteKugelT = -1, kugelKosten = 0, kugelSzene = -1
  function maleBewegt(t, szeneNr, b, opt = {}) {
    const abstand = Math.min(1 / 12, Math.max(0, kugelKosten * 1.15 - 1 / 60))
    if (szeneNr === kugelSzene && letzteKugelT >= 0 && t - letzteKugelT < abstand && t >= letzteKugelT) return
    const a = performance.now()
    zeichneGlobusSchnell(kugelCv, { breite: bewegtPx, hoehe: bewegtPx, dpr: 1, mitte: b.mitte, P: b.P, linien: opt.linien || [], punkte: opt.punkte || [], drehung: opt.drehung || 0 })
    const k = (performance.now() - a) / 1000
    kugelKosten = kugelKosten ? kugelKosten * 0.8 + k * 0.2 : k
    letzteKugelT = t; kugelSzene = szeneNr
  }
  function kugelGecacht(schluessel, b, opt) {
    let cv = kugelCache.get(schluessel)
    if (!cv) { cv = neuesCanvas(kugelPx, kugelPx); maleKugel(cv, b, opt); kugelCache.set(schluessel, cv) }
    return cv
  }
  const kugelLage = () => ({ x: (W - kugelZiel) / 2, y: kugelMitteY - kugelZiel / 2, s: kugelZiel / kugelPx })
  function setzeKugel(cv, alpha = 1, zoom = 1) {
    const { x, y } = kugelLage()
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    const d = kugelZiel * zoom
    ctx.drawImage(cv, x + (kugelZiel - d) / 2, y + (kugelZiel - d) / 2, d, d)
    ctx.restore()
  }

  // ---------- Text ----------
  function passendeGroesse(text, schrift, gewicht, start, maxBreite, min = 22) {
    let g = start
    while (g > min) {
      ctx.font = `${gewicht} ${g}px ${schrift}`
      if (ctx.measureText(text).width <= maxBreite) break
      g -= 2
    }
    return g
  }
  function text(t, x, y, { groesse = 28, schrift = TEXT_SCHRIFT, gewicht = 700, farbe = CREME, ausrichtung = 'center', schatten = true, alpha = 1, abstand = 0 } = {}) {
    if (!t) return
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = `${gewicht} ${groesse}px ${schrift}`
    ctx.textAlign = ausrichtung; ctx.textBaseline = 'alphabetic'
    if ('letterSpacing' in ctx) ctx.letterSpacing = abstand + 'px'
    if (schatten) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2 }
    ctx.fillStyle = farbe
    ctx.fillText(t, x, y)
    ctx.restore()
  }
  /** Zeilen umbrechen (höchstens `max` Zeilen, sonst gekürzt). */
  function zeilen(t, maxBreite, max = 2) {
    const woerter = String(t || '').split(/\s+/).filter(Boolean)
    const out = []
    let z = ''
    for (const w of woerter) {
      const v = z ? z + ' ' + w : w
      if (ctx.measureText(v).width <= maxBreite || !z) z = v
      else { out.push(z); z = w }
    }
    if (z) out.push(z)
    if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, '') + ' …' }
    return out
  }
  function verlaufUnten(hoeheAnteil = 0.42, staerke = 0.78) {
    const y0 = H * (1 - hoeheAnteil)
    const g = ctx.createLinearGradient(0, y0, 0, H)
    g.addColorStop(0, 'rgba(5,11,23,0)'); g.addColorStop(1, `rgba(5,11,23,${staerke})`)
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0)
  }

  // ---------- Szenen ----------
  const zeitraum = daten.bilanz.von ? t('{tagMonatJahr} bis {tagMonatJahr2}', { tagMonatJahr: tagMonatJahr(daten.bilanz.von), tagMonatJahr2: tagMonatJahr(daten.bilanz.bis) }) : ''

  function szeneTitel(t, sek, dauer) {
    const p = sek / dauer
    const b = { mitte: startBlick.mitte, P: startBlick.P * (1.25 - 0.25 * ausklang(p)) }
    maleBewegt(t, 0, b, { drehung: -26 * (1 - sanft(Math.min(1, p * 1.1))) })
    setzeKugel(kugelCv, blende(sek, dauer, 0.6, 0))
    const a = blende(sek - 0.3, dauer - 0.3, 0.6, 0.45)
    verlaufUnten(0.4, 0.85 * a)
    const g = passendeGroesse('WESTERN AUSTRALIA', TITEL_SCHRIFT, 400, 92, W - 80)
    text('WESTERN', W / 2, H * 0.79, { groesse: g * 1.18, schrift: TITEL_SCHRIFT, gewicht: 400, alpha: a, abstand: 1 })
    text('AUSTRALIA', W / 2, H * 0.79 + g * 1.12, { groesse: g * 1.18, schrift: TITEL_SCHRIFT, gewicht: 400, farbe: AKZENT, alpha: a, abstand: 1 })
    text(zeitraum, W / 2, H * 0.79 + g * 1.12 + 56, { groesse: 27, alpha: blende(sek - 0.8, dauer - 0.8, 0.5, 0.4) })
    if (etappen.length) text(tn(etappen.length, '{n} Etappe', '{n} Etappen'), W / 2, H * 0.79 + g * 1.12 + 96, { groesse: 22, gewicht: 600, farbe: 'rgba(244,236,224,0.75)', alpha: blende(sek - 1.1, dauer - 1.1, 0.5, 0.4) })
  }

  function blickVor(nr) { return nr <= 0 ? startBlick : etappen[nr - 1].blick }

  function szeneFlug(t, index, sz, sek, dauer, vorher) {
    const e = etappen[sz.nr]
    const cam = kameraFlug(blickVor(sz.nr), e.blick, sek / dauer)
    maleBewegt(t, index, cam, { linien: linienBis(sz.nr), punkte: punkteBis(sz.nr) })
    setzeKugel(kugelCv)
    // Vom letzten Foto weich herüber
    if (vorher?.typ === 'foto' && sek < 0.45) zeichneFoto(vorher, vorher.dauer, vorher.dauer, 1 - sanft(sek / 0.45), false)
    // Zähler oben
    text(`${sz.nr + 1} / ${etappen.length}`, W / 2, 84, { groesse: 22, gewicht: 700, farbe: 'rgba(244,236,224,0.8)' })
  }

  function routenKugel(nr) {
    const e = etappen[nr]
    return kugelGecacht('route-' + nr, e.blick, { linien: linienBis(nr), punkte: punkteBis(nr) })
  }
  function etappenKarte(e, a) {
    if (a <= 0) return
    ctx.save()
    ctx.globalAlpha = a
    const y = H * 0.8 + (1 - a) * 18
    ctx.font = `400 10px ${TITEL_SCHRIFT}`
    let g = passendeGroesse(e.name.toUpperCase(), TITEL_SCHRIFT, 400, 76, W - 120, 40)
    ctx.font = `400 ${g}px ${TITEL_SCHRIFT}`
    const z = zeilen(e.name.toUpperCase(), W - 120, 2)
    if (z.length > 1) g = Math.round(g * 0.82)
    const hoeheText = z.length * g * 1.02
    // Farbband links
    ctx.fillStyle = e.farbe
    ctx.fillRect(48, y - g * 0.92, 8, hoeheText + 58)
    z.forEach((zeile, i) => text(zeile, 76, y + i * g * 1.02, { groesse: g, schrift: TITEL_SCHRIFT, gewicht: 400, ausrichtung: 'left' }))
    text(`${bereich(e.von, e.bis)}, ${tageText(e.tage)}`, 78, y + hoeheText + 18, { groesse: 27, gewicht: 700, farbe: AKZENT, ausrichtung: 'left' })
    ctx.restore()
  }
  function szeneRoute(sz, sek, dauer) {
    const e = etappen[sz.nr]
    setzeKugel(routenKugel(sz.nr))
    const proj = globusProjektion({ breite: kugelPx, hoehe: kugelPx, dpr: 1, mitte: e.blick.mitte, P: e.blick.P })
    const { x, y, s } = kugelLage()
    const p = Math.min(1, (sek / dauer) * 1.35)
    const linien = teilLinien(e.geo.linien, sanft(p))
    const punkte = p >= 1 ? e.geo.punkte : e.geo.punkte.slice(0, Math.max(1, Math.round(e.geo.punkte.length * p)))
    zeichneUeberlagerung(ctx, proj, { linien, punkte: e.geo.linien.length || p > 0.2 ? punkte : [], dpr: dpr * s, skala: s, versatz: [x, y] })
    // Verkehrsmittel an der Spitze der Linie, dazu kurz die Entfernung
    const zuletzt = linien[linien.length - 1]
    if (zuletzt?.coords?.length >= 2 && p < 1) {
      const v = verlauf(zuletzt.coords), o = punktBei(v, 1)
      const q = proj.proj([o.lon, o.lat])
      if (q) {
        ctx.save()
        ctx.translate(x + q[0] * s, y + q[1] * s); ctx.rotate(o.richtung * Math.PI / 180); ctx.scale(2, 2); ctx.translate(-12, -12)
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8
        ctx.fillStyle = '#fff'; ctx.fill(new Path2D(FAHRZEUG[zuletzt.art] || FAHRZEUG.auto), 'evenodd')
        ctx.restore()
      }
    }
    const kmE = e.geo.linien.reduce((n, l) => n + (l.km || 0), 0)
    verlaufUnten(0.36, 0.8)
    if (kmE) text(kmText(kmE, zahl), W / 2, 130, { groesse: 34, gewicht: 800, farbe: AKZENT, alpha: blende(sek, dauer, 0.4, 0.4) })
    etappenKarte(e, blende(sek - 0.15, dauer, 0.45, 0))
    text(`${sz.nr + 1} / ${etappen.length}`, W / 2, 84, { groesse: 22, gewicht: 700, farbe: 'rgba(244,236,224,0.8)' })
  }
  function routeFertig(nr) {
    const e = etappen[nr]
    setzeKugel(routenKugel(nr))
    const proj = globusProjektion({ breite: kugelPx, hoehe: kugelPx, dpr: 1, mitte: e.blick.mitte, P: e.blick.P })
    const { x, y, s } = kugelLage()
    zeichneUeberlagerung(ctx, proj, { linien: e.geo.linien, punkte: e.geo.punkte, dpr: dpr * s, skala: s, versatz: [x, y] })
  }

  // Unscharfer Hintergrund für Querformat: Bild winzig rechnen und wieder vergrößern
  const unscharf = new Map()
  function unscharfVon(img) {
    let u = unscharf.get(img)
    if (u) return u
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height
    const klein = neuesCanvas(18, 32), kc = klein.getContext('2d')
    const d = deckend(iw, ih, 18, 32)
    kc.drawImage(img, d.x, d.y, d.w, d.h)
    // in zwei Stufen vergrößern, sonst wird es kantig
    const mittel = neuesCanvas(72, 128), mc = mittel.getContext('2d')
    mc.imageSmoothingEnabled = true
    mc.drawImage(klein, 0, 0, 72, 128)
    u = neuesCanvas(288, 512)
    const uc = u.getContext('2d')
    uc.imageSmoothingEnabled = true; uc.imageSmoothingQuality = 'high'
    uc.drawImage(mittel, 0, 0, 288, 512)
    // Wo der Browser Filter auf dem Canvas kann (Chrome, Safari 18), echte Unschärfe darüber
    if ('filter' in uc) {
      try {
        const d2 = deckend(iw, ih, 288, 512)
        uc.filter = 'blur(14px)'
        uc.drawImage(img, d2.x - 20, d2.y - 20, d2.w + 40, d2.h + 40)
        uc.filter = 'none'
      } catch {}
    }
    uc.fillStyle = 'rgba(5,11,23,0.35)'; uc.fillRect(0, 0, 288, 512)
    unscharf.set(img, u)
    return u
  }
  function zeichneFoto(sz, sek, dauer, alpha, mitText = true) {
    const img = bilder.get(sz.foto.src)
    if (!img || alpha <= 0) return
    const kb = kenBurns(sek / dauer, sz.fotoNr + sz.nr)
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    if (iw / ih > 0.8) {
      // Querformat (und fast quadratisch): ganzes Bild über unscharfem Hintergrund
      ctx.drawImage(unscharfVon(img), 0, 0, W, H)
      const bh = Math.max(H * 0.34, Math.min(H * 0.62, W * ih / iw))   // Panoramen werden an den Seiten beschnitten
      const by = H * 0.43 - bh / 2
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12
      ctx.fillStyle = '#000'; ctx.fillRect(0, by, W, bh)
      ctx.shadowColor = 'transparent'
      ctx.beginPath(); ctx.rect(0, by, W, bh); ctx.clip()
      const d = deckend(iw, ih, W, bh)
      ctx.translate(W / 2 + kb.dx * W, by + bh / 2 + kb.dy * bh)
      ctx.scale(kb.skala, kb.skala)
      ctx.drawImage(img, d.x - W / 2, d.y - bh / 2, d.w, d.h)
    } else {
      const d = deckend(iw, ih, W, H)
      ctx.translate(W / 2 + kb.dx * W, H / 2 + kb.dy * H)
      ctx.scale(kb.skala, kb.skala)
      ctx.drawImage(img, d.x - W / 2, d.y - H / 2, d.w, d.h)
    }
    ctx.restore()
    if (!mitText) return
    ctx.save(); ctx.globalAlpha = alpha
    const g = ctx.createLinearGradient(0, H * 0.62, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.66)')
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.62, W, H * 0.38)
    const o = ctx.createLinearGradient(0, 0, 0, 170)
    o.addColorStop(0, 'rgba(0,0,0,0.42)'); o.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = o; ctx.fillRect(0, 0, W, 170)
    ctx.restore()
    const e = etappen[sz.nr]
    const ta = alpha * blende(sek - 0.25, dauer, 0.45, 0.3)
    // Etappe oben klein, mit Farbpunkt
    ctx.save(); ctx.globalAlpha = ta; ctx.fillStyle = e.farbe
    ctx.beginPath(); ctx.arc(56, 78, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    text(e.name, 76, 87, { groesse: 25, gewicht: 800, ausrichtung: 'left', alpha: ta })
    if (sz.foto.ort) {
      ctx.font = `800 40px ${TEXT_SCHRIFT}`
      const z = zeilen(sz.foto.ort, W - 112, 2)
      z.forEach((zeile, i) => text(zeile, 56, H - 150 + i * 46 - (z.length - 1) * 46, { groesse: 40, gewicht: 800, ausrichtung: 'left', alpha: ta }))
    }
    text(tagMonatJahr(sz.foto.datum), 56, H - 98, { groesse: 27, gewicht: 700, farbe: AKZENT, ausrichtung: 'left', alpha: ta })
  }
  function szeneFoto(sz, sek, dauer, vorher) {
    if (!bilder.get(sz.foto.src)) { routeFertig(sz.nr); verlaufUnten(0.36, 0.8); etappenKarte(etappen[sz.nr], 1); return }
    const a = blende(sek, dauer, 0.4, 0)
    if (a < 1) {
      // Darunter, was vorher zu sehen war: die fertige Route oder das vorige Foto
      if (vorher?.typ === 'foto') zeichneFoto(vorher, vorher.dauer, vorher.dauer, 1, false)
      else routeFertig(sz.nr)
    }
    zeichneFoto(sz, sek, dauer, a)
  }

  function szeneBilanz(sek, dauer, vorher) {
    const cv = kugelGecacht('bilanz', gesamtBlick, { linien: linienBis(etappen.length), punkte: punkteBis(etappen.length) })
    const ka = blende(sek, dauer, 0.5, 0)
    setzeKugel(cv, ka, 0.94 + 0.06 * ausklang(sek / dauer))
    if (vorher?.typ === 'foto' && sek < 0.5) zeichneFoto(vorher, vorher.dauer, vorher.dauer, 1 - sanft(sek / 0.5), false)
    verlaufUnten(0.48, 0.88)
    const b = daten.bilanz
    const a1 = blende(sek - 0.4, dauer - 0.4, 0.5, 0)
    const a2 = blende(sek - 0.8, dauer - 0.8, 0.5, 0)
    const a3 = blende(sek - 1.2, dauer - 1.2, 0.5, 0)
    text(t('MEINE REISE'), W / 2, H * 0.71, { groesse: 30, schrift: TITEL_SCHRIFT, gewicht: 400, farbe: AKZENT, alpha: a1, abstand: 2 })
    if (b.km > 0) {
      text(`${zahl(b.km)} km`, W / 2, H * 0.71 + 96, { groesse: 84, schrift: TITEL_SCHRIFT, gewicht: 400, alpha: a2 })
      text(b.kmArt === 'gefahren' ? 'gefahren' : t('auf der Straße geplant'), W / 2, H * 0.71 + 136, { groesse: 23, gewicht: 600, farbe: 'rgba(244,236,224,0.78)', alpha: a2 })
    }
    const y3 = H * 0.71 + (b.km > 0 ? 222 : 110)
    text(tn(b.etappen, '{tage} in {n} Etappe', '{tage} in {n} Etappen', { tage: tageText(b.tage) }), W / 2, y3, { groesse: 40, gewicht: 800, alpha: a3 })
    text('Western Australia', W / 2, H - 56, { groesse: 21, gewicht: 600, farbe: 'rgba(244,236,224,0.6)', alpha: a3 })
    // Zum Schluss ins Dunkle
    const ende = Math.max(0, (sek - (dauer - 0.7)) / 0.7)
    if (ende > 0) { ctx.save(); ctx.globalAlpha = sanft(ende); ctx.fillStyle = '#050b17'; ctx.fillRect(0, 0, W, H); ctx.restore() }
  }

  // ---------- öffentlich ----------
  async function vorbereiten(onFortschritt = () => {}) {
    try { await document.fonts?.load(`400 80px Anton`) } catch {}
    hintergrund = baueHintergrund()
    const quellen = [...new Set(plan.szenen.filter((s) => s.typ === 'foto').map((s) => s.foto.src))]
    let n = 0
    for (const src of quellen) {
      const img = await ladeBild(src)
      if (img) { try { await img.decode?.() } catch {} bilder.set(src, img) }
      onFortschritt(++n / Math.max(1, quellen.length + etappen.length + 1))
    }
    // Stehende Kugeln vorab rechnen, damit die Aufnahme später nicht stockt
    for (let i = 0; i < etappen.length; i++) {
      routenKugel(i)
      onFortschritt((quellen.length + i + 1) / Math.max(1, quellen.length + etappen.length + 1))
      await new Promise((r) => setTimeout(r, 0))
    }
    kugelGecacht('bilanz', gesamtBlick, { linien: linienBis(etappen.length), punkte: punkteBis(etappen.length) })
    onFortschritt(1)
  }

  function zeichne(t) {
    if (!hintergrund) hintergrund = baueHintergrund()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(hintergrund, 0, 0)
    const s = szeneBei(plan, Math.min(t, plan.gesamt - 1e-3))
    if (!s) return
    const { szene: sz, sek, index } = s
    const vorher = index > 0 ? plan.szenen[index - 1] : null
    if (sz.typ === 'titel') szeneTitel(t, sek, sz.dauer)
    else if (sz.typ === 'flug') szeneFlug(t, index, sz, sek, sz.dauer, vorher)
    else if (sz.typ === 'route') szeneRoute(sz, sek, sz.dauer)
    else if (sz.typ === 'foto') szeneFoto(sz, sek, sz.dauer, vorher)
    else if (sz.typ === 'bilanz') szeneBilanz(sek, sz.dauer, vorher)
  }

  return { vorbereiten, zeichne, gesamt: plan.gesamt }
}
