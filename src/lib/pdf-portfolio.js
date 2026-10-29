// PDF-Portfolios öffnen.
//
// Outlook mit Adobe „PDFMaker“ speichert Mails als PDF-Portfolio: eine Hülle mit nur einer
// Deckseite („Zur optimalen Anzeige dieses PDF-Portfolios … Acrobat“), die eigentliche Mail
// steckt als eingebettete Datei darin. Das iPhone und jeder Browser zeigen nur die Deckseite.
// Hier wird die eingebettete Datei herausgeholt, damit der Beleg mit jedem Betrachter aufgeht.
//
// Kein vollständiger PDF-Leser: Die Dateibeschreibungen (/EF << /F 12 0 R >>) und die Kennung
// /Collection des Portfolios liegen oft in komprimierten Objektströmen, die werden entpackt. Der
// Datenstrom der eingebetteten Datei selbst liegt nie darin; seine Typ-Angabe /EmbeddedFile ist
// freiwillig und fehlt bei PDFMaker, deshalb zählt der Verweis. Was sich nicht lesen lässt, bleibt,
// wie es ist: dann öffnet eben die Hülle wie bisher. Reine Funktionen, im Browser und in Node gleich.

const latin = (b) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return s }

async function entpacke(daten) {
  const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(strom).arrayBuffer())
}

/** Alle Datenströme: [{ nr (Objektnummer), dict (Text), daten (roh, Uint8Array) }] */
export function stroeme(bytes) {
  const s = latin(bytes), out = []
  let i = 0
  while ((i = s.indexOf('stream', i)) >= 0) {
    // nur das Schlüsselwort „stream“ nach einem Wörterbuch, nicht „endstream“
    if (s.slice(i - 3, i) === 'end' || !/>>\s*$/.test(s.slice(Math.max(0, i - 40), i))) { i += 6; continue }
    const objPos = s.lastIndexOf(' obj', i)
    const dictStart = s.indexOf('<<', objPos)
    if (objPos < 0 || dictStart < 0 || dictStart > i) { i += 6; continue }
    const kopf = s.slice(Math.max(0, objPos - 24), objPos).match(/(\d+)\s+\d+\s*$/)
    const dict = s.slice(dictStart, i).replace(/\s*$/, '')
    let start = i + 6
    if (s[start] === '\r') start++
    if (s[start] === '\n') start++
    const direkt = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)
    let ende = direkt ? start + +direkt[1] : -1
    if (ende < 0 || s.slice(ende, ende + 12).indexOf('endstream') < 0) {
      ende = s.indexOf('endstream', start)
      if (ende < 0) break
      if (s[ende - 1] === '\n') ende--
      if (s[ende - 1] === '\r') ende--
    }
    out.push({ nr: kopf ? +kopf[1] : null, dict, daten: bytes.subarray(start, ende) })
    i = ende + 9
  }
  return out
}

const istFlate = (dict) => /\/Filter\s*(\[\s*)?\/FlateDecode\s*\]?/.test(dict)
const nurFlateOderOhne = (dict) => !/\/Filter/.test(dict) || /\/Filter\s*(\[\s*)?\/FlateDecode\s*\]?\s*(\/|>>|$)/.test(dict)
const inhalt = async (st) => (istFlate(st.dict) ? entpacke(st.daten) : st.daten)

/**
 * Ist das ein Portfolio, und was steckt darin?
 * @returns { portfolio: bool, dateien: [{ bytes, istPdf }] }
 */
export async function leseHuelle(eingabe) {
  const bytes = eingabe instanceof Uint8Array ? eingabe : new Uint8Array(eingabe)
  if (latin(bytes.subarray(0, 5)) !== '%PDF-') return { portfolio: false, dateien: [] }
  const alle = stroeme(bytes)
  // Klartext des Dokuments plus entpackte Objektströme: dort stehen Katalog und Dateibeschreibungen
  let text = latin(bytes)
  for (const st of alle.filter((x) => /\/Type\s*\/ObjStm\b/.test(x.dict) && istFlate(x.dict))) {
    try { text += '\n' + latin(await entpacke(st.daten)) } catch {}
  }
  const verweise = new Set([...text.matchAll(/\/EF\s*<<[^>]*?\/(?:UF|F)\s+(\d+)\s+\d+\s+R/g)].map((m) => +m[1]))
  const eingebettet = alle.filter((st) => (verweise.has(st.nr) || /\/Type\s*\/EmbeddedFile\b/.test(st.dict)) && nurFlateOderOhne(st.dict))
  if (!eingebettet.length) return { portfolio: false, dateien: [] }
  const portfolio = text.includes('/Collection')
  const dateien = []
  for (const st of eingebettet) {
    try {
      const b = await inhalt(st)
      dateien.push({ bytes: b, istPdf: latin(b.subarray(0, 5)) === '%PDF-' })
    } catch {}
  }
  return { portfolio, dateien }
}

/**
 * Was soll beim Öffnen eines Belegs gezeigt werden? Normale PDFs bleiben, wie sie sind.
 * Portfolio mit genau einem PDF darin: dieses PDF. Mit mehreren: alle PDFs zur Auswahl.
 * @returns { art: 'datei', blob } | { art: 'liste', dateien: [Blob] }
 */
export async function zumAnzeigen(blob) {
  try {
    if (!/pdf/i.test(blob.type || 'application/pdf')) return { art: 'datei', blob }
    const h = await leseHuelle(new Uint8Array(await blob.arrayBuffer()))
    const pdfs = h.dateien.filter((d) => d.istPdf)
    if (!h.portfolio || !pdfs.length) return { art: 'datei', blob }
    const blobs = pdfs.map((d) => new Blob([d.bytes], { type: 'application/pdf' }))
    return blobs.length === 1 ? { art: 'datei', blob: blobs[0] } : { art: 'liste', dateien: blobs }
  } catch { return { art: 'datei', blob } }
}
