// Amtliche Warnungen — drei Bundesstaaten, alle direkt aus dem Browser abrufbar
// (CORS erlaubt, kein Schlüssel, kein eigener Server nötig; am 02.08.2026 live geprüft).
//
//   WA   DFES / EmergencyWA      Polygone
//   VIC  VicEmergency OSOM       Polygone + Punkte, dazu Fire Danger Rating & Total Fire Ban
//   QLD  QFD OCS Warnings        Polygone (ArcGIS, f=geojson)
//   QLD  Severe Weather/Flut/Zyklon (ArcGIS) — wichtig für Cairns in der Zyklonsaison
//
// Anders als früher zählt nicht mehr nur „Punkt liegt im Warngebiet". Für einen Roadtrip
// ist die ENTFERNUNG entscheidend: ein Feuer 60 km die Straße hoch geht einen etwas an.
// Deshalb liefert jede Warnung eine Abstandsrechnung (0 km = man steht mitten drin).
import { t } from './i18n.js'

const QUELLEN = [
  {
    id: 'wa', staat: 'WA', name: t('DFES Westaustralien'),
    url: 'https://api.emergency.wa.gov.au/v1/warnings',
    lies: liesWA,
  },
  {
    id: 'vic', staat: 'VIC', name: 'VicEmergency',
    url: 'https://emergency.vic.gov.au/public/osom-geojson.json',
    lies: liesVIC,
  },
  {
    id: 'qld', staat: 'QLD', name: t('Queensland Fire Department'),
    url: 'https://services1.arcgis.com/vkTwD8kHw2woKBqV/arcgis/rest/services/OCSWarnings_PublicView/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson',
    lies: liesQLD,
  },
  {
    id: 'qld-wetter', staat: 'QLD', name: t('Queensland Unwetter & Zyklon'),
    url: 'https://services-ap1.arcgis.com/4z1c8UDtmlbV0cw9/arcgis/rest/services/Severe_Weather_Flood_Cyclone_Area_Public_View/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson',
    lies: liesQLD,
  },
]

// Australisches Warnsystem: drei Stufen, überall gleich benannt.
const STUFE = {
  3: { label: 'Emergency Warning', farbe: '#c0392b', icon: '🚨' },
  2: { label: 'Watch & Act', farbe: '#e8730c', icon: '⚠️' },
  1: { label: 'Advice', farbe: '#e0a800', icon: 'ℹ️' },
  0: { label: t('Hinweis'), farbe: '#8a7565', icon: '•' },
}
function rangAus(...texte) {
  const s = texte.filter(Boolean).join(' ').toLowerCase()
  if (/emergency\s*warning/.test(s)) return 3
  if (/watch\s*(and|&)?\s*act/.test(s)) return 2
  if (/\badvice\b/.test(s)) return 1
  return 0
}
function ohneHtml(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ---------- Geometrie einsammeln ----------
function ringeAus(geo) {
  const ringe = [], punkte = []
  const eins = (g) => {
    if (!g) return
    if (g.type === 'Polygon') ringe.push(...g.coordinates)
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => ringe.push(...p))
    else if (g.type === 'Point') punkte.push(g.coordinates)
    else if (g.type === 'MultiPoint') punkte.push(...g.coordinates)
    else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(eins)
  }
  if (geo?.type === 'FeatureCollection') (geo.features || []).forEach((f) => eins(f.geometry))
  else eins(geo)
  return { ringe, punkte }
}

// ---------- je Quelle ----------
function liesWA(d) {
  return (d.warnings || [])
    .filter((w) => (w['publishing-status'] || 'Published') === 'Published')
    .map((w) => {
      const g = ringeAus(w['geo-source'])
      const rang = rangAus(w.entitySubType, w['warning-type'])
      return bau({
        id: 'wa:' + w.id, staat: 'WA', rang,
        titel: ohneHtml(w.title || w.headline || w.name || t('Warnung')),
        event: (w['cap-event-type'] || []).join(', ') || w['warning-type'] || '',
        text: ohneHtml(w['alert-line'] || w.headline || ''),
        ort: (w.suburbs || []).join(', '),
        zeit: w['issued-date-time'] || w['published-date-time'] || w.updatedAt,
        ...g,
      })
    })
}

function liesVIC(d) {
  // Der Feed mischt drei Dinge: echte Warnungen, laufende Einsätze und geplante
  // Brandrodungen (58 von 66 Einträgen!). Die Rodungen würden alles zudecken —
  // sie fliegen raus. Kleinkram wie „Tree Down" oder ein Wohnungsbrand ebenso:
  // für jemanden auf Durchreise ist das kein Reisehinweis.
  const UNWICHTIG = /tree down|accident|rescue|building fire|alarm/i
  const warn = (d.features || [])
    .filter((f) => f.properties?.feedType !== 'burn-area')
    .filter((f) => {
      const p = f.properties || {}
      if (p.suppress) return false
      if (UNWICHTIG.test(`${p.category1} ${p.category2} ${p.sourceTitle}`)) return false
      // Feuer und Wetter zählen; Vorfälle nur, solange sie nicht unter Kontrolle sind.
      const relevant = /fire|met|flood|storm|weather/i.test(`${p.category1} ${p.category2}`)
      const erledigt = /under control|safe|complete/i.test(p.status || '')
      return relevant && !erledigt
    })
    .map((f) => {
      const p = f.properties || {}
      const g = ringeAus(f.geometry)
      // In der Feuersaison tragen echte Warnungen webHeadline/webBody und die Stufe
      // im Text. Außerhalb bleibt nur der Einsatzstatus — dann Stufe 1.
      let rang = rangAus(p.webHeadline, p.category2, p.status, p.name)
      if (!rang) rang = /not yet under control|going|out of control/i.test(p.status || '') ? 2 : 1
      return bau({
        id: 'vic:' + (p.id || p.sourceId || p.estaId),
        staat: 'VIC', rang,
        titel: ohneHtml(p.webHeadline || p.name || p.sourceTitle || p.category2 || t('Warnung')),
        event: [p.category1, p.category2].filter(Boolean).join(' · '),
        text: ohneHtml(p.webBody || p.status || ''),
        ort: p.location || '',
        zeit: p.updated || p.created,
        ...g,
      })
    })
  return { warnungen: warn, bedingungen: d.properties?.conditions || null }
}

function liesQLD(d) {
  return (d.features || []).map((f) => {
    const p = f.properties || {}
    const g = ringeAus(f.geometry)
    const ms = Number(p.ModifiedDate || p.last_edited_date || 0)
    return bau({
      id: 'qld:' + (p.UniqueID || p.GlobalID || p.OBJECTID),
      staat: 'QLD', rang: rangAus(p.WarningLevel, p.WarningTitle),
      titel: ohneHtml(p.WarningTitle || p.Header || t('Warnung')),
      event: p.WarningArea || '',
      text: ohneHtml(p.CallToAction || p.WarningText || p.Impacts || p.ShouldDo || ''),
      ort: p.WarningArea || '',
      zeit: ms ? new Date(ms).toISOString() : null,
      ...g,
    })
  })
}

function bau(w) {
  const s = STUFE[w.rang] || STUFE[0]
  return { ...w, level: s.label, farbe: s.farbe, icon: s.icon, ringe: w.ringe || [], punkte: w.punkte || [], linien: w.linien || [] }
}

// ---------- Abruf ----------
/** Holt alle Quellen parallel. Eine kaputte Quelle kippt nicht die anderen. */
export async function holeWarnungen() {
  const ergebnisse = await Promise.allSettled(
    QUELLEN.map(async (q) => {
      const r = await fetch(q.url)
      if (!r.ok) throw new Error(`${q.name}: HTTP ${r.status}`)
      return { q, d: await r.json() }
    })
  )
  const warnungen = []
  const quellenFehler = []
  let bedingungen = null
  for (let i = 0; i < ergebnisse.length; i++) {
    const e = ergebnisse[i]
    if (e.status !== 'fulfilled') { quellenFehler.push(QUELLEN[i].name); continue }
    try {
      const roh = e.value.q.lies(e.value.d)
      if (Array.isArray(roh)) warnungen.push(...roh)
      else { warnungen.push(...(roh.warnungen || [])); if (roh.bedingungen) bedingungen = roh.bedingungen }
    } catch { quellenFehler.push(QUELLEN[i].name) }
  }
  warnungen.sort((a, b) => b.rang - a.rang)
  warnungen.quellenFehler = quellenFehler
  warnungen.bedingungen = bedingungen
  return warnungen
}

/** Auffällige Fire-Danger-/Total-Fire-Ban-/Hitze-Angaben aus dem VIC-Feed. */
export function auffaelligeBedingungen(bed) {
  if (!bed) return []
  const HARMLOS = /^(no forecast|no - restrictions may apply|not declared|none|no)$/i
  const raus = []
  for (const [art, titel] of [['fdr', t('Waldbrandgefahr')], ['tfb', t('Totales Feuerverbot')], ['heat', t('Hitzewarnung')]]) {
    for (const [distrikt, wert] of Object.entries(bed[art] || {})) {
      if (!wert || HARMLOS.test(String(wert).trim())) continue
      raus.push({ art, titel, distrikt, wert: String(wert) })
    }
  }
  return raus
}

// ---------- Entfernung ----------
const GRAD_KM = 111.32

function imRing(lon, lat, ring) {
  let drin = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    if (((yi > lat) !== (yj > lat)) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) drin = !drin
  }
  return drin
}

// Abstand Punkt→Strecke in der lokalen Ebene (Längengrade mit cos(lat) gestaucht).
// Für Entfernungen bis einige hundert Kilometer genau genug.
function abstandZuStrecke(lat, lon, a, b, cos) {
  const px = lon * cos, py = lat
  const ax = a[0] * cos, ay = a[1], bx = b[0] * cos, by = b[1]
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * dx, qy = ay + t * dy
  return Math.hypot(px - qx, py - qy) * GRAD_KM
}

/**
 * Kilometer bis zur Warnung. 0 = der Punkt liegt im Warngebiet.
 * Versteht neben Flächen (`ringe`) und Punkten auch Linien (`linien`, z. B.
 * Straßenabschnitte von Main Roads WA): dort Abstand Punkt zu Strecke, nie 0 durch „drin“.
 * Ältere Einträge aus dem Offline-Speicher ohne `linien` funktionieren unverändert.
 */
export function abstandKm(w, lat, lon) {
  const cos = Math.cos((lat * Math.PI) / 180)
  const ringe = w.ringe || [], punkte = w.punkte || [], linien = w.linien || []
  for (const ring of ringe) if (imRing(lon, lat, ring)) return 0
  let min = Infinity
  for (const ring of ringe)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
      min = Math.min(min, abstandZuStrecke(lat, lon, ring[j], ring[i], cos))
  for (const l of linien) {
    if (l.length === 1) min = Math.min(min, Math.hypot((l[0][0] - lon) * cos, l[0][1] - lat) * GRAD_KM)
    for (let i = 1; i < l.length; i++) min = Math.min(min, abstandZuStrecke(lat, lon, l[i - 1], l[i], cos))
  }
  for (const p of punkte)
    min = Math.min(min, Math.hypot((p[0] - lon) * cos, p[1] - lat) * GRAD_KM)
  return min
}

/** Liegt der Punkt IM Warngebiet? (unverändertes Verhalten von früher) */
export function betrifftOrt(w, lat, lon) {
  return (w.ringe || []).some((ring) => imRing(lon, lat, ring))
}

/** Liegt der Punkt im Warngebiet ODER höchstens `km` daneben? */
export function imUmkreis(w, lat, lon, km) {
  return abstandKm(w, lat, lon) <= km
}

/**
 * Wichtigste Warnung für einen Punkt innerhalb des Umkreises.
 * Erst nach Stufe, bei gleicher Stufe nach Nähe. Liefert `{...warnung, km}`.
 */
export function warnungFuer(warnungen, lat, lon, umkreisKm = 0) {
  let beste = null
  for (const w of warnungen || []) {
    const km = abstandKm(w, lat, lon)
    if (km > umkreisKm) continue
    if (!beste || w.rang > beste.rang || (w.rang === beste.rang && km < beste.km)) beste = { ...w, km }
  }
  return beste
}

/** Alle Warnungen im Umkreis, wichtigste zuerst — jeweils mit `km`. */
export function warnungenFuer(warnungen, lat, lon, umkreisKm = 0) {
  return (warnungen || [])
    .map((w) => ({ ...w, km: abstandKm(w, lat, lon) }))
    .filter((w) => w.km <= umkreisKm)
    .sort((a, b) => b.rang - a.rang || a.km - b.km)
}

/** Warnungen entlang einer Route (Geometrie [[lon,lat], …]) im Umkreis. */
export function warnungenAnRoute(warnungen, geometrie, umkreisKm = 0, schritt = 6) {
  const treffer = new Map()
  for (const w of warnungen || []) {
    let min = Infinity
    for (let i = 0; i < geometrie.length; i += schritt) {
      const km = abstandKm(w, geometrie[i][1], geometrie[i][0])
      if (km < min) min = km
      if (min === 0) break
    }
    if (min <= umkreisKm) treffer.set(w.id, { ...w, km: min })
  }
  return [...treffer.values()].sort((a, b) => b.rang - a.rang || a.km - b.km)
}
