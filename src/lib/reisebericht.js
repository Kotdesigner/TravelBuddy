// Reisebericht zum Teilen (11.10.): eine einzige HTML-Datei, die man verschicken kann.
// Alles steckt in der Datei (Text, Weltkugeln als PNG, Fotos als JPEG, Schrift), sie
// enthält kein Skript und lädt nichts nach.
//
// Datenschutz: Das Modell nimmt NUR, was ausdrücklich erlaubt ist (Positivliste):
//   Etappen (Name, Zeitraum, Farbe), Routen (Name, Art, Namen der Stopps),
//   Orte (Namen), Tagebuchtexte (nur wenn gewünscht), ausgewählte Fotos (aus dem Logbuch
//   und die Fotos fürs Tagebuch, die nur auf dem Gerät liegen).
// Nie: Buchungen und Buchungsnummern, Dokumente, Kosten, Notfallkontakte, Koordinaten.
// Freitexte laufen zusätzlich durch `entschaerfe` (Codes, Telefonnummern, Mailadressen).
// Reine Funktionen ohne Browser, damit sie sich prüfen lassen.

import { etappenMitDatum, routenDerEtappe, tageZwischen } from './plan.js'
import { bereich, tagMonatJahr, wochentagLang, tageText } from './format.js'
import { t, tn, istEn } from './i18n.js'

export const MAX_BYTES = 8 * 1024 * 1024

export function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

/** Private Kennungen aus Freitext entfernen: Mailadressen, Telefonnummern, Buchungscodes. */
export function entschaerfe(text) {
  let t = String(text ?? '')
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '•••')
  // Stichwort mit folgendem Code („Buchungsnr. AB12CD“, „Booking ref: 4711-0815“)
  t = t.replace(/\b(buchungs\s*-?\s*(nr|nummer|code)|bestätigungs\s*-?\s*(nr|nummer|code)|booking(\s*(ref|reference|no|number|id|code))?|confirmation(\s*(no|number|code))?|reservierungs\s*-?\s*(nr|nummer)|reservation(\s*(no|number|code))?|ref(erenz)?|pnr|ticket\s*-?\s*(nr|nummer|no))\b\.?\s*[:#]?\s*[A-Za-z0-9][A-Za-z0-9-]{2,}/giu, (m, w) => w + ' •••')
  // Telefonnummern: mindestens 8 Ziffern, auch mit Leerzeichen, Klammern, Strichen, +
  // (ohne Lookbehind: ältere Safari kennen ihn nicht)
  t = t.replace(/(^|[^\w.])(\+?\d[\d ()/-]{6,}\d)(?![\w.])/g, (m, vor, nr) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(nr)) return m
    return nr.replace(/\D/g, '').length >= 8 ? vor + '•••' : m
  })
  // Codes aus Großbuchstaben und Ziffern (mind. 6 Zeichen, mind. 2 Ziffern), z. B. „QF1234X9“
  t = t.replace(/\b(?=[A-Z0-9-]*\d[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{6,}\b/g, '•••')
  return t
}

const istFlug = (x) => (x?.art || 'auto') === 'flug' || !!x?.route?.flug
const stoppNamen = (x) => (x?.stops || []).map((s) => entschaerfe(String(s?.name || '').trim())).filter(Boolean)
const alsSet = (x) => (x == null ? null : x instanceof Set ? x : new Set(x))

/**
 * Fotos aus dem Logbuch, gruppiert nach Etappe, zum Auswählen. id = `${eintragId}:${index}`.
 * Dazu optional die Fotos fürs Tagebuch vom Gerät (tagebuch-fotos.js): id = `g:${id}`, ohne
 * `src`, aber mit `geraetId`. Ihre Bilddaten holt die Ansicht selbst und reicht sie verkleinert
 * über `fotoSrc` an baueBerichtHtml. Mitgenommen werden nur Tag und Ortsname, nie Koordinaten.
 */
export function fotosZurAuswahl(journal, etappen, geraet = []) {
  const out = []
  for (const et of etappen) {
    for (const e of journal || []) {
      if (!e?.datum || e.datum < et.von || e.datum > et.bis || !Array.isArray(e.fotos)) continue
      e.fotos.forEach((src, i) => { if (typeof src === 'string' && src) out.push({ id: `${e.id}:${i}`, src, datum: e.datum, ort: entschaerfe(e.ort || ''), etappeId: et.reise?.id ?? et.id }) })
    }
    for (const f of geraet || []) {
      if (!f?.id || !f.datum || f.datum < et.von || f.datum > et.bis) continue
      out.push({ id: `g:${f.id}`, src: '', geraetId: f.id, datum: f.datum, ort: entschaerfe(f.ort || ''), etappeId: et.reise?.id ?? et.id })
    }
  }
  return out.sort((a, b) => a.datum.localeCompare(b.datum))
}

/**
 * Das Modell des Berichts, nur aus erlaubten Feldern.
 * @param o.etappenIds  Auswahl (Array/Set), null = alle
 * @param o.mitTexten   Tagebuchtexte mitnehmen
 * @param o.fotoIds     ausgewählte Fotos (Array/Set)
 * @param o.geraetFotos Fotos fürs Tagebuch vom Gerät (Angaben aus tagebuch-fotos.js)
 */
export function berichtModell({ reisen = [], journal = [], gesamtStart, etappenIds = null, mitTexten = false, fotoIds = [], geraetFotos = [], titel = 'Western Australia' } = {}) {
  const wahl = alsSet(etappenIds)
  const fotoWahl = alsSet(fotoIds) || new Set()
  const plan = etappenMitDatum(reisen, gesamtStart).filter((e) => !wahl || wahl.has(e.reise.id))
  const alleFotos = fotosZurAuswahl(journal, plan, geraetFotos)
  const etappen = plan.map((e) => {
    const r = e.reise
    const routen = [r, ...routenDerEtappe(reisen, r.id)]
      .map((x) => ({ name: entschaerfe(x.name || ''), art: istFlug(x) ? 'flug' : 'fahrt', stopps: stoppNamen(x) }))
      .filter((x) => x.stopps.length >= 2 || (x.name && x.stopps.length))
    const eintraege = (journal || []).filter((j) => j?.datum && j.datum >= e.von && j.datum <= e.bis)
      .sort((a, b) => a.datum.localeCompare(b.datum))
    const orte = []
    const gesehen = new Set()
    const dazu = (n) => { const k = n.toLowerCase(); if (n && !gesehen.has(k)) { gesehen.add(k); orte.push(n) } }
    for (const j of eintraege) dazu(entschaerfe(String(j.ort || '').trim()))
    for (const x of routen) x.stopps.forEach(dazu)
    const tage = mitTexten
      ? eintraege.filter((j) => String(j.text || '').trim()).map((j) => ({ datum: j.datum, ort: entschaerfe(j.ort || ''), text: entschaerfe(String(j.text).trim()) }))
      : []
    const fotos = alleFotos.filter((f) => f.etappeId === r.id && fotoWahl.has(f.id)).map(({ id, src, datum, ort, geraetId }) => (geraetId ? { id, src, datum, ort, geraetId } : { id, src, datum, ort }))
    return { id: r.id, name: entschaerfe(r.name || t('Etappe')), farbe: /^#[0-9a-f]{3,8}$/i.test(r.farbe || '') ? r.farbe : '#8a3f16', von: e.von, bis: e.bis, tage: e.tage, routen, orte: orte.slice(0, 40), eintraege: tage, fotos }
  })
  const von = etappen.length ? etappen.reduce((m, x) => (x.von < m ? x.von : m), etappen[0].von) : null
  const bis = etappen.length ? etappen.reduce((m, x) => (x.bis > m ? x.bis : m), etappen[0].bis) : null
  return { titel: entschaerfe(titel), von, bis, tage: von ? tageZwischen(von, bis) + 1 : 0, mitTexten: !!mitTexten, etappen }
}

const bytes = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : Buffer.byteLength(s, 'utf8'))
const istBild = (s) => typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)
const istSchrift = (s) => typeof s === 'string' && /^data:font\/woff2;base64,[A-Za-z0-9+/=]+$/.test(s)

function css(schrift) {
  const titel = schrift ? "'TB Anton', Impact, 'Arial Narrow', sans-serif" : "Georgia, 'Times New Roman', serif"
  return `${schrift ? `@font-face{font-family:'TB Anton';src:url(${schrift}) format('woff2');font-display:swap}` : ''}
:root{--bg:#fbf8f3;--ink:#2b2621;--muted:#5a5248;--card:#fffdfa;--line:#e5ddd0;--brand:#8a3f16;--akzent:#f0b453;--flaeche:#faf5ec;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#1e150e;--ink:#f0e7da;--muted:#b3a795;--card:#2a1f15;--line:#453522;--brand:#e89a63;--flaeche:#2c2115}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Liberation Sans',Arial,sans-serif}
.kopf{background:radial-gradient(ellipse 90% 70% at 50% 40%,#15305a 0%,#0b1a33 50%,#050b17 100%);color:#f4ece0;text-align:center;padding:48px 20px 40px}
.kopf h1{font-family:${titel};font-weight:400;font-size:clamp(44px,12vw,92px);line-height:.98;letter-spacing:.01em;margin:0;text-wrap:balance}
.kopf h1 span{display:block;color:var(--akzent)}
.kopf .zeit{margin:14px 0 0;font-weight:700;font-size:17px}
.kopf img{display:block;width:min(340px,80vw);height:auto;margin:24px auto 8px}
.zahlen{display:flex;justify-content:center;gap:28px;margin:8px 0 0;padding:0;list-style:none}
.zahlen b{display:block;font-family:${titel};font-weight:400;font-size:34px;line-height:1.1;color:#fff}
.zahlen span{font-size:13px;opacity:.8}
main{max-width:760px;margin:0 auto;padding:12px 18px 40px}
.etappe{padding:28px 0 8px;border-bottom:1px solid var(--line)}
.etappe:last-child{border-bottom:0}
.e-kopf{display:flex;gap:16px;align-items:center}
.e-kopf img{width:120px;height:120px;flex:none}
.e-band{border-left:6px solid var(--f);padding-left:12px}
.etappe h2{font-family:${titel};font-weight:400;font-size:clamp(28px,7vw,40px);line-height:1.05;margin:0;text-wrap:balance}
.e-zeit{margin:4px 0 0;color:var(--muted);font-weight:700;font-variant-numeric:tabular-nums}
.routen{margin:16px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.routen li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.routen b{display:block}
.routen small{color:var(--muted);font-size:14px}
.orte{margin:12px 0 0;display:flex;flex-wrap:wrap;gap:6px}
.orte span{background:var(--flaeche);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:14px}
.fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:18px 0 0}
.fotos figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.fotos img{display:block;width:100%;height:auto}
.fotos figcaption{padding:6px 10px 8px;font-size:13.5px;color:var(--muted)}
.tag{margin:18px 0 0}
.tag h3{margin:0;font-size:15px;color:var(--brand)}
.tag p{margin:4px 0 0;white-space:pre-line;text-wrap:pretty;max-width:65ch}
footer{text-align:center;color:var(--muted);font-size:13px;padding:24px 16px 40px}
@media print{.kopf{-webkit-print-color-adjust:exact;print-color-adjust:exact}.etappe{break-inside:avoid-page}}`
}

function etappeHtml(e, kugel) {
  const routen = e.routen.length
    ? `<ul class="routen">${e.routen.map((r) => `<li><b>${r.art === 'flug' ? '✈️' : '🚐'} ${esc(r.name || (r.stopps.length > 1 ? r.stopps[0] + ' → ' + r.stopps.at(-1) : r.stopps[0]))}</b>${r.stopps.length ? `<small>${r.stopps.slice(0, 16).map(esc).join(' → ')}${r.stopps.length > 16 ? ' …' : ''}</small>` : ''}</li>`).join('')}</ul>`
    : ''
  const orte = e.orte.length ? `<div class="orte" aria-label="${t('Orte')}">${e.orte.map((o) => `<span>${esc(o)}</span>`).join('')}</div>` : ''
  const texte = e.eintraege.map((t) => `<div class="tag"><h3>${esc(wochentagLang(t.datum))}, ${esc(tagMonatJahr(t.datum))}${t.ort ? `, ${esc(t.ort)}` : ''}</h3><p>${esc(t.text)}</p></div>`).join('')
  const fotos = e.fotos.length
    ? `<div class="fotos">${e.fotos.map((f) => `<figure><img src="${f.src}" alt="${esc(f.ort || t('Reisefoto'))}" loading="lazy"><figcaption>${[f.ort, tagMonatJahr(f.datum)].filter(Boolean).map(esc).join(', ')}</figcaption></figure>`).join('')}</div>`
    : ''
  return `<section class="etappe" style="--f:${esc(e.farbe)}"><div class="e-kopf">${kugel ? `<img src="${kugel}" alt="">` : ''}<div class="e-band"><h2>${esc(e.name)}</h2><p class="e-zeit">${esc(bereich(e.von, e.bis))}, ${esc(tageText(e.tage))}</p></div></div>${routen}${orte}${fotos}${texte}</section>`
}

function render(m, { kugeln, fotoSrc, schrift, erstellt, ohneFotos, ohneKugeln }) {
  const kugel = (id) => (!ohneKugeln && istBild(kugeln?.[id]) ? kugeln[id] : '')
  const etappen = m.etappen.map((e) => ({
    ...e,
    fotos: e.fotos.filter((f) => !ohneFotos.has(f.id)).map((f) => ({ ...f, src: fotoSrc?.get?.(f.id) ?? fotoSrc?.[f.id] ?? f.src })).filter((f) => istBild(f.src)),
  }))
  const zeitraum = m.von ? t('{von} bis {bis}', { von: tagMonatJahr(m.von), bis: tagMonatJahr(m.bis) }) : ''
  const teile = String(m.titel || '').trim().split(/\s+/)
  const h1 = teile.length > 1 ? `${esc(teile.slice(0, -1).join(' '))}<span>${esc(teile.at(-1))}</span>` : esc(m.titel)
  const html = `<!doctype html>
<html lang="${istEn ? 'en' : 'de'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">
<meta name="robots" content="noindex">
<title>${esc(m.titel)}${zeitraum ? ', ' + esc(zeitraum) : ''}</title>
<style>${css(schrift)}</style></head>
<body>
<header class="kopf"><h1>${h1}</h1>${zeitraum ? `<p class="zeit">${esc(zeitraum)}</p>` : ''}${kugel('gesamt') ? `<img src="${kugel('gesamt')}" alt="${t('Weltkugel mit der ganzen Reise')}">` : ''}
<ul class="zahlen"><li><b>${m.tage}</b><span>${tn(m.tage, 'Tag', 'Tage')}</span></li><li><b>${m.etappen.length}</b><span>${tn(m.etappen.length, 'Etappe', 'Etappen')}</span></li></ul></header>
<main>${etappen.map((e) => etappeHtml(e, kugel(e.id))).join('\n')}</main>
<footer>${t('Reisebericht aus TravelBuddy')}${erstellt ? t(', erstellt am {datum}', { datum: esc(tagMonatJahr(erstellt)) }) : ''}</footer>
</body></html>`
  return { html, fotosDrin: etappen.reduce((n, e) => n + e.fotos.length, 0) }
}

/**
 * Baut die HTML-Datei. Wird sie größer als `maxBytes`, fallen zuerst Fotos weg (immer aus
 * der Etappe mit den meisten, von hinten), dann die Weltkugeln, zuletzt die Schrift.
 * @param o.kugeln   { gesamt: dataURL, [etappeId]: dataURL }
 * @param o.fotoSrc  Map oder Objekt id → verkleinerte JPEG-data-URL
 * @param o.schrift  data:font/woff2 (Anton) oder null
 * @returns { html, bytes, fotosDrin, fotosWeg, ohneKugeln, ohneSchrift }
 */
export function baueBerichtHtml(modell, { kugeln = {}, fotoSrc = null, schrift = null, maxBytes = MAX_BYTES, erstellt = null } = {}) {
  const opt = { kugeln, fotoSrc, schrift: istSchrift(schrift) ? schrift : null, erstellt, ohneFotos: new Set(), ohneKugeln: false }
  let r = render(modell, opt)
  let n = bytes(r.html)
  const reihe = () => {
    // Etappe mit den meisten verbliebenen Fotos, dort das letzte
    let best = null
    for (const e of modell.etappen) {
      const rest = e.fotos.filter((f) => !opt.ohneFotos.has(f.id))
      if (rest.length && (!best || rest.length > best.length)) best = rest
    }
    return best ? best[best.length - 1] : null
  }
  const srcVon = (f) => String(fotoSrc?.get?.(f.id) ?? fotoSrc?.[f.id] ?? f.src ?? '')
  while (n > maxBytes) {
    const f = reihe()
    if (!f) break
    opt.ohneFotos.add(f.id)
    n -= srcVon(f).length + 120   // Schätzung, unten genau nachgemessen
    if (n <= maxBytes) { r = render(modell, opt); n = bytes(r.html) }
  }
  if (n > maxBytes && !opt.ohneKugeln) { opt.ohneKugeln = true; r = render(modell, opt); n = bytes(r.html) }
  if (n > maxBytes && opt.schrift) { opt.schrift = null; r = render(modell, opt); n = bytes(r.html) }
  r = render(modell, opt); n = bytes(r.html)
  return { html: r.html, bytes: n, fotosDrin: r.fotosDrin, fotosWeg: opt.ohneFotos.size, ohneKugeln: opt.ohneKugeln, ohneSchrift: !!schrift && !opt.schrift }
}

/** Dateiname „Reisebericht_Western-Australia_2026-11.html“. */
export function dateiName(modell) {
  const name = String(modell?.titel || t('Reise')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || t('Reise')
  return `${t('Reisebericht')}_${name}${modell?.von ? '_' + modell.von.slice(0, 7) : ''}.html`
}
