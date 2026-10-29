// Musik unterwegs: Wie heißt der Ort hier? Für Standorte außerhalb Australiens (Anreise,
// Zwischenstopps, Test zu Hause), wo die Ortssammlung der App nicht hilft.
// Quelle: OpenStreetMap Nominatim (umgekehrte Suche), höchstens ein Abruf je Suchlauf.
// Namen auf Englisch, weil MusicBrainz seine Gebiete so führt (Munich, Cologne).
import { t } from '../i18n.js'

const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Antwort von Nominatim → Region im Format von regionFuer(); null, wenn kein Ort erkennbar. */
export function regionAusAdresse(j) {
  const a = j?.address || {}
  const ort = a.city || a.town || a.village || a.municipality || a.county
  const land = (a.country_code || '').toUpperCase()
  if (!ort || !land) return null
  return {
    id: `welt:${land.toLowerCase()}:${slug(ort)}`, name: ort, ebene: 'stadt',
    staat: null, staatName: a.state || null, land, landName: a.country || null,
    naechsterOrt: null, abstandKm: null, welt: true,
  }
}

const R = 6371, RAD = Math.PI / 180
const kmZwischen = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin((b.lat - a.lat) * RAD / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin((b.lon - a.lon) * RAD / 2) ** 2))
export const NAH_KM = 35

/** Orte im Umkreis in zwei Ringen, je größte zuerst:
    nah  = Städte und Kleinstädte bis 35 km (dazu der Kreis, „Kreis Plön“ → Plön)
    weit = Städte und größere Orte (ab 15.000 Einwohnern) bis zum eingestellten Umkreis.
    Damit findet die Musiksuche auch in Dörfern wie Mönkeberg etwas. */
export function umgebungAus(elemente = [], { eigener = '', kreis = '', pos = null, radiusKm = 200 } = {}) {
  const k = String(kreis || '').replace(/^(?:kreis|landkreis|district of)\s+/i, '').trim()
  const alle = (elemente || []).filter((e) => e?.tags?.name).map((e) => ({
    name: e.tags['name:en'] || e.tags.name,
    stadt: e.tags.place === 'city',
    ew: Number(String(e.tags.population || '').replace(/\D/g, '')) || (e.tags.place === 'city' ? 100000 : 5000),
    km: e.km != null ? Number(e.km) : pos && e.lat != null ? kmZwischen(pos, { lat: e.lat, lon: e.lon }) : 0,
  })).filter((x) => x.name.toLowerCase() !== String(eigener).toLowerCase() && x.km <= radiusKm)
  const nachGroesse = (a, b) => b.ew - a.ew
  const nah = [...new Set([...alle.filter((x) => x.km <= NAH_KM).sort(nachGroesse).map((x) => x.name), k].filter(Boolean))]
    .filter((n) => n.toLowerCase() !== String(eigener).toLowerCase())
  const weit = [...new Set(alle.filter((x) => x.km > NAH_KM && (x.stadt || x.ew >= 15000)).sort(nachGroesse).map((x) => x.name))]
    .filter((n) => !nah.includes(n)).slice(0, 25)
  return { nah, weit }
}

/** Overpass: Städte und Kleinstädte im Umkreis. Ist oft überlastet (504), daher kurzer Zeitrahmen. */
async function ausOverpass({ lat, lon }, radiusKm, { f, signal }) {
  const q = `[out:json][timeout:20];node["place"~"^(city|town)$"](around:${Math.round(radiusKm * 1000)},${lat.toFixed(4)},${lon.toFixed(4)});out;`
  const o = await f('https://overpass-api.de/api/interpreter', { method: 'POST', signal: zeitrahmen(signal, 25000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) })
  if (!o.ok) throw new Error(t('Overpass antwortet mit {status}', { status: o.status }))
  const j = await o.json().catch(() => null)
  if (!j?.elements) throw new Error(t('Overpass liefert keine Daten'))
  return j.elements
}

/** Wikidata: Orte mit Einwohnerzahl im Umkreis (Ersatz, wenn Overpass nicht antwortet). */
export function wikidataAbfrage({ lat, lon }, radiusKm) {
  return `SELECT ?ort (SAMPLE(?l) AS ?name) (MAX(?ew) AS ?einw) (MIN(?d) AS ?km) WHERE {
  SERVICE wikibase:around { ?ort wdt:P625 ?k . bd:serviceParam wikibase:center "Point(${lon.toFixed(4)} ${lat.toFixed(4)})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${Math.round(radiusKm)}" . bd:serviceParam wikibase:distance ?d . }
  ?ort wdt:P1082 ?ew . FILTER(?ew >= 15000 || (?d <= ${NAH_KM} && ?ew >= 2000))
  ?ort wdt:P31/wdt:P279* wd:Q486972 .
  ?ort rdfs:label ?l . FILTER(LANG(?l) = "en")
} GROUP BY ?ort ORDER BY DESC(?einw) LIMIT 250`
}
export function wikidataElemente(j) {
  return (j?.results?.bindings || []).map((b) => {
    const ew = Number(b.einw?.value) || 0
    return { tags: { name: b.name?.value, place: ew >= 100000 ? 'city' : 'town', population: String(ew) }, km: Number(b.km?.value) || 0 }
  }).filter((e) => e.tags.name)
}
async function ausWikidata(pos, radiusKm, { f, signal }) {
  const u = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(wikidataAbfrage(pos, radiusKm))
  const r = await f(u, { signal: zeitrahmen(signal, 40000), headers: { Accept: 'application/sparql-results+json' } })
  if (!r.ok) throw new Error(t('Wikidata antwortet mit {status}', { status: r.status }))
  return wikidataElemente(await r.json())
}

function zeitrahmen(signal, ms) {
  try { const t = AbortSignal.timeout(ms); return signal && AbortSignal.any ? AbortSignal.any([signal, t]) : t } catch { return signal }
}

// Zwischenspeicher je Raster von etwa 10 km: einmal gefunden, gilt der Umkreis 90 Tage,
// auch ohne Netz (Outback).
const UMKREIS_KEY = 'tb-musik-umkreis'
const rasterKey = ({ lat, lon }, radiusKm) => `${lat.toFixed(1)},${lon.toFixed(1)},${radiusKm}`
function ausSpeicher(key) {
  try { const e = JSON.parse(localStorage.getItem(UMKREIS_KEY) || '{}')[key]; if (e && Date.now() - e.zeit < 90 * 864e5) return e } catch {}
  return null
}
function inSpeicher(key, wert) {
  try {
    const alle = JSON.parse(localStorage.getItem(UMKREIS_KEY) || '{}')
    alle[key] = { ...wert, zeit: Date.now() }
    const keys = Object.keys(alle).sort((a, b) => alle[b].zeit - alle[a].zeit).slice(0, 60)
    localStorage.setItem(UMKREIS_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, alle[k]]))))
  } catch {}
}

/** Umkreis für eine Position: erst Zwischenspeicher, dann Overpass, dann Wikidata.
    Antwortet keiner, bleibt wenigstens der Kreis (nah) und quelle 'keine'. */
export async function umgebungFuer(pos, { f = fetch, signal, radiusKm = 200, eigener = '', kreis = '' } = {}) {
  const key = rasterKey(pos, radiusKm)
  const alt = ausSpeicher(key)
  if (alt?.nah) return { ...umgebungAus([], { eigener, kreis }), ...alt, nah: [...new Set([...alt.nah, ...umgebungAus([], { kreis }).nah])].filter((n) => n.toLowerCase() !== String(eigener).toLowerCase()), quelle: 'speicher' }
  const fehler = []
  for (const [name, holen] of [['Overpass', ausOverpass], ['Wikidata', ausWikidata]]) {
    try {
      const el = await holen(pos, radiusKm, { f, signal })
      if (!el.length) { fehler.push(name + t(': nichts gefunden')); continue }
      const um = umgebungAus(el, { eigener, kreis, pos, radiusKm })
      inSpeicher(key, { nah: um.nah, weit: um.weit })
      return { ...um, quelle: name }
    } catch (e) { fehler.push(`${name}: ${e.message}`) }
  }
  return { ...umgebungAus([], { eigener, kreis }), quelle: 'keine', fehler }
}

export async function ortFuerPosition({ lat, lon }, { f = fetch, signal } = {}) {
  const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`
  const r = await f(u, { signal, headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(t('Ortssuche antwortet mit {status}', { status: r.status }))
  const j = await r.json()
  const region = regionAusAdresse(j)
  if (region) region.kreis = j.address?.county || null
  return region
}
