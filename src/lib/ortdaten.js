// Automatische Orts-Daten (online): Koordinaten + Region via OpenStreetMap-Geocoding,
// Kurzbeschreibung via Wikipedia. Best effort — fehlende Teile bleiben leer.
import { t, istEn } from './i18n.js'

// Wikipedia zuerst in der Sprache der App, dann in der anderen
const SPRACHEN = istEn ? ['en', 'de'] : ['de', 'en']

async function geocode(name) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=${SPRACHEN[0]}&q=${encodeURIComponent(name)}`
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const d = await r.json()
    if (!d?.length) return null
    const t = d[0], a = t.address || {}
    return {
      lat: +(+t.lat).toFixed(5),
      lon: +(+t.lon).toFixed(5),
      region: a.state || a.region || a.county || a.country || '',
    }
  } catch { return null }
}

function kuerze(text, max = 300) {
  if (!text) return ''
  if (text.length <= max) return text
  const schnitt = text.slice(0, max)
  const p = schnitt.lastIndexOf('. ')
  return (p > 120 ? schnitt.slice(0, p + 1) : schnitt.trim() + ' …')
}

// Sucht den passenden Artikel — löst Begriffsklärungsseiten auf
// („Kinglake" → „Kinglake, Victoria"), mit Regions-Kontext.
// Mit Koordinaten zuerst Artikel in der Nähe (10 km), deren Titel zum Namen passt:
// „Margaret River“ fand über die Volltextsuche sonst einen Artikel über eine Person,
// die dort gelebt hat. Treffer der Volltextsuche müssen deshalb im Titel passen.
const seiten = new Map()
const gleich = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
// Wie gut passt ein Artikeltitel zum Namen? 0 = gar nicht.
// „Margaret River“ 4, „Margaret River, Western Australia“ 3, „Margaret River Airport“ 2,
// „Shire of Augusta Margaret River“ 1
function titelGuete(titel, name) {
  const roh = String(titel || '').toLowerCase(), a = gleich(titel), b = gleich(name)
  if (!a || !b) return 0
  if (a === b) return 4
  if (roh.startsWith(String(name).toLowerCase() + ',') || roh.startsWith(String(name).toLowerCase() + ' (')) return 3
  if (a.startsWith(b + ' ') || b.startsWith(a + ' ')) return 2
  return b.length > 5 && a.includes(b) ? 1 : 0
}
async function zusammenfassung(lang, titel) {
  const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titel)}`)
  if (!r.ok) return null
  const d = await r.json()
  return d.extract && d.type !== 'disambiguation' ? d : null
}
function wikiSeite(name, lang, kontext, lat, lon) {
  const k = [name, lang, kontext, lat, lon].join('|')
  if (!seiten.has(k)) seiten.set(k, sucheSeite(name, lang, kontext, lat, lon))
  return seiten.get(k)
}
async function sucheSeite(name, lang, kontext, lat, lon) {
  try {
    if (lat != null && lon != null) {
      const g = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=20&format=json&origin=*`)
      if (g.ok) {
        const gj = await g.json()
        // nach Titel-Güte, bei Gleichstand der nähere (Reihenfolge der Geosuche)
        const kand = (gj?.query?.geosearch || []).map((p, i) => ({ titel: p.title, guete: titelGuete(p.title, name), i }))
          .filter((k) => k.guete > 0).sort((x, y) => y.guete - x.guete || x.i - y.i)
        for (const k of kand) {
          const d = await zusammenfassung(lang, k.titel)
          if (d) return { ...d, guete: k.guete }
        }
      }
    }
    const d = await zusammenfassung(lang, name)
    if (d) return { ...d, guete: 4 }
    // Direkter Treffer fehlt oder ist mehrdeutig → Volltextsuche mit Kontext
    const such = encodeURIComponent(`${name} ${kontext || 'Australia'}`)
    const s = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&srsearch=${such}&format=json&origin=*`)
    if (!s.ok) return null
    const sj = await s.json()
    for (const treffer of sj?.query?.search || []) {
      const guete = titelGuete(treffer.title, name)
      if (!guete) continue
      const d2 = await zusammenfassung(lang, treffer.title)
      if (d2) return { ...d2, guete }
    }
    return null
  } catch { return null }
}

async function wikiText(name, lang, kontext, lat, lon) {
  const d = await wikiSeite(name, lang, kontext, lat, lon)
  return d?.extract ? kuerze(d.extract.trim()) : ''
}

// ---------- Vorschaubild ----------
// 1. Wahl: Bild des Wikipedia-Artikels. 2. Wahl: Foto aus Wikimedia Commons
// in der Nähe der Koordinaten (Geosuche). Wird lokal als verkleinertes
// Bild gespeichert → funktioniert danach auch offline.
import { macheThumbnail } from './thumbnail.js'

async function wikiBild(name, lang, kontext, lat, lon) {
  const d = await wikiSeite(name, lang, kontext, lat, lon)
  const url = d?.originalimage?.source || d?.thumbnail?.source || ''
  if (!url) return null
  const datei = decodeURIComponent(url.split('?')[0].split('/').pop() || '')
  if (/\.svg$/i.test(datei) || BILD_TABU.test(datei)) return null    // Lagekarten, Wappen, Schilder
  return { url, guete: d.guete || 0 }
}

// Unpassende Motive: Katastrophen-, Schilder-, Karten- und Belegfotos.
// (Für Kinglake lieferte die reine Nächster-Treffer-Suche sonst Buschbrand-Bilder.)
const BILD_TABU = /(bushfire|wildfire|fire|burn|flood|damage|destroy|crash|accident|wreck|memorial|grave|cemetery|funeral|protest|map|diagram|chart|graph|logo|coat.of.arms|flag|sign|plaque|signpost|roadsign|portrait|specimen|herbarium|atlas|locator|location|\blga\b|_lga_|lga_|seal|wappen|karte)/i
// Nichtssagende Datei- und Belegnamen („GCMP sample photo 2097", „IMG_4711", „DSC01234").
const BILD_MUELL = /(sample.?photo|\bgcmp\b|\bimg[_-]?\d|\bdsc[_-]?\d|\bp\d{6,}|screenshot|scan\b|\bfig(ure)?[._ ]?\d)/i
// Naturaufnahmen sind als Vorschaubild meist am besten.
const BILD_BONUS = /(national.?park|waterfall|beach|lake|river|valley|lookout|view|panorama|landscape|sunset|coast|mountain|forest|town|main.?street|esplanade|jetty|pier|harbour|marina|skyline)/i
// Arten-Belegfotos („Varanus varius …", „Tremella fuciformis …") sind kein Ortsbild.
const BILD_ART = /^[A-Z][a-z]{2,}\s[a-z]{3,}\b|molting|juvenile|male|female|subsp\.|\bvar\./

/** Bestes Foto in der Nähe als { quelle, punkte, titel } — oder null. */
async function commonsBildUrl(lat, lon, name) {
  if (lat == null || lon == null) return null
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
      + '&generator=geosearch&ggsnamespace=6&ggslimit=20&ggsradius=10000'   // 10 km = API-Maximum
      + `&ggscoord=${lat}|${lon}&prop=imageinfo&iiprop=url|size&iiurlwidth=1200`
    const r = await fetch(url)
    if (!r.ok) return ''
    const d = await r.json()
    const kandidaten = []
    for (const p of Object.values(d?.query?.pages || {})) {
      const info = p.imageinfo?.[0]
      const quelle = info?.thumburl || info?.url || ''
      if (!/\.(jpg|jpeg|png|webp)$/i.test(quelle)) continue      // keine SVG/PDF
      const titel = (p.title || '').replace(/^File:/, '')
      if (BILD_TABU.test(titel)) continue                        // unpassende Motive raus
      if (BILD_MUELL.test(titel)) continue                       // nichtssagende Dateinamen raus
      let punkte = 0
      if (name && titel.toLowerCase().includes(String(name).toLowerCase())) punkte += 10
      if (BILD_BONUS.test(titel)) punkte += 4
      if ((info?.width || 0) >= 1200) punkte += 1                // ordentliche Auflösung
      if (BILD_ART.test(titel)) punkte -= 12                     // Tier-/Pflanzen-Belegfoto
      if ((info?.width || 0) < (info?.height || 0)) punkte -= 1   // Hochformat passt schlecht ins Kartenbild
      kandidaten.push({ quelle, punkte, titel })
    }
    if (!kandidaten.length) return null
    kandidaten.sort((a, b) => b.punkte - a.punkte)
    return kandidaten[0]
  } catch { return null }
}

async function alsBild(url) {
  if (!url) return ''
  try {
    const r = await fetch(url)
    if (!r.ok) return ''
    const blob = await r.blob()
    if (!blob.type.startsWith('image/')) return ''
    return await macheThumbnail(blob, 900, 0.8) // klein & offline-tauglich
  } catch { return '' }
}

/** Vorschaubild für einen Ort holen.
 *  Ein Foto aus der Umgebung (Commons-Geosuche) ist meist am treffendsten — aber nur,
 *  wenn es erkennbar zum Ort gehört. Sonst hat der Wikipedia-Artikel das bessere Bild:
 *  bei Coral Bay etwa liefert die Umkreissuche nur Riff-Belegfotos aus dem Ningaloo Reef.
 */
export async function holeOrtsbild(name, lat, lon, kontext) {
  const n = (name || '').trim()
  const nah = await commonsBildUrl(lat, lon, n)
  if (nah && nah.punkte >= 4) return await alsBild(nah.quelle)   // Name getroffen oder klares Landschaftsmotiv

  // Bild aus dem besser passenden Artikel, egal in welcher Sprache
  const kand = []
  if (n) for (const l of SPRACHEN) { const b = await wikiBild(n, l, kontext, lat, lon); if (b) kand.push(b) }
  kand.sort((a, b) => b.guete - a.guete)
  if (kand.length) return await alsBild(kand[0].url)
  return nah ? await alsBild(nah.quelle) : ''                    // lieber irgendein Ortsfoto als keins
}

/** Liefert { lat, lon, region, beschreibung, bildData } (best effort, nur online).
    Mit opt.lat/opt.lon (z. B. aus einem Vorschlag) entfällt die Suche nach Koordinaten. */
export async function holeOrtsdaten(name, opt = {}) {
  const n = (name || '').trim()
  if (!n) return {}
  const geo = opt.lat != null && opt.lon != null ? null : await geocode(n)
  const out = { ...(geo || {}) }
  const kontext = opt.kontext || out.region || 'Australia'
  const lat = opt.lat ?? out.lat, lon = opt.lon ?? out.lon
  out.beschreibung = (await wikiText(n, SPRACHEN[0], kontext, lat, lon)) || (await wikiText(n, SPRACHEN[1], kontext, lat, lon))
  if (opt.mitBild !== false) out.bildData = await holeOrtsbild(n, lat, lon, kontext)
  return out
}

// ---------- Vorschläge beim Anlegen eines Orts ----------
// OpenStreetMap (Nominatim) mit Ortstyp, damit man den richtigen Treffer erkennt
// („Margaret River · Stadt · Western Australia“ oder „· Fluss“). Nur Australien.
// Nominatim erlaubt höchstens eine Anfrage pro Sekunde: die Eingabe wartet deshalb,
// bis eine halbe Sekunde nicht mehr getippt wurde (siehe OrtNeu.svelte).
const ARTEN = {
  place: { city: ['Stadt', '🏙️'], town: ['Stadt', '🏘️'], village: ['Ort', '🏘️'], hamlet: ['Weiler', '🏘️'], suburb: ['Stadtteil', '🏘️'], city_district: ['Bezirk', '🏘️'], municipality: ['Gemeinde', '🏘️'], locality: ['Gegend', '📍'], island: ['Insel', '🏝️'], islet: ['Insel', '🏝️'] },
  natural: { beach: ['Strand', '🏖️'], peak: ['Berg', '⛰️'], ridge: ['Bergrücken', '⛰️'], bay: ['Bucht', '🌊'], cape: ['Kap', '🌊'], reef: ['Riff', '🐠'], cliff: ['Klippe', '🪨'], rock: ['Fels', '🪨'], cave_entrance: ['Höhle', '🕳️'], spring: ['Quelle', '💧'], hot_spring: ['Heiße Quelle', '♨️'], water: ['Gewässer', '💧'], gorge: ['Schlucht', '🏞️'], valley: ['Tal', '🏞️'], dune: ['Düne', '🏜️'], sand: ['Sand', '🏜️'], wood: ['Wald', '🌲'] },
  waterway: { waterfall: ['Wasserfall', '💦'], river: ['Fluss', '🏞️'], stream: ['Bach', '🏞️'] },
  boundary: { national_park: ['Nationalpark', '🏞️'], protected_area: ['Schutzgebiet', '🏞️'] },
  leisure: { nature_reserve: ['Naturschutzgebiet', '🏞️'], park: ['Park', '🌳'] },
  tourism: { attraction: ['Sehenswürdigkeit', '⭐'], viewpoint: ['Aussichtspunkt', '👀'], camp_site: ['Campingplatz', '⛺'], caravan_site: ['Caravanpark', '🚐'], museum: ['Museum', '🏛️'], picnic_site: ['Picknickplatz', '🧺'], zoo: ['Tierpark', '🦘'], artwork: ['Kunstwerk', '🎨'], hotel: ['Unterkunft', '🏨'], motel: ['Unterkunft', '🏨'] },
  man_made: { lighthouse: ['Leuchtturm', '🗼'], pier: ['Steg', '🌊'] },
  historic: { '*': ['Historischer Ort', '🏛️'] },
  craft: { winery: ['Weingut', '🍷'] },
}
function artVon(klasse, typ, adresstyp) {
  // Gemeindegrenzen („boundary/administrative“) sind meist der Ort selbst: Typ aus der Adresse
  if (klasse === 'boundary' && typ === 'administrative') return ARTEN.place[adresstyp] || null
  const k = ARTEN[klasse]
  return (k && (k[typ] || k['*'])) || null
}

/** Vorschläge für einen eingetippten Ortsnamen: [{ name, zusatz, lat, lon, gebiet, emoji, art }] */
export async function ortVorschlaege(q, { signal, limit = 8 } = {}) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&countrycodes=au'
    + `&limit=${limit}&accept-language=${SPRACHEN[0]}&q=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!r.ok) throw new Error('Nominatim ' + r.status)
  const d = await r.json()
  const gesehen = new Set()
  const out = []
  for (const x of d || []) {
    const a = x.address || {}
    const klasse = x.category || x.class, typ = x.type
    if (klasse === 'highway' || klasse === 'building' || klasse === 'shop' || klasse === 'office') continue   // Straßen und Häuser sind keine Reiseorte
    const name = x.name || x.namedetails?.name || String(x.display_name || '').split(',')[0]
    if (!name) continue
    const art = artVon(klasse, typ, x.addresstype)
    const nahe = a.town || a.city || a.village || a.hamlet || a.suburb || ''
    const gebiet = a.state || a.territory || ''
    const zusatz = [art ? t(art[0]) : '', nahe && nahe !== name ? nahe : '', gebiet].filter(Boolean).join(' · ')
    const lat = +(+x.lat).toFixed(5), lon = +(+x.lon).toFixed(5)
    // Flüsse und Bäche bestehen aus vielen Abschnitten: je Name, Typ, Nachbarort und Staat nur einmal
    const k = [name.toLowerCase(), art?.[0] || klasse + typ, nahe, gebiet].join('|')
    if (gesehen.has(k)) continue
    gesehen.add(k)
    out.push({ name, zusatz, lat, lon, gebiet, emoji: art ? art[1] : '📍', art: art ? art[0] : '' })
  }
  return out
}
