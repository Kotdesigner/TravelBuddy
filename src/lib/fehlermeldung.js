// Fehler melden: Text, freiwillige E-Mail und bis zu drei Bildschirmfotos gehen an die eigene
// Netlify-Funktion netlify/functions/fehlermeldung.mjs, die sie über Resend als Mail an den Anbieter
// schickt (Adresse nur in Netlify). Ohne Netlify (lokal, Mac-App) geht es über die Mail-App an EMPFAENGER. Netlify Forms war vorher der Weg, dessen Spamfilter hat aber
// echte Meldungen aussortiert und dafür keine Mail verschickt.
//
// Mit geht nur, was in der Meldung steht und was unten im Formular sichtbar aufgelistet ist:
// Version, Gerät, Browser, Sprache, Bildschirmgröße und die zuletzt offene Seite. Keine Reisedaten,
// kein Logbuch, kein Standort.

export const ZIEL = '/api/fehlermeldung'
export const MAX_BILDER = 3
export const FELDER = ['bot-field', 'beschreibung', 'email', 'technik', 'screenshot1', 'screenshot2', 'screenshot3']
const BILD_PX = 1800
const BILD_QUALITAET = 0.82
// Eine Netlify-Funktion nimmt nur wenige MB je Anfrage an (die Funktion prüft 5 MB). Etwas Luft für Text.
export const MAX_BYTES = 4.5 * 1024 * 1024

/** Graue Hilfe im leeren Textfeld. Verschwindet, sobald man tippt. */
export const HILFE = {
  de: 'Was geht nicht?\nWann tritt es auf? Auf welcher Seite, nach welchem Knopf?\nWas hast du erwartet?\nPassiert es jedes Mal oder nur manchmal?',
  en: 'What is not working?\nWhen does it happen? On which page, after which button?\nWhat did you expect?\nDoes it happen every time or only sometimes?',
}

// ---------------------------------------------------------------- zuletzt offene Seite

let letzteSeite = ''
/** Merkt sich die zuletzt offene Seite (ohne die Fehlerseite selbst). Rückgabe: Funktion zum Beenden. */
export function merkeSeiten() {
  if (typeof window === 'undefined') return () => {}
  const merk = () => { const h = location.hash || '#/heute'; if (!h.startsWith('#/mehr/fehler')) letzteSeite = h }
  merk()
  window.addEventListener('hashchange', merk)
  return () => window.removeEventListener('hashchange', merk)
}
export const zuletztOffen = () => letzteSeite

// ---------------------------------------------------------------- Technik in Klartext

/** Gerät und Browser aus der Kennung des Browsers, grob und ohne Versionsnummern des Geräts */
export function geraetUndBrowser(ua = '', { touch = 0 } = {}) {
  let geraet = 'Computer'
  if (/iPhone/.test(ua)) geraet = 'iPhone'
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) geraet = 'iPad'
  else if (/Android/.test(ua)) geraet = /Mobile/.test(ua) ? 'Android-Handy' : 'Android-Tablet'
  else if (/Macintosh|Mac OS X/.test(ua)) geraet = 'Mac'
  else if (/Windows/.test(ua)) geraet = 'Windows'
  else if (/Linux/.test(ua)) geraet = 'Linux'
  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Firefox\/|FxiOS/.test(ua)) browser = 'Firefox'
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet'
  else if (/Chrome\/|CriOS/.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua)) browser = 'Safari'
  return { geraet, browser }
}

/** Die Zeilen, die mitgeschickt und im Formular angezeigt werden */
export function technikZeilen({ version = '', build = '', ua = '', touch = 0, sprache = 'de', breite = 0, hoehe = 0, seite = '', alsApp = false } = {}) {
  const en = sprache === 'en'
  const { geraet: g, browser } = geraetUndBrowser(ua, { touch })
  const geraet = en ? ({ 'Android-Handy': 'Android phone', 'Android-Tablet': 'Android tablet' }[g] || g) : g
  return [
    [en ? 'Version' : 'Version', [version, build && (en ? 'build ' : 'Build ') + build].filter(Boolean).join(' · ')],
    [en ? 'Device' : 'Gerät', `${geraet}, ${browser}${alsApp ? (en ? ', installed as app' : ', als App eingerichtet') : ''}`],
    [en ? 'Language' : 'Sprache', en ? 'English' : 'Deutsch'],
    [en ? 'Screen' : 'Bildschirm', breite && hoehe ? `${breite} × ${hoehe}` : ''],
    [en ? 'Last page' : 'Zuletzt offen', seite || ''],
  ].filter(([, w]) => w)
}

export const technikText = (zeilen) => zeilen.map(([k, w]) => `${k}: ${w}`).join('\n')

// ---------------------------------------------------------------- Formular

/** Ist die Meldung sendefertig? */
export const sendefertig = (text) => String(text || '').trim().length >= 3

/** Sieht die freiwillige E-Mail-Angabe brauchbar aus? Leer ist erlaubt. */
export const emailOk = (email) => !String(email || '').trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())

/** Gesamtgröße aller Bilder */
export const bildBytes = (bilder = []) => bilder.reduce((s, b) => s + (b?.size || 0), 0)

/**
 * FormData für die Funktion. `bilder` sind Blobs oder Files (schon verkleinert), höchstens drei.
 * `FD` lässt sich in Tests ersetzen.
 */
export function baueFormular({ text, email = '', technik = '', bilder = [] }, FD = FormData) {
  const fd = new FD()
  fd.append('bot-field', '')
  fd.append('beschreibung', String(text || '').trim())
  fd.append('email', String(email || '').trim())
  fd.append('technik', technik)
  bilder.slice(0, MAX_BILDER).forEach((b, i) => fd.append(`screenshot${i + 1}`, b, b.name || `bildschirmfoto-${i + 1}.jpg`))
  return fd
}

/**
 * Abschicken. Kein Content-Type setzen, den Rahmen für die Dateien setzt der Browser selbst.
 * Rückgabe: { ok, grund } mit grund 'netz' | 'abgelehnt' | 'zu-gross'.
 */
export async function sende(fd, { f = (typeof fetch === 'function' ? fetch : null), ziel = ZIEL, groesse = 0 } = {}) {
  if (groesse > MAX_BYTES) return { ok: false, grund: 'zu-gross' }
  if (!f) return { ok: false, grund: 'netz' }
  try {
    const r = await f(ziel, { method: 'POST', body: fd })
    // Nur eine ausdrückliche Bestätigung der Funktion zählt. Ein Server, der einfach „200“ sagt
    // (lokale Vorschau, alte Fassung ohne Funktion), gilt nicht als gesendet.
    let j = null
    try { j = await r.json() } catch {}
    return r && r.ok && j?.ok === true ? { ok: true } : { ok: false, grund: 'abgelehnt', status: r?.status, info: j?.grund }
  } catch {
    return { ok: false, grund: 'netz' }
  }
}

// ---------------------------------------------------------------- Wo geht das Absenden?

export const EMPFAENGER = 'travelbuddy.oz@outlook.com'

/**
 * Die Funktion gibt es nur auf der veröffentlichten Netlify-Seite. Lokal (Vorschau, Mac-App) gibt es
 * keinen Formulardienst, ein lokaler Server würde trotzdem „OK“ antworten und es käme nie eine Mail an.
 */
export const istNetlify = (host = '') => /(^|\.)netlify\.app$/i.test(String(host))

/** Basic: ohne Netlify (zum Beispiel aus dem Quellcode selbst gestartet) eine Meldung auf GitHub vorbereiten */
export const ISSUES = 'https://github.com/Kotdesigner/TravelBuddy/issues/new'
export function issueLink({ text = '', technik = '' } = {}) {
  const titel = String(text).trim().split(/\r?\n/)[0].slice(0, 80) || 'Fehlermeldung'
  const koerper = [String(text).trim(), '', '---', technik].join('\n').slice(0, 6000)
  return `${ISSUES}?title=${encodeURIComponent(titel)}&body=${encodeURIComponent(koerper)}`
}

/** Mail-App mit Empfänger, Betreff und Text öffnen, für Fassungen ohne Netlify. Bilder hängt man dort selbst an. */
export function mailLink({ text = '', technik = '', sprache = 'de' } = {}) {
  const en = sprache === 'en'
  const betreff = en ? 'TravelBuddy: problem report' : 'TravelBuddy: Fehlermeldung'
  const koerper = [String(text).trim(), '', '---', technik].join('\n')
  return `mailto:${EMPFAENGER}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(koerper)}`
}

// ---------------------------------------------------------------- Bilder (nur im Browser)

/** Bildschirmfoto auf höchstens 1800 px lange Kante bringen, als JPEG */
export function verkleinere(file, { maxPx = BILD_PX, qualitaet = BILD_QUALITAET } = {}) {
  return new Promise((fertig, fehler) => {
    if (!file || !(file.type?.startsWith('image/') || /\.(heic|heif)$/i.test(file.name || ''))) return fehler(new Error('kein Bild'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
      const cv = document.createElement('canvas')
      cv.width = Math.max(1, Math.round(img.naturalWidth * s))
      cv.height = Math.max(1, Math.round(img.naturalHeight * s))
      const ctx = cv.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, cv.width, cv.height)
      URL.revokeObjectURL(url)
      cv.toBlob((b) => {
        cv.width = 0; cv.height = 0
        if (!b) return fehler(new Error('Bild konnte nicht gelesen werden'))
        const name = String(file.name || 'bildschirmfoto').replace(/\.[^.]+$/, '') + '.jpg'
        fertig(new File([b], name, { type: 'image/jpeg' }))
      }, 'image/jpeg', qualitaet)
    }
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild konnte nicht gelesen werden')) }
    img.src = url
  })
}

// ---------------------------------------------------------------- Entwurf

const KEY_ENTWURF = 'tb-fehlermeldung-entwurf'
export function liesEntwurf() {
  try { const j = JSON.parse(localStorage.getItem(KEY_ENTWURF) || '{}'); return { text: j.text || '', email: j.email || '' } } catch { return { text: '', email: '' } }
}
export function merkeEntwurf({ text = '', email = '' }) {
  try { if (text || email) localStorage.setItem(KEY_ENTWURF, JSON.stringify({ text, email })); else localStorage.removeItem(KEY_ENTWURF) } catch {}
}
