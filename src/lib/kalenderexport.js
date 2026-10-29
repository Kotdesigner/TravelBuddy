// Reisekalender als PDF und als Excel-Datei.
//
// Zwei Ausgaben aus derselben Quelle:
//   alsPdf()  — A4-Druckfassung zum Mitnehmen, nach Etappen und Tagen gegliedert.
//   alsXlsx() — echte .xlsx zum Weiterarbeiten, eine Zeile je Termin.
//
// Warum eine echte xlsx und kein CSV: CSV kann keine Spaltenbreiten, keine fette
// Kopfzeile, keine Farben und keine echten Datumswerte. Für „geht so" reicht es,
// für einen Reiseplan nicht.
//
// Die Datei wird von Hand gebaut — eine xlsx ist ein ZIP mit ein paar XML-Teilen.
// Ohne Komprimierung (Methode 0 „stored") braucht es dafür keine Bibliothek, nur
// eine CRC32-Prüfsumme. Bei ein paar hundert Zeilen ist die Dateigröße egal.

import { katInfo } from './reisekalender.js'
import { dauerText } from './wanderungen-daten.js'
import { LOCALE, t, tn, istEn } from './i18n.js'
import { wochentag, ZWEI } from './format.js'

const tag = (s) => new Date(s + 'T12:00')
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtTag = (s) => { try { return tag(s).toLocaleDateString(LOCALE, { day: ZWEI, month: 'short', year: 'numeric' }) } catch { return s } }
const fmtKurz = (s) => { try { return tag(s).toLocaleDateString(LOCALE, { day: ZWEI, month: 'short' }) } catch { return s } }
const wtag = (s) => { try { return wochentag(s) } catch { return '' } }

// Kategorien, die im Export vorkommen — Reihenfolge bestimmt die Sortierung
// innerhalb eines Tages: erst wo man hinfährt, dann wo man schläft, dann der Rest.
const RANG = { flight: 1, train: 1, boat: 2, shuttle: 2, car: 3, camper: 3, hotel: 4, stay: 5, city: 5, wanderung: 6, logbuch: 7 }

/**
 * Alles Datierte in eine flache, chronologische Liste.
 * Jeder Eintrag weiß, in welcher Etappe er liegt — das trägt beide Ausgaben.
 */
export function baueEintraege({ plan, buchungen, wanderungen = [], journal = [] }) {
  const etappen = (plan?.eintraege || []).map((e) => ({
    name: e.reise.name, farbe: e.reise.farbe || '#7a5c8e',
    von: ymd(e.von), bis: ymd(e.bis), tage: e.tage,
  }))
  const etappeFuer = (datum) => etappen.find((a) => datum >= a.von && datum <= a.bis) || null

  const out = []
  for (const e of buchungen?.events || []) {
    if (e.platzhalter) continue
    out.push({
      datum: e.datum, zeit: '', kat: e.kat, quelle: 'Buchung',
      titel: e.titel, details: e.sub, ref: e.ref,
      belege: e.docs.map((d) => d.label).join(', '),
      icon: katInfo(e.kat).icon, art: katInfo(e.kat).label,
      special: e.special || '', emoji: e.emoji || '',
    })
  }
  for (const w of wanderungen) {
    if (!w.datum) continue
    out.push({
      datum: w.datum, zeit: w.zeit || '', kat: 'wanderung', quelle: 'Wanderung',
      titel: w.name, icon: '🥾', art: t('Wanderung'), ref: '', belege: '', special: '', emoji: '',
      details: [w.km ? `${w.km} km` : '', dauerText(w.dauerMin), w.hoehenmeter ? t('↑ {hoehenmeter} hm', { hoehenmeter: w.hoehenmeter }) : '', w.gebiet]
        .filter(Boolean).join(' · '),
    })
  }
  for (const j of journal) {
    if (!j.datum) continue
    out.push({
      datum: j.datum, zeit: '', kat: 'logbuch', quelle: 'Logbuch',
      titel: j.ort || t('Reisetag'), icon: '📖', art: t('Logbuch'), ref: '', belege: '', special: '', emoji: '',
      details: (j.text || '').trim().replace(/\s+/g, ' ').slice(0, 160),
    })
  }

  out.sort((a, b) =>
    a.datum.localeCompare(b.datum) ||
    (a.zeit || '').localeCompare(b.zeit || '') ||
    (RANG[a.kat] || 9) - (RANG[b.kat] || 9))

  // Etappe und laufende Tagesnummer anhängen.
  const start = etappen[0]?.von || out[0]?.datum
  for (const e of out) {
    const a = etappeFuer(e.datum)
    e.abschnitt = a?.name || '—'
    e.farbe = a?.farbe || '#8a8178'
    // Vor dem Reisebeginn gibt es keinen Reisetag — sonst stand im Export „Tag -126"
    // (Logbuch-Testeinträge vom Juli, gefunden 18.09.).
    const nr = start ? Math.round((tag(e.datum) - tag(start)) / 86400000) + 1 : 0
    e.tagNr = nr >= 1 ? nr : ''
    e.wochentag = wtag(e.datum)
  }
  return { eintraege: out, etappen }
}

// ===========================================================================
// PDF (über das Druckfenster des Browsers)
// ===========================================================================

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const DRUCK_CSS = `
  @font-face { font-family:'Anton'; src:url('${typeof location !== 'undefined' ? location.origin : ''}/fonts/anton.woff2') format('woff2'); font-display:swap; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; color:#2b2621; margin:0; background:#fff; font-size:10.5pt; }
  @page { size:A4; margin:14mm 12mm 16mm; }

  .deckel { text-align:center; padding:56px 20px 40px; color:#fff; page-break-after:always;
    background:linear-gradient(150deg,#8a3f16,#b5451b 55%,#d98a3d); min-height:70vh;
    display:flex; flex-direction:column; justify-content:center; }
  .d-kicker { font-size:11pt; font-weight:800; letter-spacing:0.25em; text-transform:uppercase; opacity:.9; }
  .d-titel { font-family:'Anton',sans-serif; text-transform:uppercase; font-size:52pt; line-height:1; margin:12px 0 8px; }
  .d-zeit { font-size:13pt; font-weight:600; }
  .d-zahlen { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:24px; }
  .d-zahlen span { font-size:10pt; font-weight:700; background:rgba(255,255,255,.18);
    border:1px solid rgba(255,255,255,.35); padding:5px 12px; border-radius:20px; }

  h2.abschnitt { font-family:'Anton',sans-serif; text-transform:uppercase; font-size:19pt; letter-spacing:.01em;
    margin:0 0 2px; page-break-after:avoid; }
  .a-kopf { border-left:6px solid var(--f); padding:8px 0 8px 12px; margin:16px 0 8px; page-break-after:avoid;
    page-break-inside:avoid; background:linear-gradient(90deg, color-mix(in srgb, var(--f) 9%, transparent), transparent 70%); }
  .a-zeit { font-size:10pt; font-weight:700; color:#6b6157; }

  .tagblock { page-break-inside:avoid; margin:0 0 7px; padding-left:12px; border-left:2px dashed #ddd2c0; }
  .t-kopf { font-size:10pt; font-weight:800; color:var(--f); margin-bottom:2px; }
  .t-nr { font-weight:600; color:#9a8f81; }
  .zeile { display:flex; gap:8px; align-items:baseline; padding:2.5px 0; border-bottom:1px solid #f1eadd; }
  .z-icon { flex:0 0 16px; font-size:11pt; }
  .z-titel { font-weight:700; }
  .z-det { color:#6b6157; font-size:9.5pt; }
  .z-ref { margin-left:auto; flex:0 0 auto; font-family:ui-monospace,'SF Mono',monospace; font-size:8.5pt; color:#8a8178; white-space:nowrap; }
  .z-beleg { font-size:8.5pt; color:#1a5276; white-space:nowrap; }

  table.ueber { width:100%; border-collapse:collapse; margin-top:10px; page-break-inside:auto; }
  table.ueber th { background:#2b2621; color:#fff; font-size:9pt; text-align:left; padding:6px 8px; }
  table.ueber td { padding:5px 8px; border-bottom:1px solid #eee5d6; font-size:9.5pt; vertical-align:top; }
  table.ueber tr:nth-child(even) td { background:#faf7f2; }
  .u-farbe { width:5px; padding:0 !important; }

  .fuss { margin-top:14px; font-size:8.5pt; color:#9a8f81; text-align:center; }
  h3.kap { font-family:'Anton',sans-serif; text-transform:uppercase; font-size:15pt; margin:0 0 6px; page-break-after:avoid; }
`

/** Öffnet das Druckfenster. Muss SYNCHRON aus dem Klick heraus laufen (iOS). */
export function alsPdf(daten) {
  const w = window.open('', '_blank')   // ZUERST, sonst blockt iOS (siehe belege.js)
  if (!w) return false
  const html = baueDruckHtml(daten)
  w.document.open(); w.document.write(html); w.document.close()
  const los = () => { try { w.focus(); w.print() } catch {} }
  w.onload = los
  setTimeout(los, 900)   // Fallback, falls onload nicht feuert
  return true
}

/** Die Druckfassung als HTML — herausgelöst, damit sie ohne Drucker prüfbar ist. */
export function baueDruckHtml({ eintraege, etappen, titel = 'Western Australia', zeitraum = '' }) {
  const proTag = new Map()
  for (const e of eintraege) {
    if (!proTag.has(e.datum)) proTag.set(e.datum, [])
    proTag.get(e.datum).push(e)
  }

  const zahl = (k) => eintraege.filter((e) => e.quelle === k).length
  const deckel = `
    <div class="deckel">
      <div class="d-kicker">${t('Reisekalender')}</div>
      <div class="d-titel">${esc(titel)}</div>
      <div class="d-zeit">${esc(zeitraum)}</div>
      <div class="d-zahlen">
        <span>${tn(etappen.length, '{n} Abschnitt', '{n} Abschnitte')}</span>
        <span>${tn(zahl('Buchung'), '{n} Buchung', '{n} Buchungen')}</span>
        ${zahl('Wanderung') ? `<span>${tn(zahl('Wanderung'), '{n} Wanderung', '{n} Wanderungen')}</span>` : ''}
        ${zahl('Logbuch') ? `<span>${tn(zahl('Logbuch'), '{n} Reisetag', '{n} Reisetage')}</span>` : ''}
      </div>
    </div>`

  const uebersicht = `
    <h3 class="kap">${t('Übersicht')}</h3>
    <table class="ueber">
      <thead><tr><th class="u-farbe"></th><th>${t('Von – bis')}</th><th>${t('Tage')}</th><th>${t('Abschnitt')}</th><th>${t('Termine')}</th></tr></thead>
      <tbody>${etappen.map((a) => {
        const n = eintraege.filter((e) => e.datum >= a.von && e.datum <= a.bis && e.quelle === 'Buchung').length
        return `<tr>
          <td class="u-farbe" style="background:${esc(a.farbe)}"></td>
          <td>${fmtKurz(a.von)}${a.bis !== a.von ? ' – ' + fmtKurz(a.bis) : ''}</td>
          <td>${a.tage}</td>
          <td><b>${esc(a.name)}</b></td>
          <td>${n || '—'}</td></tr>`
      }).join('')}</tbody>
    </table>`

  const zeile = (e) => `
    <div class="zeile">
      <span class="z-icon">${esc(e.icon)}</span>
      <span class="z-titel">${esc(e.titel)}</span>
      ${e.details ? `<span class="z-det">${esc(e.details)}</span>` : ''}
      ${e.belege ? `<span class="z-beleg">📎 ${esc(e.belege)}</span>` : ''}
      ${e.ref ? `<span class="z-ref">${esc(e.ref)}</span>` : ''}
    </div>`

  const abschnitte = etappen.map((a) => {
    const tage = [...proTag.keys()].filter((d) => d >= a.von && d <= a.bis).sort()
    if (!tage.length) return ''
    return `
      <section style="--f:${esc(a.farbe)}">
        <div class="a-kopf">
          <h2 class="abschnitt">${esc(a.name)}</h2>
          <div class="a-zeit">${fmtTag(a.von)}${a.bis !== a.von ? ' – ' + fmtTag(a.bis) : ''} · ${tn(a.tage, '{n} Tag', '{n} Tage')}</div>
        </div>
        ${tage.map((d) => {
          const es = proTag.get(d)
          return `<div class="tagblock" style="--f:${esc(a.farbe)}">
            <div class="t-kopf">${wtag(d)}, ${fmtTag(d)} <span class="t-nr">· ${t('Tag {n}', { n: es[0].tagNr })}</span></div>
            ${es.map(zeile).join('')}
          </div>`
        }).join('')}
      </section>`
  }).join('')

  // Was in keine Etappe fällt, geht sonst still verloren.
  const drin = new Set(etappen.flatMap((a) => [...proTag.keys()].filter((d) => d >= a.von && d <= a.bis)))
  const rest = [...proTag.keys()].filter((d) => !drin.has(d)).sort()
  const ausserhalb = rest.length ? `
    <h3 class="kap" style="margin-top:18px">${t('Außerhalb der Abschnitte')}</h3>
    ${rest.map((d) => `<div class="tagblock" style="--f:#8a8178">
      <div class="t-kopf">${wtag(d)}, ${fmtTag(d)}</div>${proTag.get(d).map(zeile).join('')}</div>`).join('')}` : ''

  return `<!doctype html><html lang="${istEn ? 'en' : 'de'}"><head><meta charset="utf-8">
    <!-- Ohne das macht Safari aus jeder Buchungsnummer einen blauen Telefon-Link. -->
    <meta name="format-detection" content="telephone=no">
    <title>${t('Reisekalender')} — ${esc(titel)}</title><style>${DRUCK_CSS}</style></head>
    <body>${deckel}${uebersicht}${abschnitte}${ausserhalb}
    <div class="fuss">${t('Erstellt aus TravelBuddy')} · ${new Date().toLocaleDateString(LOCALE)}</div>
    </body></html>`
}

// ===========================================================================
// Excel (.xlsx von Hand)
// ===========================================================================

// --- ZIP ohne Komprimierung -------------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(dateien) {
  const enc = new TextEncoder()
  const teile = [], zentral = []
  let versatz = 0
  const u16 = (n) => [n & 255, (n >> 8) & 255]
  const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]

  for (const { name, inhalt } of dateien) {
    const daten = enc.encode(inhalt)
    const nb = enc.encode(name)
    const c = crc32(daten)
    // Lokaler Kopf (Signatur, Version, Flags, Methode 0, Zeit/Datum 0, CRC, Größen)
    const kopf = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(c), ...u32(daten.length), ...u32(daten.length), ...u16(nb.length), ...u16(0)]
    teile.push(new Uint8Array(kopf), nb, daten)
    zentral.push({ name: nb, crc: c, groesse: daten.length, versatz })
    versatz += kopf.length + nb.length + daten.length
  }

  const verz = []
  for (const e of zentral) {
    verz.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0), ...u32(e.crc), ...u32(e.groesse), ...u32(e.groesse),
      ...u16(e.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.versatz)]), e.name)
  }
  const verzGroesse = verz.reduce((n, a) => n + a.length, 0)
  const ende = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(zentral.length), ...u16(zentral.length), ...u32(verzGroesse), ...u32(versatz), ...u16(0)])

  return new Blob([...teile, ...verz, ende], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// --- Tabelle ----------------------------------------------------------------
const xesc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
const spalte = (i) => { let s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0); return s }
// Excel zählt Tage ab dem 30.12.1899.
const excelDatum = (s) => Math.round((tag(s) - new Date(1899, 11, 30, 12)) / 86400000)

const SPALTEN = [
  { titel: t('Datum'), breite: 12, typ: 'datum' },
  { titel: t('Tag'), breite: 6, typ: 'zahl' },
  { titel: t('Wo.'), breite: 6 },
  { titel: t('Abschnitt'), breite: 26 },
  { titel: t('Art'), breite: 14 },
  { titel: t('Titel'), breite: 34 },
  { titel: t('Details'), breite: 46 },
  { titel: t('Uhrzeit'), breite: 9 },
  { titel: t('Buchungsnummer'), breite: 18 },
  { titel: t('Belege'), breite: 24 },
  { titel: t('Quelle'), breite: 11 },
]

// Füllfarben je Quelle — Buchung blau, Wanderung grün, Logbuch orange.
const FUELL = { Buchung: 4, Wanderung: 5, Logbuch: 6 }

export function alsXlsx({ eintraege }, dateiname = t('Reisekalender') + '.xlsx') {
  const zeilen = eintraege.map((e) => [
    { w: e.datum, t: 'datum' }, { w: e.tagNr, t: 'zahl' }, { w: e.wochentag },
    { w: e.abschnitt }, { w: e.art }, { w: e.titel }, { w: e.details },
    { w: e.zeit }, { w: e.ref }, { w: e.belege }, { w: t(e.quelle) },
  ].map((z) => ({ ...z, s: FUELL[e.quelle] || 3 })))

  const zelle = (r, c, z) => {
    const ref = `${spalte(c)}${r}`
    if (z.t === 'datum' && z.w) return `<c r="${ref}" s="2"><v>${excelDatum(z.w)}</v></c>`
    if (z.t === 'zahl' && z.w !== '' && z.w != null) return `<c r="${ref}" s="${z.s}"><v>${Number(z.w)}</v></c>`
    if (!z.w) return `<c r="${ref}" s="${z.s}"/>`
    return `<c r="${ref}" s="${z.s}" t="inlineStr"><is><t xml:space="preserve">${xesc(z.w)}</t></is></c>`
  }

  const kopf = `<row r="1" ht="20" customHeight="1">${SPALTEN.map((s, i) =>
    `<c r="${spalte(i)}1" s="1" t="inlineStr"><is><t>${xesc(s.titel)}</t></is></c>`).join('')}</row>`
  const koerper = zeilen.map((z, i) => `<row r="${i + 2}">${z.map((c, j) => zelle(i + 2, j, c)).join('')}</row>`).join('')
  const letzte = `${spalte(SPALTEN.length - 1)}${zeilen.length + 1}`

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" tabSelected="1">
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${SPALTEN.map((s, i) => `<col min="${i + 1}" max="${i + 1}" width="${s.breite}" customWidth="1"/>`).join('')}</cols>
<sheetData>${kopf}${koerper}</sheetData>
<autoFilter ref="A1:${letzte}"/>
</worksheet>`

  // Stil 0 Standard · 1 Kopf · 2 Datum · 3 normal · 4/5/6 eingefärbt
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="ddd\\ dd\\.\\ mmm\\ yyyy"/></numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/><color rgb="FF2B2621"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2B2621"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8F3EE"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDF1E0"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFEEE5D6"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`

  const blob = zip([
    { name: '[Content_Types].xml', inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>` },
    { name: '_rels/.rels', inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { name: 'xl/workbook.xml', inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Reisekalender" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Reisekalender!$A$1:${'$' + spalte(SPALTEN.length - 1) + '$' + (zeilen.length + 1)}</definedName></definedNames>
</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { name: 'xl/styles.xml', inhalt: styles },
    { name: 'xl/worksheets/sheet1.xml', inhalt: sheet },
  ])

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = dateiname
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
  return zeilen.length
}
