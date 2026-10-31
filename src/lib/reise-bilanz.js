// Reise-Bilanz fürs Tagebuch: Zahlen aus Logbuch, Plan und Wanderungen (reine Logik).
// Es kommt nur heraus, wofür es Daten gibt. Fehlt etwas, fehlt der Schlüssel ganz.
import { kursFuer, inBeide } from './fx.js'
import { album } from './tierwelt.js'
import { eintragTage } from './plan.js'
import { LOCALE, t, tn } from './i18n.js'
import { dezimal, eur as euro, aud as audT } from './format.js'

const zahlAus = (w) => {
  if (w == null || w === '') return null
  const n = typeof w === 'number' ? w : parseFloat(String(w).replace(',', '.'))
  return isFinite(n) ? n : null
}

/** Erste Zahl aus einem Freitext wie „38 °C, schwül“. Unplausibles fällt heraus. */
export function temperaturAus(text) {
  if (typeof text === 'number') return text > -30 && text < 60 ? text : null
  const m = String(text ?? '').match(/-?\d+(?:[.,]\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0].replace(',', '.'))
  return isFinite(n) && n > -30 && n < 60 ? n : null
}

const hatWert = (w) => w != null && w !== '' && !(Array.isArray(w) && !w.length) && !(typeof w === 'object' && !Array.isArray(w) && !Object.keys(w).length)

/** Hat ein Eintrag irgendetwas Geschriebenes? (wie im Tagebuch) */
export const eintragHatInhalt = (e) => !!e && !!((e.text || '').trim() || (e.ort || '').trim() || (e.fotos || []).length || (e.audios || []).length
  || (e.sichtungen || []).length || Object.values(e.felder || {}).some(hatWert))

const normOrt = (s) => String(s || '').trim().replace(/\s+/g, ' ')

/**
 * @param journal      Logbuch-Einträge
 * @param wanderungen  Wanderungen
 * @param reisen       Etappen und Routen (für km ohne Tageskilometer)
 * @param plan         { start, ende, tage } aus planUeberblick (optional)
 * @param kurse        Tageskurse EUR je AUD (fxKurse), sonst Näherung
 */
export function berechneBilanz({ journal = [], wanderungen = [], reisen = [], plan = null, kurse = {} } = {}) {
  const b = {}
  const js = (journal || []).filter(Boolean)
  const geschrieben = new Set(js.filter((e) => e.datum && eintragHatInhalt(e)).flatMap(eintragTage))

  // Reisetage: aus dem Plan, sonst Spanne der geschriebenen Tage
  if (plan?.tage) b.reisetage = plan.tage
  else if (geschrieben.size) {
    const d = [...geschrieben].sort()
    b.reisetage = Math.round((Date.parse(d[d.length - 1] + 'T12:00:00Z') - Date.parse(d[0] + 'T12:00:00Z')) / 864e5) + 1
  }
  if (geschrieben.size) b.geschrieben = geschrieben.size

  // Kilometer: Tageskilometer aus dem Logbuch, sonst die gefahrenen Routen des Plans
  const kmTage = js.map((e) => zahlAus(e.felder?.distance_km)).filter((n) => n != null && n > 0)
  if (kmTage.length) b.km = { wert: Math.round(kmTage.reduce((a, n) => a + n, 0)), quelle: 'logbuch', tage: kmTage.length }
  else {
    let km = 0
    for (const r of reisen || []) {
      if (!r || (r.art || 'auto') === 'flug' || r.route?.flug) continue
      km += Number(r.route?.km) || 0
    }
    if (km > 0) b.km = { wert: Math.round(km), quelle: 'plan' }
  }

  // Kosten: Währung je Eintrag (Vorgabe AUD wie im Logbuch), Umrechnung zum Tageskurs
  let tank = { eur: 0, aud: 0 }, gesamt = { eur: 0, aud: 0 }, kostenTage = 0
  for (const e of js) {
    const cur = e.felder?.waehrung || 'AUD'
    const kurs = kursFuer(kurse, e.datum)
    let hat = false
    for (const [k, v] of Object.entries(e.felder || {})) {
      if (!k.startsWith('kosten_')) continue
      const n = zahlAus(v)
      if (n == null || n <= 0) continue
      const x = inBeide(n, cur, kurs)
      gesamt.eur += x.eur; gesamt.aud += x.aud; hat = true
      if (k === 'kosten_sprit') { tank.eur += x.eur; tank.aud += x.aud }
    }
    if (hat) kostenTage++
  }
  const rund = (x) => ({ eur: Math.round(x.eur), aud: Math.round(x.aud) })
  if (gesamt.eur > 0.5) b.kosten = { gesamt: rund(gesamt), tank: tank.eur > 0.5 ? rund(tank) : null, tage: kostenTage }

  // Fotos: Logbuch und Wanderungen
  const fotos = js.reduce((n, e) => n + (e.fotos || []).length, 0) + (wanderungen || []).reduce((n, w) => n + (w?.fotos || []).length, 0)
  if (fotos) b.fotos = fotos

  // Wanderungen gemacht
  const gemacht = (wanderungen || []).filter((w) => w && w.status === 'gemacht')
  if (gemacht.length) b.wanderungen = { anzahl: gemacht.length, km: Math.round(gemacht.reduce((n, w) => n + (zahlAus(w.km) || 0), 0) * 10) / 10 }

  // Tiere gesehen (Album samt „Lebend gesehen“)
  const alb = album(js)
  if (alb.artenGesamt) b.tiere = { arten: alb.artenGesamt, ausListe: alb.gesehen, liste: alb.gesamt, sichtungen: alb.sichtungen }

  // Heißester Tag
  let heiss = null
  for (const e of js) {
    const t = temperaturAus(e.felder?.temp_celsius)
    if (t != null && (!heiss || t > heiss.grad)) heiss = { grad: t, datum: e.datum || null, ort: normOrt(e.ort) || null }
  }
  if (heiss) b.heissesterTag = heiss

  // Lieblingsort: am häufigsten genannt (Strecken „A → B“ zählen für beide Orte)
  const zaehl = new Map()
  for (const e of js) {
    for (const teil of String(e.ort || '').split(/\s*(?:→|->|–>)\s*/)) {
      const n = normOrt(teil)
      if (n.length < 2) continue
      const k = n.toLowerCase()
      const z = zaehl.get(k) || { name: n, n: 0 }
      z.n++; zaehl.set(k, z)
    }
  }
  const top = [...zaehl.values()].sort((a, c) => c.n - a.n || a.name.localeCompare(c.name, LOCALE))
  if (top.length && top[0].n >= 2 && (top.length === 1 || top[0].n > top[1].n)) b.lieblingsort = { name: top[0].name, mal: top[0].n }

  // Stimmung im Schnitt (1 bis 5)
  const st = js.map((e) => zahlAus(e.felder?.stimmung)).filter((n) => n != null && n > 0)
  if (st.length) b.stimmung = { schnitt: Math.round((st.reduce((a, n) => a + n, 0) / st.length) * 10) / 10, tage: st.length }

  return b
}

/** Hat die Bilanz überhaupt etwas zu zeigen? */
export const bilanzHatDaten = (b) => !!b && Object.keys(b).length > 0

const zahlT = (n) => Math.round(Number(n) || 0).toLocaleString(LOCALE)
const datumT = (d) => {
  if (!d) return ''
  try { return new Date(d + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
}
const stimmungsWort = (s) => t(s >= 4.5 ? 'bestens' : s >= 3.5 ? 'gut' : s >= 2.5 ? 'gemischt' : s >= 1.5 ? 'eher mau' : 'schwer')

/**
 * Kacheln für Ansicht und Druck: [{ id, icon, wert, text, zusatz }]. Reihenfolge fest.
 */
export function bilanzKacheln(b) {
  const k = []
  if (!b) return k
  if (b.reisetage) k.push({ id: 'reisetage', icon: '📅', wert: zahlT(b.reisetage), text: tn(b.reisetage, 'Reisetag', 'Reisetage') })
  if (b.geschrieben) k.push({ id: 'geschrieben', icon: '✍️', wert: zahlT(b.geschrieben), text: tn(b.geschrieben, 'Tag geschrieben', 'Tage geschrieben'),
    zusatz: b.reisetage && b.geschrieben <= b.reisetage ? t('{p} % der Reise', { p: Math.round((b.geschrieben / b.reisetage) * 100) }) : '' })
  if (b.km) k.push({ id: 'km', icon: '🛣️', wert: zahlT(b.km.wert), text: t('km gefahren'), zusatz: b.km.quelle === 'plan' ? t('laut Plan') : '' })
  if (b.kosten?.tank) k.push({ id: 'tank', icon: '⛽', wert: euro(b.kosten.tank.eur), text: t('fürs Tanken'), zusatz: audT(b.kosten.tank.aud) })
  if (b.kosten) k.push({ id: 'kosten', icon: '💰', wert: euro(b.kosten.gesamt.eur), text: t('ausgegeben unterwegs'), zusatz: audT(b.kosten.gesamt.aud) })
  if (b.fotos) k.push({ id: 'fotos', icon: '📸', wert: zahlT(b.fotos), text: tn(b.fotos, 'Foto', 'Fotos') })
  if (b.wanderungen) k.push({ id: 'wanderungen', icon: '🥾', wert: zahlT(b.wanderungen.anzahl), text: tn(b.wanderungen.anzahl, 'Wanderung gemacht', 'Wanderungen gemacht'),
    zusatz: b.wanderungen.km ? t('{km} km zu Fuß', { km: b.wanderungen.km.toLocaleString(LOCALE) }) : '' })
  if (b.tiere) k.push({ id: 'tiere', icon: '🦘', wert: zahlT(b.tiere.arten), text: tn(b.tiere.arten, 'Tierart gesehen', 'Tierarten gesehen'),
    zusatz: t('{a} von {b} im Album', { a: b.tiere.ausListe, b: b.tiere.liste }) })
  if (b.heissesterTag) k.push({ id: 'heiss', icon: '🌡️', wert: `${dezimal(b.heissesterTag.grad)} °C`, text: t('heißester Tag'),
    zusatz: [datumT(b.heissesterTag.datum), b.heissesterTag.ort].filter(Boolean).join(', ') })
  if (b.lieblingsort) k.push({ id: 'lieblingsort', icon: '📍', wert: b.lieblingsort.name, text: t('Lieblingsort'), zusatz: t('{n}× im Logbuch', { n: b.lieblingsort.mal }), lang: true })
  if (b.stimmung) k.push({ id: 'stimmung', icon: '😊', wert: t('{wert} von 5', { wert: dezimal(b.stimmung.schnitt) }), text: t('Stimmung im Schnitt'), zusatz: stimmungsWort(b.stimmung.schnitt) })
  return k
}
