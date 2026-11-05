// Orte im Netz suchen, während man tippt: Photon (OpenStreetMap), bei Ausfall Nominatim.
// Australien steht vorn, gefunden wird weltweit.
import { istEn } from './i18n.js'

const rund = (x) => +(+x).toFixed(5)
const WEG = new Set(['bus_stop', 'stop', 'artwork', 'platform', 'stop_position'])

/** Photon-Antwort in Treffer für die Ortswahl umwandeln. */
export function ausPhoton(d) {
  const gesehen = new Set(), out = []
  for (const f of d?.features || []) {
    const p = f.properties || {}, [lon, lat] = f.geometry?.coordinates || []
    if (!p.name || lat == null || WEG.has(p.osm_value)) continue
    const region = [p.city !== p.name ? p.city : '', p.state, p.country].filter(Boolean).join(', ')
    const k = `${p.name}|${region}`
    if (gesehen.has(k)) continue
    gesehen.add(k)
    out.push({ name: p.name, lat: rund(lat), lon: rund(lon), region, quelle: 'netz' })
  }
  return out.slice(0, 5)
}

async function nominatim(q, signal) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${istEn ? 'en' : 'de'}&q=${encodeURIComponent(q)}`, { signal })
  if (!r.ok) return []
  return (await r.json()).map((t) => ({ name: t.name || t.display_name.split(',')[0], lat: rund(t.lat), lon: rund(t.lon), region: t.display_name.split(', ').slice(1, 4).join(', '), quelle: 'netz' }))
}

export async function sucheOnline(q, signal) {
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=${istEn ? 'en' : 'de'}&lat=-25&lon=134`, { signal })
    if (r.ok) { const t = ausPhoton(await r.json()); if (t.length) return t }
  } catch (e) { if (e?.name === 'AbortError') throw e }
  return nominatim(q, signal)
}
