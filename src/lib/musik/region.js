// Musik unterwegs: Wo bin ich, und ist das ein neuer Ort? (LocationService)
//
// Reine Funktionen. Die Position kommt aus standort.js (GPS, nur mit Freigabe) oder von
// Hand. Einer Position wird eine Region zugeordnet, in dieser Reihenfolge:
//   stadt       – ein Ort aus der Sammlung mit Typ Stadt höchstens `stadtKm` entfernt
//   region      – der nächste Ort der Sammlung im Suchradius (dessen Region/Abschnitt)
//   bundesstaat – grob über Längen- und Breitengrade (WA, NT, SA, QLD, NSW, VIC, TAS)
//   land        – außerhalb Australiens: das Land (soweit bekannt), sonst „unbekannt"
// Die Zuordnung zum Bundesstaat ist eine Näherung über Rechtecke. Für die Musiksuche
// reicht das; als Grenze im Sinne der Landkarte taugt es nicht.
import { t, jeSprache } from '../i18n.js'

const R = 6371
export function km(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export const STAATEN = jeSprache(() => ([
  { id: 'TAS', name: t('Tasmanien'), test: (la, lo) => la < -39.4 && lo > 143 && lo < 149 },
  { id: 'WA', name: t('Westaustralien'), test: (la, lo) => lo >= 112 && lo < 129 },
  { id: 'NT', name: t('Northern Territory'), test: (la, lo) => lo >= 129 && lo < 138 && la >= -26 },
  { id: 'SA', name: t('Südaustralien'), test: (la, lo) => lo >= 129 && lo < 141 && la < -26 },
  { id: 'QLD', name: t('Queensland'), test: (la, lo) => lo >= 138 && la >= -29 },
  { id: 'VIC', name: t('Victoria'), test: (la, lo) => lo >= 141 && lo < 150.2 && la < -34 && la >= -39.4 && !(lo > 148 && la > -37.5) },
  { id: 'NSW', name: t('New South Wales'), test: (la, lo) => lo >= 141 && la < -29 && la >= -37.6 },
]))
const IN_AUSTRALIEN = (la, lo) => lo > 112 && lo < 154.5 && la < -9.5 && la > -44

export function staatFuer({ lat, lon }) {
  if (!IN_AUSTRALIEN(lat, lon)) return null
  return STAATEN.find((s) => s.test(lat, lon)) || null
}

/**
 * @param pos    { lat, lon }
 * @param orte   Orte der Sammlung [{ id, name, lat, lon, region?, abschnitt?, typ? }]
 * @param opt    { stadtKm, suchRadiusKm }
 * @returns { id, name, ebene, staat, land, naechsterOrt }
 */
export function regionFuer(pos, orte = [], { stadtKm = 25, suchRadiusKm = 50 } = {}) {
  const staat = staatFuer(pos)
  let naechster = null, naechsterKm = Infinity
  for (const o of orte) {
    if (o.lat == null || o.lon == null) continue
    const d = km(pos, o)
    if (d < naechsterKm) { naechster = o; naechsterKm = d }
  }
  const land = staat ? 'AU' : null
  if (naechster && naechsterKm <= stadtKm && /stadt|city|town/i.test(naechster.typ || '')) {
    return { id: 'stadt:' + naechster.id, name: naechster.name, ebene: 'stadt', staat: staat?.id || null, land, naechsterOrt: naechster.name, abstandKm: Math.round(naechsterKm) }
  }
  if (naechster && naechsterKm <= suchRadiusKm) {
    const name = naechster.region || naechster.abschnitt || naechster.name
    return { id: 'region:' + name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-'), name, ebene: 'region', staat: staat?.id || null, land, naechsterOrt: naechster.name, abstandKm: Math.round(naechsterKm) }
  }
  if (staat) return { id: 'staat:' + staat.id, name: staat.name, ebene: 'bundesstaat', staat: staat.id, land, naechsterOrt: naechster?.name || null, abstandKm: naechster ? Math.round(naechsterKm) : null }
  return { id: 'land:unbekannt', name: t('außerhalb Australiens'), ebene: 'land', staat: null, land: null, naechsterOrt: null, abstandKm: null }
}

/**
 * Lohnt eine neue Suche? Nein bei kleinen GPS-Schwankungen und zu kurz hintereinander.
 * Ja, wenn die Region wechselt (und die Mindestzeit um ist) oder man weit genug gefahren ist.
 */
export function relevanterWechsel(letzter, jetzt, region, { mindestAbstandM = 10000, mindestAbstandMin = 30 } = {}) {
  if (!letzter) return { ja: true, grund: t('erster Standort') }
  const minuten = (jetzt.zeit - letzter.zeit) / 60000
  if (minuten < mindestAbstandMin) return { ja: false, grund: t('erst {round} min seit der letzten Suche', { round: Math.round(minuten) }) }
  if (region && letzter.regionId && region.id !== letzter.regionId) return { ja: true, grund: t('neue Region') }
  const meter = km(letzter, jetzt) * 1000
  if (meter >= mindestAbstandM) return { ja: true, grund: t('{round} km weiter', { round: Math.round(meter / 1000) }) }
  return { ja: false, grund: t('nur {round} km bewegt', { round: Math.round(meter / 1000) }) }
}

/** Reihenfolge, in der Quellen gefragt werden: erst die genaueste Ebene, dann gröber. */
export function ebenenFolge(region) {
  const alle = ['stadt', 'region', 'weit', 'bundesstaat', 'national']
  const start = { stadt: 0, region: 1, bundesstaat: 3, land: 4 }[region?.ebene] ?? 4
  return alle.slice(start)
}
