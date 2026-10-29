// Karten als Bilddatei zum Drucken.
//
// NICHT den Bildschirm abfotografieren: das iPhone-Canvas ist 390 × 760 px — gedruckt
// wäre das ein Briefmarkenbild. Stattdessen wird eine ZWEITE Karte unsichtbar in der
// gewünschten Druckgröße aufgebaut, auf denselben Ausschnitt gestellt, abgewartet bis
// alle Kacheln da sind, und die dann ausgelesen.
//
// Zwei Fallstricke, beide hier behandelt:
//  1. `preserveDrawingBuffer: true` ist Pflicht. Ohne das ist die WebGL-Leinwand nach
//     dem Frame leer und `toDataURL()` liefert ein durchsichtiges Bild.
//  2. Die Herkunftsangabe („© OpenStreetMap") gehört ins Bild — beim Ausdruck ist sonst
//     nicht mehr erkennbar, woher die Karte stammt. Sie wird unten eingebrannt.
import { t } from './i18n.js'

export const FORMATE = [
  { id: 'a4-quer', label: t('A4 quer'), breite: 3508, hoehe: 2480 },   // 297 × 210 mm bei 300 dpi
  { id: 'a4-hoch', label: t('A4 hoch'), breite: 2480, hoehe: 3508 },
  { id: 'a5-quer', label: t('A5 quer'), breite: 2480, hoehe: 1748 },
  { id: 'bildschirm', label: t('Bildschirm (2×)'), breite: 2048, hoehe: 1536 },
]

export const DATEITYPEN = [
  { id: 'jpg', label: 'JPG', endung: 'jpg', mime: 'image/jpeg', hinweis: t('klein, überall druckbar') },
  { id: 'png', label: 'PNG', endung: 'png', mime: 'image/png', hinweis: 'verlustfrei' },
  { id: 'tiff', label: 'TIFF', endung: 'tif', mime: null, hinweis: t('unkomprimiert, für Druckereien') },
]

/** Baseline-TIFF (unkomprimiert, RGB). Browser können TIFF nicht selbst schreiben. */
export function alsTiff(imageData) {
  const { width: b, height: h, data } = imageData
  const pixelBytes = b * h * 3
  const eintraege = 10
  const ifdOffset = 8
  const ifdLaenge = 2 + eintraege * 12 + 4
  const werteOffset = ifdOffset + ifdLaenge          // BitsPerSample (3 × uint16) + Auflösung
  const bpsOffset = werteOffset
  const xResOffset = bpsOffset + 6
  const yResOffset = xResOffset + 8
  const datenOffset = yResOffset + 8

  const buf = new ArrayBuffer(datenOffset + pixelBytes)
  const dv = new DataView(buf)
  const LE = true

  dv.setUint16(0, 0x4949, LE)                        // „II" = little endian
  dv.setUint16(2, 42, LE)                            // Magische Zahl
  dv.setUint32(4, ifdOffset, LE)

  let p = ifdOffset
  dv.setUint16(p, eintraege, LE); p += 2
  const tag = (nr, typ, anzahl, wert) => {
    dv.setUint16(p, nr, LE); dv.setUint16(p + 2, typ, LE)
    dv.setUint32(p + 4, anzahl, LE); dv.setUint32(p + 8, wert, LE); p += 12
  }
  tag(256, 4, 1, b)                                  // ImageWidth
  tag(257, 4, 1, h)                                  // ImageLength
  tag(258, 3, 3, bpsOffset)                          // BitsPerSample 8,8,8
  tag(259, 3, 1, 1)                                  // Compression = keine
  tag(262, 3, 1, 2)                                  // PhotometricInterpretation = RGB
  tag(273, 4, 1, datenOffset)                        // StripOffsets
  tag(277, 3, 1, 3)                                  // SamplesPerPixel
  tag(279, 4, 1, pixelBytes)                         // StripByteCounts
  tag(282, 5, 1, xResOffset)                         // XResolution
  tag(283, 5, 1, yResOffset)                         // YResolution
  dv.setUint32(p, 0, LE)                             // kein weiteres IFD

  dv.setUint16(bpsOffset, 8, LE)
  dv.setUint16(bpsOffset + 2, 8, LE)
  dv.setUint16(bpsOffset + 4, 8, LE)
  dv.setUint32(xResOffset, 300, LE); dv.setUint32(xResOffset + 4, 1, LE)   // 300 dpi
  dv.setUint32(yResOffset, 300, LE); dv.setUint32(yResOffset + 4, 1, LE)

  const aus = new Uint8Array(buf, datenOffset)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    aus[j] = data[i]; aus[j + 1] = data[i + 1]; aus[j + 2] = data[i + 2]
  }
  return new Blob([buf], { type: 'image/tiff' })
}

function herkunftEinbrennen(cv, text) {
  const ctx = cv.getContext('2d')
  const hoehe = Math.max(26, Math.round(cv.height * 0.022))
  ctx.font = `600 ${Math.round(hoehe * 0.62)}px -apple-system, system-ui, sans-serif`
  const breite = ctx.measureText(text).width + hoehe
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillRect(cv.width - breite - 8, cv.height - hoehe - 8, breite, hoehe)
  ctx.fillStyle = '#3a332c'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cv.width - breite - 8 + hoehe / 2, cv.height - hoehe / 2 - 8)
}

/**
 * Rendert die LAUFENDE Karte kurz in Druckgroesse und gibt das Bild als Blob zurueck.
 *
 * Warum nicht eine zweite, unsichtbare Karte? Zwei Gruende, beide auf dem iPhone gemessen:
 *  - iOS Safari zeichnet WebGL ausserhalb des Sichtbereichs nicht — Ergebnis war schwarz.
 *  - Jede Karte belegt einen eigenen WebGL-Kontext; davon gibt es nur wenige.
 * Also wird die vorhandene Karte kurz vergroessert, ausgelesen und zurueckgesetzt.
 *
 * Und: MapLibre multipliziert die CSS-Groesse mit dem Pixelverhaeltnis (auf dem iPhone 2).
 * Bei 3508 px Wunschbreite waere die Leinwand 7016 px breit — ueber der Grenze von iOS
 * (4096 px), das Bild bliebe leer. Deshalb wird die CSS-Groesse heruntergerechnet, damit
 * die Leinwand GENAU die gewuenschte Pixelzahl bekommt.
 */
export async function exportiereKarte({ vorlage, breite, hoehe, typ = 'jpg', herkunft = '© OpenStreetMap', hintergrund = null }) {
  const behaelter = vorlage.getContainer()
  const dpr = window.devicePixelRatio || 1
  const GRENZE = 4096
  let zielB = Math.min(breite, GRENZE), zielH = Math.min(hoehe, GRENZE)
  if (zielB !== breite || zielH !== hoehe) {
    const f = Math.min(GRENZE / breite, GRENZE / hoehe)
    zielB = Math.round(breite * f); zielH = Math.round(hoehe * f)
  }
  const cssB = Math.max(64, Math.round(zielB / dpr))
  const cssH = Math.max(64, Math.round(zielH / dpr))

  const alt = behaelter.getAttribute('style') || ''
  const blende = document.createElement('div')
  blende.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(20,17,14,.72);' +
    'display:flex;align-items:center;justify-content:center;color:#fff;font:700 15px -apple-system,system-ui,sans-serif'
  blende.textContent = t('Karte wird in Druckgröße gerendert …')
  document.body.appendChild(blende)

  try {
    behaelter.setAttribute('style',
      `position:fixed;left:0;top:0;width:${cssB}px;height:${cssH}px;z-index:99997;pointer-events:none`)
    vorlage.resize()

    await new Promise((fertig) => {
      const notaus = setTimeout(fertig, 25000)
      vorlage.once('idle', () => { clearTimeout(notaus); fertig() })
    })
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const quelle = vorlage.getCanvas()
    const cv = document.createElement('canvas')
    cv.width = quelle.width; cv.height = quelle.height
    const ctx = cv.getContext('2d')
    // Weltkugel: um die Kugel herum ist die Leinwand durchsichtig, dort kommt der Weltraum hin
    if (hintergrund) { ctx.fillStyle = hintergrund; ctx.fillRect(0, 0, cv.width, cv.height) }
    ctx.drawImage(quelle, 0, 0)

    // Gegenprobe: eine schwarze Flaeche heisst, die Karte hat nicht gezeichnet.
    // Lieber ehrlich abbrechen als eine leere Datei zum Drucken geben. Geprüft wird die
    // Bildmitte (bei der Kugel ist der Rand Weltraum und darf dunkel sein).
    const pw = Math.min(cv.width, 600), ph = Math.min(cv.height, 600)
    const probe = ctx.getImageData(Math.round((cv.width - pw) / 2), Math.round((cv.height - ph) / 2), pw, ph).data
    let hell = 0, n = 0
    for (let i = 0; i < probe.length; i += 4 * 37) { n++; if (probe[i] + probe[i + 1] + probe[i + 2] > 60) hell++ }
    if (n && hell / n < 0.05) throw new Error(t('Karte hat nicht gezeichnet (leeres Bild) — bitte noch einmal versuchen'))

    if (herkunft) herkunftEinbrennen(cv, herkunft)

    if (typ === 'tiff') return { blob: alsTiff(ctx.getImageData(0, 0, cv.width, cv.height)), breite: cv.width, hoehe: cv.height }
    const dt = DATEITYPEN.find((x) => x.id === typ) || DATEITYPEN[0]
    const blob = await new Promise((r) => cv.toBlob(r, dt.mime, dt.id === 'jpg' ? 0.92 : undefined))
    return { blob, breite: cv.width, hoehe: cv.height }
  } finally {
    behaelter.setAttribute('style', alt)
    try { vorlage.resize() } catch {}
    blende.remove()
  }
}

export function speichere(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
