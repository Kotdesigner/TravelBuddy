// Fertige Dateien ohne Druckdialog: Seiten als Bilder rechnen und daraus PDF, JPEG oder TIFF bauen.
// Alles läuft auf dem Gerät. 300 dpi auf A4, die PDF-Dateien von Hand gebaut, ganz ohne Bibliothek.
export const DPI = 300
export const A4_HOCH = { breite: 2480, hoehe: 3508, ptB: 595.28, ptH: 841.89 }
export const A4_QUER = { breite: 3508, hoehe: 2480, ptB: 841.89, ptH: 595.28 }
const QUALITAET = 0.95

const text = (s) => new TextEncoder().encode(s)

/** PDF aus JPEG-Seiten: [{ bytes, breite, hoehe, ptB, ptH }] */
export function pdfAusJpegs(seiten) {
  const teile = [], versatz = []
  let laenge = 0
  const dazu = (x) => { const b = typeof x === 'string' ? text(x) : x; teile.push(b); laenge += b.length }
  const objekt = (nr, f) => { versatz[nr] = laenge; dazu(`${nr} 0 obj\n`); f(); dazu('\nendobj\n') }
  dazu('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const kinder = seiten.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  objekt(1, () => dazu('<< /Type /Catalog /Pages 2 0 R >>'))
  objekt(2, () => dazu(`<< /Type /Pages /Count ${seiten.length} /Kids [${kinder}] >>`))
  seiten.forEach((s, i) => {
    const seite = 3 + i * 3, inhalt = seite + 1, bild = seite + 2
    const strom = `q ${s.ptB} 0 0 ${s.ptH} 0 0 cm /B Do Q`
    objekt(seite, () => dazu(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${s.ptB} ${s.ptH}] /Resources << /XObject << /B ${bild} 0 R >> >> /Contents ${inhalt} 0 R >>`))
    objekt(inhalt, () => dazu(`<< /Length ${strom.length} >>\nstream\n${strom}\nendstream`))
    objekt(bild, () => {
      dazu(`<< /Type /XObject /Subtype /Image /Width ${s.breite} /Height ${s.hoehe} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${s.bytes.length} >>\nstream\n`)
      dazu(s.bytes)
      dazu('\nendstream')
    })
  })
  const anzahl = 3 + seiten.length * 3
  const xref = laenge
  let tabelle = `xref\n0 ${anzahl}\n0000000000 65535 f \n`
  for (let i = 1; i < anzahl; i++) tabelle += `${String(versatz[i]).padStart(10, '0')} 00000 n \n`
  dazu(`${tabelle}trailer\n<< /Size ${anzahl} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(teile, { type: 'application/pdf' })
}

/** Unkomprimiertes TIFF mit 300 dpi, je Seite ein Bild: [{ rgb, breite, hoehe }] */
export function tiffAusSeiten(seiten) {
  const teile = []
  let pos = 8
  const kopf = new DataView(new ArrayBuffer(8))
  kopf.setUint16(0, 0x4949); kopf.setUint16(2, 42, true)
  teile.push(new Uint8Array(kopf.buffer))
  let verweis = [kopf, 4]
  seiten.forEach((s) => {
    const pixel = pos
    teile.push(s.rgb); pos += s.rgb.length
    if (pos % 2) { teile.push(new Uint8Array(1)); pos++ }
    const felder = 12, ifd = pos, extra = ifd + 2 + felder * 12 + 4
    const b = new DataView(new ArrayBuffer(extra - ifd + 22))
    b.setUint16(0, felder, true)
    const feld = (i, tag, typ, zahl, wert) => {
      const o = 2 + i * 12
      b.setUint16(o, tag, true); b.setUint16(o + 2, typ, true); b.setUint32(o + 4, zahl, true)
      if (typ === 3 && zahl === 1) b.setUint16(o + 8, wert, true); else b.setUint32(o + 8, wert, true)
    }
    ;[[256, 4, 1, s.breite], [257, 4, 1, s.hoehe], [258, 3, 3, extra], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, pixel],
      [277, 3, 1, 3], [278, 4, 1, s.hoehe], [279, 4, 1, s.rgb.length], [282, 5, 1, extra + 6], [283, 5, 1, extra + 14], [296, 3, 1, 2]]
      .forEach((f, i) => feld(i, ...f))
    const e = extra - ifd
    for (let i = 0; i < 3; i++) b.setUint16(e + i * 2, 8, true)
    for (const o of [e + 6, e + 14]) { b.setUint32(o, DPI, true); b.setUint32(o + 4, 1, true) }
    verweis[0].setUint32(verweis[1], ifd, true)
    verweis = [b, 2 + felder * 12]
    teile.push(new Uint8Array(b.buffer)); pos = extra + 22
  })
  return new Blob(teile, { type: 'image/tiff' })
}

/**
 * Seitenumbrüche aus Blöcken im Dokument. atome: [{ oben, unten, umbruch, halten }], sortiert.
 * Nichts wird zerschnitten, außer ein Block ist höher als eine ganze Seite.
 * Ein Block mit `halten` (Überschrift) bleibt nicht allein am Seitenende stehen.
 */
export function seitenSchnitte(atome, hoehe) {
  const seiten = []
  let block = []
  const unten = (l) => Math.max(...l.map((a) => a.unten))
  const schliesse = (l) => { if (l.length && unten(l) > l[0].oben) seiten.push({ von: l[0].oben, bis: unten(l) }) }
  for (const a of atome) {
    if (block.length && a.unten - block[0].oben > hoehe) {
      let k = block.length
      while (k > 0 && block[k - 1].halten) k--
      if (!k) k = block.length
      schliesse(block.slice(0, k))
      block = block.slice(k)
    }
    if (block.length && a.unten - block[0].oben > hoehe) { schliesse(block); block = [] }
    if (!block.length && a.unten - a.oben > hoehe) {
      let von = a.oben
      while (a.unten - von > hoehe) { seiten.push({ von, bis: von + hoehe }); von += hoehe }
      block = [{ ...a, oben: von }]
    } else block.push(a)
    if (a.umbruch) { schliesse(block); block = [] }
  }
  schliesse(block)
  return seiten
}

// ---------- ab hier nur im Browser ----------

const naechsterSchritt = () => new Promise((r) => setTimeout(r, 0))
const warte = (ms) => new Promise((r) => setTimeout(r, ms))

export const jpegVon = (canvas) => new Promise((ok, nein) => canvas.toBlob(async (b) => {
  if (!b) return nein(new Error('jpeg'))
  ok({ blob: b, bytes: new Uint8Array(await b.arrayBuffer()) })
}, 'image/jpeg', QUALITAET))

export function rgbVon(canvas) {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  const rgb = new Uint8Array(canvas.width * canvas.height * 3)
  for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2] }
  return rgb
}

const neuesBlatt = (format) => {
  const c = document.createElement('canvas')
  c.width = format.breite; c.height = format.hoehe
  const g = c.getContext('2d')
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
  return [c, g]
}

const ladeBild = (src) => new Promise((ok, nein) => {
  const i = new Image()
  i.onload = () => ok(i); i.onerror = nein
  i.src = src
})

// ---------- Kollage ----------

function deckend(g, bild, x, y, b, h, r) {
  const s = Math.max(b / bild.naturalWidth, h / bild.naturalHeight)
  const qb = b / s, qh = h / s
  g.save(); g.beginPath(); g.roundRect(x, y, b, h, r); g.clip()
  g.drawImage(bild, (bild.naturalWidth - qb) / 2, (bild.naturalHeight - qh) / 2, qb, qh, x, y, b, h)
  g.restore()
}

/** Kollage als Blätter: erst das Deckblatt, dann je Vorlage eine Seite. Ruft `blatt(canvas)` je Seite auf. */
export async function kollageBlaetter({ fotos, vorlagen, titel, untertitel, holeBild, beschriftung }, blatt, melde = () => {}, gestoppt = () => false) {
  const f = A4_QUER, rand = 118, luecke = 47, fuss = 70
  const felder = []
  for (let i = 0, r = 0; i < fotos.length; r++) {
    const v = vorlagen[r % vorlagen.length], seite = []
    for (const feld of v) { if (i >= fotos.length) break; seite.push([feld, fotos[i++]]) }
    felder.push(seite)
  }
  const gesamt = felder.length + 1
  melde(1, gesamt)
  const [c0, g0] = neuesBlatt(f)
  g0.fillStyle = '#2b2621'; g0.textAlign = 'center'
  g0.font = '700 170px -apple-system, "Segoe UI", Roboto, sans-serif'
  let groesse = 170
  while (g0.measureText(titel).width > f.breite - rand * 2 && groesse > 70) { groesse -= 10; g0.font = `700 ${groesse}px -apple-system, "Segoe UI", Roboto, sans-serif` }
  g0.fillText(titel, f.breite / 2, f.hoehe / 2)
  g0.fillStyle = '#6b6157'; g0.font = '400 62px -apple-system, "Segoe UI", Roboto, sans-serif'
  g0.fillText(untertitel, f.breite / 2, f.hoehe / 2 + 110)
  await blatt(c0)
  c0.width = 0
  for (let s = 0; s < felder.length; s++) {
    if (gestoppt()) return
    melde(s + 2, gesamt)
    await naechsterSchritt()
    const [c, g] = neuesBlatt(f)
    const zb = (f.breite - rand * 2 + luecke) / 6, zh = (f.hoehe - rand * 2 - fuss + luecke) / 4
    for (const [[sp, ze, br, ho], foto] of felder[s]) {
      const x = rand + (sp - 1) * zb, y = rand + (ze - 1) * zh, b = br * zb - luecke, h = ho * zh - luecke
      const src = await holeBild(foto)
      try {
        const bild = await ladeBild(src.url)
        deckend(g, bild, x, y, b, h, 35)
      } catch { g.fillStyle = '#efe6d6'; g.beginPath(); g.roundRect(x, y, b, h, 35); g.fill() }
      src.fertig?.()
      const bu = beschriftung(foto)
      if (bu) {
        g.save(); g.beginPath(); g.roundRect(x, y, b, h, 35); g.clip()
        const v = g.createLinearGradient(0, y + h - 190, 0, y + h)
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.62)')
        g.fillStyle = v; g.fillRect(x, y + h - 190, b, 190)
        g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = '700 38px -apple-system, "Segoe UI", Roboto, sans-serif'
        g.fillText(bu, x + 34, y + h - 30, b - 68)
        g.restore()
      }
    }
    g.fillStyle = '#9a9086'; g.textAlign = 'right'; g.font = '400 32px -apple-system, "Segoe UI", Roboto, sans-serif'
    g.fillText(String(s + 1), f.breite - rand, f.hoehe - rand + 8)
    await blatt(c)
    c.width = 0
  }
}

// ---------- HTML-Dokument (Tagebuch) ----------

const XHTML = 'http://www.w3.org/1999/xhtml'
const RAND_X = 165, RAND_Y = 189, SP_B = 688, SP_H = 1002   // 14 und 16 mm Rand, Satzspiegel in CSS-Pixeln

/** Blöcke des Dokuments, die nicht getrennt werden dürfen. */
function sammleAtome(wurzel, fenster, mass) {
  const atome = []
  const oben = (e) => (e.getBoundingClientRect().top + fenster.scrollY) / mass
  const zeilen = (e) => {
    const r = e.ownerDocument.createRange(); r.selectNodeContents(e)
    const mal = new Map()
    for (const q of r.getClientRects()) if (q.height) mal.set(Math.round((q.bottom + fenster.scrollY) / mass), (q.top + fenster.scrollY) / mass)
    return [...mal].map(([unten, top]) => ({ oben: top, unten, umbruch: false }))
  }
  const gehe = (e) => {
    const st = fenster.getComputedStyle(e)
    if (st.display === 'none') return
    const hoch = e.getBoundingClientRect().height / mass
    const bu = /page|always/.test(st.breakAfter + st.pageBreakAfter)
    const ganz = /avoid/.test(st.breakInside + st.pageBreakInside) || /flex|grid/.test(st.display) || e.tagName === 'IMG'
    const kinder = [...e.children].filter((k) => !/STYLE|SCRIPT/.test(k.tagName))
    if (hoch <= SP_H && (ganz || !kinder.length)) {
      if (!kinder.length && hoch > 90) atome.push(...zeilen(e))
      else if (hoch) atome.push({ oben: oben(e), unten: oben(e) + hoch, umbruch: false, halten: e.matches('h1,h2,h3,h4,[class*=kopf]') })
    } else if (kinder.length) kinder.forEach(gehe)
    else if (hoch) atome.push(...zeilen(e))
    if (bu && atome.length) atome[atome.length - 1].umbruch = true
  }
  ;[...wurzel.children].forEach(gehe)
  return atome.sort((a, b) => a.oben - b.oben || a.unten - b.unten)
}

async function alsDatenUrl(url, typ) {
  const b = await (await fetch(url)).blob()
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(typ ? new Blob([b], { type: typ }) : b) })
}

/** Foto direkt aufs Blatt: Safari malt Fotos im SVG unzuverlässig, und so bleibt das SVG klein. */
function zeichneFoto(g, img, x, y, b, h, art, radius, clipOben, clipUnten) {
  if (!img.naturalWidth || !b || !h) return
  const s = (art === 'contain' ? Math.min : Math.max)(b / img.naturalWidth, h / img.naturalHeight)
  const zb = img.naturalWidth * s, zh = img.naturalHeight * s
  g.save()
  g.beginPath(); g.rect(0, clipOben, g.canvas.width, clipUnten - clipOben); g.clip()
  g.beginPath(); g.roundRect(x, y, b, h, radius); g.clip()
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
  g.drawImage(img, x + (b - zb) / 2, y + (h - zh) / 2, zb, zh)
  g.restore()
}

/** Dokument setzen, in A4-Seiten teilen und je Seite `blatt(canvas)` aufrufen. */
export async function htmlBlaetter({ css, body, schriften = {} }, blatt, melde = () => {}, gestoppt = () => false) {
  const rahmen = document.createElement('iframe')
  rahmen.setAttribute('aria-hidden', 'true')
  const FAKTOR = (A4_HOCH.breite - RAND_X * 2) / SP_B
  rahmen.style.cssText = `position:fixed;left:-20000px;top:0;width:${SP_B}px;height:${SP_H}px;border:0;visibility:hidden`
  document.body.append(rahmen)
  try {
    const doc = rahmen.contentDocument, fenster = rahmen.contentWindow
    // Die Seite steckt später in einem div, die Regeln für body müssen dorthin mit
    let stil = css.replace(/@page\s*\{[^}]*\}/g, '').replace(/([\d.]+)vh/g, (_, n) => `${(n * SP_H) / 100}px`)
      .replace(/(^|[\s,}])body(\s*[,{])/g, '$1.ag-seite$2')
    doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%}body{margin:0}${stil}</style></head><body><div class="ag-seite" style="width:${SP_B}px">${body.replace(/\sloading="lazy"/g, '')}</div></body></html>`); doc.close()
    await Promise.all([...doc.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
    await doc.fonts?.ready
    await warte(60)
    for (const [url, typ] of Object.entries(schriften)) stil = stil.replaceAll(url, await alsDatenUrl(url, typ))
    const inhalt = doc.body.firstElementChild
    const mass = 1
    const schnitte = seitenSchnitte(sammleAtome(inhalt, fenster, mass), SP_H)
    const alle = [...doc.images]
    const groessen = alle.map((i) => {
      const b = i.getBoundingClientRect(), st = fenster.getComputedStyle(i)
      return { b: b.width / mass, h: b.height / mass, x: b.left / mass, oben: (b.top + fenster.scrollY) / mass, art: st.objectFit, radius: parseFloat(st.borderTopLeftRadius) || 0 }
    })
    for (let n = 0; n < schnitte.length; n++) {
      if (gestoppt()) return
      melde(n + 1, schnitte.length)
      await naechsterSchritt()
      const { von, bis } = schnitte[n]
      const klon = inhalt.cloneNode(true)
      klon.querySelectorAll('img').forEach((k, i) => {
        const g = groessen[i]
        k.style.width = `${g.b}px`; k.style.height = `${g.h}px`; k.style.display = 'block'
        k.removeAttribute('src'); k.removeAttribute('srcset')
        k.style.visibility = 'hidden'
      })
      // Das SVG bleibt in Originalgröße, so stimmt es mit der gemessenen Seite überein. Die Vergrößerung
      // macht drawImage, das rechnet ein SVG scharf neu. viewBox oder zoom verschieben in Safari den Inhalt.
      const f = A4_HOCH, faktor = FAKTOR
      const aussen = doc.createElementNS(XHTML, 'div')
      aussen.setAttribute('style', `width:${SP_B}px;height:${bis - von}px;overflow:hidden;background:#fff`)
      const s = doc.createElementNS(XHTML, 'style'); s.textContent = stil
      const innen = doc.createElementNS(XHTML, 'div')
      innen.setAttribute('style', `margin-top:${-von}px`)
      innen.append(klon)
      aussen.append(s, innen)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SP_B}" height="${SP_H}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(aussen)}</foreignObject></svg>`
      const bild = await ladeBild('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))
      const [c, g] = neuesBlatt(f)
      g.drawImage(bild, RAND_X, RAND_Y, SP_B * faktor, SP_H * faktor)
      await warte(40)
      g.fillStyle = '#fff'; g.fillRect(0, 0, f.breite, f.hoehe)
      g.drawImage(bild, RAND_X, RAND_Y, SP_B * faktor, SP_H * faktor)
      groessen.forEach((m, i) => {
        if (m.oben + m.h > von && m.oben < bis) zeichneFoto(g, alle[i], RAND_X + m.x * faktor, RAND_Y + (m.oben - von) * faktor, m.b * faktor, m.h * faktor, m.art, m.radius * faktor, RAND_Y, RAND_Y + (bis - von) * faktor)
      })
      g.fillStyle = '#9a9086'; g.textAlign = 'center'; g.font = '400 30px -apple-system, "Segoe UI", Roboto, sans-serif'
      if (n) g.fillText(String(n + 1), f.breite / 2, f.hoehe - 95)
      await blatt(c)
      c.width = 0
    }
  } finally { rahmen.remove() }
}

// ---------- Dateien ----------

/** Alle Blätter sammeln und daraus die Dateien bauen. format: 'pdf', 'jpeg' oder 'tiff'. */
export async function sammleDatei(format, seitenFormat, name, erzeuge) {
  const seiten = [], dateien = []
  await erzeuge(async (c) => {
    const j = await jpegVon(c)
    if (format === 'tiff') { seiten.push({ rgb: rgbVon(c), blob: j.blob, breite: c.width, hoehe: c.height }); return }
    seiten.push({ blob: j.blob, bytes: format === 'pdf' ? j.bytes : null, breite: c.width, hoehe: c.height, ptB: seitenFormat.ptB, ptH: seitenFormat.ptH })
    if (format === 'jpeg') dateien.push(new File([j.blob], `${name}-${String(seiten.length).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }))
  })
  if (!seiten.length) return null
  if (format === 'pdf') dateien.push(new File([pdfAusJpegs(seiten)], `${name}.pdf`, { type: 'application/pdf' }))
  if (format === 'tiff') dateien.push(new File([tiffAusSeiten(seiten)], `${name}.tiff`, { type: 'image/tiff' }))
  return { dateien, seiten: seiten.length, bilder: seiten.map((s) => s.blob).filter(Boolean) }
}

/** Druckt HTML in der App, ohne zweites Fenster. Am iPhone gäbe es aus dem kein Zurück. */
export function druckeHtml(html, fertig = () => {}) {
  const rahmen = document.createElement('iframe')
  rahmen.setAttribute('aria-hidden', 'true')
  rahmen.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
  document.body.append(rahmen)
  const doc = rahmen.contentDocument
  doc.open(); doc.write(html); doc.close()
  let los = false
  const drucke = () => {
    if (los) return
    los = true
    try { rahmen.contentWindow.focus(); rahmen.contentWindow.print() } catch {}
    fertig()
    setTimeout(() => rahmen.remove(), 60000)
  }
  rahmen.onload = drucke
  setTimeout(drucke, 900)
}

/** Fertige Seiten drucken: eine Seite je Bild, randlos auf A4. */
export function druckeBilder(blobs, quer = false) {
  const urls = blobs.map((b) => URL.createObjectURL(b))
  const seiten = urls.map((u) => `<img src="${u}">`).join('')
  druckeHtml(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 ${quer ? 'landscape' : 'portrait'};margin:0}html,body{margin:0}img{display:block;width:${quer ? '297mm' : '210mm'};height:${quer ? '210mm' : '297mm'};page-break-after:always}img:last-child{page-break-after:auto}</style></head><body>${seiten}</body></html>`, () => setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 60000))
}
